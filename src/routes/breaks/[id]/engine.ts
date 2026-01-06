import { pb } from "$lib/index";

export type Member = { id: string; username: string; ical_link: string };
export type Event = { start: Date; end: Date; summary?: string };
export type FreeBlock = { start: Date; end: Date; users: Member[] };

// ------------------- Schedules -------------------
export async function getSchedules(
  members: Member[],
): Promise<Record<string, Event[]>> {
  const schedules: Record<string, Event[]> = {};

  const parseICal = (text: string): Event[] =>
    text
      .split("BEGIN:VEVENT")
      .slice(1)
      .map((block) => {
        const e: Partial<Event> = {};
        block.split("\n").forEach((line) => {
          if (line.startsWith("DTSTART")) {
            const dateStr = line.split(":").pop()?.trim() || "";
            const isUTC = dateStr.endsWith("Z");
            const hasTZID = line.includes("TZID=");
            const date = parseICalDate(dateStr, isUTC, hasTZID);
            e.start = date;
            console.log(`[DEBUG] Parsed DTSTART: ${date.toString()}`);
          }
          if (line.startsWith("DTEND")) {
            const dateStr = line.split(":").pop()?.trim() || "";
            const isUTC = dateStr.endsWith("Z");
            const hasTZID = line.includes("TZID=");
            const date = parseICalDate(dateStr, isUTC, hasTZID);
            e.end = date;
            console.log(`[DEBUG] Parsed DTEND: ${date.toString()}`);
          }
          if (line.startsWith("SUMMARY"))
            e.summary = line.split(":")[1]?.trim();
        });
        return e.start && e.end ? (e as Event) : null;
      })
      .filter(Boolean) as Event[];

  await Promise.all(
    members.map(async (m) => {
      try {
        const txt = await (await fetch(m.ical_link)).text();
        const events = parseICal(txt);
        schedules[m.id] = events;
        console.log(`[DEBUG] Member ${m.username} has ${events.length} events`);
      } catch (err) {
        console.error(`[DEBUG] Failed to fetch ICS for ${m.username}:`, err);
        schedules[m.id] = [];
      }
    }),
  );

  return schedules;
}

// ------------------- ICS date parser -------------------
function parseICalDate(
  dateStr: string,
  isUTC: boolean,
  hasTZID: boolean,
): Date {
  // Cleanup whitespace & CRLF
  dateStr = dateStr.replace(/\s+/g, "");

  // Format: 20241015T083000
  const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z?$/);
  if (!m) {
    console.error("[DEBUG] Invalid date string:", dateStr);
    return new Date(NaN);
  }

  const [_, year, month, day, hour, min, sec] = m;
  const seconds = sec ? +sec : 0;

  // Lokale tijd bij TZID, anders UTC
  if (hasTZID) {
    return new Date(+year, +month - 1, +day, +hour, +min, seconds);
  } else if (isUTC) {
    return new Date(Date.UTC(+year, +month - 1, +day, +hour, +min, seconds));
  } else {
    return new Date(+year, +month - 1, +day, +hour, +min, seconds);
  }
}

// ------------------- Breaks -------------------
export function getBreaks(events: Event[], date: Date): Event[] {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const dayEvents = events
    .filter((ev) => ev.start < endOfDay && ev.end > startOfDay)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  console.log(`[DEBUG] ${date.toDateString()} has ${dayEvents.length} events`);

  if (dayEvents.length < 2) return [];

  const free: Event[] = [];

  for (let i = 0; i < dayEvents.length - 1; i++) {
    const current = dayEvents[i];
    const next = dayEvents[i + 1];
    const gapMinutes = (next.start.getTime() - current.end.getTime()) / 60000;

    console.log(
      `[DEBUG] Gap from ${current.end.toTimeString()} to ${next.start.toTimeString()} = ${gapMinutes} min`,
    );

    if (gapMinutes >= 40) {
      const startHour = current.end.getHours();
      const endHour = next.start.getHours();

      // sanity check: alleen extreme tijden filteren (<6 of >20)
      if (startHour >= 6 && endHour <= 20) {
        free.push({ start: current.end, end: next.start });
        console.log(
          `[DEBUG] Added free block: ${current.end.toTimeString()} - ${next.start.toTimeString()}`,
        );
      } else {
        console.log(`[DEBUG] Skipped free block due to extreme hours`);
      }
    } else {
      console.log(`[DEBUG] Skipped free block due to short gap`);
    }
  }

  return free;
}

