// scripts/build_teams.js  (v5 — adds FIFA ranking integration)
//
// Computes stratified atk/def values for all 48 World Cup 2026 teams,
// integrating Elo (eloratings.net), FIFA points (football-ranking.com),
// and Opta values to feed multiple rating modes in the simulator.
//
// === v5 changes vs v4 ===
//   - Reads scripts/fifa_data.json (produced by fetch_fifa_rank.js)
//   - Adds fifaR (rank) and fifaP (points) to each team object
//   - Sanity check: warns if FIFA data is missing for any of the 48 teams
//   - Metadata includes FIFA source info
//   - Does NOT use FIFA values in atk/def or shrinkage computation
//     (atk/def remains driven by eloratings.net match history; FIFA is
//      stored as parallel data for the simulator's rating-mode switch)
//
// === v4 changes vs v3 ===
//   - Time decay: matches weighted by exp decay (half-life 540 days)
//     → recent matches matter more, ancient ones fade smoothly
//   - James-Stein style shrinkage: each of {atkS, atkW, defS, defW} is shrunk
//     toward the corresponding GLOBAL mean, with prior strength K=5
//     → small-sample teams (Jordan def(s)=4.40 with n=2) no longer explode
//   - Two-pass computation: Pass 1 computes raw values for all 48 teams,
//     then GLOBAL means are derived, then Pass 2 applies shrinkage
//   - Sanity checks at end: aborts with non-zero exit if anything looks wrong
//     (team count, elo range, sum-elo drift, atk/def range)
//   - n_eff (effective sample size after time decay) is used everywhere a
//     count was used before (fallback decisions, shrinkage prior weight)
//
// === Methodology (unchanged from v3) ===
//   - Default period: matches from 2022-01-01 onwards
//   - Stratify by opponent's CURRENT Elo: >= 1800 = strong, < 1800 = weak
//     (KNOWN LIMITATION: should ideally use opponent's ELO AT MATCH TIME;
//      eloratings.net match history doesn't expose that, so we use current.
//      Reviewer #2 flagged this; tracked as future work.)
//   - For each stratum, if 2022+ n_eff < MIN_SAMPLES, extend that stratum
//     ONLY back to 2020-01-01
//   - If a stratum still has < FALLBACK_THRESHOLD n_eff, use overall avg
//
// File formats:
//   elo_data.json:   { teams: { "ESP": {name, elo}, ... } }
//   teams.json:      { lastUpdated, teams: [{c, elo, atk, def, g, f, opta}, ...] }
//   match_data.json: { results: { "JPN": { ok, matches: [...] }} }
//
// Usage: node scripts/build_teams.js

const fs = require('fs');
const path = require('path');

// === Configuration ===
const STRONG_THRESHOLD = 1800;
const PRIMARY_PERIOD_START = '2022-01-01';
const FALLBACK_PERIOD_START = '2020-01-01';
const MIN_SAMPLES = 5;          // n_eff threshold for extending to 2020+
const FALLBACK_THRESHOLD = 3;   // n_eff threshold for overall fallback

// v4 additions
const HALF_LIFE_DAYS = 540;     // ~18 months: weight halves every 540 days
const SHRINK_K = 5;             // shrinkage prior strength: at n_eff=K,
                                // raw and GLOBAL contribute equally

// Sanity check thresholds (reviewer's recommendations)
const SANITY = {
  EXPECTED_TEAM_COUNT: 48,
  MIN_TOTAL_MATCHES: 3000,      // total matches across all 48 nations
  ELO_MIN: 1300,
  ELO_MAX: 2300,
  ELO_SUM_MAX_DRIFT: 500,       // total Elo across 48 should not jump by > 500
  ATK_DEF_MAX: 5.0,             // single-stratum atk/def shouldn't exceed this
  ATK_DEF_MIN: 0.0,
};

// TLA -> ISO2 mapping for flag-icons CDN.
const TLA_TO_ISO2 = {
  ESP:'es', FRA:'fr', ENG:'gb-eng', POR:'pt', NED:'nl',
  GER:'de', CRO:'hr', SUI:'ch', BEL:'be', AUT:'at',
  CZE:'cz', NOR:'no', BIH:'ba', SCO:'gb-sct', TUR:'tr', SWE:'se',
  ARG:'ar', BRA:'br', COL:'co', URU:'uy', ECU:'ec', PAR:'py',
  USA:'us', CAN:'ca', MEX:'mx', PAN:'pa', CUW:'cw', HAI:'ht',
  JPN:'jp', KOR:'kr', IRN:'ir', KSA:'sa', AUS:'au',
  UZB:'uz', JOR:'jo', IRQ:'iq', QAT:'qa',
  MAR:'ma', SEN:'sn', TUN:'tn', EGY:'eg', ALG:'dz',
  CIV:'ci', GHA:'gh', CPV:'cv', RSA:'za', COD:'cd',
  NZL:'nz'
};

