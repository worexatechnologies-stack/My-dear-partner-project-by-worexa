'use client';

import { useEffect, useState, type ComponentType, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from '@/lib/router-compat';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, BadgeCheck, Calendar, Check, ChevronDown,
  Eye, EyeOff, GraduationCap, Heart, HeartHandshake, Languages,
  Lock, Mail, MapPin, Phone, ShieldCheck, UserRound, Users, Globe,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

/* ──────────────────────── Types ──────────────────────── */
type IconType = ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;

type FormState = {
  firstName: string; lastName: string; profileFor: string; gender: string;
  birthDate: string; city: string; religion: string; language: string; caste: string;
  education: string; email: string; countryCode: string; phone: string;
  password: string; confirmPassword: string; acceptTerms: boolean;
  termsAcceptedAt: string;
};

const INITIAL_FORM: FormState = {
  firstName: '', lastName: '', profileFor: '', gender: '', birthDate: '',
  city: '', religion: '', language: '', caste: '', education: '', email: '',
  countryCode: '+91', phone: '', password: '', confirmPassword: '', acceptTerms: false,
  termsAcceptedAt: '',
};

/* ──────────────────────── Step config ──────────────────────── */
const STEPS = [
  { name: 'Your Identity',     shortName: 'Identity',  title: 'Let\'s begin with the basics.',               desc: 'Tell us who the profile is for and share a few essential details.',                      icon: UserRound },
  { name: 'Life & Background', shortName: 'Background', title: 'Add details that shape compatibility.',       desc: 'These details help us make more relevant and respectful introductions.',                  icon: HeartHandshake },
  { name: 'Secure Account',    shortName: 'Security',  title: 'Create your private member account.',         desc: 'Your contact details stay protected and are never displayed without your control.',       icon: ShieldCheck },
];

/* ──────────────────────── Dropdown data ──────────────────────── */
const COUNTRIES = [
  { code: 'IN', label: 'India',         dial: '+91' },
  { code: 'US', label: 'United States', dial: '+1'  },
  { code: 'GB', label: 'United Kingdom',dial: '+44' },
  { code: 'CA', label: 'Canada',        dial: '+1'  },
  { code: 'AU', label: 'Australia',     dial: '+61' },
  { code: 'AE', label: 'UAE',           dial: '+971'},
  { code: 'SG', label: 'Singapore',     dial: '+65' },
  { code: 'LK', label: 'Sri Lanka',     dial: '+94' },
];
const PROFILE_OPTIONS = [
  { value: 'Self',     label: 'Myself',        icon: UserRound    },
  { value: 'Parent',   label: 'Son/Daughter',  icon: Users        },
  { value: 'Sibling',  label: 'Sibling',       icon: Heart        },
  { value: 'Relative', label: 'Relative',      icon: HeartHandshake },
  { value: 'Friend',   label: 'Friend',        icon: Users        },
];
const GENDER_OPTIONS = [
  { value: 'Female', label: 'Woman', icon: UserRound },
  { value: 'Male',   label: 'Man',   icon: UserRound },
  { value: 'Other',  label: 'Other', icon: UserRound },
];
const RELIGIONS  = ['Hindu','Muslim','Christian','Sikh','Jain','Buddhist','Other'];
const LANGUAGES  = ['Hindi','English','Tamil','Telugu','Bengali','Marathi','Gujarati','Kannada','Malayalam','Punjabi','Urdu','Other'];
const EDUCATION  = ['High School','Diploma',"Bachelor's","Master's",'PhD','Other'];

/* ──────────────────────── Validators ──────────────────────── */
const validateName = (n: string, f: string, required = true) => {
  const t = n.trim();
  if (!t) return required ? `${f} is required.` : '';
  const min = required ? 2 : 1;
  if (t.length < min) return `${f} must be at least ${min} character${min > 1 ? 's' : ''}.`;
  if (t.length > 50) return `${f} must be at most 50 characters.`;
  if (!/^[a-zA-Z\s'-]+$/.test(t)) return `${f} contains invalid characters.`;
  return '';
};
const validateEmail = (e: string) => {
  if (!e) return 'Email address is required.';
  if (/\s/.test(e)) return 'Email cannot contain spaces.';
  if (!/^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/.test(e)) return 'Enter a valid email address.';
  return '';
};
const validatePhone = (p: string) => {
  if (!p) return 'Mobile number is required.';
  const n = p.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(n)) return 'Digits only.';
  if (n.length < 6 || n.length > 14) return 'Enter a valid mobile number.';
  if (/^(\d)\1+$/.test(n)) return 'Enter a valid mobile number.';
  return '';
};
const validateDOB = (d: string) => {
  if (!d) return 'Date of birth is required.';
  const dob = new Date(d);
  if (isNaN(dob.getTime())) return 'Enter a valid date.';
  if (dob > new Date()) return 'Cannot be in the future.';
  const today = new Date();
  const age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (age < 18 || (age === 18 && (m < 0 || (m === 0 && today.getDate() < dob.getDate())))) return 'Must be at least 18 years old.';
  return '';
};
const checkPwd = (p: string) => ({
  length: p.length >= 8, upper: /[A-Z]/.test(p), lower: /[a-z]/.test(p),
  number: /\d/.test(p), special: /[^A-Za-z0-9]/.test(p),
});

/* ──────────────────────── Shared input style helpers ──────────────────────── */
const baseInputStyle: React.CSSProperties = {
  width: '100%', padding: '13px 14px 13px 42px', background: 'transparent',
  border: 'none', outline: 'none', fontSize: 13, fontWeight: 600,
  color: '#111827', borderRadius: 14,
};
const fieldWrap = (focused: boolean, hasError: boolean): React.CSSProperties => ({
  position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 14,
  transition: 'all 0.18s',
  background: focused ? '#fff' : hasError ? '#fff5f7' : '#f9f1f4',
  border: hasError ? '1.5px solid #f87171' : focused ? '2px solid #8e3d58' : '1.5px solid #f3d5de',
  boxShadow: focused ? '0 0 0 3px rgba(142,61,88,0.10)' : 'none',
});

/* ──────────────────────── Sub-components ──────────────────────── */
function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" style={{ margin: '4px 0 0', fontSize: 11, color: '#dc2626', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontWeight: 900 }}>!</span> {message}
    </p>
  );
}

