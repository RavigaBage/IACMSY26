
import { Outlet, NavLink } from 'react-router-dom';
import { LayoutDashboard, Coffee, MonitorPlay, ServerCrash, FileBarChart2, Activity, QrCode, Smartphone } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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

export default function DashboardLayout() {
  return (
    <div className="flex h-screen w-full bg-zinc-50 text-zinc-900 font-sans tracking-tight">
      {/* Sidebar Navigation */}
      <nav className="w-72 border-r border-zinc-200/80 bg-white/50 backdrop-blur-xl flex flex-col justify-between">
        <div>
          <div className="px-8 pt-10 pb-8 flex items-center gap-3">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center shadow-md">
              <Activity className="w-5 h-5 text-zinc-50" />
            </div>
            <h1 className="text-xl font-bold text-zinc-900 tracking-tight">
              IAC Manager
            </h1>
          </div>
          
          <div className="px-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    "group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-zinc-900 text-white shadow-md shadow-zinc-900/10" 
                      : "text-zinc-500 hover:bg-zinc-100/80 hover:text-zinc-900"
                  )}
                >
                  <Icon className={cn("w-5 h-5 transition-transform duration-200 group-hover:scale-110", "opacity-80")} />
                  {item.name}
                </NavLink>
              );
            })}
          </div>
        </div>
        
        {/* User profile area */}
        <div className="p-6">
          <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 border border-zinc-100 hover:border-zinc-200 transition-colors cursor-pointer">
            <div className="w-10 h-10 rounded-full bg-zinc-200 flex items-center justify-center text-zinc-600 font-semibold text-sm shadow-inner">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-zinc-900 text-sm truncate">Admin User</p>
              <p className="text-zinc-500 text-xs truncate">admin@iac.local</p>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-zinc-50/50">
        <div className="max-w-7xl mx-auto w-full h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
