import { pb } from "@/index";
import type { RequestHandler } from "./$types";

function formatDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

export const GET: RequestHandler = async ({ url }) => {
  const apptoken = url.searchParams.get("apptoken");
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const records = await pb.collection("studyuren").getFullList({
    filter: `date >= "${weekAgo.toISOString()}"`,
    query: {
      apptoken,
    },
  });

  let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Studyuren Calendar Intergration//EN
CALSCALE:GREGORIAN
`;

  for (const s of records) {
    const end = new Date(s.date);
    const start = new Date(end.getTime() - s.duration * 1000);

    ical += `BEGIN:VEVENT
UID:${s.id}
DTSTAMP:${formatDate(now)}
DTSTART:${formatDate(start)}
DTEND:${formatDate(end)}
SUMMARY:Studeren
DESCRIPTION:${s.duration} sec, score: ${s.score}\nToegevoegd door Studyuren.
END:VEVENT
`;
  }

  ical += "END:VCALENDAR";

  return new Response(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
};
