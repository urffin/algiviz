import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer, createStatePlayer, createTimeline } from '@grundyjs/algiviz/playback';

const states = [Object.freeze({ x: 40 }), Object.freeze({ x: 200 }), Object.freeze({ x: 560 })];
const steps = states.map((state, i) => ({ state, index: [10, 25, 90][i], event: i === 2 ? 'done' : 'move' }));
function setup(finalHoldMs) {
    const counts = { explicit: 0, plain: 0, closedExplicit: 0, closedPlain: 0, renderExplicit: 0, renderPlain: 0 };
    function* explicit() { try { for (const step of steps) { counts.explicit++; yield step; } }
        finally { counts.closedExplicit++; } }
    function* plain() { try { for (const state of states) { counts.plain++; yield state; } }
        finally { counts.closedPlain++; } }
    const timing = { stepDurationMs: 100, finalHoldMs };
    return {
        p: createPlayer(explicit(), { ...timing, isTerminal: s => s.event === 'done', render() { counts.renderExplicit++; } }),
        q: createStatePlayer(plain(), { ...timing, render() { counts.renderPlain++; } }),
        timeline: createTimeline(steps, timing), counts,
    };
}

for (const hold of [0, 75]) {
    test(`completion matrix: timed frames, endpoint references and hold=${hold}`, () => {
        for (const time of [0, .3, 40, 100, 125, 199.9, 200, 225, 275, 500]) {
            const { p, q, timeline, counts } = setup(hold);
            p.advance(time); q.advance(time);
            const frame = timeline.sample(time);
            for (const player of [p, q]) {
                assert.equal(player.frame.current, frame.current);
                assert.equal(player.frame.progress, frame.progress);
            }
            assert.equal(p.frame.previous, frame.previous);
            assert.equal(p.frame.stepIndex, frame.stepIndex);
            assert.equal(q.frame.stepIndex, steps.findIndex(s => s.index === frame.stepIndex));
            assert.equal(q.frame.event, undefined);
            // Exact end time consumes no extra request; plain source cannot know it is final.
            assert.equal(q.frame.previous, time === 200 ? states[1] : frame.previous);
            assert.equal(p.finished, time >= 200 + hold);
            assert.equal(q.finished, time > 200 && time >= 200 + hold);
            assert.equal(counts.closedExplicit, Number(time >= 200));
            assert.equal(counts.closedPlain, Number(time > 200));
            const before = { ...counts };
            p.advance(0); q.advance(0);
            assert.equal(counts.explicit, before.explicit);
            assert.equal(counts.plain, before.plain);
            assert.equal(counts.closedPlain, before.closedPlain);
            assert.equal(counts.renderExplicit, before.renderExplicit + 1);
            assert.equal(counts.renderPlain, before.renderPlain + 1);
            p.dispose(); q.dispose();
            assert.equal(counts.closedExplicit, 1); assert.equal(counts.closedPlain, 1);
        }
    });

    test(`completion matrix: mixed controls, extra request and hold=${hold}`, () => {
        const { p, q, counts } = setup(hold);
        p.advance(.3); q.advance(.3);
        p.nextStep(); q.nextStep();
        assert.equal(counts.explicit, 2); assert.equal(counts.plain, 2);
        assert.equal(p.frame.progress, 1); assert.equal(q.frame.progress, 1);
        p.nextStep(); q.nextStep();
        assert.equal(p.finished, hold === 0); assert.equal(q.finished, false);
        assert.equal(p.frame.previous, states[2]); assert.equal(q.frame.previous, states[1]);
        const before = { ...counts };
        p.nextStep(); q.nextStep();
        assert.equal(p.finished, true); assert.equal(q.finished, hold === 0);
        assert.equal(counts.plain, before.plain); assert.equal(counts.closedPlain, 1);
        assert.equal(q.frame.previous, states[2]); assert.equal(q.frame.current, states[2]);
        assert.equal(q.frame.stepIndex, 2);
        assert.equal(counts.renderExplicit, before.renderExplicit + 1);
        assert.equal(counts.renderPlain, before.renderPlain + 1);
        if (hold) q.nextStep();
        assert.equal(q.finished, true);
        const last = q.frame, reads = counts.plain;
        q.nextStep(); q.advance(1000);
        assert.deepEqual(q.frame, last); assert.equal(counts.plain, reads);
        p.dispose(); q.dispose();
        assert.equal(counts.closedExplicit, 1); assert.equal(counts.closedPlain, 1);
    });
}
