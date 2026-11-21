import http from 'node:http';
import {randomBytes,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {Storage} from './storage.mjs';
const catalogue=JSON.parse(readFileSync(new URL('./catalogue.json',import.meta.url)));
const hash=s=>createHash('sha256').update(s).digest('hex');
const name=s=>String(s||'').replace(/[\x00-\x1f\x7f]/g,'').slice(0,24);
const fail=(status,message)=>Object.assign(Error(message),{status});
export function createApp(store,{clock=Date.now}={}){
 const rates=new Map();let globalSlot=-1,globalRequests=0,quotaDay=-1,quotaLeft=0,quotaPromise=null,blockedDay=-1;
 async function mutate(key,fn){for(let i=0;i<4;i++){const old=await store.get(key),data=old?structuredClone(old.data):null;const result=fn(data);if(result.remove){if(!old||await store.remove(key,old.generation))return result.value;}else if(await store.put(key,result.data,old?.generation||'0'))return result.value;}throw fail(409,'Please retry');}
 function live(data){if(!data||data.expires<=clock())throw fail(404,'Challenge not found or expired');return data;}
 async function spendQuota(now){const day=Math.floor(now/86400000);if(blockedDay===day)throw fail(429,'Daily service limit reached; use the offline backup code');if(quotaDay!==day){quotaDay=day;quotaLeft=0;}while(quotaLeft<=0){if(!quotaPromise)quotaPromise=(async()=>{try{const grant=await mutate('control/day-'+day+'.json',d=>{const used=d?.used||0;if(used>=3000)throw fail(429,'Daily service limit reached; use the offline backup code');const grant=Math.min(20,3000-used);return{data:{used:used+grant,day},value:grant};});quotaLeft+=grant;}catch(e){if(e.status===429)blockedDay=day;throw e;}})();try{await quotaPromise;}finally{quotaPromise=null;}}quotaLeft--;}
 function view(d,who){return{id:d.id,card:d.card,lang:d.lang,created:d.created,expires:d.expires,limit:d.limit,serverNow:clock(),owner:d.owner===who,players:Object.entries(d.players).map(([k,p],i)=>({you:k===who,label:p.label||'Player '+(i+1),started:p.started,finished:p.finished||null,elapsed:p.finished?Math.ceil((p.finished-p.started)/1000):null,late:p.finished? p.finished-p.started>d.limit*1000:false})),you:d.players[who]?{started:d.players[who].started,deadline:d.players[who].started+d.limit*1000,finished:d.players[who].finished||null}:null};}
 return http.createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Access-Control-Allow-Origin','https://sibal.local');res.setHeader('Access-Control-Allow-Headers','Authorization,Content-Type');res.setHeader('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try{
   if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
   const path=new URL(req.url,'http://localhost').pathname;if(path==='/health'&&req.method==='GET'){send(200,{ok:true,version:'0.4.0',catalogue:hash(JSON.stringify(catalogue))});return;}
   const landing=path.match(/^\/c\/([A-Za-z0-9_-]{22})$/);if(landing&&req.method==='GET'){const id=landing[1];res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'"});res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>SIBAL365 challenge</title><style>body{font:18px system-ui;background:#f7f0ff;color:#352349;max-width:650px;margin:10vh auto;padding:24px;line-height:1.7}a{display:block;background:#593683;color:white;padding:16px;border-radius:16px;margin:14px 0;text-align:center}code{overflow-wrap:anywhere}</style><h1>Your SIBAL365 challenge</h1><p>Open the game to preview and accept. Your timer starts only after you accept.</p><a href="sibal365://challenge/${id}">Open in SIBAL365</a><a href="https://play.google.com/store/apps/details?id=com.tory.sibal365">Get the Android app</a><p>Or paste this code in Friends &amp; challenges:</p><code>S365G-${id}</code><p>Photos stay on your phone. Joining shares your optional nickname and timing with this private group. Participation is voluntary.</p>`);return;}
   const token=(req.headers.authorization||'').replace(/^Bearer /,'');if(!/^[a-f0-9]{64}$/.test(token))throw fail(401,'Device key required');const who=hash(token),now=clock(),slot=Math.floor(now/60000),rate=rates.get(who);if(globalSlot!==slot){globalSlot=slot;globalRequests=0;}if(++globalRequests>180)throw fail(429,'Service busy; retry shortly');if(rate?.slot===slot&&rate.count>=40)throw fail(429,'Try again in a minute');rates.set(who,{slot,count:rate?.slot===slot?rate.count+1:1});if(rates.size>10000)for(const[k,v]of rates)if(v.slot!==slot)rates.delete(k);if(rates.size>12000)throw fail(503,'Busy');
   await spendQuota(now);
   let body={};if(req.method==='POST'){if(Number(req.headers['content-length'])>2048)throw fail(413,'Too large');let data='';for await(const chunk of req){data+=chunk;if(Buffer.byteLength(data)>2048)throw fail(413,'Too large');}try{body=JSON.parse(data||'{}');}catch{throw fail(400,'Invalid JSON');}}
   if(path==='/v1/challenges'&&req.method==='POST'){
    if(!Number.isInteger(body.card)||!catalogue[body.card]||!['en','sk','cs','de','pl','fr','it','es','pt','hu','tr','ja'].includes(body.lang))throw fail(400,'Invalid card');
    const id=randomBytes(16).toString('base64url'),key='challenges/'+id+'.json';
    await mutate('devices/'+who+'.json',d=>{d=d&&d.expires>now?d:{created:now,expires:now+30*86400000,day:0,count:0,ids:[]};const day=Math.floor(now/86400000);if(d.day!==day){d.day=day;d.count=0;}if(d.count>=6)throw fail(429,'Six new group challenges per day');d.ids=d.ids.slice(-59);d.ids.push(id);d.count++;return{data:d,value:null};});
    const d={id,card:body.card,lang:body.lang,limit:catalogue[body.card],created:now,expires:now+7*86400000,owner:who,players:{[who]:{label:name(body.label),started:now,finished:null}}};if(!await store.put(key,d))throw fail(409,'Retry');send(201,view(d,who));return;
   }
   if(path==='/v1/me'&&req.method==='DELETE'){const key='devices/'+who+'.json',index=await store.get(key);for(const id of index?.data.ids||[]){await mutate('challenges/'+id+'.json',d=>{if(!d)return{remove:true,value:null};if(d.owner===who)return{remove:true,value:null};delete d.players[who];return{data:d,value:null};});}if(index)await store.remove(key,index.generation);send(200,{deleted:true});return;}
   const match=path.match(/^\/v1\/challenges\/([A-Za-z0-9_-]{22})(?:\/(join|finish))?$/);if(!match)throw fail(404,'Not found');const [,id,action]=match,key='challenges/'+id+'.json';
   if(req.method==='GET'&&!action){const d=live((await store.get(key))?.data);send(200,view(d,who));return;}
   if(req.method==='DELETE'&&!action){await mutate(key,d=>{live(d);if(d.owner!==who){if(!d.players[who])throw fail(403,'Not a participant');delete d.players[who];return{data:d,value:null};}return{remove:true,value:null};});send(200,{deleted:true});return;}
   if(req.method!=='POST'||!action)throw fail(405,'Method not allowed');
   if(action==='join'){await mutate('devices/'+who+'.json',d=>{d=d&&d.expires>now?d:{created:now,expires:now+30*86400000,day:0,count:0,ids:[]};if(!d.ids.includes(id)){if(d.ids.length>=60)throw fail(429,'Active challenge limit');d.ids.push(id);}return{data:d,value:null};});}
   const result=await mutate(key,d=>{live(d);if(action==='join'){if(!d.players[who]){if(now>d.created+7*86400000)throw fail(404,'Invitation expired');if(Object.keys(d.players).length>=20)throw fail(409,'Group full');d.players[who]={label:name(body.label),started:now,finished:null};d.expires=Math.max(d.expires,now+d.limit*1000+86400000);}}else{const player=d.players[who];if(!player)throw fail(403,'Accept first');if(!player.finished)player.finished=now;}return{data:d,value:view(d,who)};});send(200,result);
  }catch(e){send(e.status||503,{error:e.status?e.message:'Temporarily unavailable'});}
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const store=new Storage(process.env.SIBAL_BUCKET);createApp(store).listen(Number(process.env.PORT)||8080,'0.0.0.0');}
