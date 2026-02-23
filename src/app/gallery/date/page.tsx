'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchDateFolderCounts } from '@/lib/supabase';

export default function DateGalleryPage() {
    const [grouped, setGrouped] = useState<Array<{ date: string; count: number }>>([]);
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
                            <li key={item.date} className='flex items-center justify-between rounded-2xl bg-slate-50 p-4'>
                                <span className='font-medium text-slate-800'>{item.date}</span>
                                <span className='rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white'>
                                    {item.count} uploads
                                </span>
                            </li>
                        ))}
                    </ul>
                </section>
            </AppShell>
        </AuthGuard>
    );
}
