'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { MainNav } from '@/components/layout/main-nav';
import { OfflineSync } from '@/components/system/offline-sync';
import {
    fetchFreedomPosts,
    fetchIncognitoPosts,
    fetchPostsPage,
} from '@/lib/supabase';

type SidebarLink = {
    href: string;
    label: string;
    hint: string;
};

const sidebarLinks: SidebarLink[] = [
    { href: '/feed', label: 'Feed', hint: 'Campus timeline' },
    { href: '/camera', label: 'Camera', hint: 'Capture live' },
    {
        href: '/gallery/date',
        label: 'Date Folders',
        hint: 'Chronological gallery',
    },
    { href: '/gallery/events', label: 'Events', hint: 'Tagged moments' },
    { href: '/freedom-wall', label: 'Freedom Wall', hint: 'Open discussions' },
    { href: '/incognito', label: 'Incognito', hint: 'Anonymous space' },
    { href: '/visitor-gallery', label: 'Visitor', hint: 'Guest captures' },
    { href: '/reviews', label: 'Visitor Feedback', hint: 'Guest feedback' },
    {
        href: '/notifications',
        label: 'Notifications',
        hint: 'Realtime activity',
    },
];

function isActive(pathname: string, href: string): boolean {
    if (href === '/camera') return pathname === '/camera';
    return pathname.startsWith(href);
}

