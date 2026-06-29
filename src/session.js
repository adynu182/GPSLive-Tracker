import { db } from '../firebase-config.js';
import {
  ref, set, onValue, onDisconnect,
  serverTimestamp, remove, get,
} from 'firebase/database';
import { state } from './state.js';
import { COLORS, FIXED_ROOM, genId, safeColor } from './constants.js';
import { saveUserData, getDeviceId } from './storage.js';
import { showToast, showConnectionStatus, renderMembers, updateDistances, cancelFollow } from './ui.js';
import { initMap, updateMarker } from './map.js';
import { startGPS } from './gps.js';

// ─── Fullscreen ───────────────────────────────────────────────────
// Harus dipanggil dalam user-gesture (onclick) agar browser mengizinkan.
export function enterFullscreen() {
  const el  = document.documentElement;
  const rfs = el.requestFullscreen
    || el.webkitRequestFullscreen
    || el.mozRequestFullScreen
    || el.msRequestFullscreen;
  if (rfs) {
    rfs.call(el).catch(err => {
      // Gagal di iOS Safari — PWA meta sudah menanganinya
      console.info('Fullscreen not supported or denied:', err.message);
    });
  }
}

// Sembunyikan/tampilkan tombol ⛶ sesuai status fullscreen saat ini.
export function syncFullscreenBtn() {
  const inFS = !!(
    document.fullscreenElement
    || document.webkitFullscreenElement
    || document.mozFullScreenElement
    || document.msFullscreenElement
  );
  const btn = document.getElementById('fullscreenBtn');
  if (btn && state.myId) {
    btn.style.display = inFS ? 'none' : 'flex';
  }
}

// ─── Wake Lock ────────────────────────────────────────────────────
// Cegah layar redup/mati selama sesi aktif.
export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (state.wakeLock) return; // sudah aktif
    state.wakeLock = await navigator.wakeLock.request('screen');
    state.wakeLock.addEventListener('release', () => { state.wakeLock = null; });
  } catch (err) {
    // Bisa gagal saat baterai kritis atau browser tidak izinkan
    console.info('Wake lock failed:', err.message);
  }
}

export function releaseWakeLock() {
  if (state.wakeLock) { state.wakeLock.release(); state.wakeLock = null; }
}

// ─── Tab detection (BroadcastChannel) ────────────────────────────
// Mencegah user membuka dua tab aktif sekaligus.
// initTabDetection() dipanggil saat page load (sebelum login),
// tapi isTabActive baru di-set true setelah startSession() berhasil.
export function initTabDetection() {
  try {
    state.broadcastChannel = new BroadcastChannel('lokasi_bareng_tab');
    state.broadcastChannel.onmessage = (event) => {
      if (event.data.type === 'TAB_ACTIVE') {
        // Tab lain baru aktif — jika tab ini sudah aktif, minta tab baru keluar
        if (state.isTabActive && state.myId) {
          state.broadcastChannel.postMessage({ type: 'CLOSE_DUPLICATE' });
        }
      } else if (event.data.type === 'CLOSE_DUPLICATE') {
        showDuplicateTabWarning();
      } else if (event.data.type === 'LOGOUT') {
        performLogout();
      }
    };
  } catch (e) {
    console.warn('BroadcastChannel tidak tersedia');
  }
}

function showDuplicateTabWarning() {
  document.getElementById('duplicateTabOverlay').classList.add('show');
}

// ─── Logout ───────────────────────────────────────────────────────
export function performLogout() {
  console.log('🚪 Performing logout...');
  releaseWakeLock();

  // Hapus nama & emoji dari localStorage (form kosong saat login lagi)
  // Warna sengaja tidak dihapus agar user dapat warna yang sama berikutnya
  localStorage.removeItem('lokasi_name');
  localStorage.removeItem('lokasi_emoji');

  if (state.myId && state.roomId) {
    remove(ref(db, `rooms/${state.roomId}/members/${state.myId}`));
  }

  if (state.watchId) navigator.geolocation.clearWatch(state.watchId);
  if (state.simIntervalId) { clearInterval(state.simIntervalId); state.simIntervalId = null; }

  const u = new URL(location);
  u.searchParams.delete('room');
  history.replaceState({}, '', u.toString());

  showToast('👋 Berhasil logout');
  setTimeout(() => location.reload(), 1000);
}

export function handleLogout() {
  if (state.broadcastChannel) {
    state.broadcastChannel.postMessage({ type: 'LOGOUT' });
  }
  performLogout();
}

