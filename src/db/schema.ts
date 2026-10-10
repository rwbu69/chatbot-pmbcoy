import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

// Load environment variables
const dbFile = process.env.DB_FILE || "data/chatbot.sqlite";
const adminUsername = process.env.ADMIN_USERNAME || "admin";
const adminPassword = process.env.ADMIN_PASSWORD || "admin";

// Ensure the directory exists before creating the database file
mkdirSync(dirname(dbFile), { recursive: true });

export const db = new Database(dbFile, { create: true });

export async function initDb() {
  db.run(`
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        chunk_index INTEGER NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS admins (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_logs (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        similarity_score REAL,
        unanswered_flag BOOLEAN DEFAULT 0,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
        chat_id TEXT PRIMARY KEY,
        history TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS faqs (
        id TEXT PRIMARY KEY,
        keywords TEXT NOT NULL,
        answer_text TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Menambahkan kolom feedback tanpa merusak data lama
  try {
    db.run(`ALTER TABLE chat_logs ADD COLUMN feedback INTEGER DEFAULT 0;`);
  } catch (e) {
    // Abaikan jika kolom sudah ada
  }

  try {
    db.run(`ALTER TABLE chat_sessions ADD COLUMN unanswered_count INTEGER DEFAULT 0;`);
  } catch (e) {
    // Abaikan
  }

  // Initialize Default Admin
  const adminExists = db.query("SELECT * FROM admins WHERE username = $username").get({
      $username: adminUsername
  });
  
  if (!adminExists) {
    const hash = await Bun.password.hash(adminPassword);
    db.query("INSERT INTO admins (id, username, password_hash) VALUES ($id, $username, $hash)").run({
        $id: crypto.randomUUID(),
        $username: adminUsername,
        $hash: hash
    });
    console.log(`Default admin user '${adminUsername}' created.`);
  }

  // Inisialisasi pengaturan default jika tabel kosong
  const settingsCount = db.query("SELECT COUNT(*) as count FROM settings").get() as { count: number };
  if (settingsCount.count === 0) {
    const defaultSettings = [
      { key: "contact_name", value: process.env.CONTACT_NAME || "Panitia Pusat PK2MB" },
      { key: "contact_phone", value: process.env.CONTACT_PHONE || "081234567890" },
      { key: "contact_hours", value: process.env.CONTACT_HOURS || "Senin-Jumat, 08:00 - 16:00 WIB" }
    ];
    
    const insertSetting = db.prepare("INSERT INTO settings (key, value) VALUES ($key, $value)");
    for (const setting of defaultSettings) {
      insertSetting.run({ $key: setting.key, $value: setting.value });
    }
    console.log("Default settings seeded.");
  }

  console.log("Database schema initialized.");
}

export function getContactString() {
  try {
    const rows = db.query("SELECT key, value FROM settings").all() as {key: string, value: string}[];
    const settings = rows.reduce((acc, row) => {
      acc[row.key] = row.value;
      return acc;
    }, {} as Record<string, string>);
    
    let contactString = "";
    if (settings['contact_name'] || settings['contact_phone']) {
      contactString = `Silakan hubungi ${settings['contact_name'] || 'Panitia'}`;
      if (settings['contact_phone']) {
        contactString += ` di ${settings['contact_phone']}`;
      }
      if (settings['contact_hours']) {
        contactString += ` (Jam layanan: ${settings['contact_hours']}).`;
      } else {
        contactString += `.`;
      }
    }
    return contactString;
  } catch (e) {
    return "Silakan hubungi panitia pendaftaran."; // Fallback if settings table is not ready yet
  }
}
