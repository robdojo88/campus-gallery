import Link from 'next/link';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AdminPanelShell } from '@/components/admin/admin-panel-shell';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { ADMIN_NAV_LINKS } from '@/lib/admin-panel';

export default function AdminPage() {
    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <AdminPanelShell>
                    <PageHeader
                        eyebrow='Admin workspace'
                        title='Admin Panel'
                        description='Manage users, registry, events, reports, and analytics from one consistent workspace.'
                    />
                    {/* <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                        {ADMIN_NAV_LINKS.map((item) => (
                            <article
                                key={item.href}
                                className='rounded-[28px] border border-white/75 bg-gradient-to-br from-white/90 via-white/82 to-slate-100/74 p-5 shadow-[0_28px_70px_-46px_rgba(15,23,42,0.62)] backdrop-blur-xl'
                            >
                                <p className='text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500'>
                                    Admin Section
                                </p>
                                <h2 className='mt-1 text-lg font-semibold tracking-tight text-slate-900'>
                                    {item.label}
                                </h2>
                                <p className='mt-2 text-sm text-slate-600'>
                                    Open {item.label.toLowerCase()} management.
                                </p>
                                <Link
                                    href={item.href}
                                    className='mt-4 inline-flex rounded-2xl border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-800 transition hover:bg-white'
                                >
                                    Open
                                </Link>
                            </article>
                        ))}
                    </section> */}
                </AdminPanelShell>
            </AppShell>
        </AuthGuard>
    );
}
