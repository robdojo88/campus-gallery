'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
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
    const [reviews, setReviews] = useState<(Review & { visitorName: string })[]>(
        [],
    );
    const [loading, setLoading] = useState(true);
    const [status, setStatus] = useState('Loading moderation queue...');
    const [busyId, setBusyId] = useState('');
    const [busyBulkDelete, setBusyBulkDelete] = useState(false);
    const [showDeleteAllFeedbackConfirm, setShowDeleteAllFeedbackConfirm] =
        useState(false);
    const [highlightedReportId, setHighlightedReportId] = useState('');
    const requestedReportId = (searchParams.get('report') ?? '').trim();

    async function loadAll(nextFilter: ReportFilter = filter) {
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
    }

    useEffect(() => {
        void loadAll(filter);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filter]);

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
                <PageHeader
                    eyebrow='Admin'
                    title='Reports & Feedback Moderation'
                    description='Review user reports, remove violating content, and manage visitor feedback.'
                />

                {status ? (
                    <p className='mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600'>
                        {status}
                    </p>
                ) : null}

                <section className='mb-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-bold text-slate-900'>
                                Visitor Feedback
                            </h2>
                            <p className='text-xs text-slate-500'>
                                Specific delete and bulk delete are available.
                            </p>
                        </div>
                        <button
                            type='button'
                            onClick={() =>
                                setShowDeleteAllFeedbackConfirm(true)
                            }
                            disabled={busyBulkDelete || reviews.length === 0}
                            className='rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                        >
                            {busyBulkDelete
                                ? 'Deleting...'
                                : 'Delete All Feedback'}
                        </button>
                    </div>

                    {loading ? (
                        <p className='mt-3 text-sm text-slate-500'>Loading...</p>
                    ) : reviews.length === 0 ? (
                        <p className='mt-3 text-sm text-slate-500'>
                            No feedback available.
                        </p>
                    ) : (
                        <div className='mt-3 space-y-2'>
                            {reviews.map((review) => (
                                <article
                                    key={review.id}
                                    className='rounded-2xl border border-slate-200 bg-slate-50 p-3'
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
                                                void onDeleteFeedback(review.id)
                                            }
                                            disabled={busyId === review.id}
                                            className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div>
                            <h2 className='text-base font-bold text-slate-900'>
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
                                className='rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 outline-none'
                            >
                                <option value='open'>Open</option>
                                <option value='resolved'>Resolved</option>
                                <option value='declined'>Declined</option>
                                <option value='all'>All</option>
                            </select>
                        </label>
                    </div>

                    {loading ? (
                        <p className='mt-3 text-sm text-slate-500'>Loading...</p>
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
                                    tabIndex={report.targetHref ? 0 : undefined}
                                    className={`rounded-2xl border bg-slate-50 p-3 transition ${
                                        highlightedReportId === report.id
                                            ? 'border-blue-300 bg-blue-50/40 ring-2 ring-blue-300/60 ring-offset-1'
                                            : report.targetHref
                                              ? 'border-blue-200 bg-blue-50/20'
                                              : 'border-slate-200'
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
                                                Reported by {report.reporterName}{' '}
                                                at{' '}
                                                {new Date(
                                                    report.createdAt,
                                                ).toLocaleString()}
                                            </p>
                                            <p className='mt-2 text-sm text-slate-700'>
                                                Reason: {report.reason}
                                            </p>
                                            {report.details ? (
                                                <p className='mt-1 text-xs text-slate-600'>
                                                    Details: {report.details}
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
                                                    className='rounded-lg border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 transition hover:bg-blue-100'
                                                >
                                                    Open Target
                                                </Link>
                                            ) : (
                                                <span className='rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500'>
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
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void onDeclineReport(
                                                                report.id,
                                                            );
                                                        }}
                                                        disabled={
                                                            busyId === report.id
                                                        }
                                                        className='rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60'
                                                    >
                                                        Decline
                                                    </button>
                                                    <button
                                                        type='button'
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            void onDeleteReportedTarget(
                                                                report.id,
                                                            );
                                                        }}
                                                        disabled={
                                                            busyId === report.id
                                                        }
                                                        className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
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
                    onCancel={() => {
                        if (busyBulkDelete) return;
                        setShowDeleteAllFeedbackConfirm(false);
                    }}
                    onConfirm={() => {
                        void onDeleteAllFeedback();
                    }}
                />
            </AppShell>
        </AuthGuard>
    );
}
