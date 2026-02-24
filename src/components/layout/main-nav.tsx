'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
    countUnreadNotifications,
    getCurrentUserProfile,
    getSessionUser,
    searchGlobalContent,
    signOutUser,
    subscribeToNotifications,
} from '@/lib/supabase';
import type { GlobalSearchResults, UserRole } from '@/lib/types';

type NavIconName =
    | 'feed'
    | 'camera'
    | 'date'
    | 'events'
    | 'freedom'
    | 'incognito'
    | 'visitor'
    | 'reviews';

type NavLink = {
    href: string;
    label: string;
    icon: NavIconName;
};

const NAV_ROLE_CACHE_KEY = 'campus_gallery_nav_role';
const NAV_USER_CACHE_KEY = 'campus_gallery_nav_user_id';
const THEME_CACHE_KEY = 'campus_gallery_theme_mode';
const DEFAULT_AVATAR_URL = '/avatar-default.svg';
const LIGHT_BODY_CLASSES = ['bg-slate-100', 'text-slate-900'];
const DARK_BODY_CLASSES = ['bg-slate-950', 'text-slate-100'];

type ThemeMode = 'light' | 'dark';
const EMPTY_SEARCH_RESULTS: GlobalSearchResults = {
    users: [],
    events: [],
    dates: [],
    posts: [],
};

const links = [
    { href: '/feed', label: 'Feed', icon: 'feed' },
    { href: '/camera', label: 'Camera', icon: 'camera' },
    { href: '/gallery/date', label: 'Date Folders', icon: 'date' },
    { href: '/gallery/events', label: 'Events', icon: 'events' },
    { href: '/freedom-wall', label: 'Freedom Wall', icon: 'freedom' },
    { href: '/incognito', label: 'Incognito', icon: 'incognito' },
    { href: '/visitor-gallery', label: 'Visitor', icon: 'visitor' },
    { href: '/reviews', label: 'Visitor Feedback', icon: 'reviews' },
] satisfies NavLink[];

function NotificationBell({
    active,
    unreadCount,
}: {
    active: boolean;
    unreadCount: number;
}) {
    return (
        <span className='relative inline-flex h-5 w-5 items-center justify-center'>
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${active ? 'text-blue-600' : 'text-slate-600'}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <path d='M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5' />
                <path d='M9 17a3 3 0 0 0 6 0' />
            </svg>
            {unreadCount > 0 ? (
                <span className='absolute -right-2 -top-2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white'>
                    {unreadCount > 99 ? '99+' : unreadCount}
                </span>
            ) : null}
        </span>
    );
}

function Icon({ name, active }: { name: NavIconName; active: boolean }) {
    const colorClass = active ? 'text-blue-600' : 'text-slate-600';

    if (name === 'feed') {
        return (
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${colorClass}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <path d='M3 12h7V3H3zM14 21h7v-7h-7zM14 10h7V3h-7zM3 21h7v-4H3z' />
            </svg>
        );
    }

    if (name === 'camera') {
        return (
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${colorClass}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <path d='M4 7h3l2-3h6l2 3h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z' />
                <circle cx='12' cy='13' r='4' />
            </svg>
        );
    }

    if (name === 'date') {
        return (
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${colorClass}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <rect x='3' y='4' width='18' height='18' rx='2' />
                <path d='M16 2v4M8 2v4M3 10h18' />
            </svg>
        );
    }

    if (name === 'events') {
        return (
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${colorClass}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <path d='M7 21V9M17 21V5M7 9l10-4M7 13l10-4' />
            </svg>
        );
    }

    if (name === 'freedom') {
        return (
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${colorClass}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
            </svg>
        );
    }

    if (name === 'incognito') {
        return (
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${colorClass}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <path d='M3 12h3l2-5h8l2 5h3' />
                <circle cx='9' cy='13' r='2' />
                <circle cx='15' cy='13' r='2' />
                <path d='M7 17c1.2 1 2.8 1.5 5 1.5s3.8-.5 5-1.5' />
            </svg>
        );
    }

    if (name === 'visitor') {
        return (
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${colorClass}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <circle cx='12' cy='12' r='9' />
                <path d='M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18' />
            </svg>
        );
    }

    if (name === 'reviews') {
        return (
            <svg
                viewBox='0 0 24 24'
                aria-hidden='true'
                className={`h-5 w-5 ${colorClass}`}
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
            >
                <path d='m12 3 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.9-5.4 2.9 1-6L3.3 9.4l6-.9Z' />
            </svg>
        );
    }

    return (
        <svg
            viewBox='0 0 24 24'
            aria-hidden='true'
            className={`h-5 w-5 ${colorClass}`}
            fill='none'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        >
            <path d='M12 2 4 6v6c0 5 3.5 8.5 8 10 4.5-1.5 8-5 8-10V6l-8-4z' />
            <path d='M9 12h6M12 9v6' />
        </svg>
    );
}

