export function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error) {
        const value = (error as { message?: unknown }).message;
        if (typeof value === 'string' && value.trim().length > 0) return value;
    }
    return fallback;
}
