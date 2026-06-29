import { state } from './state.js';
import { sanitize } from './constants.js';

// ─── Toast notification ───────────────────────────────────────────
export function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ─── Connection badge (offline / kembali online) ─────────────────
export function showConnectionStatus(connected) {
  const badge = document.getElementById('connectionBadge');
  if (!badge) return;
  if (connected) {
    if (!state._prevConnected) showToast('✅ Kembali online');
    badge.style.display = 'none';
    badge.className = '';
  } else {
    badge.textContent = '📡 Offline — mencoba sambung kembali…';
    badge.className = 'offline';
    badge.style.display = 'block';
  }
  state._prevConnected = connected;
}

// ─── Follow mode ──────────────────────────────────────────────────
// Batalkan follow → sembunyikan indicator dan refresh kartu anggota.
export function cancelFollow() {
  state.followedUid = null;
  updateFollowIndicator();
}

export function updateFollowIndicator() {
  const indicator = document.getElementById('followIndicator');
  if (state.followedUid && state.members[state.followedUid]) {
    const m = state.members[state.followedUid];
    document.getElementById('followIndicatorText').textContent =
      `${m.emoji} Mengikuti ${sanitize(m.name)}`;
    indicator.style.display = 'flex';
  } else {
    indicator.style.display = 'none';
  }
  renderMembers(); // refresh highlight kartu anggota
}

// ─── Focus/follow anggota di peta ────────────────────────────────
// Klik dua kali pada anggota yang sama → matikan follow.
export function focusMember(uid) {
  const m = state.members[uid];
  if (!m || m.lat == null) { showToast('📍 Lokasi belum tersedia'); return; }

  if (state.followedUid === uid) {
    cancelFollow();
    showToast('📍 Mode ikuti dinonaktifkan');
    return;
  }

  state.followedUid = uid;
  // isFollowFlying mencegah updateMarker memanggil setView sebelum flyTo selesai
  state.isFollowFlying = true;
  state.map.flyTo([m.lat, m.lng], 16, { duration: 1 });
  state.map.once('moveend', () => { state.isFollowFlying = false; });
  updateFollowIndicator();
  showToast(`📍 Mengikuti ${m.name}`);
}

// ─── Sidebar: render daftar anggota ──────────────────────────────
export function renderMembers() {
  const list = document.getElementById('membersList');
  document.getElementById('memberCount').textContent = Object.keys(state.members).length;
  list.innerHTML = '';

  Object.entries(state.members).forEach(([uid, m]) => {
    const online     = m.sharing && m.lat != null;
    const isFollowing = uid === state.followedUid;
    const num        = state.memberNumbers[uid] || '?';

    const card = document.createElement('div');
    card.className = 'member-card'
      + (m.isMe       ? ' me'        : '')
      + (isFollowing  ? ' following' : '');
    card.style.borderColor = m.color;
    card.style.background  = m.color + '12';
    if (isFollowing) card.style.color = m.color;
    card.onclick = () => focusMember(uid);
    card.title   = m.isMe
      ? (isFollowing ? 'Klik untuk berhenti ikuti' : 'Klik untuk ikuti posisi Anda')
      : (isFollowing ? `Klik untuk berhenti ikuti ${m.name}` : `Klik untuk ikuti ${m.name}`);

    card.innerHTML = `
      <div class="avatar">
        <div style="
          width:26px; height:26px; border-radius:50%;
          background:${m.color}; color:#fff;
          display:flex; align-items:center; justify-content:center;
          font-size:0.72rem; font-weight:800; flex-shrink:0;
          opacity:${m.sharing === false ? 0.5 : 1};
        ">${num}</div>
        <div class="status-dot ${online ? 'online' : 'offline'}"></div>
      </div>
      <span>
        ${sanitize(m.name)}
        ${m.isMe      ? ' <small style="opacity:.55">(Me)</small>' : ''}
        ${isFollowing ? ' 🔒' : ''}
      </span>
    `;
    list.appendChild(card);
  });
}

// ─── Toggle collapse sidebar anggota ─────────────────────────────
export function toggleMembersList() {
  state.membersCollapsed = !state.membersCollapsed;
  const list = document.getElementById('membersList');
  const icon = document.getElementById('collapseIcon');
  if (state.membersCollapsed) {
    list.classList.add('collapsed');
    icon.style.transform = 'rotate(-90deg)';
  } else {
    list.classList.remove('collapsed');
    icon.style.transform = 'rotate(0deg)';
  }
}

// ─── Distance bar (bawah layar) ───────────────────────────────────
function haversine(a, b, c, d) {
  const R = 6371000, r = Math.PI / 180;
  const dL  = (c - a) * r;
  const dLn = (d - b) * r;
  const x   = Math.sin(dL / 2) ** 2
             + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLn / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

const fmtDist = m => m < 1000
  ? Math.round(m) + ' m'
  : (m / 1000).toFixed(1) + ' km';

export function updateDistances() {
  const bar = document.getElementById('bottomBar');
  if (state.myLat == null) return;

  const others = Object.entries(state.members)
    .filter(([u, m]) => u !== state.myId && m.lat != null);

  if (!others.length) {
    bar.innerHTML = '<span style="color:var(--muted);font-size:.75rem">Belum ada anggota lain di peta...</span>';
    return;
  }

  bar.innerHTML = '';
  others.forEach(([uid, m]) => {
    const d    = haversine(state.myLat, state.myLng, m.lat, m.lng);
    const chip = document.createElement('div');
    chip.className = 'dist-chip';
    chip.onclick   = () => focusMember(uid);
    chip.innerHTML = `
      <div class="dist-dot" style="background:${m.color}"></div>
      <span class="dist-label">${sanitize(m.emoji)} ${sanitize(m.name)}</span>
      <span class="dist-value">${fmtDist(d)}</span>
    `;
    bar.appendChild(chip);
  });
}
