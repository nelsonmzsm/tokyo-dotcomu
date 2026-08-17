import { createHash } from "node:crypto";
import { getDb } from "../db/index";
import { ScrapedEvent } from "./types";

function eventId(ev: ScrapedEvent): string {
  return createHash("sha256").update(`${ev.venueId}|${ev.date}|${ev.name}`).digest("hex").slice(0, 24);
}

// 「HTML取得 → パース → 正規化 → upsert」の共通インターフェース（仕様書7章）
// venueId + date + eventName をユニークキーとし、raw_html_hash が一致すれば書き込みをスキップする。
export function upsertEvents(events: ScrapedEvent[], pageHash: string): { upserted: number; skipped: number } {
  const db = getDb();
  const scrapedAt = new Date().toISOString();

  const selectExisting = db.prepare(`SELECT raw_html_hash FROM events WHERE id = ?`);
  const upsertStmt = db.prepare(`
    INSERT INTO events (id, venue_id, name, genre, date, start_time, end_time, scale, source_url, scraped_at, raw_html_hash)
    VALUES (@id, @venueId, @name, @genre, @date, @start, @end, @scale, @sourceUrl, @scrapedAt, @pageHash)
    ON CONFLICT(id) DO UPDATE SET
      genre = excluded.genre,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      scale = excluded.scale,
      source_url = excluded.source_url,
      scraped_at = excluded.scraped_at,
      raw_html_hash = excluded.raw_html_hash
  `);

  let upserted = 0;
  let skipped = 0;

  const run = db.transaction((evs: ScrapedEvent[]) => {
    for (const ev of evs) {
      const id = eventId(ev);
      const existing = selectExisting.get(id) as { raw_html_hash: string } | undefined;
      if (existing && existing.raw_html_hash === pageHash) {
        skipped++;
        continue;
      }
      upsertStmt.run({
        id,
        venueId: ev.venueId,
        name: ev.name,
        genre: ev.genre,
        date: ev.date,
        start: ev.start,
        end: ev.end,
        scale: ev.scale,
        sourceUrl: ev.sourceUrl,
        scrapedAt,
        pageHash,
      });
      upserted++;
    }
  });

  run(events);
  return { upserted, skipped };
}
