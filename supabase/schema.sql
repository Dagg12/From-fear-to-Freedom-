-- From Fear to Freedom — Supabase schema
-- Run in Supabase SQL Editor after creating a new project.
-- Security note: never expose service_role keys in the browser.

create extension if not exists pgcrypto;

create type public.order_status as enum ('pending','paid','shipped','completed','cancelled','refunded');
create type public.discount_type as enum ('percentage','fixed');
create type public.review_status as enum ('pending','approved','hidden');
create type public.event_status as enum ('draft','published','cancelled');
create type public.campaign_status as enum ('draft','active','ended');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_path text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  subtitle text,
  author_name text not null default 'Refilwe Mokgosi-Mogale',
  description text not null default '',
  price numeric(12,2) not null check (price >= 0),
  compare_at_price numeric(12,2) check (compare_at_price is null or compare_at_price >= 0),
  currency char(3) not null default 'ZAR',
  cover_path text,
  gallery_paths text[] not null default '{}',
  category text,
  isbn text,
  format text not null default 'Paperback',
  stock_quantity integer check (stock_quantity is null or stock_quantity >= 0),
  is_preorder boolean not null default true,
  is_published boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('FFF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  user_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  customer_email text not null,
  customer_phone text,
  shipping_address jsonb not null default '{}'::jsonb,
  status public.order_status not null default 'pending',
  currency char(3) not null default 'ZAR',
  subtotal numeric(12,2) not null default 0 check (subtotal >= 0),
  discount_total numeric(12,2) not null default 0 check (discount_total >= 0),
  shipping_total numeric(12,2) not null default 0 check (shipping_total >= 0),
  total numeric(12,2) not null default 0 check (total >= 0),
  promo_code_id uuid,
  promo_code_snapshot text,
  customer_note text,
  admin_note text,
  payment_provider text,
  payment_reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  title_snapshot text not null,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored
);

create table public.promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text,
  discount_kind public.discount_type not null,
  discount_value numeric(12,2) not null check (discount_value > 0),
  minimum_order_value numeric(12,2) not null default 0 check (minimum_order_value >= 0),
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  usage_count integer not null default 0 check (usage_count >= 0),
  per_customer_limit integer check (per_customer_limit is null or per_customer_limit > 0),
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (discount_kind <> 'percentage' or discount_value <= 100)
);

alter table public.orders
  add constraint orders_promo_code_fk foreign key (promo_code_id) references public.promo_codes(id) on delete set null;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  display_name text not null,
  rating integer not null check (rating between 1 and 5),
  title text,
  body text not null check (char_length(body) between 10 and 3000),
  status public.review_status not null default 'pending',
  verified_purchase boolean not null default false,
  moderated_by uuid references public.profiles(id) on delete set null,
  moderated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (book_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text,
  description text not null default '',
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null default 'Africa/Johannesburg',
  location_name text,
  address text,
  booking_url text,
  status public.event_status not null default 'draft',
  featured boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.event_images (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  banner_path text,
  promo_code_id uuid references public.promo_codes(id) on delete set null,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  status public.campaign_status not null default 'draft',
  featured boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  consent_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.wishlists (
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);

create index books_published_idx on public.books (is_published, featured);
create index orders_user_created_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index order_items_order_idx on public.order_items (order_id);
create index reviews_public_idx on public.reviews (book_id, status, created_at desc);
create index events_public_idx on public.events (status, starts_at);
create index campaigns_public_idx on public.campaigns (status, starts_at, ends_at);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_admin = true
  );
$$;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger books_updated_at before update on public.books
for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders
for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events
for each row execute function public.set_updated_at();
create trigger campaigns_updated_at before update on public.campaigns
for each row execute function public.set_updated_at();

-- Create a profile whenever a user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS on all app tables.
alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.promo_codes enable row level security;
alter table public.reviews enable row level security;
alter table public.events enable row level security;
alter table public.event_images enable row level security;
alter table public.campaigns enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.wishlists enable row level security;

create policy "Profiles: read own or admin" on public.profiles for select
using (id = auth.uid() or public.is_admin());
create policy "Profiles: update own or admin" on public.profiles for update
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

create policy "Published books are public" on public.books for select
using (is_published = true or public.is_admin());
create policy "Admins manage books" on public.books for all
using (public.is_admin()) with check (public.is_admin());

create policy "Customers read own orders; admins read all" on public.orders for select
using (user_id = auth.uid() or public.is_admin());
create policy "Signed-in users create own pending orders" on public.orders for insert
with check (auth.uid() is not null and user_id = auth.uid() and status = 'pending');
create policy "Admins manage orders" on public.orders for update
using (public.is_admin()) with check (public.is_admin());

create policy "Order items visible to order owner or admin" on public.order_items for select
using (exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin())));
create policy "Order items inserted for own pending order" on public.order_items for insert
with check (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid() and o.status = 'pending'));
create policy "Admins manage order items" on public.order_items for all
using (public.is_admin()) with check (public.is_admin());

