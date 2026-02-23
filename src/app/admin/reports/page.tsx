import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';

const reports = [
    { id: 'rep-1', type: 'Inappropriate Comment', target: 'Post p2', status: 'open' },
    { id: 'rep-2', type: 'Spam', target: 'Freedom Post f1', status: 'reviewing' },
];

export default function AdminReportsPage() {
    return (
        <AuthGuard roles={['admin']}>
            <AppShell>
                <PageHeader
                    eyebrow='Admin'
                    title='Reports Queue'
                    description='Central queue for user-reported content across feed, comments, and anonymous posts.'
                />
                <section className='space-y-3'>
                    {reports.map((report) => (
                        <article key={report.id} className='rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'>
                            <div className='flex items-center justify-between'>
                                <div>
                                    <p className='text-sm font-semibold text-slate-800'>{report.type}</p>
                                    <p className='text-xs text-slate-500'>{report.target}</p>
                                </div>
                                <span className='rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800'>
                                    {report.status}
                                </span>
                            </div>
                        </article>
                    ))}
                </section>
            </AppShell>
        </AuthGuard>
    );
}
