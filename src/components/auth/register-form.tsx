'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { resendConfirmationEmail, signInWithGoogle, signUpWithEmail } from '@/lib/supabase';

export function RegisterForm() {
    const router = useRouter();
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'member' | 'visitor'>('member');
    const [incognitoAlias, setIncognitoAlias] = useState('');
    const [password, setPassword] = useState('');
    const [status, setStatus] = useState('');
    const [needsEmailConfirmation, setNeedsEmailConfirmation] = useState(false);
    const [pending, setPending] = useState(false);
    const [resending, setResending] = useState(false);

    async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (role === 'member' && !incognitoAlias.trim()) {
            setStatus('Incognito alias is required for campus members.');
            return;
        }
        setPending(true);
        setStatus('');
        setNeedsEmailConfirmation(false);
        try {
            const result = await signUpWithEmail({
                name,
                email,
                password,
                role,
                incognitoAlias: role === 'member' ? incognitoAlias : undefined,
            });
            if (!result.session) {
                setNeedsEmailConfirmation(true);
                setStatus('Registration successful. Check your inbox (and spam) for the confirmation email.');
                return;
            }
            router.push('/feed');
            router.refresh();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Registration failed.';
            setStatus(message);
        } finally {
            setPending(false);
        }
    }

    async function onResend() {
        if (!email) {
            setStatus('Enter your email first.');
            return;
        }
        setResending(true);
        setStatus('');
        try {
            await resendConfirmationEmail(email);
            setStatus('Confirmation email resent. Check inbox and spam.');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to resend confirmation email.';
            setStatus(message);
        } finally {
            setResending(false);
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
                <h1 className='text-2xl font-bold'>Register</h1>
                <p className='mt-2 text-sm text-slate-600'>Create your Ripple account.</p>
                <form onSubmit={onSubmit} className='mt-6 space-y-3'>
                    <input
                        placeholder='Full Name'
                        value={name}
                        onChange={(event) => setName(event.target.value)}
                        required
                        className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                    />
                    <input
                        type='email'
                        placeholder='Email'
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                        required
                        className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                    />
                    <select
                        value={role}
                        onChange={(event) => {
                            const nextRole = event.target.value as 'member' | 'visitor';
                            setRole(nextRole);
                            if (nextRole === 'visitor') {
                                setIncognitoAlias('');
                            }
                        }}
                        className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                    >
                        <option value='member'>Campus Member</option>
                        <option value='visitor'>Visitor</option>
                    </select>
                    {role === 'member' ? (
                        <>
                            <input
                                placeholder='Incognito Alias'
                                value={incognitoAlias}
                                onChange={(event) => setIncognitoAlias(event.target.value)}
                                required
                                minLength={3}
                                maxLength={24}
                                pattern='[A-Za-z0-9._-]{3,24}'
                                className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                            />
                            <p className='text-xs text-slate-500'>
                                Required for Incognito posts. This alias cannot be changed in-app after signup.
                            </p>
                        </>
                    ) : null}
                    <input
                        type='password'
                        placeholder='Password'
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        required
                        minLength={6}
                        className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm outline-none focus:border-cyan-600'
                    />
                    <button
                        type='submit'
                        disabled={pending}
                        className='w-full rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60'
                    >
                        {pending ? 'Creating account...' : 'Create Account'}
                    </button>
                </form>
                <button
                    type='button'
                    onClick={() => void onGoogleSignIn()}
                    className='mt-3 w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50'
                >
                    Continue with Google
                </button>
                {status ? <p className='mt-3 text-sm text-slate-700'>{status}</p> : null}
                {needsEmailConfirmation ? (
                    <button
                        type='button'
                        onClick={() => void onResend()}
                        disabled={resending}
                        className='mt-3 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60'
                    >
                        {resending ? 'Resending...' : 'Resend Confirmation Email'}
                    </button>
                ) : null}
                <Link href='/login' className='mt-4 inline-block text-sm font-semibold text-cyan-700 hover:underline'>
                    Already have an account? Login
                </Link>
            </section>
        </main>
    );
}
