import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { state } from './state.js';
import { sanitize, MAX_TRAIL } from './constants.js';
import { focusMember } from './ui.js';

// ─── Inisialisasi peta Leaflet ────────────────────────────────────
// onDragCancelFollow dipanggil saat user drag peta — memutus follow mode.
// Dipass sebagai callback untuk menghindari circular import (map ↔ ui).
export function initMap(onDragCancelFollow) {
  state.map = L.map('map', { zoomControl: true, attributionControl: false })
    .setView([-6.2, 106.8], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(state.map);

  state.mapReady = true;
  state.map.on('dragstart', onDragCancelFollow);
}

// ─── Buat ikon lingkaran bernomor untuk marker Leaflet ───────────
export function markerIcon(number, color, isMe, isSharing = true) {
  const sz      = isMe ? 34 : 26;
  const bgColor = isSharing ? color : '#9ca3af';
  const shadow  = isSharing
    ? `0 0 0 2.5px #fff, 0 2px 8px ${color}66`
    : `0 0 0 2.5px #fff, 0 2px 6px rgba(0,0,0,0.18)`;
  const glow    = (isMe && isSharing) ? `, 0 0 0 4px ${color}33` : '';

  return L.divIcon({
    className: '',
    html: `<div style="
      background:${bgColor};
      width:${sz}px; height:${sz}px;
      border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      box-shadow:${shadow}${glow};
      color:#fff;
      font-family:'Inter',sans-serif;
      font-size:${isMe ? '0.88' : '0.72'}rem;
      font-weight:800;
      line-height:1;
      user-select:none;
      opacity:${isSharing ? 1 : 0.6};
    ">${number}</div>`,
    iconSize:     [sz, sz],
    iconAnchor:   [sz / 2, sz / 2],
    popupAnchor:  [0, -(sz / 2) - 6],
    tooltipAnchor:[0, -(sz / 2) - 4],
  });
}

// ─── Update atau buat marker + trail untuk satu anggota ──────────
export function updateMarker(uid) {
  const m = state.members[uid];
  if (!m || m.lat == null || !state.mapReady) return;

  const isSharing  = m.sharing !== false;
  const num        = state.memberNumbers[uid] || '?';
  const tooltipHtml = `<span style="color:${m.color};font-weight:700;">${sanitize(m.name)}${m.isMe ? ' ✦' : ''}</span>`;

  // ── Marker ──────────────────────────────────────────────────────
  if (state.markers[uid]) {
    // Update posisi dan ikon saja (lebih efisien daripada remove+create)
    state.markers[uid].setLatLng([m.lat, m.lng]);
    state.markers[uid].setIcon(markerIcon(num, m.color, m.isMe, isSharing));
    const tip = state.markers[uid].getTooltip();
    if (tip) state.markers[uid].setTooltipContent(tooltipHtml);
  } else {
    state.markers[uid] = L.marker([m.lat, m.lng], {
      icon: markerIcon(num, m.color, m.isMe, isSharing),
    })
      .addTo(state.map)
      .bindTooltip(tooltipHtml, {
        permanent:  true,
        direction:  'top',
        className:  'member-label',
        offset:     [0, 0],
      })
      .on('click', () => focusMember(uid)); // klik marker → aktifkan follow
  }

  // ── Trail ───────────────────────────────────────────────────────
  if (!state.trailPts[uid]) state.trailPts[uid] = [];
  const arr  = state.trailPts[uid];
  const last = arr[arr.length - 1];

  // Tambah titik baru hanya jika posisi berubah
  if (!last || last.lat !== m.lat || last.lng !== m.lng) {
    arr.push({ lat: m.lat, lng: m.lng });
    if (arr.length > MAX_TRAIL) arr.shift();
  }

  if (arr.length > 1) {
    const latlngs = arr.map(p => [p.lat, p.lng]);
    if (state.trails[uid]) {
      // FIX: setLatLngs() — update polyline yang ada, bukan remove+create tiap tick.
      // Menghindari overhead DOM dan garbage collection per update GPS.
      state.trails[uid].setLatLngs(latlngs);
    } else {
      state.trails[uid] = L.polyline(latlngs, {
        color: m.color, weight: 2, opacity: 0.55, dashArray: '4 7',
      }).addTo(state.map);
    }
  } else if (state.trails[uid]) {
    // Kurang dari 2 titik (misal setelah reset): hapus trail
    state.map.removeLayer(state.trails[uid]);
    delete state.trails[uid];
  }

  // ── Follow mode ─────────────────────────────────────────────────
  // Gunakan setView {animate:false} agar marker selalu tepat di tengah.
  // Skip saat isFollowFlying=true (flyTo awal belum selesai) agar tidak bentrok.
  if (state.followedUid === uid && state.mapReady && !state.isFollowFlying) {
    state.map.setView([m.lat, m.lng], state.map.getZoom(), { animate: false });
  }
}
