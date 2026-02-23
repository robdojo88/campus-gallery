export type UserRole = 'admin' | 'member' | 'visitor';

export type Visibility = 'campus' | 'visitor';

export interface User {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    avatarUrl: string;
    createdAt: string;
}

export interface EventFolder {
    id: string;
    name: string;
    description: string;
}

export interface Post {
    id: string;
    userId: string;
    imageUrl: string;
    images: string[];
    caption?: string;
    visibility: Visibility;
    eventId?: string;
    eventName?: string;
    likes: number;
    comments: number;
    createdAt: string;
    author?: User;
}

export interface FreedomPost {
    id: string;
    authorId: string;
    authorName?: string;
    content: string;
    imageUrl?: string;
    likes: number;
    comments: number;
    likedByCurrentUser?: boolean;
    createdAt: string;
}

export interface FreedomWallComment {
    id: string;
    postId: string;
    userId: string;
    parentId?: string;
    content: string;
    createdAt: string;
    authorName: string;
}

export interface IncognitoPost {
    id: string;
    authorId: string;
    content: string;
    likes: number;
    comments: number;
    createdAt: string;
}

export interface Review {
    id: string;
    visitorId: string;
    rating: number;
    reviewText: string;
    status: 'approved' | 'pending' | 'rejected';
    createdAt: string;
}

export interface OfflineCapture {
    id: string;
    imageDataUrl: string;
    caption?: string;
    visibility: Visibility;
    eventId?: string;
    createdAt: string;
}

export interface PostComment {
    id: string;
    postId: string;
    userId: string;
    content: string;
    createdAt: string;
    authorName: string;
}

export type NotificationType =
    | 'feed_like'
    | 'feed_comment'
    | 'freedom_like'
    | 'freedom_comment'
    | 'incognito_like'
    | 'incognito_comment'
    | 'event_created'
    | 'system';

export interface AppNotification {
    id: string;
    recipientUserId: string;
    actorUserId?: string;
    actorName?: string;
    type: NotificationType;
    title: string;
    body: string;
    data: Record<string, unknown>;
    readAt?: string;
    createdAt: string;
}
