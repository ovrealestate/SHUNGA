CREATE TABLE IF NOT EXISTS catalog_assets (
 model TEXT PRIMARY KEY,
 image_base64 TEXT,
 mime TEXT,
 info_json TEXT NOT NULL
);
