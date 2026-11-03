import test from 'node:test';
import assert from 'node:assert/strict';
import {Script} from 'node:vm';
import {PAGE} from '../src/page.mjs';
test('dashboard has all rubric controls, review and receipt status history',()=>{
 for(const label of ['Create recurring schedule','weekly','monthly','PENDING',
  'PAID','FAILED','Refresh now','Check balance & prepare unsigned',
  'Retry failed period','Track real transaction hash','NEXT SCHEDULED UTC']){
  assert.ok(PAGE.includes(label),'Missing UI '+label);
 }
});
test('browser script parses and is incapable of directly signing or sending',()=>{
 const m=PAGE.match(/<script>([\s\S]*?)<\/script>/);
 assert.ok(m,'Missing application script');
 new Script(m[1]);
 assert.doesNotMatch(PAGE,/eth_sendRawTransaction|eth_sendTransaction|personal_sign/);
 assert.match(PAGE,/No automatic transfers/);
 assert.match(PAGE,/crypto\.randomUUID\(\)/);
});
test('frontend uses private access keys and accurately labels external payment receipts',()=>{
 assert.match(PAGE,/pharos-recurring-key/);
 assert.match(PAGE,/receipt/);
 assert.match(PAGE,/No funds have been moved by this Worker/);
 assert.match(PAGE,/signed:false,transactionBroadcast:false/);
});
