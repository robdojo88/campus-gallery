'use client';

import { motion } from 'framer-motion';

function shimmerTransition(delay = 0) {
    return {
        duration: 1.1,
        repeat: Number.POSITIVE_INFINITY,
        ease: 'easeInOut' as const,
        delay,
    };
}

export function FeedLoader({ count = 3, compact = false }: { count?: number; compact?: boolean } = {}) {
    const placeholders = Array.from({ length: count });

    return (
        <div className='mx-auto w-full max-w-3xl space-y-4'>
            {placeholders.map((_, index) => (
                <motion.article
                    key={`feed-loader-${index}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: index * 0.05 }}
                    className={`overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm ${
                        compact ? 'opacity-90' : ''
                    }`}
                >
                    <motion.div
                        className={`w-full rounded-2xl bg-slate-100 ${compact ? 'h-44' : 'h-56'}`}
                        animate={{ opacity: [0.45, 0.9, 0.45] }}
                        transition={shimmerTransition(index * 0.08)}
                    />
                    <div className='mt-4 space-y-3'>
                        <motion.div
                            className='h-3 w-1/3 rounded-full bg-slate-100'
                            animate={{ opacity: [0.45, 0.95, 0.45] }}
                            transition={shimmerTransition(index * 0.08 + 0.06)}
                        />
                        <motion.div
                            className='h-3 w-5/6 rounded-full bg-slate-100'
                            animate={{ opacity: [0.45, 0.95, 0.45] }}
                            transition={shimmerTransition(index * 0.08 + 0.12)}
                        />
                        <motion.div
                            className='h-3 w-2/3 rounded-full bg-slate-100'
                            animate={{ opacity: [0.45, 0.95, 0.45] }}
                            transition={shimmerTransition(index * 0.08 + 0.18)}
                        />
                        <motion.div
                            className='mt-2 h-8 w-28 rounded-xl bg-slate-100'
                            animate={{ opacity: [0.45, 0.95, 0.45] }}
                            transition={shimmerTransition(index * 0.08 + 0.24)}
                        />
                    </div>
                </motion.article>
            ))}
        </div>
    );
}
