import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, units } from "@/db/schema";
import { BookingForm } from "@/components/BookingForm";
import { blockActive } from "@/lib/unit-block";

export const dynamic = "force-dynamic";

// Open from a customer (?customerId=...) or from a free unit on the board
// (?unitId=...). With only a unit, the form lets you pick the customer.
export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: { customerId?: string; unitId?: string };
}) {
  const { customerId, unitId } = searchParams;
  if (!customerId && !unitId) notFound();

  const customer = customerId
    ? await db.query.customers.findFirst({ where: eq(customers.id, customerId) })
    : undefined;
  if (customerId && !customer) notFound();

  const unit = unitId
    ? await db.query.units.findFirst({ where: eq(units.id, unitId) })
    : undefined;
  if (unitId && !unit) notFound();

  if (unit) {
    const taken = await db.query.bookings.findFirst({
      where: eq(bookings.unitId, unit.id),
      columns: { id: true },
    });
    if (taken) {
      return (
        <div className="space-y-3">
          <Link href="/dashboard" className="text-sm text-brass-dark hover:underline">← Unit board</Link>
          <p className="rounded-md bg-due-bg px-3 py-2 text-sm text-due">
            {unit.unitType} {unit.unitNumber} is already booked, so it can&apos;t be booked again.
          </p>
        </div>
      );
    }
  }
  const held = unit && blockActive(unit) ? unit : undefined;

  const customerList = customer
    ? undefined
    : (await db.select().from(customers).orderBy(asc(customers.fullName))).map((c) => ({
        id: c.id,
        name: `${c.fullName} · ${c.mobile}`,
      }));

  return (
    <div>
      <Link
        href={customer ? `/customers/${customer.id}` : "/dashboard"}
        className="text-sm text-brass-dark hover:underline"
      >
        ← {customer ? customer.fullName : "Unit board"}
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-medium">
        {unit ? `Book ${unit.unitType} ${unit.unitNumber}` : "New booking"}
      </h1>
      {held && (
        <p className="mb-4 rounded-md bg-due-bg px-3 py-2 text-sm text-due">
          Blocked for {held.blockName}{held.blockMobile ? ` (${held.blockMobile})` : ""}
          {held.unblockOn ? ` until ${held.unblockOn}` : ""}. Booking it will release the block.
        </p>
      )}
      <BookingForm
        defaultCustomerId={held?.blockCustomerId ?? undefined}
        customerId={customer?.id}
        customers={customerList}
        unit={
          unit
            ? {
                id: unit.id,
                projectName: unit.projectName,
                unitType: unit.unitType,
                unitNumber: unit.unitNumber,
              }
            : undefined
        }
      />
    </div>
  );
}