// === Lookup tables (unchanged) ===
const NAME_TO_CODE = {
  'spain': 'ESP', 'france': 'FRA', 'england': 'ENG', 'portugal': 'POR',
  'netherlands': 'NED', 'germany': 'GER', 'croatia': 'CRO', 'switzerland': 'SUI',
  'belgium': 'BEL', 'austria': 'AUT', 'czechia': 'CZE', 'czech republic': 'CZE',
  'norway': 'NOR', 'bosnia and herzegovina': 'BIH', 'scotland': 'SCO',
  'turkey': 'TUR', 'sweden': 'SWE',
  'argentina': 'ARG', 'brazil': 'BRA', 'colombia': 'COL', 'uruguay': 'URU',
  'ecuador': 'ECU', 'paraguay': 'PAR',
  'united states': 'USA', 'usa': 'USA', 'canada': 'CAN', 'mexico': 'MEX',
  'panama': 'PAN', 'curacao': 'CUW', 'curaçao': 'CUW', 'haiti': 'HAI',
  'japan': 'JPN', 'south korea': 'KOR', 'korea republic': 'KOR',
  'iran': 'IRN', 'saudi arabia': 'KSA', 'australia': 'AUS',
  'uzbekistan': 'UZB', 'jordan': 'JOR', 'iraq': 'IRQ', 'qatar': 'QAT',
  'morocco': 'MAR', 'senegal': 'SEN', 'tunisia': 'TUN', 'egypt': 'EGY',
  'algeria': 'ALG', 'ivory coast': 'CIV', "cote d'ivoire": 'CIV',
  'côte d\'ivoire': 'CIV', 'ghana': 'GHA', 'cape verde': 'CPV',
  'south africa': 'RSA', 'dr congo': 'COD', 'democratic republic of the congo': 'COD',
  'congo dr': 'COD', 'new zealand': 'NZL'
};

// Approximate Elo for non-WC opponents (used for stratification).
const NON_WC_ELO_APPROX = {
  // Just keeping the same values from v3 — copied from the original file
  'italy': 1900, 'denmark': 1830, 'poland': 1700, 'ukraine': 1750,
  'serbia': 1750, 'romania': 1670, 'hungary': 1660, 'finland': 1620,
  'wales': 1670, 'ireland': 1620, 'iceland': 1610, 'slovakia': 1620,
  'slovenia': 1670, 'albania': 1610, 'greece': 1660, 'georgia': 1620,
  'kazakhstan': 1500, 'lithuania': 1450, 'latvia': 1380, 'estonia': 1380,
  'belarus': 1500, 'russia': 1740, 'moldova': 1390, 'kosovo': 1500,
  'north macedonia': 1620, 'montenegro': 1530, 'cyprus': 1410,
  'luxembourg': 1450, 'bulgaria': 1500, 'armenia': 1530, 'azerbaijan': 1430,
  'andorra': 1100, 'malta': 1230, 'liechtenstein': 1080, 'gibraltar': 1100,
  'san marino': 950, 'faroe islands': 1370,
  'chile': 1750, 'peru': 1670, 'venezuela': 1620, 'bolivia': 1530,
  'jamaica': 1500, 'honduras': 1530, 'el salvador': 1430,
  'costa rica': 1620, 'guatemala': 1380, 'trinidad and tobago': 1330,
  'nicaragua': 1280, 'cuba': 1340, 'dominican republic': 1330,
  'guyana': 1300, 'suriname': 1370, 'belize': 1240, 'antigua and barbuda': 1230,
  'st kitts and nevis': 1240, 'st vincent and the grenadines': 1180,
  'puerto rico': 1230, 'bahamas': 1100, 'dominica': 1100, 'st lucia': 1170,
  'china': 1450, 'india': 1320, 'thailand': 1480, 'vietnam': 1490,
  'indonesia': 1430, 'malaysia': 1430, 'philippines': 1370, 'singapore': 1340,
  'myanmar': 1340, 'cambodia': 1180, 'laos': 1170, 'brunei': 1100,
  'kyrgyzstan': 1450, 'tajikistan': 1480, 'turkmenistan': 1370, 'afghanistan': 1340,
  'syria': 1490, 'lebanon': 1430, 'palestine': 1430, 'kuwait': 1450,
  'bahrain': 1500, 'oman': 1530, 'uae': 1530, 'yemen': 1300,
  'hong kong': 1430, 'taiwan': 1340, 'mongolia': 1180, 'nepal': 1290,
  'sri lanka': 1170, 'pakistan': 1130, 'bangladesh': 1180, 'maldives': 1230,
  'bhutan': 1100, 'guam': 1080, 'macau': 1100, 'north korea': 1530,
  'cameroon': 1700, 'nigeria': 1700, 'mali': 1660, 'guinea': 1620,
  'burkina faso': 1620, 'gabon': 1530, 'angola': 1530, 'mozambique': 1430,
  'kenya': 1450, 'uganda': 1500, 'tanzania': 1450, 'zambia': 1500,
  'zimbabwe': 1430, 'libya': 1500, 'sudan': 1450, 'south sudan': 1180,
  'comoros': 1430, 'gambia': 1500, 'sierra leone': 1430, 'liberia': 1370,
  'togo': 1430, 'benin': 1530, 'niger': 1430, 'central african republic': 1370,
  'chad': 1340, 'eritrea': 1240, 'djibouti': 1180, 'mauritania': 1430,
  'rwanda': 1430, 'burundi': 1430, 'malawi': 1430, 'namibia': 1430,
  'botswana': 1450, 'congo': 1500, 'equatorial guinea': 1530,
  'guinea-bissau': 1430, 'sao tome and principe': 1170, 'mauritius': 1290,
  'madagascar': 1430, 'ethiopia': 1380, 'mayotte': 1100, 'south sudan': 1180,
  'lesotho': 1320, 'seychelles': 1180, 'somalia': 1190
};

