import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Circle, DeviceTablet, SignOut } from '@phosphor-icons/react';

const routeTitles = {
  '/admin/dashboard': 'Dashboard Overview',
  '/admin/gate': 'Gate Access & Control',
  '/admin/visitors': 'Visitor Directory Management',
  '/admin/visits': 'Visit Logs & History',
  '/admin/audit': 'System Audit Logs',
  '/admin/settings': 'System Settings',
};

export default function Header({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  const currentTitle = routeTitles[location.pathname] || 'Admin Portal';
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });

  return (
    <header className="bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 px-6 py-3.5 flex items-center justify-between sticky top-0 z-30">
      <div>
        <h1 className="text-sm font-semibold text-white">{currentTitle}</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">{dateStr} &middot; {timeStr}</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Gate Status Indicator */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400 font-medium px-2.5 py-1 bg-slate-950 border border-slate-800 rounded-lg">
          <Circle size={7} weight="fill" className="text-emerald-400 animate-pulse" />
          <span>Gate Online</span>
        </div>

        {/* Quick Kiosk Switcher Button */}
        {/* <button
          type="button"
          onClick={() => navigate('/kiosk')}
          title="Buka Tampilan Kiosk Registrasi Tamu"
          className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700/80 text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <DeviceTablet size={16} />
          <span className="hidden md:inline">Mode Kiosk</span>
        </button> */}

        {/* Divider */}
        <div className="w-px h-4 bg-slate-800" />

        {/* User Info & Logout */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[10px] font-bold text-emerald-400">
            AD
          </div>
          <div className="hidden sm:block">
            <div className="text-xs font-semibold text-white leading-none">{user?.name || 'Administrator'}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{user?.role || 'Super Admin'}</div>
          </div>
        </div>

        {/* Logout Button */}
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            title="Log out of Admin Dashboard"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors ml-1"
          >
            <SignOut size={18} />
          </button>
        )}
      </div>
    </header>
  );
}
