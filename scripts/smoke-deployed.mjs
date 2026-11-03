import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {ERC20,USDC} from '../src/logic.mjs';
import {BUILD_VERSION} from '../src/version.mjs';
const base=(process.env.RECURRING_AGENT_URL||'https://recurring-payment-agent.trantanlong2411.workers.dev').replace(/\/$/,'');
const pause=t=>new Promise(r=>setTimeout(r,t));
async function send(body){
 const response=await fetch(base+'/api/schedule',{method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 let data;try{data=await response.json()}catch{throw Error('Non-JSON Worker response '+response.status)}
 return {status:response.status,...data};
}
const call=(key,action,rest={})=>send({key,action,...rest});
let health;
for(let i=0;i<34;i++){
 try{
  const r=await fetch(base+'/api/health',{signal:AbortSignal.timeout(15000)});
  if(r.ok){health=await r.json();if(health.version===BUILD_VERSION)break}
  console.log('WAIT_FOR_DEPLOY',i+1,'version',health?.version);
 }catch(e){console.log('WAIT_FOR_DEPLOY',i+1,String(e?.message||e).slice(0,100))}
 await pause(4500);
}
assert.equal(health?.version,BUILD_VERSION,'Published Worker did not match deployed build');
assert.equal(health.chainId,1672);
assert.equal(health.signing,false);assert.equal(health.broadcast,false);
const sender='0x08cd62babd8Dac7404504792Df30C12fC5384Df5';
const recipient='0x2222222222222222222222222222222222222222';
const firstDueAt=new Date(Date.now()+22000).toISOString();
const key=randomUUID();
const created=await call(key,'create',{
 title:'Automated Reviewer Demo - Weekly Subscription',
 sender,recipient,token:'USDC',amount:'1.00',frequency:'weekly',firstDueAt
});
assert.equal(created.status,201);
assert.equal(created.ok,true);
assert.equal(created.schedule.history.length,0);
assert.equal(created.schedule.state,'ACTIVE');
console.log('LIVE_SCHEDULE_CREATED',JSON.stringify({frequency:'weekly',firstDueAt,
 nextDueAt:created.schedule.nextDueAt,privateKeyRedacted:true}));
const before=await call(key,'state');
assert.equal(before.ok,true);
assert.equal(before.schedule.history.length,0);
await pause(Math.max(0,Date.parse(firstDueAt)+2000-Date.now()));
const due=await call(key,'state');
assert.equal(due.ok,true);
assert.equal(due.schedule.history.length,1);
const period=due.schedule.history[0];
assert.equal(period.status,'PENDING');
assert.equal(period.id,firstDueAt);
assert.equal(period.unsignedTemplate.signed,false);
assert.equal(period.unsignedTemplate.broadcast,false);
const again=await call(key,'state');
assert.equal(again.schedule.history.length,1);
assert.equal(again.schedule.history[0].id,period.id);
console.log('DUE_PERIOD_UNIQUE',JSON.stringify({due:period.id,status:period.status,
 historyLength:again.schedule.history.length,nextDueAt:due.schedule.nextDueAt}));
let reviewed;
for(let i=0;i<4;i++){
 reviewed=await call(key,'review',{periodId:period.id});
 if(reviewed.ok)break;
 await pause((i+1)*900);
}
assert.equal(reviewed.ok,true,'On-chain review failed');
assert.equal(reviewed.ready,true,'Live sender had insufficient USDC/PROS or gas estimation failed');
assert.equal(reviewed.payment.status,'READY');
assert.equal(reviewed.payment.review.checks.every(x=>x.ok),true);
const draft=reviewed.payment.unsigned;
assert.equal(draft.chainId,'0x688');
assert.equal(draft.from.toLowerCase(),sender.toLowerCase());
assert.equal(draft.to.toLowerCase(),USDC.toLowerCase());
assert.equal(draft.value,'0x0');
const [recipientOutput,baseUnits]=ERC20.decodeFunctionData('transfer',draft.data);
assert.equal(recipientOutput.toLowerCase(),recipient.toLowerCase());
assert.equal(baseUnits,1000000n);
assert.ok(draft.nonce&&draft.gas&&draft.gasPrice);
assert.equal(draft.signed,false);assert.equal(draft.broadcast,false);
console.log('LIVE_UNSIGNED_DUE_PAYMENT_VERIFIED',JSON.stringify({
 amount:'1 USDC',status:'READY',block:reviewed.payment.review.block,
 gasReservePROS:reviewed.payment.review.gasReserve,nonce:draft.nonce,
 selector:draft.data.slice(0,10),signed:false,broadcast:false}));
const badHash=await call(key,'submit',{periodId:period.id,txHash:'not-a-hash'});
assert.equal(badHash.ok,false);
const fakeHash='0x'+'e'.repeat(64);
const submitted=await call(key,'submit',{periodId:period.id,txHash:fakeHash});
assert.equal(submitted.ok,true);
assert.equal(submitted.payment.status,'SUBMITTED','Unmined hash must not become PAID');
const duplicate=await call(key,'submit',{periodId:period.id,txHash:fakeHash});
assert.equal(duplicate.ok,true);
assert.equal(duplicate.idempotent,true);
const after=await call(key,'state');
assert.equal(after.ok,true);
assert.equal(after.schedule.history[0].status,'SUBMITTED');
assert.equal(after.schedule.history.filter(x=>x.id===period.id).length,1);
console.log('NO_FALSE_PAID_FOR_UNKNOWN_HASH',JSON.stringify({status:'SUBMITTED',
 doublePayBlocked:true,unknownHashNotAcceptedAsPaid:true}));

const badKey=randomUUID(),failDue=new Date(Date.now()+8000).toISOString();
const failCreated=await call(badKey,'create',{
 title:'Insufficient Balance Reviewer Example',
 sender:'0x1111111111111111111111111111111111111111',
 recipient,token:'USDC',amount:'100',frequency:'monthly',firstDueAt:failDue
});
assert.equal(failCreated.ok,true);
await pause(Math.max(0,Date.parse(failDue)+1200-Date.now()));
const failState=await call(badKey,'state');assert.equal(failState.ok,true);
assert.equal(failState.schedule.history.length,1);
const failPeriod=failState.schedule.history[0];
const failReview=await call(badKey,'review',{periodId:failPeriod.id});
assert.equal(failReview.ok,true);
assert.equal(failReview.ready,false);
assert.equal(failReview.payment.status,'FAILED');
assert.match(failReview.payment.reason,/not enough|insufficient/i);
const retried=await call(badKey,'retry',{periodId:failPeriod.id});
assert.equal(retried.ok,true);
assert.equal(retried.payment.status,'PENDING');
assert.equal(retried.schedule.history.length,1);
console.log('INSUFFICIENT_BALANCE_FAILED_AND_RETRY_VERIFIED',JSON.stringify({
 failedBeforeRetry:true,retryStatus:'PENDING',historyCount:1,
 failedReason:failReview.payment.reason}));
const evidence={
 schema:'pharos-recurring-payment-live-review-v1',
 observedAtUtc:new Date().toISOString(),
 worker:base,chainId:1672,version:BUILD_VERSION,
 firstDueAt,frequency:'weekly',periodId:period.id,
 periodicAlarmChecks:{uniqueDueSlot:true,historyLength:1,nextDueAt:due.schedule.nextDueAt},
 verifiedDraft:{
  status:'READY',symbol:'USDC',amount:'1.00',block:reviewed.payment.review.block,
  tokenBalance:reviewed.payment.review.tokenBalance,
  gasReservePROS:reviewed.payment.review.gasReserve,
  contract:USDC,calldataSelector:draft.data.slice(0,10),
  recipient,hasGasNonce:Boolean(draft.gas&&draft.nonce),signed:false,broadcast:false
 },
 receiptSafety:{unknownHashNotPaid:true,afterUnknownHashStatus:'SUBMITTED',
  duplicateSubmissionIdempotent:true},
 insufficientBalance:{status:'FAILED',explicitRetry:'PENDING',periodCountAfterRetry:1},
 walletOwner:'Public third-party sample EOA; project does not control funds',
 note:'No payment was signed or broadcast. Real PAID requires a separate confirmed chain receipt with exact matching transaction fields.'
};
await mkdir('proof',{recursive:true});
await writeFile('proof/deployed-live-evidence.json',JSON.stringify(evidence,null,2)+'\n');
console.log('RECURRING_PAYMENT_WORKER_LIVE_SUCCESS',JSON.stringify({
 chainId:1672,verifiedDraft:true,duePeriodUnique:true,
 receiptPendingNotPaid:true,insufficientBalanceFailed:true,retrySafe:true,
 noSigning:true,noBroadcast:true,artifact:'proof/deployed-live-evidence.json'
}));
