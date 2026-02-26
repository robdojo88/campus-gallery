'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    captureFrameAsDataUrl,
    getHighResolutionStream,
} from '@/lib/camera-capture';
import { getErrorMessage } from '@/lib/error-message';
import {
    OFFLINE_QUEUE_CHANGED_EVENT,
    addPendingCapture,
    getPendingCaptures,
} from '@/lib/offline-queue';
import {
    fetchCurrentEventTag,
    getCurrentUserProfile,
    uploadBatchCaptures,
    uploadCapturedImage,
} from '@/lib/supabase';
import type { Visibility } from '@/lib/types';

const NAV_ROLE_CACHE_KEY = 'campus_gallery_nav_role';

function getFallbackVisibilityFromCachedRole(): Visibility {
    if (typeof window === 'undefined') return 'campus';
    const cachedRole = window.localStorage
        .getItem(NAV_ROLE_CACHE_KEY)
        ?.trim()
        .toLowerCase();
    return cachedRole === 'visitor' ? 'visitor' : 'campus';
}

function CaptureIcon({ className = 'h-5 w-5' }: { className?: string }) {
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
            <path d='M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z' />
            <circle cx='12' cy='13' r='4' />
        </svg>
    );
}

export function SingleCameraCapture() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const captureNoticeTimeoutRef = useRef<number | null>(null);
    const [captures, setCaptures] = useState<string[]>([]);
    const [activePreviewIndex, setActivePreviewIndex] = useState(0);
    const [caption, setCaption] = useState('');
    const [currentEvent, setCurrentEvent] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [currentEventLoading, setCurrentEventLoading] = useState(true);
    const [visibility, setVisibility] = useState<Visibility>('visitor');
    const [visibilityResolved, setVisibilityResolved] = useState(false);
    const [online, setOnline] = useState(true);
    const [status, setStatus] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureNotice, setCaptureNotice] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [pendingQueueCount, setPendingQueueCount] = useState(0);

    useEffect(() => {
        const setNetwork = () => setOnline(navigator.onLine);
        setNetwork();
        window.addEventListener('online', setNetwork);
        window.addEventListener('offline', setNetwork);

        return () => {
            window.removeEventListener('online', setNetwork);
            window.removeEventListener('offline', setNetwork);
        };
    }, []);

    useEffect(() => {
        let mounted = true;

        async function refreshPendingQueueCount() {
            try {
                const pending = await getPendingCaptures();
                if (mounted) {
                    setPendingQueueCount(pending.length);
                }
            } catch {
                if (mounted) {
                    setPendingQueueCount(0);
                }
            }
        }

        const handleQueueChanged = () => {
            void refreshPendingQueueCount();
        };

        void refreshPendingQueueCount();
        window.addEventListener(
            OFFLINE_QUEUE_CHANGED_EVENT,
            handleQueueChanged,
        );
        window.addEventListener('focus', handleQueueChanged);

        return () => {
            mounted = false;
            window.removeEventListener(
                OFFLINE_QUEUE_CHANGED_EVENT,
                handleQueueChanged,
            );
            window.removeEventListener('focus', handleQueueChanged);
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        getCurrentUserProfile()
            .then((profile) => {
                if (!mounted) return;
                setVisibility(
                    profile?.role === 'visitor' ? 'visitor' : 'campus',
                );
            })
            .catch(() => {
                if (!mounted) return;
                setVisibility(getFallbackVisibilityFromCachedRole());
            })
            .finally(() => {
                if (!mounted) return;
                setVisibilityResolved(true);
            });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        async function loadCurrentEvent() {
            try {
                const current = await fetchCurrentEventTag();
                if (!mounted) return;
                setCurrentEvent(current);
            } catch (error) {
                if (!mounted) return;
                setCurrentEvent(null);
                if (navigator.onLine) {
                    setStatus(
                        getErrorMessage(
                            error,
                            'Failed to load current event tag.',
                        ),
                    );
                } else {
                    setStatus(
                        'Offline mode - camera capture works and uploads will queue automatically.',
                    );
                }
            } finally {
                if (mounted) setCurrentEventLoading(false);
            }
        }
        void loadCurrentEvent();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let stream: MediaStream | null = null;
        async function bootCamera() {
            try {
                stream = await getHighResolutionStream();
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }
            } catch {
                setStatus('Camera permission denied or unavailable.');
            }
        }
        void bootCamera();
        return () => {
            stream?.getTracks().forEach((track) => track.stop());
        };
    }, []);

    useEffect(() => {
        return () => {
            if (captureNoticeTimeoutRef.current) {
                window.clearTimeout(captureNoticeTimeoutRef.current);
            }
        };
    }, []);

    const networkClass = useMemo(
        () =>
            online
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-red-100 text-red-700',
        [online],
    );
    const captureButtonLabel = isCapturing
        ? 'Capturing...'
        : captureNotice
          ? 'Captured!'
          : 'Capture';

    async function capture() {
        if (isCapturing || isSubmitting) return;
        if (!videoRef.current || !canvasRef.current) return;
        setIsCapturing(true);
        try {
            const next = await captureFrameAsDataUrl(
                videoRef.current,
                canvasRef.current,
            );
            setCaptures((prev) => [...prev, next]);
            setActivePreviewIndex(captures.length);
            setStatus('');
            setCaptureNotice(true);
            if (captureNoticeTimeoutRef.current) {
                window.clearTimeout(captureNoticeTimeoutRef.current);
            }
            captureNoticeTimeoutRef.current = window.setTimeout(() => {
                setCaptureNotice(false);
                captureNoticeTimeoutRef.current = null;
            }, 1200);
        } catch (error) {
            setStatus(getErrorMessage(error, 'Unable to capture image.'));
            setCaptureNotice(false);
        } finally {
            setIsCapturing(false);
        }
    }

    function removeCapture(index: number) {
        const nextLength = captures.length - 1;
        setCaptures((prev) =>
            prev.filter((_, itemIndex) => itemIndex !== index),
        );
        setActivePreviewIndex((current) => {
            if (nextLength <= 0) return 0;
            if (index < current) return current - 1;
            if (index === current) return Math.max(0, current - 1);
            return Math.min(current, nextLength - 1);
        });
    }

    async function submitCapture() {
        if (isSubmitting) return;

        if (captures.length === 0) {
            setStatus('Capture at least one image first.');
            return;
        }
        const cleanedCaption = caption.trim();
        if (!cleanedCaption) {
            setStatus('Caption is required.');
            return;
        }

        if (!visibilityResolved) {
            setStatus('Resolving account visibility. Please wait a moment.');
            return;
        }

        async function saveToOfflineQueue(prefix: string): Promise<boolean> {
            try {
                await addPendingCapture({
                    id: crypto.randomUUID(),
                    imageDataUrl: captures[0],
                    captures: [...captures],
                    caption: cleanedCaption,
                    visibility,
                    eventId: currentEvent?.id,
                    createdAt: new Date().toISOString(),
                });
                const pending = await getPendingCaptures().catch(() => []);
                const nextPendingCount = pending.length;
                setPendingQueueCount(nextPendingCount);
                setStatus(
                    `${prefix} Saved locally as one pending post. Pending queue: ${nextPendingCount}. It will auto-upload when connection is stable.`,
                );
                setCaptures([]);
                setActivePreviewIndex(0);
                setCaption('');
                return true;
            } catch (queueError) {
                setStatus(
                    `Failed to save offline queue: ${getErrorMessage(queueError, 'queue unavailable')}`,
                );
                return false;
            }
        }

        if (!online) {
            await saveToOfflineQueue('Offline.');
            return;
        }

        setIsSubmitting(true);
        try {
            if (captures.length === 1) {
                await uploadCapturedImage(captures[0], {
                    caption: cleanedCaption,
                    visibility,
                });
            } else {
                await uploadBatchCaptures({
                    captures,
                    caption: cleanedCaption,
                    visibility,
                });
            }
            setStatus(
                `Uploaded ${captures.length} capture${captures.length > 1 ? 's' : ''} as one post.`,
            );
            setCaptures([]);
            setActivePreviewIndex(0);
            setCaption('');
            router.push('/feed');
        } catch (error) {
            const message = getErrorMessage(error, 'Upload failed.');
            await saveToOfflineQueue(`${message}.`);
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <section className='-mt-6 grid gap-6 lg:mt-0 lg:grid-cols-[1.2fr_0.8fr]'>
            <article className='overflow-hidden bg-white shadow-sm lg:rounded-3xl lg:border lg:border-slate-200'>
                <div className='relative h-[100dvh] w-full  bg-slate-900 lg:aspect-[4/3] lg:h-auto'>
                    <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        muted
                        className='h-full w-full object-cover'
                    />
                    <div className='absolute inset-x-0 bottom-0 lg:hidden '>
                        <div className='pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-900/90 via-slate-900/45 to-transparent' />
                        <div className='relative flex items-end justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+5.9rem)]'>
                            <button
                                type='button'
                                onClick={() => void capture()}
                                disabled={isSubmitting || isCapturing}
                                aria-label={captureButtonLabel}
                                className='group relative grid h-[4.6rem] w-[4.6rem] place-items-center rounded-full border-4 border-white/95 bg-white/15 shadow-[0_16px_30px_-18px_rgba(0,0,0,0.95)] backdrop-blur-sm transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                <span
                                    className={`grid h-[3.35rem] w-[3.35rem] place-items-center rounded-full transition ${
                                        captureNotice
                                            ? 'bg-emerald-200 text-emerald-900'
                                            : 'bg-white text-slate-900'
                                    }`}
                                >
                                    <CaptureIcon className='h-6 w-6' />
                                </span>
                            </button>
                        </div>
                        <p className='absolute left-4 bottom-[calc(env(safe-area-inset-bottom)+7.35rem)] rounded-full bg-black/45 px-3 py-1 text-xs font-semibold text-white'>
                            Captured: {captures.length}
                        </p>
                        <span
                            className={`absolute right-4 bottom-[calc(env(safe-area-inset-bottom)+7.35rem)] rounded-full px-3 py-1 text-xs font-semibold ${networkClass}`}
                        >
                            {online ? 'Online' : 'Offline'}
                        </span>
                    </div>
                </div>
                <div className='hidden items-center justify-between gap-3 p-4 lg:flex'>
                    <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${networkClass}`}
                    >
                        {online
                            ? 'Online - instant upload'
                            : 'Offline - queue enabled'}
                    </span>
                    <div className='flex items-center gap-2'>
                        <p className='text-xs font-semibold text-slate-200'>
                            Captured: {captures.length}
                        </p>
                        <button
                            type='button'
                            onClick={() => void capture()}
                            disabled={isSubmitting || isCapturing}
                            className='inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            <CaptureIcon className='h-4 w-4' />
                            <span>{captureButtonLabel}</span>
                        </button>
                    </div>
                </div>
            </article>

            <article className='space-y-4 rounded-3xl border border-slate-200 bg-white p-7 shadow-sm md:p-5'>
                {/* <h2 className='text-lg font-bold'>Preview and Submit Post</h2> */}
                {captures.length > 0 ? (
                    <Image
                        src={captures[activePreviewIndex]}
                        alt='Captured preview'
                        width={1200}
                        height={900}
                        unoptimized
                        className='w-full rounded-2xl border border-slate-200'
                    />
                ) : (
                    <div className='rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500'>
                        You can capture multiple images into one post.
                    </div>
                )}
                {captures.length > 1 ? (
                    <div className='grid grid-cols-4 gap-2'>
                        {captures.map((image, index) => (
                            <div key={`${image}-${index}`} className='relative'>
                                <button
                                    type='button'
                                    onClick={() => setActivePreviewIndex(index)}
                                    disabled={isSubmitting}
                                    className={`relative block aspect-square w-full overflow-hidden rounded-xl border ${
                                        activePreviewIndex === index
                                            ? 'border-cyan-600'
                                            : 'border-slate-300'
                                    }`}
                                >
                                    <Image
                                        src={image}
                                        alt={`Capture ${index + 1}`}
                                        fill
                                        unoptimized
                                        className='object-cover'
                                    />
                                </button>
                                <button
                                    type='button'
                                    onClick={() => removeCapture(index)}
                                    disabled={isSubmitting}
                                    className='absolute -right-1 -top-1 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-60'
                                >
                                    x
                                </button>
                            </div>
                        ))}
                    </div>
                ) : null}
                <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    disabled={isSubmitting}
                    placeholder='Caption (required)'
                    className='min-h-24 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                />
                <div className='grid gap-3'>
                    {/* <div className='rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700'>
                        <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500'>
                            Visibility
                        </p>
                        <p className='mt-1 font-semibold capitalize text-slate-900'>
                            {visibility}
                        </p>
                    </div> */}
                    <div className='rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700'>
                        <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500'>
                            Current event tag
                        </p>
                        <p className='mt-1 font-semibold text-slate-900'>
                            {currentEventLoading
                                ? 'Loading...'
                                : (currentEvent?.name ?? 'Not set by admin')}
                        </p>
                    </div>
                </div>
                <p className='text-xs text-slate-500'>
                    Event tags are managed by admin. Every feed post is
                    auto-tagged with the current event.
                </p>
                <p className='text-xs text-slate-500'>
                    Pending uploads:{' '}
                    <span className='font-semibold'>{pendingQueueCount}</span>
                </p>
                <button
                    type='button'
                    onClick={() => void submitCapture()}
                    disabled={isSubmitting || caption.trim().length === 0}
                    className='w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                >
                    {isSubmitting ? 'Posting...' : 'Submit Post'}
                </button>
                {captures.length > 0 ? (
                    <button
                        type='button'
                        onClick={() => {
                            setCaptures([]);
                            setActivePreviewIndex(0);
                        }}
                        disabled={isSubmitting}
                        className='w-full rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                        Clear Captures
                    </button>
                ) : null}
                {status ? (
                    <p className='text-sm text-slate-700'>{status}</p>
                ) : null}
                {visibility === 'visitor' ? (
                    <p className='text-xs text-slate-500'>
                        Visitor accounts can only publish to visitor visibility.
                    </p>
                ) : null}
                <p className='text-xs text-slate-500'>
                    File upload from device is intentionally disabled. Only live
                    camera capture is supported.
                </p>
            </article>
            <canvas ref={canvasRef} className='hidden' />
        </section>
    );
}
