'use client';

import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import {
    fetchNotificationsPage,
    markAllNotificationsRead,
    markNotificationRead,
    subscribeToNotifications,
} from '@/lib/supabase';
import type { AppNotification } from '@/lib/types';

const PAGE_SIZE = 10;

function NotificationSkeleton({ count = 3 }: { count?: number }) {
    return (
        <section className='space-y-3'>
            {Array.from({ length: count }).map((_, index) => (
                <motion.article
                    key={`notif-skeleton-${index}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.04 }}
                    className='overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
                >
                    <div className='space-y-2'>
                        <div className='h-4 w-40 animate-pulse rounded bg-slate-200' />
                        <div className='h-3 w-full animate-pulse rounded bg-slate-100' />
                        <div className='h-3 w-2/3 animate-pulse rounded bg-slate-100' />
                        <div className='h-3 w-28 animate-pulse rounded bg-slate-100' />
                    </div>
                </motion.article>
            ))}
        </section>
    );
}

export default function NotificationsPage() {
    const [items, setItems] = useState<AppNotification[]>([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [busyId, setBusyId] = useState('');
    const [markingAll, setMarkingAll] = useState(false);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);
    const anchorRef = useRef<HTMLDivElement | null>(null);
    const itemsCountRef = useRef(0);

    const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

    useEffect(() => {
        itemsCountRef.current = items.length;
    }, [items]);

    const loadInitial = useCallback(async () => {
        setStatus('');
        setCursor(undefined);
        setHasMore(false);
        setLoading(true);
        try {
            const page = await fetchNotificationsPage({ limit: PAGE_SIZE });
            setItems(page.items);
            setCursor(page.nextCursor);
            setHasMore(page.hasMore);
            if (page.items.length === 0) {
                setStatus('No notifications yet.');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load notifications.';
            setStatus(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshLoaded = useCallback(async () => {
        const loadedCount = Math.max(PAGE_SIZE, itemsCountRef.current);
        try {
            const page = await fetchNotificationsPage({ limit: loadedCount });
            setItems(page.items);
            setCursor(page.nextCursor);
            setHasMore(page.hasMore);
            if (page.items.length > 0) {
                setStatus('');
            } else {
                setStatus('No notifications yet.');
            }
        } catch {
            // Keep current content visible if background refresh fails.
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!hasMore || !cursor || loading || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await fetchNotificationsPage({
                limit: PAGE_SIZE,
                beforeCreatedAt: cursor,
            });
            setItems((prev) => {
                const existingIds = new Set(prev.map((item) => item.id));
                const next = page.items.filter((item) => !existingIds.has(item.id));
                return [...prev, ...next];
            });
            setCursor(page.nextCursor);
            setHasMore(page.hasMore);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load previous notifications.';
            setStatus(message);
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, hasMore, loading, loadingMore]);

    useEffect(() => {
        void loadInitial();
        const unsubscribe = subscribeToNotifications(() => {
            void refreshLoaded();
        });
        const pollingTimer = window.setInterval(() => {
            void refreshLoaded();
        }, 5000);
        return () => {
            unsubscribe();
            window.clearInterval(pollingTimer);
        };
    }, [loadInitial, refreshLoaded]);

    useEffect(() => {
        if (!anchorRef.current || !hasMore || loading) return;
        const node = anchorRef.current;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void loadMore();
                }
            },
            { rootMargin: '200px 0px 200px 0px' },
        );
        observer.observe(node);
        return () => {
            observer.disconnect();
        };
    }, [hasMore, loadMore, loading]);

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

                {loading ? <NotificationSkeleton count={4} /> : null}
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
                                            {unread ? (
                                                <span className='rounded-full bg-cyan-600 px-2 py-0.5 text-[10px] font-bold text-white'>
                                                    NEW
                                                </span>
                                            ) : null}
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

                {!loading && hasMore ? (
                    <div className='mt-4 space-y-3'>
                        <div ref={anchorRef} className='h-2 w-full' aria-hidden='true' />
                        <button
                            type='button'
                            onClick={() => void loadMore()}
                            disabled={loadingMore}
                            className='w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {loadingMore ? 'Loading previous notifications...' : 'See previous notifications'}
                        </button>
                        {loadingMore ? <NotificationSkeleton count={2} /> : null}
                    </div>
                ) : null}
            </AppShell>
        </AuthGuard>
    );
}