function FormLabel({ htmlFor, children, optional }: { htmlFor: string; children: ReactNode; optional?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
      <label htmlFor={htmlFor} style={{ fontSize: 11, fontWeight: 800, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {children}
      </label>
      {optional && <span style={{ fontSize: 10, color: '#9ca3af', fontWeight: 600 }}>Optional</span>}
    </div>
  );
}

function InputField({
  id, label, icon: Icon, value, onChange, onBlur, error,
  type = 'text', placeholder, required, autoComplete, inputMode, max, rightSlot, optional,
}: {
  id: string; label: string; icon: IconType; value: string;
  onChange: (v: string) => void; onBlur?: () => void; error?: string;
  type?: string; placeholder?: string; required?: boolean;
  autoComplete?: string; inputMode?: 'numeric' | 'text' | 'email' | 'tel';
  max?: string; rightSlot?: ReactNode; optional?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <FormLabel htmlFor={id} optional={optional}>{label}{required && <span style={{ color: '#8e3d58', marginLeft: 2 }}>*</span>}</FormLabel>
      <div style={fieldWrap(focused, !!error)}>
        <Icon size={15} style={{ position: 'absolute', left: 14, color: focused ? '#8e3d58' : error ? '#f87171' : '#c4a0ad', pointerEvents: 'none' } as React.CSSProperties} />
        <input
          id={id} type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); onBlur?.(); }}
          placeholder={placeholder} required={required}
          autoComplete={autoComplete} inputMode={inputMode} max={max}
          aria-invalid={!!error}
          style={{ ...baseInputStyle, paddingRight: rightSlot ? 44 : 14 }}
        />
        {rightSlot}
      </div>
      <FieldError message={error} />
    </div>
  );
}

