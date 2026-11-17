/** Canvas state/command host for geometry tests; native tests cover actual rasterization. */
export function recording(width = 640, height = 400) {
    const commands = [], stack = [];
    const state = { transform: [3, 0, 0, 4, 5, 6], dash: [7, 3], globalAlpha: .37, globalCompositeOperation: 'xor',
        filter: 'blur(2px)', shadowColor: 'red', shadowBlur: 8, shadowOffsetX: 2, shadowOffsetY: 3,
        fillStyle: 'pink', strokeStyle: 'blue', lineWidth: 7, lineDashOffset: 5, lineCap: 'square', lineJoin: 'bevel', miterLimit: 2,
        font: 'italic 30px serif', textAlign: 'right', textBaseline: 'top', direction: 'rtl', fontKerning: 'normal',
        fontStretch: 'expanded', fontVariantCaps: 'small-caps', letterSpacing: '3px', wordSpacing: '2px', textRendering: 'optimizeLegibility' };
    const target = { canvas: { width, height } };
    function call(name, args) {
        commands.push({ name, args, state: structuredClone(state) });
        if (name === 'save') stack.push(structuredClone(state));
        else if (name === 'restore') {
            const saved = stack.pop();
            if (!saved) throw Error('Unbalanced restore');
            for (const key of Object.keys(state)) delete state[key]; Object.assign(state, saved);
        } else if (name === 'setTransform') state.transform = args;
        else if (name === 'setLineDash') state.dash = [...args[0]];
    }
    const ctx = new Proxy(target, {
        get(object, key) { if (key === 'measureText') return text => {
            call('measureText', [text]); const width = [...text].length * 6;
            return { width, actualBoundingBoxLeft: width / 2, actualBoundingBoxRight: width / 2, actualBoundingBoxAscent: 6, actualBoundingBoxDescent: 6 };
        }; if (key in object) return object[key]; if (key in state) return state[key]; return (...args) => call(key, args); },
        set(_object, key, value) { state[key] = value; return true; },
        has(object, key) { return key in object || key in state; }
    });
    return { ctx, commands, state, stack, calls: name => commands.filter(command => command.name === name) };
}
