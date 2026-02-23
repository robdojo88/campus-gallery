'use client';

import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth/auth-guard';
import { PostCard } from '@/components/feed/post-card';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';
import { fetchUserProfile } from '@/lib/supabase';
import type { Post, User } from '@/lib/types';

export default function ProfilePage() {
    const params = useParams<{ id: string }>();
    const [user, setUser] = useState<User | null>(null);
    const [posts, setPosts] = useState<Post[]>([]);
    const [totalLikes, setTotalLikes] = useState(0);
    const [status, setStatus] = useState('Loading profile...');

    useEffect(() => {
        async function load() {
            try {
                const data = await fetchUserProfile(params.id);
                setUser(data.user);
                setPosts(data.posts);
                setTotalLikes(data.totalLikes);
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
                        <div className='flex items-center gap-4'>
                            {user.avatarUrl ? (
                                <Image
                                    src={user.avatarUrl}
                                    alt={user.name}
                                    width={80}
                                    height={80}
                                    className='rounded-2xl object-cover'
                                />
                            ) : (
                                <div className='grid h-20 w-20 place-items-center rounded-2xl bg-slate-200 text-xl font-bold text-slate-700'>
                                    {user.name.slice(0, 1).toUpperCase()}
                                </div>
                            )}
                            <div>
                                <p className='text-sm text-slate-500'>{user.email}</p>
                                <p className='mt-1 text-sm font-semibold capitalize text-cyan-700'>{user.role}</p>
                                <p className='text-xs text-slate-500'>
                                    Joined {new Date(user.createdAt).toLocaleDateString()}
                                </p>
                            </div>
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
            </AppShell>
        </AuthGuard>
    );
}
