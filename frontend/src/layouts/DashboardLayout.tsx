
import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Coffee, MonitorPlay, ServerCrash, FileBarChart2, Activity, QrCode, Smartphone, LogOut, Menu, X, Shield } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useAuth } from '../contexts/AuthContext';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { name: 'Overview', path: '/', icon: LayoutDashboard },
  { name: 'Internet Lounge', path: '/lounge', icon: Coffee },
  { name: 'Rooms & Labs', path: '/rooms', icon: MonitorPlay },
  { name: 'Devices', path: '/devices', icon: ServerCrash },
  { name: 'Reports', path: '/reports', icon: FileBarChart2 },
  { name: 'QR Attendance', path: '/attendance-qr', icon: QrCode },
  { name: 'Iac Mobile', path: '/iac-mobile', icon: Smartphone },
];

function getInitials(name?: string) {
  if (!name) return 'AD';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await logout();
    } finally {
      setIsLoggingOut(false);
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="flex h-screen w-full bg-zinc-50 text-zinc-900 font-sans tracking-tight overflow-hidden">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-zinc-900/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <nav
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-72 border-r border-zinc-200/80 bg-white md:bg-white/70 backdrop-blur-xl flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="px-6 pt-7 pb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-900 rounded-xl flex items-center justify-center shadow-md shadow-zinc-900/10">
                <Activity className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h1 className="text-base font-bold text-zinc-900 tracking-tight leading-tight">
                  IAC Manager
                </h1>
                <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Command Center
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 md:hidden"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="px-3.5 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => cn(
                    "group flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-zinc-900 text-white shadow-sm shadow-zinc-900/10 font-semibold"
                      : "text-zinc-600 hover:bg-zinc-100/80 hover:text-zinc-900"
                  )}
                >
                  <Icon className={cn("w-4 h-4 transition-transform duration-150 group-hover:scale-110", "opacity-80")} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* User profile & Logout area */}
        <div className="p-4 border-t border-zinc-200/80 bg-zinc-50/80">
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-white border border-zinc-200/90 shadow-2xs mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-center text-amber-700 font-bold text-xs shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-zinc-900 text-xs truncate">
                  {user?.name || 'Administrator'}
                </p>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200/70 inline-flex items-center gap-0.5">
                  <Shield className="w-2.5 h-2.5" />
                  {user?.role || 'Admin'}
                </span>
              </div>
              <p className="text-zinc-400 text-[11px] truncate">
                {user?.email || 'admin@iac.com'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200/80 transition-all duration-150 cursor-pointer disabled:opacity-50 shadow-2xs"
            title="Sign out of administrative portal"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>{isLoggingOut ? 'Signing out...' : 'Log Out'}</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-zinc-200/80 bg-white/70 backdrop-blur-md px-4 sm:px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 md:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>System Online</span>
              <span className="text-zinc-300">•</span>
              <span className="text-zinc-400">Authenticated Session</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-bold text-zinc-900 leading-tight">
                {user?.name || 'Administrator'}
              </span>
              <span className="text-[10px] text-zinc-400 leading-tight">
                {user?.email || 'admin@iac.com'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-zinc-700 hover:text-rose-700 hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 transition-colors cursor-pointer"
              title="Sign out of account"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-500 group-hover:text-rose-600" />
              <span className="hidden xs:inline">{isLoggingOut ? 'Signing out...' : 'Log Out'}</span>
            </button>
          </div>
        </header>

        {/* Routed Page Content */}
        <main className="flex-1 overflow-auto bg-zinc-50/50">
          <div className="max-w-7xl mx-auto w-full h-full p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
