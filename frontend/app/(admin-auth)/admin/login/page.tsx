import type { Metadata } from 'next';
import AdminLoginPage from '@/legacy/pages/AdminLoginPage';
export const metadata: Metadata = { title: 'Admin Login', robots: { index: false, follow: false } };
export default function Page() { return <AdminLoginPage accountType="ADMIN" dashboardPath="/admin/dashboard" />; }
