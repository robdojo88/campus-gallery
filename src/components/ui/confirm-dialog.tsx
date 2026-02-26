'use client';

import { motion } from 'framer-motion';
import {
    Button,
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
} from '@heroui/react';

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    busy?: boolean;
    classNames?: string;
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
    classNames = '',
    onConfirm,
    onCancel,
}: ConfirmDialogProps) {
    return (
        <Modal
            isOpen={open}
            backdrop='blur'
            isDismissable={!busy}
            isKeyboardDismissDisabled={busy}
            hideCloseButton
            onClose={onCancel}
        >
            <ModalContent
                className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_60px_-35px_rgba(15,23,42,0.45)] ${classNames}`.trim()}
            >
                <div className='relative'>
                    <div className='absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-rose-400 via-amber-300 to-rose-500' />
                    <ModalHeader className='px-5 pb-2 pt-5'>
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className='flex items-start gap-3'
                        >
                            <motion.span
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                    duration: 0.22,
                                    delay: 0.08,
                                    ease: 'easeOut',
                                }}
                                className='mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-sm font-bold text-rose-700'
                            >
                                !
                            </motion.span>
                            <div className='min-w-0'>
                                <p className='text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500'>
                                    Confirm action
                                </p>
                                <h2 className='text-base font-semibold text-slate-900'>
                                    {title}
                                </h2>
                            </div>
                        </motion.div>
                    </ModalHeader>
                    <ModalBody className='px-5 pb-1'>
                        <motion.p
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.2,
                                delay: 0.05,
                                ease: 'easeOut',
                            }}
                            className='text-sm leading-6 text-slate-600'
                        >
                            {description}
                        </motion.p>
                    </ModalBody>
                    <ModalFooter className='px-5 pb-5 pt-3'>
                        <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{
                                duration: 0.2,
                                delay: 0.1,
                                ease: 'easeOut',
                            }}
                            className='flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end'
                        >
                            <Button
                                variant='bordered'
                                className='font-semibold'
                                isDisabled={busy}
                                onPress={onCancel}
                            >
                                {cancelLabel}
                            </Button>
                            <Button
                                color='danger'
                                variant='flat'
                                className='font-semibold'
                                isDisabled={busy}
                                onPress={onConfirm}
                            >
                                {busy ? 'Deleting...' : confirmLabel}
                            </Button>
                        </motion.div>
                    </ModalFooter>
                </div>
            </ModalContent>
        </Modal>
    );
}
