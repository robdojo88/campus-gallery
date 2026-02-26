'use client';

import { motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminPanelShell } from '@/components/admin/admin-panel-shell';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { adminSetUserRole, fetchUsers } from '@/lib/supabase';
import type { User } from '@/lib/types';

type UserSortField = 'name' | 'role' | 'email' | 'status';
type SortDirection = 'asc' | 'desc';

const DEFAULT_ROWS_PER_PAGE = 10;
const MAX_PAGE_BUTTONS = 5;
const USER_SORT_OPTIONS: Array<{ value: UserSortField; label: string }> = [
    { value: 'name', label: 'Name' },
    { value: 'role', label: 'Role' },
    { value: 'email', label: 'Email' },
    { value: 'status', label: 'Status' },
];

function compareTextValues(valueA: string, valueB: string): number {
    return valueA.localeCompare(valueB, undefined, {
        sensitivity: 'base',
        numeric: true,
    });
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

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [status, setStatus] = useState('Loading users...');
    const [loading, setLoading] = useState(true);
    const [busyUserId, setBusyUserId] = useState('');
    const [sortField, setSortField] = useState<UserSortField>('name');
    const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(DEFAULT_ROWS_PER_PAGE);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const data = await fetchUsers();
                setUsers(data);
                setStatus(data.length === 0 ? 'No users found.' : '');
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : 'Failed to load users.';
                setStatus(message);
            } finally {
                setLoading(false);
            }
        }
        void load();
    }, []);

    const sortedUsers = useMemo(() => {
        const directionMultiplier = sortDirection === 'asc' ? 1 : -1;
        const next = [...users];

        next.sort((a, b) => {
            let result = 0;

            if (sortField === 'name') {
                result = compareTextValues(a.name, b.name);
            } else if (sortField === 'role') {
                result = compareTextValues(a.role, b.role);
            } else if (sortField === 'email') {
                result = compareTextValues(a.email, b.email);
            } else if (sortField === 'status') {
                const statusA = a.isSuspended ? 'suspended' : 'active';
                const statusB = b.isSuspended ? 'suspended' : 'active';
                result = compareTextValues(statusA, statusB);
            }

            if (result === 0) {
                result = compareTextValues(a.name, b.name);
            }

            return result * directionMultiplier;
        });

        return next;
    }, [users, sortDirection, sortField]);

    const totalRows = sortedUsers.length;
    const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
    const safeCurrentPage = Math.min(currentPage, totalPages);
    const startIndex = (safeCurrentPage - 1) * rowsPerPage;
    const paginatedUsers = sortedUsers.slice(
        startIndex,
        startIndex + rowsPerPage,
    );
    const visiblePageNumbers = getVisiblePageNumbers(
        safeCurrentPage,
        totalPages,
    );
    const visibleStart = totalRows === 0 ? 0 : startIndex + 1;
    const visibleEnd = Math.min(startIndex + rowsPerPage, totalRows);

    useEffect(() => {
        setCurrentPage(1);
    }, [rowsPerPage, sortDirection, sortField]);

    useEffect(() => {
        setCurrentPage((previous) =>
            previous > totalPages ? totalPages : previous,
        );
    }, [totalPages]);

    async function onToggleSuspend(user: User) {
        if (user.role === 'admin') {
            setStatus('Admin accounts cannot be suspended.');
            return;
        }

        const isSuspended = user.isSuspended === true;
        const nextRole = user.role;
        const nextSuspended = !isSuspended;
        setBusyUserId(user.id);
        try {
            await adminSetUserRole({
                userId: user.id,
                role: nextRole,
                isSuspended: nextSuspended,
            });
            setUsers((prev) =>
                prev.map((item) =>
                    item.id === user.id
                        ? {
                              ...item,
                              role: nextRole,
                              isSuspended: nextSuspended,
                          }
                        : item,
                ),
            );
            setStatus(
                nextSuspended
                    ? `${user.name} suspended.`
                    : `${user.name} unsuspended.`,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : 'Action failed.';
            setStatus(message);
        } finally {
            setBusyUserId('');
        }
    }

    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <AdminPanelShell>
                    <PageHeader
                        eyebrow=''
                        title='Manage Users'
                        description=''
                    />

                    {status ? (
                        <p className='mb-4 rounded-[22px] border border-slate-200/90 bg-white/70 px-4 py-3 text-sm text-slate-600 shadow-[0_20px_38px_-30px_rgba(15,23,42,0.65)] backdrop-blur-xl'>
                            {status}
                        </p>
                    ) : null}

                    <motion.section
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.24, ease: 'easeOut' }}
                        className='overflow-hidden rounded-[32px] border border-white/75 bg-white/78 shadow-[0_35px_90px_-55px_rgba(15,23,42,0.72)] backdrop-blur-xl'
                    >
                        <div className='border-b border-white/70 bg-white/45 p-4 backdrop-blur'>
                            <div className='flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between'>
                                <p className='text-sm font-semibold text-slate-800'>
                                    Users: {totalRows}
                                </p>
                                <div className='flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center'>
                                    <select
                                        value={sortField}
                                        onChange={(event) =>
                                            setSortField(
                                                event.target
                                                    .value as UserSortField,
                                            )
                                        }
                                        className='rounded-2xl border border-white/80 bg-white/75 px-3 py-2 text-xs text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-sky-300'
                                    >
                                        {USER_SORT_OPTIONS.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                Sort: {option.label}
                                            </option>
                                        ))}
                                    </select>
                                    <select
                                        value={sortDirection}
                                        onChange={(event) =>
                                            setSortDirection(
                                                event.target
                                                    .value as SortDirection,
                                            )
                                        }
                                        className='rounded-2xl border border-white/80 bg-white/75 px-3 py-2 text-xs text-slate-700 outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] transition focus:border-sky-300'
                                    >
                                        <option value='asc'>Asc</option>
                                        <option value='desc'>Desc</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className='overflow-x-auto'>
                            <table className='w-full min-w-[760px] text-left text-sm'>
                                <thead className='bg-white/70 text-[11px] uppercase tracking-[0.12em] text-slate-500'>
                                    <tr>
                                        <th className='border-r border-white/70 px-4 py-3 last:border-r-0'>
                                            Name
                                        </th>
                                        <th className='border-r border-white/70 px-4 py-3 last:border-r-0'>
                                            Role
                                        </th>
                                        <th className='border-r border-white/70 px-4 py-3 last:border-r-0'>
                                            Email
                                        </th>
                                        <th className='border-r border-white/70 px-4 py-3 last:border-r-0'>
                                            Status
                                        </th>
                                        <th className='px-4 py-3'>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className='px-4 py-8 text-center text-slate-500'
                                            >
                                                Loading...
                                            </td>
                                        </tr>
                                    ) : totalRows === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className='px-4 py-8 text-center text-slate-500'
                                            >
                                                No users found.
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedUsers.map((user, index) => (
                                            <motion.tr
                                                key={user.id}
                                                initial={{ opacity: 0, y: 8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{
                                                    duration: 0.18,
                                                    delay: index * 0.012,
                                                    ease: 'easeOut',
                                                }}
                                                className='border-t border-white/80 transition-colors hover:bg-white/55'
                                            >
                                                <td className='border-r border-white/65 px-4 py-3 font-medium text-slate-800 last:border-r-0'>
                                                    {user.name}
                                                </td>
                                                <td className='border-r border-white/65 px-4 py-3 capitalize text-slate-700 last:border-r-0'>
                                                    {user.role}
                                                </td>
                                                <td className='border-r border-white/65 px-4 py-3 text-slate-600 last:border-r-0'>
                                                    {user.email}
                                                </td>
                                                <td className='border-r border-white/65 px-4 py-3 last:border-r-0'>
                                                    <span
                                                        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                                            user.isSuspended
                                                                ? 'border border-rose-200/80 bg-rose-50/85 text-rose-700'
                                                                : 'border border-emerald-200/80 bg-emerald-100/80 text-emerald-700'
                                                        }`}
                                                    >
                                                        {user.isSuspended
                                                            ? 'Suspended'
                                                            : 'Active'}
                                                    </span>
                                                </td>
                                                <td className='px-4 py-3'>
                                                    <button
                                                        type='button'
                                                        onClick={() =>
                                                            void onToggleSuspend(
                                                                user,
                                                            )
                                                        }
                                                        disabled={
                                                            busyUserId ===
                                                                user.id ||
                                                            user.role ===
                                                                'admin'
                                                        }
                                                        className='rounded-xl border border-white/85 bg-white/85 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-[0_16px_24px_-20px_rgba(15,23,42,0.8)] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60'
                                                    >
                                                        {user.isSuspended
                                                            ? 'Unsuspend'
                                                            : 'Suspend'}
                                                    </button>
                                                </td>
                                            </motion.tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {!loading && totalRows > 0 ? (
                            <div className='flex flex-col gap-3 border-t border-white/70 bg-white/45 p-4 sm:flex-row sm:items-center sm:justify-between'>
                                <p className='text-xs text-slate-500'>
                                    Showing {visibleStart}-{visibleEnd} of{' '}
                                    {totalRows}
                                </p>
                                <div className='flex flex-wrap items-center gap-2'>
                                    <label
                                        htmlFor='users-rows-per-page'
                                        className='text-xs font-medium text-slate-600'
                                    >
                                        Rows per page
                                    </label>
                                    <input
                                        id='users-rows-per-page'
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
                                                    500,
                                                    Math.trunc(value),
                                                ),
                                            );
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
                                    {visiblePageNumbers[0] > 1 ? (
                                        <>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    setCurrentPage(1)
                                                }
                                                className='rounded-xl border border-white/85 bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white'
                                            >
                                                1
                                            </button>
                                            <span className='px-1 text-xs text-slate-400'>
                                                ...
                                            </span>
                                        </>
                                    ) : null}
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
                                    {visiblePageNumbers[
                                        visiblePageNumbers.length - 1
                                    ] < totalPages ? (
                                        <>
                                            <span className='px-1 text-xs text-slate-400'>
                                                ...
                                            </span>
                                            <button
                                                type='button'
                                                onClick={() =>
                                                    setCurrentPage(totalPages)
                                                }
                                                className='rounded-xl border border-white/85 bg-white/85 px-2.5 py-1 text-xs font-semibold text-slate-700 transition hover:bg-white'
                                            >
                                                {totalPages}
                                            </button>
                                        </>
                                    ) : null}
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
                    </motion.section>
                </AdminPanelShell>
            </AppShell>
        </AuthGuard>
    );
}
