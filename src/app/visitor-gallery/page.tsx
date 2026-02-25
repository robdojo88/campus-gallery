'use client';

import { useEffect, useState } from 'react';
import { Card, CardBody } from '@heroui/react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PostCard } from '@/components/feed/post-card';
import { PageHeader } from '@/components/ui/page-header';
import { fetchPosts, getCurrentUserProfile } from '@/lib/supabase';
import type { Post, UserRole } from '@/lib/types';

export default function VisitorGalleryPage() {
    const [visitorPosts, setVisitorPosts] = useState<Post[]>([]);
    const [status, setStatus] = useState('Loading visitor gallery...');
    const [viewerRole, setViewerRole] = useState<UserRole | null>(null);

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
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load visitor gallery.';
                setStatus(message);
            }
        }
        void load();
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        getCurrentUserProfile()
            .then((profile) => {
                if (!mounted) return;
                setViewerRole(profile?.role ?? null);
            })
            .catch(() => {
                if (!mounted) return;
                setViewerRole(null);
            });
        return () => {
            mounted = false;
        };
    }, []);

    const effectiveStatus =
        visitorPosts.length === 0 && status === ''
            ? 'No visitor posts yet.'
            : status;

    return (
        <AuthGuard roles={['admin', 'member', 'visitor']}>
            <AppShell>
                <PageHeader
                    eyebrow='Visitors'
                    title='Visitor Gallery'
                    description='Feed-style visitor timeline. Like and comment interactions are hidden on this page.'
                />
                {effectiveStatus ? (
                    <Card className='mb-4 border border-slate-200 bg-white'>
                        <CardBody className='p-4 text-sm text-slate-600'>
                            {effectiveStatus}
                        </CardBody>
                    </Card>
                ) : null}
                <section className='mx-auto w-full max-w-3xl space-y-3'>
                    {visitorPosts.map((post) => (
                        <PostCard
                            key={`${post.id}-${post.likes}-${post.comments}`}
                            post={post}
                            showEngagement={false}
                            isAdminViewer={viewerRole === 'admin' ? true : null}
                            onPostDeleted={(deletedPostId) => {
                                setVisitorPosts((prev) =>
                                    prev.filter(
                                        (item) => item.id !== deletedPostId,
                                    ),
                                );
                            }}
                        />
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
