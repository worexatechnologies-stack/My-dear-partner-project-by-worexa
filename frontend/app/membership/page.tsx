import { Suspense } from 'react';
import MembershipContent from './membership-content';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function MembershipPage() {
  return (
    <Suspense fallback={<div className="mp-route-loading"><span /><p>Preparing membership options...</p></div>}>
      <MembershipContent />
    </Suspense>
  );
}