create policy "Active promo codes are readable" on public.promo_codes for select
using ((is_active = true and starts_at <= now() and (expires_at is null or expires_at > now())) or public.is_admin());
create policy "Admins manage promo codes" on public.promo_codes for all
using (public.is_admin()) with check (public.is_admin());

create policy "Approved reviews public; users see own; admin sees all" on public.reviews for select
using (status = 'approved' or user_id = auth.uid() or public.is_admin());
create policy "Signed-in customers submit reviews" on public.reviews for insert
with check (auth.uid() is not null and user_id = auth.uid() and status = 'pending');
create policy "Review owner edits pending review; admin moderates" on public.reviews for update
using ((user_id = auth.uid() and status = 'pending') or public.is_admin())
with check ((user_id = auth.uid() and status = 'pending') or public.is_admin());
create policy "Admins delete reviews" on public.reviews for delete using (public.is_admin());

create policy "Published events are public" on public.events for select
using (status = 'published' or public.is_admin());
create policy "Admins manage events" on public.events for all
using (public.is_admin()) with check (public.is_admin());

create policy "Images for public events are public" on public.event_images for select
using (exists (select 1 from public.events e where e.id = event_id and e.status = 'published') or public.is_admin());
create policy "Admins manage event images" on public.event_images for all
using (public.is_admin()) with check (public.is_admin());

create policy "Active campaigns are public" on public.campaigns for select
using ((status = 'active' and starts_at <= now() and (ends_at is null or ends_at > now())) or public.is_admin());
create policy "Admins manage campaigns" on public.campaigns for all
using (public.is_admin()) with check (public.is_admin());

create policy "Users manage own wishlist" on public.wishlists for all
using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Newsletter inserts are public; reading/deleting subscriber data is admin-only.
create policy "Anyone can subscribe to newsletter" on public.newsletter_subscribers for insert
with check (position('@' in email) > 1);
create policy "Admins manage newsletter subscribers" on public.newsletter_subscribers for all
using (public.is_admin()) with check (public.is_admin());

-- Storage buckets. Public buckets are suitable for public imagery only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
 ('book-covers','book-covers',true,10485760,array['image/jpeg','image/png','image/webp']),
 ('event-posters','event-posters',true,10485760,array['image/jpeg','image/png','image/webp']),
 ('author-media','author-media',true,10485760,array['image/jpeg','image/png','image/webp']),
 ('user-avatars','user-avatars',true,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "Public can view public author store images" on storage.objects for select
using (bucket_id in ('book-covers','event-posters','author-media','user-avatars'));
create policy "Admins upload author store images" on storage.objects for insert
with check (bucket_id in ('book-covers','event-posters','author-media') and public.is_admin());
create policy "Admins update author store images" on storage.objects for update
using (bucket_id in ('book-covers','event-posters','author-media') and public.is_admin())
with check (bucket_id in ('book-covers','event-posters','author-media') and public.is_admin());
create policy "Admins delete author store images" on storage.objects for delete
using (bucket_id in ('book-covers','event-posters','author-media') and public.is_admin());
create policy "Users upload their own avatar" on storage.objects for insert
with check (bucket_id = 'user-avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users update their own avatar" on storage.objects for update
using (bucket_id = 'user-avatars' and auth.uid()::text = (storage.foldername(name))[1])
with check (bucket_id = 'user-avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "Users delete their own avatar" on storage.objects for delete
using (bucket_id = 'user-avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- SECURITY CRITICAL:
-- Do not allow clients to set profiles.is_admin themselves. The policies above
-- permit profile updates to the row owner; column-level protection should be
-- applied by restricting grants or by moving admin grants to a server-side workflow.
-- Recommended: revoke update on is_admin from authenticated and grant only safe columns.
revoke update on public.profiles from authenticated;
grant update (full_name, phone, avatar_path, updated_at) on public.profiles to authenticated;

-- Admin bootstrap: first create/sign up the author's account, then run this once
-- from SQL Editor using the exact account email. Never expose admin escalation to clients.
-- update public.profiles set is_admin = true where email = 'refilwe@refilwemogosi.co.za';
