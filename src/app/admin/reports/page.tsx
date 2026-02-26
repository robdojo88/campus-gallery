'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminPanelShell } from '@/components/admin/admin-panel-shell';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    deleteAllReviews,
    deleteReview,
    fetchContentReports,
    fetchReviews,
    resolveContentReport,
} from '@/lib/supabase';
import type { ContentReport, Review } from '@/lib/types';

type ReportFilter = 'open' | 'resolved' | 'declined' | 'all';

function formatTargetLabel(report: ContentReport): string {
    if (report.targetType === 'feed_post') return 'Feed Post';
    if (report.targetType === 'feed_comment') return 'Feed Comment';
    if (report.targetType === 'freedom_post') return 'Freedom Wall Post';
    if (report.targetType === 'freedom_comment') return 'Freedom Wall Comment';
    if (report.targetType === 'incognito_post') return 'Incognito Post';
    return 'Incognito Comment';
}

export default function AdminReportsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [filter, setFilter] = useState<ReportFilter>('open');
    const [reports, setReports] = useState<ContentReport[]>([]);
    const [reviews, setReviews] = useState<
        (Review & { visitorName: string })[]
    >([]);
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading moderation queue...');
    const [busyId, setBusyId] = useState('');
    const [busyBulkDelete, setBusyBulkDelete] = useState(false);
    const [showDeleteAllFeedbackConfirm, setShowDeleteAllFeedbackConfirm] =
        useState(false);
    const [highlightedReportId, setHighlightedReportId] = useState('');
    const requestedReportId = (searchParams.get('report') ?? '').trim();

    const loadAll = useCallback(async (nextFilter: ReportFilter) => {
        setLoading(true);
        try {
            const [reportRows, reviewRows] = await Promise.all([
                fetchContentReports({
                    status: nextFilter === 'all' ? 'all' : nextFilter,
                }),
                fetchReviews(),
            ]);
            setReports(reportRows);
            setReviews(reviewRows);
            setStatus('');
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to load moderation queue.';
            setStatus(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAll(filter);
    }, [filter, loadAll]);

    useEffect(() => {
        if (!requestedReportId) return;
        if (filter !== 'all') {
            setFilter('all');
        }
    }, [filter, requestedReportId]);

    useEffect(() => {
        if (!requestedReportId || loading) return;

        const targetReportExists = reports.some(
            (report) => report.id === requestedReportId,
        );
        if (!targetReportExists) {
            setStatus('Requested report was not found.');
            setHighlightedReportId('');
            return;
        }

        setHighlightedReportId(requestedReportId);
        const selector = `[data-report-id="${requestedReportId}"]`;
        window.requestAnimationFrame(() => {
            const node = document.querySelector<HTMLElement>(selector);
            node?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }, [loading, reports, requestedReportId]);

    useEffect(() => {
        if (!highlightedReportId) return;
        const timer = window.setTimeout(() => {
            setHighlightedReportId('');
        }, 4000);
        return () => {
            window.clearTimeout(timer);
        };
    }, [highlightedReportId]);

    const openReportsCount = useMemo(
        () => reports.filter((report) => report.status === 'open').length,
        [reports],
    );

    async function onDeclineReport(reportId: string) {
        setBusyId(reportId);
        try {
            await resolveContentReport({
                reportId,
                action: 'decline',
                actionNote: 'No policy violation found.',
            });
            await loadAll(filter);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to decline report.';
            setStatus(message);
        } finally {
            setBusyId('');
        }
    }

    async function onDeleteReportedTarget(reportId: string) {
        setBusyId(reportId);
        try {
            await resolveContentReport({
                reportId,
                action: 'delete_target',
                actionNote: 'Content removed by admin.',
            });
            await loadAll(filter);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to delete reported target.';
            setStatus(message);
        } finally {
            setBusyId('');
        }
    }

    async function onDeleteFeedback(reviewId: string) {
        setBusyId(reviewId);
        try {
            await deleteReview(reviewId);
            await loadAll(filter);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to delete feedback.';
            setStatus(message);
        } finally {
            setBusyId('');
        }
    }

    async function onDeleteAllFeedback() {
        setBusyBulkDelete(true);
        try {
            const deleted = await deleteAllReviews();
            setStatus(
                deleted > 0
                    ? `Deleted ${deleted} feedback item(s).`
                    : 'No feedback to delete.',
            );
            await loadAll(filter);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Failed to delete all feedback.';
            setStatus(message);
        } finally {
            setBusyBulkDelete(false);
            setShowDeleteAllFeedbackConfirm(false);
        }
    }

    function openReportTarget(href?: string) {
        if (!href) return;
        router.push(href);
    }

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <AdminPanelShell>
                    {/* <PageHeader
                        eyebrow='Admin workspace'
                        title='Reports & Feedback Moderation'
                        description='Moderate visitor feedback and resolve content reports from one unified queue.'
                    /> */}

                    {status ? (
                        <p className='mb-4 rounded-[22px] border border-slate-200/90 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl'>
                            {status}
                        </p>
                    ) : null}

                    <section className='mb-4 rounded-[30px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'>
                        <div className='flex flex-wrap items-center justify-between gap-3'>
                            <div>
                                <h2 className='text-base font-semibold tracking-tight text-slate-900'>
                                    Visitor Feedback
                                </h2>
                                <p className='text-xs text-slate-500'>
                                    Specific delete and bulk delete are
                                    available.
                                </p>
                            </div>
                            <button
                                type='button'
                                onClick={() =>
                                    setShowDeleteAllFeedbackConfirm(true)
                                }
                                disabled={
                                    busyBulkDelete || reviews.length === 0
                                }
                                className='rounded-2xl border border-rose-200/80 bg-rose-50/85 px-3 py-2 text-xs font-semibold text-rose-700 shadow-[0_16px_24px_-20px_rgba(244,63,94,0.75)] transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {busyBulkDelete
                                    ? 'Deleting...'
                                    : 'Delete All Feedback'}
                            </button>
                        </div>

                        {loading ? (
                            <p className='mt-3 text-sm text-slate-500'>
                                Loading...
                            </p>
                        ) : reviews.length === 0 ? (
                            <p className='mt-3 text-sm text-slate-500'>
                                No feedback available.
                            </p>
                        ) : (
                            <div className='mt-3 space-y-2'>
                                {reviews.map((review) => (
                                    <motion.article
                                        key={review.id}
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{
                                            duration: 0.18,
                                            ease: 'easeOut',
                                        }}
                                        className='rounded-2xl border border-white/80 bg-white/75 p-3'
                                    >
                                        <div className='flex items-start justify-between gap-3'>
                                            <div className='min-w-0'>
                                                <p className='text-sm font-semibold text-slate-800'>
                                                    {review.visitorName}
                                                </p>
                                                <p className='mt-1 text-xs text-slate-500'>
                                                    {new Date(
                                                        review.createdAt,
                                                    ).toLocaleString()}
                                                </p>
                                                <p className='mt-2 text-sm text-slate-700'>
                                                    {review.reviewText}
                                                </p>
                                            </div>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    void onDeleteFeedback(
                                                        review.id,
                                                    )
                                                }
                                                disabled={busyId === review.id}
                                                className='rounded-xl border border-rose-200/80 bg-rose-50/85 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </motion.article>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className='rounded-[30px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'>
                        <div className='flex flex-wrap items-center justify-between gap-3'>
                            <div>
                                <h2 className='text-base font-semibold tracking-tight text-slate-900'>
                                    Reports Queue
                                </h2>
                                <p className='text-xs text-slate-500'>
                                    {openReportsCount} open report(s)
                                </p>
                            </div>
                            <label className='inline-flex items-center gap-2 text-xs font-semibold text-slate-600'>
                                <span>Filter</span>
                                <select
                                    value={filter}
                                    onChange={(event) =>
                                        setFilter(
                                            event.target.value as ReportFilter,
                                        )
                                    }
                                    className='rounded-xl border border-white/85 bg-white/85 px-2 py-1 text-xs text-slate-700 outline-none'
                                >
                                    <option value='open'>Open</option>
                                    <option value='resolved'>Resolved</option>
                                    <option value='declined'>Declined</option>
                                    <option value='all'>All</option>
                                </select>
                            </label>
                        </div>

                        {loading ? (
                            <p className='mt-3 text-sm text-slate-500'>
                                Loading...
                            </p>
                        ) : reports.length === 0 ? (
                            <p className='mt-3 text-sm text-slate-500'>
                                No reports in this filter.
                            </p>
                        ) : (
                            <div className='mt-3 space-y-3'>
                                {reports.map((report) => (
                                    <article
                                        key={report.id}
                                        data-report-id={report.id}
                                        onClick={() =>
                                            openReportTarget(report.targetHref)
                                        }
                                        onKeyDown={(event) => {
                                            if (!report.targetHref) return;
                                            if (
                                                event.key === 'Enter' ||
                                                event.key === ' '
                                            ) {
                                                event.preventDefault();
                                                openReportTarget(
                                                    report.targetHref,
                                                );
                                            }
                                        }}
                                        role={
                                            report.targetHref
                                                ? 'button'
                                                : undefined
                                        }
                                        tabIndex={
                                            report.targetHref ? 0 : undefined
                                        }
                                        className={`rounded-2xl border bg-white/75 p-3 transition ${
                                            highlightedReportId === report.id
                                                ? 'border-blue-300 bg-blue-50/45 ring-2 ring-blue-300/60 ring-offset-1'
                                                : report.targetHref
                                                  ? 'border-blue-200 bg-blue-50/25'
                                                  : 'border-white/80'
                                        } ${
                                            report.targetHref
                                                ? 'cursor-pointer hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus:ring-2 focus:ring-blue-300/70'
                                                : ''
                                        }`}
                                    >
                                        <div className='flex flex-wrap items-start justify-between gap-3'>
                                            <div className='min-w-0'>
                                                <p className='text-sm font-semibold text-slate-800'>
                                                    {formatTargetLabel(report)}
                                                </p>
                                                <p className='mt-1 text-xs text-slate-500'>
                                                    Target: {report.targetId}
                                                </p>
                                                <p className='mt-1 text-xs text-slate-500'>
                                                    Reported by{' '}
                                                    {report.reporterName} at{' '}
                                                    {new Date(
                                                        report.createdAt,
                                                    ).toLocaleString()}
                                                </p>
                                                <p className='mt-2 text-sm text-slate-700'>
                                                    Reason: {report.reason}
                                                </p>
                                                {report.details ? (
                                                    <p className='mt-1 text-xs text-slate-600'>
                                                        Details:{' '}
                                                        {report.details}
                                                    </p>
                                                ) : null}
                                                {report.status !== 'open' ? (
                                                    <p className='mt-1 text-xs text-slate-600'>
                                                        {report.status} by{' '}
                                                        {report.reviewedByName ??
                                                            'Admin'}
                                                        {report.reviewedAt
                                                            ? ` at ${new Date(report.reviewedAt).toLocaleString()}`
                                                            : ''}
                                                    </p>
                                                ) : null}
                                                {report.targetHref ? (
                                                    <p className='mt-2 inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700'>
                                                        Open reported content
                                                        <span aria-hidden='true'>
                                                            {'->'}
                                                        </span>
                                                    </p>
                                                ) : null}
                                            </div>

                                            <div className='flex flex-wrap items-center gap-2'>
                                                {report.targetHref ? (
                                                    <Link
                                                        href={report.targetHref}
                                                        onClick={(event) =>
                                                            event.stopPropagation()
                                                        }
                                                        className='rounded-xl border border-blue-200 bg-blue-50/90 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100'
                                                    >
                                                        Open Target
                                                    </Link>
                                                ) : (
                                                    <span className='rounded-xl border border-white/80 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-500'>
                                                        Target unavailable
                                                    </span>
                                                )}
                                                <span
                                                    className={`rounded-full px-2 py-1 text-[11px] font-semibold uppercase ${
                                                        report.status === 'open'
                                                            ? 'bg-amber-100 text-amber-800'
                                                            : report.status ===
                                                                'resolved'
                                                              ? 'bg-emerald-100 text-emerald-800'
                                                              : 'bg-slate-200 text-slate-700'
                                                    }`}
                                                >
                                                    {report.status}
                                                </span>

                                                {report.status === 'open' ? (
                                                    <>
                                                        <button
                                                            type='button'
                                                            onClick={(
                                                                event,
                                                            ) => {
                                                                event.stopPropagation();
                                                                void onDeclineReport(
                                                                    report.id,
                                                                );
                                                            }}
                                                            disabled={
                                                                busyId ===
                                                                report.id
                                                            }
                                                            className='rounded-xl border border-white/85 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
                                                        >
                                                            Decline
                                                        </button>
                                                        <button
                                                            type='button'
                                                            onClick={(
                                                                event,
                                                            ) => {
                                                                event.stopPropagation();
                                                                void onDeleteReportedTarget(
                                                                    report.id,
                                                                );
                                                            }}
                                                            disabled={
                                                                busyId ===
                                                                report.id
                                                            }
                                                            className='rounded-xl border border-rose-200/80 bg-rose-50/85 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                                        >
                                                            Delete Target
                                                        </button>
                                                    </>
                                                ) : null}
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>
                    <ConfirmDialog
                        open={showDeleteAllFeedbackConfirm}
                        title='Delete all visitor feedback?'
                        description='This action permanently removes all feedback entries and cannot be undone.'
                        confirmLabel='Delete All'
                        busy={busyBulkDelete}
                        classNames='rounded-[30px] border border-white/80 bg-gradient-to-br from-white/95 via-white/90 to-slate-100/85 shadow-[0_35px_80px_-45px_rgba(15,23,42,0.55)] backdrop-blur-2xl'
                        onCancel={() => {
                            if (busyBulkDelete) return;
                            setShowDeleteAllFeedbackConfirm(false);
                        }}
                        onConfirm={() => {
                            void onDeleteAllFeedback();
                        }}
                    />
                </AdminPanelShell>
            </AppShell>
        </AuthGuard>
    );
}
