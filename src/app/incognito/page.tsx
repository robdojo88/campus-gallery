'use client';

import { useEffect, useRef, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import {
    addIncognitoPostComment,
    createIncognitoPost,
    fetchIncognitoPostComments,
    fetchIncognitoPosts,
    subscribeToIncognito,
    toggleIncognitoPostLike,
} from '@/lib/supabase';
import type { PostComment } from '@/lib/types';

function HeartIcon({ filled = false, className = 'h-4 w-4' }: { filled?: boolean; className?: string }) {
    return (
        <svg
            viewBox='0 0 24 24'
            aria-hidden='true'
            className={className}
            fill={filled ? 'currentColor' : 'none'}
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            <path d='m12 20.5-1.1-1C5.7 14.8 2 11.5 2 7.4 2 4.2 4.5 2 7.4 2c1.9 0 3.8.9 4.9 2.4C13.5 2.9 15.4 2 17.3 2 20.2 2 22.7 4.2 22.7 7.4c0 4.1-3.7 7.4-8.9 12.1z' />
        </svg>
    );
}

function CommentIcon({ className = 'h-4 w-4' }: { className?: string }) {
    return (
        <svg
            viewBox='0 0 24 24'
            aria-hidden='true'
            className={className}
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            <path d='M21 11.5a8.5 8.5 0 0 1-8.5 8.5H7l-4 3v-6.5A8.5 8.5 0 1 1 21 11.5Z' />
        </svg>
    );
}

function formatIncognitoTimestamp(createdAt: string): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;

    if (diffMs < hourMs) {
        const minutes = Math.max(1, Math.floor(diffMs / minuteMs));
        return `${minutes}m`;
    }

    if (diffMs < dayMs) {
        const hours = Math.max(1, Math.floor(diffMs / hourMs));
        return `${hours}h`;
    }

    const days = Math.floor(diffMs / dayMs);
    if (days <= 7) {
        return `${days}d`;
    }

    const showYear = date.getFullYear() !== now.getFullYear();
    const dateLabel = date.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
        ...(showYear ? { year: 'numeric' } : {}),
    });
    const timeLabel = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });
    return `${dateLabel} at ${timeLabel}`;
}

