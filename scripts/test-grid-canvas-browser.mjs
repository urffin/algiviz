import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const {values}=parseArgs({options:{report:{type:'string'},port:{type:'string',default:'0'}}});
if(!values.report)throw Error('Pass --report with a local output JSON path');
const reportPath=resolve(values.report);
const server=createServer(async(req,res)=>{
    try{
        const url=new URL(req.url,'http://127.0.0.1');
        if(req.method==='POST'&&url.pathname==='/report'){
            let body='';for await(const chunk of req){body+=chunk;if(body.length>2_000_000)throw Error('Report too large');}
            const report=JSON.parse(body);await writeFile(reportPath,JSON.stringify(report,null,2)+'\n');res.end('saved');
            console.log(JSON.stringify({report:reportPath,passed:report.passed,failed:report.failed}));return;
        }
        if(req.method!=='GET'){res.writeHead(405);res.end();return;}
        const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/test/grid-canvas-browser.html':url.pathname));
        if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
        const content=await readFile(path);res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json'})[extname(path)]??'application/octet-stream');res.end(content);
    }catch(error){res.writeHead(404);res.end(String(error));}
});
server.listen(Number(values.port),'127.0.0.1',()=>console.log('http://127.0.0.1:'+server.address().port+'/'));
