import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../contexts/DataContext';
import { Currency } from '../types';
import { savingsBalance, savingsInterest, SavingsEvent } from '../utils/savings';
import { formatMoney, parseMoneyInput, sumMoney } from '../utils/money';
import { toLocalYMD, parseDate } from '../utils/date';
import { makeId } from '../utils/id';
import BottomSheet from './BottomSheet';

const labels={deposit:'存入',withdraw:'提取',interest:'利息',transfer:'轉帳'};
export default function SavingsPanel(){
 const {savingsAccounts:accounts,transactions,currency,saveSavingsAccount,addSavingsEvent}=useData();
 const navigate=useNavigate();
 const [selected,setSelected]=useState('');
 const [sheet,setSheet]=useState<'new'|SavingsEvent['kind']|null>(null);
 const [name,setName]=useState(''),[unit,setUnit]=useState(currency),[amount,setAmount]=useState(''),[date,setDate]=useState(toLocalYMD(new Date())),[note,setNote]=useState(''),[destination,setDestination]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);const lock=useRef(false),operation=useRef('');
 const account=accounts.find(a=>a.id===selected);
 const today=toLocalYMD(new Date());
 const open=(action:typeof sheet)=>{operation.current=makeId('savings');setSheet(action);setAmount('');setName('');setDate(today);setNote('');setDestination('');setError('');};
 const interest=account?savingsInterest(account,transactions):[];
 async function submit(e:React.FormEvent){
  e.preventDefault();if(lock.current)return;lock.current=true;setBusy(true);setError('');
  try{
   const value=parseMoneyInput(amount,account && sheet!=='new'?account.currency:unit);
   if(value===null || value<0 || (sheet!=='new' && value===0))throw new Error('請輸入有效金額');
   if(sheet==='new'){await saveSavingsAccount({id:operation.current,name:name.trim(),currency:unit,openingBalance:value,events:[]});setSelected(operation.current);}
   else if(account && sheet) await addSavingsEvent(account.id,{id:operation.current,kind:sheet,amount:value,date,note,destinationId:sheet==='transfer'?destination:undefined,transactionId:sheet==='interest'?`${operation.current}-interest`:undefined});
   setSheet(null);
  }catch(e){setError(e instanceof Error?e.message:'未能儲存');}finally{lock.current=false;setBusy(false);}
 }
 return <section aria-label="儲蓄戶口" data-testid="wallet-section-savings">
  <div className="sf-wallet-section-title"><h2>儲蓄</h2><button onClick={()=>open('new')}>＋ 新增戶口</button></div>
  {!account ? <>
   {[...new Set(accounts.map(a=>a.currency))].map(code=><div className="sf-sub-group p-4 mb-3" key={code}><small>{code} 儲蓄總額</small><h3 className="text-2xl font-bold">{formatMoney(sumMoney(accounts.filter(a=>a.currency===code).map(a=>savingsBalance(a,accounts,transactions)),code),code)}</h3></div>)}
   <div className="sf-sub-group">{accounts.map(a=><button key={a.id} className="sf-wallet-row" onClick={()=>setSelected(a.id)}><span><strong>{a.name}</strong><small>{a.currency}</small></span><b>{formatMoney(savingsBalance(a,accounts,transactions),a.currency)}</b></button>)}{!accounts.length && <button className="sf-wallet-empty" onClick={()=>open('new')}>新增第一個儲蓄戶口</button>}</div>
  </>:<>
   <button className="text-primary py-3" onClick={()=>setSelected('')}>返回儲蓄戶口</button>
   <div className="sf-sub-group p-5"><h3>{account.name}</h3><strong className="text-3xl block my-3">{formatMoney(savingsBalance(account,accounts,transactions),account.currency)}</strong><p>本月利息 {formatMoney(sumMoney(interest.filter(t=>toLocalYMD(parseDate(t.date)!).startsWith(today.slice(0,7))).map(t=>t.amount),account.currency),account.currency)}</p><p>今年利息 {formatMoney(sumMoney(interest.filter(t=>toLocalYMD(parseDate(t.date)!).startsWith(today.slice(0,4))).map(t=>t.amount),account.currency),account.currency)}</p></div>
   <div className="grid grid-cols-2 gap-3 my-4">{(Object.keys(labels) as SavingsEvent['kind'][]).map(kind=><button key={kind} className="sf-control rounded-xl p-3" onClick={()=>open(kind)}>{labels[kind]}</button>)}</div>
   <h3>紀錄</h3><div className="sf-sub-group">
   {[...account.events.map(e=>({...e,incoming:false})),...accounts.flatMap(a=>a.events.filter(e=>e.kind==='transfer'&&e.destinationId===account.id).map(e=>({...e,incoming:true})))].sort((a,b)=>b.date.localeCompare(a.date)).map(e=>{const tx=e.kind==='interest'?transactions.find(t=>t.id===e.transactionId):undefined;return <div className="sf-wallet-history" key={e.id}><div><strong>{labels[e.kind]}{e.incoming?'轉入':''}{e.kind==='interest'&&!tx?'（帳目已刪除）':''}</strong><small>{tx?toLocalYMD(parseDate(tx.date)!):e.date} · {tx?.note||e.note}</small></div><span>{formatMoney(e.kind==='interest'?(tx?.amount||0):e.amount,account.currency)}</span>{tx&&<button className="text-primary" onClick={()=>navigate(`/view/${tx.id}`)}>查看</button>}</div>;})}
   <div className="sf-wallet-history"><span>起始結餘</span><b>{formatMoney(account.openingBalance,account.currency)}</b></div></div>
  </>}
  {sheet&&<BottomSheet title={sheet==='new'?'新增儲蓄戶口':labels[sheet]} onClose={()=>{if(!busy)setSheet(null);}}><form onSubmit={submit}><fieldset disabled={busy} className="sf-wallet-form">
   {error&&<p role="alert">{error}</p>}
   {sheet==='new'&&<><label>戶口名稱<input className="sf-field" value={name} maxLength={80} onChange={e=>setName(e.target.value)}/></label><label>戶口幣別<select className="sf-field" value={unit} onChange={e=>setUnit(e.target.value as Currency)}>{Object.values(Currency).map(c=><option key={c}>{c}</option>)}</select></label></>}
   <label>{sheet==='new'?'起始結餘':'金額'}<input className="sf-field" inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
   {sheet!=='new'&&<><label>日期<input type="date" className="sf-field" value={date} max={today} onChange={e=>setDate(e.target.value)}/></label><label>備註<input className="sf-field" value={note} onChange={e=>setNote(e.target.value)}/></label></>}
   {sheet==='transfer'&&<label>轉入戶口<select className="sf-field" value={destination} onChange={e=>setDestination(e.target.value)}><option value="">選擇戶口</option>{accounts.filter(a=>a.id!==account?.id&&a.currency===account?.currency).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>}
   <small>{sheet==='interest'?'實收利息同時記入收入帳目。':'起始結餘、存入、提取及互轉不計收支。'}</small>
   <button className="sf-primary-button">{busy?'儲存中…':'儲存'}</button>
  </fieldset></form></BottomSheet>}
 </section>;
}
