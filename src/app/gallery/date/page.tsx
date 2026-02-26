'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card, CardBody, Chip } from '@heroui/react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { fetchDateFolderCounts } from '@/lib/supabase';

type DateFolderItem = {
    date: string;
    count: number;
    label: string;
    dominantEventName?: string;
    dominantEventCount?: number;
};

type DateFolderSortOption =
    | 'date-desc'
    | 'date-asc'
    | 'uploads-desc'
    | 'uploads-asc'
    | 'dominant-tag-asc'
    | 'dominant-tag-desc';

function compareDominantTag(a: DateFolderItem, b: DateFolderItem): number {
    const aHasTag = Boolean(a.dominantEventName);
    const bHasTag = Boolean(b.dominantEventName);

    if (aHasTag && !bHasTag) return -1;
    if (!aHasTag && bHasTag) return 1;

    const tagOrder = (a.dominantEventName ?? '').localeCompare(
        b.dominantEventName ?? '',
        undefined,
        { sensitivity: 'base' },
    );
    if (tagOrder !== 0) return tagOrder;

    return (b.dominantEventCount ?? 0) - (a.dominantEventCount ?? 0);
}

export default function DateGalleryPage() {
    const [grouped, setGrouped] = useState<DateFolderItem[]>([]);
    const [status, setStatus] = useState('Loading folders...');
    const [sortOption, setSortOption] =
        useState<DateFolderSortOption>('date-desc');

    const sortedGrouped = useMemo(() => {
        const items = [...grouped];
        items.sort((a, b) => {
            if (sortOption === 'date-desc') {
                return b.date.localeCompare(a.date);
            }
            if (sortOption === 'date-asc') {
                return a.date.localeCompare(b.date);
            }
            if (sortOption === 'uploads-desc') {
                return b.count - a.count || b.date.localeCompare(a.date);
            }
            if (sortOption === 'uploads-asc') {
                return a.count - b.count || a.date.localeCompare(b.date);
            }
            if (sortOption === 'dominant-tag-asc') {
                return compareDominantTag(a, b) || b.date.localeCompare(a.date);
            }
            return compareDominantTag(b, a) || b.date.localeCompare(a.date);
        });
        return items;
    }, [grouped, sortOption]);

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchDateFolderCounts();
                setGrouped(data);
                setStatus(data.length === 0 ? 'No date folders yet.' : '');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load date folders.';
                setStatus(message);
            }
        }
        void load();
    }, []);

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <div className='mx-auto w-full max-w-4xl '>
                    {/* <PageHeader
                        eyebrow='Folders'
                        title='Folders'
                        description='Auto-structured folders by year, month, and day for all captured media.'
                    /> */}
                    {status ? (
                        <Card className='mb-4 border border-slate-200 bg-white'>
                            <CardBody className='p-4 text-sm text-slate-600'>
                                {status}
                            </CardBody>
                        </Card>
                    ) : null}
                    <Card className='border border-slate-200 bg-white shadow-sm rounded-2xl'>
                        <CardBody className='p-5'>
                            <div className='mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3'>
                                <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                                    Sort Folders
                                </p>
                                <label className='inline-flex items-center gap-2 text-xs text-slate-600'>
                                    <span className='font-semibold'>
                                        By
                                    </span>
                                    <select
                                        value={sortOption}
                                        onChange={(event) =>
                                            setSortOption(
                                                event.target
                                                    .value as DateFolderSortOption,
                                            )
                                        }
                                        className='rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 outline-none focus:border-cyan-600'
                                    >
                                        <option value='date-desc'>
                                            Date (Newest first)
                                        </option>
                                        <option value='date-asc'>
                                            Date (Oldest first)
                                        </option>
                                        <option value='uploads-desc'>
                                            Uploads (Most first)
                                        </option>
                                        <option value='uploads-asc'>
                                            Uploads (Fewest first)
                                        </option>
                                        <option value='dominant-tag-asc'>
                                            Dominant Tag (A-Z)
                                        </option>
                                        <option value='dominant-tag-desc'>
                                            Dominant Tag (Z-A)
                                        </option>
                                    </select>
                                </label>
                            </div>
                            <ul className='space-y-3'>
                                {sortedGrouped.map((item) => (
                                    <li key={item.date}>
                                        <Link
                                            href={`/gallery/date/${encodeURIComponent(item.date)}`}
                                            className='flex items-center justify-between rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-100'
                                        >
                                            <div>
                                                {/* <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                                                    Date
                                                </p> */}
                                                <p className='mt-1 font-medium text-slate-800'>
                                                    {item.label}
                                                </p>
                                                {item.dominantEventName ? (
                                                    <Chip
                                                        size='sm'
                                                        variant='flat'
                                                        className='mt-2 bg-cyan-100 text-[11px] font-semibold text-cyan-800'
                                                    >
                                                        Dominant Tag:{' '}
                                                        {item.dominantEventName}
                                                        {item.dominantEventCount
                                                            ? ` (${item.dominantEventCount})`
                                                            : ''}
                                                    </Chip>
                                                ) : (
                                                    <Chip
                                                        size='sm'
                                                        variant='flat'
                                                        className='mt-2 bg-slate-200 text-[11px] font-semibold text-slate-700'
                                                    >
                                                        Dominant Tag: None
                                                    </Chip>
                                                )}
                                            </div>
                                            <Chip
                                                size='sm'
                                                className='bg-slate-900 text-xs font-semibold text-white'
                                            >
                                                {item.count} uploads
                                            </Chip>
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </CardBody>
                    </Card>
                </div>
            </AppShell>
        </AuthGuard>
    );
}
