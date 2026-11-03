import test from 'node:test';
import assert from 'node:assert/strict';
import {parseUnits} from 'ethers';
import {validateSetup,newSchedule,advanceDue,nextPaymentAt,unsignedTemplate,ERC20,USDC,summary} from '../src/logic.mjs';
import {verifyReceiptFields} from '../src/chain.mjs';
const from='0x1111111111111111111111111111111111111111',to='0x2222222222222222222222222222222222222222';
const key='41111111-1111-4111-8111-111111111111';
const now=Date.parse('2026-11-03T16:00:00Z');
function setup(first='2026-11-03T16:00:20Z',frequency='weekly',asset='USDC'){
 return validateSetup({title:'Rent',sender:from,recipient:to,token:asset,amount:'100',frequency,firstDueAt:first},now)
}
test('validates token, recipient, amount, recurrence and UTC due time',()=>{
 const x=setup();assert.equal(x.amountRaw,'100000000');assert.equal(x.frequency,'weekly');
 const original={title:'Rent',sender:from,recipient:to,token:'USDC',amount:'100',
  frequency:'weekly',firstDueAt:'2026-11-03T16:00:20Z'};
 assert.throws(()=>validateSetup({...original,recipient:from},now),/distinct/);
 assert.throws(()=>validateSetup({...original,token:'DOGE'},now),/USDC/);
 assert.throws(()=>validateSetup({...original,amount:'1.1234567'},now),/decimal/);
 assert.throws(()=>validateSetup({...original,firstDueAt:'2025-01-01T00:00:00Z'},now),/First due/);
});
test('weekly exact UTC and month-end anchor handle February without drift',()=>{
 assert.equal(nextPaymentAt('2026-11-03T16:00:20.000Z','weekly',3),'2026-11-10T16:00:20.000Z');
 assert.equal(nextPaymentAt('2027-01-31T16:00:20Z','monthly',31),'2027-02-28T16:00:20.000Z');
 assert.equal(nextPaymentAt('2027-02-28T16:00:20Z','monthly',31),'2027-03-31T16:00:20.000Z');
});
test('prepares each due time once even when alarm is retried',()=>{
 const s=newSchedule(setup(),key,now);
 assert.equal(advanceDue(s,now+19999),0);
 assert.equal(advanceDue(s,now+20000,'ALARM'),1);
 assert.equal(s.history.length,1);assert.equal(s.history[0].status,'PENDING');
 assert.equal(s.history[0].trigger,'ALARM');
 assert.equal(s.history[0].unsignedTemplate.signed,false);
 assert.equal(advanceDue(s,now+20000),0);assert.equal(s.history.length,1);
 assert.equal(advanceDue(s,Date.parse('2026-11-10T16:00:20Z')),1);
 assert.equal(s.history.length,2);assert.notEqual(s.history[0].id,s.history[1].id);
 const hist=summary(s);
 assert.equal(hist.history.length,2);assert.equal(hist.readOnly,true);
});
test('missed periods are distinct and future alarm points ahead without double count',()=>{
 const s=newSchedule(setup(),key,now);
 const added=advanceDue(s,Date.parse('2026-12-01T16:00:20Z'));
 assert.equal(added,5);
 assert.equal(s.history.length,5);
 assert.equal(new Set(s.history.map(p=>p.dueAt)).size,5);
 assert.ok(Date.parse(s.nextDueAt)>Date.parse('2026-12-01T16:00:20Z'));
});
test('ERC20 unsigned template encodes exact recipient and USDC base amount',()=>{
 const s=newSchedule(setup(),key,now),tx=unsignedTemplate(s);
 assert.equal(tx.chainId,'0x688');assert.equal(tx.to.toLowerCase(),USDC.toLowerCase());
 assert.equal(tx.value,'0x0');assert.ok(tx.data.startsWith('0xa9059cbb'));
 const [recipient,amount]=ERC20.decodeFunctionData('transfer',tx.data);
 assert.equal(recipient,to);assert.equal(amount,parseUnits('100',6));
 assert.equal(tx.signed,false);assert.equal(tx.broadcast,false);
});
test('native PROS template uses value rather than ERC20 calldata',()=>{
 const s=newSchedule(setup('2026-11-03T16:00:20Z','monthly','PROS'),key,now);
 const tx=unsignedTemplate(s);
 assert.equal(tx.to,to);assert.equal(tx.data,'0x');
 assert.equal(BigInt(tx.value),parseUnits('100',18));
});
function fakeReceipt(){
 const s=newSchedule(setup(),key,now);
 advanceDue(s,now+20000);
 const period=s.history[0];period.txHash='0x'+'a'.repeat(64);
 const decoded=ERC20.encodeEventLog(ERC20.getEvent('Transfer'),[from,to,100000000n]);
 const tx={hash:period.txHash,from,to:USDC,input:period.unsignedTemplate.data,value:'0x0'};
 const receipt={transactionHash:period.txHash,status:'0x1',blockNumber:'0xa',
  logs:[{address:USDC,topics:decoded.topics,data:decoded.data}]};
 return {s,period,tx,receipt};
}
test('Paid requires successful matching transaction and ERC20 Transfer log',()=>{
 const {s,period,tx,receipt}=fakeReceipt();
 assert.equal(verifyReceiptFields(s,period,tx,receipt,'0xc').status,'PAID');
 assert.equal(verifyReceiptFields(s,period,tx,receipt,'0xa').status,'SUBMITTED');
 assert.equal(verifyReceiptFields(s,period,tx,null,'0xc').status,'SUBMITTED');
});
test('wrong sender, destination, amount, reverted receipt never become Paid',()=>{
 const {s,period,tx,receipt}=fakeReceipt();
 assert.equal(verifyReceiptFields(s,period,{...tx,from:to},receipt,'0xc').status,'FAILED');
 assert.equal(verifyReceiptFields(s,period,{...tx,to:from},receipt,'0xc').status,'FAILED');
 assert.equal(verifyReceiptFields(s,period,tx,{...receipt,status:'0x0'},'0xc').status,'FAILED');
 assert.equal(verifyReceiptFields(s,period,tx,{...receipt,logs:[]},'0xc').status,'FAILED');
 const wrong=ERC20.encodeEventLog(ERC20.getEvent('Transfer'),[from,to,100000001n]);
 assert.equal(verifyReceiptFields(s,period,tx,
  {...receipt,logs:[{address:USDC,topics:wrong.topics,data:wrong.data}]},'0xc').status,'FAILED');
});
test('missing transaction is still submitted, not Paid',()=>{
 const {s,period}=fakeReceipt();
 assert.equal(verifyReceiptFields(s,period,null,null,'0xb').status,'SUBMITTED');
});
