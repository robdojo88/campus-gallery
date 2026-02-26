'use client';

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminPanelShell } from '@/components/admin/admin-panel-shell';
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
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load analytics.';
                setStatus(message);
            }
        }
        void load();
    }, []);

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <AdminPanelShell>
                    {/* <PageHeader
                        eyebrow='Admin workspace'
                        title='Analytics'
                        description='Track platform totals and engagement volumes with a cleaner at-a-glance dashboard.'
                    /> */}
                    {status ? (
                        <p className='mb-4 rounded-[22px] border border-slate-200/90 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl'>
                            {status}
                        </p>
                    ) : null}
                    <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
                        <motion.article
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className='rounded-[28px] border border-white/75 bg-linear-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_28px_70px_-46px_rgba(15,23,42,0.62)] backdrop-blur-xl'
                        >
                            <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>
                                Total Users
                            </p>
                            <p className='mt-2 text-3xl font-semibold text-slate-900'>
                                {stats.totalUsers}
                            </p>
                        </motion.article>
                        <motion.article
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.2,
                                delay: 0.04,
                                ease: 'easeOut',
                            }}
                            className='rounded-[28px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_28px_70px_-46px_rgba(15,23,42,0.62)] backdrop-blur-xl'
                        >
                            <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>
                                Campus Posts
                            </p>
                            <p className='mt-2 text-3xl font-semibold text-slate-900'>
                                {stats.campusPosts}
                            </p>
                        </motion.article>
                        <motion.article
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.2,
                                delay: 0.08,
                                ease: 'easeOut',
                            }}
                            className='rounded-[28px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_28px_70px_-46px_rgba(15,23,42,0.62)] backdrop-blur-xl'
                        >
                            <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>
                                Visitor Posts
                            </p>
                            <p className='mt-2 text-3xl font-semibold text-slate-900'>
                                {stats.visitorPosts}
                            </p>
                        </motion.article>
                        <motion.article
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.2,
                                delay: 0.12,
                                ease: 'easeOut',
                            }}
                            className='rounded-[28px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_28px_70px_-46px_rgba(15,23,42,0.62)] backdrop-blur-xl'
                        >
                            <p className='text-xs uppercase tracking-[0.18em] text-slate-500'>
                                Approved Feedback
                            </p>
                            <p className='mt-2 text-3xl font-semibold text-slate-900'>
                                {stats.approvedReviews}
                            </p>
                        </motion.article>
                    </section>
                </AdminPanelShell>
            </AppShell>
        </AuthGuard>
    );
}
