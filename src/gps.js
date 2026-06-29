import { state } from './state.js';
import { writeLocation, writeSharing } from './firebase-write.js';
import { updateMarker } from './map.js';
import { showToast, updateDistances } from './ui.js';

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
function onGPS({ coords: { latitude: lat, longitude: lng, accuracy } }) {
  state.myLat = lat;
  state.myLng = lng;

  // Update accuracy bar UI
  const pct    = Math.max(0, Math.min(100, 100 - Math.log(accuracy) * 14));
  const accStr = `±${Math.round(accuracy)} m`;
  document.getElementById('accuracyValue').textContent = accStr;
  document.getElementById('accuracyLabel').textContent = accStr;
  const fill = document.querySelector('.accuracy-fill');
  if (fill) fill.style.width = pct + '%';

  if (!state.sharingOn) return;

  // Update cache lokal sebelum render (hindari flash data lama)
  if (state.members[state.myId]) {
    state.members[state.myId] = { ...state.members[state.myId], lat, lng };
  }
  updateMarker(state.myId);
  writeLocation(lat, lng);
  updateDistances();

  // Center peta ke posisi user saat fix pertama
  if (state.firstFix && state.mapReady) {
    state.map.setView([lat, lng], 15);
    state.firstFix = false;
  }
}

// ─── Callback error GPS ───────────────────────────────────────────
function onGPSErr(err) {
  // Error code 1 = PERMISSION_DENIED → fallback ke mode demo
  if (err.code === 1) {
    document.getElementById('accuracyValue').textContent = 'GPS diblokir';
    simulateGPS();
  }
}

// ─── Mode demo: random walk di area Jakarta ───────────────────────
// Aktif saat geolocation tidak tersedia atau izin GPS ditolak.
function simulateGPS() {
  let lat = -6.2 + (Math.random() - 0.5) * 0.02;
  let lng = 106.8 + (Math.random() - 0.5) * 0.02;

  document.getElementById('accuracyValue').textContent = 'Mode Demo';
  document.getElementById('accuracyLabel').textContent = 'Mode Demo';
  const fill = document.querySelector('.accuracy-fill');
  if (fill) fill.style.width = '60%';

  const tick = () => {
    if (!state.sharingOn) return;
    lat += (Math.random() - 0.5) * 0.0004;
    lng += (Math.random() - 0.5) * 0.0004;
    state.myLat = lat;
    state.myLng = lng;
    if (state.members[state.myId]) {
      state.members[state.myId] = { ...state.members[state.myId], lat, lng };
    }
    updateMarker(state.myId);
    writeLocation(lat, lng);
    updateDistances();
    if (state.firstFix && state.mapReady) {
      state.map.setView([lat, lng], 15);
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

  // Sync kedua toggle (sidebar dan floating panel)
  document.getElementById('sharingToggle').checked      = on;
  document.getElementById('sharingToggleFloat').checked = on;

  showToast(on ? '📡 Berbagi lokasi aktif' : '🔇 Lokasi disembunyikan');

  if (state.myId && state.members[state.myId]) {
    state.members[state.myId].sharing = on;
    updateMarker(state.myId); // update tampilan marker (abu-abu saat off)
  }
}
