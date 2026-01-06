import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";

function formatDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

type Member = { id: string; username: string; ical_link: string };
type Event = { start: Date; end: Date; summary?: string };
type FreeBlock = { start: Date; end: Date; users: Member[] };

// ------------------- ICS date parser -------------------
function parseICalDate(
  dateStr: string,
  isUTC: boolean,
  hasTZID: boolean,
): Date {
  dateStr = dateStr.replace(/\s+/g, "");
  const m = dateStr.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?Z?$/);
  if (!m) return new Date(NaN);

  const [_, year, month, day, hour, min, sec] = m;
  const seconds = sec ? +sec : 0;

  if (hasTZID) {
    return new Date(+year, +month - 1, +day, +hour, +min, seconds);
  } else if (isUTC) {
    return new Date(Date.UTC(+year, +month - 1, +day, +hour, +min, seconds));
  } else {
    return new Date(+year, +month - 1, +day, +hour, +min, seconds);
  }
}

// ------------------- Parse iCal -------------------
function parseICal(text: string): Event[] {
  try {
    const events: Event[] = [];
    const blocks = text.split("BEGIN:VEVENT").slice(1);

    for (const block of blocks) {
      const e: Partial<Event> = {};
      const lines = block.split(/\r?\n/);

      for (const line of lines) {
        const cleanLine = line.trim();

        if (cleanLine.startsWith("DTSTART")) {
          const parts = cleanLine.split(":");
          const dateStr = parts[parts.length - 1]?.trim() || "";
          if (dateStr) {
            const isUTC = dateStr.endsWith("Z");
            const hasTZID = cleanLine.includes("TZID=");
            const parsed = parseICalDate(dateStr, isUTC, hasTZID);
            if (!isNaN(parsed.getTime())) {
              e.start = parsed;
            }
          }
        } else if (cleanLine.startsWith("DTEND")) {
          const parts = cleanLine.split(":");
          const dateStr = parts[parts.length - 1]?.trim() || "";
          if (dateStr) {
            const isUTC = dateStr.endsWith("Z");
            const hasTZID = cleanLine.includes("TZID=");
            const parsed = parseICalDate(dateStr, isUTC, hasTZID);
            if (!isNaN(parsed.getTime())) {
              e.end = parsed;
            }
          }
        } else if (cleanLine.startsWith("SUMMARY:")) {
          e.summary = cleanLine.substring(8).trim();
        }
      }

      if (e.start && e.end) {
        events.push(e as Event);
      }
    }

    return events;
  } catch (err) {
    console.error("[ERROR] Failed to parse iCal:", err);
    return [];
  }
}

// ------------------- Get Breaks -------------------
function getBreaks(events: Event[], date: Date): Event[] {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const dayEvents = events
    .filter((ev) => ev.start < endOfDay && ev.end > startOfDay)
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  if (dayEvents.length < 2) return [];

  const free: Event[] = [];

  for (let i = 0; i < dayEvents.length - 1; i++) {
    const current = dayEvents[i];
    const next = dayEvents[i + 1];
    const gapMinutes = (next.start.getTime() - current.end.getTime()) / 60000;

    if (gapMinutes >= 40) {
      const startHour = current.end.getHours();
      const endHour = next.start.getHours();

      if (startHour >= 6 && endHour <= 20) {
        free.push({ start: current.end, end: next.start });
      }
    }
  }

  return free;
}

