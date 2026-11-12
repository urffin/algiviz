// Local prototype, not a package export. The host must set a CSS width that is
// independent of the bitmap width and leave CSS height under this helper's control.
export function createCanvasViewport(canvas, { onResize, maxPixelRatio = Infinity } = {}) {
    const view = canvas?.ownerDocument?.defaultView;
    if (!view || typeof canvas.getContext !== 'function') throw new TypeError('Expected a DOM canvas');
    if (typeof onResize !== 'function') throw new TypeError('Expected an onResize callback');
    if (typeof maxPixelRatio !== 'number' || !(maxPixelRatio > 0)) throw new RangeError('Pixel ratio cap must be positive');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable');
    let disposed = false, request = null, last = null, media = null, watchedRatio;
    const deviceRatio = () => Number.isFinite(view.devicePixelRatio) && view.devicePixelRatio > 0 ? view.devicePixelRatio : 1;
    const pixels = value => Number.parseFloat(value) || 0;
    function measure() {
        const style = view.getComputedStyle(canvas);
        const insetX = pixels(style.borderLeftWidth) + pixels(style.borderRightWidth) + pixels(style.paddingLeft) + pixels(style.paddingRight);
        const insetY = pixels(style.borderTopWidth) + pixels(style.borderBottomWidth) + pixels(style.paddingTop) + pixels(style.paddingBottom);
        const borderBox = style.boxSizing === 'border-box';
        const width = canvas.getClientRects().length && style.width.endsWith('px')
            ? Math.max(0, pixels(style.width) - (borderBox ? insetX : 0)) : 0;
        return { width, insetY: borderBox ? insetY : 0, pixelRatio: Math.min(deviceRatio(), maxPixelRatio) };
    }
    const equal = (a, b) => a && b && a.width === b.width && a.insetY === b.insetY && a.pixelRatio === b.pixelRatio;
    function watchRatio() {
        const ratio = deviceRatio();
        if (ratio === watchedRatio) return;
        media?.removeEventListener('change', schedule);
        media = view.matchMedia(`(resolution: ${ratio}dppx)`);
        media.addEventListener('change', schedule);
        watchedRatio = ratio;
    }
    function schedule() {
        if (disposed || request !== null) return;
        request = view.requestAnimationFrame(() => {
            request = null;
            if (disposed) return;
            watchRatio();
            const next = measure();
            if (equal(last, next)) return;
            last = next;
            onResize();
        });
    }
    const observer = new view.ResizeObserver(schedule);
    function dispose() {
        if (disposed) return;
        disposed = true;
        if (request !== null) view.cancelAnimationFrame(request);
        request = null;
        observer.disconnect();
        media?.removeEventListener('change', schedule);
        view.removeEventListener('resize', schedule);
    }
    try {
        observer.observe(canvas);
        view.addEventListener('resize', schedule);
        watchRatio();
    } catch (error) { try { dispose(); } catch {} throw error; }
    return Object.freeze({
        context,
        resize(heightForWidth) {
            if (disposed) throw new Error('Canvas viewport is disposed');
            if (typeof heightForWidth !== 'function') throw new TypeError('Expected a height function');
            const measured = measure(), { width, pixelRatio } = measured;
            if (!(width > 0)) { last = measured; return null; }
            const height = heightForWidth(width);
            if (disposed) throw new Error('Canvas viewport was disposed during measurement');
            if (!Number.isFinite(height) || height <= 0) throw new RangeError('Canvas height must be positive and finite');
            const bitmapWidth = Math.max(1, Math.round(width * pixelRatio));
            const bitmapHeight = Math.max(1, Math.round(height * pixelRatio));
            const cssHeight = height + measured.insetY;
            if (![bitmapWidth, bitmapHeight].every(value => Number.isSafeInteger(value) && value <= 0xffffffff) || !Number.isFinite(cssHeight))
                throw new RangeError('Canvas bitmap dimensions exceed the supported numeric range');
            if (canvas.style.height !== `${cssHeight}px`) canvas.style.height = `${cssHeight}px`;
            if (canvas.width !== bitmapWidth) canvas.width = bitmapWidth;
            if (canvas.height !== bitmapHeight) canvas.height = bitmapHeight;
            context.setTransform(bitmapWidth / width, 0, 0, bitmapHeight / height, 0, 0);
            last = measured;
            return Object.freeze({ width, height, bitmapWidth, bitmapHeight, pixelRatio });
        },
        dispose,
    });
}
