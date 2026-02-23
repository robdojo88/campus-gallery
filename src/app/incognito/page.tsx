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

export default function IncognitoPage() {
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

    useEffect(() => {
        openCommentsRef.current = openCommentsByPost;
    }, [openCommentsByPost]);

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
                        <article key={post.id} className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                            <p className='text-sm font-semibold text-slate-800'>Anonymous</p>
                            {post.authorId ? <p className='text-xs text-slate-500'>Admin view: {post.authorId}</p> : null}
                            <p className='mt-2 text-sm text-slate-700'>{post.content}</p>
                            <p className='mt-3 text-xs text-slate-500'>{new Date(post.createdAt).toLocaleString()}</p>
                            <div className='mt-3 flex flex-wrap items-center gap-2'>
                                <button
                                    type='button'
                                    onClick={() => void onToggleLike(post.id)}
                                    disabled={busyPostId === post.id}
                                    className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                                        post.likedByCurrentUser ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700'
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                >
                                    {post.likedByCurrentUser ? 'Liked' : 'Like'} ({post.likes})
                                </button>
                                <button
                                    type='button'
                                    onClick={() => void toggleComments(post.id)}
                                    className='rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700'
                                >
                                    {openCommentsByPost[post.id] ? 'Hide Comments' : 'Comments'} ({post.comments})
                                </button>
                            </div>

                            {openCommentsByPost[post.id] ? (
                                <div className='mt-4 space-y-3'>
                                    {(commentsByPost[post.id] ?? []).length === 0 ? (
                                        <p className='text-xs text-slate-500'>No comments yet.</p>
                                    ) : (
                                        <div className='space-y-2'>
                                            {(commentsByPost[post.id] ?? []).map((comment) => (
                                                <div key={comment.id} className='rounded-xl bg-slate-50 px-3 py-2 text-xs'>
                                                    <p className='font-semibold text-slate-700'>{comment.authorName}</p>
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
