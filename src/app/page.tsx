'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { AppShell } from '@/components/layout/app-shell';

const quickStats = [
    { label: 'Sync', value: 'Realtime' },
    { label: 'Capture', value: 'Device Camera' },
    { label: 'Mode', value: 'Campus + Public' },
];

export default function Home() {
    return (
        <AppShell>
            <section className='relative isolate h-screen overflow-hidden bg-gradient-to-br from-[#04070d] via-[#060c14] to-[#0b1320] p-5 text-slate-100 shadow-[0_35px_90px_-50px_rgba(2,6,23,0.85)] backdrop-blur-xl xl:h-auto xl:rounded-[2.2rem] sm:p-8 lg:p-10'>
                <motion.div
                    aria-hidden
                    className='pointer-events-none absolute inset-[-10%] z-0 bg-[radial-gradient(circle_at_12%_18%,rgba(56,189,248,0.22),transparent_36%),radial-gradient(circle_at_85%_15%,rgba(59,130,246,0.2),transparent_40%),radial-gradient(circle_at_52%_92%,rgba(45,212,191,0.16),transparent_42%)] opacity-85'
                    style={{ backgroundSize: '125% 125%' }}
                    animate={{
                        x: [0, 18, -15, 0],
                        y: [0, -14, 12, 0],
                        scale: [1, 1.04, 1],
                        backgroundPosition: [
                            '0% 0%',
                            '35% 25%',
                            '15% 55%',
                            '0% 0%',
                        ],
                    }}
                    transition={{
                        duration: 18,
                        ease: 'easeInOut',
                        repeat: Number.POSITIVE_INFINITY,
                    }}
                />
                <motion.div
                    aria-hidden
                    className='pointer-events-none absolute -right-24 -top-24 -z-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl'
                    animate={{
                        x: [0, 18, 0],
                        y: [0, 28, 0],
                        scale: [1, 1.06, 1],
                    }}
                    transition={{
                        duration: 16,
                        ease: 'easeInOut',
                        repeat: Number.POSITIVE_INFINITY,
                    }}
                />
                <motion.div
                    aria-hidden
                    className='pointer-events-none absolute -bottom-28 -left-14 -z-20 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl'
                    animate={{
                        x: [0, -12, 0],
                        y: [0, -24, 0],
                        scale: [1, 1.08, 1],
                    }}
                    transition={{
                        duration: 20,
                        ease: 'easeInOut',
                        repeat: Number.POSITIVE_INFINITY,
                    }}
                />

                <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    className='relative z-10'
                >
                    <div className='space-y-6'>
                        <motion.h1
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.12, duration: 0.42 }}
                            className='flex items-center gap-3 text-2xl font-bold tracking-tight text-slate-100 sm:text-4xl'
                        >
                            <div className='flex w-full items-center gap-3'>
                                <motion.div
                                    animate={{ rotate: [0, 360] }}
                                    transition={{
                                        duration: 24,
                                        ease: 'linear',
                                        repeat: Number.POSITIVE_INFINITY,
                                    }}
                                >
                                    <Image
                                        src='/spiral_light.png'
                                        alt='KATOL spiral logo'
                                        width={80}
                                        height={80}
                                        priority
                                        className='h-10 w-10 rounded-full shadow-[0_0_26px_rgba(34,211,238,0.45)]'
                                    />
                                </motion.div>
                                KATOL Gallery
                            </div>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.18, duration: 0.4 }}
                            className='max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg'
                        >
                            <strong>K</strong>eep <strong>A</strong>ll{' '}
                            <strong>T</strong>houghts <strong>O</strong>n{' '}
                            <strong>L</strong>oop. Built for instant capture,
                            sharp identity, and a premium glass-first feel.
                        </motion.p>

                        <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.24, duration: 0.35 }}
                            className='flex justify-between md:justify-start gap-4 w-full lg:w-auto'
                        >
                            <Link
                                href='/feed'
                                className='h-44 w-48 lg:h-auto flex items-center justify-center rounded-2xl border border-cyan-400/70 bg-cyan-500/80 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_-12px_rgba(8,145,178,0.9)] transition hover:translate-y-[-1px] hover:bg-cyan-400/90'
                            >
                                Open Realtime Feed
                            </Link>
                            <Link
                                href='/camera'
                                className='h-44 w-48 lg:h-auto flex items-center justify-center rounded-2xl border border-white/20 bg-white/8 px-5 py-2.5 text-sm font-semibold text-slate-100 backdrop-blur transition hover:-translate-y-[1px] hover:bg-white/15'
                            >
                                Launch Camera
                            </Link>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3, duration: 0.42 }}
                            className='grid gap-3 sm:grid-cols-3'
                        >
                            {quickStats.map((item) => (
                                <div
                                    key={item.label}
                                    className='rounded-2xl border border-white/15 bg-white/8 px-4 py-3 backdrop-blur h-28 lg-auto'
                                >
                                    <p className='text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400'>
                                        {item.label}
                                    </p>
                                    <p className='mt-1 text-sm font-semibold text-slate-100'>
                                        {item.value}
                                    </p>
                                </div>
                            ))}
                        </motion.div>
                    </div>
                </motion.div>
            </section>
        </AppShell>
    );
}
