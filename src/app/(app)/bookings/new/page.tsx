import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { BookingForm } from "@/components/BookingForm";

export const dynamic = "force-dynamic";

export default async function NewBookingPage({
  searchParams,
}: {
  searchParams: { customerId?: string };
}) {
  const customerId = searchParams.customerId;
  if (!customerId) notFound();

  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, customerId),
  });
  if (!customer) notFound();

  return (
    <div>
      <Link href={`/customers/${customer.id}`} className="text-sm text-brass-dark hover:underline">
        ← {customer.fullName}
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-medium">New booking</h1>
      <BookingForm customerId={customer.id} />
    </div>
  );
}
