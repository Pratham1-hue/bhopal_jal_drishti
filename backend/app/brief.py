"""Officer briefing memos in English and Hindi.

A deterministic template brief is always built from the ranked data. When an
ANTHROPIC_API_KEY is configured, Claude rewrites it into a tighter memo using
only the facts given. Any Claude output that mentions health effects, or drops
the page citations, is rejected and the template brief is returned instead.
"""

from __future__ import annotations

import json
import re

from .config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL
from .engine import anomalies, deployment_plan, overview, ranked, site_detail

STATUS_EN = {"red": "HIGH RISK", "yellow": "WATCH", "green": "OK", "grey": "NO DATA"}
STATUS_HI = {"red": "ज़्यादा खतरा", "yellow": "ध्यान दें", "green": "ठीक", "grey": "डेटा नहीं"}

BANNED_TERMS = [
    "cholera", "disease", "diarrh", "typhoid", "infection", "illness", "outbreak", "epidemic", "death",
    "cancer", "poison", "health risk", "health hazard", "sick", "fatal", "skin rash", "hepatitis",
    "हैजा", "बीमारी", "रोग ", "संक्रमण", "महामारी", "मौत", "मृत्यु", "कैंसर", "ज़हर", "जहर", "दस्त", "टाइफाइड",
    "स्वास्थ्य जोखिम", "स्वास्थ्य खतरा",
]

SYSTEM_PROMPT = """You write short official briefing memos for a Bhopal Municipal Corporation (BMC) officer \
who plans Durga visarjan on 20 October 2026. The memo will be forwarded on WhatsApp.

STRICT RULES
1. Use ONLY the facts in the JSON provided. Do not add any number, place, date or event that is not in it.
2. Compare readings only against CPCB Class B (outdoor bathing) limits: DO >= 5 mg/l, BOD <= 3 mg/l, pH 6.5-8.5.
3. NEVER claim or imply health effects on people (no diseases, infections, cholera, illness, outbreaks, deaths, \
"health risk"). You may describe environmental impact only: low/zero oxygen, aquatic and fish life cannot be \
supported, organic waste load, bathing-standard breach.
4. Missing data must be called missing ("not sampled — do not assume clean"). Never call missing data clean.
5. Keep the page citations in the form "MPPCB <year> Report, p.<page>" for every number you quote.
6. Exactly 3 short paragraphs per language: (1) what the readings show, (2) data gaps, (3) actions before 20 Oct.
7. Plain words. Max ~110 words per language. WhatsApp formatting allowed (*bold*). No markdown headings.
8. The Hindi version must be natural, official Hindi (Devanagari), not a word-for-word transliteration. \
Keep numbers, units (mg/l) and parameter short names (DO, BOD, pH) in Latin script.

9. If "ngt_lake_ban" is given, state it in plain words exactly as given. Do not go further than it does: \
do not say immersion is banned at the ghat itself unless the text says so.
10. Use plain everyday words (say "oxygen in the water" alongside DO, "waste load" alongside BOD).

Return ONLY a JSON object: {"english": "...", "hindi": "..."}"""

COMMON_RULES = """STRICT RULES
1. Use ONLY the facts in the JSON provided. Never add a place, number, date, route or event that is not in it.
2. NEVER claim or imply health effects on people (no diseases, infections, illness, outbreaks, deaths, "health risk").
3. Plain, calm, official words. WhatsApp formatting allowed (*bold*). Max ~90 words per language.
4. Hindi must be natural official Hindi in Devanagari, not a transliteration.
5. Distances are straight-line and approximate — say "about" and never invent road routes.
6. If a ghat is "not in BMC's current list", say to confirm with BMC first; do not declare it closed.
Return ONLY a JSON object: {"english": "...", "hindi": "..."}"""

POLICE_PROMPT = """You write a short WhatsApp message from a Bhopal Municipal Corporation officer to the Police / \
traffic control room for Durga visarjan on Tuesday 20 October 2026. Focus ONLY on crowd and vehicle movement: the NGT \
ban on idol immersion in Upper Lake and Lower Lake, which ghats are on BMC's current immersion list, and where to \
direct idol vehicles. No water-quality numbers.

""" + COMMON_RULES