function SelectField({
  id, label, icon: Icon, value, options, onChange, error, placeholder, required, optional,
}: {
  id: string; label: string; icon: IconType; value: string;
  options: string[]; onChange: (v: string) => void;
  error?: string; placeholder: string; required?: boolean; optional?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <FormLabel htmlFor={id} optional={optional}>{label}{required && <span style={{ color: '#8e3d58', marginLeft: 2 }}>*</span>}</FormLabel>
      <div style={fieldWrap(focused, !!error)}>
        <Icon size={15} style={{ position: 'absolute', left: 14, color: focused ? '#8e3d58' : error ? '#f87171' : '#c4a0ad', pointerEvents: 'none' } as React.CSSProperties} />
        <select
          id={id} value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          aria-invalid={!!error}
          style={{ ...baseInputStyle, paddingRight: 36, appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', color: value ? '#111827' : '#9ca3af' }}
        >
          <option value="" disabled>{placeholder}</option>
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={14} style={{ position: 'absolute', right: 12, color: '#9ca3af', pointerEvents: 'none' }} />
      </div>
      <FieldError message={error} />
    </div>
  );
}

function ChoiceCard({ active, icon: Icon, label, onClick }: { active: boolean; icon: IconType; label: string; onClick: () => void }) {
  return (
    <button
      type="button" onClick={onClick} aria-pressed={active}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '10px 8px', borderRadius: 14, border: active ? '2px solid #8e3d58' : '1.5px solid #f3d5de',
        background: active ? '#fce7ef' : '#fdf8f5', cursor: 'pointer',
        transition: 'all 0.18s', position: 'relative',
      }}
    >
      {active && (
        <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: '#8e3d58', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={10} style={{ color: 'white' }} />
        </div>
      )}
      <div style={{ width: 32, height: 32, borderRadius: 10, background: active ? '#f9a8c4' : '#f3d5de', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={16} style={{ color: active ? '#5c1f35' : '#9ca3af' } as React.CSSProperties} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color: active ? '#5c1f35' : '#4b5563', textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </button>
  );
}

/* ──────────────────────── Main Component ──────────────────────── */
export default function RegisterPage() {
  const [step, setStep]               = useState(0);
  const [errors, setErrors]           = useState<Record<string, string>>({});
  const [backendErrors, setBackendErrors] = useState<Record<string, string[]>>({});
  const [submitting, setSubmitting]   = useState(false);
  const [successMsg, setSuccessMsg]   = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [touched, setTouched]         = useState<Record<string, boolean>>({});
  const [draftReady, setDraftReady]   = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [hasReadTerms, setHasReadTerms] = useState(false);
  const [form, setForm]               = useState<FormState>(INITIAL_FORM);

  const { registerMember } = useAuth();
  const navigate = useNavigate();

  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()).toISOString().split('T')[0];

  /* Draft persistence */
  useEffect(() => {
    try {
      const raw = localStorage.getItem('register_draft');
      if (raw) {
        const saved = JSON.parse(raw) as Partial<FormState>;
        setForm((c) => ({ ...c, ...saved, password: '', confirmPassword: '' }));
      }
    } catch { /* ignore */ } finally { setDraftReady(true); }
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const { password: _p, confirmPassword: _c, ...safe } = form;
    try { localStorage.setItem('register_draft', JSON.stringify(safe)); } catch { /* ignore */ }
  }, [draftReady, form]);

  useEffect(() => {
    if (showTermsModal) setHasReadTerms(false);
  }, [showTermsModal]);

  useEffect(() => {
    if (step === 0) return;
    document.getElementById('reg-form-heading')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [step]);

  /* Field helpers */
  const update = (key: keyof FormState, value: string | boolean) => {
    setForm((c) => ({ ...c, [key]: value }));
    if (backendErrors[key]) setBackendErrors((c) => { const n = { ...c }; delete n[key]; return n; });
  };

  const validateField = (key: keyof FormState, value: string | boolean): string => {
    const sv = typeof value === 'boolean' ? '' : value;
    let msg = '';
    switch (key) {
      case 'firstName':      msg = validateName(sv, 'First name', true); break;
      case 'lastName':       msg = validateName(sv, 'Last name', false); break;
      case 'profileFor':     if (!sv) msg = 'Please select who this profile is for.'; break;
      case 'gender':         if (!sv) msg = 'Please select a gender.'; break;
      case 'birthDate':      msg = validateDOB(sv); break;
      case 'city':           if (!sv.trim()) msg = 'Current city is required.'; break;
      case 'religion':       if (!sv.trim()) msg = 'Religion is required.'; break;
      case 'language':       if (!sv.trim()) msg = 'Mother tongue is required.'; break;
      case 'caste':          if (!sv.trim()) msg = 'Caste or community is required.'; break;
      case 'education':      if (!sv.trim()) msg = 'Highest education is required.'; break;
      case 'email':          msg = validateEmail(sv); break;
      case 'phone':          msg = validatePhone(sv); break;
      case 'password': {
        if (!sv) { msg = 'Password is required.'; break; }
        const r = checkPwd(sv);
        if (!r.length) msg = 'At least 8 characters required.';
        else if (!r.upper) msg = 'Add at least one uppercase letter.';
        else if (!r.lower) msg = 'Add at least one lowercase letter.';
        else if (!r.number) msg = 'Add at least one number.';
        else if (!r.special) msg = 'Add at least one special character.';
        else if (form.email && sv.includes(form.email)) msg = 'Password must not contain your email.';
        else if (form.phone && sv.includes(form.phone)) msg = 'Password must not contain your phone.';
        break;
      }
      case 'confirmPassword': if (!sv) msg = 'Confirm your password.'; else if (sv !== form.password) msg = 'Passwords do not match.'; break;
      case 'acceptTerms':     if (!value) msg = 'Accept the Terms to continue.'; break;
      default: break;
    }
    setErrors((c) => { const n = { ...c }; if (msg) n[key] = msg; else delete n[key]; return n; });
    return msg;
  };

  const changeField = (key: keyof FormState, value: string | boolean) => {
    update(key, value);
    if (touched[key] || errors[key] || backendErrors[key]) validateField(key, value);
  };
  const blurField = (key: keyof FormState) => {
    setTouched((c) => ({ ...c, [key]: true }));
    validateField(key, form[key]);
  };

  const validateStep = (s: number): boolean => {
    const se: Record<string, string> = {};
    if (s === 0) {
      se.firstName = validateName(form.firstName, 'First name', true);
      se.lastName  = validateName(form.lastName, 'Last name', false);
      if (!form.profileFor) se.profileFor = 'Please select who this profile is for.';
      if (!form.gender)     se.gender     = 'Please select a gender.';
      se.birthDate = validateDOB(form.birthDate);
    } else if (s === 1) {
      if (!form.city.trim())     se.city     = 'Current city is required.';
      if (!form.religion.trim()) se.religion = 'Religion is required.';
      if (!form.language.trim()) se.language = 'Mother tongue is required.';
      if (!form.caste.trim())    se.caste    = 'Caste or community is required.';
      if (!form.education.trim()) se.education = 'Highest education is required.';
    } else {
      se.email = validateEmail(form.email);
      se.phone = validatePhone(form.phone);
      const r = checkPwd(form.password);
      if (!form.password)   se.password = 'Password is required.';
      else if (!r.length)   se.password = 'At least 8 characters required.';
      else if (!r.upper)    se.password = 'Add an uppercase letter.';
      else if (!r.lower)    se.password = 'Add a lowercase letter.';
      else if (!r.number)   se.password = 'Add a number.';
      else if (!r.special)  se.password = 'Add a special character.';
      if (!form.confirmPassword) se.confirmPassword = 'Confirm your password.';
      else if (form.confirmPassword !== form.password) se.confirmPassword = 'Passwords do not match.';
      if (!form.acceptTerms) se.acceptTerms = 'Accept the Terms to continue.';
    }
    const cleaned = Object.fromEntries(Object.entries(se).filter(([, v]) => v));
    setErrors((c) => ({ ...c, ...cleaned }));
    setTouched((c) => ({ ...c, ...Object.fromEntries(Object.keys(cleaned).map((k) => [k, true])) }));
    const first = Object.keys(cleaned)[0];
    if (first) { document.getElementById(first)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    return true;
  };

  const next = (e: FormEvent<HTMLFormElement>) => { e.preventDefault(); if (validateStep(step)) setStep((c) => Math.min(c + 1, STEPS.length - 1)); };
  const back = () => setStep((c) => Math.max(c - 1, 0));

  const finish = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (submitting || !validateStep(2)) return;
    setSubmitting(true); setBackendErrors({});
    try {
      await registerMember({
        email: form.email.trim(),
        mobile_number: `${form.countryCode}${form.phone.replace(/[\s-]/g, '')}`,
        password: form.password, confirm_password: form.confirmPassword,
        accept_terms: form.acceptTerms,
        terms_accepted_at: form.termsAcceptedAt || new Date().toISOString(),
        first_name: form.firstName.trim(),
        last_name: form.lastName.trim(), profile_created_by: form.profileFor,
        gender: form.gender, date_of_birth: form.birthDate,
        work_location: form.city.trim(), religion: form.religion.trim(),
        mother_tongue: form.language.trim(), caste: form.caste.trim(),
        highest_education: form.education.trim(),
      });
      try { localStorage.removeItem('register_draft'); } catch { /* ignore */ }
      setSuccessMsg('Profile created successfully!');
      setTimeout(() => navigate('/dashboard', { replace: true }), 3000);
    } catch (caught: unknown) {
      const err = caught as { errors?: unknown; message?: unknown };
      const rawErrors = err.errors && typeof err.errors === 'object' && !Array.isArray(err.errors)
        ? err.errors as Record<string, unknown> : null;
      if (rawErrors) {
        const keyMap: Record<string, string> = {
          first_name: 'firstName', last_name: 'lastName', profile_created_by: 'profileFor',
          gender: 'gender', date_of_birth: 'birthDate', work_location: 'city',
          religion: 'religion', mother_tongue: 'language', highest_education: 'education',
          email: 'email', mobile_number: 'phone', password: 'password',
          confirm_password: 'confirmPassword', accept_terms: 'acceptTerms',
        };
        const mapped: Record<string, string[]> = {};
        Object.entries(rawErrors).forEach(([f, msgs]) => {
          const mk = keyMap[f] || f;
          const vals = Array.isArray(msgs) ? msgs : [msgs];
          const valid = vals.filter((v): v is string => typeof v === 'string' && v.trim().length > 0);
          if (valid.length) mapped[mk] = valid;
        });
        if (Object.keys(mapped).length) {
          setBackendErrors(mapped);
          const firstKey = Object.keys(mapped)[0];
          if (['firstName','lastName','profileFor','gender','birthDate'].includes(firstKey)) setStep(0);
          else if (['city','religion','language','education'].includes(firstKey)) setStep(1);
          else setStep(2);
        } else {
          setErrors({ general: typeof err.message === 'string' ? err.message : 'Registration failed. Please try again.' });
        }
      } else {
        setErrors({ general: caught instanceof Error ? caught.message : 'Registration failed. Please try again.' });
      }
    } finally { setSubmitting(false); }
  };

  const fe = (key: string) => errors[key] || backendErrors[key]?.[0];
  const pwdReqs = checkPwd(form.password);
  const metCount = Object.values(pwdReqs).filter(Boolean).length;
  const strength = metCount === 5 ? 'Strong' : metCount >= 3 ? 'Good' : metCount > 0 ? 'Weak' : '';
  const strengthColor = metCount === 5 ? '#16a34a' : metCount >= 3 ? '#f59e0b' : '#ef4444';
  const progress = ((step + 1) / STEPS.length) * 100;
  const StepIcon = STEPS[step].icon;

  /* ── Success screen ── */
  if (successMsg) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #fdf8f5 0%, #fce7ef 100%)', fontFamily: "'Inter', system-ui, sans-serif" }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22 }}
          style={{ background: 'white', borderRadius: 28, padding: '48px 40px', maxWidth: 460, width: '90%', textAlign: 'center', boxShadow: '0 24px 80px rgba(142,61,88,0.15)', border: '1px solid #f3d5de' }}
        >
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'linear-gradient(135deg, #8e3d58, #5c1f35)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>
            <Check size={32} style={{ color: 'white' }} />
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 999, background: '#dcfce7', border: '1px solid #86efac', marginBottom: 16 }}>
            <BadgeCheck size={14} style={{ color: '#16a34a' }} />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Registration Complete</span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: '#230914', margin: '0 0 12px' }}>{successMsg}</h1>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, margin: '0 0 28px' }}>
            Welcome to MyDearPartner! Your secure account is ready and your matchmaking journey can begin.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginBottom: 28 }}>
            {[{ icon: ShieldCheck, text: 'Account secured' }, { icon: BadgeCheck, text: 'Profile saved' }].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#374151' }}>
                <Icon size={16} style={{ color: '#8e3d58' }} /> {text}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => navigate('/dashboard', { replace: true })}
            style={{ width: '100%', padding: '14px 24px', borderRadius: 16, background: 'linear-gradient(135deg, #8e3d58 0%, #5c1f35 100%)', border: 'none', color: 'white', fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 6px 24px rgba(142,61,88,0.30)' }}
          >
            Go to my dashboard <ArrowRight size={16} />
          </button>
          <p style={{ marginTop: 16, fontSize: 11, color: '#9ca3af' }}>Redirecting automatically…</p>
        </motion.div>
      </div>
    );
  }

  /* ── Main register layout ── */
  return (
    <div className="register-redesign" style={{ minHeight: '100vh', width: '100%', display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", background: '#fdf8f5' }}>

      {/* ── LEFT HERO PANEL (desktop only) ── */}
      <div
        className="reg-hero-panel"
        aria-hidden="true"
        style={{ position: 'relative', width: '38%', minHeight: '100vh', flexShrink: 0, display: 'none', flexDirection: 'column', justifyContent: 'space-between', padding: '40px 36px', overflow: 'hidden' }}
      >
        {/* Background image */}
        <img
          src="/images/signup-editorial-couple.png"
          alt="Happy couple"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', zIndex: 1 }}
        />
        {/* Dark overlay gradient */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(35,9,20,0.52) 0%, rgba(35,9,20,0.85) 100%)', zIndex: 1 }} />

        {/* Decorative rings */}
        {[['−80px','−80px','320px'],['−40px','−40px','200px']].map(([t,r,s],i) => (
          <div key={i} style={{ position: 'absolute', top: t, right: r, width: s, height: s, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.09)', pointerEvents: 'none' }} />
        ))}
        <div style={{ position: 'absolute', bottom: '-100px', left: '-60px', width: 340, height: 340, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.06)', pointerEvents: 'none' }} />

        {/* Logo */}
        <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 10, position: 'relative', zIndex: 2, textDecoration: 'none', cursor: 'pointer' }}>
          <img src="/images/main-logo.png" alt="My Dear Partner Logo" style={{ width: 42, height: 42, objectFit: 'contain' }} />
          <span style={{ color: 'white', fontWeight: 900, fontSize: 20, letterSpacing: '-0.5px' }}>
            My Dear <span style={{ color: '#ec4899' }}>Partner</span>
          </span>
        </Link>

        {/* Centre content */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 14px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', marginBottom: 20 }}>
            <ShieldCheck size={13} style={{ color: '#f9a8c4' }} />
            <span style={{ color: '#f9a8c4', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em' }}>Made for meaningful matches</span>
          </div>
          <h2 style={{ fontSize: 34, fontWeight: 900, color: 'white', lineHeight: 1.25, margin: '0 0 14px' }}>
            Meet with intention.<br />
            <span style={{ color: '#f9a8c4' }}>Move with care.</span>
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, lineHeight: 1.65, margin: '0 0 32px', maxWidth: 280 }}>
            Tell your story in your own words, then discover people whose future feels like yours.
          </p>

          {/* Step list */}
          <div className="reg-hero-steps" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {STEPS.map(({ name, icon: Icon }, i) => {
              const done   = i < step;
              const active = i === step;
              return (
                <div
                  key={name}
                  onClick={() => done && setStep(i)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 16, cursor: done ? 'pointer' : 'default', background: active ? 'rgba(255,255,255,0.14)' : done ? 'rgba(255,255,255,0.06)' : 'transparent', border: active ? '1px solid rgba(255,255,255,0.22)' : '1px solid transparent', backdropFilter: active ? 'blur(8px)' : 'none', transition: 'all 0.2s' }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: done ? '#f9a8c4' : active ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    {done
                      ? <Check size={16} style={{ color: '#5c1f35' }} />
                      : <Icon size={17} style={{ color: active ? 'white' : 'rgba(255,255,255,0.5)' } as React.CSSProperties} />
                    }
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Step {i + 1}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: active ? 'white' : done ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.45)' }}>{name}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Trust bullets */}
          <div className="reg-hero-trust" style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: BadgeCheck, text: 'Profiles carefully reviewed for authenticity' },
              { icon: Lock, text: 'Your details stay under your full control' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} style={{ color: '#f9a8c4' }} />
                </div>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', fontWeight: 500, lineHeight: 1.4 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, position: 'relative', zIndex: 2 }}>
          © {new Date().getFullYear()} MyDearPartner
        </p>
      </div>

      {/* ── RIGHT FORM PANEL ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>

        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 28px', borderBottom: '1px solid #fce7ef', background: 'white', flexShrink: 0 }}>
          {/* Mobile logo */}
          <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <img src="/images/main-logo.png" alt="My Dear Partner Logo" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          
            <span style={{ fontWeight: 900, fontSize: 16, color: '#230914' }}>My Dear <span style={{ color: '#ec4899' }}>Partner</span></span>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <BadgeCheck size={15} style={{ color: '#8e3d58' }} />
            <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>Free · No card required</span>
            <span style={{ width: 1, height: 14, background: '#e5e7eb', margin: '0 4px' }} />
            <span style={{ fontSize: 12, color: '#6b7280' }}>
              Have an account?{' '}
              <Link to="/login" style={{ color: '#8e3d58', fontWeight: 800, textDecoration: 'none' }}>Sign in</Link>
            </span>
          </div>
        </div>

        {/* Scrollable form area */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 24px 48px' }}>
          <div style={{ maxWidth: 580, margin: '0 auto' }}>

            {/* Step heading */}
            <div id="reg-form-heading" style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fce7ef', border: '1.5px solid #f3b8cb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <StepIcon size={20} style={{ color: '#8e3d58' } as React.CSSProperties} />
                </div>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#8e3d58', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    Step {step + 1} of {STEPS.length} · {STEPS[step].name}
                  </div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: '#230914', lineHeight: 1.2 }}>{STEPS[step].title}</h2>
                </div>
              </div>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>{STEPS[step].desc}</p>

              {/* Progress bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 6, borderRadius: 999, background: '#f3d5de', overflow: 'hidden' }}>
                  <div style={{ width: `${progress}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #8e3d58, #c45c7e)', transition: 'width 0.4s ease' }} />
                </div>
                <span style={{ fontSize: 11, fontWeight: 700, color: '#8e3d58' }}>{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Mobile step pills */}
            <div className="reg-mobile-steps" style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
              {STEPS.map(({ shortName }, i) => (
                <div key={shortName} style={{ flex: 1, padding: '6px 4px', borderRadius: 10, textAlign: 'center', background: i < step ? '#fce7ef' : i === step ? '#8e3d58' : '#f9f1f4', border: '1px solid', borderColor: i < step ? '#f3b8cb' : i === step ? '#8e3d58' : '#f3d5de' }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: i === step ? 'white' : i < step ? '#8e3d58' : '#9ca3af' }}>{shortName}</span>
                </div>
              ))}
            </div>

            {/* General error */}
            {errors.general && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 16, background: '#fef2f2', border: '1px solid #fecaca', marginBottom: 20 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, flexShrink: 0 }}>!</div>
                <span style={{ color: '#b91c1c', fontSize: 13, fontWeight: 600 }}>{errors.general}</span>
              </div>
            )}

            {/* Animated form steps */}
            <AnimatePresence mode="wait">
              <motion.form
                key={step}
                onSubmit={step === STEPS.length - 1 ? finish : next}
                noValidate
                // Keep required form controls visible before client-side
                // hydration. On slower/mobile connections an initial opacity
                // of zero left the entire registration form appearing blank.
                initial={false}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -18 }}
                transition={{ duration: 0.22, ease: 'easeOut' }}
                style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
              >
                {/* ── STEP 0: Identity ── */}
                {step === 0 && (
                  <>
                    <div className="reg-two-column-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <InputField id="firstName" label="First name" icon={UserRound} value={form.firstName} onChange={(v) => changeField('firstName', v)} onBlur={() => blurField('firstName')} error={fe('firstName')} placeholder="First name" required autoComplete="given-name" />
                      <InputField id="lastName"  label="Last name"  icon={UserRound} value={form.lastName}  onChange={(v) => changeField('lastName', v)}  onBlur={() => blurField('lastName')}  error={fe('lastName')}  placeholder="Last name"  required autoComplete="family-name" />
                    </div>

                    <div>
                      <FormLabel htmlFor="profileFor">Profile is for <span style={{ color: '#8e3d58' }}>*</span></FormLabel>
                      <div className="reg-profile-options" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                        {PROFILE_OPTIONS.map((o) => <ChoiceCard key={o.value} active={form.profileFor === o.value} icon={o.icon} label={o.label} onClick={() => changeField('profileFor', o.value)} />)}
                      </div>
                      <FieldError message={fe('profileFor')} />
                    </div>

                    <div className="reg-two-column-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div>
                        <FormLabel htmlFor="gender">Gender <span style={{ color: '#8e3d58' }}>*</span></FormLabel>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {GENDER_OPTIONS.map((o) => <ChoiceCard key={o.value} active={form.gender === o.value} icon={o.icon} label={o.label} onClick={() => changeField('gender', o.value)} />)}
                        </div>
                        <FieldError message={fe('gender')} />
                      </div>
                      <InputField id="birthDate" label="Date of Birth" icon={Calendar} type="date" max={maxDate} value={form.birthDate} onChange={(v) => changeField('birthDate', v)} onBlur={() => blurField('birthDate')} error={fe('birthDate')} required />
                    </div>
                  </>
                )}

                {/* ── STEP 1: Background ── */}
                {step === 1 && (
                  <>
                    <div className="reg-two-column-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <InputField id="city"      label="Current City"      icon={MapPin}        value={form.city}      onChange={(v) => changeField('city', v)}      onBlur={() => blurField('city')}      error={fe('city')}      placeholder="Where do you live?"     required autoComplete="address-level2" />
                      <InputField id="religion"  label="Religion"          icon={Globe}         value={form.religion}  onChange={(v) => changeField('religion', v)}  onBlur={() => blurField('religion')}  error={fe('religion')}  placeholder="e.g. Hindu, Muslim, Christian, Sikh..." required />
                      <InputField id="language"  label="Mother Tongue"     icon={Languages}     value={form.language}  onChange={(v) => changeField('language', v)}  onBlur={() => blurField('language')}  error={fe('language')}  placeholder="e.g. Hindi, English, Kannada..." required />
                      <InputField id="caste"     label="Caste / Community" icon={Users}         value={form.caste}     onChange={(v) => changeField('caste', v)}     onBlur={() => blurField('caste')}     error={fe('caste')}     placeholder="e.g. Brahmin, Maratha, etc." required />
                      <InputField id="education" label="Highest Education" icon={GraduationCap} value={form.education} onChange={(v) => changeField('education', v)} onBlur={() => blurField('education')} error={fe('education')} placeholder="e.g. B.Tech, M.Com, High School, PhD..." required />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px', borderRadius: 14, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                      <ShieldCheck size={16} style={{ color: '#16a34a', flexShrink: 0, marginTop: 1 }} />
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.5 }}>
                        <strong style={{ color: '#166534' }}>Why we ask:</strong> Background details help us match you better. You can manage their visibility later in settings.
                      </div>
                    </div>
                  </>
                )}

                {/* ── STEP 2: Security ── */}
                {step === 2 && (
                  <>
                    <InputField id="email" label="Email Address" icon={Mail} type="email" value={form.email} onChange={(v) => changeField('email', v)} onBlur={() => blurField('email')} error={fe('email')} placeholder="name@example.com" required autoComplete="email" inputMode="email" />

                    {/* Phone with country code */}
                    <div>
                      <FormLabel htmlFor="phone">Mobile Number <span style={{ color: '#8e3d58' }}>*</span></FormLabel>
                      <div style={fieldWrap(false, !!fe('phone'))}>
                        <select
                          id="countryCode" value={form.countryCode}
                          onChange={(e) => update('countryCode', e.target.value)}
                          aria-label="Country code"
                          style={{ padding: '13px 10px 13px 14px', border: 'none', outline: 'none', background: 'transparent', fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer', minWidth: 82, appearance: 'none', WebkitAppearance: 'none' }}
                        >
                          {COUNTRIES.map((c) => <option key={c.code} value={c.dial}>{c.code} {c.dial}</option>)}
                        </select>
                        <div style={{ width: 1, height: 22, background: '#f3d5de', flexShrink: 0 }} />
                        <Phone size={15} style={{ marginLeft: 10, color: '#c4a0ad', flexShrink: 0 }} />
                        <input
                          id="phone" type="tel" inputMode="numeric" autoComplete="tel-national"
                          value={form.phone} placeholder="Mobile number"
                          onChange={(e) => changeField('phone', e.target.value)}
                          onBlur={() => blurField('phone')}
                          aria-invalid={!!fe('phone')}
                          style={{ flex: 1, padding: '13px 14px', background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 600, color: '#111827' }}
                        />
                      </div>
                      <FieldError message={fe('phone')} />
                    </div>

                    {/* Password */}
                    <InputField
                      id="password" label="Create Password" icon={Lock}
                      type={showPassword ? 'text' : 'password'} value={form.password}
                      onChange={(v) => { changeField('password', v); if (touched.confirmPassword) validateField('confirmPassword', form.confirmPassword); }}
                      onBlur={() => blurField('password')} error={fe('password')}
                      placeholder="Create a strong password" required autoComplete="new-password"
                      rightSlot={
                        <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label="Toggle password" style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      }
                    />

                    {/* Strength meter */}
                    {form.password && (
                      <div style={{ padding: '14px 16px', borderRadius: 14, background: '#fdf8f5', border: '1px solid #f3d5de' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>Password Strength</span>
                          <span style={{ fontSize: 11, fontWeight: 800, color: strengthColor }}>{strength}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                          {[0,1,2,3,4].map((i) => (
                            <div key={i} style={{ flex: 1, height: 4, borderRadius: 999, background: i < metCount ? strengthColor : '#f3d5de', transition: 'background 0.2s' }} />
                          ))}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                          {[
                            { met: pwdReqs.length,  label: '8+ characters' },
                            { met: pwdReqs.upper,   label: 'Uppercase letter' },
                            { met: pwdReqs.lower,   label: 'Lowercase letter' },
                            { met: pwdReqs.number,  label: 'One number' },
                            { met: pwdReqs.special, label: 'Special character' },
                          ].map(({ met, label }) => (
                            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: met ? '#16a34a' : '#9ca3af' }}>
                              <div style={{ width: 14, height: 14, borderRadius: '50%', background: met ? '#dcfce7' : '#f3f4f6', border: `1px solid ${met ? '#86efac' : '#e5e7eb'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {met && <Check size={8} style={{ color: '#16a34a' }} />}
                              </div>
                              {label}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Confirm password */}
                    <InputField
                      id="confirmPassword" label="Confirm Password" icon={Lock}
                      type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                      onChange={(v) => changeField('confirmPassword', v)}
                      onBlur={() => blurField('confirmPassword')} error={fe('confirmPassword')}
                      placeholder="Repeat your password" required autoComplete="new-password"
                      rightSlot={
                        <button type="button" onClick={() => setShowConfirm((v) => !v)} aria-label="Toggle confirm password" style={{ position: 'absolute', right: 12, background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                          {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      }
                    />

                    {/* Terms */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
                        <div
                          onClick={() => {
                            if (!form.acceptTerms) {
                              setShowTermsModal(true);
                            } else {
                              changeField('acceptTerms', false);
                              update('termsAcceptedAt', '');
                            }
                          }}
                          style={{ width: 20, height: 20, borderRadius: 6, border: form.acceptTerms ? '2px solid #8e3d58' : '1.5px solid #f3d5de', background: form.acceptTerms ? '#8e3d58' : '#fdf8f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, cursor: 'pointer', transition: 'all 0.18s' }}
                        >
                          {form.acceptTerms && <Check size={12} style={{ color: 'white' }} />}
                        </div>
                          <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                          I agree to the{' '}
                          <button type="button" onClick={() => setShowTermsModal(true)} style={{ color: '#8e3d58', fontWeight: 800, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>Terms of Service</button>
                          {' '}and{' '}
                          <button type="button" onClick={() => setShowTermsModal(true)} style={{ color: '#8e3d58', fontWeight: 800, background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>Privacy Policy</button>.
                        </span>
                      </label>

                      {form.acceptTerms && form.termsAcceptedAt && (
                        <div style={{ padding: '8px 12px', borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, color: '#15803d' }}>
                          <BadgeCheck size={14} style={{ color: '#16a34a' }} />
                          Verified Proof: Terms & Privacy accepted on {new Date(form.termsAcceptedAt).toLocaleString()}
                        </div>
                      )}
                    </div>
                    <FieldError message={fe('acceptTerms')} />
                  </>
                )}

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                  {step > 0 && (
                    <button
                      type="button" onClick={back} disabled={submitting}
                      style={{ padding: '14px 20px', borderRadius: 16, border: '1.5px solid #f3d5de', background: '#fdf8f5', color: '#374151', fontWeight: 800, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    >
                      <ArrowLeft size={15} /> Back
                    </button>
                  )}
                  <button
                    type="submit" disabled={submitting}
                    style={{ flex: 1, padding: '14px 20px', borderRadius: 16, border: 'none', background: submitting ? '#b0607a' : 'linear-gradient(135deg, #8e3d58 0%, #5c1f35 100%)', color: 'white', fontWeight: 900, fontSize: 14, cursor: submitting ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: submitting ? 'none' : '0 6px 20px rgba(142,61,88,0.28)', opacity: submitting ? 0.75 : 1 }}
                  >
                    {submitting ? (
                      <><div style={{ width: 15, height: 15, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> Creating profile…</>
                    ) : step === STEPS.length - 1 ? (
                      <>Create my profile <ArrowRight size={15} /></>
                    ) : (
                      <>Continue to {STEPS[step + 1].shortName} <ArrowRight size={15} /></>
                    )}
                  </button>
                </div>
              </motion.form>
            </AnimatePresence>

            {/* Trust strip */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 28 }}>
              {[
                { icon: ShieldCheck, text: 'Privacy controls' },
                { icon: BadgeCheck,  text: 'Reviewed profiles' },
                { icon: Lock,        text: 'Secure account' },
              ].map(({ icon: Icon, text }) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                  <Icon size={13} style={{ color: '#8e3d58' }} /> {text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Terms & Privacy Modal ── */}
      <AnimatePresence>
        {showTermsModal && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', inset: 0, background: 'rgba(35,9,20,0.65)', backdropFilter: 'blur(4px)' }}
              onClick={() => setShowTermsModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              style={{ position: 'relative', background: 'white', borderRadius: 24, padding: '28px 24px', maxWidth: 520, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '1px solid #f3d5de' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid #f3d5de', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: '#fce7ef', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShieldCheck size={20} style={{ color: '#8e3d58' }} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: '#230914' }}>Terms of Service & Privacy Policy</h3>
                    <p style={{ margin: 0, fontSize: 11, color: '#6b7280', fontWeight: 600 }}>Please review and accept our terms to create your account.</p>
                  </div>
                </div>
              </div>

              <div
                style={{ flex: 1, overflowY: 'auto', paddingRight: 8, fontSize: 12.5, color: '#4b5563', lineHeight: 1.65 }}
                onScroll={(event) => {
                  const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
                  if (scrollHeight - scrollTop - clientHeight <= 8) setHasReadTerms(true);
                }}
              >
                <h4 style={{ color: '#8e3d58', fontWeight: 800, margin: '12px 0 4px' }}>1. Acceptance of Terms</h4>
                <p>By accessing or registering on My Dear Partner, owned and operated by Worexa Technologies, you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you must not use our services.</p>

                <h4 style={{ color: '#8e3d58', fontWeight: 800, margin: '12px 0 4px' }}>2. Eligibility Criteria</h4>
                <p>To register, you must be of legal marriageable age (minimum 18 years for females and 21 years for males in India), legally single/divorced/widowed, and legally competent to enter into a binding contract.</p>

                <h4 style={{ color: '#8e3d58', fontWeight: 800, margin: '12px 0 4px' }}>3. Account Registration & Authenticity</h4>
                <p>You agree to provide true, accurate, current, and complete information during registration. Creating duplicate profiles, false accounts, or profiles on behalf of third parties without their explicit legal consent is strictly prohibited.</p>

                <h4 style={{ color: '#8e3d58', fontWeight: 800, margin: '12px 0 4px' }}>4. Code of Conduct</h4>
                <p>All members must interact respectfully and lawfully. Harassment, hate speech, fraudulent behaviour, solicitation, or any activity that violates applicable laws is strictly prohibited and will result in immediate account suspension or permanent ban.</p>

                <h4 style={{ color: '#8e3d58', fontWeight: 800, margin: '12px 0 4px' }}>5. Privacy & Data Protection</h4>
                <p>Worexa Technologies respects your privacy and is committed to protecting your personal data in compliance with the Digital Personal Data Protection (DPDP) Act. Your personal contact information is kept confidential and is not sold to third-party advertisers.</p>

                <h4 style={{ color: '#8e3d58', fontWeight: 800, margin: '12px 0 4px' }}>6. Information We Collect</h4>
                <p>We collect personal profile data (name, age, gender, religion, education, occupation, photos), contact information (email, phone), verification data (Government ID proofs), and technical usage data (IP address, device info, login timestamps).</p>

                <h4 style={{ color: '#8e3d58', fontWeight: 800, margin: '12px 0 4px' }}>7. User Rights & Data Control</h4>
                <p>You can review and edit your personal details through account settings. You can request account deletion at any time. Upon deletion, your profile will be removed from search results and data will be permanently purged or anonymized.</p>

                <h4 style={{ color: '#8e3d58', fontWeight: 800, margin: '12px 0 4px' }}>8. Platform Role & Disclaimer</h4>
                <p>My Dear Partner operates as an online intermediary platform for matrimonial matchmaking. We do not guarantee marriage outcomes. Users are advised to independently verify credentials before proceeding with personal meetings or financial decisions.</p>

                <h4 style={{ color: '#8e3d58', fontWeight: 800, margin: '12px 0 4px' }}>9. Audit Proof of Acceptance</h4>
                <p>When you click "I Agree & Accept", your acceptance timestamp will be digitally recorded as proof of agreement to these terms.</p>
              </div>

              <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid #f3d5de' }}>
                {!hasReadTerms && (
                  <p style={{ margin: '0 0 10px', color: '#9a5368', fontSize: 11, fontWeight: 700, textAlign: 'center' }}>
                    Please scroll to the end of the Terms &amp; Conditions to enable acceptance.
                  </p>
                )}
                <div style={{ display: 'flex', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  style={{ padding: '12px 18px', borderRadius: 14, border: '1.5px solid #f3d5de', background: '#fdf8f5', color: '#6b7280', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!hasReadTerms}
                  onClick={() => {
                    const now = new Date().toISOString();
                    changeField('acceptTerms', true);
                    update('termsAcceptedAt', now);
                    setShowTermsModal(false);
                  }}
                  style={{ flex: 1, padding: '12px 18px', borderRadius: 14, border: 'none', background: hasReadTerms ? 'linear-gradient(135deg, #8e3d58 0%, #5c1f35 100%)' : '#d9c5cc', color: 'white', fontWeight: 900, fontSize: 13, cursor: hasReadTerms ? 'pointer' : 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: hasReadTerms ? '0 4px 16px rgba(142,61,88,0.28)' : 'none' }}
                >
                  <Check size={16} /> I Agree & Accept Terms
                </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .register-redesign { background: #fffefd !important; font-family: var(--font-manrope), system-ui, sans-serif !important; }
        .register-redesign .reg-hero-panel { width: 42% !important; padding: 36px 40px !important; }
        .register-redesign .reg-hero-panel > div:nth-of-type(1) { background: linear-gradient(to top, rgba(44,41,40,.78), rgba(44,41,40,.13) 62%) !important; }
        .register-redesign .reg-hero-panel h2 { font-family: var(--font-display), Georgia, serif !important; font-weight: 400 !important; font-size: 40px !important; letter-spacing: -.05em !important; }
        .register-redesign .reg-hero-panel h2 span { color: #f0c4c5 !important; font-family: Georgia, serif !important; font-style: italic; }
        .register-redesign .reg-hero-steps, .register-redesign .reg-hero-trust { display: none !important; }
        .register-redesign .reg-hero-panel > div:nth-of-type(5) { max-width: 340px; }
        .register-redesign .reg-hero-panel > a span { font-family: var(--font-display), Georgia, serif !important; }
        .register-redesign .reg-hero-panel > a span span { color: #f0c4c5 !important; }
        .register-redesign > div:last-of-type { background: #fffefd !important; }
        .register-redesign > div:last-of-type > div:first-child { border-bottom-color: #eaded8 !important; background: #fffefd !important; }
        .register-redesign input, .register-redesign select { border-radius: 0 !important; }
        .register-redesign button[type="submit"] { border-radius: 0 !important; background: #bd6970 !important; box-shadow: none !important; text-transform: uppercase; letter-spacing: .1em; font-size: 12px !important; }
        .register-redesign button[type="submit"]:hover { background: #a8525c !important; }
        .register-redesign [style*="borderRadius: 16"], .register-redesign [style*="borderRadius: 14"] { border-radius: 0 !important; }
        .register-redesign [style*="background: '#fdf8f5'"], .register-redesign [style*="background: '#f9f1f4'"], .register-redesign [style*="background: '#fdf1f5'"] { background: #fffaf7 !important; }
        .register-redesign [style*="border: '1.5px solid #f3d5de'"] { border-color: #eaded8 !important; }
        .register-redesign [style*="color: '#8e3d58'"] { color: #a8525c !important; }
        .register-redesign [style*="background: '#fce7ef'"] { background: #f7e7e2 !important; border-color: #eaded8 !important; }
        @media (min-width: 1024px) {
          .reg-hero-panel { display: flex !important; }
          .reg-mobile-logo { display: none !important; }
          .reg-mobile-steps { display: none !important; }
        }
        @media (max-width: 1023px) {
          .reg-hero-panel { display: none !important; }
          .reg-mobile-logo { display: flex !important; }
          .reg-mobile-steps { display: flex !important; }
        }
        @media (max-width: 600px) {
          .reg-two-column-grid { grid-template-columns: 1fr !important; }
          .reg-profile-options { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
        }
      `}</style>
    </div>
  );
}
