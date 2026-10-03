import { expect, test } from 'vitest';
import { Currency, Subscription, TransactionType } from '../types';
import { processDueSubscriptions } from './subscriptionProcessing';
import { subscriptionForecast, subscriptionMonthly } from './subscriptionSchedule';
import { subscriptionCalendar } from './subscriptionCalendar';
import { createBackupFromSnapshot, parseBackupJson } from './backup';
const base: Subscription = { id:'s', name:'Service', amount:10, currency:Currency.AUD, billingCycle:'Monthly', nextBillingDate:'2026-01-31', recordingMode:'auto', status:'active' };
const process = (s: Subscription, today = new Date(2026,3,30)) => processDueSubscriptions({subscriptions:[s], transactions:[], categories:[{id:'1', name:'訂閱',type:TransactionType.EXPENSE, icon:'x',color:'red'}],defaultCurrency:Currency.AUD, today,makeTransactionId:()=>Math.random().toString()});
test('paused, cancelled and tracking plans never post entries',()=>{
 for (const s of [{...base,status:'paused' as const},{...base,status:'cancelled' as const},{...base,recordingMode:'track' as const}]) expect(process(s).transactions).toHaveLength(0);
});
test('quarterly billing preserves month-end anchor and forecast agrees with posting',()=>{
 const s: Subscription={...base,billingCycle:'Custom',intervalCount:3,intervalUnit:'months'};
 const result=process(s,new Date(2026,9,31));
 expect(result.transactions.map(t=>t.date)).toEqual(['2026-01-31','2026-04-30','2026-07-31','2026-10-31']);
 expect(subscriptionForecast(s,'2026-01-01','2026-10-31').map(t=>t.date)).toEqual(result.transactions.map(t=>t.date));
 expect(subscriptionMonthly(s,'2026-01-01')).toBeCloseTo(10/3);
});
test('trial waits until first payment and scheduled price affects future periods only',()=>{
 const s: Subscription={...base,nextBillingDate:'2026-02-28',trialEndDate:'2026-02-28',priceChange:{amount:15,effectiveDate:'2026-03-01'}};
 expect(process(s,new Date(2026,1,27)).transactions).toHaveLength(0);
 expect(process(s,new Date(2026,2,28)).transactions.map(t=>t.amount)).toEqual([10,15]);
});
test('linked occurrence identity prevents duplicate posting even after transaction date edits',()=>{
 const tx={id:'manual',type:TransactionType.EXPENSE,amount:10,currency:Currency.AUD,date:'2026-02-01',note:'manual',categoryId:'1',subscriptionId:'s',subscriptionOccurrenceDate:'2026-01-31'};
 const result=processDueSubscriptions({subscriptions:[base],transactions:[tx],categories:[],defaultCurrency:Currency.AUD,today:new Date(2026,0,31),makeTransactionId:()=> 'duplicate'});
 expect(result.transactions).toHaveLength(0);
});
test('30-day forecast excludes paused subscriptions and supports weekly multiple charges',()=>{
 expect(subscriptionForecast({...base,status:'paused'},'2026-01-01','2026-02-01')).toEqual([]);
 expect(subscriptionForecast({...base,nextBillingDate:'2026-01-01',billingCycle:'Weekly'},'2026-01-01','2026-01-30')).toHaveLength(5);
});
test('calendar exports and backups preserve subscription features',()=>{
 const s: Subscription={...base,trialEndDate:'2026-01-31',cardId:'card',managementUrl:'https://example.com',priceChange:{amount:20,effectiveDate:'2026-03-01'}};
 const backup=createBackupFromSnapshot({smartfinance_subscriptions:JSON.stringify([s])},'test');
 expect(JSON.parse(parseBackupJson(JSON.stringify(backup)).storage.smartfinance_subscriptions)[0]).toEqual(s);
 expect(subscriptionCalendar(s,new Date(2026,0,1))).toContain('BEGIN:VALARM');
 expect(subscriptionCalendar({...s,status:'cancelled'},new Date(2026,0,1))).not.toContain('BEGIN:VEVENT');
});
