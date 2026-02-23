'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { FeedLoader } from '@/components/feed/feed-loader';
import { AppShell } from '@/components/layout/app-shell';
import { PostCard } from '@/components/feed/post-card';
import { PageHeader } from '@/components/ui/page-header';
import { getErrorMessage } from '@/lib/error-message';
import { fetchPostsPage, subscribeToPosts } from '@/lib/supabase';
import type { Post } from '@/lib/types';

const PAGE_SIZE = 5;

export default function FeedPage() {
    const [campusPosts, setCampusPosts] = useState<Post[]>([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [cursor, setCursor] = useState<string | undefined>(undefined);
    const [hasMore, setHasMore] = useState(false);
    const anchorRef = useRef<HTMLDivElement | null>(null);
    const postsCountRef = useRef(0);

    useEffect(() => {
        postsCountRef.current = campusPosts.length;
    }, [campusPosts]);

    const loadInitial = useCallback(async () => {
        setStatus('');
        setLoading(true);
        setCursor(undefined);
        setHasMore(false);
        try {
            const page = await fetchPostsPage({ visibility: 'campus', limit: PAGE_SIZE });
            setCampusPosts(page.items);
            setCursor(page.nextCursor);
            setHasMore(page.hasMore);
            setStatus(page.items.length === 0 ? 'No posts yet.' : '');
        } catch (error) {
            const message = getErrorMessage(error, 'Failed to load feed.');
            setStatus(message);
        } finally {
            setLoading(false);
        }
    }, []);

    const refreshLoaded = useCallback(async () => {
        const loadedCount = Math.max(PAGE_SIZE, postsCountRef.current);
        try {
            const page = await fetchPostsPage({
                visibility: 'campus',
                limit: loadedCount,
            });
            setCampusPosts(page.items);
            setCursor(page.nextCursor);
            setHasMore(page.hasMore);
            setStatus(page.items.length === 0 ? 'No posts yet.' : '');
        } catch {
            // Keep current content visible if background refresh fails.
        }
    }, []);

    const loadMore = useCallback(async () => {
        if (!hasMore || !cursor || loading || loadingMore) return;
        setLoadingMore(true);
        try {
            const page = await fetchPostsPage({
                visibility: 'campus',
                limit: PAGE_SIZE,
                beforeCreatedAt: cursor,
            });
            setCampusPosts((prev) => {
                const existingIds = new Set(prev.map((post) => post.id));
                const next = page.items.filter((post) => !existingIds.has(post.id));
                return [...prev, ...next];
            });
            setCursor(page.nextCursor);
            setHasMore(page.hasMore);
        } catch (error) {
            const message = getErrorMessage(error, 'Failed to load more posts.');
            setStatus(message);
        } finally {
            setLoadingMore(false);
        }
    }, [cursor, hasMore, loading, loadingMore]);

    useEffect(() => {
        void loadInitial();
        const unsubscribe = subscribeToPosts(() => {
            void refreshLoaded();
        });
        return () => {
            unsubscribe();
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
            { rootMargin: '220px 0px 220px 0px' },
        );
        observer.observe(node);
        return () => {
            observer.disconnect();
        };
    }, [hasMore, loadMore, loading]);

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Realtime Feed'
                    title='Campus Feed'
                    description='Live social feed for students, teachers, and staff. Sorted by latest or most liked.'
                />
                {loading ? <FeedLoader count={3} /> : null}
                {!loading && status ? (
                    <p className='mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>{status}</p>
                ) : null}
                {!loading && campusPosts.length > 0 ? (
                    <div className='mx-auto w-full max-w-3xl space-y-4'>
                        {campusPosts.map((post) => (
                            <PostCard key={post.id} post={post} />
                        ))}
                    </div>
                ) : null}
                {!loading && hasMore ? (
                    <div className='mx-auto mt-4 w-full max-w-3xl space-y-3'>
                        <div ref={anchorRef} className='h-2 w-full' aria-hidden='true' />
                        <button
                            type='button'
                            onClick={() => void loadMore()}
                            disabled={loadingMore}
                            className='w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {loadingMore ? 'Loading more posts...' : 'See more posts'}
                        </button>
                        {loadingMore ? <FeedLoader count={2} compact /> : null}
                    </div>
                ) : null}
            </AppShell>
        </AuthGuard>
    );
}
