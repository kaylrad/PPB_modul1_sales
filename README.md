# API Peminjaman Buku

API ini dibuat untuk mencatat peminjaman buku oleh anggota perpustakaan. Data yang disimpan meliputi anggota, buku, tanggal pinjam, jatuh tempo, dan tanggal pengembalian. Proyek menggunakan Node.js, Express, dan Supabase.

- Repository: https://github.com/kaylrad/PPB_modul1_sales
- Deployment: https://ppb-modul1-sales-6o4k.vercel.app

Pengujian terakhir: API sudah berjalan, tetapi CRUD masih merespons HTTP 503 karena konfigurasi Supabase belum selesai. Link deployment akan diperbarui jika memakai domain produksi lain.

## Database

Schema lengkap ada di [supabase/schema.sql](supabase/schema.sql).

| Tabel | Kolom dan tipe data |
| --- | --- |
| `members` | `id` uuid, `member_code` text, `name` text, `email` text, `created_at` timestamptz |
| `books` | `id` uuid, `title` text, `author` text, `isbn` text, `created_at` timestamptz |
| `loans` | `id` uuid, `member_id` uuid, `book_id` uuid, `borrowed_at` date, `due_at` date, `returned_at` date, `notes` text, `created_at` timestamptz |

`id` dan `created_at` dibuat otomatis. `member_id` terhubung ke tabel `members`, sedangkan `book_id` terhubung ke `books`. Email, ISBN, catatan, dan tanggal pengembalian boleh kosong (`null`). Kode anggota dan ISBN harus unik jika diisi.

Status peminjaman dihitung melalui view `loan_details` menggunakan tanggal WIB:

- `Dipinjam`: belum dikembalikan dan belum melewati jatuh tempo.
- `Terlambat`: belum dikembalikan dan sudah melewati jatuh tempo.
- `Dikembalikan`: tanggal pengembalian sudah diisi.

Tanggal menggunakan format `YYYY-MM-DD`. Jatuh tempo dan tanggal pengembalian tidak boleh sebelum tanggal pinjam. Anggota atau buku yang masih dipakai oleh catatan peminjaman tidak bisa dihapus.

## Endpoint

| Method | Endpoint | Keterangan |
| --- | --- | --- |
| GET | `/loans` | Menampilkan peminjaman |
| GET | `/loans/:id` | Detail peminjaman |
| POST | `/loans` | Menambah peminjaman |
| PUT / PATCH | `/loans/:id` | Mengubah peminjaman |
| DELETE | `/loans/:id` | Menghapus peminjaman |
| GET / POST | `/members` | Menampilkan atau menambah anggota |
| GET / PUT / PATCH / DELETE | `/members/:id` | Detail, ubah, atau hapus anggota |
| GET / POST | `/books` | Menampilkan atau menambah buku |
| GET / PUT / PATCH / DELETE | `/books/:id` | Detail, ubah, atau hapus buku |
| GET | `/health/ready` | Mengecek koneksi database |

Filter yang tersedia pada `/loans`: `status`, `member_id`, dan `book_id`. Beberapa filter bisa dipakai bersamaan. Daftar data juga mendukung `limit` (1-100, default 20) dan `offset` (default 0).

## Menjalankan di lokal

Gunakan Node.js 22 dan project Supabase yang aktif.

```bash
git clone https://github.com/kaylrad/PPB_modul1_sales.git
cd PPB_modul1_sales
npm ci
```

1. Buka SQL Editor di Supabase dan jalankan `supabase/schema.sql`.
2. Jika menggunakan anon key, jalankan juga `supabase/anon-demo.sql`. Mode ini memberikan akses CRUD publik pada tabel perpustakaan, jadi gunakan data contoh.
3. Salin `.env.example` menjadi `.env`. Di PowerShell, jalankan `Copy-Item .env.example .env`.
4. Isi URL dan key Supabase:

```env
SUPABASE_URL=https://PROJECT_REF.supabase.co
SUPABASE_KEY=ANON_KEY_ANDA
PORT=3000
```

