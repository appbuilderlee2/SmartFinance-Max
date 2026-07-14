export interface CardCatalogItem {
  id: string;
  name: string;
  bank?: string;
  imageUrl?: string;
  tags?: string[];
  sellingPoints?: string[];
  applyUrl?: string;
  rewardCategories?: string[];
}

export const DEFAULT_CARD_CATALOG_CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSi-fnj3ECDbSKh05KS_HIECPF5lzeXd-OSoZq3Qln86xyaKgHWvxiU58xhzEtJxlF58EoWR5Gmdy8g/pub?gid=2005160625&single=true&output=csv';

const parseCsv = (text: string): string[][] => {
  // RFC4180-ish CSV parser (handles quotes + commas + newlines inside quotes).
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    // Avoid pushing trailing empty row from terminal newline
    if (row.length === 1 && row[0] === '' && rows.length) return;
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      pushField();
      continue;
    }
    if (ch === '\n') {
      pushField();
      pushRow();
      continue;
    }
    if (ch === '\r') {
      // Handle CRLF: ignore CR, LF will be handled.
      continue;
    }

    field += ch;
  }

  // Flush last field/row
  pushField();
  pushRow();

  return rows;
};

const tryParseJsonStringArray = (value: string | undefined): string[] | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!trimmed.startsWith('[')) return undefined;
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.map((v) => String(v));
  } catch {
    // ignore
  }
  return undefined;
};

const tryParseJson = (value: string | undefined): unknown => {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
};

type RewardRule = {
  matchType?: string;
  matchValue?: unknown;
  isForeignCurrency?: boolean;
  isDiscount?: boolean;
  description?: string;
};

const extractRewardCategories = (rulesValue: string | undefined): string[] | undefined => {
  const parsed = tryParseJson(rulesValue);
  if (!Array.isArray(parsed)) return undefined;

  const out = new Set<string>();
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue;
    const rule = raw as RewardRule;
    const matchType = typeof rule.matchType === 'string' ? rule.matchType : '';

    if (rule.isForeignCurrency) out.add('海外');
    if (rule.isDiscount) out.add('折扣');

    if (matchType === 'category') {
      const mv = rule.matchValue as unknown;
      if (Array.isArray(mv)) {
        mv.forEach((v) => {
          const s = String(v).trim();
          if (s) out.add(s);
        });
      } else if (mv != null) {
        const s = String(mv).trim();
        if (s) out.add(s);
      }
      continue;
    }

    if (matchType === 'merchant') out.add('指定商戶');
    if (matchType === 'base') out.add('一般');
    if (matchType === 'paymentMethod') out.add('指定支付方式');
  }

  return out.size ? Array.from(out) : undefined;
};

export const fetchCardCatalog = async (
  url: string = DEFAULT_CARD_CATALOG_CSV_URL
): Promise<CardCatalogItem[]> => {
  const res = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' });
  if (!res.ok) throw new Error(`Card catalog fetch failed: ${res.status} ${res.statusText}`);

  const text = await res.text();
  const rows = parseCsv(text);
  if (rows.length < 2) return [];

  const headers = rows[0].map((h) => h.trim());
  const col = (name: string) => headers.findIndex((h) => h.toLowerCase() === name.toLowerCase());

  const idIdx = col('id');
  const nameIdx = col('name');
  const bankIdx = col('bank');
  const imageIdx = col('image_url');
  const tagsIdx = col('tags');
  const sellingIdx = col('selling_points');
  const applyIdx = col('apply_url');
  const rulesIdx = col('rules');

  if (idIdx < 0 || nameIdx < 0) {
    throw new Error('Card catalog headers missing required fields (id, name)');
  }

  const items: CardCatalogItem[] = [];
  for (const r of rows.slice(1)) {
    const id = (r[idIdx] || '').trim();
    const name = (r[nameIdx] || '').trim();
    if (!id || !name) continue;

    items.push({
      id,
      name,
      bank: bankIdx >= 0 ? (r[bankIdx] || '').trim() : undefined,
      imageUrl: imageIdx >= 0 ? (r[imageIdx] || '').trim() : undefined,
      tags: tagsIdx >= 0 ? tryParseJsonStringArray(r[tagsIdx]) : undefined,
      sellingPoints: sellingIdx >= 0 ? tryParseJsonStringArray(r[sellingIdx]) : undefined,
      applyUrl: applyIdx >= 0 ? (r[applyIdx] || '').trim() : undefined,
      rewardCategories: rulesIdx >= 0 ? extractRewardCategories(r[rulesIdx]) : undefined,
    });
  }

  // Deduplicate by id (sheet can contain repeated rows during edits)
  const seen = new Set<string>();
  return items.filter((it) => {
    if (seen.has(it.id)) return false;
    seen.add(it.id);
    return true;
  });
};
