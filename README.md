# Library Loans API

REST API untuk mencatat peminjaman buku oleh anggota perpustakaan. Proyek memakai **Node.js 22, Express 5, dan PostgreSQL di Supabase**. API menyediakan CRUD anggota, buku, dan peminjaman, serta filter status peminjaman. Tujuannya memudahkan pencatatan siapa yang meminjam buku, kapan buku jatuh tempo, dan kapan buku dikembalikan.

## Link pengumpulan

- **Repository publik:** https://github.com/kaylrad/PPB_modul1_sales
- **Base URL Vercel:** [https://ppb-modul1-sales-6o4k.vercel.app](https://ppb-modul1-sales-6o4k.vercel.app)
- **Base URL lokal:** `http://localhost:3000`

**Status verifikasi 10 Oktober 2026:** kode telah dipush dan build produksi Vercel berhasil. `/` dan `/health` merespons HTTP 200. `/health/ready` dan `/loans?status=Terlambat` masih merespons HTTP 503 karena environment variables Supabase belum tersedia di Vercel. Project Supabase lokal sekarang dapat dijangkau dan anon key diterima, tetapi tabel `members`, `books`, `loans`, dan view `loan_details` belum ditemukan. Agar seluruh ketentuan pengumpulan terpenuhi, pasang schema, konfigurasi akses database sesuai pilihan key di bawah, tambahkan environment variables di Vercel, redeploy, lalu jalankan smoke test sampai lulus.

## Fitur dan endpoint

| Method | Endpoint | Fungsi |
| --- | --- | --- |
| GET | `/` | Informasi API dan daftar endpoint |
| GET | `/health` | Mengecek proses API |
| GET | `/health/ready` | Mengecek koneksi tabel dan view Supabase |
| GET | `/loans` | Daftar peminjaman, filter, dan pagination |
| GET | `/loans/:id` | Detail peminjaman beserta anggota dan buku |
| POST | `/loans` | Membuat peminjaman |
| PUT / PATCH | `/loans/:id` | Memperbarui field peminjaman yang dikirim |
| DELETE | `/loans/:id` | Menghapus peminjaman |
| GET / POST | `/members` | Daftar / tambah anggota |
| GET / PUT / PATCH / DELETE | `/members/:id` | Detail / ubah / hapus anggota |
| GET / POST | `/books` | Daftar / tambah buku |
| GET / PUT / PATCH / DELETE | `/books/:id` | Detail / ubah / hapus buku |

API tugas ini dapat diuji publik tanpa login. Gunakan data fiktif untuk demonstrasi.

## Struktur data / schema

Schema lengkap ada di [`supabase/schema.sql`](supabase/schema.sql). Semua `id` adalah UUID yang dibuat database; `created_at` adalah timestamp dengan zona waktu.

### `members`

| Field | Tipe | Aturan |
| --- | --- | --- |
| `id` | uuid | Primary key, otomatis |
| `member_code` | text | Wajib, unik, maksimal 50 karakter |
| `name` | text | Wajib, maksimal 150 karakter |
| `email` | text | Opsional / null, email valid, maksimal 254 karakter |
| `created_at` | timestamptz | Otomatis |

### `books`

| Field | Tipe | Aturan |
| --- | --- | --- |
| `id` | uuid | Primary key, otomatis |
| `title` | text | Wajib, maksimal 200 karakter |
| `author` | text | Wajib, maksimal 150 karakter |
| `isbn` | text | Opsional / null, unik jika diisi, maksimal 32 karakter |
| `created_at` | timestamptz | Otomatis |

### `loans`

| Field | Tipe | Aturan |
| --- | --- | --- |
| `id` | uuid | Primary key, otomatis |
| `member_id` | uuid | Wajib, foreign key ke `members.id` |
| `book_id` | uuid | Wajib, foreign key ke `books.id` |
| `borrowed_at` | date | Wajib, format `YYYY-MM-DD` |
| `due_at` | date | Wajib, tidak boleh sebelum `borrowed_at` |
| `returned_at` | date | Opsional / null, tidak boleh sebelum `borrowed_at` |
| `notes` | text | Opsional / null, maksimal 1000 karakter |
| `created_at` | timestamptz | Otomatis |

Relasi: satu anggota mempunyai banyak peminjaman; satu buku mempunyai banyak catatan peminjaman. Anggota/buku yang masih dirujuk peminjaman tidak dapat dihapus (HTTP 409). API ini mencatat transaksi, tanpa pengelolaan stok eksemplar.

View `loan_details` menambahkan `status`, object `member`, dan object `book`. `status` dihitung saat query memakai tanggal **Asia/Jakarta (WIB)**:

- `Dikembalikan`: `returned_at` terisi, termasuk pengembalian setelah jatuh tempo.
- `Terlambat`: belum dikembalikan dan `due_at` sebelum hari ini.
- `Dipinjam`: belum dikembalikan dan `due_at` hari ini atau sesudahnya.

Field `status` hanya muncul di response dan tidak dikirim dalam body. Ubah `returned_at` untuk mencatat pengembalian; kirim `null` untuk membatalkannya. Filter status dijalankan di database **sebelum** pagination. Tanggal masa depan diperbolehkan untuk pencatatan terencana.

## Instalasi dan menjalankan lokal

1. Instal Node.js 22 dan siapkan project Supabase aktif.
2. Clone repository dan instal dependensi:

   ```bash
   git clone https://github.com/kaylrad/PPB_modul1_sales.git
   cd PPB_modul1_sales
   npm ci
   ```

3. Di Supabase Dashboard → **SQL Editor**, jalankan isi [`supabase/schema.sql`](supabase/schema.sql). Opsional: jalankan [`supabase/seed.sql`](supabase/seed.sql) untuk menambahkan anggota, buku, dan peminjaman terlambat fiktif.
4. Salin `.env.example` ke `.env`:

   ```bash
   cp .env.example .env
   ```

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

5. Isi `.env` menggunakan project yang sama dengan tempat schema dijalankan:

   ```dotenv
   SUPABASE_URL=https://PROJECT_REF.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=ISI_SECRET_KEY_ATAU_SERVICE_ROLE_KEY
   PORT=3000
   ```

   Ambil URL dasar proyek dan secret key / legacy `service_role` key dari **Project Settings → API Keys**. Kunci server hanya dipakai backend. Schema utama mengaktifkan RLS dan membatasi akses database langsung kepada `service_role`. URL untuk Supabase SDK adalah `https://PROJECT_REF.supabase.co`, tanpa `/rest/v1/`.

   **Alternatif untuk anon key pada demo tugas publik:** setelah `schema.sql`, jalankan juga [`supabase/anon-demo.sql`](supabase/anon-demo.sql). Isi konfigurasi berikut di `.env` lokal dan Vercel:

   ```dotenv
   SUPABASE_URL=https://PROJECT_REF.supabase.co
   SUPABASE_KEY=ISI_ANON_KEY
   ```

   Kosongkan atau hapus `SUPABASE_SERVICE_ROLE_KEY` saat memilih opsi anon karena aplikasi memprioritaskan variabel tersebut. Kebijakan demo memberi role `anon` akses CRUD langsung hanya ke tabel perpustakaan dan akses baca view; gunakan data fiktif. Key `anon` tidak mempunyai hak membuat tabel atau menjalankan SQL schema. Variabel `SUPABASE_KEY` juga mendukung legacy service-role key.

6. Jalankan:

   ```bash
   npm run dev
   # atau
   npm start
   ```

7. Cek `GET http://localhost:3000/health/ready`. Response HTTP 200 dengan `database: connected` memastikan database dan view siap. `/health` hanya mengecek proses API.

`.env`, token, `node_modules`, dan konfigurasi akun `.vercel` diabaikan Git. `SUPABASE_ACCESS_TOKEN` dan `VERCEL_TOKEN` hanya diperlukan jika menyiapkan infrastruktur melalui CLI/API, bukan untuk menjalankan aplikasi.

## Contoh request dan response

Contoh berikut memakai `curl` pada Bash. Di Windows PowerShell, gunakan `curl.exe` atau Postman. UUID di contoh berasal dari `seed.sql`; bila membuat data sendiri, gunakan `id` dari response POST.

### Membuat anggota dan buku

```bash
curl -X POST http://localhost:3000/members \
  -H 'Content-Type: application/json' \
  -d '{"member_code":"AGT-002","name":"Anggota Contoh","email":"anggota@example.test"}'

curl -X POST http://localhost:3000/books \
  -H 'Content-Type: application/json' \
  -d '{"title":"Dasar Pemrograman Web","author":"Penulis Contoh","isbn":"9780000000002"}'
```

Kedua endpoint mengembalikan HTTP **201** dengan `{ "data": { ... } }`, termasuk UUID dan `created_at`.

### Create — POST `/loans`

```bash
curl -X POST http://localhost:3000/loans \
  -H 'Content-Type: application/json' \
  -d '{"member_id":"11111111-1111-4111-8111-111111111111","book_id":"22222222-2222-4222-8222-222222222222","borrowed_at":"2026-10-01","due_at":"2026-10-07","notes":"Untuk belajar"}'
```

Response HTTP **201** (contoh jika tanggal WIB sudah melewati 7 Oktober 2026). UUID peminjaman dibuat otomatis dan dapat berbeda:

```json
{
  "data": {
    "id": "44444444-4444-4444-8444-444444444444",
    "member_id": "11111111-1111-4111-8111-111111111111",
    "book_id": "22222222-2222-4222-8222-222222222222",
    "borrowed_at": "2026-10-01",
    "due_at": "2026-10-07",
    "returned_at": null,
    "notes": "Untuk belajar",
    "created_at": "2026-10-10T03:00:00+00:00",
    "status": "Terlambat",
    "member": {
      "id": "11111111-1111-4111-8111-111111111111",
      "member_code": "AGT-001",
      "name": "Anggota Demo",
      "email": "demo@example.test"
    },
    "book": {
      "id": "22222222-2222-4222-8222-222222222222",
      "title": "Belajar Express",
      "author": "Penulis Demo",
      "isbn": "9780000000001"
    }
  }
}
```

### Read — GET `/loans` dan GET `/loans/:id`

```bash
curl http://localhost:3000/loans
curl http://localhost:3000/loans/44444444-4444-4444-8444-444444444444
```

Response daftar HTTP **200**:

```json
{
  "data": [],
  "pagination": { "total": 0, "limit": 20, "offset": 0 }
}
```

Jika ada data, `data` berisi object lengkap seperti response POST. Response detail adalah `{ "data": { ... } }`. ID valid yang tidak ditemukan menghasilkan HTTP **404**.

### Filter query

```bash
curl 'http://localhost:3000/loans?status=Terlambat'
curl 'http://localhost:3000/loans?status=Dikembalikan&member_id=11111111-1111-4111-8111-111111111111&limit=10&offset=0'
curl 'http://localhost:3000/loans?book_id=22222222-2222-4222-8222-222222222222'
```

| Query | Nilai |
| --- | --- |
| `status` | `Dipinjam`, `Dikembalikan`, atau `Terlambat` (case sensitive) |
| `member_id` | UUID anggota |
| `book_id` | UUID buku |
| `limit` | 1–100, default 20 |
| `offset` | Bilangan bulat >= 0, default 0 |

Beberapa filter dapat digabungkan dan memakai kondisi AND. `total` adalah jumlah seluruh hasil setelah filter, sebelum pagination. Urutan data adalah `created_at` terbaru, kemudian `id`. `/members` dan `/books` mendukung `limit` dan `offset`. Query tidak dikenal atau berulang menghasilkan HTTP 400.

### Update — PUT `/loans/:id`

```bash
curl -X PUT http://localhost:3000/loans/44444444-4444-4444-8444-444444444444 \
  -H 'Content-Type: application/json' \
  -d '{"returned_at":"2026-10-09","notes":"Sudah dikembalikan"}'
```

Response HTTP **200**: `{ "data": { ... } }` berisi catatan lengkap, `returned_at: "2026-10-09"`, dan `status: "Dikembalikan"`. PUT dan PATCH sama-sama memperbarui hanya field yang dikirim. Aturan urutan tanggal tetap diperiksa database untuk update sebagian.

### Delete — DELETE `/loans/:id`

```bash
curl -X DELETE http://localhost:3000/loans/44444444-4444-4444-8444-444444444444
```

Response HTTP **200**:

```json
{ "message": "Peminjaman berhasil dihapus." }
```

Menghapus ID yang sama lagi menghasilkan HTTP 404.

### Contoh error

Body tanggal tidak valid menghasilkan HTTP **400**:

```json
{
  "error": {
    "message": "Validasi gagal.",
    "details": ["due_at harus berupa tanggal valid YYYY-MM-DD."]
  }
}
```

| Status HTTP | Arti |
| --- | --- |
| 200 | Pembacaan, update, atau penghapusan berhasil |
| 201 | Data dibuat |
| 400 | Body/query/UUID/tanggal tidak valid |
| 404 | Data atau endpoint tidak ditemukan |
| 409 | Konflik foreign key atau nilai unik |
| 413 | Body JSON melebihi 100 KB |
| 500 | Kesalahan internal |
| 503 | Koneksi, kredensial, atau schema Supabase bermasalah |

Field tidak dikenal, termasuk `id`, `created_at`, dan `status`, ditolak pada body. Detail internal database dan kunci tidak ditampilkan dalam response error.

## Pengujian

```bash
npm test
npm run check
```

Test otomatis menjalankan schema SQL asli di PostgreSQL dalam memori melalui PGlite, menguji HTTP Express dan query Supabase JS melalui adapter PostgREST lokal. Data terisolasi dan tidak memerlukan kredensial Supabase. Untuk menguji project Supabase nyata, nyalakan API lalu jalankan:

```bash
npm run smoke
# Setelah deployment:
npm run smoke -- https://ppb-modul1-sales-6o4k.vercel.app
```

Smoke test membuat data uji sementara, mengecek koneksi, create/read/update/delete dan filter `Terlambat`, lalu menghapus data uji yang dibuatnya. Ia hanya menghapus ID milik pengujian tersebut.

Collection Postman: import [`Library_API_Postman_Collection.json`](Library_API_Postman_Collection.json), atur collection variable `base_url`, lalu jalankan berurutan. ID anggota, buku, dan peminjaman disimpan otomatis dari response POST.

## Deployment ke Vercel

Aplikasi mengekspor instance Express dari `src/index.js`; listener lokal berada di `src/server.js`. `vercel.json` memilih framework Express dan region Singapore.

1. Pastikan schema sudah dipasang di Supabase aktif dan smoke test lokal lulus.
2. Commit dan push kode ke repository publik di atas.
3. Untuk deployment yang sudah terhubung, buka project Vercel **`ppb-modul1-sales-6o4k`**. Untuk membuat deployment baru, masuk ke Vercel → **Add New → Project**, lalu import repository `kaylrad/PPB_modul1_sales`.
4. Pilih framework **Express**, root directory `./`, Node.js **22.x**. Biarkan Build Command dan Output Directory mengikuti default Express.
5. Tambahkan environment variables `SUPABASE_URL` dan `SUPABASE_SERVICE_ROLE_KEY` untuk **Production** (serta Preview bila dibutuhkan). Jika memakai mode anon, jalankan `anon-demo.sql`, gunakan `SUPABASE_KEY` sebagai pengganti `SUPABASE_SERVICE_ROLE_KEY`, dan kosongkan/hapus variabel service-role. Jangan unggah `.env` atau token pengelolaan akun ke repository.
6. Klik **Deploy**. Jika mengubah environment variables setelah deploy, lakukan redeploy.
7. Di project Vercel, pastikan deployment produksi dapat diakses publik. Jika Deployment Protection meminta login, sesuaikan pengaturan produksi agar penilai dapat mengakses endpoint.
8. Salin domain produksi yang diberikan Vercel. Uji `/health/ready`, `/loans`, dan `/loans?status=Terlambat`, kemudian jalankan smoke test terhadap domain tersebut.
9. Perbarui status verifikasi di bagian Link pengumpulan setelah seluruh endpoint berfungsi. Jika domain produksi berubah, perbarui juga **Base URL Vercel**, lalu commit dan push README.

Alternatif CLI dari root proyek:

```bash
npx vercel login
npx vercel link
npx vercel env add SUPABASE_URL production
npx vercel env add SUPABASE_SERVICE_ROLE_KEY production
npx vercel --prod
```

Untuk mode anon, ganti perintah `vercel env add SUPABASE_SERVICE_ROLE_KEY production` dengan `vercel env add SUPABASE_KEY production`.

Rujukan: [Express on Vercel](https://vercel.com/docs/frameworks/backend/express), [Supabase views](https://supabase.com/docs/guides/database/views), dan [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Struktur proyek

```text
src/
  index.js                  # Express app, diekspor untuk Vercel
  server.js                 # Listener untuk menjalankan lokal
  config/supabaseClient.js   # Koneksi Supabase server
  models/libraryModel.js    # Query CRUD dan filter
  routes/resourceRoutes.js  # Endpoint anggota, buku, peminjaman
  utils/errors.js           # Error JSON dan pemetaan error database
  utils/validation.js       # Validasi body, query, UUID, tanggal
supabase/
  schema.sql                # Tabel, relasi, view status, izin, indeks
  anon-demo.sql             # Opsi kebijakan RLS untuk anon key demo publik
  seed.sql                  # Data fiktif opsional
scripts/smoke.mjs            # Uji terhadap API dan database nyata
test/                       # Test otomatis
.env.example
Library_API_Postman_Collection.json
package.json
package-lock.json
vercel.json
README.md
```
