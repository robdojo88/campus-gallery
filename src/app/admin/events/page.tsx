'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { createEvent, fetchEvents } from '@/lib/supabase';

type AdminEvent = {
    id: string;
    name: string;
    description: string;
    count: number;
};

export default function AdminEventsPage() {
    const [events, setEvents] = useState<AdminEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [submitting, setSubmitting] = useState(false);

    async function loadEvents() {
        try {
            const data = await fetchEvents();
            setEvents(data);
            setStatus(data.length === 0 ? 'No events yet. Create one to enable camera tagging.' : '');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load events.';
            setStatus(message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadEvents();
    }, []);

    async function onCreateEvent(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (submitting) return;

        setSubmitting(true);
        setStatus('');
        try {
            await createEvent({ name, description });
            setName('');
            setDescription('');
            setStatus('Event created successfully. Camera dropdown options are now updated.');
            await loadEvents();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to create event.';
            setStatus(message);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <PageHeader
                    eyebrow='Admin'
                    title='Manage Events'
                    description='Create event folders for camera tagging. Members will see these options in camera upload forms.'
                />

                <section className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <h2 className='text-lg font-bold text-slate-900'>Create Event</h2>
                    <form onSubmit={onCreateEvent} className='mt-4 space-y-3'>
                        <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder='Event name'
                            required
                            disabled={submitting}
                            className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 disabled:opacity-60'
                        />
                        <textarea
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            placeholder='Short description (optional)'
                            disabled={submitting}
                            className='min-h-20 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600 disabled:opacity-60'
                        />
                        <button
                            type='submit'
                            disabled={submitting}
                            className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {submitting ? 'Creating...' : 'Create Event'}
                        </button>
                    </form>
                </section>

                {status ? <p className='mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700'>{status}</p> : null}

                <section className='mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                    {events.map((event) => (
                        <article key={event.id} className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                            <h3 className='text-base font-bold text-slate-900'>{event.name}</h3>
                            <p className='mt-2 text-sm text-slate-600'>{event.description || 'No description yet.'}</p>
                            <p className='mt-4 text-xs font-semibold uppercase tracking-wide text-cyan-700'>
                                {event.count} assigned captures
                            </p>
                        </article>
                    ))}
                    {!loading && events.length === 0 ? (
                        <article className='rounded-3xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600'>
                            No events available.
                        </article>
                    ) : null}
                </section>
            </AppShell>
        </AuthGuard>
    );
}

