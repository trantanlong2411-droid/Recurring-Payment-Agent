export const PAGE=String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Manage recurring unsigned USDC or PROS payments on Pharos, with durable alarms, tracked status and on-chain receipt verification.">
<title>Recurring Payment Agent | Pharos</title>
<style>
:root{color-scheme:dark;--bg:#07111f;--pane:#12243a;--pane2:#0c1c31;--line:#334e68;--text:#edf5ff;--muted:#9bb4cf;--teal:#71e5d4;--purple:#b6c2ff;--red:#ff9caa;--yellow:#f8c884}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:radial-gradient(ellipse at 8% -20%,#244c6c,#0b1a30 44%,var(--bg) 86%);font:14px/1.6 system-ui,Segoe UI,sans-serif;color:var(--text)}
main{max-width:1180px;margin:auto;padding:26px 22px 70px}header{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-size:12px;letter-spacing:.08em}
a{color:var(--purple)}.label{border:1px solid #577599;border-radius:99px;padding:4px 9px;letter-spacing:0}.eyebrow{color:var(--teal);font-size:12px;letter-spacing:.1em}
h1{font-size:clamp(44px,7.7vw,82px);line-height:1.02;letter-spacing:-.07em;margin:57px 0 20px}h1 em{font-style:normal;color:var(--purple)}
.lead{font-size:18px;color:#b1c5df;max-width:830px}p{margin:9px 0}.banner{background:#2e2d26;border:1px solid #927b4b;padding:15px;border-radius:13px;color:#ffe0a8;margin:24px 0}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:13px;margin:26px 0}.kpi,.panel{background:rgba(18,33,56,.96);border:1px solid var(--line);border-radius:16px}.kpi{padding:16px}.kpi small{display:block;color:var(--muted);font-size:11px}.kpi b{font-size:23px;line-height:1.3;display:block;overflow-wrap:anywhere}
.panel{padding:24px;margin-bottom:18px}h2{font-size:23px;margin:0 0 12px}h3{font-size:17px;margin:0 0 8px}
input,select{width:100%;padding:12px 13px;background:#09182d;border:1px solid #496785;border-radius:10px;color:var(--text);font:inherit}
input:focus,select:focus{outline:2px solid #91cbeb;outline-offset:1px}
label{display:block;margin:12px 0 6px;color:#c0d1e8;font-size:12px}.inline{display:flex;align-items:flex-start;gap:8px}.inline input{width:auto;margin:3px 0 0;accent-color:var(--teal)}.inline label{margin:0}
button{border:0;border-radius:10px;background:#a7d8f5;color:#09182f;font:750 13px system-ui;padding:12px 16px;cursor:pointer}
button.secondary{background:#314f70;color:#f2f7ff}button.warn{background:#5c4147;color:#ffe1e7}button:disabled{opacity:.43;cursor:not-allowed}
.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.small{font-size:12px;color:var(--muted)}.status{border:1px solid #426382;background:#0b1c34;padding:11px 13px;border-radius:10px;margin:13px 0;overflow-wrap:anywhere}
.good{color:var(--teal)}.bad{color:var(--red)}.amber{color:var(--yellow)}.row{display:flex;align-items:center;gap:10px;justify-content:space-between;flex-wrap:wrap}
.stack{display:grid;gap:12px}.step{display:flex;align-items:flex-start;gap:13px;border:1px solid #324963;border-radius:11px;padding:12px;background:#0d1d32}
.step strong{color:var(--teal)}pre{white-space:pre-wrap;overflow-wrap:anywhere;max-height:310px;overflow:auto;padding:16px;border:1px solid #35526e;border-radius:10px;background:#07172a;font:12px/1.7 ui-monospace,Consolas,monospace}
table{border-collapse:collapse;width:100%;font-size:12px}th,td{border-bottom:1px solid #31455e;text-align:left;padding:12px 9px;vertical-align:top;overflow-wrap:anywhere}th{color:#a4bcd8;font-weight:600}.table-scroll{overflow:auto}
.pill{border:1px solid #496586;border-radius:18px;display:inline-block;padding:2px 9px;font-weight:700}.pill.paid{color:var(--teal)}.pill.failed{color:var(--red)}.pill.pending,.pill.submitted{color:var(--yellow)}.pill.ready{color:var(--purple)}
code{color:#bfcbff;word-break:break-all}footer{margin-top:40px;color:var(--muted);font-size:12px}
[hidden]{display:none!important}
@media(max-width:790px){.grid,.kpis{grid-template-columns:1fr 1fr}h1{margin-top:37px}}
@media(max-width:550px){.grid,.kpis{grid-template-columns:1fr}.panel{padding:16px}main{padding:17px 13px}}
</style></head><body><main>
<header><span>PHAROS / AGENT ARENA <span class="label">MEDIUM · PAYMENTS</span></span><a href="https://github.com/trantanlong2411-droid/Recurring-Payment-Agent" target="_blank" rel="noopener">GitHub source & test evidence ↗</a></header>
<h1>RECURRING<br><em>PAYMENT AGENT</em></h1>
<p class="lead">Schedule rent, subscriptions and payroll-style payments on Pharos Mainnet. Durable background alarms prepare a unique, unsigned payment for every due period. Check balances, review a draft and verify on-chain receipts — all without storing private keys.</p>
<div class="banner"><b>No automatic transfers.</b> This app NEVER signs or sends transactions. A scheduled payment is <b>Pending</b> until you review and sign externally. It becomes <b>Paid</b> only when a matching successful on-chain transaction is verified. A public sample sender is not your wallet, and a prepared unsigned draft does not authorize spending its funds.</div>
<div class="kpis">
<div class="kpi"><small>SCHEDULE STATE</small><b id="kState">Not created</b></div>
<div class="kpi"><small>NEXT SCHEDULED UTC</small><b id="kNext" style="font-size:14px">—</b></div>
<div class="kpi"><small>PENDING / READY</small><b id="kPending">0</b></div>
<div class="kpi"><small>PAID / FAILED</small><b id="kCompleted">0 / 0</b></div>
</div>
<div class="grid">
<section class="panel" id="newPanel">
<h2>01 / Create a recurring payment</h2>
<p class="small">Weekly or monthly with a fixed amount and recipient. Try the 20-second first-due demo to see the background scheduler prepare a real pending period without paying anyone.</p>
<label for="title">Payment description</label><input id="title" maxlength="64" value="Monthly subscription">
<label for="sender">Public sender wallet</label>
<input id="sender" spellcheck="false" value="0x08cd62babd8Dac7404504792Df30C12fC5384Df5">
<label for="recipient">Recipient address (0x...)</label>
<input id="recipient" spellcheck="false" value="0x2222222222222222222222222222222222222222">
<div class="grid">
<div><label for="asset">Asset</label><select id="asset"><option>USDC</option><option>PROS</option></select></div>
<div><label for="amount">Amount per period</label><input id="amount" value="1.00"></div>
</div>
<div class="grid">
<div><label for="frequency">Frequency</label><select id="frequency"><option>weekly</option><option>monthly</option></select></div>
<div><label for="firstDue">First due (your local time)</label><input id="firstDue" type="datetime-local"></div>
</div>
<div class="inline" style="margin-top:14px"><input id="quick" type="checkbox" checked><label for="quick">Quick demo: first payment due in 20 seconds (then repeat weekly/monthly)</label></div>
<div class="actions"><button id="create">Create recurring schedule</button></div>
<p class="status" id="createStatus" role="status">No schedule created yet. Public sample wallet balances can change; each due payment requires a live balance and gas check.</p>
</section>
<section class="panel">
<h2>02 / Open your saved schedule</h2>
<p class="small">Your secret schedule key is a capability. Keep it private: anyone with this key can manage the schedule. It is saved in this browser only for convenience and is never used to sign transactions.</p>
<label for="accessKey">Private schedule access key</label><input id="accessKey" spellcheck="false" placeholder="xxxxxxxx-xxxx-4xxx-xxxx-xxxxxxxxxxxx">
<div class="actions"><button class="secondary" id="open">Open schedule</button><button class="secondary" id="copyKey">Copy key</button><button class="secondary" id="refresh">Refresh now</button></div>
<p class="status" id="loadStatus">No schedule selected.</p>
<div class="stack" style="margin-top:18px">
<div class="step"><strong>01</strong><span>Durable Object creates a unique payment period when due.</span></div>
<div class="step"><strong>02</strong><span>User reviews balances and receives unsigned calldata.</span></div>
<div class="step"><strong>03</strong><span>User signs externally and enters their actual transaction hash.</span></div>
<div class="step"><strong>04</strong><span>Pharos receipt confirms Paid, or reports failure with retry control.</span></div>
</div>
<p class="small">The background alarm runs independently of the browser. The page refreshes every 20 seconds while open.</p>
</section>
</div>
<section id="manage" hidden>
<div class="panel"><div class="row"><h2>03 / Schedule controls</h2><div class="actions"><button class="secondary" id="pause">Pause</button><button class="secondary" id="resume">Resume</button><button class="warn" id="cancel">Cancel schedule</button></div></div>
<div class="status" id="details"></div>
</div>
<div class="grid">
<section class="panel">
<h2>04 / Payment history</h2><p class="small">Each due time has one uniquely tracked period. PENDING and READY are not paid. FAILED can be retried only after checking that no earlier signed transaction remains unresolved.</p>
<div class="table-scroll"><table><thead><tr><th>Due (UTC)</th><th>Status</th><th>Action</th></tr></thead><tbody id="history"><tr><td colspan="3">No due periods yet.</td></tr></tbody></table></div>
</section>
<section class="panel">
<h2>05 / Review payment</h2>
<p class="small" id="selected">Select a due period from history.</p>
<div class="actions"><button id="prepare" disabled>Check balance & prepare unsigned</button><button id="retry" class="secondary" disabled>Retry failed period</button></div>
<div class="status" id="paymentMessage">No payment selected.</div>
<div id="draftPanel" hidden>
<h3>Unsigned transaction (NOT sent)</h3><pre id="draft"></pre>
<div class="actions"><button class="secondary" id="copyDraft">Copy unsigned JSON</button><button class="secondary" id="downloadDraft">Export JSON</button></div>
<label for="txHash">Actual signed transaction hash (only after sending in your own wallet)</label>
<input id="txHash" placeholder="0x... 64 hex chars" spellcheck="false">
<div class="actions"><button class="secondary" id="submitTx">Track real transaction hash</button></div>
<p class="small">Submitting a hash does not mark a payment Paid. Only a successful Pharos receipt from the right sender with exact recipient, amount and calldata qualifies.</p>
</div>
</section></div>
<section class="panel"><h2>06 / Full schedule state for reviewer</h2><pre id="raw">Create or open a schedule to view source-backed data.</pre></section>
</section>
<footer>Pharos Pacific Mainnet (chain 1672) · USDC contract verified from Circle · UTC period history · 0 private keys · 0 automatic signatures · 0 server-side broadcasts. Durable Object SQLite and alarms are used to prepare payment periods while browsers are closed.</footer>
</main><script>
(function(){
 const $=id=>document.getElementById(id);
 let current=null,activePeriod=null,accessKey=localStorage.getItem('pharos-recurring-key')||'';
 $('accessKey').value=accessKey;
 const fmt=s=>s?new Date(s).toISOString().replace('T',' ').replace('.000Z',' UTC'):'—';
 const status=(id,msg)=>$(id).textContent=msg;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 async function api(action,body={}){
  const key=($('accessKey').value||accessKey).trim();
  const response=await fetch('/api/schedule',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({key,action,...body})});
  const data=await response.json();
  if(!response.ok||!data.ok)throw Error(data.error||'Unknown API failure');
  return data;
 }
 function update(s){
  current=s;
  $('manage').hidden=false;
  $('kState').textContent=s.state;$('kNext').textContent=fmt(s.nextDueAt);
  $('kPending').textContent=s.history.filter(p=>['PENDING','READY','SUBMITTED'].includes(p.status)).length;
  $('kCompleted').textContent=s.history.filter(p=>p.status==='PAID').length+' / '+s.history.filter(p=>p.status==='FAILED').length;
  $('details').textContent=s.title+' · '+s.amount+' '+s.symbol+' '+s.frequency+' · Sender '+s.sender+' · Recipient '+s.recipient+' · Next '+fmt(s.nextDueAt);
  $('pause').disabled=s.state!=='ACTIVE';$('resume').disabled=s.state!=='PAUSED';$('cancel').disabled=s.state==='CANCELLED';
  $('raw').textContent=JSON.stringify(s,null,2);
  const tbody=$('history');tbody.replaceChildren();
  if(!s.history.length){const row=tbody.insertRow();const c=row.insertCell();c.colSpan=3;c.textContent='No payment due yet. The alarm will prepare it at '+fmt(s.nextDueAt);return;}
  for(const p of s.history){
   const tr=tbody.insertRow();tr.insertCell().textContent=fmt(p.dueAt);
   const c=tr.insertCell();const b=document.createElement('span');b.className='pill '+p.status.toLowerCase();b.textContent=p.status;c.appendChild(b);
   const td=tr.insertCell();const btn=document.createElement('button');btn.className='secondary';btn.textContent='Inspect';btn.onclick=()=>selectPeriod(p.id);
   td.appendChild(btn);
  }
  if(activePeriod&&s.history.find(p=>p.id===activePeriod))selectPeriod(activePeriod,false);
 }
 function selectPeriod(id,resetDraft=true){
  activePeriod=id;const p=current.history.find(x=>x.id===id);if(!p)return;
  status('selected','Period '+fmt(p.dueAt)+' · '+p.status);
  status('paymentMessage',p.reason||((p.status==='PAID')?'Confirmed on-chain at block '+p.receiptBlock:('Status '+p.status+'. No funds have been moved by this Worker.')));
  $('prepare').disabled=!['PENDING','FAILED','READY'].includes(p.status);
  $('retry').disabled=p.status!=='FAILED';
  $('draftPanel').hidden=!p.unsigned;
  if(p.unsigned)$('draft').textContent=JSON.stringify(p.unsigned,null,2);
  if(resetDraft)$('txHash').value='';
 }
 async function refresh(silent=false){
  if(!$('accessKey').value.trim())return;
  try{const r=await api('state');update(r.schedule);status('loadStatus','Schedule loaded from persistent SQLite. Refreshed '+new Date().toISOString());}
  catch(e){if(!silent)status('loadStatus','Unable to load: '+e.message)}
 }
 async function change(action){
  try{const d=await api(action);update(d.schedule);status('loadStatus','Schedule '+action+' accepted.');}
  catch(e){status('loadStatus','Action failed: '+e.message)}
 }
 $('create').onclick=async()=>{
  $('create').disabled=true;status('createStatus','Creating the durable schedule and alarm…');
  try{
   const key=crypto.randomUUID();const due=$('quick').checked?new Date(Date.now()+20000).toISOString():
     new Date($('firstDue').value).toISOString();
   const body={key,action:'create',title:$('title').value,sender:$('sender').value.trim(),
    recipient:$('recipient').value.trim(),token:$('asset').value,amount:$('amount').value,
    frequency:$('frequency').value,firstDueAt:due};
   const response=await fetch('/api/schedule',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
   const j=await response.json();if(!response.ok||!j.ok)throw Error(j.error||'Could not create schedule');
   accessKey=key;localStorage.setItem('pharos-recurring-key',key);$('accessKey').value=key;
   activePeriod=null;update(j.schedule);status('createStatus','Schedule created! Save your private key. The first due event is '+fmt(due)+'.');
   status('loadStatus','Schedule loaded. Access key stored in this browser only.');
  }catch(e){status('createStatus','Creation failed: '+e.message)}
  finally{$('create').disabled=false}
 };
 $('quick').onchange=()=>{$('firstDue').disabled=$('quick').checked};
 $('firstDue').disabled=true;
 $('open').onclick=async()=>{accessKey=$('accessKey').value.trim();localStorage.setItem('pharos-recurring-key',accessKey);activePeriod=null;await refresh()};
 $('refresh').onclick=()=>refresh();
 $('copyKey').onclick=()=>navigator.clipboard.writeText($('accessKey').value.trim()).then(()=>status('loadStatus','Access key copied. Keep it private.')).catch(()=>status('loadStatus','Copy not available. Select the key manually.'));
 $('pause').onclick=()=>change('pause');$('resume').onclick=()=>change('resume');$('cancel').onclick=()=>{
  if(confirm('Cancel future recurring periods? Existing submitted transactions will still be verified.'))change('cancel');
 };
 $('prepare').onclick=async()=>{
  $('prepare').disabled=true;status('paymentMessage','Checking real Pharos token balance, PROS gas and nonce…');
  try{const r=await api('review',{periodId:activePeriod});update(r.schedule);
   status('paymentMessage',r.ready?'Unsigned transaction READY. Copy it and sign only from a wallet you own.':
    'FAILED: '+r.payment.reason+'. No draft will be generated until the issue is resolved.');
  }catch(e){status('paymentMessage','Cannot prepare payment: '+e.message)}
  finally{if(current)selectPeriod(activePeriod,false)}
 };
 $('retry').onclick=async()=>{
  try{const r=await api('retry',{periodId:activePeriod});update(r.schedule);status('paymentMessage','The failed period is pending again. Verify and prepare it once more.');}
  catch(e){status('paymentMessage','Retry blocked: '+e.message)}
 };
 $('submitTx').onclick=async()=>{
  const txHash=$('txHash').value.trim();
  if(!/^0x[0-9a-f]{64}$/i.test(txHash)){status('paymentMessage','Please enter a real 32-byte transaction hash.');return}
  try{const r=await api('submit',{periodId:activePeriod,txHash});update(r.schedule);
   const p=r.schedule.history.find(q=>q.id===activePeriod);
   status('paymentMessage','Submitted receipt check: '+p.status+'. '+(p.reason||''));
  }catch(e){status('paymentMessage','Hash rejected: '+e.message)}
 };
 $('copyDraft').onclick=()=>navigator.clipboard.writeText($('draft').textContent).catch(()=>status('paymentMessage','Clipboard unavailable'));
 $('downloadDraft').onclick=()=>{
  if(!current||!activePeriod)return;
  const p=current.history.find(x=>x.id===activePeriod);if(!p?.unsigned)return;
  const blob=new Blob([JSON.stringify({schema:'pharos-recurring-unsigned-v1',
   schedule:current.id,period:p.id,payment:p.unsigned,
   signed:false,transactionBroadcast:false,exportedAt:new Date().toISOString()},null,2)+'\n'],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='pharos-recurring-unsigned-'+Date.now()+'.json';a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),1000);
 };
 if(accessKey)refresh(true);
 setInterval(()=>{if($('accessKey').value.trim())refresh(true)},20000);
})();
</script></body></html>`;
