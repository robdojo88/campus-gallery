import type { Metadata } from 'next';
import { DM_Sans, Space_Grotesk } from 'next/font/google';
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
    title: 'Ripple',
    description: 'A camera-first real-time social platform.',
    icons: {
        icon: [
            {
                media: '(prefers-color-scheme: dark)',
                url: '/favicon.ico',
            },
            {
                media: '(prefers-color-scheme: light)',
                url: '/favicon_.ico',
            },
        ],
        shortcut: [
            {
                media: '(prefers-color-scheme: dark)',
                url: '/favicon.ico',
            },
            {
                media: '(prefers-color-scheme: light)',
                url: '/favicon_.ico',
            },
        ],
    },
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
                {children}
            </body>
        </html>
    );
}
