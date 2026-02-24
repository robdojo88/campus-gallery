'use client';

import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { PostCard } from '@/components/feed/post-card';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchUserProfile, getSessionUser, setCurrentUserIncognitoAlias, uploadProfileAvatar } from '@/lib/supabase';
import type { Post, User } from '@/lib/types';

export default function ProfilePage() {
    const params = useParams<{ id: string }>();
    const [user, setUser] = useState<User | null>(null);
    const [viewerId, setViewerId] = useState<string | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [totalLikes, setTotalLikes] = useState(0);
    const [status, setStatus] = useState('Loading profile...');
    const [avatarStatus, setAvatarStatus] = useState('');
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [avatarViewerOpen, setAvatarViewerOpen] = useState(false);
    const [aliasInput, setAliasInput] = useState('');
    const [aliasSaving, setAliasSaving] = useState(false);
    const [aliasStatus, setAliasStatus] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const [data, sessionUser] = await Promise.all([fetchUserProfile(params.id), getSessionUser()]);
                setUser(data.user);
                setAliasInput(data.user.incognitoAlias ?? '');
                setPosts(data.posts);
                setTotalLikes(data.totalLikes);
                setViewerId(sessionUser?.id ?? null);
                setStatus('');
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to load profile.';
                setStatus(message);
            }
        }
        if (params.id) {
            void load();
        }
    }, [params.id]);

    const isOwnProfile = Boolean(viewerId && user && viewerId === user.id);
    const canSetAlias = Boolean(isOwnProfile && user?.role === 'member' && !user?.incognitoAlias);

    async function onSetAlias() {
        if (!canSetAlias) return;
        setAliasSaving(true);
        setAliasStatus('');
        try {
            const savedAlias = await setCurrentUserIncognitoAlias(aliasInput);
            setUser((previous) => (previous ? { ...previous, incognitoAlias: savedAlias } : previous));
            setAliasInput(savedAlias);
            setAliasStatus('Incognito alias saved. You can no longer change it here.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to save incognito alias.';
            setAliasStatus(message);
        } finally {
            setAliasSaving(false);
        }
    }

    async function onAvatarChange(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file || !isOwnProfile) return;

        setAvatarUploading(true);
        setAvatarStatus('');
        try {
            const avatarUrl = await uploadProfileAvatar(file);
            setUser((previous) => (previous ? { ...previous, avatarUrl } : previous));
            setAvatarStatus('Profile picture updated.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to update profile picture.';
            setAvatarStatus(message);
        } finally {
            setAvatarUploading(false);
        }
    }

    useEffect(() => {
        if (!avatarViewerOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setAvatarViewerOpen(false);
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [avatarViewerOpen]);

    return (
        <AuthGuard roles={['admin', 'member']}>
            <AppShell>
                <PageHeader
                    eyebrow='Profile'
                    title={user?.name ?? 'User Profile'}
                    description='Public profile with uploads, likes received, role, and account details.'
                />
                {status ? <p className='mb-4 text-sm text-slate-600'>{status}</p> : null}
                {user ? (
                    <section className='mb-6 grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[0.8fr_1.2fr]'>
                        <div className='flex flex-col gap-3'>
                            <div className='flex items-center gap-4'>
                                <button
                                    type='button'
                                    onClick={() => setAvatarViewerOpen(true)}
                                    className='relative h-20 w-20 overflow-hidden rounded-full bg-slate-200 text-xl font-bold text-slate-700 ring-2 ring-slate-200'
                                    aria-label='Open full profile picture'
                                >
                                    {user.avatarUrl ? (
                                        <Image
                                            src={user.avatarUrl}
                                            alt={user.name}
                                            fill
                                            className='object-cover'
                                            sizes='80px'
                                        />
                                    ) : (
                                        <span className='grid h-full w-full place-items-center'>
                                            {user.name.slice(0, 1).toUpperCase()}
                                        </span>
                                    )}
                                </button>
                                <div>
                                    <p className='text-sm text-slate-500'>{user.email}</p>
                                    <p className='mt-1 text-sm font-semibold capitalize text-cyan-700'>{user.role}</p>
                                    <p className='text-xs text-slate-500'>
                                        Joined {new Date(user.createdAt).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                            {isOwnProfile ? (
                                <div>
                                    <label className='inline-flex cursor-pointer items-center rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700'>
                                        <input
                                            type='file'
                                            accept='image/*'
                                            className='hidden'
                                            onChange={(event) => void onAvatarChange(event)}
                                            disabled={avatarUploading}
                                        />
                                        {avatarUploading ? 'Uploading photo...' : 'Change Profile Photo'}
                                    </label>
                                    <p className='mt-2 text-xs text-slate-500'>
                                        Your profile picture is required. Add or update it anytime.
                                    </p>
                                    {avatarStatus ? <p className='mt-1 text-xs text-slate-600'>{avatarStatus}</p> : null}
                                </div>
                            ) : null}
                            {isOwnProfile && user.role === 'member' ? (
                                <div className='rounded-2xl border border-slate-200 bg-slate-50 p-3'>
                                    <p className='text-xs font-semibold uppercase tracking-wide text-slate-600'>Incognito Alias</p>
                                    {user.incognitoAlias ? (
                                        <>
                                            <p className='mt-1 text-sm font-semibold text-slate-900'>{user.incognitoAlias}</p>
                                            <p className='mt-1 text-xs text-slate-500'>
                                                This alias is locked. Contact admin or developer if you need a change.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <div className='mt-2 flex gap-2'>
                                                <input
                                                    value={aliasInput}
                                                    onChange={(event) => setAliasInput(event.target.value)}
                                                    placeholder='Set your incognito alias'
                                                    minLength={3}
                                                    maxLength={24}
                                                    pattern='[A-Za-z0-9._-]{3,24}'
                                                    className='flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                                                />
                                                <button
                                                    type='button'
                                                    onClick={() => void onSetAlias()}
                                                    disabled={aliasSaving}
                                                    className='rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60'
                                                >
                                                    {aliasSaving ? 'Saving...' : 'Set Alias'}
                                                </button>
                                            </div>
                                            <p className='mt-1 text-xs text-slate-500'>
                                                Required for Incognito. Use 3-24 letters, numbers, dot, underscore, or hyphen.
                                            </p>
                                        </>
                                    )}
                                    {aliasStatus ? <p className='mt-1 text-xs text-slate-600'>{aliasStatus}</p> : null}
                                </div>
                            ) : null}
                        </div>
                        <div className='grid grid-cols-3 gap-3'>
                            <div className='rounded-2xl bg-slate-50 p-3 text-center'>
                                <p className='text-2xl font-bold'>{posts.length}</p>
                                <p className='text-xs text-slate-600'>Uploads</p>
                            </div>
                            <div className='rounded-2xl bg-slate-50 p-3 text-center'>
                                <p className='text-2xl font-bold'>{totalLikes}</p>
                                <p className='text-xs text-slate-600'>Likes</p>
                            </div>
                            <div className='rounded-2xl bg-slate-50 p-3 text-center'>
                                <p className='text-2xl font-bold'>{user.role === 'admin' ? 'Full' : 'Scoped'}</p>
                                <p className='text-xs text-slate-600'>Access</p>
                            </div>
                        </div>
                    </section>
                ) : null}
                <section className='grid gap-4 md:grid-cols-2'>
                    {posts.map((post) => (
                        <PostCard key={`${post.id}-${post.likes}-${post.comments}`} post={post} />
                    ))}
                </section>
                {avatarViewerOpen && user?.avatarUrl ? (
                    <div
                        className='fixed inset-0 z-[120] bg-black/90 p-4'
                        onClick={(event) => {
                            if (event.target === event.currentTarget) {
                                setAvatarViewerOpen(false);
                            }
                        }}
                    >
                        <button
                            type='button'
                            onClick={() => setAvatarViewerOpen(false)}
                            className='absolute right-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-30 rounded-full bg-white/20 px-3 py-1 text-sm font-semibold text-white hover:bg-white/30'
                        >
                            Close
                        </button>
                        <div className='flex h-full items-center justify-center'>
                            <Image
                                src={user.avatarUrl}
                                alt={`${user.name} profile picture`}
                                width={1600}
                                height={1600}
                                className='max-h-[90vh] max-w-[95vw] rounded-2xl object-contain'
                            />
                        </div>
                    </div>
                ) : null}
            </AppShell>
        </AuthGuard>
    );
}
