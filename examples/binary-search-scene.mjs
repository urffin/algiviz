import { createSceneProjector, createSceneRenderer } from '@grundyjs/algiviz/scene';

export function binarySearchScene(state) {
    return { objects: state.values.map((value, index) => ({
        id: 'cell:' + index, type: 'cell',
        data: { index, value, count: state.values.length,
            active: index >= state.low && index <= state.high,
            mid: index === state.mid, candidate: index === state.candidate, found: index === state.result }
    })) };
}
export function binarySearchLayout(width, count) {
    const dense = count > 32;
    const capacity = Math.max(1, Math.floor((width - 24) / 62));
    const rows = dense ? 1 : Math.max(1, Math.ceil(count / capacity));
    const columns = dense ? count : Math.max(1, Math.ceil(count / rows));
    const pitch = (width - 24) / Math.max(1, columns);
    return { height: Math.max(130, 24 + rows * 90), labels: pitch >= 42,
        position(index) { return { x: 12 + index % columns * pitch, y: 16 + Math.floor(index / columns) * 90, width: Math.max(0.1, pitch - (dense ? Math.min(2, pitch * 0.15) : 6)) }; } };
}
export function createBinarySearchRenderer() {
    const project = createSceneProjector(binarySearchScene);
    let width = 960;
    const renderer = createSceneRenderer({
        cell(ctx, object) {
            const d = object.current?.data;
            if (!d) return;
            const layout = binarySearchLayout(width, d.count);
            const p = layout.position(d.index);
            ctx.fillStyle = d.found ? '#34d399' : d.mid ? '#fbbf24' : d.candidate ? '#67e8f9' : d.active ? '#a5b4fc' : '#334155';
            ctx.fillRect(p.x, p.y, p.width, 42);
            if (!layout.labels) return;
            ctx.fillStyle = d.active || d.mid || d.candidate || d.found ? '#111827' : '#cbd5e1';
            ctx.font = '14px Arial'; ctx.textAlign = 'center';
            const label = String(d.value);
            ctx.fillText(label.length > 6 ? label.slice(0, 4) + '…' : label, p.x + p.width / 2, p.y + 26, p.width - 8);
            ctx.fillStyle = '#cbd5e1'; ctx.font = '12px Arial';
            ctx.fillText(String(d.index), p.x + p.width / 2, p.y + 61);
            if (d.mid || d.candidate) ctx.fillText(d.mid ? 'mid' : '✓', p.x + p.width / 2, p.y + 78);
        }
    });
    return { render(ctx, frame, cssWidth = ctx.canvas.width) {
        width = cssWidth;
        const layout = binarySearchLayout(width, frame.current.values.length);
        ctx.fillStyle = '#111827'; ctx.fillRect(0, 0, width, layout.height);
        // Highlights change discretely: the scene and text describe the same step.
        const snapped = { ...frame, previous: frame.current, progress: 1 };
        renderer.render(ctx, project(snapped));
        if (!frame.current.values.length) {
            ctx.fillStyle = '#cbd5e1'; ctx.font = '14px Arial'; ctx.textAlign = 'center';
            ctx.fillText('Empty array', width / 2, 60);
        }
    } };
}
