import { setMapStyle } from './map.js';

const THEME_KEY = 'lokasi_theme';

// ─── Style peta MapLibre per tema — OpenFreeMap juga sediakan style ────
// "dark" (selain "liberty" yang dipakai default/light), jadi peta ikut
// gelap juga, bukan cuma chrome UI-nya doang.
const MAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/liberty',
  dark:  'https://tiles.openfreemap.org/styles/dark',
};

// Warna status bar HP (meta theme-color) per tema, biar nyatu sama UI
const STATUS_BAR_COLOR = {
  light: '#247066',
  dark:  '#17202e',
};

// ─── Tema aktif saat ini ──────────────────────────────────────────
// Sudah di-set oleh inline script di <head> SEBELUM body dirender
// (lihat index.html), jadi di sini tinggal dibaca — tidak ada "kedip"
// tema terang sekilas saat halaman dibuka dalam mode gelap.
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function mapStyleForTheme(theme) {
  return MAP_STYLES[theme] || MAP_STYLES.light;
}

// ─── Dipakai session.js saat initMap() pertama kali ──────────────
export function getCurrentMapStyleUrl() {
  return mapStyleForTheme(getTheme());
}

// ─── Inisialisasi: sinkronkan ikon tombol dengan tema aktif ─────
export function initTheme() {
  _applyStatusBarColor(getTheme());
  _syncButton();
}

// ─── Toggle tema (dipanggil dari tombol 🌙/☀️ di sidebar) ────────
export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  try { localStorage.setItem(THEME_KEY, next); } catch { /* abaikan, non-fatal */ }

  _applyStatusBarColor(next);
  _syncButton();

  // Kalau peta sudah aktif (sesi sudah jalan), ganti style-nya juga.
  // setMapStyle() sendiri sudah cek state.map null/belum ada, jadi aman
  // dipanggil kapan pun termasuk sebelum sesi mulai (no-op saat itu).
  setMapStyle(mapStyleForTheme(next));
}

function _applyStatusBarColor(theme) {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', STATUS_BAR_COLOR[theme] || STATUS_BAR_COLOR.light);
}

function _syncButton() {
  const btn = document.getElementById('themeToggleBtn');
  if (!btn) return;
  const dark = getTheme() === 'dark';
  btn.textContent = dark ? '☀️' : '🌙';
  btn.title = dark ? 'Mode terang' : 'Mode gelap';
  btn.setAttribute('aria-label', btn.title);
}
