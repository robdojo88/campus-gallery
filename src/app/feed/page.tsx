'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PostCard } from '@/components/feed/post-card';
import { PageHeader } from '@/components/ui/page-header';
import { getErrorMessage } from '@/lib/error-message';
import { fetchPosts, subscribeToPosts } from '@/lib/supabase';
import type { Post } from '@/lib/types';

export default function FeedPage() {
    const [campusPosts, setCampusPosts] = useState<Post[]>([]);
    const [status, setStatus] = useState('Loading feed...');

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const data = await fetchPosts({ visibility: 'campus' });
                if (!mounted) return;
                setCampusPosts(data);
                setStatus(data.length === 0 ? 'No posts yet.' : '');
            } catch (error) {
                if (!mounted) return;
                const message = getErrorMessage(error, 'Failed to load feed.');
                setStatus(message);
            }
        }

        void load();
        const unsubscribe = subscribeToPosts(() => {
            void load();
        });
        return () => {
            mounted = false;
            unsubscribe();
        };
    }, []);

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Realtime Feed'
                    title='Campus Feed'
                    description='Live social feed for students, teachers, and staff. Sorted by latest or most liked.'
                />
                {status ? <p className='mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>{status}</p> : null}
                <div className='grid gap-4 md:grid-cols-2'>
                    {campusPosts.map((post) => (
                        <PostCard key={`${post.id}-${post.likes}-${post.comments}`} post={post} />
                    ))}
                </div>
            </AppShell>
        </AuthGuard>
    );
}
