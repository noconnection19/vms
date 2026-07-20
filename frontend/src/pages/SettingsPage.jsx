import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import { ArrowClockwise, Trash } from '@phosphor-icons/react';
import { API_BASE_URL } from '../config';

export default function SettingsPage() {
  const { toast, confirm } = useToast();
  const [masterSystems, setMasterSystems] = useState([]);
  const [masterAdmins, setMasterAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [resetMsg, setResetMsg] = useState('');

  const loadSettingsData = async () => {
    setLoading(true);
    try {
      const [sysRes, adminRes] = await Promise.all([
        fetch(`${API_BASE_URL}/system/master`),
        fetch(`${API_BASE_URL}/system/admins`),
      ]);
      const sysData = await sysRes.json();
      const adminData = await adminRes.json();
      if (sysData.data) setMasterSystems(sysData.data);
      if (adminData.data) setMasterAdmins(adminData.data);
    } catch (err) {
      console.error('Failed to load settings data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleResetData = async () => {
    const isConfirmed = await confirm({
      title: 'Reset VMS Database',
      message: 'Are you sure you want to DELETE ALL DATA (visit logs, visitor records, access cards, and attachments)? This action is permanent and cannot be undone.',
      isDanger: true,
      confirmText: 'Yes, Reset All Data',
      cancelText: 'Cancel',
    });

    if (!isConfirmed) return;

    setResetting(true);
    setResetMsg('');
    try {
      const res = await fetch(`${API_BASE_URL}/system/reset-data`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setResetMsg(data.message);
        toast.success(data.message || 'Database reset successfully.', 'Reset Complete');
        loadSettingsData();
      } else {
        toast.error('Failed to reset data: ' + data.error);
      }
    } catch (err) {
      toast.error('Error resetting data: ' + err.message);
    } finally {
      setResetting(false);
    }
  };


  return (
    <div className="space-y-5 max-w-4xl">
      {/* System Configurations */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">System References</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">System settings and configuration parameters</p>
          </div>
          <button
            onClick={loadSettingsData}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Refresh"
          >
            <ArrowClockwise size={14} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/60 text-slate-500 border-b border-slate-800">
              <tr>
                <th className="px-4 py-3 font-medium">System Type</th>
                <th className="px-4 py-3 font-medium">System Code</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {masterSystems.length > 0 ? (
                masterSystems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200">{item.systemType}</td>
                    <td className="px-4 py-3 font-mono text-emerald-400">{item.systemCd}</td>
                    <td className="px-4 py-3 font-semibold text-amber-400">{item.systemValue}</td>
                    <td className="px-4 py-3 text-slate-400">{item.remarks}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="px-4 py-10 text-center text-slate-500">
                    {loading ? 'Loading data...' : 'No system master data available.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Users */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Administrator Accounts</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">List of users with administrator access rights</p>
        </div>
        <div className="space-y-2">
          {masterAdmins.length > 0 ? (
            masterAdmins.map((admin) => (
              <div key={admin.username} className="flex items-center gap-3 px-4 py-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                  {admin.username?.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-white">{admin.name}</div>
                  <div className="text-[11px] text-slate-500">{admin.username} &middot; {admin.role}</div>
                </div>
                <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">Active</span>
              </div>
            ))
          ) : (
            <div className="px-4 py-6 text-center text-slate-500 text-xs">
              {loading ? 'Loading admin data...' : 'No admin accounts registered.'}
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone: Reset Data */}
      <div className="bg-slate-900/90 border border-rose-500/30 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-rose-400 flex items-center gap-2">
            <Trash size={18} />
            <span>Danger Zone - Reset Database</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Permanently erases all visit transaction history, visitor directory, access cards, attachments, and uploaded files.
          </p>
        </div>

        {resetMsg && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300">
            {resetMsg}
          </div>
        )}

        <button
          type="button"
          onClick={handleResetData}
          disabled={resetting}
          className="bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {resetting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Trash size={16} />
              <span>Reset All VMS Data</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
