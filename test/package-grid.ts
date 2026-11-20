import {createGridTrace,gridScene,type GridCoordinate,type GridInput,type GridWrite,type GridAnnotation,type GridMark,type GridCellCaption,type GridCellCaptionPatch,type GridMarkUpdate,type GridResultInput,type GridResult,type GridDoneOptions,type GridTraceOptions,type GridEdit,type GridSnapshot,type GridEvent,type GridStep,type GridFrame,type GridTrace,type GridSceneOptions,type GridCellView,type GridPathView,type GridObjects} from '@grundyjs/algiviz/grid';
import {createTimeline,createPlayer,createRewindBuffer} from '@grundyjs/algiviz/playback';
import {createSceneProjector,createSceneRenderer} from '@grundyjs/algiviz/scene';
export type PublicGridTypes=[GridCoordinate,GridInput,GridWrite,GridAnnotation,GridMark,GridCellCaption,GridCellCaptionPatch,GridMarkUpdate,GridResultInput,GridResult,GridDoneOptions,GridTraceOptions,GridEdit,GridSnapshot,GridEvent,GridStep,GridFrame,GridTrace,GridSceneOptions,GridCellView,GridPathView,GridObjects];
function check(value:unknown):asserts value{if(!value)throw Error('Installed grid check failed')}
const t=createGridTrace({rows:1,columns:2,values:[1,2]},{cellCaptions:[{row:0,column:0,text:''}]});
const first=t.start(),changed=t.edit({writes:[{row:0,column:0,value:2},{row:0,column:1,value:1}],marks:{cells:[{row:0,column:0,role:'visited'}]}}),final=t.done({result:{path:[{row:0,column:0},{row:0,column:1},{row:0,column:0}]}});
const n:number|undefined=changed.state.grid.values[0];check(n===2&&first.state.grid.values[0]===1&&final.state.result?.path.length===3);
const timeline=createTimeline([first,changed,final],{stepDurationMs:100,finalHoldMs:0}),project=createSceneProjector((s:GridSnapshot<number>)=>gridScene(s,{namespace:'consumer'}));
const results:number[]=[];createSceneRenderer<GridObjects<number>,number[],GridEvent>({gridCell(out,object){const v=(object.current??object.previous)!.data;const value:number=v.value;if(v.result)out.push(value)},gridPath(_out,object,scene){for(const id of (object.current??object.previous)!.data.cellIds)check(scene.get(id))}}).render(results,project(timeline.sample(200)));check(results.join()==='2,1');
const ring=createRewindBuffer([first,changed,final],{capacity:2});ring.next();ring.next();check(ring.previous()===changed);ring.dispose();
const player=createPlayer([first,changed,final],{isTerminal:s=>s.event.type==='done'});player.nextStep();player.nextStep();check(player.finished);player.dispose();
const eventFree:GridFrame<number,undefined>={...timeline.sample(200),event:undefined};project(eventFree);
const unknown=createGridTrace({rows:1,columns:1,values:[undefined]});unknown.start();unknown.edit({writes:[{row:0,column:0,value:undefined}]});unknown.done({result:{}});
export function gridTypeErrors(){
    // @ts-expect-error numeric coordinates
    const wrong:GridCoordinate={row:'0',column:0};
    // @ts-expect-error column required
    const missing:GridCoordinate={row:0};
    // @ts-expect-error ordinary storage
    createGridTrace({rows:1,columns:2,values:new Uint8Array([1,2])});
    // @ts-expect-error flat numeric values
    const flat:GridInput<number>={rows:1,columns:2,values:[[1,2]]};
    // @ts-expect-error exclusive replacement and writes
    t.edit({values:[1,2],writes:[]});
    // @ts-expect-error fixed rows
    t.edit({rows:1});
    // @ts-expect-error fixed columns
    t.edit({columns:2});
    // @ts-expect-error value required even when undefined is allowed
    t.edit({writes:[{row:0,column:0}]});
    // @ts-expect-error inferred number payload
    t.edit({writes:[{row:0,column:0,value:'x'}]});
    // @ts-expect-error role string or null
    t.mark({cells:[{row:0,column:0,role:false}]});
    // @ts-expect-error caption string or null
    t.mark({cellCaptions:[{row:0,column:0,text:2}]});
    // @ts-expect-error mark update required
    t.mark(undefined);
    // @ts-expect-error no null result input
    t.done({result:null});
    // @ts-expect-error path coordinates rather than offsets
    t.done({result:{path:[0,1]}});
    // @ts-expect-error regions not in first API
    t.done({result:{regions:[]}});
    // @ts-expect-error readonly owned values
    first.state.grid.values.push(3);
    // @ts-expect-error readonly result path
    final.state.result!.path.push({row:0,column:0});
    // @ts-expect-error no headless pixel layout API
    t.setLayout([]);
    // @ts-expect-error explicit namespace
    gridScene(first.state,{});
    // @ts-expect-error default event is GridEvent
    const badFrame:GridFrame<number>=eventFree;
    // @ts-expect-error both scene kinds require handlers
    createSceneRenderer<GridObjects<number>,unknown,GridEvent>({gridCell(){}});
    void wrong;void missing;void flat;void badFrame;
}
