import { db } from '../firebase-config.js';
import { ref, update, set, serverTimestamp } from 'firebase/database';
import { state } from './state.js';

// ─── Tulis koordinat GPS ke Firebase (atomic) ─────────────────────
// FIX: satu update() menggantikan 3 set() terpisah, mencegah race condition
// di mana listener lain bisa menerima lat baru tapi lng masih lama.
export function writeLocation(lat, lng) {
  if (!state.myId || !state.roomId) return;
  update(ref(db, `rooms/${state.roomId}/members/${state.myId}`), {
    lat,
    lng,
    ts: serverTimestamp(),
  });
}

// ─── Update status berbagi lokasi ────────────────────────────────
export function writeSharing(val) {
  if (!state.myId || !state.roomId) return;
  set(ref(db, `rooms/${state.roomId}/members/${state.myId}/sharing`), val);
}
