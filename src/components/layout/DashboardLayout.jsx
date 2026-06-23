import Link from "next/link";
import { useRouter } from "next/router";
import { ROLE_LABELS } from "@/lib/roles";
import { useAuth } from "@/context/AuthContext";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/leads", label: "Leads" },
  { href: "/leads/import", label: "Lead Import" },
  { href: "/sms", label: "SMS" },
  { href: "/email", label: "Email" },
  { href: "/tasks", label: "Tasks" },
  { href: "/twilio", label: "Twilio Admin", roles: ["super_admin", "admin", "manager"] }
];

export default function DashboardLayout({ children }) {
  const router = useRouter();
  const { profile, user, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-cloud text-ink">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-4 py-5 md:block">
        <Link href="/dashboard" className="block text-lg font-semibold text-ink">
          Marketing CRM
        </Link>
        <nav className="mt-8 space-y-1">
          {links
            .filter((link) => !link.roles || link.roles.includes(profile?.role))
            .map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm font-medium hover:bg-brand/10 ${
                router.pathname === link.href || (link.href === "/leads" && router.pathname === "/leads/[id]")
                  ? "bg-brand/10 text-brand"
                  : "text-slate-700"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-moss">Secure workspace</p>
            <h2 className="text-lg font-semibold text-ink">Dashboard</h2>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-ink">{profile?.name || user?.email}</p>
              <p className="text-xs text-slate-500">{ROLE_LABELS[profile?.role] || "Agent"}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-ink hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </header>

        <main className="px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
