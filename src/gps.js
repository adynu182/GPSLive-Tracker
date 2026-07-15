import { state } from './state.js';
import { writeLocation, writeSharing } from './firebase-write.js';
import { updateMarker } from './map.js';
import { showToast, updateDistances } from './ui.js';
import { snapToRoad } from './road-snap.js';
import { maybeRecalculateRoute } from './route.js';

// ─── Mulai tracking GPS via watchPosition ─────────────────────────
export function startGPS() {
  if (state.simIntervalId) {
    clearInterval(state.simIntervalId);
    state.simIntervalId = null;
  }
  if (!navigator.geolocation) {
    simulateGPS();
    return;
  }
  state.watchId = navigator.geolocation.watchPosition(
    onGPS,
    onGPSErr,
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
  );
}

// ─── Callback berhasil dapat koordinat ───────────────────────────
function onGPS({ coords: { latitude: rawLat, longitude: rawLng, accuracy, heading, speed } }) {
  state.mySpeed = speed ?? 0;

  // Heading dari GPS valid hanya saat bergerak (speed > 0.3 m/s ≈ 1 km/h).
  // Saat diam, pertahankan heading terakhir agar peta tidak reset ke Utara.
  if (heading != null && state.mySpeed > 0.3) {
    state.myHeading = heading;
  }

  // Snap ke jalan (client-side) sebelum dipakai — biar marker & trail
  // nempel di jalan, bukan titik GPS mentah yang errornya bisa ±5-20m.
  const { lat, lng } = snapToRoad(rawLat, rawLng);
  state.myLat = lat;
  state.myLng = lng;

  // Update GPS accuracy di toolbar
  const pct    = Math.max(0, Math.min(100, 100 - Math.log(accuracy) * 14));
  const accStr = `±${Math.round(accuracy)} m`;
  const valEl  = document.getElementById('accuracyValue');
  if (valEl) valEl.textContent = accStr;

  // Warna dot GPS sesuai kualitas akurasi
  const dot = document.getElementById('gpsDot');
  if (dot) {
    dot.className = 'gps-dot ' + (accuracy < 20 ? 'good' : accuracy < 60 ? 'medium' : 'poor');
  }

  if (!state.sharingOn) return;

  // Update cache lokal sebelum render (hindari flash data lama)
  if (state.members[state.myId]) {
    state.members[state.myId] = { ...state.members[state.myId], lat, lng };
  }
  updateMarker(state.myId);
  writeLocation(lat, lng);
  updateDistances();
  maybeRecalculateRoute(); // no-op kalau gak ada rute aktif / belum waktunya re-route

  // Center peta ke posisi user saat fix pertama — MapLibre: [lng, lat]
  if (state.firstFix && state.mapReady) {
    state.map.jumpTo({ center: [lng, lat], zoom: 15 });
    state.firstFix = false;
  }
}

// ─── Callback error GPS ───────────────────────────────────────────
function onGPSErr(err) {
  if (err.code === 1) {
    const valEl = document.getElementById('accuracyValue');
    if (valEl) valEl.textContent = 'Diblokir';
    const dot = document.getElementById('gpsDot');
    if (dot) dot.className = 'gps-dot poor';
    simulateGPS();
  }
}

// ─── Mode demo: random walk di area Jakarta ───────────────────────
// Aktif saat geolocation tidak tersedia atau izin GPS ditolak.
function simulateGPS() {
  let lat = -6.2 + (Math.random() - 0.5) * 0.02;
  let lng = 106.8 + (Math.random() - 0.5) * 0.02;
  let prevLat = null, prevLng = null;

  const valEl = document.getElementById('accuracyValue');
  if (valEl) valEl.textContent = 'Demo';
  const dot = document.getElementById('gpsDot');
  if (dot) dot.className = 'gps-dot medium';

  const tick = () => {
    if (!state.sharingOn) return;

    prevLat = lat; prevLng = lng;
    lat += (Math.random() - 0.5) * 0.0004;
    lng += (Math.random() - 0.5) * 0.0004;

    // Hitung heading dari selisih posisi (bearing titik A → B)
    if (prevLat != null) {
      const dLng  = lng - prevLng;
      const dLat  = lat - prevLat;
      const angle = Math.atan2(dLng, dLat) * (180 / Math.PI);
      state.myHeading = (angle + 360) % 360;
      state.mySpeed   = 0.8; // simulasikan sedang berjalan pelan
    }

    // Snap ke jalan juga di mode demo — trek jadi ikut jalan asli Jakarta
    // alih-alih random walk lurus yang menembus gedung/blok.
    // `lat`/`lng` closure di atas sengaja TETAP raw (tidak di-snap) supaya
    // delta/heading tick berikutnya tetap dihitung dari jalur acak aslinya.
    const snapped = snapToRoad(lat, lng);
    state.myLat = snapped.lat;
    state.myLng = snapped.lng;

    if (state.members[state.myId]) {
      state.members[state.myId] = { ...state.members[state.myId], lat: snapped.lat, lng: snapped.lng };
    }
    updateMarker(state.myId);
    writeLocation(snapped.lat, snapped.lng);
    updateDistances();
    if (state.firstFix && state.mapReady) {
      state.map.jumpTo({ center: [snapped.lng, snapped.lat], zoom: 15 });
      state.firstFix = false;
    }
  };

  tick(); // jalankan sekali langsung agar tidak menunggu 3 detik
  if (state.simIntervalId) clearInterval(state.simIntervalId);
  state.simIntervalId = setInterval(tick, 3000);
}

// ─── Toggle berbagi lokasi ON/OFF ─────────────────────────────────
export function toggleSharing(on) {
  state.sharingOn = on;
  writeSharing(on);

  // Sync toggle
  const t = document.getElementById('sharingToggleFloat');
  if (t) t.checked = on;

  // Update label teks di toolbar
  const lbl = document.getElementById('sharingLabel');
  if (lbl) {
    lbl.textContent = on ? 'Online' : 'Offline';
    lbl.className   = 'tb-toggle-label ' + (on ? 'sharing-on' : 'sharing-off');
  }

  showToast(on ? '📡 Berbagi lokasi aktif' : '🔇 Lokasi disembunyikan');

  if (state.myId && state.members[state.myId]) {
    state.members[state.myId].sharing = on;
    updateMarker(state.myId);
  }
}
