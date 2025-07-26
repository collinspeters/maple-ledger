import { useAuth } from "@/hooks/use-auth";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { 
  Brain, 
  LayoutDashboard, 
  ArrowRightLeft, 
  Receipt, 
  ChartLine, 
  MessageSquare, 
  Settings,
  User,
  MoreVertical,
  Clock
} from "lucide-react";

export default function Sidebar() {
  const { user, logout } = useAuth();
  const [location] = useLocation();

  const menuItems = [
    { href: "/", icon: LayoutDashboard, label: "Dashboard" },
    { href: "/transactions", icon: ArrowRightLeft, label: "Transactions", badge: "3" },
    { href: "/receipts", icon: Receipt, label: "Receipts", badge: "2" },
    { href: "/reports", icon: ChartLine, label: "Reports" },
    { href: "/ai-assistant", icon: MessageSquare, label: "AI Assistant" },
    { href: "/settings", icon: Settings, label: "Settings" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return location === "/";
    return location.startsWith(href);
  };

  return (
    <div className="w-64 bg-surface shadow-lg border-r border-gray-200 flex flex-col">
      {/* Logo and branding */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Brain className="text-white text-sm" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">BookkeepAI</h1>
            <p className="text-xs text-gray-500">Smart Bookkeeping</p>
          </div>
        </div>
      </div>

      {/* Trial Status Banner */}
      {user?.subscriptionStatus === "trial" && (
        <div className="mx-4 mt-4 p-3 bg-accent/10 border border-accent/20 rounded-lg">
          <div className="flex items-center space-x-2">
            <Clock className="text-accent text-sm" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {user.trialDaysRemaining || 0} days left
              </p>
              <p className="text-xs text-gray-600">in your free trial</p>
            </div>
          </div>
          <Link href="/subscribe">
            <Button className="w-full mt-2 px-3 py-1.5 bg-accent text-white text-xs font-medium rounded hover:bg-orange-600 transition-colors">
              Upgrade Now
            </Button>
          </Link>
        </div>
      )}

      {/* Navigation Menu */}
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <Link key={item.href} href={item.href}>
            <div className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors ${
              isActive(item.href)
                ? "bg-primary/10 text-primary"
                : "text-gray-700 hover:bg-gray-100"
            }`}>
              <item.icon className="w-4 h-4" />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`ml-auto text-white text-xs px-1.5 py-0.5 rounded-full ${
                  item.label === "Transactions" ? "bg-accent" : "bg-secondary"
                }`}>
                  {item.badge}
                </span>
              )}
            </div>
          </Link>
        ))}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="text-gray-600 text-sm" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">
              {user?.firstName && user?.lastName 
                ? `${user.firstName} ${user.lastName}`
                : user?.username
              }
            </p>
            <p className="text-xs text-gray-500">
              {user?.businessName || "No business name"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => logout()}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
