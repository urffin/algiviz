import { createTreeTrace, treeScene, type TreeKind, type TreeBinarySlot, type TreeNode, type TreeOrderedLink, type TreeBinaryLink, type TreeLink, type TreeOrderedInput, type TreeBinaryInput, type TreeInput, type TreePosition, type TreeAnnotation, type TreeMark, type TreeNodeCaption, type TreeNodeCaptionPatch, type TreeMarkUpdate, type TreeResultInput, type TreeResult, type TreeDoneOptions, type TreeTraceOptions, type TreeEdit, type TreeSnapshot, type TreeEvent, type TreeStep, type TreeFrame, type TreeTrace, type TreeSceneOptions, type TreeNodeView, type TreeLinkView, type TreeObjects } from '@grundyjs/algiviz/tree';
import { createTimeline, createPlayer, createRewindBuffer } from '@grundyjs/algiviz/playback';
import { createSceneProjector, createSceneRenderer } from '@grundyjs/algiviz/scene';
export type PublicTreeTypes = [TreeKind, TreeBinarySlot, TreeNode, TreeOrderedLink, TreeBinaryLink, TreeLink, TreeOrderedInput, TreeBinaryInput, TreeInput, TreePosition, TreeAnnotation, TreeMark, TreeNodeCaption, TreeNodeCaptionPatch, TreeMarkUpdate, TreeResultInput, TreeResult, TreeDoneOptions, TreeTraceOptions, TreeEdit, TreeSnapshot, TreeEvent, TreeStep, TreeFrame, TreeTrace, TreeSceneOptions, TreeNodeView, TreeLinkView, TreeObjects];
function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const positions=[{nodeId:'A',x:0,y:0},{nodeId:'B',x:1,y:1}];
const binary=createTreeTrace({kind:'binary',rootId:'A',nodes:[{id:'A',data:{value:2}},{id:'B',data:{value:3}}],
    links:[{id:'edge',parentId:'A',childId:'B',slot:'right',data:{cost:1}}]}, {layout:positions});
const ordered=createTreeTrace({kind:'ordered',rootId:null,nodes:[],links:[]},{layout:[]});
const mode:'binary'=binary.state.tree.kind;
const value:number|undefined=binary.state.tree.nodes[0]?.data?.value;
const cost:number|undefined=binary.state.tree.links[0]?.data?.cost;
const initial=binary.start();
const marked=binary.mark({nodes:[{id:'A',role:'active'}],links:[{id:'edge',role:'path'}],nodeCaptions:[{id:'A',text:''}]});
const changed=binary.edit({rootId:'B',links:[{id:'edge',parentId:'B',childId:'A',slot:'left',data:{cost:2}}],layout:positions});
const done=binary.done({result:{nodeIds:['B'],linkIds:['edge']}});
check(initial.state.tree.rootId==='A'&&done.state.tree.rootId==='B','Tree atomic root edit failed');
check(changed.state.linkMarks[0]?.id==='edge'&&changed.state.nodeCaptions[0]?.text==='','Tree attributes lost in edit');
const timeline=createTimeline([initial,marked,changed,done],{stepDurationMs:100,finalHoldMs:0});
const project=createSceneProjector((state:typeof binary.state)=>treeScene(state,{namespace:'consumer'}));
const result:number[]=[];
createSceneRenderer<TreeObjects<{value:number},{cost:number},'binary'>,number[],TreeEvent>({
    treeNode(output,object){const view=(object.current??object.previous)!.data;const n:number|undefined=view.node.data?.value;if(view.result&&n!==undefined)output.push(n);const root:boolean=view.root;const caption:string|null=view.caption;void root;void caption;},
    treeLink(_output,object,scene){const view=(object.current??object.previous)!.data;const slot:'left'|'right'=view.link.slot;const data:number|undefined=view.link.data?.cost;check(scene.get(view.from)?.current?.type==='treeNode','Tree link source is not a scene ref');void slot;void data;}
}).render(result,project(timeline.sample(300)));
check(result.join()==='3','Installed tree result projection failed');
const ring=createRewindBuffer([initial,marked,changed,done],{capacity:2});ring.next();ring.next();ring.next();check(ring.previous()===changed,'Installed tree rewind failed');ring.dispose();
const player=createPlayer([initial,marked,changed,done],{isTerminal:step=>step.event.type==='done'});player.nextStep();player.nextStep();player.nextStep();check(player.finished,'Installed tree terminal failed');player.dispose();
const stateOnly:TreeFrame<{value:number},{cost:number},'binary',undefined>={...timeline.sample(300),event:undefined};project(stateOnly);
const scene=treeScene(binary.state,{namespace:'direct'});for(const o of scene.objects)if(o.type==='treeNode'){const data:number|undefined=o.data.node.data?.value;void data;}
const input:TreeInput<number,string>=Math.random()>.5?{kind:'ordered',rootId:null,nodes:[],links:[]}:{kind:'binary',rootId:null,nodes:[],links:[]};
const union=createTreeTrace(input,{layout:[]});const kind:TreeKind=union.state.tree.kind;
function genericScene<K extends TreeKind>(state:TreeSnapshot<number,string,K>){return treeScene(state,{namespace:'generic'});}
void mode;void value;void cost;void kind;void genericScene;

