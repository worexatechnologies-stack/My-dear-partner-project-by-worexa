'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPreferencesPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings/profile'); }, [router]);
  return null;
}
