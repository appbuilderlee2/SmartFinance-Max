import { subscriptionLogos } from './subscriptionLogos';

export const serviceGroups = ['全部', '影音', '音樂', '雲端', 'AI'] as const;
export type ServiceGroup = typeof serviceGroups[number];
export interface SubscriptionService {
  id: string;
  name: string;
  group: ServiceGroup;
  keywords: string;
  logo?: keyof typeof subscriptionLogos;
  color: string;
  background: string;
  emoji?: string;
}

// Templates contain identity only. Prices, billing dates and ledger categories
// belong to the user's subscription, not to the service catalogue.
export const subscriptionServices: SubscriptionService[] = [
  { id: 'netflix', name: 'Netflix', group: '影音', keywords: '網飛 奈飛', logo: 'netflix', color: '#e50914', background: '#080808' },
  { id: 'spotify', name: 'Spotify', group: '音樂', keywords: '音樂 music', logo: 'spotify', color: '#1ed760', background: '#080808' },
  { id: 'youtube', name: 'YouTube Premium', group: '影音', keywords: 'youtube premium music 影片', logo: 'youtube', color: '#ff0033', background: '#fff' },
  { id: 'icloud', name: 'iCloud+', group: '雲端', keywords: 'icloud apple 蘋果 儲存', logo: 'icloud', color: '#159cee', background: '#fff' },
  { id: 'chatgpt', name: 'ChatGPT', group: 'AI', keywords: 'openai gpt 人工智能', logo: 'openai', color: '#171717', background: '#fff' },
  { id: 'disney', name: 'Disney+', group: '影音', keywords: 'disney 迪士尼', emoji: '🏰', color: '#fff', background: '#133c58' },
  { id: 'prime', name: 'Amazon Prime', group: '影音', keywords: 'amazon prime 亞馬遜', emoji: '📦', color: '#fff', background: '#16476a' },
  { id: 'dropbox', name: 'Dropbox', group: '雲端', keywords: 'dropbox 儲存', logo: 'dropbox', color: '#0061ff', background: '#fff' },
];

export function findSubscriptionService(id: string | null | undefined) {
  return subscriptionServices.find(service => service.id === id);
}