export default function IncognitoPage() {
    const [targetPostId, setTargetPostId] = useState('');
    const [content, setContent] = useState('');
    const [items, setItems] = useState<
        Array<{
            id: string;
            content: string;
            createdAt: string;
            authorId?: string;
            likes: number;
            comments: number;
            likedByCurrentUser: boolean;
        }>
    >([]);
    const [commentsByPost, setCommentsByPost] = useState<Record<string, PostComment[]>>({});
    const [commentInputByPost, setCommentInputByPost] = useState<Record<string, string>>({});
    const [openCommentsByPost, setOpenCommentsByPost] = useState<Record<string, boolean>>({});
    const [status, setStatus] = useState('Loading anonymous posts...');
    const [posting, setPosting] = useState(false);
    const [busyPostId, setBusyPostId] = useState('');
    const openCommentsRef = useRef<Record<string, boolean>>({});
    const focusedPostIdRef = useRef('');

    useEffect(() => {
        openCommentsRef.current = openCommentsByPost;
    }, [openCommentsByPost]);

    useEffect(() => {
        const readTargetPost = () => {
            const params = new URLSearchParams(window.location.search);
            setTargetPostId((params.get('post') ?? '').trim());
        };

        readTargetPost();
        window.addEventListener('popstate', readTargetPost);
        return () => {
            window.removeEventListener('popstate', readTargetPost);
        };
    }, []);

    async function loadPosts(options: { keepStatus?: boolean } = {}) {
        try {
            const data = await fetchIncognitoPosts();
            setItems(data);
            if (!options.keepStatus) {
                setStatus(data.length === 0 ? 'No anonymous posts yet.' : '');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load anonymous posts.';
            setStatus(message);
        }
    }

    async function loadComments(postId: string) {
        try {
            const rows = await fetchIncognitoPostComments(postId);
            setCommentsByPost((prev) => ({ ...prev, [postId]: rows }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load comments.';
            setStatus(message);
        }
    }

    useEffect(() => {
        let mounted = true;
        async function init() {
            await loadPosts();
            if (!mounted) return;
        }

        void init();

        const unsubscribe = subscribeToIncognito(() => {
            void loadPosts({ keepStatus: true });
            Object.entries(openCommentsRef.current).forEach(([postId, open]) => {
                if (open) void loadComments(postId);
            });
        });

        const pollingTimer = window.setInterval(() => {
            void loadPosts({ keepStatus: true });
            Object.entries(openCommentsRef.current).forEach(([postId, open]) => {
                if (open) void loadComments(postId);
            });
        }, 3000);

        return () => {
            mounted = false;
            unsubscribe();
            window.clearInterval(pollingTimer);
        };
    }, []);

    useEffect(() => {
        if (!targetPostId || focusedPostIdRef.current === targetPostId) return;
        const targetNode = document.querySelector<HTMLElement>(`[data-incognito-post-id="${targetPostId}"]`);
        if (!targetNode) return;
        targetNode.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
        focusedPostIdRef.current = targetPostId;
    }, [items, targetPostId]);

    async function submit() {
        if (posting) return;
        setPosting(true);
        try {
            await createIncognitoPost(content);
            setContent('');
            await loadPosts();
            setStatus('Anonymous post submitted.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to post anonymously.';
            setStatus(message);
        } finally {
            setPosting(false);
        }
    }

    async function onToggleLike(postId: string) {
        if (busyPostId) return;
        setBusyPostId(postId);
        try {
            await toggleIncognitoPostLike(postId);
            await loadPosts({ keepStatus: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update like.';
            setStatus(message);
        } finally {
            setBusyPostId('');
        }
    }

    async function toggleComments(postId: string) {
        const nextOpen = !openCommentsByPost[postId];
        setOpenCommentsByPost((prev) => ({ ...prev, [postId]: nextOpen }));
        if (nextOpen) {
            await loadComments(postId);
        }
    }

    async function submitComment(postId: string) {
        const value = (commentInputByPost[postId] ?? '').trim();
        if (!value || busyPostId) return;

        setBusyPostId(postId);
        try {
            await addIncognitoPostComment(postId, value);
            setCommentInputByPost((prev) => ({ ...prev, [postId]: '' }));
            setOpenCommentsByPost((prev) => ({ ...prev, [postId]: true }));
            await Promise.all([loadPosts({ keepStatus: true }), loadComments(postId)]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add comment.';
            setStatus(message);
        } finally {
            setBusyPostId('');
        }
    }

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Anonymous'
                    title='Incognito Page'
                    description='Members can post anonymously. Public view hides identity while admins can moderate safely.'
                />
                <section className='mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <div className='flex gap-2'>
                        <input
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            placeholder='Write an anonymous note'
                            className='flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm'
                        />
                        <button
                            type='button'
                            onClick={() => void submit()}
                            disabled={posting}
                            className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {posting ? 'Posting...' : 'Post'}
                        </button>
                    </div>
                </section>
                {status ? <p className='mb-4 text-sm text-slate-600'>{status}</p> : null}
                <section className='space-y-4'>
                    {items.map((post) => (
                        <article
                            key={post.id}
                            id={`incognito-post-${post.id}`}
                            data-incognito-post-id={post.id}
                            className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'
                        >
                            <div className='flex items-center justify-between gap-3'>
                                <p className='text-sm font-semibold text-slate-800'>Anonymous</p>
                                <p className='text-xs text-slate-500'>{formatIncognitoTimestamp(post.createdAt)}</p>
                            </div>
                            {post.authorId ? <p className='text-xs text-slate-500'>Admin view: {post.authorId}</p> : null}
                            <p className='mt-2 text-sm text-slate-700'>{post.content}</p>
                            <div className='mt-3 space-y-3'>
                                <div className='flex items-center justify-between border-b border-slate-200 pb-2 text-sm text-slate-600'>
                                    <div className='inline-flex items-center gap-1.5'>
                                        <HeartIcon filled className='h-4 w-4 text-rose-500' />
                                        <span>{post.likes}</span>
                                    </div>
                                    <div className='inline-flex items-center gap-1.5'>
                                        <CommentIcon className='h-4 w-4 text-slate-500' />
                                        <span>{post.comments}</span>
                                    </div>
                                </div>
                                <div className='grid grid-cols-2 gap-2'>
                                    <button
                                        type='button'
                                        onClick={() => void onToggleLike(post.id)}
                                        disabled={busyPostId === post.id}
                                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                            post.likedByCurrentUser
                                                ? 'border-rose-200 bg-rose-50 text-rose-600'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        } disabled:cursor-not-allowed disabled:opacity-60`}
                                    >
                                        <HeartIcon filled={post.likedByCurrentUser} className={`h-4 w-4 ${post.likedByCurrentUser ? 'text-rose-600' : 'text-slate-500'}`} />
                                        <span>Like</span>
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => void toggleComments(post.id)}
                                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                            openCommentsByPost[post.id]
                                                ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <CommentIcon className={`h-4 w-4 ${openCommentsByPost[post.id] ? 'text-cyan-700' : 'text-slate-500'}`} />
                                        <span>{openCommentsByPost[post.id] ? 'Hide' : 'Comment'}</span>
                                    </button>
                                </div>
                            </div>

                            {openCommentsByPost[post.id] ? (
                                <div className='mt-4 space-y-3'>
                                    {(commentsByPost[post.id] ?? []).length === 0 ? (
                                        <p className='text-xs text-slate-500'>No comments yet.</p>
                                    ) : (
                                        <div className='space-y-2'>
                                            {(commentsByPost[post.id] ?? []).map((comment) => (
                                                <div key={comment.id} className='rounded-xl bg-slate-50 px-3 py-2 text-xs'>
                                                    <p className='font-semibold text-slate-700'>Anonymous</p>
                                                    <p className='mt-1 text-slate-700'>{comment.content}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className='flex gap-2'>
                                        <input
                                            value={commentInputByPost[post.id] ?? ''}
                                            onChange={(event) =>
                                                setCommentInputByPost((prev) => ({
                                                    ...prev,
                                                    [post.id]: event.target.value,
                                                }))
                                            }
                                            placeholder='Write a comment'
                                            className='flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                                        />
                                        <button
                                            type='button'
                                            onClick={() => void submitComment(post.id)}
                                            disabled={busyPostId === post.id}
                                            className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                                        >
                                            Send
                                        </button>
                                    </div>
                                </div>
                            ) : null}
                        </article>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
