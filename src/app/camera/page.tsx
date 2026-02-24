import { AuthGuard } from '@/components/auth/auth-guard';
import { AppShell } from '@/components/layout/app-shell';
import { SingleCameraCapture } from '@/components/camera/single-camera';

export default function CameraPage() {
    return (
        <AuthGuard roles={['admin', 'member', 'visitor']}>
            <AppShell>
                <SingleCameraCapture />
            </AppShell>
        </AuthGuard>
    );
}
