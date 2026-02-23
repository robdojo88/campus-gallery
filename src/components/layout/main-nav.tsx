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

const links = [
    { href: '/feed', label: 'Feed' },
    { href: '/camera', label: 'Camera' },
    { href: '/camera/multi', label: 'Batch' },
    { href: '/gallery/date', label: 'Date Folders' },
    { href: '/gallery/events', label: 'Events' },
    { href: '/freedom-wall', label: 'Freedom Wall' },
    { href: '/incognito', label: 'Incognito' },
    { href: '/visitor-gallery', label: 'Visitor' },
    { href: '/reviews', label: 'Reviews' },
    { href: '/notifications', label: 'Notifications' },
    { href: '/admin', label: 'Admin' },
];

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

export function MainNav() {
    const pathname = usePathname();
    const router = useRouter();
    const [role, setRole] = useState<UserRole | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const user = await getSessionUser();
                if (!mounted) return;
                setUserId(user?.id ?? null);
                if (!user) {
                    setRole(null);
                    setUnreadCount(0);
                    return;
                }
                const [profile, unread] = await Promise.all([getCurrentUserProfile(), countUnreadNotifications()]);
                if (!mounted) return;
                setRole(profile?.role ?? null);
                setUnreadCount(unread);
            } catch {
                if (!mounted) return;
                setRole(null);
                setUserId(null);
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
        setUnreadCount(0);
        setUserId(null);
        setRole(null);
        router.push('/login');
        router.refresh();
    }

    return (
        <header className='sticky top-0 z-40 border-b border-slate-300/70 bg-white/90 backdrop-blur'>
            <div className='mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3 md:px-8'>
                <Link href='/' className='shrink-0 text-lg font-bold tracking-tight'>
                    Campus Gallery
                </Link>
                <nav className='hidden flex-1 items-center gap-2 overflow-x-auto md:flex'>
                    {visibleLinks.map((link) => {
                        const active = pathname.startsWith(link.href);
                        if (link.href === '/notifications') {
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    aria-label='Notifications'
                                    className={`rounded-xl p-2.5 transition ${
                                        active ? 'bg-slate-900' : 'hover:bg-slate-100'
                                    }`}
                                >
                                    <NotificationBell active={active} unreadCount={unreadCount} />
                                </Link>
                            );
                        }
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`rounded-xl px-3 py-2 text-sm font-medium transition ${
                                    active
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-700 hover:bg-slate-100'
                                }`}
                            >{link.label}</Link>
                        );
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
            <nav className='mx-auto flex w-full max-w-7xl flex-wrap gap-2 px-4 pb-3 md:hidden md:px-8'>
                {visibleLinks.map((link) => {
                    const active = pathname.startsWith(link.href);
                    if (link.href === '/notifications') {
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                aria-label='Notifications'
                                className={`rounded-xl px-3 py-2 ${
                                    active ? 'bg-slate-900' : 'bg-slate-100'
                                }`}
                            >
                                <NotificationBell active={active} unreadCount={unreadCount} />
                            </Link>
                        );
                    }
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={`rounded-xl px-3 py-2 text-center text-xs font-medium ${
                                active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'
                            }`}
                        >{link.label}</Link>
                    );
                })}
            </nav>
        </header>
    );
}
