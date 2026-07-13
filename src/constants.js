// ─── Warna anggota (dikosongkan saat sharing off → abu) ──────────
export const COLORS = [
  '#247066', '#187a7d', '#2b9a9d', '#1f7b7f',
  '#0f4c4a', '#3da49d', '#5bb5b0', '#7fc6c1',
];

// ─── Pilihan emoji untuk join form ───────────────────────────────
export const EMOJIS = ['🧑', '👩', '🧔', '👦', '👧', '🧑‍💻', '🧑‍🎤', '🧑‍🚀', '🦊', '🐱'];

// ─── Jumlah titik trail per anggota ──────────────────────────────
export const MAX_TRAIL = 40;

// ─── Room ID acak per sesi — user bisa "Buat Room" (kode baru) atau ──
// "Gabung Room" (masukkan kode teman). Tiap kode = room terpisah di
// Firebase (rooms/<kode>/members), jadi tiap grup punya sesi sendiri.
// Alfabet sengaja tanpa I/O/0/1 supaya tidak ambigu saat dibaca/diketik.
const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ROOM_CODE_LENGTH   = 6;

export const genRoomCode = () => {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
};

// ─── Bersihkan input kode room dari user ─────────────────────────
// Huruf besar, hanya A-Z0-9 — mencegah karakter ilegal path Firebase
// RTDB (. # $ [ ]) dan membatasi panjang biar tidak disalahgunakan.
export const sanitizeRoomCode = s =>
  String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);

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