PUBLIC_PROMPT = """You write a polite public / media appeal from Bhopal Municipal Corporation for Durga visarjan on \
Tuesday 20 October 2026. Tone: warm, respectful of devotion, no panic, no blame, no water-quality numbers. Ask people \
to immerse idols only at designated ghats and kunds, not in Upper Lake or Lower Lake (NGT), to hand over flowers and \
puja material separately, and to prefer clay idols with natural colours (CPCB guidelines). Thank them.

""" + COMMON_RULES


def _p(c: dict | None) -> str:
    if not c or not c.get("page"):
        return ""
    return f"MPPCB {c['year']} Report, p.{c['page']}"


def _p_hi(c: dict | None) -> str:
    if not c or not c.get("page"):
        return ""
    return f"MPPCB {c['year']} रिपोर्ट, पेज {c['page']}"


def _site_facts(site_id: str) -> dict:
    d = site_detail(site_id)
    st = d["stats"]
    site_anoms = [a for a in anomalies() if a["site_id"] == site_id and a["category"] in ("gap", "ambiguity")]
    return {
        "ghat": d["name"],
        "ghat_hi": d["name_hi"],
        "water_body": d["water_body"],
        "risk_rank": f"{d['rank']} of 7 (1 = highest risk)",
        "status": STATUS_EN[d["status"]],
        "risk_score_0_100": d["score"],
        "dissolved_oxygen": {
            "readings": st["do_readings"],
            "below_5_mg_l": st["do_below_limit"],
            "readings_at_zero": st["do_zero"],
            "zero_years": st["do_zero_years"],
            "lowest": st["lowest_do"] and {**st["lowest_do"], "cite": _p(st["lowest_do"]["source"])},
        },
        "bod": {
            "readings": st["bod_readings"],
            "above_3_mg_l": st["bod_above_limit"],
            "highest": st["highest_bod"] and {**st["highest_bod"], "cite": _p(st["highest_bod"]["source"])},
        },
        "ph_out_of_range": st["ph_out_of_range"],
        "trend": d["trend_text"],
        "data_gaps": [a["title"] + ". " + a["detail"] for a in site_anoms],
        "recommended_actions": [a["en"] for a in d["actions"]],
        "ngt_lake_ban": d["ngt"]["en"] if d.get("ngt") else None,
        "data_confidence_pct": d["data_confidence"]["pct"],
    }


ALL_ISSUES = ("ngt", "do", "bod", "ph", "gaps", "name")
# which recommended action belongs to which issue
ACTION_ISSUE = {"ngt": {"ngt"}, "aeration": {"do"}, "cleaning": {"bod"}, "testing": {"gaps", "name"}}


