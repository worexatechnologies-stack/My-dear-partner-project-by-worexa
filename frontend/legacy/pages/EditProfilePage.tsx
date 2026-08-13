'use client';

import ProfileImage from '@/components/profile/ProfileImage';
import ProtectedDocumentViewer from '@/components/documents/ProtectedDocumentViewer';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { usePathname } from 'next/navigation';
import {
  AlertCircle,
  BadgeCheck,
  BriefcaseBusiness,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  FileText,
  HeartHandshake,
  ImagePlus,
  Loader2,
  Mail,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Star,
  Trash2,
  Upload,
  UserRound,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { useDispatch } from 'react-redux';
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

const maritalStatusOptions = ['', 'Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'];
const preferredMaritalStatusOptions = ['', 'Any', 'Never Married', 'Divorced', 'Widowed', 'Awaiting Divorce'];
const weightOptions = ['', 'NA', 'Below 40 kg', '40–49 kg', '50–59 kg', '60–69 kg', '70–79 kg', '80–89 kg', '90–99 kg', '100 kg and above'];
const bloodGroupOptions = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', "Don't know"];
const complexionOptions = ['', 'Very fair', 'Fair', 'Wheatish', 'Wheatish brown', 'Dark'];
const religionOptions = ['', 'Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Jewish', 'Parsi', 'Other'];
const motherTongueOptions = ['', 'Hindi', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu', 'Odia', 'Other'];
const educationOptions = ['', 'NA', 'High school', 'Diploma', 'BCA', 'B.Com', 'B.Sc', 'BA', 'BE', 'B.Tech', 'BBA', 'MBA', 'MCA', 'M.Tech', 'MBBS', 'MD', 'PhD', 'Other'];
const occupationOptions = ['', 'NA', 'Software professional', 'Business owner', 'Teacher', 'Doctor', 'Engineer', 'Government employee', 'Banking professional', 'Designer', 'Consultant', 'Not working', 'Other'];
const employedInOptions = ['', 'NA', 'Private company', 'Government / public sector', 'Business / self employed', 'Defence / civil services', 'Non-profit organisation', 'Not working'];
const companyOptions = ['', 'Not specified', 'Self employed', 'Government organisation', 'Private company', 'Other'];
const incomeOptions = ['', 'No income', 'Below ₹1 lakh', '₹1–3 lakh', '₹3–5 lakh', '₹5–7 lakh', '₹7–10 lakh', '₹10–15 lakh', '₹15–20 lakh', '₹20–30 lakh', '₹30 lakh and above', 'Prefer not to say'];
const preferredAgeOptions = ['', ...Array.from({ length: 83 }, (_, index) => String(index + 18))];
const preferredHeightOptions = ['Any', ...heightOptions.slice(1)];
const casteOptions = ['', 'Any', 'Brahmin', 'Kshatriya', 'Vaishya', 'Reddy', 'Kamma', 'Kapus', 'Vokkaliga', 'Lingayat', 'Naidu', 'Nair', 'Ezhava', 'SC', 'ST', 'OBC', 'Other'];
const preferredLocationOptions = ['', 'Any', 'Bangalore', 'Tirupati', 'Bangalore & Tirupati', 'Chennai', 'Hyderabad', 'Mumbai', 'Pune', 'Delhi', 'Kolkata', 'Other'];
const preferredEducationOptions = ['', 'Any', 'High school', 'Diploma', 'BCA', 'B.Com', 'B.Sc', 'BA', 'BE', 'B.Tech', 'Btech', 'BBA', 'MBA', 'MCA', 'M.Tech', 'MBBS', 'MD', 'PhD', 'Other'];
const preferredOccupationOptions = ['', 'Any', 'Software professional', 'software', 'Business owner', 'Teacher', 'Doctor', 'Engineer', 'Government employee', 'Banking professional', 'Designer', 'Consultant', 'Not working', 'Other'];
const parentStatusOptions = ['', 'Government employee', 'govt employee', 'Private employee', 'Business owner', 'Self employed', 'Retired', 'Not working', 'House wife', 'Homemaker', 'Deceased', 'Other'];
const siblingCountOptions = ['', ...Array.from({ length: 11 }, (_, index) => String(index))];
const familyStatusOptions = ['', 'Middle class', 'Upper middle class', 'Rich / affluent', 'Other'];
const familyLocationOptions = ['', 'Bangalore', 'Tirupati', 'Chennai', 'Hyderabad', 'Mumbai', 'Pune', 'Delhi', 'Kolkata', 'Other'];
const idealPartnerOptions = [
  '',
  'Kind, caring, and family-oriented',
  'Well educated and professionally settled',
  'Respectful, honest, and understanding',
  'Traditional values with a modern outlook',
  'Ambitious, supportive, and compassionate',
  'Simple, responsible, and good-natured',
  'Open to mutual respect and lifelong companionship',
];

const sections: Record<Exclude<TabId, 'photos' | 'verification'>, FieldConfig[]> = {
  basic: [
    { key: 'first_name', label: 'First name', placeholder: 'Enter your first name' },
    { key: 'last_name', label: 'Last name', placeholder: 'Enter your last name' },
    { key: 'mobile_number', label: 'Mobile number', placeholder: 'Enter your mobile number' },
    { key: 'gender', label: 'Gender', type: 'select', options: ['', 'Male', 'Female'] },
    { key: 'profile_created_by', label: 'Profile created by', type: 'select', options: ['', 'Self', 'Parent', 'Sibling', 'Relative', 'Friend'] },
    { key: 'date_of_birth', label: 'Date of birth', type: 'date' },
    { key: 'work_location', label: 'Current city', placeholder: 'Where do you currently live?' },
    { key: 'about', label: 'About me', type: 'textarea', placeholder: 'Share a thoughtful introduction about yourself' },
    { key: 'hobbies', label: 'Hobbies and interests', placeholder: 'Reading, travel, music' },
  ],
  personal: [
    { key: 'marital_status', label: 'Marital status', type: 'select', options: maritalStatusOptions },
    { key: 'height', label: 'Height', type: 'select', options: heightOptions },
    { key: 'weight', label: 'Weight', type: 'select', options: weightOptions },
    { key: 'blood_group', label: 'Blood group', type: 'select', options: bloodGroupOptions },
    { key: 'complexion', label: 'Complexion', type: 'select', options: complexionOptions },
    { key: 'religion', label: 'Religion', type: 'select', options: religionOptions },
    { key: 'mother_tongue', label: 'Mother tongue', type: 'select', options: motherTongueOptions },
    { key: 'caste', label: 'Caste or community' },
    { key: 'sub_caste', label: 'Sub-caste' },
    { key: 'gothra', label: 'Gothra' },
    { key: 'star_nakshatra', label: 'Star or Nakshatra' },
    { key: 'manglik_status', label: 'Manglik status', type: 'select', options: ["Don't Know", 'Yes', 'No'] },
  ],
  family: [
    { key: 'father_status', label: "Father's status", type: 'select', options: parentStatusOptions },
    { key: 'mother_status', label: "Mother's status", type: 'select', options: parentStatusOptions },
    { key: 'num_brothers', label: 'Number of brothers', type: 'select', options: siblingCountOptions },
    { key: 'num_sisters', label: 'Number of sisters', type: 'select', options: siblingCountOptions },
    { key: 'family_type', label: 'Family type', type: 'select', options: ['', 'Nuclear', 'Joint'] },
    { key: 'family_status', label: 'Family status', type: 'select', options: familyStatusOptions },
    { key: 'family_location', label: 'Family location', type: 'select', options: familyLocationOptions },
  ],
  career: [
    { key: 'highest_education', label: 'Highest education', type: 'select', options: educationOptions },
    { key: 'education_detail', label: 'Education details', type: 'select', options: educationOptions },
    { key: 'occupation', label: 'Occupation', type: 'select', options: occupationOptions },
    { key: 'employed_in', label: 'Employed in', type: 'select', options: employedInOptions },
    { key: 'company', label: 'Company', type: 'select', options: companyOptions },
    { key: 'annual_income', label: 'Annual income', type: 'select', options: incomeOptions },
  ],
  preferences: [
    { key: 'pref_age_min', label: 'Minimum age', type: 'select', options: preferredAgeOptions },
    { key: 'pref_age_max', label: 'Maximum age', type: 'select', options: preferredAgeOptions },
    { key: 'pref_height_min', label: 'Minimum height', type: 'select', options: preferredHeightOptions },
    { key: 'pref_height_max', label: 'Maximum height', type: 'select', options: preferredHeightOptions },
    { key: 'pref_religion', label: 'Preferred religion', type: 'select', options: ['', 'Any', ...religionOptions.slice(1)] },
    { key: 'pref_caste', label: 'Preferred caste', type: 'select', options: casteOptions },
    { key: 'pref_location', label: 'Preferred locations', type: 'select', options: preferredLocationOptions },
    { key: 'pref_education', label: 'Preferred education', type: 'select', options: preferredEducationOptions },
    { key: 'pref_occupation', label: 'Preferred occupation', type: 'select', options: preferredOccupationOptions },
    { key: 'pref_marital_status', label: 'Preferred marital status', type: 'select', options: preferredMaritalStatusOptions },
    { key: 'pref_about', label: 'About my ideal partner', type: 'select', options: idealPartnerOptions },
  ],
};

const tabs = [
  { id: 'basic' as const, label: 'Basic & lifestyle', shortLabel: 'Basics', icon: UserRound, description: 'Identity, location, introduction, and interests' },
  { id: 'photos' as const, label: 'Profile photos', shortLabel: 'Photos', icon: Camera, description: 'Manage the photos people see first' },
  { id: 'personal' as const, label: 'Personal & religion', shortLabel: 'Personal', icon: HeartHandshake, description: 'Personal, cultural, and religious background' },
  { id: 'family' as const, label: 'Family details', shortLabel: 'Family', icon: UsersRound, description: 'Family structure, location, and background' },
  { id: 'career' as const, label: 'Career & education', shortLabel: 'Career', icon: BriefcaseBusiness, description: 'Education, profession, and employment details' },
  { id: 'preferences' as const, label: 'Partner preferences', shortLabel: 'Preferences', icon: SlidersHorizontal, description: 'Describe the person you hope to meet' },
  { id: 'verification' as const, label: 'Verification', shortLabel: 'Verification', icon: ShieldCheck, description: 'Contact checks and private documents' },
];

const numberFields = new Set(['num_brothers', 'num_sisters', 'pref_age_min', 'pref_age_max']);
const allowedPhotoTypes = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const allowedPhotoFilename = /\.(?:jpe?g|png|webp)$/i;

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

  for (const field of profileFieldsForValidation) {
    const value = form[field.key]?.trim() || '';
    if (field.options && value && !field.options.includes(value)) return `Choose a valid ${field.label.toLowerCase()}.`;
    if (field.type === 'textarea' && value.length > 1200) return `${field.label} must be 1,200 characters or fewer.`;
    if (field.key !== 'about' && field.key !== 'pref_about' && value.length > 180) return `${field.label} must be 180 characters or fewer.`;
    if (field.type === 'number' && value) {
      const number = Number(value);
      if (!Number.isInteger(number) || number < 0) return `${field.label} must be a whole number of zero or more.`;
      if (field.key.startsWith('pref_age_') && (number < 18 || number > 100)) return `${field.label} must be between 18 and 100.`;
    }
  }

  const minAge = Number(form.pref_age_min || 0);
  const maxAge = Number(form.pref_age_max || 0);
  if (minAge && maxAge && minAge > maxAge) return 'Minimum preferred age cannot exceed maximum preferred age.';
  const minHeight = heightOptions.indexOf(form.pref_height_min || '');
  const maxHeight = heightOptions.indexOf(form.pref_height_max || '');
  if (minHeight > 0 && maxHeight > 0 && minHeight > maxHeight) return 'Minimum preferred height cannot exceed maximum preferred height.';
  return null;
};

const profileFieldsForValidation = Object.values(sections).flat();

const statusLabel = (status: string) => {
  const labels: Record<string, string> = {
    approved: 'Approved',
    pending_review: 'Under review',
    rejected: 'Changes requested',
    changes_requested: 'Changes requested',
    submitted: 'Submitted',
    draft: 'Draft',
    not_started: 'Draft',
  };
  return labels[status?.toLowerCase()] || 'Draft';
};

const statusTone = (status: string) => {
  const normalized = status?.toLowerCase();
  if (normalized === 'approved') return 'is-approved';
  if (normalized === 'pending_review' || normalized === 'submitted') return 'is-pending';
  if (normalized === 'rejected' || normalized === 'changes_requested') return 'is-rejected';
  return 'is-draft';
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
    if (record.data && typeof record.data === 'object') {
      const data = record.data as { message?: unknown; detail?: unknown };
      if (typeof data.message === 'string') return data.message;
      if (typeof data.detail === 'string') return data.detail;
    }
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

  // 30-second Resend OTP cooldown timer
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
      .catch(() => { /* Keep the cached user when refreshing fails. */ });
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
      if (pathname.startsWith('/settings/')) {
        document.getElementById(`profile-section-${tab}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
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
      <div className="ep-state-page">
        {authLoading ? (
          <div className="ep-loader" role="status"><span /><p>Preparing your profile editor…</p></div>
        ) : (
          <div className="ep-empty-state">
            <UserRound size={28} />
            <h1>Sign in to edit your profile</h1>
            <p>Your profile details are available inside your private member account.</p>
            <a href="/login">Go to sign in</a>
          </div>
        )}
      </div>
    );
  }

  const status = String(profile.profile_status || 'draft');
  const activeMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const ActiveIcon = activeMeta.icon;
  const documents = Array.isArray(profile.documents) ? profile.documents as Array<Record<string, unknown>> : [];
  const isEmbeddedInSettings = pathname.startsWith('/settings/');

  const renderProfileFields = (tab: Exclude<TabId, 'photos' | 'verification'> = activeTab as Exclude<TabId, 'photos' | 'verification'>) => {
    if (!(tab in sections)) return null;
    const fields = sections[tab];
    return (
      <div className="ep-form-grid">
        {fields.map((field) => {
          const id = `ep-${field.key}`;
          const wide = field.type === 'textarea' || field.key === 'hobbies';
          return (
            <div key={field.key} className={`ep-field${wide ? ' ep-field--wide' : ''}`}>
              <div className="ep-field-label">
                <label htmlFor={id}>{field.label}</label>
                {field.type === 'textarea' && <small>{(form[field.key] || '').length} characters</small>}
              </div>
              <div className={`ep-control${field.type === 'textarea' ? ' ep-control--textarea' : ''}`}>
                {field.type === 'textarea' ? (
                  <textarea
                    id={id}
                    rows={5}
                    value={form[field.key] || ''}
                    placeholder={field.placeholder}
                    onChange={(event) => setValue(field.key, event.target.value)}
                  />
                ) : field.type === 'select' ? (
                  <>
                    <select id={id} value={form[field.key] || ''} onChange={(event) => setValue(field.key, event.target.value)}>
                      {field.options?.map((value) => (
                        <option key={value} value={value}>{value || `Select ${field.label.toLowerCase()}`}</option>
                      ))}
                    </select>
                    <ChevronDown size={16} aria-hidden="true" />
                  </>
                ) : (
                  <input
                    id={id}
                    type={field.type || 'text'}
                    min={field.type === 'number' ? 0 : undefined}
                    value={form[field.key] || ''}
                    placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                    onChange={(event) => setValue(field.key, event.target.value)}
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
    <div className="ep-photo-grid">
      {Array.from({ length: maxPhotos }).map((_, index) => {
        const photo = photosList[index];
        if (photo) {
          return (
            <article key={photo.id} className="ep-photo-card">
              <ProfileImage
                photoId={photo.id}
                src={photo.thumbnail_url}
                variant="thumbnail"
                version={photo.updated_at}
                alt={`Profile photo ${index + 1}`}
                size="full"
                aspectRatio="4:5"
                shape="square"
                className="ep-photo-image"
              />
              <div className="ep-photo-badges">
                {photo.is_primary && <span className="is-primary"><Star size={11} /> Primary</span>}
                <span className={`is-${photo.status}`}>{photo.status}</span>
              </div>
              <div className="ep-photo-actions">
                {!photo.is_primary && photo.status === 'approved' && (
                  <button type="button" onClick={() => setPhotoPrimary(photo.id)} disabled={busy}>
                    <Star size={14} /> Make primary
                  </button>
                )}
                <button type="button" className="is-delete" onClick={() => deletePhoto(photo.id)} disabled={busy} aria-label="Delete photo">
                  <Trash2 size={15} /> <span>Remove</span>
                </button>
              </div>
              {photo.rejection_reason && <p className="ep-photo-reason">{photo.rejection_reason}</p>}
            </article>
          );
        }
        if (index === photosList.length) {
          return (
            <label key={index} className="ep-photo-upload">
              <span><ImagePlus size={26} /></span>
              <strong>Add a photo</strong>
              <small>JPEG, PNG or WebP · up to 10 MB</small>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadPhoto} disabled={busy} />
            </label>
          );
        }
        return (
          <div key={index} className="ep-photo-empty" aria-hidden="true">
            <Camera size={21} /><span>Photo slot {index + 1}</span>
          </div>
        );
      })}
    </div>
  );

  const renderVerification = () => {
    const contacts: Array<{
      id: VerificationTarget;
      label: string;
      value: string;
      verified: boolean;
      icon: typeof Mail;
    }> = [
      { id: 'mobile', label: 'Mobile number', value: String(profile.mobile_number || ''), verified: Boolean(profile.is_mobile_verified), icon: Smartphone },
    ];
    const documentStatus = String(profile.document_status || 'draft');

    return (
      <div className="ep-verification-stack">
        <section className="ep-subsection">
          <div className="ep-subsection-heading">
            <div><span className="ep-mini-icon"><BadgeCheck size={18} /></span><div><h3>Contact verification</h3><p>Verify the mobile number connected to your account.</p></div></div>
          </div>
          <article className="ep-contact-card">
            <div className="ep-contact-top">
              <span className="ep-contact-icon"><Mail size={19} /></span>
              <span className="ep-verification-badge is-verified"><CheckCircle2 size={13} /> Saved</span>
            </div>
            <h4>Email address</h4>
            <p>{String(profile.email || 'Not provided')}</p>
          </article>
          <div className="ep-contact-grid">
            {contacts.map(({ id, label, value, verified, icon: Icon }) => (
              <article key={id} className={`ep-contact-card${verified ? ' is-verified' : ''}`}>
                <div className="ep-contact-top">
                  <span className="ep-contact-icon"><Icon size={19} /></span>
                  <span className={`ep-verification-badge${verified ? ' is-verified' : ''}`}>
                    {verified ? <CheckCircle2 size={13} /> : <AlertCircle size={13} />}
                    {verified ? 'Verified' : 'Not verified'}
                  </span>
                </div>
                <h4>{label}</h4>
                <p>{value || 'Not provided'}</p>
                {!verified && value && (
                  verifyTarget === id ? (
                    <>
                      <div className="ep-otp-row">
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="Enter OTP"
                          value={otpCode}
                          onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, ''))}
                          aria-label={`${label} verification code`}
                        />
                        <button type="button" onClick={verifyOtp} disabled={verifying || otpCode.length < 4}>
                          {verifying ? <Loader2 size={15} className="ep-spin" /> : 'Verify'}
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-center gap-1 text-xs">
                        {resendIn > 0 ? (
                          <span className="font-semibold text-slate-400">Resend code in {resendIn}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => sendOtp(id)}
                            disabled={verifying}
                            className="font-bold text-rose-600 transition hover:underline disabled:opacity-50"
                          >
                            Didn't get the code? Resend
                          </button>
                        )}
                      </div>
                    </>
                  ) : (
                    <button type="button" className="ep-contact-action" onClick={() => sendOtp(id)} disabled={verifying}>
                      {verifying ? 'Sending code…' : 'Send verification code'}
                    </button>
                  )
                )}
              </article>
            ))}
          </div>
        </section>

        <section className="ep-subsection">
          <div className="ep-subsection-heading">
            <div><span className="ep-mini-icon"><FileText size={18} /></span><div><h3>Identity documents</h3><p>Documents remain private and are used only for account verification.</p></div></div>
          </div>

          <div className={`ep-document-status ${statusTone(documentStatus)}`}>
            <ShieldCheck size={22} />
            <div>
              <span>Verification status</span>
              <strong>{statusLabel(documentStatus)}</strong>
              <p>
                {documentStatus === 'approved' && 'Your identity verification is complete.'}
                {documentStatus === 'pending_review' && 'Your documents are securely waiting for review.'}
                {documentStatus === 'rejected' && 'Please review the feedback and upload a new document.'}
                {!['approved', 'pending_review', 'rejected'].includes(documentStatus) && 'Upload a government-approved document to begin verification.'}
              </p>
            </div>
          </div>

          {documents.length > 0 && (
            <div className="ep-document-list">
              {documents.map((document, index) => {
                const documentId = String(document.id || index);
                const documentType = String(document.document_type || 'Document');
                const documentState = String(document.status || 'PENDING');
                return (
                  <article key={documentId}>
                    <span className="ep-document-icon"><FileText size={18} /></span>
                    <div>
                      <strong>{documentType.replace(/_/g, ' ')}</strong>
                      <small>Uploaded {document.uploaded_at ? new Date(String(document.uploaded_at)).toLocaleDateString() : 'recently'}</small>
                      {Boolean(document.rejection_reason) && <p>{String(document.rejection_reason)}</p>}
                    </div>
                    <div className="ep-document-actions">
                      <span className={`is-${documentState.toLowerCase()}`}>{documentState}</span>
                      <button type="button" onClick={() => setViewDoc({ id: documentId, type: documentType })}>View</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <form onSubmit={uploadDocument} className="ep-upload-document">
            <div className="ep-upload-copy">
              <span><Upload size={20} /></span>
              <div><h4>Upload a verification document</h4><p>PDF, JPEG or PNG files are accepted.</p></div>
            </div>
            <div className="ep-upload-fields">
              <label>
                <span>Document type</span>
                <div className="ep-control">
                  <select value={docType} onChange={(event) => setDocType(event.target.value)}>
                    <option value="AADHAAR">Aadhaar Card</option>
                    <option value="PAN">PAN Card</option>
                    <option value="PASSPORT">Passport</option>
                    <option value="DRIVING_LICENCE">Driving Licence</option>
                    <option value="VOTER_ID">Voter ID</option>
                    <option value="BIRTH_CERTIFICATE">Birth Certificate</option>
                    <option value="ADDRESS_PROOF">Address Proof</option>
                    <option value="INCOME_CERTIFICATE">Income Certificate</option>
                    <option value="DEGREE_CERTIFICATE">Degree Certificate</option>
                    <option value="TENTH_MARKSHEET">10th Marks Card</option>
                    <option value="TWELFTH_MARKSHEET">12th Marks Card</option>
                    <option value="DIPLOMA_CERTIFICATE">Diploma Certificate</option>
                    <option value="EMPLOYMENT_PROOF">Employment Proof</option>
                    <option value="SALARY_SLIP">Salary Slip</option>
                    <option value="DIVORCE_CERTIFICATE">Divorce Certificate</option>
                    <option value="DEATH_CERTIFICATE">Death Certificate</option>
                    <option value="OTHER">Other</option>
                  </select>
                  <ChevronDown size={16} />
                </div>
              </label>
              {docType === 'OTHER' && (
                <label>
                  <span>Document name</span>
                  <input type="text" value={customDocName} onChange={(event) => setCustomDocName(event.target.value)} placeholder="e.g. Caste certificate" />
                </label>
              )}
              <label className="ep-file-field">
                <span>Select file</span>
                <input id="ep-document-file" type="file" required accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setDocFile(event.target.files?.[0] || null)} />
              </label>
            </div>
            <button type="submit" className="ep-upload-button" disabled={busy || !docFile}>
              {busy ? <Loader2 size={16} className="ep-spinner" /> : <Upload size={16} />}
              <span>Submit document for verification</span>
            </button>
          </form>

          {/* Terms & Conditions Digital Audit Proof */}
          <article className="ep-verification-card ep-verification-card--terms border-2 border-emerald-100 bg-emerald-50/50 rounded-2xl p-5 mt-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0">
                <ShieldCheck size={22} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    Terms of Service & Privacy Policy Agreement
                  </h4>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-600 text-white flex items-center gap-1 shadow-sm">
                    <Check size={14} /> Verified & Binding
                  </span>
                </div>
                <p className="text-xs text-slate-600 mb-2">
                  You accepted the digital Terms of Service & Privacy Policy during account creation.
                </p>
                <div className="text-xs font-semibold text-emerald-800 bg-emerald-100/80 px-3 py-1.5 rounded-xl inline-flex items-center gap-1.5">
                  <strong>Agreement Timestamp Proof:</strong> {profile.terms_accepted_at ? new Date(String(profile.terms_accepted_at)).toLocaleString() : profile.created_at ? new Date(String(profile.created_at)).toLocaleString() : 'On Registration'}
                </div>
              </div>
            </div>
          </article>
        </section>
      </div>
    );
  };

  return (
    <div className={`ep-page${isEmbeddedInSettings ? ' ep-page--settings' : ''}`}>
      <div className="ep-shell">
        {notice && (
          <div className={`ep-notice${notice.error ? ' is-error' : ''}`} role="status">
            {notice.error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message"><XCircle size={16} /></button>
          </div>
        )}

        {status === 'rejected' && Boolean(profile.rejection_reason) && (
          <div className="ep-review-note"><AlertCircle size={18} /><p><strong>Review note</strong>{String(profile.rejection_reason)}</p></div>
        )}

        <div className="ep-workspace">
          <aside className="ep-sidebar">
            <div className="ep-member-card">
              <div className="ep-avatar-wrap">
                <ProfileImage
                  photoId={primaryPhoto?.id}
                  src={primaryPhoto?.thumbnail_url}
                  variant="thumbnail"
                  version={primaryPhoto?.updated_at}
                  alt="Your profile photo"
                  size="md"
                  aspectRatio="4:5"
                  shape="rounded"
                  className="ep-avatar"
                />
                <button type="button" onClick={() => selectTab('photos')} aria-label="Manage profile photos"><Camera size={14} /></button>
              </div>
              <div><strong>{profile.full_name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Your profile'}</strong><span>{profile.email}</span></div>
            </div>

            <nav className="ep-tabs" aria-label="Profile editor sections">
              {tabs.map(({ id, label, shortLabel, icon: Icon }) => (
                <button
                  type="button"
                  key={id}
                  className={activeTab === id ? 'is-active' : ''}
                  aria-current={activeTab === id ? 'page' : undefined}
                  onClick={() => selectTab(id)}
                >
                  <span><Icon size={17} /></span>
                  <strong>{label}</strong>
                  <small>{shortLabel}</small>
                  {id === 'photos' && <em>{photosList.length}/{maxPhotos}</em>}
                  {id === 'verification' && Boolean(profile.is_mobile_verified) && <Check size={14} />}
                </button>
              ))}
            </nav>

            <div className="ep-sidebar-tip">
              <ShieldCheck size={18} />
              <p><strong>Your privacy matters</strong>You control which details are visible to other members.</p>
            </div>
          </aside>

          <section className="ep-editor" ref={editorTopRef}>
            <div className="ep-editor-heading">
              <span className="ep-editor-icon"><ActiveIcon size={21} /></span>
              <div>
                <span>{isEmbeddedInSettings ? 'One profile, one save' : 'Profile section'}</span>
                <h2>{isEmbeddedInSettings ? 'Build your complete profile' : activeMeta.label}</h2>
                <p>{isEmbeddedInSettings ? 'Update every profile section here, then save all your changes once.' : activeMeta.description}</p>
              </div>
              {isEmbeddedInSettings && <small>{hasChanges ? 'Changes ready to save' : 'All changes saved'}</small>}
              {!isEmbeddedInSettings && activeTab === 'photos' && <small>{photosList.length} of {maxPhotos} photos uploaded</small>}
            </div>

            <div className="ep-editor-content">
              {isEmbeddedInSettings ? (
                <div className="ep-all-sections">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <section id={`profile-section-${tab.id}`} key={tab.id} className="ep-profile-section">
                        <header className="ep-profile-section-heading">
                          <span><Icon size={18} /></span>
                          <div><h3>{tab.label}</h3><p>{tab.description}</p></div>
                          {tab.id === 'photos' && <small>{photosList.length}/{maxPhotos} photos</small>}
                        </header>
                        {tab.id === 'photos'
                          ? renderPhotos()
                          : tab.id === 'verification'
                            ? renderVerification()
                            : renderProfileFields(tab.id)}
                      </section>
                    );
                  })}
                </div>
              ) : activeTab === 'photos' ? renderPhotos() : activeTab === 'verification' ? renderVerification() : renderProfileFields()}
            </div>

            <footer className="ep-save-bar">
              <div className={hasChanges ? 'has-changes' : ''}>
                <span>{hasChanges ? 'Unsaved changes' : 'Profile is up to date'}</span>
                <small>{hasChanges ? 'Save before leaving this page.' : 'Your latest changes are safely stored.'}</small>
              </div>
              <button type="button" onClick={save} disabled={busy || !hasChanges}>
                {busy ? <Loader2 size={17} className="ep-spin" /> : <Save size={17} />}
                {busy ? 'Saving profile…' : isEmbeddedInSettings ? 'Save all profile changes' : 'Save changes'}
              </button>
            </footer>
          </section>
        </div>
      </div>

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
