// Cache para abrir e gerar PDF sem internet na obra.
// Páginas e arquivos do app: rede primeiro, cache se estiver sem sinal. Bibliotecas de PDF (versão fixa): cache primeiro.
const V = 'nycxo-medida-v5';
const LOCAIS = ['./', 'index.html', 'manifest.json', 'icon.svg', 'apple-touch-icon.png', 'icon-512.png'];
const LIBS = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
];
// Guarda as bibliotecas que ainda não estão no cache (sem falhar a instalação se estiver sem internet).
const guardarLibs = async () => {
  const c = await caches.open(V);
  await Promise.all(LIBS.map(async u => { if (await c.match(u)) return; try { const r = await fetch(u, { mode: 'cors' }); if (r.ok) await c.put(u, r); } catch (e) { } }));
};
self.addEventListener('install', e => { e.waitUntil((async () => { const c = await caches.open(V); await c.addAll(LOCAIS); await guardarLibs(); })()); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('nycxo-medida-') && k !== V) await caches.delete(k);
  await self.clients.claim(); guardarLibs();
})()));
self.addEventListener('message', e => { if (e.data === 'guardar-libs') e.waitUntil(guardarLibs()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (LIBS.includes(req.url)) {
    e.respondWith(caches.match(req.url).then(hit => hit || fetch(req.url, { mode: 'cors' }).then(r => { if (r.ok) { const k = r.clone(); caches.open(V).then(c => c.put(req.url, k)); } return r; })));
    return;
  }
  e.respondWith(fetch(req).then(r => { const k = r.clone(); caches.open(V).then(c => c.put(req, k)); return r; }).catch(() => caches.match(req)));
});