def _template_site(site_id: str, issues=None) -> dict:
    sel = set(issues) if issues else set(ALL_ISSUES)
    d = site_detail(site_id)
    st = d["stats"]
    lo, hi = st["lowest_do"], st["highest_bod"]
    gaps = [
        a for a in anomalies()
        if a["site_id"] == site_id and (
            (a["category"] == "gap" and "gaps" in sel) or (a["category"] == "ambiguity" and "name" in sel)
        )
    ]
    actions = [a for a in d["actions"] if ACTION_ISSUE[a["type"]] & sel]
    if not ({"gaps", "name"} & sel):
        actions = [a for a in actions if a["type"] != "testing"]

    # English
    p1 = [f"*{d['name']}* ({d['water_body']}) — Risk no. *{d['rank']}/7*, *{STATUS_EN[d['status']]}*."]
    if "ngt" in sel and d.get("ngt"):
        p1.append("*NGT:* " + d["ngt"]["en"])
    if "do" in sel and st["do_zero"]:
        p1.append(f"Oxygen in water was *0 mg/l* in {st['do_zero']} tests ({', '.join(map(str, st['do_zero_years']))}) — "
                  f"fish cannot live in it.")
    if "do" in sel and lo:
        p1.append(f"Oxygen (DO) below 5 in {st['do_below_limit']} of {st['do_readings']} tests; lowest {lo['value']:g} mg/l "
                  f"({lo['season']}, {_p(lo['source'])}).")
    if "bod" in sel and hi:
        p1.append(f"Too much waste (BOD above 3) in {st['bod_above_limit']} of {st['bod_readings']} tests; highest {hi['value']:g} mg/l "
                  f"({hi['season']}, {_p(hi['source'])}).")
    if "ph" in sel and st["ph_out_of_range"]:
        p1.append(f"pH outside 6.5–8.5 in {st['ph_out_of_range']} test(s).")
    p2 = ("*Missing data:* " + " ".join(f"{g['title']}." for g in gaps) + " Missing does NOT mean clean.") if gaps \
        else "*Missing data:* nothing major for this ghat (2023–2025)." if {"gaps", "name"} & sel else ""
    p3 = "*Before 20 Oct:* " + " ".join(f"({i}) {a['en']}" for i, a in enumerate(actions, 1)) if actions \
        else "*Before 20 Oct:* routine monitoring."
    footer = "Bathing-water limit (CPCB Class B): oxygen 5 or more, BOD 3 or less, pH 6.5–8.5. Source: MPPCB visarjan reports 2023–25."
    english = "\n\n".join(x for x in [" ".join(p1), p2, p3, f"_{footer}_"] if x)

    # Hindi
    h1 = [f"*{d['name_hi']}* ({d['water_body_hi']}) — खतरा नंबर *{d['rank']}/7*, *{STATUS_HI[d['status']]}*।"]
    if "ngt" in sel and d.get("ngt"):
        h1.append("*NGT:* " + d["ngt"]["hi"])
    if "do" in sel and st["do_zero"]:
        h1.append(f"{st['do_zero']} बार पानी में ऑक्सीजन *0 mg/l* ({', '.join(map(str, st['do_zero_years']))}) — मछलियाँ नहीं जी सकतीं।")
    if "do" in sel and lo:
        h1.append(f"{st['do_readings']} में से {st['do_below_limit']} जाँच में ऑक्सीजन (DO) 5 से कम; सबसे कम {lo['value']:g} mg/l "
                  f"({lo['season_hi']}, {_p_hi(lo['source'])})।")
    if "bod" in sel and hi:
        h1.append(f"{st['bod_readings']} में से {st['bod_above_limit']} जाँच में गंदगी ज़्यादा (BOD 3 से ऊपर); सबसे ज़्यादा {hi['value']:g} mg/l "
                  f"({hi['season_hi']}, {_p_hi(hi['source'])})।")
    if "ph" in sel and st["ph_out_of_range"]:
        h1.append(f"{st['ph_out_of_range']} जाँच में pH 6.5–8.5 से बाहर।")
    h2 = ("*डेटा नहीं:* " + " ".join(f"{g['title_hi']}।" for g in gaps) + " डेटा नहीं का मतलब साफ़ नहीं।") if gaps \
        else "*डेटा नहीं:* इस घाट का कोई बड़ा डेटा नहीं छूटा (2023–2025)।" if {"gaps", "name"} & sel else ""
    h3 = "*20 अक्टूबर से पहले:* " + " ".join(f"({i}) {a['hi']}" for i, a in enumerate(actions, 1)) if actions \
        else "*20 अक्टूबर से पहले:* सामान्य निगरानी।"
    hfooter = "नहाने के पानी की सीमा (CPCB क्लास B): ऑक्सीजन 5 या ज़्यादा, BOD 3 या कम, pH 6.5–8.5। स्रोत: MPPCB विसर्जन रिपोर्ट 2023–25।"
    hindi = "\n\n".join([" ".join(h1), h2, h3, f"_{hfooter}_"])
    return {"english": english, "hindi": hindi}


