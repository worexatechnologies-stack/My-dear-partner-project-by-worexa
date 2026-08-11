'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function SettingsMembershipPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/membership'); }, [router]);
  return null;
}
