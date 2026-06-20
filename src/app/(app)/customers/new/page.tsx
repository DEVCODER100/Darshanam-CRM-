import Link from "next/link";
import { CustomerForm } from "@/components/CustomerForm";

export default function NewCustomerPage() {
  return (
    <div>
      <Link href="/customers" className="text-sm text-brass-dark hover:underline">
        ← Customers
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-medium">New customer</h1>
      <CustomerForm mode="create" />
    </div>
  );
}