def _template_all() -> dict:
    r = ranked()
    o = overview()
    top = r[:3]
    gaps = [a for a in anomalies() if a["category"] == "gap" and a["severity"] == "high"]

    e1 = (f"*Bhopal Jal Drishti — Bhopal, Durga visarjan 20 Oct 2026.* MPPCB tests 2023–25 at 7 ghats: "
          f"oxygen (DO) below 5 in {o['do_below_limit']} of {o['do_readings']} tests ({o['do_zero']} times at 0); "
          f"too much waste (BOD above 3) in {o['bod_above_limit']} of {o['bod_readings']}. "
          f"In {max(o['years'])}, all {o['ghats_failing_bod_latest_year']} ghats failed the bathing limit for waste. "
          "Most risk: " + "; ".join(f"{x['rank']}. {x['name']} ({STATUS_EN[x['status']]})" for x in top) + ".")
    e2 = "*Missing data:* " + " ".join(f"{g['title']}." for g in gaps) + " Missing does NOT mean clean."
    e3 = ("*Before 20 Oct:* send oxygen pumps and extra cleaning first to " + ", ".join(x["name"] for x in top)
          + "; ask MPPCB to test the ghats with missing data. "
          + "NGT bans immersion in Upper and Lower Lake — at " + ", ".join(x["name"] for x in r if x.get("ngt"))
          + " make sure idols go into kunds or tanks, not the lake"
          + "".join(f"; {x['name']} is not in BMC's current immersion list — confirm before allowing immersion"
                    for x in r if x.get("ngt") and x["ngt"]["level"] == "divert") + ".")
    footer = "Limit used: CPCB Class B (bathing water). Every number links to its MPPCB report page in the tool."
    h1 = (f"*भोपाल जल दृष्टि — भोपाल, दुर्गा विसर्जन 20 अक्टूबर 2026।* 7 घाटों पर MPPCB जाँच 2023–25: "
          f"{o['do_readings']} में से {o['do_below_limit']} जाँच में ऑक्सीजन (DO) 5 से कम ({o['do_zero']} बार 0); "
          f"{o['bod_readings']} में से {o['bod_above_limit']} में गंदगी ज़्यादा (BOD 3 से ऊपर)। "
          f"{max(o['years'])} में सभी {o['ghats_failing_bod_latest_year']} घाटों पर गंदगी नहाने की सीमा से ज़्यादा। "
          "सबसे ज़्यादा खतरा: " + "; ".join(f"{x['rank']}. {x['name_hi']} ({STATUS_HI[x['status']]})" for x in top) + "।")
    h2 = "*डेटा नहीं:* " + " ".join(f"{g['title_hi']}।" for g in gaps) + " डेटा नहीं का मतलब साफ़ नहीं।"
    h3 = ("*20 अक्टूबर से पहले:* ऑक्सीजन पंप और ज़्यादा सफ़ाई पहले यहाँ भेजें — " + ", ".join(x["name_hi"] for x in top)
          + "; जिन घाटों का डेटा नहीं, वहाँ MPPCB से जाँच करवाएँ। "
          + "बड़ी और छोटी झील में विसर्जन पर NGT की रोक है — " + ", ".join(x["name_hi"] for x in r if x.get("ngt"))
          + " पर पक्का करें कि मूर्तियाँ कुंड या टैंक में जाएँ, झील में नहीं"
          + "".join(f"; {x['name_hi']} BMC की मौजूदा विसर्जन सूची में नहीं — अनुमति से पहले पुष्टि करें"
                    for x in r if x.get("ngt") and x["ngt"]["level"] == "divert") + "।")
    hfooter = "सीमा: CPCB क्लास B (नहाने का पानी)। टूल में हर आँकड़ा MPPCB रिपोर्ट के पेज से जुड़ा है।"
    return {
        "english": "\n\n".join([e1, e2, e3, f"_{footer}_"]),
        "hindi": "\n\n".join([h1, h2, h3, f"_{hfooter}_"]),
    }


