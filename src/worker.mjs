import {DurableObject} from 'cloudflare:workers';
import {validateSetup,newSchedule,advanceDue,summary,CHAIN_ID} from './logic.mjs';
import {verifyAndPrepare,verifySubmittedHash} from './chain.mjs';
import {PAGE} from './page.mjs';
export const BUILD_VERSION='recurring-pharos-2026-11-03-v1';
const keyOk=x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x);
const json=(v,status=200)=>Response.json(v,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}});
function fail(error,status=400){return json({ok:false,error},status)}
const iso=()=>new Date().toISOString();

export class PaymentSchedule extends DurableObject {
 constructor(ctx,env){
  super(ctx,env);
  this.db=ctx.storage.sql;
  this.db.exec('CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY,data TEXT NOT NULL)');
 }
 getData(){
  const row=this.db.exec("SELECT data FROM documents WHERE id='schedule'").toArray()[0];
  return row?JSON.parse(row.data):null;
 }
 save(s){
  s.lastUpdatedAt=iso();
  this.db.exec("INSERT INTO documents(id,data) VALUES('schedule',?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",JSON.stringify(s));
 }
 due(s,now=Date.now()){
  const count=advanceDue(s,now);
  if(count)this.save(s);
  return count;
 }
 async arm(s){
  const times=[];
  if(s.state==='ACTIVE')times.push(Date.parse(s.nextDueAt));
  if(s.history.some(p=>p.status==='SUBMITTED'))times.push(Date.now()+45000);
  if(times.length)await this.ctx.storage.setAlarm(Math.max(Date.now()+150,Math.min(...times)));
  else await this.ctx.storage.deleteAlarm();
 }
 async reconcile(s){
  const pending=s.history.filter(p=>p.status==='SUBMITTED'&&p.txHash).slice(0,6);
  for(const p of pending){
   let result;
   try{result=await verifySubmittedHash(s,p)}
   catch(e){p.lastCheckError=String(e?.message||e).slice(0,140);continue}
   // Refresh current copy before persisting, to avoid overriding another request's update.
   const current=this.getData();if(!current)continue;
   const item=current.history.find(x=>x.id===p.id);
   if(!item||item.status!=='SUBMITTED'||item.txHash!==p.txHash)continue;
   if(result.status==='PAID'||result.status==='FAILED'){
    item.status=result.status;item.reason=result.reason;
    item.receiptBlock=result.receiptBlock||null;item.finalizedAt=iso();
    item.lastCheckError=null;this.save(current);s=current;
   }
  }
  return s;
 }
 async alarm(){
  let s=this.getData();if(!s)return;
  this.due(s);
  s=await this.reconcile(s);
  await this.arm(s);
 }
 async fetch(request){
  if(request.method!=='POST')return fail('POST only',405);
  let input;
  try{input=await request.json()}catch{return fail('JSON input required')}
  const action=new URL(request.url).pathname.slice(1);
  const now=Date.now();
  let s=this.getData();
  if(action==='create'){
   if(s)return fail('This private schedule key is already in use',409);
   try{const settings=validateSetup(input,now);s=newSchedule(settings,input.key,now)}
   catch(e){return fail(String(e.message||e))}
   this.save(s);this.due(s);await this.arm(s);
   return json({ok:true,version:BUILD_VERSION,schedule:summary(s)},201);
  }
  if(!s)return fail('No schedule found for this access key',404);
  this.due(s);
  if(action==='state'||action==='refresh'){
   s=await this.reconcile(s);await this.arm(s);
   return json({ok:true,version:BUILD_VERSION,schedule:summary(s)});
  }
  if(action==='pause'||action==='resume'||action==='cancel'){
   if(action==='resume'&&s.state==='CANCELLED')return fail('Cancelled schedules cannot resume');
   s.state=action==='pause'?'PAUSED':action==='resume'?'ACTIVE':'CANCELLED';
   if(action==='resume')this.due(s);
   this.save(s);await this.arm(s);
   return json({ok:true,schedule:summary(s)});
  }
  const slot=s.history.find(p=>p.id===input.periodId);
  if(!slot)return fail('Select a due payment period in the history');
  if(action==='review'){
   if(!['PENDING','READY','FAILED'].includes(slot.status))
    return fail('Payment already submitted/paid; a second unsigned draft is blocked',409);
   let result;
   try{result=await verifyAndPrepare(s,slot)}
   catch(e){return fail('On-chain validation unavailable: '+String(e.message||e),503)}
   // A concurrent submission may have changed this period during the RPC calls.
   s=this.getData();const p=s.history.find(x=>x.id===input.periodId);
   if(!p||!['PENDING','READY','FAILED'].includes(p.status))
    return fail('Payment state changed while validating. Reload history.',409);
   p.review=result.review;
   p.status=result.ok?'READY':'FAILED';
   p.reason=result.reason;
   p.unsigned=result.unsigned;
   p.reviewedAt=iso();
   this.save(s);await this.arm(s);
   return json({ok:true,ready:result.ok,payment:p,schedule:summary(s),
    note:'This only prepares an unsigned payment. You must sign independently, then submit its actual hash.'});
  }
  if(action==='retry'){
   if(slot.status!=='FAILED')return fail('Only failed payments can be retried',409);
   slot.status='PENDING';slot.reason=null;slot.unsigned=null;slot.review=null;
   slot.reviewedAt=null;slot.txHash=null;slot.attempt+=1;
   this.save(s);await this.arm(s);
   return json({ok:true,payment:slot,schedule:summary(s)});
  }
  if(action==='submit'){
   const hash=String(input.txHash||'').trim();
   if(!/^0x[0-9a-f]{64}$/i.test(hash))return fail('Enter a valid 0x transaction hash');
   if(slot.status==='SUBMITTED'&&slot.txHash?.toLowerCase()===hash.toLowerCase())
    return json({ok:true,payment:slot,idempotent:true});
   if(slot.status!=='READY'||!slot.unsigned)
    return fail('Review this period successfully before recording a transaction hash',409);
   if(s.history.some(x=>x.txHash?.toLowerCase()===hash.toLowerCase()))
    return fail('This transaction hash has already been used for a payment period',409);
   if(!slot.reviewedAt||Date.now()-Date.parse(slot.reviewedAt)>15*60000)
    return fail('Review is older than 15 minutes. Recheck balance and gas.',409);
   slot.txHash=hash;slot.status='SUBMITTED';slot.submittedAt=iso();slot.reason='Awaiting confirmed receipt';
   this.save(s);
   s=await this.reconcile(s);await this.arm(s);
   return json({ok:true,payment:s.history.find(x=>x.id===slot.id),schedule:summary(s),
    note:'Only a matching on-chain success receipt and transfer data can produce PAID.'});
  }
  return fail('Unknown schedule operation',404);
 }
}

