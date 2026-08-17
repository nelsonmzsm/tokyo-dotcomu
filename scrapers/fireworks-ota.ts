import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";

// 大田区平和祈念花火: https://www.city.ota.tokyo.jp/kanko/topics/heiwakinenhanabi.html
// 区の公式ページは和暦＋漢数字時刻表記（例:「令和8年11月14日（土曜日） 花火打上げ 午後5時30分から午後6時まで」）
// のため、専用のパースが必要。

export const venueId = "fireworks-ota";
const URL = "https://www.city.ota.tokyo.jp/kanko/topics/heiwakinenhanabi.html";
const EVENT_NAME = "大田区平和祈念花火";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
}

function kanjiTimeToHHMM(period: string, hour: number, minute: number): string {
  let h = hour % 12;
  if (period === "午後") h += 12;
  return `${String(h).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(URL);
  const pageHash = hashHtml(html);
  const text = stripTags(html);

  // 令和1年=2019年
  const dateMatch = text.match(/令和(\d+)年(\d{1,2})月(\d{1,2})日/);
  const timeMatch = text.match(
    /花火打上げ\s*(午前|午後)(\d{1,2})時(?:(\d{1,2})分)?から(午前|午後)(\d{1,2})時(?:(\d{1,2})分)?/
  );

  if (!dateMatch) {
    console.warn(`[${venueId}] 開催日を特定できませんでした`);
    return { events: [], pageHash };
  }

  const year = 2018 + Number(dateMatch[1]);
  const date = `${year}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
  const start = timeMatch ? kanjiTimeToHHMM(timeMatch[1], Number(timeMatch[2]), Number(timeMatch[3] || "0")) : null;
  const end = timeMatch ? kanjiTimeToHHMM(timeMatch[4], Number(timeMatch[5]), Number(timeMatch[6] || "0")) : null;

  const events: ScrapedEvent[] = [
    { venueId, name: EVENT_NAME, genre: "fireworks", date, start, end, scale: "medium", sourceUrl: URL },
  ];
  return { events, pageHash };
}
