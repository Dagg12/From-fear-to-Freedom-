alter table public.books
  add column if not exists available_on date;
