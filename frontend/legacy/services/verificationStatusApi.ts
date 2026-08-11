import { baseApi } from './baseApi';

type DisplayVerificationStatus = 'incomplete' | 'pending' | 'approved' | 'rejected';

function displayStatus(status: unknown): DisplayVerificationStatus {
  switch (status) {
    case 'approved':
    case 'verified':
    case 'complete':
    case 'completed':
      return 'approved';
    case 'pending':
    case 'pending_review':
      return 'pending';
    case 'rejected':
    case 'changes_requested':
      return 'rejected';
    default:
      return 'incomplete';
  }
}

export interface VerificationStatus {
  account_status: 'INCOMPLETE' | 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'SUSPENDED';
  is_verified: boolean;
  contact: {
    status: DisplayVerificationStatus;
    name: string;
    email_verified?: boolean;
    mobile_verified?: boolean;
    reason?: string | null;
  };
  profile: {
    status: DisplayVerificationStatus;
    submitted_at: string | null;
    reviewed_at: string | null;
    reason: string | null;
  };
  primary_photo: {
    status: DisplayVerificationStatus;
    submitted_at: string | null;
    reviewed_at: string | null;
    reason: string | null;
  };
  documents: {
    status: DisplayVerificationStatus;
    submitted_at: string | null;
    reviewed_at: string | null;
    reason: string | null;
  };
  next_action: string;
  membership_pending: boolean;
}

export const verificationStatusApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVerificationStatus: builder.query<VerificationStatus, void>({
      query: () => ({
        url: '/member-auth/verification/status/',
        method: 'GET',
      }),
      transformResponse: (response: any) => {
        // The member-status endpoint returns contact flags inside `contact`,
        // while the verification endpoint exposes them at the top level.
        // Accept both shapes so a successful OTP verification immediately
        // marks this checklist item as complete.
        const emailVerified = Boolean(response.email_verified ?? response.contact?.email_verified);
        const mobileVerified = Boolean(response.mobile_verified ?? response.contact?.mobile_verified);

        return {
          ...response,
          // The backend exposes `overall_status` and the two contact flags,
          // while this client page consumes `account_status` and one contact
          // checklist item. Normalize both response shapes here.
          account_status: response.account_status ?? String(response.overall_status ?? 'incomplete').toUpperCase(),
          contact: {
            ...response.contact,
            email_verified: emailVerified,
            mobile_verified: mobileVerified,
            // OTP flags are the source of truth for this combined contact
            // step. Some API responses retain an old `contact.status` after
            // both checks have passed.
            status: emailVerified && mobileVerified
              ? 'approved'
              : response.contact?.status ? displayStatus(response.contact.status) : 'incomplete',
          },
          profile: { ...response.profile, status: displayStatus(response.profile?.status) },
          primary_photo: { ...response.primary_photo, status: displayStatus(response.primary_photo?.status ?? response.photo?.status) },
          documents: { ...response.documents, status: displayStatus(response.documents?.status ?? response.document?.status) },
        };
      },
      providesTags: ['VerificationStatus'],
    }),
  }),
});

export const {
  useGetVerificationStatusQuery,
} = verificationStatusApi;
