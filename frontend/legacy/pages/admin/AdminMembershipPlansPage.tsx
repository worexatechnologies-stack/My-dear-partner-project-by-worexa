'use client';

import { useCallback, useEffect, useState } from 'react';
import { Award, Edit3, LoaderCircle, Plus, RefreshCw, Trash2, Percent } from 'lucide-react';
import { fetchApi } from '../../services/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import {
  AdminConfirmDialog, AdminEmptyState, AdminErrorState, AdminLoading,
  AdminModal, AdminPageHeader, AdminPanel, AdminStatusBadge, AdminToast,
} from '../../components/admin/AdminUI';

interface MembershipPlan {
  id: string;
  name: string;
  slug: string;
  price: string | number;
  duration: string;
  features: string[];
  highlighted: boolean;
  badge: string;
  color: string;
  description: string;
  currency: string;
  duration_days: number;
  is_active: boolean;
  is_featured: boolean;
  display_order: number;
  max_photos: number;
  profile_view_limit_daily: number;
  interest_limit_daily: number;
  message_limit_daily: number;
  can_message: boolean;
  can_view_profile_visitors: boolean;
  can_view_private_photos: boolean;
  can_get_priority_listing: boolean;
  can_use_profile_boost: boolean;
  can_view_received_interests: boolean;
  contact_access_mode: 'NONE' | 'MUTUAL_ONLY' | 'FULL';
  photo_access_mode: 'PRIMARY_ONLY' | 'ALL_APPROVED';
  can_use_advanced_search: boolean;
  can_use_horoscope: boolean;
  profile_boost_level: string;
  support_priority: string;
  price_3m?: string;
  discount_3m?: string;
  price_6m?: string;
  discount_6m?: string;
  price_1y?: string;
  discount_1y?: string;
}

type PlanFormState = {
  name: string;
  slug: string;
  price: string;
  duration: string;
  featuresText: string;
  highlighted: boolean;
  badge: string;
  color: string;
  description: string;
  currency: string;
  duration_days: string;
  is_active: boolean;
  is_featured: boolean;
  display_order: string;
  profile_view_limit_daily: string;
  interest_limit_daily: string;
  message_limit_daily: string;
  max_photos: string;
  can_message: boolean;
  can_view_profile_visitors: boolean;
  can_view_private_photos: boolean;
  can_get_priority_listing: boolean;
  can_use_profile_boost: boolean;
  can_view_received_interests: boolean;
  contact_access_mode: 'NONE' | 'MUTUAL_ONLY' | 'FULL';
  photo_access_mode: 'PRIMARY_ONLY' | 'ALL_APPROVED';
  can_use_advanced_search: boolean;
  can_use_horoscope: boolean;
  profile_boost_level: string;
  support_priority: string;
  price_3m: string;
  discount_3m: string;
  price_6m: string;
  discount_6m: string;
  price_1y: string;
  discount_1y: string;
};

const calcDiscount = (fullPrice: number, tierPrice: number): string => {
  if (!fullPrice || !tierPrice || tierPrice >= fullPrice) return '';
  const pct = Math.round((1 - tierPrice / fullPrice) * 100);
  return `${pct}% OFF`;
};

const emptyPlanForm: PlanFormState = {
  name: '',
  slug: '',
  price: '',
  duration: '',
  featuresText: '',
  highlighted: false,
  badge: '',
  color: 'from-rose-500 to-pink-600',
  description: '',
  currency: 'INR',
  duration_days: '30',
  is_active: true,
  is_featured: false,
  display_order: '0',
  profile_view_limit_daily: '10',
  interest_limit_daily: '3',
  message_limit_daily: '0',
  max_photos: '6',
  can_message: false,
  can_view_profile_visitors: false,
  can_view_private_photos: false,
  can_get_priority_listing: false,
  can_use_profile_boost: false,
  can_view_received_interests: false,
  contact_access_mode: 'NONE',
  photo_access_mode: 'PRIMARY_ONLY',
  can_use_advanced_search: false,
  can_use_horoscope: false,
  profile_boost_level: 'NONE',
  support_priority: 'STANDARD',
  price_3m: '',
  discount_3m: '',
  price_6m: '',
  discount_6m: '',
  price_1y: '',
  discount_1y: '',
};

