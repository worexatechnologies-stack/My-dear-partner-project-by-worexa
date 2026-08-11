'use client';

import { useCallback, useEffect, useState } from 'react';
import { Filter, LoaderCircle, Mail, MapPin, Phone, RefreshCw, Save, Search } from 'lucide-react';
import {
  getAdminEnquiries, updateAdminEnquiry, type ContactEnquiry, type EnquiryStatus,
} from '../../services/adminService';
import {
  AdminEmptyState, AdminErrorState, AdminLoading, AdminPageHeader, AdminPagination,
  AdminPanel, AdminStatusBadge, AdminToast, formatAdminDate,
} from '../../components/admin/AdminUI';

export default function AdminEnquiriesPage() {
  const [enquiries, setEnquiries] = useState<ContactEnquiry[]>([]);
  const [selected, setSelected] = useState<ContactEnquiry | null>(null);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getAdminEnquiries({ page, page_size: 20, search, status: status || undefined });
      setEnquiries(result.results);
      setCount(result.count);
      setSelected((current) => result.results.find((item) => item.id === current?.id) || result.results[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Contact enquiries could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [page, search, status]);

  useEffect(() => {
    const timer = window.setTimeout(load, 200);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => { setPage(1); }, [search, status]);
  useEffect(() => { setNotes(selected?.internal_notes || ''); }, [selected]);

  const patchEnquiry = async (input: { status?: EnquiryStatus; internal_notes?: string }) => {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await updateAdminEnquiry(selected.id, input);
      setSelected(updated);
      setEnquiries((rows) => rows.map((item) => item.id === updated.id ? updated : item));
      setToast({ message: 'Enquiry updated successfully.', tone: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'The enquiry could not be updated.', tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !enquiries.length) return <AdminLoading label="Loading contact enquiriesâ€¦" />;
  if (error && !enquiries.length) return <AdminErrorState message={error} onRetry={load} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Customer care"
        title="Contact enquiries"
        description="Track incoming questions, add private context and keep every contact moving toward resolution."
        actions={<button type="button" className="admin-btn admin-btn-secondary" onClick={load}><RefreshCw /> Refresh</button>}
      />
      <AdminPanel className="admin-table-panel">
        <div className="admin-table-toolbar">
          <div className="admin-search-field"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or subject" /></div>
          <div className="admin-filter-row"><label><Filter /><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option><option value="NEW">New</option><option value="PENDING">Pending</option><option value="CONTACTED">Contacted</option><option value="RESOLVED">Resolved</option><option value="CLOSED">Closed</option></select></label></div>
        </div>
        {error && <div className="admin-inline-error">{error}</div>}
        {enquiries.length ? (
          <div className="admin-enquiry-grid border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="admin-enquiry-list border-r border-slate-200/80">
              {enquiries.map((enquiry) => {
                const isActive = selected?.id === enquiry.id;
                return (
                  <button
                    type="button"
                    key={enquiry.id}
                    className={`w-full text-left p-4 border-b border-slate-100 transition-all ${
                      isActive ? 'bg-rose-50/70 border-l-4 border-l-rose-600 shadow-xs' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => setSelected(enquiry)}
                  >
                    <div className="flex items-center gap-3 mb-1.5">
                      <span className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-black text-xs flex items-center justify-center shrink-0">
                        {enquiry.name[0]?.toUpperCase() || '?'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <strong className="block text-xs font-bold text-slate-900 truncate">{enquiry.name}</strong>
                        <small className="block text-[11px] text-slate-500 truncate">{enquiry.email}</small>
                      </div>
                    </div>
                    <h3 className="text-xs font-medium text-slate-700 truncate mb-2 capitalize">{enquiry.subject}</h3>
                    <div className="flex items-center justify-between pt-1">
                      <AdminStatusBadge status={enquiry.status} />
                      <time className="text-[10px] text-slate-400 font-medium">{formatAdminDate(enquiry.created_at)}</time>
                    </div>
                  </button>
                );
              })}
              <AdminPagination page={page} count={count} pageSize={20} onPageChange={setPage} />
            </div>
            {selected && (
              <article className="admin-enquiry-detail p-6 space-y-6 bg-white">
                <header className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
                  <div>
                    <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest mb-1">Enquiry details</p>
                    <h2 className="text-xl font-black text-slate-900 capitalize">{selected.subject}</h2>
                    <span className="text-xs text-slate-400 mt-1 block">Received {formatAdminDate(selected.created_at, true)}</span>
                  </div>
                  <AdminStatusBadge status={selected.status} />
                </header>
                
                <div className="grid sm:grid-cols-2 gap-3">
                  <a href={`mailto:${selected.email}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-rose-300 transition-all text-slate-700">
                    <Mail className="w-4 h-4 text-rose-500 shrink-0" />
                    <div className="min-w-0">
                      <small className="block text-[9px] uppercase font-bold text-slate-400">Email</small>
                      <span className="text-xs font-semibold truncate block">{selected.email}</span>
                    </div>
                  </a>
                  {selected.phone && (
                    <a href={`tel:${selected.phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60 hover:border-rose-300 transition-all text-slate-700">
                      <Phone className="w-4 h-4 text-rose-500 shrink-0" />
                      <div className="min-w-0">
                        <small className="block text-[9px] uppercase font-bold text-slate-400">Phone</small>
                        <span className="text-xs font-semibold truncate block">{selected.phone}</span>
                      </div>
                    </a>
                  )}
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-slate-700">
                    <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                    <div className="min-w-0">
                      <small className="block text-[9px] uppercase font-bold text-slate-400">Assigned to</small>
                      <span className="text-xs font-semibold truncate block">{selected.assigned_to?.full_name || 'Shared queue'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap">
                  {selected.message}
                </div>

                <div className="space-y-4 pt-2">
                  <label className="block text-xs font-bold text-slate-700">
                    Enquiry Status
                    <select
                      value={selected.status}
                      onChange={(event) => patchEnquiry({ status: event.target.value as EnquiryStatus })}
                      disabled={busy}
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold text-slate-800 focus:border-rose-500 focus:ring-rose-500"
                    >
                      <option value="NEW">New</option>
                      <option value="PENDING">Pending</option>
                      <option value="CONTACTED">Contacted</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="CLOSED">Closed</option>
                    </select>
                  </label>

                  <label className="block text-xs font-bold text-slate-700">
                    Internal Notes
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Add useful context for the next team member..."
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 text-xs text-slate-800 focus:border-rose-500 focus:ring-rose-500"
                    />
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-rose-700 text-white font-bold text-xs shadow-md shadow-rose-200 hover:brightness-110 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                    disabled={busy || notes === (selected.internal_notes || '')}
                    onClick={() => patchEnquiry({ internal_notes: notes })}
                  >
                    {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Internal Notes
                  </button>
                </div>
              </article>
            )}
          </div>
        ) : <AdminEmptyState title="No enquiries found" description="No contact enquiries match the current filters." />}

      </AdminPanel>
      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}

