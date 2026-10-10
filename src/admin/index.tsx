import { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { db } from "../db/schema";
import { parseDocument } from "../rag/parser";
import { chunkText } from "../rag/chunker";
import { ingestDocument } from "../rag/embeddings";

export const adminApp = new Hono();

// JSX Layout Component
const Layout = (props: { children: any; title: string; activePath?: string }) => (
  <html>
    <head>
      <title>{props.title}</title>
      <script src="https://unpkg.com/htmx.org@1.9.10"></script>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>{`
        /* Indikator pemrosesan HTMX */
        .htmx-indicator { display: none; }
        .htmx-request .htmx-indicator { display: inline; }
        .htmx-request .htmx-hide-on-request { display: none; }
      `}</style>
    </head>
    <body class="bg-stone-50 text-stone-900 font-sans antialiased text-sm">
      <nav class="bg-white border-b border-stone-300 px-6 py-3 flex justify-between items-center">
        <h1 class="text-base font-bold text-stone-900">PK2MB Admin</h1>
        <div class="flex items-center gap-6">
          <a href="/admin/dashboard" class={`hover:text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700 transition-colors rounded-sm ${props.activePath === '/dashboard' ? 'text-blue-700 font-semibold underline' : 'text-stone-600'}`}>Dokumen</a>
          <a href="/admin/faq" class={`hover:text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700 transition-colors rounded-sm ${props.activePath === '/faq' ? 'text-blue-700 font-semibold underline' : 'text-stone-600'}`}>FAQ Manual</a>
          <a href="/admin/logs" class={`hover:text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700 transition-colors rounded-sm ${props.activePath === '/logs' ? 'text-blue-700 font-semibold underline' : 'text-stone-600'}`}>Riwayat Percakapan</a>
          <a href="/admin/stats" class={`hover:text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700 transition-colors rounded-sm ${props.activePath === '/stats' ? 'text-blue-700 font-semibold underline' : 'text-stone-600'}`}>Statistik</a>
          <a href="/admin/settings" class={`hover:text-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-700 transition-colors rounded-sm ${props.activePath === '/settings' ? 'text-blue-700 font-semibold underline' : 'text-stone-600'}`}>Pengaturan Kontak</a>
          <a href="/admin/logout" class="text-stone-600 hover:text-stone-900 focus:outline-none focus:ring-1 focus:ring-blue-700 transition-colors border-l border-stone-300 pl-6 rounded-sm">Keluar</a>
        </div>
      </nav>
      <main class="max-w-5xl mx-auto mt-6 px-6 pb-12">
        {props.children}
      </main>
    </body>
  </html>
);

// Form Bantuan Login (agar error form bisa dirender)
const renderLogin = (errorMsg?: string) => (
  <html>
    <head>
      <title>Login - PK2MB Admin</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-stone-50 text-stone-900 font-sans flex items-center justify-center min-h-screen text-sm">
      <div class="bg-white p-8 rounded-md border border-stone-300 w-full max-w-sm">
        <h1 class="text-lg font-bold mb-6 text-stone-900">PK2MB Admin</h1>
        {errorMsg && (
          <div class="mb-4 p-3 bg-red-50 text-red-700 border border-red-300 rounded-md">
            {errorMsg}
          </div>
        )}
        <form method="post" action="/admin/login" class="flex flex-col gap-4">
          <div>
            <label class="block font-medium text-stone-700 mb-1" for="username">Nama pengguna</label>
            <input type="text" id="username" name="username" class="block w-full border border-stone-300 px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700" required />
          </div>
          <div>
            <label class="block font-medium text-stone-700 mb-1" for="password">Kata sandi</label>
            <input type="password" id="password" name="password" class="block w-full border border-stone-300 px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700" required />
          </div>
          <button type="submit" class="bg-blue-700 text-white px-4 py-2 mt-2 rounded-md font-medium hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-700 border border-blue-800">Masuk</button>
        </form>
      </div>
    </body>
  </html>
);

// Middleware Autentikasi
adminApp.use('*', async (c, next) => {
  if (c.req.path === '/admin/login') return next();
  const session = getCookie(c, "admin_session");
  if (!session) return c.redirect("/admin/login");
  await next();
});

// Halaman Login
adminApp.get('/login', (c) => {
  return c.html(renderLogin());
});

// Aksi Login
adminApp.post('/login', async (c) => {
  const body = await c.req.parseBody();
  const username = body.username as string;
  const password = body.password as string;

  const admin = db.query("SELECT * FROM admins WHERE username = $username").get({ $username: username }) as any;
  
  if (admin && await Bun.password.verify(password, admin.password_hash)) {
    setCookie(c, "admin_session", "true", { path: "/", maxAge: 60 * 60 * 24 });
    return c.redirect("/admin/dashboard");
  }
  
  // Jika gagal, kembalikan ke form dengan pesan
  return c.html(renderLogin("Nama pengguna atau kata sandi tidak sesuai."));
});

// Aksi Logout
adminApp.get('/logout', (c) => {
  deleteCookie(c, "admin_session", { path: "/" });
  return c.redirect("/admin/login");
});

// Halaman Dokumen
adminApp.get('/dashboard', (c) => {
  const docs = db.query("SELECT * FROM documents ORDER BY created_at DESC").all() as any[];
  const uploadedChunks = c.req.query('uploaded');
  
  return c.html(
    <Layout title="Dokumen - PK2MB Admin" activePath="/dashboard">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-stone-900">Dokumen Sumber</h2>
        <p class="text-stone-600 mt-1">Unggah dokumen resmi untuk diperbarui ke dalam memori chatbot.</p>
      </div>

      {uploadedChunks && (
        <div class="bg-green-50 border border-green-200 text-green-800 rounded-md p-4 mb-6">
          <p class="font-medium">✅ Dokumen berhasil diproses!</p>
          <p class="text-sm mt-1">Sistem memecah dokumen tersebut menjadi {uploadedChunks} kepingan informasi (chunks) untuk dipelajari.</p>
        </div>
      )}
      
      <div class="bg-white rounded-md border border-stone-300 p-5 mb-6">
        <form hx-post="/admin/upload" hx-encoding="multipart/form-data" hx-target="body" hx-push-url="true" class="flex flex-col sm:flex-row gap-4 items-end">
          <div class="flex-1 w-full">
            <label class="block font-medium text-stone-700 mb-1" for="file">Pilih berkas dokumen (PDF, TXT, DOCX)</label>
            <input type="file" id="file" name="file" class="block w-full border border-stone-300 px-3 py-2 rounded-md bg-stone-50 text-stone-700 file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:bg-stone-200 file:text-stone-800 hover:file:bg-stone-300 cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700" required />
          </div>
          <button type="submit" class="bg-blue-700 text-white px-5 py-2.5 rounded-md font-medium hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-700 border border-blue-800 w-full sm:w-auto shrink-0 flex items-center justify-center">
            <span class="htmx-hide-on-request">Unggah dokumen</span>
            <span class="htmx-indicator">Memproses dokumen...</span>
          </button>
        </form>
      </div>

      <div class="bg-white rounded-md border border-stone-300 overflow-hidden">
        <table class="min-w-full text-left border-collapse">
          <thead class="bg-stone-100 border-b border-stone-300">
            <tr>
              <th class="py-2.5 px-4 font-medium text-stone-700">Nama Dokumen</th>
              <th class="py-2.5 px-4 font-medium text-stone-700 w-32">Status</th>
              <th class="py-2.5 px-4 font-medium text-stone-700 w-48">Tanggal Unggah</th>
              <th class="py-2.5 px-4 font-medium text-stone-700 w-24 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-stone-200 text-stone-800">
            {docs.map(doc => (
              <tr class="hover:bg-stone-50" id={`doc-${doc.id}`}>
                <td class="py-3 px-4">
                  <a href={`/admin/document/${doc.id}/preview`} class="font-medium text-blue-700 hover:underline">{doc.name}</a>
                </td>
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <span class={`w-2 h-2 rounded-full ${doc.status === 'active' ? 'bg-green-600' : 'bg-red-600'}`}></span>
                    {doc.status === 'active' ? 'Aktif' : 'Tidak aktif'}
                  </div>
                </td>
                <td class="py-3 px-4">{new Date(doc.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
                <td class="py-3 px-4 text-right">
                  <div class="flex items-center gap-3 justify-end">
                    {doc.status === 'active' ? (
                      <button hx-patch={`/admin/document/${doc.id}/toggle`} hx-target={`#doc-${doc.id}`} hx-swap="outerHTML" class="text-stone-600 hover:text-stone-900 focus:outline-none text-sm">Nonaktifkan</button>
                    ) : (
                      <button hx-patch={`/admin/document/${doc.id}/toggle`} hx-target={`#doc-${doc.id}`} hx-swap="outerHTML" class="text-stone-600 hover:text-stone-900 focus:outline-none text-sm">Aktifkan</button>
                    )}
                    <button hx-delete={`/admin/document/${doc.id}`} hx-confirm="Yakin ingin menghapus dokumen ini permanen?" hx-target={`#doc-${doc.id}`} hx-swap="outerHTML" class="text-red-700 hover:underline focus:outline-none text-sm">Hapus</button>
                  </div>
                </td>
              </tr>
            ))}
            {docs.length === 0 && (
              <tr>
                <td colSpan={4} class="py-8 text-center text-stone-500">
                  Belum ada dokumen. Silakan unggah dokumen baru.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
});

// Aksi Upload Dokumen
adminApp.post('/upload', async (c) => {
  const body = await c.req.parseBody();
  const file = body.file as File;
  
  if (file) {
    try {
      const buffer = await file.arrayBuffer();
      const text = await parseDocument(file.name, file.type, buffer);
      const chunks = chunkText(text);
      await ingestDocument(crypto.randomUUID(), file.name, chunks);
      return c.redirect(`/admin/dashboard?uploaded=${chunks.length}`);
    } catch (e) {
      console.error("Upload failed:", e);
      // Fallback response for simple error handling
      return c.html(
        <html>
          <head>
            <script src="https://cdn.tailwindcss.com"></script>
          </head>
          <body class="bg-stone-50 text-stone-900 font-sans p-8 text-sm">
            <div class="bg-white p-6 border border-red-300 rounded-md max-w-lg mx-auto mt-10">
              <h2 class="text-red-700 font-bold mb-2">Gagal memproses dokumen</h2>
              <p class="text-stone-700 mb-4">Pastikan format dokumen didukung (PDF, DOCX, TXT) dan teks bisa dibaca oleh sistem. Alasan: {e instanceof Error ? e.message : 'Kesalahan internal'}</p>
              <a href="/admin/dashboard" class="text-blue-700 hover:underline">Kembali ke dokumen</a>
            </div>
          </body>
        </html>
      );
    }
  }
  
  return c.redirect("/admin/dashboard");
});

// Aksi Hapus Dokumen
adminApp.delete('/document/:id', (c) => {
  const id = c.req.param('id');
  db.query("DELETE FROM documents WHERE id = $id").run({ $id: id });
  return c.text(""); // Mengembalikan string kosong untuk menghapus baris via HTMX
});

// Aksi Toggle Status Dokumen
adminApp.patch('/document/:id/toggle', (c) => {
  const id = c.req.param('id');
  const doc = db.query("SELECT * FROM documents WHERE id = $id").get({ $id: id }) as any;
  if (doc) {
    const newStatus = doc.status === 'active' ? 'inactive' : 'active';
    db.query("UPDATE documents SET status = $status WHERE id = $id").run({ $status: newStatus, $id: id });
    const updatedDoc = { ...doc, status: newStatus };
    
    return c.html(
      <tr class="hover:bg-stone-50" id={`doc-${updatedDoc.id}`}>
        <td class="py-3 px-4">
          <a href={`/admin/document/${updatedDoc.id}/preview`} class="font-medium text-blue-700 hover:underline">{updatedDoc.name}</a>
        </td>
        <td class="py-3 px-4">
          <div class="flex items-center gap-2">
            <span class={`w-2 h-2 rounded-full ${updatedDoc.status === 'active' ? 'bg-green-600' : 'bg-red-600'}`}></span>
            {updatedDoc.status === 'active' ? 'Aktif' : 'Tidak aktif'}
          </div>
        </td>
        <td class="py-3 px-4">{new Date(updatedDoc.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}</td>
        <td class="py-3 px-4 text-right">
          <div class="flex items-center gap-3 justify-end">
            {updatedDoc.status === 'active' ? (
              <button hx-patch={`/admin/document/${updatedDoc.id}/toggle`} hx-target={`#doc-${updatedDoc.id}`} hx-swap="outerHTML" class="text-stone-600 hover:text-stone-900 focus:outline-none text-sm">Nonaktifkan</button>
            ) : (
              <button hx-patch={`/admin/document/${updatedDoc.id}/toggle`} hx-target={`#doc-${updatedDoc.id}`} hx-swap="outerHTML" class="text-stone-600 hover:text-stone-900 focus:outline-none text-sm">Aktifkan</button>
            )}
            <button hx-delete={`/admin/document/${updatedDoc.id}`} hx-confirm="Yakin ingin menghapus dokumen ini permanen?" hx-target={`#doc-${updatedDoc.id}`} hx-swap="outerHTML" class="text-red-700 hover:underline focus:outline-none text-sm">Hapus</button>
          </div>
        </td>
      </tr>
    );
  }
  return c.text("");
});

// Halaman Preview Ekstraksi Dokumen
adminApp.get('/document/:id/preview', (c) => {
  const id = c.req.param('id');
  const doc = db.query("SELECT name FROM documents WHERE id = $id").get({ $id: id }) as any;
  if (!doc) return c.text("Dokumen tidak ditemukan", 404);
  
  const chunks = db.query("SELECT chunk_index, content FROM chunks WHERE document_id = $id ORDER BY chunk_index ASC LIMIT 10").all({ $id: id }) as any[];
  
  return c.html(
    <Layout title={`Preview ${doc.name} - PK2MB Admin`} activePath="/dashboard">
      <div class="mb-6">
        <div class="flex items-center gap-4">
          <a href="/admin/dashboard" class="text-stone-500 hover:text-stone-900 focus:outline-none focus:ring-1 focus:ring-stone-500 rounded-sm">← Kembali</a>
          <h2 class="text-xl font-bold text-stone-900">Preview Ekstraksi: {doc.name}</h2>
        </div>
        <p class="text-stone-600 mt-1 md:ml-16">Menampilkan 10 keping teks (chunk) pertama. Gunakan ini untuk mengecek apakah tabel jadwal atau daftar rincian terpotong dengan benar.</p>
      </div>
      <div class="space-y-4 md:ml-16 max-w-4xl">
        {chunks.map(chunk => (
          <div class="bg-white rounded-md border border-stone-300 p-4">
            <div class="text-xs font-bold text-stone-500 uppercase tracking-wider mb-2 border-b border-stone-200 pb-2">Kepingan (Chunk) #{chunk.chunk_index}</div>
            <pre class="font-mono text-sm text-stone-800 whitespace-pre-wrap">{chunk.content}</pre>
          </div>
        ))}
        {chunks.length === 0 && (
          <div class="bg-white rounded-md border border-stone-300 p-8 text-center text-stone-500">
            Dokumen ini tidak memiliki kepingan teks.
          </div>
        )}
      </div>
    </Layout>
  );
});

// Halaman FAQ Manual
adminApp.get('/faq', (c) => {
  const faqs = db.query("SELECT * FROM faqs ORDER BY created_at DESC").all() as any[];
  const prefillQ = c.req.query('q') || '';
  
  return c.html(
    <Layout title="FAQ Manual - PK2MB Admin" activePath="/faq">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-stone-900">FAQ Manual (Jalur Prioritas)</h2>
        <p class="text-stone-600 mt-1">Tambahkan kata kunci spesifik untuk langsung dijawab dengan teks statis tanpa melalui AI (misal untuk jadwal atau biaya).</p>
      </div>
      
      <div class="bg-white rounded-md border border-stone-300 p-5 mb-6">
        <form method="post" action="/admin/faq" class="flex flex-col gap-4">
          <div>
            <label class="block font-medium text-stone-700 mb-1" for="keywords">Kata Kunci (Pisahkan dengan koma)</label>
            <input type="text" id="keywords" name="keywords" value={prefillQ} class="block w-full border border-stone-300 px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700" placeholder="Misal: jadwal, kapan, tanggal" required />
          </div>
          <div>
            <label class="block font-medium text-stone-700 mb-1" for="answer_text">Teks Jawaban Lengkap</label>
            <textarea id="answer_text" name="answer_text" rows={5} class="block w-full border border-stone-300 px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700" placeholder="Masukkan jawaban lengkap di sini (gunakan baris baru untuk memisahkan jadwal)..." required></textarea>
          </div>
          <button type="submit" class="bg-blue-700 text-white px-5 py-2 rounded-md font-medium hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-700 w-full sm:w-auto self-start">Tambah FAQ</button>
        </form>
      </div>

      <div class="space-y-4">
        {faqs.map(faq => (
          <div class="bg-white p-5 rounded-md border border-stone-300 flex justify-between items-start" id={`faq-${faq.id}`}>
            <div class="flex-1 pr-6">
              <div class="mb-2">
                <span class="inline-block bg-stone-200 text-stone-800 text-xs px-2 py-1 rounded font-medium">Kata Kunci: {faq.keywords}</span>
              </div>
              <p class="text-stone-900 whitespace-pre-wrap">{faq.answer_text}</p>
            </div>
            <button hx-delete={`/admin/faq/${faq.id}`} hx-confirm="Yakin ingin menghapus FAQ ini?" hx-target={`#faq-${faq.id}`} hx-swap="outerHTML" class="text-blue-700 hover:underline focus:outline-none text-sm shrink-0">Hapus</button>
          </div>
        ))}
        {faqs.length === 0 && (
          <div class="bg-white rounded-md border border-stone-300 p-8 text-center text-stone-500">
            Belum ada FAQ manual tersimpan.
          </div>
        )}
      </div>
    </Layout>
  );
});

// Aksi Tambah FAQ
adminApp.post('/faq', async (c) => {
  const body = await c.req.parseBody();
  db.query("INSERT INTO faqs (id, keywords, answer_text) VALUES ($id, $keywords, $answer_text)").run({
    $id: crypto.randomUUID(),
    $keywords: (body.keywords as string).toLowerCase().trim(),
    $answer_text: (body.answer_text as string).trim()
  });
  return c.redirect("/admin/faq");
});

// Aksi Hapus FAQ
adminApp.delete('/faq/:id', (c) => {
  db.query("DELETE FROM faqs WHERE id = $id").run({ $id: c.req.param('id') });
  return c.text("");
});

// Halaman Pengaturan Kontak
adminApp.get('/settings', (c) => {
  const settingsRows = db.query("SELECT key, value FROM settings").all() as {key: string, value: string}[];
  const settings = settingsRows.reduce((acc, row) => {
    acc[row.key] = row.value;
    return acc;
  }, {} as Record<string, string>);
  
  return c.html(
    <Layout title="Pengaturan Kontak - PK2MB Admin" activePath="/settings">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-stone-900">Pengaturan Kontak Panitia</h2>
        <p class="text-stone-600 mt-1">Data ini akan digunakan oleh chatbot ketika memberikan pesan error atau informasi yang tidak ada di dokumen.</p>
      </div>
      
      <div class="bg-white rounded-md border border-stone-300 p-6 max-w-2xl">
        <form method="post" action="/admin/settings" class="flex flex-col gap-5">
          <div>
            <label class="block font-medium text-stone-700 mb-1" for="contact_name">Nama Kontak / Jabatan</label>
            <input type="text" id="contact_name" name="contact_name" value={settings['contact_name'] || ''} class="block w-full border border-stone-300 px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700" placeholder="Misal: Panitia Pusat PK2MB" />
          </div>
          <div>
            <label class="block font-medium text-stone-700 mb-1" for="contact_phone">Nomor Telepon / WhatsApp</label>
            <input type="text" id="contact_phone" name="contact_phone" value={settings['contact_phone'] || ''} class="block w-full border border-stone-300 px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700" placeholder="Misal: 081234567890" pattern="^(08|62)[0-9]{7,12}$" title="Nomor harus diawali 08 atau 62, minimal 9 digit" />
            <p class="text-xs text-stone-500 mt-1">Gunakan format Indonesia (diawali 08 atau 62).</p>
          </div>
          <div>
            <label class="block font-medium text-stone-700 mb-1" for="contact_hours">Jam Layanan</label>
            <input type="text" id="contact_hours" name="contact_hours" value={settings['contact_hours'] || ''} class="block w-full border border-stone-300 px-3 py-2 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700" placeholder="Misal: Senin-Jumat, 08:00 - 16:00 WIB" />
          </div>
          <div class="pt-2">
            <button type="submit" class="bg-blue-700 text-white px-5 py-2.5 rounded-md font-medium hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-700 border border-blue-800">Simpan Pengaturan</button>
          </div>
        </form>
      </div>
    </Layout>
  );
});

// Aksi Simpan Pengaturan
adminApp.post('/settings', async (c) => {
  const body = await c.req.parseBody();
  const updateStmt = db.prepare("UPDATE settings SET value = $value, updated_at = CURRENT_TIMESTAMP WHERE key = $key");
  
  if (typeof body.contact_name === 'string') updateStmt.run({ $key: 'contact_name', $value: body.contact_name });
  if (typeof body.contact_phone === 'string') updateStmt.run({ $key: 'contact_phone', $value: body.contact_phone });
  if (typeof body.contact_hours === 'string') updateStmt.run({ $key: 'contact_hours', $value: body.contact_hours });
  
  return c.redirect("/admin/settings");
});

// Halaman Riwayat Percakapan
adminApp.get('/logs', (c) => {
  const logs = db.query("SELECT * FROM chat_logs ORDER BY timestamp DESC LIMIT 50").all() as any[];
  
  return c.html(
    <Layout title="Riwayat Percakapan - PK2MB Admin" activePath="/logs">
      <div class="mb-6 flex justify-between items-end">
        <div>
          <h2 class="text-xl font-bold text-stone-900">Riwayat Percakapan</h2>
          <p class="text-stone-600 mt-1">Daftar 50 interaksi terakhir antara calon mahasiswa dan chatbot.</p>
        </div>
      </div>
      
      <div class="bg-white rounded-md border border-stone-300 p-4 mb-6">
        <label class="font-medium text-stone-700 mr-4" for="filter-logs">Saring riwayat:</label>
        <select id="filter-logs" class="border border-stone-300 px-3 py-1.5 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-700 focus:border-blue-700" onchange="filterLogs(this.value)">
          <option value="all">Semua percakapan</option>
          <option value="unanswered">Hanya pertanyaan yang gagal dijawab</option>
        </select>
        <script dangerouslySetInnerHTML={{__html: `
          function filterLogs(filterType) {
            const items = document.querySelectorAll('.log-item');
            items.forEach(item => {
              if (filterType === 'all') {
                item.style.display = 'block';
              } else if (filterType === 'unanswered') {
                if (item.dataset.unanswered === 'true') {
                  item.style.display = 'block';
                } else {
                  item.style.display = 'none';
                }
              }
            });
          }
        `}}></script>
      </div>
      
      <div class="space-y-4">
        {logs.map(log => (
          <div class={`log-item p-5 rounded-md border ${log.unanswered_flag ? 'bg-orange-50 border-orange-300' : 'bg-white border-stone-300'}`} data-unanswered={log.unanswered_flag ? 'true' : 'false'}>
            <div class="flex justify-between items-start mb-4 border-b border-stone-200 pb-3">
              <span class="text-stone-500 font-medium">
                {new Date(log.timestamp).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}
                {log.feedback === 1 && <span class="ml-3 text-green-600 text-sm font-bold" title="Umpan balik positif dari pengguna">👍 Berguna</span>}
                {log.feedback === -1 && <span class="ml-3 text-red-600 text-sm font-bold" title="Umpan balik negatif dari pengguna">👎 Tidak berguna</span>}
              </span>
              <span class={`font-medium ${log.unanswered_flag ? 'text-orange-700' : 'text-stone-500'}`}>
                {log.unanswered_flag ? 'Tidak ditemukan di dokumen' : 'Ditemukan di dokumen'} 
                <span class="text-stone-400 font-normal ml-1">(Tingkat kecocokan: {log.similarity_score?.toFixed(3) || '0.000'})</span>
                {log.unanswered_flag === 1 && (
                  <a href={`/admin/faq?q=${encodeURIComponent(log.question)}`} class="ml-4 inline-block bg-orange-200 text-orange-800 hover:bg-orange-300 px-2 py-0.5 rounded text-xs font-bold transition-colors">Buat FAQ dari ini</a>
                )}
              </span>
            </div>
            <div class="mb-3">
              <span class="block font-medium text-stone-700 mb-1">Pertanyaan</span>
              <p class="text-stone-900">{log.question}</p>
            </div>
            <div>
              <span class="block font-medium text-stone-700 mb-1">Jawaban bot</span>
              <p class="text-stone-900 whitespace-pre-wrap">{log.answer}</p>
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div class="bg-white rounded-md border border-stone-300 p-8 text-center text-stone-500">
            Belum ada interaksi tercatat.
          </div>
        )}
      </div>
    </Layout>
  );
});

// Halaman Statistik
adminApp.get('/stats', (c) => {
  const totalQuestions = (db.query("SELECT COUNT(*) as count FROM chat_logs").get() as any).count;
  const answeredQuestions = (db.query("SELECT COUNT(*) as count FROM chat_logs WHERE unanswered_flag = 0").get() as any).count;
  const successRate = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;
  
  const totalThumbsUp = (db.query("SELECT COUNT(*) as count FROM chat_logs WHERE feedback = 1").get() as any).count;
  const totalThumbsDown = (db.query("SELECT COUNT(*) as count FROM chat_logs WHERE feedback = -1").get() as any).count;
  
  return c.html(
    <Layout title="Statistik - PK2MB Admin" activePath="/stats">
      <div class="mb-6">
        <h2 class="text-xl font-bold text-stone-900">Statistik Chatbot</h2>
        <p class="text-stone-600 mt-1">Ringkasan performa dan interaksi chatbot dengan calon mahasiswa.</p>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div class="bg-white p-6 rounded-md border border-stone-300">
          <h3 class="text-sm font-medium text-stone-500 uppercase tracking-wider mb-1">Total Pertanyaan</h3>
          <p class="text-3xl font-bold text-stone-900">{totalQuestions}</p>
        </div>
        
        <div class="bg-white p-6 rounded-md border border-stone-300">
          <h3 class="text-sm font-medium text-stone-500 uppercase tracking-wider mb-1">Tingkat Keberhasilan</h3>
          <div class="flex items-end gap-2">
            <p class="text-3xl font-bold text-stone-900">{successRate}%</p>
            <p class="text-sm text-stone-500 mb-1">terjawab dari sumber</p>
          </div>
        </div>

        <div class="bg-white p-6 rounded-md border border-stone-300">
          <h3 class="text-sm font-medium text-stone-500 uppercase tracking-wider mb-1">Umpan Balik Pengguna</h3>
          <div class="flex gap-4 mt-1">
            <div class="flex items-center gap-1.5">
              <span class="text-green-600">👍</span>
              <span class="text-xl font-bold text-stone-900">{totalThumbsUp}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-red-600">👎</span>
              <span class="text-xl font-bold text-stone-900">{totalThumbsDown}</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
});
