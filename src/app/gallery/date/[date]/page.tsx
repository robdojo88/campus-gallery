'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Button, Card, CardBody, Chip } from '@heroui/react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader } from '@/components/ui/page-header';
import {
    DATE_FOLDER_TIME_ZONE,
    fetchDateFolderPosts,
    getCurrentUserProfile,
    logAdminAuditAction,
} from '@/lib/supabase';
import type { UserRole } from '@/lib/types';

type DateFolderImage = {
    id: string;
    imageUrl: string;
    authorName: string;
    eventName?: string;
    capturedAt: string;
};

function formatDateLabel(dateKey: string): string {
    const [yearRaw, monthRaw, dayRaw] = dateKey.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const day = Number(dayRaw);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return dateKey;
    }

    const strictDate = new Date(Date.UTC(year, month - 1, day));
    if (
        Number.isNaN(strictDate.getTime()) ||
        strictDate.getUTCFullYear() !== year ||
        strictDate.getUTCMonth() !== month - 1 ||
        strictDate.getUTCDate() !== day
    ) {
        return dateKey;
    }

    // Noon UTC avoids edge cases around DST boundaries.
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    if (Number.isNaN(date.getTime())) {
        return dateKey;
    }

    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: DATE_FOLDER_TIME_ZONE,
    });
}

function sanitizeFilenamePart(value: string): string {
    const cleaned = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return cleaned || 'capture';
}

function inferFileExtension(imageUrl: string, mimeType: string): string {
    if (mimeType.startsWith('image/')) {
        const typeSuffix = mimeType.slice('image/'.length).toLowerCase();
        if (typeSuffix === 'jpeg') return 'jpg';
        if (typeSuffix) return typeSuffix;
    }

    const withoutQuery = imageUrl.split('?')[0] ?? imageUrl;
    const match = withoutQuery.match(/\.([a-zA-Z0-9]{2,5})$/);
    return match?.[1]?.toLowerCase() ?? 'jpg';
}

