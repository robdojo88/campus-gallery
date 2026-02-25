'use client';

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
    return (
        <Modal
            isOpen={open}
            backdrop='blur'
            isDismissable={!busy}
            isKeyboardDismissDisabled={busy}
            hideCloseButton={busy}
            onClose={onCancel}
        >
            <ModalContent>
                <ModalHeader className='text-sm font-semibold text-slate-900'>
                    {title}
                </ModalHeader>
                <ModalBody>
                    <p className='text-sm text-slate-600'>{description}</p>
                </ModalBody>
                <ModalFooter>
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
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}
