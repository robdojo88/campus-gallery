'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { RealtimeChannel, SupabaseClient, User } from '@supabase/supabase-js';
import type {
    AppNotification,
    ContentReport,
    FreedomPost,
    FreedomWallComment,
    GlobalSearchResults,
    NotificationType,
    OfflineCapture,
    Post,
    PostComment,
    Review,
    SearchDateResult,
    SearchEventResult,
    SearchPostResult,
    SearchUserResult,
    StudentRegistryEntry,
    StudentRegistryStatus,
    StudentRegistryUpsertInput,
    ReportTargetType,
    ReportStatus,
    UserRole,
    Visibility,
} from '@/lib/types';

type DbUser = {
    id: string;
    name: string;
    email: string;
    usn: string | null;
    role: UserRole;
    avatar_url: string | null;
    incognito_alias: string | null;
    created_at: string;
};
type DbSearchUserRow = Pick<DbUser, 'id' | 'name' | 'email' | 'role' | 'avatar_url'>;

type DbPost = {
    id: string;
    user_id: string;
    image_url: string;
    caption: string | null;
    visibility: Visibility;
    event_id: string | null;
    created_at: string;
};
type DbPostImage = {
    post_id: string;
    image_url: string;
    sort_order: number;
};
type DbEventOption = {
    id: string;
    name: string;
};
type DbEventSearch = {
    id: string;
    name: string;
    description: string | null;
};

type DbLike = { post_id: string };
type DbComment = { post_id: string };
type DbCommentRow = {
    id: string;
    post_id: string;
    user_id: string;
    parent_id: string | null;
    content: string;
    created_at: string;
};
type DbCommentLikeRow = {
    id: string;
    comment_id: string;
    user_id: string;
};

type DbFreedomPost = {
    id: string;
    user_id: string;
    content: string;
    image_url: string | null;
    created_at: string;
};
type DbFreedomLike = {
    id: string;
    post_id: string;
    user_id: string;
};
type DbFreedomCommentRow = {
    id: string;
    post_id: string;
    user_id: string;
    parent_id: string | null;
    content: string;
    created_at: string;
};
type DbFreedomCommentLikeRow = {
    id: string;
    comment_id: string;
    user_id: string;
};

type DbIncognitoPost = {
    id: string;
    user_id: string;
    content: string;
    created_at: string;
};
type DbIncognitoLike = {
    id: string;
    post_id: string;
    user_id: string;
};
type DbIncognitoCommentRow = {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    created_at: string;
};
type DbIncognitoCommentLikeRow = {
    id: string;
    comment_id: string;
    user_id: string;
};

type DbNotification = {
    id: string;
    recipient_user_id: string;
    actor_user_id: string | null;
    type: string;
    title: string;
    body: string;
    data: Record<string, unknown> | null;
    read_at: string | null;
    created_at: string;
};

type DbReview = {
    id: string;
    visitor_id: string;
    rating: number;
    review_text: string;
    status: 'approved' | 'pending' | 'rejected';
    created_at: string;
};

type DbContentReport = {
    id: string;
    reporter_user_id: string;
    target_type: ReportTargetType;
    target_id: string;
    reason: string;
    details: string | null;
    status: ReportStatus;
    reviewed_by: string | null;
    reviewed_at: string | null;
    action_note: string | null;
    created_at: string;
};

type DbStudentRegistry = {
    id: string;
    usn: string;
    first_name: string;
    last_name: string;
    course: string | null;
    year_level: number | null;
    email: string;
    status: string;
    created_at: string;
    updated_at: string;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const DEFAULT_AVATAR_URL = '/avatar-default.svg';
const INCOGNITO_ALIAS_PATTERN = /^[A-Za-z0-9._-]{3,24}$/;
const INCOGNITO_ALIAS_RULES = 'Incognito alias must be 3-24 characters and use letters, numbers, dot, underscore, or hyphen.';
const PENDING_LOGIN_USN_KEY = 'ripple_pending_login_usn';

let browserClient: SupabaseClient | null = null;
let sessionRecoveryPromise: Promise<void> | null = null;
const UUID_PATTERN =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getSupabase(): SupabaseClient {
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing Supabase env vars. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }

    if (!browserClient) {
        browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
    }

    return browserClient;
}

function dataUrlToBlob(dataUrl: string): Blob {
    const [metadata, base64Data] = dataUrl.split(',');
    if (!metadata || !base64Data) {
        throw new Error('Invalid image data URL.');
    }
    const mimeMatch = metadata.match(/data:(.*?);base64/);
    const mimeType = mimeMatch?.[1] ?? 'image/jpeg';
    const raw = window.atob(base64Data);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
}

function toNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
}

function getNotificationDataString(
    data: Record<string, unknown> | null | undefined,
    key: string,
): string | undefined {
    const value = data?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function resolveAvatarUrl(value: string | null | undefined): string {
    return toNonEmptyString(value) ?? DEFAULT_AVATAR_URL;
}

function parseIncognitoAlias(value: unknown): string | null {
    const alias = toNonEmptyString(value);
    if (!alias) return null;
    return INCOGNITO_ALIAS_PATTERN.test(alias) ? alias : null;
}

function requireValidIncognitoAlias(value: string): string {
    const alias = value.trim();
    if (!alias) {
        throw new Error('Incognito alias is required for members.');
    }
    if (!INCOGNITO_ALIAS_PATTERN.test(alias)) {
        throw new Error(INCOGNITO_ALIAS_RULES);
    }
    return alias;
}

function resolveIncognitoDisplayAlias(input: {
    role?: UserRole;
    incognitoAlias?: string | null;
}): string {
    if (input.role === 'member') {
        return parseIncognitoAlias(input.incognitoAlias) ?? 'Anonymous';
    }
    if (input.role === 'admin') {
        return 'Admin';
    }
    return 'Anonymous';
}

function getAvatarFromAuthUser(user: User): string | null {
    const metadata = user.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {};
    const candidates: unknown[] = [
        (metadata as Record<string, unknown>).avatar_url,
        (metadata as Record<string, unknown>).picture,
        (metadata as Record<string, unknown>).photo_url,
    ];

    if (Array.isArray(user.identities)) {
        for (const identity of user.identities) {
            if (!identity || typeof identity !== 'object') continue;
            const identityData =
                'identity_data' in identity && identity.identity_data && typeof identity.identity_data === 'object'
                    ? (identity.identity_data as Record<string, unknown>)
                    : null;
            if (!identityData) continue;
            candidates.push(identityData.avatar_url, identityData.picture, identityData.photo_url);
        }
    }

    for (const candidate of candidates) {
        const parsed = toNonEmptyString(candidate);
        if (parsed) return parsed;
    }

    return null;
}

function mapUser(dbUser: DbUser) {
    return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        usn: toNonEmptyString(dbUser.usn) ?? undefined,
        role: dbUser.role,
        avatarUrl: resolveAvatarUrl(dbUser.avatar_url),
        incognitoAlias: parseIncognitoAlias(dbUser.incognito_alias) ?? undefined,
        createdAt: dbUser.created_at,
    };
}

function normalizeStudentRegistryStatus(
    value: unknown,
): StudentRegistryStatus {
    const normalized = toNonEmptyString(value)?.toLowerCase();
    return normalized === 'inactive' ? 'inactive' : 'active';
}

function mapStudentRegistryRow(row: DbStudentRegistry): StudentRegistryEntry {
    const firstName = row.first_name.trim();
    const lastName = row.last_name.trim();
    const course = toNonEmptyString(row.course) ?? undefined;
    return {
        id: row.id,
        usn: row.usn,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        course,
        yearLevel: row.year_level ?? undefined,
        email: row.email,
        status: normalizeStudentRegistryStatus(row.status),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

function normalizeCaptureUrl(imageUrl: string): string {
    if (!supabaseUrl) return imageUrl;

    if (imageUrl.startsWith('http') && imageUrl.includes('/storage/v1/object/public/captures/')) {
        return imageUrl;
    }

    if (imageUrl.startsWith('http') && imageUrl.includes('/storage/v1/object/captures/')) {
        return imageUrl.replace('/storage/v1/object/captures/', '/storage/v1/object/public/captures/');
    }

    if (!imageUrl.startsWith('http')) {
        const path = imageUrl.startsWith('captures/') ? imageUrl.slice('captures/'.length) : imageUrl;
        return `${supabaseUrl}/storage/v1/object/public/captures/${path}`;
    }

    return imageUrl;
}

function normalizeUuid(value?: string): string | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    return UUID_PATTERN.test(trimmed) ? trimmed : undefined;
}

function normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
}

function normalizeUsn(value: string): string {
    return value.trim().toUpperCase();
}

function setPendingLoginUsn(usnInput: string): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(PENDING_LOGIN_USN_KEY, normalizeUsn(usnInput));
}

function takePendingLoginUsn(): string | null {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(PENDING_LOGIN_USN_KEY);
    if (stored === null) return null;
    window.localStorage.removeItem(PENDING_LOGIN_USN_KEY);
    return stored;
}

function clearPendingLoginUsn(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(PENDING_LOGIN_USN_KEY);
}

function normalizeStudentRegistryPayload(input: StudentRegistryUpsertInput): {
    usn: string;
    first_name: string;
    last_name: string;
    course: string | null;
    year_level: number | null;
    email: string;
    status: StudentRegistryStatus;
} {
    const usn = input.usn.trim().toUpperCase();
    if (!usn) {
        throw new Error('USN is required.');
    }

    const firstName = input.firstName.trim();
    if (!firstName) {
        throw new Error('First name is required.');
    }

    const lastName = input.lastName.trim();
    if (!lastName) {
        throw new Error('Last name is required.');
    }

    const email = normalizeEmail(input.email);
    if (!email) {
        throw new Error('Email is required.');
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        throw new Error('Email format is invalid.');
    }

    const course = toNonEmptyString(input.course) ?? null;
    const status = normalizeStudentRegistryStatus(input.status);
    let yearLevel: number | null = null;
    if (typeof input.yearLevel === 'number') {
        if (!Number.isFinite(input.yearLevel)) {
            throw new Error('Year level must be a valid number.');
        }
        yearLevel = Math.trunc(input.yearLevel);
    }
    if (yearLevel !== null && (yearLevel < 1 || yearLevel > 12)) {
        throw new Error('Year level must be between 1 and 12.');
    }

    return {
        usn,
        first_name: firstName,
        last_name: lastName,
        course,
        year_level: yearLevel,
        email,
        status,
    };
}

function normalizeSearchQuery(query: string): string {
    return query.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
}

function toIlikePattern(query: string): string {
    const normalized = normalizeSearchQuery(query).replace(/[,%]/g, ' ');
    return `%${normalized}%`;
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
    const seen = new Set<string>();
    return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
}

