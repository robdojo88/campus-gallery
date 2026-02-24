'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signInWithGoogle } from '@/lib/supabase';

export function RegisterForm() {
    const router = useRouter();
    const [usn, setUsn] = useState('');
    const [status, setStatus] = useState('');
    const [pending, setPending] = useState(false);

    function normalizedUsn(value: string): string {
        return value.trim().toUpperCase();
    }

    async function onGoogleRegisterWithUsn() {
        const checkedUsn = normalizedUsn(usn);
        if (!checkedUsn) {
            setStatus('USN is required.');
            return;
        }

        setPending(true);
        setStatus('');
        try {
            await signInWithGoogle(checkedUsn);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Google sign-in failed.';
            setStatus(message);
            setPending(false);
        }
    }

    async function onGoogleRegisterWithoutUsn() {
        setPending(true);
        setStatus('');
        try {
            await signInWithGoogle();
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Google sign-in failed.';
            setStatus(message);
            setPending(false);
        }
    }

    return (
        <main className='mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-8'>
            <section className='w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
                <h1 className='text-2xl font-bold'>Create Account</h1>
                <p className='mt-2 text-sm text-slate-600'>Enter your USN first, then continue with Google. No USN is allowed and will register you as visitor.</p>
                <div className='mt-6 space-y-3'>
                    <input
                        placeholder='USN'
                        value={usn}
                        onChange={(event) => setUsn(event.target.value.toUpperCase())}
                        className='w-full rounded-xl border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-cyan-600'
                    />
                    <button
                        type='button'
                        onClick={() => void onGoogleRegisterWithUsn()}
                        disabled={pending}
                        className='w-full rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-60'
                    >
                        {pending ? 'Redirecting to Google...' : 'Submit USN and Register'}
                    </button>
                    <button
                        type='button'
                        onClick={() => void onGoogleRegisterWithoutUsn()}
                        disabled={pending}
                        className='w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60'
                    >
                        No USN, proceed to register
                    </button>
                    <button
                        type='button'
                        onClick={() => router.push('/login')}
                        className='w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200'
                    >
                        I already have an account
                    </button>
                </div>
                {status ? <p className='mt-3 text-sm text-red-600'>{status}</p> : null}
                <Link href='/login' className='mt-4 inline-block text-sm font-semibold text-cyan-700 hover:underline'>
                    Back to account question
                </Link>
            </section>
        </main>
    );
}
