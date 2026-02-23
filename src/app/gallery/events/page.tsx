'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchEvents } from '@/lib/supabase';

export default function EventGalleryPage() {
    const [events, setEvents] = useState<Array<{ id: string; name: string; description: string; count: number }>>([]);
    const [status, setStatus] = useState('Loading events...');

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchEvents();
                setEvents(data);
                setStatus(data.length === 0 ? 'No event folders yet.' : '');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load event folders.';
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
                    title='Event-Based Gallery'
                    description='Admin-managed event folders where members can assign captures during upload.'
                />
                {status ? <p className='mb-4 text-sm text-slate-600'>{status}</p> : null}
                <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                    {events.map((event) => (
                        <article key={event.id} className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                            <h2 className='text-lg font-bold'>{event.name}</h2>
                            <p className='mt-2 text-sm text-slate-600'>{event.description}</p>
                            <p className='mt-4 text-sm font-semibold text-cyan-700'>{event.count} assigned captures</p>
                        </article>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
