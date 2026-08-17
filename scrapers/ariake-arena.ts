import * as cheerio from "cheerio";
import { fetchStaticHtml, hashHtml } from "./fetchHtml";
import { ScrapedEvent } from "./types";
import { estimateScale, guessGenre } from "./scaleHeuristic";

// 有明アリーナ: https://ariake-arena.tokyo/event/
// 静的HTML、ul.event_detail_list > li が1イベント1ブロック。
// 年表記がないため、参照時点の日付を基準に月をロールフォワードして年を推定する。
// robots.txt: /wp-admin/ のみDisallow（対象パスは制限なし）

export const venueId = "ariake-arena";
const EVENT_URL = "https://ariake-arena.tokyo/event/";

function resolveYear(month: number, day: number, reference: Date): number {
  const refYear = reference.getFullYear();
  const refMonth = reference.getMonth() + 1;
  // 参照月より2ヶ月以上前の月が出てきたら、年をまたいだ表記とみなし翌年扱いにする
  if (month < refMonth - 2) return refYear + 1;
  return refYear;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export async function run(): Promise<{ events: ScrapedEvent[]; pageHash: string }> {
  const html = await fetchStaticHtml(EVENT_URL);
  const pageHash = hashHtml(html);
  const $ = cheerio.load(html);
  const now = new Date();

  const events: ScrapedEvent[] = [];

  $("ul.event_detail_list > li").each((_, li) => {
    const $li = $(li);
    const performer = $li.find(".event_name p").first().text().trim();
    const subtitle = $li.find(".sub_title").first().text().trim();
    const name = subtitle || performer;
    if (!name) return;

    const officialLink = $li.find("tr.url_area a").first().attr("href");
    const sourceUrl = officialLink || EVENT_URL;

    // 「公演時間」行（th要素のテキストで判定。並び順は固定でないため探索する）
    let timeCellHtml = "";
    $li.find("table.detail_table tr").each((__, tr) => {
      const label = $(tr).find("th").first().text();
      if (label.includes("公演時間")) {
        timeCellHtml = $(tr).find("td").first().html() || "";
      }
    });
    const lines = timeCellHtml
      .split(/<br\s*\/?>/i)
      .map(stripTags)
      .filter(Boolean);

    const genre = guessGenre(`${performer} ${subtitle}`);
    const scale = estimateScale(venueId, genre);

    for (const line of lines) {
      const dateMatch = line.match(/(\d{1,2})\.(\d{1,2})/);
      if (!dateMatch) continue;
      const month = Number(dateMatch[1]);
      const day = Number(dateMatch[2]);
      const year = resolveYear(month, day, now);
      const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      // 「開場/開演」「試合開始」「TIPOFF」など表記が揺れるため、行内の最後の HH:MM を開始時刻とみなす
      // （開場と開演の両方がある場合、常に後に書かれるのは開演側のため）
      const timeMatches = [...line.matchAll(/(\d{1,2}:\d{2})/g)];
      const start = timeMatches.length ? timeMatches[timeMatches.length - 1][1].padStart(5, "0") : null;

      events.push({ venueId, name, genre, date, start, end: null, scale, sourceUrl });
    }
  });

  return { events, pageHash };
}
