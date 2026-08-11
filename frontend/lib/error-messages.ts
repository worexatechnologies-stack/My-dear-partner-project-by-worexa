/**
 * Centralized, user-friendly error mapping for the entire frontend.
 *
 * Every backend error carries a stable `code` (see backend apps.core.exceptions).
 * This module maps those codes (and HTTP statuses) to simple, polite,
 * non-technical messages. Raw framework text such as "Bad Request",
 * "Unauthorized", "non_field_errors", or "[object Object]" must NEVER reach
 * the user — the helpers below guarantee that.
 *
 * Save this file as UTF-8. Use real punctuation (', ', ', —) not mojibake.
 */

export type ErrorCode = string;

/** Stable application error codes → simple user message. */
export const ERROR_CODE_MESSAGES: Record<string, string> = {
  // Authentication
  INVALID_CREDENTIALS: 'The email or mobile number or password is incorrect.',
  AUTHENTICATION_REQUIRED: 'Please sign in to continue.',
  ACCESS_TOKEN_EXPIRED: 'Your session has expired. Please sign in again.',
  SESSION_EXPIRED: 'Your session has expired. Please sign in again.',
  SESSION_REVOKED: 'You have been signed out. Please sign in again.',
  ACCOUNT_SUSPENDED: 'Your account is currently suspended. Please contact support for help.',
  WRONG_PORTAL: 'Please use the correct login page for your account.',
  OTP_EXPIRED: 'The verification code has expired. Request a new code.',
  OTP_INCORRECT: 'The verification code is incorrect.',
  OTP_RATE_LIMITED: 'Too many attempts. Please wait before trying again.',

  // Validation
  VALIDATION_ERROR: 'Some information is missing or incorrect. Please check your entries and try again.',
  INVALID_INPUT: 'Some information is missing or incorrect. Please check and try again.',
  REQUIRED_FIELD_MISSING: 'Please fill in all required fields.',
  INVALID_FILE: 'Please upload a JPEG, PNG, or WebP image.',
  PROFILE_INCOMPLETE: 'Please complete the required profile details before submitting.',
  PARSE_ERROR: 'The request could not be understood. Please try again.',

  // Resources
  RESOURCE_NOT_FOUND: 'The requested information could not be found.',
  MEMBER_NOT_FOUND: 'This member is no longer available.',
  PHOTO_NOT_FOUND: 'This photo is no longer available.',
  DOCUMENT_NOT_FOUND: 'This document could not be found.',
  TICKET_NOT_FOUND: 'This support ticket could not be found.',

  // Conflicts
  DUPLICATE_EMAIL: 'This email address is already registered.',
  DUPLICATE_MOBILE: 'This mobile number is already registered.',
  DUPLICATE_PHOTO: 'This photo has already been uploaded.',
  ALREADY_APPROVED: 'This request has already been approved.',
  ALREADY_REJECTED: 'This request has already been rejected.',
  TICKET_ALREADY_CLAIMED: 'Another support agent has already accepted this ticket.',
  PRIMARY_PHOTO_NOT_VERIFIED: 'Your primary photo must be approved before adding more photos.',
  CONFLICT: 'This action cannot be completed because the information has already changed.',

  // Limits
  RATE_LIMITED: 'Too many attempts. Please wait a moment and try again.',
  PHOTO_LIMIT_REACHED: 'You have reached the maximum number of profile photos.',
  MEMBERSHIP_LIMIT_REACHED: 'You have reached the limit allowed by your plan.',

  // Server / network
  INTERNAL_SERVER_ERROR: "We couldn't complete your request right now. Please try again.",
  DATABASE_UNAVAILABLE: 'Server is down. Please try again later.',
  SERVICE_UNAVAILABLE: 'Server is down. Please try again later.',
  GATEWAY_ERROR: 'The server returned an invalid response. Please try again.',
  REQUEST_TIMEOUT: 'The request took too long. Please try again.',
  NETWORK_ERROR: 'We couldn\'t connect to the server. Check your internet connection and try again.',
  OFFLINE: 'You appear to be offline. Check your internet connection.',
  UNKNOWN_ERROR: 'Something went wrong. Please try again.',

  // Permission
  PERMISSION_DENIED: "You don't have permission to perform this action.",
  METHOD_NOT_ALLOWED: 'This action is not supported.',
};

/** Raw backend field names → human-readable labels (no internal names shown). */
export const FIELD_LABELS: Record<string, string> = {
  identifier: 'Email or Mobile Number',
  about_me: 'About Me',
  about: 'About',
  bio: 'About',
  date_of_birth: 'Date of Birth',
  current_city: 'Current City',
  marital_status: 'Marital Status',
  mother_tongue: 'Mother Tongue',
  highest_education: 'Highest Education',
  annual_income: 'Annual Income',
  occupation: 'Occupation',
  employer: 'Employer',
  preferred_min_age: 'Minimum Preferred Age',
  preferred_max_age: 'Maximum Preferred Age',
  email: 'Email',
  mobile: 'Mobile Number',
  mobile_number: 'Mobile Number',
  phone: 'Phone Number',
  password: 'Password',
  confirm_password: 'Confirm Password',
  current_password: 'Current Password',
  photo: 'Photo',
  image: 'Photo',
  document: 'Document',
  thumbnail: 'Photo',
  rejection_reason: 'Reason',
  non_field_errors: 'General',
  detail: 'General',
  code: 'General',
};

