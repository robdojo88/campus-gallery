'use client';

import Image from 'next/image';
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type TouchEvent,
} from 'react';
import { Button, Card, CardBody, Chip } from '@heroui/react';
import { AnimatePresence, motion } from 'framer-motion';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { StatusPopper } from '@/components/ui/status-popper';
import {
    adminDeleteContentTarget,
    addPostComment,
    createContentReport,
    fetchPostEngagement,
    fetchPostCommentsPage,
    getSessionUser,
    subscribeToPostEngagement,
    togglePostCommentLike,
    togglePostLike,
} from '@/lib/supabase';
import { formatCommentTime } from '@/lib/comment-time';
import { parseTimestamp } from '@/lib/timestamp';
import type { Post, PostComment } from '@/lib/types';

const FALLBACK_AVATAR_URL = '/avatar-default.svg';
const COMMENTS_INITIAL_LIMIT = 10;
const COMMENTS_PAGE_SIZE = 5;
const FEED_COMMENT_INDENT_CAP = 1;

type ReplyTarget = {
    commentId: string;
    parentId: string;
    authorName: string;
};

type CommentSortOrder = 'recent' | 'oldest';
type DeleteTarget = { kind: 'post' } | { kind: 'comment'; commentId: string };

type CommentNode = PostComment & { replies: CommentNode[] };

function safeTimeValue(timestamp: string): number {
    const value = parseTimestamp(timestamp).getTime();
    return Number.isNaN(value) ? 0 : value;
}

function buildCommentTree(
    comments: PostComment[],
    sortOrder: CommentSortOrder,
): CommentNode[] {
    const sorted = [...comments].sort((a, b) => {
        const delta = safeTimeValue(a.createdAt) - safeTimeValue(b.createdAt);
        return sortOrder === 'oldest' ? delta : -delta;
    });
    const byId = new Map<string, CommentNode>();
    for (const comment of sorted) {
        byId.set(comment.id, { ...comment, replies: [] });
    }

    const roots: CommentNode[] = [];
    for (const comment of sorted) {
        const node = byId.get(comment.id);
        if (!node) continue;
        const parent = comment.parentId
            ? byId.get(comment.parentId)
            : undefined;
        if (parent) {
            parent.replies.push(node);
        } else {
            roots.push(node);
        }
    }
    return roots;
}

function formatFeedTimestamp(createdAt: string): string {
    const date = parseTimestamp(createdAt);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const minuteMs = 60 * 1000;
    const hourMs = 60 * 60 * 1000;
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
    if (days < 7) {
        return `${days}d`;
    }

    if (date.getFullYear() !== now.getFullYear()) {
        return date.toLocaleDateString(undefined, {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        });
    }

    const dateLabel = date.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
    });
    const timeLabel = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });
    return `${dateLabel} at ${timeLabel}`;
}

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

function PostImageGrid({
    images,
    onOpen,
}: {
    images: string[];
    onOpen: (index: number) => void;
}) {
    const total = images.length;
    const moreCount = Math.max(0, total - 4);

    if (total === 1) {
        return (
            <button
                type='button'
                onClick={() => onOpen(0)}
                className='relative block h-[58svh] w-full overflow-hidden md:h-[60vh]'
            >
                <Image
                    src={images[0]}
                    alt='Post image 1'
                    fill
                    className='object-cover'
                />
            </button>
        );
    }

    if (total === 2) {
        return (
            <div className='grid h-[58svh] grid-cols-2 gap-1 md:h-[60vh]'>
                {images.slice(0, 2).map((image, index) => (
                    <button
                        key={image}
                        type='button'
                        onClick={() => onOpen(index)}
                        className='relative overflow-hidden'
                    >
                        <Image
                            src={image}
                            alt={`Post image ${index + 1}`}
                            fill
                            className='object-cover'
                        />
                    </button>
                ))}
            </div>
        );
    }

    if (total === 3) {
        return (
            <div className='grid h-[58svh] grid-cols-[2fr_1fr] gap-1 md:h-[60vh]'>
                <button
                    type='button'
                    onClick={() => onOpen(0)}
                    className='relative row-span-2 overflow-hidden'
                >
                    <Image
                        src={images[0]}
                        alt='Post image 1'
                        fill
                        className='object-cover'
                    />
                </button>
                <button
                    type='button'
                    onClick={() => onOpen(1)}
                    className='relative overflow-hidden'
                >
                    <Image
                        src={images[1]}
                        alt='Post image 2'
                        fill
                        className='object-cover'
                    />
                </button>
                <button
                    type='button'
                    onClick={() => onOpen(2)}
                    className='relative overflow-hidden'
                >
                    <Image
                        src={images[2]}
                        alt='Post image 3'
                        fill
                        className='object-cover'
                    />
                </button>
            </div>
        );
    }

    return (
        <div className='grid h-[58svh] grid-cols-2 grid-rows-2 gap-1 md:h-[60vh] '>
            {images.slice(0, 4).map((image, index) => {
                const isLastVisible = index === 3;
                return (
                    <button
                        key={image}
                        type='button'
                        onClick={() => onOpen(index)}
                        className='relative overflow-hidden'
                    >
                        <Image
                            src={image}
                            alt={`Post image ${index + 1}`}
                            fill
                            className='object-cover'
                        />
                        {isLastVisible && moreCount > 0 ? (
                            <span className='absolute inset-0 grid place-items-center bg-black/55 text-2xl font-bold text-white'>
                                +{moreCount} more
                            </span>
                        ) : null}
                    </button>
                );
            })}
        </div>
    );
}

