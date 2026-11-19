import {recording as baseRecording} from './graph-canvas-context.mjs';
/** Keep injected host failures separate from the cloneable drawing-state log. */
export function recording(...args) {
    const env=baseRecording(...args), overrides=new Map(),base=env.ctx;
    env.ctx=new Proxy(base,{
        get(target,key){return overrides.has(key)?overrides.get(key):Reflect.get(target,key);},
        set(target,key,value){if(typeof value==='function'){overrides.set(key,value);return true;}return Reflect.set(target,key,value);}
    });
    return env;
}
