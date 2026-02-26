'use client';

const CAPTURE_JPEG_QUALITY = 1;

export async function getHighResolutionStream(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 4096 },
            height: { ideal: 2160 },
        },
        audio: false,
    });

    const track = stream.getVideoTracks()[0];
    if (track && typeof track.getCapabilities === 'function') {
        try {
            const capabilities = track.getCapabilities();
            const widthMax = capabilities.width?.max;
            const heightMax = capabilities.height?.max;
            if (widthMax && heightMax) {
                await track.applyConstraints({
                    width: { ideal: widthMax },
                    height: { ideal: heightMax },
                });
            }
        } catch {
            // Best-effort only. If constraints fail, keep current stream settings.
        }
    }

    return stream;
}

export async function captureFrameAsDataUrl(
    videoElement: HTMLVideoElement,
    canvasElement: HTMLCanvasElement,
): Promise<string> {
    if (!videoElement.videoWidth || !videoElement.videoHeight) {
        throw new Error('Camera frame not ready yet. Try again.');
    }

    const sourceWidth = videoElement.videoWidth;
    const sourceHeight = videoElement.videoHeight;
    const targetWidth = sourceWidth;
    const targetHeight = sourceHeight;

    canvasElement.width = targetWidth;
    canvasElement.height = targetHeight;
    const ctx = canvasElement.getContext('2d');
    if (!ctx) throw new Error('Cannot access capture context.');

    ctx.drawImage(videoElement, 0, 0, targetWidth, targetHeight);
    return canvasElement.toDataURL('image/jpeg', CAPTURE_JPEG_QUALITY);
}
