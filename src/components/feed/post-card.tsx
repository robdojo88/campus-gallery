'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import {
    addPostComment,
    fetchPostEngagement,
    fetchPostCommentsPage,
    getSessionUser,
    subscribeToPostEngagement,
    togglePostLike,
} from '@/lib/supabase';
import type { Post, PostComment } from '@/lib/types';

const FALLBACK_AVATAR_URL = '/avatar-default.svg';
const COMMENTS_INITIAL_LIMIT = 10;
const COMMENTS_PAGE_SIZE = 5;

function formatFeedTimestamp(createdAt: string): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';

    const now = new Date();
    const diffMs = Math.max(0, now.getTime() - date.getTime());
    const hourMs = 60 * 60 * 1000;
    const dayMs = 24 * hourMs;

    if (diffMs < dayMs) {
        const hours = Math.max(1, Math.floor(diffMs / hourMs));
        return `${hours}h`;
    }

    const days = Math.floor(diffMs / dayMs);
    if (days <= 7) {
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
            <button type='button' onClick={() => onOpen(0)} className='relative block h-[58svh] w-full overflow-hidden md:h-[60vh]'>
                <Image src={images[0]} alt='Post image 1' fill className='object-cover' />
            </button>
        );
    }

    if (total === 2) {
        return (
            <div className='grid h-[58svh] grid-cols-2 gap-1 md:h-[60vh]'>
                {images.slice(0, 2).map((image, index) => (
                    <button key={image} type='button' onClick={() => onOpen(index)} className='relative overflow-hidden'>
                        <Image src={image} alt={`Post image ${index + 1}`} fill className='object-cover' />
                    </button>
                ))}
            </div>
        );
    }

    if (total === 3) {
        return (
            <div className='grid h-[58svh] grid-cols-[2fr_1fr] gap-1 md:h-[60vh]'>
                <button type='button' onClick={() => onOpen(0)} className='relative row-span-2 overflow-hidden'>
                    <Image src={images[0]} alt='Post image 1' fill className='object-cover' />
                </button>
                <button type='button' onClick={() => onOpen(1)} className='relative overflow-hidden'>
                    <Image src={images[1]} alt='Post image 2' fill className='object-cover' />
                </button>
                <button type='button' onClick={() => onOpen(2)} className='relative overflow-hidden'>
                    <Image src={images[2]} alt='Post image 3' fill className='object-cover' />
                </button>
            </div>
        );
    }

    return (
        <div className='grid h-[58svh] grid-cols-2 grid-rows-2 gap-1 md:h-[60vh]'>
            {images.slice(0, 4).map((image, index) => {
                const isLastVisible = index === 3;
                return (
                    <button key={image} type='button' onClick={() => onOpen(index)} className='relative overflow-hidden'>
                        <Image src={image} alt={`Post image ${index + 1}`} fill className='object-cover' />
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
            className='fixed inset-0 z-[100] bg-black/90 p-4 md:p-8'
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
                    onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
                    className='rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30'
                >
                    -
                </button>
                <button
                    type='button'
                    onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
                    className='rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30'
                >
                    +
                </button>
                <span className='text-xs font-semibold text-white'>{Math.round(zoom * 100)}%</span>
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
                <div className='relative max-h-full max-w-full' onClick={(event) => event.stopPropagation()}>
                    {imageLoading ? (
                        <div className='absolute inset-0 z-20 grid place-items-center bg-black/45'>
                            <div className='flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold text-white'>
                                <span className='h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white' />
                                Loading image...
                            </div>
                        </div>
                    ) : null}
                    <Image
                        src={currentSrc}
                        alt={`Preview ${index + 1}`}
                        width={2200}
                        height={1600}
                        className='max-h-[82vh] w-auto max-w-[94vw] object-contain transition-transform duration-200'
                        style={{ transform: `scale(${zoom})` }}
                        onLoad={() => setLoadedSrc(currentSrc)}
                        onError={() => setLoadedSrc(currentSrc)}
                    />
                </div>
            </div>
        </div>
    );
}

export function PostCard({ post }: { post: Post }) {
    const author = post.author;
    const avatarUrl = author?.avatarUrl ?? FALLBACK_AVATAR_URL;
    const postedAt = formatFeedTimestamp(post.createdAt);
    const postMeta = post.eventName ? `${postedAt} • ${post.eventName}` : postedAt;
    const [liked, setLiked] = useState(false);
    const [likesCount, setLikesCount] = useState(post.likes);
    const [commentsCount, setCommentsCount] = useState(post.comments);
    const [showComments, setShowComments] = useState(false);
    const [comments, setComments] = useState<PostComment[]>([]);
    const [commentInput, setCommentInput] = useState('');
    const [status, setStatus] = useState('');
    const [canInteract, setCanInteract] = useState(false);
    const [lightboxOpen, setLightboxOpen] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [commentsLoading, setCommentsLoading] = useState(false);
    const [commentsLoadingMore, setCommentsLoadingMore] = useState(false);
    const [commentsCursor, setCommentsCursor] = useState<string | undefined>(undefined);
    const [commentsHasMore, setCommentsHasMore] = useState(false);
    const commentsContainerRef = useRef<HTMLDivElement | null>(null);
    const commentsAnchorRef = useRef<HTMLDivElement | null>(null);
    const loadedCommentsCountRef = useRef(0);

    const images = useMemo(() => (post.images.length > 0 ? post.images : [post.imageUrl]), [post.imageUrl, post.images]);

    const refreshEngagement = useCallback(async () => {
        const engagement = await fetchPostEngagement(post.id);
        setLikesCount(engagement.likesCount);
        setCommentsCount(engagement.commentsCount);
        setLiked(engagement.likedByCurrentUser);
    }, [post.id]);

    useEffect(() => {
        loadedCommentsCountRef.current = comments.length;
    }, [comments]);

    const loadInitialComments = useCallback(async () => {
        setCommentsLoading(true);
        try {
            const page = await fetchPostCommentsPage(post.id, {
                limit: COMMENTS_INITIAL_LIMIT,
            });
            setComments(page.items);
            setCommentsCursor(page.nextCursor);
            setCommentsHasMore(page.hasMore);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load comments.';
            setStatus(message);
        } finally {
            setCommentsLoading(false);
        }
    }, [post.id]);

    const refreshLoadedComments = useCallback(async () => {
        const loadedCount = Math.max(COMMENTS_INITIAL_LIMIT, loadedCommentsCountRef.current || COMMENTS_INITIAL_LIMIT);
        const page = await fetchPostCommentsPage(post.id, {
            limit: loadedCount,
        });
        setComments(page.items);
        setCommentsCursor(page.nextCursor);
        setCommentsHasMore(page.hasMore);
    }, [post.id]);

    const loadMoreComments = useCallback(async () => {
        if (!showComments || commentsLoadingMore || !commentsHasMore || !commentsCursor) return;
        setCommentsLoadingMore(true);
        try {
            const page = await fetchPostCommentsPage(post.id, {
                limit: COMMENTS_PAGE_SIZE,
                beforeCreatedAt: commentsCursor,
            });
            setComments((prev) => {
                const existingIds = new Set(prev.map((comment) => comment.id));
                const next = page.items.filter((comment) => !existingIds.has(comment.id));
                return [...prev, ...next];
            });
            setCommentsCursor(page.nextCursor);
            setCommentsHasMore(page.hasMore);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to load more comments.';
            setStatus(message);
        } finally {
            setCommentsLoadingMore(false);
        }
    }, [commentsCursor, commentsHasMore, commentsLoadingMore, post.id, showComments]);

    useEffect(() => {
        let mounted = true;
        getSessionUser()
            .then((user) => {
                if (!mounted) return;
                setCanInteract(Boolean(user));
            })
            .catch(() => {
                if (!mounted) return;
                setCanInteract(false);
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
                const message = error instanceof Error ? error.message : 'Failed to refresh engagement.';
                setStatus(message);
            });
            if (showComments) {
                void refreshLoadedComments()
                    .catch((error: unknown) => {
                        const message = error instanceof Error ? error.message : 'Failed to refresh comments.';
                        setStatus(message);
                    });
            }
        });

        return () => {
            mounted = false;
            unsubscribe();
        };
    }, [post.id, refreshEngagement, refreshLoadedComments, showComments]);

    useEffect(() => {
        if (!showComments) return;
        void loadInitialComments();
    }, [loadInitialComments, showComments]);

    useEffect(() => {
        if (!showComments || !commentsHasMore || !commentsContainerRef.current || !commentsAnchorRef.current) return;
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries.some((entry) => entry.isIntersecting)) {
                    void loadMoreComments();
                }
            },
            {
                root: commentsContainerRef.current,
                rootMargin: '120px 0px 120px 0px',
            },
        );
        observer.observe(commentsAnchorRef.current);
        return () => {
            observer.disconnect();
        };
    }, [commentsHasMore, loadMoreComments, showComments]);

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
            const message = error instanceof Error ? error.message : 'Failed to update like.';
            setStatus(message);
        }
    }

    async function onAddComment() {
        if (!canInteract) {
            setStatus('Login required to comment.');
            return;
        }
        try {
            await addPostComment(post.id, commentInput);
            setCommentInput('');
            await refreshEngagement();
            setShowComments(true);
            await loadInitialComments();
            setStatus('');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to add comment.';
            setStatus(message);
        }
    }

    function openLightbox(index: number) {
        setActiveImageIndex(index);
        setLightboxOpen(true);
    }

    function goNextImage() {
        setActiveImageIndex((current) => Math.min(current + 1, images.length - 1));
    }

    function goPrevImage() {
        setActiveImageIndex((current) => Math.max(current - 1, 0));
    }

    const canPrev = activeImageIndex > 0;
    const canNext = activeImageIndex < images.length - 1;

    return (
        <article className='flex min-h-[90svh] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm md:min-h-[90vh]'>
            <div className='p-4 md:p-5'>
                <div className='flex items-center gap-3'>
                    <button type='button' onClick={() => openLightbox(0)} className='h-11 w-11 overflow-hidden rounded-full border border-slate-200 bg-slate-100'>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={avatarUrl} alt={author?.name ?? 'User avatar'} className='h-full w-full object-cover' />
                    </button>
                    <div className='min-w-0'>
                        <p className='truncate text-sm font-semibold text-slate-900'>{author?.name ?? 'Unknown'}</p>
                        <p className='text-xs text-slate-500'>{postMeta}</p>
                    </div>
                </div>
                {post.caption ? <p className='mt-3 text-sm text-slate-700'>{post.caption}</p> : null}
            </div>
            <PostImageGrid images={images} onOpen={openLightbox} />
            <div className='space-y-3 p-4 md:p-5'>
                <div className='flex items-center justify-between border-b border-slate-200 pb-2 text-sm text-slate-600'>
                    <div className='inline-flex items-center gap-1.5'>
                        <HeartIcon filled className='h-4 w-4 text-rose-500' />
                        <span>{likesCount}</span>
                    </div>
                    <div className='inline-flex items-center gap-1.5'>
                        <CommentIcon className='h-4 w-4 text-slate-500' />
                        <span>{commentsCount}</span>
                    </div>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                    <button
                        type='button'
                        onClick={() => void onToggleLike()}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                            liked ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <HeartIcon filled={liked} className={`h-4 w-4 ${liked ? 'text-rose-600' : 'text-slate-500'}`} />
                        <span>Like</span>
                    </button>
                    <button
                        type='button'
                        onClick={() => setShowComments((prev) => !prev)}
                        className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                            showComments ? 'border-cyan-200 bg-cyan-50 text-cyan-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                    >
                        <CommentIcon className={`h-4 w-4 ${showComments ? 'text-cyan-700' : 'text-slate-500'}`} />
                        <span>Comment</span>
                    </button>
                </div>
                <form
                    className='flex gap-2'
                    onSubmit={(event) => {
                        event.preventDefault();
                        void onAddComment();
                    }}
                >
                    <input
                        value={commentInput}
                        onChange={(event) => setCommentInput(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key !== 'Enter') return;
                            if (event.nativeEvent.isComposing) return;
                            event.preventDefault();
                            void onAddComment();
                        }}
                        placeholder='Write a comment'
                        className='flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                    />
                    <button
                        type='submit'
                        className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700'
                    >
                        Send
                    </button>
                </form>
                {showComments ? (
                    <div ref={commentsContainerRef} className='max-h-72 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3'>
                        {commentsLoading ? (
                            <div className='space-y-2'>
                                <div className='h-9 w-full animate-pulse rounded-xl bg-slate-200' />
                                <div className='h-9 w-5/6 animate-pulse rounded-xl bg-slate-200' />
                                <div className='h-9 w-2/3 animate-pulse rounded-xl bg-slate-200' />
                            </div>
                        ) : comments.length === 0 ? (
                            <p className='text-xs text-slate-500'>No comments yet.</p>
                        ) : (
                            comments.map((comment) => (
                                <div key={comment.id} className='rounded-xl bg-white px-3 py-2 text-xs'>
                                    <p className='font-semibold text-slate-700'>{comment.authorName}</p>
                                    <p className='mt-1 text-slate-700'>{comment.content}</p>
                                </div>
                            ))
                        )}
                        {commentsHasMore ? <div ref={commentsAnchorRef} className='h-2 w-full' aria-hidden='true' /> : null}
                        {commentsLoadingMore ? <p className='text-center text-xs text-slate-500'>Loading more comments...</p> : null}
                        {commentsHasMore && !commentsLoadingMore ? (
                            <button
                                type='button'
                                onClick={() => void loadMoreComments()}
                                className='mx-auto block rounded-lg border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100'
                            >
                                Load more comments
                            </button>
                        ) : null}
                    </div>
                ) : null}
                {status ? <p className='text-xs text-slate-500'>{status}</p> : null}
            </div>
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
        </article>
    );
}

