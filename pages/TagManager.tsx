import { useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useData } from '../contexts/DataContext';
import { tagKey, normalizeTag, userTags } from '../utils/tags';
import { loadTagHistory } from '../utils/tagHistory';
import BottomSheet from '../components/BottomSheet';

export default function TagManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const { transactions, renameTag } = useData();
  const [query, setQuery] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [target, setTarget] = useState('');
  const [preview, setPreview] = useState(false);
  const tags = useMemo(() => {
    const names = new Set([...transactions.flatMap(userTags), ...loadTagHistory()]);
    return [...names].map(name => ({ name, count: transactions.filter(t => userTags(t).includes(name)).length })).sort((a,b) => b.count - a.count || a.name.localeCompare(b.name));
  }, [transactions]);
  const affected = transactions.filter(t => userTags(t).some(tag => tagKey(tag) === tagKey(source || '')));
  const merging = tags.some(tag => tag.name !== source && tagKey(tag.name) === tagKey(target));
  return <main className="sf-report sf-tag-manager"><header className="flex items-center gap-3 py-3"><button aria-label={location.state?.fromReport ? '返回報告' : '返回設定'} className="text-primary" onClick={() => location.state?.fromReport ? navigate(-1) : navigate('/settings')}><ChevronLeft /></button><h1 className="text-xl font-semibold">標籤管理</h1></header>
    <p className="text-sm text-gray-400 mb-5">標籤可跨分類整理交易。備註用來描述單筆交易；訂閱及週期來源另行標示。</p>
    <input className="sf-field" aria-label="搜尋標籤" placeholder="搜尋標籤" value={query} onChange={e => setQuery(e.target.value)} />
    {!tags.length && <p className="text-gray-400 py-10 text-center">尚未有標籤，可在記帳時加入。</p>}
    {tags.filter(tag => tagKey(tag.name).includes(tagKey(query))).map(tag => <div className="sf-report-row" key={tag.name}><button className="flex-1 min-w-0 text-left" onClick={() => navigate(`/reports?tag=${encodeURIComponent(tag.name)}`)}><span className="break-words">{tag.name}</span><span className="block text-xs text-gray-400">{tag.count} 筆交易 · 查看統計</span></button><button className="text-primary text-sm" aria-label={`整理標籤 ${tag.name}`} onClick={() => { setSource(tag.name); setTarget(tag.name); setPreview(false); }}>整理</button><ChevronRight size={16}/></div>)}
    {source !== null && <BottomSheet title={preview ? '確認標籤變更' : '重新命名或合併'} onClose={() => setSource(null)}>
      <p className="text-gray-400 mb-4">原標籤：{source}</p>
      {!preview ? <><label>新名稱<input autoFocus className="sf-field mt-2" value={target} onChange={e => setTarget(e.target.value)} /></label><p className="text-sm text-gray-400 my-4">輸入已有標籤名稱即可合併。大小寫與前置 # 會視為同名。</p><button disabled={!normalizeTag(target) || target === source} className="sf-primary-button disabled:opacity-40" onClick={() => setPreview(true)}>預覽變更</button></> : <><p className="mb-3">將「{source}」{merging ? '合併至' : '改名為'}「{normalizeTag(target)}」，影響 {affected.length} 筆交易。</p><p className="text-xs text-gray-400 mb-4">只更新標籤，保留備註、金額及分類。同筆交易的重複標籤會合併。</p><ul className="text-sm space-y-2 mb-5">{affected.slice(0,5).map(t => <li key={t.id}>{t.note || '未填備註'}</li>)}</ul>{affected.length > 5 && <p className="text-xs mb-4">另有 {affected.length - 5} 筆</p>}<button className="sf-primary-button" onClick={() => { renameTag(source, tags.find(tag => tag.name !== source && tagKey(tag.name) === tagKey(target))?.name || target); setSource(null); }}>確認變更</button><button className="w-full py-3" onClick={() => setPreview(false)}>返回修改</button></>}
    </BottomSheet>}
  </main>;
}
