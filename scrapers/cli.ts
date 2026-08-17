import { sleep } from "./fetchHtml";
import { upsertEvents } from "./upsert";
import { ScrapedEvent } from "./types";

import * as tokyoDome from "./tokyo-dome";
import * as bigsight from "./bigsight";
import * as ariakeArena from "./ariake-arena";
import * as forum from "./forum";
import * as kokuritsu from "./kokuritsu";
import * as zeppDiver from "./zepp-diver";
import * as fireworksAkishima from "./fireworks-akishima";
import * as fireworksChofu from "./fireworks-chofu";
import * as fireworksKita from "./fireworks-kita";
import * as fireworksSetagaya from "./fireworks-setagaya";
import * as fireworksOta from "./fireworks-ota";
import * as fireworksTokyobay from "./fireworks-tokyobay";

interface ScraperModule {
  venueId: string;
  run(): Promise<{ events: ScrapedEvent[]; pageHash: string }>;
}

const SCRAPERS: ScraperModule[] = [
  tokyoDome,
  bigsight,
  ariakeArena,
  forum,
  kokuritsu,
  zeppDiver,
  fireworksAkishima,
  fireworksChofu,
  fireworksKita,
  fireworksSetagaya,
  fireworksOta,
  fireworksTokyobay,
];

// 会場間のリクエスト間隔（サーバー負荷配慮。仕様書「6. クローリング運用ルール」）
const VENUE_INTERVAL_MS = 2000;

function parseArgs(argv: string[]): { venue?: string; all: boolean } {
  const venueArg = argv.find((a) => a.startsWith("--venue="));
  return { venue: venueArg?.split("=")[1], all: argv.includes("--all") };
}

async function runOne(scraper: ScraperModule) {
  process.stdout.write(`[${scraper.venueId}] scraping... `);
  try {
    const { events, pageHash } = await scraper.run();
    const { upserted, skipped } = upsertEvents(events, pageHash);
    console.log(`ok (found=${events.length}, upserted=${upserted}, skipped=${skipped})`);
  } catch (err) {
    console.log("FAILED");
    console.error(`  [${scraper.venueId}]`, err instanceof Error ? err.message : err);
  }
}

async function main() {
  const { venue, all } = parseArgs(process.argv.slice(2));

  if (!venue && !all) {
    console.error("使い方: npm run scrape -- --venue=tokyo-dome  または  npm run scrape -- --all");
    process.exit(1);
  }

  const targets = all ? SCRAPERS : SCRAPERS.filter((s) => s.venueId === venue);
  if (targets.length === 0) {
    console.error(`未知のvenueId: ${venue}`);
    console.error(`利用可能: ${SCRAPERS.map((s) => s.venueId).join(", ")}`);
    process.exit(1);
  }

  for (let i = 0; i < targets.length; i++) {
    if (i > 0) await sleep(VENUE_INTERVAL_MS);
    await runOne(targets[i]);
  }
}

main();
