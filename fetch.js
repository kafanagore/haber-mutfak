/* ============================================================
   HABER MUTFAĞI — RSS haber toplama + kategori derleme
   Çıktı: briefing.json  (telefonun okuyacağı dosya)
   ============================================================ */
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const parser = new Parser({
  timeout: 12000,
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HaberSaati/1.0)' }
});

// Kategori -> RSS kaynakları (birden fazla; bazıları çalışmazsa sorun değil)
const FEEDS = {
  gundem: [
    'https://www.ntv.com.tr/gundem.rss',
    'https://www.hurriyet.com.tr/rss/gundem',
    'https://feeds.bbci.co.uk/turkce/rss.xml'
  ],
  dunya: [
    'https://www.ntv.com.tr/dunya.rss',
    'https://www.hurriyet.com.tr/rss/dunya'
  ],
  ekonomi: [
    'https://www.ntv.com.tr/ekonomi.rss',
    'https://www.hurriyet.com.tr/rss/ekonomi'
  ],
  spor: [
    'https://www.ntv.com.tr/spor.rss',
    'https://www.hurriyet.com.tr/rss/spor'
  ],
  teknoloji: [
    'https://www.ntv.com.tr/teknoloji.rss',
    'https://www.hurriyet.com.tr/rss/teknoloji'
  ],
  saglik: [
    'https://www.ntv.com.tr/saglik.rss',
    'https://www.hurriyet.com.tr/rss/saglik'
  ],
  magazin: [
    'https://www.hurriyet.com.tr/rss/magazin'
  ]
};

const PER_CATEGORY = 5;

function cleanText(s) {
  if (!s) return '';
  return String(s)
    .replace(/<[^>]*>/g, ' ')            // HTML etiketleri
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n))
    .replace(/\s+/g, ' ')
    .trim();
}
function normTitle(t) {
  return cleanText(t).toLowerCase().replace(/[^a-z0-9çğıöşü ]/gi, '').trim();
}

async function fetchFeed(url) {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items || []).map(it => ({
      title: cleanText(it.title),
      summary: cleanText(it.contentSnippet || it.content || it.summary || ''),
      link: it.link || '',
      date: it.isoDate || it.pubDate || ''
    })).filter(x => x.title);
  } catch (e) {
    console.log(`   ⚠ ${url}  (${e.message})`);
    return null;
  }
}

async function main() {
  console.log('=== Haber Mutfağı çalışıyor ===\n');
  const categories = {};
  let okFeeds = 0, failFeeds = 0, totalItems = 0;

  for (const cat of Object.keys(FEEDS)) {
    console.log(`• ${cat}`);
    let items = [];
    for (const url of FEEDS[cat]) {
      const res = await fetchFeed(url);
      if (res === null) { failFeeds++; continue; }
      okFeeds++;
      items = items.concat(res);
    }
    // Tekrarları ele (başlığa göre)
    const seen = new Set();
    items = items.filter(it => {
      const k = normTitle(it.title);
      if (!k || seen.has(k)) return false;
      seen.add(k); return true;
    });
    // Tarihe göre sırala (yeni önce)
    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    items = items.slice(0, PER_CATEGORY);
    totalItems += items.length;

    // Okunacak kısa metin
    const text = items.length
      ? items.map(it => it.title.replace(/\s*\.\s*$/, '') + '.').join(' ')
      : '';

    categories[cat] = { text, items: items.map(it => ({ title: it.title, summary: it.summary, source: it.link })) };
    console.log(`   → ${items.length} haber`);
  }

  const out = {
    app: 'haber-saati',
    version: 1,
    generatedAt: new Date().toISOString(),
    categories
  };
  const outPath = path.join(__dirname, 'briefing.json');
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

  console.log(`\n=== Bitti ===`);
  console.log(`Çalışan kaynak: ${okFeeds}, başarısız: ${failFeeds}, toplam haber: ${totalItems}`);
  console.log(`Dosya: ${outPath}`);
}

main().catch(e => { console.error('HATA:', e); process.exit(1); });