function Lightbox({
    images,
    index,
    onClose,
    onPrev,
    onNext,
    canPrev,
    canNext,
}: {
    images: string[];
    index: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
    canPrev: boolean;
    canNext: boolean;
}) {
    const [zoom, setZoom] = useState(1);
    const [loadedSrc, setLoadedSrc] = useState('');
    const touchStartX = useRef<number | null>(null);
    const currentSrc = images[index] ?? '';
    const imageLoading = loadedSrc !== currentSrc;

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowLeft' && canPrev) onPrev();
            if (event.key === 'ArrowRight' && canNext) onNext();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [canNext, canPrev, onClose, onNext, onPrev]);

    function onTouchStart(event: TouchEvent<HTMLDivElement>) {
        touchStartX.current = event.touches[0]?.clientX ?? null;
    }

    function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
        if (touchStartX.current === null) return;
        const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
        const delta = endX - touchStartX.current;
        if (delta > 40 && canPrev) onPrev();
        if (delta < -40 && canNext) onNext();
        touchStartX.current = null;
    }

    return (
        <div
            className='fixed inset-0 z-[100] bg-black/90 p-0 lg:p-8'
            onClick={(event) => {
                if (event.target === event.currentTarget) onClose();
            }}
        >
            <button
                type='button'
                onClick={onClose}
                className='absolute right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30'
            >
                Close
            </button>
            <div className='absolute left-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 flex items-center gap-2'>
                <button
                    type='button'
                    onClick={() =>
                        setZoom((value) => Math.max(1, value - 0.25))
                    }
                    className='rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30'
                >
                    -
                </button>
                <button
                    type='button'
                    onClick={() =>
                        setZoom((value) => Math.min(3, value + 0.25))
                    }
                    className='rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30'
                >
                    +
                </button>
                <span className='text-xs font-semibold text-white'>
                    {Math.round(zoom * 100)}%
                </span>
            </div>
            {canPrev ? (
                <button
                    type='button'
                    onClick={onPrev}
                    className='absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30'
                >
                    {'<'}
                </button>
            ) : null}
            {canNext ? (
                <button
                    type='button'
                    onClick={onNext}
                    className='absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30'
                >
                    {'>'}
                </button>
            ) : null}
            <div
                className='flex h-full items-center justify-center'
                onClick={onClose}
                onTouchStart={onTouchStart}
                onTouchEnd={onTouchEnd}
            >
                <div
                    className='relative max-h-full max-w-full'
                    onClick={(event) => event.stopPropagation()}
                >
                    <AnimatePresence>
                        {imageLoading ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.22, ease: 'easeOut' }}
                                className='absolute inset-0 z-20 grid place-items-center bg-black/40 backdrop-blur-sm'
                            >
                                <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.96 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 8, scale: 0.98 }}
                                    transition={{
                                        duration: 0.26,
                                        ease: 'easeOut',
                                    }}
                                    className='flex min-w-[220px] flex-col items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 shadow-[0_20px_45px_-25px_rgba(0,0,0,0.85)]'
                                >
                                    <div className='relative h-10 w-10'>
                                        <motion.span
                                            className='absolute inset-0 rounded-full border border-cyan-200/35'
                                            animate={{
                                                scale: [1, 1.25],
                                                opacity: [0.8, 0],
                                            }}
                                            transition={{
                                                duration: 1.1,
                                                ease: 'easeOut',
                                                repeat: Number.POSITIVE_INFINITY,
                                            }}
                                        />
                                        <motion.span
                                            className='absolute inset-0 rounded-full border-2 border-transparent border-r-sky-200 border-t-cyan-200'
                                            animate={{ rotate: 360 }}
                                            transition={{
                                                duration: 0.9,
                                                ease: 'linear',
                                                repeat: Number.POSITIVE_INFINITY,
                                            }}
                                        />
                                    </div>
                                    <div className='h-1.5 w-28 overflow-hidden '>
                                        <motion.span
                                            className='block h-full w-12 rounded-full bg-linear-to-r from-cyan-200 via-sky-200 to-indigo-200'
                                            animate={{ x: [-52, 116] }}
                                            transition={{
                                                duration: 1.05,
                                                ease: 'easeInOut',
                                                repeat: Number.POSITIVE_INFINITY,
                                            }}
                                        />
                                    </div>
                                    <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-white/90'>
                                        Loading
                                    </p>
                                </motion.div>
                            </motion.div>
                        ) : null}
                    </AnimatePresence>
                    <Image
                        src={currentSrc}
                        alt={`Preview ${index + 1}`}
                        width={2200}
                        height={1600}
                        className='max-h-[90vh] w-screen max-w-screen object-contain transition-transform duration-200 rounded-none lg:w-auto lg:max-w-[94vw] lg:rounded-2xl'
                        style={{ transform: `scale(${zoom})` }}
                        onLoad={() => setLoadedSrc(currentSrc)}
                        onError={() => setLoadedSrc(currentSrc)}
                    />
                </div>
            </div>
        </div>
    );
}

