'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchPosts } from '@/lib/supabase';
import type { Post } from '@/lib/types';

export default function AdminUploadsPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [status, setStatus] = useState('Loading uploads...');

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchPosts();
                setPosts(data);
                setStatus(data.length === 0 ? 'No uploads yet.' : '');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load uploads.';
                setStatus(message);
            }
        }
        void load();
    }, []);

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <PageHeader
                    eyebrow='Admin'
                    title='Moderate Uploads'
                    description='Delete inappropriate content, review pending visitor media, and enforce policy.'
                />
                {status ? <p className='mb-3 text-sm text-slate-600'>{status}</p> : null}
                <section className='space-y-3'>
                    {posts.map((post) => (
                        <article key={post.id} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                            <div className='flex flex-wrap items-center justify-between gap-3'>
                                <p className='text-sm text-slate-700'>{post.caption ?? 'No caption'}</p>
                                <div className='flex gap-2'>
                                    <button className='rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-white'>
                                        Flag
                                    </button>
                                    <button className='rounded-lg bg-red-600 px-3 py-1 text-xs font-semibold text-white'>
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </article>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
