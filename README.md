# Darshanam — Construction CRM & Payment Tracking

Internal, invite-only dashboard for customer / booking / payment tracking with a
**provably correct** outstanding-amount calculation and a full audit trail.
Phase 1 (MVP) per `Construction_CRM_PRD.md`.

## Stack
Next.js 14 (App Router) · Neon PostgreSQL (Drizzle ORM) · Clerk (auth, RBAC, 2FA)
· Vercel Blob (attachments) · Vitest. All money is stored as **BIGINT paise** —
no floating-point math anywhere.

## Setup

1. Install deps: `npm install`
2. Copy env: `cp .env.example .env.local` and fill in:
   - `DATABASE_URL` — Neon connection string
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` — from Clerk dashboard
   - `BLOB_READ_WRITE_TOKEN` — Vercel Blob (only needed for payment attachments)
3. In the **Clerk dashboard**: disable public sign-ups (invite-only), enable 2FA.
4. Apply schema: `npm run db:migrate`
5. (Optional) Seed sample data: `npm run db:seed`
6. Run: `npm run dev`

### First user / roles
The first account to sign in is bootstrapped as **admin**; everyone after defaults
to least-privilege **manager** until an admin promotes them. Roles: `admin`,
`accountant`, `sales_executive`, `manager` (matrix in `src/lib/permissions.ts`).

## The critical logic (PRD §5)
Outstanding is **never stored** — always recomputed on read by the single formula
in `src/lib/outstanding.ts`:

```
Outstanding(as of D) = Σ(schedule due_date <= D) − Σ(payments)
```

`Balance Property Value = total_cost − Σ(payments)` is shown alongside it as a
distinct number. Both appear on the booking detail screen.

## Tests
```
npm run test        # outstanding, cost, money, masking, RBAC matrix
```
The outstanding suite covers all six PRD §5 rows and the four edge cases
(advance/overpay, payment-before-due, paid-exceeds-total, delete-payment recompute).
Keep this green — it is the project's load-bearing guarantee.

## Acceptance (PRD §12)

Verified by automated tests / build in this repo:
- **§12.3** Outstanding correct for all 6 rows + 4 edge cases — `src/lib/outstanding.test.ts`.
- **§12.4** No floating-point money — BIGINT columns + `src/lib/money.ts` is the only conversion path.
- **§12.6** Deleting a payment recalculates correctly — recompute-on-read; edge-case test green.
- RBAC matrix (PRD §2) — `src/lib/permissions.test.ts`.

Verify against a live Neon + Clerk environment (needs your credentials):
- **§12.1** Logged-out user is redirected from every page/API (`src/middleware.ts`).
- **§12.2** Each role limited server-side — hit a forbidden API directly, expect 401/403.
  e.g. as a Manager: `POST /api/bookings/<id>/payments` → 403.
- **§12.5** Every create/edit/delete appears in `/audit` with the acting user.

## Project structure
- `src/lib/` — `money`, `cost`, `outstanding`, `rbac`, `permissions`, `audit`, `masking`, `booking-detail`
- `src/db/` — Drizzle `schema`, client, `migrate`, `seed`
- `src/app/(app)/` — customers, bookings, booking detail, audit pages
- `src/app/api/` — REST routes; every mutation is RBAC-gated and writes an audit row atomically via `db.batch`

## Phase 2 (built)
- **Loans** — status pipeline + bank/amount/dates on the booking detail screen (`loan:edit`).
- **Dashboard** — live summary cards + alerts (`src/lib/dashboard.ts`); every number is a query, never a stored aggregate.
- **Reports** (`report:view`) — Outstanding, Customer, Loan, Monthly Collection at `/reports/*`.
- **Export** — every report to Excel (`exceljs`) and PDF (`@react-pdf/renderer`) via `/api/reports/[type]/export?format=xlsx|pdf`.
- **Search** — customers (name/mobile/email) and bookings (property/customer) via `?q=`.

## Notes / decisions
- Aadhaar/PAN is stored **masked (last 4 only)** and never persisted in full — a
  deliberately stricter stance than PRD §3 (which allowed full storage shown to
  Admin/Accountant). Revisit if full retrieval is ever required.
- Mutations + audit run atomically as a single Neon HTTP transaction via `db.batch`.
- Excel money cells are numeric rupees (with ₹ format); PDF uses lakh/crore strings.
- Dashboard "Total Outstanding" sums only positive per-booking outstanding (advances are excluded, not netted off).
