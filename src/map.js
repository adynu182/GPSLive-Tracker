import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { state } from './state.js';
import { sanitize, MAX_TRAIL } from './constants.js';
import { focusMember, cancelFollow, showToast, updateFollowIndicator } from './ui.js';

const SRC = uid => `trail-src-${uid}`;
const LYR = uid => `trail-lyr-${uid}`;

// ─── Animasi smooth marker antar update GPS (interpolasi rAF) ────
// GPS cuma ngasih titik baru tiap beberapa detik — tanpa ini marker
// "teleport" instan tiap update. Di sini kita tween dari posisi terakhir
// ke posisi baru selama MARKER_ANIM_MS dengan easing, biar kelihatan jalan.
const MARKER_ANIM_MS = 900;
const _anim = {}; // uid → requestAnimationFrame id yang sedang berjalan

const _easeOutCubic = t => 1 - Math.pow(1 - t, 3);

function _cancelMarkerAnim(uid) {
  if (_anim[uid] != null) {
    cancelAnimationFrame(_anim[uid]);
    delete _anim[uid];
  }
}

function _animateMarkerTo(uid, toLng, toLat) {
  const marker = state.markers[uid];
  if (!marker) return;

  _cancelMarkerAnim(uid);

  const cur     = marker.getLngLat();
  const fromLng = cur.lng, fromLat = cur.lat;

  // Loncatan gak wajar (GPS baru dapat sinyal lagi, dsb) → langsung pindah
  // tanpa animasi, biar gak "meluncur" aneh melintasi peta.
  if (Math.hypot(toLng - fromLng, toLat - fromLat) > 0.01) {
    marker.setLngLat([toLng, toLat]);
    return;
  }

  const start = performance.now();
  const tick = now => {
    const t = Math.min(1, (now - start) / MARKER_ANIM_MS);
    const e = _easeOutCubic(t);
    marker.setLngLat([
      fromLng + (toLng - fromLng) * e,
      fromLat + (toLat - fromLat) * e,
    ]);
    if (t < 1) {
      _anim[uid] = requestAnimationFrame(tick);
    } else {
      delete _anim[uid];
    }
  };
  _anim[uid] = requestAnimationFrame(tick);
}

// ─── Inisialisasi peta MapLibre ───────────────────────────────────
export function initMap(onDragCancelFollow) {
  state.map = new maplibregl.Map({
    container:          'map',
    style:              'https://tiles.openfreemap.org/styles/liberty',
    center:             [106.8, -6.2],
    zoom:               5,
    bearing:            0,
    attributionControl: false,
  });

  state.map.addControl(
    new maplibregl.NavigationControl({ showCompass: true }),
    'bottom-left',
  );

  // Gabungkan tombol mode navigasi ke dalam grup kontrol yang sama (zoom + kompas).
  // Dicari lewat class korner resmi MapLibre (bukan properti privat controller)
  // supaya tidak bergantung pada detail internal library.
  const ctrlGroup = document.querySelector('#map .maplibregl-ctrl-bottom-left .maplibregl-ctrl-group');
  if (ctrlGroup) {
    const navBtn = document.createElement('button');
    navBtn.type = 'button';
    navBtn.id   = 'navModeBtn';
    navBtn.title = 'Mode navigasi';
    navBtn.setAttribute('aria-label', 'Mode navigasi');
    navBtn.innerHTML = `
      <span class="ctrl-custom-icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polygon points="3 11 22 2 13 21 11 13 3 11"/>
        </svg>
      </span>`;
    navBtn.addEventListener('click', toggleNavMode);
    ctrlGroup.appendChild(navBtn);

    // Tombol "Gedung 3D" sengaja TIDAK ditampilkan lagi supaya grup kontrol
    // peta tidak penuh/sesak. Kapabilitas 3D-nya sendiri TETAP ada:
    //  1) Mode navigasi (tombol panah di atas) otomatis tilt peta 45° saat
    //     bergerak — lihat _updateCamera() & _activateNavMode() di bawah.
    //  2) Gesture bawaan MapLibre: drag dua jari (touch) atau Ctrl+drag/
    //     klik-kanan-drag (desktop) untuk pitch manual — tidak perlu tombol
    //     khusus, ini default library selama tidak dimatikan lewat opsi
    //     dragRotate/touchPitch (tidak kita matikan di initMap() atas).
    // toggle3DBuildings() di bawah tetap diekspor kalau suatu saat mau
    // disambung lagi ke kontrol lain (mis. menu pengaturan).
  }

  state.map.on('load', () => {
    state.mapReady = true;
    Object.keys(state.members).forEach(uid => {
      if (state.members[uid].lat != null) updateMarker(uid);
    });
  });

  state.map.on('dragstart', () => {
    // Matikan nav mode saat user drag peta secara manual
    if (state.navMode) {
      _deactivateNavMode();
      showToast('🧭 Mode navigasi dimatikan');
    }
    onDragCancelFollow();
  });
}

