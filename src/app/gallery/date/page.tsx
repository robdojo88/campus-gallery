'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Card, CardBody, Chip } from '@heroui/react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchDateFolderCounts } from '@/lib/supabase';

export default function DateGalleryPage() {
    const [grouped, setGrouped] = useState<
        Array<{
            date: string;
            count: number;
            label: string;
            dominantEventName?: string;
            dominantEventCount?: number;
        }>
    >([]);
    const [status, setStatus] = useState('Loading folders...');

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
                <PageHeader
                    eyebrow='Folders'
                    title='Folders'
                    description='Auto-structured folders by year, month, and day for all captured media.'
                />
                {status ? (
                    <Card className='mb-4 border border-slate-200 bg-white'>
                        <CardBody className='p-4 text-sm text-slate-600'>
                            {status}
                        </CardBody>
                    </Card>
                ) : null}
                <Card className='border border-slate-200 bg-white shadow-sm'>
                    <CardBody className='p-5'>
                    <ul className='space-y-3'>
                        {grouped.map((item) => (
                            <li key={item.date}>
                                <Link
                                    href={`/gallery/date/${encodeURIComponent(item.date)}`}
                                    className='flex items-center justify-between rounded-2xl bg-slate-50 p-4 transition hover:bg-slate-100'
                                >
                                    <div>
                                        <p className='text-xs font-semibold uppercase tracking-wide text-slate-500'>
                                            Date
                                        </p>
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
            </AppShell>
        </AuthGuard>
    );
}
