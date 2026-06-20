import Link from "next/link";
import { desc, or, ilike } from "drizzle-orm";
import { db } from "@/db";
import { customers, bookings } from "@/db/schema";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { SearchBar } from "@/components/SearchBar";

const TYPE_ORDER = ["Villa", "Flat", "Shop"];

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  const user = await getCurrentUser();
  const q = searchParams.q?.trim();
  const where = q
    ? or(
        ilike(customers.fullName, `%${q}%`),
        ilike(customers.mobile, `%${q}%`),
        ilike(customers.email, `%${q}%`),
      )
    : undefined;
  const rows = await db
    .select()
    .from(customers)
    .where(where)
    .orderBy(desc(customers.createdAt));

  // Distinct property types each customer owns, for the tag before their name.
  const typeRows = await db
    .selectDistinct({
      customerId: bookings.customerId,
      propertyType: bookings.propertyType,
    })
    .from(bookings);
  const typesByCustomer = new Map<string, string[]>();
  for (const t of typeRows) {
    const list = typesByCustomer.get(t.customerId) ?? [];
    list.push(t.propertyType);
    typesByCustomer.set(t.customerId, list);
  }
  const sortedTypes = (id: string) =>
    (typesByCustomer.get(id) ?? []).sort(
      (a, b) =>
        (TYPE_ORDER.indexOf(a) + 1 || 99) - (TYPE_ORDER.indexOf(b) + 1 || 99),
    );

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-medium">Customers</h1>
        {user && can(user.role, "customer:create") && (
          <Link href="/customers/new" className="btn-primary">
            New customer
          </Link>
        )}
      </div>

      <div className="mb-4">
        <SearchBar placeholder="Search name, mobile or email" defaultValue={q} />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted">
          {q ? "No customers match your search." : "No customers yet."}
        </p>
      ) : (
        <div className="overflow-hidden rounded border border-hairline bg-white">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Mobile</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Aadhaar/PAN</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="border-t border-hairline hover:bg-canvas">
                  <td className="px-4 py-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {sortedTypes(c.id).map((t) => (
                        <span key={t} className="pill-neutral">
                          {t}
                        </span>
                      ))}
                      <Link href={`/customers/${c.id}`} className="text-brass-dark hover:underline">
                        {c.fullName}
                      </Link>
                    </span>
                  </td>
                  <td className="px-4 py-2">{c.mobile}</td>
                  <td className="px-4 py-2 text-muted">{c.email ?? "—"}</td>
                  <td className="px-4 py-2 font-mono text-muted">
                    {c.aadhaarPanMasked ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
