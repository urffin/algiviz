import { createCanvasViewport, type CanvasViewport, type CanvasViewportOptions, type CanvasViewportSize } from '@grundyjs/algiviz/canvas/viewport';

if (typeof createCanvasViewport !== 'function') throw new Error('Viewport entry must import without DOM globals');
export type PublicViewportTypes = [CanvasViewport, CanvasViewportOptions, CanvasViewportSize];

// Compiled against the installed declarations; construction needs a browser.
export function checkViewportTypes(canvas: HTMLCanvasElement) {
    const options: CanvasViewportOptions = { onResize() {}, maxPixelRatio: undefined };
    const viewport: CanvasViewport = createCanvasViewport(canvas, options);
    const context: CanvasRenderingContext2D = viewport.context;
    const size: CanvasViewportSize | null = viewport.resize(width => {
        const cssWidth: number = width;
        return cssWidth / 2;
    });
    if (size) {
        const metrics: readonly number[] = [size.width, size.height, size.bitmapWidth, size.bitmapHeight, size.pixelRatio];
        // @ts-expect-error Sizing results are read-only.
        size.width = 10;
        void metrics;
    }
    // @ts-expect-error Context identity is read-only.
    viewport.context = context;
    // @ts-expect-error Notification is required.
    createCanvasViewport(canvas, {});
    // @ts-expect-error Options cannot be omitted.
    createCanvasViewport(canvas);
    // @ts-expect-error Only a DOM canvas can supply the owner window and style/layout.
    createCanvasViewport({}, options);
    // @ts-expect-error Layout returns a numeric content height.
    viewport.resize(width => String(width));
    viewport.dispose();
}
