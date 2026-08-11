'use client';

import dynamic from 'next/dynamic';

const EditProfilePage = dynamic(() => import('@/legacy/pages/EditProfilePage'), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-2xl border border-gray-100 p-8 animate-pulse">
      <div className="h-6 w-48 bg-gray-200 rounded mb-6" />
      <div className="space-y-4">
        <div className="h-10 bg-gray-100 rounded-xl" />
        <div className="h-10 bg-gray-100 rounded-xl" />
        <div className="h-10 bg-gray-100 rounded-xl" />
        <div className="h-24 bg-gray-100 rounded-xl" />
      </div>
    </div>
  ),
});

export default function SettingsProfilePage() {
  return <EditProfilePage />;
}
