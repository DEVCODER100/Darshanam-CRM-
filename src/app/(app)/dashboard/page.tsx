import Link from "next/link";
import { getBoard, getUnitPanel, type UnitStatus } from "@/lib/unit-board";
import { getCurrentUser } from "@/lib/rbac";
import { can } from "@/lib/permissions";
import { asc, ne } from "drizzle-orm";
import { db } from "@/db";
import { siteMaps, users } from "@/db/schema";
import { BOX, STATUSES } from "@/lib/unit-style";
import { activeCount, matchesUnit, parseUnitFilters } from "@/lib/unit-filters";
import { panQueryHash } from "@/lib/report-filters";
import { hashPan } from "@/lib/pan";
import { UnitFilterPanel } from "@/components/UnitFilterPanel";
import { filterOptions } from "@/lib/unit-table";
import { activeProjectId, inProject } from "@/lib/project-scope";
import { MapBoard } from "@/components/MapBoard";
import { MapUpload } from "@/components/MapUpload";
import { UnitAdd } from "@/components/UnitAdd";
import { UnitImport } from "@/components/UnitImport";
import { UnitQuickActions } from "@/components/UnitQuickActions";
import { UnitPanel } from "@/components/UnitPanel";

export const dynamic = "force-dynamic";

type Params = Record<string, string | undefined>; // unit, view, map, edit and all the filter fields

/** Real staff for the "Blocked by" list; an email tells apart people with the same name. */
async function staffChoices() {
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(ne(users.clerkUserId, "seed_admin_placeholder"));
  return rows.map((u) => ({
    id: u.id,
    name: rows.filter((o) => o.name === u.name).length > 1 ? `${u.name} (${u.email})` : u.name,
  }));
}