function getUtcDateKey(createdAt: string): string {
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return '';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateLabelFromKey(dateKey: string): string {
    const date = new Date(`${dateKey}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return dateKey;
    return date.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    });
}

function normalizeNotificationType(value: string): NotificationType {
    const supported: NotificationType[] = [
        'feed_like',
        'feed_comment',
        'freedom_like',
        'freedom_comment',
        'incognito_like',
        'incognito_comment',
        'event_created',
        'report_created',
        'system',
    ];
    return supported.includes(value as NotificationType) ? (value as NotificationType) : 'system';
}

function buildReportTargetHref(
    targetType: ReportTargetType,
    targetId: string,
    targetPostId?: string,
): string | undefined {
    const encodedTargetId = encodeURIComponent(targetId);
    const encodedTargetPostId = targetPostId
        ? encodeURIComponent(targetPostId)
        : '';

    if (targetType === 'feed_post') {
        return `/feed?post=${encodedTargetId}`;
    }
    if (targetType === 'feed_comment' && targetPostId) {
        return `/feed?post=${encodedTargetPostId}&comment=${encodedTargetId}`;
    }
    if (targetType === 'freedom_post') {
        return `/freedom-wall?post=${encodedTargetId}`;
    }
    if (targetType === 'freedom_comment' && targetPostId) {
        return `/freedom-wall?post=${encodedTargetPostId}&comment=${encodedTargetId}`;
    }
    if (targetType === 'incognito_post') {
        return `/incognito?post=${encodedTargetId}`;
    }
    if (targetType === 'incognito_comment' && targetPostId) {
        return `/incognito?post=${encodedTargetPostId}&comment=${encodedTargetId}`;
    }
    return undefined;
}

function toAppError(error: unknown, fallback = 'Unexpected error.'): Error {
    if (error instanceof Error) return error;

    if (error && typeof error === 'object') {
        const maybeMessage =
            'message' in error && typeof (error as { message?: unknown }).message === 'string'
                ? (error as { message: string }).message
                : '';
        const maybeCode =
            'code' in error && typeof (error as { code?: unknown }).code === 'string'
                ? (error as { code: string }).code
                : '';

        if (maybeMessage) {
            return new Error(maybeCode ? `${maybeMessage} (${maybeCode})` : maybeMessage);
        }
    }

    if (typeof error === 'string' && error.trim()) {
        return new Error(error);
    }

    return new Error(fallback);
}

function isSessionMissingError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const name =
        'name' in error && typeof (error as { name?: unknown }).name === 'string'
            ? (error as { name: string }).name.toLowerCase()
            : '';
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message.toLowerCase()
            : '';

    return name.includes('authsessionmissingerror') || message.includes('auth session missing');
}

function isInvalidRefreshTokenError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message.toLowerCase()
            : '';
    return message.includes('invalid refresh token') || message.includes('refresh token not found');
}

function isRecoverableAuthError(error: unknown): boolean {
    return isSessionMissingError(error) || isInvalidRefreshTokenError(error);
}

function isPermissionDeniedError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code =
        'code' in error && typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : '';
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message.toLowerCase()
            : '';
    return code === '42501' || message.includes('permission denied') || message.includes('new row violates row-level security');
}

function isUniqueViolationError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const code =
        'code' in error && typeof (error as { code?: unknown }).code === 'string'
            ? (error as { code: string }).code
            : '';
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message.toLowerCase()
            : '';
    return code === '23505' || message.includes('duplicate key value') || message.includes('unique constraint');
}

function isIncognitoAliasConflictError(error: unknown): boolean {
    if (!isUniqueViolationError(error)) return false;
    if (!error || typeof error !== 'object') return false;
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message.toLowerCase()
            : '';
    return message.includes('incognito_alias') || message.includes('users_incognito_alias_lower_unique');
}

function isIncognitoAliasRequiredError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message.toLowerCase()
            : '';
    return message.includes('incognito alias is required for members');
}

function isFreedomCommentPolicyRecursionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? (error as { message: string }).message.toLowerCase()
            : '';
    return message.includes('infinite recursion detected in policy for relation') && message.includes('freedom_wall_comments');
}

async function recoverSessionState(supabase: SupabaseClient): Promise<void> {
    if (!sessionRecoveryPromise) {
        sessionRecoveryPromise = supabase.auth
            .signOut({ scope: 'local' })
            .catch(() => undefined)
            .then(() => undefined)
            .finally(() => {
                sessionRecoveryPromise = null;
            });
    }

    await sessionRecoveryPromise;
}

function extensionFromMimeType(mimeType: string): string {
    if (mimeType === 'image/png') return 'png';
    if (mimeType === 'image/webp') return 'webp';
    if (mimeType === 'image/heic') return 'heic';
    if (mimeType === 'image/heif') return 'heif';
    return 'jpg';
}

function isMissingPostImagesError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? ((error as { message: string }).message || '').toLowerCase()
            : '';

    return (
        message.includes("could not find the table 'public.post_images' in the schema cache") ||
        (message.includes('relation') && message.includes('post_images') && message.includes('does not exist'))
    );
}

function isMissingTableError(error: unknown, tableName: string): boolean {
    if (!error || typeof error !== 'object') return false;
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? ((error as { message: string }).message || '').toLowerCase()
            : '';
    const normalizedTable = tableName.toLowerCase();
    return (
        message.includes(normalizedTable) &&
        (message.includes('does not exist') || message.includes('relation') || message.includes('schema cache'))
    );
}

function isMissingFreedomEngagementTablesError(error: unknown): boolean {
    return isMissingTableError(error, 'freedom_wall_likes') || isMissingTableError(error, 'freedom_wall_comments');
}

function isMissingIncognitoEngagementTablesError(error: unknown): boolean {
    return isMissingTableError(error, 'incognito_likes') || isMissingTableError(error, 'incognito_comments');
}

function isMissingFeedCommentLikesTableError(error: unknown): boolean {
    return isMissingTableError(error, 'comment_likes');
}

function isMissingFeedCommentReplySchemaError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? ((error as { message: string }).message || '').toLowerCase()
            : '';
    return message.includes('parent_id') && message.includes('comments');
}

function isMissingFreedomCommentLikesTableError(error: unknown): boolean {
    return isMissingTableError(error, 'freedom_wall_comment_likes');
}

function isMissingIncognitoCommentLikesTableError(error: unknown): boolean {
    return isMissingTableError(error, 'incognito_comment_likes');
}

function isMissingContentReportsTableError(error: unknown): boolean {
    return isMissingTableError(error, 'content_reports');
}

function isMissingStudentRegistryTableError(error: unknown): boolean {
    return isMissingTableError(error, 'student_registry');
}

function isMissingUsnResolutionFunctionError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    const message =
        'message' in error && typeof (error as { message?: unknown }).message === 'string'
            ? ((error as { message: string }).message || '').toLowerCase()
            : '';
    return (
        message.includes('resolve_user_role_by_usn') &&
        (message.includes('does not exist') || message.includes('function'))
    );
}

function mapPosts(
    rawPosts: DbPost[],
    users: DbUser[],
    likes: DbLike[],
    comments: DbComment[],
    postImages: DbPostImage[],
    eventNamesById: Map<string, string>,
): Post[] {
    const userById = new Map(users.map((user) => [user.id, user]));
    const likeCounts = likes.reduce<Record<string, number>>((acc, like) => {
        acc[like.post_id] = (acc[like.post_id] ?? 0) + 1;
        return acc;
    }, {});
    const commentCounts = comments.reduce<Record<string, number>>((acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] ?? 0) + 1;
        return acc;
    }, {});
    const imagesByPost = postImages.reduce<Record<string, DbPostImage[]>>((acc, row) => {
        if (!acc[row.post_id]) acc[row.post_id] = [];
        acc[row.post_id].push(row);
        return acc;
    }, {});

    return rawPosts.map((post) => {
        const author = userById.get(post.user_id);
        const orderedImages =
            imagesByPost[post.id]
                ?.sort((a, b) => a.sort_order - b.sort_order)
                .map((row) => normalizeCaptureUrl(row.image_url)) ?? [];
        const normalizedLegacy = normalizeCaptureUrl(post.image_url);
        const normalizedImages = orderedImages.length > 0 ? orderedImages : [normalizedLegacy];
        return {
            id: post.id,
            userId: post.user_id,
            imageUrl: normalizedImages[0] ?? normalizedLegacy,
            images: normalizedImages,
            caption: post.caption ?? undefined,
            visibility: post.visibility,
            eventId: post.event_id ?? undefined,
            eventName: post.event_id ? eventNamesById.get(post.event_id) : undefined,
            likes: likeCounts[post.id] ?? 0,
            comments: commentCounts[post.id] ?? 0,
            createdAt: post.created_at,
            author: author ? mapUser(author) : undefined,
        };
    });
}

export function hasSupabaseConfig(): boolean {
    return Boolean(supabaseUrl && supabaseAnonKey);
}

export async function getSessionUser(): Promise<User | null> {
    const supabase = getSupabase();
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
        if (isRecoverableAuthError(sessionError)) {
            await recoverSessionState(supabase);
            return null;
        }
        throw toAppError(sessionError);
    }
    if (sessionData.session?.user) return sessionData.session.user;

    const { data, error } = await supabase.auth.getUser();
    if (error) {
        if (isRecoverableAuthError(error)) {
            await recoverSessionState(supabase);
            return null;
        }
        throw toAppError(error);
    }
    return data.user ?? null;
}

type DbUsnRoleResolution = {
    role: UserRole;
    usn: string | null;
    profile_name: string | null;
};

async function resolveCurrentUserRoleByUsn(usnInput: string): Promise<DbUsnRoleResolution> {
    const supabase = getSupabase();
    const normalizedUsn = normalizeUsn(usnInput);
    const { data, error } = await supabase
        .rpc('resolve_user_role_by_usn', {
            input_usn: normalizedUsn,
        })
        .maybeSingle<DbUsnRoleResolution>();

    if (error) {
        if (isMissingUsnResolutionFunctionError(error)) {
            throw new Error(
                "Database migration required: missing 'resolve_user_role_by_usn' function. Run 'supabase/usn-role-resolution.sql' and retry.",
            );
        }
        throw toAppError(error);
    }

    if (!data) {
        throw new Error('Failed to resolve account role from USN.');
    }

    return data;
}

async function applyPendingUsnResolution(user: User): Promise<void> {
    const pendingUsn = takePendingLoginUsn();
    if (pendingUsn === null) return;

    try {
        await ensureUserProfile(user);
        await resolveCurrentUserRoleByUsn(pendingUsn);
    } catch (error) {
        const supabase = getSupabase();
        await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
        throw toAppError(error);
    } finally {
        clearPendingLoginUsn();
    }
}

export async function getCurrentUserProfile() {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) return null;
    await applyPendingUsnResolution(user);

    const { data, error } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle<DbUser>();
    if (error) throw toAppError(error);
    if (data) return mapUser(data);

    try {
        await ensureUserProfile(user);
    } catch (ensureError) {
        if (isIncognitoAliasRequiredError(ensureError)) {
            throw new Error(
                'Profile row is missing and DB requires alias on member insert. Run the user backfill SQL, then retry.',
            );
        }
        throw toAppError(ensureError);
    }

    const { data: repaired, error: repairedError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle<DbUser>();
    if (repairedError) throw toAppError(repairedError);
    return repaired ? mapUser(repaired) : null;
}

export async function ensureUserProfile(user: User): Promise<void> {
    const supabase = getSupabase();
    const metadataName =
        toNonEmptyString(user.user_metadata?.name) ??
        toNonEmptyString(user.user_metadata?.full_name) ??
        toNonEmptyString(user.user_metadata?.user_name) ??
        '';
    const metadataRole: UserRole =
        user.user_metadata?.role === 'admin' ? 'admin' : 'visitor';
    const metadataAvatarUrl = getAvatarFromAuthUser(user);
    const metadataAlias =
        parseIncognitoAlias(user.user_metadata?.incognito_alias) ??
        parseIncognitoAlias(user.user_metadata?.incognitoAlias);

    const { data: existingProfile, error: existingProfileError } = await supabase
        .from('users')
        .select('name,avatar_url,incognito_alias,role,usn')
        .eq('id', user.id)
        .maybeSingle<{
            name: string;
            avatar_url: string | null;
            incognito_alias: string | null;
            role: UserRole;
            usn: string | null;
        }>();
    if (existingProfileError) throw toAppError(existingProfileError);

    const existingName = toNonEmptyString(existingProfile?.name);
    const existingAvatarUrl = toNonEmptyString(existingProfile?.avatar_url);
    const existingAlias = parseIncognitoAlias(existingProfile?.incognito_alias);
    const existingRole = existingProfile?.role;
    const existingUsn = toNonEmptyString(existingProfile?.usn);
    const avatarUrl =
        existingAvatarUrl && existingAvatarUrl !== DEFAULT_AVATAR_URL
            ? existingAvatarUrl
            : resolveAvatarUrl(metadataAvatarUrl ?? existingAvatarUrl);
    const incognitoAlias = existingAlias ?? metadataAlias;
    const resolvedRole: UserRole = existingRole ?? metadataRole;
    const profileName =
        existingName ??
        toNonEmptyString(metadataName) ??
        user.email?.split('@')[0] ??
        'Campus User';

    const { error } = await supabase.from('users').upsert({
        id: user.id,
        email: user.email ?? '',
        name: profileName,
        role: resolvedRole,
        usn: existingUsn ?? null,
        avatar_url: avatarUrl,
        incognito_alias: incognitoAlias,
    });
    if (error) {
        if (isIncognitoAliasConflictError(error)) {
            throw new Error('This incognito alias is already in use. Pick another alias.');
        }
        throw toAppError(error);
    }
}

export async function uploadProfileAvatar(file: File): Promise<string> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in to update your profile photo.');

    const mimeType = file.type || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
        throw new Error('Only image files are allowed for profile photos.');
    }

    const extension = extensionFromMimeType(mimeType);
    const filePath = `avatars/${user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('captures').upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
    });
    if (uploadError) throw toAppError(uploadError);

    const { data: publicData } = supabase.storage.from('captures').getPublicUrl(filePath);
    const publicUrl = publicData.publicUrl || `${supabaseUrl}/storage/v1/object/public/captures/${filePath}`;

    const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', user.id);
    if (updateError) {
        await supabase.storage.from('captures').remove([filePath]);
        throw toAppError(updateError);
    }

    return publicUrl;
}

export async function signUpWithEmail(input: {
    name: string;
    email: string;
    password: string;
    usn: string;
}) {
    const supabase = getSupabase();
    const email = normalizeEmail(input.email);
    const usn = normalizeUsn(input.usn);
    if (!usn) {
        throw new Error('USN is required.');
    }

    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
    const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
            data: {
                name: input.name,
            },
            emailRedirectTo: redirectTo,
        },
    });
    if (error) {
        throw toAppError(error);
    }

    if (data.user && data.session) {
        try {
            await ensureUserProfile(data.user);
            await resolveCurrentUserRoleByUsn(usn);
        } catch (resolveError) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            throw toAppError(resolveError);
        }
    }

    return data;
}

