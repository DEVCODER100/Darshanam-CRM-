import Link from "next/link";
import { getCashflow } from "@/lib/calendar";
import { formatINR } from "@/lib/money";
import { todayISO } from "@/lib/booking-detail";

export const dynamic = "force-dynamic";

function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default async function CalendarPage() {
  const { months, overdueTotal, upcomingTotal } = await getCashflow();
  const today = todayISO();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-medium">Calendar &amp; cashflow</h1>
        <p className="mt-1 text-sm text-muted">
          Scheduled instalments by month · as of {today}
        </p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card border-l-[3px] border-l-due p-4">
          <p className="text-xs tracking-wide text-muted">Overdue (past due date)</p>
          <p className="money mt-1 text-2xl font-medium text-due">
            {formatINR(overdueTotal, { paise2dp: false })}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs tracking-wide text-muted">Upcoming inflow</p>
          <p className="money mt-1 text-2xl font-medium text-ink">
            {formatINR(upcomingTotal, { paise2dp: false })}
          </p>
        </div>
      </section>

      {months.length === 0 ? (
        <p className="text-sm text-muted">No scheduled instalments.</p>
      ) : (
        <div className="space-y-5">
          {months.map((group) => (
            <div key={group.month} className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-hairline bg-canvas px-4 py-2.5">
                <h2 className="font-medium">{monthLabel(group.month)}</h2>
                <span className="money text-sm font-medium">
                  {formatINR(group.total, { paise2dp: false })}
                </span>
              </div>
              <table className="data-table">
                <tbody>
                  {group.items.map((item, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap">
                        {item.dueDate}
                        {item.overdue && (
                          <span className="pill-due ml-2">Overdue</span>
                        )}
                      </td>
                      <td>{item.customerName}</td>
                      <td>
                        <Link href={`/bookings/${item.bookingId}`} className="text-brass-dark hover:underline">
                          {item.booking}
                        </Link>
                      </td>
                      <td className="text-muted">{item.label ?? "—"}</td>
                      <td className="money text-right font-medium">{formatINR(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
