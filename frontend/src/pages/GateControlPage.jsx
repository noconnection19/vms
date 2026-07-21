import React, { useState } from 'react';

const formatTime = (val) => {
  if (!val) return '—';
  // DB may return timestamps without timezone suffix (e.g. "2026-07-21 04:36:11").
  // Browser interprets those as local time instead of UTC — append Z to force UTC,
  // then toLocaleTimeString() correctly converts to the user's local timezone.
  const str = String(val);
  const utcStr = /[Zz]|[+-]\d{2}:\d{2}$/.test(str)
    ? str
    : str.replace(' ', 'T') + 'Z';
  const d = new Date(utcStr);
  return isNaN(d.getTime()) ? val : d.toLocaleTimeString();
};

const getField = (obj, ...keys) => {
  for (const k of keys) if (obj?.[k] != null) return obj[k];
  return null;
};
import {
  SignIn,
  SignOut,
  Upload,
  IdentificationCard,
  CircleNotch,
  CheckCircle,
  XCircle,
  Barcode,
  Keyboard,
  CaretDown,
  CaretUp,
  ArrowClockwise,
  ShieldCheck,
} from '@phosphor-icons/react';

import { API_BASE_URL as API_BASE } from '../config';
import { useToast } from '../context/ToastContext';

export default function GateControlPage() {
  const { toast } = useToast();

  // Check-In State
  const [checkInCardNo, setCheckInCardNo] = useState('');
  const [checkInScanData, setCheckInScanData] = useState(null);
  const [checkInPreviewUrl, setCheckInPreviewUrl] = useState(null);
  const [scanningIn, setScanningIn] = useState(false);
  const [loadingIn, setLoadingIn] = useState(false);
  const [checkInResult, setCheckInResult] = useState(null);
  const [showManualIn, setShowManualIn] = useState(false);

  // Check-Out State
  const [checkOutCardNo, setCheckOutCardNo] = useState('');
  const [checkOutScanData, setCheckOutScanData] = useState(null);
  const [checkOutPreviewUrl, setCheckOutPreviewUrl] = useState(null);
  const [scanningOut, setScanningOut] = useState(false);
  const [loadingOut, setLoadingOut] = useState(false);
  const [checkOutResult, setCheckOutResult] = useState(null);
  const [showManualOut, setShowManualOut] = useState(false);

  // Handle card scan for Check-In
  const handleCheckInCardScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCheckInPreviewUrl(URL.createObjectURL(file));
    setScanningIn(true);
    setCheckInResult(null);
    setShowManualIn(false);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('cardType', 'KTP');

    try {
      const res = await fetch(`${API_BASE}/visitor/scan-ocr`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.ocrResult) {
        const ocr = data.ocrResult;
        setCheckInScanData(ocr);
        if (ocr.card_no) {
          setCheckInCardNo(ocr.card_no);
          toast.success(`Card detected: ${ocr.card_no}`, 'Card Detected');
        } else {
          toast.warning('Card number not detected. Please enter it manually.', 'Check Card');
          setShowManualIn(true);
        }
      } else {
        toast.warning('Could not read the card. Please enter the number manually.', 'Scan Failed');
        setShowManualIn(true);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to process the card scan.', 'Connection Error');
      setShowManualIn(true);
    } finally {
      setScanningIn(false);
    }
  };

  // Handle card scan for Check-Out
  const handleCheckOutCardScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCheckOutPreviewUrl(URL.createObjectURL(file));
    setScanningOut(true);
    setCheckOutResult(null);
    setShowManualOut(false);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('cardType', 'KTP');

    try {
      const res = await fetch(`${API_BASE}/visitor/scan-ocr`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.ocrResult) {
        const ocr = data.ocrResult;
        setCheckOutScanData(ocr);
        if (ocr.card_no) {
          setCheckOutCardNo(ocr.card_no);
          toast.success(`Card detected: ${ocr.card_no}`, 'Card Detected');
        } else {
          toast.warning('Card number not detected. Please enter it manually.', 'Check Card');
          setShowManualOut(true);
        }
      } else {
        toast.warning('Could not read the card. Please enter the number manually.', 'Scan Failed');
        setShowManualOut(true);
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to process the card scan.', 'Connection Error');
      setShowManualOut(true);
    } finally {
      setScanningOut(false);
    }
  };

  const processCheckIn = async () => {
    if (!checkInCardNo) {
      toast.error('Please scan a card or enter a card number first.');
      return;
    }
    setLoadingIn(true);
    try {
      const res = await fetch(`${API_BASE}/gate/check-in`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNo: checkInCardNo }),
      });
      const data = await res.json();
      setCheckInResult(data);
      if (data.accessGranted) {
        toast.success(data.message || 'Check-In successful! Gate opened.', 'Check-In');
      } else {
        toast.error(data.message || 'Access denied.', 'Check-In');
      }
    } catch {
      setCheckInResult({ accessGranted: false, message: 'Failed to connect to gate service.' });
      toast.error('Failed to connect to gate service.');
    } finally {
      setLoadingIn(false);
    }
  };

  const processCheckOut = async () => {
    if (!checkOutCardNo) {
      toast.error('Please scan a card or enter a card number first.');
      return;
    }
    setLoadingOut(true);
    try {
      const res = await fetch(`${API_BASE}/gate/check-out`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardNo: checkOutCardNo }),
      });
      const data = await res.json();
      setCheckOutResult(data);
      if (data.accessGranted) {
        toast.success(data.message || 'Check-Out successful! Gate opened.', 'Check-Out');
      } else {
        toast.error(data.message || 'Access denied.', 'Check-Out');
      }
    } catch {
      setCheckOutResult({ accessGranted: false, message: 'Failed to connect to gate service.' });
      toast.error('Failed to connect to gate service.');
    } finally {
      setLoadingOut(false);
    }
  };

  const resetCheckIn = () => {
    setCheckInCardNo('');
    setCheckInScanData(null);
    setCheckInPreviewUrl(null);
    setCheckInResult(null);
    setShowManualIn(false);
  };

  const resetCheckOut = () => {
    setCheckOutCardNo('');
    setCheckOutScanData(null);
    setCheckOutPreviewUrl(null);
    setCheckOutResult(null);
    setShowManualOut(false);
  };

  const inputClass =
    'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 outline-none transition-colors';
  const labelClass = 'block text-xs font-medium text-slate-400 mb-1.5';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <IdentificationCard size={24} weight="duotone" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Gate Control</h1>
            <p className="text-xs text-slate-400">Upload visitor's ID card to process check-in &amp; check-out</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg">
          <ShieldCheck size={14} className="text-emerald-400" />
          <span>Gate System Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 lg:items-start gap-6">
        {/* ===== Entrance Gate (Check-In) ===== */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 flex flex-col">
          <div className="space-y-4 flex-1">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                  <SignIn size={20} className="text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Entrance Gate</h3>
                  <p className="text-[11px] text-slate-400">Scan visitor's card to check in</p>
                </div>
              </div>
              {(checkInPreviewUrl || checkInCardNo) && (
                <button
                  onClick={resetCheckIn}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-md transition-colors"
                >
                  <ArrowClockwise size={12} /> Reset
                </button>
              )}
            </div>

            {/* Card Upload Area */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                <Upload size={14} /> Upload ID Card Photo
              </label>

              {checkInPreviewUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                  <img
                    src={checkInPreviewUrl}
                    alt="ID Card Preview"
                    className="w-full max-h-44 object-contain py-2 bg-slate-950"
                  />
                  <label
                    htmlFor="checkInFileInput"
                    className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors backdrop-blur-sm"
                  >
                    <Barcode size={13} /> Re-upload Card
                  </label>
                  <input
                    type="file"
                    onChange={handleCheckInCardScan}
                    accept="image/*"
                    className="hidden"
                    id="checkInFileInput"
                  />
                  {scanningIn && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm gap-2">
                      <CircleNotch size={26} className="animate-spin text-emerald-400" />
                      <span className="text-xs text-emerald-300 font-semibold">Reading card information...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 rounded-xl p-5 text-center bg-slate-950/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center mx-auto mb-2 text-emerald-400">
                    <Upload size={20} />
                  </div>
                  <p className="text-xs text-slate-300 font-medium mb-1">Upload visitor's ID card photo</p>
                  <p className="text-[11px] text-slate-500 mb-3">The system will automatically read the card number</p>
                  <input
                    type="file"
                    onChange={handleCheckInCardScan}
                    accept="image/*"
                    className="hidden"
                    id="checkInFileInput"
                  />
                  <label
                    htmlFor="checkInFileInput"
                    className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-lg cursor-pointer text-xs transition-colors shadow-sm"
                  >
                    <Barcode size={15} /> Select Card Photo
                  </label>
                </div>
              )}
            </div>

            {/* Detected Card Info */}
            {checkInScanData && checkInCardNo && (
              <div className="p-3 bg-slate-950 border border-emerald-500/30 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Card Information:</span>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                    DETECTED
                  </span>
                </div>
                <div className="flex items-center justify-between text-white font-mono font-bold">
                  <span className="text-slate-400">Card No.</span>
                  <span className="text-emerald-400">{checkInCardNo}</span>
                </div>
                {checkInScanData.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Name</span>
                    <span className="text-slate-200 font-medium">{checkInScanData.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Manual Entry (Optional) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowManualIn((v) => !v)}
                className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-emerald-400 font-medium transition-colors py-1"
              >
                <span className="flex items-center gap-1.5">
                  <Keyboard size={13} />
                  Enter card number manually
                  <span className="text-slate-600 font-normal">(optional)</span>
                </span>
                {showManualIn ? <CaretUp size={12} /> : <CaretDown size={12} />}
              </button>

              {showManualIn && (
                <div className="mt-2 space-y-1.5">
                  <input
                    type="text"
                    placeholder="Enter or scan card number..."
                    value={checkInCardNo}
                    onChange={(e) => setCheckInCardNo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && processCheckIn()}
                    className={inputClass}
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500">
                    Auto-filled from card scan. You can edit if needed.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={processCheckIn}
            disabled={loadingIn || scanningIn || !checkInCardNo}
            className="w-full bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-slate-950 font-bold py-2.5 rounded-lg transition-all text-sm disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/10"
          >
            {loadingIn ? (
              <>
                <CircleNotch size={18} className="animate-spin" /> Processing...
              </>
            ) : (
              <>
                <SignIn size={18} weight="bold" /> Confirm Check-In
              </>
            )}
          </button>

          {/* Gate Result */}
          {checkInResult && (
            <div
              className={`p-4 border rounded-xl space-y-1.5 ${
                checkInResult.accessGranted
                  ? 'bg-emerald-500/10 border-emerald-500/40'
                  : 'bg-rose-500/10 border-rose-500/40'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {checkInResult.accessGranted ? (
                  <CheckCircle size={20} weight="duotone" className="text-emerald-400" />
                ) : (
                  <XCircle size={20} weight="duotone" className="text-rose-400" />
                )}
                <span className={checkInResult.accessGranted ? 'text-emerald-300' : 'text-rose-300'}>
                  {checkInResult.accessGranted ? 'Gate Opened' : 'Access Denied'}
                </span>
              </div>
              <p className="text-xs text-slate-300">{checkInResult.message}</p>
              {checkInResult.visit && (
                <div className="text-[11px] font-mono pt-1.5 text-slate-400 border-t border-slate-800/60 flex justify-between gap-4">
                  <span className="truncate">ID: {getField(checkInResult.visit, 'VISIT_ID', 'visit_id', 'visitId') ?? '—'}</span>
                  <span className="shrink-0">{formatTime(getField(checkInResult.visit, 'CHECK_IN', 'check_in', 'checkIn'))}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ===== Exit Gate (Check-Out) ===== */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5 flex flex-col">
          <div className="space-y-4 flex-1">
            {/* Panel Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <SignOut size={20} className="text-amber-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Exit Gate</h3>
                  <p className="text-[11px] text-slate-400">Scan visitor's card to check out</p>
                </div>
              </div>
              {(checkOutPreviewUrl || checkOutCardNo) && (
                <button
                  onClick={resetCheckOut}
                  className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1 bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded-md transition-colors"
                >
                  <ArrowClockwise size={12} /> Reset
                </button>
              )}
            </div>

            {/* Card Upload Area */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                <Upload size={14} /> Upload ID Card Photo
              </label>

              {checkOutPreviewUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
                  <img
                    src={checkOutPreviewUrl}
                    alt="ID Card Preview"
                    className="w-full max-h-44 object-contain py-2 bg-slate-950"
                  />
                  <label
                    htmlFor="checkOutFileInput"
                    className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors backdrop-blur-sm"
                  >
                    <Barcode size={13} /> Re-upload Card
                  </label>
                  <input
                    type="file"
                    onChange={handleCheckOutCardScan}
                    accept="image/*"
                    className="hidden"
                    id="checkOutFileInput"
                  />
                  {scanningOut && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-sm gap-2">
                      <CircleNotch size={26} className="animate-spin text-amber-400" />
                      <span className="text-xs text-amber-300 font-semibold">Reading card information...</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="border-2 border-dashed border-slate-800 hover:border-amber-500/50 rounded-xl p-5 text-center bg-slate-950/50 transition-colors">
                  <div className="w-10 h-10 rounded-lg bg-slate-800/80 flex items-center justify-center mx-auto mb-2 text-amber-400">
                    <Upload size={20} />
                  </div>
                  <p className="text-xs text-slate-300 font-medium mb-1">Upload visitor's ID card photo</p>
                  <p className="text-[11px] text-slate-500 mb-3">The system will automatically read the card number</p>
                  <input
                    type="file"
                    onChange={handleCheckOutCardScan}
                    accept="image/*"
                    className="hidden"
                    id="checkOutFileInput"
                  />
                  <label
                    htmlFor="checkOutFileInput"
                    className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-2 rounded-lg cursor-pointer text-xs transition-colors shadow-sm"
                  >
                    <Barcode size={15} /> Select Card Photo
                  </label>
                </div>
              )}
            </div>

            {/* Detected Card Info */}
            {checkOutScanData && checkOutCardNo && (
              <div className="p-3 bg-slate-950 border border-amber-500/30 rounded-xl space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium">Card Information:</span>
                  <span className="text-[10px] text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded">
                    DETECTED
                  </span>
                </div>
                <div className="flex items-center justify-between text-white font-mono font-bold">
                  <span className="text-slate-400">Card No.</span>
                  <span className="text-amber-400">{checkOutCardNo}</span>
                </div>
                {checkOutScanData.name && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Name</span>
                    <span className="text-slate-200 font-medium">{checkOutScanData.name}</span>
                  </div>
                )}
              </div>
            )}

            {/* Manual Entry (Optional) */}
            <div className="pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setShowManualOut((v) => !v)}
                className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-amber-400 font-medium transition-colors py-1"
              >
                <span className="flex items-center gap-1.5">
                  <Keyboard size={13} />
                  Enter card number manually
                  <span className="text-slate-600 font-normal">(optional)</span>
                </span>
                {showManualOut ? <CaretUp size={12} /> : <CaretDown size={12} />}
              </button>

              {showManualOut && (
                <div className="mt-2 space-y-1.5">
                  <input
                    type="text"
                    placeholder="Enter or scan card number..."
                    value={checkOutCardNo}
                    onChange={(e) => setCheckOutCardNo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && processCheckOut()}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-amber-500 focus:ring-1 focus:ring-amber-500/40 outline-none transition-colors"
                    autoFocus
                  />
                  <p className="text-[11px] text-slate-500">
                    Auto-filled from card scan. You can edit if needed.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={processCheckOut}
            disabled={loadingOut || scanningOut || !checkOutCardNo}
            className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-slate-950 font-bold py-2.5 rounded-lg transition-all text-sm disabled:opacity-40 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/10"
          >
            {loadingOut ? (
              <>
                <CircleNotch size={18} className="animate-spin" /> Processing...
              </>
            ) : (
              <>
                <SignOut size={18} weight="bold" /> Confirm Check-Out
              </>
            )}
          </button>

          {/* Gate Result */}
          {checkOutResult && (
            <div
              className={`p-4 border rounded-xl space-y-1.5 ${
                checkOutResult.accessGranted
                  ? 'bg-emerald-500/10 border-emerald-500/40'
                  : 'bg-rose-500/10 border-rose-500/40'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {checkOutResult.accessGranted ? (
                  <CheckCircle size={20} weight="duotone" className="text-emerald-400" />
                ) : (
                  <XCircle size={20} weight="duotone" className="text-rose-400" />
                )}
                <span className={checkOutResult.accessGranted ? 'text-emerald-300' : 'text-rose-300'}>
                  {checkOutResult.accessGranted ? 'Gate Opened' : 'Access Denied'}
                </span>
              </div>
              <p className="text-xs text-slate-300">{checkOutResult.message}</p>
              {checkOutResult.visit && (
                <div className="text-[11px] font-mono pt-1.5 text-slate-400 border-t border-slate-800/60 flex justify-between gap-4">
                  <span className="truncate">ID: {getField(checkOutResult.visit, 'VISIT_ID', 'visit_id', 'visitId') ?? '—'}</span>
                  <span className="shrink-0">{formatTime(getField(checkOutResult.visit, 'CHECK_OUT', 'check_out', 'checkOut'))}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
