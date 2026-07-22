import React, { useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext';
import {
  MagnifyingGlass,
  ArrowClockwise,
  Plus,
  Eye,
  PencilSimple,
  Trash,
  X,
  Upload,
  User,
  CheckCircle,
  IdentificationCard,
  Phone,
  Camera,
  WarningCircle,
  CircleNotch,
  FileText,
} from '@phosphor-icons/react';

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

export default function VisitorsPage() {
  const { toast, confirm } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [visitors, setVisitors] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVisitor, setSelectedVisitor] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Employee Add Form State
  const [singleForm, setSingleForm] = useState({
    phoneNo: '',
    name: '',
    gender: 'L',
    placeOfBirth: '',
    birthday: '',
    address: '',
    userType: 'EMPLOYEE',
    photoAttachmentId: null,
    mcuAttachmentId: null,
    mcuValidFrom: '',
    mcuValidTo: '',
    cards: [
      { cardType: 'KTP', cardNo: '', cardAttachmentId: null, previewUrl: null }
    ],
  });

  const [facePreviewUrl, setFacePreviewUrl] = useState(null);
  const [cardUploadingIdx, setCardUploadingIdx] = useState(null);
  const [faceLoading, setFaceLoading] = useState(false);
  const [mcuLoading, setMcuLoading] = useState(false);
  const [mcuFileName, setMcuFileName] = useState('');
  const [extraCardUploadingIdx, setExtraCardUploadingIdx] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formMsg, setFormMsg] = useState({ type: '', text: '' });

  // Edit Form State
  const [editForm, setEditForm] = useState({
    phoneNo: '',
    name: '',
    gender: 'L',
    placeOfBirth: '',
    birthday: '',
    address: '',
    cardType: 'KTP',
    cardNo: '',
    userType: 'EMPLOYEE',
    mcuAttachmentId: null,
    mcuValidFrom: '',
    mcuValidTo: '',
  });
  const [editMcuFileName, setEditMcuFileName] = useState('');
  const [editMcuLoading, setEditMcuLoading] = useState(false);

  const fetchVisitors = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/visitor/all`);
      const data = await res.json();
      if (data.data) setVisitors(data.data);
    } catch (err) {
      console.error('Error fetching directory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitors();
  }, []);

  const openDetail = async (visitor) => {
    setSelectedVisitor(visitor);
    setShowDetailModal(true);
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_BASE}/visitor/detail/${visitor.phoneNo}`);
      const data = await res.json();
      setDetailData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setDetailLoading(false);
    }
  };

  const openEdit = (visitor) => {
    setSelectedVisitor(visitor);
    const primaryCard = visitor.cards?.[0];
    const rawType = visitor.userType || visitor.user_type || visitor.USER_TYPE || 'VISITOR';
    const initialUserType = (rawType === 'REGULAR' || rawType === 'VISITOR') ? 'VISITOR' : rawType;

    setEditForm({
      phoneNo: visitor.phoneNo || visitor.phone_no || visitor.PHONE_NO || '',
      name: visitor.name || visitor.NAME || '',
      gender: visitor.gender || visitor.GENDER || 'L',
      placeOfBirth: visitor.placeOfBirth || visitor.place_of_birth || visitor.PLACE_OF_BIRTH || '',
      birthday: parseOcrDate(visitor.birthday || visitor.BIRTHDAY || ''),
      address: visitor.address || visitor.ADDRESS || '',
      cardType: primaryCard?.card_type || primaryCard?.CARD_TYPE || 'KTP',
      cardNo: primaryCard?.card_no || primaryCard?.CARD_NO || '',
      cardAttachmentId: primaryCard?.card_attachment_id || primaryCard?.CARD_ATTACHMENT_ID || null,
      userType: initialUserType,
      mcuAttachmentId: visitor.mcuAttachmentId || visitor.mcu_attachment_id || visitor.MCU_ATTACHMENT_ID || null,
      mcuValidFrom: parseOcrDate(visitor.mcuValidFrom || visitor.mcu_valid_from || visitor.MCU_VALID_FROM || ''),
      mcuValidTo: parseOcrDate(visitor.mcuValidTo || visitor.mcu_valid_to || visitor.MCU_VALID_TO || ''),
      additionalCards: [],
    });
    setEditMcuFileName('');
    setShowEditModal(true);
  };

  const handleEditCardImageUpload = async (idx, file) => {
    if (!file) return;
    setExtraCardUploadingIdx(idx);
    const formData = new FormData();
    formData.append('file', file);
    const cardType = editForm.additionalCards[idx]?.cardType || 'KTP';
    formData.append('cardType', cardType);

    try {
      const res = await fetch(`${API_BASE}/visitor/scan-ocr`, { method: 'POST', body: formData });
      const data = await res.json();
      const updated = [...(editForm.additionalCards || [])];
      if (data.attachmentId) {
        updated[idx].cardAttachmentId = data.attachmentId;
      }
      if (data.ocrResult && data.ocrResult.card_no) {
        updated[idx].cardNo = data.ocrResult.card_no;
      }
      updated[idx].previewUrl = URL.createObjectURL(file);
      setEditForm((prev) => ({ ...prev, additionalCards: updated }));
      toast.success('Card image uploaded successfully.');
    } catch (err) {
      toast.error('Failed to upload card image: ' + err.message);
    } finally {
      setExtraCardUploadingIdx(null);
    }
  };

  const handleDelete = async (phoneNo, name) => {
    const isConfirmed = await confirm({
      title: 'Delete User Record',
      message: `Are you sure you want to delete ${name || phoneNo}? Associated card and visit history will be deleted.`,
      isDanger: true,
      confirmText: 'Yes, Delete',
      cancelText: 'Cancel',
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE}/visitor/delete/${phoneNo}`, { method: 'DELETE' });
      const data = await res.json();
      toast.success(data.message || 'Record deleted successfully.');
      fetchVisitors();
    } catch (err) {
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const handleDeleteCard = async (cardNo) => {
    const isConfirmed = await confirm({
      title: 'Delete Access Card',
      message: `Are you sure you want to delete card ${cardNo}?`,
      isDanger: true,
      confirmText: 'Yes, Delete Card',
      cancelText: 'Cancel',
    });

    if (!isConfirmed) return;

    try {
      const res = await fetch(`${API_BASE}/visitor/card/${cardNo}`, { method: 'DELETE' });
      const data = await res.json();
      toast.success(data.message || 'Card deleted successfully.');
      fetchVisitors();
      if (selectedVisitor) {
        setSelectedVisitor({
          ...selectedVisitor,
          cards: (selectedVisitor.cards || []).filter(c => (c.CARD_NO || c.card_no) !== cardNo)
        });
      }
    } catch (err) {
      toast.error('Failed to delete card: ' + err.message);
    }
  };

  // OCR Scan File Selection for cards in singleForm.cards
  const handleCardImageUpload = async (idx, file) => {
    if (!file) return;
    setCardUploadingIdx(idx);
    setFormMsg({ type: '', text: '' });

    const formData = new FormData();
    formData.append('file', file);
    const cardType = singleForm.cards[idx]?.cardType || 'KTP';
    formData.append('cardType', cardType);

    try {
      const res = await fetch(`${API_BASE}/visitor/scan-ocr`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      const updatedCards = [...singleForm.cards];

      if (data.attachmentId) {
        updatedCards[idx].cardAttachmentId = data.attachmentId;
      }

      if (data.ocrResult) {
        const ocr = data.ocrResult;
        if (ocr.card_no) updatedCards[idx].cardNo = ocr.card_no;
        if (idx === 0) {
          setSingleForm((prev) => ({
            ...prev,
            name: ocr.name || prev.name,
            gender: ocr.gender || prev.gender,
            placeOfBirth: ocr.place_of_birth || prev.placeOfBirth,
            birthday: parseOcrDate(ocr.birthday) || prev.birthday,
            address: ocr.address || prev.address,
          }));
          setFormMsg({ type: 'success', text: 'ID card OCR scan result extracted automatically!' });
          toast.info('ID card data extracted via OCR.', 'OCR Scan Complete');
        } else {
          toast.success('Card image uploaded and scanned successfully.');
        }
      }
      updatedCards[idx].previewUrl = URL.createObjectURL(file);
      setSingleForm((prev) => ({ ...prev, cards: updatedCards }));
    } catch (err) {
      setFormMsg({ type: 'error', text: 'Failed OCR scan: ' + err.message });
      toast.error('Failed to process OCR: ' + err.message);
    } finally {
      setCardUploadingIdx(null);
    }
  };

  // Face Photo Selection
  const handleFaceFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setFacePreviewUrl(URL.createObjectURL(file));
    setFaceLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/visitor/upload-photo`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.attachmentId) {
        setSingleForm((prev) => ({ ...prev, photoAttachmentId: data.attachmentId }));
        toast.success('Face photo uploaded and verified successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload face photo: ' + err.message);
    } finally {
      setFaceLoading(false);
    }
  };

  // MCU File Selection for Add Employee
  const handleMcuFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setMcuFileName(file.name);
    setMcuLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/visitor/upload-attachment`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.attachmentId) {
        setSingleForm((prev) => ({ ...prev, mcuAttachmentId: data.attachmentId }));
        toast.success('MCU document uploaded successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload MCU document: ' + err.message);
    } finally {
      setMcuLoading(false);
    }
  };

  // MCU File Selection for Edit Employee
  const handleEditMcuFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setEditMcuFileName(file.name);
    setEditMcuLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/visitor/upload-attachment`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.attachmentId) {
        setEditForm((prev) => ({ ...prev, mcuAttachmentId: data.attachmentId }));
        toast.success('MCU document uploaded successfully.');
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload MCU document: ' + err.message);
    } finally {
      setEditMcuLoading(false);
    }
  };

  // Employee Form Submit
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    const primaryCard = singleForm.cards[0];
    if (!singleForm.phoneNo || !primaryCard?.cardNo || !singleForm.name) {
      setFormMsg({ type: 'error', text: 'Phone number, Name, and Primary Card number are required.' });
      toast.warning('Phone number, Name, and Primary Card number are required.');
      return;
    }

    setSubmitLoading(true);
    setFormMsg({ type: '', text: '' });

    try {
      const validCards = singleForm.cards.filter((c) => c && c.cardNo && c.cardNo.trim() !== '');

      const res = await fetch(`${API_BASE}/visitor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNo: singleForm.phoneNo,
          name: singleForm.name,
          gender: singleForm.gender,
          placeOfBirth: singleForm.placeOfBirth,
          birthday: singleForm.birthday,
          address: singleForm.address,
          userType: 'EMPLOYEE',
          photoAttachmentId: singleForm.photoAttachmentId,
          mcuAttachmentId: singleForm.mcuAttachmentId,
          mcuValidFrom: singleForm.mcuValidFrom,
          mcuValidTo: singleForm.mcuValidTo,
          cards: validCards.map((c) => ({
            cardNo: c.cardNo.trim(),
            cardType: c.cardType || 'KTP',
            cardAttachmentId: c.cardAttachmentId || null,
          })),
        }),
      });
      const data = await res.json();

      if (res.ok) {
        toast.success(`Employee ${singleForm.name} registered successfully with ${validCards.length} card(s)!`, 'Registration Successful');
        setShowAddModal(false);
        resetAddForm();
        fetchVisitors();
      } else {
        setFormMsg({ type: 'error', text: data.message || 'Failed to save employee data.' });
        toast.error(data.message || 'Failed to save employee data.');
      }
    } catch (err) {
      setFormMsg({ type: 'error', text: 'Submit error: ' + err.message });
      toast.error('Failed to submit: ' + err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Edit Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSubmitLoading(true);
    try {
      const res = await fetch(`${API_BASE}/visitor/update/${editForm.phoneNo}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success('Employee data updated successfully.', 'Update Successful');
        setShowEditModal(false);
        fetchVisitors();
      } else {
        toast.error(data.message || 'Failed to update.');
      }
    } catch (err) {
      toast.error('Error updating: ' + err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const resetAddForm = () => {
    setSingleForm({
      phoneNo: '',
      name: '',
      gender: 'L',
      placeOfBirth: '',
      birthday: '',
      address: '',
      userType: 'EMPLOYEE',
      photoAttachmentId: null,
      mcuAttachmentId: null,
      mcuValidFrom: '',
      mcuValidTo: '',
      cards: [
        { cardType: 'KTP', cardNo: '', cardAttachmentId: null, previewUrl: null }
      ],
    });
    setMcuFileName('');
    setFacePreviewUrl(null);
    setFormMsg({ type: '', text: '' });
  };

  const filteredVisitors = visitors.filter((v) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      v.phoneNo?.toLowerCase().includes(term) ||
      v.name?.toLowerCase().includes(term) ||
      v.cards?.some((c) => (c.card_no || c.CARD_NO)?.toLowerCase().includes(term));

    const matchesType = filterType === 'ALL' || (v.userType || v.USER_TYPE || 'EMPLOYEE') === filterType;
    return matchesSearch && matchesType;
  });

  const inputClass = "w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/40 outline-none transition-colors";
  const labelClass = "block text-xs font-medium text-slate-300 mb-1";

  return (
    <div className="space-y-4">
      {/* Header Action Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">Master Directory</h2>
          <p className="text-xs text-slate-400 mt-0.5">Manage registered employees and visitors master database</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search name, phone, or ID number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-600 outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          {/* Type Filter */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 outline-none focus:border-emerald-500"
          >
            <option value="ALL">All Types</option>
            <option value="EMPLOYEE">Employee</option>
            <option value="VISITOR">Visitor</option>
          </select>

          {/* Refresh */}
          <button
            onClick={fetchVisitors}
            className="p-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Refresh Table"
          >
            <ArrowClockwise size={16} />
          </button>

          {/* Add Employee Button */}
          <button
            type="button"
            onClick={() => {
              resetAddForm();
              setShowAddModal(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5"
          >
            <Plus size={16} weight="bold" />
            <span>Add New Employee</span>
          </button>
        </div>
      </div>

      {/* Directory Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 font-semibold">
              <tr>
                <th className="px-4 py-3.5">Photo</th>
                <th className="px-4 py-3.5">Name & Type</th>
                <th className="px-4 py-3.5">Phone Number</th>
                <th className="px-4 py-3.5">Access Card / ID</th>
                <th className="px-4 py-3.5">Address</th>
                <th className="px-4 py-3.5 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredVisitors.length > 0 ? (
                filteredVisitors.map((v, index) => {
                  const photoId = v.photoAttachmentId || v.PHOTO_ATTACHMENT_ID;
                  const photoUrl = photoId ? `${API_BASE}/visitor/attachment/${photoId}` : null;

                  return (
                    <tr key={v.phoneNo || v.PHONE_NO || `visitor-${index}`} className="hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden flex items-center justify-center text-slate-500">
                          {photoUrl ? (
                            <img src={photoUrl} alt={v.name} className="w-full h-full object-cover" />
                          ) : (
                            <User size={20} />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-white text-sm">{v.name || <span className="text-slate-600">—</span>}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              (v.userType || v.USER_TYPE) === 'EMPLOYEE'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-sky-500/10 text-sky-400 border border-sky-500/30'
                            }`}
                          >
                            {v.userType || v.USER_TYPE || 'EMPLOYEE'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {v.gender === 'L' ? 'Male' : v.gender === 'P' ? 'Female' : ''}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-400 font-medium">{v.phoneNo}</td>
                      <td className="px-4 py-3">
                        {v.cards && v.cards.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {v.cards.map((card, cIdx) => (
                              <div key={cIdx} className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-2 py-0.5 rounded">
                                <span className="px-1 py-0.2 bg-slate-900 border border-slate-800 text-emerald-400 rounded text-[9px] font-mono font-bold">
                                  {card.card_type || card.CARD_TYPE}
                                </span>
                                <span className="font-mono text-white text-xs font-medium">
                                  {card.card_no || card.CARD_NO}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-400 truncate max-w-xs">{v.address || <span className="text-slate-600">—</span>}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => openDetail(v)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                            title="Profile Details"
                          >
                            <Eye size={16} />
                          </button>
                          <button
                            onClick={() => openEdit(v)}
                            className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                            title="Edit Record"
                          >
                            <PencilSimple size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(v.phoneNo, v.name)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                            title="Delete Record"
                          >
                            <Trash size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-4 py-12 text-center text-slate-500">
                    {loading ? 'Loading directory data...' : searchTerm ? 'No matching records found.' : 'No registered users yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ==================== MODAL 1: ADD NEW EMPLOYEE ==================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <div>
                <h3 className="text-base font-bold text-white">Add New Employee</h3>
                <p className="text-xs text-slate-400">Enter employee registration details, MCU info, and access cards</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {formMsg.text && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    formMsg.type === 'error'
                      ? 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  {formMsg.type === 'error' ? <WarningCircle size={18} /> : <CheckCircle size={18} />}
                  <span>{formMsg.text}</span>
                </div>
              )}

              <form onSubmit={handleSingleSubmit} className="space-y-4">
                <div>
                  <label className={labelClass}>Phone Number / WhatsApp *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 081234567890"
                    value={singleForm.phoneNo}
                    onChange={(e) => setSingleForm({ ...singleForm, phoneNo: e.target.value })}
                    className={inputClass}
                  />
                </div>

                {/* Unified Access Cards Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <IdentificationCard size={18} className="text-emerald-400" />
                      <span>Access Cards & ID Information</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setSingleForm((prev) => ({
                          ...prev,
                          cards: [
                            ...prev.cards,
                            { cardType: 'KTP', cardNo: '', cardAttachmentId: null, previewUrl: null },
                          ],
                        }))
                      }
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      <Plus size={14} /> Add Another Card
                    </button>
                  </div>

                  <div className="space-y-3">
                    {singleForm.cards.map((card, idx) => (
                      <div key={idx} className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-300 border-b border-slate-800/80 pb-2">
                          <span className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] text-emerald-400 font-bold">
                              {idx + 1}
                            </span>
                            {idx === 0 ? 'Primary Access Card *' : `Additional Access Card #${idx + 1}`}
                          </span>
                          {idx > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const updated = singleForm.cards.filter((_, i) => i !== idx);
                                setSingleForm({ ...singleForm, cards: updated });
                              }}
                              className="text-slate-400 hover:text-rose-400 p-1 rounded hover:bg-rose-500/10 transition-colors"
                              title="Remove Card"
                            >
                              <Trash size={14} />
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                          <div>
                            <label className={labelClass}>Card Type</label>
                            <select
                              value={card.cardType}
                              onChange={(e) => {
                                const updated = [...singleForm.cards];
                                updated[idx].cardType = e.target.value;
                                setSingleForm({ ...singleForm, cards: updated });
                              }}
                              className={inputClass}
                            >
                              <option value="KTP">KTP</option>
                              <option value="Non KTP">Non KTP</option>
                            </select>
                          </div>

                          <div className="sm:col-span-2">
                            <label className={labelClass}>Card No. / ID Number {idx === 0 ? '*' : ''}</label>
                            <input
                              type="text"
                              required={idx === 0}
                              placeholder={idx === 0 ? 'e.g. 3171012304900001' : 'Enter card / ID number...'}
                              value={card.cardNo}
                              onChange={(e) => {
                                const updated = [...singleForm.cards];
                                updated[idx].cardNo = e.target.value;
                                setSingleForm({ ...singleForm, cards: updated });
                              }}
                              className={inputClass}
                            />
                          </div>
                        </div>

                        {card.cardType !== 'Non KTP' && (
                          <div>
                            <label className={labelClass}>Upload ID Card (Auto OCR Scan)</label>
                            <div className="flex items-center gap-3">
                              <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors">
                                {cardUploadingIdx === idx ? (
                                  <>
                                    <CircleNotch size={16} className="animate-spin text-emerald-400" />
                                    <span className="text-emerald-400 font-semibold">Scanning OCR...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload size={16} />
                                    <span>Select ID File</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={cardUploadingIdx === idx}
                                  onChange={(e) => handleCardImageUpload(idx, e.target.files[0])}
                                  className="hidden"
                                />
                              </label>
                              {card.previewUrl && (
                                <div className="w-12 h-8 rounded border border-slate-700 overflow-hidden shrink-0">
                                  <img src={card.previewUrl} alt="Card Preview" className="w-full h-full object-cover" />
                                </div>
                              )}
                              {card.cardAttachmentId && !card.previewUrl && (
                                <span className="text-[10px] text-emerald-400 font-semibold">Image Attached</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Full Employee Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter full name"
                      value={singleForm.name}
                      onChange={(e) => setSingleForm({ ...singleForm, name: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Gender</label>
                    <select
                      value={singleForm.gender}
                      onChange={(e) => setSingleForm({ ...singleForm, gender: e.target.value })}
                      className={inputClass}
                    >
                      <option value="L">Male</option>
                      <option value="P">Female</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Place of Birth</label>
                    <input
                      type="text"
                      placeholder="e.g. Jakarta"
                      value={singleForm.placeOfBirth}
                      onChange={(e) => setSingleForm({ ...singleForm, placeOfBirth: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Date of Birth</label>
                    <input
                      type="date"
                      value={singleForm.birthday}
                      onChange={(e) => setSingleForm({ ...singleForm, birthday: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Address</label>
                  <input
                    type="text"
                    placeholder="Enter residential address"
                    value={singleForm.address}
                    onChange={(e) => setSingleForm({ ...singleForm, address: e.target.value })}
                    className={inputClass}
                  />
                </div>

                {/* MCU Information Section */}
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-white">
                    <FileText size={18} className="text-emerald-400" />
                    <span>Medical Check Up (MCU) Info</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass}>MCU Valid From</label>
                      <input
                        type="date"
                        value={singleForm.mcuValidFrom}
                        onChange={(e) => setSingleForm({ ...singleForm, mcuValidFrom: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>MCU Valid To</label>
                      <input
                        type="date"
                        value={singleForm.mcuValidTo}
                        onChange={(e) => setSingleForm({ ...singleForm, mcuValidTo: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Upload MCU Document</label>
                    <div className="flex items-center gap-3">
                      <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors">
                        {mcuLoading ? (
                          <>
                            <CircleNotch size={16} className="animate-spin text-emerald-400" />
                            <span className="text-emerald-400 font-semibold">Uploading MCU...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={16} className="text-emerald-400" />
                            <span>Select MCU File</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          disabled={mcuLoading}
                          onChange={handleMcuFileSelect}
                          className="hidden"
                        />
                      </label>
                      {mcuFileName && (
                        <span className="text-xs text-emerald-400 font-medium truncate max-w-xs">
                          📄 {mcuFileName}
                        </span>
                      )}
                      {singleForm.mcuAttachmentId && !mcuFileName && (
                        <span className="text-[10px] text-emerald-400 font-semibold">MCU Document Attached</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Face Photo Section */}
                <div>
                  <label className={labelClass}>Upload Employee Photo</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors">
                      {faceLoading ? (
                        <>
                          <CircleNotch size={16} className="animate-spin text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Uploading Photo...</span>
                        </>
                      ) : (
                        <>
                          <Camera size={16} className="text-emerald-400" />
                          <span>Upload Photo</span>
                        </>
                      )}
                      <input type="file" accept="image/*" disabled={faceLoading} onChange={handleFaceFileSelect} className="hidden" />
                    </label>
                    {facePreviewUrl && (
                      <div className="w-9 h-9 rounded-full border border-emerald-500/40 overflow-hidden shrink-0">
                        <img src={facePreviewUrl} alt="Face Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-5 py-2 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    {submitLoading ? 'Saving...' : 'Save Employee Data'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: DETAIL ==================== */}
      {showDetailModal && selectedVisitor && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <h3 className="text-base font-bold text-white">Profile Details</h3>
              <button onClick={() => setShowDetailModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {detailLoading ? (
                <div className="py-12 text-center text-xs text-slate-400">Loading details...</div>
              ) : (
                <div className="space-y-4">
                  {/* Profile Header Card */}
                  <div className="flex items-center gap-4 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="w-16 h-16 rounded-xl bg-slate-900 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                      {detailData?.photoAttachmentId ? (
                        <img
                          src={`${API_BASE}/visitor/attachment/${detailData.photoAttachmentId}`}
                          alt={detailData.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User size={32} className="text-slate-600" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white">{detailData?.name || selectedVisitor.name}</h4>
                      <p className="text-xs font-mono text-emerald-400 mt-0.5">{detailData?.phoneNo || selectedVisitor.phoneNo}</p>
                      <span className="inline-block mt-1.5 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-[10px] font-bold text-slate-300">
                        Type: {detailData?.userType || 'EMPLOYEE'}
                      </span>
                    </div>
                  </div>

                  {/* Details Table */}
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Gender</span>
                      <span className="text-white font-medium">{detailData?.gender === 'L' ? 'Male' : 'Female'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Place of Birth</span>
                      <span className="text-white font-medium">{detailData?.placeOfBirth || '—'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Date of Birth</span>
                      <span className="text-white font-medium">{detailData?.birthday ? String(detailData.birthday).split('T')[0] : '—'}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800/60">
                      <span className="text-slate-400">Address</span>
                      <span className="text-white font-medium truncate max-w-xs">{detailData?.address || '—'}</span>
                    </div>
                  </div>

                  {/* MCU Information (Only for EMPLOYEE) */}
                  {(detailData?.userType || detailData?.USER_TYPE) === 'EMPLOYEE' && (
                    <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <div className="text-xs font-semibold text-white flex items-center justify-between">
                        <span>MCU Information</span>
                        {detailData?.mcuAttachmentId || detailData?.MCU_ATTACHMENT_ID ? (
                          <a
                            href={`${API_BASE}/visitor/attachment/${detailData.mcuAttachmentId || detailData.MCU_ATTACHMENT_ID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                          >
                            📄 View Document
                          </a>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-normal">No document</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div>
                          <span className="text-slate-400 block text-[11px]">Valid From:</span>
                          <span className="text-white font-medium">
                            {detailData?.mcuValidFrom || detailData?.MCU_VALID_FROM ? String(detailData.mcuValidFrom || detailData.MCU_VALID_FROM).split('T')[0] : '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[11px]">Valid To:</span>
                          <span className="text-white font-medium">
                            {detailData?.mcuValidTo || detailData?.MCU_VALID_TO ? String(detailData.mcuValidTo || detailData.MCU_VALID_TO).split('T')[0] : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Card Info */}
                  <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="text-xs font-semibold text-white">Access Card & ID Information</div>
                    {detailData?.cards?.map((c, idx) => (
                      <div key={c.CARD_NO || c.card_no || `card-${idx}`} className="flex items-center justify-between text-xs pt-1">
                        <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-emerald-400 rounded font-mono font-bold">
                          {c.CARD_TYPE || c.card_type}
                        </span>
                        <span className="font-mono text-white font-semibold">{c.CARD_NO || c.card_no}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 text-right">
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs px-4 py-2 rounded-xl"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODAL 3: EDIT ==================== */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900">
              <h3 className="text-base font-bold text-white">
                {editForm.userType === 'EMPLOYEE' ? 'Edit Employee Data' : 'Edit Visitor Data'}
              </h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
                <X size={20} />
              </button>
            </div>

            {/* Modal Form & Scrollable Body */}
            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                <div>
                  <label className={labelClass}>Phone Number (Read-Only)</label>
                  <input type="text" disabled value={editForm.phoneNo} className={`${inputClass} opacity-60`} />
                </div>

                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Gender</label>
                    <select
                      value={editForm.gender}
                      onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                      className={inputClass}
                    >
                      <option value="L">Male</option>
                      <option value="P">Female</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>User Type</label>
                    <select
                      value={editForm.userType}
                      onChange={(e) => setEditForm({ ...editForm, userType: e.target.value })}
                      className={inputClass}
                    >
                      <option value="EMPLOYEE">EMPLOYEE</option>
                      <option value="VISITOR">VISITOR</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Place of Birth</label>
                    <input
                      type="text"
                      value={editForm.placeOfBirth}
                      onChange={(e) => setEditForm({ ...editForm, placeOfBirth: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Date of Birth</label>
                    <input
                      type="date"
                      value={editForm.birthday}
                      onChange={(e) => setEditForm({ ...editForm, birthday: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* MCU Information Section (Only for EMPLOYEE) */}
                {editForm.userType === 'EMPLOYEE' && (
                  <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-white">
                      <FileText size={18} className="text-emerald-400" />
                      <span>Medical Check Up (MCU) Info</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelClass}>MCU Valid From</label>
                        <input
                          type="date"
                          value={editForm.mcuValidFrom}
                          onChange={(e) => setEditForm({ ...editForm, mcuValidFrom: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>MCU Valid To</label>
                        <input
                          type="date"
                          value={editForm.mcuValidTo}
                          onChange={(e) => setEditForm({ ...editForm, mcuValidTo: e.target.value })}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div>
                      <label className={labelClass}>Upload / Replace MCU Document</label>
                      <div className="flex items-center gap-3">
                        <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs px-3.5 py-2 rounded-xl flex items-center gap-2 transition-colors">
                          {editMcuLoading ? (
                            <>
                              <CircleNotch size={16} className="animate-spin text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Uploading MCU...</span>
                            </>
                          ) : (
                            <>
                              <Upload size={16} className="text-emerald-400" />
                              <span>Select File</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            disabled={editMcuLoading}
                            onChange={handleEditMcuFileSelect}
                            className="hidden"
                          />
                        </label>
                        {editMcuFileName && (
                          <span className="text-xs text-emerald-400 font-medium truncate max-w-xs">
                            📄 {editMcuFileName}
                          </span>
                        )}
                        {editForm.mcuAttachmentId && !editMcuFileName && (
                          <span className="text-[10px] text-emerald-400 font-semibold">MCU Document Attached</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Registered Cards Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={labelClass}>Registered Access Cards</label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditForm((prev) => ({
                          ...prev,
                          additionalCards: [
                            ...(prev.additionalCards || []),
                            { cardNo: '', cardType: 'KTP', cardAttachmentId: null, previewUrl: null },
                          ],
                        }))
                      }
                      className="text-[11px] text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      + Add New Card
                    </button>
                  </div>

                  {selectedVisitor?.cards && selectedVisitor.cards.length > 0 ? (
                    <div className="space-y-1.5 mb-2">
                      {selectedVisitor.cards.map((c, idx) => {
                        const cNo = c.CARD_NO || c.card_no;
                        const cType = c.CARD_TYPE || c.card_type;
                        const cAttId = c.CARD_ATTACHMENT_ID || c.card_attachment_id;
                        return (
                          <div key={cNo || idx} className="flex items-center justify-between px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-emerald-400 rounded text-[10px] font-mono font-bold">
                                {cType}
                              </span>
                              <span className="font-mono text-white font-semibold">{cNo}</span>
                              {cAttId && (
                                <span className="text-[10px] text-slate-500 border border-slate-800 bg-slate-900 px-1.5 py-0.5 rounded">
                                  Image Attached
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteCard(cNo)}
                              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                              title="Delete Card"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 mb-2">No cards registered yet.</p>
                  )}

                  {/* Additional Cards Input Rows in Edit Modal */}
                  {editForm.additionalCards && editForm.additionalCards.length > 0 && (
                    <div className="space-y-2 pt-1 border-t border-slate-800/60 mt-2">
                      <label className={labelClass}>New Cards to Add & Image Upload</label>
                      {editForm.additionalCards.map((extra, idx) => (
                        <div key={idx} className="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                          <div className="flex items-center gap-2">
                            <select
                              value={extra.cardType}
                              onChange={(e) => {
                                const updated = [...editForm.additionalCards];
                                updated[idx].cardType = e.target.value;
                                setEditForm({ ...editForm, additionalCards: updated });
                              }}
                              className="w-28 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-200"
                            >
                              <option value="KTP">KTP</option>
                              <option value="Non KTP">Non KTP</option>
                            </select>
                            <input
                              type="text"
                              placeholder="Enter new card number..."
                              value={extra.cardNo}
                              onChange={(e) => {
                                const updated = [...editForm.additionalCards];
                                updated[idx].cardNo = e.target.value;
                                setEditForm({ ...editForm, additionalCards: updated });
                              }}
                              className={inputClass}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const updated = editForm.additionalCards.filter((_, i) => i !== idx);
                                setEditForm({ ...editForm, additionalCards: updated });
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10"
                              title="Remove Card"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                          {extra.cardType !== 'Non KTP' && (
                            <div className="flex items-center gap-2 pt-1">
                              <label className="cursor-pointer bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors">
                                {extraCardUploadingIdx === idx ? (
                                  <>
                                    <CircleNotch size={13} className="animate-spin text-emerald-400" />
                                    <span className="text-emerald-400 font-semibold">Scanning & Uploading...</span>
                                  </>
                                ) : (
                                  <>
                                    <Upload size={13} />
                                    <span>Upload Card Image</span>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={extraCardUploadingIdx === idx}
                                  onChange={(e) => handleEditCardImageUpload(idx, e.target.files[0])}
                                  className="hidden"
                                />
                              </label>
                              {extra.previewUrl && (
                                <div className="w-10 h-6 rounded border border-slate-700 overflow-hidden shrink-0">
                                  <img src={extra.previewUrl} alt="Card Preview" className="w-full h-full object-cover" />
                                </div>
                              )}
                              {extra.cardAttachmentId && !extra.previewUrl && (
                                <span className="text-[10px] text-emerald-400 font-semibold">Image Attached</span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelClass}>Address</label>
                  <input
                    type="text"
                    value={editForm.address}
                    onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-slate-800 flex items-center justify-end gap-2 shrink-0 bg-slate-900">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-5 py-2 rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  {submitLoading ? 'Saving...' : 'Update Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
