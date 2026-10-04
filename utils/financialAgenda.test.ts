import { expect, it } from 'vitest';
import { Currency, Subscription, WalletItem, TransactionType } from '../types';
import { financialAgenda } from './financialAgenda';
const sub: Subscription = {id:'s', name:'Medibank', amount:25, billingCycle:'Monthly', nextBillingDate:'2026-10-03', recordingMode:'track'};
const voucher: WalletItem = {id:'v',name:'禮券',kind:'voucher',currency:Currency.AUD,openingBalance:1,notes:'',events:[],expiresOn:'2026-10-31'};
it('combines upcoming recurring charges and unspent card expiry, omits posted charges and paused plans', () => {
 const events=financialAgenda([sub,{...sub,id:'paused',status:'paused'}],[voucher,{...voucher,id:'empty',openingBalance:0}],[],[],[],'2026-10-01','2026-10-31');
 expect(events.map(e=>[e.date,e.label])).toEqual([['2026-10-03','預計扣款'],['2026-10-31','卡券到期']]);
 const posted={id:'t',amount:25,type:TransactionType.EXPENSE,date:'2026-10-03',note:'',categoryId:'c',subscriptionId:'s',subscriptionOccurrenceDate:'2026-10-03'};
 expect(financialAgenda([sub],[voucher],[posted],[],[],'2026-10-01','2026-10-31')).toHaveLength(1);
 expect(financialAgenda([],[voucher],[],[],[],'2026-11-01','2026-11-30')).toHaveLength(0);
});
