import { createDemoPlayer } from './demo-player.mjs';
import { analyzeBoid, boidsTiming, boidsLimits, createBoidsSource } from './boids-algorithm.mjs';
import { createBoidsRenderer } from './boids-scene.mjs';

const $ = id => document.getElementById(id);
const canvas = $('flock'), context = canvas.getContext('2d'), renderer = createBoidsRenderer();
const ruleNames = ['separation', 'alignment', 'cohesion'];
let selectedId = 0, appliedCount = 0;
const decimals = value => (Math.abs(value) < 0.0005 ? 0 : value).toFixed(3);
const pair = value => `(${decimals(value.x)}, ${decimals(value.y)})`;
const playback = createDemoPlayer({
    timing: boidsTiming,
    isTerminal: step => step.event.kind === 'finished',
    onError: error => { $('error').textContent = error.message; },
    render(frame, { running, mode }) {
        const state = frame.current, inspect = $('inspect').checked;
        if (state.birds.length !== appliedCount) {
            appliedCount = state.birds.length;
            selectedId = Math.min(selectedId, appliedCount - 1);
            $('bird').replaceChildren(...state.birds.map(bird => {
                const option = document.createElement('option');
                option.value = String(bird.id); option.textContent = `Bird #${bird.id + 1}`; return option;
            }));
            $('bird').value = String(selectedId);
        }
        $('bird').disabled = !inspect;
        $('inspection').hidden = !inspect;
        $('stage').classList.toggle('inspecting', inspect);
        const width = Math.max(1, canvas.clientWidth), height = Math.max(240, width * 0.625);
        canvas.style.height = `${height}px`;
        const dpr = Math.min(devicePixelRatio || 1, 2), w = Math.round(width * dpr), h = Math.round(height * dpr);
        if (canvas.width !== w) canvas.width = w;
        if (canvas.height !== h) canvas.height = h;
        context.setTransform(canvas.width / width, 0, 0, canvas.height / height, 0, 0);
        const logical = new Proxy(context, {
            get(target, key) {
                if (key === 'canvas') return { width, height };
                const value = Reflect.get(target, key, target);
                return typeof value === 'function' ? value.bind(target) : value;
            },
            set: (target, key, value) => Reflect.set(target, key, value, target)
        });
        renderer.render(logical, frame, { inspect, selectedId });
        $('status').setAttribute('aria-live', running ? 'off' : 'polite');
        $('status').textContent = `Tick ${state.tick} / ${state.config.ticks}${frame.event.kind === 'finished' ? ' · run complete' : ''}${inspect ? ` · inspecting bird #${selectedId + 1}` : ''}`;
        $('count').max = String(boidsLimits[mode]);
        $('limit').textContent = `Example limits: ${boidsLimits.history} birds with history, ${boidsLimits.generator} with a generator; ${boidsLimits.ticks} ticks. Not library limits.`;
        $('applied').textContent = `Applied: ${state.birds.length} birds · seed ${state.config.seed} · ${state.config.obstacle} · rules: ${ruleNames.filter(key => state.config.rules[key]).join(', ') || 'none'}`;
        if (inspect) {
            const analysis = analyzeBoid(state, selectedId);
            $('inspection-title').textContent = `Bird #${selectedId + 1} · tick ${state.tick} → ${state.tick + 1}`;
            $('neighbor-summary').textContent = `${analysis.neighbors.length} neighbor${analysis.neighbors.length === 1 ? '' : 's'} · ${analysis.close.length} too close. IDs: ${analysis.neighbors.map(id => `#${id + 1}`).join(', ') || 'none'}.`;
            for (const key of [...ruleNames, 'obstacle', 'total', 'velocity', 'nextVelocity']) $('value-' + key).textContent = pair(analysis[key]);
            $('calculation-note').textContent = `Δv is the sum of the three weighted rule vectors and obstacle avoidance. Add it to v, then limit speed to 1.2–2.8 units/tick.${analysis.contact ? ' Contact response also changes this next velocity.' : ''}${frame.event.kind === 'finished' ? ' The next update is a prediction beyond the recorded run.' : ''}`;
        }
    }
});
function draft() {
    return { count: Number($('count').value), seed: /^\d+$/.test($('seed').value.trim()) ? Number($('seed').value) : NaN,
        obstacle: $('obstacle').value, rules: Object.fromEntries(ruleNames.map(key => [key, $('rule-' + key).checked])) };
}
$('input-form').addEventListener('change', () => { $('draft-note').textContent = 'Draft changes — Apply & restart to use them.'; });
$('input-form').addEventListener('submit', event => {
    event.preventDefault();
    try { playback.load(createBoidsSource(draft(), playback.mode)); $('draft-note').textContent = ''; }
    catch (error) { $('error').textContent = error.message; }
});
$('inspect').addEventListener('change', () => playback.pause());
$('bird').addEventListener('change', () => { selectedId = Number($('bird').value); playback.pause(); });
new ResizeObserver(() => playback.draw()).observe(canvas);
playback.load(createBoidsSource(draft()));
