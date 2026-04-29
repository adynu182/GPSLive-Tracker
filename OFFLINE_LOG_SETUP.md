# 📋 Offline Log System - Setup & Testing Guide

## ✅ Implementation Checklist

Fitur offline log sudah diimplementasikan dengan improvements berikut:

### 1. **Saving Offline Logs**
- ✅ Otomatis save ketika member keluar/disconnect
- ✅ Save data ketika user logout
- ✅ Save data ketika user close tab/browser (via sessionStorage queue)
- ✅ Console logging untuk debugging
- ✅ Error handling lengkap

### 2. **Data Structure di Firestore**
```
Collection: offline_logs
├── roomId          (String) - ID ruangan
├── name           (String) - Nama member
├── emoji          (String) - Emoji member
├── timestamp      (Number) - Waktu logout (milliseconds)
├── lastOnlineTime (Number) - Waktu terakhir online
├── offlineTime    (Date)   - Tanggal offline
└── createdAt      (Date)   - Tanggal dibuat
```

### 3. **Firestore Rules**
Tambahkan rules ini di Firebase Console → Firestore Database → Rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow anyone to write offline logs (untuk testing)
    match /offline_logs/{document=**} {
      allow create, read: if true;
    }
    
    // Untuk production, gunakan:
    // match /offline_logs/{document=**} {
    //   allow create, read: if request.auth != null;
    // }
  }
}
```

## 🧪 Testing Steps

### Test 1: Member Keluar (Normal Disconnect)
1. Buka 2 tab/browser dengan room yang sama
2. Tab 1: Username "Budi" dengan emoji 🧑
3. Tab 2: Username "Sinta" dengan emoji 👩
4. Tab 2: Close tab atau keluar ruangan
5. **Harapan**: 
   - Sinta muncul di log offline
   - Console: `✅ Offline log saved successfully`
   - Firestore: Muncul di collection `offline_logs`

### Test 2: User Logout (Ganti Nama)
1. Buka aplikasi dengan username "Andi"
2. Klik tombol "Ganti Nama"
3. **Harapan**:
   - Andi tersimpan di offline logs
   - Console: `Saving my offline log before logout`
   - Toast notification: `📋 Log Andi tersimpan`

### Test 3: Close Tab/Browser
1. Buka aplikasi dengan username "Maya"
2. Close tab atau close browser
3. Buka kembali aplikasi
4. **Harapan**:
   - Console: `Processing pending offline log...`
   - Console: `✅ Pending offline log saved`
   - Maya muncul di offline logs setelah beberapa saat

### Test 4: View Offline Logs
1. Klik tombol 📋 (floating menu di kiri bawah)
2. Menu terbuka dengan list offline members
3. **Harapan**:
   - Menampilkan max 50 data terbaru
   - Format: emoji + nama + waktu (e.g., "4m ago")
   - Terurut dari yang paling baru offline

## 🔍 Debug Console
Buka DevTools (F12) → Console untuk melihat:

### Key logs:
- `🎬 Starting session...` - Aplikasi mulai
- `Loading offline logs for room:` - Loading logs
- `Saving offline log:` - Menyimpan log
- `✅ Offline log saved successfully:` - Berhasil
- `❌ Error saving offline log:` - Error
- `Member offline: {name}` - Member keluar

### Troubleshooting:
```javascript
// Lihat semua offline logs di console:
offlineLogs

// Cek roomId:
console.log('roomId:', roomId)

// Cek Firestore connection:
console.log('fs:', fs)
```

## 📊 Offline Logs Query

### View di Firebase Console:
1. Go to: Firestore Database → offline_logs collection
2. Filter: `roomId == "TRIPIN"`
3. Sort by: `timestamp` (descending)

### Example query di console browser:
```javascript
// Load ulang logs
await loadOfflineLogs()

// Lihat offline logs
console.table(offlineLogs)
```

## ⚠️ Possible Issues & Solutions

### Issue: Data tidak tersimpan ke Firestore
**Solusi:**
- Cek Firestore Rules sudah allow write
- Cek F12 Console untuk error messages
- Pastikan Firebase projectId benar
- Tunggu 1-2 detik sebelum cek database

### Issue: Offline logs tidak muncul di UI
**Solusi:**
- Refresh page
- Klik tombol 📋 lagi
- Cek console untuk error saat loading logs

### Issue: Member tidak tersimpan saat close tab
**Solusi:**
- Pastikan user first bergabung dengan session (login dulu)
- Check sessionStorage di DevTools
- Pastikan page reload setelah close tab

## 🎯 Features

✅ **Offline Detection**: Otomatis detect ketika member disconnect
✅ **Auto Save**: Simpan ke Firestore dengan error handling
✅ **Time Format**: Menampilkan "4m ago", "1h ago", dll
✅ **Floating Menu**: 📋 button di kiri bawah, collapse/expand
✅ **Max 50 Logs**: Tampilkan 50 offline log terbaru
✅ **SessionStorage Queue**: Save ketika close tab
✅ **Console Logging**: Debug mode dengan detailed logs

## 📝 Next Steps

1. ✅ Test semua scenario
2. ✅ Verify Firestore documents
3. ⭕ Setup Firestore index jika needed (auto-created)
4. ⭕ Update Security Rules untuk production

---
Last Updated: April 2026
