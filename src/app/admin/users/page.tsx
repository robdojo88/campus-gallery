'use client';

import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchUsers } from '@/lib/supabase';
import type { User } from '@/lib/types';

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [status, setStatus] = useState('Loading users...');

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchUsers();
                setUsers(data);
                setStatus(data.length === 0 ? 'No users found.' : '');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load users.';
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
                    title='Manage Users'
                    description='Create, suspend, delete users, and adjust role-based access.'
                />
                {status ? <p className='mb-3 text-sm text-slate-600'>{status}</p> : null}
                <section className='overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm'>
                    <table className='w-full text-left text-sm'>
                        <thead className='bg-slate-50 text-slate-600'>
                            <tr>
                                <th className='px-4 py-3'>Name</th>
                                <th className='px-4 py-3'>Role</th>
                                <th className='px-4 py-3'>Email</th>
                                <th className='px-4 py-3'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((user) => (
                                <tr key={user.id} className='border-t border-slate-200'>
                                    <td className='px-4 py-3 font-medium'>{user.name}</td>
                                    <td className='px-4 py-3 capitalize'>{user.role}</td>
                                    <td className='px-4 py-3 text-slate-600'>{user.email}</td>
                                    <td className='px-4 py-3'>
                                        <button className='rounded-lg border border-slate-300 px-3 py-1 text-xs font-semibold'>
                                            Suspend
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </section>
            </AppShell>
        </AuthGuard>
    );
}