function normalizeName(name) {
  return String(name).toLowerCase().trim();
}

function getOpponentElo(opponentName, eloByCode) {
  const norm = normalizeName(opponentName);
  const code = NAME_TO_CODE[norm];
  if (code && eloByCode[code] != null) return eloByCode[code];
  if (NON_WC_ELO_APPROX[norm] != null) return NON_WC_ELO_APPROX[norm];
  for (const [key, elo] of Object.entries(NON_WC_ELO_APPROX)) {
    if (norm.includes(key) && key.length > 4) return elo;
  }
  return 1500;
}

// === v4: time-decay weighting ===
function timeWeight(daysAgo) {
  return Math.pow(0.5, Math.max(0, daysAgo) / HALF_LIFE_DAYS);
}

function daysBetween(refDate, matchDateStr) {
  const m = new Date(matchDateStr + 'T00:00:00Z');
  return (refDate - m) / (1000 * 60 * 60 * 24);
}

// Returns { value, nEff } where nEff = sum of weights (effective sample size)
function weightedAvg(matches, key, refDate) {
  if (!matches || matches.length === 0) return { value: null, nEff: 0 };
  let sum = 0, wSum = 0;
  for (const m of matches) {
    const w = timeWeight(daysBetween(refDate, m.date));
    sum += m[key] * w;
    wSum += w;
  }
  return { value: wSum > 0 ? sum / wSum : null, nEff: wSum };
}

