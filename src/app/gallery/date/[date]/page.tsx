'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchDateFolderPosts } from '@/lib/supabase';

type DateFolderImage = {
    id: string;
    imageUrl: string;
    authorName: string;
    eventName?: string;
    capturedAt: string;
};

function formatDateLabel(dateKey: string): string {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return dateKey;
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

export default function DateFolderDetailPage() {
    const params = useParams<{ date: string }>();
    const folderDate = decodeURIComponent(Array.isArray(params?.date) ? params.date[0] : params?.date ?? '');
    const [images, setImages] = useState<DateFolderImage[]>([]);
    const [status, setStatus] = useState('Loading folder...');
    const [activeImageIndex, setActiveImageIndex] = useState<number | null>(null);

    const folderLabel = useMemo(() => formatDateLabel(folderDate), [folderDate]);

    useEffect(() => {
        let mounted = true;
        async function load() {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(folderDate)) {
                setImages([]);
                setStatus('Invalid date folder.');
                return;
            }

            try {
                const posts = await fetchDateFolderPosts(folderDate);
                if (!mounted) return;

                const flattened = posts.flatMap((post) => {
                    const authorName = post.author?.name ?? 'Unknown';
                    const capturedAt = new Date(post.createdAt).toLocaleString();
                    const postImages = post.images.length > 0 ? post.images : [post.imageUrl];

                    return postImages.map((imageUrl, index) => ({
                        id: `${post.id}-${index}`,
                        imageUrl,
                        authorName,
                        eventName: post.eventName,
                        capturedAt,
                    }));
                });

                setImages(flattened);
                setStatus(flattened.length === 0 ? 'No captures in this date folder yet.' : '');
            } catch (error) {
                if (!mounted) return;
                const message = error instanceof Error ? error.message : 'Failed to load date folder.';
                setStatus(message);
            }
        }

        void load();
        return () => {
            mounted = false;
        };
    }, [folderDate]);

    useEffect(() => {
        if (activeImageIndex === null) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setActiveImageIndex(null);
            }
            if (images.length > 0 && event.key === 'ArrowRight') {
                setActiveImageIndex((current) => {
                    if (current === null) return null;
                    return (current + 1) % images.length;
                });
            }
            if (images.length > 0 && event.key === 'ArrowLeft') {
                setActiveImageIndex((current) => {
                    if (current === null) return null;
                    return (current - 1 + images.length) % images.length;
                });
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [activeImageIndex, images.length]);

    function openImage(index: number) {
        setActiveImageIndex(index);
    }

    function closeLightbox() {
        setActiveImageIndex(null);
    }

    function showNextImage() {
        setActiveImageIndex((current) => {
            if (current === null || images.length === 0) return null;
            return (current + 1) % images.length;
        });
    }

    function showPreviousImage() {
        setActiveImageIndex((current) => {
            if (current === null || images.length === 0) return null;
            return (current - 1 + images.length) % images.length;
        });
    }

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Folders'
                    title='Date Folder'
                    description={`Showing all captures for ${folderLabel}.`}
                    action={
                        <Link
                            href='/gallery/date'
                            className='rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                        >
                            Back to Date Folders
                        </Link>
                    }
                />

                {status ? <p className='mb-4 text-sm text-slate-600'>{status}</p> : null}

                <section className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                    {images.map((item, index) => (
                        <article
                            key={item.id}
                            className='overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm'
                        >
                            <button
                                type='button'
                                onClick={() => openImage(index)}
                                className='relative block aspect-square w-full'
                            >
                                <Image src={item.imageUrl} alt={`Capture by ${item.authorName}`} fill className='object-cover' />
                                <div className='absolute left-2 top-2 flex flex-wrap items-center gap-1'>
                                    <span className='rounded-full bg-black/70 px-2 py-1 text-[11px] font-semibold text-white'>
                                        {item.authorName}
                                    </span>
                                    {item.eventName ? (
                                        <span className='rounded-full bg-cyan-700/90 px-2 py-1 text-[11px] font-semibold text-white'>
                                            {item.eventName}
                                        </span>
                                    ) : null}
                                </div>
                                <span className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 text-[11px] text-white'>
                                    {item.capturedAt}
                                </span>
                            </button>
                        </article>
                    ))}
                </section>

                {activeImageIndex !== null && images[activeImageIndex] ? (
                    <div
                        className='fixed inset-0 z-[100] bg-black/90 p-3 md:p-6'
                        onClick={(event) => {
                            if (event.target === event.currentTarget) closeLightbox();
                        }}
                    >
                        <button
                            type='button'
                            onClick={closeLightbox}
                            className='absolute right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30'
                        >
                            Close
                        </button>
                        {images.length > 1 ? (
                            <>
                                <button
                                    type='button'
                                    onClick={showPreviousImage}
                                    className='absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30'
                                >
                                    {'<'}
                                </button>
                                <button
                                    type='button'
                                    onClick={showNextImage}
                                    className='absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/20 px-3 py-2 text-xl text-white hover:bg-white/30'
                                >
                                    {'>'}
                                </button>
                            </>
                        ) : null}
                        <div className='flex h-full items-center justify-center' onClick={closeLightbox}>
                            <div className='max-h-full max-w-full' onClick={(event) => event.stopPropagation()}>
                                <Image
                                    src={images[activeImageIndex].imageUrl}
                                    alt={`Capture by ${images[activeImageIndex].authorName}`}
                                    width={2200}
                                    height={1600}
                                    className='max-h-[84vh] w-auto max-w-[94vw] object-contain'
                                />
                            </div>
                        </div>
                        <div className='absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-semibold text-white'>
                            {images[activeImageIndex].eventName
                                ? `${images[activeImageIndex].authorName} - ${images[activeImageIndex].eventName}`
                                : images[activeImageIndex].authorName}
                        </div>
                    </div>
                ) : null}
            </AppShell>
        </AuthGuard>
    );
}
