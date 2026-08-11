import { ReactNode } from 'react';

/**
 * Layout for profile pages
 * - Provides consistent structure for profile views
 * - Breadcrumbs and navigation context
 * - MembershipProvider already available from parent layout
 */
export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
