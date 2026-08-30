/**
 * 金额格式化：
 * - < 1 万：千分位整数/两位小数，如 ¥2,540、¥267.14
 * - >= 1 万：x.x 万，如 ¥1.2万
 */
export function formatMoney(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  if (Math.abs(n) >= 10000) {
    return '¥' + (n / 10000).toFixed(1) + '万';
  }
  const hasDecimal = Math.abs(n % 1) > 0.001;
  return '¥' + n.toLocaleString('zh-CN', {
    minimumFractionDigits: hasDecimal ? 2 : 0,
    maximumFractionDigits: 2,
  });
}