export async function setCurrentUserIncognitoAlias(aliasInput: string): Promise<string> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const alias = requireValidIncognitoAlias(aliasInput);
    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role,incognito_alias')
        .eq('id', user.id)
        .maybeSingle<{ role: UserRole; incognito_alias: string | null }>();
    if (profileError) throw toAppError(profileError);
    if (!profile) throw new Error('Profile not found. Contact admin to restore your account profile row.');

    if (profile.role !== 'member') {
        throw new Error('Only campus members can set an incognito alias.');
    }
    if (parseIncognitoAlias(profile.incognito_alias)) {
        throw new Error('Incognito alias is already set and cannot be changed. Contact admin for changes.');
    }

    const { error: updateError } = await supabase
        .from('users')
        .update({ incognito_alias: alias })
        .eq('id', user.id)
        .is('incognito_alias', null);
    if (updateError) {
        if (isIncognitoAliasConflictError(updateError)) {
            throw new Error('This incognito alias is already in use. Pick another alias.');
        }
        throw toAppError(updateError);
    }

    const { data: updatedProfile, error: updatedProfileError } = await supabase
        .from('users')
        .select('incognito_alias')
        .eq('id', user.id)
        .maybeSingle<{ incognito_alias: string | null }>();
    if (updatedProfileError) throw toAppError(updatedProfileError);
    if (!updatedProfile) throw new Error('Profile not found after update. Contact admin to check your user profile record.');

    const savedAlias = parseIncognitoAlias(updatedProfile.incognito_alias);
    if (!savedAlias) {
        throw new Error('Incognito alias is already set and cannot be changed. Contact admin for changes.');
    }
    return savedAlias;
}

export async function resendConfirmationEmail(email: string): Promise<void> {
    const supabase = getSupabase();
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
    const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
            emailRedirectTo: redirectTo,
        },
    });
    if (error) throw toAppError(error);
}

export async function signInWithEmail(input: {
    email: string;
    password: string;
    usn: string;
}) {
    const supabase = getSupabase();
    const email = normalizeEmail(input.email);
    const usn = normalizeUsn(input.usn);
    if (!usn) {
        throw new Error('USN is required.');
    }

    setPendingLoginUsn(usn);

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: input.password,
    });

    if (error) {
        clearPendingLoginUsn();
        throw toAppError(error);
    }

    if (data.user) {
        try {
            await ensureUserProfile(data.user);
            await resolveCurrentUserRoleByUsn(usn);
        } catch (resolveError) {
            await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
            clearPendingLoginUsn();
            throw toAppError(resolveError);
        }
    }

    clearPendingLoginUsn();
    return data;
}

export async function signInWithGoogle(usnInput?: string): Promise<void> {
    const supabase = getSupabase();
    const providedUsn = toNonEmptyString(usnInput);

    if (providedUsn) {
        setPendingLoginUsn(providedUsn);
    } else {
        clearPendingLoginUsn();
    }

    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/feed` : undefined;
    const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo,
            queryParams: {
                access_type: 'offline',
                prompt: 'consent',
            },
        },
    });
    if (error) {
        clearPendingLoginUsn();
        throw toAppError(error);
    }
}

export async function signOutUser() {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) {
        if (isRecoverableAuthError(error)) {
            await recoverSessionState(supabase);
            return;
        }
        throw toAppError(error);
    }
}

async function uploadOneCapture(input: {
    userId: string;
    imageDataUrl: string;
    caption?: string;
    visibility: Visibility;
    eventId?: string;
}): Promise<{ path: string; publicUrl: string }> {
    const supabase = getSupabase();
    const blob = dataUrlToBlob(input.imageDataUrl);
    const mimeType = blob.type || 'image/jpeg';
    const extension = extensionFromMimeType(mimeType);
    const filePath = `${input.userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: storageError } = await supabase.storage.from('captures').upload(filePath, blob, {
        contentType: mimeType,
        upsert: false,
    });
    if (storageError) throw toAppError(storageError);

    const { data: publicData } = supabase.storage.from('captures').getPublicUrl(filePath);
    const publicUrl = publicData.publicUrl || `${supabaseUrl}/storage/v1/object/public/captures/${filePath}`;

    return { path: filePath, publicUrl };
}

export async function uploadCapturedImage(
    imageDataUrl: string,
    options: {
        caption?: string;
        visibility?: Visibility;
        eventId?: string;
    } = {},
): Promise<string> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in to upload.');

    const safeEventId = normalizeUuid(options.eventId);

    const uploaded = await uploadOneCapture({
        userId: user.id,
        imageDataUrl,
        caption: options.caption,
        visibility: options.visibility ?? 'campus',
        eventId: safeEventId,
    });

    const { data: postRow, error: insertError } = await supabase
        .from('posts')
        .insert({
            user_id: user.id,
            image_url: uploaded.publicUrl,
            caption: options.caption ?? null,
            visibility: options.visibility ?? 'campus',
            event_id: safeEventId ?? null,
        })
        .select('id')
        .single();

    if (insertError || !postRow) {
        await supabase.storage.from('captures').remove([uploaded.path]);
        throw toAppError(insertError ?? new Error('Failed to create post.'));
    }

    const { error: imagesError } = await supabase.from('post_images').insert({
        post_id: postRow.id,
        image_url: uploaded.publicUrl,
        sort_order: 0,
    });
    if (imagesError) {
        // Keep post insert successful for legacy compatibility if post_images fails.
        // Feed falls back to posts.image_url.
    }

    return uploaded.publicUrl;
}

export async function uploadBatchCaptures(input: {
    captures: string[];
    caption?: string;
    visibility?: Visibility;
    eventId?: string;
}): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in to upload.');
    if (input.captures.length === 0) throw new Error('No captures to upload.');
    const safeEventId = normalizeUuid(input.eventId);

    const createdFiles: { path: string; publicUrl: string }[] = [];
    try {
        for (const imageDataUrl of input.captures) {
            const uploaded = await uploadOneCapture({
                userId: user.id,
                imageDataUrl,
                caption: input.caption,
                visibility: input.visibility ?? 'campus',
                eventId: safeEventId,
            });
            createdFiles.push(uploaded);
        }

        const coverUrl = createdFiles[0]?.publicUrl;
        if (!coverUrl) {
            throw new Error('No uploaded files in batch.');
        }

        const { data: postRow, error: postInsertError } = await supabase
            .from('posts')
            .insert({
                user_id: user.id,
                image_url: coverUrl,
                caption: input.caption ?? null,
                visibility: input.visibility ?? 'campus',
                event_id: safeEventId ?? null,
            })
            .select('id')
            .single();
        if (postInsertError) throw toAppError(postInsertError);

        const imageRows = createdFiles.map((file, index) => ({
            post_id: postRow.id,
            image_url: file.publicUrl,
            sort_order: index,
        }));

        const { error: imagesInsertError } = await supabase.from('post_images').insert(imageRows);
        if (imagesInsertError) {
            if (isMissingPostImagesError(imagesInsertError)) {
                throw new Error(
                    "Database migration required: missing table 'public.post_images'. Run SQL migration and retry.",
                );
            }
            throw toAppError(imagesInsertError);
        }
    } catch (error) {
        if (createdFiles.length > 0) {
            await supabase.storage.from('captures').remove(createdFiles.map((file) => file.path));
        }
        throw toAppError(error);
    }
}

export async function createPostWithImages(input: {
    imageUrls: string[];
    caption?: string;
    visibility?: Visibility;
    eventId?: string;
}): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in to upload.');
    if (input.imageUrls.length === 0) throw new Error('No images for post.');

    const safeEventId = normalizeUuid(input.eventId);
    const coverUrl = input.imageUrls[0];

    const { data: postRow, error: postInsertError } = await supabase
        .from('posts')
        .insert({
            user_id: user.id,
            image_url: coverUrl,
            caption: input.caption ?? null,
            visibility: input.visibility ?? 'campus',
            event_id: safeEventId ?? null,
        })
        .select('id')
        .single();
    if (postInsertError) throw toAppError(postInsertError);

    const imageRows = input.imageUrls.map((imageUrl, index) => ({
        post_id: postRow.id,
        image_url: imageUrl,
        sort_order: index,
    }));
    const { error: imagesInsertError } = await supabase.from('post_images').insert(imageRows);
    if (imagesInsertError) {
        if (isMissingPostImagesError(imagesInsertError)) {
            throw new Error(
                "Database migration required: missing table 'public.post_images'. Run SQL migration and retry.",
            );
        }
        throw toAppError(imagesInsertError);
    }
}

export async function flushPendingCaptures(captures: OfflineCapture[]): Promise<void> {
    for (const capture of captures) {
        await uploadCapturedImage(capture.imageDataUrl, {
            caption: capture.caption,
            visibility: capture.visibility,
            eventId: capture.eventId,
        });
    }
}

async function hydratePosts(rawPosts: DbPost[]): Promise<Post[]> {
    if (!rawPosts || rawPosts.length === 0) return [];

    const supabase = getSupabase();
    const postIds = rawPosts.map((post) => post.id);
    const userIds = [...new Set(rawPosts.map((post) => post.user_id))];
    const eventIds = [...new Set(rawPosts.map((post) => post.event_id).filter((value): value is string => Boolean(value)))];

    const [{ data: users }, { data: likes }, { data: comments }] = await Promise.all([
        supabase.from('users').select('*').in('id', userIds).returns<DbUser[]>(),
        supabase.from('likes').select('post_id').in('post_id', postIds).returns<DbLike[]>(),
        supabase.from('comments').select('post_id').in('post_id', postIds).returns<DbComment[]>(),
    ]);

    // Backward compatibility: if post_images table/policies are not set yet,
    // still load feed using posts.image_url.
    let postImages: DbPostImage[] = [];
    const { data: postImagesData, error: postImagesError } = await supabase
        .from('post_images')
        .select('post_id,image_url,sort_order')
        .in('post_id', postIds)
        .returns<DbPostImage[]>();

    if (!postImagesError && postImagesData) {
        postImages = postImagesData;
    } else {
        const message = postImagesError?.message?.toLowerCase() ?? '';
        const isMissingTable = message.includes('relation') && message.includes('post_images');
        const isSchemaMissing = message.includes('does not exist');
        if (!isMissingTable && !isSchemaMissing) {
            postImages = [];
        }
    }

    let eventNamesById = new Map<string, string>();
    if (eventIds.length > 0) {
        const { data: eventsData, error: eventsError } = await supabase
            .from('events')
            .select('id,name')
            .in('id', eventIds)
            .returns<DbEventOption[]>();
        if (!eventsError && eventsData) {
            eventNamesById = new Map(eventsData.map((event) => [event.id, event.name]));
        }
    }

    return mapPosts(rawPosts, users ?? [], likes ?? [], comments ?? [], postImages ?? [], eventNamesById);
}

export async function fetchPostsPage(input: {
    visibility?: Visibility;
    limit?: number;
    beforeCreatedAt?: string;
} = {}): Promise<{
    items: Post[];
    nextCursor?: string;
    hasMore: boolean;
}> {
    const supabase = getSupabase();
    const safeLimit = Math.max(1, Math.min(input.limit ?? 5, 50));

    let query = supabase.from('posts').select('*').order('created_at', { ascending: false }).limit(safeLimit + 1);
    if (input.visibility) {
        query = query.eq('visibility', input.visibility);
    }
    if (input.beforeCreatedAt) {
        query = query.lt('created_at', input.beforeCreatedAt);
    }

    const { data: rows, error } = await query.returns<DbPost[]>();
    if (error) throw toAppError(error);
    if (!rows || rows.length === 0) {
        return {
            items: [],
            hasMore: false,
        };
    }

    const hasMore = rows.length > safeLimit;
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;
    const items = await hydratePosts(pageRows);
    const nextCursor = pageRows[pageRows.length - 1]?.created_at;

    return {
        items,
        nextCursor,
        hasMore,
    };
}

export async function fetchPosts(options?: { visibility?: Visibility }): Promise<Post[]> {
    const all: Post[] = [];
    const seenIds = new Set<string>();
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
        const page = await fetchPostsPage({
            visibility: options?.visibility,
            limit: 50,
            beforeCreatedAt: cursor,
        });

        for (const post of page.items) {
            if (seenIds.has(post.id)) continue;
            seenIds.add(post.id);
            all.push(post);
        }

        hasMore = page.hasMore;
        cursor = page.nextCursor;
        if (!cursor) break;
    }

    return all;
}

