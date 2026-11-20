import {createGridTrace} from '@grundyjs/algiviz/grid';
export const size={width:328,height:218};
export const cell=(row,column)=>({row,column});
export const endpoint=(state,progress=1)=>({previous:state,current:state,progress,stepIndex:0,event:undefined});
export function states(){const trace=createGridTrace({rows:2,columns:3,values:[0,1,2,3,4,5]}, {cellCaptions:[{row:0,column:0,text:'d=0'},{row:1,column:2,text:'d=3'}]});
    const start=trace.start(),changed=trace.edit({writes:[{row:0,column:0,value:9}],marks:{cells:[{row:0,column:0,role:'visited'}]}}),done=trace.done({result:{cells:[cell(0,1)],path:[cell(0,0),cell(0,0),cell(1,2),cell(0,0)]}});return{start,changed,done};}
export const presentCell=({value})=>({label:String(value)});
