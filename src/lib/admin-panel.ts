export type AdminNavIcon =
    | 'admin_users'
    | 'admin_students'
    | 'admin_events'
    | 'admin_reports'
    | 'admin_analytics';

export type AdminNavLink = {
    href:
        | '/admin/users'
        | '/admin/students'
        | '/admin/events'
        | '/admin/reports'
        | '/admin/analytics';
    label: string;
    icon: AdminNavIcon;
};

export const ADMIN_NAV_LINKS: AdminNavLink[] = [
    { href: '/admin/users', label: 'Users', icon: 'admin_users' },
    { href: '/admin/students', label: 'Students', icon: 'admin_students' },
    { href: '/admin/events', label: 'Events', icon: 'admin_events' },
    { href: '/admin/reports', label: 'Reports', icon: 'admin_reports' },
    { href: '/admin/analytics', label: 'Analytics', icon: 'admin_analytics' },
];
