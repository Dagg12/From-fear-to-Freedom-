begin;

alter table public.order_items
  add column if not exists is_preorder boolean not null default false,
  add column if not exists available_on date,
  add column if not exists stock_reserved boolean not null default false;

notify pgrst, 'reload schema';

commit;
