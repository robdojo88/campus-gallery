'use client';

import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Button, Card, CardBody, Textarea } from '@heroui/react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusPopper } from '@/components/ui/status-popper';
import { formatCommentTime } from '@/lib/comment-time';
import {
    adminDeleteContentTarget,
    addFreedomPostComment,
    createContentReport,
    createFreedomPost,
    fetchFreedomPostComments,
    fetchFreedomPosts,
    getCurrentUserProfile,
    getSessionUser,
    subscribeToFreedomWall,
    toggleFreedomCommentLike,
    toggleFreedomPostLike,
} from '@/lib/supabase';
import type { FreedomPost, FreedomWallComment } from '@/lib/types';

type CommentNode = FreedomWallComment & { replies: CommentNode[] };
type ReplyTarget = { commentId: string; parentId: string; authorName: string };
type CommentSortOrder = 'recent' | 'oldest';
type DeleteTarget =
    | { kind: 'post'; postId: string }
    | { kind: 'comment'; postId: string; commentId: string };
const FREEDOM_COMMENT_INDENT_CAP = 1;
const COMMENT_AVATAR_FALLBACK = '/avatar-default.svg';
const COMMENTS_INITIAL_VISIBLE = 10;
const COMMENTS_PAGE_SIZE = 5;
const FREEDOM_POST_IMAGE_LIMIT = 4;

function safeTimeValue(timestamp: string): number {
    const value = new Date(timestamp).getTime();
    return Number.isNaN(value) ? 0 : value;
}

function sortComments(
    comments: FreedomWallComment[],
    sortOrder: CommentSortOrder,
): FreedomWallComment[] {
    return [...comments].sort((a, b) => {
        const delta = safeTimeValue(a.createdAt) - safeTimeValue(b.createdAt);
        return sortOrder === 'oldest' ? delta : -delta;
    });
}

function buildCommentTree(
    comments: FreedomWallComment[],
    sortOrder: CommentSortOrder,
): CommentNode[] {
    const sorted = sortComments(comments, sortOrder);
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
    return {
        marginLeft: `${Math.min(depth, FREEDOM_COMMENT_INDENT_CAP) * 12}px`,
    };
}

