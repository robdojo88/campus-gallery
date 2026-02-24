import Link from 'next/link';
import { AppShell } from '@/components/layout/app-shell';

export default function Home() {
    return (
        <AppShell>
            <section className='grid gap-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[1.1fr_0.9fr] md:p-10'>
                <div className='space-y-5'>
                    <p className='text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700'>
                        Camera-first Social Platform
                    </p>
                    <h1 className='text-4xl font-bold tracking-tight md:text-5xl'>
                        Ripple
                    </h1>
                    <p className='max-w-2xl text-base text-slate-600 md:text-lg'>
                        Real-time, role-based, and offline-capable social
                        sharing where every image is captured live from the
                        website camera.
                    </p>
                    <div className='flex flex-wrap gap-3'>
                        <Link
                            href='/feed'
                            className='rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500'
                        >
                            Open Realtime Feed
                        </Link>
                        <Link
                            href='/camera'
                            className='rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50'
                        >
                            Launch Camera
                        </Link>
                    </div>
                </div>
                <div className='space-y-3 rounded-2xl bg-slate-900 p-5 text-slate-100'>
                    <p className='text-sm font-semibold text-cyan-300'>
                        System Identity
                    </p>
                    <ul className='space-y-2 text-sm'>
                        <li>Camera-only uploads</li>
                        <li>Realtime interactions</li>
                        <li>Offline pending queue</li>
                        <li>Incognito anonymous posting</li>
                        <li>Admin moderation controls</li>
                    </ul>
                </div>
            </section>
        </AppShell>
    );
}