// === v4: Pass 1 — compute raw atk/def (with time decay, no shrinkage) ===
function computeRawAtkDef(allMatches, eloByCode, refDate) {
  const enriched = allMatches.map(m => ({
    ...m,
    opponentElo: getOpponentElo(m.opponentName, eloByCode)
  }));
  
  const matches2022 = enriched.filter(m => m.date >= PRIMARY_PERIOD_START);
  const matches2020 = enriched.filter(m => m.date >= FALLBACK_PERIOD_START);
  
  const strong2022 = matches2022.filter(m => m.opponentElo >= STRONG_THRESHOLD);
  const weak2022 = matches2022.filter(m => m.opponentElo < STRONG_THRESHOLD);
  
  // Use n_eff for fallback decisions (not raw count)
  const strong2022nEff = strong2022.reduce((s, m) => s + timeWeight(daysBetween(refDate, m.date)), 0);
  const weak2022nEff = weak2022.reduce((s, m) => s + timeWeight(daysBetween(refDate, m.date)), 0);
  
  let strongUsed, strongPeriod;
  if (strong2022nEff >= MIN_SAMPLES) {
    strongUsed = strong2022;
    strongPeriod = '2022+';
  } else {
    strongUsed = matches2020.filter(m => m.opponentElo >= STRONG_THRESHOLD);
    strongPeriod = '2020+';
  }
  
  let weakUsed, weakPeriod;
  if (weak2022nEff >= MIN_SAMPLES) {
    weakUsed = weak2022;
    weakPeriod = '2022+';
  } else {
    weakUsed = matches2020.filter(m => m.opponentElo < STRONG_THRESHOLD);
    weakPeriod = '2020+';
  }
  
  // Overall fallback (uses widest period: 2020+)
  const overallAtk = weightedAvg(matches2020, 'ourScore', refDate);
  const overallDef = weightedAvg(matches2020, 'oppScore', refDate);
  
  const flags = [];
  
  // Strong stratum
  let atkS, defS, nStrong;
  const strongAtk = weightedAvg(strongUsed, 'ourScore', refDate);
  const strongDef = weightedAvg(strongUsed, 'oppScore', refDate);
  if (strongAtk.nEff >= FALLBACK_THRESHOLD) {
    atkS = strongAtk.value;
    defS = strongDef.value;
    nStrong = strongAtk.nEff;
  } else {
    flags.push(`strong_overall_fallback(n_eff=${strongAtk.nEff.toFixed(1)})`);
    atkS = overallAtk.value;
    defS = overallDef.value;
    // v4.1 fix: keep the TRUE stratum n_eff for shrinkage, not the overall
    // sample size. The fallback value is a biased estimator of the stratum
    // (it is mostly weak-opponent games), so its uncertainty is that of the
    // thin stratum, not of the 80+ overall games. Carrying overall nEff let
    // e.g. Algeria's qualifier blowouts (overall atk ≈ 2.1 vs mostly weak
    // sides) flow into atk.s nearly unshrunk — and rank them #1 the moment
    // ORIGINAL mode let atk/def decide outcomes.
    nStrong = strongAtk.nEff;
  }
  
  // Weak stratum
  let atkW, defW, nWeak;
  const weakAtk = weightedAvg(weakUsed, 'ourScore', refDate);
  const weakDef = weightedAvg(weakUsed, 'oppScore', refDate);
  if (weakAtk.nEff >= FALLBACK_THRESHOLD) {
    atkW = weakAtk.value;
    defW = weakDef.value;
    nWeak = weakAtk.nEff;
  } else {
    flags.push(`weak_overall_fallback(n_eff=${weakAtk.nEff.toFixed(1)})`);
    atkW = overallAtk.value;
    defW = overallDef.value;
    // v4.1 fix: same as the strong stratum — shrink with the TRUE stratum
    // n_eff so a fallback-filled value gets pulled hard toward the global.
    nWeak = weakAtk.nEff;
  }
  
  if (strongPeriod === '2020+') flags.push('strong_extended_to_2020');
  if (weakPeriod === '2020+') flags.push('weak_extended_to_2020');

  // (v4.2's weak-only PPG lived here; superseded in v4.4 by the win-points
  // efficiency inside computeAdjustedIndices — all matches, expected-points
  // ratio — which also credits draws/wins against elite sides.)

  return {
    atk: { s: atkS, w: atkW },
    def: { s: defS, w: defW },
    nEff: { strong: nStrong, weak: nWeak },
    sample: {
      strongPhys: strongUsed.length,
      weakPhys: weakUsed.length,
      strongPeriod,
      weakPeriod,
    },
    flags
  };
}

// === v4: GLOBAL mean computation (per-stratum) ===
function computeGlobalMeans(rawResults) {
  const valid = (xs) => xs.filter(x => x != null && Number.isFinite(x));
  const mean = (xs) => xs.length === 0 ? null : xs.reduce((s, x) => s + x, 0) / xs.length;
  return {
    atkS: mean(valid(rawResults.map(r => r.atk.s))),
    atkW: mean(valid(rawResults.map(r => r.atk.w))),
    defS: mean(valid(rawResults.map(r => r.def.s))),
    defW: mean(valid(rawResults.map(r => r.def.w))),
  };
}

// === v4: James-Stein style shrinkage ===
// observed * n / (n + K) + global * K / (n + K)
function shrunk(observed, n, global, K) {
  if (observed == null || global == null) return observed;
  return (observed * n + global * K) / (n + K);
}

