import type { ReactNode } from 'react';
import { Card, CardBody, Chip } from '@heroui/react';

interface PageHeaderProps {
    eyebrow?: string;
    title: string;
    description: string;
    action?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, action }: PageHeaderProps) {
    return (
        <Card className='mb-5 border border-slate-200/90 bg-white/95 shadow-sm backdrop-blur md:mb-6'>
            <CardBody className='px-5 py-5 md:px-7 md:py-6'>
                <div className='flex flex-col gap-4 md:flex-row md:items-end md:justify-between'>
                    <div className='space-y-2'>
                        {eyebrow ? (
                            <Chip
                                size='sm'
                                variant='flat'
                                className='bg-blue-100 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-700'
                            >
                                {eyebrow}
                            </Chip>
                        ) : null}
                        <h1 className='text-2xl font-bold tracking-tight text-slate-900 md:text-3xl'>
                            {title}
                        </h1>
                        <p className='max-w-3xl text-sm text-slate-600 md:text-base'>
                            {description}
                        </p>
                    </div>
                    {action}
                </div>
            </CardBody>
        </Card>
    );
}
