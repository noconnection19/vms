import React, { useState, useEffect } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import { API_BASE_URL } from '../config';
import { formatDateTime } from '../utils/datetime';

export default function VisitsPage() {
  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchVisits = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/gate/visits`)
      .then((res) => res.json())
      .then((data) => {
        if (data.data) setVisits(data.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchVisits();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Visit Logs</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">History and activity monitoring for all visitor visits</p>
        </div>
        <button
          onClick={fetchVisits}
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          title="Refresh"
        >
          <ArrowClockwise size={14} />
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
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
            {visits.length > 0 ? (
              visits.map((v) => (
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
                      <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-medium">Completed</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium">Inside</span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                  {loading ? 'Loading data...' : 'No visit records found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
