import assert from 'node:assert/strict';
export const input=(ids=['A','B','C'])=>({headId:ids[0]??null,nodes:ids.map((id,i)=>({id,value:i,nextId:ids[i+1]??null}))});
export const positions=(ids=['A','B','C'])=>ids.map((nodeId,i)=>({nodeId,x:i,y:0}));
export const options=(ids)=>({layout:positions(ids)});
export const slot=nodeId=>nodeId===undefined?{kind:'head'}:{kind:'next',nodeId};
export const nodeId=(id,namespace='list')=>JSON.stringify([namespace,'list','node',id]);
export const pointerId=(id,namespace='list')=>JSON.stringify(id===undefined?[namespace,'list','pointer','head']:[namespace,'list','pointer','next',id]);
export const errorIs=Type=>error=>error?.constructor===Type;
export function throwsSame(fn,value){let caught=false;try{fn()}catch(error){caught=true;assert.equal(error,value)}assert.equal(caught,true)}
export function owned(state){
    for(const value of [state,state.list,state.list.nodes,state.layout,state.nodeMarks,state.pointerMarks,state.nodeCaptions])assert.ok(Object.isFrozen(value));
    for(const list of [state.list.nodes,state.layout,state.nodeMarks,state.pointerMarks,state.nodeCaptions])for(const value of list)assert.ok(Object.isFrozen(value));
    for(const value of state.pointerMarks)assert.ok(Object.isFrozen(value.id));
    if(state.result){for(const value of [state.result,state.result.nodeIds,state.result.pointerIds,...state.result.pointerIds])assert.ok(Object.isFrozen(value));}
}
