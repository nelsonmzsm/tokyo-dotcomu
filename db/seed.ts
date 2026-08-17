import { getDb } from "./index";

// MVP対象6会場のマスタデータ（仕様書「2. スコープ」「8. API仕様」準拠）
// 座標・最寄り駅は既存デモ(tokyo-dotcomu-realmap-demo.html)のVENUES/STATIONSを踏襲

interface VenueSeed {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  stations: { name: string; lines: string[] }[];
  officialUrl: string;
  sourceType: string;
}

const VENUES: VenueSeed[] = [
  {
    id: "tokyo-dome",
    name: "東京ドーム",
    area: "文京区",
    lat: 35.7056,
    lng: 139.7519,
    stations: [
      { name: "水道橋駅", lines: ["chuo", "mita"] },
      { name: "後楽園駅", lines: ["marunouchi", "namboku"] },
    ],
    officialUrl: "https://www.tokyo-dome.co.jp/dome/event/schedule.html",
    sourceType: "official_table",
  },
  {
    id: "bigsight",
    name: "東京ビッグサイト",
    area: "江東区",
    lat: 35.6300,
    lng: 139.7930,
    stations: [
      { name: "国際展示場駅", lines: ["rinkai"] },
      { name: "東京テレポート駅", lines: ["rinkai"] },
    ],
    officialUrl: "https://www.bigsight.jp/visitor/event/",
    sourceType: "official_list",
  },
  {
    id: "ariake-arena",
    name: "有明アリーナ",
    area: "江東区",
    lat: 35.6417,
    lng: 139.7936,
    stations: [{ name: "国際展示場駅", lines: ["rinkai"] }],
    officialUrl: "https://ariake-arena.tokyo/event/",
    sourceType: "official_list",
  },
  {
    id: "forum",
    name: "東京国際フォーラム",
    area: "千代田区",
    lat: 35.6751,
    lng: 139.7631,
    stations: [{ name: "有楽町駅", lines: ["yamanote", "yurakucho"] }],
    officialUrl: "https://www.t-i-forum.co.jp/visitors/event/",
    sourceType: "official_calendar",
  },
  {
    id: "kokuritsu",
    name: "国立競技場",
    area: "新宿区",
    lat: 35.6780,
    lng: 139.7150,
    stations: [
      { name: "国立競技場駅", lines: ["oedo"] },
      { name: "千駄ケ谷駅", lines: ["chuo"] },
    ],
    officialUrl: "https://jns-e.com/event/",
    sourceType: "official_list",
  },
  {
    id: "zepp-diver",
    name: "Zepp DiverCity",
    area: "江東区",
    lat: 35.6259,
    lng: 139.7754,
    stations: [{ name: "お台場海浜公園駅", lines: ["yurikamome"] }],
    officialUrl: "https://www.zepp.co.jp/hall/divercity/schedule/",
    sourceType: "official_list",
  },
  // 花火大会（常設会場ではなく年1回の単発イベント。座標は打ち上げ場所付近の概略値）
  {
    id: "fireworks-akishima",
    name: "昭島市民くじら祭 夢花火",
    area: "昭島市",
    lat: 35.7060,
    lng: 139.3745,
    stations: [{ name: "東中神駅", lines: ["ome"] }],
    officialUrl: "https://akishima-kujiramatsuri.jp/",
    sourceType: "official_single_event",
  },
  {
    id: "fireworks-chofu",
    name: "調布花火",
    area: "調布市",
    lat: 35.6270,
    lng: 139.5300,
    stations: [
      { name: "京王多摩川駅", lines: ["keio-sagamihara"] },
      { name: "布田駅", lines: ["keio"] },
    ],
    officialUrl: "https://hanabi.csa.gr.jp/",
    sourceType: "official_single_event",
  },
  {
    id: "fireworks-kita",
    name: "北区花火会 RED×BLUE SPARKLE GATE",
    area: "北区",
    lat: 35.7865,
    lng: 139.7305,
    stations: [
      { name: "赤羽岩淵駅", lines: ["namboku"] },
      { name: "赤羽駅", lines: ["keihintohoku"] },
    ],
    officialUrl: "https://hanabi-kita.com/",
    sourceType: "official_single_event",
  },
  {
    id: "fireworks-setagaya",
    name: "世田谷区たまがわ花火大会",
    area: "世田谷区",
    lat: 35.6070,
    lng: 139.6265,
    stations: [{ name: "二子玉川駅", lines: ["denentoshi"] }],
    officialUrl: "https://www.tamagawa-hanabi.com/",
    sourceType: "official_single_event",
  },
  {
    id: "fireworks-ota",
    name: "大田区平和祈念花火",
    area: "大田区",
    lat: 35.5465,
    lng: 139.7125,
    stations: [{ name: "六郷土手駅", lines: ["keikyu"] }],
    officialUrl: "https://www.city.ota.tokyo.jp/kanko/topics/heiwakinenhanabi.html",
    sourceType: "official_single_event",
  },
  {
    id: "fireworks-tokyobay",
    name: "東京湾大華火祭",
    area: "中央区・港区",
    lat: 35.6480,
    lng: 139.7825,
    stations: [
      { name: "豊洲駅", lines: ["yurakucho"] },
      { name: "新豊洲駅", lines: ["yurikamome"] },
    ],
    officialUrl: "https://tokyo-hanabi-festival.com/",
    sourceType: "official_single_event",
  },
];

function seed() {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO venues (id, name, area, lat, lng, stations, official_url, source_type)
    VALUES (@id, @name, @area, @lat, @lng, @stations, @officialUrl, @sourceType)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      area = excluded.area,
      lat = excluded.lat,
      lng = excluded.lng,
      stations = excluded.stations,
      official_url = excluded.official_url,
      source_type = excluded.source_type
  `);

  const insertMany = db.transaction((venues: VenueSeed[]) => {
    for (const v of venues) {
      upsert.run({ ...v, stations: JSON.stringify(v.stations) });
    }
  });

  insertMany(VENUES);
  console.log(`Seeded ${VENUES.length} venues.`);
}

seed();
