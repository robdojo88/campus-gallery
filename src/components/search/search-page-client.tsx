'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { getErrorMessage } from '@/lib/error-message';
import { searchGlobalContent } from '@/lib/supabase';
import type { GlobalSearchResults } from '@/lib/types';

const EMPTY_RESULTS: GlobalSearchResults = {
    users: [],
    events: [],
    dates: [],
    posts: [],
};

export function SearchPageClient({ query }: { query: string }) {
    const normalizedQuery = query.trim();
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [results, setResults] = useState<GlobalSearchResults>(EMPTY_RESULTS);

    const totalResults = useMemo(() => {
        return (
            results.users.length +
            results.events.length +
            results.dates.length +
            results.posts.length
        );
    }, [results]);

    useEffect(() => {
        let mounted = true;
        async function load() {
            if (normalizedQuery.length < 2) {
                setResults(EMPTY_RESULTS);
                setStatus('Type at least 2 characters to search.');
                return;
            }

            setLoading(true);
            setStatus('');
            try {
                const data = await searchGlobalContent(normalizedQuery, {
                    limit: 12,
                });
                if (!mounted) return;
                setResults(data);
                if (
                    data.users.length +
                        data.events.length +
                        data.dates.length +
                        data.posts.length ===
                    0
                ) {
                    setStatus('No matching results found.');
                }
            } catch (error) {
                if (!mounted) return;
                setStatus(getErrorMessage(error, 'Search failed.'));
            } finally {
                if (mounted) setLoading(false);
            }
        }

        void load();
        return () => {
            mounted = false;
        };
    }, [normalizedQuery]);

    return (
        <AuthGuard>
            <AppShell>
                <PageHeader
                    eyebrow='Global Search'
                    title={
                        normalizedQuery
                            ? `Results for "${normalizedQuery}"`
                            : 'Search'
                    }
                    description='Find users, event tags, date folders, and matching post captions across Campus Gallery.'
                />

                {loading ? (
                    <section className='space-y-3'>
                        <div className='h-24 animate-pulse rounded-2xl border border-slate-200 bg-white' />
                        <div className='h-24 animate-pulse rounded-2xl border border-slate-200 bg-white' />
                        <div className='h-24 animate-pulse rounded-2xl border border-slate-200 bg-white' />
                    </section>
                ) : null}

                {!loading && status ? (
                    <p className='rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>
                        {status}
                    </p>
                ) : null}

                {!loading && totalResults > 0 ? (
                    <div className='space-y-5'>
                        {results.users.length > 0 ? (
                            <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                                <h2 className='text-sm font-semibold text-slate-900'>
                                    Users
                                </h2>
                                <div className='mt-3 grid gap-2'>
                                    {results.users.map((user) => (
                                        <Link
                                            key={user.id}
                                            href={`/profile/${user.id}`}
                                            className='flex items-center gap-3 rounded-xl p-2 transition hover:bg-slate-50'
                                        >
                                            <span className='relative h-10 w-10 overflow-hidden rounded-full border border-slate-200 bg-slate-100'>
                                                <Image
                                                    src={user.avatarUrl}
                                                    alt={user.name}
                                                    fill
                                                    className='object-cover'
                                                    sizes='40px'
                                                />
                                            </span>
                                            <span>
                                                <p className='text-sm font-semibold text-slate-900'>
                                                    {user.name}
                                                </p>
                                                <p className='text-xs text-slate-500'>
                                                    {user.email}
                                                </p>
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {results.events.length > 0 ? (
                            <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                                <h2 className='text-sm font-semibold text-slate-900'>
                                    Events
                                </h2>
                                <div className='mt-3 grid gap-2'>
                                    {results.events.map((event) => (
                                        <Link
                                            key={event.id}
                                            href={`/gallery/events?event=${event.id}`}
                                            className='rounded-xl p-2 transition hover:bg-slate-50'
                                        >
                                            <p className='text-sm font-semibold text-slate-900'>
                                                {event.name}
                                            </p>
                                            {event.description ? (
                                                <p className='text-xs text-slate-500'>
                                                    {event.description}
                                                </p>
                                            ) : null}
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {results.dates.length > 0 ? (
                            <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                                <h2 className='text-sm font-semibold text-slate-900'>
                                    Date Folders
                                </h2>
                                <div className='mt-3 grid gap-2'>
                                    {results.dates.map((folder) => (
                                        <Link
                                            key={folder.date}
                                            href={`/gallery/date/${folder.date}`}
                                            className='flex items-center justify-between rounded-xl p-2 transition hover:bg-slate-50'
                                        >
                                            <span>
                                                <p className='text-sm font-semibold text-slate-900'>
                                                    {folder.label}
                                                </p>
                                                <p className='text-xs text-slate-500'>
                                                    {folder.date}
                                                </p>
                                            </span>
                                            <span className='rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700'>
                                                {folder.count}
                                            </span>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {results.posts.length > 0 ? (
                            <section className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                                <h2 className='text-sm font-semibold text-slate-900'>
                                    Posts
                                </h2>
                                <div className='mt-3 grid gap-3'>
                                    {results.posts.map((post) => (
                                        <Link
                                            key={post.id}
                                            href='/feed'
                                            className='flex gap-3 rounded-xl p-2 transition hover:bg-slate-50'
                                        >
                                            <div className='relative h-14 w-14 overflow-hidden rounded-xl border border-slate-200 bg-slate-100'>
                                                <Image
                                                    src={post.imageUrl}
                                                    alt={post.caption}
                                                    fill
                                                    className='object-cover'
                                                    sizes='56px'
                                                />
                                            </div>
                                            <div className='min-w-0'>
                                                <p className='line-clamp-2 text-sm font-semibold text-slate-900'>
                                                    {post.caption}
                                                </p>
                                                <p className='text-xs text-slate-500'>
                                                    {post.authorName}
                                                    {post.eventName
                                                        ? ` • ${post.eventName}`
                                                        : ''}
                                                </p>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            </section>
                        ) : null}
                    </div>
                ) : null}
            </AppShell>
        </AuthGuard>
    );
}
