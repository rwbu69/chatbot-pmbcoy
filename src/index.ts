import { initDb } from "./db/schema";
import { Hono } from "hono";
import { startBot } from "./bot/index";
import { adminApp } from "./admin/index";

const app = new Hono();

// Redirect root to admin dashboard
app.get("/", (c) => c.redirect("/admin/dashboard"));

// Mount the admin app
app.route("/admin", adminApp);

async function start() {
    console.log("Initializing database schema...");
    await initDb();

    console.log("Starting Telegram Bot...");
    startBot();

    const port = process.env.PORT || 3000;
    console.log(`Starting Web Server for Admin Dashboard...`);
    
    Bun.serve({
        port: port,
        fetch: app.fetch,
    });
    
    console.log(`✅ Admin Dashboard is running at http://localhost:${port}/admin/login`);
}

start().catch(console.error);