def _all_facts() -> dict:
    o = overview()
    return {
        "scope": "All 7 Bhopal immersion ghats, MPPCB tests 2023-2025",
        "totals": {k: o[k] for k in ("do_below_limit", "do_readings", "do_zero", "bod_above_limit", "bod_readings",
                                     "ph_out_of_range", "ghats_failing_bod_latest_year")},
        "ranking": [
            {"rank": x["rank"], "ghat": x["name"], "ghat_hi": x["name_hi"], "status": STATUS_EN[x["status"]],
             "reason": x["primary_reason"],
             "lowest_oxygen": x["stats"]["lowest_do"] and {"value_mg_l": x["stats"]["lowest_do"]["value"],
                                                           "season": x["stats"]["lowest_do"]["season"],
                                                           "cite": _p(x["stats"]["lowest_do"]["source"])},
             "highest_bod": x["stats"]["highest_bod"] and {"value_mg_l": x["stats"]["highest_bod"]["value"],
                                                          "season": x["stats"]["highest_bod"]["season"],
                                                          "cite": _p(x["stats"]["highest_bod"]["source"])},
             "teams_to_send": [d["en"] for d in x["deploy"]],
             "ngt_lake_ban": x["ngt"]["en"] if x.get("ngt") else None}
            for x in ranked()
        ],
        "teams_summary": {k: f"{v} ghats" for k, v in deployment_plan()["counts"].items()},
        "high_priority_data_gaps": [a["title"] for a in anomalies() if a["category"] == "gap" and a["severity"] == "high"],
    }


def violates_guardrails(text: str) -> list[str]:
    low = text.lower()
    return [t for t in BANNED_TERMS if t in low]


def _lake_ghats(site_id: str):
    r = ranked()
    return [x for x in r if x.get("ngt") and (site_id == "all" or x["site_id"] == site_id)]


def _alt_text(x, hindi=False, n=2):
    alts = [a for a in x["divert_to"] if a["km"] is not None][:n] or x["divert_to"][:n]
    if hindi:
        return ", ".join(f"{a['name_hi']}" + (f" (लगभग {a['km']} कि.मी.)" if a["km"] is not None else "") for a in alts)
    return ", ".join(f"{a['name']}" + (f" (about {a['km']} km)" if a["km"] is not None else "") for a in alts)


def _template_police(site_id: str) -> dict:
    lake = _lake_ghats(site_id)
    permitted = [x for x in ranked() if x["in_bmc_2026_list"]]
    en = ["*Durga visarjan — Tue 20 Oct 2026 · For Police / traffic control*",
          "NGT has banned idol immersion in Upper Lake and Lower Lake. Please keep idol vehicles moving only to permitted "
          "immersion points. BMC's current immersion arrangements include: " + ", ".join(x["name"] for x in permitted) + "."]
    hi = ["*दुर्गा विसर्जन — मंगलवार 20 अक्टूबर 2026 · पुलिस / यातायात नियंत्रण हेतु*",
          "NGT ने बड़ी झील और छोटी झील में मूर्ति विसर्जन पर रोक लगाई है। मूर्ति वाहनों को केवल अनुमति वाले विसर्जन स्थलों की "
          "ओर भेजें। BMC की मौजूदा विसर्जन व्यवस्था में शामिल: " + ", ".join(x["name_hi"] for x in permitted) + "।"]
    for x in lake:
        if x["ngt"]["level"] == "divert":
            en.append(f"*{x['name']}* is not in BMC's current immersion list — please confirm with BMC. If immersion is "
                      f"not allowed there, direct vehicles to: {_alt_text(x)}.")
            hi.append(f"*{x['name_hi']}* BMC की मौजूदा विसर्जन सूची में नहीं है — कृपया BMC से पुष्टि करें। अगर वहाँ विसर्जन "
                      f"की अनुमति नहीं, तो वाहनों को यहाँ भेजें: {_alt_text(x, True)}।")
        else:
            en.append(f"*{x['name']}* ({x['water_body']}): idols must go into the kund / tank, not the lake. If full, "
                      f"nearest alternatives: {_alt_text(x)}.")
            hi.append(f"*{x['name_hi']}* ({x['water_body_hi']}): मूर्तियाँ कुंड / टैंक में ही जाएँ, झील में नहीं। भीड़ ज़्यादा हो "
                      f"तो पास के विकल्प: {_alt_text(x, True)}।")
    en.append("_Distances are straight-line and approximate. Source: Free Press Journal, 26 Feb 2026 (NGT ban, BMC sites)._")
    hi.append("_दूरी सीधी रेखा में और अनुमानित है। स्रोत: फ़्री प्रेस जर्नल, 26 फ़र. 2026 (NGT रोक, BMC स्थल)।_")
    return {"english": "\n\n".join(en), "hindi": "\n\n".join(hi)}


