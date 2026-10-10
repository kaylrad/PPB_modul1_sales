-- Data fiktif opsional untuk demonstrasi. Jalankan setelah schema.sql.
begin;
insert into public.members (id, member_code, name, email)
values ('11111111-1111-4111-8111-111111111111', 'AGT-001', 'Anggota Demo', 'demo@example.test')
on conflict do nothing;

insert into public.books (id, title, author, isbn)
values ('22222222-2222-4222-8222-222222222222', 'Belajar Express', 'Penulis Demo', '9780000000001')
on conflict do nothing;

insert into public.loans (id, member_id, book_id, borrowed_at, due_at, notes)
values (
  '33333333-3333-4333-8333-333333333333',
  '11111111-1111-4111-8111-111111111111',
  '22222222-2222-4222-8222-222222222222',
  (now() at time zone 'Asia/Jakarta')::date - 10,
  (now() at time zone 'Asia/Jakarta')::date - 3,
  'Data demo untuk filter Terlambat'
)
on conflict do nothing;
commit;
