// Contract v2.1: 30 calendar days, excluding the signature day, ending at
// midnight Europe/Berlin; Munich weekends/public holidays extend the final day.
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const n = h + l - 7 * m + 114;
  return Date.UTC(year, Math.floor(n / 31) - 1, n % 31 + 1);
}
export function munichNonWorkingDay(day: Date) {
  const fixed = ['01-01','01-06','05-01','08-15','10-03','11-01','12-25','12-26'];
  return [0,6].includes(day.getUTCDay()) || fixed.includes(day.toISOString().slice(5,10)) || [-2,1,39,50,60].some(offset => easter(day.getUTCFullYear()) + offset * 86400000 === day.getTime());
}
const berlinParts = (time: number) => Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(time)).map(p => [p.type, Number(p.value)]));
export function recruiterCounterDeadline(signedAt: string): string {
  const time = Date.parse(signedAt);
  if (!Number.isFinite(time)) throw new Error('Ungültiger Unterschriftszeitpunkt.');
  const p = berlinParts(time);
  const last = new Date(Date.UTC(p.year, p.month - 1, p.day + 30));
  while (munichNonWorkingDay(last)) last.setUTCDate(last.getUTCDate() + 1);
  const target = last.getTime() + 86400000;
  let midnight = target;
  for (let n = 0; n < 3; n++) {
    const q = berlinParts(midnight);
    midnight += target - Date.UTC(q.year, q.month - 1, q.day, q.hour, q.minute, q.second);
  }
  return new Date(midnight).toISOString(); // exclusive boundary
}
