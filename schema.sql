CREATE TABLE IF NOT EXISTS inventory (
 id TEXT PRIMARY KEY,
 position INTEGER NOT NULL,
 product_json TEXT NOT NULL CHECK(json_valid(product_json)),
 physical INTEGER CHECK(physical IS NULL OR (typeof(physical)='integer' AND physical BETWEEN 0 AND 20)),
 updated TEXT NOT NULL DEFAULT '',
 revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS inventory_history (
 event_id INTEGER PRIMARY KEY AUTOINCREMENT,
 variant_id TEXT NOT NULL,
 previous INTEGER,
 physical INTEGER,
 updated TEXT NOT NULL,
 revision INTEGER NOT NULL,
 actor TEXT NOT NULL DEFAULT 'morelos'
);
CREATE TRIGGER IF NOT EXISTS inventory_audit AFTER UPDATE OF physical ON inventory
BEGIN
 INSERT INTO inventory_history(variant_id,previous,physical,updated,revision)
 VALUES(NEW.id,OLD.physical,NEW.physical,NEW.updated,NEW.revision);
END;
