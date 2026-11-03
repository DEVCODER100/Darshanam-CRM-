import Link from "next/link";
import { CustomerForm } from "@/components/CustomerForm";

export default function NewCustomerPage({ searchParams }: { searchParams: { returnTo?: string } }) {
  // Only follow in-app paths (the booking flow sends us here and takes us back).
  const returnTo = searchParams.returnTo?.startsWith("/") && !searchParams.returnTo.startsWith("//") ? searchParams.returnTo : undefined;
  return (
    <div>
      <Link href="/customers" className="text-sm text-brass-dark hover:underline">
        ← Customers
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-medium">New customer</h1>
      <CustomerForm mode="create" returnTo={returnTo} />
    </div>
  );
}
