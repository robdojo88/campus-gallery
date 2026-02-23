'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { FeedLoader } from '@/components/feed/feed-loader';
import { AppShell } from '@/components/layout/app-shell';
import { PostCard } from '@/components/feed/post-card';
import { PageHeader } from '@/components/ui/page-header';
import { getErrorMessage } from '@/lib/error-message';
import { fetchPosts, subscribeToPosts } from '@/lib/supabase';
import type { Post } from '@/lib/types';

export default function FeedPage() {
    const [campusPosts, setCampusPosts] = useState<Post[]>([]);
    const [status, setStatus] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function load(showLoader = false) {
            if (showLoader && mounted) {
                setLoading(true);
                setStatus('');
            }
            try {
                const data = await fetchPosts({ visibility: 'campus' });
                if (!mounted) return;
                setCampusPosts(data);
                setStatus(data.length === 0 ? 'No posts yet.' : '');
            } catch (error) {
                if (!mounted) return;
                const message = getErrorMessage(error, 'Failed to load feed.');
                setStatus(message);
            } finally {
                if (showLoader && mounted) {
                    setLoading(false);
                }
            }
        }

        void load(true);
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
                {loading ? <FeedLoader /> : null}
                {!loading && status ? (
                    <p className='mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>{status}</p>
                ) : null}
                <div className='grid gap-4 md:grid-cols-2'>
                    {campusPosts.map((post) => (
                        <PostCard key={`${post.id}-${post.likes}-${post.comments}`} post={post} />
                    ))}
                </div>
            </AppShell>
        </AuthGuard>
    );
}
