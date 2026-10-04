import { describe, it, expect } from 'vitest';
import { AnnualReserve, Currency, Transaction, TransactionType } from '../types';
import { incomeBySource, nextAnnualDate, reserveProgress, validateReserve, RESERVES_KEY } from './planning';
import { backupToCsv, parseBackupCsv, parseBackupJson, mergeBackupSnapshots } from './backup';
import { editRecurringTransactions } from './recurringTransactions';
const plan: AnnualReserve = {id:'rego',name:'Rego',currency:Currency.AUD,target:1200,reserved:200,dueDate:'2027-02-15'};
const income: Transaction = {id:'income',type:TransactionType.INCOME,categoryId:'7',amount:100,currency:Currency.AUD,date:'2026-10-04',note:'',incomeSource:'游泳教班'};
describe('income tracking and annual reserves',()=>{
 it('groups actual incomes by month, source and currency without guessing old sources',()=>{
  const result = incomeBySource([income,{...income,id:'2',amount:50,incomeSource:' 私教 '},{...income,id:'3',amount:25,incomeSource:undefined},{...income,id:'4',currency:Currency.HKD},{...income,id:'5',type:TransactionType.EXPENSE},{...income,id:'6',date:'2026-09-01'}],'2026-10',Currency.AUD,Currency.HKD);
  expect(result.total).toBe(175); expect(result.groups.map(g=>g.source)).toEqual(['游泳教班','私教','未指定來源']);
  expect(result.groups[0].share).toBeCloseTo(100/175*100);
 });
 it('uses minor units and follows edits or deletions',()=>{
  expect(incomeBySource([{...income,amount:0.1},{...income,id:'2',amount:0.2}],'2026-10',Currency.AUD,Currency.AUD).total).toBe(0.3);
  expect(incomeBySource([{...income,incomeSource:'新來源'}],'2026-10',Currency.AUD,Currency.AUD).groups[0].source).toBe('新來源');
  expect(incomeBySource([],'2026-10',Currency.AUD,Currency.AUD).total).toBe(0);
 });
 it('reserves before the due month and rounds up to currency precision',()=>{
  expect(reserveProgress(plan,'2026-10-04')).toMatchObject({remaining:1000,months:4,monthly:250,overdue:false});
  expect(reserveProgress({...plan,target:100,reserved:0,dueDate:'2027-01-01'},'2026-10-04').monthly).toBe(33.34);
  expect(reserveProgress({...plan,target:100,reserved:0,currency:Currency.JPY,dueDate:'2027-01-01'},'2026-10-04').monthly).toBe(34);
 });
 it('handles due-today, overdue and overfunded plans without negative amounts',()=>{
  expect(reserveProgress(plan,'2027-02-15')).toMatchObject({monthly:1000,months:1,overdue:false});
  expect(reserveProgress(plan,'2027-02-16')).toMatchObject({monthly:1000,overdue:true});
  expect(reserveProgress({...plan,reserved:1300},'2026-10-04')).toMatchObject({remaining:0,monthly:0,percent:100});
  expect(nextAnnualDate('2028-02-29')).toBe('2029-02-28');
 });
 it('rejects malformed reserve data',()=>{
  for(const changes of [{target:0},{reserved:-1},{reserved:Infinity},{dueDate:'invalid'},{name:''},{currency:'XXX'},{target:0.001}]) expect(()=>validateReserve({...plan,...changes} as AnnualReserve)).toThrow();
 });
 it('preserves reserves and income sources in JSON, CSV and nonduplicating merges',()=>{
  const storage = {[RESERVES_KEY]:JSON.stringify([plan]),smartfinance_transactions:JSON.stringify([income])};
  const backup = parseBackupJson(JSON.stringify({format:'smartfinance-backup',storage}));
  expect(parseBackupCsv(backupToCsv(backup)).storage).toEqual(backup.storage);
  expect(JSON.parse(mergeBackupSnapshots(backup.storage,backup.storage)[RESERVES_KEY])).toEqual([plan]);
  expect(JSON.parse(backup.storage.smartfinance_transactions)[0].incomeSource).toBe('游泳教班');
 });
 it('one-off recurring income edits do not change future source names',()=>{
  const rows=editRecurringTransactions([{...income,recurrence:'monthly',isRecurring:true}],income.id,{incomeSource:'一次收入'},'only');
  expect(rows[0].incomeSource).toBe('一次收入');
  expect(rows[0].recurrenceTemplate?.incomeSource).toBe('游泳教班');
 });
});