export default function DateFolderDetailPage() {
    const params = useParams<{ date: string }>();
    const folderDate = decodeURIComponent(
        Array.isArray(params?.date) ? params.date[0] : (params?.date ?? ''),
    );
    const [images, setImages] = useState<DateFolderImage[]>([]);
    const [status, setStatus] = useState('Loading folder...');
    const [downloadStatus, setDownloadStatus] = useState('');
    const [downloadingAll, setDownloadingAll] = useState(false);
    const [confirmDownloadOpen, setConfirmDownloadOpen] = useState(false);
    const [role, setRole] = useState<UserRole | null>(null);
    const [activeImageIndex, setActiveImageIndex] = useState<number | null>(
        null,
    );

    const folderLabel = useMemo(
        () => formatDateLabel(folderDate),
        [folderDate],
    );

    useEffect(() => {
        let mounted = true;
        getCurrentUserProfile()
            .then((profile) => {
                if (!mounted) return;
                setRole(profile?.role ?? null);
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
                    const capturedAt = new Date(
                        post.createdAt,
                    ).toLocaleString(undefined, {
                        timeZone: DATE_FOLDER_TIME_ZONE,
                    });
                    const postImages =
                        post.images.length > 0 ? post.images : [post.imageUrl];

                    return postImages.map((imageUrl, index) => ({
                        id: `${post.id}-${index}`,
                        imageUrl,
                        authorName,
                        eventName: post.eventName,
                        capturedAt,
                    }));
                });

                setImages(flattened);
                setStatus(
                    flattened.length === 0
                        ? 'No captures in this date folder yet.'
                        : '',
                );
            } catch (error) {
                if (!mounted) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load date folder.';
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

    async function onDownloadAllImages() {
        if (downloadingAll || images.length === 0) return;

        setDownloadingAll(true);
        setDownloadStatus('');

        try {
            const JSZip = (await import('jszip')).default;
            const zip = new JSZip();

            for (let index = 0; index < images.length; index += 1) {
                const item = images[index];
                setDownloadStatus(
                    `Adding image ${index + 1} of ${images.length}...`,
                );

                const response = await fetch(item.imageUrl);
                if (!response.ok) {
                    throw new Error(`Failed to download image ${index + 1}.`);
                }

                const blob = await response.blob();
                const extension = inferFileExtension(item.imageUrl, blob.type);
                const filename = `${folderDate}-${String(index + 1).padStart(3, '0')}-${sanitizeFilenamePart(item.authorName)}.${extension}`;
                const content = await blob.arrayBuffer();
                zip.file(filename, content, { binary: true });
            }

            setDownloadStatus('Building ZIP file...');
            const zipBlob = await zip.generateAsync({
                type: 'blob',
                compression: 'STORE',
            });
            const objectUrl = URL.createObjectURL(zipBlob);
            const archiveName = `date-folder-${folderDate}.zip`;
            const anchor = document.createElement('a');
            anchor.href = objectUrl;
            anchor.download = archiveName;
            anchor.rel = 'noopener';
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);

            setDownloadStatus(
                `Downloaded ${archiveName} with ${images.length} image(s).`,
            );

            if (role === 'admin') {
                try {
                    await logAdminAuditAction({
                        action: 'gallery_images_downloaded',
                        details: {
                            folderDate,
                            archiveName,
                            imageCount: images.length,
                        },
                    });
                } catch {
                    // Keep download successful even if audit logging is unavailable.
                }
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to download folder images.';
            setDownloadStatus(message);
        } finally {
            setDownloadingAll(false);
        }
    }

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <div className='mx-auto w-full max-w-4xl'>
                    <PageHeader
                        eyebrow='Folders'
                        title='Date Folder'
                        description={`Showing all captures for ${folderLabel}.`}
                        action={
                            <div className='flex flex-wrap items-center justify-end gap-2'>
                                {role === 'admin' ? (
                                    <Button
                                        onClick={() =>
                                            setConfirmDownloadOpen(true)
                                        }
                                        isDisabled={
                                            downloadingAll ||
                                            images.length === 0
                                        }
                                        variant='flat'
                                        color='primary'
                                        className='font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-colors duration-150 hover:bg-cyan-100'
                                    >
                                        {downloadingAll
                                            ? 'Downloading...'
                                            : 'Download All Images'}
                                    </Button>
                                ) : null}
                                <Button
                                    as={Link}
                                    href='/gallery/date'
                                    variant='bordered'
                                    className='font-semibold text-slate-700 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors duration-150'
                                >
                                    Back to Date Folders
                                </Button>
                            </div>
                        }
                    />

                    {status ? (
                        <Card className='mb-4 border border-slate-200 bg-white'>
                            <CardBody className='p-4 text-sm text-slate-600'>
                                {status}
                            </CardBody>
                        </Card>
                    ) : null}
                    {downloadStatus ? (
                        <Card className='mb-4 border border-slate-200 bg-white'>
                            <CardBody className='p-4 text-sm text-slate-600'>
                                {downloadStatus}
                            </CardBody>
                        </Card>
                    ) : null}

                    <section className='grid gap-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
                        {images.map((item, index) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0.35, y: 8, scale: 0.99 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                transition={{
                                    duration: 0.22,
                                    ease: 'easeOut',
                                    delay: Math.min(index * 0.04, 0.24),
                                }}
                            >
                                <Card className='overflow-hidden border border-slate-200 bg-white shadow-sm '>
                                    <button
                                        type='button'
                                        onClick={() => openImage(index)}
                                        className='relative block aspect-square w-full'
                                    >
                                        <Image
                                            src={item.imageUrl}
                                            alt={`Capture by ${item.authorName}`}
                                            fill
                                            className='object-cover'
                                        />
                                        <div className='absolute left-2 top-2 flex flex-wrap items-center gap-1'>
                                            <Chip
                                                size='sm'
                                                className='bg-black/70 text-[11px] font-semibold text-white'
                                            >
                                                {item.authorName}
                                            </Chip>
                                            {item.eventName ? (
                                                <Chip
                                                    size='sm'
                                                    className='bg-cyan-700/90 text-[11px] font-semibold text-white'
                                                >
                                                    {item.eventName}
                                                </Chip>
                                            ) : null}
                                        </div>
                                        <span className='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-2 text-[11px] text-white'>
                                            {item.capturedAt}
                                        </span>
                                    </button>
                                </Card>
                            </motion.div>
                        ))}
                    </section>
                </div>

                {activeImageIndex !== null && images[activeImageIndex] ? (
                    <div
                        className='fixed inset-0 z-[100] bg-black/90 p-3 md:p-6'
                        onClick={(event) => {
                            if (event.target === event.currentTarget)
                                closeLightbox();
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
                        <div
                            className='flex h-full items-center justify-center'
                            onClick={closeLightbox}
                        >
                            <div
                                className='max-h-full max-w-full'
                                onClick={(event) => event.stopPropagation()}
                            >
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
                <ConfirmDialog
                    open={confirmDownloadOpen}
                    title='Download all images in this folder?'
                    description={`This will create one ZIP file with ${images.length} original image(s).`}
                    confirmLabel='Download ZIP'
                    busy={downloadingAll}
                    onCancel={() => {
                        if (downloadingAll) return;
                        setConfirmDownloadOpen(false);
                    }}
                    onConfirm={() => {
                        setConfirmDownloadOpen(false);
                        void onDownloadAllImages();
                    }}
                />
            </AppShell>
        </AuthGuard>
    );
}
