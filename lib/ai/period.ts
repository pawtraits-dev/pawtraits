/** Start of London's day for `now` */
export function londonMidnight(now: Date): Date {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const sinceMidnight = ((get('hour') * 60 + get('minute')) * 60 + get('second')) * 1000 + now.getMilliseconds();
  return new Date(now.getTime() - sinceMidnight);
}

/** Admin > AI costs periods start at London midnight: 1 = today, 7 = today and the 6 days before, … */
export function periodStart(days: number, now = new Date()): Date {
  return new Date(londonMidnight(now).getTime() - (days - 1) * 86_400_000);
}
