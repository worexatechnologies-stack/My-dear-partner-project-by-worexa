'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import { useDispatch } from 'react-redux';
import {
  AlertCircle,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  HeartHandshake,
  ImagePlus,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Star,
  Trash2,
  TrendingUp,
  Upload,
  UserRound,
  UsersRound,
  XCircle,
} from 'lucide-react';
import ProfileImage from '@/components/profile/ProfileImage';
import ProtectedDocumentViewer from '@/components/documents/ProtectedDocumentViewer';
import { useAuth, type UserType } from '../contexts/AuthContext';
import { ApiError, fetchApi } from '../services/apiClient';
import { baseApi } from '../services/baseApi';
import {
  MAX_PROFILE_PHOTO_BYTES,
  useDeletePhotoMutation,
  useGetMyPhotosQuery,
  useSetPrimaryPhotoMutation,
  useUploadPhotoMutation,
} from '../services/photoApi';

type ProfileUser = UserType & Record<string, unknown>;
type FormState = Record<string, string>;
type FieldConfig = {
  key: string;
  label: string;
  type?: 'text' | 'date' | 'number' | 'textarea' | 'select';
  options?: string[];
  placeholder?: string;
};
type TabId = 'basic' | 'photos' | 'personal' | 'family' | 'career' | 'preferences' | 'verification';
type VerificationTarget = 'mobile';

const heightOptions = [
  'Select height',
  "135 cm (4'5\")", "137 cm (4'6\")", "140 cm (4'7\")", "142 cm (4'8\")",
  "145 cm (4'9\")", "147 cm (4'10\")", "150 cm (4'11\")", "152 cm (5'0\")",
  "155 cm (5'1\")", "157 cm (5'2\")", "160 cm (5'3\")", "163 cm (5'4\")",
  "165 cm (5'5\")", "168 cm (5'6\")", "170 cm (5'7\")", "173 cm (5'8\")",
  "175 cm (5'9\")", "178 cm (5'10\")", "180 cm (5'11\")", "183 cm (6'0\")",
  "185 cm (6'1\")", "188 cm (6'2\")", "191 cm (6'3\")", "193 cm (6'4\")",
  "196 cm (6'5\")",
];

