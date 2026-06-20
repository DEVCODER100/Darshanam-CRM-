import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { CustomerForm } from "@/components/CustomerForm";

export const dynamic = "force-dynamic";

export default async function EditCustomerPage({
  params,
}: {
  params: { id: string };
}) {
  const c = await db.query.customers.findFirst({
    where: eq(customers.id, params.id),
  });
  if (!c) notFound();

  return (
    <div>
      <Link href={`/customers/${c.id}`} className="text-sm text-brass-dark hover:underline">
        ← {c.fullName}
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-medium">Edit customer</h1>
      <CustomerForm
        mode="edit"
        customerId={c.id}
        initial={{
          fullName: c.fullName,
          mobile: c.mobile,
          alternateMobile: c.alternateMobile ?? "",
          email: c.email ?? "",
          address: c.address ?? "",
          // Aadhaar/PAN is stored masked; leave the field blank so a re-entry is
          // explicit (entering a value replaces the stored masked value).
          panNumber: "",
          aadhaarNumber: "",
          salesExecutive: c.salesExecutive ?? "",
          notes: c.notes ?? "",
        }}
      />
    </div>
  );
}
