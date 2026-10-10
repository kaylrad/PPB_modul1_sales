-- Jalankan sekali di SQL Editor project Supabase (PostgreSQL 15+).
-- Tidak menghapus tabel maupun data proyek lama.
begin;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  member_code text not null unique check (length(btrim(member_code)) between 1 and 50),
  name text not null check (length(btrim(name)) between 1 and 150),
  email text check (email is null or length(email) between 1 and 254),
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 200),
  author text not null check (length(btrim(author)) between 1 and 150),
  isbn text unique check (isbn is null or length(btrim(isbn)) between 1 and 32),
  created_at timestamptz not null default now()
);

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  book_id uuid not null references public.books(id) on delete restrict,
  borrowed_at date not null,
  due_at date not null,
  returned_at date,
  notes text check (notes is null or length(notes) <= 1000),
  created_at timestamptz not null default now(),
  constraint loans_due_after_borrowed check (due_at >= borrowed_at),
  constraint loans_returned_after_borrowed check (returned_at is null or returned_at >= borrowed_at)
);

create index if not exists loans_member_id_idx on public.loans(member_id);
create index if not exists loans_book_id_idx on public.loans(book_id);
create index if not exists loans_due_at_idx on public.loans(due_at) where returned_at is null;
create index if not exists loans_created_at_idx on public.loans(created_at desc, id desc);

create or replace view public.loan_details with (security_invoker = true) as
select
  l.*,
  case
    when l.returned_at is not null then 'Dikembalikan'
    when l.due_at < (now() at time zone 'Asia/Jakarta')::date then 'Terlambat'
    else 'Dipinjam'
  end as status,
  jsonb_build_object('id', m.id, 'member_code', m.member_code, 'name', m.name, 'email', m.email) as member,
  jsonb_build_object('id', b.id, 'title', b.title, 'author', b.author, 'isbn', b.isbn) as book
from public.loans l
join public.members m on m.id = l.member_id
join public.books b on b.id = l.book_id;

alter table public.members enable row level security;
alter table public.books enable row level security;
alter table public.loans enable row level security;
revoke all on public.members, public.books, public.loans, public.loan_details from anon, authenticated;
grant select, insert, update, delete on public.members, public.books, public.loans to service_role;
grant select on public.loan_details to service_role;

notify pgrst, 'reload schema';
commit;