// ─── Elemen HTML marker lingkaran bernomor (anggota biasa) ────────
function createCircleEl(num, color, isMe, isSharing, name) {
  const sz      = isMe ? 26 : 24;
  const bgColor = isSharing ? color : '#9ca3af';
  const opacity = isSharing ? 1 : 0.6;
  const shadow  = isSharing
    ? `0 0 0 2px #fff, 0 2px 6px ${color}66`
    : `0 0 0 2px #fff, 0 2px 4px rgba(0,0,0,0.18)`;
  const glow = (isMe && isSharing) ? `, 0 0 0 4px ${color}33` : '';

  const wrap = document.createElement('div');
  wrap.style.cssText = `position:relative; width:${sz}px; height:${sz}px; cursor:pointer; user-select:none;`;
  wrap.innerHTML = `
    <div class="ml-label" style="
      position:absolute; bottom:calc(100% + 4px); left:50%;
      transform:translateX(-50%);
      background:rgba(18,28,28,0.88); color:${color};
      font-family:'Inter',sans-serif; font-size:0.7rem; font-weight:700;
      padding:2px 6px; border-radius:5px; white-space:nowrap;
      pointer-events:none; box-shadow:0 1px 4px rgba(0,0,0,0.25);
    ">${sanitize(name)}</div>
    <div class="ml-circle" style="
      width:${sz}px; height:${sz}px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      background:${bgColor}; color:#fff;
      font-family:'Inter',sans-serif;
      font-size:${isMe ? '0.88' : '0.72'}rem; font-weight:800; line-height:1;
      box-shadow:${shadow}${glow}; opacity:${opacity};
    ">${num}</div>`;
  return wrap;
}

// ─── Elemen HTML marker navigasi segitiga (hanya untuk diri sendiri) ──
// Panah selalu menunjuk ke ATAS layar = arah perjalanan,
// karena peta yang berputar mengikuti heading, bukan marker-nya.
// rotationAlignment:'viewport' memastikan marker tegak meski peta berputar.
function createNavArrowEl(color) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative; width:40px; height:40px; cursor:pointer; user-select:none;';
  wrap.innerHTML = `
    <svg viewBox="0 0 40 40" width="40" height="40"
      style="display:block; filter:drop-shadow(0 3px 10px ${color}90);">
      <path d="M20 3 L35 37 L20 28 L5 37 Z"
        fill="${color}" stroke="white" stroke-width="2.5" stroke-linejoin="round"/>
      <circle cx="20" cy="22" r="5" fill="white" fill-opacity="0.92"/>
    </svg>`;
  return wrap;
}

