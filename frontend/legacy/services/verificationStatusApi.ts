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

export interface MemberVerificationDocument {
  id: string;
  document_type: string;
  custom_document_name?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  rejection_reason?: string | null;
  uploaded_at?: string;
}

export const verificationStatusApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getVerificationStatus: builder.query<VerificationStatus, void>({
      query: () => ({
        url: '/member-auth/verification/status/',
        method: 'GET',
      }),
      transformResponse: (response: any) => {
        // Accept both legacy response shapes while keeping mobile verification
        // as the only contact-verification requirement.
        const mobileVerified = Boolean(response.mobile_verified ?? response.contact?.mobile_verified);

        return {
          ...response,
          // Normalize the legacy status shape used by this client page.
          account_status: response.account_status ?? String(response.overall_status ?? 'incomplete').toUpperCase(),
          contact: {
            ...response.contact,
            mobile_verified: mobileVerified,
            status: mobileVerified ? 'approved' : 'incomplete',
          },
          profile: { ...response.profile, status: displayStatus(response.profile?.status) },
          primary_photo: { ...response.primary_photo, status: displayStatus(response.primary_photo?.status ?? response.photo?.status) },
          documents: { ...response.documents, status: displayStatus(response.documents?.status ?? response.document?.status) },
        };
      },
      providesTags: ['VerificationStatus'],
    }),
    getMemberVerificationDocuments: builder.query<MemberVerificationDocument[], void>({
      query: () => ({
        url: '/member-auth/me/documents/',
        method: 'GET',
      }),
      transformResponse: (response: any) => {
        if (Array.isArray(response)) return response;
        if (Array.isArray(response?.documents)) return response.documents;
        if (Array.isArray(response?.results)) return response.results;
        throw new Error('The verification document response was invalid.');
      },
      providesTags: ['VerificationStatus'],
    }),
    submitMemberVerificationDocument: builder.mutation<unknown, FormData>({
      query: (body) => ({
        url: '/member-auth/me/documents/',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['VerificationStatus'],
    }),
  }),
});

export const {
  useGetVerificationStatusQuery,
  useGetMemberVerificationDocumentsQuery,
  useSubmitMemberVerificationDocumentMutation,
} = verificationStatusApi;
