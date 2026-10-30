export function plain(value: string): string {
  return value.replace(/<br\s*\/?\s*>|<\/li>/gi, '\n').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/\n+/g, '\n').trim();
}
export function requirementGb(text: string, label: string): number | null {
  const line = text.split('\n').find(x => x.toLowerCase().startsWith(label.toLowerCase() + ':'));
  const match = line?.match(/(\d+(?:\.\d+)?)\s*(GB|MB|TB)/i);
  if (!match) return null;
  return Number(match[1]) * ({GB: 1, MB: 1 / 1024, TB: 1024}[match[2].toUpperCase()] ?? 1);
}
