'use client';
import type { ReactNode } from 'react';
import { Card, CardBody, Chip } from '@heroui/react';

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    description: string;
    action?: ReactNode;
}

export function PageHeader({
    eyebrow,
    title,
    description,
    action,
}: PageHeaderProps) {
    return (
        <Card className='relative mb-5 overflow-hidden rounded-[30px] border border-white/75 bg-gradient-to-br from-white/92 via-white/84 to-slate-100/74 shadow-[0_30px_75px_-45px_rgba(15,23,42,0.62)] backdrop-blur-xl md:mb-6'>
            <div className='pointer-events-none absolute -left-10 -top-10 h-24 w-24 rounded-full bg-sky-200/35 blur-2xl' />
            <div className='pointer-events-none absolute -bottom-12 right-0 h-24 w-24 rounded-full bg-slate-300/25 blur-2xl' />
            <CardBody className='px-5 py-5 md:px-7 md:py-6'>
                <div className='relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
                    <div className='space-y-2.5'>
                        {eyebrow ? (
                            <Chip
                                size='sm'
                                variant='flat'
                                className='rounded-full border border-white/70 bg-white/75 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600'
                            >
                                {eyebrow}
                            </Chip>
                        ) : null}
                        <h1 className='text-2xl font-semibold tracking-tight text-slate-900 md:text-3xl'>
                            {title}
                        </h1>
                        <p className='max-w-3xl text-sm leading-6 text-slate-600 md:text-base'>
                            {description}
                        </p>
                    </div>
                    {action ? <div className='shrink-0'>{action}</div> : null}
                </div>
            </CardBody>
        </Card>
    );
}
