'use client';

import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ensureUserProfile, getCurrentUserProfile, getSessionUser } from '@/lib/supabase';
import type { UserRole } from '@/lib/types';

export function AuthGuard({
    children,
    roles,
}: {
    children: ReactNode;
    roles?: UserRole[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [loading, setLoading] = useState(true);
    const [allowed, setAllowed] = useState(false);
    const rolesKey = roles?.join('|') ?? '';
    const normalizedRoles = useMemo<UserRole[]>(
        () => (rolesKey ? (rolesKey.split('|').filter(Boolean) as UserRole[]) : []),
        [rolesKey],
    );

    function fallbackRouteForRole(role: UserRole): string {
        if (role === 'visitor') return '/visitor-gallery';
        if (role === 'admin' || role === 'member') return '/feed';
        return '/login';
    }

    function roleFromMetadata(value: unknown): UserRole {
        if (value === 'admin' || value === 'member' || value === 'visitor') return value;
        return 'member';
    }

    useEffect(() => {
        let mounted = true;
        async function verify() {
            try {
                const user = await getSessionUser();
                if (!user) {
                    if (pathname !== '/login') {
                        router.replace('/login');
                    }
                    return;
                }

                let profile = null;
                try {
                    profile = await getCurrentUserProfile();
                    if (!profile) {
                        await ensureUserProfile(user);
                        profile = await getCurrentUserProfile();
                    }
                } catch {
                    profile = null;
                }

                const effectiveRole = profile?.role ?? roleFromMetadata(user.user_metadata?.role);

                if (normalizedRoles.length === 0) {
                    if (mounted) setAllowed(true);
                    return;
                }
                if (!normalizedRoles.includes(effectiveRole)) {
                    const fallback = fallbackRouteForRole(effectiveRole);
                    if (pathname !== fallback) {
                        router.replace(fallback);
                    }
                    return;
                }
                if (mounted) setAllowed(true);
            } catch {
                if (pathname !== '/login') {
                    router.replace('/login');
                }
            } finally {
                if (mounted) setLoading(false);
            }
        }

        void verify();
        return () => {
            mounted = false;
        };
    }, [normalizedRoles, pathname, rolesKey, router]);

    if (loading) {
        return (
            <div className='rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600'>
                Loading account session...
            </div>
        );
    }

    if (!allowed) return null;

    return <>{children}</>;
}
