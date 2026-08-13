'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Save, Sliders, ShieldCheck, CreditCard, Mail, Bell, Settings, Lock, Database, Trash2, Plus } from 'lucide-react';
import { fetchApi } from '../../services/apiClient';
import { AdminErrorState, AdminLoading, AdminPageHeader, AdminPanel, AdminToast } from '../../components/admin/AdminUI';

interface Setting { key: string; value: unknown; description: string; is_public: boolean; updated_at: string }
interface Backup { id: string; status: string; storage_path: string; size_bytes: number; error_message: string; created_at: string; completed_at?: string }

// Exactly the 15 enterprise configuration categories requested
const CONFIG_TABS = [
  { key: 'GENERAL', label: 'General', icon: Sliders, desc: 'Application Name, contact info and maintenance mode.' },
  { key: 'BRANDING', label: 'Branding', icon: Sliders, desc: 'Corporate branding, logos, favicons, and accent colors.' },
  { key: 'REGISTRATION', label: 'Registration', icon: ShieldCheck, desc: 'Onboarding policies and verification requirements.' },
  { key: 'VERIFICATION', label: 'Verification', icon: ShieldCheck, desc: 'Identity checklist documents and AI checks.' },
  { key: 'PAYMENTS', label: 'Payments', icon: CreditCard, desc: 'Manual approval, currency, and refund policies.' },
  { key: 'NOTIFICATIONS', label: 'Notifications', icon: Bell, desc: 'WhatsApp notifications, push messages, and system alerts.' },
  { key: 'EMAIL', label: 'Email', icon: Mail, desc: 'SMTP server host, port, username, password and templates.' },
  { key: 'SMS_OTP', label: 'SMS/OTP', icon: Bell, desc: 'SMS gateway keys and OTP verification rules.' },
  { key: 'SUPPORT', label: 'Support', icon: Settings, desc: 'Support category SLAs and automated queue routings.' },
  { key: 'SECURITY', label: 'Security', icon: Lock, desc: 'Password complexity, timeout limits, max failed logins, and 2FA.' },
  { key: 'STORAGE', label: 'Storage', icon: Database, desc: 'Primary media file bucket providers and upload size limits.' },
  { key: 'BACKUPS', label: 'Backups', icon: Database, desc: 'Automatic relational snapshot schedules.' },
  { key: 'FEATURE_FLAGS', label: 'Feature Flags', icon: Settings, desc: 'Toggle optional modules (Astrology, MBTI, Chat).' },
  { key: 'ANALYTICS', label: 'Analytics', icon: Sliders, desc: 'Dashboard report widgets and data charts config.' }
];

interface SecretInputProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  description?: string;
}

