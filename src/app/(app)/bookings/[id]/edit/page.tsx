import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { bookings, propertyCosts } from "@/db/schema";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { paiseToRupeeString, bpsToPercentString } from "@/lib/money";
import { BookingForm } from "@/components/BookingForm";

export const dynamic = "force-dynamic";

export default async function EditBookingPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "booking:edit")) {
    return (
      <p className="rounded-md bg-due-bg px-3 py-2 text-sm text-due">
        You do not have permission to edit bookings.
      </p>
    );
  }

  const booking = await db.query.bookings.findFirst({
    where: eq(bookings.id, params.id),
  });
  if (!booking) notFound();
  const cost = await db.query.propertyCosts.findFirst({
    where: eq(propertyCosts.bookingId, params.id),
  });

  return (
    <div>
      <Link href={`/bookings/${booking.id}`} className="text-sm text-brass-dark hover:underline">
        ← {booking.propertyType} {booking.propertyNumber ?? ""}
      </Link>
      <h1 className="mb-4 mt-2 text-2xl font-medium">Edit booking</h1>
      <BookingForm
        mode="edit"
        bookingId={booking.id}
        customerId={booking.customerId}
        initial={{
          bookingDate: booking.bookingDate,
          projectName: booking.projectName ?? "",
          propertyType: booking.propertyType as
            | "Villa"
            | "Plot"
            | "Apartment"
            | "Flat"
            | "Shop",
          propertyNumber: booking.propertyNumber ?? "",
          bookingAddress: booking.bookingAddress ?? "",
          unitStatus: booking.unitStatus,
          paymentType: booking.paymentType,
          stageBased: booking.stageBased,
          currentStage: booking.currentStage ?? "",
          downPayment: paiseToRupeeString(booking.downPayment),
          installmentCount: booking.installmentCount
            ? String(booking.installmentCount)
            : "",
          installmentFrequency: booking.installmentFrequency ?? "monthly",
          baseCost: cost ? paiseToRupeeString(cost.baseCost) : "",
          extraCharges: cost ? paiseToRupeeString(cost.extraCharges) : "0",
          discount: cost ? paiseToRupeeString(cost.discount) : "0",
          gstPercent: cost ? bpsToPercentString(BigInt(cost.gstPercentBps)) : "0",
          maintenanceCharge: cost ? paiseToRupeeString(cost.maintenanceCharge) : "0",
          documentationPercent: cost
            ? bpsToPercentString(BigInt(cost.documentationPercentBps))
            : "0",
        }}
      />
    </div>
  );
}
