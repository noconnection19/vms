import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import { formatDateTime } from '../utils/datetime';
import {
  Users,
  SignIn,
  SignOut,
  Plugs,
  ArrowRight,
  ArrowClockwise,
} from '@phosphor-icons/react';

export default function DashboardPage({ setActivePage }) {
  const [stats, setStats] = useState({
    totalVisitors: 0,
    activeCheckIns: 0,
    todayCheckOuts: 0,
    gateStatus: 'OPERATIONAL',
  });
  const [recentVisits, setRecentVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, visitsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/gate/stats`),
        fetch(`${API_BASE_URL}/gate/visits`),
      ]);
      const statsData = await statsRes.json();
      const visitsData = await visitsRes.json();
      setStats({
        totalVisitors: statsData.totalVisitors || 0,
        activeCheckIns: statsData.activeCheckIns || 0,
        todayCheckOuts: statsData.todayCheckOuts || 0,
        gateStatus: statsData.gateStatus || 'OPERATIONAL',
      });
      if (visitsData.data) {
        setRecentVisits(visitsData.data.slice(0, 10));
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const statCards = [
    {
      label: 'Total Visitors',
      value: loading ? '...' : stats.totalVisitors,
      sub: 'Total registered visitors',
      icon: Users,
      color: 'text-slate-300',
      iconBg: 'bg-slate-800',
    },
    {
      label: 'Active Visitors',
      value: loading ? '...' : stats.activeCheckIns,
      sub: 'Currently inside building',
      icon: SignIn,
      color: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
    },
    {
      label: 'Today Check-Outs',
      value: loading ? '...' : stats.todayCheckOuts,
      sub: 'Completed visits today',
      icon: SignOut,
      color: 'text-amber-400',
      iconBg: 'bg-amber-500/10',
    },
    {
      label: 'Gate Status',
      value: loading ? '...' : stats.gateStatus,
      sub: 'Gate sensor connected',
      icon: Plugs,
      color: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10',
      isText: true,
    },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg ${card.iconBg} flex items-center justify-center`}>
                  <Icon size={15} className={card.color} />
                </div>
              </div>
              <div className={`${card.isText ? 'text-base font-bold' : 'text-3xl font-bold'} ${card.color} tracking-tight`}>
                {card.value}
              </div>
              <div className="text-[11px] text-slate-500">{card.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Kiosk Quick Launch */}
      {/* <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-white">Kiosk Self-Registration</h3>
          <p className="text-xs text-slate-400">
            Alur pendaftaran 5 langkah: Verifikasi HP, Scan OCR, Foto Wajah, Submit, Gate Open.
          </p>
        </div>
        <button
          onClick={() => setActivePage('kiosk')}
          className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-semibold px-4 py-2 rounded-lg transition-colors text-sm whitespace-nowrap"
        >
          Buka Kiosk
          <ArrowRight size={15} weight="bold" />
        </button>
      </div> */}

      {/* Recent Visits Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">Recent Visit Activity</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">Real-time monitoring of recent visitor activity</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadDashboardData}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Refresh"
            >
              <ArrowClockwise size={15} />
            </button>
            <button
              onClick={() => setActivePage('visits')}
              className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
            >
              View all
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-500 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">Visit ID</th>
                <th className="px-4 py-3 font-medium">Card No.</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Check-In</th>
                <th className="px-4 py-3 font-medium">Check-Out</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {recentVisits.length > 0 ? (
                recentVisits.map((v) => (
                  <tr key={v.visitId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-slate-500">{v.visitId?.substring(0, 8)}...</td>
                    <td className="px-4 py-3 font-mono font-medium text-slate-200">{v.cardNo}</td>
                    <td className="px-4 py-3 text-slate-200">{v.card?.name || 'Visitor'}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400">{formatDateTime(v.checkIn)}</td>
                    <td className="px-4 py-3 font-mono text-amber-400">
                      {v.checkOut ? formatDateTime(v.checkOut) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {v.checkOut ? (
                        <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-medium">
                          Completed
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium">
                          Inside
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                    {loading ? 'Loading data...' : 'No visit activity recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