const sections: Record<Exclude<TabId, 'photos' | 'verification'>, FieldConfig[]> = {
  basic: [
    { key: 'first_name', label: 'First Name', placeholder: 'Enter your first name' },
    { key: 'last_name', label: 'Last Name', placeholder: 'Enter your last name' },
    { key: 'mobile_number', label: 'Mobile Number', placeholder: 'Enter your mobile number' },
    { key: 'gender', label: 'Gender', placeholder: 'e.g. Male, Female, Other' },
    { key: 'profile_created_by', label: 'Profile Created By', placeholder: 'e.g. Self, Parent, Sibling' },
    { key: 'date_of_birth', label: 'Date of Birth', type: 'date' },
    { key: 'work_location', label: 'Current City', placeholder: 'Where do you currently live?' },
    { key: 'about', label: 'About Me', type: 'textarea', placeholder: 'Share a thoughtful introduction about your life, values, and aspirations' },
    { key: 'hobbies', label: 'Hobbies & Interests', placeholder: 'e.g. Reading, travel, music, photography' },
  ],
  personal: [
    { key: 'marital_status', label: 'Marital Status', placeholder: 'e.g. Never Married, Divorced, Widowed' },
    { key: 'height', label: 'Height', type: 'select', options: heightOptions },
    { key: 'weight', label: 'Weight', placeholder: 'e.g. 65 kg' },
    { key: 'blood_group', label: 'Blood Group', placeholder: 'e.g. A+, B+, O+' },
    { key: 'complexion', label: 'Complexion', placeholder: 'e.g. Fair, Wheatish, Dark' },
    { key: 'religion', label: 'Religion', placeholder: 'e.g. Hindu, Muslim, Christian, Sikh' },
    { key: 'mother_tongue', label: 'Mother Tongue', placeholder: 'e.g. Hindi, Kannada, Tamil, Telugu' },
    { key: 'caste', label: 'Caste / Community', placeholder: 'e.g. Brahmin, Reddy, Nair' },
    { key: 'sub_caste', label: 'Sub-Caste', placeholder: 'Enter sub-caste' },
    { key: 'gothra', label: 'Gothra', placeholder: 'Enter gothra' },
    { key: 'star_nakshatra', label: 'Star / Nakshatra', placeholder: 'Enter star or nakshatra' },
  ],
  family: [
    { key: 'father_status', label: "Father's Status", placeholder: 'e.g. Business Owner, Government Employee, Retired' },
    { key: 'mother_status', label: "Mother's Status", placeholder: 'e.g. Homemaker, Business Owner, Teacher' },
    { key: 'num_brothers', label: 'Number of Brothers', type: 'number', placeholder: '0' },
    { key: 'num_sisters', label: 'Number of Sisters', type: 'number', placeholder: '0' },
    { key: 'family_type', label: 'Family Type', placeholder: 'e.g. Nuclear, Joint' },
    { key: 'family_status', label: 'Family Status', placeholder: 'e.g. Middle class, Upper middle class' },
    { key: 'family_location', label: 'Family Location', placeholder: 'e.g. Bangalore, Chennai, Hyderabad' },
  ],
  career: [
    { key: 'highest_education', label: 'Highest Education', placeholder: 'e.g. B.Tech, MBA, MBBS, MS' },
    { key: 'education_detail', label: 'Education Details', placeholder: 'e.g. Computer Science, Finance, Architecture' },
    { key: 'occupation', label: 'Occupation', placeholder: 'e.g. Software Engineer, Doctor, Banking Professional' },
    { key: 'employed_in', label: 'Employed In', placeholder: 'e.g. Private Company, Government / Public Sector' },
    { key: 'company', label: 'Company Name', placeholder: 'e.g. Google, Infosys, Self Employed' },
    { key: 'annual_income', label: 'Annual Income', placeholder: 'e.g. ₹10–15 lakh, ₹20–30 lakh' },
  ],
  preferences: [
    { key: 'pref_age_min', label: 'Minimum Preferred Age', type: 'number', placeholder: '24' },
    { key: 'pref_age_max', label: 'Maximum Preferred Age', type: 'number', placeholder: '32' },
    { key: 'pref_height_min', label: 'Minimum Preferred Height', placeholder: "e.g. 5'3\"" },
    { key: 'pref_height_max', label: 'Maximum Preferred Height', placeholder: "e.g. 6'0\"" },
    { key: 'pref_religion', label: 'Preferred Religion', placeholder: 'e.g. Any, Hindu, Christian' },
    { key: 'pref_caste', label: 'Preferred Caste', placeholder: 'e.g. Any, Brahmin, No caste bar' },
    { key: 'pref_location', label: 'Preferred Locations', placeholder: 'e.g. Bangalore, Hyderabad, Chennai, Any' },
    { key: 'pref_education', label: 'Preferred Education', placeholder: 'e.g. Any, Graduate, Post Graduate' },
    { key: 'pref_occupation', label: 'Preferred Occupation', placeholder: 'e.g. Any, Software, Healthcare, Business' },
    { key: 'pref_marital_status', label: 'Preferred Marital Status', placeholder: 'e.g. Any, Never Married' },
    { key: 'pref_about', label: 'About Ideal Partner', type: 'textarea', placeholder: 'Describe what you are looking for in a lifelong companion' },
  ],
};

const tabs = [
  { id: 'basic' as const, label: 'Basic & Lifestyle', shortLabel: 'Basic', icon: UserRound, description: 'Identity, location, contact, and personal introduction' },
  { id: 'photos' as const, label: 'Profile Photos', shortLabel: 'Photos', icon: Camera, description: 'Upload authentic photos to increase connection requests' },
  { id: 'personal' as const, label: 'Personal & Religion', shortLabel: 'Personal', icon: HeartHandshake, description: 'Cultural, physical, and religious background' },
  { id: 'family' as const, label: 'Family Details', shortLabel: 'Family', icon: UsersRound, description: 'Family structure, background, and location' },
  { id: 'career' as const, label: 'Career & Education', shortLabel: 'Career', icon: BriefcaseBusiness, description: 'Educational qualifications and professional background' },
  { id: 'preferences' as const, label: 'Partner Preferences', shortLabel: 'Preferences', icon: SlidersHorizontal, description: 'Define the partner criteria you hope to match with' },
  { id: 'verification' as const, label: 'Verification', shortLabel: 'Verification', icon: ShieldCheck, description: 'Mobile verification and private identity documents' },
];

const numberFields = new Set(['num_brothers', 'num_sisters', 'pref_age_min', 'pref_age_max']);
const allowedPhotoTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const allowedPhotoFilename = /\.(?:jpe?g|png|webp)$/i;

