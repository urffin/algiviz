import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parseArgs } from 'node:util';
import ts from 'typescript';
import * as current from '@grundyjs/algiviz/scene';
import { profileWorkloads, prepareProfile, measureProfile, profilePolicy } from '../test/profile-workloads.mjs';

const { values } = parseArgs({ options: { 'scene-cache': { type: 'boolean' }, output: { type: 'string' } } });
const baselineCommit = '443892cf050cf313defcf055cf28318741502946';
const source = execFileSync('git', ['show', baselineCommit + ':src/scene/index.ts'], { encoding: 'utf8' });
const baselineDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'algiviz-scene-baseline-'));
const baselineFile = path.join(baselineDirectory, 'scene.mjs');
let checksum = 0;
const pause = () => new Promise(resolve => setImmediate(resolve));
const gc = async () => { for (let i=0;i<3;i++) { await pause(); global.gc(); } };

async function speed(baseline) {
    const rows = [];
    for (const workload of profileWorkloads) {
        const prepared = prepareProfile(workload), projected = prepared.projected;
        const windows = {
            samePair: projected.slice(0,8),
            advancing: projected,
            changingPair: projected.filter((_,i)=>i%8===0),
            standalone: projected
        };
        // Compare the entire real workload window against the released implementation.
        let validatedFrames=0;
        const checkRegistry=Object.fromEntries([...new Set(projected.flatMap(f=>[...f.previous.objects,...f.current.objects].map(o=>o.type)))].map(type=>[type,(_,object,resolved)=>{
            if(object===resolved.objects[0]) {
                const expected=baseline.createSceneFrame(projected[validatedFrames]);
                assert.deepEqual(resolved.objects,expected.objects);
                assert.equal(resolved.progress,expected.progress); assert.equal(resolved.stepIndex,expected.stepIndex);
                assert.equal(resolved.event,expected.event);
                for(const transition of expected.objects) assert.deepEqual(resolved.get(transition.id),transition);
                assert.equal(resolved.get('missing'),undefined);
                validatedFrames++;
            }
        }]));
        const checkRenderer=current.createSceneRenderer(checkRegistry);
        for(const f of projected) checkRenderer.render(null,f);
        assert.equal(validatedFrames,projected.length);
        const registry = Object.fromEntries([...new Set(projected.flatMap(f=>[...f.previous.objects,...f.current.objects].map(o=>o.type)))].map(type=>[type,(_,object,resolved)=>{
            checksum += object.presence;
            if (object === resolved.objects[0]) checksum += resolved.get(object.id).presence;
        }]));
        const result = {name:workload.name, objects:prepared.objects, validatedFrames, cases:{}};
        for (const [name, frames] of Object.entries(windows)) {
            const rounds = [];
            for (const order of [['before','after'],['after','before']]) {
                const round = {};
                for (const version of order) {
                    const api = version === 'before' ? baseline : current;
                    const renderer=api.createSceneRenderer(registry);
                    round[version] = await measureProfile(i=>{
                        const f=frames[i%frames.length];
                        if (name==='standalone') checksum += api.createSceneFrame(f).objects.length;
                        else renderer.render(null,f);
                    }, {minIterations:Math.ceil(frames.length/profilePolicy.samples)});
                }
                rounds.push(round);
            }
            result.cases[name] = rounds;
        }
        rows.push(result);
        console.log(JSON.stringify({name:result.name, ms:Object.fromEntries(Object.entries(result.cases).map(([key,rounds])=>[key,rounds.map(r=>({before:+r.before.medianMs.toFixed(4),after:+r.after.medianMs.toFixed(4)}))]))}));
    }
    return rows;
}

function feed(renderer, count, size, offset) {
    const make = step => ({objects:Array.from({length:size},(_,i)=>({id:'node:'+i,type:'node',data:{step:step+offset,payload:Array(16).fill(i)}}))});
    let previous=make(0); const old=[new WeakRef(previous)];
    let lastPrevious;
    for(let i=1;i<=count;i++) {
        const next=make(i);
        renderer.render(null,{previous,current:next,progress:.5,event:null,stepIndex:i+offset});
        if(i===1) old.push(new WeakRef(next));
        lastPrevious=previous; previous=next;
    }
    return {old,active:[new WeakRef(lastPrevious),new WeakRef(previous)]};
}

async function memory(api, version) {
    await gc();
    const initial=process.memoryUsage().heapUsed;
    let renderer=api.createSceneRenderer({node(){}});
    const samples=[];
    let active;
    for(let batch=0;batch<4;batch++) {
        const refs=feed(renderer,1000,512,batch*1000);
        await gc();
        const oldAlive=refs.old.filter(ref=>ref.deref()!==undefined).length;
        if(oldAlive) throw Error(version+': obsolete endpoint scenes retained');
        active=refs.active;
        samples.push({pairs:(batch+1)*1000,heapBytes:process.memoryUsage().heapUsed,oldAlive});
    }
    const activeAlive=active.filter(ref=>ref.deref()!==undefined).length;
    assert.equal(activeAlive,version==='after'?2:0);
    renderer=null; await gc();
    const afterDropAlive=active.filter(ref=>ref.deref()!==undefined).length;
    if(afterDropAlive) throw Error(version+': dropping renderer did not release endpoints');
    console.log(JSON.stringify({version,memory:samples.map(s=>({pairs:s.pairs,heapMiB:+(s.heapBytes/1024**2).toFixed(3),oldAlive:s.oldAlive})),activeAlive,afterDropAlive}));
    return {initialHeapBytes:initial,samples,activeAlive,afterDropAlive,afterDropHeapBytes:process.memoryUsage().heapUsed,
        policy:{pairs:4000,objectsPerScene:512,forcedGcPasses:3,oldReferencesPerBatch:2}};
}

try {
    if(!global.gc) throw Error('Run with --expose-gc for retained-memory checks');
    await fs.writeFile(baselineFile,ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText);
    const baseline=await import(pathToFileURL(baselineFile));
    const report={environment:{date:new Date().toISOString(),runtime:process.version,platform:process.platform,arch:process.arch,
        cpu:os.cpus()[0]?.model,baselineCommit,currentHead:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
        currentSourceSha256:createHash('sha256').update(await fs.readFile('src/scene/index.ts')).digest('hex'),
        harnessSha256:createHash('sha256').update(await fs.readFile(new URL(import.meta.url))).digest('hex'),
        note:'Uncommitted optimized source; same-process paired CPU comparison, no Canvas/GPU/FPS'},policy:profilePolicy};
    report.speed=await speed(baseline);
    report.memory={before:await memory(baseline,'before'),after:await memory(current,'after')};
    report.checksum=checksum;
    if(values.output) await fs.writeFile(path.resolve(values.output),JSON.stringify(report,null,2));
} finally {
    await fs.unlink(baselineFile).catch(error=>{if(error.code!=='ENOENT') throw error;});
    await fs.rmdir(baselineDirectory);
}
