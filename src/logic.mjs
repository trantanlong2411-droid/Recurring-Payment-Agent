import {getAddress,parseUnits,Interface} from 'ethers';
export const CHAIN_ID=1672;
export const RPC='https://rpc.pharos.xyz';
export const USDC='0xC879C018dB60520F4355C26eD1a6D572cdAC1815';
export const TOKEN={
 USDC:{symbol:'USDC',address:USDC,decimals:6,kind:'erc20'},
 PROS:{symbol:'PROS',address:null,decimals:18,kind:'native'}
};
export const ERC20=new Interface([
 'function balanceOf(address) view returns(uint256)',
 'function decimals() view returns(uint8)',
 'function symbol() view returns(string)',
 'function transfer(address,uint256) returns(bool)',
 'event Transfer(address indexed from,address indexed to,uint256 value)'
]);
export const hex=x=>'0x'+BigInt(x).toString(16);
const ADDRESS_ZERO='0x0000000000000000000000000000000000000000';
export function address(value){
 try{const a=getAddress(String(value||''));return a===ADDRESS_ZERO?null:a}catch{return null}
}
export function validateSetup(input,now=Date.now()){
 if(!input||typeof input!=='object')throw Error('Schedule settings are required');
 const sender=address(input.sender),recipient=address(input.recipient);
 if(!sender||!recipient||sender===recipient)throw Error('Enter distinct, valid nonzero sender and recipient addresses');
 const symbol=String(input.token||'').toUpperCase();
 const token=TOKEN[symbol];
 if(!token)throw Error('Only USDC and native PROS are supported');
 const amount=String(input.amount||'').trim();
 if(!/^\d+(?:\.\d+)?$/.test(amount)||!/[1-9]/.test(amount))throw Error('Amount must be a positive decimal number');
 if((amount.split('.')[1]||'').length>token.decimals)throw Error('Too many token decimal places');
 const amountRaw=parseUnits(amount,token.decimals).toString();
 if(BigInt(amountRaw)<=0n)throw Error('Amount cannot be zero');
 const frequency=String(input.frequency||'').toLowerCase();
 if(!['weekly','monthly'].includes(frequency))throw Error('Select weekly or monthly recurring payments');
 const first=Date.parse(String(input.firstDueAt||''));
 if(!Number.isFinite(first)||first<now-3000||first>now+366*86400000)
  throw Error('First due time must be between now and 366 days from now (UTC)');
 const title=String(input.title||'Recurring payment').trim();
 if(!title||title.length>64)throw Error('Payment title must have 1–64 characters');
 return {title,sender,recipient,symbol,amount,amountRaw,tokenAddress:token.address,
  frequency,firstDueAt:new Date(first).toISOString(),anchorDay:new Date(first).getUTCDate()};
}
export function nextPaymentAt(previous,frequency,anchorDay){
 const d=new Date(previous);
 if(!Number.isFinite(d.getTime()))throw Error('Invalid preceding schedule timestamp');
 if(frequency==='weekly')return new Date(d.getTime()+7*86400000).toISOString();
 if(frequency!=='monthly')throw Error('Invalid recurrence');
 const year=d.getUTCFullYear(),month=d.getUTCMonth()+1;
 const base=new Date(Date.UTC(year,month,1,d.getUTCHours(),d.getUTCMinutes(),d.getUTCSeconds()));
 const end=new Date(Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+1,0)).getUTCDate();
 base.setUTCDate(Math.min(anchorDay,end));
 return base.toISOString();
}
export function unsignedTemplate(s){
 const t=TOKEN[s.symbol];if(!t)throw Error('Invalid asset');
 const data=t.kind==='erc20'?ERC20.encodeFunctionData('transfer',[s.recipient,BigInt(s.amountRaw)]):'0x';
 return {chainId:hex(CHAIN_ID),from:s.sender,
  to:t.kind==='erc20'?t.address:s.recipient,
  value:t.kind==='native'?hex(s.amountRaw):'0x0',data,
  signed:false,broadcast:false};
}
export function newSchedule(settings,key,now=Date.now()){
 return {schema:'pharos-recurring-payment-v1',id:key.slice(0,8),title:settings.title,
  sender:settings.sender,recipient:settings.recipient,symbol:settings.symbol,
  amount:settings.amount,amountRaw:settings.amountRaw,tokenAddress:settings.tokenAddress,
  frequency:settings.frequency,anchorDay:settings.anchorDay,
  createdAt:new Date(now).toISOString(),firstDueAt:settings.firstDueAt,
  nextDueAt:settings.firstDueAt,state:'ACTIVE',history:[],lastUpdatedAt:new Date(now).toISOString()};
}
export function advanceDue(s,now=Date.now(),origin='STATE_CATCHUP'){
 if(!s||s.state!=='ACTIVE')return 0;
 let created=0;
 while(Date.parse(s.nextDueAt)<=now&&created<52){
  const dueAt=s.nextDueAt;
  if(!s.history.some(p=>p.dueAt===dueAt)){
   s.history.unshift({id:dueAt,period:s.history.length+1,dueAt,
    preparedAt:new Date(now).toISOString(),status:'PENDING',
    unsignedTemplate:unsignedTemplate(s),attempt:0,txHash:null,
    reason:null,receiptBlock:null,review:null});
   created++;
  }
  s.nextDueAt=nextPaymentAt(dueAt,s.frequency,s.anchorDay);
 }
 if(created)s.lastUpdatedAt=new Date(now).toISOString();
 return created;
}
export function summary(s){
 const history=s.history.map(({unsignedTemplate,review,...p})=>({
  ...p,unsignedTemplate,review:review?{
    observedAt:review.observedAt,block:review.block,tokenBalance:review.tokenBalance,
    nativeBalance:review.nativeBalance,gasReserve:review.gasReserve,checks:review.checks
  }:null
 }));
 return {...s,history,chainId:CHAIN_ID,readOnly:true,
  note:'Only unsigned instructions are prepared automatically. The user must sign in an external wallet and provide a transaction hash for on-chain verification. No automatic payment occurs.'};
}
