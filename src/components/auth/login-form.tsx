'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signInWithEmail, signInWithGoogle } from '@/lib/supabase';

export function LoginForm() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('');
    const [pending, setPending] = useState(false);

    function friendlyAuthError(message: string): string {
        const normalized = message.toLowerCase();
        if (normalized.includes('invalid login credentials')) {
            return 'Login failed. Check email/password, confirm your email, and make sure you are using the same Supabase project.';
        }
        if (normalized.includes('email not confirmed')) {
            return 'Email not confirmed yet. Confirm from inbox/spam, then try again.';
        }
        return message;
    }

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPending(true);
        setStatus('');
        try {
            await signInWithEmail({ email, password });
            router.push('/feed');
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Login failed.';
            setStatus(friendlyAuthError(message));
        } finally {
            setPending(false);
        }
    }

    async function onGoogleSignIn() {
        setStatus('');
        try {
            await signInWithGoogle();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Google sign-in failed.';
            setStatus(message);
        }
    }

    return (
        <main className='mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-8'>
            <section className='w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
                <h1 className='text-2xl font-bold'>Login</h1>
                <p className='mt-2 text-sm text-slate-600'>Sign in with your campus or visitor account.</p>
                <form onSubmit={onSubmit} className='mt-6 space-y-3'>
                    <input
                        type='email'
                        placeholder='Email'
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                    />
                    <input
                        type='password'
                        placeholder='Password'
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                    />
                    <button
                        type='submit'
                        disabled={pending}
                        className='w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60'
                    >
                        {pending ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                <button
                    type='button'
                    onClick={() => void onGoogleSignIn()}
                    className='mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50'
                >
                    Continue with Google
                </button>
                {status ? <p className='mt-3 text-sm text-red-600'>{status}</p> : null}
                <Link href='/register' className='mt-4 inline-block text-sm font-semibold text-cyan-700 hover:underline'>
                    Need an account? Register
                </Link>
            </section>
        </main>
    );
}
