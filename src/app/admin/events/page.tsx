'use client';

import { motion } from 'framer-motion';
import { FormEvent, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminPanelShell } from '@/components/admin/admin-panel-shell';
import { AppShell } from '@/components/layout/app-shell';
import {
    createEvent,
    fetchCurrentEventTag,
    fetchEvents,
    setCurrentEventTag,
} from '@/lib/supabase';

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
    const [selectedCurrentEventId, setSelectedCurrentEventId] = useState('');
    const [savingCurrentEvent, setSavingCurrentEvent] = useState(false);

    async function loadEvents(options: { preserveStatus?: boolean } = {}) {
        try {
            const [data, currentEvent] = await Promise.all([
                fetchEvents(),
                fetchCurrentEventTag(),
            ]);
            setEvents(data);
            setSelectedCurrentEventId((previous) => {
                if (currentEvent?.id) return currentEvent.id;
                if (previous && data.some((item) => item.id === previous)) {
                    return previous;
                }
                return '';
            });

            if (!options.preserveStatus) {
                setStatus(
                    data.length === 0
                        ? 'No tags yet. Create one to allow member uploads.'
                        : currentEvent
                          ? `Current event tag: ${currentEvent.name}`
                          : 'No current event tag selected. Set one below.',
                );
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load events.';
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
            setStatus(
                'Tag created successfully.',
            );
            await loadEvents({ preserveStatus: true });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to create event.';
            setStatus(message);
        } finally {
            setSubmitting(false);
        }
    }

    async function onSetCurrentEvent(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (savingCurrentEvent) return;
        if (!selectedCurrentEventId) {
            setStatus('Select one event tag first.');
            return;
        }

        setSavingCurrentEvent(true);
        setStatus('');
        try {
            await setCurrentEventTag(selectedCurrentEventId);
            const eventName =
                events.find((item) => item.id === selectedCurrentEventId)
                    ?.name ?? 'Selected tag';
            setStatus(`Current event tag set to ${eventName}.`);
            await loadEvents({ preserveStatus: true });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to update current event tag.';
            setStatus(message);
        } finally {
            setSavingCurrentEvent(false);
        }
    }

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <AdminPanelShell>
                    {/* <PageHeader
                        eyebrow='Admin workspace'
                        title='Manage Events'
                        description='Create event folders for camera tagging. Members can only post using tags listed here.'
                    /> */}

                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className='rounded-[30px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'
                    >
                        <h2 className='text-lg font-semibold tracking-tight text-slate-900'>
                            Create Event
                        </h2>
                        <form
                            onSubmit={onCreateEvent}
                            className='mt-4 space-y-3'
                        >
                            <input
                                value={name}
                                onChange={(event) =>
                                    setName(event.target.value)
                                }
                                placeholder='Event name'
                                required
                                disabled={submitting}
                                className='w-full rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition focus:border-sky-300 disabled:opacity-60'
                            />
                            <textarea
                                value={description}
                                onChange={(event) =>
                                    setDescription(event.target.value)
                                }
                                placeholder='Short description (optional)'
                                disabled={submitting}
                                className='min-h-20 w-full rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition focus:border-sky-300 disabled:opacity-60'
                            />
                            <button
                                type='submit'
                                disabled={submitting}
                                className='rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_26px_-20px_rgba(15,23,42,0.9)] transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {submitting ? 'Creating...' : 'Create Event'}
                            </button>
                        </form>
                    </motion.section>

                    <motion.section
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className='mt-4 rounded-[30px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'
                    >
                        <h2 className='text-lg font-semibold tracking-tight text-slate-900'>
                            Current Event Tag
                        </h2>
                        <p className='mt-2 text-sm text-slate-600'>
                            All feed uploads are automatically tagged with the event selected here.
                        </p>
                        <form
                            onSubmit={onSetCurrentEvent}
                            className='mt-4 flex flex-col gap-3 sm:flex-row sm:items-center'
                        >
                            <select
                                value={selectedCurrentEventId}
                                onChange={(event) =>
                                    setSelectedCurrentEventId(
                                        event.target.value,
                                    )
                                }
                                disabled={savingCurrentEvent || events.length === 0}
                                className='w-full rounded-2xl border border-white/80 bg-white/90 px-3 py-2 text-sm text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] transition focus:border-sky-300 disabled:opacity-60'
                            >
                                {events.length === 0 ? (
                                    <option value=''>
                                        No tags available
                                    </option>
                                ) : null}
                                {events.length > 0 && !selectedCurrentEventId ? (
                                    <option value=''>Select event tag</option>
                                ) : null}
                                {events.map((event) => (
                                    <option key={event.id} value={event.id}>
                                        {event.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type='submit'
                                disabled={
                                    savingCurrentEvent ||
                                    events.length === 0 ||
                                    !selectedCurrentEventId
                                }
                                className='rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_20px_26px_-20px_rgba(15,23,42,0.9)] transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {savingCurrentEvent
                                    ? 'Saving...'
                                    : 'Set Current Tag'}
                            </button>
                        </form>
                    </motion.section>

                    {status ? (
                        <p className='mt-4 rounded-[22px] border border-slate-200/90 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl'>
                            {status}
                        </p>
                    ) : null}

                    <section className='mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                        {events.map((event, index) => (
                            <motion.article
                                key={event.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{
                                    duration: 0.18,
                                    delay: index * 0.02,
                                    ease: 'easeOut',
                                }}
                                className='rounded-[28px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_28px_70px_-46px_rgba(15,23,42,0.62)] backdrop-blur-xl'
                            >
                                <h3 className='text-base font-semibold tracking-tight text-slate-900'>
                                    {event.name}
                                </h3>
                                <p className='mt-2 text-sm text-slate-600'>
                                    {event.description || 'No description yet.'}
                                </p>
                                <p className='mt-4 text-xs font-semibold uppercase tracking-wide text-sky-700'>
                                    {event.count} assigned captures
                                </p>
                            </motion.article>
                        ))}
                        {!loading && events.length === 0 ? (
                            <article className='rounded-[28px] border border-dashed border-slate-300 bg-white/70 p-5 text-sm text-slate-600 backdrop-blur-xl'>
                                No events available.
                            </article>
                        ) : null}
                    </section>
                </AdminPanelShell>
            </AppShell>
        </AuthGuard>
    );
}
