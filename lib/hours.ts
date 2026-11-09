import { zonedParts } from "@/lib/timezones";

const DAY_INDEX: Record<string, number> = { Mo: 1, Tu: 2, We: 3, Th: 4, Fr: 5, Sa: 6, Su: 0 };

type Rule = { days: number[]; open: number; close: number };

function parseClock(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour === 24 && minute === 0) return 24 * 60;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function parseDays(value: string): number[] | null {
  const days: number[] = [];
  for (const part of value.split(",").map((item) => item.trim()).filter(Boolean)) {
    const range = part.match(/^(Mo|Tu|We|Th|Fr|Sa|Su)(?:-(Mo|Tu|We|Th|Fr|Sa|Su))?$/);
    if (!range) return null;
    const start = DAY_INDEX[range[1]];
    const end = range[2] ? DAY_INDEX[range[2]] : start;
    let cursor = start;
    for (let step = 0; step < 7; step += 1) {
      days.push(cursor);
      if (cursor === end) break;
      cursor = (cursor + 1) % 7;
    }
  }
  return days.length ? days : null;
}

export function parseOpeningHours(value: string | null | undefined): Rule[] | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  if (/^24\s*\/\s*7$/.test(text)) return [{ days: [0, 1, 2, 3, 4, 5, 6], open: 0, close: 24 * 60 }];
  if (/[A-Za-z]/.test(text.replace(/Mo|Tu|We|Th|Fr|Sa|Su/g, ""))) return null;

  const rules: Rule[] = [];
  for (const segment of text.split(";").map((item) => item.trim()).filter(Boolean)) {
    const match = segment.match(/^([A-Za-z,\- ]+?)\s+(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
    if (!match) return null;
    const days = parseDays(match[1].trim());
    const open = parseClock(match[2]);
    const close = parseClock(match[3]);
    if (!days || open === null || close === null || open === close) return null;
    rules.push({ days, open, close });
  }
  return rules.length ? rules : null;
}

function covers(rule: Rule, weekday: number, minutes: number): boolean {
  if (!rule.days.includes(weekday)) return false;
  if (rule.close > rule.open) return minutes >= rule.open && minutes < rule.close;
  return minutes >= rule.open || minutes < rule.close;
}

export function openNowFromHours(
  value: string | null | undefined,
  timeZone: string | null,
  now = new Date(),
): boolean | null {
  const rules = parseOpeningHours(value);
  if (!rules || !timeZone) return null;
  const parts = zonedParts(now, timeZone);
  if (!parts) return null;
  return rules.some((rule) => covers(rule, parts.weekday, parts.minutes));
}
