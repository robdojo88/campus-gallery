import Link from 'next/link';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';

const cards = [
    { href: '/admin/users', label: 'Users', detail: 'Manage users, roles, and suspensions' },
    { href: '/admin/uploads', label: 'Uploads', detail: 'Moderate posts and visitor submissions' },
    { href: '/admin/incognito', label: 'Incognito', detail: 'Review anonymous posts and identities' },
    { href: '/admin/reports', label: 'Reports', detail: 'Handle flagged content and abuse reports' },
    { href: '/admin/analytics', label: 'Analytics', detail: 'Track activity, growth, and engagement' },
];

export default function AdminPage() {
    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <PageHeader
                    eyebrow='Admin'
                    title='Admin Dashboard'
                    description='Central moderation and operations console for Campus Gallery.'
                />
                <section className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                    {cards.map((card) => (
                        <Link
                            key={card.href}
                            href={card.href}
                            className='rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow'
                        >
                            <h2 className='text-lg font-bold'>{card.label}</h2>
                            <p className='mt-2 text-sm text-slate-600'>{card.detail}</p>
                        </Link>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
