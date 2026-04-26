// functions/_middleware.js
//
// Cloudflare Pages middleware that rewrites the served HTML based on the
// requested language so crawlers (Twitter, Facebook, LINE, Slack, Discord,
// ChatGPT, etc.) and modern browsers see the right `<html lang>`,
// `<title>`, OGP meta tags, and description for the visitor's language.
//
// Why: index.html is one static file that switches language client-side
// via JavaScript. Crawlers don't run JS, so they always saw the English
// version, which (a) made every shared link preview look like an English
// page regardless of where the visitor was, and (b) caused Chrome/Edge
// to pop the "translate this page?" bar on Japanese visitors.
//
// Resolution priority for language:
//   1. ?lang=xx in the URL (explicit user choice)
//   2. Accept-Language header (browser preference)
//   3. Default: en
//
// On unsupported / unknown values: fall back to en.

const SUPPORTED = ['ja','en','es','pt','fr','de','it','ko','zh','ar'];
const LOCALE_MAP = {
  ja: 'ja_JP',
  en: 'en_US',
  es: 'es_ES',
  pt: 'pt_BR',
  fr: 'fr_FR',
  de: 'de_DE',
  it: 'it_IT',
  ko: 'ko_KR',
  zh: 'zh_CN',
  ar: 'ar_SA',
};

// Per-language metadata. Translations of the matchup-simulator title and
// the description Yoshiki finalized in Japanese:
//   "W杯出場48ヶ国の優勝確率を10万回試合で予測、または1回ブラケットで観戦。
//    Elo/Opta/FIFAの3つのレーティングを基準に切り替えて概算可能。"
const META = {
  ja: {
    title: 'W杯2026 対戦シミュレーター',
    description: 'W杯出場48ヶ国の優勝確率を10万回試合で予測、または1回ブラケットで観戦。Elo/Opta/FIFAの3つのレーティングを基準に切り替えて概算可能。',
  },
  en: {
    title: 'World Cup 2026 Matchup Simulator',
    description: 'Predict the championship odds of all 48 World Cup nations across 100,000 simulated tournaments, or watch a single bracket play out. Toggle between Elo, Opta, and FIFA ratings to compare estimates.',
  },
  es: {
    title: 'Simulador de Enfrentamientos del Mundial 2026',
    description: 'Predice las probabilidades de campeonato de las 48 selecciones del Mundial con 100.000 torneos simulados, o mira un único cuadro completo. Alterna entre los ratings Elo, Opta y FIFA para comparar estimaciones.',
  },
  pt: {
    title: 'Simulador de Confrontos da Copa do Mundo 2026',
    description: 'Estime as probabilidades de título das 48 seleções da Copa em 100.000 torneios simulados, ou acompanhe um único chaveamento. Alterne entre os ratings Elo, Opta e FIFA para comparar estimativas.',
  },
  fr: {
    title: 'Simulateur de Confrontations Coupe du Monde 2026',
    description: 'Estimez les probabilités de victoire des 48 nations de la Coupe du Monde sur 100 000 tournois simulés, ou suivez un seul tableau. Basculez entre les classements Elo, Opta et FIFA pour comparer les estimations.',
  },
  de: {
    title: 'WM 2026 Begegnungssimulator',
    description: 'Schätze die Titelchancen aller 48 WM-Nationen über 100.000 simulierte Turniere oder verfolge ein einzelnes Tableau. Wechsle zwischen Elo-, Opta- und FIFA-Ratings, um Schätzungen zu vergleichen.',
  },
  it: {
    title: 'Simulatore Sfide Mondiale 2026',
    description: 'Stima le probabilità di vittoria delle 48 nazionali del Mondiale su 100.000 tornei simulati, o segui un singolo tabellone. Alterna tra i rating Elo, Opta e FIFA per confrontare le stime.',
  },
  ko: {
    title: '2026 월드컵 대진 시뮬레이터',
    description: '월드컵 본선 48개국의 우승 확률을 10만 번의 토너먼트 시뮬레이션으로 예측하거나, 한 번의 대진표를 끝까지 관전. Elo/Opta/FIFA 세 가지 레이팅을 전환해 비교 추정 가능.',
  },
  zh: {
    title: '2026世界杯对阵模拟器',
    description: '通过10万次模拟比赛预测世界杯48强的夺冠概率,或观看单次完整对阵。可在Elo、Opta、FIFA三种评分之间切换比较估算。',
  },
  ar: {
    title: 'محاكي مواجهات كأس العالم 2026',
    description: 'توقّع احتمالات بطولة المنتخبات الـ48 المشاركة في كأس العالم عبر 100,000 محاكاة للبطولة، أو تابع مباراة شجرة واحدة بالكامل. بدّل بين تصنيفات Elo و Opta و FIFA لمقارنة التقديرات.',
  },
};

