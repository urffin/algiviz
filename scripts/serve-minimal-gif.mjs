import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
const root=resolve('.'),take=resolve('../canvas-take/dist');
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(req.method==='POST'&&url.pathname==='/save'){
  const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>15e6)throw Error('Too large');chunks.push(chunk);}
  await writeFile(resolve(root,'docs/assets/minimal.gif'),Buffer.concat(chunks));res.end('Saved');return;
 }
 if(req.method!=='GET'){res.writeHead(405).end();return;}
 const mapped=url.pathname.startsWith('/canvas-take/'),base=mapped?take:root;
 const path=resolve(base,'.'+decodeURIComponent(mapped?url.pathname.slice(12):url.pathname));
 if(!path.startsWith(base+sep)){res.writeHead(403).end();return;}
 res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.gif':'image/gif'})[extname(path)]??'text/plain');
 res.end(await readFile(path));
}catch(e){res.writeHead(500).end(String(e));}}).listen(3016,'127.0.0.1',()=>console.log('GIF server: http://127.0.0.1:3016/docs/assets/minimal-export.html'));
