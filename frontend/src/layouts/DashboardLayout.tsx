import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Coffee, MonitorPlay, ServerCrash, FileBarChart2, QrCode, Smartphone, LogOut, Menu, X, Shield } from 'lucide-react';
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
  { name: 'IAC Mobile', path: '/iac-mobile', icon: Smartphone },
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
          className="fixed inset-0 z-40 bg-zinc-900/40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation (Drawer on mobile, fixed on desktop) */}
      <nav
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 w-72 border-r border-zinc-200 bg-white flex flex-col justify-between transition-transform duration-200 ease-in-out shrink-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-zinc-100">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-zinc-900 rounded-lg flex items-center justify-center text-amber-400 font-bold text-xs">
                IAC
              </div>
              <div>
                <h1 className="text-sm font-bold text-zinc-900 tracking-tight leading-tight">
                  IAC Management
                </h1>
                <p className="text-[11px] font-medium text-zinc-400">
                  Operations Portal
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 md:hidden cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <div className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) => cn(
                    "min-h-[44px] flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-zinc-900 text-white font-semibold"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                  )}
                >
                  <Icon className="w-4 h-4 opacity-80 shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </div>
        </div>

        {/* User profile & Logout area */}
        <div className="p-4 border-t border-zinc-200 bg-zinc-50">
          <div className="flex items-center gap-3 p-2.5 rounded-lg bg-white border border-zinc-200 mb-2.5">
            <div className="w-9 h-9 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700 font-bold text-xs shrink-0">
              {getInitials(user?.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-zinc-900 text-xs truncate">
                  {user?.name || 'Administrator'}
                </p>
                <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-700 border border-zinc-200 inline-flex items-center gap-0.5">
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
            className="w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-600" />
            <span>{isLoggingOut ? 'Signing out...' : 'Log Out'}</span>
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Top Header Bar */}
        <header className="min-h-[56px] border-b border-zinc-200 bg-white px-4 sm:px-6 flex items-center justify-between shrink-0 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 md:hidden cursor-pointer"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-bold text-zinc-900 md:hidden">
              IAC Management
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex flex-col text-right">
              <span className="text-xs font-semibold text-zinc-900 leading-tight">
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
              className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-700 hover:text-rose-700 hover:bg-rose-50 border border-zinc-200 hover:border-rose-200 transition-colors cursor-pointer"
              title="Sign out of account"
            >
              <LogOut className="w-3.5 h-3.5 text-zinc-500" />
              <span className="hidden xs:inline">{isLoggingOut ? 'Signing out...' : 'Log Out'}</span>
            </button>
          </div>
        </header>

        {/* Routed Page Content */}
        <main className="flex-1 overflow-auto bg-zinc-50 pb-[calc(env(safe-area-inset-bottom)+4.5rem)] md:pb-[env(safe-area-inset-bottom)]">
          <div className="max-w-7xl mx-auto w-full p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Navigation Bar (Screens < 768px) */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-zinc-200 pb-[env(safe-area-inset-bottom)] shadow-md">
          <div className="grid grid-cols-5 h-14">
            <NavLink
              to="/"
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center text-[10px] font-medium transition-colors min-h-[48px]",
                isActive ? "text-zinc-900 font-bold" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <LayoutDashboard className="w-4 h-4 mb-0.5" />
              <span>Overview</span>
            </NavLink>
            <NavLink
              to="/lounge"
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center text-[10px] font-medium transition-colors min-h-[48px]",
                isActive ? "text-zinc-900 font-bold" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <Coffee className="w-4 h-4 mb-0.5" />
              <span>Lounge</span>
            </NavLink>
            <NavLink
              to="/rooms"
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center text-[10px] font-medium transition-colors min-h-[48px]",
                isActive ? "text-zinc-900 font-bold" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <MonitorPlay className="w-4 h-4 mb-0.5" />
              <span>Rooms</span>
            </NavLink>
            <NavLink
              to="/devices"
              className={({ isActive }) => cn(
                "flex flex-col items-center justify-center text-[10px] font-medium transition-colors min-h-[48px]",
                isActive ? "text-zinc-900 font-bold" : "text-zinc-500 hover:text-zinc-900"
              )}
            >
              <ServerCrash className="w-4 h-4 mb-0.5" />
              <span>Devices</span>
            </NavLink>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex flex-col items-center justify-center text-[10px] font-medium text-zinc-500 hover:text-zinc-900 min-h-[48px] cursor-pointer"
            >
              <Menu className="w-4 h-4 mb-0.5" />
              <span>More</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
