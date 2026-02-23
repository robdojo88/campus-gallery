'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import type { OfflineCapture, Post, PostComment, Review, UserRole, Visibility } from '@/lib/types';

type DbUser = {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatar_url: string | null;
    created_at: string;
};

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

type DbLike = { post_id: string };
type DbComment = { post_id: string };
type DbCommentRow = {
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    created_at: string;
};

type DbFreedomPost = {
    id: string;
    user_id: string;
    content: string;
    image_url: string | null;
    created_at: string;
};

type DbIncognitoPost = {
    id: string;
    user_id: string;
    content: string;
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let browserClient: SupabaseClient | null = null;
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

function mapUser(dbUser: DbUser) {
    return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
        avatarUrl: dbUser.avatar_url ?? '',
        createdAt: dbUser.created_at,
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

function mapPosts(
    rawPosts: DbPost[],
    users: DbUser[],
    likes: DbLike[],
    comments: DbComment[],
    postImages: DbPostImage[],
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
    if (sessionError) throw toAppError(sessionError);
    if (sessionData.session?.user) return sessionData.session.user;

    const { data, error } = await supabase.auth.getUser();
    if (error) {
        if (error.name === 'AuthSessionMissingError') return null;
        if (error.message.toLowerCase().includes('auth session missing')) return null;
        throw toAppError(error);
    }
    return data.user ?? null;
}

export async function getCurrentUserProfile() {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) return null;

    const { data, error } = await supabase.from('users').select('*').eq('id', user.id).maybeSingle<DbUser>();
    if (error) throw toAppError(error);
    return data ? mapUser(data) : null;
}

export async function ensureUserProfile(user: User): Promise<void> {
    const supabase = getSupabase();
    const metadataName = typeof user.user_metadata?.name === 'string' ? user.user_metadata.name : '';
    const metadataRole =
        user.user_metadata?.role === 'admin' || user.user_metadata?.role === 'member' || user.user_metadata?.role === 'visitor'
            ? user.user_metadata.role
            : 'member';

    const { error } = await supabase.from('users').upsert({
        id: user.id,
        email: user.email ?? '',
        name: metadataName || user.email?.split('@')[0] || 'Campus User',
        role: metadataRole,
    });
    if (error) throw toAppError(error);
}

export async function signUpWithEmail(input: {
    name: string;
    email: string;
    password: string;
    role: 'member' | 'visitor';
}) {
    const supabase = getSupabase();
    const email = normalizeEmail(input.email);
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
    const { data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
            data: {
                name: input.name,
                role: input.role,
            },
            emailRedirectTo: redirectTo,
        },
    });
    if (error) throw toAppError(error);
    if (data.user && data.session) {
        await ensureUserProfile(data.user);
    }
    return data;
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

export async function signInWithEmail(input: { email: string; password: string }) {
    const supabase = getSupabase();
    const email = normalizeEmail(input.email);
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password: input.password,
    });
    if (error) throw toAppError(error);
    if (data.user) await ensureUserProfile(data.user);
    return data;
}

export async function signInWithGoogle(): Promise<void> {
    const supabase = getSupabase();
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
    if (error) throw toAppError(error);
}

