import { useId } from 'react';
import { Transaction, TransactionType } from '../types';

export default function IncomeSourceField({ value, onChange, transactions }: { value: string; onChange: (value: string) => void; transactions: Transaction[] }) {
  const listId = useId();
  const sources = [...new Set(transactions.filter(tx => tx.type === TransactionType.INCOME).map(tx => tx.incomeSource?.trim()).filter(Boolean))];
  return <label className="block text-sm">收入來源<input aria-label="收入來源" className="sf-field block w-full mt-2" value={value} maxLength={80} onChange={e => onChange(e.target.value)} list={listId} placeholder="例如游泳教班、Uber Eats、私教" /><datalist id={listId}>{sources.map(source => <option key={source} value={source} />)}</datalist></label>;
}
