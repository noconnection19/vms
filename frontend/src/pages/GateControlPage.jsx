import React, { useState } from 'react';
import { SignIn, SignOut } from '@phosphor-icons/react';

import { API_BASE_URL as API_BASE } from '../config';

export default function GateControlPage() {
  const [checkInCardNo, setCheckInCardNo] = useState('');
  const [checkOutCardNo, setCheckOutCardNo] = useState('');
  const [checkInResult, setCheckInResult] = useState(null);
  const [checkOutResult, setCheckOutResult] = useState(null);
  const [loadingIn, setLoadingIn] = useState(false);
  const [loadingOut, setLoadingOut] = useState(false);

  const processCheckIn = async () => {
    if (!checkInCardNo) return;
    setLoadingIn(true);
    try {
      const res = await fetch(`${API_BASE}/gate/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNo: checkInCardNo }),
      });
      const data = await res.json();
      setCheckInResult(data);
    } catch {
      setCheckInResult({ accessGranted: false, message: 'Failed to connect to Gate API.' });
    } finally {
      setLoadingIn(false);
    }
  };

  const processCheckOut = async () => {
    if (!checkOutCardNo) return;
    setLoadingOut(true);
    try {
      const res = await fetch(`${API_BASE}/gate/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNo: checkOutCardNo }),
      });
      const data = await res.json();
      setCheckOutResult(data);
    } catch {
      setCheckOutResult({ accessGranted: false, message: 'Failed to connect to Gate API.' });
    } finally {
      setLoadingOut(false);
    }
  };

  const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 outline-none transition-colors";
  const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto">
      {/* Gate Check-In */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <SignIn size={18} className="text-emerald-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Entrance Gate</h3>
            <p className="text-[11px] text-slate-400">Scan card for visitor check-in</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Card Number / National ID</label>
            <input
              type="text"
              placeholder="Scan or enter card number"
              value={checkInCardNo}
              onChange={(e) => setCheckInCardNo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && processCheckIn()}
              className={inputClass}
            />
          </div>
          <button
            onClick={processCheckIn}
            disabled={loadingIn || !checkInCardNo}
            className="w-full bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-semibold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-40"
          >
            {loadingIn ? 'Processing...' : 'Process Check-In'}
          </button>
        </div>

        {checkInResult && (
          <div className={`px-4 py-3 border rounded-lg text-xs font-medium ${checkInResult.accessGranted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
            {checkInResult.message}
          </div>
        )}
      </div>

      {/* Gate Check-Out */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <SignOut size={18} className="text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Exit Gate</h3>
            <p className="text-[11px] text-slate-400">Validate before opening exit gate</p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={labelClass}>Card Number / National ID</label>
            <input
              type="text"
              placeholder="Scan or enter card number"
              value={checkOutCardNo}
              onChange={(e) => setCheckOutCardNo(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && processCheckOut()}
              className={`w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-colors`}
            />
          </div>
          <button
            onClick={processCheckOut}
            disabled={loadingOut || !checkOutCardNo}
            className="w-full bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-semibold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-40"
          >
            {loadingOut ? 'Processing...' : 'Process Check-Out'}
          </button>
        </div>

        {checkOutResult && (
          <div className={`px-4 py-3 border rounded-lg text-xs font-medium ${checkOutResult.accessGranted ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
            {checkOutResult.message}
          </div>
        )}
      </div>
    </div>
  );
}
