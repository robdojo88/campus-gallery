'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
    countUnreadNotifications,
    getCurrentUserProfile,
    getSessionUser,
    signOutUser,
    subscribeToNotifications,
} from '@/lib/supabase';
import type { UserRole } from '@/lib/types';

type NavIconName =
    | 'feed'
    | 'camera'
    | 'batch'
    | 'date'
    | 'events'
    | 'freedom'
    | 'incognito'
    | 'visitor'
    | 'reviews'
    | 'notifications'
    | 'admin';

type NavLink = {
    href: string;
    label: string;
    icon: NavIconName;
};

const NAV_ROLE_CACHE_KEY = 'campus_gallery_nav_role';
const NAV_USER_CACHE_KEY = 'campus_gallery_nav_user_id';

const links = [
    { href: '/feed', label: 'Feed', icon: 'feed' },
    { href: '/camera', label: 'Camera', icon: 'camera' },
    { href: '/camera/multi', label: 'Batch', icon: 'batch' },
    { href: '/gallery/date', label: 'Date Folders', icon: 'date' },
    { href: '/gallery/events', label: 'Events', icon: 'events' },
    { href: '/freedom-wall', label: 'Freedom Wall', icon: 'freedom' },
    { href: '/incognito', label: 'Incognito', icon: 'incognito' },
    { href: '/visitor-gallery', label: 'Visitor', icon: 'visitor' },
    { href: '/reviews', label: 'Reviews', icon: 'reviews' },
    { href: '/notifications', label: 'Notifications', icon: 'notifications' },
    { href: '/admin', label: 'Admin', icon: 'admin' },
] satisfies NavLink[];

function NotificationBell({
    active,
    unreadCount,
}: {
    active: boolean;
    unreadCount: number;
}) {
    return (
        <span className='relative inline-flex h-5 w-5 items-center justify-center'>
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${active ? 'text-white' : 'text-slate-700'}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <path d='M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5' />
                <path d='M9 17a3 3 0 0 0 6 0' />
            </svg>
            {unreadCount > 0 ? (
                <span className='absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white'>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            ) : null}
        </span>
    );
}

function Icon({
    name,
    active,
}: {
    name: NavIconName;
    active: boolean;
}) {
    const colorClass = active ? 'text-white' : 'text-slate-700';

    if (name === 'notifications') {
        return <span className={colorClass}>N</span>;
    }

    if (name === 'feed') {
        return (
            <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M3 12h7V3H3zM14 21h7v-7h-7zM14 10h7V3h-7zM3 21h7v-4H3z' />
            </svg>
        );
    }

    if (name === 'camera') {
        return (
            <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z' />
                <circle cx='12' cy='13' r='4' />
            </svg>
        );
    }

    if (name === 'batch') {
        return (
            <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <rect x='3' y='7' width='13' height='13' rx='2' />
                <path d='M16 12h3a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2v-3' />
            </svg>
        );
    }

    if (name === 'date') {
        return (
            <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <rect x='3' y='4' width='18' height='18' rx='2' />
                <path d='M16 2v4M8 2v4M3 10h18' />
            </svg>
        );
    }

    if (name === 'events') {
        return (
            <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M7 21V9M17 21V5M7 9l10-4M7 13l10-4' />
            </svg>
        );
    }

    if (name === 'freedom') {
        return (
            <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
            </svg>
        );
    }

    if (name === 'incognito') {
        return (
            <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='M3 12h3l2-5h8l2 5h3' />
                <circle cx='9' cy='13' r='2' />
                <circle cx='15' cy='13' r='2' />
                <path d='M7 17c1.2 1 2.8 1.5 5 1.5s3.8-.5 5-1.5' />
            </svg>
        );
    }

    if (name === 'visitor') {
        return (
            <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <circle cx='12' cy='12' r='9' />
                <path d='M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18' />
            </svg>
        );
    }

    if (name === 'reviews') {
        return (
            <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
                <path d='m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6L3.3 9.4l6-.9Z' />
            </svg>
        );
    }

    return (
        <svg viewBox='0 0 24 24' aria-hidden='true' className={`h-5 w-5 ${colorClass}`} fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'>
            <path d='M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z' />
            <path d='M9 12h6M12 9v6' />
        </svg>
    );
}

function isLinkActive(pathname: string, href: string): boolean {
    if (href === '/camera') return pathname === '/camera';
    return pathname.startsWith(href);
}

function normalizeRole(value: unknown): UserRole | null {
    if (value === 'admin' || value === 'member' || value === 'visitor') return value;
    return null;
}

function getCachedRole(): UserRole | null {
    if (typeof window === 'undefined') return null;
    return normalizeRole(window.localStorage.getItem(NAV_ROLE_CACHE_KEY));
}

function getCachedUserId(): string | null {
    if (typeof window === 'undefined') return null;
    const value = window.localStorage.getItem(NAV_USER_CACHE_KEY);
    const trimmed = value?.trim() ?? '';
    return trimmed || null;
}

