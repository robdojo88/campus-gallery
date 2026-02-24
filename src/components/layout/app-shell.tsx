'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { MainNav } from '@/components/layout/main-nav';

type SidebarLink = {
    href: string;
    label: string;
    hint: string;
};

const sidebarLinks: SidebarLink[] = [
    { href: '/feed', label: 'Feed', hint: 'Campus timeline' },
    { href: '/camera', label: 'Camera', hint: 'Capture live' },
    { href: '/camera/multi', label: 'Batch', hint: 'Multi capture' },
    { href: '/gallery/date', label: 'Date Folders', hint: 'Chronological gallery' },
    { href: '/gallery/events', label: 'Events', hint: 'Tagged moments' },
    { href: '/freedom-wall', label: 'Freedom Wall', hint: 'Open discussions' },
    { href: '/incognito', label: 'Incognito', hint: 'Anonymous space' },
    { href: '/visitor-gallery', label: 'Visitor', hint: 'Guest captures' },
    { href: '/reviews', label: 'Visitor Feedback', hint: 'Guest feedback' },
    { href: '/notifications', label: 'Notifications', hint: 'Realtime activity' },
];

function isActive(pathname: string, href: string): boolean {
    if (href === '/camera') return pathname === '/camera';
    return pathname.startsWith(href);
}

function LeftSidebar({ pathname }: { pathname: string }) {
    return (
        <aside className='hidden lg:block'>
            <div className='sticky top-24 space-y-4'>
                <section className='rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'>
                    <p className='px-2 pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                        Navigation
                    </p>
                    <nav className='space-y-1.5'>
                        {sidebarLinks.map((link) => {
                            const active = isActive(pathname, link.href);
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`group flex items-center justify-between rounded-xl px-3 py-2.5 transition ${
                                        active
                                            ? 'bg-blue-50 ring-1 ring-blue-100'
                                            : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <div className='flex min-w-0 items-center gap-2.5'>
                                        <span
                                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                                active ? 'bg-blue-600' : 'bg-slate-300 group-hover:bg-slate-500'
                                            }`}
                                            aria-hidden='true'
                                        />
                                        <div className='min-w-0'>
                                            <p
                                                className={`truncate text-sm font-medium ${
                                                    active
                                                        ? 'text-blue-700'
                                                        : 'text-slate-700'
                                                }`}
                                            >
                                                {link.label}
                                            </p>
                                            <p className='truncate text-[11px] text-slate-500'>
                                                {link.hint}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </nav>
                </section>

                <section className='rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'>
                    <p className='px-2 pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                        Quick Actions
                    </p>
                    <div className='grid grid-cols-1 gap-2'>
                        <Link
                            href='/camera'
                            className='rounded-xl bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-blue-500'
                        >
                            Capture Now
                        </Link>
                        <Link
                            href='/camera/multi'
                            className='rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
                        >
                            Start Batch Capture
                        </Link>
                    </div>
                </section>
            </div>
        </aside>
    );
}

function RightSidebar() {
    return (
        <aside className='hidden xl:block'>
            <div className='sticky top-24 space-y-4'>
                <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                    <p className='text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                        Campus Updates
                    </p>
                    <ul className='mt-3 space-y-3 text-sm'>
                        <li className='rounded-xl bg-slate-50 p-3 text-slate-700'>
                            Event folders are now available for structured tagging.
                        </li>
                        <li className='rounded-xl bg-slate-50 p-3 text-slate-700'>
                            Realtime likes, comments, and notifications are active.
                        </li>
                        <li className='rounded-xl bg-slate-50 p-3 text-slate-700'>
                            Offline capture queue syncs automatically once online.
                        </li>
                    </ul>
                </section>

                <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                    <p className='text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                        UX Tips
                    </p>
                    <div className='mt-3 space-y-2.5 text-sm text-slate-700'>
                        <p className='rounded-xl bg-slate-50 p-3'>
                            Use the camera route for live-only captures.
                        </p>
                        <p className='rounded-xl bg-slate-50 p-3'>
                            Use notifications to quickly jump to new interactions.
                        </p>
                        <p className='rounded-xl bg-slate-50 p-3'>
                            Hover icons to reveal tooltips on desktop.
                        </p>
                    </div>
                </section>
            </div>
        </aside>
    );
}

export function AppShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isCameraRoute = pathname.startsWith('/camera');
    const showLeftSidebar = !isCameraRoute;
    const showRightSidebar =
        !isCameraRoute &&
        !pathname.startsWith('/admin') &&
        !pathname.startsWith('/profile');

    const gridLayoutClass =
        showLeftSidebar && showRightSidebar
            ? 'grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]'
            : showLeftSidebar
              ? 'grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]'
              : showRightSidebar
                ? 'grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]'
                : 'grid-cols-1 gap-6';

    return (
        <div className='min-h-screen'>
            <MainNav />
            <div className='mx-auto w-full max-w-[1480px] px-3 pb-10 pt-5 md:px-6 md:pt-6 lg:px-8'>
                <div className={`grid ${gridLayoutClass}`}>
                    {showLeftSidebar ? <LeftSidebar pathname={pathname} /> : null}
                    <main className='min-w-0'>{children}</main>
                    {showRightSidebar ? <RightSidebar /> : null}
                </div>
            </div>
        </div>
    );
}
