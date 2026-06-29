import { EMOJIS, COLORS, FIXED_ROOM, genId } from './constants.js';
import { state } from './state.js';
import { loadUserData, saveUserData, getDeviceId } from './storage.js';
import {
  startTracking, startSession, handleLogout,
  enterFullscreen, syncFullscreenBtn,
  initTabDetection, requestWakeLock,
} from './session.js';
import { toggleSharing } from './gps.js';
import { toggleMembersList, cancelFollow, focusMember, showToast } from './ui.js';
import { db } from '../firebase-config.js';
import { ref, get } from 'firebase/database';

// ─── Muat preferensi tersimpan sebelum apapun ────────────────────
loadUserData();

// ─── Emoji picker ─────────────────────────────────────────────────
function initEmoji() {
  const row = document.getElementById('emojiRow');
  row.innerHTML = '';
  EMOJIS.forEach((e, i) => {
    const d         = document.createElement('div');
    const isSelected = (state.myEmoji && e === state.myEmoji) || (i === 0 && !state.myEmoji);
    d.className  = 'emoji-opt' + (isSelected ? ' selected' : '');
    d.textContent = e;
    d.onclick = () => {
      row.querySelectorAll('.emoji-opt').forEach(x => x.classList.remove('selected'));
      d.classList.add('selected');
      state.myEmoji = e;
    };
    row.appendChild(d);
  });
}
initEmoji();

// ─── Expose ke window untuk inline onclick di HTML ────────────────
// Fungsi-fungsi ini dipanggil dari atribut onclick="..." di index.html.
window.startTracking     = startTracking;
window.handleLogout      = handleLogout;
window.toggleMembersList = toggleMembersList;
window.cancelFollow      = cancelFollow;
window.toggleSharing     = toggleSharing;
window.enterFullscreen   = enterFullscreen;
window.focusMember       = focusMember;

// ─── Fullscreen change listeners ─────────────────────────────────
['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'msfullscreenchange']
  .forEach(ev => document.addEventListener(ev, syncFullscreenBtn));

// ─── Re-acquire wake lock saat halaman aktif kembali ─────────────
// Wake Lock dilepas otomatis oleh browser saat tab ke background.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.myId) {
    requestWakeLock();
  } else {
    state.wakeLock = null;
  }
});

// ─── Cleanup saat tab/window ditutup ─────────────────────────────
window.addEventListener('beforeunload', () => {
  console.log('📤 Page unloading, cleaning up...');
  saveUserData();
  // Hapus manual diabaikan — onDisconnect(myRef).remove() sudah menanganinya
  if (state.watchId)       navigator.geolocation.clearWatch(state.watchId);
  if (state.simIntervalId) clearInterval(state.simIntervalId);
});

// ─── Tab detection + Auto-login dari URL ─────────────────────────
// initTabDetection() harus dipanggil sebelum setTimeout auto-login
// agar BroadcastChannel sudah terpasang saat signal TAB_ACTIVE dikirim.
initTabDetection();

setTimeout(async () => {
  const urlRoom = new URLSearchParams(location.search).get('room');
  if (!urlRoom) return;

  // Nilai urlRoom diabaikan — app selalu pakai FIXED_ROOM.
  // Parameter ?room= hanya sebagai trigger auto-login.
  state.roomId = FIXED_ROOM;
  const savedName = localStorage.getItem('lokasi_name');
  if (!savedName) return;

  // Set state user (loadUserData() sudah mengisi myColor jika ada di localStorage)
  state.myName  = savedName;
  state.myEmoji = localStorage.getItem('lokasi_emoji') || '🧑';
  state.myId    = genId();
  if (!localStorage.getItem('lokasi_color')) {
    state.myColor = COLORS[state.colorIdx++ % COLORS.length];
  }

  // Broadcast: beritahu tab lain bahwa tab ini akan aktif
  if (state.broadcastChannel) {
    state.broadcastChannel.postMessage({ type: 'TAB_ACTIVE' });
  }

  // Tunggu respons dari tab lain (300ms) sebelum lanjut
  setTimeout(async () => {
    // Jika tab duplikat overlay sudah muncul, batalkan auto-login
    if (document.getElementById('duplicateTabOverlay').classList.contains('show')) return;

    // Cek apakah nama sudah digunakan oleh device lain
    try {
      const snapshot = await get(ref(db, `rooms/${state.roomId}/members`));
      if (snapshot.exists()) {
        const myDevId     = getDeviceId();
        const isNameTaken = Object.values(snapshot.val()).some(m =>
          m.name && m.name.toLowerCase() === savedName.toLowerCase() && m.deviceId !== myDevId,
        );
        if (isNameTaken) {
          showToast('⚠️ Nama Anda sedang digunakan di sesi lain!');
          document.getElementById('setupSection').style.display  = 'block';
          document.getElementById('loadingSection').style.display = 'none';
          return;
        }
      }
    } catch (e) {
      console.error('Auto login name check failed', e);
    }

    // Lanjut login otomatis
    document.getElementById('setupSection').style.display  = 'none';
    document.getElementById('loadingSection').style.display = '';
    document.getElementById('loadingText').textContent      = 'Bergabung dengan teman...';
    setTimeout(() => startSession(), 800);
  }, 300);
}, 100);
