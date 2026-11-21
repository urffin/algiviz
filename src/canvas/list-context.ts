/** Restore every acquired save, preserving even falsy primary exceptions. */
export function saved(ctx: CanvasRenderingContext2D, run: () => void): void {
    ctx.save();
    let failed = false, primary: unknown;
    try { run(); } catch (error) { failed = true; primary = error; }
    try { ctx.restore(); } catch (error) { if (!failed) { failed = true; primary = error; } }
    if (failed) throw primary;
}
export function setup(ctx: CanvasRenderingContext2D, sx: number, sy: number): void {
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over"; ctx.filter = "none";
    ctx.shadowColor = "rgba(0, 0, 0, 0)"; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    ctx.setLineDash([]); ctx.lineDashOffset = 0; ctx.lineCap = "round"; ctx.lineJoin = "round"; ctx.miterLimit = 10;
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.direction = "ltr"; ctx.font = "12px sans-serif";
    if ("fontKerning" in ctx) ctx.fontKerning = "none";
    if ("fontStretch" in ctx) ctx.fontStretch = "normal";
    if ("fontVariantCaps" in ctx) ctx.fontVariantCaps = "normal";
    if ("letterSpacing" in ctx) ctx.letterSpacing = "0px";
    if ("wordSpacing" in ctx) ctx.wordSpacing = "0px";
    if ("textRendering" in ctx) ctx.textRendering = "auto";
}
