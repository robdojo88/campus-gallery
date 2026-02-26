'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
    createReview,
    deleteReview,
    fetchReviews,
    getCurrentUserProfile,
} from '@/lib/supabase';
import type { Review, UserRole } from '@/lib/types';

export default function ReviewsPage() {
    const [items, setItems] = useState<(Review & { visitorName: string })[]>(
        [],
    );
    const [role, setRole] = useState<UserRole | null>(null);
    const [reviewText, setReviewText] = useState('');
    const [status, setStatus] = useState('Loading feedback...');
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [busyDeleteId, setBusyDeleteId] = useState('');

    useEffect(() => {
        let mounted = true;
        fetchReviews()
            .then((data) => {
                if (!mounted) return;
                setItems(data);
                setStatus(data.length === 0 ? 'No feedback yet.' : '');
            })
            .catch((error: unknown) => {
                if (!mounted) return;
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load feedback.';
                setStatus(message);
            });
        return () => {
            mounted = false;
        };
    }, []);

    useEffect(() => {
        let mounted = true;
        getCurrentUserProfile()
            .then((profile) => {
                if (!mounted) return;
                setRole(profile?.role ?? null);
            })
            .catch(() => {
                if (!mounted) return;
                setRole(null);
            });
        return () => {
            mounted = false;
        };
    }, []);

    async function submitReview() {
        if (role !== 'visitor') {
            setStatus('Only visitors can submit feedback.');
            return;
        }

        const content = reviewText.trim();
        if (!content) {
            setStatus('Feedback cannot be empty.');
            return;
        }

        try {
            await createReview({ reviewText: content });
            setReviewText('');
            setStatus('Feedback submitted.');
            const data = await fetchReviews();
            setItems(data);
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : 'Feedback submit failed.';
            setStatus(message);
        }
    }

    async function onConfirmDeleteReview() {
        if (role !== 'admin' || !deleteTargetId) return;

        setBusyDeleteId(deleteTargetId);
        try {
            await deleteReview(deleteTargetId);
            const data = await fetchReviews();
            setItems(data);
            setStatus('Feedback deleted.');
            setDeleteTargetId(null);
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Delete failed.';
            setStatus(message);
        } finally {
            setBusyDeleteId('');
        }
    }

    return (
        <AuthGuard roles={['admin', 'member', 'visitor']}>
            <AppShell>
                <div className='mx-auto w-full max-w-4xl'>
                    <PageHeader
                        eyebrow='Feedback'
                        title='Visitor Feedback'
                        description='Visitors can submit text feedback. Members and admins can view approved feedback.'
                    />
                    {role === 'visitor' ? (
                        <section className='mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                            <h2 className='mb-3 text-lg font-bold'>
                                Add Feedback
                            </h2>
                            <div className='grid gap-3 md:grid-cols-[1fr_auto]'>
                                <input
                                    value={reviewText}
                                    onChange={(event) =>
                                        setReviewText(event.target.value)
                                    }
                                    placeholder='Write your feedback'
                                    className='rounded-xl border border-slate-300 px-3 py-2 text-sm'
                                />
                                <button
                                    type='button'
                                    onClick={() => void submitReview()}
                                    className='rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500'
                                >
                                    Submit
                                </button>
                            </div>
                        </section>
                    ) : null}
                    {status ? (
                        <p className='mb-4 text-sm text-slate-600'>{status}</p>
                    ) : null}
                    <section className='space-y-4'>
                        {items.map((review) => (
                            <article
                                key={review.id}
                                className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'
                            >
                                <div className='flex items-center justify-between gap-3'>
                                    <p className='text-sm font-semibold text-slate-800'>
                                        {review.visitorName}
                                    </p>
                                    {role === 'admin' ? (
                                        <button
                                            type='button'
                                            onClick={() =>
                                                setDeleteTargetId(review.id)
                                            }
                                            disabled={
                                                busyDeleteId === review.id
                                            }
                                            className='rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                                        >
                                            Delete
                                        </button>
                                    ) : null}
                                </div>
                                <p className='mt-2 text-sm text-slate-700'>
                                    {review.reviewText}
                                </p>
                            </article>
                        ))}
                    </section>
                    <ConfirmDialog
                        open={Boolean(deleteTargetId)}
                        title='Delete this feedback?'
                        description='This action permanently removes this visitor feedback.'
                        confirmLabel='Delete'
                        busy={
                            Boolean(deleteTargetId) &&
                            busyDeleteId === deleteTargetId
                        }
                        onCancel={() => {
                            if (busyDeleteId) return;
                            setDeleteTargetId(null);
                        }}
                        onConfirm={() => {
                            void onConfirmDeleteReview();
                        }}
                    />
                </div>
            </AppShell>
        </AuthGuard>
    );
}
