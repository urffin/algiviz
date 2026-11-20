import assert from 'node:assert/strict';
export const cell = (row, column) => ({row,column});
export const input = () => ({rows:2,columns:3,values:[0,1,2,3,4,5]});
export const errorIs = kind => error => error?.constructor === kind;
export function throwsSame(fn, expected) { let thrown=false;try{fn();}catch(error){thrown=true;assert.equal(error,expected);}assert.equal(thrown,true); }
export function own(value) {
    if (!value || typeof value!=='object') return;
    assert.equal(Object.isFrozen(value),true);
    for(const key of Object.keys(value))if(key!=='value'&&key!=='values')own(value[key]);
    if(value.grid)assert.equal(Object.isFrozen(value.grid.values),true);
}
export const endpoint = state => ({previous:state,current:state,progress:1,stepIndex:0,event:undefined});
