import { describe, expect, it } from 'vitest';
import { Currency, Transaction, TransactionType, WalletItem } from '../types';
import { validateWalletItem, validateWalletLedger, validateWalletPayment, walletBalance, walletStatus } from './wallet';
import { backupToCsv, parseBackupCsv, parseBackupJson, mergeBackupSnapshots } from './backup';
const card: WalletItem = { id: 'card', name: '超市卡', kind: 'stored', currency: Currency.HKD, openingBalance: 100, notes: '', events: [{ id:'topup', kind:'add', amount:20, date:'2026-10-01', note:'' }] };
const tx: Transaction = { id:'tx', type:TransactionType.EXPENSE, categoryId:'food', currency:Currency.HKD, amount:30, date:'2026-10-02', note:'晚餐', walletItemId:card.id };
const snapshot = (items: WalletItem[], rows: Transaction[]) => parseBackupJson(JSON.stringify({format:'smartfinance-backup', storage:{ smartfinance_wallet:JSON.stringify(items), smartfinance_transactions:JSON.stringify(rows) }}));
describe('wallet ledger', () => {
 it('derives spend, edit and delete balances without separately mutating the card', () => {
  expect(walletBalance(card,[tx])).toBe(90);
  expect(walletBalance(card,[{...tx,amount:40}])).toBe(80);
  expect(walletBalance(card,[])).toBe(120);
  expect(card.events).toHaveLength(1);
  expect(() => validateWalletPayment({...tx,amount:120},[card],[tx])).not.toThrow();
  expect(() => validateWalletPayment({...tx,amount:121},[card],[tx])).toThrow('不足');
 });
 it('uses integer minor units for decimal spends and forbids incompatible payments', () => {
  expect(walletBalance({...card,openingBalance:0.3,events:[]},[{...tx,amount:0.1}])).toBe(0.2);
  for (const changes of [{currency:Currency.AUD},{type:TransactionType.INCOME},{isRecurring:true},{subscriptionId:'sub'},{recurrenceSourceId:'source'}]) expect(() => validateWalletPayment({...tx,...changes},[card],[])).toThrow('單筆支出');
  expect(() => validateWalletLedger([], [tx])).toThrow();
 });
 it('prevents unsafe undo when the restored payment would overdraw the card', () => {
  expect(() => validateWalletPayment(tx,[card],[{...tx,id:'new',amount:100}])).toThrow('不足');
 });
 it('expiry includes the final day and permits metadata edits to an existing historical payment', () => {
  const expired = {...card,expiresOn:'2026-10-01'};
  expect(walletStatus(expired,[],'2026-10-01')).toBe('active');
  expect(walletStatus(expired,[],'2026-10-02')).toBe('expired');
  expect(() => validateWalletPayment(tx,[expired],[])).toThrow('到期日');
  expect(() => validateWalletPayment({...tx,note:'updated'},[expired],[tx],tx)).not.toThrow();
  expect(() => validateWalletPayment({...tx,amount:40},[expired],[tx],tx)).toThrow('到期日');
 });
 it('validates whole units, exhausted status, duplicate events and free vouchers', () => {
  const pass: WalletItem = {...card,kind:'count',openingBalance:2,events:[{id:'use',date:'2026-10-02',kind:'use',amount:2,note:''}]};
  expect(walletBalance(pass,[])).toBe(0);
  expect(walletStatus(pass,[])).toBe('used');
  expect(() => validateWalletLedger([{...pass,openingBalance:1}],[])).toThrow('不足');
  expect(() => validateWalletItem({...pass,openingBalance:1.5})).toThrow('整數');
  expect(() => validateWalletItem({...pass,events:[...pass.events,...pass.events]})).toThrow('使用紀錄');
  expect(() => validateWalletItem({...pass,kind:'voucher',faceValue:0})).not.toThrow();
  expect(() => validateWalletItem({...card,events:pass.events})).toThrow('使用紀錄');
 });
 it('backs up both card history and payment references in JSON and CSV', () => {
  const backup = snapshot([card],[tx]);
  expect(parseBackupCsv(backupToCsv(backup)).storage).toEqual(backup.storage);
  const restored = parseBackupJson(JSON.stringify(backup));
  expect(walletBalance(JSON.parse(restored.storage.smartfinance_wallet)[0],JSON.parse(restored.storage.smartfinance_transactions))).toBe(90);
  expect(() => snapshot([], [tx])).toThrow();
 });
 it('rejects merging independently valid backups if their combined spends overdraw', () => {
  expect(() => mergeBackupSnapshots(snapshot([card],[{...tx,amount:80}]).storage,snapshot([card],[{...tx,id:'other',amount:80}]).storage)).toThrow('不足');
 });
});