export async function fetchEventOptions(): Promise<Array<{ id: string; name: string }>> {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('events').select('id,name').order('created_at', { ascending: false }).returns<DbEventOption[]>();
    if (error) throw toAppError(error);
    return data ?? [];
}

export async function fetchEvents(): Promise<Array<{ id: string; name: string; description: string; count: number }>> {
    const supabase = getSupabase();
    const { data: events, error } = await supabase
        .from('events')
        .select('id,name,description')
        .order('created_at', { ascending: false });
    if (error) throw toAppError(error);

    const mapped = await Promise.all(
        (events ?? []).map(async (event) => {
            const { count } = await supabase
                .from('posts')
                .select('*', { count: 'exact', head: true })
                .eq('event_id', event.id);
            return {
                id: event.id as string,
                name: event.name as string,
                description: (event.description as string | null) ?? '',
                count: count ?? 0,
            };
        }),
    );

    return mapped;
}

export async function createEvent(input: { name: string; description?: string }): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');
    const name = input.name.trim();
    const description = input.description?.trim() ?? '';

    if (!name) {
        throw new Error('Event name is required.');
    }

    const { error } = await supabase.from('events').insert({
        name,
        description: description || null,
        created_by: user.id,
    });
    if (error) throw toAppError(error);
}

export async function fetchDateFolderCounts(): Promise<
    Array<{ date: string; count: number; label: string; dominantEventName?: string; dominantEventCount?: number }>
> {
    const posts = await fetchPosts({ visibility: 'campus' });
    const grouped = posts.reduce<Record<string, { count: number; eventCounts: Record<string, number> }>>((acc, post) => {
        const dateKey = getUtcDateKey(post.createdAt);
        if (!dateKey) return acc;

        if (!acc[dateKey]) {
            acc[dateKey] = { count: 0, eventCounts: {} };
        }

        acc[dateKey].count += 1;
        if (post.eventName) {
            acc[dateKey].eventCounts[post.eventName] = (acc[dateKey].eventCounts[post.eventName] ?? 0) + 1;
        }

        return acc;
    }, {});

    return Object.entries(grouped)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .map(([dateKey, bucket]) => {
            const dominantEvent = Object.entries(bucket.eventCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];

            return {
            date: dateKey,
            count: bucket.count,
            label: formatDateLabelFromKey(dateKey),
            dominantEventName: dominantEvent?.[0],
            dominantEventCount: dominantEvent?.[1],
            };
        });
}

export async function fetchDateFolderPosts(dateKey: string): Promise<Post[]> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
        throw new Error('Invalid date folder format.');
    }

    const posts = await fetchPosts({ visibility: 'campus' });
    return posts
        .filter((post) => getUtcDateKey(post.createdAt) === dateKey)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function fetchUserProfile(userId: string) {
    const supabase = getSupabase();
    let { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle<DbUser>();
    if (error) throw toAppError(error);

    if (!data) {
        const sessionUser = await getSessionUser();
        if (sessionUser?.id === userId) {
            try {
                await ensureUserProfile(sessionUser);
            } catch (ensureError) {
                if (isIncognitoAliasRequiredError(ensureError)) {
                    throw new Error(
                        'Profile row is missing and DB requires alias on member insert. Run the user backfill SQL, then retry.',
                    );
                }
                throw toAppError(ensureError);
            }
            const retry = await supabase.from('users').select('*').eq('id', userId).maybeSingle<DbUser>();
            data = retry.data;
            error = retry.error;
            if (error) throw toAppError(error);
        }
    }

    if (!data) throw new Error('Profile not found.');

    const userPosts = await fetchPosts();
    const postsByUser = userPosts.filter((post) => post.userId === userId);
    const totalLikes = postsByUser.reduce((sum, post) => sum + post.likes, 0);
    return {
        user: mapUser(data),
        posts: postsByUser,
        totalLikes,
    };
}

export async function fetchFreedomPosts(): Promise<FreedomPost[]> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    const { data: rows, error } = await supabase
        .from('freedom_wall_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .returns<DbFreedomPost[]>();
    if (error) throw toAppError(error);
    if (!rows || rows.length === 0) return [];

    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const postIds = rows.map((row) => row.id);

    const { data: users, error: usersError } = await supabase.from('users').select('*').in('id', userIds).returns<DbUser[]>();
    if (usersError) throw toAppError(usersError);
    const names = new Map((users ?? []).map((user) => [user.id, user.name]));
    const avatarUrls = new Map(
        (users ?? []).map((user) => [user.id, resolveAvatarUrl(user.avatar_url)]),
    );

    let likesRows: DbFreedomLike[] = [];
    let commentsRows: DbFreedomCommentRow[] = [];

    const { data: likesData, error: likesError } = await supabase
        .from('freedom_wall_likes')
        .select('id,post_id,user_id')
        .in('post_id', postIds)
        .returns<DbFreedomLike[]>();
    if (!likesError && likesData) {
        likesRows = likesData;
    } else if (likesError && !isMissingTableError(likesError, 'freedom_wall_likes')) {
        throw toAppError(likesError);
    }

    const { data: commentsData, error: commentsError } = await supabase
        .from('freedom_wall_comments')
        .select('id,post_id,user_id,parent_id,content,created_at')
        .in('post_id', postIds)
        .returns<DbFreedomCommentRow[]>();
    if (!commentsError && commentsData) {
        commentsRows = commentsData;
    } else if (commentsError && !isMissingTableError(commentsError, 'freedom_wall_comments')) {
        throw toAppError(commentsError);
    }

    const likeCounts = likesRows.reduce<Record<string, number>>((acc, like) => {
        acc[like.post_id] = (acc[like.post_id] ?? 0) + 1;
        return acc;
    }, {});
    const commentCounts = commentsRows.reduce<Record<string, number>>((acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] ?? 0) + 1;
        return acc;
    }, {});
    const likedPostIds = new Set(
        likesRows.filter((like) => like.user_id === user?.id).map((like) => like.post_id),
    );

    return rows.map((row) => ({
        id: row.id,
        authorId: row.user_id,
        authorName: names.get(row.user_id) ?? 'Unknown',
        authorAvatarUrl: avatarUrls.get(row.user_id) ?? DEFAULT_AVATAR_URL,
        content: row.content,
        imageUrl: row.image_url ? normalizeCaptureUrl(row.image_url) : undefined,
        likes: likeCounts[row.id] ?? 0,
        comments: commentCounts[row.id] ?? 0,
        likedByCurrentUser: likedPostIds.has(row.id),
        createdAt: row.created_at,
    }));
}