const SecretInput: React.FC<SecretInputProps> = ({ label, value, onChange, description }) => {
  const [isEditing, setIsEditing] = useState(false);
  const isConfigured = value && value !== '';

  return (
    <div className="admin-form-field flex flex-col gap-1 w-full">
      <span className="font-semibold text-gray-700 text-xs">{label}</span>
      {isConfigured && !isEditing ? (
        <div className="flex items-center gap-2 mt-1">
          <span className="px-3 py-1.5 bg-green-50 border border-green-200 text-green-700 text-xs font-bold rounded-xl select-none">
            âœ“ Configured
          </span>
          <button
            type="button"
            onClick={() => {
              setIsEditing(true);
              onChange(''); // Clear value to replace
            }}
            className="py-1 px-3 border border-gray-200 hover:bg-gray-50 text-gray-700 text-[11px] font-bold rounded-lg cursor-pointer transition-colors"
          >
            Replace secret
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 mt-1">
          <input
            type="password"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={isEditing ? 'Enter new secret' : 'Not configured'}
            className="w-full px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-rose-500"
          />
          {isEditing && (
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                onChange('********'); // Revert configuration mask
              }}
              className="py-1 px-3 text-xs text-gray-500 hover:text-gray-700 font-bold cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      )}
      {description && <small className="text-gray-400 mt-1 text-[10px]">{description}</small>}
    </div>
  );
};

interface EnvSettingNoticeProps {
  label: string;
  value: string;
}

const EnvSettingNotice: React.FC<EnvSettingNoticeProps> = ({ label, value }) => {
  return (
    <div className="admin-form-field flex flex-col gap-1 w-full">
      <span className="font-semibold text-gray-700 text-xs">{label}</span>
      <div className="flex flex-col p-3 bg-gray-50 border border-gray-150 rounded-2xl gap-1 mt-1 text-xs text-gray-500">
        <div className="font-semibold text-gray-700">Value: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-gray-600 font-mono text-[10px]">{value || 'Configured'}</code></div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          This setting is managed through the production environment and cannot be changed from the dashboard.
        </div>
      </div>
    </div>
  );
};

export default function AdminSystemPage({ mode }: { mode: 'settings' | 'backups' }) {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('GENERAL');
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  
  // Track modified settings in local state
  const [formState, setFormState] = useState<Record<string, any>>({});
  
  const getDbKey = (tab: string) => {
    switch (tab) {
      case 'BRANDING': return 'GENERAL';
      case 'SMS_OTP': return 'NOTIFICATIONS';
      case 'PAYMENTS': return 'PAYMENT';
      case 'BACKUPS': return 'BACKUP';
      case 'ANALYTICS': return 'GENERAL';
      default: return tab;
    }
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      if (mode === 'settings') {
        const data = await fetchApi<Setting[]>('/admin/settings/');
        setSettings(data);
        const initialForm: Record<string, any> = {};
        data.forEach(item => {
          initialForm[item.key] = item.value || {};
        });
        setFormState(initialForm);
      } else {
        setBackups(await fetchApi<Backup[]>('/admin/backups/'));
      }
    } catch (err) { 
      setError(err instanceof Error ? err.message : 'System data could not be loaded.'); 
    } finally { 
      setLoading(false); 
    }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  const updateFormField = (settingKey: string, fieldPath: string, newValue: any) => {
    setFormState(prev => {
      const currentVal = { ...prev[settingKey] };
      
      if (fieldPath.includes('.')) {
        const parts = fieldPath.split('.');
        let temp = currentVal;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!temp[parts[i]]) temp[parts[i]] = {};
          temp[parts[i]] = { ...temp[parts[i]] };
          temp = temp[parts[i]];
        }
        temp[parts[parts.length - 1]] = newValue;
      } else {
        currentVal[fieldPath] = newValue;
      }

      return {
        ...prev,
        [settingKey]: currentVal
      };
    });
  };

  const save = async (tabKey: string) => {
    const dbKey = getDbKey(tabKey);
    const original = settings.find(s => s.key === dbKey);
    if (!original) return;
    
    const valueToSave = formState[dbKey];
    
    // Validations
    if (tabKey === 'SECURITY') {
      const minLength = Number(valueToSave.password_min_length);
      if (isNaN(minLength) || minLength < 4 || minLength > 32) {
        setToast({ message: 'Password length limit must be between 4 and 32 characters.', tone: 'error' });
        return;
      }
    }

    try {
      const payload = {
        key: dbKey,
        value: valueToSave,
        description: original.description,
        is_public: original.is_public
      };
      const updated = await fetchApi<Setting>('/admin/settings/', { 
        method: 'PATCH', 
        body: JSON.stringify(payload) 
      });
      setSettings((rows) => rows.map((row) => row.key === updated.key ? updated : row));
      setToast({ message: `${CONFIG_TABS.find(t => t.key === tabKey)?.label} settings saved successfully.`, tone: 'success' });
    } catch (err) { 
      setToast({ message: err instanceof Error ? err.message : 'Setting could not be saved.', tone: 'error' }); 
    }
  };

  const triggerBackup = async () => {
    try {
      const response = await fetchApi<Backup>('/admin/backups/', { method: 'POST' });
      setBackups(prev => [response, ...prev]);
      setToast({ message: 'Database backup task initiated successfully.', tone: 'success' });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : 'Could not launch backup.', tone: 'error' });
    }
  };

  if (loading) return <AdminLoading label={`Loading ${mode === 'settings' ? 'Platform Configuration' : 'Backup Records'}â€¦`} />;
  if (error) return <AdminErrorState message={error} onRetry={load} />;

  // Render settings page tab contents
  const renderSettingFields = (tabKey: string) => {
    const dbKey = getDbKey(tabKey);
    const val = formState[dbKey] || {};
    
    switch (tabKey) {
      case 'GENERAL':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <label className="admin-form-field">
                <span>Application Name</span>
                <input type="text" value={val.app_name || ''} onChange={e => updateFormField('GENERAL', 'app_name', e.target.value)} />
              </label>
              <label className="admin-form-field">
                <span>Support Email Address</span>
                <input type="email" value={val.contact_email || ''} onChange={e => updateFormField('GENERAL', 'contact_email', e.target.value)} />
              </label>
              <label className="admin-form-field">
                <span>Support Phone Number</span>
                <input type="text" value={val.contact_phone || ''} onChange={e => updateFormField('GENERAL', 'contact_phone', e.target.value)} />
              </label>
            </div>
            
            <label className="admin-form-field">
              <span>Footer Copyright Text</span>
              <input type="text" value={val.footer_text || ''} onChange={e => updateFormField('GENERAL', 'footer_text', e.target.value)} />
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', cursor: 'pointer', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={Boolean(val.maintenance_mode)} onChange={e => updateFormField('GENERAL', 'maintenance_mode', e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <strong style={{ color: '#b45309', fontSize: '0.9rem' }}>Enable Maintenance Mode</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#d97706' }}>This blocks access to members while preserving full admin capabilities.</p>
              </div>
            </label>
          </div>
        );

      case 'BRANDING':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <label className="admin-form-field">
                <span>Platform Logo URL</span>
                <input type="text" value={val.logo_url || ''} onChange={e => updateFormField('GENERAL', 'logo_url', e.target.value)} placeholder="https://" />
              </label>
              <label className="admin-form-field">
                <span>Favicon URL</span>
                <input type="text" value={val.favicon_url || ''} onChange={e => updateFormField('GENERAL', 'favicon_url', e.target.value)} placeholder="https://" />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <label className="admin-form-field">
                <span>Primary Corporate Color</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="color" value={val.primary_color || '#6f2845'} onChange={e => updateFormField('GENERAL', 'primary_color', e.target.value)} style={{ width: '48px', height: '42px', padding: 0 }} />
                  <input type="text" value={val.primary_color || ''} onChange={e => updateFormField('GENERAL', 'primary_color', e.target.value)} style={{ flex: 1 }} />
                </div>
              </label>
              <label className="admin-form-field">
                <span>Secondary Accent Color</span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="color" value={val.secondary_color || '#c99c53'} onChange={e => updateFormField('GENERAL', 'secondary_color', e.target.value)} style={{ width: '48px', height: '42px', padding: 0 }} />
                  <input type="text" value={val.secondary_color || ''} onChange={e => updateFormField('GENERAL', 'secondary_color', e.target.value)} style={{ flex: 1 }} />
                </div>
              </label>
            </div>
          </div>
        );

      case 'REGISTRATION':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(val.enable_registration)} onChange={e => updateFormField('REGISTRATION', 'enable_registration', e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Allow Member Registrations</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-muted)' }}>If turned off, no new registrations can be made via the public site.</p>
              </div>
            </label>

            <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '1rem', color: 'var(--admin-wine)' }}>Verification Rules</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.require_mobile_verification)} onChange={e => updateFormField('REGISTRATION', 'require_mobile_verification', e.target.checked)} />
                <span>Require Mobile SMS OTP verification during onboarding</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.require_profile_verification)} onChange={e => updateFormField('REGISTRATION', 'require_profile_verification', e.target.checked)} />
                <span>Require staff manual review before making profiles public</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.require_document_verification)} onChange={e => updateFormField('REGISTRATION', 'require_document_verification', e.target.checked)} />
                <span>Require ID Document upload before messaging capability matches</span>
              </label>
            </div>
          </div>
        );

      case 'VERIFICATION':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(val.ai_verification_enabled)} onChange={e => updateFormField('VERIFICATION', 'ai_verification_enabled', e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Enable AI document validation</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-muted)' }}>Automate ID verification checks with optical matching.</p>
              </div>
            </label>

            <div>
              <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--admin-ink)', marginBottom: '0.5rem' }}>Accepted verification documents</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {(val.required_documents || []).map((doc: string, idx: number) => (
                  <span key={idx} style={{ background: 'var(--admin-wine-soft, #f6eaf0)', color: 'var(--admin-wine, #6f2845)', padding: '0.25rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    {doc}
                    <button type="button" onClick={() => {
                      const list = [...(val.required_documents || [])];
                      list.splice(idx, 1);
                      updateFormField('VERIFICATION', 'required_documents', list);
                    }} style={{ border: 'none', background: 'none', padding: 0, color: 'var(--admin-wine)', display: 'inline-flex', alignSelf: 'center' }}>
                      <Trash2 size={12} />
                    </button>
                  </span>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" id="new_doc_input" placeholder="Add custom document (e.g. Driving License)" style={{ flex: 1 }} onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const inputEl = e.currentTarget;
                    const docText = inputEl.value.trim();
                    if (docText) {
                      const list = [...(val.required_documents || [])];
                      if (!list.includes(docText)) {
                        list.push(docText);
                        updateFormField('VERIFICATION', 'required_documents', list);
                      }
                      inputEl.value = '';
                    }
                  }
                }} />
                <button type="button" className="admin-btn admin-btn-secondary" onClick={() => {
                  const inputEl = document.getElementById('new_doc_input') as HTMLInputElement;
                  const docText = inputEl?.value?.trim();
                  if (docText) {
                    const list = [...(val.required_documents || [])];
                    if (!list.includes(docText)) {
                      list.push(docText);
                      updateFormField('VERIFICATION', 'required_documents', list);
                    }
                    inputEl.value = '';
                  }
                }}><Plus size={16} /> Add</button>
              </div>
            </div>
          </div>
        );



      case 'PAYMENTS':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <p style={{ margin: 0, color: 'var(--admin-muted)' }}>Membership requests are reviewed and activated manually. Online checkout and payment gateway credentials are intentionally unavailable.</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.25rem' }}>
              <label className="admin-form-field">
                <span>Base Transaction Currency</span>
                <input type="text" value={val.currency || 'INR'} onChange={e => updateFormField('PAYMENT', 'currency', e.target.value)} maxLength={3} />
              </label>
            </div>

            <label className="admin-form-field">
              <span>Automatic Refund Claim Validity Period (Days)</span>
              <input type="number" min="1" max="90" value={val.refund_days_limit || 7} onChange={e => updateFormField('PAYMENT', 'refund_days_limit', Number(e.target.value))} />
              <small style={{ color: 'var(--admin-muted)' }}>Claims after this period require Super Admin verification.</small>
            </label>
          </div>
        );

      case 'EMAIL':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '1.25rem' }}>
              <label className="admin-form-field">
                <span>SMTP Outgoing Server</span>
                <input type="text" value={val.smtp_host || ''} onChange={e => updateFormField('EMAIL', 'smtp_host', e.target.value)} placeholder="smtp.domain.com" />
              </label>
              <label className="admin-form-field">
                <span>SMTP Port</span>
                <input type="number" value={val.smtp_port || 587} onChange={e => updateFormField('EMAIL', 'smtp_port', Number(e.target.value))} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              <label className="admin-form-field">
                <span>SMTP Username</span>
                <input type="text" value={val.smtp_user || ''} onChange={e => updateFormField('EMAIL', 'smtp_user', e.target.value)} />
              </label>
              <SecretInput
                label="SMTP Password"
                value={val.smtp_password}
                onChange={v => updateFormField('EMAIL', 'smtp_password', v)}
                description="The password or app-specific credential of the SMTP username."
              />
            </div>

            <label className="admin-form-field">
              <span>Outgoing Mail Sender Address ("From")</span>
              <input type="email" value={val.from_email || ''} onChange={e => updateFormField('EMAIL', 'from_email', e.target.value)} />
            </label>

            <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '1rem', color: 'var(--admin-wine)' }}>Email Subject Lines</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <label className="admin-form-field">
                <span>Welcome Email Subject</span>
                <input type="text" value={val.templates?.welcome || ''} onChange={e => updateFormField('EMAIL', 'templates.welcome', e.target.value)} />
              </label>
              <label className="admin-form-field">
                <span>Verification OTP Subject</span>
                <input type="text" value={val.templates?.verification || ''} onChange={e => updateFormField('EMAIL', 'templates.verification', e.target.value)} />
              </label>
            </div>
          </div>
        );

      case 'NOTIFICATIONS':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(val.enable_whatsapp)} onChange={e => updateFormField('NOTIFICATIONS', 'enable_whatsapp', e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Enable WhatsApp Notifications</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-muted)' }}>Send match updates directly to member mobile devices.</p>
              </div>
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(val.enable_push)} onChange={e => updateFormField('NOTIFICATIONS', 'enable_push', e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Web Push Notifications</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-muted)' }}>Prompt for native web browser real-time alerts.</p>
              </div>
            </label>
          </div>
        );

      case 'SMS_OTP':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <SecretInput
              label="SMS Gateway API Key"
              value={val.sms_gateway_api_key}
              onChange={v => updateFormField('NOTIFICATIONS', 'sms_gateway_api_key', v)}
              description="Your key parameter for the SMS delivery gateway provider."
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={true} disabled />
              <span>Enable 2FA OTP security verification on all registrations</span>
            </label>
          </div>
        );

      case 'SUPPORT':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(val.auto_assignment_enabled)} onChange={e => updateFormField('SUPPORT', 'auto_assignment_enabled', e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Auto ticket assignment</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-muted)' }}>Triages and routes new tickets to support agents automatically.</p>
              </div>
            </label>

            <label className="admin-form-field">
              <span>SLA Escalation Limit (Hours)</span>
              <input type="number" min="1" max="168" value={val.escalation_hours || 24} onChange={e => updateFormField('SUPPORT', 'escalation_hours', Number(e.target.value))} />
              <small style={{ color: 'var(--admin-muted)' }}>Escalates ticket to Admin if unaddressed after this time.</small>
            </label>
          </div>
        );

      case 'SECURITY':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <label className="admin-form-field">
                <span>Minimum password length</span>
                <input type="number" min="6" max="32" value={val.password_min_length || 8} onChange={e => updateFormField('SECURITY', 'password_min_length', Number(e.target.value))} />
              </label>
              
              <label className="admin-form-field">
                <span>Maximum login failures before lock</span>
                <input type="number" min="3" max="10" value={val.max_login_attempts || 5} onChange={e => updateFormField('SECURITY', 'max_login_attempts', Number(e.target.value))} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
              <label className="admin-form-field">
                <span>Session Lifecycle Limit (Minutes)</span>
                <input type="number" min="5" max="1440" value={val.session_timeout_minutes || 30} onChange={e => updateFormField('SECURITY', 'session_timeout_minutes', Number(e.target.value))} />
              </label>
              
              <label className="admin-form-field">
                <span>JWT Access Token Lifetime (Hours)</span>
                <input type="number" min="1" max="168" value={val.jwt_lifetime_hours || 24} onChange={e => updateFormField('SECURITY', 'jwt_lifetime_hours', Number(e.target.value))} />
              </label>
            </div>

            <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '1rem', color: 'var(--admin-wine)' }}>Password Complexity Policy</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.password_require_uppercase)} onChange={e => updateFormField('SECURITY', 'password_require_uppercase', e.target.checked)} />
                <span>Require uppercase letter (A-Z)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.password_require_lowercase)} onChange={e => updateFormField('SECURITY', 'password_require_lowercase', e.target.checked)} />
                <span>Require lowercase letter (a-z)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.password_require_number)} onChange={e => updateFormField('SECURITY', 'password_require_number', e.target.checked)} />
                <span>Require numeric digit (0-9)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.password_require_special)} onChange={e => updateFormField('SECURITY', 'password_require_special', e.target.checked)} />
                <span>Require special character (@, $, !, etc.)</span>
              </label>
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer', marginTop: '0.5rem' }}>
              <input type="checkbox" checked={Boolean(val.enable_2fa)} onChange={e => updateFormField('SECURITY', 'enable_2fa', e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Enforce 2-Factor Authentication (2FA)</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-muted)' }}>Require a real verification code on login for admins.</p>
              </div>
            </label>
          </div>
        );

      case 'STORAGE':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label className="admin-form-field">
              <span>Primary Storage Provider</span>
              <select value={val.provider || 'local'} onChange={e => updateFormField('STORAGE', 'provider', e.target.value)}>
                <option value="local">Local Workspace Directories</option>
                <option value="s3">Amazon AWS S3 Bucket</option>
                <option value="r2">Cloudflare R2 Storage</option>
              </select>
            </label>

            {val.provider === 's3' && (
              <label className="admin-form-field">
                <span>AWS S3 Bucket Name</span>
                <input type="text" value={val.s3_bucket || ''} onChange={e => updateFormField('STORAGE', 's3_bucket', e.target.value)} />
              </label>
            )}

            {val.provider === 'r2' && (
              <label className="admin-form-field">
                <span>Cloudflare R2 Endpoint URL</span>
                <input type="text" value={val.r2_endpoint || ''} onChange={e => updateFormField('STORAGE', 'r2_endpoint', e.target.value)} placeholder="https://<account-id>.r2.cloudflarestorage.com" />
              </label>
            )}

            <label className="admin-form-field">
              <span>Max Upload Size Limitation (MB)</span>
              <input type="number" min="1" max="100" value={val.upload_limit_mb || 5} onChange={e => updateFormField('STORAGE', 'upload_limit_mb', Number(e.target.value))} />
            </label>
          </div>
        );

      case 'BACKUPS':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
              <input type="checkbox" checked={Boolean(val.auto_backup)} onChange={e => updateFormField('BACKUP', 'auto_backup', e.target.checked)} style={{ width: '18px', height: '18px' }} />
              <div>
                <strong style={{ fontSize: '0.9rem' }}>Enable Automated Snapshots</strong>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-muted)' }}>Perform periodic backups of relational application tables.</p>
              </div>
            </label>

            <label className="admin-form-field">
              <span>Execution Schedule (Cron Syntax)</span>
              <input type="text" value={val.schedule || '0 2 * * *'} onChange={e => updateFormField('BACKUP', 'schedule', e.target.value)} placeholder="e.g. 0 2 * * *" />
              <small style={{ color: 'var(--admin-muted)' }}>"0 2 * * *" represents execution every day at 2:00 AM.</small>
            </label>
          </div>
        );

      case 'FEATURE_FLAGS':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--admin-wine)' }}>Platform Modules Toggle Dashboard</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.enable_chat)} onChange={e => updateFormField('FEATURE_FLAGS', 'enable_chat', e.target.checked)} />
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Enable Real-time Chat</span>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--admin-muted)' }}>Allow direct match communications.</p>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.enable_astrology)} onChange={e => updateFormField('FEATURE_FLAGS', 'enable_astrology', e.target.checked)} />
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Astrology compatibility matching</span>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--admin-muted)' }}>Calculate matching horoscopes.</p>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.enable_mbti)} onChange={e => updateFormField('FEATURE_FLAGS', 'enable_mbti', e.target.checked)} />
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Myers-Briggs MBTI matches</span>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--admin-muted)' }}>Match user personality indicators.</p>
                </div>
              </label>



              <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', background: '#f3f4f6', borderRadius: '8px', cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(val.enable_match_suggestions)} onChange={e => updateFormField('FEATURE_FLAGS', 'enable_match_suggestions', e.target.checked)} />
                <div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Recommendation matching Suggestions</span>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--admin-muted)' }}>Enable matching daily recommendation emails.</p>
                </div>
              </label>
            </div>
          </div>
        );

      case 'ANALYTICS':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--admin-wine)' }}>Dashboard Analytics Layout</h3>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={true} disabled />
              <span>Display signup conversion metrics charts</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={true} disabled />
              <span>Display revenue trends breakdown logs</span>
            </label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <AdminPageHeader 
        eyebrow="Management" 
        title={mode === 'settings' ? 'Platform Control Center' : 'System Database Backups'} 
        description={mode === 'settings' ? 'Overhaul and view general, billing, layout, security and feature flag controls.' : 'Review database snapshot history and run automatic backup records.'} 
        actions={
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {mode === 'backups' && (
              <button type="button" className="admin-btn admin-btn-primary" onClick={triggerBackup}>
                Run Backup Now
              </button>
            )}
            <button type="button" className="admin-btn admin-btn-secondary" onClick={load}>
              <RefreshCw /> Refresh Data
            </button>
          </div>
        } 
      />

      {mode === 'settings' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '2rem', alignItems: 'flex-start' }}>
          
          {/* Tab Navigation Menu */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', background: 'var(--admin-surface, #fff)', border: '1px solid var(--admin-line, rgba(0,0,0,0.08))', borderRadius: '12px', padding: '0.75rem' }}>
            {CONFIG_TABS.map(tab => {
              const Icon = tab.icon;
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: active ? 'var(--admin-wine-soft, #f6eaf0)' : 'transparent',
                    color: active ? 'var(--admin-wine, #6f2845)' : 'var(--admin-ink, #211a20)',
                    textAlign: 'left',
                    fontWeight: active ? '700' : '500',
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <Icon size={16} style={{ color: active ? 'var(--admin-wine)' : 'var(--admin-muted)' }} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Form details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <AdminPanel 
              title={CONFIG_TABS.find(t => t.key === activeTab)?.label} 
              subtitle={CONFIG_TABS.find(t => t.key === activeTab)?.desc}
              action={
                <button type="button" className="admin-btn admin-btn-primary" onClick={() => save(activeTab)}>
                  <Save size={16} /> Save Changes
                </button>
              }
            >
              <div style={{ padding: '1.25rem 0' }}>
                {renderSettingFields(activeTab)}
              </div>
            </AdminPanel>
          </div>

        </div>
      ) : (
        <AdminPanel>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Completed</th>
                  <th>Size</th>
                  <th>Storage path / error</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span style={{ 
                        display: 'inline-block',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        background: row.status === 'COMPLETED' ? '#def7ec' : row.status === 'FAILED' ? '#fde8e8' : '#fef3c7',
                        color: row.status === 'COMPLETED' ? '#03543f' : row.status === 'FAILED' ? '#9b1c1c' : '#d97706'
                      }}>
                        {row.status}
                      </span>
                    </td>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>{row.completed_at ? new Date(row.completed_at).toLocaleString() : 'â€”'}</td>
                    <td>{row.size_bytes ? `${(row.size_bytes / 1048576).toFixed(2)} MB` : 'â€”'}</td>
                    <td>{row.error_message || row.storage_path || 'â€”'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!backups.length && <p style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-muted)' }}>No database backups records are available.</p>}
          </div>
        </AdminPanel>
      )}

      {toast && <AdminToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}
    </>
  );
}
