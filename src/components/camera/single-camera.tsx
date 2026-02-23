'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { captureFrameAsDataUrl, getHighResolutionStream } from '@/lib/camera-capture';
import { getErrorMessage } from '@/lib/error-message';
import { addPendingCapture } from '@/lib/offline-queue';
import { fetchEventOptions, getCurrentUserProfile, uploadBatchCaptures, uploadCapturedImage } from '@/lib/supabase';
import type { UserRole, Visibility } from '@/lib/types';

export function SingleCameraCapture() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const captureNoticeTimeoutRef = useRef<number | null>(null);
    const [captures, setCaptures] = useState<string[]>([]);
    const [activePreviewIndex, setActivePreviewIndex] = useState(0);
    const [caption, setCaption] = useState('');
    const [eventId, setEventId] = useState('');
    const [eventOptions, setEventOptions] = useState<Array<{ id: string; name: string }>>([]);
    const [eventsLoading, setEventsLoading] = useState(true);
    const [visibility, setVisibility] = useState<Visibility>('campus');
    const [role, setRole] = useState<UserRole | null>(null);
    const [online, setOnline] = useState(true);
    const [status, setStatus] = useState('');
    const [isCapturing, setIsCapturing] = useState(false);
    const [captureNotice, setCaptureNotice] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

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
        getCurrentUserProfile()
            .then((profile) => {
                if (!mounted || !profile) return;
                setRole(profile.role);
                if (profile.role === 'visitor') setVisibility('visitor');
                if (profile.role === 'member') setVisibility('campus');
            })
            .catch(() => {
                if (!mounted) return;
                setRole(null);
            });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        async function loadEvents() {
            try {
                const events = await fetchEventOptions();
                if (!mounted) return;
                setEventOptions(events);
            } catch {
                if (!mounted) return;
                setEventOptions([]);
            } finally {
                if (mounted) setEventsLoading(false);
            }
        }
        void loadEvents();
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
        () => (online ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-700'),
        [online],
    );
    const visibilityOptions = useMemo(() => {
        if (role === 'visitor') return ['visitor'] as const;
        if (role === 'member') return ['campus'] as const;
        return ['campus', 'visitor'] as const;
    }, [role]);
    const captureButtonLabel = isCapturing ? 'Capturing...' : captureNotice ? 'Captured!' : 'Capture';

    async function capture() {
        if (isCapturing || isSubmitting) return;
        if (!videoRef.current || !canvasRef.current) return;
        setIsCapturing(true);
        try {
            const next = await captureFrameAsDataUrl(videoRef.current, canvasRef.current);
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
        setCaptures((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
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

        if (!online) {
            await Promise.all(
                captures.map((capture) =>
                    addPendingCapture({
                        id: crypto.randomUUID(),
                        imageDataUrl: capture,
                        caption,
                        visibility,
                        eventId: eventId || undefined,
                        createdAt: new Date().toISOString(),
                    }),
                ),
            );
            setStatus(
                `Offline - saved ${captures.length} capture${captures.length > 1 ? 's' : ''} locally. Upload will auto-resume when online.`,
            );
            setCaptures([]);
            setActivePreviewIndex(0);
            setCaption('');
            setEventId('');
            return;
        }

        setIsSubmitting(true);
        try {
            if (captures.length === 1) {
                await uploadCapturedImage(captures[0], {
                    caption,
                    visibility,
                    eventId: eventId || undefined,
                });
            } else {
                await uploadBatchCaptures({
                    captures,
                    caption,
                    visibility,
                    eventId: eventId || undefined,
                });
            }
            setStatus(`Uploaded ${captures.length} capture${captures.length > 1 ? 's' : ''} as one post.`);
            setCaptures([]);
            setActivePreviewIndex(0);
            setCaption('');
            setEventId('');
            router.push('/feed');
        } catch (error) {
            setStatus(getErrorMessage(error, 'Upload failed.'));
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <section className='-mx-4 -mt-6 grid gap-6 lg:mx-0 lg:mt-0 lg:grid-cols-[1.2fr_0.8fr]'>
            <article className='overflow-hidden bg-white shadow-sm lg:rounded-3xl lg:border lg:border-slate-200'>
                <div className='relative h-[100dvh] w-full bg-slate-900 lg:aspect-[4/3] lg:h-auto'>
                    <video ref={videoRef} autoPlay playsInline muted className='h-full w-full object-cover' />
                    <div className='absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-slate-900/90 via-slate-900/55 to-transparent p-4 lg:hidden'>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${networkClass}`}>
                            {online ? 'Online' : 'Offline'}
                        </span>
                        <div className='flex items-center gap-2'>
                            <p className='text-xs font-semibold text-white'>Captured: {captures.length}</p>
                            <button
                                type='button'
                                onClick={() => void capture()}
                                disabled={isSubmitting || isCapturing}
                                className='rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {captureButtonLabel}
                            </button>
                        </div>
                    </div>
                </div>
                <div className='hidden items-center justify-between gap-3 p-4 lg:flex'>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${networkClass}`}>
                        {online ? 'Online - instant upload' : 'Offline - queue enabled'}
                    </span>
                    <div className='flex items-center gap-2'>
                        <p className='text-xs font-semibold text-slate-200'>Captured: {captures.length}</p>
                        <button
                            type='button'
                            onClick={() => void capture()}
                            disabled={isSubmitting || isCapturing}
                            className='rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {captureButtonLabel}
                        </button>
                    </div>
                </div>
            </article>

            <article className='space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm md:p-5'>
                <h2 className='text-lg font-bold'>Preview and Submit Post</h2>
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
                        Capture from the live camera feed. You can add multiple images into one post.
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
                                        activePreviewIndex === index ? 'border-cyan-600' : 'border-slate-300'
                                    }`}
                                >
                                    <Image src={image} alt={`Capture ${index + 1}`} fill unoptimized className='object-cover' />
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
                    placeholder='Optional caption'
                    className='min-h-24 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                />
                <div className='grid gap-3 sm:grid-cols-2'>
                    <select
                        value={visibility}
                        onChange={(event) => setVisibility(event.target.value as Visibility)}
                        disabled={visibilityOptions.length === 1 || isSubmitting}
                        className='rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                    >
                        {visibilityOptions.map((option) => (
                            <option key={option} value={option}>
                                {option === 'campus' ? 'Campus visibility' : 'Visitor visibility'}
                            </option>
                        ))}
                    </select>
                    <select
                        value={eventId}
                        onChange={(event) => setEventId(event.target.value)}
                        disabled={isSubmitting || eventsLoading}
                        className='rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                    >
                        <option value=''>
                            {eventsLoading ? 'Loading events...' : 'No specific event'}
                        </option>
                        {eventOptions.map((eventOption) => (
                            <option key={eventOption.id} value={eventOption.id}>
                                {eventOption.name}
                            </option>
                        ))}
                    </select>
                </div>
                <p className='text-xs text-slate-500'>Assign an event so this post appears in Event folders and Date folder tags.</p>
                <button
                    type='button'
                    onClick={() => void submitCapture()}
                    disabled={isSubmitting}
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
                {status ? <p className='text-sm text-slate-700'>{status}</p> : null}
                {role === 'visitor' ? (
                    <p className='text-xs text-slate-500'>Visitor accounts can only publish to visitor visibility.</p>
                ) : null}
                <p className='text-xs text-slate-500'>
                    File upload from device is intentionally disabled. Only live camera capture is supported.
                </p>
            </article>
            <canvas ref={canvasRef} className='hidden' />
        </section>
    );
}