// === v4.3: opponent-adjusted goal indices (continuous Elo adjustment) ===
// Pool ALL 48 finalists' matches (2022+) into opponent-Elo bins and compute
// the pool-average GF/GA per bin ("what an average finalist does against
// that opponent level"). Each team's match GF/GA is then expressed as a
// ratio to its bin expectation; the time-decayed mean of those ratios is
// the team's opponent-adjusted attack/defense index (1.0 = average
// finalist, attack >1 better, defense <1 better).
// Why: the two-layer split is too coarse for the DISPLAY rating. "Weak"
// spans Elo ~1200-1799; African sides' weak pool averages ~1520 vs ~1630
// for European sides, so a flat layer average hands the former a quality
// discount (Algeria: layer-based index looked elite, ratio-based = 1.00 /
// 1.00, a perfectly average finalist). Used by ORIGINAL Power only — the
// simulation λs keep the stratified atk/def.
const ADJ_BIN_EDGES = [1400, 1500, 1600, 1700, 1800, 1900];
function adjBinIdx(elo) {
  let i = 0;
  for (const b of ADJ_BIN_EDGES) if (elo >= b) i++;
  return i; // 0..6
}
function computeAdjustedIndices(matchData, eloByCode, refDate) {
  const matchPts = (m) => m.ourScore > m.oppScore ? 3 : m.ourScore === m.oppScore ? 1 : 0;
  const pool = Array.from({ length: 7 }, () => ({ gf: 0, ga: 0, p: 0, n: 0 }));
  for (const r of Object.values(matchData.results || {})) {
    if (!r || !r.ok || !r.matches) continue;
    for (const m of r.matches) {
      if (m.date < PRIMARY_PERIOD_START) continue;
      const p = pool[adjBinIdx(getOpponentElo(m.opponentName, eloByCode))];
      p.gf += m.ourScore; p.ga += m.oppScore; p.p += matchPts(m); p.n++;
    }
  }
  const exp = pool.map(p => ({
    gf: p.n ? p.gf / p.n : 1.4,
    ga: p.n ? p.ga / p.n : 1.0,
    p: p.n ? p.p / p.n : 1.4
  }));
  const out = {};
  for (const [code, r] of Object.entries(matchData.results || {})) {
    if (!r || !r.ok || !r.matches) continue;
    const ms = r.matches.filter(m => m.date >= PRIMARY_PERIOD_START);
    if (!ms.length) continue;
    let aSum = 0, dSum = 0, pSum = 0, w = 0;
    for (const m of ms) {
      const e = exp[adjBinIdx(getOpponentElo(m.opponentName, eloByCode))];
      const wt = timeWeight(daysBetween(refDate, m.date));
      aSum += wt * (m.ourScore / Math.max(0.3, e.gf));
      dSum += wt * (m.oppScore / Math.max(0.3, e.ga));
      // v4.4: win-points efficiency — actual points vs what an average
      // finalist takes from that opponent level, ALL matches. Supersedes the
      // weak-only PPG: a 0-0 with Portugal or a 3-3 with Argentina is an
      // achievement (expected ~1.1-1.3 pts, earned 1), not a non-event, while
      // a 0-0 with Sudan stays the dropped 2 points it is.
      pSum += wt * (matchPts(m) / Math.max(0.2, e.p));
      w += wt;
    }
    // Shrink toward 1.0 — the pool average by construction.
    const nEff = w;
    out[code] = {
      adjA: +(((aSum / w) * nEff + 1.0 * SHRINK_K) / (nEff + SHRINK_K)).toFixed(2),
      adjD: +(((dSum / w) * nEff + 1.0 * SHRINK_K) / (nEff + SHRINK_K)).toFixed(2),
      wpe: +(((pSum / w) * nEff + 1.0 * SHRINK_K) / (nEff + SHRINK_K)).toFixed(2)
    };
  }
  return out;
}

