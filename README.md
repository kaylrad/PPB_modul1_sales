# Create API Medication

API backend untuk manajemen data obat menggunakan Node.js, Express, dan Supabase.

## Prasyarat

- Node.js
- npm
- Akun Supabase dan project Supabase sudah dibuat

## Cara Install dan Menjalankan

1. **Clone repo**

```bash
git clone https://github.com/princeofverry/create-api-medication.git
cd create-api-medication
```

2. **Install dependencies**

```bash
npm install
```

3. **Buat file `.env`**

- Copy dari `.env.example`

```bash
cp .env.example .env
```

- Edit `.env` dan isi sesuai project Supabase kamu:

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
PORT=3000
```

4. **Jalankan API**

```bash
npm run dev       # untuk development
npm start         # untuk production
```

5. **Tes endpoint**

- Buka di browser atau Postman:

```
GET http://localhost:3000/api/medications
```

## Struktur Project

```
src/
  ├─ index.js        # Entry point API
  ├─ models/
  │    └─ medication.js
  └─ config/
       └─ supabaseClient.js
package.json
.env.example
```

## export collections on postman

- Buka postman
- Import file `praktikum-ppb-1.postman_collection.json`
- Jalankan collection

## query

```
create table categories (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text
);

create table medications (
  id uuid primary key default gen_random_uuid(),
  sku text unique,
  name text not null,
  description text,
  category_id uuid references categories(id),
  supplier_id uuid references suppliers(id),
  price numeric(12,2) default 0,
  quantity integer default 0
);
```

## Catatan

- Jangan commit `.env` ke repo, gunakan `.env.example` sebagai template.
- Pastikan Supabase sudah memiliki tabel `medications` dan data sudah ada.