/** Friendly messages for common action failures (used in toasts/banners). */
export const ACTION_MESSAGES: Record<string, string> = {
  profile_save: "We couldn't save your profile changes. Please try again.",
  profile_submit: "We couldn't submit your profile for review. Please try again.",
  photo_upload: "We couldn't upload this photo. Please try another image.",
  photo_delete: "We couldn't delete this photo. Please try again.",
  photo_approve: "We couldn't approve this photo. Please try again.",
  photo_reject: "We couldn't reject this photo. Please try again.",
  photo_replace: "We couldn't replace this photo. Please try another image.",
  photo_set_primary: "We couldn't set this photo as primary. Please try again.",
  document_upload: "We couldn't upload this document. Please try again.",
  document_approve: "We couldn't approve this document. Please try again.",
  document_reject: "We couldn't reject this document. Please try again.",
  ticket_create: "We couldn't create your support ticket. Please try again.",
  ticket_reply: "We couldn't send your reply. Please try again.",
  membership_activate: "We couldn't activate the membership. Please try again.",
  member_suspend: "We couldn't suspend this member. Please try again.",
  member_delete: "We couldn't remove this member. Please try again.",
  password_change: "We couldn't change your password. Please try again.",
  login: 'We couldn\'t sign you in. Please try again.',
  register: "We couldn't create your account. Please try again.",
  logout: 'We couldn\'t sign you out. Please try again.',
};

/** Friendly success messages. */
export const SUCCESS_MESSAGES: Record<string, string> = {
  profile_save: 'Profile changes saved successfully.',
  profile_submit: 'Your profile has been submitted for review.',
  photo_upload: 'Photo uploaded successfully and is awaiting review.',
  photo_delete: 'Photo deleted successfully.',
  photo_approve: 'Photo approved successfully.',
  photo_reject: 'Photo rejected successfully.',
  photo_replace: 'Photo replaced successfully.',
  document_upload: 'Document uploaded successfully and is awaiting review.',
  document_approve: 'Document approved successfully.',
  password_change: 'Password changed successfully.',
  logout: 'You have been signed out.',
  logout_all: 'You have been signed out from all devices.',
};

/** Friendly message by HTTP status when no code is present. */
export function statusMessage(status: number, retryAfter?: number): string {
  switch (status) {
    case 400:
      return 'Some information is missing or incorrect. Please check your entry and try again.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return "You don't have permission to perform this action.";
    case 404:
      return 'The requested information could not be found.';
    case 405:
      return 'This action is not supported.';
    case 409:
      return 'This action cannot be completed because the information has already changed.';
    case 413:
      return 'The file you uploaded is too large. Please try a smaller one.';
    case 429:
      return retryAfter
        ? `Too many attempts. Please wait ${retryAfter} seconds and try again.`
        : 'Too many attempts. Please wait a moment and try again.';
    case 500:
      return "We couldn't complete your request right now. Please try again.";
    case 502:
      return 'The server returned an invalid response. Please try again.';
    case 503:
      return 'Server is down. Please try again later.';
    case 504:
      return 'The request took too long. Please try again.';
    default:
      if (status >= 500) return "We couldn't complete your request right now. Please try again.";
      if (status >= 400) return 'We couldn\'t complete your request. Please try again.';
      return 'Something went wrong. Please try again.';
  }
}

/** Convert a raw backend field name into a human-readable label. */
export function humanizeField(field: string): string {
  if (!field) return 'General';
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  const spaced = field.replace(/_/g, ' ').replace(/\./g, ' ').trim();
  return spaced
    .split(' ')
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
    .join(' ');
}

function isPlainString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Normalize backend field errors into { fieldLabel: message } for display.
 * Never emits raw field names or "[object Object]".
 */
export function formatFieldErrors(errors: unknown): Record<string, string> {
  const result: Record<string, string> = {};
  if (!errors || typeof errors !== 'object') return result;

  for (const [field, value] of Object.entries(errors)) {
    if (value === null || value === undefined) continue;
    let message = '';
    if (Array.isArray(value)) {
      message = value.filter(isPlainString).join(' ');
    } else if (isPlainString(value)) {
      message = value;
    } else if (typeof value === 'object') {
      message = formatFieldErrors(value)[Object.keys(formatFieldErrors(value))[0] ?? ''] ?? '';
    }
    if (!message) continue;
    result[humanizeField(field)] = message;
  }
  return result;
}

/**
 * Resolve a single friendly message. Priority:
 * 1. Known code mapping (or the backend's own friendly message)
 * 2. Field-specific error (first one)
 * 3. HTTP status fallback
 */
export function friendlyMessage(params: {
  code?: string | null;
  message?: string | null;
  status?: number;
  errors?: unknown;
  retryAfter?: number;
}): string {
  const { code, message, status, errors, retryAfter } = params;

  if (code && ERROR_CODE_MESSAGES[code]) return ERROR_CODE_MESSAGES[code];

  if (isPlainString(message)) {
    const looksTechnical =
      /(bad request|unauthorized|forbidden|not found|internal server error|validationerror|doesnotexist|integrityerror|traceback|\[object object\]|non_field_errors)/i.test(
        message,
      );
    if (!looksTechnical) return message;
  }

  const fieldErrors = formatFieldErrors(errors);
  const firstFieldMessage = Object.values(fieldErrors)[0];
  if (firstFieldMessage) return firstFieldMessage;

  if (status) return statusMessage(status, retryAfter);
  return ERROR_CODE_MESSAGES.UNKNOWN_ERROR;
}

/** Friendly message for a network/offline failure (no server response). */
export function networkErrorMessage(offline = false): string {
  return offline ? ERROR_CODE_MESSAGES.OFFLINE : ERROR_CODE_MESSAGES.NETWORK_ERROR;
}