function cacheAuthSnapshot(role: UserRole, userId: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NAV_ROLE_CACHE_KEY, role);
    window.localStorage.setItem(NAV_USER_CACHE_KEY, userId);
}

function clearAuthSnapshot(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(NAV_ROLE_CACHE_KEY);
    window.localStorage.removeItem(NAV_USER_CACHE_KEY);
}

function NavIconLink({
    link,
    active,
    unreadCount,
}: {
    link: NavLink;
    active: boolean;
    unreadCount: number;
}) {
    return (
        <Link
            key={link.href}
            href={link.href}
            aria-label={link.label}
            title={link.label}
            className={`group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                active ? 'bg-slate-900' : 'hover:bg-slate-100'
            }`}
        >
            {link.icon === 'notifications' ? (
                <NotificationBell active={active} unreadCount={unreadCount} />
            ) : (
                <Icon name={link.icon} active={active} />
            )}
            <span className='pointer-events-none absolute -bottom-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100'>
                {link.label}
            </span>
        </Link>
    );
}

export function MainNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [role, setRole] = useState<UserRole | null>(() => getCachedRole());
    const [userId, setUserId] = useState<string | null>(() => getCachedUserId());
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const user = await getSessionUser();
                if (!mounted) return;
                if (!user) {
                    clearAuthSnapshot();
                    setRole(null);
                    setUserId(null);
                    setUnreadCount(0);
                    return;
                }
                setUserId(user.id);

                const metadataRole = normalizeRole(user.user_metadata?.role) ?? 'member';
                setRole((current) => current ?? metadataRole);
                const [profile, unread] = await Promise.all([getCurrentUserProfile(), countUnreadNotifications()]);
                if (!mounted) return;
                const resolvedRole = profile?.role ?? metadataRole;
                setRole(resolvedRole);
                setUnreadCount(unread);
                cacheAuthSnapshot(resolvedRole, user.id);
            } catch {
                if (!mounted) return;
                setUnreadCount(0);
            }
        }
        void load();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        if (!userId) {
            return;
        }

        let mounted = true;
        async function refreshUnread() {
            try {
                const unread = await countUnreadNotifications();
                if (!mounted) return;
                setUnreadCount(unread);
            } catch {
                if (!mounted) return;
                setUnreadCount(0);
            }
        }

        void refreshUnread();
        const unsubscribe = subscribeToNotifications(() => {
            void refreshUnread();
        });
        const pollingTimer = window.setInterval(() => {
            void refreshUnread();
        }, 5000);

        return () => {
            mounted = false;
            unsubscribe();
            window.clearInterval(pollingTimer);
        };
    }, [userId]);

    const visibleLinks = useMemo(() => {
        if (!role) {
            const base = ['/feed', '/camera', '/camera/multi', '/reviews'];
            if (userId) base.push('/notifications');
            return links.filter((link) => base.includes(link.href));
        }
        if (role === 'visitor') {
            return links.filter((link) =>
                ['/camera', '/camera/multi', '/visitor-gallery', '/reviews', '/notifications'].includes(link.href),
            );
        }
        if (role === 'member') {
            return links.filter((link) => link.href !== '/admin');
        }
        return links;
    }, [role, userId]);

    async function onLogout() {
        await signOutUser();
        clearAuthSnapshot();
        setUnreadCount(0);
        setUserId(null);
        setRole(null);
        router.push('/login');
        router.refresh();
    }

    return (
        <header className='sticky top-0 z-40 overflow-x-hidden border-b border-slate-300/70 bg-white/90 backdrop-blur'>
            <div className='mx-auto grid w-full max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 md:px-8'>
                <Link href='/' className='shrink-0 text-lg font-bold tracking-tight'>
                    Campus Gallery
                </Link>
                <nav className='hidden flex-1 flex-wrap items-center justify-center gap-2 md:flex'>
                    {visibleLinks.map((link) => {
                        const active = isLinkActive(pathname, link.href);
                        return <NavIconLink key={link.href} link={link} active={active} unreadCount={unreadCount} />;
                    })}
                </nav>
                <div className='flex items-center gap-2'>
                    {userId ? (
                        <Link
                            href={`/profile/${userId}`}
                            className='rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500'
                        >
                            Profile
                        </Link>
                    ) : (
                        <Link
                            href='/login'
                            className='rounded-xl bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500'
                        >
                            Login
                        </Link>
                    )}
                    {userId ? (
                        <button
                            type='button'
                            onClick={() => void onLogout()}
                            className='rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100'
                        >
                            Logout
                        </button>
                    ) : null}
                </div>
            </div>
            <nav className='mx-auto flex w-full max-w-7xl flex-wrap justify-center gap-2 overflow-x-hidden px-4 pb-3 md:hidden md:px-8'>
                {visibleLinks.map((link) => {
                    const active = isLinkActive(pathname, link.href);
                    return <NavIconLink key={link.href} link={link} active={active} unreadCount={unreadCount} />;
                })}
            </nav>
        </header>
    );
}
