import maplibregl from 'maplibre-gl';
import { state } from './state.js';
import { showToast, renderRouteInfo, updateDistances, haversine } from './ui.js';

// ─── Rute navigasi mobil pakai OSRM demo server ──────────────────
// PENTING: router.project-osrm.org itu server demo publik gratis, BUKAN
// buat produksi — kebijakan resminya maks 1 request/detik, tanpa jaminan
// uptime, dan aksesnya bisa dicabut kapan saja. Makanya recalculate rute
// di-throttle (lihat maybeRecalculateRoute), bukan dipanggil tiap tick GPS.
const OSRM_BASE = 'https://router.project-osrm.org/route/v1/driving';

const ROUTE_SRC = 'route-src';
const ROUTE_LYR = 'route-lyr';

const RECALC_MIN_DIST_M = 150;   // re-route kalau sudah gerak >150m dari titik hitung terakhir...
const RECALC_MIN_MS     = 35000; // ...ATAU sudah >35 detik sejak hitung terakhir (dua-duanya cukup jarang buat hormatin limit 1 req/s)
const ARRIVED_DIST_M    = 40;    // di bawah ini dianggap "sudah sampai", rute auto-selesai

let _destMarker      = null;
let _lastGeometry    = null; // geometry rute terakhir, buat redraw cepat tanpa panggil OSRM lagi (mis. abis ganti tema)
let _requestInFlight = false; // cegah request numpuk kalau network lambat & GPS tick lain nyusul

// ─── Tombol kontrol rute (🚗/📍/✕) — satu tombol, state via routeMode ──
export function toggleRoute() {
  if (state.routeMode === 'idle') {
    _armPicking();
  } else if (state.routeMode === 'picking') {
    _cancelPicking();
  } else {
    clearRoute();
  }
}

function _armPicking() {
  if (state.myLat == null) {
    showToast('⚠️ Tunggu GPS kamu terdeteksi dulu');
    return;
  }
  state.routeMode = 'picking';
  _syncControlButton();
  showToast('📍 Ketuk peta untuk pilih tujuan');
}

function _cancelPicking() {
  state.routeMode = 'idle';
  _syncControlButton();
}

// ─── Dipanggil dari map.js saat peta di-tap (cuma diproses kalau lagi mode picking) ──
export function handleMapClick(lngLat) {
  if (state.routeMode !== 'picking') return;
  if (state.myLat == null) {
    showToast('⚠️ Posisi GPS kamu belum didapat');
    return;
  }

  state.routeDest     = { lat: lngLat.lat, lng: lngLat.lng };
  state.routeMode     = 'active';
  state.routeLastCalc = null; // belum ada histori → paksa hitung pertama kali
  _setDestinationMarker(lngLat.lat, lngLat.lng);
  _syncControlButton();

  _requestRoute(state.myLat, state.myLng, lngLat.lat, lngLat.lng);
}

// ─── Dipanggil dari gps.js tiap ada posisi GPS baru — throttled ──
export function maybeRecalculateRoute() {
  if (state.routeMode !== 'active' || !state.routeDest) return;
  if (state.myLat == null) return;

  const last = state.routeLastCalc;
  if (last) {
    const moved   = haversine(last.lat, last.lng, state.myLat, state.myLng);
    const elapsed = Date.now() - last.time;
    if (moved < RECALC_MIN_DIST_M && elapsed < RECALC_MIN_MS) return; // belum waktunya
  }

  _requestRoute(state.myLat, state.myLng, state.routeDest.lat, state.routeDest.lng);
}

// ─── Batalkan rute sepenuhnya, balik ke idle ─────────────────────
export function clearRoute() {
  state.routeMode     = 'idle';
  state.routeDest     = null;
  state.routeInfo     = null;
  state.routeLastCalc = null;
  _lastGeometry        = null;
  _clearRouteLayer();
  _clearDestinationMarker();
  _syncControlButton();
  updateDistances(); // balik nampilin chip jarak anggota seperti biasa
}

