begin;

alter table public.books
  add column if not exists available_on date;

notify pgrst, 'reload schema';

commit;
