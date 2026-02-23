'use client';

import Image from 'next/image';
import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent } from 'react';
import {
    addPostComment,
    fetchPostEngagement,
    fetchPostComments,
    getSessionUser,
    subscribeToPostEngagement,
    togglePostLike,
} from '@/lib/supabase';
import type { Post, PostComment } from '@/lib/types';

function PostImageGrid({
    images,
    onOpen,
}: {
    images: string[];
    onOpen: (index: number) => void;
}) {
    const total = images.length;
    const moreCount = Math.max(0, total - 5);

    if (total === 1) {
        return (
            <button type='button' onClick={() => onOpen(0)} className='relative block aspect-[16/10] w-full overflow-hidden'>
                <Image src={images[0]} alt='Post image 1' fill className='object-cover' />
            </button>
        );
    }

    if (total === 2) {
        return (
            <div className='grid h-80 grid-cols-2 gap-1'>
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
            <div className='grid h-80 grid-cols-[2fr_1fr] gap-1'>
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

    if (total === 4) {
        return (
            <div className='grid h-80 grid-cols-2 grid-rows-2 gap-1'>
                {images.slice(0, 4).map((image, index) => (
                    <button key={image} type='button' onClick={() => onOpen(index)} className='relative overflow-hidden'>
                        <Image src={image} alt={`Post image ${index + 1}`} fill className='object-cover' />
                    </button>
                ))}
            </div>
        );
    }

    return (
        <div className='grid h-80 grid-cols-3 grid-rows-2 gap-1'>
            {images.slice(0, 5).map((image, index) => {
                const isLast = index === 4;
                return (
                    <button
                        key={image}
                        type='button'
                        onClick={() => onOpen(index)}
                        className={`relative overflow-hidden ${index === 0 ? 'col-span-2 row-span-2' : ''}`}
                    >
                        <Image src={image} alt={`Post image ${index + 1}`} fill className='object-cover' />
                        {isLast && moreCount > 0 ? (
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
}: {
    images: string[];
    index: number;
    onClose: () => void;
    onPrev: () => void;
    onNext: () => void;
}) {
    const [zoom, setZoom] = useState(1);
    const touchStartX = useRef<number | null>(null);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            if (event.key === 'ArrowLeft') onPrev();
            if (event.key === 'ArrowRight') onNext();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [onClose, onNext, onPrev]);

    function onTouchStart(event: TouchEvent<HTMLDivElement>) {
        touchStartX.current = event.touches[0]?.clientX ?? null;
    }

    function onTouchEnd(event: TouchEvent<HTMLDivElement>) {
        if (touchStartX.current === null) return;
        const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
        const delta = endX - touchStartX.current;
        if (delta > 40) onPrev();
        if (delta < -40) onNext();
        touchStartX.current = null;
    }

    return (
        <div className='fixed inset-0 z-[100] bg-black/90 p-4 md:p-8'>
            <button
                type='button'
                onClick={onClose}
                className='absolute right-4 top-4 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30'
            >
                Close
            </button>
            <div className='absolute left-4 top-4 flex items-center gap-2'>
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
            <button
                type='button'
                onClick={onPrev}
                className='absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30'
            >
                {'<'}
            </button>
            <button
                type='button'
                onClick={onNext}
                className='absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30'
            >
                {'>'}
            </button>
            <div className='flex h-full items-center justify-center' onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                <div className='relative h-full w-full max-w-6xl overflow-hidden'>
                    <Image
                        src={images[index]}
                        alt={`Preview ${index + 1}`}
                        fill
                        className='object-contain transition-transform duration-200'
                        style={{ transform: `scale(${zoom})` }}
                    />
                </div>
            </div>
        </div>
    );
}

export function PostCard({ post }: { post: Post }) {
    const author = post.author;
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

    const images = useMemo(() => (post.images.length > 0 ? post.images : [post.imageUrl]), [post.imageUrl, post.images]);

    const refreshEngagement = useCallback(async () => {
        const engagement = await fetchPostEngagement(post.id);
        setLikesCount(engagement.likesCount);
        setCommentsCount(engagement.commentsCount);
        setLiked(engagement.likedByCurrentUser);
    }, [post.id]);

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
                void fetchPostComments(post.id)
                    .then((rows) => {
                        setComments(rows);
                    })
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
    }, [post.id, refreshEngagement, showComments]);

    useEffect(() => {
        let cancelled = false;
        if (!showComments) return;
        fetchPostComments(post.id)
            .then((rows) => {
                if (cancelled) return;
                setComments(rows);
                setCommentsCount(rows.length);
            })
            .catch((error: unknown) => {
                if (cancelled) return;
                const message = error instanceof Error ? error.message : 'Failed to load comments.';
                setStatus(message);
            });
        return () => {
            cancelled = true;
        };
    }, [showComments, post.id]);

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
            const rows = await fetchPostComments(post.id);
            setComments(rows);
            setShowComments(true);
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
        setActiveImageIndex((current) => (current + 1) % images.length);
    }

    function goPrevImage() {
        setActiveImageIndex((current) => (current - 1 + images.length) % images.length);
    }

    return (
        <article className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm'>
            <PostImageGrid images={images} onOpen={openLightbox} />
            <div className='space-y-3 p-4 md:p-5'>
                <div className='flex items-center justify-between gap-3'>
                    <div>
                        <p className='text-sm font-semibold text-slate-800'>{author?.name ?? 'Unknown'}</p>
                        <p className='text-xs text-slate-500'>{new Date(post.createdAt).toLocaleString()}</p>
                    </div>
                    <span className='rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700'>
                        {post.visibility}
                    </span>
                </div>
                {post.caption ? <p className='text-sm text-slate-700'>{post.caption}</p> : null}
                <div className='flex flex-wrap gap-2 text-xs text-slate-600'>
                    <span className='rounded-full bg-slate-100 px-3 py-1'>{likesCount} likes</span>
                    <span className='rounded-full bg-slate-100 px-3 py-1'>{commentsCount} comments</span>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <button
                        type='button'
                        onClick={() => void onToggleLike()}
                        className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
                            liked ? 'bg-cyan-600 text-white' : 'bg-slate-100 text-slate-700'
                        }`}
                    >
                        {liked ? 'Liked' : 'Like'}
                    </button>
                    <button
                        type='button'
                        onClick={() => setShowComments((prev) => !prev)}
                        className='rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700'
                    >
                        {showComments ? 'Hide Comments' : 'Comments'}
                    </button>
                </div>
                <div className='flex gap-2'>
                    <input
                        value={commentInput}
                        onChange={(event) => setCommentInput(event.target.value)}
                        placeholder='Write a comment'
                        className='flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs outline-none focus:border-cyan-600'
                    />
                    <button
                        type='button'
                        onClick={() => void onAddComment()}
                        className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700'
                    >
                        Send
                    </button>
                </div>
                {showComments ? (
                    <div className='space-y-2 rounded-2xl bg-slate-50 p-3'>
                        {comments.length === 0 ? (
                            <p className='text-xs text-slate-500'>No comments yet.</p>
                        ) : (
                            comments.map((comment) => (
                                <div key={comment.id} className='rounded-xl bg-white px-3 py-2 text-xs'>
                                    <p className='font-semibold text-slate-700'>{comment.authorName}</p>
                                    <p className='mt-1 text-slate-700'>{comment.content}</p>
                                </div>
                            ))
                        )}
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
                />
            ) : null}
        </article>
    );
}