async function uploadFreedomWallImage(userId: string, file: File): Promise<{ path: string; publicUrl: string }> {
    const supabase = getSupabase();
    const mimeType = file.type || 'image/jpeg';
    if (!mimeType.startsWith('image/')) {
        throw new Error('Only image files are allowed.');
    }

    const extension = extensionFromMimeType(mimeType);
    const filePath = `freedom-wall/${userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from('captures').upload(filePath, file, {
        contentType: mimeType,
        upsert: false,
    });
    if (uploadError) throw toAppError(uploadError);

    const { data: publicData } = supabase.storage.from('captures').getPublicUrl(filePath);
    const publicUrl = publicData.publicUrl || `${supabaseUrl}/storage/v1/object/public/captures/${filePath}`;
    return { path: filePath, publicUrl };
}

export async function createFreedomPost(input: string | { content?: string; imageFile?: File | null }): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const rawContent = typeof input === 'string' ? input : input.content ?? '';
    const cleanedContent = rawContent.trim();
    const imageFile = typeof input === 'string' ? null : input.imageFile ?? null;

    if (!cleanedContent && !imageFile) {
        throw new Error('Write something or choose an image.');
    }

    let uploadedPath: string | null = null;
    let uploadedUrl: string | null = null;

    if (imageFile) {
        const uploaded = await uploadFreedomWallImage(user.id, imageFile);
        uploadedPath = uploaded.path;
        uploadedUrl = uploaded.publicUrl;
    }

    const { error } = await supabase.from('freedom_wall_posts').insert({
        user_id: user.id,
        content: cleanedContent,
        image_url: uploadedUrl,
    });
    if (error) {
        if (uploadedPath) {
            await supabase.storage.from('captures').remove([uploadedPath]);
        }
        throw toAppError(error);
    }
}

export async function toggleFreedomPostLike(postId: string): Promise<{ liked: boolean }> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const { data: existing, error: existingError } = await supabase
        .from('freedom_wall_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (existingError) {
        if (isMissingFreedomEngagementTablesError(existingError)) {
            throw new Error(
                "Database migration required: missing 'freedom_wall_likes' table. Run the latest SQL migration and retry.",
            );
        }
        if (isPermissionDeniedError(existingError)) {
            throw new Error('Permission denied for Freedom Wall likes. Check RLS policies for freedom_wall_likes.');
        }
        throw toAppError(existingError);
    }

    if (existing?.id) {
        const { error: deleteError } = await supabase.from('freedom_wall_likes').delete().eq('id', existing.id);
        if (deleteError) throw toAppError(deleteError);
        return { liked: false };
    }

    const { error: insertError } = await supabase.from('freedom_wall_likes').insert({
        post_id: postId,
        user_id: user.id,
    });
    if (insertError) {
        if (isPermissionDeniedError(insertError)) {
            throw new Error('Permission denied for Freedom Wall likes. Check RLS policies for freedom_wall_likes.');
        }
        throw toAppError(insertError);
    }
    return { liked: true };
}

export async function toggleFreedomCommentLike(commentId: string): Promise<{ liked: boolean }> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const { data: existing, error: existingError } = await supabase
        .from('freedom_wall_comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (existingError) {
        if (isMissingFreedomCommentLikesTableError(existingError)) {
            throw new Error(
                "Database migration required: missing 'freedom_wall_comment_likes' table. Run 'supabase/comment-reactions.sql' and retry.",
            );
        }
        if (isPermissionDeniedError(existingError)) {
            throw new Error(
                'Permission denied for Freedom Wall comment reactions. Check RLS policies for freedom_wall_comment_likes.',
            );
        }
        throw toAppError(existingError);
    }

    if (existing?.id) {
        const { error: deleteError } = await supabase.from('freedom_wall_comment_likes').delete().eq('id', existing.id);
        if (deleteError) throw toAppError(deleteError);
        return { liked: false };
    }

    const { error: insertError } = await supabase.from('freedom_wall_comment_likes').insert({
        comment_id: commentId,
        user_id: user.id,
    });
    if (insertError) {
        if (isMissingFreedomCommentLikesTableError(insertError)) {
            throw new Error(
                "Database migration required: missing 'freedom_wall_comment_likes' table. Run 'supabase/comment-reactions.sql' and retry.",
            );
        }
        if (isPermissionDeniedError(insertError)) {
            throw new Error(
                'Permission denied for Freedom Wall comment reactions. Check RLS policies for freedom_wall_comment_likes.',
            );
        }
        throw toAppError(insertError);
    }

    return { liked: true };
}

export async function fetchFreedomPostComments(postId: string): Promise<FreedomWallComment[]> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    const { data: rows, error } = await supabase
        .from('freedom_wall_comments')
        .select('id,post_id,user_id,parent_id,content,created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .returns<DbFreedomCommentRow[]>();

    if (error) {
        if (isMissingTableError(error, 'freedom_wall_comments')) {
            return [];
        }
        if (isPermissionDeniedError(error)) {
            throw new Error('Permission denied when loading Freedom Wall comments. Check RLS policies.');
        }
        throw toAppError(error);
    }
    if (!rows || rows.length === 0) return [];

    const commentIds = rows.map((row) => row.id);
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const { data: users, error: usersError } = await supabase.from('users').select('*').in('id', userIds).returns<DbUser[]>();
    if (usersError) throw toAppError(usersError);
    const names = new Map((users ?? []).map((user) => [user.id, user.name]));
    const avatarUrls = new Map(
        (users ?? []).map((user) => [user.id, resolveAvatarUrl(user.avatar_url)]),
    );

    let likeRows: DbFreedomCommentLikeRow[] = [];
    if (commentIds.length > 0) {
        const { data: likesData, error: likesError } = await supabase
            .from('freedom_wall_comment_likes')
            .select('id,comment_id,user_id')
            .in('comment_id', commentIds)
            .returns<DbFreedomCommentLikeRow[]>();
        if (!likesError && likesData) {
            likeRows = likesData;
        } else if (likesError && !isMissingFreedomCommentLikesTableError(likesError)) {
            throw toAppError(likesError);
        }
    }

    const likeCounts = likeRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.comment_id] = (acc[row.comment_id] ?? 0) + 1;
        return acc;
    }, {});
    const likedCommentIds = new Set(
        likeRows.filter((row) => row.user_id === user?.id).map((row) => row.comment_id),
    );

    return rows.map((row) => ({
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        parentId: row.parent_id ?? undefined,
        content: row.content,
        likes: likeCounts[row.id] ?? 0,
        likedByCurrentUser: likedCommentIds.has(row.id),
        createdAt: row.created_at,
        authorName: names.get(row.user_id) ?? 'User',
        authorAvatarUrl: avatarUrls.get(row.user_id) ?? DEFAULT_AVATAR_URL,
    }));
}

export async function addFreedomPostComment(input: {
    postId: string;
    content: string;
    parentId?: string;
}): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const cleaned = input.content.trim();
    if (!cleaned) throw new Error('Comment cannot be empty.');

    let targetParentId: string | null = null;
    if (input.parentId) {
        const { data: parent, error: parentError } = await supabase
            .from('freedom_wall_comments')
            .select('id,post_id,parent_id,user_id')
            .eq('id', input.parentId)
            .maybeSingle<{ id: string; post_id: string; parent_id: string | null; user_id: string }>();
        if (parentError) throw toAppError(parentError);
        if (!parent || parent.post_id !== input.postId) {
            throw new Error('Reply target no longer exists.');
        }
        if (parent.user_id === user.id) {
            throw new Error('You cannot reply to your own comment.');
        }

        targetParentId = parent.id;
    }

    const { error } = await supabase.from('freedom_wall_comments').insert({
        post_id: input.postId,
        user_id: user.id,
        parent_id: targetParentId,
        content: cleaned,
    });
    if (error) {
        if (isMissingFreedomEngagementTablesError(error)) {
            throw new Error(
                "Database migration required: missing 'freedom_wall_comments' table. Run the latest SQL migration and retry.",
            );
        }
        if (isFreedomCommentPolicyRecursionError(error)) {
            throw new Error(
                "Freedom Wall comment policy recursion detected in DB. Re-run 'supabase/freedom-wall-engagement.sql' and retry.",
            );
        }
        if (isPermissionDeniedError(error)) {
            throw new Error('Permission denied for Freedom Wall comments. Check RLS policies for freedom_wall_comments.');
        }
        throw toAppError(error);
    }
}

export function subscribeToFreedomWall(onChange: () => void): () => void {
    const supabase = getSupabase();
    const channel = supabase
        .channel('freedom-wall-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'freedom_wall_posts' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'freedom_wall_likes' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'freedom_wall_comments' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'freedom_wall_comment_likes' }, onChange)
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}

export async function fetchIncognitoPosts(): Promise<
    Array<{
        id: string;
        content: string;
        createdAt: string;
        authorAlias: string;
        authorId?: string;
        likes: number;
        comments: number;
        likedByCurrentUser: boolean;
    }>
> {
    const supabase = getSupabase();
    const [profile, currentUser] = await Promise.all([getCurrentUserProfile(), getSessionUser()]);
    const isAdmin = profile?.role === 'admin';

    const { data: rows, error } = await supabase
        .from('incognito_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .returns<DbIncognitoPost[]>();
    if (error) throw toAppError(error);
    if (!rows || rows.length === 0) return [];

    const postIds = rows.map((row) => row.id);
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    let likesRows: DbIncognitoLike[] = [];
    let commentsRows: DbIncognitoCommentRow[] = [];
    const aliasByUserId = new Map<string, string>();

    if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id,role,incognito_alias')
            .in('id', userIds)
            .returns<Array<{ id: string; role: UserRole; incognito_alias: string | null }>>();
        if (usersError) throw toAppError(usersError);
        (users ?? []).forEach((dbUser) => {
            aliasByUserId.set(
                dbUser.id,
                resolveIncognitoDisplayAlias({
                    role: dbUser.role,
                    incognitoAlias: dbUser.incognito_alias,
                }),
            );
        });
    }

    const { data: likesData, error: likesError } = await supabase
        .from('incognito_likes')
        .select('id,post_id,user_id')
        .in('post_id', postIds)
        .returns<DbIncognitoLike[]>();
    if (!likesError && likesData) {
        likesRows = likesData;
    } else if (likesError && !isMissingTableError(likesError, 'incognito_likes')) {
        throw toAppError(likesError);
    }

    const { data: commentsData, error: commentsError } = await supabase
        .from('incognito_comments')
        .select('id,post_id,user_id,content,created_at')
        .in('post_id', postIds)
        .returns<DbIncognitoCommentRow[]>();
    if (!commentsError && commentsData) {
        commentsRows = commentsData;
    } else if (commentsError && !isMissingTableError(commentsError, 'incognito_comments')) {
        throw toAppError(commentsError);
    }

    const likeCounts = likesRows.reduce<Record<string, number>>((acc, like) => {
        acc[like.post_id] = (acc[like.post_id] ?? 0) + 1;
        return acc;
    }, {});
    const commentCounts = commentsRows.reduce<Record<string, number>>((acc, comment) => {
        acc[comment.post_id] = (acc[comment.post_id] ?? 0) + 1;
        return acc;
    }, {});
    const likedPostIds = new Set(likesRows.filter((row) => row.user_id === currentUser?.id).map((row) => row.post_id));

    return (rows ?? []).map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        authorAlias: aliasByUserId.get(row.user_id) ?? 'Anonymous',
        authorId: isAdmin ? row.user_id : undefined,
        likes: likeCounts[row.id] ?? 0,
        comments: commentCounts[row.id] ?? 0,
        likedByCurrentUser: likedPostIds.has(row.id),
    }));
}

export async function createIncognitoPost(content: string): Promise<void> {
    const supabase = getSupabase();
    const [user, profile] = await Promise.all([getSessionUser(), getCurrentUserProfile()]);
    if (!user) throw new Error('You must be logged in.');
    if (!profile) throw new Error('Complete your profile setup first, then try again.');
    if (profile.role === 'member' && !parseIncognitoAlias(profile.incognitoAlias)) {
        throw new Error('Set your incognito alias in your profile before posting on Incognito.');
    }
    const cleaned = content.trim();
    if (!cleaned) throw new Error('Write something before posting.');
    const { error } = await supabase.from('incognito_posts').insert({
        user_id: user.id,
        content: cleaned,
    });
    if (error) throw toAppError(error);
}

export async function toggleIncognitoPostLike(postId: string): Promise<{ liked: boolean }> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const { data: existing, error: checkError } = await supabase
        .from('incognito_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (checkError) {
        if (isMissingIncognitoEngagementTablesError(checkError)) {
            throw new Error(
                "Database migration required: missing 'incognito_likes' table. Run 'supabase/notifications.sql' and retry.",
            );
        }
        throw toAppError(checkError);
    }

    if (existing?.id) {
        const { error: deleteError } = await supabase.from('incognito_likes').delete().eq('id', existing.id);
        if (deleteError) throw toAppError(deleteError);
        return { liked: false };
    }

    const { error: insertError } = await supabase.from('incognito_likes').insert({
        post_id: postId,
        user_id: user.id,
    });
    if (insertError) {
        if (isMissingIncognitoEngagementTablesError(insertError)) {
            throw new Error(
                "Database migration required: missing 'incognito_likes' table. Run 'supabase/notifications.sql' and retry.",
            );
        }
        throw toAppError(insertError);
    }

    return { liked: true };
}

export async function toggleIncognitoCommentLike(commentId: string): Promise<{ liked: boolean }> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const { data: existing, error: checkError } = await supabase
        .from('incognito_comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (checkError) {
        if (isMissingIncognitoCommentLikesTableError(checkError)) {
            throw new Error(
                "Database migration required: missing 'incognito_comment_likes' table. Run 'supabase/comment-reactions.sql' and retry.",
            );
        }
        throw toAppError(checkError);
    }

    if (existing?.id) {
        const { error: deleteError } = await supabase.from('incognito_comment_likes').delete().eq('id', existing.id);
        if (deleteError) throw toAppError(deleteError);
        return { liked: false };
    }

    const { error: insertError } = await supabase.from('incognito_comment_likes').insert({
        comment_id: commentId,
        user_id: user.id,
    });
    if (insertError) {
        if (isMissingIncognitoCommentLikesTableError(insertError)) {
            throw new Error(
                "Database migration required: missing 'incognito_comment_likes' table. Run 'supabase/comment-reactions.sql' and retry.",
            );
        }
        throw toAppError(insertError);
    }

    return { liked: true };
}

export async function fetchIncognitoPostComments(postId: string): Promise<PostComment[]> {
    const supabase = getSupabase();
    const currentUser = await getSessionUser();
    const { data: rows, error } = await supabase
        .from('incognito_comments')
        .select('id,post_id,user_id,content,created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .returns<DbIncognitoCommentRow[]>();

    if (error) {
        if (isMissingTableError(error, 'incognito_comments')) {
            return [];
        }
        throw toAppError(error);
    }
    if (!rows || rows.length === 0) return [];

    const commentIds = rows.map((row) => row.id);
    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const { data: users, error: usersError } = await supabase.from('users').select('*').in('id', userIds).returns<DbUser[]>();
    if (usersError) throw toAppError(usersError);
    const aliases = new Map(
        (users ?? []).map((dbUser) => [
            dbUser.id,
            resolveIncognitoDisplayAlias({
                role: dbUser.role,
                incognitoAlias: dbUser.incognito_alias,
            }),
        ]),
    );

    let likeRows: DbIncognitoCommentLikeRow[] = [];
    if (commentIds.length > 0) {
        const { data: likesData, error: likesError } = await supabase
            .from('incognito_comment_likes')
            .select('id,comment_id,user_id')
            .in('comment_id', commentIds)
            .returns<DbIncognitoCommentLikeRow[]>();
        if (!likesError && likesData) {
            likeRows = likesData;
        } else if (likesError && !isMissingIncognitoCommentLikesTableError(likesError)) {
            throw toAppError(likesError);
        }
    }

    const likeCounts = likeRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.comment_id] = (acc[row.comment_id] ?? 0) + 1;
        return acc;
    }, {});
    const likedCommentIds = new Set(
        likeRows.filter((row) => row.user_id === currentUser?.id).map((row) => row.comment_id),
    );

    return rows.map((row) => ({
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        content: row.content,
        likes: likeCounts[row.id] ?? 0,
        likedByCurrentUser: likedCommentIds.has(row.id),
        createdAt: row.created_at,
        authorName: aliases.get(row.user_id) ?? 'Anonymous',
    }));
}

export async function addIncognitoPostComment(postId: string, content: string): Promise<void> {
    const supabase = getSupabase();
    const [user, profile] = await Promise.all([getSessionUser(), getCurrentUserProfile()]);
    if (!user) throw new Error('You must be logged in.');
    if (!profile) throw new Error('Complete your profile setup first, then try again.');
    if (profile.role === 'member' && !parseIncognitoAlias(profile.incognitoAlias)) {
        throw new Error('Set your incognito alias in your profile before commenting on Incognito.');
    }

    const cleaned = content.trim();
    if (!cleaned) throw new Error('Comment cannot be empty.');

    const { error } = await supabase.from('incognito_comments').insert({
        post_id: postId,
        user_id: user.id,
        content: cleaned,
    });
    if (error) {
        if (isMissingIncognitoEngagementTablesError(error)) {
            throw new Error(
                "Database migration required: missing 'incognito_comments' table. Run 'supabase/notifications.sql' and retry.",
            );
        }
        throw toAppError(error);
    }
}

export function subscribeToIncognito(onChange: () => void): () => void {
    const supabase = getSupabase();
    const channel = supabase
        .channel('incognito-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incognito_posts' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incognito_likes' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incognito_comments' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'incognito_comment_likes' }, onChange)
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}

async function mapNotificationsRows(rows: DbNotification[]): Promise<AppNotification[]> {
    const supabase = getSupabase();
    if (!rows || rows.length === 0) return [];

    const normalizedRows = rows.map((row) => ({
        row,
        type: normalizeNotificationType(row.type),
        data: row.data ?? {},
    }));

    const actorIds = [
        ...new Set(
            normalizedRows
                .map(({ row }) => row.actor_user_id)
                .filter((value): value is string => Boolean(value)),
        ),
    ];
    const actorById = new Map<
        string,
        { name: string; avatarUrl: string; incognitoAlias: string }
    >();
    if (actorIds.length > 0) {
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id,name,avatar_url,role,incognito_alias')
            .in('id', actorIds)
            .returns<Array<{ id: string; name: string; avatar_url: string | null; role: UserRole; incognito_alias: string | null }>>();
        if (usersError) throw toAppError(usersError);
        (users ?? []).forEach((row) => {
            actorById.set(row.id, {
                name: row.name,
                avatarUrl: resolveAvatarUrl(row.avatar_url),
                incognitoAlias: resolveIncognitoDisplayAlias({
                    role: row.role,
                    incognitoAlias: row.incognito_alias,
                }),
            });
        });
    }

    const feedPostIds = [
        ...new Set(
            normalizedRows
                .filter(
                    ({ type }) =>
                        type === 'feed_like' || type === 'feed_comment',
                )
                .map(({ data }) => getNotificationDataString(data, 'postId'))
                .filter((value): value is string => Boolean(value)),
        ),
    ];
    const freedomPostIds = [
        ...new Set(
            normalizedRows
                .filter(
                    ({ type }) =>
                        type === 'freedom_like' || type === 'freedom_comment',
                )
                .map(({ data }) =>
                    getNotificationDataString(data, 'freedomPostId'),
                )
                .filter((value): value is string => Boolean(value)),
        ),
    ];
    const incognitoPostIds = [
        ...new Set(
            normalizedRows
                .filter(
                    ({ type }) =>
                        type === 'incognito_like' ||
                        type === 'incognito_comment',
                )
                .map(({ data }) =>
                    getNotificationDataString(data, 'incognitoPostId'),
                )
                .filter((value): value is string => Boolean(value)),
        ),
    ];

    const feedCaptionById = new Map<string, string>();
    if (feedPostIds.length > 0) {
        const { data } = await supabase
            .from('posts')
            .select('id,caption')
            .in('id', feedPostIds)
            .returns<Array<{ id: string; caption: string | null }>>();
        (data ?? []).forEach((post) => {
            feedCaptionById.set(post.id, toNonEmptyString(post.caption) ?? 'none');
        });
    }

    const freedomCaptionById = new Map<string, string>();
    if (freedomPostIds.length > 0) {
        const { data } = await supabase
            .from('freedom_wall_posts')
            .select('id,content')
            .in('id', freedomPostIds)
            .returns<Array<{ id: string; content: string | null }>>();
        (data ?? []).forEach((post) => {
            freedomCaptionById.set(
                post.id,
                toNonEmptyString(post.content) ?? 'none',
            );
        });
    }

    const incognitoCaptionById = new Map<string, string>();
    if (incognitoPostIds.length > 0) {
        const { data } = await supabase
            .from('incognito_posts')
            .select('id,content')
            .in('id', incognitoPostIds)
            .returns<Array<{ id: string; content: string | null }>>();
        (data ?? []).forEach((post) => {
            incognitoCaptionById.set(
                post.id,
                toNonEmptyString(post.content) ?? 'none',
            );
        });
    }

    return normalizedRows.map(({ row, type, data }) => {
        const isIncognitoNotification = type === 'incognito_like' || type === 'incognito_comment';
        const actor = row.actor_user_id ? actorById.get(row.actor_user_id) : undefined;
        const actorAliasFromData = isIncognitoNotification ? getNotificationDataString(data, 'actorAlias') : undefined;

        let title = row.title;
        let body = row.body;
        if (isIncognitoNotification) {
            title = 'New activity on your anonymous post';
            body = type === 'incognito_like'
                ? 'Someone liked one of your anonymous posts.'
                : 'Someone commented on your anonymous post.';
        }

        const mappedData: Record<string, unknown> = { ...data };
        if (type === 'feed_like' || type === 'feed_comment') {
            const postId = getNotificationDataString(data, 'postId');
            mappedData.targetCaption =
                (postId && feedCaptionById.get(postId)) ?? 'none';
        } else if (type === 'freedom_like' || type === 'freedom_comment') {
            const postId = getNotificationDataString(data, 'freedomPostId');
            mappedData.targetCaption =
                (postId && freedomCaptionById.get(postId)) ?? 'none';
        } else if (
            type === 'incognito_like' ||
            type === 'incognito_comment'
        ) {
            const postId = getNotificationDataString(data, 'incognitoPostId');
            mappedData.targetCaption =
                (postId && incognitoCaptionById.get(postId)) ?? 'none';
        }

        return {
            id: row.id,
            recipientUserId: row.recipient_user_id,
            actorUserId: row.actor_user_id ?? undefined,
            actorName:
                isIncognitoNotification
                    ? actor?.incognitoAlias ?? actorAliasFromData ?? actor?.name
                    : !row.actor_user_id
                      ? undefined
                      : actor?.name,
            actorAvatarUrl:
                isIncognitoNotification || !row.actor_user_id
                    ? undefined
                    : actor?.avatarUrl,
            type,
            title,
            body,
            data: mappedData,
            readAt: row.read_at ?? undefined,
            createdAt: row.created_at,
        };
    });
}

export async function fetchNotificationsPage(input: {
    limit?: number;
    beforeCreatedAt?: string;
} = {}): Promise<{
    items: AppNotification[];
    nextCursor?: string;
    hasMore: boolean;
}> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) {
        return {
            items: [],
            hasMore: false,
        };
    }

    const safeLimit = Math.max(1, Math.min(input.limit ?? 10, 200));
    let query = supabase
        .from('notifications')
        .select('*')
        .eq('recipient_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(safeLimit + 1);

    if (input.beforeCreatedAt) {
        query = query.lt('created_at', input.beforeCreatedAt);
    }

    const { data: rows, error } = await query.returns<DbNotification[]>();
    if (error) {
        if (isMissingTableError(error, 'notifications')) {
            return {
                items: [],
                hasMore: false,
            };
        }
        throw toAppError(error);
    }
    if (!rows || rows.length === 0) {
        return {
            items: [],
            hasMore: false,
        };
    }

    const hasMore = rows.length > safeLimit;
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;
    const items = await mapNotificationsRows(pageRows);
    const nextCursor = pageRows[pageRows.length - 1]?.created_at;

    return {
        items,
        hasMore,
        nextCursor,
    };
}

export async function fetchNotifications(limit = 60): Promise<AppNotification[]> {
    const firstPage = await fetchNotificationsPage({ limit });
    return firstPage.items;
}

export async function countUnreadNotifications(): Promise<number> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) return 0;

    const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('recipient_user_id', user.id)
        .is('read_at', null);

    if (error) {
        if (isMissingTableError(error, 'notifications')) {
            return 0;
        }
        throw toAppError(error);
    }

    return count ?? 0;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId)
        .eq('recipient_user_id', user.id);
    if (error) throw toAppError(error);
}

export async function markAllNotificationsRead(): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('recipient_user_id', user.id)
        .is('read_at', null);
    if (error) throw toAppError(error);
}

export function subscribeToNotifications(onChange: () => void): () => void {
    const supabase = getSupabase();
    let channel: RealtimeChannel | null = null;
    let disposed = false;

    void getSessionUser()
        .then((user) => {
            if (disposed || !user) return;
            channel = supabase
                .channel(`notifications-${user.id}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'notifications', filter: `recipient_user_id=eq.${user.id}` },
                    onChange,
                )
                .subscribe();
        })
        .catch(() => undefined);

    return () => {
        disposed = true;
        if (channel) {
            void supabase.removeChannel(channel);
        }
    };
}

