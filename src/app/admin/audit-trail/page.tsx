'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminPanelShell } from '@/components/admin/admin-panel-shell';
import { AppShell } from '@/components/layout/app-shell';
import {
    fetchAdminAuditLogs,
    type AdminAuditCategory,
    type AdminAuditLogEntry,
} from '@/lib/supabase';

type AuditSortDirection = 'newest' | 'oldest';

const DEFAULT_ROWS_PER_PAGE = 10;
const MAX_PAGE_BUTTONS = 5;

const AUDIT_CATEGORY_OPTIONS: Array<{
    value: AdminAuditCategory;
    label: string;
}> = [
    { value: 'all', label: 'All incidents' },
    { value: 'posting', label: 'Posting' },
    { value: 'deleting', label: 'Deleting' },
    { value: 'editing', label: 'Editing' },
    { value: 'suspending', label: 'Suspending' },
    { value: 'moderation', label: 'Moderation' },
    { value: 'events', label: 'Events' },
    { value: 'downloads', label: 'Downloads' },
    { value: 'other', label: 'Other' },
];

function toLocalDateKey(dateValue: string): string {
    const parsed = new Date(dateValue);
    if (Number.isNaN(parsed.getTime())) return '';
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getVisiblePageNumbers(
    currentPage: number,
    totalPages: number,
): number[] {
    if (totalPages <= MAX_PAGE_BUTTONS) {
        return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const halfWindow = Math.floor(MAX_PAGE_BUTTONS / 2);
    let start = Math.max(1, currentPage - halfWindow);
    let end = start + MAX_PAGE_BUTTONS - 1;

    if (end > totalPages) {
        end = totalPages;
        start = end - MAX_PAGE_BUTTONS + 1;
    }

    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}

function summarizeIds(details: Record<string, unknown>): string {
    const idPairs = Object.entries(details)
        .filter(([key, value]) => {
            if (!key.toLowerCase().endsWith('id')) return false;
            return typeof value === 'string' && value.trim().length > 0;
        })
        .slice(0, 3)
        .map(([key, value]) => `${key}: ${String(value)}`);
    return idPairs.join(' | ');
}

export default function AdminAuditTrailPage() {
    const [entries, setEntries] = useState<AdminAuditLogEntry[]>([]);
    const [status, setStatus] = useState('Loading audit trail...');
    const [search, setSearch] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [categoryFilter, setCategoryFilter] =
        useState<AdminAuditCategory>('all');
    const [sortDirection, setSortDirection] =
        useState<AuditSortDirection>('newest');
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        async function load() {
            try {
                const rows = await fetchAdminAuditLogs(1000);
                setEntries(rows);
                setStatus(rows.length === 0 ? 'No audit logs yet.' : '');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load audit trail.';
                setStatus(message);
            }
        }
        void load();
    }, []);

    const filteredEntries = useMemo(() => {
        const term = search.trim().toLowerCase();
        return entries.filter((entry) => {
            if (
                selectedDate &&
                toLocalDateKey(entry.createdAt) !== selectedDate
            ) {
                return false;
            }
            if (categoryFilter !== 'all' && entry.category !== categoryFilter) {
                return false;
            }
            if (!term) return true;

            const haystack = [
                entry.adminName,
                entry.actionLabel,
                entry.description,
                entry.action,
                JSON.stringify(entry.details),
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(term);
        });
    }, [categoryFilter, entries, search, selectedDate]);

    const sortedEntries = useMemo(() => {
        const next = [...filteredEntries];
        next.sort((a, b) => {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return sortDirection === 'newest' ? timeB - timeA : timeA - timeB;
        });
        return next;
    }, [filteredEntries, sortDirection]);

    const totalRows = sortedEntries.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * rowsPerPage;
    const paginatedEntries = sortedEntries.slice(
        startIndex,
        startIndex + rowsPerPage,
    );
    const visiblePageNumbers = getVisiblePageNumbers(
        safeCurrentPage,
        totalPages,
    );
    const visibleStart = totalRows === 0 ? 0 : startIndex + 1;
    const visibleEnd = Math.min(startIndex + rowsPerPage, totalRows);

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <AdminPanelShell>
                    <section className='rounded-[30px] border border-white/75 bg-gradient-to-br from-white/92 via-white/84 to-slate-100/78 p-5 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.6)] backdrop-blur-xl'>
                        <div className='flex flex-wrap items-start justify-between gap-3'>
                            <div>
                                <h2 className='text-lg font-semibold tracking-tight text-slate-900'>
                                    Full Admin Audit Trail
                                </h2>
                                <p className='mt-1 text-xs text-slate-500'>
                                    Human-readable responsibility log with IDs
                                    for traceability.
                                </p>
                            </div>
                            <div className='grid gap-2 sm:grid-cols-4'>
                                <input
                                    value={search}
                                    onChange={(event) => {
                                        setSearch(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                    placeholder='Search name, action, id...'
                                    className='rounded-xl border border-white/85 bg-white/85 px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-300'
                                />
                                <input
                                    type='date'
                                    value={selectedDate}
                                    onChange={(event) => {
                                        setSelectedDate(event.target.value);
                                        setCurrentPage(1);
                                    }}
                                    className='rounded-xl border border-white/85 bg-white/85 px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-300'
                                />
                                <select
                                    value={categoryFilter}
                                    onChange={(event) => {
                                        setCategoryFilter(
                                            event.target
                                                .value as AdminAuditCategory,
                                        );
                                        setCurrentPage(1);
                                    }}
                                    className='rounded-xl border border-white/85 bg-white/85 px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-300'
                                >
                                    {AUDIT_CATEGORY_OPTIONS.map((option) => (
                                        <option
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={sortDirection}
                                    onChange={(event) => {
                                        setSortDirection(
                                            event.target
                                                .value as AuditSortDirection,
                                        );
                                        setCurrentPage(1);
                                    }}
                                    className='rounded-xl border border-white/85 bg-white/85 px-3 py-2 text-xs text-slate-700 outline-none focus:border-sky-300'
                                >
                                    <option value='newest'>Date: Newest</option>
                                    <option value='oldest'>Date: Oldest</option>
                                </select>
                            </div>
                        </div>
                        {selectedDate ? (
                            <div className='mt-3'>
                                <button
                                    type='button'
                                    onClick={() => {
                                        setSelectedDate('');
                                        setCurrentPage(1);
                                    }}
                                    className='rounded-xl border border-white/85 bg-white/80 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-white'
                                >
                                    Clear Date Filter
                                </button>
                            </div>
                        ) : null}

                        {status ? (
                            <p className='mt-4 rounded-2xl border border-slate-200/85 bg-white/75 px-4 py-3 text-sm text-slate-600'>
                                {status}
                            </p>
                        ) : null}

                        {!status ? (
                            <div className='mt-4 space-y-3'>
                                {paginatedEntries.map((entry, index) => {
                                    const idSummary = summarizeIds(
                                        entry.details,
                                    );
                                    return (
                                        <motion.article
                                            key={entry.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{
                                                duration: 0.2,
                                                delay: index * 0.02,
                                                ease: 'easeOut',
                                            }}
                                            className='rounded-2xl border border-white/80 bg-white/75 p-4'
                                        >
                                            <div className='flex flex-wrap items-start justify-between gap-3'>
                                                <div className='min-w-0'>
                                                    <p className='text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500'>
                                                        {entry.actionLabel}
                                                    </p>
                                                    <p className='mt-1 text-sm font-semibold text-slate-900'>
                                                        {entry.description}
                                                    </p>
                                                </div>
                                                <p className='text-[11px] text-slate-500'>
                                                    {new Date(
                                                        entry.createdAt,
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
                        ) : null}

                        {!status ? (
                            <div className='mt-4 flex flex-col gap-3 border-t border-white/70 pt-4 sm:flex-row sm:items-center sm:justify-between'>
                                <p className='text-xs text-slate-500'>
                                    Showing {visibleStart}-{visibleEnd} of{' '}
                                    {totalRows}
                                </p>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <label
                                        htmlFor='audit-rows-per-page'
                                        className='text-xs font-medium text-slate-600'
                                    >
                                        Rows per page
                                    </label>
                                    <input
                                        id='audit-rows-per-page'
                                        type='number'
                                        min={1}
                                        value={rowsPerPage}
                                        onChange={(event) => {
                                            const value = Number(
                                                event.target.value,
                                            );
                                            if (
                                                !Number.isFinite(value) ||
                                                value < 1
                                            ) {
                                                return;
                                            }
                                            setRowsPerPage(
                                                Math.min(
                                                    200,
                                                    Math.trunc(value),
                                                ),
                                            );
                                            setCurrentPage(1);
                                        }}
                                        className='w-20 rounded-xl border border-white/85 bg-white/80 px-2 py-1 text-xs text-slate-700 outline-none focus:border-sky-300'
                                    />
                                    <button
                                        type='button'
                                        onClick={() =>
                                            setCurrentPage(safeCurrentPage - 1)
                                        }
                                        disabled={safeCurrentPage <= 1}
                                        className='rounded-xl border border-white/85 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
                                    >
                                        Previous
                                    </button>
                                    {visiblePageNumbers.map((pageNumber) => (
                                        <button
                                            key={pageNumber}
                                            type='button'
                                            onClick={() =>
                                                setCurrentPage(pageNumber)
                                            }
                                            className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition ${
                                                pageNumber === safeCurrentPage
                                                    ? 'border border-sky-200 bg-sky-100/80 text-sky-700'
                                                    : 'border border-white/85 bg-white/85 text-slate-700 hover:bg-white'
                                            }`}
                                        >
                                            {pageNumber}
                                        </button>
                                    ))}
                                    <button
                                        type='button'
                                        onClick={() =>
                                            setCurrentPage(safeCurrentPage + 1)
                                        }
                                        disabled={safeCurrentPage >= totalPages}
                                        className='rounded-xl border border-white/85 bg-white/85 px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        ) : null}
                    </section>
                </AdminPanelShell>
            </AppShell>
        </AuthGuard>
    );
}
