import { MultiCameraCapture } from '@/components/camera/multi-camera';
import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/ui/page-header';

export default function MultiCameraPage() {
    return (
        <AuthGuard roles={['admin', 'member', 'visitor']}>
            <AppShell>
                <div className='hidden lg:block'>
                    <PageHeader
                        eyebrow='Batch Mode'
                        title='Multi-Capture Upload'
                        description='Capture multiple images, preview them in a grid, and upload all together with no partial completion.'
                    />
                </div>
                <MultiCameraCapture />
            </AppShell>
        </AuthGuard>
    );
}