export async function fetchReviews(): Promise<(Review & { visitorName: string })[]> {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false })
        .returns<DbReview[]>();
    if (error) throw toAppError(error);

    const visitorIds = [...new Set((rows ?? []).map((row) => row.visitor_id))];
    const { data: users, error: usersError } = await supabase.from('users').select('*').in('id', visitorIds).returns<DbUser[]>();
    if (usersError) throw toAppError(usersError);
    const names = new Map((users ?? []).map((user) => [user.id, user.name]));

    return (rows ?? []).map((row) => ({
        id: row.id,
        visitorId: row.visitor_id,
        rating: row.rating,
        reviewText: row.review_text,
        status: row.status,
        createdAt: row.created_at,
        visitorName: names.get(row.visitor_id) ?? 'Visitor',
    }));
}

export async function hasUserLikedPost(postId: string): Promise<boolean> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) return false;
    const { data, error } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (error) throw toAppError(error);
    return Boolean(data);
}

export async function fetchPostEngagement(postId: string): Promise<{
    likesCount: number;
    commentsCount: number;
    likedByCurrentUser: boolean;
}> {
    const supabase = getSupabase();
    const user = await getSessionUser();

    const [likesResult, commentsResult, likedResult] = await Promise.all([
        supabase.from('likes').select('*', { count: 'exact', head: true }).eq('post_id', postId),
        supabase.from('comments').select('*', { count: 'exact', head: true }).eq('post_id', postId),
        user
            ? supabase
                  .from('likes')
                  .select('id')
                  .eq('post_id', postId)
                  .eq('user_id', user.id)
                  .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
    ]);

    if (likesResult.error) throw toAppError(likesResult.error);
    if (commentsResult.error) throw toAppError(commentsResult.error);
    if (likedResult.error) throw toAppError(likedResult.error);

    return {
        likesCount: likesResult.count ?? 0,
        commentsCount: commentsResult.count ?? 0,
        likedByCurrentUser: Boolean(likedResult.data),
    };
}

export async function togglePostLike(postId: string): Promise<{ liked: boolean }> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const { data: existing, error: checkError } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (checkError) throw toAppError(checkError);

    if (existing?.id) {
        const { error: deleteError } = await supabase.from('likes').delete().eq('id', existing.id);
        if (deleteError) throw toAppError(deleteError);
        return { liked: false };
    }

    const { error: insertError } = await supabase.from('likes').insert({
        post_id: postId,
        user_id: user.id,
    });
    if (insertError) throw toAppError(insertError);
    return { liked: true };
}

export async function togglePostCommentLike(commentId: string): Promise<{ liked: boolean }> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const profile = await getCurrentUserProfile().catch(() => null);
    if (profile?.role === 'visitor') {
        throw new Error('Visitor accounts can only like feed posts.');
    }

    const { data: existing, error: checkError } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .maybeSingle();
    if (checkError) {
        if (isMissingFeedCommentLikesTableError(checkError)) {
            throw new Error(
                "Database migration required: missing 'comment_likes' table. Run 'supabase/comment-reactions.sql' and retry.",
            );
        }
        throw toAppError(checkError);
    }

    if (existing?.id) {
        const { error: deleteError } = await supabase.from('comment_likes').delete().eq('id', existing.id);
        if (deleteError) throw toAppError(deleteError);
        return { liked: false };
    }

    const { error: insertError } = await supabase.from('comment_likes').insert({
        comment_id: commentId,
        user_id: user.id,
    });
    if (insertError) {
        if (isMissingFeedCommentLikesTableError(insertError)) {
            throw new Error(
                "Database migration required: missing 'comment_likes' table. Run 'supabase/comment-reactions.sql' and retry.",
            );
        }
        throw toAppError(insertError);
    }

    return { liked: true };
}

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
    const all: PostComment[] = [];
    const seenIds = new Set<string>();
    let cursor: string | undefined = undefined;
    let hasMore = true;

    while (hasMore) {
        const page = await fetchPostCommentsPage(postId, {
            limit: 50,
            beforeCreatedAt: cursor,
        });

        for (const comment of page.items) {
            if (seenIds.has(comment.id)) continue;
            seenIds.add(comment.id);
            all.push(comment);
        }

        hasMore = page.hasMore;
        cursor = page.nextCursor;
        if (!cursor) break;
    }

    return all;
}

