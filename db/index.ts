import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// process.cwd() を基準にする（tsxでの実行時と、tscビルド後にdist/から実行する時とで
// __dirname が db/ と dist/db/ にずれてしまい、schema.sqlや既存のsqliteファイルを
// 見失うため。両ケースともリポジトリルートから起動される前提）
const DB_PATH = path.join(process.cwd(), "db", "tokyo-dotcomu.sqlite");
const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  const schema = fs.readFileSync(SCHEMA_PATH, "utf-8");
  db.exec(schema);
  return db;
}