const calculateAge = (dobString?: string) => {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (Number.isNaN(dob.getTime())) return null;
  const diff = Date.now() - dob.getTime();
  const ageDate = new Date(diff);
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

const calculateProfileCompleteness = (formState: FormState, photosCount: number, isVerified: boolean) => {
  let score = 0;
  if (formState.first_name) score += 5;
  if (formState.last_name) score += 5;
  if (formState.gender) score += 5;
  if (formState.date_of_birth) score += 5;
  if (formState.work_location) score += 5;
  if (formState.about && formState.about.length > 20) score += 10;
  if (formState.marital_status) score += 5;
  if (formState.height) score += 5;
  if (formState.religion) score += 5;
  if (formState.highest_education) score += 10;
  if (formState.occupation) score += 10;
  if (formState.annual_income) score += 5;
  if (formState.family_type || formState.family_location) score += 5;
  if (photosCount > 0) score += 10;
  if (photosCount >= 2) score += 5;
  if (isVerified) score += 5;
  return Math.min(100, Math.max(15, score));
};

const validateProfileForm = (form: FormState): string | null => {
  const firstName = form.first_name?.trim() || '';
  const lastName = form.last_name?.trim() || '';
  if (!firstName || firstName.length < 2) return 'Enter a valid first name.';
  if (firstName.length > 60) return 'First name must be 60 characters or fewer.';
  if (lastName && lastName.length > 60) return 'Last name must be 60 characters or fewer.';

  if (form.mobile_number?.trim() && !/^\+?[0-9 ()-]{7,20}$/.test(form.mobile_number.trim())) {
    return 'Enter a valid mobile number.';
  }
  if (form.date_of_birth) {
    const date = new Date(`${form.date_of_birth}T00:00:00`);
    if (Number.isNaN(date.getTime()) || date > new Date()) return 'Date of birth cannot be in the future.';
  }

  const minAge = Number(form.pref_age_min || 0);
  const maxAge = Number(form.pref_age_max || 0);
  if (minAge && maxAge && minAge > maxAge) return 'Minimum preferred age cannot exceed maximum preferred age.';
  const minHeight = heightOptions.indexOf(form.pref_height_min || '');
  const maxHeight = heightOptions.indexOf(form.pref_height_max || '');
  if (minHeight > 0 && maxHeight > 0 && minHeight > maxHeight) return 'Minimum preferred height cannot exceed maximum preferred height.';
  return null;
};

const messageFrom = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.errors && typeof error.errors === 'object') {
      const parts = Object.entries(error.errors as Record<string, unknown>).map(([field, messages]) => {
        const values = Array.isArray(messages) ? messages : [messages];
        return `${field.replace(/_/g, ' ')}: ${values.filter(Boolean).join(', ')}`;
      });
      return parts.join('; ') || 'Validation failed.';
    }
    return error.message;
  }
  if (error && typeof error === 'object') {
    const record = error as { message?: unknown; data?: unknown };
    if (typeof record.message === 'string') return record.message;
  }
  return error instanceof Error ? error.message : 'The request could not be completed.';
};

