// scripts/build_teams.js
//
// Computes stratified atk/def values for all 48 World Cup 2026 teams.
//
// Methodology (matches past Research):
//   - Default: use ALL matches from 2022-01-01 onwards
//   - Stratify by opponent's CURRENT Elo: >= 1800 = strong, < 1800 = weak
//   - For each stratum, if 2022+ samples < MIN_SAMPLES, extend that stratum
//     ONLY back to 2020-01-01 to gather more data
//   - If a stratum still has < FALLBACK_THRESHOLD samples, use the overall
//     average (across all matches in that period) as fallback
//   - NO cap on samples — use all matches that fall in the period
//
// File formats (verified):
//   elo_data.json:   { teams: { "ESP": {name, elo}, ... } }
//   teams.json:      { lastUpdated, teams: [{c, elo, atk:{s,w}, def:{s,w}, g, f, opta}, ...] }
//   match_data.json: { results: { "JPN": { ok, matches: [...] }} }
//
// Usage: node scripts/build_teams.js

const fs = require('fs');
const path = require('path');

const STRONG_THRESHOLD = 1800;
const PRIMARY_PERIOD_START = '2022-01-01';
const FALLBACK_PERIOD_START = '2020-01-01';
const MIN_SAMPLES = 5;          // If stratum < this in 2022+, extend to 2020+
const FALLBACK_THRESHOLD = 3;   // If stratum < this even with 2020+, use overall avg

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
  'iran': 'IRN', 'saudi arabia': 'KSA', 'australia': 'AUS', 'uzbekistan': 'UZB',
  'jordan': 'JOR', 'iraq': 'IRQ', 'qatar': 'QAT',
  'morocco': 'MAR', 'senegal': 'SEN', 'tunisia': 'TUN', 'egypt': 'EGY',
  'algeria': 'ALG', "cote d'ivoire": 'CIV', 'ivory coast': 'CIV',
  'ghana': 'GHA', 'cape verde': 'CPV', 'south africa': 'RSA',
  'dr congo': 'COD', 'congo dr': 'COD', 'new zealand': 'NZL'
};

