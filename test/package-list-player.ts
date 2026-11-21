import type {PlayerOptions} from '@grundyjs/algiviz/player';
import {createListTrace,listScene} from '@grundyjs/algiviz/list';
import type {ListSnapshot,ListEvent} from '@grundyjs/algiviz/list';
function* source(){const t=createListTrace({headId:null,nodes:[]},{layout:[]});yield t.start();yield t.done({result:{pointerIds:[{kind:'head'}]}});}
export const options:PlayerOptions<ListSnapshot, ListEvent>={stepSource:source,isTerminal:s=>s.event.type==='done',rewindCapacity:3,render:f=>{listScene(f.current,{namespace:'typed-player'});}};
export function invalidListPlayer(){
// @ts-expect-error explicit steps require isTerminal
const noTerminal:PlayerOptions<ListSnapshot,ListEvent>={stepSource:source,render(){}};
// @ts-expect-error mutually exclusive source options
const both:PlayerOptions<ListSnapshot,ListEvent>={stepSource:source,isTerminal:()=>true,source:()=>[],render(){}};
}
