import React, { useState, useEffect } from 'react';
import { ArrowClockwise } from '@phosphor-icons/react';
import { API_BASE_URL } from '../config';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/system/audit-logs`);
      const data = await res.json();
      if (data.data) setLogs(data.data);
    } catch (err) {
      console.error('Error fetching audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const methodColor = (method) => {
    const m = method?.toUpperCase();
    if (m === 'GET') return 'bg-slate-800 text-slate-300';
    if (m === 'POST') return 'bg-emerald-500/10 text-emerald-400';
    if (m === 'PUT' || m === 'PATCH') return 'bg-amber-500/10 text-amber-400';
    if (m === 'DELETE') return 'bg-rose-500/10 text-rose-400';
    return 'bg-slate-800 text-slate-400';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Audit Log</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">System transaction history and activity audit log</p>
        </div>
        <button
          onClick={fetchLogs}
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
              <th className="px-4 py-3 font-medium">Log ID</th>
              <th className="px-4 py-3 font-medium">Method</th>
              <th className="px-4 py-3 font-medium">API URL</th>
              <th className="px-4 py-3 font-medium">Request Body</th>
              <th className="px-4 py-3 font-medium">Response</th>
              <th className="px-4 py-3 font-medium">Timestamp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {logs.length > 0 ? (
              logs.map((log) => (
                <tr key={log.logId} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono text-slate-500">#{log.logId}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${methodColor(log.method)}`}>
                      {log.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-200">{log.apiUrl}</td>
                  <td className="px-4 py-3 font-mono text-slate-400 truncate max-w-xs">{log.paramBody || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 font-mono text-slate-400 truncate max-w-xs">{log.response || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 font-mono text-slate-500 text-[11px]">{new Date(log.createdDt).toLocaleString('en-US')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                  {loading ? 'Loading logs...' : 'No activity logs recorded yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