const NON_WC_ELO_APPROX = {
  'italy': 1860, 'denmark': 1870, 'poland': 1729, 'serbia': 1750,
  'hungary': 1690, 'ukraine': 1700, 'greece': 1559, 'wales': 1740,
  'ireland': 1620, 'romania': 1700, 'finland': 1530, 'iceland': 1620,
  'slovakia': 1670, 'slovenia': 1700, 'kosovo': 1530, 'belarus': 1420,
  'azerbaijan': 1430,
  'venezuela': 1727, 'chile': 1680, 'peru': 1620, 'bolivia': 1530,
  'costa rica': 1610, 'jamaica': 1535, 'el salvador': 1480,
  'china': 1520, 'china pr': 1520, 'india': 1300, 'thailand': 1480,
  'vietnam': 1500, 'oman': 1610, 'syria': 1580, 'kuwait': 1450,
  'lebanon': 1430, 'palestine': 1400, 'uae': 1530,
  'nigeria': 1668, 'cameroon': 1680, 'mali': 1620, 'guinea': 1570,
  'burkina faso': 1580, 'zambia': 1520, 'gambia': 1450, 'benin': 1430,
  'kenya': 1380, 'libya': 1390, 'gabon': 1490, 'sudan': 1370,
  'mozambique': 1380, 'angola': 1480, 'madagascar': 1450,
  'guinea bissau': 1410, 'sierra leone': 1380, 'togo': 1380,
  'comoros': 1430, 'equatorial guinea': 1500, 'congo': 1480,
  'rwanda': 1390, 'zimbabwe': 1400, 'tanzania': 1380, 'eswatini': 1330,
  'central african republic': 1370, 'ethiopia': 1370, 'liberia': 1370,
  'uganda': 1430, 'malawi': 1400, 'mauritania': 1480, 'niger': 1380,
  'namibia': 1430, 'south sudan': 1330, 'eritrea': 1310, 'botswana': 1340,
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

function avg(matches, key) {
  if (matches.length === 0) return null;
  return matches.reduce((s, m) => s + m[key], 0) / matches.length;
}

function computeAtkDef(allMatches, eloByCode) {
  // Annotate matches with opponent Elo
  const enriched = allMatches.map(m => ({
    ...m,
    opponentElo: getOpponentElo(m.opponentName, eloByCode)
  }));
  
  // Period-filtered subsets
  const matches2022 = enriched.filter(m => m.date >= PRIMARY_PERIOD_START);
  const matches2020 = enriched.filter(m => m.date >= FALLBACK_PERIOD_START);
  
  // 2022+ stratification
  const strong2022 = matches2022.filter(m => m.opponentElo >= STRONG_THRESHOLD);
  const weak2022 = matches2022.filter(m => m.opponentElo < STRONG_THRESHOLD);
  
  // Choose strong stratum: prefer 2022+, fall back to 2020+ if too few
  let strongUsed, strongPeriod;
  if (strong2022.length >= MIN_SAMPLES) {
    strongUsed = strong2022;
    strongPeriod = '2022+';
  } else {
    strongUsed = matches2020.filter(m => m.opponentElo >= STRONG_THRESHOLD);
    strongPeriod = '2020+';
  }
  
  // Choose weak stratum: same logic
  let weakUsed, weakPeriod;
  if (weak2022.length >= MIN_SAMPLES) {
    weakUsed = weak2022;
    weakPeriod = '2022+';
  } else {
    weakUsed = matches2020.filter(m => m.opponentElo < STRONG_THRESHOLD);
    weakPeriod = '2020+';
  }
  
  // Overall fallback (uses widest period: 2020+)
  const overallAtk = avg(matches2020, 'ourScore');
  const overallDef = avg(matches2020, 'oppScore');
  
  const flags = [];
  
  // Compute strong-stratum atk/def
  let atkS, defS;
  if (strongUsed.length >= FALLBACK_THRESHOLD) {
    atkS = avg(strongUsed, 'ourScore');
    defS = avg(strongUsed, 'oppScore');
  } else {
    flags.push(`strong_overall_fallback(n=${strongUsed.length})`);
    atkS = overallAtk;
    defS = overallDef;
  }
  
  // Compute weak-stratum atk/def
  let atkW, defW;
  if (weakUsed.length >= FALLBACK_THRESHOLD) {
    atkW = avg(weakUsed, 'ourScore');
    defW = avg(weakUsed, 'oppScore');
  } else {
    flags.push(`weak_overall_fallback(n=${weakUsed.length})`);
    atkW = overallAtk;
    defW = overallDef;
  }
  
  // Note period extension if it happened
  if (strongPeriod === '2020+') flags.push('strong_extended_to_2020');
  if (weakPeriod === '2020+') flags.push('weak_extended_to_2020');
  
  return {
    atk: { s: +atkS.toFixed(2), w: +atkW.toFixed(2) },
    def: { s: +defS.toFixed(2), w: +defW.toFixed(2) },
    sample: {
      strong: strongUsed.length,
      weak: weakUsed.length,
      strongPeriod,
      weakPeriod,
      overall2022: matches2022.length,
      overall2020: matches2020.length
    },
    flags
  };
}

function main() {
  const dir = __dirname;
  const eloDataPath = path.join(dir, 'elo_data.json');
  const matchDataPath = path.join(dir, 'match_data.json');
  const teamsJsonPath = path.join(dir, '..', 'teams.json');
  
  const eloData = JSON.parse(fs.readFileSync(eloDataPath, 'utf-8'));
  const matchData = JSON.parse(fs.readFileSync(matchDataPath, 'utf-8'));
  const teamsRaw = JSON.parse(fs.readFileSync(teamsJsonPath, 'utf-8'));
  
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
  
  // Backup
  const backupPath = teamsJsonPath + '.bak';
  fs.copyFileSync(teamsJsonPath, backupPath);
  console.log(`Backed up teams.json -> teams.json.bak`);
  
  console.log(`\nComputing atk/def for ${teamsList.length} teams (period: ${PRIMARY_PERIOD_START}+, fallback: ${FALLBACK_PERIOD_START}+)...\n`);
  
  const updatedTeams = [];
  const issues = [];
  const oldByCode = {};
  for (const t of teamsList) oldByCode[t.c] = t;
  
  let extendedCount = 0;
  let fallbackCount = 0;
  
  for (const team of teamsList) {
    const code = team.c;
    const matchResult = matchData.results && matchData.results[code];
    
    if (!matchResult || !matchResult.ok || !matchResult.matches || matchResult.matches.length === 0) {
      console.warn(`  ${code}: no match data, keeping existing`);
      issues.push(code);
      updatedTeams.push(team);
      continue;
    }
    
    const result = computeAtkDef(matchResult.matches, eloByCode);
    const newElo = eloByCode[code] != null ? eloByCode[code] : team.elo;
    
    const updated = {
      ...team,
      elo: newElo,
      atk: result.atk,
      def: result.def
    };
    updatedTeams.push(updated);
    
    if (result.flags.some(f => f.includes('extended_to_2020'))) extendedCount++;
    if (result.flags.some(f => f.includes('overall_fallback'))) fallbackCount++;
    
    const flagStr = result.flags.length > 0 ? ` [${result.flags.join(', ')}]` : '';
    console.log(`  ${code}: elo=${newElo} atk=(s:${result.atk.s},w:${result.atk.w}) def=(s:${result.def.s},w:${result.def.w}) n=(s:${result.sample.strong}/${result.sample.strongPeriod}, w:${result.sample.weak}/${result.sample.weakPeriod})${flagStr}`);
  }
  
  // Write
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
      methodology: {
        primaryPeriodStart: PRIMARY_PERIOD_START,
        fallbackPeriodStart: FALLBACK_PERIOD_START,
        strongThreshold: STRONG_THRESHOLD,
        minSamples: MIN_SAMPLES,
        fallbackThreshold: FALLBACK_THRESHOLD
      }
    }
  };
  fs.writeFileSync(teamsJsonPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${teamsJsonPath}`);
  
  console.log(`\n========== SUMMARY ==========`);
  console.log(`Teams updated: ${updatedTeams.length - issues.length}/${updatedTeams.length}`);
  console.log(`Teams that needed 2020+ extension for some stratum: ${extendedCount}`);
  console.log(`Teams that fell back to overall avg for some stratum: ${fallbackCount}`);
  if (issues.length > 0) {
    console.log(`Teams with no match data (kept existing): ${issues.join(', ')}`);
  }
  
  // Old vs new comparison
  console.log(`\n========== OLD vs NEW COMPARISON ==========`);
  const checkCodes = ['JPN', 'ARG', 'NZL', 'NOR', 'BRA', 'ESP', 'FRA'];
  for (const code of checkCodes) {
    const oldT = oldByCode[code];
    const newT = updatedTeams.find(x => x.c === code);
    if (oldT && newT) {
      const oldAtk = oldT.atk ? `s:${oldT.atk.s},w:${oldT.atk.w}` : 'n/a';
      const newAtk = `s:${newT.atk.s},w:${newT.atk.w}`;
      const oldDef = oldT.def ? `s:${oldT.def.s},w:${oldT.def.w}` : 'n/a';
      const newDef = `s:${newT.def.s},w:${newT.def.w}`;
      console.log(`  ${code}:`);
      console.log(`    OLD elo=${oldT.elo} atk=(${oldAtk}) def=(${oldDef})`);
      console.log(`    NEW elo=${newT.elo} atk=(${newAtk}) def=(${newDef})`);
    }
  }
}

main();
