export type AdminNavIcon =
    | 'admin_users'
    | 'admin_students'
    | 'admin_events'
    | 'admin_reports'
    | 'admin_analytics'
    | 'admin_audit';

export type AdminNavLink = {
    href:
        | '/admin/users'
        | '/admin/students'
        | '/admin/events'
        | '/admin/reports'
        | '/admin/analytics'
        | '/admin/audit-trail';
    label: string;
    icon: AdminNavIcon;
};

export const ADMIN_NAV_LINKS: AdminNavLink[] = [
    { href: '/admin/users', label: 'Users', icon: 'admin_users' },
    { href: '/admin/students', label: 'Students', icon: 'admin_students' },
    { href: '/admin/events', label: 'Events', icon: 'admin_events' },
    { href: '/admin/reports', label: 'Reports', icon: 'admin_reports' },
    { href: '/admin/analytics', label: 'Analytics', icon: 'admin_analytics' },
    { href: '/admin/audit-trail', label: 'Audit Trail', icon: 'admin_audit' },
];