// === v4: Sanity checks ===
function runSanityChecks(updatedTeams, prevTeams, totalMatches) {
  const errors = [];
  
  // 1. Team count
  if (updatedTeams.length !== SANITY.EXPECTED_TEAM_COUNT) {
    errors.push(`Team count: ${updatedTeams.length} (expected ${SANITY.EXPECTED_TEAM_COUNT})`);
  }
  
  // 2. Total matches
  if (totalMatches < SANITY.MIN_TOTAL_MATCHES) {
    errors.push(`Total matches across all teams: ${totalMatches} (min ${SANITY.MIN_TOTAL_MATCHES})`);
  }
  
  // 3. Elo range per team
  for (const t of updatedTeams) {
    if (typeof t.elo !== 'number' || t.elo < SANITY.ELO_MIN || t.elo > SANITY.ELO_MAX) {
      errors.push(`${t.c}: elo=${t.elo} out of range [${SANITY.ELO_MIN}, ${SANITY.ELO_MAX}]`);
    }
  }
  
  // 4. Elo sum drift vs previous
  if (prevTeams && prevTeams.length === updatedTeams.length) {
    const sumNew = updatedTeams.reduce((s, t) => s + (t.elo || 0), 0);
    const sumPrev = prevTeams.reduce((s, t) => s + (t.elo || 0), 0);
    const drift = Math.abs(sumNew - sumPrev);
    if (drift > SANITY.ELO_SUM_MAX_DRIFT) {
      errors.push(`Elo sum drift: ${drift} (sum=${sumNew}, prev=${sumPrev}, max=${SANITY.ELO_SUM_MAX_DRIFT})`);
    }
  }
  
  // 5. atk/def per-stratum range
  for (const t of updatedTeams) {
    for (const [field, val] of [
      [`atk.s`, t.atk?.s], [`atk.w`, t.atk?.w],
      [`def.s`, t.def?.s], [`def.w`, t.def?.w]
    ]) {
      if (typeof val !== 'number' || val < SANITY.ATK_DEF_MIN || val > SANITY.ATK_DEF_MAX) {
        errors.push(`${t.c}: ${field}=${val} out of range [${SANITY.ATK_DEF_MIN}, ${SANITY.ATK_DEF_MAX}]`);
      }
    }
  }
  
  return errors;
}

