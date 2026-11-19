import { createTreeTrace } from '@grundyjs/algiviz/tree';
import { createTreeRenderer } from '@grundyjs/algiviz/canvas/tree';
export const size = {width:640,height:400};
export const endpoint = state => ({previous:state,current:state,progress:1,event:undefined,stepIndex:0});
export function fixture(kind='binary') {
    const pairs = kind==='binary' ? [['R','A','left'],['R','B','right'],['A','C','right'],['B','D','left'],['D','E','left'],['D','F','right']]
        : [['R','A'],['R','B'],['R','C'],['A','D'],['A','E'],['C','F']];
    return {kind,rootId:'R',nodes:['R','A','B','C','D','E','F'].map(id=>({id,label:id})),
        links:pairs.map(([parentId,childId,slot],i)=>({id:'l'+i,parentId,childId,...(slot?{slot}:{}),...(i===0?{label:'L'}:{})}))};
}
export function states(kind='binary') {
    const renderer=createTreeRenderer({theme:'light'}), input=fixture(kind);
    const trace=createTreeTrace(input,{layout:renderer.layout(input),nodeCaptions:[{id:'C',text:'d=2'},{id:'F',text:'end'},{id:'R',text:'root'}]});
    const start=trace.start();trace.mark({nodes:[{id:'A',role:'active'}],links:[{id:'l0',role:'visited'}]});
    const done=trace.done({result:{nodeIds:['C'],linkIds:['l0']}});
    return {start:start.state,done:done.state};
}
export function rotation(renderer=createTreeRenderer({theme:'light'})) {
    const input={kind:'binary',rootId:'R',nodes:['R','B','A'].map(id=>({id})),links:[
        {id:'pivot',parentId:'R',childId:'B',slot:'right'}, {id:'child',parentId:'B',childId:'A',slot:'left'}]};
    const trace=createTreeTrace(input,{layout:renderer.layout(input)}),start=trace.start();
    const update={rootId:'B',links:[{id:'pivot',parentId:'B',childId:'R',slot:'left'},{id:'child',parentId:'R',childId:'A',slot:'right'}]};
    const moved=trace.edit({...update,layout:renderer.layout({...trace.state.tree,...update})});
    const done=trace.done({result:{nodeIds:['B'],linkIds:['pivot']}});
    return {start,moved,done,frame:p=>({previous:start.state,current:moved.state,progress:p,event:undefined,stepIndex:1})};
}
