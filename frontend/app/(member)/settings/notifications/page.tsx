'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsNotificationsPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/notifications'); }, [router]);
  return null;
}