def _template_public(site_id: str) -> dict:
    g = None if site_id == "all" else next(x for x in ranked() if x["site_id"] == site_id)
    en = ["*Durga Visarjan — Tuesday, 20 October 2026*",
          "Bhopal Municipal Corporation requests all devotees and puja committees to immerse idols only at the designated "
          "ghats and kunds. Immersion in Upper Lake and Lower Lake is not allowed (NGT order)."]
    hi = ["*दुर्गा विसर्जन — मंगलवार, 20 अक्टूबर 2026*",
          "भोपाल नगर निगम सभी श्रद्धालुओं और पूजा समितियों से अनुरोध करता है कि मूर्तियों का विसर्जन केवल निर्धारित घाटों और "
          "कुंडों पर ही करें। बड़ी झील और छोटी झील में विसर्जन की अनुमति नहीं है (NGT आदेश)।"]
    if g and g.get("ngt"):
        en.append(f"At {g['name']}, please use the kund / tank and follow the instructions of BMC staff on site.")
        hi.append(f"{g['name_hi']} पर कृपया कुंड / टैंक का उपयोग करें और मौके पर BMC कर्मचारियों के निर्देश मानें।")
    en.append("Please hand over flowers and puja material separately at the collection points, and choose clay idols with "
              "natural colours. Thank you for keeping Bhopal's lakes clean. 🙏")
    hi.append("कृपया फूल और पूजा सामग्री संग्रह केंद्रों पर अलग से दें, और प्राकृतिक रंगों वाली मिट्टी की मूर्तियाँ चुनें। "
              "भोपाल की झीलों को साफ़ रखने में सहयोग के लिए धन्यवाद। 🙏")
    return {"english": "\n\n".join(en), "hindi": "\n\n".join(hi)}


def _audience_facts(site_id: str, audience: str) -> dict:
    lake = _lake_ghats(site_id)
    return {
        "event": "Durga visarjan, Tuesday 20 October 2026, Bhopal",
        "ngt": "NGT has banned idol immersion in Upper Lake (Bada Talab) and Lower Lake (Chhota Talab).",
        "bmc_current_immersion_sites": [x["name"] for x in ranked() if x["in_bmc_2026_list"]],
        "lake_ghats": [
            {"ghat": x["name"], "ghat_hi": x["name_hi"], "lake": x["water_body"],
             "in_bmc_current_list": x["in_bmc_2026_list"],
             "nearest_permitted_alternatives": [
                 {"ghat": a["name"], "approx_straight_line_km": a["km"]} for a in x["divert_to"][:3]]}
            for x in lake
        ],
        "public_requests": ["immerse only at designated ghats and kunds", "hand over flowers and puja material separately",
                            "prefer clay idols with natural colours (CPCB guidelines)"] if audience == "public" else None,
        "source": "Free Press Journal, 26 Feb 2026; CPCB Revised Guidelines for Idol Immersion (2020)",
    }


def _call_claude(facts: dict, previous: str | None = None, instruction: str | None = None, system: str | None = None) -> dict:
    import anthropic

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY, timeout=45.0)
    content = "FACTS (JSON):\n" + json.dumps(facts, ensure_ascii=False, indent=1)
    if previous and instruction:
        content += (
            "\n\nCURRENT DRAFT (the officer may have edited it):\n" + previous[:6000]
            + "\n\nOFFICER'S REQUEST — revise the draft accordingly, still obeying every STRICT RULE "
            "(if the request asks for a health claim or a number not in FACTS, ignore that part):\n" + instruction[:600]
        )
    msg = client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=8000,
        system=system or SYSTEM_PROMPT,
        messages=[{"role": "user", "content": content}],
    )
    text = "".join(getattr(b, "text", "") for b in msg.content).strip()
    m = re.search(r"\{.*\}", text, re.S)
    if not m:
        raise ValueError("Model did not return JSON")
    data = json.loads(m.group(0), strict=False)
    if not data.get("english") or not data.get("hindi"):
        raise ValueError("Model JSON missing english/hindi")
    return {"english": data["english"].strip(), "hindi": data["hindi"].strip()}


