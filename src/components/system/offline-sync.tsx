'use client';

import { useEffect, useRef, useState } from 'react';
import {
    OFFLINE_QUEUE_CHANGED_EVENT,
    getPendingCaptures,
    removePendingCapture,
} from '@/lib/offline-queue';
import { getErrorMessage } from '@/lib/error-message';
import { uploadBatchCaptures, uploadCapturedImage } from '@/lib/supabase';

export function OfflineSync() {
    const [pendingCount, setPendingCount] = useState(0);
    const [syncing, setSyncing] = useState(false);
    const [online, setOnline] = useState(true);
    const [syncProgress, setSyncProgress] = useState<{
        total: number;
        uploaded: number;
        failed: number;
    } | null>(null);
    const [lastError, setLastError] = useState<string | null>(null);
    const [completionMessage, setCompletionMessage] = useState<string | null>(
        null,
    );
    const completionTimerRef = useRef<number | null>(null);

    function toSyncFailureMessage(error: unknown): string {
        const message = getErrorMessage(
            error,
            'Upload failed. Auto-retry will continue.',
        );
        const normalized = message.toLowerCase();
        if (normalized.includes('must be logged in')) {
            return 'Login required to finish queued uploads. Please sign in again.';
        }
        if (normalized.includes('caption is required')) {
            return 'A queued upload is missing a caption and cannot be posted.';
        }
        if (normalized.includes('no current event tag is set')) {
            return 'Admin must set a current event tag before queued uploads can continue.';
        }
        return message;
    }

    useEffect(() => {
        let mounted = true;
        let syncInProgress = false;
        const handleOnlineState = () => setOnline(navigator.onLine);
        const handleBackOnline = () => {
            handleOnlineState();
            void syncPending();
        };
        const handleQueueChanged = () => {
            void refreshPending().then(() => {
                if (navigator.onLine) {
                    void syncPending();
                }
            });
        };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                handleOnlineState();
                void refreshPending().then(() => {
                    if (navigator.onLine) {
                        void syncPending();
                    }
                });
            }
        };

        async function refreshPending() {
            try {
                const pending = await getPendingCaptures();
                if (mounted) setPendingCount(pending.length);
                if (mounted && pending.length === 0) {
                    setSyncProgress(null);
                    setLastError(null);
                }
            } catch (error) {
                if (!mounted) return;
                setLastError(
                    getErrorMessage(
                        error,
                        'Unable to read offline queue. Please refresh and retry.',
                    ),
                );
            }
        }

        async function syncPending() {
            if (!navigator.onLine || syncInProgress) return;
            syncInProgress = true;
            setSyncing(true);
            setLastError(null);
            setCompletionMessage(null);
            try {
                const pending = await getPendingCaptures();
                if (pending.length === 0) {
                    if (mounted) {
                        setSyncProgress(null);
                        setLastError(null);
                    }
                    return;
                }
                let uploaded = 0;
                let failed = 0;
                if (mounted) {
                    setSyncProgress({
                        total: pending.length,
                        uploaded: 0,
                        failed: 0,
                    });
                }
                for (const item of pending) {
                    const captures =
                        Array.isArray(item.captures) && item.captures.length > 0
                            ? item.captures
                            : item.imageDataUrl
                              ? [item.imageDataUrl]
                              : [];
                    if (captures.length === 0) {
                        await removePendingCapture(item.id);
                        failed += 1;
                        if (mounted) {
                            setLastError(
                                'A queued upload entry was invalid and was skipped.',
                            );
                            setSyncProgress({
                                total: pending.length,
                                uploaded,
                                failed,
                            });
                        }
                        continue;
                    }
                    try {
                        if (captures.length === 1) {
                            await uploadCapturedImage(captures[0], {
                                caption: item.caption,
                                visibility: item.visibility,
                                eventId: item.eventId,
                            });
                        } else {
                            await uploadBatchCaptures({
                                captures,
                                caption: item.caption,
                                visibility: item.visibility,
                                eventId: item.eventId,
                            });
                        }
                        await removePendingCapture(item.id);
                        uploaded += 1;
                    } catch (error) {
                        // Keep this item in queue and continue syncing others.
                        failed += 1;
                        if (mounted) {
                            setLastError(toSyncFailureMessage(error));
                        }
                    }
                    if (mounted) {
                        setSyncProgress({
                            total: pending.length,
                            uploaded,
                            failed,
                        });
                    }
                }
                if (mounted && uploaded > 0 && failed === 0) {
                    setCompletionMessage(
                        `Upload complete - ${uploaded} queued post${uploaded > 1 ? 's' : ''} uploaded.`,
                    );
                    if (completionTimerRef.current) {
                        window.clearTimeout(completionTimerRef.current);
                    }
                    completionTimerRef.current = window.setTimeout(() => {
                        setCompletionMessage(null);
                        completionTimerRef.current = null;
                    }, 7000);
                }
            } catch (error) {
                // Keep pending items for future retries.
                if (mounted) {
                    setLastError(
                        getErrorMessage(
                            error,
                            'Unable to access offline queue. Retrying automatically.',
                        ),
                    );
                }
            } finally {
                syncInProgress = false;
                if (mounted) setSyncing(false);
                await refreshPending();
            }
        }

        handleOnlineState();
        void (async () => {
            await refreshPending();
            if (navigator.onLine) {
                await syncPending();
            }
        })();
        window.addEventListener('online', handleBackOnline);
        window.addEventListener('offline', handleOnlineState);
        window.addEventListener(OFFLINE_QUEUE_CHANGED_EVENT, handleQueueChanged);
        window.addEventListener('focus', handleBackOnline);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        const retryTimer = window.setInterval(() => {
            if (navigator.onLine) {
                void syncPending();
            }
        }, 20000);
        return () => {
            mounted = false;
            window.removeEventListener('online', handleBackOnline);
            window.removeEventListener('offline', handleOnlineState);
            window.removeEventListener(
                OFFLINE_QUEUE_CHANGED_EVENT,
                handleQueueChanged,
            );
            window.removeEventListener('focus', handleBackOnline);
            document.removeEventListener(
                'visibilitychange',
                handleVisibilityChange,
            );
            window.clearInterval(retryTimer);
            if (completionTimerRef.current) {
                window.clearTimeout(completionTimerRef.current);
                completionTimerRef.current = null;
            }
        };
    }, []);

    const shouldHideBanner =
        pendingCount === 0 &&
        online &&
        !syncing &&
        !lastError &&
        !completionMessage &&
        syncProgress === null;
    if (shouldHideBanner) return null;

    const message = (() => {
        if (!online) {
            return 'Offline - camera captures are saved locally and will upload when connection returns.';
        }
        if (completionMessage && pendingCount === 0) {
            return completionMessage;
        }
        if (syncing) {
            if (syncProgress && syncProgress.total > 0) {
                return `Online - uploading ${syncProgress.uploaded} of ${syncProgress.total} pending uploads...`;
            }
            return `Online - syncing ${pendingCount} pending uploads...`;
        }
        if (
            syncProgress &&
            syncProgress.total > 0 &&
            syncProgress.failed > 0 &&
            pendingCount > 0
        ) {
            return `Upload attempt complete: ${syncProgress.uploaded}/${syncProgress.total} uploaded, ${syncProgress.failed} failed. ${pendingCount} still in queue. ${lastError ? `Last issue: ${lastError} ` : ''}Retrying automatically.`;
        }
        if (lastError && pendingCount > 0) {
            return `${pendingCount} pending uploads in queue. Last issue: ${lastError}`;
        }
        return `${pendingCount} pending uploads in queue. Waiting for auto-sync.`;
    })();

    return (
        <div className='sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs font-medium text-amber-900'>
            {message}
        </div>
    );
}
