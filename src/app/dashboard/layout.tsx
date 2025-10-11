import Link from "next/link";
import {
  BarChart3,
  Users,
  MessageSquare,
  FileText,
  Settings,
  Home,
  Send,
  Bot,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: Home },
  { name: "Contacts", href: "/dashboard/contacts", icon: Users },
  { name: "Campaigns", href: "/dashboard/campaigns", icon: Send },
  { name: "AI Autoreply", href: "/dashboard/autoreply", icon: Bot },
  { name: "Templates", href: "/dashboard/templates", icon: FileText },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        {/* Sidebar */}
        <div className="w-64 bg-white shadow-sm border-r border-slate-200">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-slate-900">AutoSend Pro</h1>
          </div>
          <nav className="px-4 pb-4">
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link
                    href={item.href}
                    className="flex items-center px-4 py-2 text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Main content */}
        <div className="flex-1">
          <main className="p-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
