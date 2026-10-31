import { Currency, Transaction, TransactionType } from '../types';
import { parseLocalYMD } from './date';
import { toMinorUnits, fromMinorUnits, parseMoneyInput } from './money';
export const SAVINGS_KEY = 'smartfinance_savings';
export interface SavingsAccount { id:string; name:string; currency:Currency; openingBalance:number; events:SavingsEvent[] }
export interface SavingsEvent { id:string; kind:'deposit'|'withdraw'|'interest'|'transfer'; amount:number; date:string; note:string; destinationId?:string; transactionId?:string }
export function validateSavings(account:SavingsAccount) {
 if(!account || typeof account.id!=='string' || !account.id.trim() || typeof account.name!=='string' || !account.name.trim() || account.name.length>80 || !Object.values(Currency).includes(account.currency) || !Array.isArray(account.events)) throw new Error('儲蓄戶口資料不正確');
 const money=(n:number)=>typeof n==='number' && Number.isFinite(n) && n>=0 && parseMoneyInput(String(n),account.currency)!==null;
 if(!money(account.openingBalance)) throw new Error('起始結餘不正確');
 const ids=new Set<string>();
 for(const e of account.events) {
  if(!e || typeof e.id!=='string' || !e.id || ids.has(e.id) || !['deposit','withdraw','interest','transfer'].includes(e.kind) || !money(e.amount) || e.amount<=0 || !parseLocalYMD(e.date) || typeof e.note!=='string') throw new Error('儲蓄紀錄不正確');
  if(e.kind==='interest' && (typeof e.transactionId!=='string' || !e.transactionId)) throw new Error('利息帳目連結不正確');
  if(e.kind==='transfer' && (typeof e.destinationId!=='string' || !e.destinationId || e.destinationId===account.id)) throw new Error('轉帳戶口不正確');
  ids.add(e.id);
 }
}
export function savingsInterest(account:SavingsAccount, transactions:Transaction[]) {
 const ids=new Set(account.events.filter(e=>e.kind==='interest').map(e=>e.transactionId));
 return transactions.filter(t=>ids.has(t.id) && t.type===TransactionType.INCOME && t.currency===account.currency);
}
export function savingsBalance(account:SavingsAccount, accounts:SavingsAccount[], transactions:Transaction[]) {
 let total=toMinorUnits(account.openingBalance,account.currency);
 for(const e of account.events) if(e.kind!=='interest') total+=toMinorUnits(e.amount,account.currency)*(e.kind==='deposit'?1:-1);
 for(const a of accounts) for(const e of a.events) if(e.kind==='transfer' && e.destinationId===account.id && a.currency===account.currency) total+=toMinorUnits(e.amount,account.currency);
 for(const tx of savingsInterest(account,transactions)) total+=toMinorUnits(tx.amount,account.currency);
 return fromMinorUnits(total,account.currency);
}
