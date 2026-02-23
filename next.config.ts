import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'images.unsplash.com',
            },
            {
                protocol: 'https',
                hostname: 'ytkqwsnuvqdfxlyclrtm.supabase.co',
            },
            {
                protocol: 'https',
                hostname: '**.googleusercontent.com',
            },
        ],
    },
};

export default nextConfig;