function isLinkActive(pathname: string, href: string): boolean {
    if (href === '/camera') return pathname === '/camera';
    return pathname.startsWith(href);
}

function isMobilePrimaryLink(href: string): boolean {
    return (
        href === '/feed' ||
        href === '/camera' ||
        href === '/gallery/date' ||
        href === '/freedom-wall'
    );
}

function normalizeRole(value: unknown): UserRole | null {
    if (value === 'admin' || value === 'member' || value === 'visitor')
        return value;
    return null;
}

function getCachedRole(): UserRole | null {
    if (typeof window === 'undefined') return null;
    return normalizeRole(window.localStorage.getItem(NAV_ROLE_CACHE_KEY));
}

function getCachedUserId(): string | null {
    if (typeof window === 'undefined') return null;
    const value = window.localStorage.getItem(NAV_USER_CACHE_KEY);
    const trimmed = value?.trim() ?? '';
    return trimmed || null;
}

function cacheAuthSnapshot(role: UserRole, userId: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(NAV_ROLE_CACHE_KEY, role);
    window.localStorage.setItem(NAV_USER_CACHE_KEY, userId);
}

function clearAuthSnapshot(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(NAV_ROLE_CACHE_KEY);
    window.localStorage.removeItem(NAV_USER_CACHE_KEY);
}

function resolveInitialThemeMode(): ThemeMode {
    if (typeof window === 'undefined') return 'light';
    const cached = window.localStorage.getItem(THEME_CACHE_KEY);
    if (cached === 'dark' || cached === 'light') return cached;
    return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
}

function applyBodyTheme(mode: ThemeMode): void {
    if (typeof document === 'undefined') return;
    const body = document.body;
    body.classList.remove(
        ...(mode === 'dark' ? LIGHT_BODY_CLASSES : DARK_BODY_CLASSES),
    );
    body.classList.add(
        ...(mode === 'dark' ? DARK_BODY_CLASSES : LIGHT_BODY_CLASSES),
    );
    document.documentElement.classList.toggle('dark', mode === 'dark');
    document.documentElement.style.colorScheme = mode;
}

function NavIconLink({
    link,
    active,
    compact = false,
}: {
    link: NavLink;
    active: boolean;
    compact?: boolean;
}) {
    return (
        <Link
            key={link.href}
            href={link.href}
            aria-label={link.label}
            title={link.label}
            className={`group relative flex shrink-0 items-center justify-center border border-transparent transition-all duration-200 ${
                compact ? 'h-9 w-9 rounded-lg' : 'h-11 w-11 rounded-xl'
            } ${
                active
                    ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                    : 'text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
            }`}
        >
            <Icon name={link.icon} active={active} />
            <span
                className={`pointer-events-none absolute -bottom-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 ${
                    compact ? 'hidden' : ''
                }`}
            >
                {link.label}
            </span>
        </Link>
    );
}

