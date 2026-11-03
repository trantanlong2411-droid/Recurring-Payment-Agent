import {formatUnits} from 'ethers';
import {CHAIN_ID,RPC,TOKEN,USDC,ERC20,hex,unsignedTemplate} from './logic.mjs';
let rpcId=0;
export async function rpc(method,params=[]){
 const allowed=new Set(['eth_chainId','eth_blockNumber','eth_getBalance','eth_getCode',
  'eth_call','eth_gasPrice','eth_estimateGas','eth_getTransactionCount',
  'eth_getTransactionByHash','eth_getTransactionReceipt']);
 if(!allowed.has(method))throw Error('Forbidden JSON-RPC method: '+method);
 let last;
 for(let i=0;i<4;i++){
  try{
   const id=++rpcId;
   const response=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id,method,params}),signal:AbortSignal.timeout(12000)});
   if(!response.ok)throw Error('Pharos RPC HTTP '+response.status);
   const v=await response.json();
   if(v.error)throw Error(method+': '+String(v.error.message||'RPC error').slice(0,140));
   if(v.id!==id||v.jsonrpc!=='2.0')throw Error('Pharos RPC response identity mismatch');
   return v.result;
  }catch(e){last=e;if(i<3)await new Promise(r=>setTimeout(r,(i+1)*350))}
 }
 throw Error(String(last?.message||last||'RPC unavailable').slice(0,190));
}
const bigint=(value,label)=>{
 if(typeof value!=='string'||!/^0x[0-9a-f]+$/i.test(value))throw Error('Missing '+label+' from Pharos');
 return BigInt(value);
};
async function erc20Read(method,args,block){
 const data=await rpc('eth_call',[{to:USDC,data:ERC20.encodeFunctionData(method,args)},block]);
 if(typeof data!=='string'||data==='0x')throw Error('USDC on-chain '+method+' returned no value');
 return ERC20.decodeFunctionResult(method,data)[0];
}
export async function verifyAndPrepare(schedule,payment){
 const current=await rpc('eth_chainId',[]);
 if(bigint(current,'chain ID')!==BigInt(CHAIN_ID))throw Error('Unexpected network');
 const block=await rpc('eth_blockNumber',[]);
 bigint(block,'block number');
 const gasPrice=bigint(await rpc('eth_gasPrice',[]),'gas price');
 if(gasPrice===0n)throw Error('Network gas price unavailable');
 const native=bigint(await rpc('eth_getBalance',[schedule.sender,block]),'native balance');
 const asset=TOKEN[schedule.symbol];
 let balance=native;
 if(asset.kind==='erc20'){
  const code=await rpc('eth_getCode',[USDC,block]);
  if(!code||code==='0x')throw Error('USDC contract was not found');
  const [symbol,decimals,rawBalance]=await Promise.all([
   erc20Read('symbol',[],block),erc20Read('decimals',[],block),
   erc20Read('balanceOf',[schedule.sender],block)
  ]);
  if(String(symbol).toUpperCase()!=='USDC'||Number(decimals)!==6)
   throw Error('The USDC contract metadata is not verified');
  balance=BigInt(rawBalance);
 }
 const needed=BigInt(schedule.amountRaw);
 const sufficient=balance>=needed;
 let estimate=null,gasError=null;
 const template=unsignedTemplate(schedule);
 const tx={from:template.from,to:template.to,value:template.value,data:template.data};
 if(sufficient){
  try{estimate=bigint(await rpc('eth_estimateGas',[tx]),'gas estimate');
   if(estimate===0n)throw Error('Empty gas estimate');
  }catch(e){gasError=String(e?.message||e).slice(0,150)}
 }
 const gas=estimate===null?null:(estimate*120n+99n)/100n;
 const gasReserve=gas===null?null:gas*gasPrice;
 const enoughGas=gasReserve!==null&&native>=gasReserve+(asset.kind==='native'?needed:0n);
 const checks=[
  {name:'Pharos Mainnet 1672',ok:true},
  {name:'Verified asset contract',ok:true},
  {name:'Sufficient '+schedule.symbol+' balance',ok:sufficient},
  {name:'Live gas estimation',ok:gas!==null},
  {name:'Sufficient native PROS for gas',ok:enoughGas}
 ];
 const ready=checks.every(c=>c.ok);
 const nonce=ready?bigint(await rpc('eth_getTransactionCount',[schedule.sender,'pending']),'pending nonce'):null;
 const review={observedAt:new Date().toISOString(),block:bigint(block,'block number').toString(),
  tokenBalance:formatUnits(balance,asset.decimals),nativeBalance:formatUnits(native,18),
  gasReserve:gasReserve===null?null:formatUnits(gasReserve,18),checks,
  message:ready?'Ready for external user wallet signing':
    !sufficient?'Not enough '+schedule.symbol+' to cover this period':
    gasError||'Insufficient PROS for gas'};
 const unsigned=ready?{...template,gas:hex(gas),gasPrice:hex(gasPrice),nonce:hex(nonce)}:null;
 return {ok:ready,review,unsigned,reason:ready?null:review.message};
}
export function verifyReceiptFields(schedule,payment,tx,receipt,latestBlock){
 if(!tx||!receipt)return {status:'SUBMITTED',reason:'Waiting for a transaction receipt'};
 if(tx.hash?.toLowerCase()!==payment.txHash?.toLowerCase()||
    receipt.transactionHash?.toLowerCase()!==payment.txHash?.toLowerCase())
  return {status:'FAILED',reason:'Transaction hash mismatches submitted hash'};
 if(tx.from?.toLowerCase()!==schedule.sender.toLowerCase())
  return {status:'FAILED',reason:'Transaction was not sent by the configured sender'};
 const block=bigint(receipt.blockNumber,'receipt block');
 if(bigint(latestBlock,'latest block')<block+1n)
  return {status:'SUBMITTED',reason:'Waiting for one additional confirmation'};
 if(bigint(receipt.status,'receipt status')!==1n)
  return {status:'FAILED',reason:'Transaction reverted on chain'};
 const template=unsignedTemplate(schedule);
 if(tx.to?.toLowerCase()!==template.to.toLowerCase())
  return {status:'FAILED',reason:'Confirmed transaction has the wrong destination'};
 if((tx.input||tx.data||'0x').toLowerCase()!==(template.data||'0x').toLowerCase())
  return {status:'FAILED',reason:'Confirmed transaction calldata differs from reviewed payment'};
 if(bigint(tx.value,'transaction value')!==BigInt(template.value))
  return {status:'FAILED',reason:'Confirmed transaction value does not match payment'};
 if(schedule.symbol==='USDC'){
  const matching=(receipt.logs||[]).some(l=>{
   if(l.address?.toLowerCase()!==USDC.toLowerCase())return false;
   try{const parsed=ERC20.parseLog({topics:l.topics,data:l.data});
    return parsed?.name==='Transfer'&&
      parsed.args[0].toLowerCase()===schedule.sender.toLowerCase()&&
      parsed.args[1].toLowerCase()===schedule.recipient.toLowerCase()&&
      parsed.args[2]===BigInt(schedule.amountRaw);
   }catch{return false}
  });
  if(!matching)return {status:'FAILED',reason:'No matching confirmed USDC Transfer event in transaction receipt'};
 }
 return {status:'PAID',reason:null,receiptBlock:block.toString()};
}
export async function verifySubmittedHash(schedule,payment){
 const id=await rpc('eth_chainId',[]);
 if(bigint(id,'network')!==1672n)throw Error('Wrong network');
 const [tx,receipt,block]=await Promise.all([
  rpc('eth_getTransactionByHash',[payment.txHash]),
  rpc('eth_getTransactionReceipt',[payment.txHash]),
  rpc('eth_blockNumber',[])
 ]);
 return verifyReceiptFields(schedule,payment,tx,receipt,block);
}
