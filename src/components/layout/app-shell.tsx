import type { ReactNode } from 'react';
import { MainNav } from '@/components/layout/main-nav';

export function AppShell({ children }: { children: ReactNode }) {
    return (
        <div className='min-h-screen'>
            <MainNav />
            <main className='mx-auto w-full max-w-7xl px-4 pb-24 pt-6 md:px-8 md:pt-8'>
                {children}
            </main>
        </div>
    );
}
