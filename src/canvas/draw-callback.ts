/** Isolate temporary Canvas state and scope the drawing helpers to this call. */
export function withDrawCallback(ctx: CanvasRenderingContext2D, draw: (assertActive: () => void) => void): void {
    ctx.save();
    let active = true;
    let failed = false, primary: unknown;
    try {
        ctx.beginPath();
        draw(() => {
            if (!active) throw new Error("Canvas drawing helpers can only be used during their callback");
        });
    } catch (error) {
        failed = true;
        primary = error;
    }
    active = false;
    try { ctx.restore(); } catch (error) { if (!failed) throw error; }
    if (failed) throw primary;
}
