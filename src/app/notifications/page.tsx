'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
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
import type { AppNotification, NotificationType } from '@/lib/types';

const PAGE_SIZE = 10;
const ACTOR_AVATAR_FALLBACK = '/avatar-default.svg';

type NotificationGroup = {
    key: string;
    notificationIds: string[];
    type: NotificationType;
    createdAt: string;
    href?: string;
    title: string;
    body: string;
    caption: string;
    actorNames: string[];
    actorCount: number;
    actorAvatarUrl?: string;
    isAnonymous: boolean;
    unread: boolean;
};

function getDataString(
    data: Record<string, unknown>,
    key: string,
): string | undefined {
    const value = data[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function getNotificationHref(item: AppNotification): string | undefined {
    if (item.type === 'feed_like') {
        const postId = getDataString(item.data, 'postId');
        if (postId) return `/feed?post=${encodeURIComponent(postId)}`;
    }

    if (item.type === 'feed_comment') {
        const postId = getDataString(item.data, 'postId');
        const commentId = getDataString(item.data, 'commentId');
        if (postId && commentId) {
            return `/feed?post=${encodeURIComponent(postId)}&comment=${encodeURIComponent(commentId)}`;
        }
        if (postId) {
            return `/feed?post=${encodeURIComponent(postId)}`;
        }
    }

    if (item.type === 'freedom_like') {
        const postId = getDataString(item.data, 'freedomPostId');
        if (postId) return `/freedom-wall?post=${encodeURIComponent(postId)}`;
    }

    if (item.type === 'freedom_comment') {
        const postId = getDataString(item.data, 'freedomPostId');
        const commentId = getDataString(item.data, 'commentId');
        if (postId && commentId) {
            return `/freedom-wall?post=${encodeURIComponent(postId)}&comment=${encodeURIComponent(commentId)}`;
        }
        if (postId) {
            return `/freedom-wall?post=${encodeURIComponent(postId)}`;
        }
    }

    if (item.type === 'incognito_like') {
        const postId = getDataString(item.data, 'incognitoPostId');
        if (postId) return `/incognito?post=${encodeURIComponent(postId)}`;
    }

    if (item.type === 'incognito_comment') {
        const postId = getDataString(item.data, 'incognitoPostId');
        const commentId = getDataString(item.data, 'commentId');
        if (postId && commentId) {
            return `/incognito?post=${encodeURIComponent(postId)}&comment=${encodeURIComponent(commentId)}`;
        }
        if (postId) {
            return `/incognito?post=${encodeURIComponent(postId)}`;
        }
    }

    if (item.type === 'event_created') {
        const eventId = getDataString(item.data, 'eventId');
        if (eventId) {
            return `/gallery/events?event=${encodeURIComponent(eventId)}`;
        }
    }

    if (item.type === 'report_created') {
        const reportId = getDataString(item.data, 'reportId');
        if (reportId) {
            return `/admin/reports?report=${encodeURIComponent(reportId)}`;
        }
        return '/admin/reports';
    }

    return undefined;
}

function getNotificationGroupKey(item: AppNotification): string {
    if (item.type === 'feed_like' || item.type === 'feed_comment') {
        const postId = getDataString(item.data, 'postId');
        if (postId) return `${item.type}:${postId}`;
    }

    if (item.type === 'freedom_like' || item.type === 'freedom_comment') {
        const postId = getDataString(item.data, 'freedomPostId');
        if (postId) return `${item.type}:${postId}`;
    }

    if (item.type === 'incognito_like' || item.type === 'incognito_comment') {
        const postId = getDataString(item.data, 'incognitoPostId');
        if (postId) return `${item.type}:${postId}`;
    }

    return item.id;
}

function isEngagementType(type: NotificationType): boolean {
    return (
        type === 'feed_like' ||
        type === 'feed_comment' ||
        type === 'freedom_like' ||
        type === 'freedom_comment' ||
        type === 'incognito_like' ||
        type === 'incognito_comment'
    );
}

function formatCompactRelativeTime(createdAt: string): string {
    const timestamp = new Date(createdAt).getTime();
    if (Number.isNaN(timestamp)) return '';

    const diffMs = Math.max(0, Date.now() - timestamp);
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;
    const yearMs = 365 * dayMs;

    if (diffMs < hourMs) {
        return `${Math.max(1, Math.floor(diffMs / minuteMs))}m`;
    }
    if (diffMs < dayMs) {
        return `${Math.max(1, Math.floor(diffMs / hourMs))}h`;
    }
    if (diffMs < weekMs) {
        return `${Math.max(1, Math.floor(diffMs / dayMs))}d`;
    }
    if (diffMs < monthMs) {
        return `${Math.max(1, Math.floor(diffMs / weekMs))}w`;
    }
    if (diffMs < yearMs) {
        return `${Math.max(1, Math.floor(diffMs / monthMs))}m`;
    }
    return `${Math.max(1, Math.floor(diffMs / yearMs))}y`;
}

function formatActorLabel(group: NotificationGroup): string {
    const names = group.actorNames.slice(0, 2);
    const others = Math.max(0, group.actorCount - names.length);

    if (names.length === 0) {
        return group.actorCount > 1 ? `${group.actorCount} people` : 'Someone';
    }

    if (names.length === 1) {
        if (others === 0) return names[0];
        return `${names[0]} and ${others} other ${others === 1 ? 'person' : 'people'}`;
    }

    if (others === 0) {
        return `${names[0]} and ${names[1]}`;
    }

    return `${names[0]}, ${names[1]} and ${others} other ${others === 1 ? 'person' : 'people'}`;
}

function buildNotificationMessage(group: NotificationGroup): string {
    const quotedCaption = `"${group.caption || 'none'}"`;
    const actorLabel = formatActorLabel(group);

    if (
        group.type === 'feed_like' ||
        group.type === 'freedom_like' ||
        group.type === 'incognito_like'
    ) {
        return `${actorLabel} recently reacted to your post: ${quotedCaption}`;
    }

    if (
        group.type === 'feed_comment' ||
        group.type === 'freedom_comment' ||
        group.type === 'incognito_comment'
    ) {
        return `${actorLabel} recently commented on your post: ${quotedCaption}`;
    }

    return group.body || group.title;
}

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
    const router = useRouter();
    const [items, setItems] = useState<AppNotification[]>([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [busyKey, setBusyKey] = useState('');
    const [markingAll, setMarkingAll] = useState(false);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);
    const anchorRef = useRef<HTMLDivElement | null>(null);
    const itemsCountRef = useRef(0);

    const unreadIdSet = useMemo(
        () =>
            new Set(
                items.filter((item) => !item.readAt).map((item) => item.id),
            ),
        [items],
    );

    const unreadCount = unreadIdSet.size;

    const groupedItems = useMemo(() => {
        const grouped = new Map<
            string,
            {
                key: string;
                notificationIds: string[];
                type: NotificationType;
                createdAt: string;
                createdAtMs: number;
                href?: string;
                title: string;
                body: string;
                caption: string;
                actorNameById: Map<string, string>;
                actorIdSet: Set<string>;
                actorAvatarUrl?: string;
                isAnonymous: boolean;
                unread: boolean;
            }
        >();

        for (const item of items) {
            const key = getNotificationGroupKey(item);
            const createdAtMs = Number.isNaN(new Date(item.createdAt).getTime())
                ? 0
                : new Date(item.createdAt).getTime();
            const caption = getDataString(item.data, 'targetCaption') || 'none';

            if (!grouped.has(key)) {
                const actorNameById = new Map<string, string>();
                const actorIdSet = new Set<string>();
                const actorName = item.actorName?.trim();

                if (item.actorUserId) {
                    actorIdSet.add(item.actorUserId);
                }
                if (actorName) {
                    const actorKey =
                        item.actorUserId ?? `name:${actorName.toLowerCase()}`;
                    actorNameById.set(actorKey, actorName);
                }

                grouped.set(key, {
                    key,
                    notificationIds: [item.id],
                    type: item.type,
                    createdAt: item.createdAt,
                    createdAtMs,
                    href: getNotificationHref(item),
                    title: item.title,
                    body: item.body,
                    caption,
                    actorNameById,
                    actorIdSet,
                    actorAvatarUrl: item.actorAvatarUrl,
                    isAnonymous:
                        item.type === 'incognito_like' ||
                        item.type === 'incognito_comment',
                    unread: !item.readAt,
                });
                continue;
            }

            const group = grouped.get(key);
            if (!group) continue;

            group.notificationIds.push(item.id);
            if (!item.readAt) group.unread = true;
            if (!group.href) {
                group.href = getNotificationHref(item);
            }
            if (group.caption === 'none' && caption !== 'none') {
                group.caption = caption;
            }
            if (!group.actorAvatarUrl && item.actorAvatarUrl) {
                group.actorAvatarUrl = item.actorAvatarUrl;
            }

            if (item.actorUserId) {
                group.actorIdSet.add(item.actorUserId);
            }

            const actorName = item.actorName?.trim();
            if (actorName) {
                const actorKey =
                    item.actorUserId ?? `name:${actorName.toLowerCase()}`;
                group.actorNameById.set(actorKey, actorName);
            }

            if (createdAtMs > group.createdAtMs) {
                group.createdAt = item.createdAt;
                group.createdAtMs = createdAtMs;
                group.title = item.title;
                group.body = item.body;
                group.href = getNotificationHref(item) ?? group.href;
            }
        }

        return [...grouped.values()]
            .sort((a, b) => b.createdAtMs - a.createdAtMs)
            .map((group) => ({
                key: group.key,
                notificationIds: group.notificationIds,
                type: group.type,
                createdAt: group.createdAt,
                href: group.href,
                title: group.title,
                body: group.body,
                caption: group.caption || 'none',
                actorNames: [...group.actorNameById.values()],
                actorCount:
                    group.actorIdSet.size > 0
                        ? group.actorIdSet.size
                        : group.actorNameById.size > 0
                          ? group.actorNameById.size
                        : group.notificationIds.length,
                actorAvatarUrl: group.actorAvatarUrl,
                isAnonymous: group.isAnonymous,
                unread: group.unread,
            }));
    }, [items]);

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
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load notifications.';
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
                const next = page.items.filter(
                    (item) => !existingIds.has(item.id),
                );
                return [...prev, ...next];
            });
            setCursor(page.nextCursor);
            setHasMore(page.hasMore);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load previous notifications.';
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

    async function onMarkGroupRead(group: NotificationGroup) {
        if (busyKey) return;

        const unreadIds = group.notificationIds.filter((id) =>
            unreadIdSet.has(id),
        );
        if (unreadIds.length === 0) return;

        setBusyKey(group.key);
        try {
            await Promise.all(unreadIds.map((id) => markNotificationRead(id)));
            const now = new Date().toISOString();
            const unreadSet = new Set(unreadIds);
            setItems((prev) =>
                prev.map((item) =>
                    unreadSet.has(item.id)
                        ? {
                              ...item,
                              readAt: item.readAt ?? now,
                          }
                        : item,
                ),
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to mark notification as read.';
            setStatus(message);
        } finally {
            setBusyKey('');
        }
    }

    async function onMarkAllRead() {
        if (markingAll) return;
        setMarkingAll(true);
        try {
            await markAllNotificationsRead();
            const now = new Date().toISOString();
            setItems((prev) =>
                prev.map((item) => ({ ...item, readAt: item.readAt ?? now })),
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to mark all notifications as read.';
            setStatus(message);
        } finally {
            setMarkingAll(false);
        }
    }

    function onOpenGroup(group: NotificationGroup, href: string) {
        const unreadIds = group.notificationIds.filter((id) =>
            unreadIdSet.has(id),
        );

        if (unreadIds.length > 0) {
            const now = new Date().toISOString();
            const unreadSet = new Set(unreadIds);
            setItems((prev) =>
                prev.map((item) =>
                    unreadSet.has(item.id)
                        ? { ...item, readAt: item.readAt ?? now }
                        : item,
                ),
            );

            void Promise.all(
                unreadIds.map((id) => markNotificationRead(id)),
            ).catch((error) => {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to mark notification as read.';
                setStatus(message);
            });
        }

        router.push(href);
    }

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                {/* <PageHeader
                    eyebrow='Account'
                    title='Notifications'
                    description='Realtime alerts for likes, comments, new events, and key activity across Ripple.'
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
                /> */}
                <button
                    type='button'
                    onClick={() => void onMarkAllRead()}
                    disabled={markingAll || unreadCount === 0}
                    className='rounded-xl bg-slate-900 px-3 py-2 mb-2 w-full text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                >
                    {markingAll ? 'Marking...' : 'Mark All Read'}
                </button>
                {loading ? <NotificationSkeleton count={4} /> : null}
                {!loading && status ? (
                    <p className='rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>
                        {status}
                    </p>
                ) : null}

                {!loading && groupedItems.length > 0 ? (
                    <section className='space-y-3'>
                        {groupedItems.map((group) => {
                            const unread = group.unread;
                            const clickable = Boolean(group.href);
                            const message = buildNotificationMessage(group);
                            const relativeLabel =
                                formatCompactRelativeTime(group.createdAt) ||
                                new Date(group.createdAt).toLocaleString();
                            const showActorVisual = isEngagementType(
                                group.type,
                            );

                            return (
                                <article
                                    key={group.key}
                                    onClick={
                                        group.href
                                            ? () => {
                                                  onOpenGroup(
                                                      group,
                                                      group.href as string,
                                                  );
                                              }
                                            : undefined
                                    }
                                    onKeyDown={
                                        group.href
                                            ? (event) => {
                                                  if (
                                                      event.key === 'Enter' ||
                                                      event.key === ' '
                                                  ) {
                                                      event.preventDefault();
                                                      onOpenGroup(
                                                          group,
                                                          group.href as string,
                                                      );
                                                  }
                                              }
                                            : undefined
                                    }
                                    role={clickable ? 'button' : undefined}
                                    tabIndex={clickable ? 0 : undefined}
                                    className={`rounded-2xl border p-4 shadow-sm transition ${
                                        unread
                                            ? 'border-cyan-200 bg-cyan-50/70'
                                            : 'border-slate-200 bg-white'
                                    } ${clickable ? 'cursor-pointer hover:border-cyan-300 hover:shadow-md' : ''} ${
                                        clickable
                                            ? 'focus:outline-none focus:ring-2 focus:ring-cyan-400/70'
                                            : ''
                                    }`}
                                >
                                    <div className='flex items-start gap-3'>
                                        {showActorVisual ? (
                                            group.isAnonymous ? (
                                                <span className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black text-white'>
                                                    <svg
                                                        viewBox='0 0 24 24'
                                                        aria-hidden='true'
                                                        className='h-5 w-5'
                                                        fill='none'
                                                        stroke='currentColor'
                                                        strokeWidth='2'
                                                        strokeLinecap='round'
                                                        strokeLinejoin='round'
                                                    >
                                                        <circle
                                                            cx='12'
                                                            cy='8'
                                                            r='4'
                                                        />
                                                        <path d='M5 20a7 7 0 0 1 14 0' />
                                                    </svg>
                                                </span>
                                            ) : (
                                                <span className='relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100'>
                                                    <Image
                                                        src={
                                                            group.actorAvatarUrl ||
                                                            ACTOR_AVATAR_FALLBACK
                                                        }
                                                        alt='Actor avatar'
                                                        fill
                                                        className='object-cover'
                                                        sizes='40px'
                                                    />
                                                </span>
                                            )
                                        ) : (
                                            <span className='grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500'>
                                                <svg
                                                    viewBox='0 0 24 24'
                                                    aria-hidden='true'
                                                    className='h-5 w-5'
                                                    fill='none'
                                                    stroke='currentColor'
                                                    strokeWidth='2'
                                                    strokeLinecap='round'
                                                    strokeLinejoin='round'
                                                >
                                                    <path d='M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5' />
                                                    <path d='M9 17a3 3 0 0 0 6 0' />
                                                </svg>
                                            </span>
                                        )}

                                        <div className='min-w-0 flex-1'>
                                            <p className='text-sm font-semibold text-slate-900'>
                                                {message}
                                            </p>
                                            <p className='mt-1 text-xs text-slate-500'>
                                                {relativeLabel}
                                            </p>
                                        </div>

                                        <div className='flex items-center gap-2'>
                                            {unread ? (
                                                <span className=' text-[10px] font-bold text-white'>
                                                    <div className='h-3 w-3 rounded-full bg-[#5AA7FF]'></div>
                                                </span>
                                            ) : null}
                                            {/* {unread ? (
                                                <button
                                                    type='button'
                                                    onClick={(event) => {
                                                        event.stopPropagation();
                                                        void onMarkGroupRead(
                                                            group,
                                                        );
                                                    }}
                                                    disabled={
                                                        busyKey === group.key
                                                    }
                                                    className='rounded-lg bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                                                >
                                                    {busyKey === group.key
                                                        ? 'Saving...'
                                                        : 'Mark Read'}
                                                </button>
                                            ) : null} */}
                                        </div>
                                    </div>
                                </article>
                            );
                        })}
                    </section>
                ) : null}

                {!loading && hasMore ? (
                    <div className='mt-4 space-y-3'>
                        <div
                            ref={anchorRef}
                            className='h-2 w-full'
                            aria-hidden='true'
                        />
                        <button
                            type='button'
                            onClick={() => void loadMore()}
                            disabled={loadingMore}
                            className='w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {loadingMore
                                ? 'Loading previous notifications...'
                                : 'See previous notifications'}
                        </button>
                        {loadingMore ? (
                            <NotificationSkeleton count={2} />
                        ) : null}
                    </div>
                ) : null}
            </AppShell>
        </AuthGuard>
    );
}

