'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { createReview, fetchReviews } from '@/lib/supabase';
import type { Review } from '@/lib/types';

export default function ReviewsPage() {
    const [items, setItems] = useState<(Review & { visitorName: string })[]>(
        [],
    );
    const [reviewText, setReviewText] = useState('');
    const [status, setStatus] = useState('Loading feedback...');

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

    async function submitReview() {
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

    return (
        <AuthGuard roles={['admin', 'member', 'visitor']}>
            <AppShell>
                <PageHeader
                    eyebrow='Feedback'
                    title='Visitor Feedback'
                    description='Visitors can submit text feedback. Admin approval controls publication.'
                />
                <section className='mb-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm'>
                    <h2 className='mb-3 text-lg font-bold'>Add Feedback</h2>
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
                                <span
                                    className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${
                                        review.status === 'approved'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : review.status === 'pending'
                                              ? 'bg-amber-100 text-amber-800'
                                              : 'bg-red-100 text-red-800'
                                    }`}
                                >
                                    {review.status}
                                </span>
                            </div>
                            <p className='mt-2 text-sm text-slate-700'>
                                {review.reviewText}
                            </p>
                        </article>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
