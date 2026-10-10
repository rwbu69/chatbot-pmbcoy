import { Bot, InlineKeyboard, Context } from "grammy";
import { db, getContactString } from "../db/schema";
import { composeAnswer } from "../rag/answer";

const botToken = process.env.BOT_TOKEN;
if (!botToken) {
    console.warn("BOT_TOKEN is not set in .env. Telegram bot will not start.");
}

export const bot = botToken ? new Bot(botToken) : null;

// Helper: Common Keyboard
const topicsKeyboard = new InlineKeyboard()
    .text("📅 Jadwal", "topic_jadwal")
    .text("💰 Biaya", "topic_biaya")
    .row()
    .text("📋 Syarat", "topic_syarat")
    .text("📞 Kontak", "topic_kontak");

// Glosarium Singkatan (Normalisasi Teks)
const glossary: Record<string, string> = {
    "ukt": "uang kuliah tunggal",
    "mbkm": "merdeka belajar kampus merdeka",
    "pa": "pembimbing akademik",
    "ukm": "unit kegiatan mahasiswa",
    "ospek": "pengenalan kehidupan kampus",
    "pk2mb": "pengenalan kehidupan kampus",
    "krs": "kartu rencana studi",
    "kpn": "kapan",
    "brp": "berapa",
    "bgmn": "bagaimana",
    "gmn": "bagaimana",
    "dmn": "dimana",
    "tdk": "tidak",
    "gak": "tidak",
    "nggak": "tidak",
    "blm": "belum",
    "sdh": "sudah",
    "pdhl": "padahal",
    "sm": "sama",
    "yg": "yang",
    "utbk": "ujian tulis",
    "snbp": "jalur prestasi",
    "snbt": "jalur tes"
};

function normalizeText(text: string): string {
    let normalized = text;
    for (const [key, value] of Object.entries(glossary)) {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        normalized = normalized.replace(regex, value);
    }
    return normalized;
}

// Debounce Map
const pendingMessages = new Map<string, { timer: any, texts: string[] }>();

if (bot) {
    bot.command("start", (ctx) => {
        const msg = "Halo! Saya adalah asisten virtual resmi PK2MB.\n\n" +
            "Silakan ketik pertanyaan Anda, misalnya:\n" +
            "- Kapan jadwal ospek hari pertama?\n" +
            "- Apa saja syarat pendaftaran ulang?\n\n" +
            "Perhatian: Informasi jadwal atau kegiatan dapat berubah sewaktu-waktu. Tetap jadikan pengumuman resmi dari panitia sebagai rujukan utama.";
        ctx.reply(msg, { reply_markup: topicsKeyboard });
    });

    bot.command("help", (ctx) => {
        const msg = "Ketikkan pertanyaan Anda seputar PK2MB, dan saya akan menjawab berdasarkan dokumen resmi panitia.\n\n" +
            "Perhatian: Informasi jadwal atau kegiatan dapat berubah sewaktu-waktu. Tetap jadikan pengumuman resmi dari panitia sebagai rujukan utama.\n\n" +
            getContactString();
        ctx.reply(msg, { reply_markup: topicsKeyboard });
    });

    bot.command("info", (ctx) => {
        const doc = db.query("SELECT MAX(created_at) as last_update FROM documents").get() as { last_update: string } | undefined;
        if (doc && doc.last_update) {
            const dateStr = new Date(doc.last_update).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' });
            ctx.reply(`Dokumen sumber pengetahuan chatbot terakhir diperbarui pada: ${dateStr}.`);
        } else {
            ctx.reply("Belum ada dokumen sumber yang diunggah ke dalam basis pengetahuan.");
        }
    });

    // Handle button clicks
    bot.on("callback_query:data", async (ctx) => {
        const data = ctx.callbackQuery.data;
        
        if (data === "topic_kontak") {
            await ctx.answerCallbackQuery();
            await ctx.reply(getContactString());
            return;
        }

        if (data.startsWith("topic_")) {
            await ctx.answerCallbackQuery();
            const topic = data.split("_")[1];
            await ctx.reply(`Silakan ketikkan pertanyaan spesifik Anda mengenai ${topic} PK2MB.`);
            return;
        }

        if (data.startsWith("fb_")) {
            const parts = data.split("_");
            const value = parseInt(parts[1]); // 1 or -1
            const logId = parts[2];
            
            try {
                db.query("UPDATE chat_logs SET feedback = $feedback WHERE id = $id").run({
                    $feedback: value,
                    $id: logId
                });
                await ctx.answerCallbackQuery("Terima kasih atas masukannya!");
                await ctx.editMessageReplyMarkup({ reply_markup: new InlineKeyboard() }).catch(() => {});
            } catch (e) {
                await ctx.answerCallbackQuery("Gagal menyimpan masukan.");
            }
            return;
        }
    });

    // Handle non-text messages
    bot.on(["message:photo", "message:video", "message:voice", "message:sticker", "message:document"], async (ctx) => {
        await ctx.reply("Maaf, saat ini saya hanya bisa membaca pertanyaan berupa teks. Silakan ketikkan pertanyaan Anda.");
    });

    // Handle text messages (with Debounce)
    bot.on("message:text", async (ctx) => {
        // Group Behavior Filter
        if (ctx.chat.type === "group" || ctx.chat.type === "supergroup") {
            const isMentioned = ctx.me && ctx.message.text.includes(`@${ctx.me.username}`);
            const isReplyToBot = ctx.message.reply_to_message?.from?.id === ctx.me?.id;
            if (!isMentioned && !isReplyToBot) {
                return; // Ignore general chatter in groups
            }
        }

        const chatId = ctx.chat.id.toString();
        const questionText = ctx.message.text.trim();

        let sessionData = pendingMessages.get(chatId);
        if (sessionData) {
            clearTimeout(sessionData.timer);
            sessionData.texts.push(questionText);
        } else {
            sessionData = { texts: [questionText], timer: null };
            pendingMessages.set(chatId, sessionData);
        }

        sessionData.timer = setTimeout(async () => {
            const finalData = pendingMessages.get(chatId);
            if (!finalData) return;
            pendingMessages.delete(chatId);
            
            const combinedQuestion = finalData.texts.join("\n");
            await processQuestion(ctx, chatId, combinedQuestion);
        }, 1500);
    });

    // Error handling
    bot.catch((err) => {
        console.error(`Error while handling Telegram update ${err.ctx.update.update_id}:`);
        console.error(err.error);
    });
}

