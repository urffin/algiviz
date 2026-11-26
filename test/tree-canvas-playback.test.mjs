import assert from 'node:assert/strict';
import {test} from 'node:test';
import {Player} from '@grundyjs/algiviz/player';
import {createTreeRenderer} from '@grundyjs/algiviz/canvas/tree';
import {createTreeTrace} from '@grundyjs/algiviz/tree';
import {createTimeline} from '@grundyjs/algiviz/playback';
import {dom} from './player-test-dom.mjs';
import {recording} from './tree-canvas-context.mjs';
import {rotation,size} from './tree-canvas-fixtures.mjs';

test('tree Canvas Player: Next, Pause, rewind, terminal green, Restart and idempotent dispose',async()=>{
    for(const mode of ['stream','history']){
        const env=dom(),host=env.container(),renderer=createTreeRenderer({theme:'light',emptySlots:'visible'});
        const canvas=recording(),last=()=>canvas.calls('fill').slice(-3).map(c=>c.state.fillStyle);
        let reads=0,closed=0,runs=0,latest;
        function* source(){runs++;try{const f=rotation(renderer);for(const step of [f.start,f.moved,f.done]){reads++;yield step;}}finally{closed++;}}
        const options=mode==='stream'?{stepSource:source,isTerminal:s=>s.event.type==='done',rewindCapacity:3}
            :{history:()=>[...source()].map(s=>s.state)};
        const player=new Player(host,{...options,stepDurationMs:100,render:frame=>{latest=frame;renderer.render(canvas.ctx,frame,size);}});
        player.start();const initial=player.frame.current;assert.ok(!last().includes('#047857'));
        player.play();env.scheduler.tick(0);env.scheduler.tick(50);assert.equal(latest.progress,.5);
        player.pause();const paused=latest;env.scheduler.tick(900);assert.equal(latest,paused);
        player.next();player.next();assert.equal(player.status.phase,'finished');assert.ok(last().includes('#047857'));
        const done=player.frame.current,readsAtDone=reads;player.previous();assert.equal(player.frame.current.result,null);assert.ok(!last().includes('#047857'));
        player.next();assert.equal(player.frame.current,done);assert.equal(reads,readsAtDone);assert.ok(last().includes('#047857'));
        if(mode==='history'){player.seek(50);assert.equal(player.frame.progress,.5);assert.ok(!last().includes('#047857'));}
        player.restart();assert.equal(runs,2);assert.deepEqual(player.frame.current,initial);assert.notEqual(player.frame.current,initial);assert.ok(!last().includes('#047857'));
        player.dispose();player.dispose();const report=await player.closed;assert.equal(report.errorCount,0);assert.equal(closed,2);
        assert.equal(env.scheduler.size,0);assert.equal(host.children.length,0);
    }
});
test('tree Canvas history: state-only random seeking and unchanged source final result after rewind',()=>{
    const f=rotation(),timeline=createTimeline([f.start,f.moved,f.done],{stepDurationMs:100,finalHoldMs:0}),r=createTreeRenderer({theme:'dark'});
    for(const ms of [200,50,0,150,200,25]){
        const env=recording();r.render(env.ctx,timeline.sample(ms),size);assert.equal(env.stack.length,0);
        assert.equal(env.calls('fill').some(c=>c.state.fillStyle==='#34d399'),ms>=100);
    }
    assert.deepEqual(f.done.state.result,{nodeIds:['B'],linkIds:['pivot']});
});

