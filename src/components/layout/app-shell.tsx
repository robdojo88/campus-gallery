'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { Card, CardBody, Chip, ScrollShadow } from '@heroui/react';
import { useEffect, useState, type ReactNode } from 'react';
import { MainNav } from '@/components/layout/main-nav';
import { OfflineSync } from '@/components/system/offline-sync';
import {
    fetchFreedomPosts,
    fetchIncognitoPosts,
    fetchPostsPage,
    fetchTrendingInsights,
    getCurrentUserProfile,
} from '@/lib/supabase';
import type { UserRole } from '@/lib/types';

const NAV_ROLE_CACHE_KEY = 'campus_gallery_nav_role';

function normalizeRole(value: unknown): UserRole | null {
    if (value === 'admin' || value === 'member' || value === 'visitor')
        return value;
    return null;
}

function getCachedRole(): UserRole | null {
    if (typeof window === 'undefined') return null;
    return normalizeRole(window.localStorage.getItem(NAV_ROLE_CACHE_KEY));
}

type TrendingItem = {
    key: string;
    source: 'Feed' | 'Freedom Wall' | 'Incognito';
    href: string;
    title: string;
    likes: number;
    comments: number;
    uniqueLikeUsers: number;
    uniqueCommentUsers: number;
    uniqueInteractionUsers: number;
    trendScore: number;
    createdAt: string;
    previewImages: string[];
};

type TrendingHashtag = {
    tag: string;
    count: number;
};

type TrendingEngagement = {
    likes: number;
    comments: number;
    uniqueLikeUsers: number;
    uniqueCommentUsers: number;
    uniqueInteractionUsers: number;
};

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

function resolveTrendingEngagement(
    engagement: Partial<TrendingEngagement> | undefined,
    fallbackLikes: number,
    fallbackComments: number,
): TrendingEngagement {
    const likes = engagement?.likes ?? fallbackLikes;
    const comments = engagement?.comments ?? fallbackComments;
    const uniqueLikeUsers = engagement?.uniqueLikeUsers ?? likes;
    const uniqueCommentUsers = engagement?.uniqueCommentUsers ?? comments;
    const uniqueInteractionUsers =
        engagement?.uniqueInteractionUsers ??
        Math.max(uniqueLikeUsers, uniqueCommentUsers);

    return {
        likes,
        comments,
        uniqueLikeUsers,
        uniqueCommentUsers,
        uniqueInteractionUsers,
    };
}

function calculateTrendScore(engagement: TrendingEngagement): number {
    return (
        engagement.uniqueInteractionUsers * 1000 +
        engagement.uniqueCommentUsers * 100 +
        engagement.uniqueLikeUsers * 10 +
        engagement.comments +
        engagement.likes
    );
}

function sortByTrendScore(items: TrendingItem[]): TrendingItem[] {
    return [...items].sort((a, b) => {
        if (b.trendScore !== a.trendScore) {
            return b.trendScore - a.trendScore;
        }
        if (b.uniqueInteractionUsers !== a.uniqueInteractionUsers) {
            return b.uniqueInteractionUsers - a.uniqueInteractionUsers;
        }
        if (b.uniqueCommentUsers !== a.uniqueCommentUsers) {
            return b.uniqueCommentUsers - a.uniqueCommentUsers;
        }
        if (b.uniqueLikeUsers !== a.uniqueLikeUsers) {
            return b.uniqueLikeUsers - a.uniqueLikeUsers;
        }
        return safeTimeValue(b.createdAt) - safeTimeValue(a.createdAt);
    });
}

