# AfriFlow

**AfriFlow** is a SaaS platform built for African freelancers who work with international clients. It provides a professional phone number, a lightweight CRM, Stripe-powered payment links, and automatic payouts to Mobile Money wallets (Orange Money, MTN, Wave, Moov, Airtel).

---

## What it does

| Feature | Description |
|---|---|
| **Pro phone number** | Get a local number in France, Belgium, Germany, or Canada. Make and receive calls directly from the browser. |
| **Payment links** | Create a Stripe payment link and share it over WhatsApp or email. Clients pay by card — no AfriFlow account needed. |
| **Mobile Money payouts** | Collected funds are converted and paid out to your Mobile Money wallet in local currency (FCFA, etc.) within 1–2 business days. |
| **CRM** | Manage contacts, call history, and payment status in one place. |
| **KYC** | Identity verification flow required before payouts are enabled. |
| **Billing & subscriptions** | Subscription plans with trial minutes, top-up packs, and usage tracking. |

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [TanStack Start](https://tanstack.com/start) (React 19, file-based routing) |
| Build | Vite 8, Nitro, TypeScript, Bun |
| UI | shadcn/ui, Radix UI primitives, Tailwind CSS v4 |
| Auth & database | Supabase (PostgreSQL, Row Level Security, Realtime) |
| Payments | Stripe (Embedded Checkout, Payment Intents, Webhooks) |
| Email | React Email + `@lovable.dev/email-js` |
| Forms | React Hook Form + Zod |
| Data fetching | TanStack Query |

---

## Project structure

```
src/
  routes/
    __root.tsx               # App shell (layout, auth context)
    index.tsx                # Landing page
    auth.tsx                 # Sign in / sign up
    verify-email.tsx
    reset-password.tsx
    pay.$linkId.tsx          # Public payment page (Stripe embedded checkout)
    pay.return.tsx           # Post-payment confirmation
    unsubscribe.tsx
    _authenticated/
      dashboard.tsx          # Main dashboard
      crm.tsx                # Client management
      payments.tsx           # Payment links & transaction history
      phone.tsx              # Phone number & call logs
      billing.tsx            # Subscription & top-up
      kyc.tsx                # Identity verification
      settings.tsx
    api/                     # Server functions (Nitro)
  components/
    StripeEmbeddedCheckout   # Stripe Elements wrapper
    TopUpDialog              # Minute top-up flow
    WalletMinutesCard        # Remaining call minutes display
    TrialBanner / RestrictedOverlay / PaymentTestModeBanner
  utils/
    payments.functions.ts    # Payment link creation, Stripe webhooks
    payouts.functions.ts     # Payout processing & status
    wallet.functions.ts      # Minute wallet (included + add-on)
    telephony.functions.ts   # Call routing, minute consumption
    crm.functions.ts
    fx.functions.ts          # Currency conversion (FX rates)
    kyc.functions.ts
    dashboard.functions.ts
    settings.functions.ts
  lib/
    stripe.server.ts         # Stripe server-side client
    stripe.ts                # Stripe browser client
    email/                   # Email sending helpers
    email-templates/         # React Email templates
  integrations/
    supabase/                # Supabase client & generated types
supabase/
  config.toml
  migrations/               # All schema migrations
```

---

## Getting started

### Prerequisites

- [Bun](https://bun.sh/) (package manager & runtime)
- A [Supabase](https://supabase.com/) project
- A [Stripe](https://stripe.com/) account (test mode is fine to start)

### 1. Install dependencies

```bash
bun install
```

### 2. Configure environment variables

Copy `.env.development` and fill in your credentials:

```bash
cp .env.development .env.local
```

Required variables:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
VITE_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

### 3. Apply database migrations

```bash
npx supabase db push
# or run each file in supabase/migrations/ in order
```

### 4. Start the dev server

```bash
bun run dev
```

The app will be available at `http://localhost:3000`.

---

## Key flows

**Freelancer onboarding**
1. Sign up → email verification → KYC → choose a phone number (free trial: 10 minutes included).

**Getting paid**
1. Go to **Payments** → create a payment link with an amount and description.
2. Share the link (WhatsApp, email). The client pays by card via Stripe Embedded Checkout.
3. AfriFlow converts and queues a Mobile Money payout (processed by an admin or payout simulator).

**Making calls**
1. Go to **Phone** → dial a client number.
2. Minutes are deducted from the wallet (included balance first, then add-on credits).
3. Top up via **TopUpDialog** when credits run low.

---

## Scripts

| Command | Description |
|---|---|
| `bun run dev` | Start the development server |
| `bun run build` | Production build |
| `bun run preview` | Preview the production build locally |
| `bun run lint` | Run ESLint |
| `bun run format` | Format with Prettier |

---

## Payment limits

- Maximum **500 € / day** per user for outgoing payment links (enforced server-side with FX conversion).
- Payment links on already-paid invoices are disabled automatically.

---

## License

Private — all rights reserved.
