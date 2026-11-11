import "server-only";
import { dictionary } from "cmu-pronouncing-dictionary";
import { spellOutNumbers } from "@/domain/shadowing/scoring";

const PHONES: Record<string, string> = {
  AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ", B: "b", CH: "tʃ", D: "d", DH: "ð", EH: "ɛ", ER: "ɝ",
  EY: "eɪ", F: "f", G: "ɡ", HH: "h", IH: "ɪ", IY: "i", JH: "dʒ", K: "k", L: "l", M: "m", N: "n", NG: "ŋ", OW: "oʊ",
  OY: "ɔɪ", P: "p", R: "ɹ", S: "s", SH: "ʃ", T: "t", TH: "θ", UH: "ʊ", UW: "u", V: "v", W: "w", Y: "j", Z: "z", ZH: "ʒ",
};
/** Consonant pairs that can open a syllable, so the stress mark goes before both. */
const ONSETS = new Set([
  "pl", "pɹ", "bl", "bɹ", "tɹ", "dɹ", "kl", "kɹ", "kw", "ɡl", "ɡɹ", "fl", "fɹ", "θɹ", "ʃɹ", "sp", "st", "sk", "sm", "sn", "sl", "sw", "tw", "dw",
]);

type Phone = { ipa: string; vowel: boolean; stress: number };

function arpabetToIpa(arpabet: string): string {
  const phones: Phone[] = arpabet.split(" ").map((p) => {
    const m = /^([A-Z]+)([012])?$/.exec(p);
    const base = m?.[1] ?? p;
    const stress = m?.[2] === undefined ? -1 : Number(m[2]);
    let ipa = PHONES[base] ?? "";
    if (base === "AH" && stress === 0) ipa = "ə";
    if (base === "ER" && stress === 0) ipa = "ɚ";
    return { ipa, vowel: stress >= 0, stress };
  });
  const syllables = phones.filter((p) => p.vowel).length;
  const marks = new Map<number, string>();
  if (syllables > 1) {
    phones.forEach((p, i) => {
      if (p.stress !== 1 && p.stress !== 2) return;
      let at = i;
      const prevVowel = phones.slice(0, i).some((q) => q.vowel);
      if (!prevVowel) at = 0;
      else if (i >= 1 && !phones[i - 1].vowel) {
        at = i - 1;
        if (i >= 2 && !phones[i - 2].vowel && ONSETS.has(phones[i - 2].ipa + phones[i - 1].ipa)) at = i - 2;
      }
      marks.set(at, p.stress === 1 ? "ˈ" : "ˌ");
    });
  }
  return phones.map((p, i) => (marks.get(i) ?? "") + p.ipa).join("");
}

function lookup(word: string): string | null {
  const w = word.toLowerCase();
  if (dictionary[w]) return arpabetToIpa(dictionary[w]);
  const possessive = /^(.+)'s$/.exec(w);
  if (possessive && dictionary[possessive[1]]) {
    const base = arpabetToIpa(dictionary[possessive[1]]);
    return base + (/[szʃʒ]$|tʃ$|dʒ$/.test(base) ? "ɪz" : /[ptkfθ]$/.test(base) ? "s" : "z");
  }
  return null;
}

function wordIpa(raw: string): string {
  const word = raw.replace(/[’‘`´]/g, "'").replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "").replace(/^'+|'+$/g, "");
  if (!word) return "";
  const direct = lookup(word);
  if (direct) return direct;
  if (/[-–—]/.test(word)) return word.split(/[-–—]+/).map(wordIpa).filter(Boolean).join(" ");
  return word.toLowerCase();
}

/** Broad American IPA from CMUdict; words the dictionary lacks are kept as written. */
export function sentenceIpa(sentence: string): string {
  const words = spellOutNumbers(sentence).split(/\s+/).map(wordIpa).filter(Boolean);
  return words.length ? `/${words.join(" ")}/` : "";
}
