import React, { useState, useEffect, forwardRef } from 'react';
import { API_BASE_URL } from '../config';
import { formatDateTime } from '../utils/datetime';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  Users,
  SignIn,
  SignOut,
  Plugs,
  ArrowRight,
  ArrowClockwise,
  MagnifyingGlass,
  DownloadSimple,
  X,
  CalendarBlank,
} from '@phosphor-icons/react';

// ponytail: custom input wrapper for react-datepicker dark theme
const DarkDateInput = forwardRef(({ value, onClick, placeholder }, ref) => (
  <button
    type="button"
    onClick={onClick}
    ref={ref}
    className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 text-left focus:outline-none focus:border-slate-700 transition-colors cursor-pointer flex items-center justify-between gap-2"
  >
    <span className={value ? 'text-slate-200' : 'text-slate-500'}>{value || placeholder}</span>
    <CalendarBlank size={15} className="text-slate-500 shrink-0" />
  </button>
));

export default function DashboardPage({ setActivePage }) {
  const [stats, setStats] = useState({
    totalVisitors: 0,
    activeCheckIns: 0,
    todayCheckOuts: 0,
    totalUserEmployee: 0,
    totalUserVisitor: 0,
    activeUserEmployee: 0,
    activeUserVisitor: 0,
    todayCheckOutsEmployee: 0,
    todayCheckOutsVisitor: 0,
    gateStatus: 'OPERATIONAL',
  });
  const [recentVisits, setRecentVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('dashboard'); // 'dashboard' | 'employee_log' | 'visitor_log'
  const [searchTerm, setSearchTerm] = useState('');

  // Download Modal States
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [downloadFilterType, setDownloadFilterType] = useState('daily'); // 'daily' | 'monthly'
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [downloadMonth, setDownloadMonth] = useState(new Date());

  const getMaxEndDate = (start) => {
    const d = new Date(start);
    d.setDate(d.getDate() + 30);
    return d;
  };

  const handleStartDateChange = (date) => {
    if (!date) return;
    setStartDate(date);
    if (endDate < date) setEndDate(date);
    else if (endDate > getMaxEndDate(date)) setEndDate(getMaxEndDate(date));
  };

  const handleEndDateChange = (date) => {
    if (!date) return;
    if (date > getMaxEndDate(startDate)) date = getMaxEndDate(startDate);
    if (date < startDate) date = startDate;
    setEndDate(date);
  };

  const toDateStr = (d) => {
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };
  const toMonthStr = (d) => {
    if (!d) return '';
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${yyyy}-${mm}`;
  };

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
        totalUserEmployee: statsData.totalUserEmployee ?? 0,
        totalUserVisitor: statsData.totalUserVisitor ?? 0,
        activeUserEmployee: statsData.activeUserEmployee ?? 0,
        activeUserVisitor: statsData.activeUserVisitor ?? 0,
        todayCheckOutsEmployee: statsData.todayCheckOutsEmployee ?? 0,
        todayCheckOutsVisitor: statsData.todayCheckOutsVisitor ?? 0,
        gateStatus: statsData.gateStatus || 'OPERATIONAL',
      });
      if (visitsData.data) {
        setRecentVisits(visitsData.data);
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

  const employeeVisits = recentVisits.filter((v) => v.userType === 'EMPLOYEE').slice(0, 8);
  const visitorVisits = recentVisits.filter((v) => v.userType !== 'EMPLOYEE').slice(0, 8);

  const handleExecuteDownload = (isEmployee) => {
    const category = isEmployee ? 'Employee' : 'Visitor';
    let list = isEmployee
      ? recentVisits.filter((v) => v.userType === 'EMPLOYEE')
      : recentVisits.filter((v) => v.userType !== 'EMPLOYEE');

    if (downloadFilterType === 'daily' && startDate && endDate) {
      const sStr = toDateStr(startDate);
      const eStr = toDateStr(endDate);
      list = list.filter((v) => {
        if (!v.checkIn) return false;
        const cDate = v.checkIn.substring(0, 10);
        return cDate >= sStr && cDate <= eStr;
      });
    } else if (downloadFilterType === 'monthly' && downloadMonth) {
      const mStr = toMonthStr(downloadMonth);
      list = list.filter((v) => {
        if (!v.checkIn) return false;
        return v.checkIn.substring(0, 7) === mStr;
      });
    }

    const headers = ['Visit ID', 'Card No', 'Name', 'Check-In', 'Check-Out', 'Status'];

    const tableHtml = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8" />
        <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Log Activity</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
        <style>
          th { background-color: #0f172a; color: #ffffff; border: 1px solid #334155; padding: 8px; font-weight: bold; }
          td { border: 1px solid #cbd5e1; padding: 6px; }
        </style>
      </head>
      <body>
        <h2>Monitoring Log ${category} Activity</h2>
        <table>
          <thead>
            <tr>
              ${headers.map((h) => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${list
              .map(
                (v) => `
              <tr>
                <td style="mso-number-format:'\\@';">${v.visitId || ''}</td>
                <td style="mso-number-format:'\\@';">${v.cardNo || ''}</td>
                <td>${v.card?.name || 'Visitor'}</td>
                <td>${formatDateTime(v.checkIn)}</td>
                <td>${v.checkOut ? formatDateTime(v.checkOut) : '—'}</td>
                <td>${v.checkOut ? 'Completed' : 'Inside'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([tableHtml], { type: 'application/vnd.ms-excel;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `log_${category.toLowerCase()}_${downloadFilterType === 'daily' ? `${toDateStr(startDate)}_to_${toDateStr(endDate)}` : toMonthStr(downloadMonth)}.xls`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
  };

  const renderVisitTable = (title, subtitle, visits, onCategoryViewAll) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col justify-between">
      <div>
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">{title}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
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
              onClick={onCategoryViewAll}
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
                <th className="px-4 py-3 font-medium">ID & Status</th>
                <th className="px-4 py-3 font-medium">Card No and Name</th>
                <th className="px-4 py-3 font-medium">Check In & Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {visits.length > 0 ? (
                visits.map((v) => (
                  <tr key={v.visitId} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1">
                        <div className="font-mono text-slate-400 text-xs truncate max-w-[120px]" title={v.visitId}>
                          {v.visitId?.substring(0, 11)}...
                        </div>
                        <div>
                          {v.checkOut ? (
                            <span className="inline-flex items-center px-2 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px] font-medium">
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium">
                              Inside
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div>
                        <div className="font-mono font-medium text-slate-200 text-xs">{v.cardNo}</div>
                        <div className="text-slate-400 text-[11px] uppercase font-medium">{v.card?.name || 'Visitor'}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div>
                        <div className="font-mono text-emerald-400 text-xs">{formatDateTime(v.checkIn)}</div>
                        <div className="font-mono text-amber-400 text-xs mt-0.5">
                          {v.checkOut ? formatDateTime(v.checkOut) : <span className="text-slate-600">—</span>}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="px-4 py-10 text-center text-slate-500">
                    {loading ? 'Loading data...' : 'No activity recorded yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  if (viewMode === 'employee_log' || viewMode === 'visitor_log') {
    const isEmployee = viewMode === 'employee_log';
    const categoryName = isEmployee ? 'Employee' : 'Visitor';
    const title = isEmployee ? 'Monitoring Log Employee' : 'Monitoring Log Visitor';
    const subtitle = isEmployee
      ? 'Real-Time Monitoring Employee activity'
      : 'Real-Time Monitoring Visitor activity';

    const categoryVisits = recentVisits.filter((v) =>
      isEmployee ? v.userType === 'EMPLOYEE' : v.userType !== 'EMPLOYEE'
    );

    const filteredVisits = categoryVisits.filter((v) => {
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      const visitId = (v.visitId || '').toLowerCase();
      const cardNo = (v.cardNo || '').toLowerCase();
      const name = (v.card?.name || '').toLowerCase();
      return visitId.includes(term) || cardNo.includes(term) || name.includes(term);
    });

    return (
      <div className="space-y-4 max-w-7xl mx-auto">
        {/* Breadcrumb Header */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <button
            onClick={() => setViewMode('dashboard')}
            className="hover:text-emerald-400 transition-colors font-medium"
          >
            Dashboard
          </button>
          <span className="text-slate-600">/</span>
          <span className="text-slate-200 font-semibold">Log {categoryName}</span>
        </div>

        {/* Main Content Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-base font-bold text-white">{title}</h1>
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <MagnifyingGlass size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search name, phone, or ID number..."
                  className="bg-slate-950/90 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 rounded-lg pl-9 pr-4 py-2 w-64 focus:outline-none focus:border-slate-700 transition-colors"
                />
              </div>
              <button
                onClick={() => setShowDownloadModal(true)}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-semibold px-4 py-2 rounded-lg transition-colors text-xs whitespace-nowrap"
              >
                <DownloadSimple size={15} weight="bold" />
                Download Log Activity
              </button>
            </div>
          </div>

          <div className="border border-slate-800/80 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 font-medium">
                  <tr>
                    <th className="px-5 py-3.5">ID & Status</th>
                    <th className="px-5 py-3.5">Card No and Name</th>
                    <th className="px-5 py-3.5">Check In & Out</th>
                    <th className="px-5 py-3.5">Check-In</th>
                    <th className="px-5 py-3.5">Check-Out</th>
                    <th className="px-5 py-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredVisits.length > 0 ? (
                    filteredVisits.map((v) => (
                      <tr key={v.visitId} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-5 py-3.5 font-mono text-slate-400">
                          {v.visitId?.substring(0, 11)}...
                        </td>
                        <td className="px-5 py-3.5 font-mono font-bold text-slate-200">
                          {v.cardNo}
                        </td>
                        <td className="px-5 py-3.5 text-slate-200 uppercase font-medium">
                          {v.card?.name || 'Visitor'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-emerald-400">
                          {formatDateTime(v.checkIn)}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-amber-400">
                          {v.checkOut ? formatDateTime(v.checkOut) : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="px-5 py-3.5">
                          {v.checkOut ? (
                            <span className="inline-flex items-center px-2.5 py-1 bg-slate-800 text-slate-400 rounded text-[10px] font-medium">
                              Completed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 bg-emerald-500/10 text-emerald-400 rounded text-[10px] font-medium">
                              Inside
                            </span>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="px-5 py-12 text-center text-slate-500">
                        {loading ? 'Loading data...' : 'No visit activity recorded.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Download Modal Popup */}
        {showDownloadModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative space-y-6">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="absolute right-5 top-5 text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-slate-800"
              >
                <X size={18} />
              </button>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">Download log activity</h3>
                <p className="text-xs text-slate-400">
                  Please select Daily/Range Date/ Monthly before download
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">Filter Type</label>
                  <select
                    value={downloadFilterType}
                    onChange={(e) => setDownloadFilterType(e.target.value)}
                    className="w-full bg-slate-950/90 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-slate-700 transition-colors"
                  >
                    <option value="daily">Daily / Range Date</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                {downloadFilterType === 'daily' ? (
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">Start Date</label>
                        <DatePicker
                          selected={startDate}
                          onChange={handleStartDateChange}
                          dateFormat="dd/MM/yyyy"
                          customInput={<DarkDateInput />}
                          popperPlacement="bottom-start"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-1">End Date (Max 30 Days)</label>
                        <DatePicker
                          selected={endDate}
                          onChange={handleEndDateChange}
                          minDate={startDate}
                          maxDate={getMaxEndDate(startDate)}
                          dateFormat="dd/MM/yyyy"
                          customInput={<DarkDateInput />}
                          popperPlacement="bottom-end"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500">Maksimal rentang tanggal adalah 30 hari.</p>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] text-slate-400 mb-1">Select Month</label>
                    <DatePicker
                      selected={downloadMonth}
                      onChange={(date) => setDownloadMonth(date)}
                      dateFormat="MMMM yyyy"
                      showMonthYearPicker
                      customInput={<DarkDateInput />}
                      popperPlacement="bottom-start"
                    />
                  </div>
                )}
              </div>

              <button
                onClick={() => handleExecuteDownload(isEmployee)}
                className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-semibold px-4 py-3 rounded-xl transition-colors text-xs shadow-lg shadow-emerald-500/10"
              >
                <DownloadSimple size={16} weight="bold" />
                Download Log Activity
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total User */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-white">Total User</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Total registered user</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center">
              <Users size={15} className="text-slate-300" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-white tracking-tight">
                {loading ? '...' : stats.totalUserEmployee}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Employee</div>
            </div>
            <div className="w-px h-8 bg-slate-800 mx-3" />
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-white tracking-tight">
                {loading ? '...' : stats.totalUserVisitor}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Visitor</div>
            </div>
          </div>
        </div>

        {/* Card 2: Active User */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-white">Active User</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Currently inside building</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <SignIn size={15} className="text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                {loading ? '...' : stats.activeUserEmployee}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Employee</div>
            </div>
            <div className="w-px h-8 bg-slate-800 mx-3" />
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-emerald-400 tracking-tight">
                {loading ? '...' : stats.activeUserVisitor}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Visitor</div>
            </div>
          </div>
        </div>

        {/* Card 3: Today Check-Outs */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-white">Today Check-Outs</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Completed visits today</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <SignOut size={15} className="text-amber-400" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-amber-400 tracking-tight">
                {loading ? '...' : stats.todayCheckOutsEmployee}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Employee</div>
            </div>
            <div className="w-px h-8 bg-slate-800 mx-3" />
            <div className="flex-1 text-center">
              <div className="text-2xl font-bold text-amber-400 tracking-tight">
                {loading ? '...' : stats.todayCheckOutsVisitor}
              </div>
              <div className="text-[11px] text-slate-400 font-medium mt-0.5">Visitor</div>
            </div>
          </div>
        </div>

        {/* Card 4: Gate Status */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 hover:border-slate-700 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold text-white">Gate Status</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">Gate sensor connected</p>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Plugs size={15} className="text-emerald-400" />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm font-bold text-emerald-400 tracking-wide uppercase">
              {loading ? '...' : stats.gateStatus}
            </span>
          </div>
        </div>
      </div>

      {/* Grid of Employee & Visitor Visits */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {renderVisitTable('Recent Employee Activity', 'Real-time monitoring employee activity', employeeVisits, () => {
          setViewMode('employee_log');
          setSearchTerm('');
        })}
        {renderVisitTable('Recent Visitor Activity', 'Real-time monitoring visitor activity', visitorVisits, () => {
          setViewMode('visitor_log');
          setSearchTerm('');
        })}
      </div>
    </div>
  );
}