export function PostCard({
    post,
    targetCommentId = '',
    onPostDeleted,
    isAdminViewer = null,
    allowCommenting = true,
    showEngagement = true,
}: {
    post: Post;
    targetCommentId?: string;
    onPostDeleted?: (postId: string) => void | Promise<void>;
    isAdminViewer?: boolean | null;
    allowCommenting?: boolean;
    showEngagement?: boolean;
}) {
    const author = post.author;
    const avatarUrl = author?.avatarUrl ?? FALLBACK_AVATAR_URL;
    const [, setTimeTick] = useState(0);
    const postedAt = formatFeedTimestamp(post.createdAt);
    const postMeta = post.eventName
        ? `${postedAt} - ${post.eventName}`
        : postedAt;
    const [liked, setLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(post.likes);
    const [commentsCount, setCommentsCount] = useState(post.comments);
    const [showComments, setShowComments] = useState(false);
    const [ignoreTargetCommentAutoOpen, setIgnoreTargetCommentAutoOpen] =
        useState(false);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [commentInput, setCommentInput] = useState('');
    const [status, setStatus] = useState('');
    const [canInteract, setCanInteract] = useState(false);
    const [currentUserId, setCurrentUserId] = useState('');
    const [busyDeleteId, setBusyDeleteId] = useState('');
    const [confirmDeleteTarget, setConfirmDeleteTarget] =
        useState<DeleteTarget | null>(null);
    const [reportPopper, setReportPopper] = useState<{
        message: string;
        tone: 'success' | 'error';
    } | null>(null);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
    const [commentsAutoLoad, setCommentsAutoLoad] = useState(false);
    const [commentSortOrder, setCommentSortOrder] =
        useState<CommentSortOrder>('recent');
    const [busyCommentId, setBusyCommentId] = useState('');
    const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
    const [commentsCursor, setCommentsCursor] = useState<string | undefined>(
        undefined,
    );
    const [commentsHasMore, setCommentsHasMore] = useState(false);
    const commentsContainerRef = useRef<HTMLDivElement | null>(null);
    const commentsAnchorRef = useRef<HTMLDivElement | null>(null);
    const loadedCommentsCountRef = useRef(0);
    const commentInputRef = useRef<HTMLInputElement | null>(null);
    const focusedCommentIdRef = useRef('');

    const images = useMemo(
        () => (post.images.length > 0 ? post.images : [post.imageUrl]),
        [post.imageUrl, post.images],
    );

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setTimeTick((current) => current + 1);
        }, 60_000);
        return () => {
            window.clearInterval(intervalId);
        };
    }, []);

    const refreshEngagement = useCallback(async () => {
        const engagement = await fetchPostEngagement(post.id);
        setLikesCount(engagement.likesCount);
        setCommentsCount(engagement.commentsCount);
        setLiked(engagement.likedByCurrentUser);
    }, [post.id]);

    const commentTree = useMemo(
        () => buildCommentTree(comments, commentSortOrder),
        [commentSortOrder, comments],
    );
    const commentById = useMemo(
        () => new Map(comments.map((comment) => [comment.id, comment])),
        [comments],
    );

    useEffect(() => {
        loadedCommentsCountRef.current = comments.length;
    }, [comments]);

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
        if (!replyTarget) return;
        const targetStillVisible = comments.some(
            (comment) => comment.id === replyTarget.commentId,
        );
        if (!targetStillVisible) {
            setReplyTarget(null);
        }
    }, [comments, replyTarget]);

    const loadInitialComments = useCallback(async () => {
        setCommentsLoading(true);
        setCommentsAutoLoad(false);
        try {
            const page = await fetchPostCommentsPage(post.id, {
                limit: COMMENTS_INITIAL_LIMIT,
            });
            setComments(page.items);
            setCommentsCursor(page.nextCursor);
            setCommentsHasMore(page.hasMore);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load comments.';
            setStatus(message);
        } finally {
            setCommentsLoading(false);
        }
    }, [post.id]);

    const refreshLoadedComments = useCallback(async () => {
        const loadedCount = Math.max(
            COMMENTS_INITIAL_LIMIT,
            loadedCommentsCountRef.current || COMMENTS_INITIAL_LIMIT,
        );
        const page = await fetchPostCommentsPage(post.id, {
            limit: loadedCount,
        });
        setComments(page.items);
        setCommentsCursor(page.nextCursor);
        setCommentsHasMore(page.hasMore);
    }, [post.id]);

    const loadMoreComments = useCallback(async () => {
        if (
            !showComments ||
            commentsLoadingMore ||
            !commentsHasMore ||
            !commentsCursor
        )
            return;
        setCommentsLoadingMore(true);
        try {
            const page = await fetchPostCommentsPage(post.id, {
                limit: COMMENTS_PAGE_SIZE,
                beforeCreatedAt: commentsCursor,
            });
            setComments((prev) => {
                const existingIds = new Set(prev.map((comment) => comment.id));
                const next = page.items.filter(
                    (comment) => !existingIds.has(comment.id),
                );
                return [...prev, ...next];
            });
            setCommentsCursor(page.nextCursor);
            setCommentsHasMore(page.hasMore);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load more comments.';
            setStatus(message);
        } finally {
            setCommentsLoadingMore(false);
        }
    }, [
        commentsCursor,
        commentsHasMore,
        commentsLoadingMore,
        post.id,
        showComments,
    ]);

    useEffect(() => {
        if (!showEngagement) return;

        let mounted = true;
        getSessionUser()
            .then((user) => {
                if (!mounted) return;
                setCanInteract(Boolean(user));
                setCurrentUserId(user?.id ?? '');
            })
            .catch(() => {
                if (!mounted) return;
                setCanInteract(false);
                setCurrentUserId('');
            });

        fetchPostEngagement(post.id)
            .then((engagement) => {
                if (!mounted) return;
                setLikesCount(engagement.likesCount);
                setCommentsCount(engagement.commentsCount);
                setLiked(engagement.likedByCurrentUser);
            })
            .catch(() => {
                if (!mounted) return;
                setLiked(false);
            });

        const unsubscribe = subscribeToPostEngagement(post.id, () => {
            void refreshEngagement().catch((error: unknown) => {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to refresh engagement.';
                setStatus(message);
            });
            if (showComments) {
                void refreshLoadedComments().catch((error: unknown) => {
                    const message =
                        error instanceof Error
                            ? error.message
                            : 'Failed to refresh comments.';
                    setStatus(message);
                });
            }
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [
        post.id,
        refreshEngagement,
        refreshLoadedComments,
        showComments,
        showEngagement,
    ]);

    const isAdmin = isAdminViewer === true;
    const canReport = isAdminViewer === false;

    useEffect(() => {
        if (!showEngagement) return;
        if (!showComments) return;
        void loadInitialComments();
    }, [loadInitialComments, showComments, showEngagement]);

    useEffect(() => {
        if (!showEngagement) return;
        if (!targetCommentId || showComments || ignoreTargetCommentAutoOpen)
            return;
        setShowComments(true);
    }, [
        ignoreTargetCommentAutoOpen,
        showComments,
        showEngagement,
        targetCommentId,
    ]);

    useEffect(() => {
        if (!showEngagement) return;
        if (
            !showComments ||
            !commentsHasMore ||
            !commentsAutoLoad ||
            !commentsAnchorRef.current
        )
            return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void loadMoreComments();
                }
            },
            {
                rootMargin: '260px 0px 260px 0px',
            },
        );
        observer.observe(commentsAnchorRef.current);
        return () => {
            observer.disconnect();
        };
    }, [
        commentsAutoLoad,
        commentsHasMore,
        loadMoreComments,
        showComments,
        showEngagement,
    ]);

    useEffect(() => {
        if (!showEngagement) return;
        if (
            !showComments ||
            !targetCommentId ||
            !commentsContainerRef.current
        ) {
            return;
        }
        if (focusedCommentIdRef.current === targetCommentId) {
            return;
        }

        const targetNode =
            commentsContainerRef.current.querySelector<HTMLElement>(
                `[data-feed-comment-id="${targetCommentId}"]`,
            );
        if (targetNode) {
            targetNode.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
            });
            focusedCommentIdRef.current = targetCommentId;
            return;
        }

        if (commentsHasMore && !commentsLoadingMore && !commentsLoading) {
            void loadMoreComments();
        }
    }, [
        comments,
        commentsHasMore,
        commentsLoading,
        commentsLoadingMore,
        loadMoreComments,
        showComments,
        showEngagement,
        targetCommentId,
    ]);

    async function onToggleLike() {
        if (!canInteract) {
            setStatus('Login required to like posts.');
            return;
        }
        try {
            await togglePostLike(post.id);
            await refreshEngagement();
            setStatus('');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to update like.';
            setStatus(message);
        }
    }

    async function onAddComment() {
        if (!canInteract) {
            setStatus('Login required to comment.');
            return;
        }
        if (!allowCommenting) {
            setStatus('Visitor accounts can read comments but cannot comment.');
            return;
        }
        try {
            if (replyTarget) {
                const targetComment = commentById.get(replyTarget.commentId);
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
            let payload = commentInput.trim();
            if (!payload) {
                throw new Error('Comment cannot be empty.');
            }
            if (
                mentionPrefix &&
                !payload
                    .toLowerCase()
                    .startsWith(mentionPrefix.trim().toLowerCase())
            ) {
                payload = `${mentionPrefix}${payload}`;
            }

            await addPostComment(post.id, payload, replyTarget?.parentId);
            setCommentInput('');
            setReplyTarget(null);
            await refreshEngagement();
            setShowComments(true);
            await loadInitialComments();
            setStatus('');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to add comment.';
            setStatus(message);
        }
    }

    async function onToggleCommentLike(commentId: string) {
        if (!canInteract) {
            setStatus('Login required to react to comments.');
            return;
        }
        if (!allowCommenting) {
            setStatus('Visitor accounts can only like feed posts.');
            return;
        }
        if (busyCommentId === commentId) return;

        setBusyCommentId(commentId);
        try {
            await togglePostCommentLike(commentId);
            await Promise.all([refreshEngagement(), refreshLoadedComments()]);
            setStatus('');
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

    async function onReportPost() {
        if (!canInteract) {
            setReportPopper({
                message: 'Login required to report content.',
                tone: 'error',
            });
            return;
        }
        try {
            await createContentReport({
                targetType: 'feed_post',
                targetId: post.id,
                reason: 'Feed post reported',
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
        if (!canInteract) {
            setReportPopper({
                message: 'Login required to report content.',
                tone: 'error',
            });
            return;
        }
        try {
            await createContentReport({
                targetType: 'feed_comment',
                targetId: commentId,
                reason: 'Feed comment reported',
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

    function onAdminDeletePost() {
        if (!isAdmin) return;
        setConfirmDeleteTarget({ kind: 'post' });
    }

    function onAdminDeleteComment(commentId: string) {
        if (!isAdmin) return;
        if (busyDeleteId === commentId) return;
        setConfirmDeleteTarget({ kind: 'comment', commentId });
    }

    async function onConfirmDelete() {
        if (!confirmDeleteTarget || !isAdmin) return;

        if (confirmDeleteTarget.kind === 'post') {
            setBusyDeleteId(post.id);
            try {
                await adminDeleteContentTarget({
                    targetType: 'feed_post',
                    targetId: post.id,
                });
                await Promise.resolve(onPostDeleted?.(post.id));
                setStatus('Feed post deleted.');
                setConfirmDeleteTarget(null);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to delete post.';
                setStatus(message);
            } finally {
                setBusyDeleteId('');
            }
            return;
        }

        setBusyDeleteId(confirmDeleteTarget.commentId);
        try {
            await adminDeleteContentTarget({
                targetType: 'feed_comment',
                targetId: confirmDeleteTarget.commentId,
            });
            await Promise.all([refreshEngagement(), refreshLoadedComments()]);
            setStatus('Comment deleted.');
            setConfirmDeleteTarget(null);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to delete comment.';
            setStatus(message);
        } finally {
            setBusyDeleteId('');
        }
    }

    function onReplyToComment(comment: PostComment) {
        if (!allowCommenting) {
            setStatus('Visitor accounts can read comments but cannot reply.');
            return;
        }
        if (currentUserId && comment.userId === currentUserId) {
            setStatus('You cannot reply to your own comment.');
            return;
        }

        const mentionPrefix = `@${comment.authorName} `;

        setReplyTarget({
            commentId: comment.id,
            parentId: comment.id,
            authorName: comment.authorName,
        });
        setCommentInput((previousValue) => {
            const trimmedPrevious = previousValue.trim();
            if (!trimmedPrevious) return mentionPrefix;
            if (
                trimmedPrevious
                    .toLowerCase()
                    .startsWith(mentionPrefix.trim().toLowerCase())
            ) {
                return previousValue;
            }
            return `${mentionPrefix}${previousValue}`;
        });
        requestAnimationFrame(() => {
            commentInputRef.current?.focus();
        });
    }

    function clearReplyTarget() {
        setReplyTarget(null);
    }

    function renderCommentContent(comment: PostComment): React.ReactNode {
        if (!comment.parentId) {
            return comment.content;
        }

        const parent = commentById.get(comment.parentId);
        if (!parent) {
            return comment.content;
        }

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
        depth: number,
    ): React.ReactNode {
        const isTarget =
            Boolean(targetCommentId) && node.id === targetCommentId;
        const isReplyTargetNode =
            showComments && replyTarget?.commentId === node.id;
        return (
            <div
                data-feed-comment-id={node.id}
                className={`rounded-xl bg-white px-2 py-2 text-xs ${
                    depth > 0 ? 'border border-slate-200/80' : ''
                } ${isTarget ? 'ring-2 ring-[#155DFC]/70 ring-offset-1' : ''}`}
            >
                <div className='flex items-start gap-2'>
                    <span className='relative mt-0.5 h-7 w-7 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-slate-100'>
                        <Image
                            src={node.authorAvatarUrl ?? FALLBACK_AVATAR_URL}
                            alt={`${node.authorName} avatar`}
                            fill
                            sizes='28px'
                            className='object-cover'
                        />
                    </span>
                    <div className='min-w-0 flex-1'>
                        <div className='rounded-2xl bg-slate-100 px-3 py-2'>
                            <div className='flex items-center justify-between gap-2'>
                                <p className='font-semibold text-slate-700'>
                                    {node.authorName}
                                </p>
                                <p className='text-[11px] text-slate-500'>
                                    {formatCommentTime(node.createdAt)}
                                </p>
                            </div>
                            <p className='mt-1 text-slate-700'>
                                {renderCommentContent(node)}
                            </p>
                        </div>
                        <div className='mt-2 flex items-center gap-2 pl-1'>
                            {allowCommenting ? (
                                <button
                                    type='button'
                                    onClick={() =>
                                        void onToggleCommentLike(node.id)
                                    }
                                    disabled={busyCommentId === node.id}
                                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                                        node.likedByCurrentUser
                                            ? 'border-rose-200 bg-rose-50 text-rose-600'
                                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                    } disabled:cursor-not-allowed disabled:opacity-60`}
                                    aria-label='React to comment'
                                >
                                    <HeartIcon
                                        filled={node.likedByCurrentUser}
                                        className={`h-3.5 w-3.5 ${node.likedByCurrentUser ? 'text-rose-600' : 'text-slate-500'}`}
                                    />
                                    <span>{node.likes}</span>
                                </button>
                            ) : null}
                            {allowCommenting &&
                            (!currentUserId ||
                                node.userId !== currentUserId) ? (
                                <button
                                    type='button'
                                    onClick={() => onReplyToComment(node)}
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
                                    disabled={busyDeleteId === node.id}
                                    className='rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800 hover:bg-amber-100'
                                >
                                    Report
                                </button>
                            ) : null}
                            {isAdmin ? (
                                <button
                                    type='button'
                                    onClick={() =>
                                        void onAdminDeleteComment(node.id)
                                    }
                                    disabled={busyDeleteId === node.id}
                                    className='rounded-full border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    Delete
                                </button>
                            ) : null}
                        </div>
                        {allowCommenting && isReplyTargetNode ? (
                            <form
                                className='mt-2 flex gap-2 pl-1'
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    void onAddComment();
                                }}
                            >
                                <input
                                    ref={commentInputRef}
                                    value={commentInput}
                                    onChange={(event) =>
                                        setCommentInput(event.target.value)
                                    }
                                    onKeyDown={(event) => {
                                        if (event.key !== 'Enter') return;
                                        if (event.nativeEvent.isComposing)
                                            return;
                                        event.preventDefault();
                                        void onAddComment();
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
                                    onClick={clearReplyTarget}
                                    className='rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50'
                                >
                                    Cancel
                                </button>
                            </form>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }

    function renderCommentNodes(
        nodes: CommentNode[],
        depth = 0,
    ): React.ReactNode {
        return nodes.map((node) => {
            const flattenedReplies = flattenReplyNodes(node.replies);
            const replyDepth = Math.min(depth + 1, FEED_COMMENT_INDENT_CAP);

            return (
                <div key={node.id} className='space-y-2'>
                    {renderCommentNode(node, depth)}
                    {flattenedReplies.length > 0 ? (
                        <div
                            className={`mt-2 space-y-2 ${
                                depth < FEED_COMMENT_INDENT_CAP
                                    ? 'border-l border-slate-200 pl-3'
                                    : ''
                            }`}
                        >
                            {flattenedReplies.map((replyNode) => (
                                <div key={replyNode.id}>
                                    {renderCommentNode(replyNode, replyDepth)}
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            );
        });
    }

    function openLightbox(index: number) {
        setActiveImageIndex(index);
        setLightboxOpen(true);
    }

    function goNextImage() {
        setActiveImageIndex((current) =>
            Math.min(current + 1, images.length - 1),
        );
    }

    function goPrevImage() {
        setActiveImageIndex((current) => Math.max(current - 1, 0));
    }

    const canPrev = activeImageIndex > 0;
    const canNext = activeImageIndex < images.length - 1;
    const confirmDeleteBusy = confirmDeleteTarget
        ? confirmDeleteTarget.kind === 'post'
            ? busyDeleteId === post.id
            : busyDeleteId === confirmDeleteTarget.commentId
        : false;
    const confirmDeleteTitle =
        confirmDeleteTarget?.kind === 'post'
            ? 'Delete this feed post?'
            : 'Delete this comment?';
    const confirmDeleteDescription =
        confirmDeleteTarget?.kind === 'post'
            ? 'This action permanently removes the post and all related comments.'
            : 'This action permanently removes this comment.';
    const showFooterSection = showEngagement || Boolean(status);
    const showExpandedCommentControls =
        commentsHasMore || comments.length > COMMENTS_INITIAL_LIMIT;

    return (
        <Card
            className={`flex flex-col overflow-hidden border-y border-slate-200 bg-white shadow-none rounded-none md:rounded-2xl md:border md:shadow-sm ${
                showEngagement ? 'min-h-[90svh] md:min-h-[90vh]' : ''
            }`}
        >
            <CardBody className='p-0 '>
                <div className='p-4 md:p-5 '>
                    <div className='flex items-start justify-between gap-3'>
                        <div className='flex items-center gap-3'>
                            <button
                                type='button'
                                onClick={() => openLightbox(0)}
                                className='h-11 w-11 overflow-hidden rounded-full border border-slate-200 bg-slate-100'
                            >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={avatarUrl}
                                    alt={author?.name ?? 'User avatar'}
                                    className='h-full w-full object-cover'
                                />
                            </button>
                            <div className='min-w-0'>
                                <p className='truncate text-sm font-semibold text-slate-900'>
                                    {author?.name ?? 'Unknown'}
                                </p>
                                <Chip
                                    size='sm'
                                    variant='flat'
                                    className='mt-1 w-fit bg-slate-100 text-xs text-slate-500'
                                >
                                    {postMeta}
                                </Chip>
                            </div>
                        </div>
                        <div className='flex items-center gap-2'>
                            {canReport ? (
                                <Button
                                    onClick={() => void onReportPost()}
                                    isDisabled={busyDeleteId === post.id}
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
                                    onClick={() => void onAdminDeletePost()}
                                    isDisabled={busyDeleteId === post.id}
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
                    {post.caption ? (
                        <p className='mt-3 text-sm text-slate-700'>
                            {post.caption}
                        </p>
                    ) : null}
                </div>
                <PostImageGrid images={images} onOpen={openLightbox} />
                {showFooterSection ? (
                    <div className='space-y-3 p-4 md:p-5 '>
                        {showEngagement ? (
                            <>
                                <div className='flex items-center justify-between border-b border-slate-200 pb-2 text-sm text-slate-600'>
                                    <div className='inline-flex items-center gap-1.5'>
                                        <HeartIcon
                                            filled
                                            className='h-4 w-4 text-rose-500'
                                        />
                                        <span>{likesCount}</span>
                                    </div>
                                    <div className='inline-flex items-center gap-1.5'>
                                        <CommentIcon className='h-4 w-4 text-slate-500' />
                                        <span>{commentsCount}</span>
                                    </div>
                                </div>
                                <div className='grid grid-cols-2 gap-2 '>
                                    <Button
                                        onClick={() => void onToggleLike()}
                                        radius='lg'
                                        variant='flat'
                                        className={`rounded-xl inline-flex items-center justify-center gap-2 border text-sm font-semibold transition ${
                                            liked
                                                ? 'border-rose-200 bg-rose-50 text-rose-600'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <HeartIcon
                                            filled={liked}
                                            className={`h-4 w-4 ${liked ? 'text-rose-600' : 'text-slate-500'}`}
                                        />
                                        <span>Like</span>
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            setShowComments((prev) => {
                                                const next = !prev;
                                                if (!next) {
                                                    setReplyTarget(null);
                                                    setCommentsAutoLoad(false);
                                                    if (targetCommentId) {
                                                        setIgnoreTargetCommentAutoOpen(
                                                            true,
                                                        );
                                                    }
                                                }
                                                return next;
                                            })
                                        }
                                        radius='lg'
                                        variant='flat'
                                        className={`rounded-xl inline-flex items-center justify-center gap-2 border text-sm font-semibold transition ${
                                            showComments
                                                ? 'border-cyan-200 bg-cyan-50 text-cyan-700'
                                                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <CommentIcon
                                            className={`h-4 w-4 ${showComments ? 'text-cyan-700' : 'text-slate-500'}`}
                                        />
                                        <span>Comment</span>
                                    </Button>
                                </div>
                                {allowCommenting &&
                                (!replyTarget || !showComments) ? (
                                    <form
                                        className='flex gap-2'
                                        onSubmit={(event) => {
                                            event.preventDefault();
                                            void onAddComment();
                                        }}
                                    >
                                        <input
                                            ref={commentInputRef}
                                            value={commentInput}
                                            onChange={(event) =>
                                                setCommentInput(
                                                    event.target.value,
                                                )
                                            }
                                            onKeyDown={(event) => {
                                                if (event.key !== 'Enter')
                                                    return;
                                                if (
                                                    event.nativeEvent
                                                        .isComposing
                                                )
                                                    return;
                                                event.preventDefault();
                                                void onAddComment();
                                            }}
                                            placeholder='Write a comment'
                                            className='flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                                        />
                                        <Button
                                            type='submit'
                                            radius='lg'
                                            color='primary'
                                            className='text-xs font-semibold bg-[#0F172B] text-slate-50 rounded-xl border border-gray-200 hover:bg-[#2c3243]'
                                        >
                                            Send
                                        </Button>
                                    </form>
                                ) : null}
                                {showComments ? (
                                    <div
                                        ref={commentsContainerRef}
                                        className='space-y-2 rounded-2xl bg-slate-50 p-3'
                                    >
                                        {showExpandedCommentControls ? (
                                            <div className='flex flex-wrap items-center justify-start gap-2'>
                                                <label className='inline-flex items-center gap-2 text-[11px] font-semibold text-slate-600'>
                                                    {/* <span>Sort</span> */}
                                                    <select
                                                        value={commentSortOrder}
                                                        onChange={(event) =>
                                                            setCommentSortOrder(
                                                                event.target
                                                                    .value as CommentSortOrder,
                                                            )
                                                        }
                                                        className='rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none focus:border-cyan-600'
                                                    >
                                                        <option value='recent'>
                                                            Newest
                                                        </option>
                                                        <option value='oldest'>
                                                            All comments
                                                        </option>
                                                    </select>
                                                </label>
                                            </div>
                                        ) : null}
                                        {commentsLoading ? (
                                            <div className='space-y-2'>
                                                <div className='h-9 w-full animate-pulse rounded-xl bg-slate-200' />
                                                <div className='h-9 w-5/6 animate-pulse rounded-xl bg-slate-200' />
                                                <div className='h-9 w-2/3 animate-pulse rounded-xl bg-slate-200' />
                                            </div>
                                        ) : comments.length === 0 ? (
                                            <p className='text-xs text-slate-500'>
                                                No comments yet.
                                            </p>
                                        ) : (
                                            <div className='space-y-2'>
                                                {renderCommentNodes(
                                                    commentTree,
                                                )}
                                            </div>
                                        )}
                                        {commentsHasMore ? (
                                            <div
                                                ref={commentsAnchorRef}
                                                className='h-2 w-full'
                                                aria-hidden='true'
                                            />
                                        ) : null}
                                        {commentsLoadingMore ? (
                                            <p className='text-center text-xs text-slate-500'>
                                                Loading more comments...
                                            </p>
                                        ) : null}
                                        {commentsHasMore &&
                                        !commentsLoadingMore &&
                                        !commentsAutoLoad ? (
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    setCommentsAutoLoad(true);
                                                    void loadMoreComments();
                                                }}
                                                className='mx-auto block rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100'
                                            >
                                                Show more comments
                                            </button>
                                        ) : null}
                                        {showExpandedCommentControls ? (
                                            <button
                                                type='button'
                                                onClick={() => {
                                                    setShowComments(false);
                                                    setReplyTarget(null);
                                                    setCommentsAutoLoad(false);
                                                    if (targetCommentId) {
                                                        setIgnoreTargetCommentAutoOpen(
                                                            true,
                                                        );
                                                    }
                                                }}
                                                className='mx-auto block rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100'
                                            >
                                                Hide all comments
                                            </button>
                                        ) : null}
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                        {status ? (
                            <p className='text-xs text-slate-500'>{status}</p>
                        ) : null}
                    </div>
                ) : null}
            </CardBody>
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
            {lightboxOpen ? (
                <Lightbox
                    key={`lightbox-${activeImageIndex}`}
                    images={images}
                    index={activeImageIndex}
                    onClose={() => setLightboxOpen(false)}
                    onNext={goNextImage}
                    onPrev={goPrevImage}
                    canPrev={canPrev}
                    canNext={canNext}
                />
            ) : null}
        </Card>
    );
}
