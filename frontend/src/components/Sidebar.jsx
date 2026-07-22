import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  SquaresFour,
  Lock,
  Users,
  ClipboardText,
  ShieldCheck,
  Gear,
  DeviceTablet,
  SignOut,
} from '@phosphor-icons/react';

const menuItems = [
  { path: '/admin/dashboard', label: 'Dashboard', icon: SquaresFour },
  { path: '/admin/gate', label: 'Gate Control', icon: Lock },
  { path: '/admin/visitors', label: 'Master User', icon: Users },
  { path: '/admin/visits', label: 'Visit Logs', icon: ClipboardText },
  { path: '/admin/audit', label: 'Audit Log', icon: ShieldCheck },
  { path: '/admin/settings', label: 'Settings', icon: Gear },
];

export default function Sidebar({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <aside className="w-60 bg-slate-900 border-r border-slate-800 flex flex-col hidden lg:flex shrink-0 select-none">
      {/* Brand Header */}
      <div className="px-5 pt-6 pb-5 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
            <span className="text-slate-950 font-black text-xs tracking-tight">VMS</span>
          </div>
          <div>
            <div className="text-sm font-bold text-white leading-none">VMS Enterprise</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Admin Portal</div>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Admin Portal
        </div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${isActive
                  ? 'bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    weight={isActive ? 'duotone' : 'regular'}
                    className={isActive ? 'text-emerald-400' : 'text-slate-500'}
                  />
                  <span>{item.label}</span>
                  {isActive && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </>
              )}
            </NavLink>
          );
        })}

        {/* Separator / Public Standalone Section */}
        {/* <div className="pt-4 pb-2 px-3 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Public Standalone
        </div>
        <button
          type="button"
          onClick={() => navigate('/kiosk')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-400 hover:bg-emerald-500/10 border border-emerald-500/20 transition-all"
        >
          <DeviceTablet size={18} className="text-emerald-400" />
          <span>Screen Kiosk (Public)</span>
        </button> */}
      </nav>

      {/* User Footer / Logout */}
      <div className="px-4 py-4 border-t border-slate-800 space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-emerald-400 shrink-0">
            AD
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white truncate">{user?.name || 'Administrator'}</div>
            <div className="text-[10px] text-slate-500 truncate">{user?.role || 'Super Admin'}</div>
          </div>
          {onLogout && (
            <button
              onClick={onLogout}
              title="Logout"
              className="ml-auto p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <SignOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
