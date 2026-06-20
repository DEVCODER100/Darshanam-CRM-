import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, customers, documents } from "@/db/schema";
import { DocumentPanel } from "@/components/DocumentPanel";
import { can } from "@/lib/permissions";
import { getCurrentUser } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  const customer = await db.query.customers.findFirst({
    where: eq(customers.id, params.id),
  });
  if (!customer) notFound();

  const [customerBookings, customerDocuments] = await Promise.all([
    db
      .select()
      .from(bookings)
      .where(eq(bookings.customerId, customer.id))
      .orderBy(desc(bookings.bookingDate)),
    db
      .select()
      .from(documents)
      .where(eq(documents.customerId, customer.id))
      .orderBy(desc(documents.createdAt)),
  ]);

  return (
    <div className="space-y-7">
      <div>
        <Link href="/customers" className="text-sm text-brass-dark hover:underline">
          ← Customers
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <h1 className="text-2xl font-medium">{customer.fullName}</h1>
          {user && can(user.role, "customer:edit") && (
            <Link href={`/customers/${customer.id}/edit`} className="btn-secondary">
              Edit customer
            </Link>
          )}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium">Customer information</h2>
        <dl className="card grid gap-4 p-4 text-sm sm:grid-cols-3">
          <Info label="Mobile" value={customer.mobile} />
          <Info label="Alternate number" value={customer.alternateMobile ?? "—"} />
          <Info label="Email" value={customer.email ?? "—"} />
          <Info label="PAN" value={customer.panMasked ?? customer.aadhaarPanMasked ?? "—"} mono />
          <Info label="Aadhaar" value={customer.aadhaarMasked ?? "—"} mono />
          <Info label="Sales executive" value={customer.salesExecutive ?? "—"} />
          <Info label="Address" value={customer.address ?? "—"} />
          <Info label="Notes" value={customer.notes ?? "—"} />
        </dl>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-medium">Booked units</h2>
          {user && can(user.role, "booking:create") && (
            <Link href={`/bookings/new?customerId=${customer.id}`} className="btn-primary">
              New booking
            </Link>
          )}
        </div>
        {customerBookings.length === 0 ? (
          <p className="text-sm text-muted">No units booked yet.</p>
        ) : (
          <div className="card divide-y divide-hairline">
            {customerBookings.map((booking) => (
              <Link
                key={booking.id}
                href={`/bookings/${booking.id}`}
                className="flex items-center justify-between px-4 py-3 hover:bg-canvas"
              >
                <div>
                  <p className="font-medium text-brass-dark">
                    {booking.propertyType} {booking.propertyNumber ?? ""}
                  </p>
                  <p className="text-xs text-muted">
                    {booking.projectName ?? "Project not specified"} · {booking.paymentType.replace("_", " ")}
                  </p>
                </div>
                <span className="text-sm text-muted">{booking.bookingDate}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Documents</h2>
        <DocumentPanel
          customerId={customer.id}
          documents={customerDocuments}
          canEdit={!!user && can(user.role, "document:upload")}
        />
      </section>
    </div>
  );
}

function Info({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className={mono ? "font-mono" : ""}>{value}</dd>
    </div>
  );
}
