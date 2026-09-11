# Sherbet

A fresh Russian-language team lunch ordering app built with Next.js 16, React 19, and PostgreSQL on Supabase. Prices are in tenge. Business time is Asia/Qyzylorda.

## New deployment

Repository: https://github.com/Eldar0904/Sherbet

Supabase project: https://gyvhjfgiqzehvpiumupx.supabase.co (project URL, not the PostgreSQL connection string).

Create a new Vercel project connected to the Sherbet repository. The old lunch app is independent and its data is not migrated.

1. In Supabase, choose **Connect → Transaction pooler** and copy the full PostgreSQL URI. Replace the password placeholder with the URL-encoded database password. This app does not need publishable or secret API keys.
2. In Vercel choose **Next.js**, repository root, and default build/output settings.
3. Set `DATABASE_URL`, `ADMIN_PIN`, `SESSION_SECRET`, and `CRON_SECRET` in Production before deployment. Use separate Preview database credentials if enabling database-backed previews.
4. Deploy. The first database request creates the dedicated `sherbet` schema and its tables. It never reads or alters `public` application tables. The connection role must have schema/table creation privileges (Supabase's database owner supports this). RLS is enabled; the server's database-owner connection performs queries directly. Do not expose this connection string to browsers.
5. Sign in with the configured admin password, add dishes and prices, and mark today's dishes active. Saving a dish publishes today's menu. Orders close automatically at 12:00 Kazakhstan time and open again only after the next menu update. The real database starts with an empty menu; sample dishes are only shown in the explicitly marked preview when DATABASE_URL is absent.
6. Place a test order and check it in the administrator view. Kaspi payment is opened through the payment link; payment confirmation is handled outside the app.

## Local development

```sh
npm ci
# Copy .env.example to .env.local and fill it in, or leave DATABASE_URL absent for read-only design preview.
npm run dev
npm test
npm run build
```

Open http://127.0.0.1:3000. Preview cannot accept orders without a database. The server prices every order from the catalog and enforces the daily 12:00 close plus the menu-update opening rule. Admin access uses a signed, eight-hour HttpOnly cookie; changing the session secret invalidates sessions. Customers see orders associated with this browser's HttpOnly device cookie. Removing browser cookies removes access to that device's order history; admins still retain the records.

## Daily rollover

Orders retain their business date permanently. Daily views change automatically at Kazakhstan midnight, regardless of cron execution. Vercel Cron marks earlier days archived at 23:00 UTC (04:00 Kazakhstan) and requires CRON_SECRET. It never deletes orders. Repeat runs are safe. History remains available to the administrator.

## Design

Cream, burnt orange and deep green; responsive menu cards; original CSS food illustrations rather than dish photographs. Google Fonts is optional with local font fallbacks. Kaspi currently uses the payment link from the original app; change `KASPI` in `components/LunchApp.jsx` if the recipient changes.

## Checks

`npm test` covers timezone rollover, the 12:00 close, the menu-update opening rule, override behavior and malformed orders. `npm run build` validates the Next.js app. A new hosted database and real payment recipient must be verified during deployment.
