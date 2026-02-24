export type UserRole = 'admin' | 'member' | 'visitor';

export type Visibility = 'campus' | 'visitor';

export interface User {
    id: string;
    name: string;
    email: string;
    usn?: string;
    isSuspended?: boolean;
    role: UserRole;
    avatarUrl: string;
    incognitoAlias?: string;
    createdAt: string;
}

export type StudentRegistryStatus = 'active' | 'inactive';

export interface StudentRegistryEntry {
    id: string;
    usn: string;
    firstName: string;
    lastName: string;
    fullName: string;
    course?: string;
    yearLevel?: number;
    email: string;
    status: StudentRegistryStatus;
    createdAt: string;
    updatedAt: string;
}

export interface StudentRegistryUpsertInput {
    usn: string;
    firstName: string;
    lastName: string;
    course?: string;
    yearLevel?: number;
    email: string;
    status?: StudentRegistryStatus;
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
    authorAvatarUrl?: string;
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
    likes: number;
    likedByCurrentUser: boolean;
    createdAt: string;
    authorName: string;
    authorAvatarUrl?: string;
}

export interface IncognitoPost {
    id: string;
    authorId: string;
    authorAlias?: string;
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
    parentId?: string;
    content: string;
    likes: number;
    likedByCurrentUser: boolean;
    createdAt: string;
    authorName: string;
    authorAvatarUrl?: string;
}

export type NotificationType =
    | 'feed_like'
    | 'feed_comment'
    | 'freedom_like'
    | 'freedom_comment'
    | 'incognito_like'
    | 'incognito_comment'
    | 'event_created'
    | 'report_created'
    | 'system';

export interface AppNotification {
    id: string;
    recipientUserId: string;
    actorUserId?: string;
    actorName?: string;
    actorAvatarUrl?: string;
    type: NotificationType;
    title: string;
    body: string;
    data: Record<string, unknown>;
    readAt?: string;
    createdAt: string;
}

export interface SearchUserResult {
    id: string;
    name: string;
    email: string;
    usn?: string;
    role: UserRole;
    avatarUrl: string;
}

export interface SearchEventResult {
    id: string;
    name: string;
    description: string;
}

export interface SearchDateResult {
    date: string;
    label: string;
    count: number;
}

export interface SearchPostResult {
    id: string;
    caption: string;
    imageUrl: string;
    createdAt: string;
    visibility: Visibility;
    authorName: string;
    eventName?: string;
}

export interface GlobalSearchResults {
    users: SearchUserResult[];
    events: SearchEventResult[];
    dates: SearchDateResult[];
    posts: SearchPostResult[];
}

export type ReportTargetType =
    | 'feed_post'
    | 'feed_comment'
    | 'freedom_post'
    | 'freedom_comment'
    | 'incognito_post'
    | 'incognito_comment';

export type ReportStatus = 'open' | 'declined' | 'resolved';

export interface ContentReport {
    id: string;
    reporterUserId: string;
    reporterName: string;
    targetType: ReportTargetType;
    targetId: string;
    targetPostId?: string;
    targetHref?: string;
    reason: string;
    details: string;
    status: ReportStatus;
    reviewedBy?: string;
    reviewedByName?: string;
    reviewedAt?: string;
    actionNote?: string;
    createdAt: string;
}

