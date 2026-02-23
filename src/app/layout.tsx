import type { Metadata } from 'next';
import { DM_Sans, Space_Grotesk } from 'next/font/google';
import { OfflineSync } from '@/components/system/offline-sync';
import './globals.css';

const bodyFont = DM_Sans({
    variable: '--font-body',
    subsets: ['latin'],
});

const headingFont = Space_Grotesk({
    variable: '--font-heading',
    subsets: ['latin'],
});

export const metadata: Metadata = {
    title: 'Campus Gallery',
    description: 'A camera-first real-time campus social platform.',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang='en' suppressHydrationWarning>
            <body
                suppressHydrationWarning
                className={`${bodyFont.variable} ${headingFont.variable} min-h-screen bg-slate-100 text-slate-900 antialiased transition-colors`}
            >
                <OfflineSync />
                {children}
            </body>
        </html>
    );
}
