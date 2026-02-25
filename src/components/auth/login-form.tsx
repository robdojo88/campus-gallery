'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { signInWithGoogle } from '@/lib/supabase';

type LoginStep = 'choose' | 'existing';

export function LoginForm() {
    const router = useRouter();
    const [step, setStep] = useState<LoginStep>('choose');
    const [status, setStatus] = useState('');
    const [pending, setPending] = useState(false);

    async function onGoogleLogin() {
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

    if (step === 'choose') {
        return (
            <main className='mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-8'>
                <section className='w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
                    <h1 className='text-2xl font-bold'>Welcome to KATOL</h1>
                    <p className='mt-2 text-sm text-slate-600'>Do you already have an account?</p>
                    <div className='mt-6 grid gap-3'>
                        <button
                            type='button'
                            onClick={() => setStep('existing')}
                            className='w-full rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700'
                        >
                            Yes, I already have an account
                        </button>
                        <button
                            type='button'
                            onClick={() => router.push('/register')}
                            className='w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50'
                        >
                            No, I need to create one
                        </button>
                    </div>
                </section>
            </main>
        );
    }

    return (
        <main className='mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-8'>
            <section className='w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm'>
                <h1 className='text-2xl font-bold'>Login</h1>
                <p className='mt-2 text-sm text-slate-600'>Continue with Google to access your existing account.</p>
                <div className='mt-6 space-y-3'>
                    <button
                        type='button'
                        onClick={() => void onGoogleLogin()}
                        disabled={pending}
                        className='w-full rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60'
                    >
                        {pending ? 'Redirecting to Google...' : 'Continue with Google'}
                    </button>
                    <button
                        type='button'
                        onClick={() => {
                            setStep('choose');
                            setStatus('');
                        }}
                        className='w-full rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200'
                    >
                        Back
                    </button>
                </div>
                {status ? <p className='mt-3 text-sm text-red-600'>{status}</p> : null}
                <Link href='/register' className='mt-4 inline-block text-sm font-semibold text-cyan-700 hover:underline'>
                    New here? Create account
                </Link>
            </section>
        </main>
    );
}

