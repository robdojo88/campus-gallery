'use client';

import { Card, CardBody, Skeleton } from '@heroui/react';
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
                    className={compact ? 'opacity-90' : ''}
                >
                    <Card className='overflow-hidden border border-slate-200 bg-white shadow-sm'>
                        <CardBody className='p-4'>
                            <motion.div
                                animate={{ opacity: [0.45, 0.9, 0.45] }}
                                transition={shimmerTransition(index * 0.08)}
                            >
                                <Skeleton
                                    className={`${compact ? 'h-44' : 'h-56'} w-full rounded-2xl`}
                                />
                            </motion.div>
                            <div className='mt-4 space-y-3'>
                                <motion.div
                                    animate={{ opacity: [0.45, 0.95, 0.45] }}
                                    transition={shimmerTransition(
                                        index * 0.08 + 0.06,
                                    )}
                                >
                                    <Skeleton className='h-3 w-1/3 rounded-full' />
                                </motion.div>
                                <motion.div
                                    animate={{ opacity: [0.45, 0.95, 0.45] }}
                                    transition={shimmerTransition(
                                        index * 0.08 + 0.12,
                                    )}
                                >
                                    <Skeleton className='h-3 w-5/6 rounded-full' />
                                </motion.div>
                                <motion.div
                                    animate={{ opacity: [0.45, 0.95, 0.45] }}
                                    transition={shimmerTransition(
                                        index * 0.08 + 0.18,
                                    )}
                                >
                                    <Skeleton className='h-3 w-2/3 rounded-full' />
                                </motion.div>
                                <motion.div
                                    animate={{ opacity: [0.45, 0.95, 0.45] }}
                                    transition={shimmerTransition(
                                        index * 0.08 + 0.24,
                                    )}
                                >
                                    <Skeleton className='mt-2 h-8 w-28 rounded-xl' />
                                </motion.div>
                            </div>
                        </CardBody>
                    </Card>
                </motion.article>
            ))}
        </div>
    );
}
