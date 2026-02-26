'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { ADMIN_NAV_LINKS } from '@/lib/admin-panel';

function isAdminNavActive(pathname: string, href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminPanelShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();

    return (
        <div className='grid grid-cols-1 gap-5 xl:grid-cols-[240px_minmax(0,1fr)]'>
            <aside className='xl:sticky xl:top-24 xl:h-fit'>
                <div className='relative overflow-hidden rounded-[30px] border border-white/70 bg-gradient-to-b from-white/90 via-white/80 to-slate-100/75 p-3 shadow-[0_30px_70px_-42px_rgba(15,23,42,0.55)] backdrop-blur-xl'>
                    <div className='pointer-events-none absolute -left-10 top-0 h-20 w-20 rounded-full bg-sky-200/40 blur-2xl' />
                    <div className='pointer-events-none absolute -bottom-14 right-0 h-24 w-24 rounded-full bg-slate-300/35 blur-2xl' />
                    <p className='mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500'>
                        Admin Navigation
                    </p>
                    <nav className='flex gap-2 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0'>
                        {ADMIN_NAV_LINKS.map((item, index) => {
                            const active = isAdminNavActive(pathname, item.href);
                            return (
                                <motion.div
                                    key={item.href}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{
                                        duration: 0.2,
                                        delay: index * 0.03,
                                        ease: 'easeOut',
                                    }}
                                >
                                    <Link
                                        href={item.href}
                                        className={`group relative flex items-center gap-2 whitespace-nowrap rounded-2xl px-2.5 py-2 text-sm font-semibold transition ${
                                            active
                                                ? 'text-slate-900'
                                                : 'text-slate-600 hover:text-slate-900'
                                        }`}
                                    >
                                        {active ? (
                                            <motion.span
                                                layoutId='admin-nav-active'
                                                className='absolute inset-0 rounded-2xl border border-white bg-white/90 shadow-[0_16px_26px_-20px_rgba(15,23,42,0.75)]'
                                                transition={{
                                                    type: 'spring',
                                                    stiffness: 360,
                                                    damping: 30,
                                                }}
                                            />
                                        ) : null}
                                        <span
                                            className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-[10px] font-semibold uppercase tracking-[0.1em] ${
                                                active
                                                    ? 'border-sky-200 bg-sky-100 text-sky-700'
                                                    : 'border-slate-200 bg-white/70 text-slate-500 transition group-hover:border-sky-200 group-hover:text-sky-600'
                                            }`}
                                        >
                                            {item.label.slice(0, 2)}
                                        </span>
                                        <span className='relative z-10 pr-1'>
                                            {item.label}
                                        </span>
                                        {active ? (
                                            <span className='relative z-10 ml-auto h-1.5 w-1.5 rounded-full bg-sky-500' />
                                        ) : null}
                                    </Link>
                                </motion.div>
                            );
                        })}
                    </nav>
                </div>
            </aside>
            <div className='min-w-0'>{children}</div>
        </div>
    );
}
