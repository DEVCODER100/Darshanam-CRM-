# Build the frontend for "Darshanam" — a Construction / Real-Estate CRM & Payment Management Dashboard

## What this product is

An **internal web dashboard** (not customer-facing) for a real-estate / villa-construction company. A small office team (3–5 staff) uses it to manage customers, the units they've booked (villas / flats / plots / shops), and — most importantly — **track payments against construction progress**.

The headline job is showing, for every booking, *how much money is owed right now*, with correct, trustworthy math on crore-level (₹10M+) amounts.

Build a **modern, clean, professional CRM UI** in React + Tailwind + shadcn/ui. Use realistic mock data (Indian names, ₹ lakh/crore amounts). I already have a backend — you are rebuilding the **frontend / UX only**, so structure components cleanly and keep data in a typed mock layer I can later swap for real API calls.

**You choose the entire visual design — colours, typography, spacing, everything.** I'm not prescribing a palette; pick what looks the most premium, clean, and trustworthy for a finance-heavy internal tool. The only hard requirement is clarity of the money numbers and the stage-progress visualization.

## Users & roles

Invite-only login (no public signup). Roles: **Admin** (full edit), **Accountant** (view + reports), **Sales** (view), **Manager** (view-only). Editing is effectively admin-only; everyone else is read-only. Show or hide action buttons based on role.

## Core system & business logic (this drives every screen)

**1. Money is central.** Format all amounts in Indian style (e.g. ₹1,49,17,000), right-aligned in tables, with **tabular / monospaced figures** so columns line up digit-for-digit. Never show floating-point artefacts.

**2. A booking's cost is built up as:**
`Total cost = Base cost + Extra charges − Discount + GST (5%) + Documentation (5.9%) + Maintenance deposit`

**3. Three payment types** per booking: **Self Finance**, **Bank Loan**, **Installment**. Each can optionally be **stage-based**.

**4. THE key concept — Stage-wise payment (most important screen logic):**
Construction has 7 stages, each unlocking a cumulative percentage of the cost that can be collected:

| Stage | Eligible % |
|---|---|
| Plinth Level | 45% |
| Ground Floor Slab | 55% |
| First Floor Slab | 70% |
| Second Floor Slab | 80% |
| Outside Plaster | 90% |
| Flooring Level | 95% |
| Finishing Level | 100% |

- **Eligible Amount = Total Cost × current stage %**
- **Amount Due = Eligible Amount − Total Received**
- **Remaining Balance = Total Cost − Total Received**
- Skipping earlier stages does NOT lose eligibility — the latest stage sets the maximum collectable amount.
- Worked example: a ₹1,00,00,000 villa at Second Floor Slab (80%) with ₹45,00,000 received → eligible ₹80,00,000, **due ₹35,00,000**, remaining ₹55,00,000.
- When due becomes 0, the stage is **Paid**. The UI should surface a clear prompt like *"You can now collect ₹X based on the current construction stage."*

**5. GST is tracked separately per payment.** Each payment splits into a **basic** amount and a **GST** amount. GST owed is proportional to the basic amount collected (5% of basic collected); show the **GST shortfall** = GST that should have been collected − GST actually collected.

**6. Outstanding vs Total — keep these clearly distinct:**
- **Outstanding** = what's due right now (eligible − received).
- **Total amount to pay** = the gross total cost.

**7. Everything recalculates instantly** whenever a payment is added or the construction stage is changed. No stale numbers anywhere.

## Screens to build

1. **Dashboard** — summary cards (Total Customers, Total Bookings, Total Sales Value, Total Received, Total Outstanding, Pending Loan Amount); a **payment-type breakdown** (Self / Bank / Installment → receivable / received / due); a **construction-stage unit count**; a **stage-payment summary** (5 cards: stage customers, total eligible, total received, total outstanding, remaining balance); and an **Alerts** row (Overdue payments, Due this month, Loan docs pending, Loan approval pending) — every card and alert **clickable** through to a filtered list.

2. **Customers** — a searchable list (show property-type tags next to each customer name). A **Customer detail page** with customer info, booked units, uploaded documents, and a dedicated **Stage Payment section** (summary fields + progress tracker + history).

3. **Bookings** — a filterable list (project / stage / payment type / due status / date range). The **Booking detail page** is the centrepiece:
   - Three hero cards at the top: **Outstanding**, **Total amount to pay**, **GST payable now (shortfall)**.
   - A cost breakdown.
   - The **Stage Payment panel** (see screen 5).
   - A payment schedule.
   - A payments table with **Basic / GST / Total** columns.
   - A loan panel (bank, amount, status, dates).
   - "Record payment" and "Edit booking" actions.

4. **Stage Payments module** (dedicated section) — a table of all stage-based customers: Customer · Property Type · Unit · Total · Current Stage (%) · Eligible · Received · Due · Balance · Payment Status · action. With **search** (name / unit number / phone) and **filters** (current stage, payment status, property type), plus 5 summary cards on top. Each row opens the detail.

5. **The Construction Stage Progress Tracker** (key visual, used on the booking + customer detail) — a horizontal **7-step timeline** (Plinth → Finishing). Each step shows its percentage and is in one of three clearly distinguished states: **Completed**, **Current stage**, or **Upcoming**, with a legend. Directly below it, a **stage history table**: Stage · % · Eligible Amount · Received · Due · Status (Paid / Current / Locked).

6. **Calendar / cashflow** — scheduled instalments grouped by month, separating overdue from upcoming, with monthly subtotals.

7. **Reports** — Outstanding, Customer, Unit, Loan, Stage-wise collection, GST tracker, Monthly collection. Each a clean table with export (PDF / Excel) buttons.

8. **Audit log** (admin only) and a simple **Login** screen.

## UX requirements

- Modern, professional CRM layout with a **left sidebar** (Dashboard, Customers, Bookings, Stage Payments, Calendar, Reports, Audit).
- **Money clarity is the #1 priority:** Indian number formatting, tabular figures, right-aligned amounts, due amounts visually emphasised, paid / completed states visually distinct. Use a consistent visual language for money states (paid vs due vs error) and reserve that language for money only.
- Stage progress shown as a **visual timeline / progress tracker**, not just a table.
- Status shown as **pills / badges**.
- Tables: clean, scannable, hairline separators, hover states; horizontal scroll on small screens for wide tables.
- **Fully responsive** — must be usable on a phone browser for quick read-only checks.
- All calculations update instantly after a payment entry or stage update.

## Deliverable

A polished, responsive React / Tailwind / shadcn app covering all the screens above, with a sensible component breakdown and a typed mock-data layer (realistic Indian sample data) that I can later swap for real API calls. Prioritise the clarity of the money numbers and the construction-stage progress visualization. You own all design decisions.
