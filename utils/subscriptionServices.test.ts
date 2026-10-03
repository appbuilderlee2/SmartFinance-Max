import { describe, expect, it } from 'vitest';
import { filterSubscriptionServices, findSubscriptionService, serviceGroups, subscriptionServices } from '../data/subscriptionServices';

describe('subscription catalogue', () => {
  it('has unique stable identifiers and valid populated groups', () => {
    expect(new Set(subscriptionServices.map(s => s.id)).size).toBe(subscriptionServices.length);
    for (const group of serviceGroups.slice(1)) {
      expect(filterSubscriptionServices('', group).length).toBeGreaterThan(0);
    }
    expect(subscriptionServices.every(s => serviceGroups.includes(s.group))).toBe(true);
  });
  it('retains previously saved service identifiers', () => {
    for (const id of ['netflix', 'spotify', 'youtube', 'icloud', 'chatgpt', 'disney', 'prime', 'dropbox']) {
      expect(findSubscriptionService(id)?.id).toBe(id);
    }
    expect(findSubscriptionService('unknown')).toBeUndefined();
  });
  it('searches English aliases, Chinese names and categories', () => {
    expect(filterSubscriptionServices('  NBN ')).toContainEqual(findSubscriptionService('internet'));
    expect(filterSubscriptionServices('房租')).toContainEqual(findSubscriptionService('rent'));
    expect(filterSubscriptionServices('保險')).toHaveLength(7);
    expect(filterSubscriptionServices('OPENAI', 'AI')).toHaveLength(1);
    expect(filterSubscriptionServices('OPENAI', '住屋')).toHaveLength(0);
    expect(filterSubscriptionServices('不存在的服務')).toHaveLength(0);
  });
  it('does not invent billing terms, prices or bank authorisations', () => {
    for (const service of subscriptionServices) {
      expect(service).not.toHaveProperty('amount');
      expect(service).not.toHaveProperty('billingCycle');
      expect(service).not.toHaveProperty('recordingMode');
      expect(service).not.toHaveProperty('currency');
    }
  });
});
