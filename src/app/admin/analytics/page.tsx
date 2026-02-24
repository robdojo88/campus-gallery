'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchAdminStats } from '@/lib/supabase';

export default function AdminAnalyticsPage() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        campusPosts: 0,
        visitorPosts: 0,
        approvedReviews: 0,
    });
    const [status, setStatus] = useState('Loading analytics...');

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchAdminStats();
                setStats(data);
                setStatus('');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load analytics.';
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
                    title='Analytics'
                    description='Operational and engagement snapshot across users, uploads, and moderation streams.'
                />
                {status ? <p className='mb-3 text-sm text-slate-600'>{status}</p> : null}
                <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                    <article className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                        <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>Total Users</p>
                        <p className='mt-2 text-3xl font-bold'>{stats.totalUsers}</p>
                    </article>
                    <article className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                        <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>Campus Posts</p>
                        <p className='mt-2 text-3xl font-bold'>{stats.campusPosts}</p>
                    </article>
                    <article className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                        <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>Visitor Posts</p>
                        <p className='mt-2 text-3xl font-bold'>{stats.visitorPosts}</p>
                    </article>
                    <article className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                        <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>Approved Feedback</p>
                        <p className='mt-2 text-3xl font-bold'>{stats.approvedReviews}</p>
                    </article>
                </section>
            </AppShell>
        </AuthGuard>
    );
}
