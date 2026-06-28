this readme file

**Mengamankan `firebase-config.js` dengan GitHub Secrets**

- **Tujuan:** jangan commit kredensial Firebase langsung ke repository. Gunakan file `.env` secara lokal dan `GitHub Secrets` pada repository untuk penyimpanan rahasia.

Langkah singkat:

1. Buat file lokal `.env` (JANGAN commit). Contoh (`.env.example` sudah tersedia):

```
FIREBASE_API_KEY=...
FIREBASE_AUTH_DOMAIN=...
FIREBASE_DATABASE_URL=...
FIREBASE_PROJECT_ID=...
FIREBASE_STORAGE_BUCKET=...
FIREBASE_MESSAGING_SENDER_ID=...
FIREBASE_APP_ID=...
```

2. Tambahkan *repository secrets* di GitHub:
	 - Buka repository → Settings → Secrets and variables → Actions → New repository secret
	 - Tambahkan secrets dengan nama yang sama seperti di `.env.example` (mis. `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, dll.) dan isi nilainya.

3. Pada proses build/deploy (mis. GitHub Actions) buat file `firebase-config.js` dinamis sebelum langkah build/deploy, contohnya langkah singkat dalam workflow:

```yaml
- name: Generate firebase-config.js
	run: |
		cat > firebase-config.js <<'EOF'
		window.__FIREBASE_CONFIG__ = {
			apiKey: "${{ secrets.FIREBASE_API_KEY }}",
			authDomain: "${{ secrets.FIREBASE_AUTH_DOMAIN }}",
			databaseURL: "${{ secrets.FIREBASE_DATABASE_URL }}",
			projectId: "${{ secrets.FIREBASE_PROJECT_ID }}",
			storageBucket: "${{ secrets.FIREBASE_STORAGE_BUCKET }}",
			messagingSenderId: "${{ secrets.FIREBASE_MESSAGING_SENDER_ID }}",
			appId: "${{ secrets.FIREBASE_APP_ID }}"
		};
		EOF
```

4. `firebase-config.js` pada repo sekarang sudah diubah agar tidak menyimpan kredensial statis. Aplikasi akan membaca variabel dari `window.__FIREBASE_CONFIG__` pada runtime (yang di-generate oleh workflow di atas) atau dari variabel build-time yang disuntikkan oleh bundler.

Catatan:
- Simpan `.env` di mesin pengembangan lokal untuk pengujian saja. File `.env` sudah ditambahkan ke `.gitignore`.