Gunakan URL dasar proyek, tanpa `/rest/v1/`. Jika memakai secret key atau service-role key, isi `SUPABASE_SERVICE_ROLE_KEY` sebagai pengganti `SUPABASE_KEY` dan cukup jalankan `schema.sql`. Isi salah satu variabel key saja.

Jalankan server:

```bash
npm run dev
```

API lokal tersedia di `http://localhost:3000`. Untuk menjalankan tanpa mode watch, gunakan `npm start`. File `.env` tidak ikut diunggah ke GitHub.

## Contoh request dan response

Contoh UUID berikut memakai data dari [supabase/seed.sql](supabase/seed.sql). Jalankan file tersebut jika ingin memakai contoh ini. Jika membuat anggota dan buku sendiri, gunakan ID dari hasil POST.

### Tambah peminjaman

```http
POST /loans
Content-Type: application/json

{
  "member_id": "11111111-1111-4111-8111-111111111111",
  "book_id": "22222222-2222-4222-8222-222222222222",
  "borrowed_at": "2026-10-01",
  "due_at": "2026-10-07",
  "notes": "Untuk belajar"
}
```

Contoh response HTTP 201, jika tanggal WIB sudah melewati 7 Oktober 2026:

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
    "member": { "id": "11111111-1111-4111-8111-111111111111", "member_code": "AGT-001", "name": "Anggota Demo", "email": "demo@example.test" },
    "book": { "id": "22222222-2222-4222-8222-222222222222", "title": "Belajar Express", "author": "Penulis Demo", "isbn": "9780000000001" }
  }
}
```

ID peminjaman dibuat otomatis dan bisa berbeda dari contoh.

### Menampilkan dan memfilter peminjaman

```http
GET /loans
GET /loans?status=Terlambat
GET /loans?status=Dikembalikan&limit=10&offset=0
GET /loans/44444444-4444-4444-8444-444444444444
```

Response daftar berisi array `data` dan informasi halaman. Jika hasil filter kosong, response HTTP 200 seperti berikut:

```json
{
  "data": [],
  "pagination": { "total": 0, "limit": 20, "offset": 0 }
}
```

Response detail berisi satu object `data`, seperti pada contoh POST. Nilai filter status harus `Dipinjam`, `Terlambat`, atau `Dikembalikan`.

### Mencatat pengembalian

```http
PUT /loans/44444444-4444-4444-8444-444444444444
Content-Type: application/json

{ "returned_at": "2026-10-09" }
```

Response HTTP 200 berisi data peminjaman terbaru dengan status `Dikembalikan`. PUT dan PATCH mengubah field yang dikirim saja. Status dihitung otomatis, jadi cukup kirim `returned_at` untuk mencatat pengembalian.

### Menghapus peminjaman

```http
DELETE /loans/44444444-4444-4444-8444-444444444444
```

Response HTTP 200:

```json
{ "message": "Peminjaman berhasil dihapus." }
```

Input tidak valid menghasilkan HTTP 400, data tidak ditemukan 404, konflik data 409, dan masalah koneksi atau konfigurasi database 503.

## Deployment

Import repository ke Vercel. Gunakan framework Express dan Node.js 22, lalu isi `SUPABASE_URL` dan `SUPABASE_KEY` untuk environment Production. Jika memakai kunci server, gunakan `SUPABASE_SERVICE_ROLE_KEY`.

Setelah mengubah environment variables, lakukan redeploy. Gunakan domain Production yang bisa dibuka tanpa login Vercel. Cek `/health/ready` untuk memastikan koneksi Supabase berhasil.

## Pengujian

```bash
npm test
npm run check
npm run smoke -- https://ppb-modul1-sales-6o4k.vercel.app
```

Smoke test mengecek CRUD dan filter melalui API yang berjalan. Data sementara yang dibuat saat pengujian akan dihapus kembali.

Untuk memakai Postman, import [Library_API_Postman_Collection.json](Library_API_Postman_Collection.json), atur `base_url`, lalu jalankan request secara berurutan. ID dari hasil POST akan disimpan otomatis.