export async function fetchPostCommentsPage(
    postId: string,
    input: {
        limit?: number;
        beforeCreatedAt?: string;
    } = {},
): Promise<{
    items: PostComment[];
    nextCursor?: string;
    hasMore: boolean;
}> {
    const supabase = getSupabase();
    const currentUser = await getSessionUser();
    const safeLimit = Math.max(1, Math.min(input.limit ?? 10, 100));
    let query = supabase
        .from('comments')
        .select('id,post_id,user_id,parent_id,content,created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: false })
        .limit(safeLimit + 1);

    if (input.beforeCreatedAt) {
        query = query.lt('created_at', input.beforeCreatedAt);
    }

    const { data: rows, error } = await query.returns<DbCommentRow[]>();
    if (error) {
        if (isMissingFeedCommentReplySchemaError(error)) {
            throw new Error(
                "Database migration required: missing feed comment reply schema. Run 'supabase/feed-comment-replies.sql' and retry.",
            );
        }
        throw toAppError(error);
    }
    if (!rows || rows.length === 0) {
        return {
            items: [],
            hasMore: false,
        };
    }

    const hasMore = rows.length > safeLimit;
    const pageRows = hasMore ? rows.slice(0, safeLimit) : rows;

    const userIds = [...new Set(pageRows.map((row) => row.user_id))];
    const { data: users, error: usersError } = await supabase.from('users').select('*').in('id', userIds).returns<DbUser[]>();
    if (usersError) throw toAppError(usersError);
    const names = new Map((users ?? []).map((user) => [user.id, user.name]));
    const avatarUrls = new Map(
        (users ?? []).map((user) => [user.id, resolveAvatarUrl(user.avatar_url)]),
    );

    const commentIds = pageRows.map((row) => row.id);
    let likeRows: DbCommentLikeRow[] = [];
    if (commentIds.length > 0) {
        const { data: likesData, error: likesError } = await supabase
            .from('comment_likes')
            .select('id,comment_id,user_id')
            .in('comment_id', commentIds)
            .returns<DbCommentLikeRow[]>();
        if (!likesError && likesData) {
            likeRows = likesData;
        } else if (likesError && !isMissingFeedCommentLikesTableError(likesError)) {
            throw toAppError(likesError);
        }
    }
    const likeCounts = likeRows.reduce<Record<string, number>>((acc, row) => {
        acc[row.comment_id] = (acc[row.comment_id] ?? 0) + 1;
        return acc;
    }, {});
    const likedCommentIds = new Set(
        likeRows.filter((row) => row.user_id === currentUser?.id).map((row) => row.comment_id),
    );

    const items = pageRows.map((row) => ({
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        parentId: row.parent_id ?? undefined,
        content: row.content,
        likes: likeCounts[row.id] ?? 0,
        likedByCurrentUser: likedCommentIds.has(row.id),
        createdAt: row.created_at,
        authorName: names.get(row.user_id) ?? 'User',
        authorAvatarUrl: avatarUrls.get(row.user_id) ?? DEFAULT_AVATAR_URL,
    }));
    const nextCursor = pageRows[pageRows.length - 1]?.created_at;

    return {
        items,
        nextCursor,
        hasMore,
    };
}

export async function addPostComment(postId: string, content: string, parentId?: string): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const profile = await getCurrentUserProfile().catch(() => null);
    if (profile?.role === 'visitor') {
        throw new Error('Visitor accounts can read comments but cannot comment.');
    }

    const cleaned = content.trim();
    if (!cleaned) throw new Error('Comment cannot be empty.');

    let targetParentId: string | null = null;
    if (parentId) {
        const { data: parent, error: parentError } = await supabase
            .from('comments')
            .select('id,post_id,parent_id,user_id')
            .eq('id', parentId)
            .maybeSingle<{ id: string; post_id: string; parent_id: string | null; user_id: string }>();
        if (parentError) {
            if (isMissingFeedCommentReplySchemaError(parentError)) {
                throw new Error(
                    "Database migration required: missing feed comment reply schema. Run 'supabase/feed-comment-replies.sql' and retry.",
                );
            }
            throw toAppError(parentError);
        }
        if (!parent || parent.post_id !== postId) {
            throw new Error('Reply target no longer exists.');
        }
        if (parent.user_id === user.id) {
            throw new Error('You cannot reply to your own comment.');
        }

        targetParentId = parent.id;
    }

    const { error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: user.id,
        parent_id: targetParentId,
        content: cleaned,
    });
    if (error) {
        if (isMissingFeedCommentReplySchemaError(error)) {
            throw new Error(
                "Database migration required: missing feed comment reply schema. Run 'supabase/feed-comment-replies.sql' and retry.",
            );
        }
        throw toAppError(error);
    }
}