export function treeTypeErrors() {
// @ts-expect-error snapshot collection is readonly
binary.state.tree.nodes.push({id:'C'});
// @ts-expect-error ID is readonly
binary.state.tree.nodes[0]!.id='new';
// @ts-expect-error readonly position
binary.state.layout[0]!.x=2;
// @ts-expect-error invalid binary slot
binary.edit({links:[{id:'e',parentId:'A',childId:'B',slot:'middle'}]});
// @ts-expect-error binary link requires explicit slot
binary.edit({links:[{id:'e',parentId:'A',childId:'B'}]});
// @ts-expect-error ordered links cannot carry binary slots
ordered.edit({links:[{id:'e',parentId:'A',childId:'B',slot:'left'}]});
const binaryLink:TreeBinaryLink={id:'e',parentId:'A',childId:'B',slot:'left'};
// @ts-expect-error pre-existing binary link variable is not ordered
const invalidOrdered:TreeOrderedInput={kind:'ordered',rootId:'A',nodes:[],links:[binaryLink]};
// @ts-expect-error no kind change
binary.edit({kind:'ordered'});
// @ts-expect-error layout options required
createTreeTrace({kind:'ordered',rootId:null,nodes:[],links:[]});
// @ts-expect-error layout required in options
createTreeTrace({kind:'ordered',rootId:null,nodes:[],links:[]},{});
// @ts-expect-error payload inference is preserved
binary.edit({nodes:[{id:'A',data:{value:'wrong'}}]});
// @ts-expect-error link payload inference is preserved
binary.edit({links:[{id:'e',parentId:'A',childId:'B',slot:'left',data:{cost:'wrong'}}]});
// @ts-expect-error scene node payload is numeric
const wrongPayload:string=binary.state.tree.nodes[0]!.data!.value;
// @ts-expect-error closed event variants
const event:ReturnType<typeof binary.start>['event']={type:'rotate'};
// @ts-expect-error readonly result list
binary.state.result?.nodeIds.push('A');
// @ts-expect-error closed kind set
const wrongKind:TreeKind='forest';
// @ts-expect-error slot cannot be null placeholder
const noPlaceholder:TreeBinaryLink={id:'e',parentId:'A',childId:'B',slot:null};
// @ts-expect-error null-ended tree links are not valid input
const noNullTarget:TreeBinaryLink={id:'e',parentId:'A',childId:null,slot:'left'};
// @ts-expect-error result references use strings
binary.done({result:{nodeIds:[1]}});

}