// ------------------- General Info -------------------
export async function getGeneralInfo(
  id: string,
): Promise<{ members: Member[]; group: any }> {
  const groupPromise = pb.collection("groups").getOne(id);
  const usersPromise = pb.collection("users_public").getFullList({
    filter: `groups.id ?= '${id}'`,
  });

  const old_members = pb.collection("legacy_members").getFullList({
    query: { groupId: id },
  });

  const [group, users, oldMembers] = await Promise.all([
    groupPromise,
    usersPromise,
    old_members,
  ]);

  const userMap = new Map<string, Member>();

  users.forEach((m: any) => {
    userMap.set(m.username, {
      id: m.id,
      username: m.username,
      ical_link: m.data.somtoday_calendar,
    });
  });

  oldMembers.forEach((m: any) => {
    if (!userMap.has(m.username)) {
      userMap.set(m.username, {
        id: m.id,
        username: m.username,
        ical_link: m.ical_link,
      });
    }
  });

  return {
    group,
    members: Array.from(userMap.values()),
  };
}

// ------------------- Algorithm -------------------
export function Algorithm(
  schedules: Record<string, Event[]>,
  members: Member[],
): FreeBlock[] {
  const freeSlots: Record<string, Event[]> = {};
  const allDays = new Set<string>();

  for (const events of Object.values(schedules)) {
    for (const ev of events) {
      allDays.add(ev.start.toDateString());
    }
  }

  for (const member of members) {
    const memberEvents = schedules[member.id] || [];
    const breaks: Event[] = [];

    for (const dayStr of allDays) {
      const date = new Date(dayStr);
      breaks.push(...getBreaks(memberEvents, date));
    }

    freeSlots[member.id] = breaks;
  }

  const allBlocks: FreeBlock[] = [];
  const days = new Set<string>();

  for (const slots of Object.values(freeSlots)) {
    for (const s of slots) {
      days.add(s.start.toDateString());
    }
  }

  for (const day of days) {
    const points: number[] = [];

    for (const slots of Object.values(freeSlots)) {
      for (const s of slots) {
        if (s.start.toDateString() === day) {
          points.push(s.start.getTime(), s.end.getTime());
        }
      }
    }

    const uniquePoints = Array.from(new Set(points)).sort((a, b) => a - b);
    const dayBlocks: FreeBlock[] = [];

    for (let i = 0; i < uniquePoints.length - 1; i++) {
      const start = new Date(uniquePoints[i]);
      const end = new Date(uniquePoints[i + 1]);
      const durationMin = (end.getTime() - start.getTime()) / 60000;
      if (durationMin < 40) continue;

      const users = members.filter((m) =>
        freeSlots[m.id]?.some(
          (s) =>
            s.start <= start && s.end >= end && s.start.toDateString() === day,
        ),
      );

      if (users.length === 0) continue;

      const last = dayBlocks[dayBlocks.length - 1];
      const sameUsers =
        last &&
        arraysEqual(
          last.users.map((u) => u.id),
          users.map((u) => u.id),
        );
      const gapMin = last
        ? (start.getTime() - last.end.getTime()) / 60000
        : Infinity;

      if (last && sameUsers && gapMin <= 5) {
        last.end = end;
      } else {
        dayBlocks.push({ start, end, users });
      }
    }

    allBlocks.push(...dayBlocks);
  }

  return allBlocks.sort((a, b) => a.start.getTime() - b.start.getTime());
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
