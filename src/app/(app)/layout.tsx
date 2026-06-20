import { UserButton } from "@clerk/nextjs";
import { SidebarNav } from "@/components/SidebarNav";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 flex-shrink-0 flex-col bg-ink py-5 md:flex">
        <div className="px-6 pb-6">
          <p className="text-base font-medium text-white">Darshanam</p>
          <p className="text-xs text-white/45">Construction CRM</p>
        </div>
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-hairline bg-surface px-6 py-3">
          <p className="text-sm font-medium text-ink md:hidden">Darshanam</p>
          <div className="ml-auto">
            <UserButton afterSignOutUrl="/sign-in" />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
