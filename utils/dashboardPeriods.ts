export function dashboardTrendPeriods(year: number, month: number, mode: 'month' | 'year') {
  const count = mode === 'year' ? 12 : 6;
  return Array.from({ length: count }, (_, index) => {
    // Set the day explicitly: carrying today's 29th–31st into February
    // otherwise rolls the trend forward into March.
    const date = new Date(year, mode === 'year' ? index : month - (count - 1 - index), 1);
    return { year: date.getFullYear(), month: date.getMonth(), label: `${date.getMonth() + 1}月` };
  });
}
