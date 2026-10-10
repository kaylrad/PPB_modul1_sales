-- Opsional: jalankan SETELAH schema.sql jika memakai SUPABASE_KEY berjenis anon.
-- Mode tugas/demo publik: anon mendapat akses CRUD langsung ke tiga tabel ini.
-- Gunakan data fiktif. Tidak mengubah izin tabel lain dalam project.
begin;

grant usage on schema public to anon;
grant select, insert, update, delete on public.members, public.books, public.loans to anon;
grant select on public.loan_details to anon;

drop policy if exists library_demo_anon_crud on public.members;
create policy library_demo_anon_crud on public.members
  for all to anon using (true) with check (true);

drop policy if exists library_demo_anon_crud on public.books;
create policy library_demo_anon_crud on public.books
  for all to anon using (true) with check (true);

drop policy if exists library_demo_anon_crud on public.loans;
create policy library_demo_anon_crud on public.loans
  for all to anon using (true) with check (true);

notify pgrst, 'reload schema';
commit;
