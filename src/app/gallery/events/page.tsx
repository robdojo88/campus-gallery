'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardBody, Chip } from '@heroui/react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchEvents } from '@/lib/supabase';

export default function EventGalleryPage() {
    const [targetEventId, setTargetEventId] = useState('');
    const [events, setEvents] = useState<Array<{ id: string; name: string; description: string; count: number }>>([]);
    const [status, setStatus] = useState('Loading events...');
    const focusedEventIdRef = useRef('');

    useEffect(() => {
        const readTargetEvent = () => {
            const params = new URLSearchParams(window.location.search);
            setTargetEventId((params.get('event') ?? '').trim());
        };

        readTargetEvent();
        window.addEventListener('popstate', readTargetEvent);
        return () => {
            window.removeEventListener('popstate', readTargetEvent);
        };
    }, []);

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

    useEffect(() => {
        if (!targetEventId || focusedEventIdRef.current === targetEventId) return;
        const targetNode = document.querySelector<HTMLElement>(`[data-event-id="${targetEventId}"]`);
        if (!targetNode) return;
        targetNode.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
        focusedEventIdRef.current = targetEventId;
    }, [events, targetEventId]);

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Folders'
                    title='Event-Based Gallery'
                    description='Admin-managed event folders where members can assign captures during upload.'
                />
                {status ? (
                    <Card className='mb-4 border border-slate-200 bg-white'>
                        <CardBody className='p-4 text-sm text-slate-600'>
                            {status}
                        </CardBody>
                    </Card>
                ) : null}
                <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                    {events.map((event) => (
                        <Card
                            key={event.id}
                            id={`event-${event.id}`}
                            data-event-id={event.id}
                            className='border border-slate-200 bg-white shadow-sm'
                        >
                            <CardBody className='p-5'>
                                <h2 className='text-lg font-bold'>
                                    {event.name}
                                </h2>
                                <p className='mt-2 text-sm text-slate-600'>
                                    {event.description}
                                </p>
                                <Chip
                                    size='sm'
                                    variant='flat'
                                    className='mt-4 w-fit bg-cyan-100 text-xs font-semibold text-cyan-700'
                                >
                                    {event.count} assigned captures
                                </Chip>
                            </CardBody>
                        </Card>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
