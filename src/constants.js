// ─── Warna anggota (dikosongkan saat sharing off → abu) ──────────
export const COLORS = [
  '#247066', '#187a7d', '#2b9a9d', '#1f7b7f',
  '#0f4c4a', '#3da49d', '#5bb5b0', '#7fc6c1',
];

// ─── Pilihan emoji untuk join form ───────────────────────────────
export const EMOJIS = ['🧑', '👩', '🧔', '👦', '👧', '🧑‍💻', '🧑‍🎤', '🧑‍🚀', '🦊', '🐱'];

// ─── Jumlah titik trail per anggota ──────────────────────────────
export const MAX_TRAIL = 40;

// ─── Room ID tetap — semua user masuk room yang sama ─────────────
// Parameter ?room= di URL hanya dipakai sebagai trigger auto-login,
// nilai aktualnya diabaikan.
export const FIXED_ROOM = 'TRIPIN';

// ─── Generate random ID pendek ────────────────────────────────────
export const genId = () => Math.random().toString(36).slice(2, 10);

// ─── Escape HTML untuk mencegah XSS dari nama/emoji user ─────────
export const sanitize = s =>
  String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

// ─── Validasi hex color dari Firebase (mencegah CSS injection) ────
// Hanya izinkan format #rrggbb. Fallback ke COLORS[0] jika tidak valid.
export const safeColor = c => /^#[0-9a-fA-F]{6}$/.test(c) ? c : COLORS[0];