// ─── Dipanggil map.js setelah setStyle() (ganti tema) selesai load ───
// setStyle() menghapus source/layer rute, tapi kita masih punya geometry
// terakhir di memori jadi bisa digambar ulang tanpa panggil OSRM lagi.
export function redrawRouteIfActive() {
  if (state.routeMode !== 'active' || !state.routeDest) return;
  _setDestinationMarker(state.routeDest.lat, state.routeDest.lng);
  if (_lastGeometry) _drawRouteLine(_lastGeometry);
}

// ─── Request rute ke OSRM + render hasilnya ──────────────────────
async function _requestRoute(fromLat, fromLng, toLat, toLng) {
  if (_requestInFlight) return;
  _requestInFlight = true;

  const url = `${OSRM_BASE}/${fromLng},${fromLat};${toLng},${toLat}`
    + `?overview=full&geometries=geojson`;

  let data;
  try {
    const res = await fetch(url);
    data = await res.json();
  } catch (err) {
    console.error('OSRM request gagal:', err);
    showToast('⚠️ Gagal menghitung rute — coba lagi');
    _requestInFlight = false;
    return;
  }

  _requestInFlight = false;

  if (data.code !== 'Ok' || !data.routes || !data.routes.length) {
    showToast('⚠️ Rute ke titik itu tidak ditemukan');
    return;
  }

  // Kalau user sempat batalkan rute selagi request masih jalan, buang hasilnya
  if (state.routeMode !== 'active') return;

  const route = data.routes[0];
  state.routeInfo     = { distance: route.distance, duration: route.duration };
  state.routeLastCalc = { lat: fromLat, lng: fromLng, time: Date.now() };

  _drawRouteLine(route.geometry);
  renderRouteInfo(route.distance, route.duration);

  if (route.distance < ARRIVED_DIST_M) {
    showToast('🏁 Sampai tujuan!');
    clearRoute();
  }
}

function _drawRouteLine(geojson) {
  if (!state.map) return;
  _lastGeometry = geojson;
  const data = { type: 'Feature', properties: {}, geometry: geojson };

  if (state.map.getSource(ROUTE_SRC)) {
    state.map.getSource(ROUTE_SRC).setData(data);
  } else {
    state.map.addSource(ROUTE_SRC, { type: 'geojson', data });
    state.map.addLayer({
      id:     ROUTE_LYR,
      type:   'line',
      source: ROUTE_SRC,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color':   '#4a90d9',
        'line-width':   6,
        'line-opacity': 0.85,
      },
    });
  }
}

function _clearRouteLayer() {
  if (!state.map) return;
  if (state.map.getLayer(ROUTE_LYR)) state.map.removeLayer(ROUTE_LYR);
  if (state.map.getSource(ROUTE_SRC)) state.map.removeSource(ROUTE_SRC);
}

function _setDestinationMarker(lat, lng) {
  _clearDestinationMarker();
  const el = document.createElement('div');
  el.className   = 'route-dest-marker';
  el.textContent = '📍';
  _destMarker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
    .setLngLat([lng, lat])
    .addTo(state.map);
}

function _clearDestinationMarker() {
  if (_destMarker) { _destMarker.remove(); _destMarker = null; }
}

function _syncControlButton() {
  const btn = document.getElementById('routeControlBtn');
  if (!btn) return;
  btn.classList.remove('picking', 'active');

  if (state.routeMode === 'picking') {
    btn.classList.add('picking');
    btn.textContent = '📍';
    btn.title = 'Ketuk peta untuk pilih tujuan (ketuk lagi buat batal)';
  } else if (state.routeMode === 'active') {
    btn.classList.add('active');
    btn.textContent = '✕';
    btn.title = 'Batalkan rute';
  } else {
    btn.textContent = '🚗';
    btn.title = 'Buat rute ke tujuan';
  }
  btn.setAttribute('aria-label', btn.title);
}