// ─── Update atau buat marker + trail satu anggota ─────────────────
export function updateMarker(uid) {
  const m = state.members[uid];
  if (!m || m.lat == null || !state.mapReady) return;

  const isSharing = m.sharing !== false;
  const num       = state.memberNumbers[uid] || '?';
  const isNavSelf = uid === state.myId && state.navMode;

  // ── Marker ──────────────────────────────────────────────────────
  if (state.markers[uid]) {
    _animateMarkerTo(uid, m.lng, m.lat);

    if (!isNavSelf) {
      // Update lingkaran bernomor
      const el     = state.markers[uid].getElement();
      const circle = el.querySelector('.ml-circle');
      const label  = el.querySelector('.ml-label');
      if (circle) {
        circle.style.background = isSharing ? m.color : '#9ca3af';
        circle.style.opacity    = isSharing ? '1' : '0.6';
        circle.textContent      = num;
      }
      if (label) {
        label.style.color = m.color;
        label.textContent = sanitize(m.name);
      }
    }
    // Marker segitiga tidak perlu di-update kontennya (warna sudah tetap)

  } else {
    // Buat marker baru
    let el;
    if (isNavSelf) {
      el = createNavArrowEl(m.color);
    } else {
      el = createCircleEl(num, m.color, m.isMe, isSharing, m.name);
      el.addEventListener('click', () => focusMember(uid));
    }

    // rotationAlignment:'viewport' → marker tegak meski peta berputar saat nav mode
    state.markers[uid] = new maplibregl.Marker({ element: el, anchor: 'center', rotationAlignment: 'viewport' })
      .setLngLat([m.lng, m.lat])
      .addTo(state.map);
  }

  // ── Trail (GeoJSON source + line layer) ─────────────────────────
  if (!state.trailPts[uid]) state.trailPts[uid] = [];
  const arr  = state.trailPts[uid];
  const last = arr[arr.length - 1];
  if (!last || last.lat !== m.lat || last.lng !== m.lng) {
    arr.push({ lat: m.lat, lng: m.lng });
    if (arr.length > MAX_TRAIL) arr.shift();
  }

  if (arr.length > 1) {
    const coords  = arr.map(p => [p.lng, p.lat]);
    const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };
    if (state.map.getSource(SRC(uid))) {
      state.map.getSource(SRC(uid)).setData(geojson);
    } else {
      state.map.addSource(SRC(uid), { type: 'geojson', data: geojson });
      state.map.addLayer({
        id: LYR(uid), type: 'line', source: SRC(uid),
        paint: { 'line-color': m.color, 'line-width': 2, 'line-opacity': 0.55, 'line-dasharray': [2, 3] },
      });
      state.trails[uid] = true;
    }
  }

  // ── Kamera: follow + rotate ──────────────────────────────────────
  _updateCamera(uid, m);
}

// ─── Update kamera (pan, bearing, pitch) sesuai mode ─────────────
function _updateCamera(uid, m) {
  if (!state.mapReady || state.isFollowFlying) return;

  const isNavSelf     = uid === state.myId && state.navMode;
  const isFollowingMe = state.followedUid === uid;

  if (!isNavSelf && !isFollowingMe) return;

  if (isNavSelf && state.myHeading != null && state.mySpeed > 0.3) {
    // ── Mode navigasi: peta berputar mengikuti heading ───────────
    // easeTo membuat transisi smooth antar tiap GPS tick.
    // Marker segitiga di-set rotationAlignment:'viewport' sehingga
    // selalu menunjuk ke atas layar = arah perjalanan.
    state.map.easeTo({
      center:   [m.lng, m.lat],
      bearing:  state.myHeading,
      pitch:    45,          // sedikit tilt seperti Google Maps navigasi
      zoom:     state.map.getZoom() < 15 ? 16 : state.map.getZoom(),
      duration: 600,
    });
  } else if (isNavSelf || isFollowingMe) {
    // Diam atau follow normal: hanya pan, tidak rotate
    state.map.jumpTo({ center: [m.lng, m.lat] });
  }
}

// ─── Toggle mode navigasi ─────────────────────────────────────────
export function toggleNavMode() {
  if (!state.mapReady) { showToast('⚠️ Peta belum siap'); return; }
  if (state.myLat == null) { showToast('📍 Tunggu GPS mendapat sinyal dulu'); return; }

  if (state.navMode) {
    _deactivateNavMode();
    showToast('🧭 Mode navigasi nonaktif');
  } else {
    _activateNavMode();
    showToast('🧭 Mode navigasi aktif — peta mengikuti arah jalan');
  }

  // Sync tampilan tombol
  const btn = document.getElementById('navModeBtn');
  if (btn) btn.classList.toggle('active', state.navMode);
}

