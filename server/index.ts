import express from "express";
import cors from "cors";
import path from "node:path";
import { getDb } from "../db/index";

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.use(cors());

interface VenueRow {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  stations: string;
  official_url: string;
  source_type: string;
}

interface EventRow {
  id: string;
  venue_id: string;
  name: string;
  genre: string;
  date: string;
  start_time: string | null;
  end_time: string | null;
  scale: string;
  source_url: string | null;
}

// GET /api/venues （仕様書8章）
app.get("/api/venues", (_req, res) => {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM venues").all() as VenueRow[];
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      area: r.area,
      lat: r.lat,
      lng: r.lng,
      stations: JSON.parse(r.stations),
      officialUrl: r.official_url,
    }))
  );
});

// GET /api/events?from=YYYY-MM-DD&to=YYYY-MM-DD&venueId=（仕様書8章）
app.get("/api/events", (req, res) => {
  const { from, to, venueId } = req.query as { from?: string; to?: string; venueId?: string };

  const conditions: string[] = [];
  const params: Record<string, string> = {};
  if (from) {
    conditions.push("date >= @from");
    params.from = from;
  }
  if (to) {
    conditions.push("date <= @to");
    params.to = to;
  }
  if (venueId) {
    conditions.push("venue_id = @venueId");
    params.venueId = venueId;
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const db = getDb();
  const rows = db.prepare(`SELECT * FROM events ${where} ORDER BY date, start_time`).all(params) as EventRow[];

  res.json(
    rows.map((r) => ({
      id: r.id,
      venueId: r.venue_id,
      name: r.name,
      genre: r.genre,
      date: r.date,
      start: r.start_time,
      end: r.end_time,
      scale: r.scale,
      sourceUrl: r.source_url,
    }))
  );
});

// 表示層: 既存デモUIをベースにしたフロントエンド（仕様書9章）
// ビルド後は __dirname が dist/server になり public/ を見失うため、
// リポジトリルート(process.cwd())基準で解決する
app.use(express.static(path.join(process.cwd(), "public")));

app.listen(PORT, () => {
  console.log(`東京どっと混む server listening on http://localhost:${PORT}`);
});
