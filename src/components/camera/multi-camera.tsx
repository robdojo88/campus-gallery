'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { captureFrameAsDataUrl, getHighResolutionStream } from '@/lib/camera-capture';
import { getErrorMessage } from '@/lib/error-message';
import { addPendingCapture } from '@/lib/offline-queue';
import { getCurrentUserProfile, uploadBatchCaptures } from '@/lib/supabase';
import type { Visibility } from '@/lib/types';

export function MultiCameraCapture() {
    const router = useRouter();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [captures, setCaptures] = useState<string[]>([]);
    const [caption, setCaption] = useState('');
    const [eventId, setEventId] = useState('');
    const [visibility, setVisibility] = useState<Visibility>('campus');
    const [status, setStatus] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        let mounted = true;
        getCurrentUserProfile()
            .then((profile) => {
                if (!mounted || !profile) return;
                setVisibility(profile.role === 'visitor' ? 'visitor' : 'campus');
            })
            .catch(() => {
                if (!mounted) return;
                setVisibility('campus');
            });
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

    async function captureFrame() {
        if (!videoRef.current || !canvasRef.current) return;
        try {
            const imageData = await captureFrameAsDataUrl(videoRef.current, canvasRef.current);
            setCaptures((prev) => [...prev, imageData]);
            setStatus('');
        } catch (error) {
            setStatus(getErrorMessage(error, 'Unable to capture image.'));
        }
    }

    async function uploadAll() {
        if (uploading) return;

        if (captures.length === 0) {
            setStatus('Capture at least one image.');
            return;
        }

        setUploading(true);
        try {
            if (!navigator.onLine) {
                await Promise.all(
                    captures.map((imageDataUrl) =>
                        addPendingCapture({
                            id: crypto.randomUUID(),
                            imageDataUrl,
                            caption,
                            visibility,
                            createdAt: new Date().toISOString(),
                        }),
                    ),
                );
                setStatus('Offline - batch saved locally as pending upload.');
                setCaptures([]);
                setCaption('');
                return;
            }

            await uploadBatchCaptures({
                captures,
                caption,
                visibility,
                eventId: eventId || undefined,
            });
            setStatus('Batch upload successful. No partial uploads were committed.');
            setCaptures([]);
            setCaption('');
            setEventId('');
            router.push('/feed');
        } catch (error) {
            setStatus(getErrorMessage(error, 'Batch upload failed. Retry to upload all captures together.'));
        } finally {
            setUploading(false);
        }
    }

    return (
        <section className='grid gap-6 lg:grid-cols-[1.1fr_0.9fr]'>
            <article className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm'>
                <div className='relative aspect-[4/3] bg-slate-900'>
                    <video ref={videoRef} autoPlay playsInline muted className='h-full w-full object-cover' />
                </div>
                <div className='flex items-center justify-between gap-3 p-4'>
                    <p className='text-sm text-slate-600'>
                        Captures: <span className='font-semibold text-slate-900'>{captures.length}</span>
                    </p>
                    <button
                        type='button'
                        onClick={() => void captureFrame()}
                        disabled={uploading}
                        className='rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-60'
                    >
                        Add Capture
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
                    placeholder='Optional caption for all captures'
                    className='min-h-24 w-full rounded-2xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                />
                <input
                    value={eventId}
                    onChange={(event) => setEventId(event.target.value)}
                    disabled={uploading}
                    placeholder='Optional event id'
                    className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                />
                <p className='text-xs text-slate-500'>
                    Visibility: <span className='font-semibold capitalize'>{visibility}</span>
                </p>
                <button
                    type='button'
                    onClick={() => void uploadAll()}
                    disabled={uploading}
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
