'use client';

import { useEffect } from 'react';
import { PageErrorState } from '@/components/shared/page-error-state';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <PageErrorState
      title="We could not load this page"
      message="Your data has not been changed. Try the request again, or return later if the service is unavailable."
      requestId={error.digest}
      onRetry={reset}
    />
  );
}
