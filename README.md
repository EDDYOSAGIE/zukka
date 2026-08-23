# Zukka Social Equity Platform

Zukka is a React/Vite/TypeScript social commerce operating system for Nigerian Instagram and WhatsApp micro-merchants.

## Run

```bash
npm install
npm run dev
```

Open the Vite URL, usually `http://127.0.0.1:5173`.

## What Is Included

- Sky/navy/calm landing page with Meta, TikTok Shop, and Snapchat onboarding states.
- Merchant dashboard with GMV, completed orders, delivery integrity, Zukka Trust Score, social proof drops, and regional trend matrix.
- Unified Instagram/WhatsApp inbox with bargain simulation, safe markdown alert, and checkout-link dispatch.
- Inventory registry with modal item creation and live state updates.
- Customer checkout with Paystack-style virtual account simulation, CreditChek BNPL form, and express/pool logistics selection.
- Logistics hub with express dispatch, LGA pooled grouping, and live route cutoff countdown.
- Supabase/PostgreSQL DDL in `server/database/schema.sql`.
- Express webhook controllers for Meta inbound messages and Paystack fulfillment signatures.

## Key Files

- `src/state/ZukkaContext.tsx` - in-memory live database and cross-page actions.
- `src/pages/HomePage.tsx` - landing and channel onboarding.
- `src/pages/InboxPage.tsx` - chat negotiation workspace.
- `src/pages/CheckoutPage.tsx` - localized Naira checkout.
- `src/pages/LogisticsPage.tsx` - LGA logistics pooling.
- `server/controllers/webhooks.ts` - production-facing webhook controller implementations.
