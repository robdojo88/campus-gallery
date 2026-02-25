'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { RootAppShell } from '@/components/layout/app-shell';

function shouldDisableShell(pathname: string): boolean {
    return pathname === '/login' || pathname === '/register';
}

export function ShellRouter({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    if (shouldDisableShell(pathname)) {
        return <>{children}</>;
    }
    return <RootAppShell>{children}</RootAppShell>;
}
