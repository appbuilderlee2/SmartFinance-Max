import { useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLedger } from '../contexts/DataContext';
import { loadTagHistory } from '../utils/tagHistory';
import { normalizeTag, tagKey, userTags } from '../utils/tags';
import BottomSheet from './BottomSheet';

export default function TagPicker({ value, onChange }: { value: string[]; onChange: (tags: string[]) => void }) {
  const { transactions } = useLedger();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<string[]>([]);
  const choices = useMemo(() => Array.from(new Set([...loadTagHistory(), ...transactions.flatMap(userTags), ...value, ...draft])), [transactions, value, draft, open]);
  const toggle = (tag: string) => setDraft(previous => previous.includes(tag) ? previous.filter(t => t !== tag) : [...previous, tag]);
  const typed = normalizeTag(search);
  return <section className="space-y-2">
    <div className="font-medium">標籤 <span className="text-xs text-gray-400 font-normal">跨分類整理，可留空</span></div>
    <div className="flex flex-wrap gap-2">{value.map(tag => <button type="button" key={tag} className="sf-tag" aria-label={`移除標籤 ${tag}`} onClick={() => onChange(value.filter(t => t !== tag))}>{tag}<X size={14} /></button>)}<button type="button" className="sf-tag text-primary" onClick={() => { setDraft(value); setSearch(''); setOpen(true); }}><Plus size={16} />加入標籤</button></div>
    {open && <BottomSheet title="選擇標籤" onClose={() => setOpen(false)}>
      <input autoFocus aria-label="搜尋或新增標籤" placeholder="搜尋或新增標籤" className="sf-field" value={search} onChange={e => setSearch(e.target.value)} />
      <p className="text-sm text-gray-400 my-3">最近使用與現有標籤 · 已選 {draft.length} 個</p>
      <div className="flex flex-wrap gap-2">{choices.filter(tag => tagKey(tag).includes(tagKey(search))).map(tag => <button type="button" key={tag} aria-pressed={draft.includes(tag)} className={`sf-tag ${draft.includes(tag) ? 'bg-primary text-white' : ''}`} onClick={() => toggle(tag)}>{tag}</button>)}</div>
      {typed && !choices.some(tag => tagKey(tag) === tagKey(typed)) && <button type="button" className="sf-tag my-4 text-primary" onClick={() => { setDraft(prev => prev.some(t => tagKey(t) === tagKey(typed)) ? prev : [...prev, typed]); setSearch(''); }}>新增「{typed}」</button>}
      <button type="button" className="sf-primary-button mt-6" onClick={() => { onChange(draft); setOpen(false); }}>完成選擇</button>
    </BottomSheet>}
  </section>;
}