function parseAcceptLanguage(header) {
  if (!header) return null;
  // Header format: "ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7"
  const entries = header.split(',').map(part => {
    const [tag, qStr] = part.trim().split(';');
    const q = qStr && qStr.startsWith('q=') ? parseFloat(qStr.slice(2)) : 1.0;
    return { tag: tag.trim().toLowerCase(), q };
  }).sort((a, b) => b.q - a.q);

  for (const { tag } of entries) {
    const primary = tag.split('-')[0]; // 'ja-jp' -> 'ja'
    if (SUPPORTED.includes(primary)) return primary;
  }
  return null;
}

function resolveLanguage(request, url) {
  const explicit = url.searchParams.get('lang');
  if (explicit && SUPPORTED.includes(explicit)) return explicit;
  const fromHeader = parseAcceptLanguage(request.headers.get('Accept-Language'));
  if (fromHeader) return fromHeader;
  return 'en';
}

function rewriteHtml(html, lang) {
  const meta = META[lang] || META.en;
  const locale = LOCALE_MAP[lang] || 'en_US';
  const enMeta = META.en;
  const enLocale = LOCALE_MAP.en;

  // We use literal-string replaces so a malformed regex never breaks the
  // page. The patterns target the exact strings present in index.html.
  return html
    .replace('<html lang="en">', `<html lang="${lang}">`)
    .replace(`<title>${enMeta.title}</title>`, `<title>${meta.title}</title>`)
    .replace(
      `<meta name="description" content="48 nations, 100,000 Monte Carlo sims, Elo/Opta/FIFA ratings. Build your own World Cup 2026 prediction.">`,
      `<meta name="description" content="${meta.description}">`
    )
    .replace(
      `<meta property="og:title" content="${enMeta.title}">`,
      `<meta property="og:title" content="${meta.title}">`
    )
    .replace(
      `<meta property="og:description" content="48 nations, 100,000 Monte Carlo sims, Elo/Opta/FIFA ratings. Build your own World Cup 2026 prediction.">`,
      `<meta property="og:description" content="${meta.description}">`
    )
    .replace(
      `<meta property="og:locale" content="${enLocale}">`,
      `<meta property="og:locale" content="${locale}">`
    )
    .replace(
      `<meta name="twitter:title" content="${enMeta.title}">`,
      `<meta name="twitter:title" content="${meta.title}">`
    )
    .replace(
      `<meta name="twitter:description" content="48 nations, 100,000 Monte Carlo sims, Elo/Opta/FIFA ratings. Build your own World Cup 2026 prediction.">`,
      `<meta name="twitter:description" content="${meta.description}">`
    );
}

export async function onRequest(context) {
  const url = new URL(context.request.url);

  // Only rewrite the root HTML (and any path that resolves to index.html).
  // Asset requests (images, JSON, etc.) bypass this entirely.
  const path = url.pathname;
  const isHtmlRoute =
    path === '/' || path === '/index.html' || path.endsWith('/');
  if (!isHtmlRoute) {
    return context.next();
  }

  const response = await context.next();
  const contentType = response.headers.get('Content-Type') || '';
  if (!contentType.includes('text/html')) {
    return response;
  }

  const lang = resolveLanguage(context.request, url);
  const html = await response.text();
  const rewritten = rewriteHtml(html, lang);

  // Vary on Accept-Language so the CDN doesn't serve a Japanese visitor's
  // localized HTML to an English visitor (and vice versa).
  const headers = new Headers(response.headers);
  headers.set('Content-Language', lang);
  const existingVary = headers.get('Vary');
  if (existingVary) {
    if (!/accept-language/i.test(existingVary)) {
      headers.set('Vary', existingVary + ', Accept-Language');
    }
  } else {
    headers.set('Vary', 'Accept-Language');
  }
  // Cache at the edge briefly; HTML is small and language can change.
  headers.set('Cache-Control', 'public, max-age=60');

  return new Response(rewritten, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
