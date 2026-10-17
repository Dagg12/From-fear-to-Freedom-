# From Fear to Freedom — author platform & bookstore

A responsive Next.js 15 / React 19 / TypeScript / Tailwind website for Refilwe Mokgosi-Mogale. The original supplied cover, author portraits, endurance photographs and supplied social-profile screenshots are included in `public/images/`. The design uses Cormorant Garamond + DM Sans and a burgundy, cream, warm gold palette.

## Run in VS Code (Windows)
1. Extract the ZIP and open the extracted project folder in VS Code (**File → Open Folder**).
2. Open **Terminal → New Terminal**.
3. Install Node.js LTS from https://nodejs.org if `node -v` is not recognized.
4. Run `npm install`.
5. Copy `.env.example` to `.env.local` if you want to connect Supabase. Without credentials, the login/dashboard/order controls are clearly labelled local preview mode.
6. Run `npm run dev` and open http://localhost:3000.
7. Run `npm run typecheck` and `npm run build` before deployment.

## Routes included
- `/` Home
- `/book` Book detail and add-to-cart
- `/shop` Store catalogue
- `/cart` Cart, quantity editing and sample promo code
- `/checkout` Order-request flow (local preview only)
- `/about`, `/journey`, `/speaking`, `/events`, `/events/[slug]`, `/media`, `/journal`, `/journal/[slug]`
- `/reviews`, `/specials`, `/contact`
- `/login` Login / registration / reset UI (Supabase auth is attempted when credentials are configured; local demo mode otherwise)
- `/account` Reader dashboard (local preview order history)
- `/admin` Admin dashboard preview (catalogue settings, order view, reviews, events, promotions, customer section)
- `/wishlist`, `/privacy`, `/terms`

## Assets and social profiles
All visual assets used are from the ZIP supplied by the user and are converted to optimized WebP files in `public/images/`. Social profile screenshots are included as supplied assets. Instagram and TikTok links use the `mogalerefilwe` handle visible in the screenshots. Facebook and LinkedIn use search URLs because the screenshots did not reveal a verified direct profile URL; confirm those URLs with the author before publishing.

## Supabase setup
1. Create a Supabase project.
2. Set `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` to the project's URL and browser-safe publishable/anon key. The app supports both key variable names.
3. In Supabase SQL Editor, run `supabase/schema.sql` once on a fresh project.
4. Create the author's Auth user with `refilwe@refilwemogosi.co.za`, then run the admin bootstrap update in the SQL file/README instructions and verify it updated exactly one profile.
5. Configure email templates, redirect URLs, password recovery, storage policies and test row-level security with separate customer and admin accounts.
6. For Vercel, add the two Supabase variables under **Project Settings → Environment Variables** for **Production** (and Preview/Development if needed), then redeploy. Supabase Auth must allow the production site URL and `https://www.refilwemogale.co.za/**` as a redirect URL.

## Important production-readiness boundary
This is a complete multi-page **website starter and interactive local prototype**, not yet a production-ready commerce backend. The following must be completed and tested before public launch:
- Move order creation, order-total calculation, promo validation, stock/preorder checks and order status updates into trusted server-side functions or API routes. Never trust browser prices, discounts, roles or localStorage.
- Enforce admin access on the server and in Supabase RLS. The browser-side admin screen is a UI prototype only and must not be treated as secure access control.
- Connect cart/account/order/review/event/campaign screens to Supabase queries and storage uploads; apply least-privilege RLS policies and test with real non-admin users.
- Connect a payment provider (e.g. a supported South African provider), webhooks, refund handling and reconciliation. No live payment processing is included.
- Connect contact form delivery and newsletter sign-up to a trusted email/CRM service, with anti-spam controls and opt-in consent.
- Confirm final book price, stock/print fulfilment, shipping, taxes/VAT treatment, return policy, order confirmation, and all public social profile URLs.
- Replace draft Privacy and Terms pages with reviewed policies that match the actual processing and South African legal requirements (including POPIA and applicable consumer/e-commerce requirements).
- Update `metadataBase` in `src/app/layout.tsx` to the real domain, then set production metadata, analytics/consent controls, monitoring, error reporting and backups.
- Run dependency/security checks, accessibility review (keyboard, contrast, screen reader), mobile/browser QA, and full end-to-end testing before launch.

