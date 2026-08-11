'use client';

import { Navigate, Route, Routes } from '@/lib/router-compat';
import AdminLayout from '../components/admin/AdminLayout';
import AdminTicketsPage from './admin/AdminTicketsPage';
import StaffDashboardPage from './admin/StaffDashboardPage';
import StaffWorkQueuePage from './admin/StaffWorkQueuePage';

export default function StaffPage() {
  return (
    <AdminLayout>
      <Routes>
        <Route index element={<Navigate to="/staff/dashboard" replace />} />
        <Route path="dashboard" element={<StaffDashboardPage />} />
        <Route path="my-work" element={<StaffWorkQueuePage />} />
        <Route path="assigned-tickets" element={<AdminTicketsPage />} />
        <Route path="*" element={<Navigate to="/staff/dashboard" replace />} />
      </Routes>
    </AdminLayout>
  );
}

