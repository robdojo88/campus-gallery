'use client';

import { motion } from 'framer-motion';

export function SessionLoader({ fullscreen = true }: { fullscreen?: boolean }) {
    const containerClass = fullscreen
        ? 'grid min-h-screen place-items-center px-4 py-10'
        : 'grid min-h-[42vh] place-items-center px-4 py-10';

    return (
        <div className={containerClass}>
            <motion.section
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className='w-full max-w-sm rounded-3xl border border-slate-200 bg-white/95 p-8 shadow-[0_20px_70px_-40px_rgba(15,23,42,0.65)] backdrop-blur'
            >
                <div className='mx-auto flex w-fit items-center gap-2'>
                    {[0, 1, 2].map((index) => (
                        <motion.span
                            key={index}
                            className='h-3 w-3 rounded-full bg-cyan-500'
                            animate={{
                                y: [0, -8, 0],
                                opacity: [0.4, 1, 0.4],
                                scale: [0.88, 1, 0.88],
                            }}
                            transition={{
                                duration: 0.9,
                                repeat: Number.POSITIVE_INFINITY,
                                ease: 'easeInOut',
                                delay: index * 0.12,
                            }}
                        />
                    ))}
                </div>
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.15, duration: 0.25 }}
                    className='mt-5 text-center text-sm font-semibold text-slate-700'
                >
                    Initializing ...
                </motion.p>
                <div className='mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100'>
                    <motion.div
                        className='h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-600'
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{
                            duration: 1.2,
                            repeat: Number.POSITIVE_INFINITY,
                            ease: 'easeInOut',
                        }}
                    />
                </div>
            </motion.section>
        </div>
    );
}
