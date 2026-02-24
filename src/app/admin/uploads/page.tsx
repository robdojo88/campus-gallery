'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import {
    adminDeleteContentTarget,
    fetchFreedomPostComments,
    fetchFreedomPosts,
    fetchPostComments,
    fetchPosts,
} from '@/lib/supabase';
import type { FreedomPost, FreedomWallComment, Post, PostComment } from '@/lib/types';

type FeedCommentsByPost = Record<string, PostComment[]>;
type FreedomCommentsByPost = Record<string, FreedomWallComment[]>;

export default function AdminUploadsPage() {
    const [feedPosts, setFeedPosts] = useState<Post[]>([]);
    const [freedomPosts, setFreedomPosts] = useState<FreedomPost[]>([]);
    const [feedCommentsByPost, setFeedCommentsByPost] =
        useState<FeedCommentsByPost>({});
    const [freedomCommentsByPost, setFreedomCommentsByPost] =
        useState<FreedomCommentsByPost>({});
    const [openFeedComments, setOpenFeedComments] = useState<
        Record<string, boolean>
    >({});
    const [openFreedomComments, setOpenFreedomComments] = useState<
        Record<string, boolean>
    >({});
    const [status, setStatus] = useState('Loading moderation content...');
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState('');

    async function loadContent() {
        setLoading(true);
        try {
            const [posts, freedom] = await Promise.all([
                fetchPosts(),
                fetchFreedomPosts(),
            ]);
            setFeedPosts(posts);
            setFreedomPosts(freedom);
            setFeedCommentsByPost({});
            setFreedomCommentsByPost({});
            setOpenFeedComments({});
            setOpenFreedomComments({});
            setStatus('');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load moderation content.';
            setStatus(message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadContent();
    }, []);

    async function onDeleteTarget(targetType: 'feed_post' | 'feed_comment' | 'freedom_post' | 'freedom_comment', targetId: string) {
        setBusyId(targetId);
        try {
            await adminDeleteContentTarget({
                targetType,
                targetId,
            });
            await loadContent();
            setStatus('Content deleted.');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Delete failed.';
            setStatus(message);
        } finally {
            setBusyId('');
        }
    }

    async function toggleFeedComments(postId: string) {
        const next = !openFeedComments[postId];
        setOpenFeedComments((prev) => ({ ...prev, [postId]: next }));
        if (!next) return;
        if (feedCommentsByPost[postId]) return;
        try {
            const comments = await fetchPostComments(postId);
            setFeedCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load feed comments.';
            setStatus(message);
        }
    }

    async function toggleFreedomComments(postId: string) {
        const next = !openFreedomComments[postId];
        setOpenFreedomComments((prev) => ({ ...prev, [postId]: next }));
        if (!next) return;
        if (freedomCommentsByPost[postId]) return;
        try {
            const comments = await fetchFreedomPostComments(postId);
            setFreedomCommentsByPost((prev) => ({
                ...prev,
                [postId]: comments,
            }));
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load Freedom Wall comments.';
            setStatus(message);
        }
    }

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <PageHeader
                    eyebrow='Admin'
                    title='Moderate Feed & Freedom Wall'
                    description='Delete specific posts and comments from Feed and Freedom Wall.'
                />
                {status ? (
                    <p className='mb-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>
                        {status}
                    </p>
                ) : null}

                <section className='mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <h2 className='text-base font-bold text-slate-900'>
                        Feed Posts
                    </h2>
                    {loading ? (
                        <p className='mt-3 text-sm text-slate-500'>Loading...</p>
                    ) : feedPosts.length === 0 ? (
                        <p className='mt-3 text-sm text-slate-500'>
                            No feed posts available.
                        </p>
                    ) : (
                        <div className='mt-3 space-y-3'>
                            {feedPosts.map((post) => (
                                <article
                                    key={post.id}
                                    className='rounded-2xl border border-slate-200 bg-slate-50 p-3'
                                >
                                    <div className='flex flex-wrap items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <p className='text-sm font-semibold text-slate-800'>
                                                {post.author?.name ?? 'Unknown'}
                                            </p>
                                            <p className='mt-1 text-xs text-slate-500'>
                                                {new Date(
                                                    post.createdAt,
                                                ).toLocaleString()}
                                            </p>
                                            <p className='mt-2 text-sm text-slate-700'>
                                                {post.caption || 'No caption'}
                                            </p>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    void toggleFeedComments(
                                                        post.id,
                                                    )
                                                }
                                                className='rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100'
                                            >
                                                {openFeedComments[post.id]
                                                    ? 'Hide comments'
                                                    : 'Show comments'}
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    void onDeleteTarget(
                                                        'feed_post',
                                                        post.id,
                                                    )
                                                }
                                                disabled={busyId === post.id}
                                                className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                            >
                                                Delete Post
                                            </button>
                                        </div>
                                    </div>

                                    {openFeedComments[post.id] ? (
                                        <div className='mt-3 space-y-2 border-t border-slate-200 pt-3'>
                                            {(feedCommentsByPost[post.id] ?? [])
                                                .length === 0 ? (
                                                <p className='text-xs text-slate-500'>
                                                    No comments.
                                                </p>
                                            ) : (
                                                feedCommentsByPost[
                                                    post.id
                                                ]?.map((comment) => (
                                                    <div
                                                        key={comment.id}
                                                        className='rounded-xl border border-slate-200 bg-white px-3 py-2'
                                                    >
                                                        <div className='flex items-start justify-between gap-3'>
                                                            <div className='min-w-0'>
                                                                <p className='text-xs font-semibold text-slate-700'>
                                                                    {
                                                                        comment.authorName
                                                                    }
                                                                </p>
                                                                <p className='mt-1 text-xs text-slate-600'>
                                                                    {
                                                                        comment.content
                                                                    }
                                                                </p>
                                                            </div>
                                                            <button
                                                                type='button'
                                                                onClick={() =>
                                                                    void onDeleteTarget(
                                                                        'feed_comment',
                                                                        comment.id,
                                                                    )
                                                                }
                                                                disabled={
                                                                    busyId ===
                                                                    comment.id
                                                                }
                                                                className='rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <h2 className='text-base font-bold text-slate-900'>
                        Freedom Wall Posts
                    </h2>
                    {loading ? (
                        <p className='mt-3 text-sm text-slate-500'>Loading...</p>
                    ) : freedomPosts.length === 0 ? (
                        <p className='mt-3 text-sm text-slate-500'>
                            No Freedom Wall posts available.
                        </p>
                    ) : (
                        <div className='mt-3 space-y-3'>
                            {freedomPosts.map((post) => (
                                <article
                                    key={post.id}
                                    className='rounded-2xl border border-slate-200 bg-slate-50 p-3'
                                >
                                    <div className='flex flex-wrap items-start justify-between gap-3'>
                                        <div className='min-w-0'>
                                            <p className='text-sm font-semibold text-slate-800'>
                                                {post.authorName ?? 'Unknown'}
                                            </p>
                                            <p className='mt-1 text-xs text-slate-500'>
                                                {new Date(
                                                    post.createdAt,
                                                ).toLocaleString()}
                                            </p>
                                            <p className='mt-2 text-sm text-slate-700'>
                                                {post.content || 'No text'}
                                            </p>
                                        </div>
                                        <div className='flex items-center gap-2'>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    void toggleFreedomComments(
                                                        post.id,
                                                    )
                                                }
                                                className='rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100'
                                            >
                                                {openFreedomComments[post.id]
                                                    ? 'Hide comments'
                                                    : 'Show comments'}
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    void onDeleteTarget(
                                                        'freedom_post',
                                                        post.id,
                                                    )
                                                }
                                                disabled={busyId === post.id}
                                                className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                            >
                                                Delete Post
                                            </button>
                                        </div>
                                    </div>

                                    {openFreedomComments[post.id] ? (
                                        <div className='mt-3 space-y-2 border-t border-slate-200 pt-3'>
                                            {(freedomCommentsByPost[post.id] ??
                                                []).length === 0 ? (
                                                <p className='text-xs text-slate-500'>
                                                    No comments.
                                                </p>
                                            ) : (
                                                freedomCommentsByPost[
                                                    post.id
                                                ]?.map((comment) => (
                                                    <div
                                                        key={comment.id}
                                                        className='rounded-xl border border-slate-200 bg-white px-3 py-2'
                                                    >
                                                        <div className='flex items-start justify-between gap-3'>
                                                            <div className='min-w-0'>
                                                                <p className='text-xs font-semibold text-slate-700'>
                                                                    {
                                                                        comment.authorName
                                                                    }
                                                                </p>
                                                                <p className='mt-1 text-xs text-slate-600'>
                                                                    {
                                                                        comment.content
                                                                    }
                                                                </p>
                                                            </div>
                                                            <button
                                                                type='button'
                                                                onClick={() =>
                                                                    void onDeleteTarget(
                                                                        'freedom_comment',
                                                                        comment.id,
                                                                    )
                                                                }
                                                                disabled={
                                                                    busyId ===
                                                                    comment.id
                                                                }
                                                                className='rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    ) : null}
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
