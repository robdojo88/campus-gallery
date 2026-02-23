'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { PostCard } from '@/components/feed/post-card';
import { PageHeader } from '@/components/ui/page-header';
import { fetchPosts } from '@/lib/supabase';
import type { Post } from '@/lib/types';

export default function VisitorGalleryPage() {
    const [visitorPosts, setVisitorPosts] = useState<Post[]>([]);
    const [status, setStatus] = useState('Loading visitor gallery...');

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const data = await fetchPosts({ visibility: 'visitor' });
                if (!mounted) return;
                setVisitorPosts(data);
                setStatus(data.length === 0 ? 'No visitor posts yet.' : '');
            } catch (error) {
                if (!mounted) return;
                const message = error instanceof Error ? error.message : 'Failed to load visitor gallery.';
                setStatus(message);
            }
        }
        void load();
        return () => {
            mounted = false;
        };
    }, []);

    return (
        <AppShell>
            <PageHeader
                eyebrow='Visitors'
                title='Visitor Gallery'
                description='Separate gallery for visitor captures. Members can view and engage, but uploads here are visitor-only.'
            />
            <section className='grid gap-4 md:grid-cols-2'>
                {status ? <p className='md:col-span-2 text-sm text-slate-600'>{status}</p> : null}
                {visitorPosts.map((post) => (
                    <PostCard key={`${post.id}-${post.likes}-${post.comments}`} post={post} />
                ))}
            </section>
        </AppShell>
    );
}
