import Link from "next/link";
import { LayoutDashboard, Building2, MapPin, Users, Radio, LogOut } from "lucide-react";

export const dynamic = "force-dynamic";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const links = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/sites", label: "Site", icon: Building2 },
    { href: "/admin/checkpoints", label: "Checkpoint", icon: MapPin },
    { href: "/admin/users", label: "Pengguna", icon: Users },
    { href: "/admin/nfc", label: "NFC Pairing", icon: Radio },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-60 border-r bg-white p-4">
        <h1 className="mb-6 text-lg font-bold text-gray-900">FacilityOS</h1>
        <nav className="space-y-1">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto pt-8">
          <Link
            href="/auth/signout"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Keluar
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
