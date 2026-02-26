'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminPanelShell } from '@/components/admin/admin-panel-shell';
import { AppShell } from '@/components/layout/app-shell';
import {
    fetchAdminAuditLogs,
    fetchAdminStats,
    fetchAdminTopContributors,
    type AdminAuditLogEntry,
    type AdminContributor,
} from '@/lib/supabase';

function summarizeIds(details: Record<string, unknown>): string {
    const pairs = Object.entries(details)
        .filter(([key, value]) => {
            if (!key.toLowerCase().endsWith('id')) return false;
            return typeof value === 'string' && value.trim().length > 0;
        })
        .slice(0, 2)
        .map(([key, value]) => `${key}: ${String(value)}`);
    return pairs.join(' | ');
}

export default function AdminAnalyticsPage() {
    const [stats, setStats] = useState({
        totalUsers: 0,
        campusPosts: 0,
        visitorPosts: 0,
        approvedReviews: 0,
    });
    const [contributors, setContributors] = useState<AdminContributor[]>([]);
    const [auditLogs, setAuditLogs] = useState<AdminAuditLogEntry[]>([]);
    const [status, setStatus] = useState('Loading analytics...');
    const [auditStatus, setAuditStatus] = useState(
        'Loading admin activity log...',
    );

    const metricBars = useMemo(
        () => [
            {
                key: 'users',
                label: 'Users',
                value: stats.totalUsers,
                color: 'from-sky-400 to-cyan-300',
            },
            {
                key: 'campus',
                label: 'Campus Posts',
                value: stats.campusPosts,
                color: 'from-emerald-400 to-teal-300',
            },
            {
                key: 'visitor',
                label: 'Visitor Posts',
                value: stats.visitorPosts,
                color: 'from-amber-400 to-orange-300',
            },
            {
                key: 'reviews',
                label: 'Approved Feedback',
                value: stats.approvedReviews,
                color: 'from-violet-400 to-fuchsia-300',
            },
        ],
        [stats],
    );
    const maxMetricValue = useMemo(
        () => Math.max(1, ...metricBars.map((item) => item.value)),
        [metricBars],
    );

    useEffect(() => {
        async function load() {
            try {
                const [data, topContributors, auditResult] = await Promise.all([
                    fetchAdminStats(),
                    fetchAdminTopContributors(10),
                    fetchAdminAuditLogs(30)
                        .then((rows) => ({ rows }))
                        .catch((error: unknown) => ({ error })),
                ]);
                setStats(data);
                setContributors(topContributors);
                setStatus('');

                if ('error' in auditResult) {
                    const message =
                        auditResult.error instanceof Error
                            ? auditResult.error.message
                            : 'Failed to load admin activity log.';
                    setAuditLogs([]);
                    setAuditStatus(message);
                } else {
                    setAuditLogs(auditResult.rows);
                    setAuditStatus(
                        auditResult.rows.length === 0
                            ? 'No admin activity logged yet.'
                            : '',
                    );
                }
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
                    {status ? (
                        <p className='mb-4 rounded-[22px] border border-slate-200/90 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl'>
                            {status}
                        </p>
                    ) : null}
                    {/* <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
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
                    </section> */}

                    <section className='mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]'>
                        <motion.article
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.24, ease: 'easeOut' }}
                            className='rounded-[30px] border border-white/75 bg-gradient-to-br from-white/92 via-white/84 to-slate-100/78 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'
                        >
                            <h3 className='text-sm font-semibold uppercase tracking-[0.14em] text-slate-500'>
                                Post Metrics
                            </h3>
                            <div className='mt-4 grid h-56 grid-cols-4 items-end gap-3 rounded-2xl border border-white/70 bg-white/70 p-3'>
                                {metricBars.map((metric, index) => {
                                    const heightPercent = Math.max(
                                        (metric.value / maxMetricValue) * 100,
                                        metric.value > 0 ? 14 : 0,
                                    );
                                    return (
                                        <div
                                            key={metric.key}
                                            className='flex h-full flex-col justify-end gap-2'
                                        >
                                            <div className='relative h-full overflow-hidden rounded-2xl border border-white/70 bg-slate-100/75'>
                                                <motion.div
                                                    initial={{
                                                        height: 0,
                                                        opacity: 0.65,
                                                    }}
                                                    animate={{
                                                        height: `${heightPercent}%`,
                                                        opacity: 1,
                                                    }}
                                                    transition={{
                                                        duration: 0.55,
                                                        delay: index * 0.08,
                                                        ease: 'easeOut',
                                                    }}
                                                    className={`absolute inset-x-0 bottom-0 bg-gradient-to-t ${metric.color}`}
                                                />
                                            </div>
                                            <p className='text-center text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-500'>
                                                {metric.label}
                                            </p>
                                            <p className='text-center text-sm font-semibold text-slate-800'>
                                                {metric.value}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.article>

                        <motion.article
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.24,
                                delay: 0.06,
                                ease: 'easeOut',
                            }}
                            className='rounded-[30px] border border-white/75 bg-gradient-to-br from-white/92 via-white/84 to-slate-100/78 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'
                        >
                            <div className='flex items-center justify-between gap-2'>
                                <h3 className='text-sm font-semibold uppercase tracking-[0.14em] text-slate-500'>
                                    Admin Activity Log
                                </h3>
                                <Link
                                    href='/admin/audit-trail'
                                    className='rounded-xl border border-white/85 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-white'
                                >
                                    View Full
                                </Link>
                            </div>
                            <p className='mt-2 text-xs text-slate-500'>
                                Responsibility trail for admin actions across
                                moderation, events, and content operations.
                            </p>
                            {auditStatus ? (
                                <p className='mt-4 rounded-2xl border border-slate-200/85 bg-white/75 px-3 py-2 text-xs text-slate-600'>
                                    {auditStatus}
                                </p>
                            ) : (
                                <div className='mt-4 max-h-56 space-y-2 overflow-y-auto pr-1'>
                                    {auditLogs.map((item, index) => {
                                        const idSummary = summarizeIds(
                                            item.details,
                                        );
                                        return (
                                            <motion.article
                                                key={item.id}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    duration: 0.18,
                                                    delay: index * 0.02,
                                                    ease: 'easeOut',
                                                }}
                                                className='rounded-2xl border border-white/80 bg-white/75 p-3'
                                            >
                                                <div className='flex items-start justify-between gap-3'>
                                                    <div className='min-w-0'>
                                                        <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500'>
                                                            {item.actionLabel}
                                                        </p>
                                                        <p className='text-sm font-semibold text-slate-900'>
                                                            {item.description}
                                                        </p>
                                                    </div>
                                                    <p className='text-[11px] text-slate-500'>
                                                        {new Date(
                                                            item.createdAt,
                                                        ).toLocaleString()}
                                                    </p>
                                                </div>
                                                {idSummary ? (
                                                    <p className='mt-2 text-[11px] text-slate-500'>
                                                        {idSummary}
                                                    </p>
                                                ) : null}
                                            </motion.article>
                                        );
                                    })}
                                </div>
                            )}
                        </motion.article>
                    </section>

                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                            duration: 0.24,
                            delay: 0.1,
                            ease: 'easeOut',
                        }}
                        className='mt-4 rounded-[30px] border border-white/75 bg-gradient-to-br from-white/92 via-white/84 to-slate-100/78 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'
                    >
                        <h3 className='text-sm font-semibold uppercase tracking-[0.14em] text-slate-500'>
                            Top Contributors (Top 10)
                        </h3>
                        {contributors.length === 0 ? (
                            <p className='mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/70 px-4 py-3 text-sm text-slate-600'>
                                No contributor activity yet.
                            </p>
                        ) : (
                            <div className='mt-4 space-y-3'>
                                {contributors.map((contributor, index) => (
                                    <motion.article
                                        key={contributor.userId}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.2,
                                            delay: index * 0.03,
                                            ease: 'easeOut',
                                        }}
                                        className='rounded-2xl border border-white/80 bg-white/75 p-4'
                                    >
                                        <div className='flex items-start justify-between gap-3'>
                                            <div>
                                                <p className='text-xs font-semibold uppercase tracking-[0.1em] text-slate-500'>
                                                    Top {index + 1}
                                                </p>
                                                <p className='text-base font-semibold text-slate-900'>
                                                    {contributor.name}
                                                </p>
                                                <p className='text-xs uppercase tracking-[0.1em] text-slate-500'>
                                                    {contributor.role}
                                                </p>
                                            </div>
                                            <p className='text-xl font-semibold text-slate-900'>
                                                {contributor.score.toFixed(2)}
                                            </p>
                                        </div>
                                        <div className='mt-3 h-2 overflow-hidden rounded-full bg-slate-200/80'>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{
                                                    width: `${Math.min(
                                                        100,
                                                        contributor.score,
                                                    )}%`,
                                                }}
                                                transition={{
                                                    duration: 0.55,
                                                    delay: 0.06 + index * 0.02,
                                                    ease: 'easeOut',
                                                }}
                                                className='h-full bg-gradient-to-r from-sky-400 via-cyan-300 to-emerald-300'
                                            />
                                        </div>
                                        <div className='mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3'>
                                            <p>
                                                Posts:{' '}
                                                <span className='font-semibold text-slate-800'>
                                                    {contributor.posts}
                                                </span>
                                            </p>
                                            <p>
                                                Likes:{' '}
                                                <span className='font-semibold text-slate-800'>
                                                    {contributor.likes}
                                                </span>
                                            </p>
                                            <p>
                                                Comments:{' '}
                                                <span className='font-semibold text-slate-800'>
                                                    {contributor.comments}
                                                </span>
                                            </p>
                                        </div>
                                    </motion.article>
                                ))}
                            </div>
                        )}
                    </motion.section>
                </AdminPanelShell>
            </AppShell>
        </AuthGuard>
    );
}
