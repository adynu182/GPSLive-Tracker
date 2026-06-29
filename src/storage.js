import { state } from './state.js';
import { safeColor, genId } from './constants.js';

// ─── Simpan preferensi user ke localStorage ───────────────────────
export function saveUserData() {
  localStorage.setItem('lokasi_name',  state.myName);
  localStorage.setItem('lokasi_emoji', state.myEmoji);
  localStorage.setItem('lokasi_color', state.myColor); // FIX: persist warna lintas sesi
}

// ─── Muat preferensi user dari localStorage saat halaman dibuka ──
export function loadUserData() {
  const savedName  = localStorage.getItem('lokasi_name');
  const savedEmoji = localStorage.getItem('lokasi_emoji');
  const savedColor = localStorage.getItem('lokasi_color');

  if (savedName) {
    state.myName = savedName;
    const nameInput = document.getElementById('nameInput');
    if (nameInput) nameInput.value = savedName;
  }
  if (savedEmoji) {
    state.myEmoji = savedEmoji;
  }
  // FIX: hanya pakai warna tersimpan jika format hex valid (cegah nilai korup)
  if (savedColor && safeColor(savedColor) === savedColor) {
    state.myColor = savedColor;
  }
}

// ─── Device ID unik per perangkat (bukan per sesi) ───────────────
// Digunakan untuk membedakan user yang sama login dari perangkat berbeda.
export function getDeviceId() {
  let id = localStorage.getItem('lokasi_device_id');
  if (!id) {
    id = genId() + genId();
    localStorage.setItem('lokasi_device_id', id);
  }
  return id;
}