export function subscribeToPostEngagement(postId: string, onChange: () => void): () => void {
    const supabase = getSupabase();
    const channel = supabase
        .channel(`post-engagement-${postId}`)
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'likes', filter: `post_id=eq.${postId}` },
            onChange,
        )
        .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${postId}` },
            onChange,
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_likes' }, onChange)
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}

export async function fetchUsers() {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('users').select('*').order('created_at', { ascending: false }).returns<DbUser[]>();
    if (error) throw toAppError(error);
    return (data ?? []).map(mapUser);
}

export async function fetchStudentRegistry(): Promise<StudentRegistryEntry[]> {
    const { supabase } = await requireAdminSession();
    const { data, error } = await supabase
        .from('student_registry')
        .select('*')
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true })
        .returns<DbStudentRegistry[]>();
    if (error) {
        if (isMissingStudentRegistryTableError(error)) {
            throw new Error(
                "Database migration required: missing 'student_registry' table. Run 'supabase/student-registry.sql' and retry.",
            );
        }
        throw toAppError(error);
    }
    return (data ?? []).map(mapStudentRegistryRow);
}

export async function upsertStudentRegistryEntry(
    input: StudentRegistryUpsertInput & { id?: string },
): Promise<StudentRegistryEntry> {
    const { supabase } = await requireAdminSession();
    const payload = normalizeStudentRegistryPayload(input);

    if (input.id) {
        if (!UUID_PATTERN.test(input.id)) {
            throw new Error('Invalid student entry id.');
        }
        const { data, error } = await supabase
            .from('student_registry')
            .update(payload)
            .eq('id', input.id)
            .select('*')
            .maybeSingle<DbStudentRegistry>();
        if (error) {
            if (isMissingStudentRegistryTableError(error)) {
                throw new Error(
                    "Database migration required: missing 'student_registry' table. Run 'supabase/student-registry.sql' and retry.",
                );
            }
            if (isUniqueViolationError(error)) {
                throw new Error('USN or email already exists for another student.');
            }
            throw toAppError(error);
        }
        if (!data) {
            throw new Error('Student record was not found.');
        }
        return mapStudentRegistryRow(data);
    }

    const { data, error } = await supabase
        .from('student_registry')
        .upsert(payload, { onConflict: 'usn' })
        .select('*')
        .maybeSingle<DbStudentRegistry>();
    if (error) {
        if (isMissingStudentRegistryTableError(error)) {
            throw new Error(
                "Database migration required: missing 'student_registry' table. Run 'supabase/student-registry.sql' and retry.",
            );
        }
        if (isUniqueViolationError(error)) {
            throw new Error('USN or email already exists for another student.');
        }
        throw toAppError(error);
    }
    if (!data) {
        throw new Error('Failed to save student record.');
    }
    return mapStudentRegistryRow(data);
}

export async function bulkUpsertStudentRegistry(
    rows: StudentRegistryUpsertInput[],
): Promise<{ upserted: number }> {
    const { supabase } = await requireAdminSession();
    if (rows.length === 0) {
        return { upserted: 0 };
    }

    const payload = rows.map((row) => normalizeStudentRegistryPayload(row));
    const { data, error } = await supabase
        .from('student_registry')
        .upsert(payload, { onConflict: 'usn' })
        .select('id')
        .returns<Array<{ id: string }>>();
    if (error) {
        if (isMissingStudentRegistryTableError(error)) {
            throw new Error(
                "Database migration required: missing 'student_registry' table. Run 'supabase/student-registry.sql' and retry.",
            );
        }
        if (isUniqueViolationError(error)) {
            throw new Error('Import failed because at least one email or USN is duplicated.');
        }
        throw toAppError(error);
    }
    return { upserted: data?.length ?? payload.length };
}

export async function deleteStudentRegistryEntry(entryId: string): Promise<void> {
    if (!UUID_PATTERN.test(entryId)) {
        throw new Error('Invalid student entry id.');
    }
    const { supabase } = await requireAdminSession();
    const { error } = await supabase
        .from('student_registry')
        .delete()
        .eq('id', entryId);
    if (error) {
        if (isMissingStudentRegistryTableError(error)) {
            throw new Error(
                "Database migration required: missing 'student_registry' table. Run 'supabase/student-registry.sql' and retry.",
            );
        }
        throw toAppError(error);
    }
}

export async function searchGlobalContent(
    query: string,
    options?: { limit?: number },
): Promise<GlobalSearchResults> {
    const term = normalizeSearchQuery(query);
    const empty: GlobalSearchResults = {
        users: [],
        events: [],
        dates: [],
        posts: [],
    };

    if (term.length < 2) return empty;

    const supabase = getSupabase();
    const safeLimit = Math.max(1, Math.min(options?.limit ?? 6, 20));
    const ilikePattern = toIlikePattern(term);
    const termLower = term.toLowerCase();
    const isDateLike =
        /\d/.test(termLower) ||
        /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)/.test(
            termLower,
        );

    const profile = await getCurrentUserProfile().catch(() => null);
    const isVisitor = profile?.role === 'visitor';

    const users: SearchUserResult[] = [];
    const events: SearchEventResult[] = [];
    const dates: SearchDateResult[] = [];
    const posts: SearchPostResult[] = [];

    try {
        const [byNameResult, byEmailResult] = await Promise.all([
            supabase
                .from('users')
                .select('id,name,email,role,avatar_url')
                .ilike('name', ilikePattern)
                .order('name', { ascending: true })
                .limit(safeLimit)
                .returns<DbSearchUserRow[]>(),
            supabase
                .from('users')
                .select('id,name,email,role,avatar_url')
                .ilike('email', ilikePattern)
                .order('name', { ascending: true })
                .limit(safeLimit)
                .returns<DbSearchUserRow[]>(),
        ]);

        if (byNameResult.error) throw byNameResult.error;
        if (byEmailResult.error) throw byEmailResult.error;

        const merged = dedupeById([...(byNameResult.data ?? []), ...(byEmailResult.data ?? [])]).slice(0, safeLimit);
        users.push(
            ...merged.map((row) => ({
                id: row.id,
                name: row.name,
                email: row.email,
                role: row.role,
                avatarUrl: resolveAvatarUrl(row.avatar_url),
            })),
        );
    } catch (error) {
        if (!isPermissionDeniedError(error) && !isMissingTableError(error, 'users')) {
            throw toAppError(error);
        }
    }

    try {
        const [byNameResult, byDescriptionResult] = await Promise.all([
            supabase
                .from('events')
                .select('id,name,description')
                .ilike('name', ilikePattern)
                .order('created_at', { ascending: false })
                .limit(safeLimit)
                .returns<DbEventSearch[]>(),
            supabase
                .from('events')
                .select('id,name,description')
                .ilike('description', ilikePattern)
                .order('created_at', { ascending: false })
                .limit(safeLimit)
                .returns<DbEventSearch[]>(),
        ]);

        if (byNameResult.error) throw byNameResult.error;
        if (byDescriptionResult.error) throw byDescriptionResult.error;

        const merged = dedupeById([...(byNameResult.data ?? []), ...(byDescriptionResult.data ?? [])]).slice(0, safeLimit);
        events.push(
            ...merged.map((row) => ({
                id: row.id,
                name: row.name,
                description: row.description ?? '',
            })),
        );
    } catch (error) {
        if (!isPermissionDeniedError(error) && !isMissingTableError(error, 'events')) {
            throw toAppError(error);
        }
    }

    try {
        let postsQuery = supabase
            .from('posts')
            .select('id,user_id,image_url,caption,visibility,event_id,created_at')
            .not('caption', 'is', null)
            .ilike('caption', ilikePattern)
            .order('created_at', { ascending: false })
            .limit(safeLimit);

        if (isVisitor) {
            postsQuery = postsQuery.eq('visibility', 'visitor');
        }

        const { data: postRows, error: postsError } = await postsQuery.returns<DbPost[]>();
        if (postsError) throw postsError;

        const validPostRows = (postRows ?? []).filter((row) => Boolean(row.caption));
        if (validPostRows.length > 0) {
            const authorIds = [...new Set(validPostRows.map((row) => row.user_id))];
            const eventIds = [...new Set(validPostRows.map((row) => row.event_id).filter((value): value is string => Boolean(value)))];

            const authorNameById = new Map<string, string>();
            const eventNameById = new Map<string, string>();

            if (authorIds.length > 0) {
                const { data: authors, error: authorsError } = await supabase
                    .from('users')
                    .select('id,name')
                    .in('id', authorIds)
                    .returns<Array<{ id: string; name: string }>>();
                if (!authorsError && authors) {
                    authors.forEach((row) => {
                        authorNameById.set(row.id, row.name);
                    });
                }
            }

            if (eventIds.length > 0) {
                const { data: eventRows, error: eventRowsError } = await supabase
                    .from('events')
                    .select('id,name')
                    .in('id', eventIds)
                    .returns<Array<{ id: string; name: string }>>();
                if (!eventRowsError && eventRows) {
                    eventRows.forEach((row) => {
                        eventNameById.set(row.id, row.name);
                    });
                }
            }

            posts.push(
                ...validPostRows.map((row) => ({
                    id: row.id,
                    caption: row.caption ?? '',
                    imageUrl: normalizeCaptureUrl(row.image_url),
                    createdAt: row.created_at,
                    visibility: row.visibility,
                    authorName: authorNameById.get(row.user_id) ?? 'User',
                    eventName: row.event_id ? eventNameById.get(row.event_id) : undefined,
                })),
            );
        }
    } catch (error) {
        if (!isPermissionDeniedError(error) && !isMissingTableError(error, 'posts')) {
            throw toAppError(error);
        }
    }

    if (isDateLike) {
        try {
            if (isVisitor) {
                const { data: rows, error } = await supabase
                    .from('posts')
                    .select('created_at')
                    .eq('visibility', 'visitor')
                    .order('created_at', { ascending: false })
                    .limit(500)
                    .returns<Array<{ created_at: string }>>();
                if (error) throw error;

                const buckets = (rows ?? []).reduce<Record<string, number>>((acc, row) => {
                    const key = getUtcDateKey(row.created_at);
                    if (!key) return acc;
                    acc[key] = (acc[key] ?? 0) + 1;
                    return acc;
                }, {});

                Object.entries(buckets)
                    .sort((a, b) => b[0].localeCompare(a[0]))
                    .forEach(([dateKey, count]) => {
                        const label = formatDateLabelFromKey(dateKey);
                        if (!dateKey.toLowerCase().includes(termLower) && !label.toLowerCase().includes(termLower)) {
                            return;
                        }
                        dates.push({
                            date: dateKey,
                            label,
                            count,
                        });
                    });
            } else {
                const dateFolders = await fetchDateFolderCounts();
                dateFolders
                    .filter((folder) => {
                        return (
                            folder.date.toLowerCase().includes(termLower) ||
                            folder.label.toLowerCase().includes(termLower)
                        );
                    })
                    .forEach((folder) => {
                        dates.push({
                            date: folder.date,
                            label: folder.label,
                            count: folder.count,
                        });
                    });
            }
        } catch (error) {
            if (!isPermissionDeniedError(error)) {
                throw toAppError(error);
            }
        }
    }

    return {
        users: users.slice(0, safeLimit),
        events: events.slice(0, safeLimit),
        dates: dates.slice(0, safeLimit),
        posts: posts.slice(0, safeLimit),
    };
}

export async function fetchAdminStats() {
    const [users, posts, reviews] = await Promise.all([
        fetchUsers(),
        fetchPosts(),
        fetchReviews(),
    ]);
    const visitorPosts = posts.filter((post) => post.visibility === 'visitor').length;
    const campusPosts = posts.length - visitorPosts;
    const approvedReviews = reviews.filter((review) => review.status === 'approved').length;
    return {
        totalUsers: users.length,
        campusPosts,
        visitorPosts,
        approvedReviews,
    };
}

export async function createReview(input: { reviewText: string }): Promise<void> {
    const supabase = getSupabase();
    const [user, profile] = await Promise.all([
        getSessionUser(),
        getCurrentUserProfile(),
    ]);
    if (!user) throw new Error('You must be logged in.');
    if (profile?.role !== 'visitor') {
        throw new Error('Only visitors can submit feedback.');
    }
    const cleaned = input.reviewText.trim();
    if (!cleaned) throw new Error('Feedback cannot be empty.');

    const { error } = await supabase.from('reviews').insert({
        visitor_id: user.id,
        rating: 3,
        review_text: cleaned,
        status: 'approved',
    });
    if (error) throw toAppError(error);
}

async function requireAdminSession(): Promise<{ supabase: SupabaseClient; userId: string }> {
    const supabase = getSupabase();
    const [user, profile] = await Promise.all([
        getSessionUser(),
        getCurrentUserProfile(),
    ]);
    if (!user) throw new Error('You must be logged in.');
    if (profile?.role !== 'admin') {
        throw new Error('Admin access required.');
    }
    return { supabase, userId: user.id };
}

async function deleteContentTargetWithClient(
    supabase: SupabaseClient,
    targetType: ReportTargetType,
    targetId: string,
): Promise<void> {
    if (!UUID_PATTERN.test(targetId)) {
        throw new Error('Invalid target id.');
    }

    if (targetType === 'feed_post') {
        const { error } = await supabase.from('posts').delete().eq('id', targetId);
        if (error) throw toAppError(error);
        return;
    }
    if (targetType === 'feed_comment') {
        const { error } = await supabase.from('comments').delete().eq('id', targetId);
        if (error) throw toAppError(error);
        return;
    }
    if (targetType === 'freedom_post') {
        const { error } = await supabase.from('freedom_wall_posts').delete().eq('id', targetId);
        if (error) throw toAppError(error);
        return;
    }
    if (targetType === 'freedom_comment') {
        const { error } = await supabase.from('freedom_wall_comments').delete().eq('id', targetId);
        if (error) throw toAppError(error);
        return;
    }
    if (targetType === 'incognito_post') {
        const { error } = await supabase.from('incognito_posts').delete().eq('id', targetId);
        if (error) throw toAppError(error);
        return;
    }
    const { error } = await supabase.from('incognito_comments').delete().eq('id', targetId);
    if (error) throw toAppError(error);
}

export async function adminDeleteContentTarget(input: {
    targetType: ReportTargetType;
    targetId: string;
}): Promise<void> {
    const { supabase } = await requireAdminSession();
    await deleteContentTargetWithClient(supabase, input.targetType, input.targetId);
}

export async function deleteReview(reviewId: string): Promise<void> {
    if (!UUID_PATTERN.test(reviewId)) {
        throw new Error('Invalid review id.');
    }
    const { supabase } = await requireAdminSession();
    const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
    if (error) throw toAppError(error);
}

export async function deleteAllReviews(): Promise<number> {
    const { supabase } = await requireAdminSession();
    const { data, error } = await supabase
        .from('reviews')
        .delete()
        .not('id', 'is', null)
        .select('id');
    if (error) throw toAppError(error);
    return (data ?? []).length;
}

export async function createContentReport(input: {
    targetType: ReportTargetType;
    targetId: string;
    reason?: string;
    details?: string;
}): Promise<void> {
    if (!UUID_PATTERN.test(input.targetId)) {
        throw new Error('Invalid report target id.');
    }

    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');

    const reason = input.reason?.trim() || 'Reported content';
    const details = input.details?.trim() || null;

    const { error } = await supabase.from('content_reports').insert({
        reporter_user_id: user.id,
        target_type: input.targetType,
        target_id: input.targetId,
        reason,
        details,
    });
    if (error) {
        if (isMissingContentReportsTableError(error)) {
            throw new Error(
                "Database migration required: missing 'content_reports' table. Run 'supabase/reporting-and-moderation.sql' and retry.",
            );
        }
        if (isUniqueViolationError(error)) {
            throw new Error('You already reported this content.');
        }
        throw toAppError(error);
    }
}

export async function fetchContentReports(input: {
    status?: ReportStatus | 'all';
    limit?: number;
} = {}): Promise<ContentReport[]> {
    const { supabase } = await requireAdminSession();
    const safeLimit = Math.max(1, Math.min(input.limit ?? 200, 500));

    let query = supabase
        .from('content_reports')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(safeLimit);

    if (input.status && input.status !== 'all') {
        query = query.eq('status', input.status);
    }

    const { data: rows, error } = await query.returns<DbContentReport[]>();
    if (error) {
        if (isMissingContentReportsTableError(error)) {
            throw new Error(
                "Database migration required: missing 'content_reports' table. Run 'supabase/reporting-and-moderation.sql' and retry.",
            );
        }
        throw toAppError(error);
    }
    if (!rows || rows.length === 0) return [];

    const userIds = [
        ...new Set(
            rows
                .flatMap((row) => [row.reporter_user_id, row.reviewed_by])
                .filter((value): value is string => Boolean(value)),
        ),
    ];
    const nameByUserId = new Map<string, string>();
    if (userIds.length > 0) {
        const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id,name')
            .in('id', userIds)
            .returns<Array<{ id: string; name: string }>>();
        if (usersError) throw toAppError(usersError);
        (users ?? []).forEach((row) => {
            nameByUserId.set(row.id, row.name);
        });
    }

    const feedCommentTargetIds = [
        ...new Set(
            rows
                .filter((row) => row.target_type === 'feed_comment')
                .map((row) => row.target_id),
        ),
    ];
    const freedomCommentTargetIds = [
        ...new Set(
            rows
                .filter((row) => row.target_type === 'freedom_comment')
                .map((row) => row.target_id),
        ),
    ];
    const incognitoCommentTargetIds = [
        ...new Set(
            rows
                .filter((row) => row.target_type === 'incognito_comment')
                .map((row) => row.target_id),
        ),
    ];

    const feedCommentPostIdByCommentId = new Map<string, string>();
    const freedomCommentPostIdByCommentId = new Map<string, string>();
    const incognitoCommentPostIdByCommentId = new Map<string, string>();

    if (feedCommentTargetIds.length > 0) {
        const { data: feedCommentRows, error: feedCommentRowsError } =
            await supabase
                .from('comments')
                .select('id,post_id')
                .in('id', feedCommentTargetIds)
                .returns<Array<{ id: string; post_id: string }>>();
        if (feedCommentRowsError) throw toAppError(feedCommentRowsError);
        (feedCommentRows ?? []).forEach((row) => {
            feedCommentPostIdByCommentId.set(row.id, row.post_id);
        });
    }

    if (freedomCommentTargetIds.length > 0) {
        const { data: freedomCommentRows, error: freedomCommentRowsError } =
            await supabase
                .from('freedom_wall_comments')
                .select('id,post_id')
                .in('id', freedomCommentTargetIds)
                .returns<Array<{ id: string; post_id: string }>>();
        if (freedomCommentRowsError) throw toAppError(freedomCommentRowsError);
        (freedomCommentRows ?? []).forEach((row) => {
            freedomCommentPostIdByCommentId.set(row.id, row.post_id);
        });
    }

    if (incognitoCommentTargetIds.length > 0) {
        const {
            data: incognitoCommentRows,
            error: incognitoCommentRowsError,
        } = await supabase
            .from('incognito_comments')
            .select('id,post_id')
            .in('id', incognitoCommentTargetIds)
            .returns<Array<{ id: string; post_id: string }>>();
        if (incognitoCommentRowsError) throw toAppError(incognitoCommentRowsError);
        (incognitoCommentRows ?? []).forEach((row) => {
            incognitoCommentPostIdByCommentId.set(row.id, row.post_id);
        });
    }

    return rows.map((row) => {
        let targetPostId: string | undefined;
        if (
            row.target_type === 'feed_post' ||
            row.target_type === 'freedom_post' ||
            row.target_type === 'incognito_post'
        ) {
            targetPostId = row.target_id;
        } else if (row.target_type === 'feed_comment') {
            targetPostId = feedCommentPostIdByCommentId.get(row.target_id);
        } else if (row.target_type === 'freedom_comment') {
            targetPostId = freedomCommentPostIdByCommentId.get(row.target_id);
        } else if (row.target_type === 'incognito_comment') {
            targetPostId = incognitoCommentPostIdByCommentId.get(row.target_id);
        }

        return {
            id: row.id,
            reporterUserId: row.reporter_user_id,
            reporterName: nameByUserId.get(row.reporter_user_id) ?? 'User',
            targetType: row.target_type,
            targetId: row.target_id,
            targetPostId,
            targetHref: buildReportTargetHref(
                row.target_type,
                row.target_id,
                targetPostId,
            ),
            reason: row.reason,
            details: row.details ?? '',
            status: row.status,
            reviewedBy: row.reviewed_by ?? undefined,
            reviewedByName: row.reviewed_by
                ? nameByUserId.get(row.reviewed_by) ?? 'Admin'
                : undefined,
            reviewedAt: row.reviewed_at ?? undefined,
            actionNote: row.action_note ?? undefined,
            createdAt: row.created_at,
        };
    });
}

export async function resolveContentReport(input: {
    reportId: string;
    action: 'decline' | 'delete_target';
    actionNote?: string;
}): Promise<void> {
    if (!UUID_PATTERN.test(input.reportId)) {
        throw new Error('Invalid report id.');
    }

    const { supabase, userId } = await requireAdminSession();
    const { data: report, error: reportError } = await supabase
        .from('content_reports')
        .select('*')
        .eq('id', input.reportId)
        .maybeSingle<DbContentReport>();
    if (reportError) throw toAppError(reportError);
    if (!report) {
        throw new Error('Report no longer exists.');
    }

    if (input.action === 'delete_target') {
        await deleteContentTargetWithClient(
            supabase,
            report.target_type,
            report.target_id,
        );
    }

    const { error: updateError } = await supabase
        .from('content_reports')
        .update({
            status: input.action === 'delete_target' ? 'resolved' : 'declined',
            reviewed_by: userId,
            reviewed_at: new Date().toISOString(),
            action_note: input.actionNote?.trim() || null,
        })
        .eq('id', input.reportId);
    if (updateError) throw toAppError(updateError);
}

export function subscribeToPosts(onChange: () => void): () => void {
    const supabase = getSupabase();
    const channel = supabase
        .channel('posts-realtime')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'post_images' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'likes' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, onChange)
        .subscribe();

    return () => {
        void supabase.removeChannel(channel);
    };
}

