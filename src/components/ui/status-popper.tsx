'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type PopperTone = 'success' | 'error' | 'info';

type StatusPopperProps = {
    open: boolean;
    message: string;
    tone?: PopperTone;
    durationMs?: number;
    onClose: () => void;
};

function toneClassName(tone: PopperTone): string {
    if (tone === 'success') {
        return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    }
    if (tone === 'error') {
        return 'border-rose-200 bg-rose-50 text-rose-800';
    }
    return 'border-cyan-200 bg-cyan-50 text-cyan-800';
}

export function StatusPopper({
    open,
    message,
    tone = 'info',
    durationMs = 2600,
    onClose,
}: StatusPopperProps) {
    useEffect(() => {
        if (!open || durationMs <= 0) return;
        const timer = window.setTimeout(() => {
            onClose();
        }, durationMs);
        return () => {
            window.clearTimeout(timer);
        };
    }, [durationMs, message, onClose, open]);

    return (
        <AnimatePresence>
            {open ? (
                <div className='pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[130] flex justify-center px-4'>
                    <motion.div
                        initial={{ opacity: 0, y: -12, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className={`pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 shadow-lg ${toneClassName(tone)}`}
                        role='status'
                        aria-live='polite'
                    >
                        <p className='text-sm font-semibold'>{message}</p>
                    </motion.div>
                </div>
            ) : null}
        </AnimatePresence>
    );
}

