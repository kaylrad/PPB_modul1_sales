import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import { PGlite } from '@electric-sql/pglite';
import { createClient } from '@supabase/supabase-js';
import { createApp } from '../src/index.js';
import { createRepository } from '../src/models/libraryModel.js';
import { postgrestFetch } from './helpers/postgrest.js';

const missingId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const requests = [];
let db;
let server;
let base;
let repository;
let member;
let book;
let today;
let yesterday;
let tomorrow;

before(async () => {
  db = new PGlite();
  await db.waitReady;
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
  await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  const dates = (await db.query("SELECT ((now() at time zone 'Asia/Jakarta')::date)::text AS today, ((now() at time zone 'Asia/Jakarta')::date - 1)::text AS yesterday, ((now() at time zone 'Asia/Jakarta')::date + 1)::text AS tomorrow")).rows[0];
  ({ today, yesterday, tomorrow } = dates);
  const client = createClient('https://test.supabase.test', 'test-service-key', {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: postgrestFetch(db, requests) },
  });
  repository = createRepository(client);
  server = createApp({ getRepository: () => repository }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (db) await db.close();
});

async function request(path, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}; database: ${JSON.stringify(requests.at(-1)?.error)}`);
  return { response, result };
}

beforeEach(async () => {
  await db.exec('TRUNCATE public.loans, public.members, public.books;');
  requests.length = 0;
  member = (await request('/members', 'POST', { member_code: 'TEST-001', name: 'Anggota Uji', email: 'test@example.test' }, 201)).result.data;
  book = (await request('/books', 'POST', { title: 'Buku Uji', author: 'Penulis Uji' }, 201)).result.data;
});

async function loan(overrides = {}) {
  return (await request('/loans', 'POST', {
    member_id: member.id, book_id: book.id, borrowed_at: yesterday, due_at: tomorrow, ...overrides,
  }, 201)).result.data;
}

test('CRUD peminjaman lengkap menggunakan repository Supabase dan schema PostgreSQL asli', async () => {
  const created = await loan({ notes: '  Catatan peminjaman  ' });
  assert.equal(created.status, 'Dipinjam');
  assert.equal(created.notes, 'Catatan peminjaman');
  assert.equal(created.member.name, member.name);
  assert.equal(created.book.title, book.title);
  assert.equal(created.returned_at, null);
  assert.equal((await request(`/loans/${created.id}`)).result.data.id, created.id);
  const returned = (await request(`/loans/${created.id}`, 'PUT', { returned_at: today })).result.data;
  assert.equal(returned.status, 'Dikembalikan');
  assert.equal(returned.notes, created.notes);
  const reopened = (await request(`/loans/${created.id}`, 'PATCH', { returned_at: null })).result.data;
  assert.equal(reopened.status, 'Dipinjam');
  await request(`/loans/${created.id}`, 'DELETE');
  await request(`/loans/${created.id}`, 'GET', undefined, 404);
  await request(`/loans/${created.id}`, 'DELETE', undefined, 404);
});

test('status Terlambat, jatuh tempo hari ini, dan pengembalian terlambat dihitung oleh view WIB', async () => {
  const overdue = await loan({ due_at: yesterday });
  const dueToday = await loan({ due_at: today });
  const returnedLate = await loan({ due_at: yesterday, returned_at: today });
  assert.equal(overdue.status, 'Terlambat');
  assert.equal(dueToday.status, 'Dipinjam');
  assert.equal(returnedLate.status, 'Dikembalikan');
});

test('filter diterapkan sebelum pagination dengan total yang benar dan relasi digabungkan memakai AND', async () => {
  await loan();
  const overdueA = await loan({ due_at: yesterday });
  await loan({ due_at: yesterday });
  const otherMember = (await request('/members', 'POST', { member_code: 'TEST-002', name: 'Anggota Lain' }, 201)).result.data;
  await loan({ member_id: otherMember.id, due_at: yesterday });
  const query = `status=Terlambat&member_id=${member.id}&book_id=${book.id}&limit=1&offset=1`;
  const { result } = await request(`/loans?${query}`);
  assert.equal(result.data.length, 1);
  assert.equal(result.pagination.total, 2);
  assert.equal(result.pagination.offset, 1);
  assert.equal(result.data[0].id, overdueA.id);
  assert.equal(result.data[0].status, 'Terlambat');
  const last = requests.at(-1);
  assert.equal(last.table, 'loan_details');
  assert.equal(last.query.get('status'), 'eq.Terlambat');
  const empty = (await request('/loans?limit=10&offset=100')).result;
  assert.equal(empty.data.length, 0);
  assert.equal(empty.pagination.total, 4);
});

test('daftar kosong dan data tidak ditemukan memakai status HTTP yang sesuai', async () => {
  assert.deepEqual((await request('/loans')).result, { data: [], pagination: { total: 0, limit: 20, offset: 0 } });
  for (const resource of ['members', 'books', 'loans']) {
    await request(`/${resource}/${missingId}`, 'GET', undefined, 404);
    await request(`/${resource}/${missingId}`, 'DELETE', undefined, 404);
  }
  await request(`/loans/${missingId}`, 'PUT', { notes: 'Tidak ada' }, 404);
});

test('foreign key dan larangan menghapus anggota/buku dengan riwayat peminjaman', async () => {
  await request('/loans', 'POST', { member_id: missingId, book_id: book.id, borrowed_at: yesterday, due_at: today }, 409);
  const created = await loan();
  await request(`/members/${member.id}`, 'DELETE', undefined, 409);
  await request(`/books/${book.id}`, 'DELETE', undefined, 409);
  await request(`/loans/${created.id}`, 'DELETE');
  await request(`/members/${member.id}`, 'DELETE');
  await request(`/books/${book.id}`, 'DELETE');
});

test('kode anggota dan ISBN unik serta update anggota dan buku', async () => {
  await request('/members', 'POST', { member_code: 'TEST-001', name: 'Duplikat' }, 409);
  await request(`/books/${book.id}`, 'PUT', { isbn: '9780000000001' });
  await request('/books', 'POST', { title: 'Duplikat', author: 'Penulis', isbn: '9780000000001' }, 409);
  const changed = (await request(`/members/${member.id}`, 'PATCH', { name: 'Nama Baru', email: null })).result.data;
  assert.equal(changed.name, 'Nama Baru');
  assert.equal(changed.email, null);
  assert.equal((await request(`/books/${book.id}`)).result.data.isbn, '9780000000001');
  assert.equal((await request('/members?limit=1')).result.pagination.total, 1);
});

test('constraint tanggal tetap berlaku pada update sebagian tanpa mengubah data tersimpan', async () => {
  const created = await loan();
  await request(`/loans/${created.id}`, 'PATCH', { due_at: '2000-01-01' }, 400);
  await request(`/loans/${created.id}`, 'PUT', { returned_at: '2000-01-01' }, 400);
  assert.equal((await request(`/loans/${created.id}`)).result.data.due_at, tomorrow);
});

for (const [label, body] of [
  ['kosong', {}], ['array', []], ['null', null],
  ['field wajib hilang', { notes: 'Tidak lengkap' }],
  ['UUID salah', { member_id: '1', book_id: missingId, borrowed_at: '2026-10-01', due_at: '2026-10-07' }],
  ['tanggal tidak nyata', { member_id: missingId, book_id: missingId, borrowed_at: '2026-02-30', due_at: '2026-03-01' }],
  ['format tanggal salah', { member_id: missingId, book_id: missingId, borrowed_at: '01/10/2026', due_at: '2026-10-07' }],
  ['jatuh tempo sebelum pinjam', { member_id: missingId, book_id: missingId, borrowed_at: '2026-10-07', due_at: '2026-10-01' }],
  ['status dalam body', { status: 'Terlambat' }],
  ['field internal', { id: missingId, created_at: '2026-10-01' }],
]) {
  test(`validasi body menolak ${label} sebelum query database`, async () => {
    requests.length = 0;
    await request('/loans', 'POST', body, 400);
    assert.equal(requests.length, 0);
  });
}

for (const query of ['status=invalid', 'status=Terlambat&status=Dipinjam', 'limit=0', 'limit=101', 'limit=1.5', 'offset=-1', 'offset=9007199254740992', 'member_id=invalid', 'book_id=invalid', 'unknown=yes']) {
  test(`query tidak valid ditolak: ${query}`, async () => {
    requests.length = 0;
    await request(`/loans?${query}`, 'GET', undefined, 400);
    assert.equal(requests.length, 0);
  });
}

test('UUID tidak valid, body update kosong, email salah, dan teks terlalu panjang ditolak', async () => {
  await request('/loans/invalid', 'GET', undefined, 400);
  await request(`/members/${member.id}`, 'PUT', {}, 400);
  await request('/members', 'POST', { member_code: 'CODE', name: 'Nama', email: 'invalid' }, 400);
  await request('/books', 'POST', { title: 'x'.repeat(201), author: 'Penulis' }, 400);
});

test('JSON rusak, batas body, CORS, root, health, dan endpoint tidak dikenal', async () => {
  const bad = await fetch(`${base}/loans`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.equal(bad.status, 400);
  await request('/loans', 'POST', { notes: 'x'.repeat(110000) }, 413);
  const preflight = await fetch(`${base}/loans`, { method: 'OPTIONS' });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  assert.equal((await request('/')).result.name, 'Library Loans API');
  await request('/health');
  assert.equal((await request('/health/ready')).result.database, 'connected');
  await request('/unknown', 'GET', undefined, 404);
});

test('gangguan Supabase menghasilkan 503 tanpa menampilkan detail internal', async () => {
  const client = createClient('https://test.supabase.test', 'test-service-key', {
    global: { fetch: async () => Response.json({ code: 'PGRST205', message: 'private-secret-table-detail' }, { status: 404 }) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const failing = createRepository(client);
  await assert.rejects(() => failing.list('loans', { limit: 20, offset: 0 }), (error) => error.status === 503 && !error.message.includes('private-secret'));
});

test('schema dapat dijalankan ulang, seed valid, RLS aktif, dan anon tidak memperoleh akses', async () => {
  await db.exec(await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../supabase/seed.sql', import.meta.url), 'utf8'));
  const seeded = (await db.query("SELECT status FROM public.loan_details WHERE id = '33333333-3333-4333-8333-333333333333'")).rows[0];
  assert.equal(seeded.status, 'Terlambat');
  const roles = (await db.query("SELECT relrowsecurity FROM pg_class WHERE oid = 'public.loans'::regclass")).rows[0];
  assert.equal(roles.relrowsecurity, true);
  const permissions = (await db.query("SELECT has_table_privilege('anon', 'public.loans', 'SELECT') AS anon_read, has_table_privilege('service_role', 'public.loans', 'INSERT') AS server_write")).rows[0];
  assert.equal(permissions.anon_read, false);
  assert.equal(permissions.server_write, true);
});

test('mode anon opsional membuka CRUD demo melalui RLS tanpa membuka akses authenticated', async () => {
  const sql = await readFile(new URL('../supabase/anon-demo.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql);
  const permissions = (await db.query("SELECT has_table_privilege('anon', 'public.loan_details', 'SELECT') AS anon_read, has_table_privilege('authenticated', 'public.loans', 'INSERT') AS authenticated_write")).rows[0];
  assert.equal(permissions.anon_read, true);
  assert.equal(permissions.authenticated_write, false);
  await db.exec('SET ROLE anon;');
  try {
    const anonMember = (await db.query("INSERT INTO public.members (member_code, name) VALUES ('ANON-TEST', 'Anggota Anon') RETURNING id")).rows[0];
    const anonLoan = (await db.query('INSERT INTO public.loans (member_id, book_id, borrowed_at, due_at) VALUES ($1, $2, $3, $3) RETURNING id', [anonMember.id, book.id, yesterday])).rows[0];
    assert.equal((await db.query('SELECT status FROM public.loan_details WHERE id = $1', [anonLoan.id])).rows[0].status, 'Terlambat');
    await db.query('UPDATE public.loans SET returned_at = $1 WHERE id = $2', [today, anonLoan.id]);
    assert.equal((await db.query('SELECT status FROM public.loan_details WHERE id = $1', [anonLoan.id])).rows[0].status, 'Dikembalikan');
    await db.query('DELETE FROM public.loans WHERE id = $1', [anonLoan.id]);
    await db.query('DELETE FROM public.members WHERE id = $1', [anonMember.id]);
  } finally {
    await db.exec('RESET ROLE;');
  }
});
