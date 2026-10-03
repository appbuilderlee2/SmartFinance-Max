import { Layers } from 'lucide-react';
import { findSubscriptionService } from '../data/subscriptionServices';
import { subscriptionLogos } from '../data/subscriptionLogos';

export default function SubscriptionServiceIcon({ icon, name = '', className = '' }: { icon?: string; name?: string; className?: string }) {
  const service = icon?.startsWith('service:') ? findSubscriptionService(icon.slice(8)) : undefined;
  const emoji = icon?.startsWith('emoji:') ? icon.slice(6) : icon?.startsWith('service:') ? undefined : icon;
  return <span aria-hidden="true" className={`sf-service-icon ${className}`} style={service ? { background: service.background, color: service.color } : undefined}>
    {service?.logo ? <svg viewBox="0 0 24 24" fill="currentColor" focusable="false"><path d={subscriptionLogos[service.logo]} /></svg>
      : service?.emoji || emoji || (name ? Array.from(name)[0] : <Layers size={25} />)}
  </span>;
}
