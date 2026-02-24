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
    toggleFreedomCommentLike,
    toggleFreedomPostLike,
} from '@/lib/supabase';
import type { FreedomPost, FreedomWallComment } from '@/lib/types';

type CommentNode = FreedomWallComment & { replies: CommentNode[] };
type ReplyTarget = { commentId: string; parentId: string; authorName: string };
const FREEDOM_COMMENT_MAX_DEPTH = 2;
const COMMENT_AVATAR_FALLBACK = '/avatar-default.svg';

function safeTimeValue(timestamp: string): number {
    const value = new Date(timestamp).getTime();
    return Number.isNaN(value) ? 0 : value;
}

function buildCommentTree(comments: FreedomWallComment[]): CommentNode[] {
    const sorted = [...comments].sort(
        (a, b) => safeTimeValue(a.createdAt) - safeTimeValue(b.createdAt),
    );
    const byId = new Map<string, CommentNode>();
    for (const comment of sorted) {
        byId.set(comment.id, { ...comment, replies: [] });
    }

    const roots: CommentNode[] = [];
    for (const comment of sorted) {
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
    return { marginLeft: `${Math.min(depth, FREEDOM_COMMENT_MAX_DEPTH) * 12}px` };
}

function HeartIcon({ filled = false, className = 'h-3.5 w-3.5' }: { filled?: boolean; className?: string }) {
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

export default function FreedomWallPage() {
    const [targetPostId, setTargetPostId] = useState('');
    const [targetCommentId, setTargetCommentId] = useState('');
    const [content, setContent] = useState('');
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreviewUrl, setImagePreviewUrl] = useState('');
    const [items, setItems] = useState<FreedomPost[]>([]);
    const [commentsByPost, setCommentsByPost] = useState<Record<string, FreedomWallComment[]>>({});
    const [commentInputByPost, setCommentInputByPost] = useState<Record<string, string>>({});
    const [replyTargetByPost, setReplyTargetByPost] = useState<Record<string, ReplyTarget | null>>(
        {},
    );
    const [openCommentsByPost, setOpenCommentsByPost] = useState<Record<string, boolean>>({});
    const [status, setStatus] = useState('Loading posts...');
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [busyPostId, setBusyPostId] = useState('');
    const [busyCommentId, setBusyCommentId] = useState('');
    const openCommentsRef = useRef<Record<string, boolean>>({});
    const focusedPostIdRef = useRef('');
    const focusedCommentIdRef = useRef('');

    useEffect(() => {
        openCommentsRef.current = openCommentsByPost;
    }, [openCommentsByPost]);

    useEffect(() => {
        const readTargetPost = () => {
            const params = new URLSearchParams(window.location.search);
            setTargetPostId((params.get('post') ?? '').trim());
            setTargetCommentId((params.get('comment') ?? '').trim());
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

    useEffect(() => {
        if (!targetCommentId) {
            focusedCommentIdRef.current = '';
            return;
        }
        if (focusedCommentIdRef.current !== targetCommentId) {
            focusedCommentIdRef.current = '';
        }
    }, [targetCommentId]);

    useEffect(() => {
        if (!targetPostId || !targetCommentId) return;
        if (focusedCommentIdRef.current === targetCommentId) return;

        const commentsOpen = Boolean(openCommentsByPost[targetPostId]);
        if (!commentsOpen) {
            setOpenCommentsByPost((prev) => ({ ...prev, [targetPostId]: true }));
            void loadComments(targetPostId);
            return;
        }

        const targetNode = document.querySelector<HTMLElement>(
            `[data-freedom-comment-id="${targetCommentId}"]`,
        );
        if (targetNode) {
            targetNode.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
            focusedCommentIdRef.current = targetCommentId;
            return;
        }

        if (targetPostId in commentsByPost) {
            focusedCommentIdRef.current = targetCommentId;
            return;
        }

        void loadComments(targetPostId);
    }, [commentsByPost, openCommentsByPost, targetCommentId, targetPostId]);

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
        if (!nextOpen) {
            setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
        }
        if (nextOpen) {
            await loadComments(postId);
        }
    }

    async function submitComment(postId: string) {
        const contentValue = (commentInputByPost[postId] ?? '').trim();
        if (!contentValue || busyPostId) return;

        setBusyPostId(postId);
        try {
            const replyTarget = replyTargetByPost[postId];
            const mentionPrefix = replyTarget ? `@${replyTarget.authorName} ` : '';
            let payload = contentValue;
            if (
                mentionPrefix &&
                !payload.toLowerCase().startsWith(mentionPrefix.trim().toLowerCase())
            ) {
                payload = `${mentionPrefix}${payload}`;
            }

            await addFreedomPostComment({
                postId,
                content: payload,
                parentId: replyTarget?.parentId ?? undefined,
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
        const mentionPrefix = `@${comment.authorName} `;
        setReplyTargetByPost((prev) => ({
            ...prev,
            [postId]: {
                commentId: comment.id,
                parentId: comment.id,
                authorName: comment.authorName,
            },
        }));
        setCommentInputByPost((prev) => {
            const existing = prev[postId] ?? '';
            const trimmedExisting = existing.trim();
            if (!trimmedExisting) {
                return { ...prev, [postId]: mentionPrefix };
            }
            if (trimmedExisting.toLowerCase().startsWith(mentionPrefix.trim().toLowerCase())) {
                return prev;
            }
            return { ...prev, [postId]: `${mentionPrefix}${existing}` };
        });
    }

    function clearReplyTarget(postId: string) {
        setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
    }

    async function onToggleCommentLike(postId: string, commentId: string) {
        if (busyCommentId === commentId || busyPostId === postId) return;
        setBusyCommentId(commentId);
        try {
            await toggleFreedomCommentLike(commentId);
            await loadComments(postId);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update comment reaction.';
            setStatus(message);
        } finally {
            setBusyCommentId('');
        }
    }

    function renderCommentContent(comment: FreedomWallComment, commentById: Map<string, FreedomWallComment>): React.ReactNode {
        if (!comment.parentId) return comment.content;
        const parent = commentById.get(comment.parentId);
        if (!parent) return comment.content;

        const mention = `@${parent.authorName}`;
        const mentionWithSpace = `${mention} `;
        if (comment.content.startsWith(mentionWithSpace)) {
            const rest = comment.content.slice(mentionWithSpace.length);
            return (
                <>
                    <span className='font-bold text-[#155DFC]'>{mention}</span>
                    {rest ? ` ${rest}` : ''}
                </>
            );
        }

        if (comment.content === mention) {
            return <span className='font-bold text-[#155DFC]'>{mention}</span>;
        }

        return comment.content;
    }

    function renderComments(
        nodes: CommentNode[],
        postId: string,
        commentById: Map<string, FreedomWallComment>,
        depth = 0,
    ): React.ReactNode {
        return nodes.map((node) => (
            <div
                key={node.id}
                data-freedom-comment-id={node.id}
                className={`space-y-2 rounded-xl ${
                    targetCommentId && node.id === targetCommentId
                        ? 'ring-2 ring-[#155DFC]/70 ring-offset-1'
                        : ''
                }`}
                style={marginStyle(depth)}
            >
                <article className='rounded-xl border border-slate-200 bg-white px-2 py-2'>
                    <div className='flex items-start gap-2'>
                        <span className='relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100'>
                            <Image
                                src={node.authorAvatarUrl ?? COMMENT_AVATAR_FALLBACK}
                                alt={`${node.authorName} avatar`}
                                fill
                                sizes='28px'
                                className='object-cover'
                            />
                        </span>
                        <div className='min-w-0 flex-1'>
                            <div className='rounded-2xl bg-slate-100 px-3 py-2'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='text-xs font-semibold text-slate-800'>{node.authorName}</p>
                                    <p className='text-[11px] text-slate-500'>{new Date(node.createdAt).toLocaleString()}</p>
                                </div>
                                <p className='mt-1 text-sm text-slate-700'>{renderCommentContent(node, commentById)}</p>
                            </div>
                            <div className='mt-2 flex items-center gap-2 pl-1'>
                                <button
                                    type='button'
                                    onClick={() => void onToggleCommentLike(postId, node.id)}
                                    disabled={busyCommentId === node.id || busyPostId === postId}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                                        node.likedByCurrentUser
                                            ? 'border-rose-200 bg-rose-50 text-rose-600'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                    aria-label='React to comment'
                                >
                                    <HeartIcon
                                        filled={node.likedByCurrentUser}
                                        className={`h-3.5 w-3.5 ${node.likedByCurrentUser ? 'text-rose-600' : 'text-slate-500'}`}
                                    />
                                    <span>{node.likes}</span>
                                </button>
                                {depth < FREEDOM_COMMENT_MAX_DEPTH ? (
                                    <button
                                        type='button'
                                        onClick={() => setReplyTarget(postId, node)}
                                        className='rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50'
                                    >
                                        Reply
                                    </button>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </article>
                {node.replies.length > 0 ? (
                    <div className='space-y-2 border-l border-slate-200 pl-3'>
                        {renderComments(
                            node.replies,
                            postId,
                            commentById,
                            Math.min(depth + 1, FREEDOM_COMMENT_MAX_DEPTH),
                        )}
                    </div>
                ) : null}
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
                            const commentById = new Map(comments.map((comment) => [comment.id, comment]));
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

                                    <div className='mt-4 space-y-3'>
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
                                                disabled={busy}
                                                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                                    post.likedByCurrentUser
                                                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                            >
                                                <HeartIcon
                                                    filled={post.likedByCurrentUser}
                                                    className={`h-4 w-4 ${post.likedByCurrentUser ? 'text-rose-600' : 'text-slate-500'}`}
                                                />
                                                <span>Like</span>
                                            </button>
                                            <button
                                                type='button'
                                                onClick={() => void toggleComments(post.id)}
                                                className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                                                    commentsOpen
                                                        ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <CommentIcon className={`h-4 w-4 ${commentsOpen ? 'text-cyan-700' : 'text-slate-500'}`} />
                                                <span>{commentsOpen ? 'Hide' : 'Comment'}</span>
                                            </button>
                                        </div>
                                    </div>

                                    {commentsOpen ? (
                                        <div className='mt-4 space-y-3'>
                                            {commentTree.length === 0 ? (
                                                <p className='text-xs text-slate-500'>No comments yet.</p>
                                            ) : (
                                                <div className='space-y-2'>{renderComments(commentTree, post.id, commentById)}</div>
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
                                                    placeholder={replyTarget ? `Reply to ${replyTarget.authorName}` : 'Write a comment'}
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
