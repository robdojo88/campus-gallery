'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, CardBody, Chip, Input } from '@heroui/react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusPopper } from '@/components/ui/status-popper';
import { formatCommentTime } from '@/lib/comment-time';
import {
    adminDeleteContentTarget,
    addIncognitoPostComment,
    createContentReport,
    createIncognitoPost,
    fetchIncognitoPostComments,
    fetchIncognitoPosts,
    getCurrentUserProfile,
    setCurrentUserIncognitoAlias,
    subscribeToIncognito,
    toggleIncognitoCommentLike,
    toggleIncognitoPostLike,
} from '@/lib/supabase';
import type { PostComment } from '@/lib/types';

type CommentSortOrder = 'recent' | 'oldest';
type DeleteTarget =
    | { kind: 'post'; postId: string }
    | { kind: 'comment'; postId: string; commentId: string };

const COMMENTS_INITIAL_VISIBLE = 10;
const COMMENTS_PAGE_SIZE = 5;

function HeartIcon({
    filled = false,
    className = 'h-4 w-4',
}: {
    filled?: boolean;
    className?: string;
}) {
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

function safeTimeValue(timestamp: string): number {
    const value = new Date(timestamp).getTime();
    return Number.isNaN(value) ? 0 : value;
}

function sortComments(
    comments: PostComment[],
    sortOrder: CommentSortOrder,
): PostComment[] {
    const roots = comments.filter((comment) => !comment.parentId);
    const nestedReplies = comments.filter((comment) =>
        Boolean(comment.parentId),
    );

    const sortedRoots = [...roots].sort((a, b) => {
        const delta = safeTimeValue(a.createdAt) - safeTimeValue(b.createdAt);
        return sortOrder === 'oldest' ? delta : -delta;
    });

    const sortedNestedReplies = [...nestedReplies].sort((a, b) => {
        const delta = safeTimeValue(a.createdAt) - safeTimeValue(b.createdAt);
        if (delta !== 0) return delta;
        return a.id.localeCompare(b.id);
    });

    return [...sortedRoots, ...sortedNestedReplies];
}

export default function IncognitoPage() {
    const [targetPostId, setTargetPostId] = useState('');
    const [targetCommentId, setTargetCommentId] = useState('');
    const [content, setContent] = useState('');
    const [items, setItems] = useState<
        Array<{
            id: string;
            content: string;
            createdAt: string;
            authorAlias: string;
            authorId?: string;
            likes: number;
            comments: number;
            likedByCurrentUser: boolean;
        }>
    >([]);
    const [commentsByPost, setCommentsByPost] = useState<
        Record<string, PostComment[]>
    >({});
    const [visibleCommentsByPost, setVisibleCommentsByPost] = useState<
        Record<string, number>
    >({});
    const [autoLoadCommentsByPost, setAutoLoadCommentsByPost] = useState<
        Record<string, boolean>
    >({});
    const [commentSortByPost, setCommentSortByPost] = useState<
        Record<string, CommentSortOrder>
    >({});
    const [commentInputByPost, setCommentInputByPost] = useState<
        Record<string, string>
    >({});
    const [openCommentsByPost, setOpenCommentsByPost] = useState<
        Record<string, boolean>
    >({});
    const [ignoreTargetCommentAutoOpen, setIgnoreTargetCommentAutoOpen] =
        useState(false);
    const [status, setStatus] = useState('Loading anonymous posts...');
    const [reportPopper, setReportPopper] = useState<{
        message: string;
        tone: 'success' | 'error';
    } | null>(null);
    const [posting, setPosting] = useState(false);
    const [busyPostId, setBusyPostId] = useState('');
    const [busyCommentId, setBusyCommentId] = useState('');
    const [confirmDeleteTarget, setConfirmDeleteTarget] =
        useState<DeleteTarget | null>(null);
    const [viewerRole, setViewerRole] = useState<
        'admin' | 'member' | 'visitor' | null
    >(null);
    const [incognitoAlias, setIncognitoAlias] = useState('');
    const [aliasInput, setAliasInput] = useState('');
    const [aliasSaving, setAliasSaving] = useState(false);
    const [profileLoading, setProfileLoading] = useState(true);
    const openCommentsRef = useRef<Record<string, boolean>>({});
    const commentsAnchorByPostRef = useRef<
        Record<string, HTMLDivElement | null>
    >({});
    const focusedPostIdRef = useRef('');
    const focusedCommentIdRef = useRef('');
    const aliasRequired = viewerRole === 'member' && !incognitoAlias;
    const isAdmin = viewerRole === 'admin';
    const canReport = viewerRole === 'member';

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

    async function loadPosts(options: { keepStatus?: boolean } = {}) {
        try {
            const data = await fetchIncognitoPosts();
            setItems(data);
            if (!options.keepStatus) {
                setStatus(data.length === 0 ? 'No anonymous posts yet.' : '');
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load anonymous posts.';
            setStatus(message);
        }
    }

    async function loadViewerProfile() {
        setProfileLoading(true);
        try {
            const profile = await getCurrentUserProfile();
            setViewerRole(profile?.role ?? null);
            const alias = (profile?.incognitoAlias ?? '').trim();
            setIncognitoAlias(alias);
            setAliasInput(alias);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load your profile.';
            setStatus(message);
        } finally {
            setProfileLoading(false);
        }
    }

    async function loadComments(postId: string) {
        try {
            const rows = await fetchIncognitoPostComments(postId);
            setCommentsByPost((prev) => ({ ...prev, [postId]: rows }));
            setVisibleCommentsByPost((prev) => {
                const existing = prev[postId];
                if (typeof existing === 'number') {
                    return {
                        ...prev,
                        [postId]: Math.min(existing, rows.length),
                    };
                }
                return {
                    ...prev,
                    [postId]: Math.min(COMMENTS_INITIAL_VISIBLE, rows.length),
                };
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load comments.';
            setStatus(message);
        }
    }

    function revealMoreComments(postId: string) {
        setVisibleCommentsByPost((prev) => {
            const total = (commentsByPost[postId] ?? []).length;
            const current =
                prev[postId] ?? Math.min(COMMENTS_INITIAL_VISIBLE, total);
            return {
                ...prev,
                [postId]: Math.min(current + COMMENTS_PAGE_SIZE, total),
            };
        });
    }

    useEffect(() => {
        let mounted = true;
        async function init() {
            await Promise.all([loadViewerProfile(), loadPosts()]);
            if (!mounted) return;
        }

        void init();

        const unsubscribe = subscribeToIncognito(() => {
            void loadPosts({ keepStatus: true });
            Object.entries(openCommentsRef.current).forEach(
                ([postId, open]) => {
                    if (open) void loadComments(postId);
                },
            );
        });

        const pollingTimer = window.setInterval(() => {
            void loadPosts({ keepStatus: true });
            Object.entries(openCommentsRef.current).forEach(
                ([postId, open]) => {
                    if (open) void loadComments(postId);
                },
            );
        }, 3000);

        return () => {
            mounted = false;
            unsubscribe();
            window.clearInterval(pollingTimer);
        };
    }, []);

    useEffect(() => {
        if (!targetPostId || focusedPostIdRef.current === targetPostId) return;
        const targetNode = document.querySelector<HTMLElement>(
            `[data-incognito-post-id="${targetPostId}"]`,
        );
        if (!targetNode) return;
        targetNode.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
        focusedPostIdRef.current = targetPostId;
    }, [items, targetPostId]);

    useEffect(() => {
        setIgnoreTargetCommentAutoOpen(false);
        if (!targetCommentId) {
            focusedCommentIdRef.current = '';
            return;
        }
        if (focusedCommentIdRef.current !== targetCommentId) {
            focusedCommentIdRef.current = '';
        }
    }, [targetCommentId]);

    useEffect(() => {
        if (!targetPostId || !targetCommentId || ignoreTargetCommentAutoOpen)
            return;
        if (focusedCommentIdRef.current === targetCommentId) return;

        const commentsOpen = Boolean(openCommentsByPost[targetPostId]);
        if (!commentsOpen) {
            setOpenCommentsByPost((prev) => ({
                ...prev,
                [targetPostId]: true,
            }));
            void loadComments(targetPostId);
            return;
        }

        const targetNode = document.querySelector<HTMLElement>(
            `[data-incognito-comment-id="${targetCommentId}"]`,
        );
        if (targetNode) {
            targetNode.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
            focusedCommentIdRef.current = targetCommentId;
            return;
        }

        const loadedComments = commentsByPost[targetPostId] ?? [];
        const sortOrder = commentSortByPost[targetPostId] ?? 'recent';
        const sortedLoadedComments = sortComments(loadedComments, sortOrder);
        const targetIndex = sortedLoadedComments.findIndex(
            (comment) => comment.id === targetCommentId,
        );
        if (targetIndex >= 0) {
            const visibleCount =
                visibleCommentsByPost[targetPostId] ??
                Math.min(COMMENTS_INITIAL_VISIBLE, sortedLoadedComments.length);
            if (visibleCount <= targetIndex) {
                setVisibleCommentsByPost((prev) => ({
                    ...prev,
                    [targetPostId]: targetIndex + 1,
                }));
                return;
            }
        }

        if (targetPostId in commentsByPost) {
            focusedCommentIdRef.current = targetCommentId;
            return;
        }

        void loadComments(targetPostId);
    }, [
        commentsByPost,
        commentSortByPost,
        openCommentsByPost,
        targetCommentId,
        targetPostId,
        visibleCommentsByPost,
        ignoreTargetCommentAutoOpen,
    ]);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (!entry.isIntersecting) continue;
                    const postId = (entry.target as HTMLElement).dataset.postId;
                    if (!postId) continue;
                    revealMoreComments(postId);
                }
            },
            { rootMargin: '260px 0px 260px 0px' },
        );

        Object.entries(openCommentsByPost).forEach(([postId, isOpen]) => {
            if (!isOpen) return;
            if (!autoLoadCommentsByPost[postId]) return;
            const total = (commentsByPost[postId] ?? []).length;
            const visible =
                visibleCommentsByPost[postId] ??
                Math.min(COMMENTS_INITIAL_VISIBLE, total);
            if (visible >= total) return;
            const node = commentsAnchorByPostRef.current[postId];
            if (node) {
                observer.observe(node);
            }
        });

        return () => {
            observer.disconnect();
        };
    }, [
        autoLoadCommentsByPost,
        commentsByPost,
        openCommentsByPost,
        visibleCommentsByPost,
    ]);

    async function submit() {
        if (posting) return;
        if (aliasRequired) {
            setStatus('Set your incognito alias first before posting.');
            return;
        }
        setPosting(true);
        try {
            await createIncognitoPost(content);
            setContent('');
            await loadPosts();
            setStatus('Incognito post submitted.');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to post anonymously.';
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
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to update like.';
            setStatus(message);
        } finally {
            setBusyPostId('');
        }
    }

    async function toggleComments(postId: string) {
        const nextOpen = !openCommentsByPost[postId];
        setOpenCommentsByPost((prev) => ({ ...prev, [postId]: nextOpen }));
        if (!nextOpen) {
            setAutoLoadCommentsByPost((prev) => ({ ...prev, [postId]: false }));
            if (postId === targetPostId && targetCommentId) {
                setIgnoreTargetCommentAutoOpen(true);
            }
        }
        if (nextOpen) {
            setVisibleCommentsByPost((prev) => ({
                ...prev,
                [postId]: COMMENTS_INITIAL_VISIBLE,
            }));
            setAutoLoadCommentsByPost((prev) => ({ ...prev, [postId]: false }));
            await loadComments(postId);
        }
    }

    async function submitComment(postId: string) {
        const value = (commentInputByPost[postId] ?? '').trim();
        if (!value || busyPostId) return;
        if (aliasRequired) {
            setStatus('Set your incognito alias first before commenting.');
            return;
        }

        setBusyPostId(postId);
        try {
            await addIncognitoPostComment(postId, value);
            setCommentInputByPost((prev) => ({ ...prev, [postId]: '' }));
            setOpenCommentsByPost((prev) => ({ ...prev, [postId]: true }));
            await Promise.all([
                loadPosts({ keepStatus: true }),
                loadComments(postId),
            ]);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to add comment.';
            setStatus(message);
        } finally {
            setBusyPostId('');
        }
    }

    async function onToggleCommentLike(postId: string, commentId: string) {
        if (busyCommentId === commentId || busyPostId === postId) return;
        setBusyCommentId(commentId);
        try {
            await toggleIncognitoCommentLike(commentId);
            await loadComments(postId);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to update comment reaction.';
            setStatus(message);
        } finally {
            setBusyCommentId('');
        }
    }

    async function onReportPost(postId: string) {
        try {
            await createContentReport({
                targetType: 'incognito_post',
                targetId: postId,
                reason: 'Incognito post reported',
            });
            setReportPopper({
                message: 'Report submitted to admin.',
                tone: 'success',
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to submit report.';
            setReportPopper({ message, tone: 'error' });
        }
    }

    async function onReportComment(commentId: string) {
        try {
            await createContentReport({
                targetType: 'incognito_comment',
                targetId: commentId,
                reason: 'Incognito comment reported',
            });
            setReportPopper({
                message: 'Report submitted to admin.',
                tone: 'success',
            });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to submit report.';
            setReportPopper({ message, tone: 'error' });
        }
    }

    function onAdminDeletePost(postId: string) {
        if (!isAdmin) return;
        setConfirmDeleteTarget({ kind: 'post', postId });
    }

    function onAdminDeleteComment(postId: string, commentId: string) {
        if (!isAdmin) return;
        if (busyCommentId === commentId || busyPostId === postId) return;
        setConfirmDeleteTarget({ kind: 'comment', postId, commentId });
    }

    async function onConfirmDelete() {
        if (!confirmDeleteTarget || !isAdmin) return;

        if (confirmDeleteTarget.kind === 'post') {
            setBusyPostId(confirmDeleteTarget.postId);
            try {
                await adminDeleteContentTarget({
                    targetType: 'incognito_post',
                    targetId: confirmDeleteTarget.postId,
                });
                setCommentsByPost((prev) => {
                    if (!(confirmDeleteTarget.postId in prev)) return prev;
                    const next = { ...prev };
                    delete next[confirmDeleteTarget.postId];
                    return next;
                });
                await loadPosts({ keepStatus: true });
                setStatus('Incognito post deleted.');
                setConfirmDeleteTarget(null);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to delete post.';
                setStatus(message);
            } finally {
                setBusyPostId('');
            }
            return;
        }

        setBusyCommentId(confirmDeleteTarget.commentId);
        try {
            await adminDeleteContentTarget({
                targetType: 'incognito_comment',
                targetId: confirmDeleteTarget.commentId,
            });
            await Promise.all([
                loadPosts({ keepStatus: true }),
                loadComments(confirmDeleteTarget.postId),
            ]);
            setStatus('Comment deleted.');
            setConfirmDeleteTarget(null);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to delete comment.';
            setStatus(message);
        } finally {
            setBusyCommentId('');
        }
    }

    async function onSaveAlias() {
        if (!aliasInput.trim() || aliasSaving || !aliasRequired) return;
        setAliasSaving(true);
        try {
            const savedAlias = await setCurrentUserIncognitoAlias(aliasInput);
            setIncognitoAlias(savedAlias);
            setAliasInput(savedAlias);
            setStatus('Incognito alias saved. You can now post.');
            await loadPosts({ keepStatus: true });
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to save incognito alias.';
            setStatus(message);
        } finally {
            setAliasSaving(false);
        }
    }

    const confirmDeleteBusy = confirmDeleteTarget
        ? confirmDeleteTarget.kind === 'post'
            ? busyPostId === confirmDeleteTarget.postId
            : busyCommentId === confirmDeleteTarget.commentId
        : false;
    const confirmDeleteTitle =
        confirmDeleteTarget?.kind === 'post'
            ? 'Delete this incognito post?'
            : 'Delete this comment?';
    const confirmDeleteDescription =
        confirmDeleteTarget?.kind === 'post'
            ? 'This action permanently removes the post and all related comments.'
            : 'This action permanently removes this comment.';

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <div className='mx-auto w-full max-w-4xl'>
                    <PageHeader
                        eyebrow='Anonymous'
                        title='Incognito Page'
                        description='Members can post anonymously. Public view hides identity while admins can moderate safely.'
                    />
                    <Card className='mb-5 border border-slate-200 bg-white shadow-sm'>
                        <CardBody className='p-5'>
                            {aliasRequired ? (
                                <div className='mb-3 rounded-2xl border border-amber-200 bg-amber-50 p-3'>
                                    <p className='text-sm font-semibold text-amber-900'>
                                        Set your Incognito alias first
                                    </p>
                                    <p className='mt-1 text-xs text-amber-800'>
                                        This is required before posting. Once
                                        saved, it is locked and only
                                        admin/developer can change it.
                                    </p>
                                    <div className='mt-2 flex gap-2'>
                                        <Input
                                            value={aliasInput}
                                            onChange={(event) =>
                                                setAliasInput(
                                                    event.target.value,
                                                )
                                            }
                                            placeholder='Choose incognito alias'
                                            minLength={3}
                                            maxLength={24}
                                            pattern='[A-Za-z0-9._-]{3,24}'
                                            className='flex-1'
                                            classNames={{
                                                inputWrapper:
                                                    'border border-amber-200 bg-white',
                                                input: 'text-sm',
                                            }}
                                        />
                                        <Button
                                            onClick={() => void onSaveAlias()}
                                            isDisabled={
                                                aliasSaving || profileLoading
                                            }
                                            color='primary'
                                            className='text-xs font-semibold'
                                        >
                                            {aliasSaving
                                                ? 'Saving...'
                                                : 'Set Alias'}
                                        </Button>
                                    </div>
                                </div>
                            ) : viewerRole === 'member' && incognitoAlias ? (
                                <Chip
                                    size='sm'
                                    variant='flat'
                                    className='mb-3 bg-slate-100 text-xs text-slate-600'
                                >
                                    Posting as{' '}
                                    <span className='font-semibold text-slate-800'>
                                        {incognitoAlias}
                                    </span>
                                    . Alias is locked.
                                </Chip>
                            ) : null}
                            <div className='flex gap-2'>
                                <Input
                                    value={content}
                                    onChange={(event) =>
                                        setContent(event.target.value)
                                    }
                                    placeholder='Write an anonymous note'
                                    isDisabled={aliasRequired || profileLoading}
                                    className='flex-1'
                                    classNames={{
                                        inputWrapper:
                                            'border border-slate-300 bg-white transition-colors data-[hover=true]:border-cyan-300 group-data-[focus=true]:border-cyan-400',
                                        innerWrapper: 'h-auto items-start',
                                        input: 'h-auto min-h-[72px] resize-none overflow-hidden text-sm leading-6 \
       focus:outline-none focus:ring-0',
                                    }}
                                />
                                <Button
                                    onClick={() => void submit()}
                                    isDisabled={
                                        posting ||
                                        aliasRequired ||
                                        profileLoading
                                    }
                                    color='primary'
                                    className='text-sm font-semibold'
                                >
                                    {posting ? 'Posting...' : 'Post'}
                                </Button>
                            </div>
                        </CardBody>
                    </Card>
                    {status ? (
                        <Card className='mb-4 border border-slate-200 bg-white'>
                            <CardBody className='p-4 text-sm text-slate-600'>
                                {status}
                            </CardBody>
                        </Card>
                    ) : null}
                    <section className='space-y-4'>
                        {items.map((post) => (
                            <Card
                                key={post.id}
                                id={`incognito-post-${post.id}`}
                                data-incognito-post-id={post.id}
                                className='border border-slate-200 bg-white shadow-sm'
                            >
                                <CardBody className='p-5'>
                                    <div className='flex items-center justify-between gap-3'>
                                        <p className='text-sm font-semibold text-slate-800'>
                                            {post.authorAlias || 'Anonymous'}
                                        </p>
                                        <div className='flex items-center gap-2'>
                                            <p className='text-xs text-slate-500'>
                                                {formatIncognitoTimestamp(
                                                    post.createdAt,
                                                )}
                                            </p>
                                            {canReport ? (
                                                <Button
                                                    onClick={() =>
                                                        void onReportPost(
                                                            post.id,
                                                        )
                                                    }
                                                    isDisabled={
                                                        busyPostId === post.id
                                                    }
                                                    size='sm'
                                                    radius='full'
                                                    variant='flat'
                                                    color='warning'
                                                    className='text-[11px] font-semibold border border-gray-200 hover:bg-slate-100'
                                                >
                                                    Report
                                                </Button>
                                            ) : null}
                                            {isAdmin ? (
                                                <Button
                                                    onClick={() =>
                                                        void onAdminDeletePost(
                                                            post.id,
                                                        )
                                                    }
                                                    isDisabled={
                                                        busyPostId === post.id
                                                    }
                                                    size='sm'
                                                    radius='full'
                                                    variant='flat'
                                                    color='danger'
                                                    className='text-[11px] font-semibold border border-gray-200 hover:bg-slate-100'
                                                >
                                                    Delete
                                                </Button>
                                            ) : null}
                                        </div>
                                    </div>
                                    {post.authorId ? (
                                        <p className='text-xs text-slate-500'>
                                            Admin view: {post.authorId}
                                        </p>
                                    ) : null}
                                    <p className='mt-2 text-sm text-slate-700'>
                                        {post.content}
                                    </p>
                                    <div className='mt-3 space-y-3'>
                                        <div className='flex items-center justify-between border-b border-slate-200 pb-2 text-sm text-slate-600'>
                                            <div className='inline-flex items-center gap-1.5'>
                                                <HeartIcon
                                                    filled
                                                    className='h-4 w-4 text-rose-500'
                                                />
                                                <span>{post.likes}</span>
                                            </div>
                                            <div className='inline-flex items-center gap-1.5'>
                                                <CommentIcon className='h-4 w-4 text-slate-500' />
                                                <span>{post.comments}</span>
                                            </div>
                                        </div>
                                        <div className='grid grid-cols-2 gap-2'>
                                            <Button
                                                onClick={() =>
                                                    void onToggleLike(post.id)
                                                }
                                                isDisabled={
                                                    busyPostId === post.id
                                                }
                                                radius='lg'
                                                variant='flat'
                                                className={`inline-flex items-center justify-center gap-2 border text-sm font-semibold transition ${
                                                    post.likedByCurrentUser
                                                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <HeartIcon
                                                    filled={
                                                        post.likedByCurrentUser
                                                    }
                                                    className={`h-4 w-4 ${post.likedByCurrentUser ? 'text-rose-600' : 'text-slate-500'}`}
                                                />
                                                <span>Like</span>
                                            </Button>
                                            <Button
                                                onClick={() =>
                                                    void toggleComments(post.id)
                                                }
                                                radius='lg'
                                                variant='flat'
                                                className={`inline-flex items-center justify-center gap-2 border text-sm font-semibold transition ${
                                                    openCommentsByPost[post.id]
                                                        ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                <CommentIcon
                                                    className={`h-4 w-4 ${openCommentsByPost[post.id] ? 'text-cyan-700' : 'text-slate-500'}`}
                                                />
                                                <span>
                                                    {openCommentsByPost[post.id]
                                                        ? 'Hide'
                                                        : 'Comment'}
                                                </span>
                                            </Button>
                                        </div>
                                    </div>

                                    {openCommentsByPost[post.id] ? (
                                        <div className='mt-4 space-y-3'>
                                            {(() => {
                                                const comments =
                                                    commentsByPost[post.id] ??
                                                    [];
                                                const sortOrder =
                                                    commentSortByPost[
                                                        post.id
                                                    ] ?? 'recent';
                                                const sortedComments =
                                                    sortComments(
                                                        comments,
                                                        sortOrder,
                                                    );
                                                const visibleCount =
                                                    visibleCommentsByPost[
                                                        post.id
                                                    ] ??
                                                    Math.min(
                                                        COMMENTS_INITIAL_VISIBLE,
                                                        sortedComments.length,
                                                    );
                                                const visibleComments =
                                                    sortedComments.slice(
                                                        0,
                                                        visibleCount,
                                                    );
                                                const hasHiddenComments =
                                                    sortedComments.length >
                                                    visibleCount;
                                                const autoLoadComments =
                                                    Boolean(
                                                        autoLoadCommentsByPost[
                                                            post.id
                                                        ],
                                                    );

                                                return (
                                                    <>
                                                        <div className='flex flex-wrap items-center justify-end gap-2'>
                                                            <label className='inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600'>
                                                                <span>
                                                                    Sort
                                                                </span>
                                                                <select
                                                                    value={
                                                                        sortOrder
                                                                    }
                                                                    onChange={(
                                                                        event,
                                                                    ) =>
                                                                        setCommentSortByPost(
                                                                            (
                                                                                prev,
                                                                            ) => ({
                                                                                ...prev,
                                                                                [post.id]:
                                                                                    event
                                                                                        .target
                                                                                        .value as CommentSortOrder,
                                                                            }),
                                                                        )
                                                                    }
                                                                    className='rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-cyan-600'
                                                                >
                                                                    <option value='recent'>
                                                                        Recently
                                                                        added
                                                                    </option>
                                                                    <option value='oldest'>
                                                                        Oldest
                                                                        first
                                                                    </option>
                                                                </select>
                                                            </label>
                                                        </div>
                                                        {visibleComments.length ===
                                                        0 ? (
                                                            <p className='text-xs text-slate-500'>
                                                                No comments yet.
                                                            </p>
                                                        ) : (
                                                            <div className='space-y-2'>
                                                                {visibleComments.map(
                                                                    (
                                                                        comment,
                                                                    ) => (
                                                                        <div
                                                                            key={
                                                                                comment.id
                                                                            }
                                                                            data-incognito-comment-id={
                                                                                comment.id
                                                                            }
                                                                            className={`rounded-xl bg-slate-50 px-3 py-2 text-xs ${
                                                                                targetCommentId &&
                                                                                comment.id ===
                                                                                    targetCommentId
                                                                                    ? 'ring-2 ring-[#155DFC]/70 ring-offset-1'
                                                                                    : ''
                                                                            }`}
                                                                        >
                                                                            <div className='flex items-center justify-between gap-2'>
                                                                                <p className='font-semibold text-slate-700'>
                                                                                    {
                                                                                        comment.authorName
                                                                                    }
                                                                                </p>
                                                                                <p className='text-[11px] text-slate-500'>
                                                                                    {formatCommentTime(
                                                                                        comment.createdAt,
                                                                                    )}
                                                                                </p>
                                                                            </div>
                                                                            <p className='mt-1 text-slate-700'>
                                                                                {
                                                                                    comment.content
                                                                                }
                                                                            </p>
                                                                            <button
                                                                                type='button'
                                                                                onClick={() =>
                                                                                    void onToggleCommentLike(
                                                                                        post.id,
                                                                                        comment.id,
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    busyCommentId ===
                                                                                        comment.id ||
                                                                                    busyPostId ===
                                                                                        post.id
                                                                                }
                                                                                className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                                                                                    comment.likedByCurrentUser
                                                                                        ? 'border-rose-200 bg-rose-50 text-rose-600'
                                                                                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
                                                                                } disabled:cursor-not-allowed disabled:opacity-60`}
                                                                                aria-label='React to comment'
                                                                            >
                                                                                <HeartIcon
                                                                                    filled={
                                                                                        comment.likedByCurrentUser
                                                                                    }
                                                                                    className={`h-3.5 w-3.5 ${comment.likedByCurrentUser ? 'text-rose-600' : 'text-slate-500'}`}
                                                                                />
                                                                                <span>
                                                                                    {
                                                                                        comment.likes
                                                                                    }
                                                                                </span>
                                                                            </button>
                                                                            {canReport ? (
                                                                                <button
                                                                                    type='button'
                                                                                    onClick={() =>
                                                                                        void onReportComment(
                                                                                            comment.id,
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        busyCommentId ===
                                                                                            comment.id ||
                                                                                        busyPostId ===
                                                                                            post.id
                                                                                    }
                                                                                    className='mt-2 ml-2 inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100'
                                                                                >
                                                                                    Report
                                                                                </button>
                                                                            ) : null}
                                                                            {isAdmin ? (
                                                                                <button
                                                                                    type='button'
                                                                                    onClick={() =>
                                                                                        void onAdminDeleteComment(
                                                                                            post.id,
                                                                                            comment.id,
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        busyCommentId ===
                                                                                            comment.id ||
                                                                                        busyPostId ===
                                                                                            post.id
                                                                                    }
                                                                                    className='mt-2 ml-2 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                                                                >
                                                                                    Delete
                                                                                </button>
                                                                            ) : null}
                                                                        </div>
                                                                    ),
                                                                )}
                                                            </div>
                                                        )}
                                                        {hasHiddenComments &&
                                                        !autoLoadComments ? (
                                                            <button
                                                                type='button'
                                                                onClick={() => {
                                                                    setAutoLoadCommentsByPost(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            [post.id]: true,
                                                                        }),
                                                                    );
                                                                    revealMoreComments(
                                                                        post.id,
                                                                    );
                                                                }}
                                                                className='mx-auto block rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100'
                                                            >
                                                                Show more
                                                                comments
                                                            </button>
                                                        ) : null}
                                                        {hasHiddenComments ? (
                                                            <div
                                                                ref={(node) => {
                                                                    commentsAnchorByPostRef.current[
                                                                        post.id
                                                                    ] = node;
                                                                }}
                                                                data-post-id={
                                                                    post.id
                                                                }
                                                                className='h-2 w-full'
                                                                aria-hidden='true'
                                                            />
                                                        ) : null}
                                                    </>
                                                );
                                            })()}
                                            <div className='flex gap-2'>
                                                <input
                                                    value={
                                                        commentInputByPost[
                                                            post.id
                                                        ] ?? ''
                                                    }
                                                    onChange={(event) =>
                                                        setCommentInputByPost(
                                                            (prev) => ({
                                                                ...prev,
                                                                [post.id]:
                                                                    event.target
                                                                        .value,
                                                            }),
                                                        )
                                                    }
                                                    placeholder='Write a comment'
                                                    className='flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                                                />
                                                <button
                                                    type='button'
                                                    onClick={() =>
                                                        void submitComment(
                                                            post.id,
                                                        )
                                                    }
                                                    disabled={
                                                        busyPostId === post.id
                                                    }
                                                    className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                                                >
                                                    Send
                                                </button>
                                            </div>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    void toggleComments(post.id)
                                                }
                                                className='mx-auto block rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100'
                                            >
                                                Hide all comments
                                            </button>
                                        </div>
                                    ) : null}
                                </CardBody>
                            </Card>
                        ))}
                    </section>
                    <ConfirmDialog
                        open={Boolean(confirmDeleteTarget)}
                        title={confirmDeleteTitle}
                        description={confirmDeleteDescription}
                        confirmLabel='Delete'
                        busy={confirmDeleteBusy}
                        onCancel={() => {
                            if (confirmDeleteBusy) return;
                            setConfirmDeleteTarget(null);
                        }}
                        onConfirm={() => {
                            void onConfirmDelete();
                        }}
                    />
                    <StatusPopper
                        open={Boolean(reportPopper)}
                        message={reportPopper?.message ?? ''}
                        tone={reportPopper?.tone ?? 'info'}
                        onClose={() => setReportPopper(null)}
                    />
                </div>
            </AppShell>
        </AuthGuard>
    );
}
