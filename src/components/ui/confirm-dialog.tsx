'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

export function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = 'Delete',
    cancelLabel = 'Cancel',
    busy = false,
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    useEffect(() => {
        if (!open) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && !busy) {
                onCancel();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
        };
    }, [busy, onCancel, open]);

    return (
        <AnimatePresence>
            {open ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className='fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/55 px-4 backdrop-blur-[1.5px]'
                    onClick={() => {
                        if (!busy) onCancel();
                    }}
                >
                    <motion.div
                        initial={{ opacity: 0, y: 14, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.2, ease: 'easeOut' }}
                        className='w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl'
                        onClick={(event) => event.stopPropagation()}
                    >
                        <p className='text-sm font-semibold text-slate-900'>
                            {title}
                        </p>
                        <p className='mt-2 text-sm text-slate-600'>
                            {description}
                        </p>
                        <div className='mt-5 flex justify-end gap-2'>
                            <button
                                type='button'
                                onClick={onCancel}
                                disabled={busy}
                                className='rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {cancelLabel}
                            </button>
                            <button
                                type='button'
                                onClick={onConfirm}
                                disabled={busy}
                                className='rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {busy ? 'Deleting...' : confirmLabel}
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}

