'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsPersonalPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/settings/profile'); }, [router]);
  return null;
}
