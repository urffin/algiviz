import {createGridRenderer,type GridPalette,type GridCellPresentation,type GridRendererOptions,type GridRenderSize,type GridRenderer} from '@grundyjs/algiviz/canvas/grid';
import {createGridTrace,type GridFrame,type GridCellView} from '@grundyjs/algiviz/grid';
export type PublicGridCanvasTypes=[GridPalette,GridCellPresentation,GridRendererOptions,GridRenderSize,GridRenderer];
declare const context:CanvasRenderingContext2D,offscreen:OffscreenCanvasRenderingContext2D;
const renderer=createGridRenderer<number>({theme:'light',colors:{resultText:'#fff'},roleColors:{wall:'#111'},presentCell(cell,snapshot){
    const value:number=cell.value,selected:boolean=cell.result,n:number|undefined=snapshot.grid.values[0],noThis:void=this;
    void selected;void n;void noThis;return {label:String(value)};
}});
if(typeof renderer.render!=='function'||Object.keys(renderer).join()!=='render')throw Error('Installed grid Canvas API failed');
const t=createGridTrace({rows:1,columns:2,values:[1,2]}),first=t.start(),final=t.done({result:{path:[{row:0,column:0},{row:0,column:1}]}});
const frame:GridFrame<number,undefined>={previous:first.state,current:final.state,progress:.5,stepIndex:1,event:undefined};
export function gridCanvasTypes(ctx:CanvasRenderingContext2D){renderer.render(ctx,frame,{width:328,height:218});createGridRenderer({theme:'dark',presentCell:undefined,cellGap:undefined,path:'hidden',cellCaptions:'hidden'}).render(ctx,frame,{width:0,height:0});}
export function negativeCases(){
    // @ts-expect-error required theme
    createGridRenderer({});
    // @ts-expect-error closed theme
    createGridRenderer({theme:'sepia'});
    // @ts-expect-error numeric gap
    createGridRenderer({theme:'light',cellGap:'1'});
    // @ts-expect-error callback must be callable
    createGridRenderer({theme:'light',presentCell:3});
    // @ts-expect-error labels are strings
    createGridRenderer<number>({theme:'light',presentCell:c=>({label:c.value})});
    // @ts-expect-error color is a string
    createGridRenderer({theme:'light',presentCell:()=>({color:3})});
    // @ts-expect-error null is not an omitted presentation
    createGridRenderer({theme:'light',presentCell:()=>null});
    // @ts-expect-error synchronous presentation only
    createGridRenderer({theme:'light',presentCell:async()=>({label:'async'})});
    // @ts-expect-error explicit snapshot/cell payload
    createGridRenderer<number>({theme:'light',presentCell:(c:GridCellView<string>)=>({label:c.value})});
    // @ts-expect-error the first argument is a view, not the scalar value
    createGridRenderer<number>({theme:'light',presentCell:(value:number)=>({label:String(value)})});
    // @ts-expect-error closed caption option
    createGridRenderer({theme:'light',cellCaptions:'always'});
    // @ts-expect-error closed path option
    createGridRenderer({theme:'light',path:false});
    // @ts-expect-error known palette keys
    createGridRenderer({theme:'light',colors:{labelColor:'#000'}});
    // @ts-expect-error role colors are strings
    createGridRenderer({theme:'light',roleColors:{wall:0}});
    // @ts-expect-error no implicit linear value interpolation
    createGridRenderer({theme:'light',valueTransition:'linear'});
    // @ts-expect-error render-only API
    renderer.layout(t.state.grid,{width:1,height:1});
    // @ts-expect-error renderer owns no disposable resource
    renderer.dispose();
    // @ts-expect-error numeric logical size
    renderer.render(context,frame,{width:'108',height:108});
    const text=createGridTrace({rows:1,columns:1,values:['a']}).state;
    // @ts-expect-error retained renderer payload type
    renderer.render(context,{...frame,current:text},{width:10,height:10});
    // @ts-expect-error first host is HTML Canvas 2D
    renderer.render(offscreen,frame,{width:10,height:10});
    // @ts-expect-error complete frame required by public type
    renderer.render(context,{previous:first.state,current:final.state},{width:10,height:10});
    const presentation:GridCellPresentation={label:'x'};
    // @ts-expect-error readonly presentation type
    presentation.label='y';
    createGridRenderer<number>({theme:'light',presentCell(){
        // @ts-expect-error callback this is void
        const theme=this.theme;void theme;return {};
    }});
}
