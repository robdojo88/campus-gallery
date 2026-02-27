import { parseTimestamp } from '@/lib/timestamp';

export function formatCommentTime(createdAt: string): string {
    const date = parseTimestamp(createdAt);
    const timestamp = date.getTime();
    if (Number.isNaN(timestamp)) return '';

    const now = Date.now();
    const diffMs = Math.max(0, now - timestamp);
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;
    const weekMs = 7 * dayMs;
    const monthMs = 30 * dayMs;
    const yearMs = 365 * dayMs;

    if (diffMs < hourMs) {
        return `${Math.max(1, Math.floor(diffMs / minuteMs))}m`;
    }

    if (diffMs < dayMs) {
        return `${Math.max(1, Math.floor(diffMs / hourMs))}h`;
    }

    if (diffMs < weekMs) {
        return `${Math.max(1, Math.floor(diffMs / dayMs))}d`;
    }

    if (diffMs < monthMs) {
        return `${Math.max(1, Math.floor(diffMs / weekMs))}w`;
    }

    if (diffMs >= yearMs) {
        return `${Math.max(1, Math.floor(diffMs / yearMs))}y`;
    }

    const dateLabel = date.toLocaleDateString(undefined, {
        month: 'long',
        day: 'numeric',
    });
    const timeLabel = date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
    });
    return `${dateLabel} at ${timeLabel}`;
}
