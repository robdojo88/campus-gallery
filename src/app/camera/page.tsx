import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { SingleCameraCapture } from '@/components/camera/single-camera';
import { PageHeader } from '@/components/ui/page-header';
import Link from 'next/link';

export default function CameraPage() {
    return (
        <AuthGuard roles={['admin', 'member', 'visitor']}>
            <AppShell>
                <PageHeader
                    eyebrow='Camera First'
                    title='Capture Post'
                    description='Capture one or many images with live camera, then publish as a single Facebook-style post.'
                    action={
                        <Link
                            href='/camera/multi'
                            className='rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                        >
                            Open Batch Studio
                        </Link>
                    }
                />
                <SingleCameraCapture />
            </AppShell>
        </AuthGuard>
    );
}