export default function EditProfilePage() {
  const { user, updateUser, loading: authLoading } = useAuth();
  const dispatch = useDispatch();
  const pathname = usePathname();
  const profile = user as ProfileUser | null;

  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [form, setForm] = useState<FormState>({});
  const [initialForm, setInitialForm] = useState<FormState>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null);
  const [docType, setDocType] = useState('AADHAAR');
  const [customDocName, setCustomDocName] = useState('');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [viewDoc, setViewDoc] = useState<{ id: string; type: string } | null>(null);
  const [verifyTarget, setVerifyTarget] = useState<VerificationTarget | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const editorTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setInterval(() => setResendIn((prev) => prev - 1), 1000);
    return () => clearInterval(timer);
  }, [resendIn]);

  const { data: photosResponse, refetch: refetchPhotos } = useGetMyPhotosQuery();
  const [uploadManagedPhoto] = useUploadPhotoMutation();
  const [deleteManagedPhoto] = useDeletePhotoMutation();
  const [setManagedPrimary] = useSetPrimaryPhotoMutation();
  const photosList = photosResponse?.photos ?? [];
  const primaryPhoto = photosList.find((photo) => photo.is_primary) ?? photosList[0];
  const maxPhotos = photosResponse?.max_photos ?? 6;

  const profileFields = useMemo(() => Object.values(sections).flat(), []);
  const hasChanges = useMemo(
    () => Object.keys(initialForm).some((key) => form[key] !== initialForm[key]),
    [form, initialForm],
  );

  const mapApiToForm = (source: ProfileUser | null): FormState => {
    const next: FormState = {};
    for (const { key } of profileFields) {
      const value = source?.[key];
      next[key] = Array.isArray(value) ? value.join(', ') : value == null ? '' : String(value);
    }
    return next;
  };

  useEffect(() => {
    let cancelled = false;
    fetchApi<UserType>('/member-auth/me/')
      .then((fresh) => { if (!cancelled) updateUser(fresh); })
      .catch(() => { /* Maintain cache */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!profile) return;
    const next = mapApiToForm(profile);
    const dirty = Object.keys(initialForm).some((key) => form[key] !== initialForm[key]);
    if (dirty) {
      setInitialForm(next);
      return;
    }
    setForm(next);
    setInitialForm(next);
  }, [profile, profileFields]);

  const selectTab = (tab: TabId) => {
    setActiveTab(tab);
    setNotice(null);
    requestAnimationFrame(() => {
      editorTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const setValue = (key: string, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    if (notice?.error) setNotice(null);
  };

  const save = async () => {
    const validationError = validateProfileForm(form);
    if (validationError) {
      setNotice({ text: validationError, error: true });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const payload: Record<string, unknown> = {};
      for (const { key } of profileFields) {
        if (form[key] !== initialForm[key]) {
          payload[key] = numberFields.has(key) ? Number(form[key] || 0) : form[key] || '';
        }
      }
      if (form.hobbies !== initialForm.hobbies) {
        payload.hobbies = (form.hobbies || '').split(',').map((item) => item.trim()).filter(Boolean);
      }
      if (!Object.keys(payload).length) {
        setNotice({ text: 'Your profile is already up to date.' });
        return;
      }
      const updated = await fetchApi<UserType>('/member-auth/me/', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      updateUser(updated);
      dispatch(baseApi.util.invalidateTags(['VerificationStatus', 'UserProfile', 'MembershipSummary']));
      const saved = mapApiToForm(updated as ProfileUser);
      setForm(saved);
      setInitialForm(saved);
      setNotice({ text: 'Your profile changes have been saved.' });
    } catch (error) {
      setNotice({
        text: error instanceof ApiError && error.errors
          ? messageFrom(error)
          : "We couldn't save your profile changes. Please try again.",
        error: true,
      });
    } finally {
      setBusy(false);
    }
  };

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!allowedPhotoTypes.has(file.type.toLowerCase()) || !allowedPhotoFilename.test(file.name)) {
      setNotice({ text: 'Choose a JPEG, PNG, or WebP image.', error: true });
      event.target.value = '';
      return;
    }
    if (file.size > MAX_PROFILE_PHOTO_BYTES) {
      setNotice({ text: 'Image size must be 10 MB or smaller.', error: true });
      event.target.value = '';
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await uploadManagedPhoto(file).unwrap();
      await refetchPhotos();
      setNotice({ text: 'Your photo was uploaded successfully.' });
    } catch (error) {
      setNotice({ text: messageFrom(error), error: true });
    } finally {
      setBusy(false);
      event.target.value = '';
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    setBusy(true);
    setNotice(null);
    try {
      await deleteManagedPhoto(photoId).unwrap();
      await refetchPhotos();
      setNotice({ text: 'The photo was removed.' });
    } catch (error) {
      setNotice({ text: messageFrom(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  const setPhotoPrimary = async (photoId: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await setManagedPrimary(photoId).unwrap();
      await refetchPhotos();
      setNotice({ text: 'Your primary profile photo has been updated.' });
    } catch (error) {
      setNotice({ text: messageFrom(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  const uploadDocument = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!docFile) return;
    setBusy(true);
    setNotice(null);
    try {
      const data = new FormData();
      data.append('document_type', docType);
      if (docType === 'OTHER' && customDocName.trim()) data.append('custom_document_name', customDocName.trim());
      data.append('file', docFile);
      await fetchApi('/member-auth/me/documents/', { method: 'POST', body: data });
      const fresh = await fetchApi<UserType>('/member-auth/me/');
      updateUser(fresh);
      dispatch(baseApi.util.invalidateTags(['VerificationStatus']));
      setNotice({ text: 'Your verification document was uploaded.' });
      setDocFile(null);
      const input = document.getElementById('ep-document-file') as HTMLInputElement | null;
      if (input) input.value = '';
    } catch (error) {
      setNotice({ text: messageFrom(error), error: true });
    } finally {
      setBusy(false);
    }
  };

  const sendOtp = async (target: VerificationTarget) => {
    setVerifying(true);
    setNotice(null);
    try {
      await fetchApi<{ expires_in: number }>(
        `/member-auth/verification/${target}/send-otp/`,
        { method: 'POST' },
      );
      setVerifyTarget(target);
      setOtpCode('');
      setResendIn(30);
    } catch (error) {
      setNotice({ text: messageFrom(error), error: true });
    } finally {
      setVerifying(false);
    }
  };

  const verifyOtp = async () => {
    if (!verifyTarget || !otpCode.trim()) return;
    setVerifying(true);
    setNotice(null);
    try {
      await fetchApi(`/member-auth/verification/${verifyTarget}/verify-otp/`, {
        method: 'POST',
        body: JSON.stringify({ code: otpCode.trim() }),
      });
      const fresh = await fetchApi<UserType>('/member-auth/me/');
      updateUser(fresh);
      dispatch(baseApi.util.invalidateTags(['VerificationStatus']));
      setNotice({ text: 'Mobile number verified successfully.' });
      setVerifyTarget(null);
      setOtpCode('');
    } catch (error) {
      setNotice({ text: messageFrom(error), error: true });
    } finally {
      setVerifying(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        {authLoading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-6 h-6 animate-spin text-[#e11d48]" />
            <p className="text-xs text-slate-500 font-medium">Preparing your profile editor…</p>
          </div>
        ) : (
          <div className="max-w-md w-full text-center bg-white border border-slate-200 rounded-2xl p-8 shadow-xs">
            <UserRound className="w-10 h-10 mx-auto text-slate-400 mb-3" />
            <h1 className="text-base font-bold text-slate-900 mb-1">Sign in to edit your profile</h1>
            <p className="text-xs text-slate-500 mb-4">Your profile details are available inside your private member account.</p>
            <a href="/login" className="inline-flex px-4 py-2 rounded-xl bg-[#e11d48] text-white text-xs font-bold hover:bg-[#be123c] transition-colors">
              Go to sign in
            </a>
          </div>
        )}
      </div>
    );
  }

  const activeMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const ActiveIcon = activeMeta.icon;
  const documents = Array.isArray(profile.documents) ? profile.documents as Array<Record<string, unknown>> : [];

  const displayName = form.first_name
    ? `${form.first_name} ${form.last_name || ''}`.trim()
    : profile.full_name || 'Member Profile';

  const memberId = profile.id ? `MDP-${String(profile.id).slice(0, 6).toUpperCase()}` : 'MDP-MEMBER';
  const age = calculateAge(form.date_of_birth || (profile.date_of_birth as string));
  const completeness = calculateProfileCompleteness(form, photosList.length, Boolean(profile.is_mobile_verified));

  const renderProfileFields = (tab: Exclude<TabId, 'photos' | 'verification'> = activeTab as Exclude<TabId, 'photos' | 'verification'>) => {
    if (!(tab in sections)) return null;
    const fields = sections[tab];
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {fields.map((field) => {
          const id = `ep-${field.key}`;
          const isWide = field.type === 'textarea' || field.key === 'hobbies' || field.key === 'pref_about';
          return (
            <div key={field.key} className={isWide ? 'sm:col-span-2' : ''}>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor={id} className="text-xs font-bold text-slate-700">
                  {field.label}
                </label>
                {field.type === 'textarea' && (
                  <span className="text-[10px] text-slate-400 font-medium">
                    {(form[field.key] || '').length} characters
                  </span>
                )}
              </div>
              <div className="relative">
                {field.type === 'textarea' ? (
                  <textarea
                    id={id}
                    rows={4}
                    value={form[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={(event) => setValue(field.key, event.target.value)}
                    className="w-full p-3.5 rounded-xl border border-slate-200 bg-[#f8fafc] text-xs text-slate-900 focus:bg-white focus:border-[#e11d48] focus:ring-2 focus:ring-rose-500/10 focus:outline-hidden transition-all resize-y min-h-[100px] placeholder:text-slate-400"
                  />
                ) : field.type === 'select' ? (
                  <>
                    <select
                      id={id}
                      value={form[field.key] || ''}
                      onChange={(event) => setValue(field.key, event.target.value)}
                      className="w-full h-11 px-3.5 pr-10 rounded-xl border border-slate-200 bg-[#f8fafc] text-xs text-slate-900 focus:bg-white focus:border-[#e11d48] focus:ring-2 focus:ring-rose-500/10 focus:outline-hidden appearance-none transition-all cursor-pointer"
                    >
                      {field.options?.map((value) => (
                        <option key={value} value={value}>{value || `Select ${field.label}`}</option>
                      ))}
                    </select>
                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </>
                ) : (
                  <input
                    id={id}
                    type={field.type || 'text'}
                    min={field.type === 'number' ? 0 : undefined}
                    value={form[field.key] || ''}
                    placeholder={field.placeholder || `Enter ${field.label}`}
                    onChange={(event) => setValue(field.key, event.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl border border-slate-200 bg-[#f8fafc] text-xs text-slate-900 focus:bg-white focus:border-[#e11d48] focus:ring-2 focus:ring-rose-500/10 focus:outline-hidden transition-all placeholder:text-slate-400"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderPhotos = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: maxPhotos }).map((_, index) => {
          const photo = photosList[index];
          if (photo) {
            return (
              <div key={photo.id} className="relative group rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 flex flex-col">
                <div className="aspect-4/5 w-full relative">
                  <ProfileImage
                    photoId={photo.id}
                    src={photo.thumbnail_url}
                    variant="thumbnail"
                    version={photo.updated_at}
                    alt={`Profile photo ${index + 1}`}
                    size="full"
                    aspectRatio="4:5"
                    shape="square"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {photo.is_primary && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e11d48] text-white flex items-center gap-1 shadow-sm">
                        <Star className="w-3 h-3 fill-current" /> Primary
                      </span>
                    )}
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm ${
                      photo.status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'
                    }`}>
                      {photo.status}
                    </span>
                  </div>
                </div>

                <div className="p-2.5 bg-white border-t border-slate-100 flex items-center justify-between gap-1">
                  {!photo.is_primary && photo.status === 'approved' ? (
                    <button
                      type="button"
                      onClick={() => setPhotoPrimary(photo.id)}
                      disabled={busy}
                      className="px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:text-[#e11d48] hover:bg-[#fff1f2] rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                    >
                      <Star className="w-3 h-3" /> Make Primary
                    </button>
                  ) : <span />}

                  <button
                    type="button"
                    onClick={() => deletePhoto(photo.id)}
                    disabled={busy}
                    aria-label="Delete photo"
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          }

          if (index === photosList.length) {
            return (
              <label
                key={index}
                className="aspect-4/5 rounded-2xl border-2 border-dashed border-slate-200 hover:border-[#e11d48] bg-[#f8fafc] hover:bg-[#fff5f7] transition-all flex flex-col items-center justify-center p-4 text-center cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 text-slate-500 group-hover:text-[#e11d48] group-hover:border-[#ffe4e6] flex items-center justify-center mb-2 shadow-xs transition-colors">
                  <ImagePlus className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-800 group-hover:text-[#e11d48]">Add Photo</span>
                <span className="text-[10px] text-slate-400 mt-1">JPEG, PNG or WebP<br />Up to 10 MB</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={busy} className="hidden" />
              </label>
            );
          }

          return (
            <div
              key={index}
              className="aspect-4/5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 flex flex-col items-center justify-center p-4 text-slate-300"
            >
              <Camera className="w-6 h-6 mb-1 opacity-40" />
              <span className="text-[10px] font-semibold opacity-50">Slot {index + 1}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-2">
        <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
        High quality, clear front-facing portraits receive 3x more interest requests from matches.
      </p>
    </div>
  );

  const renderVerification = () => {
    const isMobileVerified = Boolean(profile.is_mobile_verified);
    const documentStatus = String(profile.document_status || 'draft');

    return (
      <div className="space-y-6">
        {/* Contact Checks */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Contact Verification</h3>
          <div className="grid sm:grid-cols-2 gap-3">
            {/* Email Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-[#f8fafc]">
              <div className="flex items-center justify-between mb-2">
                <Mail className="w-4 h-4 text-slate-500" />
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Confirmed
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Email</span>
              <span className="text-xs font-bold text-slate-800 truncate block mt-0.5">{String(profile.email || 'Not provided')}</span>
            </div>

            {/* Mobile Card */}
            <div className="p-4 rounded-xl border border-slate-200 bg-[#f8fafc]">
              <div className="flex items-center justify-between mb-2">
                <Smartphone className="w-4 h-4 text-slate-500" />
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                  isMobileVerified ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}>
                  {isMobileVerified ? <CheckCircle2 className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                  {isMobileVerified ? 'Verified' : 'Not Verified'}
                </span>
              </div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Mobile</span>
              <span className="text-xs font-bold text-slate-800 block mt-0.5">{String(profile.mobile_number || 'Not provided')}</span>

              {!isMobileVerified && profile.mobile_number && (
                <div className="mt-3 pt-3 border-t border-slate-200/80">
                  {verifyTarget === 'mobile' ? (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter 6-digit OTP"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                          className="flex-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono tracking-widest text-slate-900 focus:outline-hidden focus:border-[#e11d48]"
                        />
                        <button
                          type="button"
                          onClick={verifyOtp}
                          disabled={verifying || otpCode.length < 4}
                          className="px-3 h-9 rounded-lg bg-[#e11d48] text-white text-xs font-bold hover:bg-[#be123c] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
                        </button>
                      </div>
                      {resendIn > 0 ? (
                        <span className="text-[11px] text-slate-400 block text-center">Resend code in {resendIn}s</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sendOtp('mobile')}
                          disabled={verifying}
                          className="text-[11px] text-[#e11d48] font-bold hover:underline block text-center mx-auto"
                        >
                          Resend verification OTP
                        </button>
                      )}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => sendOtp('mobile')}
                      disabled={verifying}
                      className="w-full py-1.5 rounded-lg border border-[#e11d48] text-[#e11d48] hover:bg-[#fff1f2] font-bold text-xs transition-colors cursor-pointer"
                    >
                      {verifying ? 'Sending...' : 'Verify Mobile via OTP'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Identity Verification Documents */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Identity Document Proof</h3>

          <div className="p-4 rounded-xl border border-slate-200 bg-white mb-4 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#fff1f2] text-[#e11d48] flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800">Verification Status: </span>
              <span className="text-xs font-bold text-[#e11d48] capitalize">{documentStatus.replace(/_/g, ' ')}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {documentStatus === 'approved'
                  ? 'Your identity verification is approved. Verified badge active on your profile.'
                  : 'Upload an official government ID (Aadhaar, Passport, or PAN) to receive your verified profile badge.'}
              </p>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="space-y-2 mb-4">
              {documents.map((doc, idx) => {
                const docId = String(doc.id || idx);
                const type = String(doc.document_type || 'Document');
                const docStatus = String(doc.status || 'PENDING');
                return (
                  <div key={docId} className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-[#f8fafc] text-xs">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-slate-500" />
                      <div>
                        <span className="font-bold text-slate-800 block">{type.replace(/_/g, ' ')}</span>
                        <span className="text-[10px] text-slate-400">Uploaded {doc.uploaded_at ? new Date(String(doc.uploaded_at)).toLocaleDateString() : 'recently'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 capitalize">{docStatus}</span>
                      <button
                        type="button"
                        onClick={() => setViewDoc({ id: docId, type })}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-white text-[11px] font-bold text-slate-700 cursor-pointer transition-colors"
                      >
                        View
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload Form */}
          <form onSubmit={uploadDocument} className="p-4 rounded-xl border border-slate-200 bg-[#f8fafc] space-y-3">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Upload className="w-3.5 h-3.5 text-[#e11d48]" /> Upload Verification Document
            </h4>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Document Type</label>
                <div className="relative">
                  <select
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    className="w-full h-10 px-3 pr-8 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-hidden focus:border-[#e11d48] appearance-none"
                  >
                    <option value="AADHAAR">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENCE">Driving Licence</option>
                    <option value="VOTER_ID">Voter ID</option>
                    <option value="DEGREE_CERTIFICATE">Degree Certificate</option>
                    <option value="OTHER">Other Official Document</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {docType === 'OTHER' && (
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Document Name</label>
                  <input
                    type="text"
                    value={customDocName}
                    onChange={(e) => setCustomDocName(e.target.value)}
                    placeholder="e.g. Caste Certificate"
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 bg-white text-xs text-slate-900 focus:outline-hidden focus:border-[#e11d48]"
                  />
                </div>
              )}

              <div className={docType === 'OTHER' ? 'sm:col-span-2' : ''}>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Select File (PDF, JPEG, PNG)</label>
                <input
                  id="ep-document-file"
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-white file:border-slate-200 file:text-slate-700 hover:file:bg-slate-50 cursor-pointer"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy || !docFile}
              className="px-4 py-2 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              <span>Submit Document for Verification</span>
            </button>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* ── Notification Banner ── */}
      {notice && (
        <div
          className={`p-4 rounded-xl text-xs font-medium flex items-center justify-between gap-3 ${
            notice.error ? 'bg-rose-50 border border-rose-200 text-rose-800' : 'bg-emerald-50 border border-emerald-200 text-emerald-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.error ? <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-600">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Top Profile Overview & Strength Card ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          {/* Avatar: Hidden on desktop to prevent duplicate images; shown as a circle in mobile view */}
          <div className="relative lg:hidden shrink-0">
            <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 border-2 border-white shadow-xs">
              <ProfileImage
                photoId={primaryPhoto?.id}
                src={primaryPhoto?.thumbnail_url}
                variant="thumbnail"
                version={primaryPhoto?.updated_at}
                alt="Profile avatar"
                size="full"
                aspectRatio="1:1"
                shape="circle"
                className="w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => selectTab('photos')}
              className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-[#e11d48] text-white flex items-center justify-center shadow-sm cursor-pointer hover:scale-105 transition-transform"
              title="Manage photos"
            >
              <Camera className="w-3 h-3" />
            </button>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-[#0f0f10]">{displayName}</h1>
              {Boolean(profile.is_mobile_verified) && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> Verified Member
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{profile.email} • <span className="font-mono font-bold text-slate-700">{memberId}</span></p>
          </div>
        </div>

        {/* Profile Completeness Meter */}
        <div className="w-full md:w-64 bg-[#f8fafc] border border-slate-100 rounded-xl p-3.5">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-slate-700 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-[#e11d48]" /> Profile Strength
            </span>
            <span className="font-black text-[#e11d48]">{completeness}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#e11d48] to-rose-400 rounded-full transition-all duration-500"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <span className="text-[10px] text-slate-400 mt-1 block">
            {completeness < 80 ? 'Complete remaining sections to get 3x more match views.' : 'All-Star profile! High discoverability active.'}
          </span>
        </div>
      </div>

      {/* ── Horizontal Navigation Tabs ── */}
      <div className="flex items-center gap-1.5 p-1.5 bg-white rounded-2xl border border-slate-200 overflow-x-auto no-scrollbar shadow-xs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              type="button"
              key={tab.id}
              onClick={() => selectTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                isActive
                  ? 'bg-[#e11d48] text-white shadow-sm shadow-rose-500/20'
                  : 'text-slate-600 hover:bg-[#f7f4f5] hover:text-[#0f0f10]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" strokeWidth={isActive ? 2.2 : 1.85} />
              <span>{tab.label}</span>
              {tab.id === 'photos' && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {photosList.length}/{maxPhotos}
                </span>
              )}
              {tab.id === 'verification' && Boolean(profile.is_mobile_verified) && (
                <Check className={`w-3 h-3 ${isActive ? 'text-white' : 'text-emerald-600'}`} />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Main 2-Column Responsive Workspace ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Focused Edit Card */}
        <div className="lg:col-span-8 space-y-6" ref={editorTopRef}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center gap-3 pb-4 border-b border-slate-100 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#fff1f2] text-[#e11d48] border border-[#ffe4e6] flex items-center justify-center">
                <ActiveIcon className="w-5 h-5" strokeWidth={1.85} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-[#0f0f10]">{activeMeta.label}</h2>
                <p className="text-xs text-slate-500 mt-0.5">{activeMeta.description}</p>
              </div>
            </div>

            {activeTab === 'photos' ? (
              renderPhotos()
            ) : activeTab === 'verification' ? (
              renderVerification()
            ) : (
              renderProfileFields()
            )}
          </div>
        </div>

        {/* Right Column: Live Match Storycard Preview (Desktop Sticky) */}
        <aside className="lg:col-span-4 hidden lg:block sticky top-20">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Eye className="w-3.5 h-3.5 text-[#e11d48]" /> Match Card Preview
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Live
              </span>
            </div>

            {/* Simulated Match Card */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-white shadow-xs">
              <div className="aspect-4/5 w-full bg-slate-100 relative overflow-hidden">
                {primaryPhoto?.thumbnail_url ? (
                  <ProfileImage
                    photoId={primaryPhoto?.id}
                    src={primaryPhoto?.thumbnail_url}
                    variant="thumbnail"
                    version={primaryPhoto?.updated_at}
                    alt="Preview avatar"
                    size="full"
                    aspectRatio="4:5"
                    shape="square"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <UserRound className="w-12 h-12 mb-1 opacity-50" />
                    <span className="text-xs">No primary photo set</span>
                  </div>
                )}

                <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                  {Boolean(profile.is_mobile_verified) && (
                    <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-md text-emerald-700 border border-emerald-100 shadow-sm flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" /> ID Verified
                    </span>
                  )}
                </div>

                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-4 text-white">
                  <h3 className="text-base font-bold leading-tight">
                    {displayName}{age ? `, ${age}` : ''}
                  </h3>
                  <div className="flex items-center gap-1 text-xs text-white/80 mt-1">
                    <MapPin className="w-3 h-3 text-rose-400" />
                    <span>{form.work_location || 'Location not specified'}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-slate-600">
                  <BriefcaseBusiness className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{form.occupation || form.highest_education || 'Profession not added'}</span>
                </div>

                <div className="flex items-center gap-2 text-slate-600">
                  <HeartHandshake className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{form.religion ? `${form.religion}${form.caste ? ` • ${form.caste}` : ''}` : 'Community not added'}</span>
                </div>

                {form.about && (
                  <div className="pt-2 border-t border-slate-100">
                    <p className="text-[11px] text-slate-500 line-clamp-3 italic">
                      "{form.about}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 mt-4 flex items-center gap-1.5">
              <Lock className="w-3 h-3 shrink-0" /> Full contact details remain hidden until you accept an interest request.
            </p>
          </div>
        </aside>
      </div>

      {/* ── Sticky Bottom Save Bar ── */}
      <div className="sticky bottom-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3.5 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-md flex items-center justify-between">
        <div>
          {hasChanges ? (
            <span className="flex items-center gap-2 text-xs font-bold text-amber-600">
              <AlertCircle className="w-4 h-4" /> Unsaved changes ready to save
            </span>
          ) : (
            <span className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> All profile changes are saved
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={save}
          disabled={busy || !hasChanges}
          className="px-6 py-2.5 rounded-xl bg-[#e11d48] hover:bg-[#be123c] text-white font-bold text-xs transition-all flex items-center gap-2 shadow-sm shadow-rose-500/20 disabled:opacity-50 cursor-pointer"
        >
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          <span>{busy ? 'Saving Profile…' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Document View Modal */}
      {viewDoc && (
        <ProtectedDocumentViewer
          documentId={viewDoc.id}
          documentType={viewDoc.type}
          onClose={() => setViewDoc(null)}
        />
      )}
    </div>
  );
}
