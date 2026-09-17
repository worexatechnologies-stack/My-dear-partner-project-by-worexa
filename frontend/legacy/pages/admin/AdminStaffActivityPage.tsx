'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Calendar, CheckCircle, ChevronDown, ChevronRight, Clock, FileText, Filter, Globe, Heart,
  HelpCircle, Image as ImageIcon, Laptop, LoaderCircle, Mail, MapPin, Monitor, Phone, Plus,
  RefreshCw, Search, Shield, Smartphone, Tablet, Trash2, User, UserCheck, Zap,
} from 'lucide-react';
import { createAdminAccount, getAdminActivity, type ActivityLog } from '../../services/adminService';
import { fetchApi } from '../../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader,
  AdminPagination, AdminPanel, AdminStatusBadge, formatAdminDate,
} from '../../components/admin/AdminUI';

interface StaffMemberPerformance {
  id: string;
  full_name: string;
  email: string;
  mobile_number: string;
  admin_id: string;
  photo: string;
  bio: string;
  role: string;
  created_at: string;
  summary: {
    tickets_solved: number;
    photos_approved: number;
    documents_approved: number;
    profiles_approved: number;
  };
  daily_breakdown: Array<{
    date: string;
    tickets_solved: number;
    photos_approved: number;
    documents_approved: number;
    profiles_approved: number;
  }>;
}

/* ─── Helpers ─── */

