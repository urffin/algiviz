// Shared demo defaults; these are not library constraints.
export const timing = Object.freeze({ stepDurationMs: 650, finalHoldMs: 1000 });
export const limits = Object.freeze({ history: 64, generator: 2000 });
export function generateValues(count, order, mode) {
    if (!Number.isInteger(count) || count < 0 || count > limits[mode])
        throw new RangeError(`Size must be an integer from 0 to ${limits[mode]}.`);
    const values = Array.from({ length: count }, (_, i) => order === 'random' ? Math.floor(Math.random() * 100) + 1 : i + 1);
    return order === 'reverse' ? values.reverse() : values;
}
export function configureControls() {
    document.querySelector('#speed').innerHTML = [0.25, 0.5, 1, 2, 4, 8, 32]
        .map(value => `<option value="${value}"${value === 1 ? ' selected' : ''}>${value}×</option>`).join('');
    document.querySelector('#mode').innerHTML = '<option value="history">Full history · seeking</option><option value="generator">Generator · forward only</option>';
}
export function nextDelta(frame) {
    return timing.stepDurationMs * (frame.progress < 1 ? 1 - frame.progress : 1);
}
export function stepTime(time, direction, duration) {
    const step = direction < 0 ? Math.ceil(time / timing.stepDurationMs) - 1 : Math.floor(time / timing.stepDurationMs) + 1;
    return Math.max(0, Math.min(duration - timing.finalHoldMs, step * timing.stepDurationMs));
}