export default {
 async fetch(request,env){
  const path=new URL(request.url).pathname;
  if(request.method==='GET'&&path==='/'){
   return new Response(PAGE,{headers:{'content-type':'text/html;charset=utf-8',
    'cache-control':'no-store','x-content-type-options':'nosniff'}});
  }
  if(request.method==='GET'&&path==='/api/health')
   return json({ok:true,version:BUILD_VERSION,chainId:CHAIN_ID,
    storage:'SQLite Durable Object with alarms',signing:false,broadcast:false,
    states:['PENDING','READY','FAILED','SUBMITTED','PAID'],
    description:'Recurring unsigned drafts; paid only after verifiable chain receipt'});
  if(request.method!=='POST'||path!=='/api/schedule')return fail('Not found',404);
  if(!env.SCHEDULES)return fail('Cloudflare Durable Object binding SCHEDULES is missing',503);
  let body;
  try{const raw=await request.text();
   if(raw.length>2500)throw Error('Request too large');
   body=JSON.parse(raw);
  }catch(e){return fail('Invalid JSON request: '+String(e.message||e))}
  if(!keyOk(body.key))return fail('A secure random UUID v4 access key is required');
  const allowed=new Set(['create','state','refresh','pause','resume','cancel','review','retry','submit']);
  if(!allowed.has(body.action))return fail('Unsupported operation');
  const id=env.SCHEDULES.idFromName('pharos-schedule:'+body.key.toLowerCase());
  const stub=env.SCHEDULES.get(id);
  return stub.fetch(new Request('https://schedule.internal/'+body.action,{
   method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify(body)
  }));
 }
};
