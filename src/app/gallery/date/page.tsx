'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchDateFolderCounts } from '@/lib/supabase';

export default function DateGalleryPage() {
    const [grouped, setGrouped] = useState<
        Array<{ date: string; count: number; label: string; dominantEventName?: string; dominantEventCount?: number }>
    >([]);
    const [status, setStatus] = useState('Loading folders...');

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchDateFolderCounts();
                setGrouped(data);
                setStatus(data.length === 0 ? 'No date folders yet.' : '');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load date folders.';
                setStatus(message);
            }
        }
        void load();
    }, []);

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Folders'
                    title='Date-Based Gallery'
                    description='Auto-structured folders by year, month, and day for all captured media.'
                />
                {status ? <p className='mb-4 text-sm text-slate-600'>{status}</p> : null}
                <section className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <ul className='space-y-3'>
                        {grouped.map((item) => (
                            <li key={item.date}>
                                <Link
                                    href={`/gallery/date/${encodeURIComponent(item.date)}`}
                                    className='flex items-center justify-between rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-100'
                                >
                                    <div>
                                        <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>Date</p>
                                        <p className='mt-1 font-medium text-slate-800'>{item.label}</p>
                                        {item.dominantEventName ? (
                                            <p className='mt-2 inline-flex items-center rounded-full bg-cyan-100 px-2.5 py-1 text-[11px] font-semibold text-cyan-800'>
                                                Dominant Tag: {item.dominantEventName}
                                                {item.dominantEventCount ? ` (${item.dominantEventCount})` : ''}
                                            </p>
                                        ) : (
                                            <p className='mt-2 inline-flex items-center rounded-full bg-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-700'>
                                                Dominant Tag: None
                                            </p>
                                        )}
                                    </div>
                                    <span className='rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'>
                                        {item.count} uploads
                                    </span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </section>
            </AppShell>
        </AuthGuard>
    );
}