function LeftSidebar({ pathname }: { pathname: string }) {
    return (
        <aside className='hidden lg:block'>
            <div className='fixed top-20 w-[16%] space-y-4'>
                <section className='rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'>
                    <p className='px-2 pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                        Navigation
                    </p>
                    <nav className='space-y-1.5'>
                        {sidebarLinks.map((link) => {
                            const active = isActive(pathname, link.href);
                            return (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className={`group flex items-center justify-between rounded-xl px-3 py-2.5 transition ${
                                        active
                                            ? 'bg-blue-50 ring-1 ring-blue-100'
                                            : 'hover:bg-slate-50'
                                    }`}
                                >
                                    <div className='flex min-w-0 items-center gap-2.5'>
                                        <span
                                            className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                                active
                                                    ? 'bg-blue-600'
                                                    : 'bg-slate-300 group-hover:bg-slate-500'
                                            }`}
                                            aria-hidden='true'
                                        />
                                        <div className='min-w-0'>
                                            <p
                                                className={`truncate text-sm font-medium ${
                                                    active
                                                        ? 'text-blue-700'
                                                        : 'text-slate-700'
                                                }`}
                                            >
                                                {link.label}
                                            </p>
                                            <p className='truncate text-[11px] text-slate-500'>
                                                {link.hint}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </nav>
                </section>

                <section className='rounded-2xl border border-slate-200 bg-white p-3 shadow-sm'>
                    <p className='px-2 pb-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                        Quick Actions
                    </p>
                    <div className='grid grid-cols-1 gap-2'>
                        <Link
                            href='/camera'
                            className='rounded-xl bg-blue-600 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-blue-500'
                        >
                            Capture Now
                        </Link>
                    </div>
                </section>
            </div>
        </aside>
    );
}

type TrendingItem = {
    key: string;
    source: 'Feed' | 'Freedom Wall' | 'Incognito';
    href: string;
    title: string;
    likes: number;
    comments: number;
    interactions: number;
    createdAt: string;
    previewImages: string[];
};

type TrendingHashtag = {
    tag: string;
    count: number;
};

const HASHTAG_PATTERN = /(^|\s)#([A-Za-z0-9_]{2,32})/g;

function safeTimeValue(timestamp: string): number {
    const value = new Date(timestamp).getTime();
    return Number.isNaN(value) ? 0 : value;
}

function normalizePreviewText(value: string, fallback: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return fallback;
    if (normalized.length <= 88) return normalized;
    return `${normalized.slice(0, 85)}...`;
}

function normalizePreviewImages(
    values: Array<string | null | undefined>,
): string[] {
    const unique: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
        if (typeof value !== 'string') continue;
        const trimmed = value.trim();
        if (!trimmed || seen.has(trimmed)) continue;
        seen.add(trimmed);
        unique.push(trimmed);
    }
    return unique;
}

function extractHashtags(input: string): string[] {
    const tags = new Set<string>();
    const matcher = new RegExp(HASHTAG_PATTERN);
    let match = matcher.exec(input);
    while (match) {
        const tag = (match[2] ?? '').toLowerCase();
        if (tag) tags.add(tag);
        match = matcher.exec(input);
    }
    return [...tags];
}

function buildTrendingHashtags(
    texts: string[],
    limit: number,
): TrendingHashtag[] {
    const counts = new Map<string, number>();
    for (const text of texts) {
        for (const tag of extractHashtags(text)) {
            counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .sort((a, b) =>
            b[1] !== a[1] ? b[1] - a[1] : a[0].localeCompare(b[0]),
        )
        .slice(0, limit)
        .map(([tag, count]) => ({ tag: `#${tag}`, count }));
}

function RightSidebar() {
    const [items, setItems] = useState<TrendingItem[]>([]);
    const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
    const [previewIndexByKey, setPreviewIndexByKey] = useState<
        Record<string, number>
    >({});
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('');

    useEffect(() => {
        let mounted = true;

        const loadTrending = async () => {
            try {
                if (mounted) {
                    setStatus('');
                }

                const [feedPage, freedomPosts, incognitoPosts] =
                    await Promise.all([
                        fetchPostsPage({ limit: 80 }),
                        fetchFreedomPosts(),
                        fetchIncognitoPosts(),
                    ]);

                const hashtagTexts: string[] = [];
                feedPage.items.forEach((post) => {
                    hashtagTexts.push(post.caption ?? '');
                });
                freedomPosts.forEach((post) => {
                    hashtagTexts.push(post.content);
                });
                incognitoPosts.forEach((post) => {
                    hashtagTexts.push(post.content);
                });
                const nextHashtags = buildTrendingHashtags(hashtagTexts, 8);

                const feedTrending = feedPage.items
                    .map((post) => ({
                        key: `feed-${post.id}`,
                        source: 'Feed' as const,
                        href: `/feed?post=${encodeURIComponent(post.id)}`,
                        title: normalizePreviewText(
                            post.caption || post.eventName || '',
                            'Campus post',
                        ),
                        likes: post.likes,
                        comments: post.comments,
                        interactions: post.likes + post.comments,
                        createdAt: post.createdAt,
                        previewImages: normalizePreviewImages([
                            ...(post.images ?? []),
                            post.imageUrl,
                        ]),
                    }))
                    .sort((a, b) => {
                        if (b.interactions !== a.interactions) {
                            return b.interactions - a.interactions;
                        }
                        return (
                            safeTimeValue(b.createdAt) -
                            safeTimeValue(a.createdAt)
                        );
                    })[0];

                const freedomTrending = freedomPosts
                    .map((post) => ({
                        key: `freedom-${post.id}`,
                        source: 'Freedom Wall' as const,
                        href: `/freedom-wall?post=${encodeURIComponent(
                            post.id,
                        )}`,
                        title: normalizePreviewText(
                            post.content,
                            'Freedom Wall post',
                        ),
                        likes: post.likes,
                        comments: post.comments,
                        interactions: post.likes + post.comments,
                        createdAt: post.createdAt,
                        previewImages: normalizePreviewImages([post.imageUrl]),
                    }))
                    .sort((a, b) => {
                        if (b.interactions !== a.interactions) {
                            return b.interactions - a.interactions;
                        }
                        return (
                            safeTimeValue(b.createdAt) -
                            safeTimeValue(a.createdAt)
                        );
                    })[0];

                const incognitoTrending = incognitoPosts
                    .map((post) => ({
                        key: `incognito-${post.id}`,
                        source: 'Incognito' as const,
                        href: `/incognito?post=${encodeURIComponent(post.id)}`,
                        title: normalizePreviewText(
                            post.content,
                            'Incognito post',
                        ),
                        likes: post.likes,
                        comments: post.comments,
                        interactions: post.likes + post.comments,
                        createdAt: post.createdAt,
                        previewImages: [],
                    }))
                    .sort((a, b) => {
                        if (b.interactions !== a.interactions) {
                            return b.interactions - a.interactions;
                        }
                        return (
                            safeTimeValue(b.createdAt) -
                            safeTimeValue(a.createdAt)
                        );
                    })[0];

                const nextItems: TrendingItem[] = [];
                if (feedTrending) nextItems.push(feedTrending);
                if (freedomTrending) nextItems.push(freedomTrending);
                if (incognitoTrending) nextItems.push(incognitoTrending);

                if (!mounted) return;

                setItems(nextItems);
                setHashtags(nextHashtags);
                setStatus(
                    nextItems.length === 0 ? 'No trending posts yet.' : '',
                );
            } catch (error) {
                if (!mounted) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load trending posts.';
                setStatus(message);
                setHashtags([]);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        void loadTrending();
        const refreshTimer = window.setInterval(() => {
            void loadTrending();
        }, 20000);

        return () => {
            mounted = false;
            window.clearInterval(refreshTimer);
        };
    }, []);

    useEffect(() => {
        setPreviewIndexByKey((previous) => {
            const next: Record<string, number> = {};
            items.forEach((item) => {
                if (item.previewImages.length === 0) return;
                next[item.key] =
                    (previous[item.key] ?? 0) % item.previewImages.length;
            });
            return next;
        });
    }, [items]);

    useEffect(() => {
        const rotatable = items.filter((item) => item.previewImages.length > 1);
        if (rotatable.length === 0) return;

        const timer = window.setInterval(() => {
            setPreviewIndexByKey((previous) => {
                const next = { ...previous };
                rotatable.forEach((item) => {
                    const current = previous[item.key] ?? 0;
                    next[item.key] = (current + 1) % item.previewImages.length;
                });
                return next;
            });
        }, 3000);

        return () => {
            window.clearInterval(timer);
        };
    }, [items]);

    return (
        <aside className='hidden xl:block'>
            <div className='fixed w-[22%] top-20 space-y-4'>
                <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                    <p className='text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                        Trending Posts
                    </p>
                    {loading ? (
                        <div className='mt-3 space-y-2'>
                            <div className='h-14 animate-pulse rounded-xl bg-slate-100' />
                            <div className='h-14 animate-pulse rounded-xl bg-slate-100' />
                            <div className='h-14 animate-pulse rounded-xl bg-slate-100' />
                        </div>
                    ) : null}
                    {!loading && status ? (
                        <p className='mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600'>
                            {status}
                        </p>
                    ) : null}
                    {!loading && items.length > 0 ? (
                        <div className='mt-3 space-y-2.5'>
                            {items.map((item) => {
                                const previewIndex =
                                    previewIndexByKey[item.key] ?? 0;
                                const previewImage =
                                    item.previewImages[previewIndex] ??
                                    item.previewImages[0];
                                return (
                                    <Link
                                        key={item.key}
                                        href={item.href}
                                        className='group block rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50/50'
                                    >
                                        <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500'>
                                            {item.source}
                                        </p>
                                        <p className='mt-1 line-clamp-2 text-sm font-medium text-slate-800'>
                                            {item.title}
                                        </p>
                                        {/* {previewImage ? (
                                            <div className='relative mt-2 h-48 overflow-hidden rounded-lg bg-slate-100'>
                                                <AnimatePresence
                                                    mode='wait'
                                                    initial={false}
                                                >
                                                    <motion.div
                                                        key={`${item.key}-${previewIndex}-${previewImage}`}
                                                        initial={{
                                                            opacity: 0,
                                                            scale: 1.02,
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            scale: 1,
                                                        }}
                                                        exit={{
                                                            opacity: 0,
                                                            scale: 0.98,
                                                        }}
                                                        transition={{
                                                            duration: 0.12,
                                                            ease: 'easeOut',
                                                        }}
                                                        className='absolute inset-0'
                                                    >
                                                        <Image
                                                            src={previewImage}
                                                            alt={`${item.source} trending preview`}
                                                            fill
                                                            className='object-cover transition-transform duration-500 group-hover:scale-[1.03]'
                                                            sizes='280px'
                                                        />
                                                    </motion.div>
                                                </AnimatePresence>
                                                {item.previewImages.length >
                                                1 ? (
                                                    <span className='absolute bottom-1.5 right-1.5 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white'>
                                                        {(previewIndex %
                                                            item.previewImages
                                                                .length) +
                                                            1}
                                                        /
                                                        {
                                                            item.previewImages
                                                                .length
                                                        }
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null} */}
                                        <p className='mt-2 text-[11px] text-slate-600'>
                                            {item.interactions} interactions |{' '}
                                            {item.comments} comments
                                        </p>
                                    </Link>
                                );
                            })}
                        </div>
                    ) : null}
                    {!loading && hashtags.length > 0 ? (
                        <div className='mt-4 border-t border-slate-200 pt-3'>
                            <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500'>
                                Trending Hashtags
                            </p>
                            <div className='mt-2 flex flex-wrap gap-1.5'>
                                {hashtags.map((item) => (
                                    <Link
                                        key={item.tag}
                                        href={`/trending/${encodeURIComponent(item.tag.slice(1))}`}
                                        className='rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-200'
                                    >
                                        {item.tag}{' '}
                                        <span className='text-slate-500'>
                                            {item.count}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : null}
                </section>
            </div>
        </aside>
    );
}

export function AppShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const isCameraRoute = pathname.startsWith('/camera');
    const showLeftSidebar = !isCameraRoute;
    const showRightSidebar =
        !isCameraRoute &&
        !pathname.startsWith('/admin') &&
        !pathname.startsWith('/profile');

    const gridLayoutClass =
        showLeftSidebar && showRightSidebar
            ? 'grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_320px]'
            : showLeftSidebar
              ? 'grid-cols-1 gap-6 lg:grid-cols-[240px_minmax(0,1fr)]'
              : showRightSidebar
                ? 'grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]'
                : 'grid-cols-1 gap-6';

    return (
        <div className='min-h-screen'>
            <OfflineSync />
            <MainNav />
            <div className='mx-auto w-full max-w-370  px-3 pb-10 pt-5 md:px-2 md:pt-5 lg:px-8'>
                <div className={`grid ${gridLayoutClass}`}>
                    {showLeftSidebar ? (
                        <LeftSidebar pathname={pathname} />
                    ) : null}
                    <main className='min-w-0'>{children}</main>
                    {showRightSidebar ? <RightSidebar /> : null}
                </div>
            </div>
        </div>
    );
}
