'use client';

import Image from 'next/image';
import Link from 'next/link';
import { use, useMemo, useEffect, useState, useRef } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import {
    fetchFreedomPosts,
    fetchIncognitoPosts,
    fetchPosts,
} from '@/lib/supabase';

type TrendingHashtagPost = {
    key: string;
    source: 'Feed' | 'Freedom Wall' | 'Incognito';
    href: string;
    title: string;
    body: string;
    imageUrl?: string;
    likes: number;
    comments: number;
    interactions: number;
    createdAt: string;
};

const PAGE_SIZE = 5;

function safeTimeValue(timestamp: string): number {
    const value = new Date(timestamp).getTime();
    return Number.isNaN(value) ? 0 : value;
}

function normalizeText(value: string, fallback: string): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return fallback;
    if (normalized.length <= 120) return normalized;
    return `${normalized.slice(0, 117)}...`;
}

function hasTag(value: string, tag: string): boolean {
    const pattern = new RegExp(`(^|\\s)#${tag}(?=\\s|$|[.,!?;:])`, 'i');
    return pattern.test(value);
}

export default function TrendingHashtagPage({
    params,
}: {
    params: Promise<{ tag: string }>;
}) {
    const resolvedParams = use(params);
    const normalizedTag = decodeURIComponent(resolvedParams.tag ?? '')
        .trim()
        .replace(/^#/, '')
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '');

    const [items, setItems] = useState<TrendingHashtagPost[]>([]);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const [autoLoad, setAutoLoad] = useState(false);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading hashtag posts...');
    const anchorRef = useRef<HTMLDivElement | null>(null);

    const visibleItems = useMemo(
        () => items.slice(0, visibleCount),
        [items, visibleCount],
    );
    const hasMore = visibleCount < items.length;

    useEffect(() => {
        let mounted = true;

        async function load() {
            setLoading(true);
            setStatus('Loading hashtag posts...');
            setVisibleCount(PAGE_SIZE);
            setAutoLoad(false);

            if (!normalizedTag) {
                setItems([]);
                setStatus('No hashtag provided.');
                setLoading(false);
                return;
            }

            try {
                const [feedResult, freedomResult, incognitoResult] =
                    await Promise.allSettled([
                        fetchPosts(),
                        fetchFreedomPosts(),
                        fetchIncognitoPosts(),
                    ]);

                const nextItems: TrendingHashtagPost[] = [];

                if (feedResult.status === 'fulfilled') {
                    feedResult.value.forEach((post) => {
                        const text = `${post.caption ?? ''} ${post.eventName ?? ''}`;
                        if (!hasTag(text, normalizedTag)) return;
                        nextItems.push({
                            key: `feed-${post.id}`,
                            source: 'Feed',
                            href: `/feed?post=${encodeURIComponent(post.id)}`,
                            title: normalizeText(
                                post.caption || post.eventName || '',
                                'Feed post',
                            ),
                            body: post.caption ?? post.eventName ?? '',
                            imageUrl:
                                post.images?.[0] ?? post.imageUrl ?? undefined,
                            likes: post.likes,
                            comments: post.comments,
                            interactions: post.likes + post.comments,
                            createdAt: post.createdAt,
                        });
                    });
                }

                if (freedomResult.status === 'fulfilled') {
                    freedomResult.value.forEach((post) => {
                        if (!hasTag(post.content, normalizedTag)) return;
                        nextItems.push({
                            key: `freedom-${post.id}`,
                            source: 'Freedom Wall',
                            href: `/freedom-wall?post=${encodeURIComponent(
                                post.id,
                            )}`,
                            title: normalizeText(post.content, 'Freedom post'),
                            body: post.content,
                            imageUrl: post.imageUrl,
                            likes: post.likes,
                            comments: post.comments,
                            interactions: post.likes + post.comments,
                            createdAt: post.createdAt,
                        });
                    });
                }

                if (incognitoResult.status === 'fulfilled') {
                    incognitoResult.value.forEach((post) => {
                        if (!hasTag(post.content, normalizedTag)) return;
                        nextItems.push({
                            key: `incognito-${post.id}`,
                            source: 'Incognito',
                            href: `/incognito?post=${encodeURIComponent(
                                post.id,
                            )}`,
                            title: normalizeText(
                                post.content,
                                'Incognito post',
                            ),
                            body: post.content,
                            likes: post.likes,
                            comments: post.comments,
                            interactions: post.likes + post.comments,
                            createdAt: post.createdAt,
                        });
                    });
                }

                nextItems.sort((a, b) => {
                    if (b.interactions !== a.interactions) {
                        return b.interactions - a.interactions;
                    }
                    return (
                        safeTimeValue(b.createdAt) - safeTimeValue(a.createdAt)
                    );
                });

                if (!mounted) return;
                setItems(nextItems);
                setStatus(
                    nextItems.length === 0
                        ? `No posts found for #${normalizedTag}.`
                        : '',
                );
            } catch (error) {
                if (!mounted) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load hashtag posts.';
                setStatus(message);
            } finally {
                if (mounted) setLoading(false);
            }
        }

        void load();
        return () => {
            mounted = false;
        };
    }, [normalizedTag]);

    useEffect(() => {
        if (!autoLoad || !hasMore || !anchorRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    setVisibleCount((previous) =>
                        Math.min(previous + PAGE_SIZE, items.length),
                    );
                }
            },
            { rootMargin: '240px 0px 240px 0px' },
        );
        observer.observe(anchorRef.current);
        return () => observer.disconnect();
    }, [autoLoad, hasMore, items.length]);

    return (
        <AuthGuard roles={['admin', 'member', 'visitor']}>
            <AppShell>
                <PageHeader
                    eyebrow='Trending'
                    title={`#${normalizedTag || 'hashtag'}`}
                    description='Posts sorted by interactions first, then most recent.'
                />

                {loading ? (
                    <section className='space-y-3'>
                        <div className='h-28 animate-pulse rounded-2xl border border-slate-200 bg-white' />
                        <div className='h-28 animate-pulse rounded-2xl border border-slate-200 bg-white' />
                    </section>
                ) : null}

                {!loading && status ? (
                    <p className='rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>
                        {status}
                    </p>
                ) : null}

                {!loading && visibleItems.length > 0 ? (
                    <section className='space-y-3'>
                        {visibleItems.map((item) => (
                            <article
                                key={item.key}
                                className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'
                            >
                                <div className='flex items-start justify-between gap-3'>
                                    <div className='min-w-0'>
                                        <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500'>
                                            {item.source}
                                        </p>
                                        <p className='mt-1 text-sm font-semibold text-slate-800'>
                                            {item.title}
                                        </p>
                                        <p className='mt-1 text-xs text-slate-500'>
                                            {new Date(
                                                item.createdAt,
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <Link
                                        href={item.href}
                                        className='rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100'
                                    >
                                        Open
                                    </Link>
                                </div>

                                {item.imageUrl ? (
                                    <div className='relative mt-3 h-44 overflow-hidden rounded-xl border border-slate-200 bg-slate-100'>
                                        <Image
                                            src={item.imageUrl}
                                            alt={`${item.source} hashtag post`}
                                            fill
                                            className='object-cover'
                                            sizes='(max-width: 768px) 100vw, 700px'
                                        />
                                    </div>
                                ) : null}

                                <p className='mt-3 text-xs text-slate-600'>
                                    {item.interactions} interactions |{' '}
                                    {item.comments} comments
                                </p>
                            </article>
                        ))}

                        {hasMore ? (
                            <div className='space-y-3'>
                                {!autoLoad ? (
                                    <button
                                        type='button'
                                        onClick={() => {
                                            setAutoLoad(true);
                                            setVisibleCount((previous) =>
                                                Math.min(
                                                    previous + PAGE_SIZE,
                                                    items.length,
                                                ),
                                            );
                                        }}
                                        className='w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50'
                                    >
                                        See more posts
                                    </button>
                                ) : null}
                                <div
                                    ref={anchorRef}
                                    className='h-2 w-full'
                                    aria-hidden='true'
                                />
                            </div>
                        ) : null}
                    </section>
                ) : null}
            </AppShell>
        </AuthGuard>
    );
}
