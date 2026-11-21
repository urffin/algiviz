import {createListTrace,listScene} from '@grundyjs/algiviz/list';
import type {ListNode,ListInput,ListPosition,ListPointerId,ListAnnotation,ListMark,ListPointerAnnotation,ListPointerMark,ListNodeCaption,ListNodeCaptionPatch,ListMarkUpdate,ListResultInput,ListResult,ListDoneOptions,ListTraceOptions,ListEdit,ListSnapshot,ListEvent,ListStep,ListFrame,ListTrace,ListSceneOptions,ListNodeView,ListPointerView,ListObjects} from '@grundyjs/algiviz/list';
import {createPlayer,createTimeline,createRewindBuffer} from '@grundyjs/algiviz/playback';
import {createSceneProjector,createSceneRenderer} from '@grundyjs/algiviz/scene';
export type PublicListTypes=[ListNode,ListInput,ListPosition,ListPointerId,ListAnnotation,ListMark,ListPointerAnnotation,ListPointerMark,ListNodeCaption,ListNodeCaptionPatch,ListMarkUpdate,ListResultInput,ListResult,ListDoneOptions,ListTraceOptions,ListEdit,ListSnapshot,ListEvent,ListStep,ListFrame,ListTrace,ListSceneOptions,ListNodeView,ListPointerView,ListObjects];
function check(value:unknown):asserts value{if(!value)throw Error('Installed list check failed')}
const trace=createListTrace({headId:'A',nodes:[{id:'A',value:7,nextId:'B'},{id:'B',value:3,nextId:null}]},{layout:[{nodeId:'A',x:0,y:0},{nodeId:'B',x:1,y:0}]});
const first=trace.start(),changed=trace.edit({headId:'B',nodes:[{id:'A',value:8,nextId:null},{id:'B',value:3,nextId:'A'}],marks:{pointers:[{id:{kind:'next',nodeId:'A'},role:'changed'}],nodeCaptions:[{id:'B',text:''}]}}),final=trace.done({result:{nodeIds:['A'],pointerIds:[{kind:'next',nodeId:'A'}]}});
const value:number=changed.state.list.nodes[0]!.value;check(value===8&&first.state.list.headId==='A'&&final.state.result?.pointerIds.length===1);
const snapshot:ListSnapshot<number>=first.state;const undefinedValue:ListNode<undefined>={id:'U',value:undefined,nextId:null};
const timeline=createTimeline([first,changed,final],{stepDurationMs:100,finalHoldMs:0}),project=createSceneProjector((s:ListSnapshot<number>)=>listScene(s,{namespace:'consumer'})),selected:number[]=[];
createSceneRenderer<ListObjects<number>,number[],ListEvent>({listNode(out,o){const view=(o.current??o.previous)!.data;const n:number=view.node.value;if(view.result)out.push(n)},listPointer(_out,o,s){const view=(o.current??o.previous)!.data;for(const id of [view.from,view.to])if(id!==null)check(s.get(id))}}).render(selected,project(timeline.sample(200)));check(selected.join()==='8');
const ring=createRewindBuffer([first,changed,final],{capacity:2});ring.next();ring.next();check(ring.previous()===changed);ring.dispose();
const player=createPlayer([first,changed,final],{isTerminal:s=>s.event.type==='done'});player.nextStep();player.nextStep();check(player.finished);player.dispose();
const eventFree:ListFrame<number,undefined>={...timeline.sample(200),event:undefined};project(eventFree);
export function listTypeErrors(){
// @ts-expect-error missing nextId
const missingNext:ListNode<number>={id:"A",value:1};
// @ts-expect-error required present value
const missingValue:ListNode<number>={id:"A",nextId:null};
// @ts-expect-error unsupported pointer kind
const prev:ListPointerId={kind:"prev",nodeId:"A"};
// @ts-expect-error next slot requires owner
const ownerless:ListPointerId={kind:"next"};
// @ts-expect-error string is not a pointer ID
const rawPointer:ListPointerId="A";
// @ts-expect-error node is readonly
undefinedValue.nextId="A";
// @ts-expect-error value type preserved by trace inference
trace.edit({nodes:[{id:"A",value:"bad",nextId:null}]});
// @ts-expect-error head is required and cannot be undefined
const missingHead:ListInput<number>={headId:undefined,nodes:[]};
// @ts-expect-error snapshot nodes readonly
snapshot.list.nodes.push({id:"Y",value:3,nextId:null});
// @ts-expect-error registry must cover null/head pointer objects
createSceneRenderer<ListObjects<number>,void,ListEvent>({listNode(){}});
// @ts-expect-error closed event union excludes staging
const stage:ListEvent={type:"stage"};
// @ts-expect-error no unvalidated setNext operation
trace.setNext("A","X");
// @ts-expect-error selections have no path field
trace.done({result:{path:["A"]}});
// @ts-expect-error null result is invalid
trace.done({result:null});
// @ts-expect-error namespace must be a string
listScene(snapshot,{namespace:3});
// @ts-expect-error pointer selections use structured slots
trace.done({result:{pointerIds:["A"]}});
// @ts-expect-error no label-based or index-based node identity
const indexed:ListNode<number>={id:0,value:1,nextId:null};
// @ts-expect-error node arrays are complete replacements, not patch operations
trace.edit({nodes:{insert:[{id:"Y",value:1,nextId:null}]}});
// @ts-expect-error no working-arena phase in ListSnapshot
const invalidPhase:ListSnapshot<number>={...snapshot,phase:"staging"};
// @ts-expect-error positions are required for construction
createListTrace({headId:null,nodes:[]});

}
