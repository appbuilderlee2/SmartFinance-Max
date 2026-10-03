import { subscriptionLogos } from './subscriptionLogos';

export const serviceGroups = ['全部', '影音', '音樂', '雲端', 'AI', '工作', '遊戲', '生活帳單', '住屋', '保險', '交通', '健康', '學習', '會籍'] as const;
export type ServiceGroup = typeof serviceGroups[number];
export interface SubscriptionService {
  id: string;
  name: string;
  group: Exclude<ServiceGroup, '全部'>;
  keywords: string;
  logo?: keyof typeof subscriptionLogos;
  color: string;
  background: string;
  emoji?: string;
}

// Generic pictograms deliberately avoid suggesting an official brand logo.
const item = (id: string, name: string, group: SubscriptionService['group'], emoji: string, keywords: string): SubscriptionService =>
  ({ id, name, group, emoji, keywords, color: '#fff', background: '#253448' });

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
  item('apple-tv', 'Apple TV', '影音', '📺', 'apple tv 蘋果 電視 串流'),
  item('stan', 'Stan', '影音', '📺', '澳洲 電視 串流 streaming'),
  item('kayo', 'Kayo Sports', '影音', '🏉', '澳洲 體育 運動 球賽'),
  item('mytv-super', 'myTV SUPER', '影音', '📺', '香港 tvb 電視'),
  item('apple-music', 'Apple Music', '音樂', '🎵', '蘋果 music'),
  item('youtube-music', 'YouTube Music', '音樂', '🎧', 'youtube music 音樂'),
  item('moov', 'MOOV', '音樂', '🎵', '香港 廣東歌'),
  item('kkbox', 'KKBOX', '音樂', '🎧', '華語 廣東歌'),
  item('google-one', 'Google One', '雲端', '☁️', 'google drive photos 雲端 硬碟 相簿 儲存'),
  item('onedrive', 'OneDrive', '雲端', '☁️', 'microsoft 微軟 儲存'),
  item('claude', 'Claude', 'AI', '💬', 'anthropic 人工智能'),
  item('gemini', 'Google AI', 'AI', '✨', 'google gemini 人工智能'),
  item('perplexity', 'Perplexity', 'AI', '🔎', '人工智能 搜尋'),
  item('copilot', 'GitHub Copilot', 'AI', '💻', 'github coding 程式 開發'),
  item('microsoft-365', 'Microsoft 365', '工作', '💼', 'office word excel powerpoint 微軟 辦公'),
  item('adobe', 'Adobe Creative Cloud', '工作', '🎨', 'photoshop illustrator premiere 設計 剪片'),
  item('canva', 'Canva', '工作', '🎨', '設計 簡報'),
  item('notion', 'Notion', '工作', '📝', '筆記 文件'),
  item('zoom', 'Zoom', '工作', '📹', '視像 會議'),
  item('domain', '網域續費', '工作', '🌐', 'domain 網址 年費'),
  item('hosting', '網站及伺服器', '工作', '🖥️', 'hosting server vps 主機 寄存'),
  item('apple-arcade', 'Apple Arcade', '遊戲', '🎮', '蘋果 gaming'),
  item('playstation', 'PlayStation Plus', '遊戲', '🎮', 'sony ps ps5 psn'),
  item('xbox', 'Xbox Game Pass', '遊戲', '🎮', 'microsoft 微軟 gaming'),
  item('nintendo', 'Nintendo Switch Online', '遊戲', '🎮', '任天堂 nintendo switch'),
  item('electricity', '電費', '生活帳單', '⚡', 'electricity power 電力 定期'),
  item('water', '水費', '生活帳單', '💧', 'water 水務 定期'),
  item('gas', '煤氣／天然氣', '生活帳單', '🔥', 'gas 煤氣 天然氣 定期'),
  item('mobile', '手機月費', '生活帳單', '📱', 'mobile phone sim 電話 電訊 通訊 定期'),
  item('internet', '寬頻上網', '生活帳單', '📶', 'internet broadband nbn wifi 網絡 定期'),
  item('rent', '租金', '住屋', '🏠', 'rent 租屋 房租 定期'),
  item('mortgage', '按揭供款', '住屋', '🏡', 'mortgage home loan 房貸 樓 定期'),
  item('strata', '管理費', '住屋', '🏢', 'strata body corporate 物業 大廈 定期'),
  item('council', '市政費／差餉', '住屋', '🏘️', 'council rates 差餉 地租 定期'),
  item('health-insurance', '醫療保險', '保險', '🩺', 'health insurance oshc ovhc 醫保 定期'),
  item('car-insurance', '汽車保險', '保險', '🚘', 'car insurance 車保 定期'),
  item('home-insurance', '家居保險', '保險', '🏠', 'home contents insurance 房屋 財物 定期'),
  item('life-insurance', '人壽保險', '保險', '🛡️', 'life insurance 壽險 定期'),
  item('pet-insurance', '寵物保險', '保險', '🐾', 'pet insurance 貓 狗 定期'),
  item('rego', '車輛牌費', '交通', '🚗', 'rego registration 續牌 牌照 定期'),
  item('car-loan', '汽車供款', '交通', '🚙', 'car loan 車貸 定期'),
  item('parking', '月租泊車', '交通', '🅿️', 'parking 車位 停車 定期'),
  item('transport-pass', '交通月票', '交通', '🚆', 'transport metro bus train 公車 火車 巴士 定期'),
  item('gym', '健身會籍', '健康', '🏋️', 'gym fitness 健身房 定期'),
  item('swimming', '游泳會籍', '健康', '🏊', 'swimming pool 泳池 定期'),
  item('strava', 'Strava', '健康', '🚴', '跑步 單車 運動'),
  item('sports-class', '運動課程', '健康', '🧘', 'yoga pilates 瑜伽 普拉提 游泳班 定期'),
  item('duolingo', 'Duolingo', '學習', '🦉', '語言 英文 日文'),
  item('coursera', 'Coursera', '學習', '🎓', 'online course 網上 課程'),
  item('tuition', '補習／學費', '學習', '📚', 'tuition school 補習 學校 定期'),
  item('costco', 'Costco', '會籍', '🛒', '好市多 超市 會員 年費'),
  item('uber-one', 'Uber One', '會籍', '🛵', 'uber eats 外賣 送餐'),
  item('club', '社團會費', '會籍', '👥', 'club association 會員 會籍 定期'),
  item('donation', '定期捐款', '會籍', '💝', 'donation charity 慈善 定期'),
];

export function filterSubscriptionServices(query: string, group: ServiceGroup = '全部') {
  const search = query.trim().toLocaleLowerCase();
  return subscriptionServices.filter(service => (group === '全部' || service.group === group)
    && `${service.name} ${service.group} ${service.keywords}`.toLocaleLowerCase().includes(search));
}

export function findSubscriptionService(id: string | null | undefined) {
  return subscriptionServices.find(service => service.id === id);
}
