import type { ReactNode } from 'react';

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    description: string;
    action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
    return (
        <section className='mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:mb-8 md:p-8'>
            <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
                <div className='space-y-2'>
                    {eyebrow ? (
                        <p className='text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700'>
                            {eyebrow}
                        </p>
                    ) : null}
                    <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>{title}</h1>
                    <p className='max-w-3xl text-sm text-slate-600 md:text-base'>{description}</p>
                </div>
                {action}
            </div>
        </section>
    );
}