// ─── Start Tracking ───────────────────────────────────────────────
// Entry point dari tombol "Mulai Bagikan Lokasi".
// Memeriksa nama duplikat di Firebase sebelum membuat sesi.
export async function startTracking() {
  if (!db) {
    showToast('⚠️ Firebase belum siap. Isi konfigurasi VITE_FIREBASE_* terlebih dahulu.');
    return;
  }

  const name = document.getElementById('nameInput').value.trim();
  if (!name) { showToast('⚠️ Masukkan nama kamu dulu!'); return; }

  // Harus dipanggil sebelum await — browser hanya izinkan fullscreen dalam user gesture sinkron
  enterFullscreen();
  requestWakeLock();

  const btn          = document.querySelector('.primary-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<div class="loader-wrap" style="padding:0; flex-direction:row;">'
    + '<div class="spinner" style="width:16px;height:16px;border-width:2px;"></div>'
    + ' <span style="font-size:0.95rem">Memeriksa...</span></div>';

  try {
    const snapshot = await get(ref(db, `rooms/${FIXED_ROOM}/members`));
    if (snapshot.exists()) {
      const myDevId    = getDeviceId();
      const isNameTaken = Object.values(snapshot.val()).some(m =>
        m.name && m.name.toLowerCase() === name.toLowerCase() && m.deviceId !== myDevId,
      );
      if (isNameTaken) {
        showToast('⚠️ Nama sedang aktif digunakan!');
        btn.disabled  = false;
        btn.innerHTML = originalText;
        return;
      }
    }
  } catch (err) {
    console.error('Gagal memeriksa nama:', err);
  }

  btn.disabled  = false;
  btn.innerHTML = originalText;

  state.myName  = name;
  state.myId    = genId();
  state.roomId  = FIXED_ROOM;
  // FIX: gunakan warna tersimpan jika ada. Generate baru hanya saat pertama kali.
  if (!localStorage.getItem('lokasi_color')) {
    state.myColor = COLORS[state.colorIdx++ % COLORS.length];
  }
  saveUserData();

  document.getElementById('setupSection').style.display  = 'none';
  document.getElementById('loadingSection').style.display = '';
  document.getElementById('loadingText').textContent      = 'Bergabung dengan teman...';
  setTimeout(() => startSession(), 800);
}

// ─── Session ──────────────────────────────────────────────────────
// Inisialisasi peta, tulis presence ke Firebase, pasang listeners.
export function startSession() {
  if (!db) {
    showToast('⚠️ Firebase belum siap. Isi konfigurasi VITE_FIREBASE_* terlebih dahulu.');
    return;
  }

  console.log('🎬 Starting session...', { myId: state.myId, myName: state.myName, roomId: state.roomId });

  // FIX: isTabActive di-set setelah login, bukan saat page load
  state.isTabActive = true;
  if (state.broadcastChannel) {
    state.broadcastChannel.postMessage({ type: 'TAB_ACTIVE' });
  }

  // Tambah ?room= ke URL agar bisa dibagikan (trigger auto-login di tab baru)
  const u = new URL(location);
  u.searchParams.set('room', state.roomId);
  history.replaceState({}, '', u);

  document.getElementById('logoutBtn').style.display = 'flex';
  syncFullscreenBtn();
  document.getElementById('floatingStatus').style.display = 'flex';

  // Init peta dengan callback drag (batalkan follow saat user geser peta)
  initMap(() => {
    if (state.followedUid) {
      cancelFollow();
      showToast('🗺️ Mode ikuti dibatalkan');
    }
  });

  // Pre-assign nomor supaya GPS pertama sudah punya nomor
  if (!state.memberNumbers[state.myId]) {
    state.memberNumbers[state.myId] = state.nextMemberNumber++;
  }

  // Tulis presence ke Firebase + auto-hapus saat disconnect
  const myRef = ref(db, `rooms/${state.roomId}/members/${state.myId}`);
  set(myRef, {
    name:     state.myName,
    emoji:    state.myEmoji,
    color:    state.myColor,
    sharing:  true,
    lat:      null,
    lng:      null,
    ts:       serverTimestamp(),
    deviceId: getDeviceId(),
  });
  onDisconnect(myRef).remove();

  // ── Listener utama: daftar anggota di room ────────────────────
  onValue(ref(db, `rooms/${state.roomId}/members`), snap => {
    const data = snap.val() || {};

    // Handle anggota yang keluar
    Object.keys(state.members).forEach(uid => {
      if (!data[uid] && uid !== state.myId) {
        const member = state.members[uid];
        showToast(`${member.emoji || '🧑'} ${member.name || 'Anggota'} keluar`);
        if (state.markers[uid]) { state.map.removeLayer(state.markers[uid]); delete state.markers[uid]; }
        if (state.trails[uid])  { state.map.removeLayer(state.trails[uid]);  delete state.trails[uid];  }
        delete state.members[uid];
        delete state.trailPts[uid];
      }
    });

    // Handle anggota yang bergabung / update data
    Object.entries(data).forEach(([uid, m]) => {
      if (!state.members[uid] && uid !== state.myId) {
        showToast(`${m.emoji || '🧑'} ${m.name || 'Anggota'} bergabung!`);
        state.trailPts[uid] = [];
      }
      if (!state.memberNumbers[uid]) {
        state.memberNumbers[uid] = state.nextMemberNumber++;
      }

      // OFFLINE GUARD: Firebase bisa kirim data parsial saat reconnect.
      // Pakai ?? agar field yang ada di cache lokal tidak tertimpa null dari server.
      const prev = state.members[uid] || {};
      state.members[uid] = {
        ...prev,
        ...m,
        name:  m.name  ?? prev.name  ?? 'Anggota',
        emoji: m.emoji ?? prev.emoji ?? '🧑',
        color: safeColor(m.color ?? prev.color ?? COLORS[0]), // FIX: validasi hex
        isMe:  uid === state.myId,
      };
      if (m.lat && m.lng) updateMarker(uid);
    });

    renderMembers();
    updateDistances();
    document.getElementById('joinOverlay').classList.remove('show');
  });

  // ── Reconnect handler ─────────────────────────────────────────
  // Saat ganti jaringan, onDisconnect sudah berjalan → node terhapus.
  // Re-write presence saat koneksi kembali.
  onValue(ref(db, '.info/connected'), snap => {
    const connected = snap.val() === true;
    showConnectionStatus(connected);
    if (connected) {
      const myRef = ref(db, `rooms/${state.roomId}/members/${state.myId}`);
      set(myRef, {
        name:     state.myName,
        emoji:    state.myEmoji,
        color:    state.myColor,
        sharing:  state.sharingOn,
        lat:      state.myLat || null,
        lng:      state.myLng || null,
        ts:       serverTimestamp(),
        deviceId: getDeviceId(),
      });
      onDisconnect(myRef).remove();
    }
  });

  startGPS();
}
