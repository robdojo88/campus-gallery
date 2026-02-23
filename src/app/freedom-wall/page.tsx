'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { createFreedomPost, fetchFreedomPosts } from '@/lib/supabase';

export default function FreedomWallPage() {
    const [content, setContent] = useState('');
    const [items, setItems] = useState<Array<{ id: string; authorName: string; content: string; createdAt: string }>>([]);
    const [status, setStatus] = useState('Loading posts...');

    useEffect(() => {
        let mounted = true;
        fetchFreedomPosts()
            .then((data) => {
                if (!mounted) return;
                setItems(data);
                setStatus(data.length === 0 ? 'No freedom wall posts yet.' : '');
            })
            .catch((error: unknown) => {
                if (!mounted) return;
                const message = error instanceof Error ? error.message : 'Failed to load freedom wall posts.';
                setStatus(message);
            });
        return () => {
            mounted = false;
        };
    }, []);

    async function submit() {
        try {
            await createFreedomPost(content);
            setContent('');
            const data = await fetchFreedomPosts();
            setItems(data);
            setStatus('Posted.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to post.';
            setStatus(message);
        }
    }

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Community'
                    title='Freedom Wall'
                    description='Moderated text-first space for open campus conversations with reactions and comments.'
                />
                <section className='mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <div className='flex gap-2'>
                        <input
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            placeholder='Share something with campus'
                            className='flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm'
                        />
                        <button
                            type='button'
                            onClick={() => void submit()}
                            className='rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500'
                        >
                            Post
                        </button>
                    </div>
                </section>
                {status ? <p className='mb-4 text-sm text-slate-600'>{status}</p> : null}
                <section className='space-y-4'>
                    {items.map((post) => (
                        <article key={post.id} className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                            <p className='text-sm font-semibold text-slate-800'>{post.authorName}</p>
                            <p className='mt-2 text-sm text-slate-700'>{post.content}</p>
                            <p className='mt-3 text-xs text-slate-500'>{new Date(post.createdAt).toLocaleString()}</p>
                        </article>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
