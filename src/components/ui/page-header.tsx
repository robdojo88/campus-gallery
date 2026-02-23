import type { ReactNode } from 'react';

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    description: string;
    action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
    return (
        <section className='mb-5 rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm md:mb-6 md:px-7 md:py-6'>
            <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
                <div className='space-y-2'>
                    {eyebrow ? (
                        <p className='text-xs font-semibold uppercase tracking-[0.18em] text-blue-700'>
                            {eyebrow}
                        </p>
                    ) : null}
                    <h1 className='text-2xl font-bold tracking-tight text-slate-900 md:text-3xl'>{title}</h1>
                    <p className='max-w-3xl text-sm text-slate-600 md:text-base'>{description}</p>
                </div>
                {action}
            </div>
        </section>
    );
}
