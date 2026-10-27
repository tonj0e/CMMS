/**
 * Content guard: detects abusive language in English, Malayalam script and Manglish (Malayalam typed in English letters).
 * Used by the browser (instant feedback) and the server (enforcement), so it must stay dependency-free.
 *
 * Design notes
 * - Latin words are matched as whole words, so "class", "assignment" and "Scunthorpe" are fine.
 * - Common evasions are normalised: "f u c k", "f.u.c.k", "fuuuuck", "sh1t", "@ss", upper/lower case, accents.
 * - Milder insults (idiot, stupid, damn) are deliberately NOT listed: complaints are often angry, and over-blocking
 *   would stop genuine reports. Extend the lists below if the college wants a stricter policy.
 */

// Whole-word patterns, matched against lower-cased Latin text.
const LATIN_PATTERNS: string[] = [
  // English
  "f+u+c+k+(?:ing|ed|er|ers|s|in)?",
  "f+u+k+(?:ing|ed|er|ers|s)?",
  "fck(?:ing|ed|er|s)?",
  "ph+u+c?k+(?:ing|ed|er|s)?",
  "motherf\\w*",
  "sh+i+t+(?:s|ty|head|heads|ting|hole)?",
  "bullsh+i+t+",
  "bi+t+ch+(?:es|y|ing)?",
  "bastards?",
  "ass+holes?",
  "arse+holes?",
  "ass",
  "arse",
  "dumb+ass(?:es)?",
  "jack+ass(?:es)?",
  "di+c+k+(?:head|heads|s)?",
  "co+c+k+(?:s|sucker|suckers)?",
  "cu+n+t+s?",
  "slu+t+(?:s|ty)?",
  "wh+o+re+s?",
  "pu+ss+y+",
  "wanke+r+s?",
  "bollocks",
  "pric+ks?",
  "douche(?:bag|bags)?",
  "twats?",
  "nig+(?:a|er|ers|as|ga|gas|ger|gers)",
  "fag+(?:ot|ots|s)?",
  "retard(?:ed|s)?",
  "stup+i+d+(?:ly|ity)?",
  "idiots?",
  "fools?",
  "morons?",
  "crap+(?:py)?",
  "(?:god)?damn(?:ed|it)?",
  "go to hell",
  // Manglish (Malayalam in Latin letters)
  "m(?:y|ay|ai)i?r(?:u|e|ey|an)",
  "th(?:a|aa)y(?:y)?o+li+",
  "th(?:e|ee)nd(?:i|a|ikal|ikalu)",
  "ku+nn?(?:a|an|e|ayi)",
  "pul(?:a|aa)y(?:a|aa)di(?:mone|monne|mon)?",
  "kazhu+veri(?:mone|monne|mon)?",
  "p(?:oo?|u)ri+ ?mon+e?",
  "n(?:a|aa)yinte ?(?:mone|monne|makane|mon)",
  "koo+thi+(?:chi+)?",
  "oo+mb(?:u|i|an|ikko|iko)",
  "umb(?:an|i)",
  "th(?:e|ee)vidi(?:shi|chi|ssi|ssi)",
  "pu+nda+(?:chi|mone|monne)?",
  "than+thayilla+(?:tha|thavan)?",
  // Words that are also ordinary vocabulary (patti = dog, panni = pig, poori/puri = bread, poor = English).
  // They are only blocked when aimed at a person ("nee patti", "ni oru panni"), so "poor quality", "poori was stale"
  // and complaints about stray dogs still go through.
  "(?:nee|ni|ninte|ninne|ningal) +(?:oru +)?(?:patti|panni|poori|puri|pooran|puran|poor|pur)",
  "(?:pooran|puran) ?(?:mone|monne|mon)",
];

