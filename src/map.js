import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { state } from './state.js';
import { sanitize, MAX_TRAIL } from './constants.js';
import { focusMember, cancelFollow, showToast } from './ui.js';

// ID helper agar konsisten antara addSource/addLayer dan removeSource/removeLayer
const SRC  = uid => `trail-src-${uid}`;
const LYR  = uid => `trail-lyr-${uid}`;

// ─── Inisialisasi peta MapLibre ───────────────────────────────────
export function initMap(onDragCancelFollow) {
  state.map = new maplibregl.Map({
    container:          'map',
    style:              'https://tiles.openfreemap.org/styles/liberty',
    center:             [106.8, -6.2],   // [lng, lat] — GeoJSON order!
    zoom:               5,
    bearing:            0,
    attributionControl: false,
  });

  // NavigationControl bawaan MapLibre: zoom +/- dan kompas (putar peta)
  state.map.addControl(
    new maplibregl.NavigationControl({ showCompass: true }),
    'top-right',
  );

  // mapReady = true setelah style selesai dimuat (tile, font, sprite)
  state.map.on('load', () => {
    state.mapReady = true;
    // Re-render anggota yang datanya masuk sebelum style selesai load
    Object.keys(state.members).forEach(uid => {
      if (state.members[uid].lat != null) updateMarker(uid);
    });
  });

  state.map.on('dragstart', onDragCancelFollow);
}

// ─── Buat elemen HTML untuk marker anggota ───────────────────────
// Lingkaran bernomor + label nama di atas. anchor:'center' memastikan
// titik tengah lingkaran tepat di koordinat GPS.
function createMarkerEl(num, color, isMe, isSharing, name) {
  const sz      = isMe ? 34 : 26;
  const bgColor = isSharing ? color : '#9ca3af';
  const opacity = isSharing ? 1 : 0.6;
  const shadow  = isSharing
    ? `0 0 0 2.5px #fff, 0 2px 8px ${color}66`
    : `0 0 0 2.5px #fff, 0 2px 6px rgba(0,0,0,0.18)`;
  const glow    = (isMe && isSharing) ? `, 0 0 0 4px ${color}33` : '';

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

// ─── Update atau buat marker + trail untuk satu anggota ──────────
export function updateMarker(uid) {
  const m = state.members[uid];
  if (!m || m.lat == null || !state.mapReady) return;

  const isSharing = m.sharing !== false;
  const num       = state.memberNumbers[uid] || '?';

  // ── Marker (MapLibre HTML Marker) ───────────────────────────────
  if (state.markers[uid]) {
    // Update posisi
    state.markers[uid].setLngLat([m.lng, m.lat]);

    // Update elemen HTML secara langsung (lebih ringan dari remove+create)
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
  } else {
    const el = createMarkerEl(num, m.color, m.isMe, isSharing, m.name);
    el.addEventListener('click', () => focusMember(uid));

    state.markers[uid] = new maplibregl.Marker({ element: el, anchor: 'center' })
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
    const coords  = arr.map(p => [p.lng, p.lat]); // GeoJSON = [lng, lat]
    const geojson = { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } };

    if (state.map.getSource(SRC(uid))) {
      // Update data source yang sudah ada (efisien, tidak re-render layer)
      state.map.getSource(SRC(uid)).setData(geojson);
    } else {
      // Buat source + layer pertama kali
      state.map.addSource(SRC(uid), { type: 'geojson', data: geojson });
      state.map.addLayer({
        id:     LYR(uid),
        type:   'line',
        source: SRC(uid),
        paint: {
          'line-color':     m.color,
          'line-width':     2,
          'line-opacity':   0.55,
          'line-dasharray': [2, 3],
        },
      });
      state.trails[uid] = true;
    }
  }

  // ── Follow mode ─────────────────────────────────────────────────
  if (state.followedUid === uid && state.mapReady && !state.isFollowFlying) {
    state.map.jumpTo({ center: [m.lng, m.lat] });
  }
}

// ─── Hapus marker + trail satu anggota (saat anggota keluar) ─────
export function removeMarker(uid) {
  if (state.markers[uid]) {
    state.markers[uid].remove();       // MapLibre Marker.remove()
    delete state.markers[uid];
  }
  if (state.trails[uid]) {
    if (state.map.getLayer(LYR(uid))) state.map.removeLayer(LYR(uid));
    if (state.map.getSource(SRC(uid))) state.map.removeSource(SRC(uid));
    delete state.trails[uid];
  }
  delete state.trailPts[uid];
}

// ─── Fit peta ke semua anggota yang online (tombol mata) ─────────
export function fitAllMembers() {
  if (!state.mapReady) return;
  const online = Object.values(state.members)
    .filter(m => m.lat != null && m.sharing !== false);

  if (!online.length) { showToast('📍 Belum ada anggota yang online'); return; }

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
