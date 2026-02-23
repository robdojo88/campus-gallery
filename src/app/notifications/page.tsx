'use client';

import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import {
    fetchNotifications,
    markAllNotificationsRead,
    markNotificationRead,
    subscribeToNotifications,
} from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';

export default function NotificationsPage() {
    const [items, setItems] = useState<AppNotification[]>([]);
    const [status, setStatus] = useState('Loading notifications...');
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState('');
    const [markingAll, setMarkingAll] = useState(false);

    const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

    async function load(options: { silent?: boolean } = {}) {
        if (!options.silent) {
            setLoading(true);
        }
        try {
            const data = await fetchNotifications(120);
            setItems(data);
            setStatus(data.length === 0 ? 'No notifications yet.' : '');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load notifications.';
            setStatus(message);
        } finally {
            if (!options.silent) {
                setLoading(false);
            }
        }
    }

    useEffect(() => {
        void load();
        const unsubscribe = subscribeToNotifications(() => {
            void load({ silent: true });
        });
        const pollingTimer = window.setInterval(() => {
            void load({ silent: true });
        }, 5000);
        return () => {
            unsubscribe();
            window.clearInterval(pollingTimer);
        };
    }, []);

    async function onMarkRead(notificationId: string) {
        if (busyId) return;
        setBusyId(notificationId);
        try {
            await markNotificationRead(notificationId);
            setItems((prev) =>
                prev.map((item) =>
                    item.id === notificationId ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
                ),
            );
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to mark notification as read.';
            setStatus(message);
        } finally {
            setBusyId('');
        }
    }

    async function onMarkAllRead() {
        if (markingAll) return;
        setMarkingAll(true);
        try {
            await markAllNotificationsRead();
            const now = new Date().toISOString();
            setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to mark all notifications as read.';
            setStatus(message);
        } finally {
            setMarkingAll(false);
        }
    }

    return (
        <AuthGuard>
            <AppShell>
                <PageHeader
                    eyebrow='Account'
                    title='Notifications'
                    description='Realtime alerts for likes, comments, new events, and key activity across Campus Gallery.'
                    action={
                        <button
                            type='button'
                            onClick={() => void onMarkAllRead()}
                            disabled={markingAll || unreadCount === 0}
                            className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {markingAll ? 'Marking...' : 'Mark All Read'}
                        </button>
                    }
                />

                {loading ? (
                    <p className='rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>Loading notifications...</p>
                ) : null}
                {!loading && status ? (
                    <p className='rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>{status}</p>
                ) : null}

                {!loading && items.length > 0 ? (
                    <section className='space-y-3'>
                        {items.map((item) => {
                            const unread = !item.readAt;
                            return (
                                <article
                                    key={item.id}
                                    className={`rounded-2xl border p-4 shadow-sm ${
                                        unread ? 'border-cyan-200 bg-cyan-50/70' : 'border-slate-200 bg-white'
                                    }`}
                                >
                                    <div className='flex flex-wrap items-start justify-between gap-2'>
                                        <div>
                                            <p className='text-sm font-semibold text-slate-900'>{item.title}</p>
                                            <p className='mt-1 text-sm text-slate-700'>{item.body}</p>
                                            <p className='mt-2 text-xs text-slate-500'>
                                                {new Date(item.createdAt).toLocaleString()}
                                            </p>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            {unread ? <span className='rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white'>NEW</span> : null}
                                            {unread ? (
                                                <button
                                                    type='button'
                                                    onClick={() => void onMarkRead(item.id)}
                                                    disabled={busyId === item.id}
                                                    className='rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                                                >
                                                    {busyId === item.id ? 'Saving...' : 'Mark Read'}
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                ) : null}
            </AppShell>
        </AuthGuard>
    );
}
