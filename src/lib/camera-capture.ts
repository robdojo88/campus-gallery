'use client';

type ImageCaptureLike = {
    takePhoto: () => Promise<Blob>;
};

type ImageCaptureCtor = new (track: MediaStreamTrack) => ImageCaptureLike;

function getImageCaptureConstructor(): ImageCaptureCtor | null {
    const maybe = (window as Window & { ImageCapture?: ImageCaptureCtor }).ImageCapture;
    return typeof maybe === 'function' ? maybe : null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                resolve(reader.result);
            } else {
                reject(new Error('Failed to read captured image.'));
            }
        };
        reader.onerror = () => reject(reader.error ?? new Error('Failed to read captured image.'));
        reader.readAsDataURL(blob);
    });
}

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
    const stream = videoElement.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    const ImageCapture = getImageCaptureConstructor();

    if (track && ImageCapture) {
        try {
            const imageCapture = new ImageCapture(track);
            const photoBlob = await imageCapture.takePhoto();
            return await blobToDataUrl(photoBlob);
        } catch {
            // Fallback to canvas capture.
        }
    }

    if (!videoElement.videoWidth || !videoElement.videoHeight) {
        throw new Error('Camera frame not ready yet. Try again.');
    }

    canvasElement.width = videoElement.videoWidth;
    canvasElement.height = videoElement.videoHeight;
    const ctx = canvasElement.getContext('2d');
    if (!ctx) throw new Error('Cannot access capture context.');

    ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);
    // PNG fallback avoids extra lossy JPEG compression at capture time.
    return canvasElement.toDataURL('image/png');
}
