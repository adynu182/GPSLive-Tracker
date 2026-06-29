import { COLORS } from './constants.js';

// ─── Shared mutable state ─────────────────────────────────────────
// Semua modul import objek ini dan baca/tulis propertinya secara langsung.
// Pendekatan objek tunggal menghindari masalah circular import yang terjadi
// jika setiap modul mengekspor let-binding tersendiri.
export const state = {
  // ── User ─────────────────────────────────────────────────────────
  myId:     null,
  myName:   null,
  myEmoji:  '🧑',
  myColor:  COLORS[0],

  // ── Room ─────────────────────────────────────────────────────────
  roomId:   null,
  sharingOn: true,

  // ── GPS ──────────────────────────────────────────────────────────
  watchId:       null,   // ID dari watchPosition (untuk clearWatch)
  simIntervalId: null,   // ID dari setInterval (mode demo)
  myLat:         null,
  myLng:         null,

  // ── Map (Leaflet) ─────────────────────────────────────────────────
  map:           null,
  mapReady:      false,
  firstFix:      true,   // true = peta belum pernah di-center ke posisi user
  colorIdx:      0,      // counter untuk auto-assign warna ke user baru

  // ── Follow mode ───────────────────────────────────────────────────
  followedUid:   null,   // UID anggota yang sedang di-follow
  isFollowFlying: false, // true saat animasi flyTo() awal masih berjalan

  // ── Member data ───────────────────────────────────────────────────
  members:       {},     // uid → {name, emoji, color, lat, lng, sharing, isMe}
  markers:       {},     // uid → Leaflet Marker
  trails:        {},     // uid → Leaflet Polyline
  trailPts:      {},     // uid → Array<{lat, lng}>
  memberNumbers: {},     // uid → nomor urut (1, 2, 3...)
  nextMemberNumber: 1,

  // ── Tab management (BroadcastChannel) ────────────────────────────
  broadcastChannel: null,
  isTabActive:      false,

  // ── Wake Lock ─────────────────────────────────────────────────────
  wakeLock: null,

  // ── UI state ─────────────────────────────────────────────────────
  toastTimer:       null,
  _prevConnected:   true,   // tracking koneksi terakhir untuk toast "kembali online"
  membersCollapsed: false,
};