// ------------------- Calculate Free Blocks -------------------
function calculateFreeBlocks(
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
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

export const GET: RequestHandler = async ({ url }) => {
  const apptoken = url.searchParams.get("apptoken");
  if (!apptoken) throw error(400, "Missing apptoken");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  console.log("[INFO] Starting calendar generation with apptoken:", apptoken);

  // Fetch study hours
  const pbUrl = new URL(
    "https://tussenuur-api.bijsven.nl/api/collections/studyuren/records",
  );
  pbUrl.searchParams.set("filter", `date >= "${weekAgo.toISOString()}"`);
  pbUrl.searchParams.set("perPage", "500");
  pbUrl.searchParams.set("page", "1");
  pbUrl.searchParams.set("apptoken", apptoken);

  // Fetch users with calendar links
  const pbUrl_users = new URL(
    "https://tussenuur-api.bijsven.nl/api/collections/users_public",
  );
  pbUrl_users.searchParams.set("perPage", "500");
  pbUrl_users.searchParams.set("page", "1");
  pbUrl_users.searchParams.set("apptoken", apptoken);

  let studyRecords: any[] = [];
  let members: Member[] = [];
  let freeBlocks: FreeBlock[] = [];

  try {
    // Fetch both in parallel
    const [studyRes, usersRes] = await Promise.all([
      fetch(pbUrl.toString()).catch((err) => {
        console.error("[ERROR] Study fetch failed:", err);
        return null;
      }),
      fetch(pbUrl_users.toString()).catch((err) => {
        console.error("[ERROR] Users fetch failed:", err);
        return null;
      }),
    ]);

    // Process study records
    if (studyRes && studyRes.ok) {
      try {
        const studyData = await studyRes.json();
        studyRecords = studyData.items || [];
        console.log(`[INFO] Fetched ${studyRecords.length} study records`);
      } catch (err) {
        console.error("[ERROR] Failed to parse study data:", err);
      }
    }

    // Process users and fetch calendars
    if (usersRes && usersRes.ok) {
      try {
        const usersData = await usersRes.json();
        const usersRecords = usersData.items || [];
        console.log(`[INFO] Fetched ${usersRecords.length} users`);

        // Filter members with calendar links
        members = usersRecords
          .filter((u: any) => {
            const hasCalendar = u.data?.somtoday_calendar;
            if (!hasCalendar) {
              console.log(`[DEBUG] User ${u.username} has no calendar`);
            }
            return hasCalendar;
          })
          .map((u: any) => ({
            id: u.id,
            username: u.username,
            ical_link: u.data.somtoday_calendar,
          }));

        console.log(`[INFO] Found ${members.length} members with calendars`);

        if (members.length > 0) {
          const schedules: Record<string, Event[]> = {};

          // Fetch calendars with proper error handling
          const fetchResults = await Promise.allSettled(
            members.map(async (m) => {
              try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 15000);

                const response = await fetch(m.ical_link, {
                  signal: controller.signal,
                  headers: {
                    "User-Agent": "Studyuren Calendar Integration/1.0",
                  },
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                  console.error(
                    `[WARN] Failed to fetch calendar for ${m.username}: HTTP ${response.status}`,
                  );
                  return { member: m, events: [] };
                }

                const txt = await response.text();
                const events = parseICal(txt);
                console.log(
                  `[INFO] Parsed ${events.length} events for ${m.username}`,
                );
                return { member: m, events };
              } catch (err) {
                console.error(
                  `[WARN] Exception fetching calendar for ${m.username}:`,
                  err instanceof Error ? err.message : err,
                );
                return { member: m, events: [] };
              }
            }),
          );

          // Process successful fetches
          for (const result of fetchResults) {
            if (result.status === "fulfilled" && result.value) {
              schedules[result.value.member.id] = result.value.events;
            }
          }

          // Filter to members with actual schedules
          const membersWithSchedules = members.filter(
            (m) => schedules[m.id] && schedules[m.id].length > 0,
          );

          console.log(
            `[INFO] ${membersWithSchedules.length} members have valid schedules`,
          );

          // Need at least 2 people to find common breaks
          if (membersWithSchedules.length >= 2) {
            console.log(
              `[INFO] Calculating free blocks for ${membersWithSchedules.length} members`,
            );
            freeBlocks = calculateFreeBlocks(schedules, membersWithSchedules);
            console.log(`[INFO] Found ${freeBlocks.length} free blocks`);
          } else {
            console.log(
              "[INFO] Not enough members with schedules to calculate tussenuren (need at least 2)",
            );
          }
        }
      } catch (err) {
        console.error("[ERROR] Failed to process users:", err);
      }
    }
  } catch (err) {
    console.error("[ERROR] Unexpected error during data fetching:", err);
  }

  // Build iCalendar
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studyuren Calendar Integration//EN",
    "CALSCALE:GREGORIAN",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  // Add study hours to calendar
  let studyCount = 0;
  for (const s of studyRecords) {
    try {
      if (!s.date || !s.duration) continue;

      const end = new Date(s.date);
      if (isNaN(end.getTime())) continue;

      const start = new Date(end.getTime() - s.duration * 1000);

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:study-${s.id}@studyuren.bijsven.nl`);
      lines.push(`DTSTAMP:${formatDate(now)}`);
      lines.push(`DTSTART:${formatDate(start)}`);
      lines.push(`DTEND:${formatDate(end)}`);
      lines.push(`SUMMARY:Studeren`);
      lines.push(
        `DESCRIPTION:${s.duration} sec, score: ${s.score || "N/A"}\\nToegevoegd door Studyuren.`,
      );
      lines.push("END:VEVENT");
      studyCount++;
    } catch (err) {
      console.error("[ERROR] Failed to add study record:", err);
    }
  }

  // Add tussenuren (free blocks) to calendar
  let tussenuurCount = 0;
  for (const block of freeBlocks) {
    try {
      const usernames = block.users.map((u) => u.username).join(", ");
      const durationMin = Math.round(
        (block.end.getTime() - block.start.getTime()) / 60000,
      );

      const userIds = block.users
        .map((u) => u.id)
        .sort()
        .join("-");
      const blockId = `${block.start.getTime()}-${userIds}`;

      lines.push("BEGIN:VEVENT");
      lines.push(`UID:tussenuur-${blockId}@studyuren.bijsven.nl`);
      lines.push(`DTSTAMP:${formatDate(now)}`);
      lines.push(`DTSTART:${formatDate(block.start)}`);
      lines.push(`DTEND:${formatDate(block.end)}`);
      lines.push(
        `SUMMARY:🕐 Tussenuur met ${block.users.length} ${block.users.length === 1 ? "persoon" : "personen"}`,
      );
      lines.push(
        `DESCRIPTION:Vrij blok van ${durationMin} minuten\\n\\nMet: ${usernames}\\n\\nToegevoegd door Studyuren.`,
      );
      lines.push("END:VEVENT");
      tussenuurCount++;
    } catch (err) {
      console.error("[ERROR] Failed to add free block:", err);
    }
  }

  lines.push("END:VCALENDAR");

  const icalBody = lines.join("\r\n") + "\r\n";

  console.log(
    `[INFO] Calendar generated successfully: ${studyCount} study sessions, ${tussenuurCount} tussenuren`,
  );

  return new Response(icalBody, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="studyuren-calendar.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
};
