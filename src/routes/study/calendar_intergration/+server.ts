import type { RequestHandler } from "./$types";
import { error } from "@sveltejs/kit";

function formatDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export const GET: RequestHandler = async ({ url }) => {
  const apptoken = url.searchParams.get("apptoken");
  if (!apptoken) throw error(400, "Missing apptoken");

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const pbUrl = new URL(
    "https://tussenuur-api.bijsven.nl/api/collections/studyuren/records",
  );
  pbUrl.searchParams.set("filter", `date >= "${weekAgo.toISOString()}"`);
  pbUrl.searchParams.set("perPage", "500");
  pbUrl.searchParams.set("page", "1");
  pbUrl.searchParams.set("apptoken", apptoken);

  const res = await fetch(pbUrl.toString());
  const data = await res.json();
  const records = data.items;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Studyuren Calendar Integration//EN",
    "CALSCALE:GREGORIAN",
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
  ];

  for (const s of records) {
    const end = new Date(s.date);
    const start = new Date(end.getTime() - s.duration * 1000);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${s.id}`);
    lines.push(`DTSTAMP:${formatDate(now)}`);
    lines.push(`DTSTART:${formatDate(start)}`);
    lines.push(`DTEND:${formatDate(end)}`);
    lines.push(`SUMMARY:Studeren`);
    // BELANGRIJK: Gebruik \\n voor een zichtbare nieuwe regel in de beschrijving
    lines.push(
      `DESCRIPTION:${s.duration} sec, score: ${s.score}\\nToegevoegd door Studyuren.`,
    );
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  // Join alle regels met de verplichte \r\n (CRLF)
  const icalBody = lines.join("\r\n") + "\r\n";

  return new Response(icalBody, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="calendar.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
};