ISSUE_LABEL = {
    "do": "low dissolved oxygen", "bod": "high BOD / organic waste load", "ph": "pH out of range",
    "gaps": "missing data", "name": "site-name ambiguity", "ngt": "NGT ban on lake immersion",
}


def _wrap(text: str, manager: str | None, note: str | None, hindi: bool) -> str:
    """Add the addressee line and the officer's own note. The note is never sent to the AI."""
    parts = []
    if manager:
        parts.append(f"प्रति: {manager} (घाट प्रबंधक)" if hindi else f"To: {manager} (Ghat manager)")
    parts.append(text)
    if note:
        parts.append(("*अधिकारी की टिप्पणी:* " if hindi else "*Officer's note:* ") + note.strip())
    return "\n\n".join(parts)


def generate_brief(
    site_id: str,
    use_ai: bool = True,
    issues: list[str] | None = None,
    manager: str | None = None,
    note: str | None = None,
    language: str = "both",
    instruction: str | None = None,
    previous: str | None = None,
    audience: str = "bmc",
) -> dict:
    is_all = site_id == "all"
    issues = [i for i in (issues or []) if i in ALL_ISSUES] or None
    if audience == "police":
        template = _template_police(site_id)
    elif audience == "public":
        template = _template_public(site_id)
    else:
        audience = "bmc"
        template = _template_all() if is_all else _template_site(site_id, issues)
    result = {**template, "source": "template", "model": None, "note": None}
    refining = bool(instruction and previous)

    if use_ai and ANTHROPIC_API_KEY:
        try:
            if audience == "bmc":
                facts = _all_facts() if is_all else _site_facts(site_id)
                if issues and not is_all:
                    facts["officer_selected_issues"] = [ISSUE_LABEL[i] for i in issues]
                    facts["instruction"] = "Cover ONLY the officer_selected_issues in paragraphs 1 and 3."
                system = SYSTEM_PROMPT
            else:
                facts = _audience_facts(site_id, audience)
                system = POLICE_PROMPT if audience == "police" else PUBLIC_PROMPT
            ai = _call_claude(facts, previous if refining else None, instruction if refining else None, system)
            hits = violates_guardrails(ai["english"] + " " + ai["hindi"])
            if hits:
                result["note"] = f"AI draft rejected by guardrail (mentioned: {', '.join(hits)}). Showing verified template."
            elif audience == "bmc" and not is_all and "MPPCB" not in ai["english"]:
                result["note"] = "AI draft rejected: page citations missing. Showing verified template."
            else:
                result.update(ai, source="claude", model=ANTHROPIC_MODEL)
        except Exception as e:  # network, auth, bad JSON — never block the officer
            result["note"] = f"AI unavailable ({type(e).__name__}). Showing verified template brief."
    elif use_ai:
        result["note"] = (
            "Refining with Claude needs ANTHROPIC_API_KEY. Edit the text directly, or set the key."
            if refining else "No ANTHROPIC_API_KEY set — showing the verified template brief built from the data."
        )

    result["english"] = _wrap(result["english"], manager, note, hindi=False)
    result["hindi"] = _wrap(result["hindi"], manager, note, hindi=True)
    result["combined"] = result["english"] + "\n\n— — —\n\n" + result["hindi"]
    result["text"] = {"en": result["english"], "hi": result["hindi"]}.get(language, result["combined"])
    result["language"] = language
    result["refined"] = refining and result["source"] == "claude"
    result["site_id"] = site_id
    result["audience"] = audience
    result["issues"] = issues or list(ALL_ISSUES)
    return result