function HeartIcon({
    filled = false,
    className = 'h-3.5 w-3.5',
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

function resolveFreedomPostImages(post: FreedomPost): string[] {
    if (post.images && post.images.length > 0) {
        return post.images.slice(0, FREEDOM_POST_IMAGE_LIMIT);
    }
    if (post.imageUrl) {
        return [post.imageUrl];
    }
    return [];
}

function FreedomPostImageGrid({
    images,
    onOpen,
}: {
    images: string[];
    onOpen: (index: number) => void;
}) {
    if (images.length === 1) {
        return (
            <div className='relative mt-3 overflow-hidden rounded-2xl border border-slate-200'>
                <button
                    type='button'
                    onClick={() => onOpen(0)}
                    className='block w-full'
                >
                    <Image
                        src={images[0]}
                        alt='Freedom wall attachment'
                        width={1200}
                        height={900}
                        className='h-auto w-full object-cover'
                    />
                </button>
            </div>
        );
    }

    if (images.length === 2) {
        return (
            <div className='mt-3 grid h-[310px] grid-cols-2 gap-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100'>
                {images.map((imageUrl, index) => (
                    <button
                        key={`${imageUrl}-${index}`}
                        type='button'
                        onClick={() => onOpen(index)}
                        className='relative'
                    >
                        <Image
                            src={imageUrl}
                            alt={`Freedom wall attachment ${index + 1}`}
                            fill
                            className='object-cover'
                        />
                    </button>
                ))}
            </div>
        );
    }

    if (images.length === 3) {
        return (
            <div className='mt-3 grid h-[350px] grid-cols-[2fr_1fr] grid-rows-2 gap-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100'>
                <button
                    type='button'
                    onClick={() => onOpen(0)}
                    className='relative row-span-2'
                >
                    <Image
                        src={images[0]}
                        alt='Freedom wall attachment 1'
                        fill
                        className='object-cover'
                    />
                </button>
                <button
                    type='button'
                    onClick={() => onOpen(1)}
                    className='relative'
                >
                    <Image
                        src={images[1]}
                        alt='Freedom wall attachment 2'
                        fill
                        className='object-cover'
                    />
                </button>
                <button
                    type='button'
                    onClick={() => onOpen(2)}
                    className='relative'
                >
                    <Image
                        src={images[2]}
                        alt='Freedom wall attachment 3'
                        fill
                        className='object-cover'
                    />
                </button>
            </div>
        );
    }

    return (
        <div className='mt-3 grid h-[350px] grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100'>
            {images
                .slice(0, FREEDOM_POST_IMAGE_LIMIT)
                .map((imageUrl, index) => (
                    <button
                        key={`${imageUrl}-${index}`}
                        type='button'
                        onClick={() => onOpen(index)}
                        className='relative'
                    >
                        <Image
                            src={imageUrl}
                            alt={`Freedom wall attachment ${index + 1}`}
                            fill
                            className='object-cover'
                        />
                    </button>
                ))}
        </div>
    );
}

export default function FreedomWallPage() {
    const [targetPostId, setTargetPostId] = useState('');
    const [targetCommentId, setTargetCommentId] = useState('');
    const [content, setContent] = useState('');
    const [imageFiles, setImageFiles] = useState<File[]>([]);
    const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
    const [items, setItems] = useState<FreedomPost[]>([]);
    const [commentsByPost, setCommentsByPost] = useState<
        Record<string, FreedomWallComment[]>
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
    const [replyTargetByPost, setReplyTargetByPost] = useState<
        Record<string, ReplyTarget | null>
    >({});
    const [openCommentsByPost, setOpenCommentsByPost] = useState<
        Record<string, boolean>
    >({});
    const [ignoreTargetCommentAutoOpen, setIgnoreTargetCommentAutoOpen] =
        useState(false);
    const [status, setStatus] = useState('Loading posts...');
    const [reportPopper, setReportPopper] = useState<{
        message: string;
        tone: 'success' | 'error';
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [busyPostId, setBusyPostId] = useState('');
    const [busyCommentId, setBusyCommentId] = useState('');
    const [confirmDeleteTarget, setConfirmDeleteTarget] =
        useState<DeleteTarget | null>(null);
    const [currentUserId, setCurrentUserId] = useState('');
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [lightboxState, setLightboxState] = useState<{
        postId: string;
        index: number;
    } | null>(null);
    const [lightboxLoadedSrc, setLightboxLoadedSrc] = useState('');
    const openCommentsRef = useRef<Record<string, boolean>>({});
    const commentsAnchorByPostRef = useRef<
        Record<string, HTMLDivElement | null>
    >({});
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const focusedPostIdRef = useRef('');
    const focusedCommentIdRef = useRef('');
    const activeLightboxPost = lightboxState
        ? items.find((item) => item.id === lightboxState.postId)
        : undefined;
    const activeLightboxImages = activeLightboxPost
        ? resolveFreedomPostImages(activeLightboxPost)
        : [];
    const activeLightboxIndex = lightboxState
        ? Math.min(
              Math.max(lightboxState.index, 0),
              Math.max(activeLightboxImages.length - 1, 0),
          )
        : 0;
    const activeLightboxImage = activeLightboxImages[activeLightboxIndex];
    const lightboxImageLoading =
        Boolean(activeLightboxImage) &&
        lightboxLoadedSrc !== activeLightboxImage;

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
        if (imageFiles.length === 0) {
            setImagePreviewUrls([]);
            return;
        }
        const nextUrls = imageFiles.map((file) => URL.createObjectURL(file));
        setImagePreviewUrls(nextUrls);
        return () => {
            nextUrls.forEach((url) => URL.revokeObjectURL(url));
        };
    }, [imageFiles]);

    useEffect(() => {
        if (!lightboxState || activeLightboxImages.length === 0) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setLightboxState(null);
                return;
            }
            if (activeLightboxImages.length <= 1) return;
            if (event.key === 'ArrowRight') {
                setLightboxState((current) => {
                    if (!current) return current;
                    return {
                        ...current,
                        index:
                            (current.index + 1) % activeLightboxImages.length,
                    };
                });
            }
            if (event.key === 'ArrowLeft') {
                setLightboxState((current) => {
                    if (!current) return current;
                    return {
                        ...current,
                        index:
                            (current.index - 1 + activeLightboxImages.length) %
                            activeLightboxImages.length,
                    };
                });
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeLightboxImages.length, lightboxState]);

    useEffect(() => {
        if (!lightboxState) {
            setLightboxLoadedSrc('');
        }
    }, [lightboxState]);

    function openPostImage(postId: string, index: number) {
        setLightboxState({ postId, index });
    }

    function closePostImage() {
        setLightboxState(null);
    }

    function showNextPostImage() {
        if (activeLightboxImages.length <= 1) return;
        setLightboxState((current) => {
            if (!current) return current;
            return {
                ...current,
                index: (current.index + 1) % activeLightboxImages.length,
            };
        });
    }

    function showPreviousPostImage() {
        if (activeLightboxImages.length <= 1) return;
        setLightboxState((current) => {
            if (!current) return current;
            return {
                ...current,
                index:
                    (current.index - 1 + activeLightboxImages.length) %
                    activeLightboxImages.length,
            };
        });
    }

    async function loadPosts(options: { keepStatus?: boolean } = {}) {
        try {
            const data = await fetchFreedomPosts();
            setItems(data);
            if (!options.keepStatus) {
                setStatus(
                    data.length === 0 ? 'No freedom wall posts yet.' : '',
                );
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load freedom wall posts.';
            setStatus(message);
        } finally {
            setLoading(false);
        }
    }

    async function loadComments(postId: string) {
        try {
            const comments = await fetchFreedomPostComments(postId);
            setCommentsByPost((prev) => ({ ...prev, [postId]: comments }));
            setVisibleCommentsByPost((prev) => {
                const defaultVisible = Math.min(
                    COMMENTS_INITIAL_VISIBLE,
                    comments.length,
                );
                const existing = prev[postId];
                if (typeof existing === 'number') {
                    const nextVisible =
                        existing > 0 ? existing : defaultVisible;
                    return {
                        ...prev,
                        [postId]: Math.min(nextVisible, comments.length),
                    };
                }
                return {
                    ...prev,
                    [postId]: defaultVisible,
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
        async function initialLoad() {
            await loadPosts();
            if (!mounted) return;
        }

        void Promise.all([
            getSessionUser(),
            getCurrentUserProfile().catch(() => null),
        ])
            .then(([user, profile]) => {
                if (!mounted) return;
                setCurrentUserId(user?.id ?? '');
                setIsAdmin(profile?.role === 'admin');
            })
            .catch(() => {
                if (!mounted) return;
                setCurrentUserId('');
                setIsAdmin(false);
            });

        void initialLoad();
        const unsubscribe = subscribeToFreedomWall(() => {
            void loadPosts({ keepStatus: true });
            Object.entries(openCommentsRef.current).forEach(
                ([postId, isOpen]) => {
                    if (isOpen) void loadComments(postId);
                },
            );
        });
        const pollingTimer = window.setInterval(() => {
            void loadPosts({ keepStatus: true });
            Object.entries(openCommentsRef.current).forEach(
                ([postId, isOpen]) => {
                    if (isOpen) void loadComments(postId);
                },
            );
        }, 2500);

        return () => {
            mounted = false;
            window.clearInterval(pollingTimer);
            unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (!targetPostId || focusedPostIdRef.current === targetPostId) return;
        const targetNode = document.querySelector<HTMLElement>(
            `[data-freedom-post-id="${targetPostId}"]`,
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
        openCommentsByPost,
        targetCommentId,
        targetPostId,
        commentSortByPost,
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

    async function submitPost() {
        if (posting) return;
        const cleanedContent = content.trim();
        if (!cleanedContent) {
            setStatus('Caption is required.');
            return;
        }

        setPosting(true);
        setStatus('');
        try {
            await createFreedomPost({
                content: cleanedContent,
                imageFiles,
            });
            setContent('');
            setImageFiles([]);
            if (imageInputRef.current) {
                imageInputRef.current.value = '';
            }
            await loadPosts();
            setStatus('Posted to Freedom Wall.');
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Failed to post.';
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
            setReplyTargetByPost((prev) => ({ ...prev, [postId]: null }));
            setAutoLoadCommentsByPost((prev) => ({ ...prev, [postId]: false }));
            if (postId === targetPostId && targetCommentId) {
                setIgnoreTargetCommentAutoOpen(true);
            }
        }
        if (nextOpen) {
            setAutoLoadCommentsByPost((prev) => ({ ...prev, [postId]: false }));
            await loadComments(postId);
        }
    }

    async function submitComment(postId: string) {
        const contentValue = (commentInputByPost[postId] ?? '').trim();
        if (!contentValue || busyPostId) return;

        setBusyPostId(postId);
        try {
            const replyTarget = replyTargetByPost[postId];
            if (replyTarget) {
                const targetComment = (commentsByPost[postId] ?? []).find(
                    (comment) => comment.id === replyTarget.commentId,
                );
                if (
                    currentUserId &&
                    targetComment &&
                    targetComment.userId === currentUserId
                ) {
                    throw new Error('You cannot reply to your own comment.');
                }
            }
            const mentionPrefix = replyTarget
                ? `@${replyTarget.authorName} `
                : '';
            let payload = contentValue;
            if (
                mentionPrefix &&
                !payload
                    .toLowerCase()
                    .startsWith(mentionPrefix.trim().toLowerCase())
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

    function setReplyTarget(postId: string, comment: FreedomWallComment) {
        if (currentUserId && comment.userId === currentUserId) {
            setStatus('You cannot reply to your own comment.');
            return;
        }

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
            if (
                trimmedExisting
                    .toLowerCase()
                    .startsWith(mentionPrefix.trim().toLowerCase())
            ) {
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
                targetType: 'freedom_post',
                targetId: postId,
                reason: 'Freedom Wall post reported',
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
                targetType: 'freedom_comment',
                targetId: commentId,
                reason: 'Freedom Wall comment reported',
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
                    targetType: 'freedom_post',
                    targetId: confirmDeleteTarget.postId,
                });
                setCommentsByPost((prev) => {
                    if (!(confirmDeleteTarget.postId in prev)) return prev;
                    const next = { ...prev };
                    delete next[confirmDeleteTarget.postId];
                    return next;
                });
                await loadPosts({ keepStatus: true });
                setStatus('Freedom Wall post deleted.');
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
                targetType: 'freedom_comment',
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

    function renderCommentContent(
        comment: FreedomWallComment,
        commentById: Map<string, FreedomWallComment>,
    ): React.ReactNode {
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

    function flattenReplyNodes(nodes: CommentNode[]): CommentNode[] {
        const flattened: CommentNode[] = [];
        const walk = (items: CommentNode[]) => {
            for (const item of items) {
                flattened.push(item);
                if (item.replies.length > 0) {
                    walk(item.replies);
                }
            }
        };
        walk(nodes);
        return flattened.sort((a, b) => {
            const delta =
                safeTimeValue(a.createdAt) - safeTimeValue(b.createdAt);
            if (delta !== 0) return delta;
            return a.id.localeCompare(b.id);
        });
    }

    function renderCommentNode(
        node: CommentNode,
        postId: string,
        commentById: Map<string, FreedomWallComment>,
        depth: number,
    ): React.ReactNode {
        const replyTarget = replyTargetByPost[postId];
        const commentInput = commentInputByPost[postId] ?? '';
        const isReplyTargetNode = Boolean(
            replyTarget && replyTarget.commentId === node.id,
        );
        return (
            <div
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
                                src={
                                    node.authorAvatarUrl ??
                                    COMMENT_AVATAR_FALLBACK
                                }
                                alt={`${node.authorName} avatar`}
                                fill
                                sizes='28px'
                                className='object-cover'
                            />
                        </span>
                        <div className='min-w-0 flex-1'>
                            <div className='rounded-2xl bg-slate-100 px-3 py-2'>
                                <div className='flex items-center justify-between gap-2'>
                                    <p className='text-xs font-semibold text-slate-800'>
                                        {node.authorName}
                                    </p>
                                    <p className='text-[11px] text-slate-500'>
                                        {formatCommentTime(node.createdAt)}
                                    </p>
                                </div>
                                <p className='mt-1 text-sm text-slate-700'>
                                    {renderCommentContent(node, commentById)}
                                </p>
                            </div>
                            <div className='mt-2 flex items-center gap-2 pl-1'>
                                <button
                                    type='button'
                                    onClick={() =>
                                        void onToggleCommentLike(
                                            postId,
                                            node.id,
                                        )
                                    }
                                    disabled={
                                        busyCommentId === node.id ||
                                        busyPostId === postId
                                    }
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
                                {!currentUserId ||
                                node.userId !== currentUserId ? (
                                    <button
                                        type='button'
                                        onClick={() =>
                                            setReplyTarget(postId, node)
                                        }
                                        className='rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50'
                                    >
                                        Reply
                                    </button>
                                ) : null}
                                {canReport ? (
                                    <button
                                        type='button'
                                        onClick={() =>
                                            void onReportComment(node.id)
                                        }
                                        disabled={
                                            busyCommentId === node.id ||
                                            busyPostId === postId
                                        }
                                        className='rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100'
                                    >
                                        Report
                                    </button>
                                ) : null}
                                {isAdmin ? (
                                    <button
                                        type='button'
                                        onClick={() =>
                                            void onAdminDeleteComment(
                                                postId,
                                                node.id,
                                            )
                                        }
                                        disabled={
                                            busyCommentId === node.id ||
                                            busyPostId === postId
                                        }
                                        className='rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                    >
                                        Delete
                                    </button>
                                ) : null}
                            </div>
                            {isReplyTargetNode ? (
                                <form
                                    className='mt-2 flex gap-2 pl-1'
                                    onSubmit={(event) => {
                                        event.preventDefault();
                                        void submitComment(postId);
                                    }}
                                >
                                    <input
                                        autoFocus
                                        value={commentInput}
                                        onChange={(event) =>
                                            setCommentInputByPost((prev) => ({
                                                ...prev,
                                                [postId]: event.target.value,
                                            }))
                                        }
                                        onKeyDown={(event) => {
                                            if (event.key !== 'Enter') return;
                                            if (event.nativeEvent.isComposing)
                                                return;
                                            event.preventDefault();
                                            void submitComment(postId);
                                        }}
                                        placeholder={`Reply to ${replyTarget?.authorName ?? node.authorName}`}
                                        className='flex-1 rounded-xl border border-cyan-300 bg-white px-3 py-2 text-xs outline-none focus:border-cyan-600'
                                    />
                                    <button
                                        type='submit'
                                        className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700'
                                    >
                                        Send
                                    </button>
                                    <button
                                        type='button'
                                        onClick={() => clearReplyTarget(postId)}
                                        className='rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50'
                                    >
                                        Cancel
                                    </button>
                                </form>
                            ) : null}
                        </div>
                    </div>
                </article>
            </div>
        );
    }

    function renderComments(
        nodes: CommentNode[],
        postId: string,
        commentById: Map<string, FreedomWallComment>,
        depth = 0,
    ): React.ReactNode {
        return nodes.map((node) => {
            const flattenedReplies = flattenReplyNodes(node.replies);
            const replyDepth = Math.min(depth + 1, FREEDOM_COMMENT_INDENT_CAP);

            return (
                <div key={node.id} className='space-y-2'>
                    {renderCommentNode(node, postId, commentById, depth)}
                    {flattenedReplies.length > 0 ? (
                        <div
                            className={`space-y-2 ${
                                depth < FREEDOM_COMMENT_INDENT_CAP
                                    ? 'border-l border-slate-200 pl-3'
                                    : ''
                            }`}
                        >
                            {flattenedReplies.map((replyNode) => (
                                <div key={replyNode.id}>
                                    {renderCommentNode(
                                        replyNode,
                                        postId,
                                        commentById,
                                        replyDepth,
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            );
        });
    }

    const confirmDeleteBusy = confirmDeleteTarget
        ? confirmDeleteTarget.kind === 'post'
            ? busyPostId === confirmDeleteTarget.postId
            : busyCommentId === confirmDeleteTarget.commentId
        : false;
    const confirmDeleteTitle =
        confirmDeleteTarget?.kind === 'post'
            ? 'Delete this Freedom Wall post?'
            : 'Delete this comment?';
    const confirmDeleteDescription =
        confirmDeleteTarget?.kind === 'post'
            ? 'This action permanently removes the post and all related comments.'
            : 'This action permanently removes this comment.';
    const canReport = isAdmin === false;
    const canSubmitPost = !posting && content.trim().length > 0;

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <div className='mx-auto w-full max-w-4xl'>
                    <PageHeader
                        eyebrow='Community'
                        title='Freedom Wall'
                        description='Sabihin mo ang gusto mong sabihin, walang judgement dito. Pero syempre, be respectful and responsible sa mga i-popost mo.'
                    />

                    <motion.div
                        layout
                        transition={{
                            layout: { duration: 0.22, ease: 'easeOut' },
                        }}
                    >
                        <Card className='mb-5 border border-slate-200 bg-white shadow-sm md:rounded-2xl'>
                            <CardBody className='space-y-4 p-5'>
                                <Textarea
                                    value={content}
                                    onChange={(event) =>
                                        setContent(event.target.value)
                                    }
                                    placeholder="Tol, post mo na 'yang iniisip mo..."
                                    isDisabled={posting}
                                    minRows={3}
                                    maxRows={12}
                                    className='w-full'
                                    classNames={{
                                        base: 'w-full',
                                        mainWrapper: 'w-full',
                                        inputWrapper:
                                            'h-auto min-h-[92px] items-start border border-slate-300 bg-white py-2 transition-colors data-[hover=true]:border-cyan-300 group-data-[focus=true]:border-cyan-400 rounded-xl',
                                        innerWrapper: 'h-auto items-start',
                                        input: 'h-auto min-h-[72px] resize-none overflow-hidden text-sm leading-6 \
       focus:outline-none focus:ring-0 ',
                                    }}
                                />
                                <div className='flex justify-between'>
                                    {' '}
                                    <div className='flex flex-wrap items-center gap-2'>
                                        <label className='inline-flex cursor-pointer items-center rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'>
                                            <input
                                                ref={imageInputRef}
                                                type='file'
                                                accept='image/*'
                                                multiple
                                                disabled={posting}
                                                onChange={(event) => {
                                                    const selectedFiles =
                                                        Array.from(
                                                            event.target
                                                                .files ?? [],
                                                        ).slice(
                                                            0,
                                                            FREEDOM_POST_IMAGE_LIMIT,
                                                        );
                                                    setImageFiles(
                                                        selectedFiles,
                                                    );
                                                    if (
                                                        (event.target.files
                                                            ?.length ?? 0) >
                                                        FREEDOM_POST_IMAGE_LIMIT
                                                    ) {
                                                        setStatus(
                                                            `You can upload up to ${FREEDOM_POST_IMAGE_LIMIT} images.`,
                                                        );
                                                    }
                                                }}
                                                className='hidden'
                                            />
                                            Baka trip mo lagyan ng picture?
                                        </label>
                                        <span className='text-xs pl-3'>
                                            Up to 4 images
                                        </span>

                                        {imageFiles.length > 0 ? (
                                            <Button
                                                onClick={() => {
                                                    setImageFiles([]);
                                                    if (imageInputRef.current) {
                                                        imageInputRef.current.value =
                                                            '';
                                                    }
                                                }}
                                                isDisabled={posting}
                                                variant='bordered'
                                                className='text-sm font-semibold text-slate-700 bg-[#0F172B] text-slate-50 rounded-xl hover:bg-[#282828]'
                                            >
                                                Remove Image
                                            </Button>
                                        ) : null}
                                        {/* 
                                        {imageFile ? (
                                            <Chip
                                                size='sm'
                                                variant='flat'
                                                className='max-w-full bg-slate-100 text-xs text-slate-500'
                                            >
                                                {imageFile.name}
                                            </Chip>
                                        ) : null} */}
                                    </div>
                                    <div className=''>
                                        <Button
                                            onClick={() => void submitPost()}
                                            isDisabled={!canSubmitPost}
                                            // color='primary'
                                            className='min-w-16 text-sm font-semibold bg-[#0F172B] text-slate-50 rounded-xl border border-gray-200 hover:bg-[#2c3243] cursor-pointer'
                                        >
                                            {posting ? 'Posting...' : "G' na!"}
                                        </Button>
                                    </div>
                                </div>
                                {imagePreviewUrls.length > 0 ? (
                                    <motion.div
                                        layout
                                        initial={{ opacity: 0, y: 4 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.18,
                                            ease: 'easeOut',
                                        }}
                                        className='grid max-w-md grid-cols-2 gap-2 sm:grid-cols-4'
                                    >
                                        {imagePreviewUrls.map(
                                            (previewUrl, index) => (
                                                <div
                                                    key={`${previewUrl}-${index}`}
                                                    className='relative aspect-square overflow-hidden rounded-2xl border border-slate-200'
                                                >
                                                    <Image
                                                        src={previewUrl}
                                                        alt={`Selected image preview ${index + 1}`}
                                                        fill
                                                        unoptimized
                                                        className='object-cover'
                                                    />
                                                </div>
                                            ),
                                        )}
                                    </motion.div>
                                ) : null}
                            </CardBody>
                        </Card>
                    </motion.div>

                    {/* {status ? (
                        <Card className='mb-4 border border-slate-200 bg-white'>
                            <CardBody className='p-4 text-sm text-slate-600'>
                                {status}
                            </CardBody>
                        </Card>
                    ) : null} */}

                    {!loading ? (
                        <section className='space-y-0 md:space-y-4'>
                            {items.map((post) => {
                                const comments = commentsByPost[post.id] ?? [];
                                const postImages =
                                    resolveFreedomPostImages(post);
                                const sortOrder =
                                    commentSortByPost[post.id] ?? 'recent';
                                const sortedComments = sortComments(
                                    comments,
                                    sortOrder,
                                );
                                const visibleCount =
                                    visibleCommentsByPost[post.id] ??
                                    Math.min(
                                        COMMENTS_INITIAL_VISIBLE,
                                        sortedComments.length,
                                    );
                                const visibleComments = sortedComments.slice(
                                    0,
                                    visibleCount,
                                );
                                const hasHiddenComments =
                                    sortedComments.length > visibleCount;
                                const commentTree = buildCommentTree(
                                    visibleComments,
                                    sortOrder,
                                );
                                const showExpandedCommentControls =
                                    sortedComments.length >
                                    COMMENTS_INITIAL_VISIBLE;
                                const commentById = new Map(
                                    visibleComments.map((comment) => [
                                        comment.id,
                                        comment,
                                    ]),
                                );
                                const replyTarget = replyTargetByPost[post.id];
                                const commentInput =
                                    commentInputByPost[post.id] ?? '';
                                const commentsOpen = Boolean(
                                    openCommentsByPost[post.id],
                                );
                                const autoLoadComments = Boolean(
                                    autoLoadCommentsByPost[post.id],
                                );
                                const busy = busyPostId === post.id;

                                return (
                                    <Card
                                        key={post.id}
                                        id={`freedom-post-${post.id}`}
                                        data-freedom-post-id={post.id}
                                        className='border-y border-slate-200 bg-white shadow-none rounded-none md:rounded-2xl md:border md:shadow-sm'
                                    >
                                        <CardBody className='p-5'>
                                            <div className='flex items-start justify-between gap-3'>
                                                <div className='flex items-center gap-3'>
                                                    <span className='relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100'>
                                                        <Image
                                                            src={
                                                                post.authorAvatarUrl ??
                                                                COMMENT_AVATAR_FALLBACK
                                                            }
                                                            alt={`${post.authorName ?? 'User'} avatar`}
                                                            fill
                                                            sizes='40px'
                                                            className='object-cover'
                                                        />
                                                    </span>
                                                    <div className='min-w-0'>
                                                        <p className='truncate text-sm font-semibold text-slate-800'>
                                                            {post.authorName ??
                                                                'Unknown'}
                                                        </p>
                                                        <p className='mt-1 text-xs text-slate-500'>
                                                            {formatCommentTime(
                                                                post.createdAt,
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className='flex items-center gap-2'>
                                                    {canReport ? (
                                                        <Button
                                                            onClick={() =>
                                                                void onReportPost(
                                                                    post.id,
                                                                )
                                                            }
                                                            isDisabled={busy}
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
                                                            isDisabled={busy}
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

                                            {post.content ? (
                                                <p className='mt-3 text-sm text-slate-700'>
                                                    {post.content}
                                                </p>
                                            ) : null}
                                            {postImages.length > 0 ? (
                                                <FreedomPostImageGrid
                                                    images={postImages}
                                                    onOpen={(index) =>
                                                        openPostImage(
                                                            post.id,
                                                            index,
                                                        )
                                                    }
                                                />
                                            ) : null}

                                            <div className='mt-4 space-y-3'>
                                                <div className='flex items-center justify-between border-b border-slate-200 pb-2 text-sm text-slate-600'>
                                                    <div className='inline-flex items-center gap-1.5'>
                                                        <HeartIcon
                                                            filled
                                                            className='h-4 w-4 text-rose-500'
                                                        />
                                                        <span>
                                                            {post.likes}
                                                        </span>
                                                    </div>
                                                    <div className='inline-flex items-center gap-1.5'>
                                                        <CommentIcon className='h-4 w-4 text-slate-500' />
                                                        <span>
                                                            {post.comments}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className='grid grid-cols-2 gap-2 '>
                                                    <Button
                                                        onClick={() =>
                                                            void onToggleLike(
                                                                post.id,
                                                            )
                                                        }
                                                        isDisabled={busy}
                                                        radius='lg'
                                                        variant='flat'
                                                        className={`rounded-xl inline-flex items-center justify-center gap-2 border text-sm font-semibold transition ${
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
                                                            void toggleComments(
                                                                post.id,
                                                            )
                                                        }
                                                        radius='lg'
                                                        variant='flat'
                                                        className={`rounded-xl inline-flex items-center justify-center gap-2 border text-sm font-semibold transition ${
                                                            commentsOpen
                                                                ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <CommentIcon
                                                            className={`h-4 w-4 ${commentsOpen ? 'text-cyan-700' : 'text-slate-500'}`}
                                                        />
                                                        <span>
                                                            {commentsOpen
                                                                ? 'Hide'
                                                                : 'Comment'}
                                                        </span>
                                                    </Button>
                                                </div>
                                            </div>

                                            {commentsOpen ? (
                                                <div className='mt-4 space-y-3'>
                                                    {showExpandedCommentControls ? (
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
                                                    ) : null}
                                                    {commentTree.length ===
                                                    0 ? (
                                                        <p className='text-xs text-slate-500'>
                                                            No comments yet.
                                                        </p>
                                                    ) : (
                                                        <div className='space-y-2'>
                                                            {renderComments(
                                                                commentTree,
                                                                post.id,
                                                                commentById,
                                                            )}
                                                        </div>
                                                    )}
                                                    {hasHiddenComments &&
                                                    !autoLoadComments ? (
                                                        <button
                                                            type='button'
                                                            onClick={() => {
                                                                setAutoLoadCommentsByPost(
                                                                    (prev) => ({
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
                                                            Show more comments
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

                                                    {!replyTarget ? (
                                                        <div className='flex gap-2'>
                                                            <input
                                                                value={
                                                                    commentInput
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    setCommentInputByPost(
                                                                        (
                                                                            prev,
                                                                        ) => ({
                                                                            ...prev,
                                                                            [post.id]:
                                                                                event
                                                                                    .target
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
                                                                disabled={busy}
                                                                className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                                                            >
                                                                Send
                                                            </button>
                                                        </div>
                                                    ) : null}
                                                    {showExpandedCommentControls ? (
                                                        <button
                                                            type='button'
                                                            onClick={() =>
                                                                void toggleComments(
                                                                    post.id,
                                                                )
                                                            }
                                                            className='mx-auto block rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100'
                                                        >
                                                            Hide all comments
                                                        </button>
                                                    ) : null}
                                                </div>
                                            ) : null}
                                        </CardBody>
                                    </Card>
                                );
                            })}
                        </section>
                    ) : null}
                    {lightboxState && activeLightboxImage ? (
                        <div
                            className='fixed inset-0 z-[100] bg-black/90 p-0 lg:p-6'
                            onClick={(event) => {
                                if (event.target === event.currentTarget) {
                                    closePostImage();
                                }
                            }}
                        >
                            <button
                                type='button'
                                onClick={closePostImage}
                                className='absolute right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30'
                            >
                                Close
                            </button>
                            {activeLightboxImages.length > 1 ? (
                                <>
                                    <button
                                        type='button'
                                        onClick={showPreviousPostImage}
                                        className='absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30'
                                    >
                                        {'<'}
                                    </button>
                                    <button
                                        type='button'
                                        onClick={showNextPostImage}
                                        className='absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30'
                                    >
                                        {'>'}
                                    </button>
                                </>
                            ) : null}
                            <div
                                className='relative flex h-full items-center justify-center'
                                onClick={closePostImage}
                            >
                                <AnimatePresence>
                                    {lightboxImageLoading ? (
                                        <motion.div
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            transition={{
                                                duration: 0.2,
                                                ease: 'easeOut',
                                            }}
                                            className='pointer-events-none absolute inset-0 z-10 grid place-items-center'
                                        >
                                            <motion.div
                                                initial={{
                                                    opacity: 0,
                                                    y: 8,
                                                    scale: 0.96,
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    y: 0,
                                                    scale: 1,
                                                }}
                                                exit={{
                                                    opacity: 0,
                                                    y: 6,
                                                    scale: 0.98,
                                                }}
                                                transition={{
                                                    duration: 0.22,
                                                    ease: 'easeOut',
                                                }}
                                                className='flex min-w-[200px] flex-col items-center gap-3 rounded-2xl border border-white/20 bg-black/35 px-5 py-4 backdrop-blur'
                                            >
                                                <motion.span
                                                    className='h-9 w-9 rounded-full border-2 border-transparent border-r-cyan-200 border-t-sky-200'
                                                    animate={{ rotate: 360 }}
                                                    transition={{
                                                        duration: 0.9,
                                                        ease: 'linear',
                                                        repeat: Number.POSITIVE_INFINITY,
                                                    }}
                                                />
                                                <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90'>
                                                    Loading image...
                                                </p>
                                            </motion.div>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                                <div
                                    className='max-h-full w-full max-w-full lg:w-auto'
                                    onClick={(event) => event.stopPropagation()}
                                >
                                    <Image
                                        src={activeLightboxImage}
                                        alt={`Freedom wall attachment ${activeLightboxIndex + 1}`}
                                        width={2200}
                                        height={1600}
                                        className='max-h-[84vh] w-screen max-w-screen object-contain rounded-none lg:w-auto lg:max-w-[94vw] lg:rounded-2xl'
                                        onLoad={() =>
                                            setLightboxLoadedSrc(
                                                activeLightboxImage,
                                            )
                                        }
                                        onError={() =>
                                            setLightboxLoadedSrc(
                                                activeLightboxImage,
                                            )
                                        }
                                    />
                                </div>
                            </div>
                            <div className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white'>
                                {activeLightboxIndex + 1} /{' '}
                                {activeLightboxImages.length}
                            </div>
                        </div>
                    ) : null}
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