export async function signOutUser() {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw toAppError(error);
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

export async function fetchPosts(options?: { visibility?: Visibility }): Promise<Post[]> {
    const supabase = getSupabase();
    let query = supabase.from('posts').select('*').order('created_at', { ascending: false });
    if (options?.visibility) {
        query = query.eq('visibility', options.visibility);
    }

    const { data: rawPosts, error: postsError } = await query.returns<DbPost[]>();
    if (postsError) throw toAppError(postsError);
    if (!rawPosts || rawPosts.length === 0) return [];

    const postIds = rawPosts.map((post) => post.id);
    const userIds = [...new Set(rawPosts.map((post) => post.user_id))];

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

    return mapPosts(rawPosts, users ?? [], likes ?? [], comments ?? [], postImages ?? []);
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

export async function fetchDateFolderCounts(): Promise<Array<{ date: string; count: number }>> {
    const posts = await fetchPosts();
    const grouped = posts.reduce<Record<string, number>>((acc, post) => {
        const date = new Date(post.createdAt).toLocaleDateString();
        acc[date] = (acc[date] ?? 0) + 1;
        return acc;
    }, {});
    return Object.entries(grouped).map(([date, count]) => ({ date, count }));
}

export async function fetchUserProfile(userId: string) {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('users').select('*').eq('id', userId).single<DbUser>();
    if (error) throw toAppError(error);

    const userPosts = await fetchPosts();
    const postsByUser = userPosts.filter((post) => post.userId === userId);
    const totalLikes = postsByUser.reduce((sum, post) => sum + post.likes, 0);
    return {
        user: mapUser(data),
        posts: postsByUser,
        totalLikes,
    };
}

export async function fetchFreedomPosts(): Promise<
    Array<{ id: string; authorName: string; content: string; createdAt: string }>
> {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
        .from('freedom_wall_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .returns<DbFreedomPost[]>();
    if (error) throw toAppError(error);

    const userIds = [...new Set((rows ?? []).map((row) => row.user_id))];
    const { data: users, error: usersError } = await supabase.from('users').select('*').in('id', userIds).returns<DbUser[]>();
    if (usersError) throw toAppError(usersError);
    const names = new Map((users ?? []).map((user) => [user.id, user.name]));

    return (rows ?? []).map((row) => ({
        id: row.id,
        authorName: names.get(row.user_id) ?? 'Unknown',
        content: row.content,
        createdAt: row.created_at,
    }));
}

export async function createFreedomPost(content: string): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');
    const { error } = await supabase.from('freedom_wall_posts').insert({
        user_id: user.id,
        content,
    });
    if (error) throw toAppError(error);
}

export async function fetchIncognitoPosts(): Promise<
    Array<{ id: string; content: string; createdAt: string; authorId?: string }>
> {
    const supabase = getSupabase();
    const user = await getCurrentUserProfile();
    const isAdmin = user?.role === 'admin';

    const { data: rows, error } = await supabase
        .from('incognito_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .returns<DbIncognitoPost[]>();
    if (error) throw toAppError(error);

    return (rows ?? []).map((row) => ({
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        authorId: isAdmin ? row.user_id : undefined,
    }));
}

export async function createIncognitoPost(content: string): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');
    const { error } = await supabase.from('incognito_posts').insert({
        user_id: user.id,
        content,
    });
    if (error) throw toAppError(error);
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

export async function fetchPostComments(postId: string): Promise<PostComment[]> {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })
        .returns<DbCommentRow[]>();
    if (error) throw toAppError(error);
    if (!rows || rows.length === 0) return [];

    const userIds = [...new Set(rows.map((row) => row.user_id))];
    const { data: users, error: usersError } = await supabase.from('users').select('*').in('id', userIds).returns<DbUser[]>();
    if (usersError) throw toAppError(usersError);
    const names = new Map((users ?? []).map((user) => [user.id, user.name]));

    return rows.map((row) => ({
        id: row.id,
        postId: row.post_id,
        userId: row.user_id,
        content: row.content,
        createdAt: row.created_at,
        authorName: names.get(row.user_id) ?? 'User',
    }));
}

export async function addPostComment(postId: string, content: string): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');
    const cleaned = content.trim();
    if (!cleaned) throw new Error('Comment cannot be empty.');

    const { error } = await supabase.from('comments').insert({
        post_id: postId,
        user_id: user.id,
        content: cleaned,
    });
    if (error) throw toAppError(error);
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

export async function createReview(input: { rating: number; reviewText: string }): Promise<void> {
    const supabase = getSupabase();
    const user = await getSessionUser();
    if (!user) throw new Error('You must be logged in.');
    const { error } = await supabase.from('reviews').insert({
        visitor_id: user.id,
        rating: input.rating,
        review_text: input.reviewText,
    });
    if (error) throw toAppError(error);
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

