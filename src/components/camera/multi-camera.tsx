'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { captureFrameAsDataUrl, getHighResolutionStream } from '@/lib/camera-capture';
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

export function MultiCameraCapture() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const captureNoticeTimeoutRef = useRef<number | null>(null);
    const [captures, setCaptures] = useState<string[]>([]);
    const [caption, setCaption] = useState('');
    const [currentEvent, setCurrentEvent] = useState<{
        id: string;
        name: string;
    } | null>(null);
    const [currentEventLoading, setCurrentEventLoading] = useState(true);
    const [visibility, setVisibility] = useState<Visibility>('visitor');
    const [visibilityResolved, setVisibilityResolved] = useState(false);
    const [status, setStatus] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureNotice, setCaptureNotice] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [pendingQueueCount, setPendingQueueCount] = useState(0);

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
        window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
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
                setVisibility(profile?.role === 'visitor' ? 'visitor' : 'campus');
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
                if (videoRef.current) videoRef.current.srcObject = stream;
            } catch {
                setStatus('Unable to start camera.');
            }
        }
        void bootCamera();
        return () => stream?.getTracks().forEach((track) => track.stop());
    }, []);

    useEffect(() => {
        return () => {
            if (captureNoticeTimeoutRef.current) {
                window.clearTimeout(captureNoticeTimeoutRef.current);
            }
        };
    }, []);

    async function captureFrame() {
        if (isCapturing || uploading) return;
        if (!videoRef.current || !canvasRef.current) return;
        setIsCapturing(true);
        try {
            const imageData = await captureFrameAsDataUrl(videoRef.current, canvasRef.current);
            setCaptures((prev) => [...prev, imageData]);
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

    const captureButtonLabel = isCapturing ? 'Capturing...' : captureNotice ? 'Captured!' : 'Add Capture';

    async function uploadAll() {
        if (uploading) return;

        if (captures.length === 0) {
            setStatus('Capture at least one image.');
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
                setCaption('');
                return true;
            } catch (queueError) {
                setStatus(
                    `Failed to save offline queue: ${getErrorMessage(queueError, 'queue unavailable')}`,
                );
                return false;
            }
        }

        setUploading(true);
        try {
            if (!navigator.onLine) {
                await saveToOfflineQueue('Offline.');
                return;
            }

            await uploadBatchCaptures({
                captures,
                caption: cleanedCaption,
                visibility,
            });
            setStatus('Batch upload successful. No partial uploads were committed.');
            setCaptures([]);
            setCaption('');
            router.push('/feed');
        } catch (error) {
            const message = getErrorMessage(
                error,
                'Batch upload failed. Retry to upload all captures together.',
            );
            await saveToOfflineQueue(`${message}.`);
        } finally {
            setUploading(false);
        }
    }

    return (
        <section className='-mx-4 -mt-6 grid gap-6 lg:mx-0 lg:mt-0 lg:grid-cols-[1.1fr_0.9fr]'>
            <article className='overflow-hidden bg-white shadow-sm lg:rounded-3xl lg:border lg:border-slate-200'>
                <div className='relative h-[100dvh] bg-slate-900 lg:aspect-[4/3] lg:h-auto'>
                    <video ref={videoRef} autoPlay playsInline muted className='h-full w-full object-cover' />
                    <div className='absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-slate-900/90 via-slate-900/55 to-transparent p-4 lg:hidden'>
                        <p className='text-xs font-semibold text-white'>
                            Captures: <span className='font-bold'>{captures.length}</span>
                        </p>
                        <button
                            type='button'
                            onClick={() => void captureFrame()}
                            disabled={uploading || isCapturing}
                            className='rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {captureButtonLabel}
                        </button>
                    </div>
                </div>
                <div className='hidden items-center justify-between gap-3 p-4 lg:flex'>
                    <p className='text-sm text-slate-600'>
                        Captures: <span className='font-semibold text-slate-900'>{captures.length}</span>
                    </p>
                    <button
                        type='button'
                        onClick={() => void captureFrame()}
                        disabled={uploading || isCapturing}
                        className='rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                        {captureButtonLabel}
                    </button>
                </div>
            </article>

            <article className='space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5'>
                <h2 className='text-lg font-bold'>Batch Preview</h2>
                <div className='grid max-h-64 grid-cols-3 gap-2 overflow-auto rounded-2xl border border-slate-200 p-2'>
                    {captures.map((image, index) => (
                        <Image
                            key={`${image}-${index}`}
                            src={image}
                            alt='Captured'
                            width={300}
                            height={300}
                            unoptimized
                            className='aspect-square rounded-xl object-cover'
                        />
                    ))}
                    {captures.length === 0 ? (
                        <p className='col-span-3 py-6 text-center text-sm text-slate-500'>No captures yet.</p>
                    ) : null}
                </div>
                <textarea
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    disabled={uploading}
                    placeholder='Caption (required)'
                    className='min-h-24 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                />
                <div className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700'>
                    <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500'>
                        Current event tag
                    </p>
                    <p className='mt-1 font-semibold text-slate-900'>
                        {currentEventLoading
                            ? 'Loading...'
                            : currentEvent?.name ?? 'Not set by admin'}
                    </p>
                </div>
                <p className='text-xs text-slate-500'>
                    Event tags are managed by admin. Every feed post is auto-tagged with the current event.
                </p>
                <p className='text-xs text-slate-500'>
                    Visibility: <span className='font-semibold capitalize'>{visibility}</span>
                </p>
                <p className='text-xs text-slate-500'>
                    Pending uploads: <span className='font-semibold'>{pendingQueueCount}</span>
                </p>
                <button
                    type='button'
                    onClick={() => void uploadAll()}
                    disabled={uploading || caption.trim().length === 0}
                    className='w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                >
                    {uploading ? 'Posting...' : 'Upload All'}
                </button>
                {status ? <p className='text-sm text-slate-700'>{status}</p> : null}
            </article>
            <canvas ref={canvasRef} className='hidden' />
        </section>
    );
}
