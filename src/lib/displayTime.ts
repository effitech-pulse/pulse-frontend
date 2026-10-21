/** Форматирует время только для UI, не меняя дату исходного результата. */
const snapshotTime = new Intl.DateTimeFormat('ru-RU', {
  timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function formatSnapshotTime(raw: string | null | undefined): string {
  if (!raw) return '—';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw.split('-').reverse().join('.');
  // Без зоны форматируем только исходные цифры часов, не назначая им смещение.
  if (!/(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw)) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?$/.exec(raw);
    if (!parts) return raw;
    const [, year, month, day, hour, minute, second] = parts;
    const check = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute, +second));
    if (check.getUTCFullYear() !== +year || check.getUTCMonth() !== +month - 1 ||
        check.getUTCDate() !== +day || check.getUTCHours() !== +hour ||
        check.getUTCMinutes() !== +minute || check.getUTCSeconds() !== +second) return raw;
    return `${day}.${month}.${year} ${hour}:${minute}`;
  }
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : `${snapshotTime.format(date).replace(', ', ' ')} МСК`;
}
