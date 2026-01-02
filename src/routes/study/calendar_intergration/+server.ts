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
  if (!res.ok) {
    console.log("Fetching:", pbUrl.toString());
    console.log("Headers:", [...res.headers]);
    const text = await res.text();
    console.log("Response body:", text);
    throw error(res.status, "Failed to fetch from PocketBase");
  }

  const data = await res.json();
  const records = data.items;

  let ical = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Studyuren Calendar Integration//EN
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