function LeftSidebar({ role }: { role: UserRole | null }) {
    const limitedVisitorMode = role === 'visitor';
    const [hashtags, setHashtags] = useState<TrendingHashtag[]>([]);
    const [freedomItems, setFreedomItems] = useState<TrendingItem[]>([]);
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
                        fetchPostsPage({
                            visibility: limitedVisitorMode
                                ? 'campus'
                                : undefined,
                            limit: 80,
                        }),
                        limitedVisitorMode
                            ? Promise.resolve([])
                            : fetchFreedomPosts(),
                        limitedVisitorMode
                            ? Promise.resolve([])
                            : fetchIncognitoPosts(),
                    ]);

                const insights = await fetchTrendingInsights({
                    feedPostIds: feedPage.items.map((post) => post.id),
                    freedomPostIds: freedomPosts.map((post) => post.id),
                    incognitoPostIds: incognitoPosts.map((post) => post.id),
                    hashtagLimit: 10,
                });

                const nextHashtags = [...insights.hashtags]
                    .map((item) => ({
                        tag: item.tag,
                        count: item.uniqueUsers,
                    }))
                    .sort((a, b) =>
                        b.count !== a.count
                            ? b.count - a.count
                            : a.tag.localeCompare(b.tag),
                    )
                    .slice(0, 5);

                const nextFreedomItems = limitedVisitorMode
                    ? []
                    : sortByTrendScore(
                          freedomPosts.map((post) => {
                              const engagement = resolveTrendingEngagement(
                                  insights.freedom[post.id],
                                  post.likes,
                                  post.comments,
                              );

                              return {
                                  key: `freedom-${post.id}`,
                                  source: 'Freedom Wall' as const,
                                  href: `/freedom-wall?post=${encodeURIComponent(post.id)}`,
                                  title: normalizePreviewText(
                                      post.content,
                                      'Freedom Wall post',
                                  ),
                                  likes: engagement.likes,
                                  comments: engagement.comments,
                                  uniqueLikeUsers: engagement.uniqueLikeUsers,
                                  uniqueCommentUsers:
                                      engagement.uniqueCommentUsers,
                                  uniqueInteractionUsers:
                                      engagement.uniqueInteractionUsers,
                                  trendScore: calculateTrendScore(engagement),
                                  createdAt: post.createdAt,
                                  previewImages: [],
                              };
                          }),
                      ).slice(0, 5);

                if (!mounted) return;
                setHashtags(nextHashtags);
                setFreedomItems(nextFreedomItems);
                setStatus(
                    nextHashtags.length === 0 && nextFreedomItems.length === 0
                        ? 'No trends yet.'
                        : '',
                );
            } catch (error) {
                if (!mounted) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load trends.';
                setStatus(message);
                setHashtags([]);
                setFreedomItems([]);
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
    }, [limitedVisitorMode]);

    return (
        <aside className='hidden xl:block'>
            <div className='fixed top-20 w-60 space-y-4'>
                {/* <Card className='border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur'> */}
                <Card className=''>
                    <CardBody className='p-0'>
                        <div className='border-b border-slate-200/90 px-4 py-3'>
                            <p className='text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                                Trending Hashtags
                            </p>
                            {/* <p className='mt-1 text-[11px] text-slate-500'>
                                Ranked by unique users
                            </p> */}
                        </div>
                        <ScrollShadow
                            hideScrollBar
                            size={80}
                            className='scroll-shadow-fade-y max-h-[calc(100vh-30rem)] px-3 py-3'
                        >
                            {loading ? (
                                <div className='space-y-2'>
                                    <div className='h-8 animate-pulse rounded-lg bg-slate-100' />
                                    <div className='h-8 animate-pulse rounded-lg bg-slate-100' />
                                    <div className='h-8 animate-pulse rounded-lg bg-slate-100' />
                                </div>
                            ) : null}
                            {!loading && status ? (
                                <p className='rounded-xl bg-slate-50 p-3 text-xs text-slate-600'>
                                    {status}
                                </p>
                            ) : null}
                            {!loading && hashtags.length > 0 ? (
                                <div className='space-y-1.5'>
                                    {hashtags.map((item, index) => (
                                        <Link
                                            key={item.tag}
                                            href={`/trending/${encodeURIComponent(item.tag.slice(1))}`}
                                            className='flex items-center justify-between gap-2 rounded-xl px-2 py-2 transition hover:bg-slate-100'
                                        >
                                            <div className='min-w-0'>
                                                <p className='truncate text-sm font-semibold text-slate-800'>
                                                    Top {index + 1} - {item.tag}
                                                </p>
                                                <p className='text-[11px] font-medium text-slate-500'>
                                                    {item.count} users
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            ) : null}
                        </ScrollShadow>
                    </CardBody>
                </Card>

                {!limitedVisitorMode ? (
                    // <Card className='border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur'>
                    <Card className=''>
                        <CardBody className='p-0'>
                            <div className='border-b border-slate-200/90 px-4 py-3'>
                                <p className='text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                                    Trending Freedom Wall
                                </p>
                                {/* <p className='mt-1 text-[11px] text-slate-500'>
                                    Captions only
                                </p> */}
                            </div>
                            <ScrollShadow
                                hideScrollBar
                                size={80}
                                className='scroll-shadow-fade-y max-h-[calc(100vh-27rem)] px-3 py-3'
                            >
                                {loading ? (
                                    <div className='space-y-2'>
                                        <div className='h-12 animate-pulse rounded-lg bg-slate-100' />
                                        <div className='h-12 animate-pulse rounded-lg bg-slate-100' />
                                    </div>
                                ) : null}
                                {!loading && freedomItems.length === 0 ? (
                                    <p className='rounded-xl bg-slate-50 p-3 text-xs text-slate-600'>
                                        No trending Freedom Wall posts yet.
                                    </p>
                                ) : null}
                                {!loading && freedomItems.length > 0 ? (
                                    <div className='space-y-2'>
                                        {freedomItems.map((item) => (
                                            <Link
                                                key={item.key}
                                                href={item.href}
                                                className='block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:border-blue-200 hover:bg-blue-50/40'
                                            >
                                                <p className='line-clamp-2 text-sm font-medium text-slate-800'>
                                                    {item.title}
                                                </p>
                                                <p className='mt-1 text-[11px] text-slate-500'>
                                                    {
                                                        item.uniqueInteractionUsers
                                                    }{' '}
                                                    users
                                                </p>
                                            </Link>
                                        ))}
                                    </div>
                                ) : null}
                            </ScrollShadow>
                        </CardBody>
                    </Card>
                ) : null}
            </div>
        </aside>
    );
}

function RightSidebar({ role }: { role: UserRole | null }) {
    const limitedVisitorMode = role === 'visitor';
    const [items, setItems] = useState<TrendingItem[]>([]);
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

                const feedPage = await fetchPostsPage({
                    visibility: limitedVisitorMode ? 'campus' : undefined,
                    limit: 80,
                });
                const insights = await fetchTrendingInsights({
                    feedPostIds: feedPage.items.map((post) => post.id),
                });

                const nextItems = sortByTrendScore(
                    feedPage.items.map((post) => {
                        const engagement = resolveTrendingEngagement(
                            insights.feed[post.id],
                            post.likes,
                            post.comments,
                        );

                        return {
                            key: `feed-${post.id}`,
                            source: 'Feed' as const,
                            href: `/feed?post=${encodeURIComponent(post.id)}`,
                            title: normalizePreviewText(
                                post.caption || post.eventName || '',
                                'Campus post',
                            ),
                            likes: engagement.likes,
                            comments: engagement.comments,
                            uniqueLikeUsers: engagement.uniqueLikeUsers,
                            uniqueCommentUsers: engagement.uniqueCommentUsers,
                            uniqueInteractionUsers:
                                engagement.uniqueInteractionUsers,
                            trendScore: calculateTrendScore(engagement),
                            createdAt: post.createdAt,
                            previewImages: normalizePreviewImages([
                                ...(post.images ?? []),
                                post.imageUrl,
                            ]),
                        };
                    }),
                ).slice(0, 6);

                if (!mounted) return;

                setItems(nextItems);
                setStatus(
                    nextItems.length === 0 ? 'No trending feeds yet.' : '',
                );
            } catch (error) {
                if (!mounted) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load trending feeds.';
                setStatus(message);
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
    }, [limitedVisitorMode]);

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
        }, 10000);

        return () => {
            window.clearInterval(timer);
        };
    }, [items]);

    return (
        <aside className='hidden xl:block'>
            <div className='fixed top-20 w-[320px]'>
                {/* <Card className='max-h-[calc(100vh-6rem)] border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur'> */}
                <Card className='max-h-[calc(100vh-6rem)]'>
                    <CardBody className='p-0'>
                        {/* <div className='sticky top-0 z-20 border-b border-slate-200/90 bg-white/95 px-4 py-3 backdrop-blur'> */}
                        <div className='sticky top-0 z-20 px-4 py-3 '>
                            <p className='text-xs font-semibold uppercase tracking-[0.15em] text-slate-500'>
                                Trending Feeds
                            </p>
                            {/* <p className='mt-1 text-[11px] text-slate-500'>
                                Ranked by unique users interacting
                            </p> */}
                        </div>

                        <ScrollShadow
                            hideScrollBar
                            size={80}
                            className='scroll-shadow-fade-y max-h-[calc(100vh-10.5rem)] px-4 py-3'
                        >
                            {loading ? (
                                <div className='space-y-2'>
                                    <div className='h-14 animate-pulse rounded-xl bg-slate-100' />
                                    <div className='h-14 animate-pulse rounded-xl bg-slate-100' />
                                    <div className='h-14 animate-pulse rounded-xl bg-slate-100' />
                                </div>
                            ) : null}
                            {!loading && status ? (
                                <p className='rounded-xl bg-slate-50 p-3 text-sm text-slate-600'>
                                    {status}
                                </p>
                            ) : null}
                            {!loading && items.length > 0 ? (
                                <div className='space-y-2.5'>
                                    {items.map((item, index) => {
                                        const previewIndex =
                                            previewIndexByKey[item.key] ?? 0;
                                        const previewImage =
                                            item.previewImages[previewIndex] ??
                                            item.previewImages[0];
                                        return (
                                            <motion.div
                                                key={item.key}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    duration: 0.2,
                                                    delay: index * 0.04,
                                                    ease: 'easeOut',
                                                }}
                                            >
                                                <Link
                                                    href={item.href}
                                                    className='group block'
                                                >
                                                    <Card className='border border-slate-200 bg-slate-50/80 transition-colors group-hover:border-blue-200 group-hover:bg-blue-50/50'>
                                                        <CardBody className='p-3'>
                                                            <Chip
                                                                size='sm'
                                                                variant='flat'
                                                                className='h-5 bg-slate-200/70 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-700'
                                                            >
                                                                {item.source}
                                                            </Chip>
                                                            <p className='mt-1 line-clamp-2 text-sm font-medium text-slate-800'>
                                                                {item.title}
                                                            </p>
                                                            {previewImage ? (
                                                                <div className='relative mt-2 h-48 overflow-hidden rounded-lg bg-slate-100'>
                                                                    <AnimatePresence
                                                                        mode='wait'
                                                                        initial={
                                                                            false
                                                                        }
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
                                                                                duration: 0.18,
                                                                                ease: 'easeOut',
                                                                            }}
                                                                            className='absolute inset-0'
                                                                        >
                                                                            <Image
                                                                                src={
                                                                                    previewImage
                                                                                }
                                                                                alt={`${item.source} trending preview`}
                                                                                fill
                                                                                className='object-cover transition-transform duration-500 group-hover:scale-[1.03]'
                                                                                sizes='280px'
                                                                            />
                                                                        </motion.div>
                                                                    </AnimatePresence>
                                                                    {item
                                                                        .previewImages
                                                                        .length >
                                                                    1 ? (
                                                                        <span className='absolute bottom-1.5 right-1.5 rounded bg-slate-900/75 px-1.5 py-0.5 text-[10px] font-semibold text-white'>
                                                                            {(previewIndex %
                                                                                item
                                                                                    .previewImages
                                                                                    .length) +
                                                                                1}
                                                                            /
                                                                            {
                                                                                item
                                                                                    .previewImages
                                                                                    .length
                                                                            }
                                                                        </span>
                                                                    ) : null}
                                                                </div>
                                                            ) : null}
                                                            <div className='mt-2 flex flex-wrap gap-1.5'>
                                                                <Chip
                                                                    size='sm'
                                                                    variant='flat'
                                                                    className='h-5 bg-blue-100 text-[10px] font-semibold text-blue-700'
                                                                >
                                                                    {
                                                                        item.uniqueInteractionUsers
                                                                    }{' '}
                                                                    users
                                                                </Chip>
                                                                <Chip
                                                                    size='sm'
                                                                    variant='flat'
                                                                    className='h-5 bg-cyan-100 text-[10px] font-semibold text-cyan-700'
                                                                >
                                                                    {
                                                                        item.uniqueCommentUsers
                                                                    }{' '}
                                                                    commenters
                                                                </Chip>
                                                                <Chip
                                                                    size='sm'
                                                                    variant='flat'
                                                                    className='h-5 bg-emerald-100 text-[10px] font-semibold text-emerald-700'
                                                                >
                                                                    {
                                                                        item.uniqueLikeUsers
                                                                    }{' '}
                                                                    likers
                                                                </Chip>
                                                            </div>
                                                        </CardBody>
                                                    </Card>
                                                </Link>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : null}
                        </ScrollShadow>
                    </CardBody>
                </Card>
            </div>
        </aside>
    );
}

