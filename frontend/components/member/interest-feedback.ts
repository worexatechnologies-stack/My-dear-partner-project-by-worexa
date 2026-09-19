export type FeedbackTone = 'error' | 'info';

export interface InterestFeedback {
  message: string;
  tone: FeedbackTone;
  isDailyLimit: boolean;
  isMembershipRequired: boolean;
}

/**
 * Maps an interest / shortlist API error to a clean, user-friendly message + tone.
 * The backend returns {"detail": ..., "code": "MEMBERSHIP_REQUIRED" | "DAILY_INTEREST_LIMIT" ...}.
 */
export function interestFeedback(error: unknown): InterestFeedback {
  const err = error as any;
  const code = err?.code || err?.errors?.code || err?.data?.code;
  const status = err?.status;
  const raw =
    err?.message ||
    err?.detail ||
    err?.errors?.detail ||
    (error instanceof Error ? error.message : '');

  const isDailyLimit =
    code === 'DAILY_INTEREST_LIMIT' ||
    /interest limit|daily interest|per day|reached today|reached.*limit|limit.*reached/i.test(raw) ||
    (status === 403 && !/membership|plan/i.test(raw));

  const isMembership =
    code === 'MEMBERSHIP_REQUIRED' ||
    /membership plan|upgrade your plan|plan is required/i.test(raw);

  if (isDailyLimit) {
    return {
      message:
        'Daily interests completed for today! Upgrade to Premium for unlimited interests or try again tomorrow.',
      tone: 'info',
      isDailyLimit: true,
      isMembershipRequired: false,
    };
  }

  if (isMembership) {
    return {
      message:
        'Your current plan doesn’t allow sending likes. Please upgrade your plan to send likes.',
      tone: 'info',
      isDailyLimit: false,
      isMembershipRequired: true,
    };
  }

  return {
    message: raw || 'This action could not be completed. Please try again.',
    tone: 'error',
    isDailyLimit: false,
    isMembershipRequired: false,
  };
}