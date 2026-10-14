import { threeWayQuickSort } from '../examples/quick-three-way.mjs';
import { createPlayer } from '@grundyjs/algiviz/playback';
import { quickSort } from '../examples/quick-algorithm.mjs';
import { createQuickRenderer } from '../examples/quick-scene.mjs';
import { performance } from 'node:perf_hooks';
import { insertion, bubble } from '../examples/algorithms.mjs';
import { mergeSort } from '../examples/merge-algorithm.mjs';
import { createArrayRenderer } from '@grundyjs/algiviz/canvas';
import { createMergeRenderer } from '../examples/merge-scene.mjs';
const n = 2000, values = Array.from({length:n}, (_,i)=>n-i);
const noop = () => {};
const ctx = new Proxy({canvas:{width:960,height:540}}, {get:(target,key)=>key in target?target[key]:noop});
for (const [name, algorithm] of Object.entries({insertion,bubble,merge:mergeSort,quick:quickSort,quickThreeWay:threeWayQuickSort})) {
    const source = algorithm.iterate(values);
    let previous = source.next().value, current;
    const begin = performance.now();
    for(let i=0;i<1000;i++) { current=source.next().value; if(!current) break; previous=current; }
    const generationMs=performance.now()-begin;
    current=source.next().value ?? previous;
    const frame={previous:previous.state,current:current.state,progress:.5,stepIndex:current.index,event:current.event};
    const renderer=name.startsWith('quick')?createQuickRenderer(true,previous.state.main):name==='merge'?createMergeRenderer(true,mergeSort.iterate(values).next().value.state.main):createArrayRenderer({theme:'dark'});
    for(let i=0;i<20;i++) renderer.render(ctx,frame);
    const samples=[];
    for(let j=0;j<5;j++) { const start=performance.now(); for(let i=0;i<100;i++) renderer.render(ctx,frame); samples.push((performance.now()-start)/100); }
    samples.sort((a,b)=>a-b);
    source.return();
    console.log(JSON.stringify({name,n,steps:1000,generationMs:+generationMs.toFixed(2),renderCpuMedianMs:+samples[2].toFixed(3)}));
}
// CPU-only drawing benchmark: the mock excludes browser Canvas/GPU work.

// Optional retained-heap sampling; no thresholds because GC and JIT vary by host.
if (global.gc) {
    for (const [name, algorithm] of Object.entries({insertion, bubble, merge:mergeSort, quick:quickSort, quickThreeWay:threeWayQuickSort})) {
        const player = createPlayer(algorithm.iterate(values), {
            stepDurationMs: 1, finalHoldMs: 0, isTerminal: step => step.event.type === 'done',
        });
        const samples = [];
        for (let batch = 0; batch < 5; batch++) {
            player.advance(5000);
            global.gc();
            samples.push({step: player.frame.stepIndex, heapMiB: +(process.memoryUsage().heapUsed / 1024 ** 2).toFixed(2)});
        }
        player.dispose();
        console.log(JSON.stringify({name, retainedHeap: samples}));
    }
}