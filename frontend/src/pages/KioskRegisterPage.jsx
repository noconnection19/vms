import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../context/ToastContext';
import {
  Phone,
  IdentificationCard,
  Camera,
  CheckCircle,
  Barcode,
  Upload,
  ArrowLeft,
  ArrowRight,
  CircleNotch,
} from '@phosphor-icons/react';

const STEPS = ['Phone Check', 'Card Type', 'OCR Scan', 'Face Photo', 'Completed'];
import { API_BASE_URL as API_BASE } from '../config';

const parseOcrDate = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    const [d, m, y] = parts;
    if (d.length === 4) return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
    if (y.length === 4) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return str;
};

export default function KioskRegisterPage({ onGoToAdmin }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [isReturning, setIsReturning] = useState(false);
  const [userCards, setUserCards] = useState([]);
  const [form, setForm] = useState({
    phoneNo: '',
    userType: 'REGULAR',
    cardType: 'KTP',
    cardNo: '',
    name: '',
    gender: 'L',
    placeOfBirth: '',
    birthday: '',
    address: '',
    cardAttachmentId: null,
    photoAttachmentId: null,
  });
  const [ocrDone, setOcrDone] = useState(false);
  const [cardPreviewUrl, setCardPreviewUrl] = useState(null);
  const [facePreviewUrl, setFacePreviewUrl] = useState(null);
  const [faceQualityMessage, setFaceQualityMessage] = useState('');
  const [faceValid, setFaceValid] = useState(true);

  const checkPhone = async () => {
    if (!form.phoneNo) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/visitor/check-phone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNo: form.phoneNo }),
      });
      const data = await res.json();
      if (data.isRegistered && data.data) {
        const d = data.data;
        setIsReturning(true);
        const cardsList = d.cards || [];
        setUserCards(cardsList);

        const firstCard = cardsList[0];
        const cardAttId = firstCard?.CARD_ATTACHMENT_ID || firstCard?.card_attachment_id || null;
        const photoAttId = d.PHOTO_ATTACHMENT_ID || d.photo_attachment_id || null;

        setForm((prev) => ({
          ...prev,
          name: d.NAME || d.name || '',
          gender: d.GENDER || d.gender || 'L',
          placeOfBirth: d.PLACE_OF_BIRTH || d.place_of_birth || '',
          birthday: parseOcrDate(d.BIRTHDAY || d.birthday || ''),
          address: d.ADDRESS || d.address || '',
          cardNo: firstCard?.CARD_NO || firstCard?.card_no || prev.cardNo,
          cardType: firstCard?.CARD_TYPE || firstCard?.card_type || prev.cardType,
          photoAttachmentId: photoAttId,
          cardAttachmentId: cardAttId,
        }));

        if (cardAttId) {
          setCardPreviewUrl(`${API_BASE}/visitor/attachment/${cardAttId}`);
        } else {
          setCardPreviewUrl(null);
        }
        if (photoAttId) {
          setFacePreviewUrl(`${API_BASE}/visitor/attachment/${photoAttId}`);
        } else {
          setFacePreviewUrl(null);
        }

        setOcrDone(true);
        setStep(3); // Loncat langsung ke Stage 3 (OCR Scan / Data Verification)
      } else {
        setIsReturning(false);
        setUserCards([]);
        setStep(2);
      }
    } catch {
      setIsReturning(false);
      setUserCards([]);
      setStep(2);
    } finally {
      setLoading(false);
    }
  };

  const onCardFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Show local preview immediately before API call
    setCardPreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('cardType', form.cardType);
    try {
      const res = await fetch(`${API_BASE}/visitor/scan-ocr`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.attachmentId) setForm((prev) => ({ ...prev, cardAttachmentId: data.attachmentId }));
      if (data.ocrResult) {
        // OCR service returns snake_case keys from Python
        const ocr = data.ocrResult;
        setForm((prev) => ({
          ...prev,
          cardNo: ocr.card_no || prev.cardNo,
          name: ocr.name || prev.name,
          gender: ocr.gender || prev.gender,
          placeOfBirth: ocr.place_of_birth || prev.placeOfBirth,
          birthday: parseOcrDate(ocr.birthday) || prev.birthday,
          address: ocr.address || prev.address,
        }));
        setOcrDone(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const onFaceFileSelected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Show local preview immediately before API call
    setFacePreviewUrl(URL.createObjectURL(file));
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE}/visitor/upload-photo`, { method: 'POST', body: formData });
      const data = await res.json();
      setForm((prev) => ({ ...prev, photoAttachmentId: data.attachmentId }));
      setFaceValid(data.isValid);
      setFaceQualityMessage(data.message);
    } catch {
      setFaceValid(true);
      setFaceQualityMessage('Face photo uploaded successfully.');
    } finally {
      setLoading(false);
    }
  };

  const submitRegistration = async () => {
    setLoading(true);
    try {
      const regRes = await fetch(`${API_BASE}/visitor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const regData = await regRes.json();
      if (!regRes.ok) {
        toast.error(regData.message || 'Failed to submit registration.');
        return;
      }

      toast.success('Registration submitted successfully!', 'Registration Success');
      setStep(5);
    } catch (err) {
      toast.error('Failed to submit registration: ' + err.message);
    } finally {
      setLoading(false);
    }
  };


  const resetForm = () => {
    setStep(1);
    setIsReturning(false);
    setUserCards([]);
    setForm({ phoneNo: '', cardType: 'KTP', cardNo: '', name: '', gender: 'L', placeOfBirth: '', address: '', cardAttachmentId: null, photoAttachmentId: null });
    setOcrDone(false);
    setCardPreviewUrl(null);
    setFacePreviewUrl(null);
    setFaceQualityMessage('');
    setFaceValid(true);
  };

  const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 outline-none transition-colors";
  const labelClass = "block text-xs font-medium text-slate-400 mb-1.5";

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Standalone Kiosk Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl px-5 py-3.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-xs">
            VMS
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-none">Self-Register Terminal Kiosk</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Self-Service Visitor Registration & Access Pass</p>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center justify-between">
          {STEPS.map((stepName, idx) => {
            const stepNum = idx + 1;
            const isDone = step > stepNum;
            const isCurrent = step === stepNum;
            return (
              <div key={stepName} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${isCurrent
                      ? 'bg-emerald-500 text-slate-950'
                      : isDone
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-slate-800 text-slate-500 border border-slate-700'
                      }`}
                  >
                    {isDone ? <CheckCircle size={14} weight="bold" /> : stepNum}
                  </div>
                  <span className={`text-xs font-medium hidden md:block ${isCurrent ? 'text-white' : isDone ? 'text-slate-400' : 'text-slate-600'}`}>
                    {stepName}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 ${step > stepNum ? 'bg-emerald-500/40' : 'bg-slate-800'}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step 1: Phone */}
      {step === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-5 max-w-sm mx-auto">
          <div className="flex justify-center">
            <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center">
              <Phone size={22} className="text-emerald-400" />
            </div>
          </div>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold text-white">Phone Verification</h2>
            <p className="text-xs text-slate-400">System verifies previous registration history.</p>
          </div>
          <div>
            <label className={labelClass}>Phone Number</label>
            <input
              type="text"
              placeholder="08123456789"
              value={form.phoneNo}
              onChange={(e) => setForm({ ...form, phoneNo: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && checkPhone()}
              className={inputClass}
            />
          </div>
          {/* Returning visitor banner */}
          {isReturning && form.name && (
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <CheckCircle size={16} weight="duotone" className="text-emerald-400 shrink-0" />
              <div>
                <div className="text-xs font-semibold text-emerald-300">Visitor already registered</div>
                <div className="text-[11px] text-emerald-400/70">{form.name} &middot; {form.cardType}</div>
              </div>
            </div>
          )}
          <button
            onClick={checkPhone}
            disabled={loading || !form.phoneNo}
            className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-40 text-sm"
          >
            {loading ? 'Verifying...' : 'Next'}
            {!loading && <ArrowRight size={15} weight="bold" />}
          </button>
        </div>
      )}

      {/* Step 2: Card Type */}
      {step === 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-5 max-w-sm mx-auto">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold text-white">Identity Card Type</h2>
            <p className="text-xs text-slate-400">Select card type to scan with OCR.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {['KTP', 'SIM', 'NPWP', 'KTA'].map((type) => (
              <button
                key={type}
                onClick={() => { setForm({ ...form, cardType: type }); setStep(3); }}
                className="bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 p-4 rounded-lg text-center space-y-2 transition-colors group"
              >
                <div className="w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center mx-auto group-hover:bg-emerald-500/10 transition-colors">
                  <IdentificationCard size={18} className="text-emerald-400" />
                </div>
                <div className="font-semibold text-white text-sm">{type}</div>
              </button>
            ))}
          </div>
          <button onClick={resetForm} className="w-full flex items-center justify-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors">
            <ArrowLeft size={13} /> Back
          </button>
        </div>
      )}

      {/* Step 3: OCR Scan */}
      {step === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-5">
          {isReturning && (
            <div className="flex items-center justify-between p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
              <div className="flex items-center gap-3">
                <CheckCircle size={22} weight="duotone" className="text-emerald-400 shrink-0" />
                <div>
                  <div className="text-xs font-bold text-emerald-300">Welcome Back, {form.name}!</div>
                  <div className="text-[11px] text-emerald-400/80">Registered visitor data loaded. Verify details or scan a new card below.</div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">Scan {form.cardType} Card</h2>
              <p className="text-xs text-slate-400 mt-0.5">Upload card photo for OCR processing or verify details.</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md text-xs font-medium">{form.cardType}</span>
          </div>

          {userCards.length > 0 && (
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Registered Access Cards</label>
                <button
                  type="button"
                  onClick={() => {
                    setForm((prev) => ({ ...prev, cardNo: '', cardType: 'KTP', cardAttachmentId: null }));
                    setCardPreviewUrl(null);
                  }}
                  className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors"
                >
                  + Add New Card
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {userCards.map((c, idx) => {
                  const cNo = c.CARD_NO || c.card_no;
                  const cType = c.CARD_TYPE || c.card_type;
                  const isSelected = form.cardNo === cNo;
                  return (
                    <button
                      key={cNo || idx}
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, cardNo: cNo, cardType: cType }));
                        const attId = c.CARD_ATTACHMENT_ID || c.card_attachment_id;
                        if (attId) {
                          setCardPreviewUrl(`${API_BASE}/visitor/attachment/${attId}`);
                        }
                      }}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                        isSelected
                          ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <span className="px-1.5 py-0.5 bg-slate-950 rounded text-[10px] font-bold text-emerald-400">{cType}</span>
                      <span>{cNo}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Upload Box + Preview */}
          {cardPreviewUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
              <img
                src={cardPreviewUrl}
                alt="Preview kartu identitas"
                className="w-full max-h-52 object-contain"
              />
              <label
                htmlFor="cardInput"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors backdrop-blur-sm"
              >
                <Barcode size={13} /> Change / Scan New Card
              </label>
              <input type="file" onChange={onCardFileSelected} accept="image/*" className="hidden" id="cardInput" />
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs gap-2">
                  <CircleNotch size={24} className="animate-spin text-emerald-400" />
                  <span className="text-xs text-emerald-300 font-semibold">Processing & Scanning OCR...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 text-center bg-slate-950/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Upload size={18} className="text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400 mb-3">Scan new identity card image file</p>
              <input type="file" onChange={onCardFileSelected} accept="image/*" className="hidden" id="cardInput" />
              <label htmlFor="cardInput" className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-4 py-2 rounded-lg cursor-pointer transition-colors">
                <Barcode size={14} /> Scan New Card
              </label>
            </div>
          )}

          {/* OCR Result Form */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Card & Visitor Details</span>
              {ocrDone && <span className="text-xs text-emerald-400 font-medium">Extracted successfully</span>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Card Type & ID Number</label>
                <div className="flex gap-2">
                  <select
                    value={form.cardType}
                    onChange={(e) => setForm({ ...form, cardType: e.target.value })}
                    className="w-28 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2.5 text-xs text-slate-200 outline-none focus:border-emerald-500"
                  >
                    <option value="KTP">KTP</option>
                    <option value="SIM">SIM</option>
                    <option value="PASSPORT">PASSPORT</option>
                    <option value="RFID">RFID</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Enter card number..."
                    value={form.cardNo}
                    onChange={(e) => setForm({ ...form, cardNo: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label className={labelClass}>Full Name</label>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Gender</label>
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className={inputClass}>
                  <option value="L">Male</option>
                  <option value="P">Female</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Place of Birth</label>
                <input type="text" value={form.placeOfBirth} onChange={(e) => setForm({ ...form, placeOfBirth: e.target.value })} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Date of Birth</label>
                <input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} className={inputClass} />
              </div>
              <div className="md:col-span-2">
                <label className={labelClass}>Address</label>
                <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className={inputClass} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button onClick={resetForm} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors">
              <ArrowLeft size={13} /> Back
            </button>
            <button
              onClick={() => setStep(4)}
              disabled={!form.cardNo || !form.name}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-40 text-sm"
            >
              Next <ArrowRight size={15} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Photo */}
      {step === 4 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 space-y-5 max-w-sm mx-auto">
          <div className="text-center space-y-1">
            <h2 className="text-lg font-semibold text-white">Face Photo</h2>
            <p className="text-xs text-slate-400">Ensure face is clearly visible without obstructions.</p>
          </div>

          {/* Face upload + preview */}
          {facePreviewUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
              <img
                src={facePreviewUrl}
                alt="Preview foto wajah"
                className="w-full max-h-52 object-contain"
              />
              <label
                htmlFor="faceInput"
                className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-medium px-3 py-1.5 rounded-lg cursor-pointer transition-colors backdrop-blur-sm"
              >
                <Camera size={13} /> Change Photo
              </label>
              <input type="file" onChange={onFaceFileSelected} accept="image/*" className="hidden" id="faceInput" />
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs gap-2">
                  <CircleNotch size={24} className="animate-spin text-emerald-400" />
                  <span className="text-xs text-emerald-300 font-semibold">Analyzing Face Quality...</span>
                </div>
              )}
            </div>
          ) : (
            <div className="border border-dashed border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 text-center bg-slate-950/50 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center mx-auto mb-3">
                <Camera size={18} className="text-emerald-400" />
              </div>
              <p className="text-xs text-slate-400 mb-3">Upload visitor selfie photo</p>
              <input type="file" onChange={onFaceFileSelected} accept="image/*" className="hidden" id="faceInput" />
              <label htmlFor="faceInput" className="inline-flex items-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-4 py-2 rounded-lg cursor-pointer text-xs transition-colors">
                <Upload size={14} /> Choose Photo
              </label>
            </div>
          )}

          {faceQualityMessage && (
            <div className={`px-4 py-3 border rounded-lg text-xs font-medium ${faceValid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'}`}>
              {faceQualityMessage}
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(3)} className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs font-medium transition-colors">
              <ArrowLeft size={13} /> Back
            </button>
            <button
              onClick={submitRegistration}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-40 text-sm"
            >
              {loading ? 'Processing...' : 'Submit Registration'}
              {!loading && <CheckCircle size={15} weight="bold" />}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Registration Complete */}
      {step === 5 && (
        <div className="bg-slate-900 border border-emerald-500/40 rounded-xl p-10 max-w-sm mx-auto text-center space-y-5">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle size={32} weight="duotone" className="text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-emerald-400">Registration Complete</h2>
            <p className="text-sm text-slate-400 mt-1">Visitor registration successful.</p>
          </div>
          <p className="text-xs text-slate-400">
            Welcome <strong className="text-white font-medium">{form.name}</strong>. Please scan your card at the gate to check in.
          </p>
          <button
            onClick={resetForm}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-colors"
          >
            Next Visitor
          </button>
        </div>
      )}
    </div>
  );
}
