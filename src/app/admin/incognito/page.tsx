'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchIncognitoPosts } from '@/lib/supabase';

export default function AdminIncognitoPage() {
    const [posts, setPosts] = useState<Array<{ id: string; content: string; createdAt: string; authorId?: string }>>([]);
    const [status, setStatus] = useState('Loading incognito posts...');

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchIncognitoPosts();
                setPosts(data);
                setStatus(data.length === 0 ? 'No anonymous posts yet.' : '');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load incognito posts.';
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
                    title='Incognito Moderation'
                    description='Admin-only mapping of anonymous posts to internal user identities.'
                />
                {status ? <p className='mb-3 text-sm text-slate-600'>{status}</p> : null}
                <section className='space-y-4'>
                    {posts.map((post) => (
                        <article key={post.id} className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                            <p className='text-sm font-semibold text-slate-800'>Public: Anonymous</p>
                            <p className='text-xs text-slate-500'>Internal author id: {post.authorId ?? 'Hidden'}</p>
                            <p className='mt-2 text-sm text-slate-700'>{post.content}</p>
                        </article>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