export function MainNav({
    disableNavigation = false,
}: {
    disableNavigation?: boolean;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const [role, setRole] = useState<UserRole | null>(null);
    const [profileSuspended, setProfileSuspended] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);
    const [userAvatarUrl, setUserAvatarUrl] = useState(DEFAULT_AVATAR_URL);
    const [userDisplayName, setUserDisplayName] = useState('User');
    const [themeMode, setThemeMode] = useState<ThemeMode>(() =>
        resolveInitialThemeMode(),
    );
    const [profileMenuOpen, setProfileMenuOpen] = useState(false);
    const [profileMenuPosition, setProfileMenuPosition] = useState({
        top: 56,
        right: 12,
    });
    const [unreadCount, setUnreadCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchResults, setSearchResults] =
        useState<GlobalSearchResults>(EMPTY_SEARCH_RESULTS);
    const [searchStatus, setSearchStatus] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const profileMenuDesktopButtonRef = useRef<HTMLButtonElement | null>(null);
    const profileMenuMobileButtonRef = useRef<HTMLButtonElement | null>(null);
    const profileMenuPanelRef = useRef<HTMLDivElement | null>(null);
    const searchWrapperRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        applyBodyTheme(themeMode);
        if (typeof window !== 'undefined') {
            window.localStorage.setItem(THEME_CACHE_KEY, themeMode);
        }
    }, [themeMode]);

    useEffect(() => {
        if (!profileMenuOpen) return;

        function updateMenuPosition() {
            const desktopButton = profileMenuDesktopButtonRef.current;
            const mobileButton = profileMenuMobileButtonRef.current;
            const button =
                (desktopButton && desktopButton.offsetParent !== null
                    ? desktopButton
                    : null) ??
                (mobileButton && mobileButton.offsetParent !== null
                    ? mobileButton
                    : null) ??
                desktopButton ??
                mobileButton;
            if (!button || typeof window === 'undefined') return;
            const rect = button.getBoundingClientRect();
            setProfileMenuPosition({
                top: Math.round(rect.bottom + 8),
                right: Math.max(8, Math.round(window.innerWidth - rect.right)),
            });
        }

        function onPointerDown(event: PointerEvent) {
            const target = event.target as Node;
            if (profileMenuDesktopButtonRef.current?.contains(target)) return;
            if (profileMenuMobileButtonRef.current?.contains(target)) return;
            if (profileMenuPanelRef.current?.contains(target)) return;
            setProfileMenuOpen(false);
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setProfileMenuOpen(false);
            }
        }

        const raf = window.requestAnimationFrame(updateMenuPosition);
        window.addEventListener('resize', updateMenuPosition);
        window.addEventListener('scroll', updateMenuPosition, true);
        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            window.cancelAnimationFrame(raf);
            window.removeEventListener('resize', updateMenuPosition);
            window.removeEventListener('scroll', updateMenuPosition, true);
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [profileMenuOpen]);

    useEffect(() => {
        let mounted = true;
        async function load() {
            try {
                const user = await getSessionUser();
                if (!mounted) return;
                if (!user) {
                    clearAuthSnapshot();
                    setRole(null);
                    setProfileSuspended(false);
                    setUserId(null);
                    setUserAvatarUrl(DEFAULT_AVATAR_URL);
                    setUserDisplayName('User');
                    setUnreadCount(0);
                    return;
                }
                setUserId(user.id);
                setUserDisplayName(user.email?.split('@')[0] ?? 'User');

                const metadataRole =
                    normalizeRole(user.user_metadata?.role) ?? 'visitor';
                setRole((current) => current ?? metadataRole);
                const profile = await getCurrentUserProfile();
                if (!mounted) return;
                const resolvedRole = profile?.role ?? metadataRole;
                setProfileSuspended(profile?.isSuspended === true);
                let unread = 0;
                if (resolvedRole !== 'visitor') {
                    try {
                        unread = await countUnreadNotifications();
                    } catch {
                        unread = 0;
                    }
                }
                setRole(resolvedRole);
                setUserDisplayName(
                    profile?.name ?? user.email?.split('@')[0] ?? 'User',
                );
                setUserAvatarUrl(profile?.avatarUrl || DEFAULT_AVATAR_URL);
                setUnreadCount(unread);
                cacheAuthSnapshot(resolvedRole, user.id);
            } catch {
                if (!mounted) return;
                const cachedRole = getCachedRole();
                const cachedUserId = getCachedUserId();
                if (cachedRole) setRole(cachedRole);
                if (cachedUserId) setUserId(cachedUserId);
                setProfileSuspended(false);
                setUserAvatarUrl(DEFAULT_AVATAR_URL);
                setUnreadCount(0);
            }
        }
        void load();
        return () => {
            mounted = false;
        };
    }, []);

    const navigationDisabled = disableNavigation || profileSuspended;

    useEffect(() => {
        if (
            !userId ||
            (role !== 'admin' && role !== 'member') ||
            navigationDisabled
        ) {
            return;
        }

        let mounted = true;
        async function refreshUnread() {
            try {
                const unread = await countUnreadNotifications();
                if (!mounted) return;
                setUnreadCount(unread);
            } catch {
                if (!mounted) return;
                setUnreadCount(0);
            }
        }

        void refreshUnread();
        const unsubscribe = subscribeToNotifications(() => {
            void refreshUnread();
        });
        const pollingTimer = window.setInterval(() => {
            void refreshUnread();
        }, 5000);

        return () => {
            mounted = false;
            unsubscribe();
            window.clearInterval(pollingTimer);
        };
    }, [navigationDisabled, role, userId]);

    const searchResultCount = useMemo(() => {
        return (
            searchResults.users.length +
            searchResults.events.length +
            searchResults.dates.length +
            searchResults.posts.length
        );
    }, [searchResults]);

    useEffect(() => {
        if (navigationDisabled) return;
        if (!searchOpen) return;

        function onPointerDown(event: PointerEvent) {
            const target = event.target as Node;
            if (searchWrapperRef.current?.contains(target)) return;
            setSearchOpen(false);
        }

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setSearchOpen(false);
            }
        }

        document.addEventListener('pointerdown', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('pointerdown', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [navigationDisabled, searchOpen]);

    useEffect(() => {
        if (navigationDisabled) return;
        if (!mobileMenuOpen) return;

        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                setMobileMenuOpen(false);
            }
        }

        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [mobileMenuOpen, navigationDisabled]);

    useEffect(() => {
        if (navigationDisabled) return;
        if (!searchOpen) return;
        const term = searchQuery.trim();
        if (term.length < 2) {
            return;
        }

        let active = true;
        const timer = window.setTimeout(() => {
            setSearchLoading(true);
            setSearchStatus('');
            void searchGlobalContent(term, { limit: 5 })
                .then((results) => {
                    if (!active) return;
                    const scopedResults =
                        role === 'visitor'
                            ? {
                                  ...results,
                                  events: [],
                                  dates: [],
                              }
                            : results;
                    setSearchResults(scopedResults);
                    const total =
                        scopedResults.users.length +
                        scopedResults.events.length +
                        scopedResults.dates.length +
                        scopedResults.posts.length;
                    if (total === 0) {
                        setSearchStatus('No matches found.');
                    }
                })
                .catch(() => {
                    if (!active) return;
                    setSearchStatus('Search failed.');
                    setSearchResults(EMPTY_SEARCH_RESULTS);
                })
                .finally(() => {
                    if (!active) return;
                    setSearchLoading(false);
                });
        }, 280);

        return () => {
            active = false;
            window.clearTimeout(timer);
        };
    }, [navigationDisabled, role, searchOpen, searchQuery]);

    const centerLinks = useMemo(() => {
        if (navigationDisabled) {
            return [];
        }
        if (!role) {
            return links;
        }
        if (role === 'visitor') {
            return links.filter((link) =>
                ['/feed', '/camera', '/visitor-gallery', '/reviews'].includes(
                    link.href,
                ),
            );
        }
        return links;
    }, [navigationDisabled, role]);

    const mobilePrimaryLinks = useMemo(
        () => centerLinks.filter((link) => isMobilePrimaryLink(link.href)),
        [centerLinks],
    );
    const mobileOverflowLinks = useMemo(
        () => centerLinks.filter((link) => !isMobilePrimaryLink(link.href)),
        [centerLinks],
    );
    const mobileOverflowActive = useMemo(
        () =>
            mobileOverflowLinks.some((link) =>
                isLinkActive(pathname, link.href),
            ),
        [mobileOverflowLinks, pathname],
    );
    const notificationsEnabled =
        !navigationDisabled && (role === 'admin' || role === 'member');

    async function onLogout() {
        await signOutUser();
        clearAuthSnapshot();
        setProfileMenuOpen(false);
        setUnreadCount(0);
        setUserId(null);
        setRole(null);
        setProfileSuspended(false);
        setUserAvatarUrl(DEFAULT_AVATAR_URL);
        setUserDisplayName('User');
        router.push('/login');
        router.refresh();
    }

    function onToggleTheme() {
        const nextMode: ThemeMode = themeMode === 'dark' ? 'light' : 'dark';
        setThemeMode(nextMode);
    }

    function onSubmitSearch(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const term = searchQuery.trim();
        if (!term) return;
        setSearchOpen(false);
        router.push(`/search?q=${encodeURIComponent(term)}`);
    }

    return (
        <header className='sticky top-0 z-40 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur'>
            <div className='mx-auto hidden w-full max-w-[1480px] items-center gap-3 px-3 py-2 md:flex md:px-6 lg:px-8'>
                <div className='flex min-w-0 items-center gap-3 md:w-[320px] lg:w-[360px]'>
                    {navigationDisabled ? (
                        <span className='inline-flex items-center gap-2 rounded-xl px-1 py-1 text-lg font-bold tracking-tight text-slate-900'>
                            <span className='relative grid h-9 w-9 place-items-center overflow-hidden '>
                                <Image
                                    src='/spiral.png'
                                    alt='Ripple'
                                    fill
                                    className='object-cover'
                                    sizes='36px'
                                />
                            </span>
                            <span className='hidden sm:inline'>Ripple</span>
                        </span>
                    ) : (
                        <Link
                            href='/'
                            className='inline-flex items-center gap-2 rounded-xl px-1 py-1 text-lg font-bold tracking-tight text-slate-900'
                        >
                            <span className='relative grid h-9 w-9 place-items-center overflow-hidden '>
                                <Image
                                    src='/spiral.png'
                                    alt='Ripple'
                                    fill
                                    className='object-cover'
                                    sizes='36px'
                                />
                            </span>
                            <span className='hidden sm:inline'>Ripple</span>
                        </Link>
                    )}
                    {navigationDisabled ? null : (
                        <div
                            ref={searchWrapperRef}
                            className='relative hidden min-w-0 flex-1 md:block'
                        >
                        <form
                            onSubmit={onSubmitSearch}
                            className='flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-600 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100'
                        >
                            <svg
                                viewBox='0 0 24 24'
                                aria-hidden='true'
                                className='h-4 w-4'
                                fill='none'
                                stroke='currentColor'
                                strokeWidth='2'
                                strokeLinecap='round'
                                strokeLinejoin='round'
                            >
                                <circle cx='11' cy='11' r='7' />
                                <path d='m20 20-3.5-3.5' />
                            </svg>
                            <input
                                type='search'
                                value={searchQuery}
                                onChange={(event) => {
                                    const nextValue = event.target.value;
                                    setSearchQuery(nextValue);
                                    if (nextValue.trim().length < 2) {
                                        setSearchResults(EMPTY_SEARCH_RESULTS);
                                        setSearchStatus('');
                                        setSearchLoading(false);
                                    }
                                }}
                                onFocus={() => {
                                    setSearchOpen(true);
                                    if (searchQuery.trim().length < 2) {
                                        setSearchResults(EMPTY_SEARCH_RESULTS);
                                        setSearchStatus('');
                                    }
                                }}
                                placeholder='Search users, events, dates, posts...'
                                className='w-full bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-500'
                                aria-label='Search Ripple'
                            />
                        </form>
                        {searchOpen ? (
                            <div className='absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 max-h-[70vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl'>
                                {searchLoading ? (
                                    <p className='rounded-xl px-3 py-2 text-sm text-slate-500'>
                                        Searching...
                                    </p>
                                ) : null}
                                {!searchLoading &&
                                searchQuery.trim().length < 2 ? (
                                    <p className='rounded-xl px-3 py-2 text-sm text-slate-500'>
                                        Type at least 2 characters.
                                    </p>
                                ) : null}
                                {!searchLoading &&
                                searchQuery.trim().length >= 2 &&
                                searchStatus ? (
                                    <p className='rounded-xl px-3 py-2 text-sm text-slate-500'>
                                        {searchStatus}
                                    </p>
                                ) : null}

                                {!searchLoading &&
                                searchQuery.trim().length >= 2 &&
                                searchResultCount > 0 ? (
                                    <div className='space-y-2'>
                                        {searchResults.users.length > 0 ? (
                                            <div className='space-y-1'>
                                                <p className='px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'>
                                                    Users
                                                </p>
                                                {searchResults.users.map(
                                                    (user) => (
                                                        <Link
                                                            key={user.id}
                                                            href={`/profile/${user.id}`}
                                                            onClick={() =>
                                                                setSearchOpen(
                                                                    false,
                                                                )
                                                            }
                                                            className='flex items-center gap-2 rounded-xl px-2 py-2 transition hover:bg-slate-50'
                                                        >
                                                            <span className='relative h-8 w-8 overflow-hidden rounded-full border border-slate-200 bg-slate-100'>
                                                                <Image
                                                                    src={
                                                                        user.avatarUrl
                                                                    }
                                                                    alt={
                                                                        user.name
                                                                    }
                                                                    fill
                                                                    className='object-cover'
                                                                    sizes='32px'
                                                                />
                                                            </span>
                                                            <span className='min-w-0'>
                                                                <span className='block truncate text-sm font-medium text-slate-800'>
                                                                    {user.name}
                                                                </span>
                                                                <span className='block truncate text-xs text-slate-500'>
                                                                    {user.email}
                                                                </span>
                                                            </span>
                                                        </Link>
                                                    ),
                                                )}
                                            </div>
                                        ) : null}

                                        {searchResults.events.length > 0 ? (
                                            <div className='space-y-1'>
                                                <p className='px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'>
                                                    Events
                                                </p>
                                                {searchResults.events.map(
                                                    (eventResult) => (
                                                        <Link
                                                            key={eventResult.id}
                                                            href={`/gallery/events?event=${eventResult.id}`}
                                                            onClick={() =>
                                                                setSearchOpen(
                                                                    false,
                                                                )
                                                            }
                                                            className='block rounded-xl px-2 py-2 transition hover:bg-slate-50'
                                                        >
                                                            <span className='block truncate text-sm font-medium text-slate-800'>
                                                                {
                                                                    eventResult.name
                                                                }
                                                            </span>
                                                        </Link>
                                                    ),
                                                )}
                                            </div>
                                        ) : null}

                                        {searchResults.dates.length > 0 ? (
                                            <div className='space-y-1'>
                                                <p className='px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'>
                                                    Date Folders
                                                </p>
                                                {searchResults.dates.map(
                                                    (dateResult) => (
                                                        <Link
                                                            key={
                                                                dateResult.date
                                                            }
                                                            href={`/gallery/date/${dateResult.date}`}
                                                            onClick={() =>
                                                                setSearchOpen(
                                                                    false,
                                                                )
                                                            }
                                                            className='flex items-center justify-between rounded-xl px-2 py-2 transition hover:bg-slate-50'
                                                        >
                                                            <span className='truncate text-sm font-medium text-slate-800'>
                                                                {
                                                                    dateResult.label
                                                                }
                                                            </span>
                                                            <span className='text-xs text-slate-500'>
                                                                {
                                                                    dateResult.count
                                                                }
                                                            </span>
                                                        </Link>
                                                    ),
                                                )}
                                            </div>
                                        ) : null}

                                        {searchResults.posts.length > 0 ? (
                                            <div className='space-y-1'>
                                                <p className='px-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'>
                                                    Posts
                                                </p>
                                                {searchResults.posts.map(
                                                    (postResult) => (
                                                        <Link
                                                            key={postResult.id}
                                                            href='/feed'
                                                            onClick={() =>
                                                                setSearchOpen(
                                                                    false,
                                                                )
                                                            }
                                                            className='block rounded-xl px-2 py-2 transition hover:bg-slate-50'
                                                        >
                                                            <span className='block truncate text-sm font-medium text-slate-800'>
                                                                {
                                                                    postResult.caption
                                                                }
                                                            </span>
                                                            <span className='block truncate text-xs text-slate-500'>
                                                                {
                                                                    postResult.authorName
                                                                }
                                                            </span>
                                                        </Link>
                                                    ),
                                                )}
                                            </div>
                                        ) : null}

                                        <Link
                                            href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                                            onClick={() => setSearchOpen(false)}
                                            className='block rounded-xl bg-slate-900 px-3 py-2 text-center text-sm font-semibold text-white transition hover:bg-slate-700'
                                        >
                                            See all results
                                        </Link>
                                    </div>
                                ) : null}
                            </div>
                        ) : null}
                        </div>
                    )}
                </div>

                <nav className='hidden flex-1 items-center justify-center gap-2 md:flex'>
                    {centerLinks.map((link) => {
                        const active = isLinkActive(pathname, link.href);
                        return (
                            <NavIconLink
                                key={link.href}
                                link={link}
                                active={active}
                            />
                        );
                    })}
                </nav>
                <div className='ml-auto flex items-center gap-2'>
                    {userId ? (
                        <>
                            {notificationsEnabled ? (
                            <Link
                                href='/notifications'
                                aria-label='Notifications'
                                title='Notifications'
                                className={`group relative flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition ${
                                    pathname.startsWith('/notifications')
                                        ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                        : 'text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
                                }`}
                            >
                                <NotificationBell
                                    active={pathname.startsWith(
                                        '/notifications',
                                    )}
                                    unreadCount={unreadCount}
                                />
                                <span className='pointer-events-none absolute -bottom-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100'>
                                    Notifications
                                </span>
                            </Link>
                            ) : null}
                            <div className='relative'>
                                <button
                                    ref={profileMenuDesktopButtonRef}
                                    type='button'
                                    onClick={() =>
                                        setProfileMenuOpen(
                                            (current) => !current,
                                        )
                                    }
                                    className='relative h-10 w-10 rounded-full ring-2 ring-slate-200 transition duration-200 hover:ring-blue-200 focus:outline-none focus-visible:ring-blue-300'
                                    aria-label='Open profile menu'
                                    aria-expanded={profileMenuOpen}
                                >
                                    <span className='absolute inset-0 overflow-hidden rounded-full'>
                                        <Image
                                            src={userAvatarUrl}
                                            alt={`${userDisplayName} profile`}
                                            fill
                                            className='object-cover'
                                            sizes='40px'
                                        />
                                    </span>
                                </button>
                                <span className='pointer-events-none absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-slate-800 text-white ring-2 ring-white'>
                                    <svg
                                        viewBox='0 0 24 24'
                                        aria-hidden='true'
                                        className='h-2.5 w-2.5'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='2.5'
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                    >
                                        <path d='m6 9 6 6 6-6' />
                                    </svg>
                                </span>
                            </div>
                        </>
                    ) : (
                        <Link
                            href='/login'
                            className='rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500'
                        >
                            Login
                        </Link>
                    )}
                </div>
            </div>
            <nav className='mx-auto flex w-full max-w-[1480px] items-center justify-between gap-1 overflow-hidden px-2 py-2 md:hidden md:px-6 lg:px-8'>
                {mobileOverflowLinks.length > 0 ? (
                    <button
                        type='button'
                        onClick={() => setMobileMenuOpen((current) => !current)}
                        aria-label='Open more links'
                        aria-expanded={mobileMenuOpen}
                        className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent transition-all duration-200 ${
                            mobileMenuOpen || mobileOverflowActive
                                ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                : 'text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
                        }`}
                    >
                        <svg
                            viewBox='0 0 24 24'
                            aria-hidden='true'
                            className={`h-5 w-5 ${
                                mobileMenuOpen || mobileOverflowActive
                                    ? 'text-blue-600'
                                    : 'text-slate-600'
                            }`}
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        >
                            <path d='M4 7h16M4 12h16M4 17h16' />
                        </svg>
                        <span className='pointer-events-none absolute -bottom-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100'>
                            More
                        </span>
                    </button>
                ) : null}
                {navigationDisabled ? (
                    <span className='group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-600'>
                        <span className='relative h-7 w-7 overflow-hidden rounded-full ring-1 ring-slate-200'>
                            <Image
                                src='/spiral.png'
                                alt='Ripple'
                                fill
                                className='object-cover'
                                sizes='28px'
                            />
                        </span>
                    </span>
                ) : (
                    <Link
                        href='/'
                        aria-label='Ripple home'
                        title='Ripple'
                        className='group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent transition-all duration-200 text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
                    >
                        <span className='relative h-7 w-7 overflow-hidden rounded-full ring-1 ring-slate-200'>
                            <Image
                                src='/spiral.png'
                                alt='Ripple'
                                fill
                                className='object-cover'
                                sizes='28px'
                            />
                        </span>
                        <span className='pointer-events-none absolute -bottom-9 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100'>
                            Home
                        </span>
                    </Link>
                )}
                {mobilePrimaryLinks.map((link) => {
                    const active = isLinkActive(pathname, link.href);
                    return (
                        <NavIconLink
                            key={link.href}
                            link={link}
                            active={active}
                            compact
                        />
                    );
                })}
                {userId ? (
                    <>
                        {notificationsEnabled ? (
                        <Link
                            href='/notifications'
                            aria-label='Notifications'
                            title='Notifications'
                            className={`group relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent transition-all duration-200 ${
                                pathname.startsWith('/notifications')
                                    ? 'bg-blue-50 text-blue-600 shadow-sm ring-1 ring-blue-100'
                                    : 'text-slate-600 hover:border-slate-200 hover:bg-white hover:text-slate-900'
                            }`}
                        >
                            <NotificationBell
                                active={pathname.startsWith('/notifications')}
                                unreadCount={unreadCount}
                            />
                        </Link>
                        ) : null}
                        <button
                            ref={profileMenuMobileButtonRef}
                            type='button'
                            onClick={() =>
                                setProfileMenuOpen((current) => !current)
                            }
                            className='relative h-9 w-9 shrink-0 overflow-hidden rounded-full ring-2 ring-slate-200 transition duration-200 hover:ring-blue-200 focus:outline-none focus-visible:ring-blue-300'
                            aria-label='Open profile menu'
                            aria-expanded={profileMenuOpen}
                        >
                            <Image
                                src={userAvatarUrl}
                                alt={`${userDisplayName} profile`}
                                fill
                                className='object-cover'
                                sizes='36px'
                            />
                        </button>
                    </>
                ) : (
                    <Link
                        href='/login'
                        className='shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100'
                    >
                        Login
                    </Link>
                )}
            </nav>
            <AnimatePresence>
                {!navigationDisabled &&
                mobileMenuOpen &&
                mobileOverflowLinks.length > 0 ? (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        className='fixed inset-0 z-[180] md:hidden'
                    >
                        <motion.button
                            type='button'
                            aria-label='Close menu'
                            onClick={() => setMobileMenuOpen(false)}
                            className='absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]'
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                        />
                        <motion.aside
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{
                                type: 'spring',
                                stiffness: 360,
                                damping: 34,
                                mass: 0.9,
                            }}
                            className='absolute left-0 top-0 flex h-[100dvh] w-[min(82vw,19rem)] flex-col border-r border-slate-200 bg-white shadow-2xl'
                        >
                            <div className='flex items-center justify-between border-b border-slate-200 px-4 py-4'>
                                <p className='text-sm font-semibold text-slate-900'>
                                    More links
                                </p>
                                <button
                                    type='button'
                                    onClick={() => setMobileMenuOpen(false)}
                                    aria-label='Close menu'
                                    className='rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-100'
                                >
                                    Close
                                </button>
                            </div>
                            <nav className='space-y-1 p-3'>
                                {mobileOverflowLinks.map((link) => {
                                    const active = isLinkActive(
                                        pathname,
                                        link.href,
                                    );
                                    return (
                                        <Link
                                            key={`mobile-overflow-${link.href}`}
                                            href={link.href}
                                            onClick={() =>
                                                setMobileMenuOpen(false)
                                            }
                                            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${
                                                active
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'text-slate-700 hover:bg-slate-100'
                                            }`}
                                        >
                                            <Icon
                                                name={link.icon}
                                                active={active}
                                            />
                                            <span>{link.label}</span>
                                        </Link>
                                    );
                                })}
                            </nav>
                        </motion.aside>
                    </motion.div>
                ) : null}
            </AnimatePresence>
            {profileMenuOpen && userId && typeof document !== 'undefined'
                ? createPortal(
                      <div
                          ref={profileMenuPanelRef}
                          className='fixed z-[200] w-52 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl'
                          style={{
                              top: `${profileMenuPosition.top}px`,
                              right: `${profileMenuPosition.right}px`,
                          }}
                      >
                          {role === 'admin' && !navigationDisabled ? (
                              <Link
                                  href='/admin'
                                  onClick={() => setProfileMenuOpen(false)}
                                  className='block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100'
                              >
                                  Admin Panel
                              </Link>
                          ) : null}
                          <Link
                              href={`/profile/${userId}`}
                              onClick={() => setProfileMenuOpen(false)}
                              className='block rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100'
                          >
                              See Profile
                          </Link>
                          <button
                              type='button'
                              onClick={() => {
                                  onToggleTheme();
                                  setProfileMenuOpen(false);
                              }}
                              className='block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-100'
                          >
                              {themeMode === 'dark'
                                  ? 'Light mode'
                                  : 'Dark mode'}
                          </button>
                          <button
                              type='button'
                              onClick={() => void onLogout()}
                              className='block w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50'
                          >
                              Logout
                          </button>
                      </div>,
                      document.body,
                  )
                : null}
        </header>
    );
}


