'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Bus,
  ReceiptText,
  Leaf,
  Landmark,
  Settings as SettingsIcon,
  Search,
  Bell,
  Sun,
  Moon,
  TrendingUp,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check saved theme or system preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ec-theme');
      if (saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      } else {
        setIsDark(false);
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const toggleDarkMode = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('ec-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('ec-theme', 'light');
    }
  };

  const navItems = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
    { label: 'Employee Directory', href: '/admin/directory', icon: Users },
    { label: 'Fleet Management', href: '/admin/fleet', icon: Bus },
    { label: 'Trips & Manifests', href: '/admin/trips-manifests', icon: ReceiptText },
    { label: 'Carbon & ESG Reports', href: '/admin/carbon-esg', icon: Leaf },
    { label: 'Government Analytics', href: '/gov/analytics', icon: Landmark },
    { label: 'Settings', href: '/admin/settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-surface dark:bg-[#121413] text-on-surface dark:text-[#f2f0f0] transition-colors duration-200">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-screen w-72 bg-surface-container-low dark:bg-[#181b19] border-r border-[#e0dedd] dark:border-[#272c29] z-50 flex flex-col justify-between py-6 px-4">
        <div className="flex flex-col gap-6">
          {/* Logo & Title */}
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary font-bold text-lg shadow-sm">
              EC
            </div>
            <div className="flex flex-col">
              <span className="text-xl font-bold tracking-tight text-on-surface dark:text-white leading-tight">
                EcoCommute
              </span>
              <span className="text-[11px] text-primary font-semibold tracking-wider uppercase">
                RideSync Enterprise
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-on-primary font-semibold shadow-sm'
                      : 'text-on-surface-variant dark:text-[#a6b2a3] hover:bg-surface-container-high dark:hover:bg-[#222724] hover:text-on-surface dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Transit Efficiency Card */}
        <div className="bg-surface-container-lowest dark:bg-[#202522] border border-[#e4e2e1] dark:border-[#2a302c] p-4 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-semibold tracking-wider text-on-surface-variant dark:text-[#a6b2a3]">
              Transit Efficiency
            </span>
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-2xl font-bold text-primary">94.2%</span>
            <span className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">Optimal</span>
          </div>
          <div className="w-full bg-surface-container dark:bg-[#2b322e] h-2 rounded-full overflow-hidden">
            <div className="bg-primary h-full rounded-full" style={{ width: '94.2%' }} />
          </div>
        </div>
      </aside>

      {/* Top Header & Main Content */}
      <div className="pl-72">
        <header className="fixed top-0 left-72 right-0 h-16 bg-surface/90 dark:bg-[#121413]/90 backdrop-blur-md border-b border-[#e0dedd] dark:border-[#272c29] z-40 flex items-center justify-between px-8">
          <div className="flex items-center gap-3 w-80 bg-surface-container-low dark:bg-[#1d211e] px-3.5 py-2 rounded-xl border border-[#e4e2e1] dark:border-[#2c332e]">
            <Search className="w-4 h-4 text-on-surface-variant dark:text-[#a6b2a3]" />
            <input
              type="text"
              placeholder="Search administration..."
              className="bg-transparent w-full text-sm outline-none text-on-surface dark:text-white placeholder:text-on-surface-variant dark:placeholder:text-[#7f8b7c]"
            />
          </div>

          <div className="flex items-center gap-4">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-on-surface-variant dark:text-[#a6b2a3] hover:text-on-surface dark:hover:text-white hover:bg-surface-container-low dark:hover:bg-[#1d211e] rounded-xl transition-colors border border-transparent hover:border-[#e4e2e1] dark:hover:border-[#2c332e]"
              title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDark ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
            </button>

            {/* Notifications Button (Solid dot, no pulsing) */}
            <button className="p-2 text-on-surface-variant dark:text-[#a6b2a3] hover:text-on-surface dark:hover:text-white hover:bg-surface-container-low dark:hover:bg-[#1d211e] rounded-xl transition-colors relative border border-transparent hover:border-[#e4e2e1] dark:hover:border-[#2c332e]">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full" />
            </button>

            {/* Profile */}
            <div className="flex items-center gap-3 pl-2 border-l border-[#e0dedd] dark:border-[#272c29]">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-on-surface dark:text-white">Alex Rivera</div>
                <div className="text-xs text-on-surface-variant dark:text-[#a6b2a3]">Global Admin</div>
              </div>
              <div className="w-9 h-9 rounded-full bg-secondary text-white font-bold text-sm flex items-center justify-center">
                AR
              </div>
            </div>
          </div>
        </header>

        <main className="w-full pt-20 px-8 pb-12 min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
};
