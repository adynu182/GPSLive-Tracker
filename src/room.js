import { state } from './state.js';
import { genRoomCode, sanitizeRoomCode } from './constants.js';
import { showToast } from './ui.js';

// ─── State lokal modul (khusus tab Buat/Gabung Room di modal login) ──
let activeTab     = 'create';
let generatedCode = '';

// ─── Inisialisasi tab room di modal login ────────────────────────
// prefillCode: kode dari URL ?room= atau localStorage (kalau ada,
// langsung buka tab "Gabung Room" dan isi kodenya biar user tinggal
// isi nama). Kalau kosong, default ke tab "Buat Room" dengan kode baru.
export function initRoomTabs(prefillCode) {
  generatedCode = genRoomCode();
  _renderGeneratedCode();

  const joinInput = document.getElementById('roomCodeInput');
  if (joinInput) {
    joinInput.addEventListener('input', () => {
      const clean = sanitizeRoomCode(joinInput.value);
      if (joinInput.value !== clean) joinInput.value = clean;
    });
  }

  if (prefillCode) {
    if (joinInput) joinInput.value = sanitizeRoomCode(prefillCode);
    selectRoomTab('join');
  } else {
    selectRoomTab('create');
  }
}

// ─── Ganti tab aktif (Buat Room / Gabung Room) ───────────────────
export function selectRoomTab(tab) {
  activeTab = tab;
  document.getElementById('tabCreate')?.classList.toggle('active', tab === 'create');
  document.getElementById('tabJoin')?.classList.toggle('active', tab === 'join');

  const createPanel = document.getElementById('createRoomPanel');
  const joinPanel    = document.getElementById('joinRoomPanel');
  if (createPanel) createPanel.style.display = tab === 'create' ? 'block' : 'none';
  if (joinPanel)   joinPanel.style.display   = tab === 'join'   ? 'block' : 'none';

  if (tab === 'join') {
    setTimeout(() => document.getElementById('roomCodeInput')?.focus(), 50);
  }
}

// ─── Buat kode room acak yang baru (tombol 🔄 di panel Buat Room) ──
export function regenerateRoomCode() {
  generatedCode = genRoomCode();
  _renderGeneratedCode();
  showToast('🔄 Kode room baru dibuat');
}

function _renderGeneratedCode() {
  const el = document.getElementById('generatedRoomCode');
  if (el) el.textContent = generatedCode;
}

// ─── Ambil roomId final sesuai tab yang aktif saat tombol Mulai diklik ──
export function getSelectedRoomId() {
  if (activeTab === 'create') return generatedCode;
  const input = document.getElementById('roomCodeInput');
  return sanitizeRoomCode(input ? input.value : '');
}

// ─── Tampilkan kode room aktif di sidebar setelah sesi dimulai ───
export function renderActiveRoomInfo() {
  const el = document.getElementById('activeRoomId');
  if (el) el.textContent = state.roomId || '------';

  const wrap = document.getElementById('sidebarRoom');
  if (wrap) wrap.style.display = state.roomId ? 'flex' : 'none';
}

// ─── Salin kode room aktif ke clipboard ──────────────────────────
export function copyRoomCode() {
  if (!state.roomId) return;
  if (!navigator.clipboard) { showToast('⚠️ Clipboard tidak didukung browser ini'); return; }
  navigator.clipboard.writeText(state.roomId)
    .then(() => showToast('📋 Kode room disalin!'))
    .catch(() => showToast('⚠️ Gagal menyalin kode'));
}

// ─── Bagikan link undangan (Web Share API, fallback: salin link) ─
export function shareRoomCode() {
  if (!state.roomId) return;
  const url  = `${location.origin}${location.pathname}?room=${state.roomId}`;
  const text = `Yuk gabung sesi GPS Live bareng aku! Kode room: ${state.roomId}`;

  if (navigator.share) {
    navigator.share({ title: 'GPS Live', text, url }).catch(() => {});
    return;
  }
  if (!navigator.clipboard) { showToast('⚠️ Berbagi tidak didukung browser ini'); return; }
  navigator.clipboard.writeText(url)
    .then(() => showToast('🔗 Link undangan disalin!'))
    .catch(() => showToast('⚠️ Gagal menyalin link'));
}
