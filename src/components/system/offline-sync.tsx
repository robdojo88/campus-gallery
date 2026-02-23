'use client';

import { useEffect, useState } from 'react';
import { getPendingCaptures, removePendingCapture } from '@/lib/offline-queue';
import { uploadCapturedImage } from '@/lib/supabase';

export function OfflineSync() {
    const [pendingCount, setPendingCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const [online, setOnline] = useState(true);

    useEffect(() => {
        let mounted = true;
        const handleOnlineState = () => setOnline(navigator.onLine);
        const handleBackOnline = () => {
            handleOnlineState();
            void syncPending();
        };

        async function refreshPending() {
            const pending = await getPendingCaptures();
            if (mounted) setPendingCount(pending.length);
        }

        async function syncPending() {
            if (!navigator.onLine) return;
            setSyncing(true);
            try {
                const pending = await getPendingCaptures();
                for (const item of pending) {
                    await uploadCapturedImage(item.imageDataUrl, {
                        caption: item.caption,
                        visibility: item.visibility,
                        eventId: item.eventId,
                    });
                    await removePendingCapture(item.id);
                }
            } catch {
                // Keep pending items for future retries.
            }
            setSyncing(false);
            await refreshPending();
        }

        handleOnlineState();
        void refreshPending();
        window.addEventListener('online', handleBackOnline);
        window.addEventListener('offline', handleOnlineState);
        return () => {
            mounted = false;
            window.removeEventListener('online', handleBackOnline);
            window.removeEventListener('offline', handleOnlineState);
        };
    }, []);

    if (pendingCount === 0 && online) return null;

    return (
        <div className='sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900'>
            {online
                ? syncing
                    ? `Online - syncing ${pendingCount} pending uploads...`
                    : `${pendingCount} pending uploads in queue.`
                : 'Offline - camera captures are saved locally and will upload when connection returns.'}
        </div>
    );
}