## Demo data warning
The demo checkout saves order requests to the current browser only and does not charge money or send a real order. The sample `COURAGE10` discount is only a front-end demonstration. Do not use real passwords or customer data in preview mode.

## Production launch checklist (October 2026)

1. **Rotate exposed credentials first.** Revoke the exposed Supabase secret key and issue a replacement in Supabase. Change the PayFast merchant key/passphrase if those values were exposed. Never put Supabase secret/service-role keys or PayFast passphrases in `NEXT_PUBLIC_*` variables or commit them.
2. Copy `.env.example` to `.env.local` for local development and fill in the newly rotated credentials. Use the Supabase publishable/anon key only for browser access. Keep `PAYFAST_*` values server-side.
3. Set `NEXT_PUBLIC_SITE_URL` to the real HTTPS production domain. Set `PAYFAST_SANDBOX=true` for testing and change to `false` only after test transactions and merchant configuration are verified.
4. Set the administrator email in `NEXT_PUBLIC_ADMIN_EMAIL` for the UI guard and configure the matching administrator account in Supabase Auth. Do not treat a client-side UI guard as database security: enforce administrator roles in Supabase RLS policies and server-side authorization before using admin write operations.
5. Configure Supabase Auth email templates and the production Site URL / redirect allow-list. Test signup, verification email, sign-in, password reset, sign-out and denied access for a normal customer account.
6. **Payment notification is intentionally fail-closed.** `/api/payfast/notify` currently returns HTTP 501. Do not launch live payments or represent an order as paid until the PayFast ITN endpoint validates the sender, verifies the signature, checks payment status and amount against a server-created order, and persists the verified result in Supabase. The checkout endpoint uses a fixed R320 product amount and is a starter integration, not a complete order-management implementation.
7. Run `npm install`, `npm run typecheck`, and `npm run build`; fix all reported errors. Deploy to a supported Next.js host, configure environment variables there, and test the production domain and mobile layouts.

The homepage hero now features Refilwe alone (the book imagery remains on book/product sections), and Journal / reflection photography uses contain sizing to avoid cropping supplied photos.

## Production launch checklist

1. Rotate exposed credentials first. Revoke the exposed Supabase secret key and issue a replacement in Supabase. Change the PayFast merchant key/passphrase if those values were exposed. Never put Supabase secret/service-role keys or PayFast passphrases in `NEXT_PUBLIC_*` variables or commit them.
2. Copy `.env.example` to `.env.local` for local development and fill in newly rotated credentials. Use the Supabase publishable/anon key only for browser access. Keep `PAYFAST_*` values server-side.
3. Set `NEXT_PUBLIC_SITE_URL` to the real HTTPS production domain. Keep `PAYFAST_SANDBOX=true` for testing and change to `false` only after test transactions and merchant configuration are verified.
4. Set `NEXT_PUBLIC_ADMIN_EMAIL` for the UI guard and configure the matching administrator account in Supabase Auth. A client-side UI guard is not database security: enforce administrator roles in Supabase RLS policies and server-side authorization before using admin write operations.
5. Configure Supabase Auth email templates and the production Site URL / redirect allow-list. Test signup, verification email, sign-in, password reset, sign-out and denied access for a normal customer account.
6. Payment notification is intentionally fail-closed. `/api/payfast/notify` currently returns HTTP 501. Do not launch live payments or represent an order as paid until the PayFast ITN endpoint validates the sender, verifies the signature, checks payment status and amount against a server-created order, and persists the verified result in Supabase. The checkout endpoint uses a fixed R320 product amount and is a starter integration, not a complete order-management implementation.
7. Run `npm install`, `npm run typecheck`, and `npm run build`; fix all reported errors. Deploy to a supported Next.js host, configure environment variables there, and test the production domain and mobile layouts.

The homepage hero now features Refilwe alone (book imagery remains on book/product sections), and Journal / reflection photography uses contain sizing to avoid cropping supplied photos.