// === main ===
function main() {
  const dir = __dirname;
  const eloDataPath = path.join(dir, 'elo_data.json');
  const matchDataPath = path.join(dir, 'match_data.json');
  const fifaDataPath = path.join(dir, 'fifa_data.json');
  const teamsJsonPath = path.join(dir, '..', 'teams.json');
  
  const eloData = JSON.parse(fs.readFileSync(eloDataPath, 'utf-8'));
  const matchData = JSON.parse(fs.readFileSync(matchDataPath, 'utf-8'));
  const teamsRaw = JSON.parse(fs.readFileSync(teamsJsonPath, 'utf-8'));
  
  // FIFA data is optional — if missing we keep going without it
  let fifaData = null;
  let fifaByCode = {};
  if (fs.existsSync(fifaDataPath)) {
    try {
      fifaData = JSON.parse(fs.readFileSync(fifaDataPath, 'utf-8'));
      fifaByCode = fifaData?.teams || {};
      console.log(`Loaded FIFA data for ${Object.keys(fifaByCode).length} teams (source: ${fifaData.source}, lastUpdated: ${fifaData.lastUpdated})`);
    } catch (err) {
      console.warn(`Failed to read fifa_data.json: ${err.message}`);
    }
  } else {
    console.warn(`fifa_data.json not found (FIFA mode will be disabled)`);
  }
  
  const eloByCode = {};
  if (eloData.teams && typeof eloData.teams === 'object') {
    for (const [code, info] of Object.entries(eloData.teams)) {
      if (info && typeof info.elo === 'number') eloByCode[code] = info.elo;
    }
  }
  console.log(`Loaded Elo for ${Object.keys(eloByCode).length} teams`);
  
  if (!teamsRaw.teams || !Array.isArray(teamsRaw.teams)) {
    console.error('teams.json: expected { teams: [...] } structure');
    process.exit(1);
  }
  const teamsList = teamsRaw.teams;
  const prevTeams = JSON.parse(JSON.stringify(teamsList));  // deep copy for sanity check
  
  // Backup
  const backupPath = teamsJsonPath + '.bak';
  fs.copyFileSync(teamsJsonPath, backupPath);
  console.log(`Backed up teams.json -> teams.json.bak`);
  
  console.log(`\nv4: time-decay (half-life ${HALF_LIFE_DAYS}d) + shrinkage (K=${SHRINK_K}) + sanity checks`);
  console.log(`Period: ${PRIMARY_PERIOD_START}+ (fallback ${FALLBACK_PERIOD_START}+)`);
  
  const refDate = new Date();
  
  // === Pass 1: compute raw atk/def for all teams ===
  console.log(`\n=== Pass 1: raw atk/def with time decay ===\n`);
  const rawByCode = {};
  let totalMatches = 0;
  for (const team of teamsList) {
    const code = team.c;
    const matchResult = matchData.results && matchData.results[code];
    if (!matchResult || !matchResult.ok || !matchResult.matches || matchResult.matches.length === 0) {
      continue;
    }
    totalMatches += matchResult.matches.length;
    rawByCode[code] = computeRawAtkDef(matchResult.matches, eloByCode, refDate);
  }
  
  // v4.3: opponent-adjusted indices (for ORIGINAL Power display rating)
  const ADJ = computeAdjustedIndices(matchData, eloByCode, refDate);

  // === Compute GLOBAL means from raw values ===
  const rawArray = Object.values(rawByCode);
  const GLOBAL = computeGlobalMeans(rawArray);
  console.log(
    `GLOBAL means: atkS=${GLOBAL.atkS?.toFixed(2)}, atkW=${GLOBAL.atkW?.toFixed(2)}, ` +
    `defS=${GLOBAL.defS?.toFixed(2)}, defW=${GLOBAL.defW?.toFixed(2)}`
  );
  console.log(`Total matches across ${rawArray.length} teams: ${totalMatches}`);
  
  // === Pass 2: apply shrinkage and produce final teams ===
  console.log(`\n=== Pass 2: apply shrinkage ===\n`);
  const updatedTeams = [];
  const issues = [];
  let extendedCount = 0;
  let fallbackCount = 0;
  
  for (const team of teamsList) {
    const code = team.c;
    const raw = rawByCode[code];
    
    if (!raw) {
      console.warn(`  ${code}: no match data, keeping existing`);
      issues.push(code);
      const fifaInfo = fifaByCode[code];
      updatedTeams.push({
        ...team,
        f: TLA_TO_ISO2[code] || team.f || '',
        ...(fifaInfo ? { fifaR: fifaInfo.rank, fifaP: fifaInfo.points } : {})
      });
      continue;
    }
    
    // v4.4: drop the superseded weak-only PPG field if inherited from an
    // older teams.json (clients prefer wpe and only fall back to ppgW).
    delete team.ppgW;
    // Shrink each of 4 values toward its corresponding GLOBAL mean
    const atkS = shrunk(raw.atk.s, raw.nEff.strong, GLOBAL.atkS, SHRINK_K);
    const atkW = shrunk(raw.atk.w, raw.nEff.weak, GLOBAL.atkW, SHRINK_K);
    const defS = shrunk(raw.def.s, raw.nEff.strong, GLOBAL.defS, SHRINK_K);
    const defW = shrunk(raw.def.w, raw.nEff.weak, GLOBAL.defW, SHRINK_K);
    
    const newElo = eloByCode[code] != null ? eloByCode[code] : team.elo;
    const fifaInfo = fifaByCode[code];
    
    const updated = {
      ...team,
      elo: newElo,
      f: TLA_TO_ISO2[code] || team.f || '',
      atk: { s: +atkS.toFixed(2), w: +atkW.toFixed(2) },
      def: { s: +defS.toFixed(2), w: +defW.toFixed(2) },
      ...(ADJ[code] ? { adjA: ADJ[code].adjA, adjD: ADJ[code].adjD, wpe: ADJ[code].wpe } : {}), // v4.3/v4.4: opponent-adjusted goal + win-points indices
      ...(fifaInfo ? { fifaR: fifaInfo.rank, fifaP: fifaInfo.points } : {})
    };
    updatedTeams.push(updated);
    
    if (raw.flags.some(f => f.includes('extended_to_2020'))) extendedCount++;
    if (raw.flags.some(f => f.includes('overall_fallback'))) fallbackCount++;
    
    const flagStr = raw.flags.length > 0 ? ` [${raw.flags.join(', ')}]` : '';
    console.log(
      `  ${code}: elo=${newElo} ` +
      `atk=(s:${raw.atk.s.toFixed(2)}→${atkS.toFixed(2)},w:${raw.atk.w.toFixed(2)}→${atkW.toFixed(2)}) ` +
      `def=(s:${raw.def.s.toFixed(2)}→${defS.toFixed(2)},w:${raw.def.w.toFixed(2)}→${defW.toFixed(2)}) ` +
      `n_eff=(s:${raw.nEff.strong.toFixed(1)},w:${raw.nEff.weak.toFixed(1)})` +
      flagStr
    );
  }
  
  // === Sanity checks BEFORE writing ===
  console.log(`\n=== Sanity checks ===`);
  const sanityErrors = runSanityChecks(updatedTeams, prevTeams, totalMatches);
  
  // FIFA sanity: warn (not error) if FIFA data incomplete
  const fifaCount = updatedTeams.filter(t => typeof t.fifaR === 'number' && typeof t.fifaP === 'number').length;
  console.log(`FIFA data: ${fifaCount}/${updatedTeams.length} teams have FIFA rank+points`);
  if (fifaData && fifaCount < updatedTeams.length) {
    console.warn(`  WARNING: ${updatedTeams.length - fifaCount} teams missing FIFA data (FIFA mode may be incomplete)`);
  }
  
  if (sanityErrors.length > 0) {
    console.error(`\n!!! SANITY CHECK FAILED — aborting before write !!!`);
    sanityErrors.forEach(e => console.error(`  - ${e}`));
    console.error(`\nteams.json was NOT modified. Backup remains at teams.json.bak.`);
    // Restore from backup just to be safe
    fs.copyFileSync(backupPath, teamsJsonPath);
    process.exit(1);
  }
  console.log(`✓ All sanity checks passed (${sanityErrors.length} errors)`);
  
  // === Write ===
  const today = new Date().toISOString().slice(0, 10);
  const output = {
    ...teamsRaw,
    lastUpdated: today,
    source: 'Auto-generated from eloratings.net',
    teams: updatedTeams,
    metadata: {
      generatedAt: new Date().toISOString(),
      eloSource: 'eloratings.net',
      matchSource: 'eloratings.net',
      fifaSource: fifaData ? fifaData.source : null,
      fifaLastUpdated: fifaData ? fifaData.lastUpdated : null,
      fifaTeamCount: fifaCount,
      methodology: {
        primaryPeriodStart: PRIMARY_PERIOD_START,
        fallbackPeriodStart: FALLBACK_PERIOD_START,
        strongThreshold: STRONG_THRESHOLD,
        minSamples: MIN_SAMPLES,
        fallbackThreshold: FALLBACK_THRESHOLD,
        halfLifeDays: HALF_LIFE_DAYS,
        shrinkK: SHRINK_K,
        globalMeans: {
          atkS: GLOBAL.atkS != null ? +GLOBAL.atkS.toFixed(3) : null,
          atkW: GLOBAL.atkW != null ? +GLOBAL.atkW.toFixed(3) : null,
          defS: GLOBAL.defS != null ? +GLOBAL.defS.toFixed(3) : null,
          defW: GLOBAL.defW != null ? +GLOBAL.defW.toFixed(3) : null,
        }
      }
    }
  };
  fs.writeFileSync(teamsJsonPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${teamsJsonPath}`);
  
  console.log(`\n========== SUMMARY ==========`);
  console.log(`Teams updated: ${updatedTeams.length}/${teamsList.length}`);
  console.log(`Teams that needed 2020+ extension: ${extendedCount}`);
  console.log(`Teams that fell back to overall avg: ${fallbackCount}`);
  if (issues.length > 0) {
    console.warn(`Teams with no match data (kept existing): ${issues.join(', ')}`);
  }
  
  // OLD vs NEW comparison for select teams
  const compareTeams = ['JPN', 'ARG', 'NZL', 'NOR', 'BRA', 'ESP', 'FRA', 'JOR', 'HAI', 'CUW', 'CPV', 'PAN'];
  console.log(`\n========== OLD vs NEW COMPARISON ==========`);
  const newByCode = {};
  for (const t of updatedTeams) newByCode[t.c] = t;
  const prevByCode = {};
  for (const t of prevTeams) prevByCode[t.c] = t;
  for (const code of compareTeams) {
    const o = prevByCode[code];
    const n = newByCode[code];
    if (!o || !n) continue;
    console.log(`  ${code}:`);
    console.log(`    OLD elo=${o.elo} atk=(s:${o.atk?.s},w:${o.atk?.w}) def=(s:${o.def?.s},w:${o.def?.w})`);
    console.log(`    NEW elo=${n.elo} atk=(s:${n.atk.s},w:${n.atk.w}) def=(s:${n.def.s},w:${n.def.w})`);
  }
}

main();
