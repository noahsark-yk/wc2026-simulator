// AUTO-GENERATED from index.html by build_journey_engine.js — DO NOT EDIT.
// 29 Math.random() -> rng() (deterministic core, phase 0).
// Host (journey.html) calls JE.config({teams, realResults, ratingMode, homeAdvOn, fifaThirdLookup}) before sims.
'use strict';
(function (global) {
  // --- deterministic PRNG (mulberry32) ---
  function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; var t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  let rng = mulberry32(1);
  function setSeed(s){ rng = mulberry32(s >>> 0); }

  // --- runtime config (host overrides) ---
  let RATING_MODE = 'elo';
  let HOME_ADVANTAGE_ON = true;
  let GROUPS = 'ABCDEFGHIJKL'.split('');
  let FOCUS = 'JPN';
  let TEAMS = [];
  let FIFA_THIRD_LOOKUP = {
  "ABCDEFGH":"CFHEBAGD", "ABCDEFGI":"DFCIBAGE", "ABCDEFGJ":"DFCJBAGE", "ABCDEFGK":"DFCKBAGE",
  "ABCDEFGL":"DFCEBAGL", "ABCDEFHI":"CFHIBAED", "ABCDEFHJ":"CFHEBAJD", "ABCDEFHK":"CFHKBAED",
  "ABCDEFHL":"CDHEBAFL", "ABCDEFIJ":"DFCIBAJE", "ABCDEFIK":"DFCKBAEI", "ABCDEFIL":"DFCIBAEL",
  "ABCDEFJK":"DFCKBAJE", "ABCDEFJL":"DFCEBAJL", "ABCDEFKL":"DFCKBAEL", "ABCDEGHI":"CDHIBAGE",
  "ABCDEGHJ":"CDHJBAGE", "ABCDEGHK":"CDHKBAGE", "ABCDEGHL":"CDHEBAGL", "ABCDEGIJ":"CDEJBAGI",
  "ABCDEGIK":"CDEKBAGI", "ABCDEGIL":"CDEIBAGL", "ABCDEGJK":"CDEKBAGJ", "ABCDEGJL":"CDEJBAGL",
  "ABCDEGKL":"CDEKBAGL", "ABCDEHIJ":"CDHIBAJE", "ABCDEHIK":"CDHKBAEI", "ABCDEHIL":"CDHIBAEL",
  "ABCDEHJK":"CDHKBAJE", "ABCDEHJL":"CDHEBAJL", "ABCDEHKL":"CDHKBAEL", "ABCDEIJK":"CDEKBAJI",
  "ABCDEIJL":"CDEIBAJL", "ABCDEIKL":"CDEKBAIL", "ABCDEJKL":"CDEKBAJL", "ABCDFGHI":"CFHIBAGD",
  "ABCDFGHJ":"CFHJBAGD", "ABCDFGHK":"CFHKBAGD", "ABCDFGHL":"DFCHBAGL", "ABCDFGIJ":"DFCJBAGI",
  "ABCDFGIK":"DFCKBAGI", "ABCDFGIL":"DFCIBAGL", "ABCDFGJK":"DFCKBAGJ", "ABCDFGJL":"DFCJBAGL",
  "ABCDFGKL":"DFCKBAGL", "ABCDFHIJ":"CFHIBAJD", "ABCDFHIK":"CDHKBAFI", "ABCDFHIL":"CDHIBAFL",
  "ABCDFHJK":"CFHKBAJD", "ABCDFHJL":"DFCHBAJL", "ABCDFHKL":"CDHKBAFL", "ABCDFIJK":"DFCKBAJI",
  "ABCDFIJL":"DFCIBAJL", "ABCDFIKL":"DFCKBAIL", "ABCDFJKL":"DFCKBAJL", "ABCDGHIJ":"CDHJBAGI",
  "ABCDGHIK":"CDHKBAGI", "ABCDGHIL":"CDHIBAGL", "ABCDGHJK":"CDHKBAGJ", "ABCDGHJL":"CDHJBAGL",
  "ABCDGHKL":"CDHKBAGL", "ABCDGIJK":"DGCKBAJI", "ABCDGIJL":"DGCIBAJL", "ABCDGIKL":"CDIKBAGL",
  "ABCDGJKL":"DGCKBAJL", "ABCDHIJK":"CDHKBAJI", "ABCDHIJL":"CDHIBAJL", "ABCDHIKL":"CDHKBAIL",
  "ABCDHJKL":"CDHKBAJL", "ABCDIJKL":"CDIKBAJL", "ABCEFGHI":"CFHIBAGE", "ABCEFGHJ":"CFHJBAGE",
  "ABCEFGHK":"CFHKBAGE", "ABCEFGHL":"CFHEBAGL", "ABCEFGIJ":"CFEJBAGI", "ABCEFGIK":"CFEKBAGI",
  "ABCEFGIL":"CFEIBAGL", "ABCEFGJK":"CFEKBAGJ", "ABCEFGJL":"CFEJBAGL", "ABCEFGKL":"CFEKBAGL",
  "ABCEFHIJ":"CFHIBAJE", "ABCEFHIK":"CFHKBAEI", "ABCEFHIL":"CFHIBAEL", "ABCEFHJK":"CFHKBAJE",
  "ABCEFHJL":"CFHEBAJL", "ABCEFHKL":"CFHKBAEL", "ABCEFIJK":"CFEKBAJI", "ABCEFIJL":"CFEIBAJL",
  "ABCEFIKL":"CFEKBAIL", "ABCEFJKL":"CFEKBAJL", "ABCEGHIJ":"CGHIBAJE", "ABCEGHIK":"CHEKBAGI",
  "ABCEGHIL":"CHEIBAGL", "ABCEGHJK":"CGHKBAJE", "ABCEGHJL":"CGHEBAJL", "ABCEGHKL":"CHEKBAGL",
  "ABCEGIJK":"CGEKBAJI", "ABCEGIJL":"CGEIBAJL", "ABCEGIKL":"ACEKBIGL", "ABCEGJKL":"CGEKBAJL",
  "ABCEHIJK":"CHEKBAJI", "ABCEHIJL":"CHEIBAJL", "ABCEHIKL":"CHEKBAIL", "ABCEHJKL":"CHEKBAJL",
  "ABCEIJKL":"ACEKBIJL", "ABCFGHIJ":"CFHJBAGI", "ABCFGHIK":"CFHKBAGI", "ABCFGHIL":"CFHIBAGL",
  "ABCFGHJK":"CFHKBAGJ", "ABCFGHJL":"CFHJBAGL", "ABCFGHKL":"CFHKBAGL", "ABCFGIJK":"FGCKBAJI",
  "ABCFGIJL":"FGCIBAJL", "ABCFGIKL":"CFIKBAGL", "ABCFGJKL":"FGCKBAJL", "ABCFHIJK":"CFHKBAJI",
  "ABCFHIJL":"CFHIBAJL", "ABCFHIKL":"CFHKBAIL", "ABCFHJKL":"CFHKBAJL", "ABCFIJKL":"CFIKBAJL",
  "ABCGHIJK":"CGHKBAJI", "ABCGHIJL":"CGHIBAJL", "ABCGHIKL":"CHIKBAGL", "ABCGHJKL":"CGHKBAJL",
  "ABCGIJKL":"CGIKBAJL", "ABCHIJKL":"CHIKBAJL", "ABDEFGHI":"DFHIBAGE", "ABDEFGHJ":"DFHJBAGE",
  "ABDEFGHK":"DFHKBAGE", "ABDEFGHL":"DFHEBAGL", "ABDEFGIJ":"DFEJBAGI", "ABDEFGIK":"DFEKBAGI",
  "ABDEFGIL":"DFEIBAGL", "ABDEFGJK":"DFEKBAGJ", "ABDEFGJL":"DFEJBAGL", "ABDEFGKL":"DFEKBAGL",
  "ABDEFHIJ":"DFHIBAJE", "ABDEFHIK":"DFHKBAEI", "ABDEFHIL":"DFHIBAEL", "ABDEFHJK":"DFHKBAJE",
  "ABDEFHJL":"DFHEBAJL", "ABDEFHKL":"DFHKBAEL", "ABDEFIJK":"DFEKBAJI", "ABDEFIJL":"DFEIBAJL",
  "ABDEFIKL":"DFEKBAIL", "ABDEFJKL":"DFEKBAJL", "ABDEGHIJ":"DGHIBAJE", "ABDEGHIK":"DHEKBAGI",
  "ABDEGHIL":"DHEIBAGL", "ABDEGHJK":"DGHKBAJE", "ABDEGHJL":"DGHEBAJL", "ABDEGHKL":"DHEKBAGL",
  "ABDEGIJK":"DGEKBAJI", "ABDEGIJL":"DGEIBAJL", "ABDEGIKL":"ADEKBIGL", "ABDEGJKL":"DGEKBAJL",
  "ABDEHIJK":"DHEKBAJI", "ABDEHIJL":"DHEIBAJL", "ABDEHIKL":"DHEKBAIL", "ABDEHJKL":"DHEKBAJL",
  "ABDEIJKL":"ADEKBIJL", "ABDFGHIJ":"DFHJBAGI", "ABDFGHIK":"DFHKBAGI", "ABDFGHIL":"DFHIBAGL",
  "ABDFGHJK":"DFHKBAGJ", "ABDFGHJL":"DFHJBAGL", "ABDFGHKL":"DFHKBAGL", "ABDFGIJK":"DGFKBAJI",
  "ABDFGIJL":"DGFIBAJL", "ABDFGIKL":"DFIKBAGL", "ABDFGJKL":"DGFKBAJL", "ABDFHIJK":"DFHKBAJI",
  "ABDFHIJL":"DFHIBAJL", "ABDFHIKL":"DFHKBAIL", "ABDFHJKL":"DFHKBAJL", "ABDFIJKL":"DFIKBAJL",
  "ABDGHIJK":"DGHKBAJI", "ABDGHIJL":"DGHIBAJL", "ABDGHIKL":"DHIKBAGL", "ABDGHJKL":"DGHKBAJL",
  "ABDGIJKL":"DGIKBAJL", "ABDHIJKL":"DHIKBAJL", "ABEFGHIJ":"FGHIBAJE", "ABEFGHIK":"FHEKBAGI",
  "ABEFGHIL":"FHEIBAGL", "ABEFGHJK":"FGHKBAJE", "ABEFGHJL":"FGHEBAJL", "ABEFGHKL":"FHEKBAGL",
  "ABEFGIJK":"FGEKBAJI", "ABEFGIJL":"FGEIBAJL", "ABEFGIKL":"AFEKBIGL", "ABEFGJKL":"FGEKBAJL",
  "ABEFHIJK":"FHEKBAJI", "ABEFHIJL":"FHEIBAJL", "ABEFHIKL":"FHEKBAIL", "ABEFHJKL":"FHEKBAJL",
  "ABEFIJKL":"AFEKBIJL", "ABEGHIJK":"AGEKBHJI", "ABEGHIJL":"AGEIBHJL", "ABEGHIKL":"AHEKBIGL",
  "ABEGHJKL":"AGEKBHJL", "ABEGIJKL":"AGEKBIJL", "ABEHIJKL":"AHEKBIJL", "ABFGHIJK":"FGHKBAJI",
  "ABFGHIJL":"FGHIBAJL", "ABFGHIKL":"AFHKBIGL", "ABFGHJKL":"FGHKBAJL", "ABFGIJKL":"FGIKBAJL",
  "ABFHIJKL":"AFHKBIJL", "ABGHIJKL":"AGHKBIJL", "ACDEFGHI":"CFHIEAGD", "ACDEFGHJ":"CFHEJAGD",
  "ACDEFGHK":"CFHKEAGD", "ACDEFGHL":"CDHEFAGL", "ACDEFGIJ":"DFCIJAGE", "ACDEFGIK":"DFCKEAGI",
  "ACDEFGIL":"DFCIEAGL", "ACDEFGJK":"DFCKJAGE", "ACDEFGJL":"DFCEJAGL", "ACDEFGKL":"DFCKEAGL",
  "ACDEFHIJ":"CFHIEAJD", "ACDEFHIK":"CDHKFAEI", "ACDEFHIL":"CDHIFAEL", "ACDEFHJK":"CFHKEAJD",
  "ACDEFHJL":"CDHEFAJL", "ACDEFHKL":"CDHKFAEL", "ACDEFIJK":"DFCKEAJI", "ACDEFIJL":"DFCIEAJL",
  "ACDEFIKL":"DFCKIAEL", "ACDEFJKL":"DFCKEAJL", "ACDEGHIJ":"CDHIJAGE", "ACDEGHIK":"CDHKEAGI",
  "ACDEGHIL":"CDHIEAGL", "ACDEGHJK":"CDHKJAGE", "ACDEGHJL":"CDHEJAGL", "ACDEGHKL":"CDHKEAGL",
  "ACDEGIJK":"CDEKJAGI", "ACDEGIJL":"CDEIJAGL", "ACDEGIKL":"CDEKIAGL", "ACDEGJKL":"CDEKJAGL",
  "ACDEHIJK":"CDHKEAJI", "ACDEHIJL":"CDHIEAJL", "ACDEHIKL":"CDHKIAEL", "ACDEHJKL":"CDHKEAJL",
  "ACDEIJKL":"CDEKIAJL", "ACDFGHIJ":"CFHIJAGD", "ACDFGHIK":"CDHKFAGI", "ACDFGHIL":"CDHIFAGL",
  "ACDFGHJK":"CFHKJAGD", "ACDFGHJL":"DFCHJAGL", "ACDFGHKL":"CDHKFAGL", "ACDFGIJK":"DFCKJAGI",
  "ACDFGIJL":"DFCIJAGL", "ACDFGIKL":"DFCKIAGL", "ACDFGJKL":"DFCKJAGL", "ACDFHIJK":"CDHKFAJI",
  "ACDFHIJL":"CDHIFAJL", "ACDFHIKL":"CDHKIAFL", "ACDFHJKL":"CDHKFAJL", "ACDFIJKL":"DFCKIAJL",
  "ACDGHIJK":"CDHKJAGI", "ACDGHIJL":"CDHIJAGL", "ACDGHIKL":"CDHKIAGL", "ACDGHJKL":"CDHKJAGL",
  "ACDGIJKL":"CDIKJAGL", "ACDHIJKL":"CDHKIAJL", "ACEFGHIJ":"CFHIJAGE", "ACEFGHIK":"CFHKEAGI",
  "ACEFGHIL":"CFHIEAGL", "ACEFGHJK":"CFHKJAGE", "ACEFGHJL":"CFHEJAGL", "ACEFGHKL":"CFHKEAGL",
  "ACEFGIJK":"CFEKJAGI", "ACEFGIJL":"CFEIJAGL", "ACEFGIKL":"CFEKIAGL", "ACEFGJKL":"CFEKJAGL",
  "ACEFHIJK":"CFHKEAJI", "ACEFHIJL":"CFHIEAJL", "ACEFHIKL":"CFHKIAEL", "ACEFHJKL":"CFHKEAJL",
  "ACEFIJKL":"CFEKIAJL", "ACEGHIJK":"CHEKJAGI", "ACEGHIJL":"CHEIJAGL", "ACEGHIKL":"CHEKIAGL",
  "ACEGHJKL":"CHEKJAGL", "ACEGIJKL":"CGEKIAJL", "ACEHIJKL":"CHEKIAJL", "ACFGHIJK":"CFHKJAGI",
  "ACFGHIJL":"CFHIJAGL", "ACFGHIKL":"CFHKIAGL", "ACFGHJKL":"CFHKJAGL", "ACFGIJKL":"CFIKJAGL",
  "ACFHIJKL":"CFHKIAJL", "ACGHIJKL":"CGHKIAJL", "ADEFGHIJ":"DFHIJAGE", "ADEFGHIK":"DFHKEAGI",
  "ADEFGHIL":"DFHIEAGL", "ADEFGHJK":"DFHKJAGE", "ADEFGHJL":"DFHEJAGL", "ADEFGHKL":"DFHKEAGL",
  "ADEFGIJK":"DFEKJAGI", "ADEFGIJL":"DFEIJAGL", "ADEFGIKL":"DFEKIAGL", "ADEFGJKL":"DFEKJAGL",
  "ADEFHIJK":"DFHKEAJI", "ADEFHIJL":"DFHIEAJL", "ADEFHIKL":"DFHKIAEL", "ADEFHJKL":"DFHKEAJL",
  "ADEFIJKL":"DFEKIAJL", "ADEGHIJK":"DHEKJAGI", "ADEGHIJL":"DHEIJAGL", "ADEGHIKL":"DHEKIAGL",
  "ADEGHJKL":"DHEKJAGL", "ADEGIJKL":"DGEKIAJL", "ADEHIJKL":"DHEKIAJL", "ADFGHIJK":"DFHKJAGI",
  "ADFGHIJL":"DFHIJAGL", "ADFGHIKL":"DFHKIAGL", "ADFGHJKL":"DFHKJAGL", "ADFGIJKL":"DFIKJAGL",
  "ADFHIJKL":"DFHKIAJL", "ADGHIJKL":"DGHKIAJL", "AEFGHIJK":"FHEKJAGI", "AEFGHIJL":"FHEIJAGL",
  "AEFGHIKL":"FHEKIAGL", "AEFGHJKL":"FHEKJAGL", "AEFGIJKL":"FGEKIAJL", "AEFHIJKL":"FHEKIAJL",
  "AEGHIJKL":"AGEKIHJL", "AFGHIJKL":"FGHKIAJL", "BCDEFGHI":"DFCIBHGE", "BCDEFGHJ":"CFHEBJGD",
  "BCDEFGHK":"DFCKBHGE", "BCDEFGHL":"DFCEBHGL", "BCDEFGIJ":"DFCIBJGE", "BCDEFGIK":"DFCKBEGI",
  "BCDEFGIL":"DFCIBEGL", "BCDEFGJK":"DFCKBJGE", "BCDEFGJL":"DFCEBJGL", "BCDEFGKL":"DFCKBEGL",
  "BCDEFHIJ":"DFCIBHJE", "BCDEFHIK":"DFCKBHEI", "BCDEFHIL":"DFCIBHEL", "BCDEFHJK":"DFCKBHJE",
  "BCDEFHJL":"DFCEBHJL", "BCDEFHKL":"DFCKBHEL", "BCDEFIJK":"DFCKBEJI", "BCDEFIJL":"DFCIBEJL",
  "BCDEFIKL":"DFCKBIEL", "BCDEFJKL":"DFCKBEJL", "BCDEGHIJ":"CDHIBJGE", "BCDEGHIK":"CDEKBHGI",
  "BCDEGHIL":"CDEIBHGL", "BCDEGHJK":"CDHKBJGE", "BCDEGHJL":"CDHEBJGL", "BCDEGHKL":"CDEKBHGL",
  "BCDEGIJK":"CDEKBJGI", "BCDEGIJL":"CDEIBJGL", "BCDEGIKL":"CDEKBIGL", "BCDEGJKL":"CDEKBJGL",
  "BCDEHIJK":"CDEKBHJI", "BCDEHIJL":"CDEIBHJL", "BCDEHIKL":"CDEKBHIL", "BCDEHJKL":"CDEKBHJL",
  "BCDEIJKL":"CDEKBIJL", "BCDFGHIJ":"CFHIBJGD", "BCDFGHIK":"DFCKBHGI", "BCDFGHIL":"DFCIBHGL",
  "BCDFGHJK":"CFHKBJGD", "BCDFGHJL":"DFCJBHGL", "BCDFGHKL":"DFCKBHGL", "BCDFGIJK":"DFCKBJGI",
  "BCDFGIJL":"DFCIBJGL", "BCDFGIKL":"DFCKBIGL", "BCDFGJKL":"DFCKBJGL", "BCDFHIJK":"DFCKBHJI",
  "BCDFHIJL":"DFCIBHJL", "BCDFHIKL":"DFCKBHIL", "BCDFHJKL":"DFCKBHJL", "BCDFIJKL":"DFCKBIJL",
  "BCDGHIJK":"CDHKBJGI", "BCDGHIJL":"CDHIBJGL", "BCDGHIKL":"CDHKBIGL", "BCDGHJKL":"CDHKBJGL",
  "BCDGIJKL":"CDIKBJGL", "BCDHIJKL":"CDHKBIJL", "BCEFGHIJ":"CFHIBJGE", "BCEFGHIK":"CFEKBHGI",
  "BCEFGHIL":"CFEIBHGL", "BCEFGHJK":"CFHKBJGE", "BCEFGHJL":"CFHEBJGL", "BCEFGHKL":"CFEKBHGL",
  "BCEFGIJK":"CFEKBJGI", "BCEFGIJL":"CFEIBJGL", "BCEFGIKL":"CFEKBIGL", "BCEFGJKL":"CFEKBJGL",
  "BCEFHIJK":"CFEKBHJI", "BCEFHIJL":"CFEIBHJL", "BCEFHIKL":"CFEKBHIL", "BCEFHJKL":"CFEKBHJL",
  "BCEFIJKL":"CFEKBIJL", "BCEGHIJK":"CGEKBHJI", "BCEGHIJL":"CGEIBHJL", "BCEGHIKL":"CHEKBIGL",
  "BCEGHJKL":"CGEKBHJL", "BCEGIJKL":"CGEKBIJL", "BCEHIJKL":"CHEKBIJL", "BCFGHIJK":"CFHKBJGI",
  "BCFGHIJL":"CFHIBJGL", "BCFGHIKL":"CFHKBIGL", "BCFGHJKL":"CFHKBJGL", "BCFGIJKL":"CFIKBJGL",
  "BCFHIJKL":"CFHKBIJL", "BCGHIJKL":"CGHKBIJL", "BDEFGHIJ":"DFHIBJGE", "BDEFGHIK":"DFEKBHGI",
  "BDEFGHIL":"DFEIBHGL", "BDEFGHJK":"DFHKBJGE", "BDEFGHJL":"DFHEBJGL", "BDEFGHKL":"DFEKBHGL",
  "BDEFGIJK":"DFEKBJGI", "BDEFGIJL":"DFEIBJGL", "BDEFGIKL":"DFEKBIGL", "BDEFGJKL":"DFEKBJGL",
  "BDEFHIJK":"DFEKBHJI", "BDEFHIJL":"DFEIBHJL", "BDEFHIKL":"DFEKBHIL", "BDEFHJKL":"DFEKBHJL",
  "BDEFIJKL":"DFEKBIJL", "BDEGHIJK":"DGEKBHJI", "BDEGHIJL":"DGEIBHJL", "BDEGHIKL":"DHEKBIGL",
  "BDEGHJKL":"DGEKBHJL", "BDEGIJKL":"DGEKBIJL", "BDEHIJKL":"DHEKBIJL", "BDFGHIJK":"DFHKBJGI",
  "BDFGHIJL":"DFHIBJGL", "BDFGHIKL":"DFHKBIGL", "BDFGHJKL":"DFHKBJGL", "BDFGIJKL":"DFIKBJGL",
  "BDFHIJKL":"DFHKBIJL", "BDGHIJKL":"DGHKBIJL", "BEFGHIJK":"FGEKBHJI", "BEFGHIJL":"FGEIBHJL",
  "BEFGHIKL":"FHEKBIGL", "BEFGHJKL":"FGEKBHJL", "BEFGIJKL":"FGEKBIJL", "BEFHIJKL":"FHEKBIJL",
  "BEGHIJKL":"BGEKIHJL", "BFGHIJKL":"FGHKBIJL", "CDEFGHIJ":"DFCIJHGE", "CDEFGHIK":"DFCKEHGI",
  "CDEFGHIL":"DFCIEHGL", "CDEFGHJK":"DFCKJHGE", "CDEFGHJL":"DFCEJHGL", "CDEFGHKL":"DFCKEHGL",
  "CDEFGIJK":"DFCKEJGI", "CDEFGIJL":"DFCIEJGL", "CDEFGIKL":"DFCKEIGL", "CDEFGJKL":"DFCKEJGL",
  "CDEFHIJK":"DFCKEHJI", "CDEFHIJL":"DFCIEHJL", "CDEFHIKL":"DFCKIHEL", "CDEFHJKL":"DFCKEHJL",
  "CDEFIJKL":"DFCKEIJL", "CDEGHIJK":"CDEKJHGI", "CDEGHIJL":"CDEIJHGL", "CDEGHIKL":"CDEKIHGL",
  "CDEGHJKL":"CDEKJHGL", "CDEGIJKL":"CDEKIJGL", "CDEHIJKL":"CDEKIHJL", "CDFGHIJK":"DFCKJHGI",
  "CDFGHIJL":"DFCIJHGL", "CDFGHIKL":"DFCKIHGL", "CDFGHJKL":"DFCKJHGL", "CDFGIJKL":"DFCKIJGL",
  "CDFHIJKL":"DFCKIHJL", "CDGHIJKL":"CDHKIJGL", "CEFGHIJK":"CFEKJHGI", "CEFGHIJL":"CFEIJHGL",
  "CEFGHIKL":"CFEKIHGL", "CEFGHJKL":"CFEKJHGL", "CEFGIJKL":"CFEKIJGL", "CEFHIJKL":"CFEKIHJL",
  "CEGHIJKL":"CGEKIHJL", "CFGHIJKL":"CFHKIJGL", "DEFGHIJK":"DFEKJHGI", "DEFGHIJL":"DFEIJHGL",
  "DEFGHIKL":"DFEKIHGL", "DEFGHJKL":"DFEKJHGL", "DEFGIJKL":"DFEKIJGL", "DEFHIJKL":"DFEKIHJL",
  "DEGHIJKL":"DGEKIHJL", "DFGHIJKL":"DFHKIJGL", "EFGHIJKL":"FGEKIHJL"
};
  let REAL_RESULTS = {};

  // --- constants (mirror index.html SHARED_FNS prelude @7217-7230) ---
  const HOME_TEAMS = new Set(['USA', 'CAN', 'MEX']);
  const HOME_BONUS_ELO = 70, HOME_BONUS_OPTA = 3.5, HOME_BONUS_FIFA = 60;
  const EPSILON_BASE_T1 = 0.20, EPSILON_SPREAD_T1 = 0.20, EPSILON_BASE_T2 = 0.40, EPSILON_SPREAD_T2 = 0.30, SHIFT_CAP = 0.8;
  const LEAGUE_AVG_ATK = 1.83, LEAGUE_AVG_DEF = 0.99, BASE_GOALS_GS = 2.20, BASE_GOALS_KO = 2.55;

  // --- helpers that are arrow-style in main (not extracted) ---
  const rating = (team) => RATING_MODE === 'opta' ? team.opta : RATING_MODE === 'fifa' ? (typeof team.fifaP === 'number' ? team.fifaP : team.elo) : RATING_MODE === 'original' ? (typeof team.matchup === 'number' ? team.matchup : 50) : RATING_MODE === 'power' ? (typeof team.powerElo === 'number' ? team.powerElo : team.elo) : team.elo;
  const getGroup = (g) => TEAMS.filter(x => x.g === g);
  const getTeam = (code) => TEAMS.find(t => t.c === code);
  let flagHtml = (t) => (t && t.f) ? ('<span class="fi fi-' + t.f + '"></span>') : '';

  // --- engine (extracted from index.html; Math.random -> rng) ---
function lookupRealResult(c1, c2, stage) {
  if (typeof REAL_RESULTS === 'undefined' || !REAL_RESULTS) return null;
  const key = (stage !== 'gs' ? 'KO|' : 'GS|') + [c1, c2].slice().sort().join('|');
  return REAL_RESULTS[key] || null;
}

function homeBonusMultiplier(teamCode, stage) {
  // stage is one of: 'gs', 'r32', 'r16', 'qf', 'sf', 'f'
  // Default (GS, R32, R16): all three hosts effectively at home
  if (stage === 'gs' || stage === 'r32' || stage === 'r16' || !stage) return 1.0;
  // QF / SF / F: all in USA
  if (teamCode === 'USA') return 1.0;
  return 0.0; // CAN / MEX play these as away matches
}

function homeBonus(t1, t2, stage) {
  if (!HOME_ADVANTAGE_ON) return 0;
  const bonus = RATING_MODE === 'opta' ? HOME_BONUS_OPTA
              : RATING_MODE === 'fifa' ? HOME_BONUS_FIFA
              : HOME_BONUS_ELO;
  const t1Home = HOME_TEAMS.has(t1.c);
  const t2Home = HOME_TEAMS.has(t2.c);
  const m1 = t1Home ? homeBonusMultiplier(t1.c, stage) : 0;
  const m2 = t2Home ? homeBonusMultiplier(t2.c, stage) : 0;
  // Net effect: t1's home boost minus t2's home boost
  return bonus * (m1 - m2);
}

function drawProb(absDiff) {
  const smallT = RATING_MODE === 'opta' ? 5 : RATING_MODE === 'fifa' ? 100 : 75;
  const medT   = RATING_MODE === 'opta' ? 10 : RATING_MODE === 'fifa' ? 200 : 150;
  if (absDiff < smallT) return 0.35;
  if (absDiff < medT)   return 0.25;
  return 0.15;
}

function simMatch(t1, t2, allowDraw, stage) {
  // LIVE: finished real-world matches are locked — return the actual outcome.
  // (KO records always carry a winner via PK; if data is ever degenerate we
  // fall through to simulation rather than invent a coin-flip here.)
  const _real = lookupRealResult(t1.c, t2.c, stage);
  if (_real && (_real.winnerC || allowDraw)) {
    if (_real.winnerC === null) return null;
    return _real.winnerC === t1.c ? t1 : t2;
  }
  // ORIGINAL (v2.17): outcome comes from the sampled score itself — no
  // rating-based win probability, no draw table, no KO pullback. (Real
  // results above still take precedence in every mode.)
  if (RATING_MODE === 'original') {
    return generateScoreOriginal(t1, t2, stage).winner;
  }
  const r1 = rating(t1), r2 = rating(t2);
  const diff = r1 - r2 + homeBonus(t1, t2, stage);
  // Opta scale: divide by 28; Elo scale: divide by 400 (standard)
  const divisor = RATING_MODE === 'opta' ? 28 : RATING_MODE === 'fifa' ? 300 : 400;
  const p1_raw = 1 / (1 + Math.pow(10, -diff / divisor));
  if (allowDraw) {
    // Draw probability from shared drawProb() — see its comment for history.
    const dp = drawProb(Math.abs(diff));
    const r = rng();
    if (r < dp) return null;
    return ((r - dp) / (1 - dp)) < p1_raw ? t1 : t2;
  }
  // v2.9.5 (stage-aware KO_PULLBACK): The pull-back effect is NOT uniform across KO
  // rounds. Later stages (QF/SF/F) favor elite teams more strongly because:
  //   1. Squad depth: top teams rotate starters in GS, arrive fresher in late KO.
  //     Weaker teams lack bench quality, their starters wear down by QF.
  //     (Kolodziejczyk et al. 2018 WC study: top-4 teams rotated 5-8 key players
  //     in GS match 3, maintained sprint/HIR intensity through the knockout stage.)
  //   2. Big-match experience: elites have more players with CL/final-stage
  //     experience, which matters psychologically in SF/F and PK.
  //   3. Historical pattern: every WC winner since 2002 closed at ≤+1200 pre-tournament
  //     (i.e., a clear favorite). True darkhorses reach finals occasionally
  //     (Croatia 2018) but don't lift the trophy.
  //
  // So PULLBACK is higher in R32/R16 (where upsets like Saudi-Argentina 2022 happen)
  // and lower in QF/SF/F (where the field self-selects for depth-rich teams).
  const isKO = stage && stage !== 'gs';
  const KO_PULLBACK_BY_STAGE = { r32: 0.20, r16: 0.18, qf: 0.15, sf: 0.12, f: 0.10 };
  const pullback = isKO ? (KO_PULLBACK_BY_STAGE[stage] || 0.20) : 0;
  const p1 = isKO ? (0.5 + (1 - pullback) * (p1_raw - 0.5)) : p1_raw;
  return rng() < p1 ? t1 : t2;
}

function poissonRand(lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rng(); } while (p > L);
  return k - 1;
}

function footballRand(lambda) {
  // v2.9.8: Pure Poisson (mixture removed after empirical testing).
  // The mixture (35% × 0.5λ + 65% × 1.269λ) was creating excess 0-0 scores
  // that real WC data doesn't show. Pure Poisson with calibrated BASE_GOALS
  // produces more natural X-Y close-game distribution.
  return poissonRand(lambda);
}

function bivariatePoissonRand(lambda1, lambda2, lambda0) {
  // Safety: lambda0 must not exceed min(lambda1, lambda2)
  const l0 = Math.max(0, Math.min(lambda0, lambda1, lambda2) * 0.95);
  const y0 = poissonRand(l0);
  const y1 = poissonRand(Math.max(0.01, lambda1 - l0));
  const y2 = poissonRand(Math.max(0.01, lambda2 - l0));
  return [y1 + y0, y2 + y0];
}

function strongFactor(opponentRating) {
  const low = RATING_MODE === 'opta' ? 72 : RATING_MODE === 'fifa' ? 1500 : 1700;
  const hi  = RATING_MODE === 'opta' ? 82 : RATING_MODE === 'fifa' ? 1700 : 1900;
  const t = Math.max(0, Math.min(1, (opponentRating - low) / (hi - low)));
  return t * t * (3 - 2 * t);
}

function pickLayer(statObj, opponentRating) {
  if (typeof statObj === 'number') return statObj;
  const f = strongFactor(opponentRating);
  return statObj.s * f + statObj.w * (1 - f);
}

function computeLambdas(t1, t2, stage) {
  // stage is one of: 'gs', 'r32', 'r16', 'qf', 'sf', 'f' (or legacy 'ko')
  // Only GS uses the lower base rate; all KO rounds use the higher one.
  const isGS = (stage === 'gs');
  const base = isGS ? BASE_GOALS_GS : BASE_GOALS_KO;
  const halfBase = base / 2;
  // ORIGINAL (v2.17): layer selection stays on the ELO scale regardless of
  // mode — the stratified atk/def layers were BUILT by classifying opponents
  // with Elo (strong ≈ 1700-1900+ band), so the lookup must use the same
  // yardstick. Elo's only role in ORIGINAL is this context label; it never
  // touches outcomes.
  const isOriginalMode = RATING_MODE === 'original';
  const r1 = isOriginalMode ? t1.elo : rating(t1);
  const r2 = isOriginalMode ? t2.elo : rating(t2);
  // Stratified atk/def: t1.atk is selected based on t2's strength (how strong is my opponent)
  // t1.def is likewise selected based on t2's strength (how strong is who I'm defending against)
  const atk1Raw = pickLayer(t1.atk, r2);
  const atk2Raw = pickLayer(t2.atk, r1);
  const def1Raw = pickLayer(t1.def, r2);
  const def2Raw = pickLayer(t2.def, r1);
  // Clamp atk/def to dampen outliers (priors from confederation-specific data)
  // Tightened in v2.2: stratified data + confederation mix pushed goals/match up by ~30%
  // v2.20: atk floor 1.0 → 0.7 (symmetric with def). The 1.0 floor silently
  // inflated genuinely weak attacks: 11 entrants have atk.s < 1.0 (KSA 0.73,
  // CAN 0.74, ECU 0.77…) and the boost flipped coin-toss KO ties in the
  // score-driven Matchup mode — ECU's modal win over BRA was a 51.6% edge
  // that existed only because 0.77 was read as 1.0. Sub-0.7 outliers are
  // still capped; the builder's shrinkage (v4.1) tames sampling noise upstream.
  const atk1 = Math.max(0.7, Math.min(2.2, atk1Raw));
  const atk2 = Math.max(0.7, Math.min(2.2, atk2Raw));
  const def1 = Math.max(0.7, Math.min(1.4, def1Raw));
  const def2 = Math.max(0.7, Math.min(1.4, def2Raw));
  // Stratified Poisson: λ = base/2 × (atk_own / avg_atk) × (def_opp / avg_def)
  // The atk/def values are stratified by opponent strength (selected via smoothstep above).
  let l1 = halfBase * (atk1 / LEAGUE_AVG_ATK) * (def2 / LEAGUE_AVG_DEF);
  let l2 = halfBase * (atk2 / LEAGUE_AVG_ATK) * (def1 / LEAGUE_AVG_DEF);
  if (isOriginalMode) {
    // ORIGINAL: no rating-based λ factor. The stratified atk/def already
    // encode strength, and in this mode the sampled score IS the outcome —
    // a rating nudge here would smuggle Elo back into the result.
    // Home advantage enters as a direct λ multiplier (×1.10 ≈ Elo +70,
    // decided 2026-05-07; stage-aware via homeBonusMultiplier).
    if (HOME_ADVANTAGE_ON) {
      const hm1 = HOME_TEAMS.has(t1.c) ? homeBonusMultiplier(t1.c, stage) : 0;
      const hm2 = HOME_TEAMS.has(t2.c) ? homeBonusMultiplier(t2.c, stage) : 0;
      l1 *= 1 + 0.10 * hm1;
      l2 *= 1 + 0.10 * hm2;
    }
  } else {
    // Rating-based adjustment: stronger team gets boost, weaker gets suppression
    // v2.3: softened factor (0.75〜1.25) because stratified atk/def already encodes strength gap.
    // Previous 0.55〜1.45 was double-counting the rating effect and caused elite-vs-elite blowouts.
    // v2.7: home advantage added to rating diff for the ratingP1 computation as well
    const divisor = RATING_MODE === 'opta' ? 28 : RATING_MODE === 'fifa' ? 300 : 400;
    const ratingDiff = (r1 - r2) + homeBonus(t1, t2, stage);
    const ratingP1 = 1 / (1 + Math.pow(10, -ratingDiff / divisor));
    const ratingFactor1 = 0.75 + 0.5 * ratingP1;
    const ratingFactor2 = 0.75 + 0.5 * (1 - ratingP1);
    l1 *= ratingFactor1;
    l2 *= ratingFactor2;
  }
  // Clamp individual λ (v2.3)
  l1 = Math.max(0.15, Math.min(2.8, l1));
  l2 = Math.max(0.15, Math.min(2.8, l2));
  // Cap combined λ to suppress unrealistic high-total games
  // v2.3: 4.5 → 3.8. Prevents "both elites simultaneously score 3+" scenarios that arise when
  // both sides have high atk_vs_strong values. Real WC: combined expected goals rarely > 3.
  const totalCap = 3.8;
  if (l1 + l2 > totalCap) {
    const k = totalCap / (l1 + l2);
    l1 *= k; l2 *= k;
  }
  // Entertainment-tuned damping: pulls extreme λ gaps slightly toward the mean.
  // Real football statistically permits 0-5 blowouts (2014 BRA 1-7 GER exists),
  // but naive stratified data overpredicts them because Brazil's current slump
  // shows strongly in their strong-layer def stats. v2.9.3: 15% → 18% to compensate
  // for the ε-shift's tendency to amplify per-side λ in close matchups.
  // Set dampening = 0.0 to disable and see raw stratified predictions.
  const avgL = (l1 + l2) / 2;
  const dampening = 0.18;
  l1 = l1 * (1 - dampening) + avgL * dampening;
  l2 = l2 * (1 - dampening) + avgL * dampening;
  return [l1, l2];
}

function computeEpsilonShift(tier, l1, l2, ratingP1) {
  const gap = Math.abs(ratingP1 - 0.5) * 2; // 0 = even, 1 = total mismatch
  const base = tier === 1 ? EPSILON_BASE_T1 : EPSILON_BASE_T2;
  const spread = tier === 1 ? EPSILON_SPREAD_T1 : EPSILON_SPREAD_T2;
  const epsilon = base + spread * gap;
  const totalL = l1 + l2;
  return Math.min(epsilon * totalL / 2, SHIFT_CAP);
}

function generateScoreForOutcome(t1, t2, winnerTeam, stage) {
  const [l1, l2] = computeLambdas(t1, t2, stage);
  const result = { s1: 0, s2: 0, aet: false, pk: false, pkS1: 0, pkS2: 0 };
  const isGS = (stage === 'gs');

  // Group stage draw case: force an equal score sampled near avg of both lambdas
  if (isGS && winnerTeam === null) {
    const avgL = (l1 + l2) / 2;
    const n = footballRand(avgL);
    result.s1 = n;
    result.s2 = n;
    return result;
  }

  // Non-draw case: gap-dependent two-tier epsilon sampling.
  // Compute ratingP1 (raw rating-based win prob) to size the bias appropriately.
  const winnerIsT1 = (winnerTeam === t1);
  const _r1 = rating(t1), _r2 = rating(t2);
  const _divisor = RATING_MODE === 'opta' ? 28 : RATING_MODE === 'fifa' ? 300 : 400;
  const _diff = _r1 - _r2 + homeBonus(t1, t2, stage);
  const ratingP1 = 1 / (1 + Math.pow(10, -_diff / _divisor));

  // Tier 1: gap-dependent mild bias. Close matches get small ε → natural
  // close-game distribution (1-2, 2-1 appear). Large gaps get larger ε →
  // winner convincingly outscores.
  const shift1 = computeEpsilonShift(1, l1, l2, ratingP1);
  const l1_t1 = winnerIsT1 ? l1 + shift1 : Math.max(0.05, l1 - shift1);
  const l2_t1 = winnerIsT1 ? Math.max(0.05, l2 - shift1) : l2 + shift1;
  let s1 = footballRand(l1_t1);
  let s2 = footballRand(l2_t1);
  let winnerScore = winnerIsT1 ? s1 : s2;
  let loserScore = winnerIsT1 ? s2 : s1;

  if (winnerScore > loserScore) {
    result.s1 = s1;
    result.s2 = s2;
    return result;
  }

  // Tier 2: gap-dependent stronger bias
  const shift2 = computeEpsilonShift(2, l1, l2, ratingP1);
  const l1_t2 = winnerIsT1 ? l1 + shift2 : Math.max(0.05, l1 - shift2);
  const l2_t2 = winnerIsT1 ? Math.max(0.05, l2 - shift2) : l2 + shift2;
  s1 = footballRand(l1_t2);
  s2 = footballRand(l2_t2);
  winnerScore = winnerIsT1 ? s1 : s2;
  loserScore = winnerIsT1 ? s2 : s1;

  if (winnerScore > loserScore) {
    result.s1 = s1;
    result.s2 = s2;
    return result;
  }

  // Both tiers failed.
  if (isGS) {
    // GS: force minimum win
    result.s1 = s1;
    result.s2 = s2;
    if (winnerIsT1) result.s1 = Math.max(s1, s2 + 1);
    else result.s2 = Math.max(s2, s1 + 1);
    return result;
  }

  // KO: escalate to AET.
  const tiedScore = Math.min(s1, s2);
  result.s1 = tiedScore;
  result.s2 = tiedScore;
  result.aet = true;

  // Extra time: λ × 0.25 (30min/90min × fatigue 0.75)
  // Use gap-dependent tier 2 bias (AET is a close-match resolution step by construction).
  const etL1 = l1 * 0.25;
  const etL2 = l2 * 0.25;
  const etShift = computeEpsilonShift(2, etL1, etL2, ratingP1);
  const etL1_biased = winnerIsT1 ? etL1 + etShift : Math.max(0.02, etL1 - etShift);
  const etL2_biased = winnerIsT1 ? Math.max(0.02, etL2 - etShift) : etL2 + etShift;
  let et1 = footballRand(etL1_biased);
  let et2 = footballRand(etL2_biased);
  let winnerET = winnerIsT1 ? et1 : et2;
  let loserET = winnerIsT1 ? et2 : et1;

  if (winnerET <= loserET) {
    // One more ET sample (small retry budget for AET resolution).
    // Real WC: ~50-70% of AET matches go to PK; this retry tunes that rate.
    et1 = footballRand(etL1_biased);
    et2 = footballRand(etL2_biased);
    winnerET = winnerIsT1 ? et1 : et2;
    loserET = winnerIsT1 ? et2 : et1;
  }

  if (winnerET > loserET) {
    // AET resolution
    result.s1 = tiedScore + et1;
    result.s2 = tiedScore + et2;
    return result;
  }

  // Still tied → PK shootout
  // Keep ET scores equal (minimum of the two)
  const etTied = Math.min(et1, et2);
  result.s1 = tiedScore + etTied;
  result.s2 = tiedScore + etTied;
  result.pk = true;

  // PK shootout: near coin-flip, but favorite bias grows slightly in later rounds.
  // v2.9.5: stage-aware conv spread reflects big-match experience advantage of
  // deep-squad teams. Earlier rounds (R32/R16) have wider participant quality spread
  // so favorite bias is small; later rounds only elites remain and experience counts
  // more — PK-Panenka mentality emerges (Modric, Mbappe, etc). Range 0.73-0.77 (R32)
  // widens to 0.72-0.80 (Final).
  const r1 = rating(t1), r2 = rating(t2);
  const divisor = RATING_MODE === 'opta' ? 28 : RATING_MODE === 'fifa' ? 300 : 400;
  const p1Strength = 1 / (1 + Math.pow(10, -(r1 - r2) / divisor));
  // conv1 = base + spread * p1Strength; conv2 = base + spread * (1-p1Strength)
  // Stage-aware spread: R32 0.04, R16 0.05, QF 0.06, SF 0.07, F 0.08
  const PK_SPREAD_BY_STAGE = { r32: 0.04, r16: 0.05, qf: 0.06, sf: 0.07, f: 0.08 };
  const pkSpread = PK_SPREAD_BY_STAGE[stage] || 0.04;
  const conv1 = 0.73 + pkSpread * p1Strength;
  const conv2 = 0.73 + pkSpread * (1 - p1Strength);

  let pk1 = 0, pk2 = 0;
  for (let k = 1; k <= 5; k++) {
    if (rng() < conv1) pk1++;
    if (rng() < conv2) pk2++;
  }
  while (pk1 === pk2) {
    if (rng() < conv1) pk1++;
    if (rng() < conv2) pk2++;
  }
  result.pkS1 = pk1;
  result.pkS2 = pk2;
  result.pkWinner = pk1 > pk2 ? t1 : t2;
  return result;
}

function generateScoreNative(t1, t2, stage) {
  // v2.22: 2% global goal trim (part of the GS shape recalibration — the
  // family had drifted to 2.58 goals/match vs the real 2.2-2.4 band; see
  // the redistribution block before the KO section).
  let [l1, l2] = computeLambdas(t1, t2, stage);
  l1 *= 0.98; l2 *= 0.98;
  const isGS = (stage === 'gs');
  const score = { s1: 0, s2: 0, aet: false, pk: false, pkS1: 0, pkS2: 0 };

  // Compute rating-based probabilities (same formula as simMatch for MC consistency).
  const _r1 = rating(t1), _r2 = rating(t2);
  const _divisor = RATING_MODE === 'opta' ? 28 : RATING_MODE === 'fifa' ? 300 : 400;
  const _diff = _r1 - _r2 + homeBonus(t1, t2, stage);
  const p1_raw = 1 / (1 + Math.pow(10, -_diff / _divisor));
  const KO_PULLBACK_BY_STAGE = { r32: 0.20, r16: 0.18, qf: 0.15, sf: 0.12, f: 0.10 };
  const pullback = !isGS ? (KO_PULLBACK_BY_STAGE[stage] || 0.20) : 0;
  const ratingP1 = isGS ? p1_raw : (0.5 + (1 - pullback) * (p1_raw - 0.5));

  // Step 1: decide intended outcome by rating (three-way for GS, two-way for KO).
  // For GS we also need P(draw). Uses the same drawProb() as simMatch (see its
  // comment for history of unifying this across code paths).
  let intendedWinner; // t1, t2, or null (draw)
  if (isGS) {
    const dp = drawProb(Math.abs(_diff));
    const r = rng();
    if (r < dp) intendedWinner = null;
    else {
      const condP1 = (p1_raw - 0.5 * dp) / (1 - dp);
      intendedWinner = (rng() < condP1) ? t1 : t2;
    }
  } else {
    intendedWinner = (rng() < ratingP1) ? t1 : t2;
  }

  // Step 2: asymmetric rating bias.
  // Winner λ raised, loser λ lowered, but not symmetrically: winner goes up more.
  // This biases score outcome toward mismatch-patterns (2-0, 3-0) when ratings differ
  // while preserving close-game patterns (1-1, 2-1) when ratings are similar.
  const gap = Math.abs(ratingP1 - 0.5) * 2;
  const shiftWinnerF = 0.10 + 0.20 * gap; // winner gets [0.10, 0.30] * avgL
  const shiftLoserF = 0.08 + 0.20 * gap;  // loser loses [0.08, 0.28] * avgL
  const avgL = (l1 + l2) / 2;
  const shiftWin = shiftWinnerF * avgL;
  const shiftLose = shiftLoserF * avgL;
  const t1Strong = ratingP1 > 0.5;
  const l1_biased = t1Strong ? Math.max(0.05, l1 + shiftWin) : Math.max(0.05, l1 - shiftLose);
  const l2_biased = t1Strong ? Math.max(0.05, l2 - shiftLose) : Math.max(0.05, l2 + shiftWin);

  // Step 3: sample from bivariate Poisson (Karlis-Ntzoufras 2003).
  // λ0 controls goal correlation — higher λ0 increases 2-2, 3-3 rates while
  // reducing 0-0 / 1-0 (moves mass from mismatched scores to paired scores).
  // Scale λ0 with total goals (pace of match).
  const BIV_LAMBDA0_FRAC = 0.40; // calibrated: λ0 = 40% of min(λ1, λ2) for better 2-2, 4-3
  const lambda0 = Math.min(l1_biased, l2_biased) * BIV_LAMBDA0_FRAC;
  const [s1_raw, s2_raw] = bivariatePoissonRand(l1_biased, l2_biased, lambda0);
  let s1 = s1_raw, s2 = s2_raw;

  // Step 4: reconcile with intended outcome using MINIMAL adjustment
  let finalWinner = intendedWinner;
  if (intendedWinner === null) {
    // GS draw: sample a single score value and use it for both sides
    // (min(s1, s2) would over-concentrate draws at 0-0).
    // v2.22: shrink the sampling λ. The old avg-λ draws averaged ~2.6
    // goals vs ~1.7 in real WC draws (0-0 ≈35%, 1-1 ≈45%, 2-2+ ≈20%);
    // 0.55×avg lands on the real mix and pays for part of the goals the
    // redistribution block adds to decided matches.
    const avgL = (l1_biased + l2_biased) / 2;
    const drawScore = poissonRand(avgL * 0.55);
    score.s1 = drawScore;
    score.s2 = drawScore;
    return { t1, t2, winner: null, score };
  }

  const winnerIs1 = intendedWinner === t1;
  const wScore = winnerIs1 ? s1 : s2;
  const lScore = winnerIs1 ? s2 : s1;

  if (wScore > lScore) {
    score.s1 = s1;
    score.s2 = s2;
    // Post-hoc: upgrade some 1-0 wins to 2-0 to match real WC (1-0 22.9% vs 2-0 17.7%).
    // Independent Poisson under-predicts 2-0 because it tends to cap winner at 1.
    // Only apply when gap is meaningful (stronger team dominates naturally in real data).
    const winScore = winnerIs1 ? s1 : s2;
    const losScore = winnerIs1 ? s2 : s1;
    if (winScore === 1 && losScore === 0) {
      // Poisson under-predicts 2-0 wins (real WC 1-0 22.9%, 2-0 17.7%).
      // Probabilistically upgrade 1-0 to 2-0 to match real-data shape.
      // (v2.22: 0.52 -> 0.58 — the recalibration's smaller knobs push 1-0
      // supply up, this pulls the displayed 1-0 share back to ~23%.)
      if (rng() < 0.58) {
        if (winnerIs1) score.s1 = 2;
        else score.s2 = 2;
      }
    }
  } else if (wScore === lScore) {
    // Tied sample → minimal adjustment. Three strategies:
    //   A) winner +1 (creates 1-0, 2-1, 3-2) — close-game shapes
    //   B) loser -1 if loser >= 1 (creates 2-0, 3-0) — dominant win shapes
    //   C) both +1 if tied at 0 (creates 1-1 from 0-0) — draw-like shapes
    // Intent: avoid over-producing 1-0 from 0-0 tied samples.
    const tiedScore = wScore;
    if (tiedScore === 0) {
      // 0-0 tied: split between 1-0 (winner+1) and 2-1 (both+1, then winner+1 on top)
      // A: winner+1 → 1-0
      // D: 2-1 pattern via winner+2 (rare but needed to push variation)
      if (rng() < 0.22) {
        // Boost: winner gets 2, loser gets 1 → 2-1 shape
        if (winnerIs1) { s1 = 2; s2 = 1; }
        else { s2 = 2; s1 = 1; }
      } else {
        // Standard: winner +1 → 1-0
        if (winnerIs1) s1 = 1;
        else s2 = 1;
      }
    } else {
      // tiedScore >= 1: use original A/B split
      const useB = rng() < 0.60;
      if (useB) {
        if (winnerIs1) s2 = s2 - 1;
        else s1 = s1 - 1;
      } else {
        if (winnerIs1) s1 = s1 + 1;
        else s2 = s2 + 1;
      }
    }
    score.s1 = s1;
    score.s2 = s2;
  } else {
    // Sample has loser winning → resample up to 3 times until intended-winner agrees
    // Better than blindly swapping: preserves natural Poisson score distribution.
    let resample = 0;
    while (resample < 3) {
      const [s1_new, s2_new] = bivariatePoissonRand(l1_biased, l2_biased, lambda0);
      s1 = s1_new; s2 = s2_new;
      const wS = winnerIs1 ? s1 : s2;
      const lS = winnerIs1 ? s2 : s1;
      if (wS > lS) break;
      if (wS === lS) {
        // Apply tied-sample adjustment (A/B mix) after resample
        const useB2 = wS >= 1 && rng() < 0.60;
        if (useB2) {
          if (winnerIs1) s2 = s2 - 1;
          else s1 = s1 - 1;
        } else {
          if (winnerIs1) s1 = s1 + 1;
          else s2 = s2 + 1;
        }
        break;
      }
      resample++;
    }
    // If still loser-winning after 3 resamples, force +1 to winner
    const finalW = winnerIs1 ? s1 : s2;
    const finalL = winnerIs1 ? s2 : s1;
    if (finalW <= finalL) {
      if (winnerIs1) s1 = finalL + 1;
      else s2 = finalL + 1;
    }
    score.s1 = s1;
    score.s2 = s2;
  }

  // v2.22: GS shape redistribution (2026-06-13). The asymmetric rating
  // bias (step 2) starves the loser's λ, so "beaten but scoring" games
  // (3-1, 4-2 — 27% of real decided WC group matches) almost never came
  // out of the sampler (8%), while shutouts piled up (loser-0 ~70% vs the
  // real 56.2%). Move the surplus shutout/2-1 mass into 3-1 and trim the
  // blowout tail. 4-0→3-1 is goal-neutral; the added goals elsewhere are
  // paid for by the draw shrink and the 0.98 λ trim above. The winner
  // NEVER changes, so tournament probabilities are untouched (scores are
  // presentation in the rating-driven modes). Measured after (400
  // tournaments, elo): draws 20.3 / 1-0 23.9 / loser-0 54.3 / margin-1
  // 46.3 / mean goals 2.51 — vs drifted 19.7/23.5/70.3/50.7/2.58. Known
  // residual, disclosed: goals sit ~0.1 above the 2.2-2.4 real band.
  if (isGS && score.s1 !== score.s2) {
    const hiS = Math.max(score.s1, score.s2), loS = Math.min(score.s1, score.s2);
    const wIs1 = score.s1 > score.s2;
    const setHL = (h, l) => { if (wIs1) { score.s1 = h; score.s2 = l; } else { score.s1 = l; score.s2 = h; } };
    const rq = rng();
    if (hiS === 4 && loS === 0) { if (rq < 0.60) setHL(3, 1); }
    else if (hiS === 3 && loS === 0) { if (rq < 0.32) setHL(3, 1); }
    else if (hiS === 2 && loS === 0) { if (rq < 0.42) setHL(3, 1); }
    // (not in FIFA mode: its flatter probability scale already under-
    // produces margin-1 — draining 2-1 pushed it to 41% vs the real 45.8.)
    else if (hiS === 2 && loS === 1) { if (RATING_MODE !== 'fifa' && rq < 0.28) setHL(3, 1); }
    else if (hiS >= 4 && loS >= 1) { if (rq < 0.50) setHL(hiS - 1, loS); }
    else if (hiS >= 5 && loS === 0) { if (rq < 0.50) setHL(hiS - 1, 0); }
  }

  // KO: probabilistically trigger AET/PK to match real WC rates.
  //
  // DESIGN INTENT (v2.15): dual-purpose layer.
  //   simMatch's KO_PULLBACK already provides rating-based upset tolerance at
  //   the outcome layer (who wins). This additional 30% AET rewrite + PK
  //   shootout layer has two jobs:
  //     1. Narrative: produce realistic AET/PK rates (~30% AET, ~19% PK —
  //        matching recent WC data) so bracket visualisations and per-stage
  //        breakdowns show believable tournament pacing.
  //     2. Distributional: incidentally flattens the championship distribution
  //        toward pre-tournament market odds, because PKs are near-50/50.
  //        Empirically, enabling this layer pulled Spain's win share from
  //        22.8% → 19.0% and raised Japan's from 1.77% → 2.06% in 100k runs,
  //        moving the model closer to real bookmaker odds without touching the
  //        rating-based simMatch outcomes.
  //   Removing this layer would lose both. This is intended behaviour.
  //
  // When AET triggers, we first "rewind" the score to a tied state at regulation
  // end, then play extra time. When PK triggers on top, the AET score remains tied
  // and the winner is decided in the shootout. This preserves the invariant that
  // a match showing "(X-Y PK)" or "AET" must have a tied score in main/ET time.
  //
  // Guard (v2.15.2): only fire when score.aet is still false. In the current
  // code path this is always the case at this point, but a future edit to the
  // rejection-sampling fallback above could conceivably set score.aet earlier.
  // The guard keeps the "AET is entered at most once" invariant explicit.
  if (!isGS && !score.aet) {
    if (rng() < 0.30) {
      score.aet = true;
      // Rewind to a tied regulation-time score. Use the loser's score as the
      // tied value (a conservative "the favorite was held" narrative, and keeps
      // average regulation-goal counts closer to reality than averaging up).
      const regTied = Math.min(score.s1, score.s2);
      score.s1 = regTied;
      score.s2 = regTied;
      // Extra time: add goals sampled from a reduced λ (15% of regulation intensity,
      // reflecting 30-min duration and player fatigue).
      const etL1 = l1_biased * 0.15;
      const etL2 = l2_biased * 0.15;
      const et1 = footballRand(etL1);
      const et2 = footballRand(etL2);

      if (rng() < 0.63) {
        // PK path: AET also ends level. Keep ET goals symmetric.
        score.pk = true;
        const etTied = Math.min(et1, et2);
        score.s1 += etTied;
        score.s2 += etTied;

        const PK_SPREAD_BY_STAGE = { r32: 0.04, r16: 0.05, qf: 0.06, sf: 0.07, f: 0.08 };
        const pkSpread = PK_SPREAD_BY_STAGE[stage] || 0.04;
        const conv1 = 0.73 + pkSpread * p1_raw;
        const conv2 = 0.73 + pkSpread * (1 - p1_raw);
        let pk1 = 0, pk2 = 0;
        for (let k = 1; k <= 5; k++) {
          if (rng() < conv1) pk1++;
          if (rng() < conv2) pk2++;
        }
        while (pk1 === pk2) {
          if (rng() < conv1) pk1++;
          if (rng() < conv2) pk2++;
        }
        score.pkS1 = pk1;
        score.pkS2 = pk2;
        finalWinner = pk1 > pk2 ? t1 : t2;
        score.pkWinner = finalWinner;
      } else {
        // AET decides: ET goals must produce a winner. If sampled ET is tied,
        // force one goal to the intended winner so ET has a decisive margin.
        if (et1 !== et2) {
          score.s1 += et1;
          score.s2 += et2;
          // Final ET winner is just whichever team has more goals post-ET.
          // (Previously computed twice — first line was dead code from an
          // earlier refactor, removed in v2.15.2.)
          finalWinner = score.s1 > score.s2 ? t1 : t2;
        } else {
          // Tied ET: give intended winner +1 over opponent
          const winnerIs1Local = (finalWinner === t1);
          if (winnerIs1Local) {
            score.s1 += et1 + 1;
            score.s2 += et2;
          } else {
            score.s1 += et1;
            score.s2 += et2 + 1;
          }
        }
      }
    }
  }
  return { t1, t2, winner: finalWinner, score };
}

function generateScoreOriginal(t1, t2, stage) {
  const [l1, l2] = computeLambdas(t1, t2, stage);
  const isGS = (stage === 'gs');
  const score = { s1: 0, s2: 0, aet: false, pk: false, pkS1: 0, pkS2: 0 };
  // λ0 (goal correlation): 0.20 × min(λ), NOT the 0.40 the rating modes use.
  // Named compromise #1: 0.40 was calibrated for score *flavor* under a
  // predetermined winner; letting it also decide outcomes pushed the GS draw
  // rate to ~34% (real WC: 20-25%). Measured ladder: 0.40 → 33.9% draws,
  // 0.12 → 22.1% but loser-0 inflated to 65% (less shared scoring), 0.20 =
  // balance point. Current figures: scripts/test_original.js.
  const [s1Raw, s2Raw] = bivariatePoissonRand(l1, l2, Math.min(l1, l2) * 0.20);
  let s1 = s1Raw, s2 = s2Raw;

  // Named compromise #2: λ-edge-proportional tie mitigation. When a sample
  // comes out level, the λ-favored side gets +1 with probability equal to the
  // normalized λ edge. The edge comes from atk/def alone — no external rating
  // sneaks into the outcome — and even matchups keep their natural draws.
  if (s1 === s2) {
    const edge = Math.abs(l1 - l2) / Math.max(0.1, l1 + l2);
    if (rng() < edge) {
      if (l1 > l2) s1 += 1; else s2 += 1;
    }
  }

  // Weak shape calibration, ORIGINAL-tuned (applied after tie mitigation so
  // it reshapes those freshly-created 1-0s too). Raw sampling leaves 1-0 and
  // margin-1 above the real-WC shape; these mild upgrades (much weaker than
  // the rating modes' 52%/20%) pull both toward it. Winner-neutral.
  if (s1 !== s2) {
    const hiS = Math.max(s1, s2), loS = Math.min(s1, s2), oneLeads = s1 > s2;
    if (hiS === 1 && loS === 0 && rng() < 0.20) {
      if (oneLeads) s1 = 2; else s2 = 2;
    } else if (hiS === 2 && loS === 1 && rng() < 0.15) {
      if (oneLeads) { s1 = 3; s2 = 2; } else { s2 = 3; s1 = 2; }
    }
  }

  if (isGS || s1 !== s2) {
    score.s1 = s1; score.s2 = s2;
    const winner = s1 > s2 ? t1 : s2 > s1 ? t2 : null;
    return { t1, t2, winner, score };
  }

  // KO, regulation level → extra time (λ × 0.15 per side, fatigue-reduced).
  score.aet = true;
  score.s1 = s1; score.s2 = s2;
  const et1 = footballRand(l1 * 0.15);
  const et2 = footballRand(l2 * 0.15);
  score.s1 += et1; score.s2 += et2;
  if (et1 !== et2) {
    return { t1, t2, winner: score.s1 > score.s2 ? t1 : t2, score };
  }

  // ET level too → penalty shootout, flat conversion.
  score.pk = true;
  let pk1 = 0, pk2 = 0;
  for (let k = 1; k <= 5; k++) {
    if (rng() < 0.73) pk1++;
    if (rng() < 0.73) pk2++;
  }
  while (pk1 === pk2) {
    if (rng() < 0.73) pk1++;
    if (rng() < 0.73) pk2++;
  }
  score.pkS1 = pk1; score.pkS2 = pk2;
  const winner = pk1 > pk2 ? t1 : t2;
  score.pkWinner = winner;
  return { t1, t2, winner, score };
}

function simMatchDetailed(t1, t2, stage) {
  // LIVE: finished real-world matches return their actual score, flagged
  // real:true so renderers can mark them as played (not simulated).
  const _real = lookupRealResult(t1.c, t2.c, stage);
  if (_real && (_real.winnerC || stage === 'gs')) {
    const flip = _real.c1 !== t1.c;
    const score = {
      s1: flip ? _real.s2 : _real.s1,
      s2: flip ? _real.s1 : _real.s2,
      aet: !!_real.aet, pk: !!_real.pk,
      pkS1: flip ? _real.pkS2 : _real.pkS1,
      pkS2: flip ? _real.pkS1 : _real.pkS2
    };
    const winner = _real.winnerC === null ? null : (_real.winnerC === t1.c ? t1 : t2);
    return { t1, t2, winner, score, real: true };
  }
  if (RATING_MODE === 'original') return generateScoreOriginal(t1, t2, stage);
  return generateScoreNative(t1, t2, stage);
}

function simGroupDetailed(teams) {
  const stats = {}; // c -> {P, W, D, L, GF, GA, GD, Pts}
  const matches = []; // list of {t1, t2, score}
  const fp = {}; // v2.25: fair-play points (real cards only; late group tiebreak)
  teams.forEach(x => { stats[x.c] = { P:0, W:0, D:0, L:0, GF:0, GA:0, GD:0, Pts:0 }; fp[x.c] = 0; });
  for (let i = 0; i < teams.length; i++) {
    for (let j = i+1; j < teams.length; j++) {
      const t1 = teams[i], t2 = teams[j];
      const result = simMatchDetailed(t1, t2, 'gs');
      matches.push(result);
      // v2.25: accumulate real-card fair-play points (simulated games add 0)
      const _rfp = lookupRealResult(t1.c, t2.c, 'gs');
      if (_rfp && _rfp.fairPlay) {
        if (_rfp.fairPlay[t1.c] != null) fp[t1.c] += _rfp.fairPlay[t1.c];
        if (_rfp.fairPlay[t2.c] != null) fp[t2.c] += _rfp.fairPlay[t2.c];
      }
      const s1 = result.score.s1, s2 = result.score.s2;
      stats[t1.c].P++; stats[t2.c].P++;
      stats[t1.c].GF += s1; stats[t1.c].GA += s2;
      stats[t2.c].GF += s2; stats[t2.c].GA += s1;
      if (s1 === s2) {
        stats[t1.c].D++; stats[t2.c].D++;
        stats[t1.c].Pts++; stats[t2.c].Pts++;
      } else if (s1 > s2) {
        stats[t1.c].W++; stats[t2.c].L++;
        stats[t1.c].Pts += 3;
      } else {
        stats[t2.c].W++; stats[t1.c].L++;
        stats[t2.c].Pts += 3;
      }
    }
  }
  teams.forEach(x => { stats[x.c].GD = stats[x.c].GF - stats[x.c].GA; });

  // v2.24: TRUE FIFA WC 2026 tiebreak order (head-to-head FIRST).
  // Earlier versions sorted by overall GD/GF *before* H2H — that was the
  // 2018/2022 rule. For 2026 FIFA moved H2H ahead of overall GD/GF. Correct:
  //   1. Points (all matches)
  //   --- among teams level on points, in this order: ---
  //   2. H2H Points (matches between the tied teams only)
  //   3. H2H Goal Difference
  //   4. H2H Goals For
  //   5. Overall Goal Difference (all matches)
  //   6. Overall Goals For (all matches)
  //   7. Fair-play / team-conduct score (LIVE: from real card data — see Part B
  //      / addFairPlay; falls through to rating for purely simulated groups)
  //   8. FIFA ranking → drawing of lots (replaced by rating for determinism)
  //
  // The fast-path simGroup() (used in 100k MC) skips H2H for speed, relying on
  // a rating-weighted pseudo-GD ("sc"). This detailed path resolves 3-way ties
  // correctly — a recurring case in real WC groups (e.g. Japan-Spain-Germany
  // at WC 2022, where GD was the decider but H2H would've mattered if Spain
  // hadn't put 7 past Costa Rica).
  //
  // v2.13.2: H2H is now *properly recursive*. When a 3-way tie is partially
  // resolved (one team separates from the other two via H2H), the remaining
  // two are re-compared with a new H2H mini-table computed *only* from their
  // matches against each other — not from the original scope. This is what
  // FIFA actually does. Practical impact: rare (sub-0.1% of groups) but the
  // one case where the previous naive "reuse the bigger scope" could give
  // the wrong winner has been eliminated.
  const h2hStats = (teamCodes) => {
    const mini = {};
    teamCodes.forEach(c => { mini[c] = { Pts: 0, GD: 0, GF: 0 }; });
    matches.forEach(m => {
      const c1 = m.t1.c, c2 = m.t2.c;
      if (!mini[c1] || !mini[c2]) return;
      const s1 = m.score.s1, s2 = m.score.s2;
      mini[c1].GF += s1; mini[c1].GD += (s1 - s2);
      mini[c2].GF += s2; mini[c2].GD += (s2 - s1);
      if (s1 > s2)      mini[c1].Pts += 3;
      else if (s2 > s1) mini[c2].Pts += 3;
      else { mini[c1].Pts += 1; mini[c2].Pts += 1; }
    });
    return mini;
  };

  // Resolve a block of teams all sharing (Pts, GD, GF).
  // Returns the ordered list (best first). Recursively applied to partially-
  // tied sub-blocks as FIFA regulations require.
  //
  // Depth is bounded: each recursion either shrinks the block or picks a
  // final ordering via rating. With at most 4 teams per group, max recursion
  // depth is 3 (4→3→2→1).
  const resolveBlock = (block) => {
    if (block.length <= 1) return block;
    // Single-pair block: just use H2H of the pair itself. If still tied,
    // fall through to rating.
    const scope = block.map(t => t.c);
    const mini = h2hStats(scope);
    // Sort by H2H Pts → H2H GD → H2H GF → overall GD → overall GF → rating
    const sorted = [...block].sort((a, b) => {
      const mA = mini[a.c], mB = mini[b.c];
      if (mA.Pts !== mB.Pts) return mB.Pts - mA.Pts;
      if (mA.GD  !== mB.GD)  return mB.GD  - mA.GD;
      if (mA.GF  !== mB.GF)  return mB.GF  - mA.GF;
      // H2H fully tied within this scope → fall to overall GD, then GF
      // (FIFA 2026 steps 5-6), then fair-play (LIVE only, from real cards),
      // then rating (FIFA-ranking / drawing-of-lots stand-in for determinism).
      if (stats[a.c].GD !== stats[b.c].GD) return stats[b.c].GD - stats[a.c].GD;
      if (stats[a.c].GF !== stats[b.c].GF) return stats[b.c].GF - stats[a.c].GF;
      if (fp[a.c] !== fp[b.c]) return fp[b.c] - fp[a.c]; // higher (fewer cards) ranks above
      return rating(b) - rating(a);
    });
    // Walk the sorted result, building sub-blocks of teams that are STILL
    // tied after this H2H pass (same H2H Pts+GD+GF). Each such sub-block
    // must be re-resolved with a fresh mini-table scoped only to its members.
    const output = [];
    let i = 0;
    while (i < sorted.length) {
      const cur = sorted[i];
      let j = i + 1;
      while (j < sorted.length) {
        const nxt = sorted[j];
        const mC = mini[cur.c], mN = mini[nxt.c];
        if (mC.Pts === mN.Pts && mC.GD === mN.GD && mC.GF === mN.GF) j++;
        else break;
      }
      if (j - i === 1) {
        output.push(cur);
      } else if (j - i === sorted.length && j - i === block.length) {
        // No progress: H2H gave identical result for everyone in the block.
        // Further recursion won't help — everyone falls through to rating.
        // The `sorted` order already used rating as final tiebreak, so just
        // emit the block in that order.
        //
        // The double-length check (sorted.length && block.length) is currently
        // redundant — sorted is produced by [...block].sort(...) so the two are
        // always equal. It's kept as a defensive self-documentation: the
        // invariant "no progress" genuinely requires both, and if future edits
        // add any filter/map before the sort, this condition stays correct
        // (falls through to recursion rather than incorrectly terminating).
        sorted.forEach(t => output.push(t));
        break;
      } else {
        // Sub-block is a strict subset — recurse with a new, smaller scope
        output.push(...resolveBlock(sorted.slice(i, j)));
      }
      i = j;
    }
    return output;
  };

  // FIFA 2026: teams level on POINTS are separated by head-to-head FIRST, then
  // by overall GD/GF. So block strictly by points and hand each multi-team block
  // to resolveBlock, which applies H2H → overall → rating in the correct order.
  // (Pre-2026 rules blocked by identical (Pts,GD,GF) and only ran H2H on the
  // leftover — that put overall GD/GF ahead of H2H, which was the bug.)
  const byPoints = [...teams].sort((a, b) => stats[b.c].Pts - stats[a.c].Pts);
  const standings = [];
  let bi = 0;
  while (bi < byPoints.length) {
    let bj = bi + 1;
    while (bj < byPoints.length && stats[byPoints[bj].c].Pts === stats[byPoints[bi].c].Pts) bj++;
    if (bj - bi === 1) {
      standings.push(byPoints[bi]);
    } else {
      resolveBlock(byPoints.slice(bi, bj)).forEach(t => standings.push(t));
    }
    bi = bj;
  }

  return {
    standings: standings.map(x => ({ ...x, ...stats[x.c], sc: stats[x.c].GD })),
    matches
  };
}

function simGroup(teams) {
  const pts = {}, sc = {};
  // v2.24: head-to-head BEFORE overall sc when teams are level on points (FIFA
  // 2026 order). Per-pair H2H record: pts (3/1/0) + signed GD. LIVE: locked real
  // matches contribute their ACTUAL goal margin so fast-path standings agree with
  // reality; simulated games use the rating-weighted pseudo margin. 2-team ties
  // resolve EXACTLY (direct result decides); 3-team ties use the GD approximation.
  const h2h = {};
  const fp = {}; // v2.25: fair-play points (real cards only; late group tiebreak)
  teams.forEach(x => { pts[x.c] = 0; sc[x.c] = 0; h2h[x.c] = {}; fp[x.c] = 0; });
  for (let i = 0; i < teams.length; i++) {
    for (let j = i+1; j < teams.length; j++) {
      const ti = teams[i], tj = teams[j];
      const w = simMatch(ti, tj, true, 'gs');
      const _real = lookupRealResult(ti.c, tj.c, 'gs');
      if (_real && _real.fairPlay) {
        if (_real.fairPlay[ti.c] != null) fp[ti.c] += _real.fairPlay[ti.c];
        if (_real.fairPlay[tj.c] != null) fp[tj.c] += _real.fairPlay[tj.c];
      }
      if (!w) {
        pts[ti.c] += 1; pts[tj.c] += 1;
        h2h[ti.c][tj.c] = { pts: 1, gd: 0 };
        h2h[tj.c][ti.c] = { pts: 1, gd: 0 };
      } else {
        const l = w === ti ? tj : ti;
        pts[w.c] += 3;
        let d;
        if (_real) {
          d = Math.abs(_real.s1 - _real.s2);
        } else {
          const rDiff = (RATING_MODE === 'opta' || RATING_MODE === 'original') ? (rating(w) - rating(l)) / 20 : (rating(w) - rating(l)) / 150;
          d = Math.max(0.5, rDiff + rng());
        }
        sc[w.c] += d; sc[l.c] -= d;
        h2h[w.c][l.c] = { pts: 3, gd: d };
        h2h[l.c][w.c] = { pts: 0, gd: -d };
      }
    }
  }
  // Resolve a block of teams level on points: H2H pts → H2H GD → overall sc →
  // rating. Recurses on sub-blocks still tied on H2H with a rescoped mini-table.
  const resolveFast = (block) => {
    if (block.length <= 1) return block;
    const scope = block.map(t => t.c);
    const mini = {};
    scope.forEach(c => { mini[c] = { pts: 0, gd: 0 }; });
    for (const ca of scope) for (const cb of scope) {
      if (ca === cb) continue;
      const r = h2h[ca][cb];
      if (r) { mini[ca].pts += r.pts; mini[ca].gd += r.gd; }
    }
    const sorted = [...block].sort((a, b) => {
      const mA = mini[a.c], mB = mini[b.c];
      if (mA.pts !== mB.pts) return mB.pts - mA.pts;
      if (mA.gd  !== mB.gd)  return mB.gd  - mA.gd;
      if (sc[a.c] !== sc[b.c]) return sc[b.c] - sc[a.c];
      if (fp[a.c] !== fp[b.c]) return fp[b.c] - fp[a.c]; // v2.25: fair-play (fewer cards up)
      return rating(b) - rating(a);
    });
    const out = [];
    let i = 0;
    while (i < sorted.length) {
      let j = i + 1;
      while (j < sorted.length
        && mini[sorted[i].c].pts === mini[sorted[j].c].pts
        && mini[sorted[i].c].gd  === mini[sorted[j].c].gd) j++;
      if (j - i === 1) out.push(sorted[i]);
      else if (j - i === block.length) { for (let k = i; k < sorted.length; k++) out.push(sorted[k]); break; }
      else out.push(...resolveFast(sorted.slice(i, j)));
      i = j;
    }
    return out;
  };
  const byPts = [...teams].sort((a, b) => pts[b.c] - pts[a.c]);
  const standings = [];
  let bi = 0;
  while (bi < byPts.length) {
    let bj = bi + 1;
    while (bj < byPts.length && pts[byPts[bj].c] === pts[byPts[bi].c]) bj++;
    if (bj - bi === 1) standings.push(byPts[bi]);
    else resolveFast(byPts.slice(bi, bj)).forEach(t => standings.push(t));
    bi = bj;
  }
  return standings.map(x => ({...x, pts: pts[x.c], sc: sc[x.c]}));
}

function assignThirds(availableGroups) {
  const key = [...availableGroups].sort().join("");
  const v = FIFA_THIRD_LOOKUP[key];
  if (!v) {
    console.error("FIFA lookup miss for key:", key);
    return {};
  }
  const SLOTS = [74, 77, 79, 80, 81, 82, 85, 87];
  const assignment = {};
  for (let i = 0; i < 8; i++) assignment[SLOTS[i]] = v[i];
  return assignment;
}

function simulateDetailed() {
  const gr = {}, grMatches = {};
  GROUPS.forEach(g => {
    const result = simGroupDetailed(getGroup(g));
    gr[g] = result.standings;
    grMatches[g] = result.matches;
  });
  const allThirds = GROUPS.map(g => ({...gr[g][2], group: g}));
  allThirds.sort((a,b) =>
    b.Pts - a.Pts ||
    b.GD - a.GD ||
    b.GF - a.GF ||
    rating(b) - rating(a)
  );
  const top8 = allThirds.slice(0, 8);
  const top8Groups = top8.map(x => x.group);
  const thirdAsg = assignThirds(top8Groups);

  const M = {};
  const focusMatches = { r32: null, r16: null, qf: null, sf: null, f: null };
  const m = (n, t1, t2, stage) => {
    const r = simMatchDetailed(t1, t2, stage);
    M[n] = r;
    if (t1.c === FOCUS || t2.c === FOCUS) focusMatches[stage] = r;
  };

  // R32 (matches 73-88)
  m(73, gr.A[1], gr.B[1], 'r32');
  m(74, gr.E[0], gr[thirdAsg[74]][2], 'r32');
  m(75, gr.F[0], gr.C[1], 'r32');
  m(76, gr.C[0], gr.F[1], 'r32');
  m(77, gr.I[0], gr[thirdAsg[77]][2], 'r32');
  m(78, gr.E[1], gr.I[1], 'r32');
  m(79, gr.A[0], gr[thirdAsg[79]][2], 'r32');
  m(80, gr.L[0], gr[thirdAsg[80]][2], 'r32');
  m(81, gr.D[0], gr[thirdAsg[81]][2], 'r32');
  m(82, gr.G[0], gr[thirdAsg[82]][2], 'r32');
  m(83, gr.K[1], gr.L[1], 'r32');
  m(84, gr.H[0], gr.J[1], 'r32');
  m(85, gr.B[0], gr[thirdAsg[85]][2], 'r32');
  m(86, gr.J[0], gr.H[1], 'r32');
  m(87, gr.K[0], gr[thirdAsg[87]][2], 'r32');
  m(88, gr.D[1], gr.G[1], 'r32');

  // R16
  [[89,74,77],[90,73,75],[91,76,78],[92,79,80],[93,83,84],[94,81,82],[95,86,88],[96,85,87]]
    .forEach(([n,a,b]) => m(n, M[a].winner, M[b].winner, 'r16'));
  // QF
  [[97,89,90],[98,93,94],[99,91,92],[100,95,96]]
    .forEach(([n,a,b]) => m(n, M[a].winner, M[b].winner, 'qf'));
  // SF
  m(101, M[97].winner, M[98].winner, 'sf');
  m(102, M[99].winner, M[100].winner, 'sf');

  const l101 = M[101].winner === M[101].t1 ? M[101].t2 : M[101].t1;
  const l102 = M[102].winner === M[102].t1 ? M[102].t2 : M[102].t1;
  const r3rd = simMatchDetailed(l101, l102, 'f');
  M['3rd'] = r3rd;
  const rFinal = simMatchDetailed(M[101].winner, M[102].winner, 'f');
  M['final'] = rFinal;
  if (rFinal.t1.c === FOCUS || rFinal.t2.c === FOCUS) focusMatches.f = rFinal;

  return { gr, grMatches, top8Groups, thirdAsg, M, focusMatches };
}

function focusResult(sim) {
  const inR = (n) => { const x = sim.M[n]; return x && (x.t1.c === FOCUS || x.t2.c === FOCUS) ? x : null; };
  const adv = (m) => m && m.winner.c === FOCUS;

  let cur = null;
  for (let n = 73; n <= 88; n++) { if (inR(n)) { cur = inR(n); break; } }
  if (!cur) return 'final_gs';
  if (!adv(cur)) return 'final_r32';
  for (let n = 89; n <= 96; n++) { const x = inR(n); if (x) { cur = x; break; } }
  if (!adv(cur)) return 'final_r16';
  for (let n = 97; n <= 100; n++) { const x = inR(n); if (x) { cur = x; break; } }
  if (!adv(cur)) return 'final_qf';
  for (let n = 101; n <= 102; n++) { const x = inR(n); if (x) { cur = x; break; } }
  if (!adv(cur)) return sim.M['3rd'].winner.c === FOCUS ? 'final_3rd' : 'final_4th';
  return sim.M['final'].winner.c === FOCUS ? 'final_1st' : 'final_2nd';
}

  // --- public API ---
  global.JE = {
    setSeed: setSeed,
    config: function (o) {
      o = o || {};
      if (o.ratingMode !== undefined) RATING_MODE = o.ratingMode;
      if (o.homeAdvOn !== undefined) HOME_ADVANTAGE_ON = o.homeAdvOn;
      if (o.focus !== undefined) FOCUS = o.focus;
      if (o.teams) TEAMS = o.teams;
      if (o.fifaThirdLookup) FIFA_THIRD_LOOKUP = o.fifaThirdLookup;
      if (o.realResults) REAL_RESULTS = o.realResults;
      if (o.flagHtml) flagHtml = o.flagHtml;
    },
    simMatch: function (t1, t2, stage) { return simMatch(t1, t2, stage); },
    simMatchDetailed: function (t1, t2, stage) { return simMatchDetailed(t1, t2, stage); },
    simGroup: function (ts) { return simGroup(ts); },
    simulateDetailed: function () { return simulateDetailed(); },
    focusResult: function (sim) { return focusResult(sim); },
    computeLambdas: function (t1, t2, stage) { return computeLambdas(t1, t2, stage); },
    getGroup: function (g) { return getGroup(g); },
    get ratingMode() { return RATING_MODE; },
    get teams() { return TEAMS; },
  };
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
