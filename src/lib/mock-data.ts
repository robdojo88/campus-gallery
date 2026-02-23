import type {
    EventFolder,
    FreedomPost,
    IncognitoPost,
    Post,
    Review,
    User,
    UserRole,
} from '@/lib/types';

export const currentUser: User = {
    id: 'u1',
    name: 'Rob Student',
    email: 'rob@student.campus.edu',
    role: 'member',
    avatarUrl:
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300&auto=format&fit=crop&q=60',
    createdAt: '2025-08-12T09:00:00.000Z',
};

export const users: User[] = [
    currentUser,
    {
        id: 'u2',
        name: 'Mila Admin',
        email: 'mila@campus.edu',
        role: 'admin',
        avatarUrl:
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300&auto=format&fit=crop&q=60',
        createdAt: '2024-01-03T09:00:00.000Z',
    },
    {
        id: 'u3',
        name: 'Visitor J.',
        email: 'visitor@example.com',
        role: 'visitor',
        avatarUrl:
            'https://images.unsplash.com/photo-1527980965255-d3b416303d12?w=300&auto=format&fit=crop&q=60',
        createdAt: '2026-02-10T09:00:00.000Z',
    },
];

export const eventFolders: EventFolder[] = [
    { id: 'e1', name: 'Graduation 2026', description: 'Batch moments and ceremony highlights' },
    { id: 'e2', name: 'Sports Fest', description: 'Athletics, team wins, and candid crowd shots' },
    { id: 'e3', name: 'Foundation Day', description: 'Campus legacy and celebration posts' },
];

export const posts: Post[] = [
    {
        id: 'p1',
        userId: 'u1',
        imageUrl:
            'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&auto=format&fit=crop&q=60',
        images: [
            'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1400&auto=format&fit=crop&q=60',
        ],
        caption: 'Campus lawn this morning.',
        visibility: 'campus',
        eventId: 'e3',
        likes: 42,
        comments: 6,
        createdAt: '2026-02-23T08:20:00.000Z',
    },
    {
        id: 'p2',
        userId: 'u1',
        imageUrl:
            'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=1400&auto=format&fit=crop&q=60',
        images: [
            'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=1400&auto=format&fit=crop&q=60',
        ],
        caption: 'Library evening lights.',
        visibility: 'campus',
        likes: 31,
        comments: 2,
        createdAt: '2026-02-22T16:40:00.000Z',
    },
    {
        id: 'p3',
        userId: 'u3',
        imageUrl:
            'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=1400&auto=format&fit=crop&q=60',
        images: [
            'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?w=1400&auto=format&fit=crop&q=60',
        ],
        caption: 'Great first visit!',
        visibility: 'visitor',
        likes: 17,
        comments: 4,
        createdAt: '2026-02-21T13:10:00.000Z',
    },
];

export const freedomPosts: FreedomPost[] = [
    {
        id: 'f1',
        authorId: 'u1',
        content: 'Open mic night was incredible. More events like this please.',
        likes: 15,
        comments: 3,
        createdAt: '2026-02-22T10:00:00.000Z',
    },
];

export const incognitoPosts: IncognitoPost[] = [
    {
        id: 'i1',
        authorId: 'u1',
        content: 'Anonymous note: thank you to the faculty mentors this semester.',
        likes: 23,
        comments: 7,
        createdAt: '2026-02-23T07:15:00.000Z',
    },
];

export const reviews: Review[] = [
    {
        id: 'r1',
        visitorId: 'u3',
        rating: 5,
        reviewText: 'Loved the campus atmosphere and gallery concept.',
        status: 'approved',
        createdAt: '2026-02-20T14:20:00.000Z',
    },
    {
        id: 'r2',
        visitorId: 'u3',
        rating: 4,
        reviewText: 'Smooth camera upload flow and clean design.',
        status: 'pending',
        createdAt: '2026-02-23T11:30:00.000Z',
    },
];

export const memberRoutes = [
    '/feed',
    '/camera',
    '/camera/multi',
    '/gallery/date',
    '/gallery/events',
    '/profile/u1',
    '/freedom-wall',
    '/incognito',
];

export const visitorRoutes = ['/visitor-gallery', '/reviews', '/camera'];

export const adminRoutes = [
    '/admin',
    '/admin/users',
    '/admin/uploads',
    '/admin/incognito',
    '/admin/reports',
    '/admin/analytics',
];

export function isAllowed(role: UserRole, pathname: string): boolean {
    if (role === 'admin') return true;
    if (role === 'member') return !pathname.startsWith('/admin');
    if (role === 'visitor') {
        return visitorRoutes.some((route) => pathname.startsWith(route)) || pathname === '/';
    }
    return false;
}

export function getUserById(id: string): User | undefined {
    return users.find((user) => user.id === id);
}