function parseUserAgent(ua: string) {
  const s = ua || '';
  // Device type
  let deviceType = 'Desktop';
  let DeviceIcon: React.ElementType = Monitor;
  if (/mobile|android.*mobile|iphone|ipod|blackberry|windows phone/i.test(s)) {
    deviceType = 'Mobile';
    DeviceIcon = Smartphone;
  } else if (/tablet|ipad|android(?!.*mobile)/i.test(s)) {
    deviceType = 'Tablet';
    DeviceIcon = Tablet;
  } else if (/laptop/i.test(s)) {
    DeviceIcon = Laptop;
  }

  // Browser
  let browser = 'Unknown Browser';
  if (/edg\//i.test(s)) browser = 'Microsoft Edge';
  else if (/opr\//i.test(s) || /opera/i.test(s)) browser = 'Opera';
  else if (/chrome\/(\d+)/i.test(s) && !/chromium/i.test(s)) {
    const v = s.match(/chrome\/(\d+)/i);
    browser = `Chrome ${v ? v[1] : ''}`.trim();
  } else if (/firefox\/(\d+)/i.test(s)) {
    const v = s.match(/firefox\/(\d+)/i);
    browser = `Firefox ${v ? v[1] : ''}`.trim();
  } else if (/safari\/(\d+)/i.test(s) && !/chrome/i.test(s)) {
    browser = 'Safari';
  } else if (/msie|trident/i.test(s)) browser = 'Internet Explorer';
  else if (s === 'node') browser = 'Server / API';
  else if (s) browser = s.slice(0, 48);

  // OS
  let os = 'Unknown OS';
  if (/windows nt 10/i.test(s)) os = 'Windows 10/11';
  else if (/windows nt 6\.3/i.test(s)) os = 'Windows 8.1';
  else if (/windows nt 6\.1/i.test(s)) os = 'Windows 7';
  else if (/windows/i.test(s)) os = 'Windows';
  else if (/android (\d+[\.\d]*)/i.test(s)) { const v = s.match(/android (\d+[\.\d]*)/i); os = `Android ${v ? v[1] : ''}`; }
  else if (/iphone os ([\d_]+)/i.test(s)) { const v = s.match(/iphone os ([\d_]+)/i); os = `iOS ${v ? v[1].replace(/_/g, '.') : ''}`; }
  else if (/ipad/i.test(s)) os = 'iPadOS';
  else if (/mac os x ([\d_]+)/i.test(s)) { const v = s.match(/mac os x ([\d_]+)/i); os = `macOS ${v ? v[1].replace(/_/g, '.') : ''}`; }
  else if (/linux/i.test(s)) os = 'Linux';
  else if (/ubuntu/i.test(s)) os = 'Ubuntu';

  return { deviceType, DeviceIcon, browser, os };
}

function relativeTime(dateStr: string): string {
  try {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  } catch {
    return '';
  }
}


export default function AdminStaffActivityPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN' || user?.account_type === 'SUPER_ADMIN' || (user as any)?.is_super_admin;

  const [items, setItems] = useState<ActivityLog[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [module, setModule] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Performance Analytics state
  const [performanceData, setPerformanceData] = useState<StaffMemberPerformance[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [deletingStaffId, setDeletingStaffId] = useState<string | null>(null);
  const [presetRange, setPresetRange] = useState<'today' | '7days' | '30days' | 'custom'>('30days');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      let url = `/super-admin/staff-performance/?start_date=${startDate}&end_date=${endDate}`;
      if (selectedStaffId && selectedStaffId !== 'all') {
        url += `&staff_id=${selectedStaffId}`;
      }
      const data = await fetchApi<{ staff_performance: StaffMemberPerformance[] }>(url);
      setPerformanceData(data.staff_performance || []);
    } catch {
      // Fallback
    } finally {
      setAnalyticsLoading(false);
    }
  }, [startDate, endDate, selectedStaffId]);

  const handlePresetChange = (preset: 'today' | '7days' | '30days' | 'custom') => {
    setPresetRange(preset);
    const today = new Date().toISOString().split('T')[0];
    setEndDate(today);

    if (preset === 'today') {
      setStartDate(today);
    } else if (preset === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      setStartDate(d.toISOString().split('T')[0]);
    } else if (preset === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(d.toISOString().split('T')[0]);
    }
  };

  const handleDeleteAdmin = async (staff: StaffMemberPerformance) => {
    if (!window.confirm(`Are you sure you want to delete Admin profile "${staff.full_name}" (${staff.admin_id || staff.email})?\n\nThis account will be safely archived.`)) {
      return;
    }
    setDeletingStaffId(staff.id);
    try {
      await fetchApi(`/super-admin/admins/${staff.id}/`, { method: 'DELETE' });
      alert(`Admin profile "${staff.full_name}" has been deleted.`);
      setSelectedStaffId('all');
      await loadAnalytics();
      await loadWithPage(page);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete Admin profile.');
    } finally {
      setDeletingStaffId(null);
    }
  };

  const loadWithPage = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminActivity({ page: targetPage, page_size: 20, search: search || undefined, module: module || undefined, role: 'ADMIN' });
      setItems(data.results);
      setCount(data.count);
      setPage(targetPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Admin activity could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [search, module]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    setPage(1);
    const t = window.setTimeout(() => loadWithPage(1), 200);
    return () => window.clearTimeout(t);
  }, [search, module]);

  const activeStaff = selectedStaffId === 'all'
    ? performanceData[0]
    : performanceData.find((s) => s.id === selectedStaffId) || performanceData[0];

  // Aggregate stats across selected or all staff
  const totalTicketsSolved = performanceData.reduce((acc, s) => acc + (s.summary?.tickets_solved || 0), 0);
  const totalProfilesApproved = performanceData.reduce((acc, s) => acc + (s.summary?.profiles_approved || 0), 0);
  const totalPhotosApproved = performanceData.reduce((acc, s) => acc + (s.summary?.photos_approved || 0), 0);
  const totalDocsApproved = performanceData.reduce((acc, s) => acc + (s.summary?.documents_approved || 0), 0);

  if (loading && !items.length) return <AdminLoading label="Loading admin activity & performance analytics..." />;
  if (error && !items.length) return <AdminErrorState message={error} onRetry={() => loadWithPage(page)} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Management & Analytics"
        title={isSuperAdmin ? "Admin Activity & Performance" : "My Activity & Performance"}
        description={isSuperAdmin ? "Monitor admin operational activity, custom date performance metrics, support tickets solved, and profile verification approvals." : "Monitor your operational activity, performance metrics, tickets solved, and verification approvals."}
        actions={
          <button type="button" className="admin-btn admin-btn-secondary" onClick={() => { loadWithPage(page); loadAnalytics(); }}>
            <RefreshCw /> Refresh Data
          </button>
        }
      />

      {/* ─────────────────────────── Filter & Date Range Bar ─────────────────────────── */}
      <AdminPanel className="mb-6 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5 mr-2">
              <Calendar className="w-4 h-4 text-slate-600" /> Date Range:
            </span>
            <button
              onClick={() => handlePresetChange('today')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${presetRange === 'today' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Today
            </button>
            <button
              onClick={() => handlePresetChange('7days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${presetRange === '7days' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Last 7 Days
            </button>
            <button
              onClick={() => handlePresetChange('30days')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${presetRange === '30days' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Last 30 Days
            </button>
            <button
              onClick={() => setPresetRange('custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${presetRange === 'custom' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Custom Range
            </button>
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto">
            {presetRange === 'custom' && (
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <span>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            )}

            {performanceData.length > 0 && isSuperAdmin && (
              <div className="flex items-center gap-2">
                <label htmlFor="staff-selector-input" className="text-xs font-bold text-slate-500">Admin:</label>
                <select
                  id="staff-selector-input"
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="all">All Admin Accounts ({performanceData.length})</option>
                  {performanceData.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name} ({staff.admin_id || 'Admin'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </AdminPanel>

      {/* ─────────────────────────── Staff Profile & Key Performance Cards ─────────────────────────── */}
      {activeStaff && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-8">
          
          {/* Admin Profile Card */}
          <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3.5 mb-4">
                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xl overflow-hidden shrink-0">
                  {activeStaff.photo ? (
                    <img src={activeStaff.photo} alt={activeStaff.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-7 h-7 text-indigo-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-tight">{activeStaff.full_name}</h3>
                  {activeStaff.admin_id && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-[11px] font-extrabold text-indigo-700">
                      ID: {activeStaff.admin_id}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{activeStaff.email}</span>
                </div>
                {activeStaff.mobile_number && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{activeStaff.mobile_number}</span>
                  </div>
                )}
                {activeStaff.bio && (
                  <p className="mt-2 text-xs text-slate-500 italic line-clamp-3 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    "{activeStaff.bio}"
                  </p>
                )}
              </div>
            </div>

            <div>
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-2">
                <span>Account Type: {activeStaff.role}</span>
                <span>Joined: {activeStaff.created_at}</span>
              </div>

              {isSuperAdmin && (
                <button
                  onClick={() => handleDeleteAdmin(activeStaff)}
                  disabled={deletingStaffId === activeStaff.id}
                  className="w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingStaffId === activeStaff.id ? 'Deleting...' : 'Delete Admin Profile'}
                </button>
              )}
            </div>
          </div>

          {/* Performance Summary Metrics (4 Grid Cards) */}
          <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-4">
            
            {/* Metric 1: Tickets Solved */}
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 mb-3">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Tickets Solved</span>
                <div className="text-3xl font-black text-emerald-950 mt-1">
                  {selectedStaffId === 'all' ? totalTicketsSolved : activeStaff.summary?.tickets_solved || 0}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 mt-4">
                In selected date range
              </span>
            </div>

            {/* Metric 2: Profiles Approved */}
            <div className="bg-indigo-50/60 border border-indigo-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 mb-3">
                  <UserCheck className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-700">Profiles Approved</span>
                <div className="text-3xl font-black text-indigo-950 mt-1">
                  {selectedStaffId === 'all' ? totalProfilesApproved : activeStaff.summary?.profiles_approved || 0}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-indigo-700 mt-4">
                Full member profile check
              </span>
            </div>

            {/* Metric 3: Photos Approved */}
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-700 mb-3">
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">Photos Approved</span>
                <div className="text-3xl font-black text-rose-950 mt-1">
                  {selectedStaffId === 'all' ? totalPhotosApproved : activeStaff.summary?.photos_approved || 0}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-rose-700 mt-4">
                Verified member avatars
              </span>
            </div>

            {/* Metric 4: Documents Approved */}
            <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-5 shadow-sm flex flex-col justify-between">
              <div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 mb-3">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Docs Approved</span>
                <div className="text-3xl font-black text-amber-950 mt-1">
                  {selectedStaffId === 'all' ? totalDocsApproved : activeStaff.summary?.documents_approved || 0}
                </div>
              </div>
              <span className="text-[11px] font-semibold text-amber-700 mt-4">
                Govt ID verifications
              </span>
            </div>

          </div>
        </div>
      )}

      {/* ─────────────────────────── Daily Activity Performance Table ─────────────────────────── */}
      {activeStaff && activeStaff.daily_breakdown && activeStaff.daily_breakdown.length > 0 && (
        <AdminPanel className="mb-8 p-6 bg-white border border-slate-200 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-bold text-slate-900">Daily Performance Breakdown</h4>
              <p className="text-xs text-slate-500">Per-day operational breakdown for {activeStaff.full_name} from {startDate} to {endDate}</p>
            </div>
            {analyticsLoading && <LoaderCircle className="w-4 h-4 text-indigo-600 animate-spin" />}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-bold uppercase tracking-wider">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-center">Tickets Solved</th>
                  <th className="py-3 px-4 text-center">Profiles Approved</th>
                  <th className="py-3 px-4 text-center">Photos Approved</th>
                  <th className="py-3 px-4 text-center">Documents Approved</th>
                  <th className="py-3 px-4 text-right">Total Daily Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {activeStaff.daily_breakdown.slice(-14).reverse().map((day) => {
                  const dailyTotal = day.tickets_solved + day.profiles_approved + day.photos_approved + day.documents_approved;
                  return (
                    <tr key={day.date} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 font-bold text-slate-900">{day.date}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${day.tickets_solved > 0 ? 'bg-emerald-100 text-emerald-800' : 'text-slate-400'}`}>
                          {day.tickets_solved}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${day.profiles_approved > 0 ? 'bg-indigo-100 text-indigo-800' : 'text-slate-400'}`}>
                          {day.profiles_approved}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${day.photos_approved > 0 ? 'bg-rose-100 text-rose-800' : 'text-slate-400'}`}>
                          {day.photos_approved}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded font-bold ${day.documents_approved > 0 ? 'bg-amber-100 text-amber-800' : 'text-slate-400'}`}>
                          {day.documents_approved}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-black text-slate-900">
                        {dailyTotal}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </AdminPanel>
      )}

      {/* ─────────────────────────── Immutable Activity Audit Logs Table ─────────────────────────── */}
      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-search-field">
            <Search />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search administrator, action or record..."
            />
          </div>
          <div className="admin-filter-row">
            <label>
              <Filter />
              <select value={module} onChange={(e) => setModule(e.target.value)}>
                <option value="">All modules</option>
                <option value="tickets">Tickets</option>
                <option value="enquiries">Enquiries</option>
                <option value="complaints">Complaints</option>
                <option value="members">Members</option>
                <option value="photos">Photos</option>
                <option value="documents">Documents</option>
                <option value="verification">Verification</option>
              </select>
            </label>
          </div>
        </div>

        {error && <div className="admin-inline-error">{error}</div>}
        {loading && <div className="admin-table-progress"><LoaderCircle className="admin-spinner" /> Updating...</div>}

        {items.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 24 }}></th>
                  <th>Done by</th>
                  <th>Action</th>
                  <th>Module / Record</th>
                  <th>Outcome</th>
                  <th>IP &amp; Device</th>
                  <th>Location</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const ua = parseUserAgent((item as any).user_agent || '');
                  const isExpanded = expandedRow === item.id;
                  return (
                    <>
                      <tr
                        key={item.id}
                        onClick={() => setExpandedRow(isExpanded ? null : item.id)}
                        style={{ cursor: 'pointer' }}
                        className={isExpanded ? 'bg-rose-50/40' : ''}
                      >
                        {/* Expand toggle */}
                        <td style={{ width: 24, paddingRight: 0 }}>
                          {isExpanded
                            ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                            : <ChevronRight className="w-3.5 h-3.5 text-slate-300" />}
                        </td>

                        {/* Done by */}
                        <td data-label="Done by">
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-900">{item.actor_name || item.admin_name || 'Admin'}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {item.actor_role || item.role?.replaceAll('_', ' ') || 'ADMIN'}
                            </div>
                          </div>
                        </td>

                        {/* Action */}
                        <td data-label="Action">
                          <code style={{ fontSize: '0.75rem', background: 'var(--admin-bg-subtle)', padding: '0.15rem 0.5rem', borderRadius: '0.3rem' }}>
                            {item.action}
                          </code>
                        </td>

                        {/* Module / Record */}
                        <td data-label="Module / Record">
                          <div>
                            <span className="admin-muted-cell font-semibold">{item.module}</span>
                            {item.record_id && (
                              <div className="text-[10px] text-slate-400 font-mono truncate max-w-[160px]" title={String(item.record_id)}>
                                Record {String(item.record_id).slice(0, 8)}…
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Outcome */}
                        <td data-label="Outcome">
                          <AdminStatusBadge status={item.was_successful ? 'Success' : 'Failed'} />
                        </td>

                        {/* IP & Device */}
                        <td data-label="IP &amp; Device">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <ua.DeviceIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span className="text-xs text-slate-700 font-mono">{item.ip_address || '—'}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">{ua.browser}</div>
                          </div>
                        </td>

                        {/* Location */}
                        <td data-label="Location">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-slate-300 shrink-0" />
                            <span className="text-xs text-slate-600">
                              {item.city && item.country
                                ? `${item.city}, ${item.country}`
                                : item.city || item.country
                                  || (item.latitude ? `${item.latitude?.toFixed(2)}°, ${item.longitude?.toFixed(2)}°` : '—')}
                            </span>
                          </div>
                        </td>

                        {/* Timestamp */}
                        <td data-label="Timestamp">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-slate-300 shrink-0" />
                              <span className="text-xs text-slate-700 font-medium">{formatAdminDate(item.created_at, true)}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">{relativeTime(item.created_at)}</div>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded detail panel */}
                      {isExpanded && (
                        <tr key={`${item.id}-expanded`}>
                          <td colSpan={8} style={{ padding: 0, background: '#fdf8fb' }}>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 border-t border-rose-100">

                              {/* Device & Browser */}
                              <div className="bg-white rounded-xl border border-slate-100 p-3.5 space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <ua.DeviceIcon className="w-4 h-4 text-rose-500" />
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Device & Browser</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                  <span className="text-slate-400 font-semibold">Device type</span>
                                  <span className="text-slate-700 font-medium">{ua.deviceType}</span>
                                  <span className="text-slate-400 font-semibold">Browser</span>
                                  <span className="text-slate-700 font-medium">{ua.browser}</span>
                                  <span className="text-slate-400 font-semibold">OS</span>
                                  <span className="text-slate-700 font-medium">{ua.os}</span>
                                  <span className="text-slate-400 font-semibold">IP Address</span>
                                  <span className="text-slate-700 font-mono text-[11px]">{item.ip_address || '—'}</span>
                                </div>
                                {(item as any).user_agent && (
                                  <div className="mt-2 pt-2 border-t border-slate-100">
                                    <p className="text-[10px] text-slate-400 font-semibold mb-1">Raw User-Agent</p>
                                    <p className="text-[10px] text-slate-500 font-mono break-all leading-relaxed">{(item as any).user_agent}</p>
                                  </div>
                                )}
                              </div>

                              {/* Location */}
                              <div className="bg-white rounded-xl border border-slate-100 p-3.5 space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <Globe className="w-4 h-4 text-emerald-500" />
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Location</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                  <span className="text-slate-400 font-semibold">City</span>
                                  <span className="text-slate-700 font-medium">{item.city || '—'}</span>
                                  <span className="text-slate-400 font-semibold">Country</span>
                                  <span className="text-slate-700 font-medium">{item.country || '—'}</span>
                                  {item.latitude && (
                                    <>
                                      <span className="text-slate-400 font-semibold">Latitude</span>
                                      <span className="text-slate-700 font-mono text-[11px]">{item.latitude?.toFixed(5)}</span>
                                      <span className="text-slate-400 font-semibold">Longitude</span>
                                      <span className="text-slate-700 font-mono text-[11px]">{item.longitude?.toFixed(5)}</span>
                                    </>
                                  )}
                                </div>
                                {item.latitude && item.longitude && (
                                  <a
                                    href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 mt-2 text-[11px] text-emerald-700 font-semibold hover:underline"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    <MapPin className="w-3 h-3" /> View on Google Maps
                                  </a>
                                )}
                              </div>

                              {/* Timing & Action */}
                              <div className="bg-white rounded-xl border border-slate-100 p-3.5 space-y-2">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="w-4 h-4 text-indigo-500" />
                                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Timing & Action</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                  <span className="text-slate-400 font-semibold">Date</span>
                                  <span className="text-slate-700 font-medium">{formatAdminDate(item.created_at, false)}</span>
                                  <span className="text-slate-400 font-semibold">Time</span>
                                  <span className="text-slate-700 font-mono text-[11px]">{new Date(item.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}</span>
                                  <span className="text-slate-400 font-semibold">Ago</span>
                                  <span className="text-slate-700 font-medium">{relativeTime(item.created_at)}</span>
                                  <span className="text-slate-400 font-semibold">Module</span>
                                  <span className="text-slate-700 font-medium">{item.module}</span>
                                  <span className="text-slate-400 font-semibold">Action</span>
                                  <span className="text-slate-700 font-mono text-[10px] break-all">{item.action}</span>
                                  {item.description && (
                                    <>
                                      <span className="text-slate-400 font-semibold">Note</span>
                                      <span className="text-slate-700">{item.description}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState title="No admin activity" description="No admin activity found for the selected filter." />
        )}
        <AdminPagination page={page} count={count} pageSize={20} onPageChange={loadWithPage} />
      </AdminPanel>
    </>
  );
}