test('trie double outline follows terminal IDs through stepHistory and preserves highlight', async () => {
    const options = { theme: 'light', nodeRadius: 21, roleColors: { path: '#2563eb' } };
    const renderer = createTreeRenderer(options);
    const delegated = createTreeRenderer({ ...options, drawNode({ drawDefault }) { drawDefault(); } });
    const decorated = createTreeRenderer({ ...options, drawNode({ ctx, view, center, radius, outerRadius, drawDefault }) {
        drawDefault();
        if (!view.node.data.terminal) return;
        assert.ok(outerRadius > radius);
        ctx.fillStyle = '#db2777';
        ctx.beginPath();
        ctx.arc(center.x + radius * .55, center.y - radius * .55, radius * .15, 0, 2 * Math.PI);
        ctx.fill();
        ctx.font = '48px serif';
    } });
    const replaced = createTreeRenderer({ ...options, drawNode({ ctx, view, center }) {
        if (view.node.data.terminal) ctx.fillRect(center.x - 3, center.y - 3, 6, 6);
    } });
    const input = {
        kind: 'ordered', rootId: 'root',
        nodes: [
            { id: 'root', label: '∅', data: { terminal: false } },
            { id: 'c', label: 'c', data: { terminal: false } },
            { id: 'ca', label: 'a', data: { terminal: false } },
            { id: 'cat', label: 't', data: { terminal: true } }
        ],
        links: [
            { id: 'c-edge', parentId: 'root', childId: 'c' },
            { id: 'ca-edge', parentId: 'c', childId: 'ca' },
            { id: 'cat-edge', parentId: 'ca', childId: 'cat' }
        ]
    };
    const trace = createTreeTrace(input, { layout: renderer.layout(input) });
    const start = trace.start();
    const inserted = trace.edit({
        nodes: input.nodes.map(node => node.id === 'ca' ? { ...node, data: { terminal: true } } : node)
    });
    const active = trace.mark({ nodes: [{ id: 'ca', role: 'path' }, { id: 'cat', role: 'active' }],
        nodeCaptions: [{ id: 'cat', text: 'cat' }] });
    const done = trace.done({ result: { nodeIds: ['cat'] } });
    const host = dom();
    let frame;
    const player = new Player(host.container(), {
        stepHistory: () => [start, inserted, active, done],
        stepDurationMs: 100,
        render: next => { frame = next; }
    });
    try {
        player.start();
        function paint(drawingOptions, painter = renderer) {
            const canvas = recording();
            painter.render(canvas.ctx, frame, size, drawingOptions);
            return canvas;
        }
        function outlined(painter) {
            return paint({ doubleOutlineNodeIds: frame.current.tree.nodes
                .filter(node => node.data.terminal).map(node => node.id) }, painter);
        }
        const initial = outlined();
        assert.equal(initial.calls('arc').length, 5);
        assert.deepEqual(paint({ doubleOutlineNodeIds: [] }).commands, paint().commands);
        assert.deepEqual(paint({ doubleOutlineNodeIds: ['absent'] }).commands, paint().commands);
        assert.throws(() => paint({ doubleOutlineNodeIds: [null] }), TypeError);
        player.next();
        assert.equal(frame.event, inserted.event);
        assert.equal(outlined().calls('arc').length, 6);
        player.next();
        assert.equal(frame.event, active.event);
        const highlighted = outlined();
        const paintCalls = canvas => canvas.commands.filter(call =>
            ['arc', 'stroke', 'fill', 'fillText', 'fillRect'].includes(call.name)).map(({ name, args, state }) => [
                name, args, state.globalAlpha,
                name === 'stroke' ? [state.strokeStyle, state.lineWidth, state.dash] : state.fillStyle
            ]);
        assert.deepEqual(paintCalls(outlined(delegated)), paintCalls(highlighted));
        const decoratedCanvas = outlined(decorated);
        assert.deepEqual(decoratedCanvas.calls('fillText').map(c => [c.args, c.state.font]),
            highlighted.calls('fillText').map(c => [c.args, c.state.font]));
        assert.deepEqual(decoratedCanvas.calls('fill').map(c => c.state.fillStyle).slice(-2), ['#fbbf24', '#db2777']);
        const customBody = outlined(replaced);
        assert.equal(customBody.calls('arc').length, 0);
        assert.deepEqual(customBody.calls('fillText').map(c => c.args), highlighted.calls('fillText').map(c => c.args));
        assert.deepEqual(highlighted.calls('arc').filter(call => call.args[2] > 21)
            .map(call => call.state.strokeStyle), ['#2563eb', '#fbbf24']);
        const catRing = highlighted.calls('arc').at(-1).args;
        const caption = highlighted.calls('fillText').find(call => call.args[0] === 'cat');
        assert.ok(caption);
        assert.ok(Math.hypot(caption.args[1] - catRing[0], caption.args[2] - catRing[1]) > catRing[2]);
        player.next();
        assert.equal(outlined().calls('arc').at(-1).state.strokeStyle, '#047857');
        player.seek(200);
        assert.equal(frame.event, active.event);
        assert.deepEqual(outlined().commands, highlighted.commands);
        assert.deepEqual(outlined(decorated).commands, decoratedCanvas.commands);
        player.seek(0);
        assert.equal(frame.event, start.event);
        assert.deepEqual(outlined().commands, initial.commands);
    } finally {
        player.dispose();
        await player.closed;
    }
});
