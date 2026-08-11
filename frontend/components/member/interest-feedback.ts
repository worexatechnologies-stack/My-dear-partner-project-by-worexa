export type FeedbackTone = 'error' | 'info';

/**
 * Maps an interest / shortlist API error to a user-friendly message + tone.
 * The backend returns {"detail": ..., "code": "MEMBERSHIP_REQUIRED" | "DAILY_INTEREST_LIMIT" ...}.
 */
export function interestFeedback(error: unknown): { message: string; tone: FeedbackTone } {
  const err = error as any;
  const code = err?.code || err?.errors?.code;
  const raw = err?.message || (error instanceof Error ? error.message : '');

  if (code === 'MEMBERSHIP_REQUIRED' || /membership plan|upgrade your plan/i.test(raw)) {
    return {
      message:
        'Your current plan doesn\u2019t allow sending likes. Please upgrade your plan to send likes.',
      tone: 'error',
    };
  }

  if (code === 'DAILY_INTEREST_LIMIT' || /interest limit|daily interest/i.test(raw)) {
    return {
      message:
        'You\u2019ve reached today\u2019s interest limit. Upgrade your plan or try again tomorrow.',
      tone: 'info',
    };
  }

  return { message: raw || 'This action could not be completed. Please try again.', tone: 'error' };
}