async function processQuestion(ctx: Context, chatId: string, question: string) {
    const lowerQ = question.toLowerCase();

    // 1. Rule-based Filter: Greetings & Thanks
    if (/^(halo|hai|selamat (pagi|siang|sore|malam)|p!|ping)( bot| admin)?$/i.test(lowerQ)) {
        return ctx.reply("Halo! Ada yang bisa saya bantu terkait jadwal, syarat, atau biaya PK2MB?", { reply_markup: topicsKeyboard });
    }
    if (/^(terima kasih|makasih|thanks|tq)( banyak)?$/i.test(lowerQ)) {
        return ctx.reply("Sama-sama! Semoga sukses dengan PK2MB-nya. Ada lagi yang ingin ditanyakan?");
    }

    // 2. Rule-based Filter: Ambiguous/Short Questions
    if (question.length < 15 && /^(info|biaya|jadwal|syarat)[\s?]*$/i.test(lowerQ)) {
        return ctx.reply(`Pertanyaan Anda terlalu singkat ("${question}"). Silakan pilih topik di bawah ini atau ketik pertanyaan yang lebih spesifik:`, { reply_markup: topicsKeyboard });
    }

    ctx.replyWithChatAction("typing").catch(() => {});

    // 2.5. Normalize Question for RAG/FAQ processing
    const normalizedQuestion = normalizeText(question);
    const lowerNormalizedQ = normalizedQuestion.toLowerCase();

    // 3. Manual FAQ Override (Bypass RAG)
    const faqs = db.query("SELECT * FROM faqs").all() as {id: string, keywords: string, answer_text: string}[];
    let faqMatched = false;
    
    for (const faq of faqs) {
        const keywords = faq.keywords.split(",").map(k => k.trim().toLowerCase());
        for (const kw of keywords) {
            if (kw && new RegExp(`\\b${kw}\\b`, 'i').test(lowerNormalizedQ)) {
                const logId = crypto.randomUUID();
                db.query(`
                    INSERT INTO chat_logs (id, chat_id, question, answer, similarity_score, unanswered_flag)
                    VALUES ($id, $chat_id, $question, $answer, $similarity_score, $unanswered_flag)
                `).run({
                    $id: logId,
                    $chat_id: chatId,
                    $question: question,
                    $answer: faq.answer_text + "\n\n[Sumber: FAQ Manual]",
                    $similarity_score: 1.0,
                    $unanswered_flag: 0
                });

                const feedbackKeyboard = new InlineKeyboard()
                    .text("👍 Berguna", `fb_1_${logId}`)
                    .text("👎 Kurang Pas", `fb_-1_${logId}`);

                await ctx.reply(faq.answer_text, { reply_markup: feedbackKeyboard });
                faqMatched = true;
                break;
            }
        }
        if (faqMatched) break;
    }
    
    if (faqMatched) return;

    // 4. Get Session History & Unanswered Count
    let history: { role: string, content: string }[] = [];
    let unansweredCount = 0;
    
    // Add try-catch since unanswered_count might not exist if migration failed
    try {
        const session = db.query("SELECT history, unanswered_count FROM chat_sessions WHERE chat_id = $chat_id").get({ $chat_id: chatId }) as { history: string, unanswered_count: number } | undefined;
        if (session) {
            history = JSON.parse(session.history);
            unansweredCount = session.unanswered_count || 0;
        }
    } catch (e) {
        // Fallback to old schema query if column doesn't exist
        const session = db.query("SELECT history FROM chat_sessions WHERE chat_id = $chat_id").get({ $chat_id: chatId }) as { history: string } | undefined;
        if (session) history = JSON.parse(session.history);
    }

    try {
        // 5. Compose Answer using RAG Pipeline (using normalized question for better retrieval)
        const { answer, score, flag, source } = await composeAnswer(normalizedQuestion, history);

        // 6. Update Session History & Handoff Logic
        history.push({ role: "user", content: question }); // still save original to history
        history.push({ role: "assistant", content: answer });
        if (history.length > 8) {
            history = history.slice(history.length - 8);
        }

        if (flag) {
            unansweredCount++;
        } else {
            unansweredCount = 0;
        }

        try {
            db.query(`
                INSERT INTO chat_sessions (chat_id, history, updated_at, unanswered_count) 
                VALUES ($chat_id, $history, CURRENT_TIMESTAMP, $unanswered_count)
                ON CONFLICT(chat_id) DO UPDATE SET history=excluded.history, updated_at=excluded.updated_at, unanswered_count=excluded.unanswered_count
            `).run({
                $chat_id: chatId,
                $history: JSON.stringify(history),
                $unanswered_count: unansweredCount
            });
        } catch (e) {
             // Fallback if schema is old
             db.query(`
                INSERT INTO chat_sessions (chat_id, history, updated_at) 
                VALUES ($chat_id, $history, CURRENT_TIMESTAMP)
                ON CONFLICT(chat_id) DO UPDATE SET history=excluded.history, updated_at=excluded.updated_at
            `).run({
                $chat_id: chatId,
                $history: JSON.stringify(history)
            });
        }

        // 7. Log Interaction for the Dashboard
        const answerForLog = source ? `${answer}\n\n[Sumber: ${source}]` : answer;
        const logId = crypto.randomUUID();

        db.query(`
            INSERT INTO chat_logs (id, chat_id, question, answer, similarity_score, unanswered_flag)
            VALUES ($id, $chat_id, $question, $answer, $similarity_score, $unanswered_flag)
        `).run({
            $id: logId,
            $chat_id: chatId,
            $question: question,
            $answer: answerForLog,
            $similarity_score: score,
            $unanswered_flag: flag ? 1 : 0
        });

        // 8. Reply to user with Feedback Buttons or Human Handoff
        let replyMarkup = new InlineKeyboard()
            .text("👍 Berguna", `fb_1_${logId}`)
            .text("👎 Kurang Pas", `fb_-1_${logId}`);

        if (unansweredCount >= 2) {
            replyMarkup = new InlineKeyboard().text("📞 Hubungi Panitia (WA)", "topic_kontak");
        }

        await ctx.reply(answer, { reply_markup: replyMarkup });

    } catch (e) {
        console.error("RAG Pipeline Error:", e);
        await ctx.reply(`Maaf, sistem saat ini sedang sibuk atau mengalami gangguan teknis. Mohon coba beberapa saat lagi.\n\n${getContactString()}`);
    }
}

export function startBot() {
    if (bot) {
        bot.api.setMyCommands([
            { command: "start", description: "Mulai percakapan baru" },
            { command: "help", description: "Bantuan dan informasi kontak" },
            { command: "info", description: "Cek waktu pembaruan dokumen terakhir" }
        ]).catch(e => console.error("Failed to set commands", e));

        bot.start({
            onStart: (botInfo) => {
                console.log(`Telegram Bot @${botInfo.username} started successfully.`);
            }
        });
    }
}