const messageFrom = (error: unknown) => (
  error instanceof Error ? error.message : 'The request could not be completed.'
);

export default function AdminMembershipPlansPage() {
  const { user, hasAdminPermission } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [plansError, setPlansError] = useState('');
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [planFormOpen, setPlanFormOpen] = useState(false);
  const [planForm, setPlanForm] = useState({ ...emptyPlanForm });
  const [planDeleteTarget, setPlanDeleteTarget] = useState<MembershipPlan | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const isSuperAdmin = user?.account_type === 'SUPER_ADMIN';
  const canEdit = isSuperAdmin;

  const loadPlans = useCallback(async () => {
    setPlansLoading(true);
    setPlansError('');
    try {
      const data = await fetchApi<any>('/admin/membership-plans/?page_size=100');
      const list = Array.isArray(data) ? data : (data?.results ?? []);
      setPlans(list as MembershipPlan[]);
    } catch (err) {
      setPlansError(messageFrom(err));
    } finally {
      setPlansLoading(false);
    }
  }, []);

  useEffect(() => { void loadPlans(); }, [loadPlans]);

  const startEditPlan = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      price: String(plan.price),
      duration: plan.duration,
      featuresText: (plan.features || []).join('\n'),
      highlighted: plan.highlighted,
      badge: plan.badge || '',
      color: plan.color || 'from-rose-500 to-pink-600',
      description: plan.description || '',
      currency: plan.currency || 'INR',
      duration_days: String(plan.duration_days ?? 30),
      is_active: plan.is_active ?? true,
      is_featured: plan.is_featured ?? false,
      display_order: String(plan.display_order ?? 0),
      profile_view_limit_daily: String(plan.profile_view_limit_daily ?? 10),
      interest_limit_daily: String(plan.interest_limit_daily ?? 3),
      message_limit_daily: plan.message_limit_daily === null || plan.message_limit_daily === undefined ? '' : String(plan.message_limit_daily),
      max_photos: String(plan.max_photos ?? 6),
      can_message: plan.can_message ?? false,
      can_view_profile_visitors: plan.can_view_profile_visitors ?? false,
      can_view_private_photos: plan.can_view_private_photos ?? false,
      can_get_priority_listing: plan.can_get_priority_listing ?? false,
      can_use_profile_boost: plan.can_use_profile_boost ?? false,
      can_view_received_interests: plan.can_view_received_interests ?? false,
      contact_access_mode: plan.contact_access_mode || 'NONE',
      photo_access_mode: plan.photo_access_mode || 'PRIMARY_ONLY',
      can_use_advanced_search: plan.can_use_advanced_search ?? false,
      can_use_horoscope: plan.can_use_horoscope ?? false,
      profile_boost_level: plan.profile_boost_level || 'NONE',
      support_priority: plan.support_priority || 'STANDARD',
      price_3m: String((plan as any).price_3m ?? ''),
      discount_3m: String((plan as any).discount_3m ?? calcDiscount(parseFloat(String(plan.price)) * 3, parseFloat(String((plan as any).price_3m)) || 0)),
      price_6m: String((plan as any).price_6m ?? ''),
      discount_6m: String((plan as any).discount_6m ?? calcDiscount(parseFloat(String(plan.price)) * 6, parseFloat(String((plan as any).price_6m)) || 0)),
      price_1y: String((plan as any).price_1y ?? ''),
      discount_1y: String((plan as any).discount_1y ?? calcDiscount(parseFloat(String(plan.price)) * 12, parseFloat(String((plan as any).price_1y)) || 0)),
    });
    setPlanFormOpen(true);
  };

  const handleSavePlan = async () => {
    if (!planForm.name || !planForm.slug || !planForm.price || !planForm.duration) {
      setToast({ message: 'Please fill in all required fields.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const payload = {
        name: planForm.name,
        slug: planForm.slug,
        price: parseFloat(planForm.price) || 0,
        duration: planForm.duration,
        features: planForm.featuresText.split('\n').map((f) => f.trim()).filter(Boolean),
        highlighted: planForm.highlighted,
        badge: planForm.badge,
        color: planForm.color,
        description: planForm.description,
        currency: planForm.currency,
        duration_days: parseInt(planForm.duration_days) || 30,
        is_active: planForm.is_active,
        is_featured: planForm.is_featured,
        display_order: parseInt(planForm.display_order) || 0,
        max_photos: Math.max(1, parseInt(planForm.max_photos) || 6),
        profile_view_limit_daily: parseInt(planForm.profile_view_limit_daily) || 10,
        interest_limit_daily: parseInt(planForm.interest_limit_daily) || 3,
        message_limit_daily: planForm.message_limit_daily === '' ? null : parseInt(planForm.message_limit_daily) || 0,
        can_message: planForm.can_message,
        can_view_profile_visitors: planForm.can_view_profile_visitors,
        can_view_private_photos: planForm.can_view_private_photos,
        can_get_priority_listing: planForm.can_get_priority_listing,
        can_use_profile_boost: planForm.can_use_profile_boost,
        can_view_received_interests: planForm.can_view_received_interests,
        contact_access_mode: planForm.contact_access_mode,
        photo_access_mode: planForm.photo_access_mode,
        can_use_advanced_search: planForm.can_use_advanced_search,
        can_use_horoscope: planForm.can_use_horoscope,
        profile_boost_level: planForm.profile_boost_level,
        support_priority: planForm.support_priority,
        price_3m: planForm.price_3m ? parseFloat(planForm.price_3m) : null,
        discount_3m: planForm.discount_3m,
        price_6m: planForm.price_6m ? parseFloat(planForm.price_6m) : null,
        discount_6m: planForm.discount_6m,
        price_1y: planForm.price_1y ? parseFloat(planForm.price_1y) : null,
        discount_1y: planForm.discount_1y,
      };

      if (editingPlan) {
        const saved = await fetchApi<MembershipPlan>(`/admin/membership-plans/${editingPlan.id}/`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setPlans((rows) => rows.map((r) => (r.id === saved.id ? saved : r)));
        setToast({ message: 'Plan updated successfully.', tone: 'success' });
      } else {
        const saved = await fetchApi<MembershipPlan>('/admin/membership-plans/', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setPlans((rows) => [...rows, saved]);
        setToast({ message: 'Plan created successfully.', tone: 'success' });
      }
      setPlanFormOpen(false);
    } catch (err) {
      setToast({ message: messageFrom(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const togglePlanActive = async (plan: MembershipPlan) => {
    if (!canEdit) {
      setToast({ message: 'Only Super Admin can change membership plans.', tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const saved = await fetchApi<MembershipPlan>(`/admin/membership-plans/${plan.id}/`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !plan.is_active }),
      });
      setPlans((rows) => rows.map((r) => (r.id === saved.id ? saved : r)));
      setToast({ message: `Plan ${saved.is_active ? 'activated' : 'deactivated'} successfully.`, tone: 'success' });
    } catch (err) {
      setToast({ message: messageFrom(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!planDeleteTarget) return;
    setBusy(true);
    try {
      const res = await fetchApi<{ message?: string }>(`/admin/membership-plans/${planDeleteTarget.id}/`, {
        method: 'DELETE',
      });
      setPlans((rows) => rows.filter((r) => r.id !== planDeleteTarget.id));
      setToast({ message: res.message || 'Plan deleted successfully.', tone: 'success' });
      setPlanDeleteTarget(null);
      void loadPlans();
    } catch (err) {
      setToast({ message: messageFrom(err), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const startCreatePlan = () => {
    setEditingPlan(null);
    setPlanForm({ ...emptyPlanForm });
    setPlanFormOpen(true);
  };

  if (plansLoading && !plans.length) return <AdminLoading label="Loading membership plans…" />;
  if (plansError && !plans.length) return <AdminErrorState message={plansError} onRetry={loadPlans} />;

  return (
    <>
      <AdminPageHeader
        eyebrow="Commercial policy"
        title="Membership Plans"
        description="Define the tiers seekers can buy. Changes take effect for new purchases immediately."
        actions={(
          <>
            <button type="button" className="admin-btn admin-btn-secondary" onClick={loadPlans}><RefreshCw /> Refresh</button>
            {canEdit && (
              <button type="button" className="admin-btn admin-btn-primary" onClick={startCreatePlan}><Plus /> New Plan</button>
            )}
          </>
        )}
      />

      <AdminPanel className="admin-table-panel">
        {plansError && <div className="admin-inline-error">{plansError}</div>}
        {plans.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Price</th>
                  <th>Duration</th>
                  <th>Status</th>
                  <th>Order</th>
                  {canEdit && <th className="admin-table-actions-heading">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id}>
                    <td data-label="Plan">
                      <p className="admin-cell-stack">
                        <strong>{plan.name}</strong>
                        <small>{plan.slug}{plan.badge ? ` · ${plan.badge}` : ''}</small>
                      </p>
                    </td>
                    <td data-label="Price"><span className="admin-money-cell">{plan.currency} {plan.price}</span></td>
                    <td data-label="Duration"><span className="admin-muted-cell">{plan.duration}</span></td>
                    <td data-label="Status"><AdminStatusBadge status={plan.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
                    <td data-label="Order"><span className="admin-muted-cell">{plan.display_order}</span></td>
                    {canEdit && (
                      <td className="admin-row-actions" data-label="Actions">
                        <button type="button" className="admin-btn admin-btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }} onClick={() => startEditPlan(plan)}>
                          <Edit3 /> Edit
                        </button>
                        <button type="button" className="admin-btn admin-btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }} onClick={() => togglePlanActive(plan)}>
                          {plan.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button type="button" className="admin-btn admin-btn-danger" style={{ padding: '0.3rem 0.6rem', fontSize: '0.78rem' }} onClick={() => setPlanDeleteTarget(plan)}>
                          <Trash2 /> Delete
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <AdminEmptyState
            title="No membership plans"
            description="Create your first plan to start offering memberships."
            action={canEdit ? (
              <button type="button" className="admin-btn admin-btn-primary" onClick={startCreatePlan}>
                <Plus /> Create First Plan
              </button>
            ) : undefined}
          />
        )}
      </AdminPanel>

      {/* Plan Create / Edit Modal */}
      <AdminModal
        open={planFormOpen}
        title={editingPlan ? 'Edit Membership Plan' : 'Create Membership Plan'}
        onClose={() => setPlanFormOpen(false)}
      >
        <div className="admin-plan-form">
          <section className="admin-form-section">
            <header className="admin-form-section__head">
              <h3>Core Details</h3>
              <p>Identity and pricing for this membership tier.</p>
            </header>
            <div className="admin-form-grid admin-form-grid--2">
              <label className="admin-form-field">
                <span>Plan Name <em>*</em></span>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Gold"
                  disabled={!canEdit}
                />
              </label>
              <label className="admin-form-field">
                <span>Slug <em>*</em></span>
                <input
                  type="text"
                  value={planForm.slug}
                  onChange={(e) => setPlanForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }))}
                  placeholder="e.g. gold"
                  disabled={Boolean(editingPlan) || !canEdit}
                />
                <small>Unique URL key. Cannot be changed after creation.</small>
              </label>
              <label className="admin-form-field">
                <span>Maximum photos</span>
                <input
                  type="number"
                  min="1"
                  value={planForm.max_photos}
                  onChange={(e) => setPlanForm((f) => ({ ...f, max_photos: e.target.value }))}
                  disabled={!canEdit}
                />
              </label>
              <label className="admin-form-field">
                <span>Ribbon Badge</span>
                <input
                  type="text"
                  value={planForm.badge}
                  onChange={(e) => setPlanForm((f) => ({ ...f, badge: e.target.value }))}
                  placeholder="e.g. ✦ Most Popular"
                  disabled={!canEdit}
                />
              </label>
            </div>
          </section>

          <section className="admin-form-section">
            <header className="admin-form-section__head">
              <h3>Pricing & Duration</h3>
              <p>Billing amount and how long the plan stays active.</p>
            </header>
            <div className="admin-form-grid admin-form-grid--3">
              <label className="admin-form-field">
                <span>Price <em>*</em></span>
                <input
                  type="number"
                  value={planForm.price}
                  onChange={(e) => setPlanForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="e.g. 2999"
                  disabled={!canEdit}
                />
              </label>
              <label className="admin-form-field">
                <span>Currency</span>
                <input
                  type="text"
                  value={planForm.currency}
                  onChange={(e) => setPlanForm((f) => ({ ...f, currency: e.target.value }))}
                  placeholder="INR"
                  disabled={!canEdit}
                />
              </label>
              <label className="admin-form-field">
                <span>Display Order</span>
                <input
                  type="number"
                  value={planForm.display_order}
                  onChange={(e) => setPlanForm((f) => ({ ...f, display_order: e.target.value }))}
                  placeholder="1"
                  disabled={!canEdit}
                />
              </label>
              <label className="admin-form-field">
                <span>Duration label <em>*</em></span>
                <input
                  type="text"
                  value={planForm.duration}
                  onChange={(e) => setPlanForm((f) => ({ ...f, duration: e.target.value }))}
                  placeholder="e.g. 3 Months"
                  disabled={!canEdit}
                />
              </label>
              <label className="admin-form-field">
                <span>Duration in Days <em>*</em></span>
                <input
                  type="number"
                  value={planForm.duration_days}
                  onChange={(e) => setPlanForm((f) => ({ ...f, duration_days: e.target.value }))}
                  placeholder="90"
                  disabled={!canEdit}
                />
                <small>Use 36500 for an unlimited plan.</small>
              </label>
            </div>
            <label className="admin-form-field admin-form-field--full">
              <span>Description</span>
              <input
                type="text"
                value={planForm.description}
                onChange={(e) => setPlanForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g. Premium match features"
                disabled={!canEdit}
              />
            </label>

            {/* Duration-Based Multi-Tier Pricing & Discounts */}
            <div className="mt-6 border-t border-slate-200 pt-4">
              <header className="mb-3">
                <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-emerald-600" />
                  Duration-Based Tiered Discounts & Billing Options
                </h4>
                <p className="text-xs text-slate-500">Configure prices and discount badges for 1 Month, 3 Months, 6 Months, and 1 Year (12M) cycles.</p>
              </header>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-700 block mb-1">1 Month (Base)</span>
                  <input
                    type="number"
                    value={planForm.price}
                    onChange={(e) => {
                      const base = parseFloat(e.target.value) || 0;
                      setPlanForm((f) => ({
                        ...f,
                        price: e.target.value,
                        discount_3m: base && f.price_3m ? calcDiscount(base * 3, parseFloat(f.price_3m)) : f.discount_3m,
                        discount_6m: base && f.price_6m ? calcDiscount(base * 6, parseFloat(f.price_6m)) : f.discount_6m,
                        discount_1y: base && f.price_1y ? calcDiscount(base * 12, parseFloat(f.price_1y)) : f.discount_1y,
                      }));
                    }}
                    className="w-full text-xs font-bold p-2 border rounded-lg border-slate-300"
                    placeholder="e.g. 999"
                    disabled={!canEdit}
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block font-medium">Monthly Standard Rate</span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-700 block mb-1">3 Months Tier</span>
                  <input
                    type="number"
                    value={planForm.price_3m}
                    onChange={(e) => {
                      setPlanForm((f) => ({
                        ...f,
                        price_3m: e.target.value,
                        discount_3m: calcDiscount(parseFloat(f.price) * 3, parseFloat(e.target.value) || 0),
                      }));
                    }}
                    className="w-full text-xs font-bold p-2 border rounded-lg border-slate-300 mb-1"
                    placeholder="e.g. 2499"
                    disabled={!canEdit}
                  />
                  <input
                    type="text"
                    value={planForm.discount_3m}
                    readOnly
                    className="w-full text-[11px] p-1.5 border rounded border-emerald-300 text-emerald-700 font-bold bg-emerald-50"
                    placeholder="Auto-calculated"
                    disabled={!canEdit}
                  />
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-700 block mb-1">6 Months Tier</span>
                  <input
                    type="number"
                    value={planForm.price_6m}
                    onChange={(e) => {
                      setPlanForm((f) => ({
                        ...f,
                        price_6m: e.target.value,
                        discount_6m: calcDiscount(parseFloat(f.price) * 6, parseFloat(e.target.value) || 0),
                      }));
                    }}
                    className="w-full text-xs font-bold p-2 border rounded-lg border-slate-300 mb-1"
                    placeholder="e.g. 4499"
                    disabled={!canEdit}
                  />
                  <input
                    type="text"
                    value={planForm.discount_6m}
                    readOnly
                    className="w-full text-[11px] p-1.5 border rounded border-emerald-300 text-emerald-700 font-bold bg-emerald-50"
                    placeholder="Auto-calculated"
                    disabled={!canEdit}
                  />
                </div>

                <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                  <span className="text-xs font-bold text-slate-700 block mb-1">1 Year Tier (12M)</span>
                  <input
                    type="number"
                    value={planForm.price_1y}
                    onChange={(e) => {
                      setPlanForm((f) => ({
                        ...f,
                        price_1y: e.target.value,
                        discount_1y: calcDiscount(parseFloat(f.price) * 12, parseFloat(e.target.value) || 0),
                      }));
                    }}
                    className="w-full text-xs font-bold p-2 border rounded-lg border-slate-300 mb-1"
                    placeholder="e.g. 6999"
                    disabled={!canEdit}
                  />
                  <input
                    type="text"
                    value={planForm.discount_1y}
                    readOnly
                    className="w-full text-[11px] p-1.5 border rounded border-emerald-300 text-emerald-700 font-bold bg-emerald-50"
                    placeholder="Auto-calculated"
                    disabled={!canEdit}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="admin-form-section">
            <header className="admin-form-section__head">
              <h3>Entitlements & Daily Limits</h3>
              <p>Defines what subscribers can do and how often, per day.</p>
            </header>
            <div className="admin-form-grid admin-form-grid--3">
              <label className="admin-form-field">
                <span>Daily Profile Views</span>
                <input
                  type="number"
                  value={planForm.profile_view_limit_daily}
                  onChange={(e) => setPlanForm((f) => ({ ...f, profile_view_limit_daily: e.target.value }))}
                  disabled={!canEdit}
                />
              </label>
              <label className="admin-form-field">
                <span>Daily Interests</span>
                <input
                  type="number"
                  value={planForm.interest_limit_daily}
                  onChange={(e) => setPlanForm((f) => ({ ...f, interest_limit_daily: e.target.value }))}
                  disabled={!canEdit}
                />
              </label>
              <label className="admin-form-field">
                <span>Daily Messages</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={planForm.message_limit_daily}
                    onChange={(e) => setPlanForm((f) => ({ ...f, message_limit_daily: e.target.value }))}
                    disabled={!canEdit || planForm.message_limit_daily === ''}
                    className={planForm.message_limit_daily === '' ? 'opacity-40' : ''}
                  />
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={planForm.message_limit_daily === ''}
                      onChange={(e) => setPlanForm((f) => ({ ...f, message_limit_daily: e.target.checked ? '' : '0' }))}
                      disabled={!canEdit}
                    />
                    Unlimited
                  </label>
                </div>
              </label>
              <label className="admin-form-field">
                <span>Contact Access Mode</span>
                <select
                  value={planForm.contact_access_mode}
                  onChange={(e) => setPlanForm((f) => ({ ...f, contact_access_mode: e.target.value as 'NONE' | 'MUTUAL_ONLY' | 'FULL' }))}
                  disabled={!canEdit}
                >
                  <option value="NONE">None</option>
                  <option value="MUTUAL_ONLY">Mutual Accepted Only</option>
                  <option value="FULL">Full Access</option>
                </select>
              </label>
              <label className="admin-form-field">
                <span>Photo Access Mode</span>
                <select
                  value={planForm.photo_access_mode}
                  onChange={(e) => setPlanForm((f) => ({ ...f, photo_access_mode: e.target.value as 'PRIMARY_ONLY' | 'ALL_APPROVED' }))}
                  disabled={!canEdit}
                >
                  <option value="PRIMARY_ONLY">Primary Photo Only</option>
                  <option value="ALL_APPROVED">All Approved Photos</option>
                </select>
              </label>
              <label className="admin-form-field">
                <span>Profile Boost Level</span>
                <select
                  value={planForm.profile_boost_level}
                  onChange={(e) => setPlanForm((f) => ({ ...f, profile_boost_level: e.target.value }))}
                  disabled={!canEdit}
                >
                  <option value="NONE">None</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="STRONG">Strong</option>
                </select>
              </label>
              <label className="admin-form-field">
                <span>Support Priority</span>
                <select
                  value={planForm.support_priority}
                  onChange={(e) => setPlanForm((f) => ({ ...f, support_priority: e.target.value }))}
                  disabled={!canEdit}
                >
                  <option value="STANDARD">Standard</option>
                  <option value="HIGH">High</option>
                </select>
              </label>
            </div>

            <div className="admin-form-toggles">
              {[
                ['can-message', 'Allow messaging', 'can_message'],
                ['can-use-advanced-search', 'Advanced search', 'can_use_advanced_search'],
                ['can-use-horoscope', 'Horoscope compatibility', 'can_use_horoscope'],
                ['can-view-profile-visitors', 'Show profile visitors', 'can_view_profile_visitors'],
                ['can-view-private-photos', 'View private photos', 'can_view_private_photos'],
                ['can-view-received-interests', 'View received interests', 'can_view_received_interests'],
                ['can-get-priority-listing', 'Priority listing', 'can_get_priority_listing'],
                ['can-use-profile-boost', 'Profile boost', 'can_use_profile_boost'],
              ].map(([id, label, field]) => (
                <label className="admin-toggle" key={id}>
                  <input
                    type="checkbox"
                    id={id}
                    checked={Boolean(planForm[field as keyof typeof planForm])}
                    onChange={(e) => setPlanForm((form) => ({ ...form, [field]: e.target.checked }))}
                    disabled={!canEdit}
                  />
                  <span className="admin-toggle__track" aria-hidden="true"><span className="admin-toggle__thumb" /></span>
                  <span className="admin-toggle__label">{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="admin-form-section">
            <header className="admin-form-section__head">
              <h3>Visual Theme & Highlights</h3>
              <p>Controls how this plan appears on the public membership page.</p>
            </header>
            <div className="admin-form-grid admin-form-grid--2">
              <label className="admin-form-field">
                <span>Gradient CSS Theme Classes</span>
                <input
                  type="text"
                  value={planForm.color}
                  onChange={(e) => setPlanForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="e.g. from-amber-500 to-yellow-600"
                  disabled={!canEdit}
                />
                <small>Tailwind gradient classes applied to the plan card.</small>
              </label>
              <label className="admin-form-field">
                <span>Plan Features Summary</span>
                <textarea
                  value={planForm.featuresText}
                  onChange={(e) => setPlanForm((f) => ({ ...f, featuresText: e.target.value }))}
                  placeholder={'One feature per line\nUnlimited interests\nAdvanced search filters\nDirect messaging'}
                  rows={4}
                  disabled={!canEdit}
                />
                <small>Each line becomes a bullet point on the plan card.</small>
              </label>
            </div>
            <label className="admin-toggle admin-toggle--inline">
              <input
                type="checkbox"
                id="plan-highlighted"
                checked={planForm.highlighted}
                onChange={(e) => setPlanForm((f) => ({ ...f, highlighted: e.target.checked }))}
                disabled={!canEdit}
              />
              <span className="admin-toggle__track" aria-hidden="true"><span className="admin-toggle__thumb" /></span>
              <span className="admin-toggle__label">Highlight plan card</span>
            </label>
          </section>

          <div className="admin-form-actions">
            <button type="button" className="admin-btn admin-btn-secondary" onClick={() => setPlanFormOpen(false)}>
              Cancel
            </button>
            {canEdit && (
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                onClick={handleSavePlan}
                disabled={busy || !planForm.name || !planForm.slug || !planForm.price || !planForm.duration}
              >
                {busy ? <LoaderCircle className="admin-spinner" /> : null}{' '}
                {editingPlan ? 'Save changes' : 'Create Plan'}
              </button>
            )}
          </div>
        </div>
      </AdminModal>

      <AdminConfirmDialog
        open={Boolean(planDeleteTarget)}
        title="Delete this membership plan?"
        description="This permanently removes the plan. Plans with active subscribers should be deactivated instead to protect subscriber records."
        confirmLabel="Delete Plan"
        dangerous
        busy={busy}
        onCancel={() => setPlanDeleteTarget(null)}
        onConfirm={handleDeletePlan}
      />

      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
