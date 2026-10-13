function occurrenceLabel(index) {
    let label = '';
    for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26))
        label = String.fromCharCode(97 + ((n - 1) % 26)) + label;
    return label;
}
// Application-owned Quick sort example, adapted from grundyjs.ru (MIT).
import { createSceneRenderer } from '@grundyjs/algiviz/scene';
export function quickItemLabel(item, original) {
    if (!item) return '·';
    const equals = original.filter((other) => other.value === item.value);
    return (
        String(item.value) +
        (equals.length > 1 ? occurrenceLabel(equals.findIndex((other) => other.id === item.id)) : '')
    );
}
export function quickScene(state) {
    return {
        objects: state.main.map((item, index) => ({
            id: item.id,
            type: 'bar',
            data: {
                item,
                index,
                color: state.fixed.includes(index)
                    ? '#34d399'
                    : state.bands
                      ? index === state.bands.scan && index < state.bands.greater
                          ? '#fbbf24'
                          : !state.range || index < state.range.start || index >= state.range.end
                            ? '#818cf8'
                            : index < state.bands.less
                              ? '#60a5fa'
                              : index < state.bands.scan
                                ? '#c084fc'
                                : index >= state.bands.greater
                                  ? '#fb923c'
                                  : '#9ca3af'
                      : index === state.pivot
                        ? '#c084fc'
                        : index === state.scan
                          ? '#fbbf24'
                          : '#818cf8',
            },
        })),
    };
}
export function createQuickRenderer(en, original) {
    const renderer = createSceneRenderer({
        bar(ctx, object, frame) {
            const current = object.current.data;
            const previous = object.previous?.data ?? current;
            const pitch = (ctx.canvas.width - 32) / Math.max(1, original.length);
            const index = previous.index + (current.index - previous.index) * frame.progress;
            const max = Math.max(1, ...original.map((item) => Math.abs(item.value)));
            const height = (Math.abs(current.item.value) / max) * (ctx.canvas.height - 170);
            ctx.fillStyle = current.color;
            ctx.fillRect(
                16 + index * pitch + 2,
                ctx.canvas.height - 75 - height,
                Math.max(2, pitch - 4),
                Math.max(2, height),
            );
            ctx.fillStyle = '#f9fafb';
            ctx.font = Math.max(9, Math.min(17, pitch * 0.45)) + 'px Arial';
            ctx.textAlign = 'center';
            if (pitch >= 24)
                ctx.fillText(
                    quickItemLabel(current.item, original),
                    16 + (index + 0.5) * pitch,
                    ctx.canvas.height - 45,
                );
        },
    });
    return {
        render(ctx, frame) {
            const state = frame.current,
                width = ctx.canvas.width,
                height = ctx.canvas.height,
                pitch = (width - 32) / Math.max(1, original.length);
            ctx.fillStyle = '#111827';
            ctx.fillRect(0, 0, width, height);
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f9fafb';
            ctx.textAlign = 'left';
            ctx.fillText(en ? 'Quick sort' : 'Быстрая сортировка', 16, 25);
            if (state.range) {
                ctx.strokeStyle = '#818cf8';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    16 + state.range.start * pitch,
                    70,
                    (state.range.end - state.range.start) * pitch,
                    height - 140,
                );
            }
            renderer.render(ctx, { ...frame, previous: quickScene(frame.previous), current: quickScene(state) });
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            for (let i = 0; pitch >= 20 && i < original.length; i++) {
                ctx.fillStyle = '#9ca3af';
                ctx.fillText(String(i), 16 + (i + 0.5) * pitch, height - 22);
            }
            if (state.bands) {
                ctx.fillStyle = '#c084fc';
                ctx.textAlign = 'left';
                ctx.fillText((en ? 'Pivot value: ' : 'Опорное значение: ') + state.bands.value, 16, 42);
            }
            for (const [position, text, color, y] of state.bands
                ? [
                      [state.bands.less, 'lt', '#60a5fa', 56],
                      [state.bands.scan, 'i', '#fbbf24', 72],
                      [state.bands.greater, 'gt', '#fb923c', 88],
                  ]
                : [
                      [state.boundary, 'i', '#22d3ee', 48],
                      [state.scan, 'j', '#fbbf24', 64],
                      [state.pivot, 'p', '#c084fc', 80],
                  ]) {
                if (position !== null) {
                    ctx.fillStyle = color;
                    ctx.fillText('↓ ' + text, Math.min(width - 16, 16 + (position + 0.5) * pitch), y);
                }
            }
        },
    };
}
