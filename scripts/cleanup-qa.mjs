import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.resolve(__dirname, "..", "data", "bugbounty.db"));
db.exec("PRAGMA journal_mode = WAL");

const before = {
  reports: db.prepare("SELECT COUNT(*) c FROM reports").get().c,
  findings: db.prepare("SELECT COUNT(*) c FROM findings").get().c,
  activity: db.prepare("SELECT COUNT(*) c FROM activity").get().c,
  timeline: db.prepare("SELECT COUNT(*) c FROM timeline_events").get().c,
};

// empty test stubs from New-Finding testing
db.prepare("DELETE FROM reports WHERE title IN ('Untitled finding','Untitled Report','QA Row Finding')").run();
db.prepare("DELETE FROM findings WHERE title IN ('Untitled finding','QA Row Finding')").run();
// my QA-prefixed activity + timeline log rows (append-only logs)
db.prepare("DELETE FROM activity WHERE title LIKE 'QA-%' OR title LIKE '%QA-%' OR title LIKE 'QA %' OR title LIKE '%QA %' OR title LIKE '%Untitled%' OR title LIKE 'Added program QA%'").run();
db.prepare("DELETE FROM timeline_events WHERE title LIKE '%QA%' OR detail LIKE '%QA%' OR detail LIKE '%Untitled%'").run();

const after = {
  reports: db.prepare("SELECT COUNT(*) c FROM reports").get().c,
  findings: db.prepare("SELECT COUNT(*) c FROM findings").get().c,
  activity: db.prepare("SELECT COUNT(*) c FROM activity").get().c,
  timeline: db.prepare("SELECT COUNT(*) c FROM timeline_events").get().c,
};
db.close();
console.log("removed:",
  "reports", before.reports - after.reports,
  "| findings", before.findings - after.findings,
  "| activity", before.activity - after.activity,
  "| timeline", before.timeline - after.timeline);
console.log("remaining:", after);
