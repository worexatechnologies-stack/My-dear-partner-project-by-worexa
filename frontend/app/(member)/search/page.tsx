import { Suspense } from 'react';
import SearchPageV2 from '@/components/member/search-page-v2';
export default function Page() {
  return (
    <Suspense fallback={<div className="mdp-search-page"><div className="mdp-home-inner"><div className="mdp-skeleton-card h-64" /></div></div>}>
      <SearchPageV2 />
    </Suspense>
  );
}
