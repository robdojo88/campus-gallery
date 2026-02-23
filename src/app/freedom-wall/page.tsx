'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import {
    addFreedomPostComment,
    createFreedomPost,
    fetchFreedomPostComments,
    fetchFreedomPosts,
    subscribeToFreedomWall,
    toggleFreedomPostLike,
} from '@/lib/supabase';
import type { FreedomPost, FreedomWallComment } from '@/lib/types';

type CommentNode = FreedomWallComment & { replies: CommentNode[] };

function buildCommentTree(comments: FreedomWallComment[]): CommentNode[] {
    const byId = new Map<string, CommentNode>();
    for (const comment of comments) {
        byId.set(comment.id, { ...comment, replies: [] });
    }

    const roots: CommentNode[] = [];
    for (const comment of comments) {
        const node = byId.get(comment.id);
        if (!node) continue;
        if (comment.parentId && byId.has(comment.parentId)) {
            byId.get(comment.parentId)?.replies.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

function marginStyle(depth: number): CSSProperties {
    return { marginLeft: `${Math.min(depth, 6) * 12}px` };
}

export default function FreedomWallPage() {
    const [targetPostId, setTargetPostId] = useState('');
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [items, setItems] = useState<FreedomPost[]>([]);
    const [commentsByPost, setCommentsByPost] = useState<Record<string, FreedomWallComment[]>>({});
    const [commentInputByPost, setCommentInputByPost] = useState<Record<string, string>>({});
    const [replyTargetByPost, setReplyTargetByPost] = useState<Record<string, { id: string; authorName: string } | null>>(
        {},
    );
    const [openCommentsByPost, setOpenCommentsByPost] = useState<Record<string, boolean>>({});
    const [status, setStatus] = useState('Loading posts...');
    const [loading, setLoading] = useState(true);
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

    useEffect(() => {
        if (!imageFile) {
            setImagePreviewUrl('');
            return;
        }
        const nextUrl = URL.createObjectURL(imageFile);
        setImagePreviewUrl(nextUrl);
        return () => {
            URL.revokeObjectURL(nextUrl);
        };
    }, [imageFile]);

    async function loadPosts(options: { keepStatus?: boolean } = {}) {
        try {
            const data = await fetchFreedomPosts();
            setItems(data);
            if (!options.keepStatus) {
                setStatus(data.length === 0 ? 'No freedom wall posts yet.' : '');
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load freedom wall posts.';
            setStatus(message);
        } finally {
            setLoading(false);
        }
    }

    async function loadComments(postId: string) {
        try {
            const comments = await fetchFreedomPostComments(postId);
            setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load comments.';
            setStatus(message);
        }
    }

    useEffect(() => {
        let mounted = true;
        async function initialLoad() {
            await loadPosts();
            if (!mounted) return;
        }

        void initialLoad();
        const unsubscribe = subscribeToFreedomWall(() => {
            void loadPosts({ keepStatus: true });
            Object.entries(openCommentsRef.current).forEach(([postId, isOpen]) => {
                if (isOpen) void loadComments(postId);
            });
        });
        const pollingTimer = window.setInterval(() => {
            void loadPosts({ keepStatus: true });
            Object.entries(openCommentsRef.current).forEach(([postId, isOpen]) => {
                if (isOpen) void loadComments(postId);
            });
        }, 2500);

        return () => {
            mounted = false;
            window.clearInterval(pollingTimer);
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!targetPostId || focusedPostIdRef.current === targetPostId) return;
        const targetNode = document.querySelector<HTMLElement>(`[data-freedom-post-id="${targetPostId}"]`);
        if (!targetNode) return;
        targetNode.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
        focusedPostIdRef.current = targetPostId;
    }, [items, targetPostId]);

    async function submitPost() {
        if (posting) return;
        setPosting(true);
        setStatus('');
        try {
            await createFreedomPost({
                content,
                imageFile,
            });
            setContent('');
            setImageFile(null);
            await loadPosts();
            setStatus('Posted to Freedom Wall.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to post.';
            setStatus(message);
        } finally {
            setPosting(false);
        }
    }

    async function onToggleLike(postId: string) {
        if (busyPostId) return;
        setBusyPostId(postId);
        try {
            await toggleFreedomPostLike(postId);
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
        const contentValue = (commentInputByPost[postId] ?? '').trim();
        if (!contentValue || busyPostId) return;

        setBusyPostId(postId);
        try {
            await addFreedomPostComment({
                postId,
                content: contentValue,
                parentId: replyTargetByPost[postId]?.id ?? undefined,
            });
            setCommentInputByPost((prev) => ({ ...prev, [postId]: '' }));
            setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
            setOpenCommentsByPost((prev) => ({ ...prev, [postId]: true }));
            await Promise.all([loadPosts({ keepStatus: true }), loadComments(postId)]);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add comment.';
            setStatus(message);
        } finally {
            setBusyPostId('');
        }
    }

    function setReplyTarget(postId: string, comment: FreedomWallComment) {
        setReplyTargetByPost((prev) => ({
            ...prev,
            [postId]: { id: comment.id, authorName: comment.authorName },
        }));
    }

    function clearReplyTarget(postId: string) {
        setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
    }

    function renderComments(nodes: CommentNode[], postId: string, depth = 0): React.ReactNode {
        return nodes.map((node) => (
            <div key={node.id} className='space-y-2' style={marginStyle(depth)}>
                <article className='rounded-xl border border-slate-200 bg-slate-50 px-3 py-2'>
                    <div className='flex items-center justify-between gap-2'>
                        <p className='text-xs font-semibold text-slate-800'>{node.authorName}</p>
                        <p className='text-[11px] text-slate-500'>{new Date(node.createdAt).toLocaleString()}</p>
                    </div>
                    <p className='mt-1 text-sm text-slate-700'>{node.content}</p>
                    <button
                        type='button'
                        onClick={() => setReplyTarget(postId, node)}
                        className='mt-2 rounded-lg bg-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-300'
                    >
                        Reply
                    </button>
                </article>
                {node.replies.length > 0 ? <div className='space-y-2'>{renderComments(node.replies, postId, depth + 1)}</div> : null}
            </div>
        ));
    }

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Community'
                    title='Freedom Wall'
                    description='Post text or image updates, like posts, and join nested comment threads.'
                />

                <section className='mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <div className='space-y-3'>
                        <textarea
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            placeholder='Share something with campus (text optional if image is attached)'
                            disabled={posting}
                            className='min-h-24 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                        />
                        <div className='flex flex-wrap items-center gap-3'>
                            <label className='inline-flex cursor-pointer items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'>
                                <input
                                    type='file'
                                    accept='image/*'
                                    disabled={posting}
                                    onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                                    className='hidden'
                                />
                                Choose Image
                            </label>
                            {imageFile ? (
                                <button
                                    type='button'
                                    onClick={() => setImageFile(null)}
                                    disabled={posting}
                                    className='rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                                >
                                    Remove Image
                                </button>
                            ) : null}
                            {imageFile ? <p className='text-xs text-slate-500'>{imageFile.name}</p> : null}
                        </div>
                        {imagePreviewUrl ? (
                            <div className='relative max-w-sm overflow-hidden rounded-2xl border border-slate-200'>
                                <Image
                                    src={imagePreviewUrl}
                                    alt='Selected image preview'
                                    width={600}
                                    height={400}
                                    unoptimized
                                    className='h-auto w-full object-cover'
                                />
                            </div>
                        ) : null}
                        <button
                            type='button'
                            onClick={() => void submitPost()}
                            disabled={posting}
                            className='rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {posting ? 'Posting...' : 'Post'}
                        </button>
                    </div>
                </section>

                {status ? (
                    <p className='mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>{status}</p>
                ) : null}

                {!loading ? (
                    <section className='space-y-4'>
                        {items.map((post) => {
                            const comments = commentsByPost[post.id] ?? [];
                            const commentTree = buildCommentTree(comments);
                            const replyTarget = replyTargetByPost[post.id];
                            const commentInput = commentInputByPost[post.id] ?? '';
                            const commentsOpen = Boolean(openCommentsByPost[post.id]);
                            const busy = busyPostId === post.id;

                            return (
                                <article
                                    key={post.id}
                                    id={`freedom-post-${post.id}`}
                                    data-freedom-post-id={post.id}
                                    className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'
                                >
                                    <div className='flex items-start justify-between gap-3'>
                                        <div>
                                            <p className='text-sm font-semibold text-slate-800'>{post.authorName ?? 'Unknown'}</p>
                                            <p className='mt-1 text-xs text-slate-500'>{new Date(post.createdAt).toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {post.content ? <p className='mt-3 text-sm text-slate-700'>{post.content}</p> : null}
                                    {post.imageUrl ? (
                                        <div className='relative mt-3 overflow-hidden rounded-2xl border border-slate-200'>
                                            <Image
                                                src={post.imageUrl}
                                                alt='Freedom wall attachment'
                                                width={1200}
                                                height={900}
                                                className='h-auto w-full object-cover'
                                            />
                                        </div>
                                    ) : null}

                                    <div className='mt-4 flex flex-wrap items-center gap-2'>
                                        <button
                                            type='button'
                                            onClick={() => void onToggleLike(post.id)}
                                            disabled={busy}
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
                                            {commentsOpen ? 'Hide Comments' : 'Comments'} ({post.comments})
                                        </button>
                                    </div>

                                    {commentsOpen ? (
                                        <div className='mt-4 space-y-3'>
                                            {commentTree.length === 0 ? (
                                                <p className='text-xs text-slate-500'>No comments yet.</p>
                                            ) : (
                                                <div className='space-y-2'>{renderComments(commentTree, post.id)}</div>
                                            )}

                                            {replyTarget ? (
                                                <div className='flex items-center justify-between rounded-xl bg-cyan-50 px-3 py-2 text-xs text-cyan-800'>
                                                    <span>Replying to {replyTarget.authorName}</span>
                                                    <button
                                                        type='button'
                                                        onClick={() => clearReplyTarget(post.id)}
                                                        className='rounded-lg bg-cyan-100 px-2 py-1 font-semibold hover:bg-cyan-200'
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : null}

                                            <div className='flex gap-2'>
                                                <input
                                                    value={commentInput}
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
                                                    disabled={busy}
                                                    className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                                                >
                                                    Send
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </article>
                            );
                        })}
                    </section>
                ) : null}
            </AppShell>
        </AuthGuard>
    );
}
