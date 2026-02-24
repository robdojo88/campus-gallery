'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import {
    adminDeleteContentTarget,
    fetchIncognitoPostComments,
    fetchIncognitoPosts,
} from '@/lib/supabase';
import type { PostComment } from '@/lib/types';

type IncognitoPostRow = {
    id: string;
    content: string;
    createdAt: string;
    authorAlias: string;
    authorId?: string;
    likes: number;
    comments: number;
    likedByCurrentUser: boolean;
};

export default function AdminIncognitoPage() {
    const [posts, setPosts] = useState<IncognitoPostRow[]>([]);
    const [commentsByPost, setCommentsByPost] = useState<
        Record<string, PostComment[]>
    >({});
    const [openCommentsByPost, setOpenCommentsByPost] = useState<
        Record<string, boolean>
    >({});
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading incognito posts...');
    const [busyId, setBusyId] = useState('');

    async function loadPosts() {
        setLoading(true);
        try {
            const data = await fetchIncognitoPosts();
            setPosts(data);
            setCommentsByPost({});
            setOpenCommentsByPost({});
            setStatus('');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load incognito posts.';
            setStatus(message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        void loadPosts();
    }, []);

    async function toggleComments(postId: string) {
        const next = !openCommentsByPost[postId];
        setOpenCommentsByPost((prev) => ({ ...prev, [postId]: next }));
        if (!next) return;
        if (commentsByPost[postId]) return;
        try {
            const comments = await fetchIncognitoPostComments(postId);
            setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load comments.';
            setStatus(message);
        }
    }

    async function onDeleteTarget(
        targetType: 'incognito_post' | 'incognito_comment',
        targetId: string,
    ) {
        setBusyId(targetId);
        try {
            await adminDeleteContentTarget({
                targetType,
                targetId,
            });
            await loadPosts();
            setStatus('Content deleted.');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Delete failed.';
            setStatus(message);
        } finally {
            setBusyId('');
        }
    }

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <PageHeader
                    eyebrow='Admin'
                    title='Incognito Moderation'
                    description='Delete anonymous posts and comments while keeping internal author mapping visible to admin.'
                />
                {status ? (
                    <p className='mb-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>
                        {status}
                    </p>
                ) : null}
                <section className='space-y-4'>
                    {loading ? (
                        <p className='text-sm text-slate-500'>Loading...</p>
                    ) : posts.length === 0 ? (
                        <p className='text-sm text-slate-500'>
                            No anonymous posts available.
                        </p>
                    ) : (
                        posts.map((post) => (
                            <article
                                key={post.id}
                                className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'
                            >
                                <div className='flex flex-wrap items-start justify-between gap-3'>
                                    <div>
                                        <p className='text-sm font-semibold text-slate-800'>
                                            Public alias: {post.authorAlias}
                                        </p>
                                        <p className='text-xs text-slate-500'>
                                            Internal author id:{' '}
                                            {post.authorId ?? 'Hidden'}
                                        </p>
                                        <p className='mt-1 text-xs text-slate-500'>
                                            {new Date(
                                                post.createdAt,
                                            ).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className='flex items-center gap-2'>
                                        <button
                                            type='button'
                                            onClick={() =>
                                                void toggleComments(post.id)
                                            }
                                            className='rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100'
                                        >
                                            {openCommentsByPost[post.id]
                                                ? 'Hide comments'
                                                : 'Show comments'}
                                        </button>
                                        <button
                                            type='button'
                                            onClick={() =>
                                                void onDeleteTarget(
                                                    'incognito_post',
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

                                <p className='mt-2 text-sm text-slate-700'>
                                    {post.content}
                                </p>

                                {openCommentsByPost[post.id] ? (
                                    <div className='mt-3 space-y-2 border-t border-slate-200 pt-3'>
                                        {(commentsByPost[post.id] ?? [])
                                            .length === 0 ? (
                                            <p className='text-xs text-slate-500'>
                                                No comments.
                                            </p>
                                        ) : (
                                            commentsByPost[post.id]?.map(
                                                (comment) => (
                                                    <div
                                                        key={comment.id}
                                                        className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2'
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
                                                                        'incognito_comment',
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
                                                ),
                                            )
                                        )}
                                    </div>
                                ) : null}
                            </article>
                        ))
                    )}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