// Malayalam script: no word boundaries exist, so these distinctive stems are matched anywhere in the text.
const MALAYALAM_TERMS: string[] = [
  // Root stems: Malayalam adds many suffixes (മൈരൻ, മൈരന്മാർ, മൈരേ ...), so match the stem.
  "മൈര", "മൈര്", "മയിര",  "മയിര്",
  "പൂറ്", "പൂറി", "പൂറൻ", "പൂറന്",
  "തായോളി", "തയോളി",
  "തെണ്ടി", "തെണ്ടിക്കൊടി",
  "കുണ്ണ", "കുണ്ണയ്", "കുണ്ണൻ",
  "പുലയാടി", "പുലയാടിമോൻ", "പുലയാടിച്ചി",
  "കഴുവേറി", "കഴുവേറിമോൻ", "കഴുവേറിടെ",
  "നായിന്റെ മോൻ", "നായിൻ്റെ മോൻ", "നായിന്റെ മോനെ", "നായിന്റെമോൻ",
  "കൂത്തിച്ചി", "കൂത്തി",
  "ഊമ്പ്", "ഊമ്പി", "ഊമ്പിക്കോ", "ഊമ്പൻ",
  "തേവിടിശ്ശി", "തേവിടിശി",
  "പുണ്ട", "പുണ്ടച്ചി", "പുണ്ടമോൻ",
  "തന്തയില്ലാത്ത", "തന്തയില്ലാ",
];

const MALAYALAM_CONTEXT = /(?:നീ|നിന്റെ|നിൻ്റെ|നിങ്ങൾ)\s*(?:ഒരു\s*)?(?:പട്ടി|പന്നി|പൂറി)/;

const LATIN_REGEX = new RegExp(`(?<![a-z])(?:${LATIN_PATTERNS.join("|")})(?![a-z])`, "g");

const LEET: Record<string, string> = { "@": "a", "$": "s", "!": "i", "+": "t", "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" };

/** Map look-alike symbols/digits to letters inside a single token. Digits only change tokens that already contain 2+ letters, so room codes like "A55" or "Room 455" are left alone. */
function deLeet(token: string): string {
  const letters = (token.match(/[a-z]/g) ?? []).length;
  return token.replace(/[@$!+013457]/g, (ch, index: number) => {
    const isDigit = ch >= "0" && ch <= "9";
    if (isDigit) return letters >= 2 ? LEET[ch] : ch;
    // Leave a symbol at the very end alone: "shit!" is punctuation, not a letter.
    return index === token.length - 1 ? ch : LEET[ch];
  });
}

function latinVariants(text: string): string[] {
  const base = text.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
  const leet = base.replace(/\S+/g, deLeet);
  // "f u c k" / "f.u.c.k": join runs of single letters that are separated by spaces or punctuation.
  const joined = leet.replace(/(?<![a-z])([a-z])[\s._*-]+(?=[a-z](?![a-z]))/g, "$1");
  return [leet, joined, leet.replace(/([a-z])\1{2,}/g, "$1")];
}

/** Returns the distinct offending words found in `text` (empty array = clean). */
export function findProfanity(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();

  for (const variant of latinVariants(text)) {
    const regex = new RegExp(LATIN_REGEX.source, "g");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(variant)) !== null) found.add(match[0].trim());
  }

  const malayalam = text.normalize("NFC").replace(/[‌‍]/g, "");
  for (const term of MALAYALAM_TERMS) {
    if (malayalam.includes(term)) found.add(term);
  }

  const contextual = MALAYALAM_CONTEXT.exec(malayalam);
  if (contextual) found.add(contextual[0]);

  return Array.from(found);
}

/** "fuck" -> "f***": lets the UI name the problem without reprinting the word in full. */
export function maskWord(word: string): string {
  const chars = Array.from(word);
  return chars.length <= 1 ? word : chars[0] + "*".repeat(Math.min(chars.length - 1, 6));
}

export const PROFANITY_MESSAGE =
  "Your message contains abusive language, so it can't be submitted. Please rewrite it politely and try again.";
