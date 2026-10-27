import { describe, expect, it } from "vitest";
import { findProfanity, maskWord } from "./profanity";

const flagged = (text: string) => findProfanity(text).length > 0;

describe("profanity guard", () => {
  it("blocks English abuse, including common evasions", () => {
    for (const text of [
      "this is fucking useless", "what the FUCK", "you are a bitch", "shit service", "total bullshit",
      "f u c k this", "f.u.c.k", "fuuuuuck", "sh1t", "@ss hole", "what an asshole", "stupid bastard",
    ]) expect(flagged(text), text).toBe(true);
  });

  it("blocks Malayalam script abuse", () => {
    for (const text of ["നീ ഒരു തെണ്ടി ആണ്", "മൈരന്മാർ", "പൂറി മോനെ", "നായിന്റെ മോൻ", "കഴുവേറി", "പുലയാടി"]) {
      expect(flagged(text), text).toBe(true);
    }
  });

  it("blocks Manglish (Malayalam in English letters)", () => {
    for (const text of ["myre", "nee oru thendi aanu", "thayoli", "poori mone", "pulayadimone", "Kazhuveri", "naayinte mone"]) {
      expect(flagged(text), text).toBe(true);
    }
  });

  it("does not flag ordinary complaints (no Scunthorpe problem)", () => {
    for (const text of [
      "The classroom projector is broken and the assignment portal is down.",
      "Please assess the glass doors, the bass speakers and the compass at the Scunthorpe block.",
      "Room 455 and block A55 have no water. Cocktail party noise at night.",
      "The canteen poori was stale and the shiitake soup was cold.",
      "Mayor visited the campus; Myra from class 3 saw it.",
      "അടുക്കളയിൽ വെള്ളമില്ല, ക്ലാസ് മുറിയിൽ ഫാൻ പ്രവർത്തിക്കുന്നില്ല, പൂർണ്ണമായി നശിച്ചു.",
      "The hostel warden was rude and the food is terrible!",
    ]) expect(findProfanity(text), text).toEqual([]);
  });

  it("blocks the college's extended English list", () => {
    for (const text of [
      "you are an idiot", "so stupid", "what a fool", "that moron", "dumbass", "this is crap", "damn this place",
      "shithead", "dickhead", "fuck you", "shut the fuck up", "go to hell", "pussy", "cock", "cunt", "dick",
    ]) expect(flagged(text), text).toBe(true);
  });

  it("blocks the college's Malayalam + Manglish list", () => {
    for (const text of [
      "മൈരൻ", "മൈരേ", "പൂറൻ", "പൂറ്", "പൂറി", "തായോളി മോൻ", "കൂത്തിച്ചി", "കുണ്ണ", "കുണ്ണേ", "ഊമ്പൻ", "ഊമ്പി", "തേവിടിശ്ശി", "പൂറിമോൻ",
      "നീ പട്ടി", "നീ ഒരു പന്നി", "നായിന്റെ മോൻ",
      "myran", "mairan", "mayran", "myre", "maire", "mayre", "pooran mone", "nee pooran", "thayoli", "thaayoli", "thayoli mon",
      "koothichi", "koothichii", "kunna", "kunne", "kunna mon", "oomban", "umban", "oombi", "umbi", "thevidishi", "thevidichi",
      "naayinte mon", "nayinte mon", "nee patti", "ni oru panni", "nee poori", "poorimon", "purimon",
    ]) expect(flagged(text), text).toBe(true);
  });

  it("keeps ordinary words that look similar usable", () => {
    for (const text of [
      "The food quality is poor and the service is poor.", "The poori was stale at breakfast.", "Stray patti near the hostel gate.",
      "ക്യാമ്പസിൽ തെരുവ് പട്ടികൾ കൂടുതലാണ്.", "Pur ... the wifi is slow", "Puri is a city in Odisha.",
    ]) expect(findProfanity(text), text).toEqual([]);
  });

  it("masks words for display", () => {
    expect(maskWord("fuck")).toBe("f***");
  });
});