export default async function DashboardPage({ searchParams }: { searchParams: Params }) {
  const user = await getCurrentUser();
  const board = await getBoard();

  const filters = parseUnitFilters(searchParams);
  const { status, type } = filters;

  const href = (patch: Partial<Params>) => {
    const merged = { ...searchParams, edit: undefined, ...patch };
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/dashboard?${s}` : "/dashboard";
  };

  let clientPanHash: string | null = null;
  try {
    clientPanHash = panQueryHash(filters.client, hashPan); // an exact PAN typed in the client box
  } catch {} // no encryption key: PAN search simply finds nothing
  const visible = board.units.filter((u) => matchesUnit(u, filters, { clientPanHash }));
  const downloadQuery = new URLSearchParams(
    Object.entries(searchParams).filter(([k, val]) => val && !["unit", "edit", "view", "map"].includes(k)) as [string, string][],
  ).toString();

  // Group by project when there is more than one.
  const groups = new Map<string, typeof visible>();
  for (const u of visible) {
    const key = `${u.projectName}|${u.unitType}`; // one section per project and unit type
    const list = groups.get(key) ?? [];
    list.push(u);
    groups.set(key, list);
  }
  const showProject = board.projects.length > 1; // project name in headings only in the "All projects" view

  const maps = await db
    .select({ id: siteMaps.id, name: siteMaps.name, fileUrl: siteMaps.fileUrl, width: siteMaps.width, height: siteMaps.height, detected: siteMaps.detected })
    .from(siteMaps)
    .where(inProject(siteMaps.projectId, await activeProjectId()))
    .orderBy(asc(siteMaps.createdAt));
  const activeMap = maps.find((m) => m.id === searchParams.map) ?? maps[0];
  const showMap = !!activeMap && searchParams.view !== "grid";
  const visibleIds = new Set(visible.map((u) => u.id));

  const panel = searchParams.unit ? await getUnitPanel(searchParams.unit) : null;
  const access = {
    canBook: !!user && can(user.role, "booking:create"),
    canPay: !!user && can(user.role, "payment:create"),
    canEditBooking: !!user && can(user.role, "booking:edit"),
    canManageUnits: !!user && can(user.role, "unit:manage"),
    staff: await staffChoices(),
    currentUserId: user?.id ?? "",
  };
  const freeUnits = board.units
    .filter((u) => u.status === "available")
    .map((u) => ({ id: u.id, label: `${u.name}${u.projectName ? ` · ${u.projectName}` : ""}` }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">Unit board</h1>
          <p className="text-sm text-muted">Click a unit to see its owner, payments and dues.</p>
        </div>
        {access.canManageUnits && (
          <div className="flex flex-wrap items-start gap-2">
            <MapUpload />
            <UnitImport />
            <UnitAdd />
          </div>
        )}
      </div>

      {(access.canBook || access.canManageUnits) && (
        <UnitQuickActions
          freeUnits={freeUnits}
          staff={access.staff}
          currentUserId={access.currentUserId}
          canBook={access.canBook}
          canBlock={access.canManageUnits}
        />
      )}

      {maps.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {[["map", "Map"], ["grid", "Grid"]].map(([v, label]) => (
            <Link
              key={v}
              href={href({ view: v })}
              className={`rounded-md border px-3 py-1 text-sm ${(v === "map") === showMap ? "border-ink bg-ink text-white" : "border-hairline bg-surface text-muted hover:text-ink"}`}
            >
              {label}
            </Link>
          ))}
          {showMap && maps.length > 1 && (
            <>
              <span className="ml-2 text-sm text-muted">Map:</span>
              {maps.map((m) => (
                <Link
                  key={m.id}
                  href={href({ map: m.id, unit: undefined })}
                  className={`rounded-md border px-3 py-1 text-sm ${m.id === activeMap.id ? "border-ink bg-surface font-medium" : "border-hairline bg-surface text-muted hover:text-ink"}`}
                >
                  {m.name}
                </Link>
              ))}
            </>
          )}
        </div>
      )}

      {/* Legend + status filter */}
      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <Link
            key={s.key}
            href={href({ status: status === s.key ? undefined : s.key })}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${
              status === s.key ? "border-ink bg-surface font-medium" : "border-hairline bg-surface text-muted hover:text-ink"
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
            {s.label} · {board.counts[s.key]}
          </Link>
        ))}
        <span className="text-sm text-muted">{board.counts.total} units</span>
      </div>

      {/* Type filter + search */}
      <div className="flex flex-wrap items-center gap-2">
        {board.types.length > 1 && (
          <>
            <Link
              href={href({ type: undefined })}
              className={`rounded-md px-3 py-1 text-sm ${!type ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink border border-hairline"}`}
            >
              All types
            </Link>
            {board.types.map((t) => (
              <Link
                key={t}
                href={href({ type: type === t ? undefined : t })}
                className={`rounded-md px-3 py-1 text-sm ${type === t ? "bg-ink text-white" : "bg-surface text-muted hover:text-ink border border-hairline"}`}
              >
                {t}
              </Link>
            ))}
          </>
        )}
        <form method="get" className="ml-auto flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          {type && <input type="hidden" name="type" value={type} />}
          {searchParams.view && <input type="hidden" name="view" value={searchParams.view} />}
          {searchParams.map && <input type="hidden" name="map" value={searchParams.map} />}
          <input name="q" defaultValue={searchParams.q} placeholder="Find a unit or owner" className="field w-56" />
          <button className="btn-secondary px-3 py-1.5">Find</button>
        </form>
      </div>

      <UnitFilterPanel
        values={Object.fromEntries(Object.entries(searchParams).filter(([, val]) => val)) as Record<string, string>}
        active={activeCount(filters)}
        found={visible.length}
        total={board.units.length}
        options={filterOptions(board.units, board.types)}
        keep={{ view: searchParams.view, map: searchParams.map }}
        resetHref={href(Object.fromEntries(Object.keys(searchParams).filter((k) => !["view", "map"].includes(k)).map((k) => [k, undefined])))}
        downloadHref={`/api/units/export?${downloadQuery}`}
      />

      <div className={panel ? "grid gap-5 xl:grid-cols-[minmax(0,1fr)_470px]" : ""}>
        <div className="min-w-0 space-y-5">
          {showMap ? (
            <MapBoard
              key={activeMap.id}
              map={{ id: activeMap.id, name: activeMap.name, fileUrl: activeMap.fileUrl, width: activeMap.width, height: activeMap.height, detected: activeMap.detected }}
              boxes={board.units
                .filter((u) => u.map?.id === activeMap.id)
                .map((u) => ({ unitId: u.id, number: u.unitNumber, name: u.name, status: u.status, owner: u.owner, ...u.map! }))}
              free={board.units.filter((u) => !u.map).map((u) => ({ id: u.id, number: u.unitNumber, type: u.unitType }))}
              dimmed={board.units.filter((u) => !visibleIds.has(u.id)).map((u) => u.id)}
              selectedId={searchParams.unit}
              hrefBase={href({ unit: "__ID__" })}
              canEdit={access.canManageUnits}
              startEditing={searchParams.edit === "1"}
            />
          ) : board.counts.total === 0 ? (
            <p className="card p-6 text-sm text-muted">
              No units yet.{" "}
              {access.canManageUnits
                ? "Use “Add units” above, for example 20 bungalows."
                : "Ask an admin to add the units."}
            </p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted">No units match these filters.</p>
          ) : (
            [...groups.entries()].map(([key, list]) => (
              <section key={key}>
                <h2 className="mb-2 text-sm font-medium text-ink">
                  {showProject && <span className="text-muted">{list[0].projectName || "No project"} · </span>}
                  {list[0].unitType}s
                  <span className="ml-2 font-normal text-muted">
                    {list.filter((u) => u.status === "booked").length} booked of {list.length}
                  </span>
                </h2>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {list.map((u) => (
                    <Link
                      key={u.id}
                      href={href({ unit: u.id })}
                      scroll={false}
                      className={`block rounded-md border px-3 py-2.5 transition hover:shadow-pop ${BOX[u.status]} ${
                        searchParams.unit === u.id ? "ring-2 ring-ink" : ""
                      }`}
                    >
                      <p className="truncate text-sm font-medium">{u.name}</p>
                      <p className="truncate text-xs">
                        {u.status === "booked" ? u.owner : u.block ? `Blocked · ${u.block.name}` : "Available"}
                      </p>
                    </Link>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        {panel && (
          <aside className="xl:sticky xl:top-4 xl:self-start">
            <UnitPanel data={panel} access={access} closeHref={href({ unit: undefined })} />
          </aside>
        )}
      </div>
    </div>
  );
}