// ─── Toggle gedung 3D (tilt kamera; fill-extrusion sudah ada di style Liberty) ──
export function toggle3DBuildings() {
  if (!state.mapReady) { showToast('⚠️ Peta belum siap'); return; }

  // Saat nav mode aktif, pitch sudah dikendalikan otomatis tiap GPS tick
  // (lihat _updateCamera) — jangan diperebutkan, cukup kasih tahu user.
  if (state.navMode) {
    showToast('🧭 Tilt 3D mengikuti mode navigasi saat ini');
    return;
  }

  state.buildings3D = !state.buildings3D;
  state.map.easeTo({ pitch: state.buildings3D ? 45 : 0, duration: 600 });

  if (state.buildings3D && state.map.getZoom() < 14) {
    showToast('🏙️ Gedung 3D aktif — zoom in lagi supaya kelihatan');
  } else {
    showToast(state.buildings3D ? '🏙️ Gedung 3D aktif' : '🏙️ Gedung 3D nonaktif');
  }

  const btn3d = document.getElementById('buildings3DBtn');
  if (btn3d) btn3d.classList.toggle('active', state.buildings3D);
}

function _activateNavMode() {
  // Batalkan follow mode lain agar tidak bentrok
  if (state.followedUid && state.followedUid !== state.myId) cancelFollow();

  state.navMode = true;

  // Nav mode akan tilt kamera ke 45° tiap GPS tick — sinkronkan tombol 3D
  // supaya statusnya akurat (bukan toggle terpisah yg bisa saling menimpa).
  state.buildings3D = true;
  const btn3d = document.getElementById('buildings3DBtn');
  if (btn3d) btn3d.classList.add('active');

  // Ganti marker lingkaran → segitiga (hanya lokal, tidak dikirim ke Firebase)
  if (state.markers[state.myId]) {
    _cancelMarkerAnim(state.myId);
    state.markers[state.myId].remove();
    delete state.markers[state.myId];
  }
  // updateMarker akan buat marker segitiga baru (isNavSelf = true)
  if (state.members[state.myId]) updateMarker(state.myId);
}

function _deactivateNavMode() {
  state.navMode = false;

  // Ganti marker segitiga → lingkaran kembali
  if (state.markers[state.myId]) {
    _cancelMarkerAnim(state.myId);
    state.markers[state.myId].remove();
    delete state.markers[state.myId];
  }
  if (state.members[state.myId]) updateMarker(state.myId);

  // Reset bearing dan pitch ke posisi normal
  state.map.easeTo({ bearing: 0, pitch: 0, duration: 700 });

  state.buildings3D = false;
  const btn3d = document.getElementById('buildings3DBtn');
  if (btn3d) btn3d.classList.remove('active');

  // Sembunyikan follow indicator jika sedang follow diri sendiri
  updateFollowIndicator();
}

// ─── Hapus marker + trail satu anggota ───────────────────────────
export function removeMarker(uid) {
  _cancelMarkerAnim(uid);
  if (state.markers[uid]) { state.markers[uid].remove(); delete state.markers[uid]; }
  if (state.trails[uid]) {
    if (state.map.getLayer(LYR(uid))) state.map.removeLayer(LYR(uid));
    if (state.map.getSource(SRC(uid))) state.map.removeSource(SRC(uid));
    delete state.trails[uid];
  }
  delete state.trailPts[uid];
}

// ─── Toggle visibilitas label nama di atas marker ─────────────────
// Menggunakan CSS class di #map — tidak perlu menyentuh tiap marker.
export function toggleLabels() {
  state.showLabels = !state.showLabels;

  const mapEl = document.getElementById('map');
  mapEl.classList.toggle('labels-hidden', !state.showLabels);

  const btn = document.getElementById('toggleLabelsBtn');
  if (btn) btn.classList.toggle('active', !state.showLabels);

  showToast(state.showLabels ? '🏷️ Nama ditampilkan' : '🏷️ Nama disembunyikan');
}

// ─── Fit peta ke semua anggota yang online (tombol mata) ─────────
export function fitAllMembers() {
  if (!state.mapReady) return;
  const online = Object.values(state.members).filter(m => m.lat != null && m.sharing !== false);
  if (!online.length) { showToast('📍 Belum ada anggota yang online'); return; }

  if (state.navMode) { _deactivateNavMode(); }
  if (state.followedUid) cancelFollow();

  if (online.length === 1) {
    state.map.flyTo({ center: [online[0].lng, online[0].lat], zoom: 15 });
  } else {
    const bounds = new maplibregl.LngLatBounds();
    online.forEach(m => bounds.extend([m.lng, m.lat]));
    state.map.fitBounds(bounds, { padding: 60, maxZoom: 16 });
  }
  showToast(`👁️ Menampilkan ${online.length} anggota`);
}