function AppShellContent({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [role, setRole] = useState<UserRole | null>(null);
    const [isSuspended, setIsSuspended] = useState(false);
    const hasResolvedRole = role !== null;
    const isCameraRoute = pathname.startsWith('/camera');
    const showLeftSidebar =
        hasResolvedRole &&
        !isCameraRoute &&
        !isSuspended &&
        !pathname.startsWith('/admin') &&
        !pathname.startsWith('/profile');
    const showRightSidebar =
        hasResolvedRole &&
        !isCameraRoute &&
        !isSuspended &&
        !pathname.startsWith('/admin') &&
        !pathname.startsWith('/profile');

    useEffect(() => {
        let mounted = true;
        const cachedRole = getCachedRole();

        void getCurrentUserProfile()
            .then((profile) => {
                if (!mounted) return;
                setRole(profile?.role ?? cachedRole ?? null);
                setIsSuspended(profile?.isSuspended === true);
            })
            .catch(() => {
                if (!mounted) return;
                setRole((previous) => previous ?? cachedRole ?? null);
                setIsSuspended(false);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const gridLayoutClass =
        showLeftSidebar && showRightSidebar
            ? 'grid-cols-1 gap-6 xl:grid-cols-[240px_minmax(0,1fr)_320px]'
            : showLeftSidebar
              ? 'grid-cols-1 gap-6 xl:grid-cols-[240px_minmax(0,1fr)]'
              : showRightSidebar
                ? 'grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]'
                : 'grid-cols-1 gap-6';

    return (
        <div className='min-h-screen'>
            <OfflineSync />
            <MainNav disableNavigation={isSuspended} />
            <div className='mx-auto w-full max-w-370 px-3 pb-10 pt-5 md:px-2 md:pt-5 lg:px-8'>
                <div className={`grid ${gridLayoutClass}`}>
                    {showLeftSidebar ? <LeftSidebar role={role} /> : null}
                    <main className='min-w-0'>{children}</main>
                    {showRightSidebar ? <RightSidebar role={role} /> : null}
                </div>
            </div>
        </div>
    );
}

export function RootAppShell({ children }: { children: ReactNode }) {
    return <AppShellContent>{children}</AppShellContent>;
}

export function AppShell({ children }: { children: ReactNode }) {
    return <>{children}</>;
}
