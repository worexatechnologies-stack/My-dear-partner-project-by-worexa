import type { Metadata } from 'next';
import AdminLoginPage from '@/legacy/pages/AdminLoginPage';
export const metadata: Metadata = { title: 'Super Admin Login', robots: { index: false, follow: false } };
export default function Page() { return <AdminLoginPage accountType="SUPER_ADMIN" dashboardPath="/super-admin/dashboard" />; }
