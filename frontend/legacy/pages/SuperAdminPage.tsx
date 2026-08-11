'use client';

import { Navigate, Route, Routes } from '@/lib/router-compat';
import AdminLayout from '../components/admin/AdminLayout';
import AdminDashboardPage from './admin/AdminDashboardPage';
import AdminUsersPage from './admin/AdminUsersPage';
import AdminProfileApprovalsPage from './admin/AdminProfileApprovalsPage';
import AdminPhotoApprovalsPage from './admin/AdminPhotoApprovalsPage';
import AdminDocumentVerificationPage from './admin/AdminDocumentVerificationPage';
import AdminMembershipsPage from './admin/AdminMembershipsPage';
import AdminMembershipPlansPage from './admin/AdminMembershipPlansPage';
import AdminPaymentsPage from './admin/AdminPaymentsPage';
import AdminRefundsPage from './admin/AdminRefundsPage';
import AdminTicketsPage from './admin/AdminTicketsPage';
import AdminEnquiriesPage from './admin/AdminEnquiriesPage';
import AdminComplaintsPage from './admin/AdminComplaintsPage';
import AdminReportedProfilesPage from './admin/AdminReportedProfilesPage';

import AdminReportsPage from './admin/AdminReportsPage';
import AdminActivityPage from './admin/AdminActivityPage';
import AdminSystemPage from './admin/AdminSystemPage';
import AdminStaffActivityPage from './admin/AdminStaffActivityPage';
import AdminAccountsManagementPage from './admin/AdminAccountsManagementPage';


export default function SuperAdminPage() {
  return (
    <AdminLayout>
      <Routes>
        {/* Default redirect */}
        <Route index element={<Navigate to="/super-admin/dashboard" replace />} />

        {/* Dashboard */}
        <Route path="dashboard" element={<AdminDashboardPage />} />

        {/* Operations */}
        <Route path="members" element={<AdminUsersPage />} />
        <Route path="members/:id" element={<AdminUsersPage />} />
        <Route path="profile-verifications" element={<AdminProfileApprovalsPage />} />
        <Route path="photo-verifications" element={<AdminPhotoApprovalsPage />} />
        <Route path="document-verifications" element={<AdminDocumentVerificationPage />} />
        
        {/* Memberships & Finance */}
        <Route path="memberships" element={<AdminMembershipsPage />} />
        <Route path="memberships/subscriptions" element={<AdminMembershipsPage />} />
        <Route path="memberships/payments" element={<AdminPaymentsPage />} />
        <Route path="memberships/refunds" element={<AdminRefundsPage />} />
        <Route path="membership-plans" element={<AdminMembershipPlansPage />} />

        {/* Support */}
        <Route path="support-tickets" element={<AdminTicketsPage />} />
        <Route path="support-tickets/:id" element={<AdminTicketsPage />} />
        <Route path="contact-enquiries" element={<AdminEnquiriesPage />} />
        <Route path="complaints" element={<AdminComplaintsPage />} />
        <Route path="reported-profiles" element={<AdminReportedProfilesPage />} />

        <Route path="staff-activity" element={<AdminStaffActivityPage />} />
        <Route path="admin-accounts" element={<AdminAccountsManagementPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="activity" element={<AdminActivityPage />} />
        <Route path="settings" element={<AdminSystemPage mode="settings" />} />
        <Route path="backups" element={<AdminSystemPage mode="backups" />} />

        {/* Fallback Redirections */}
        <Route path="users" element={<Navigate to="/super-admin/members" replace />} />
        <Route path="profile-approvals" element={<Navigate to="/super-admin/profile-verifications" replace />} />
        <Route path="photo-approvals" element={<Navigate to="/super-admin/photo-verifications" replace />} />
        <Route path="document-verification" element={<Navigate to="/super-admin/document-verifications" replace />} />
        <Route path="payments" element={<Navigate to="/super-admin/memberships/payments" replace />} />
        <Route path="refunds" element={<Navigate to="/super-admin/memberships/refunds" replace />} />
        <Route path="faqs" element={<Navigate to="/super-admin/content/faqs" replace />} />
        <Route path="activity-logs" element={<Navigate to="/super-admin/activity" replace />} />

        {/* Catch-all: absolute path prevents redirect loop */}
        <Route path="*" element={<Navigate to="/super-admin/dashboard" replace />} />
      </Routes>
    </AdminLayout>
  );
}
