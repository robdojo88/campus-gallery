'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { createIncognitoPost, fetchIncognitoPosts } from '@/lib/supabase';

export default function IncognitoPage() {
    const [content, setContent] = useState('');
    const [items, setItems] = useState<Array<{ id: string; content: string; createdAt: string; authorId?: string }>>([]);
    const [status, setStatus] = useState('Loading anonymous posts...');

    useEffect(() => {
        let mounted = true;
        fetchIncognitoPosts()
            .then((data) => {
                if (!mounted) return;
                setItems(data);
                setStatus(data.length === 0 ? 'No anonymous posts yet.' : '');
            })
            .catch((error: unknown) => {
                if (!mounted) return;
                const message = error instanceof Error ? error.message : 'Failed to load anonymous posts.';
                setStatus(message);
            });
        return () => {
            mounted = false;
        };
    }, []);

    async function submit() {
        try {
            await createIncognitoPost(content);
            setContent('');
            const data = await fetchIncognitoPosts();
            setItems(data);
            setStatus('Anonymous post submitted.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to post anonymously.';
            setStatus(message);
        }
    }

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Anonymous'
                    title='Incognito Page'
                    description='Members can post anonymously. Public view hides identity while admins can moderate safely.'
                />
                <section className='mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <div className='flex gap-2'>
                        <input
                            value={content}
                            onChange={(event) => setContent(event.target.value)}
                            placeholder='Write an anonymous note'
                            className='flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm'
                        />
                        <button
                            type='button'
                            onClick={() => void submit()}
                            className='rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700'
                        >
                            Post
                        </button>
                    </div>
                </section>
                {status ? <p className='mb-4 text-sm text-slate-600'>{status}</p> : null}
                <section className='space-y-4'>
                    {items.map((post) => (
                        <article key={post.id} className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                            <p className='text-sm font-semibold text-slate-800'>Anonymous</p>
                            {post.authorId ? <p className='text-xs text-slate-500'>Admin view: {post.authorId}</p> : null}
                            <p className='mt-2 text-sm text-slate-700'>{post.content}</p>
                            <p className='mt-3 text-xs text-slate-500'>{new Date(post.createdAt).toLocaleString()}</p>
                        </article>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
