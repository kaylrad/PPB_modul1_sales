import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const base = (process.argv[2] || 'http://localhost:3000').replace(/\/$/, '');
const created = [];
async function request(path, method = 'GET', body, expected = 200) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  const result = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(result)}`);
  return result;
}

try {
  await request('/health');
  const ready = await request('/health/ready');
  assert.equal(ready.database, 'connected');
  const member = (await request('/members', 'POST', {
    member_code: `SMOKE-${randomUUID().slice(0, 8)}`, name: 'Anggota Uji Sementara',
  }, 201)).data;
  created.push(['/members', member.id]);
  const book = (await request('/books', 'POST', { title: 'Buku Uji Sementara', author: 'Pengujian API' }, 201)).data;
  created.push(['/books', book.id]);
  const loan = (await request('/loans', 'POST', {
    member_id: member.id, book_id: book.id, borrowed_at: '2000-01-01', due_at: '2000-01-02',
  }, 201)).data;
  created.push(['/loans', loan.id]);
  assert.equal(loan.status, 'Terlambat');
  assert.equal((await request(`/loans/${loan.id}`)).data.book.id, book.id);
  const filtered = await request(`/loans?status=Terlambat&member_id=${member.id}`);
  assert.equal(filtered.pagination.total, 1);
  assert.equal(filtered.data[0].id, loan.id);
  const returned = (await request(`/loans/${loan.id}`, 'PUT', { returned_at: '2000-01-03' })).data;
  assert.equal(returned.status, 'Dikembalikan');
  assert.equal((await request(`/loans?status=Terlambat&member_id=${member.id}`)).pagination.total, 0);
  await request(`/loans/${loan.id}`, 'DELETE');
  created.pop();
  await request(`/loans/${loan.id}`, 'GET', undefined, 404);
  console.log(`LULUS: koneksi database, CRUD peminjaman, relasi, dan filter status di ${base}`);
} catch (error) {
  console.error(`GAGAL: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const [path, id] of created.reverse()) {
    try { await request(`${path}/${id}`, 'DELETE'); }
    catch (error) { console.error(`Pembersihan data uji ${path}/${id} gagal: ${error.message}`); process.exitCode = 1; }
  }
}
