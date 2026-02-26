'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardBody, Chip } from '@heroui/react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import {
    fetchFreedomPosts,
    fetchPostsPage,
    fetchTrendingInsights,
    getCurrentUserProfile,
} from '@/lib/supabase';

type TrendingFeedItem = {
    id: string;
    title: string;
    href: string;
    likes: number;
    comments: number;
    uniqueUsers: number;
    createdAt: string;
};

type TrendingFreedomItem = {
    id: string;
    title: string;
    href: string;
    likes: number;
    comments: number;
    uniqueUsers: number;
    createdAt: string;
};

type TrendingTagItem = {
    tag: string;
    count: number;
    href: string;
};

const MIN_TREND_INTERACTIONS = 5;

function normalizeText(value: string, fallback: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return fallback;
    if (normalized.length <= 110) return normalized;
    return `${normalized.slice(0, 107)}...`;
}

function safeTimeValue(timestamp: string): number {
    const value = new Date(timestamp).getTime();
    return Number.isNaN(value) ? 0 : value;
}

export default function TrendingOverviewPage() {
    const [feedItems, setFeedItems] = useState<TrendingFeedItem[]>([]);
    const [freedomItems, setFreedomItems] = useState<TrendingFreedomItem[]>([]);
    const [tagItems, setTagItems] = useState<TrendingTagItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading trends...');

    useEffect(() => {
        let mounted = true;

        async function load() {
            try {
                setLoading(true);
                setStatus('Loading trends...');

                const profile = await getCurrentUserProfile().catch(() => null);
                const visitorMode = profile?.role === 'visitor';

                const [feedPage, freedomPosts] = await Promise.all([
                    fetchPostsPage({
                        visibility: visitorMode ? 'campus' : undefined,
                        limit: 80,
                    }),
                    visitorMode ? Promise.resolve([]) : fetchFreedomPosts(),
                ]);

                const insights = await fetchTrendingInsights({
                    feedPostIds: feedPage.items.map((post) => post.id),
                    freedomPostIds: freedomPosts.map((post) => post.id),
                    hashtagLimit: 12,
                });

                const nextFeedItems = feedPage.items
                    .map((post) => {
                        const engagement = insights.feed[post.id];
                        const likes = engagement?.likes ?? post.likes;
                        const comments = engagement?.comments ?? post.comments;
                        const uniqueUsers =
                            engagement?.uniqueInteractionUsers ??
                            Math.max(likes, comments);
                        return {
                            id: post.id,
                            title: normalizeText(
                                post.caption || post.eventName || '',
                                'Feed post',
                            ),
                            href: `/feed?post=${encodeURIComponent(post.id)}`,
                            likes,
                            comments,
                            uniqueUsers,
                            createdAt: post.createdAt,
                        };
                    })
                    .filter(
                        (item) => item.uniqueUsers >= MIN_TREND_INTERACTIONS,
                    )
                    .sort((a, b) => {
                        const scoreA =
                            a.uniqueUsers * 1000 +
                            a.comments * 100 +
                            a.likes * 10;
                        const scoreB =
                            b.uniqueUsers * 1000 +
                            b.comments * 100 +
                            b.likes * 10;
                        if (scoreB !== scoreA) {
                            return scoreB - scoreA;
                        }
                        return (
                            safeTimeValue(b.createdAt) -
                            safeTimeValue(a.createdAt)
                        );
                    })
                    .slice(0, 8);

                const nextFreedomItems = freedomPosts
                    .map((post) => {
                        const engagement = insights.freedom[post.id];
                        const likes = engagement?.likes ?? post.likes;
                        const comments = engagement?.comments ?? post.comments;
                        const uniqueUsers =
                            engagement?.uniqueInteractionUsers ??
                            Math.max(likes, comments);
                        return {
                            id: post.id,
                            title: normalizeText(
                                post.content,
                                'Freedom Wall post',
                            ),
                            href: `/freedom-wall?post=${encodeURIComponent(
                                post.id,
                            )}`,
                            likes,
                            comments,
                            uniqueUsers,
                            createdAt: post.createdAt,
                        };
                    })
                    .filter(
                        (item) => item.uniqueUsers >= MIN_TREND_INTERACTIONS,
                    )
                    .sort((a, b) => {
                        const scoreA =
                            a.uniqueUsers * 1000 +
                            a.comments * 100 +
                            a.likes * 10;
                        const scoreB =
                            b.uniqueUsers * 1000 +
                            b.comments * 100 +
                            b.likes * 10;
                        if (scoreB !== scoreA) {
                            return scoreB - scoreA;
                        }
                        return (
                            safeTimeValue(b.createdAt) -
                            safeTimeValue(a.createdAt)
                        );
                    })
                    .slice(0, 8);

                const nextTagItems = insights.hashtags
                    .map((item) => ({
                        tag: item.tag,
                        count: item.uniqueUsers,
                        href: `/trending/${encodeURIComponent(
                            item.tag.replace(/^#/, ''),
                        )}`,
                    }))
                    .filter((item) => item.count >= MIN_TREND_INTERACTIONS)
                    .slice(0, 12);

                if (!mounted) return;
                setFeedItems(nextFeedItems);
                setFreedomItems(nextFreedomItems);
                setTagItems(nextTagItems);

                const hasAny =
                    nextFeedItems.length > 0 ||
                    nextFreedomItems.length > 0 ||
                    nextTagItems.length > 0;
                setStatus(hasAny ? '' : 'No trending items yet.');
            } catch (error) {
                if (!mounted) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load trending items.';
                setStatus(message);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        void load();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <AuthGuard roles={['admin', 'member', 'visitor']}>
            <AppShell>
                <div className='mx-auto w-full max-w-3xl'>
                    <PageHeader
                        eyebrow='KATOL Galleria Trends'
                        title='Trending Post'
                        description='Top feed posts, hashtags, and Freedom Wall posts.'
                    />

                    {loading ? (
                        <section className='space-y-3'>
                            <div className='h-24 animate-pulse rounded-2xl border border-slate-200 bg-white' />
                            <div className='h-24 animate-pulse rounded-2xl border border-slate-200 bg-white' />
                            <div className='h-24 animate-pulse rounded-2xl border border-slate-200 bg-white' />
                        </section>
                    ) : null}

                    {/* {!loading && status ? (
                        <Card className='mb-4 border border-slate-200 bg-white'>
                            <CardBody className='p-4 text-sm text-slate-600'>
                                {status}
                            </CardBody>
                        </Card>
                    ) : null} */}

                    {!loading ? (
                        <div className='space-y-5'>
                            <Card className='border border-slate-200 bg-white shadow-sm rounded-2xl'>
                                <CardBody className='p-4'>
                                    <h2 className='text-sm font-bold text-slate-800'>
                                        Trending Feed
                                    </h2>
                                    <div className='mt-3 space-y-2'>
                                        {feedItems.length === 0 ? (
                                            <p className='text-xs text-slate-500'>
                                                No feed trends yet.
                                            </p>
                                        ) : (
                                            feedItems.map((item, index) => (
                                                <Link
                                                    key={item.id}
                                                    href={item.href}
                                                    className='block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:bg-slate-100'
                                                >
                                                    <p className='text-sm font-semibold text-slate-800'>
                                                        <span className='text-cyan-600 pr-1'>
                                                            {index + 1}.
                                                        </span>
                                                        {item.title}
                                                    </p>
                                                    <p className='mt-1 text-[11px] text-slate-500'>
                                                        {item.uniqueUsers} users
                                                        | {item.comments}{' '}
                                                        comments
                                                    </p>
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className='border border-slate-200 bg-white shadow-sm rounded-2xl'>
                                <CardBody className='p-4'>
                                    <h2 className='text-sm font-bold text-slate-800'>
                                        Trending Hashtags
                                    </h2>
                                    <div className='mt-3 flex flex-wrap gap-2'>
                                        {tagItems.length === 0 ? (
                                            <p className='text-xs text-slate-500'>
                                                No hashtag trends yet.
                                            </p>
                                        ) : (
                                            tagItems.map((item) => (
                                                <Link
                                                    key={item.tag}
                                                    href={item.href}
                                                >
                                                    <Chip
                                                        size='sm'
                                                        variant='flat'
                                                        className='cursor-pointer bg-cyan-100 text-xs font-semibold text-cyan-800 transition hover:bg-cyan-200'
                                                    >
                                                        {item.tag} ({item.count}
                                                        )
                                                    </Chip>
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                </CardBody>
                            </Card>

                            <Card className='border border-slate-200 bg-white shadow-sm rounded-2xl'>
                                <CardBody className='p-4'>
                                    <h2 className='text-sm font-bold text-slate-800'>
                                        Trending Freedom Wall
                                    </h2>
                                    <div className='mt-3 space-y-2'>
                                        {freedomItems.length === 0 ? (
                                            <p className='text-xs text-slate-500'>
                                                No Freedom Wall trends yet.
                                            </p>
                                        ) : (
                                            freedomItems.map((item, index) => (
                                                <Link
                                                    key={item.id}
                                                    href={item.href}
                                                    className='block rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition hover:bg-slate-100'
                                                >
                                                    <p className='text-sm font-semibold text-slate-800'>
                                                        <span className='text-cyan-600 pr-1'>
                                                            {index + 1}.
                                                        </span>
                                                        {item.title}
                                                    </p>
                                                    <p className='mt-1 text-[11px] text-slate-500'>
                                                        {item.uniqueUsers} users
                                                        | {item.comments}{' '}
                                                        comments
                                                    </p>
                                                </Link>
                                            ))
                                        )}
                                    </div>
                                </CardBody>
                            </Card>
                        </div>
                    ) : null}
                </div>
            </AppShell>
        </AuthGuard>
    );
}
