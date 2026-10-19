begin;

create unique index if not exists promo_codes_code_normalized_idx
  on public.promo_codes (upper(trim(code)));

drop function if exists public.create_checkout_order(uuid,text,text,text,jsonb,numeric,jsonb);
drop function if exists public.create_checkout_order(uuid,text,text,text,jsonb,numeric,jsonb,text);

create function public.create_checkout_order(
  p_user_id uuid,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_shipping_address jsonb,
  p_shipping_total numeric,
  p_items jsonb,
  p_promo_code text
)
returns table (id uuid, order_number text, total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile_email text;
  v_line jsonb;
  v_book public.books%rowtype;
  v_promo public.promo_codes%rowtype;
  v_lines jsonb := '[]'::jsonb;
  v_quantity integer;
  v_reserved boolean;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_order_id uuid;
  v_order_number text;
  v_total numeric(12,2);
  v_code text := nullif(upper(trim(p_promo_code)), '');
  v_customer_uses integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'Checkout must use the trusted server.' using errcode = '42501';
  end if;
  if p_customer_name is null or char_length(trim(p_customer_name)) not between 1 and 150
     or p_customer_email is null
     or p_shipping_address is null
     or char_length(coalesce(p_shipping_address->>'address','')) not between 1 and 1000
     or p_shipping_total is null or p_shipping_total < 0 or p_shipping_total > 100000 then
    raise exception 'Invalid order details.';
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array'
     or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'Invalid book list.';
  end if;
  select lower(p.email) into v_profile_email
  from public.profiles p
  where p.id = p_user_id;
  if v_profile_email is null or v_profile_email <> lower(trim(p_customer_email)) then
    raise exception 'The signed-in account profile is incomplete.';
  end if;

  if (select count(distinct value->>'id') from jsonb_array_elements(p_items) as items(value))
     <> jsonb_array_length(p_items) then
    raise exception 'Duplicate books in order.';
  end if;
  for v_line in
    select item
    from jsonb_array_elements(p_items) as items(item)
    order by item->>'id'
  loop
    if coalesce(v_line->>'id','') !~* '^[0-9a-f-]{36}$'
       or coalesce(v_line->>'quantity','') !~ '^[1-9][0-9]*$' then
      raise exception 'Invalid book or quantity.';
    end if;
    v_quantity := (v_line->>'quantity')::integer;
    if v_quantity > 20 then
      raise exception 'A maximum of 20 copies per book may be ordered at once.';
    end if;
    select * into v_book
    from public.books b
    where b.id = (v_line->>'id')::uuid
      and b.is_published = true
    for update;
    if not found then
      raise exception 'A book in your bag is no longer available.';
    end if;
    if trim(v_book.currency) <> 'ZAR' or v_book.price <= 0 then
      raise exception 'The book is not configured for ZAR checkout.';
    end if;
    v_reserved := false;
    if not v_book.is_preorder and v_book.stock_quantity is not null then
      update public.books
      set stock_quantity = stock_quantity - v_quantity
      where id = v_book.id and stock_quantity >= v_quantity;
      if not found then
        raise exception 'There are not enough copies of % in stock.', v_book.title;
      end if;
      v_reserved := true;
    end if;
    v_subtotal := v_subtotal + v_book.price * v_quantity;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'id', v_book.id,
      'title', v_book.title,
      'price', v_book.price,
      'quantity', v_quantity,
      'is_preorder', v_book.is_preorder,
      'available_on', v_book.available_on,
      'stock_reserved', v_reserved
    ));
  end loop;
  if v_subtotal <= 0 then
    raise exception 'The order total is invalid.';
  end if;

  if v_code is not null then
    select * into v_promo
    from public.promo_codes p
    where upper(trim(p.code)) = v_code
    for update;
    if not found or not v_promo.is_active
       or v_promo.starts_at > now()
       or (v_promo.expires_at is not null and v_promo.expires_at <= now()) then
      raise exception 'This promo code is invalid, inactive, or expired.';
    end if;
    if v_promo.usage_limit is not null and v_promo.usage_count >= v_promo.usage_limit then
      raise exception 'This promo code has reached its total-use limit.';
    end if;
    if v_promo.per_customer_limit is not null then
      select count(*)::integer into v_customer_uses
      from public.orders o
      where o.promo_code_id = v_promo.id
        and o.user_id = p_user_id
        and o.status <> 'cancelled';
      if v_customer_uses >= v_promo.per_customer_limit then
        raise exception 'You have reached this promo code''s per-reader use limit.';
      end if;
    end if;
    if v_subtotal < v_promo.minimum_order_value then
      raise exception 'This promo code requires a minimum book subtotal of ZAR %.',
        to_char(v_promo.minimum_order_value, 'FM999999990.00');
    end if;
    if v_promo.discount_kind = 'percentage' then
      v_discount := round(v_subtotal * v_promo.discount_value / 100, 2);
    else
      v_discount := least(v_subtotal, v_promo.discount_value);
    end if;
    update public.promo_codes
    set usage_count = usage_count + 1
    where promo_codes.id = v_promo.id;
  end if;

  v_total := round(v_subtotal - v_discount + p_shipping_total, 2);
  insert into public.orders (
    user_id, customer_name, customer_email, customer_phone, shipping_address,
    status, currency, subtotal, discount_total, shipping_total, total,
    promo_code_id, promo_code_snapshot, payment_provider
  ) values (
    p_user_id, trim(p_customer_name), lower(trim(p_customer_email)),
    nullif(trim(p_customer_phone), ''), p_shipping_address,
    'pending', 'ZAR', v_subtotal, v_discount, p_shipping_total, v_total,
    v_promo.id, v_promo.code, 'payfast'
  ) returning orders.id, orders.order_number, orders.total
  into v_order_id, v_order_number, v_total;

  for v_line in select item from jsonb_array_elements(v_lines) as lines(item)
  loop
    insert into public.order_items (
      order_id, book_id, title_snapshot, unit_price, quantity,
      is_preorder, available_on, stock_reserved
    ) values (
      v_order_id, (v_line->>'id')::uuid, v_line->>'title',
      (v_line->>'price')::numeric, (v_line->>'quantity')::integer,
      (v_line->>'is_preorder')::boolean, nullif(v_line->>'available_on','')::date,
      (v_line->>'stock_reserved')::boolean
    );
  end loop;
  return query select v_order_id, v_order_number, v_total;
end;
$$;

revoke all on function public.create_checkout_order(uuid,text,text,text,jsonb,numeric,jsonb,text)
  from public, anon, authenticated;
grant execute on function public.create_checkout_order(uuid,text,text,text,jsonb,numeric,jsonb,text)
  to service_role;

create or replace function public.release_cancelled_order_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'cancelled' then
    update public.books b
    set stock_quantity = b.stock_quantity + oi.quantity
    from public.order_items oi
    where oi.order_id = new.id and oi.stock_reserved = true and b.id = oi.book_id;
    update public.order_items set stock_reserved = false
    where order_id = new.id and stock_reserved = true;
    if new.promo_code_id is not null then
      update public.promo_codes
      set usage_count = greatest(usage_count - 1, 0)
      where id = new.promo_code_id;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists orders_release_stock_on_cancel on public.orders;

create trigger orders_release_stock_on_cancel
after update of status on public.orders
for each row execute function public.release_cancelled_order_stock();

commit;
