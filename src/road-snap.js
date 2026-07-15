import { point as turfPoint } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import { state } from './state.js';
import { showToast } from './ui.js';

// ─── Snap ke jalan (client-side, tanpa server tambahan) ──────────
// Style peta "Liberty" (OpenFreeMap) berbasis skema OpenMapTiles — geometri
// jalan ada di source-layer "transportation". Di sini kita cari fitur jalan
// yang SEDANG ter-render di sekitar titik GPS, lalu ambil titik terdekat di
// garis itu pakai Turf.js. Kalau tidak ada jalan dalam radius toleransi,
// titik GPS asli dipakai apa adanya (misal user memang di luar jalan).
//
// Catatan: karena queryRenderedFeatures cuma baca tile yang sudah di-render
// di viewport saat ini, fungsi ini paling akurat untuk posisi sendiri
// (kamera selalu ngikutin posisi sendiri saat nav mode aktif).
const SNAP_MAX_DIST_M   = 25; // toleransi snap (~akurasi GPS smartphone wajar)
const SNAP_QUERY_PIXELS = 60; // radius pencarian fitur jalan di layar (px)

export function snapToRoad(lat, lng) {
  if (!state.roadSnapOn) return { lat, lng };
  if (!state.mapReady || !state.map) return { lat, lng };

  let pt;
  try {
    pt = state.map.project([lng, lat]);
  } catch {
    return { lat, lng };
  }

  const box = [
    [pt.x - SNAP_QUERY_PIXELS, pt.y - SNAP_QUERY_PIXELS],
    [pt.x + SNAP_QUERY_PIXELS, pt.y + SNAP_QUERY_PIXELS],
  ];

  let features;
  try {
    // Sengaja tidak filter lewat opsi {layers:[...]} — ID layer gaya
    // internal Liberty bisa berubah sewaktu-waktu. Kita filter manual
    // lewat sourceLayer di bawah, yang jauh lebih stabil (skema OpenMapTiles).
    features = state.map.queryRenderedFeatures(box);
  } catch {
    return { lat, lng };
  }
  if (!features || !features.length) return { lat, lng };

  const point = turfPoint([lng, lat]);
  let best = null;

  for (const f of features) {
    if (f.sourceLayer !== 'transportation') continue;
    if (!f.geometry) continue;
    if (f.geometry.type !== 'LineString' && f.geometry.type !== 'MultiLineString') continue;

    const line = { type: 'Feature', properties: {}, geometry: f.geometry };
    let snapped;
    try {
      snapped = nearestPointOnLine(line, point, { units: 'meters' });
    } catch {
      continue;
    }
    if (!best || snapped.properties.dist < best.properties.dist) best = snapped;
  }

  if (!best || best.properties.dist > SNAP_MAX_DIST_M) return { lat, lng };

  const [snapLng, snapLat] = best.geometry.coordinates;
  return { lat: snapLat, lng: snapLng };
}

// ─── Toggle manual road snap ON/OFF ───────────────────────────────
// Kalau dimatikan, snapToRoad() di atas langsung short-circuit dan
// balikin koordinat GPS mentah (lihat guard state.roadSnapOn di atas).
export function toggleRoadSnap() {
  state.roadSnapOn = !state.roadSnapOn;

  const btn = document.getElementById('roadSnapBtn');
  if (btn) btn.classList.toggle('active', state.roadSnapOn);

  showToast(state.roadSnapOn
    ? '🛣️ Snap ke jalan aktif'
    : '📍 Snap ke jalan nonaktif — pakai posisi GPS asli');
}
