import { useState } from 'react';
import { ChevronRight, Plus, Search, X } from 'lucide-react';
import { serviceGroups, ServiceGroup, subscriptionServices, SubscriptionService } from '../data/subscriptionServices';
import SubscriptionServiceIcon from './SubscriptionServiceIcon';

export default function SubscriptionServicePicker({ onSelect, onCustom }: { onSelect: (service: SubscriptionService) => void; onCustom: (name: string) => void }) {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<ServiceGroup>('全部');
  const search = query.trim().toLocaleLowerCase();
  const visible = subscriptionServices.filter(service => (group === '全部' || service.group === group)
    && `${service.name} ${service.keywords}`.toLocaleLowerCase().includes(search));

  return <div className="sf-sub-content sf-service-picker">
    <div className="sf-service-search">
      <Search size={20} aria-hidden="true" />
      <input aria-label="搜尋服務" type="search" placeholder="搜尋服務" value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
      {query && <button type="button" aria-label="清除搜尋" onClick={() => setQuery('')}><X size={18} /></button>}
    </div>
    <div className="sf-service-groups" role="group" aria-label="服務類別">
      {serviceGroups.map(item => <button key={item} type="button" aria-pressed={group === item} onClick={() => setGroup(item)}>{item}</button>)}
    </div>
    <div className="sf-sub-group sf-service-list" aria-label="服務清單">
      {visible.map(service => <button className="sf-service-row" key={service.id} type="button" onClick={() => onSelect(service)}>
        <SubscriptionServiceIcon icon={`service:${service.id}`} />
        <span>{service.name}</span><ChevronRight size={20} aria-hidden="true" />
      </button>)}
      {!visible.length && <p className="sf-service-empty" role="status">搵唔到服務</p>}
    </div>
    <button className="sf-sub-group sf-service-row sf-service-custom" type="button" onClick={() => onCustom(query.trim())}>
      <span className="sf-service-icon"><Plus size={26} aria-hidden="true" /></span><span>自訂服務</span><ChevronRight size={20} aria-hidden="true" />
    </button>
  </div>;
}
