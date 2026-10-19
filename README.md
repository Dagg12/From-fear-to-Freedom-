# From Fear to Freedom — author platform and bookstore

Responsive Next.js 15 / React 19 / TypeScript website for Refilwe Mokgosi-Mogale. The supplied author and book imagery is in `public/images/`.

## Run locally

1. Install Node.js LTS and run `npm install`.
2. Copy `.env.example` to `.env.local` and fill in the values needed for the feature you are testing.
3. Run `npm run dev`, then open http://localhost:3000.
4. Before deploying, run `npm run typecheck` and `npm run build`.

## Supabase setup

1. Create a Supabase project. Set `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project URL and browser-safe key.
2. In Supabase SQL Editor, run `supabase/schema.sql` on a new project, then run each SQL file in `supabase/migrations/` in filename order. On an existing project, apply only the migrations that have not already been applied; do not rerun the non-idempotent base schema.
3. In Supabase Auth, create or confirm your administrator account. Then grant it the database admin role in SQL Editor:
   ```sql
   update public.profiles
   set is_admin = true
   where email = 'admin@example.com';
   ```
   Replace the example with the exact account email and verify one profile row was updated. Admin access is checked against `profiles.is_admin`, never the email address in browser code.
4. Set the Supabase Site URL and allow-list the production URL and `/login` callback URLs used for email confirmation and password recovery. Test register, confirm, sign-in, reset, and sign-out.
5. In `/admin`, add the real book catalogue entries, verified prices, stock limits, and any preorder fulfilment dates. Set a book to published to make it visible in `/shop`.

## Store, reader accounts, and pre-orders

- Reader sign-in uses Supabase Auth. `/account` loads the signed-in Supabase profile and that user's database orders; it no longer treats browser-local demo orders as a registered account.
- The admin catalogue, public storefront, and checkout all use the same `books` rows. Prices are read and checked server-side, not trusted from the browser cart.
- A pre-order is a published book with **Accept as a pre-order** enabled. Set its expected fulfilment date when known. That preorder flag and date are snapshotted into the order item so later catalogue edits do not rewrite an existing order.
- Checkout requires an authenticated reader, server-only `SUPABASE_SERVICE_ROLE_KEY`, PayFast merchant variables, and a configured flat `BOOK_SHIPPING_ZAR` amount. The database checkout function creates the order and reserves finite in-stock quantities atomically; cancelling an unpaid order releases those reserved copies.
- The PayFast ITN handler verifies the signature, calls PayFast's server validation endpoint, checks the merchant, payment status, order reference, and amount, and only then marks an order paid. A browser return from PayFast is not proof of payment.
- The admin order screen can manage statuses and the reviews screen moderates submitted reviews. Inventory reservations for unpaid orders are released when an admin cancels the order.
- Wishlist, newsletter signup, and reader reviews use Supabase. Contact enquiries open the visitor's email application and are not stored or sent by the website.

## Deployment configuration

Add these environment variables to the hosting provider's Production environment and redeploy:

| Variable | Purpose | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | Supabase browser access | Public |
| `SUPABASE_SERVICE_ROLE_KEY` | Trusted order creation and payment notifications | **Server only; never use `NEXT_PUBLIC_`** |
| `NEXT_PUBLIC_SITE_URL` | Canonical HTTPS website URL and payment callbacks | Public |
| `PAYFAST_MERCHANT_ID` | PayFast merchant identifier | Server only |
| `PAYFAST_MERCHANT_KEY` | PayFast merchant key | Server only |
| `PAYFAST_PASSPHRASE` | Optional PayFast signature passphrase, if enabled for the merchant | Server only |
| `PAYFAST_SANDBOX` | `true` for sandbox (default); use `false` only for the approved live merchant account | Server only |
| `BOOK_SHIPPING_ZAR` | Verified flat shipping charge per order in ZAR; checkout is disabled if unset | Server only |

Keep these variables out of source control and chat. Rotate any credentials that have already been exposed. After adding or changing deployment variables, redeploy the application. Set the domain in Supabase Auth's redirect allow-list as well as `NEXT_PUBLIC_SITE_URL`.

## Before accepting live orders

- Complete a PayFast sandbox transaction and verify that its ITN reaches the deployed `/api/payfast/notify` URL and changes only the matching pending order. Do not use live mode until the PayFast merchant account and domain are approved.
- Confirm product prices, shipping coverage/rates, VAT treatment, stock and preorder fulfilment promises, cancellations/refunds, and the published privacy/returns/terms policies. `BOOK_SHIPPING_ZAR` is currently one flat charge for the whole order; different rates by address/weight are not implemented.
- Add an email delivery service for order confirmations, shipping notices, review moderation and newsletter double opt-in/unsubscribe. Newsletter subscriptions are stored, but the current feature does not send confirmation emails or process automated unsubscribe requests.
- The admin dashboard is protected by Supabase Auth and RLS but is a browser client, not a separate server-rendered admin application. Keep RLS enabled and use only the provided safe policies; do not grant the service-role key to the browser.
- Review static editorial/event content, contact destinations, social links, and the legal copy before public launch. Monitor webhook failures and reconcile refunds/chargebacks with PayFast.
- Configure backups, monitoring, abuse/rate controls, and production-domain/mobile/accessibility checks with your hosting and Supabase providers.

The deployed hosting project and DNS cannot be changed from this source workspace. Set `NEXT_PUBLIC_SITE_URL` to the domain you control, configure its hosting environment variables and DNS, and deploy this build through the hosting provider.
