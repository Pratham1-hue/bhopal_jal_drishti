"""Risk ranking, receipts and anomaly detection for the 7 Bhopal ghats.

Everything here is deterministic and traceable: every number returned carries
the report year and PDF page it came from.
"""

from __future__ import annotations

from collections import defaultdict
from functools import lru_cache

import numpy as np
import pandas as pd

from .config import REPORT_PDFS, RESOURCES_DIR
from .data import (
    FESTIVALS,
    PARAM_META,
    PARAM_ORDER,
    PHASES,
    SITE_BY_ID,
    SITES,
    class_b_limits,
    load_locations,
    load_readings,
)

# ---------------------------------------------------------------- weights
# Recent years and the Durga festival matter most for the 20 Oct 2026 plan.
YEAR_WEIGHT_BY_AGE = {0: 1.0, 1: 0.7, 2: 0.5}
FESTIVAL_WEIGHT = {"Durga": 1.0, "Ganesh": 0.8}
COMPONENT_WEIGHTS = {
    "do_deficit": 0.40,   # how far DO falls below 5 mg/l, on average
    "bod_excess": 0.30,   # how far BOD rises above 3 mg/l, on average
    "worst_do": 0.15,     # the single worst DO in the last two years
    "immersion_impact": 0.10,  # does water get worse during / after immersion?
    "ph_out": 0.05,       # share of pH readings outside 6.5-8.5
}
RED_SCORE = 40
YELLOW_SCORE = 15
NEAR_FRACTION = 0.2  # within 20 % of a limit counts as "near threshold"

PHASE_HI = {"pre": "विसर्जन से पहले", "during": "विसर्जन के दौरान", "after": "एक हफ़्ते बाद"}
PHASE_EN = {"pre": "before immersion", "during": "during immersion", "after": "one week after"}
FEST_HI = {"Ganesh": "गणेश", "Durga": "दुर्गा"}


def limits():
    return class_b_limits()


# ---------------------------------------------------------------- helpers
def cite(year: int, page) -> dict:
    page = None if page is None or pd.isna(page) else int(page)
    meta = REPORT_PDFS.get(int(year), {})
    has_local = bool(meta) and (RESOURCES_DIR / meta["file"]).exists()
    return {
        "year": int(year),
        "page": page,
        "report": meta.get("title", f"MPPCB {year} report"),
        "label": f"MPPCB {year} Report, Page {page}" if page else f"MPPCB {year} Report",
        "label_hi": f"MPPCB {year} रिपोर्ट, पेज {page}" if page else f"MPPCB {year} रिपोर्ट",
        "pdf_url": (f"/api/pdf/{year}" if has_local else meta.get("url")) + (f"#page={page}" if page else "")
        if meta
        else None,
        "public_url": meta.get("url"),
    }


def fmt(x) -> str:
    if x is None or (isinstance(x, float) and np.isnan(x)):
        return "—"
    return f"{x:g}"


def cell_status(parameter: str, num, kind: str) -> str:
    """4-colour traffic light per reading. 'neutral' = parameter has no Class B limit."""
    if kind == "missing":
        return "grey"
    lim = limits()
    if kind == "bdl":
        return "green" if parameter in lim else "bdl"
    if parameter == "Dissolved oxygen":
        mn = lim[parameter]["min"]
        if num < mn:
            return "red"
        return "yellow" if num < mn * (1 + NEAR_FRACTION) else "green"
    if parameter == "BOD":
        mx = lim[parameter]["max"]
        if num > mx:
            return "red"
        return "yellow" if num > mx * (1 - NEAR_FRACTION) else "green"
    if parameter == "pH":
        lo, hi = lim["pH"]["min"], lim["pH"]["max"]
        if num < lo or num > hi:
            return "red"
        return "yellow" if (num < lo + 0.2 or num > hi - 0.2) else "green"
    return "neutral"


def _weights(df: pd.DataFrame, latest_year: int) -> pd.Series:
    age = latest_year - df["year"]
    yw = age.map(lambda a: YEAR_WEIGHT_BY_AGE.get(int(a), 0.4))
    fw = df["festival"].map(FESTIVAL_WEIGHT)
    return yw * fw


def _wmean(values: pd.Series, weights: pd.Series) -> float:
    m = values.notna()
    if not m.any() or weights[m].sum() == 0:
        return 0.0
    return float((values[m] * weights[m]).sum() / weights[m].sum())


def _season_label(year, festival) -> str:
    return f"{festival} {year}"


def _season_label_hi(year, festival) -> str:
    return f"{FEST_HI.get(festival, festival)} {year}"


# ---------------------------------------------------------------- core
@lru_cache(maxsize=1)
def _all_years() -> list[int]:
    return sorted(load_readings()["year"].unique().tolist())


def expected_seasons() -> list[tuple[int, str]]:
    return [(y, f) for y in _all_years() for f in FESTIVALS]


def _site_df(site_id: str) -> pd.DataFrame:
    df = load_readings()
    return df[df["site_id"] == site_id].copy()


def _reading_dict(r) -> dict:
    status = cell_status(r["parameter"], r["num"], r["kind"])
    return {
        "year": int(r["year"]),
        "festival": r["festival"],
        "phase": r["phase"],
        "parameter": r["parameter"],
        "value": None if r["kind"] != "value" else float(r["num"]),
        "value_as_printed": r["value_as_printed"] if r["value_as_printed"] != "" else "(blank)",
        "kind": r["kind"],
        "flag": r["flag"] or None,
        "unit": r["unit"],
        "status": status,
        "source": cite(r["year"], r["source_page"]),
    }


def _immersion_impact(sdf: pd.DataFrame) -> tuple[float, list[dict]]:
    """Share of festival seasons where DO fell >= 1 mg/l or BOD rose >= 50 % after the pre reading."""
    events = []
    for (year, fest), g in sdf.groupby(["year", "festival"]):
        def val(param, phase):
            x = g[(g["parameter"] == param) & (g["phase"] == phase) & (g["kind"] == "value")]["num"]
            return float(x.iloc[0]) if len(x) else np.nan

        do_pre, bod_pre = val("Dissolved oxygen", "pre"), val("BOD", "pre")
        do_post = np.nanmin([val("Dissolved oxygen", "during"), val("Dissolved oxygen", "after"), np.inf])
        bod_post = np.nanmax([val("BOD", "during"), val("BOD", "after"), -np.inf])
        comparable = (not np.isnan(do_pre) and np.isfinite(do_post)) or (
            not np.isnan(bod_pre) and np.isfinite(bod_post)
        )
        if not comparable:
            continue
        worse = False
        if not np.isnan(do_pre) and np.isfinite(do_post) and do_post <= do_pre - 1:
            worse = True
        if not np.isnan(bod_pre) and np.isfinite(bod_post) and bod_pre > 0 and bod_post >= bod_pre * 1.5:
            worse = True
        events.append({"year": int(year), "festival": fest, "worse": worse})
    if not events:
        return 0.0, events
    return sum(e["worse"] for e in events) / len(events), events


def _season_strip(sdf: pd.DataFrame) -> list[dict]:
    strip = []
    for year, fest in expected_seasons():
        g = sdf[(sdf["year"] == year) & (sdf["festival"] == fest)]
        key = g[g["parameter"].isin(["Dissolved oxygen", "BOD", "pH"])]
        if g.empty:
            strip.append({"year": year, "festival": fest, "status": "grey", "table_missing": True,
                          "phases_sampled": [], "page": None})
            continue
        statuses = [cell_status(r.parameter, r.num, r.kind) for r in key.itertuples()]
        known = [s for s in statuses if s != "grey"]
        if not known:
            status = "grey"
        elif "red" in known:
            status = "red"
        elif "yellow" in known:
            status = "yellow"
        else:
            status = "green"
        sampled = [p for p in PHASES if (g[(g["phase"] == p)]["kind"] != "missing").any()]
        pages = sorted(set(int(p) for p in g["source_page"].dropna()))
        strip.append({
            "year": year, "festival": fest, "status": status, "table_missing": False,
            "phases_sampled": sampled, "partial": len(sampled) < 3, "page": pages[0] if pages else None,
            "source": cite(year, pages[0] if pages else None),
        })
    return strip


def _years_text(years) -> str:
    ys = sorted(set(years))
    if len(ys) == 1:
        return str(ys[0])
    return ", ".join(str(y) for y in ys[:-1]) + " & " + str(ys[-1])


def _years_text_hi(years) -> str:
    ys = sorted(set(years))
    if len(ys) == 1:
        return str(ys[0])
    return ", ".join(str(y) for y in ys[:-1]) + " और " + str(ys[-1])


@lru_cache(maxsize=16)
def site_summary(site_id: str) -> dict:
    site = SITE_BY_ID[site_id]
    sdf = _site_df(site_id)
    latest = max(_all_years())
    lim = limits()
    do_min, bod_max = lim["Dissolved oxygen"]["min"], lim["BOD"]["max"]
    ph_lo, ph_hi = lim["pH"]["min"], lim["pH"]["max"]

    do = sdf[(sdf["parameter"] == "Dissolved oxygen") & (sdf["kind"] == "value")].copy()
    bod = sdf[(sdf["parameter"] == "BOD") & (sdf["kind"] != "missing")].copy()
    ph = sdf[(sdf["parameter"] == "pH") & (sdf["kind"] == "value")].copy()

    # --- components (each 0..1)
    do_def = _wmean(((do_min - do["num"]) / do_min).clip(0, 1), _weights(do, latest)) if len(do) else 0.0
    bod_exc = _wmean(((bod["num"] - bod_max) / (bod_max * 3)).clip(0, 1), _weights(bod, latest)) if len(bod) else 0.0
    recent_do = do[do["year"] >= latest - 1]
    worst_do_val = float(recent_do["num"].min()) if len(recent_do) else np.nan
    worst_do = 0.0 if np.isnan(worst_do_val) else float(np.clip((do_min - worst_do_val) / do_min, 0, 1))
    ph_out_mask = (ph["num"] < ph_lo) | (ph["num"] > ph_hi)
    ph_out = _wmean(ph_out_mask.astype(float), _weights(ph, latest)) if len(ph) else 0.0
    impact, impact_events = _immersion_impact(sdf)

    components = {
        "do_deficit": do_def,
        "bod_excess": bod_exc,
        "worst_do": worst_do,
        "immersion_impact": impact,
        "ph_out": ph_out,
    }
    score = round(100 * sum(COMPONENT_WEIGHTS[k] * v for k, v in components.items()), 1)

    # --- facts
    do_fail = do[do["num"] < do_min]
    do_zero = do[do["num"] == 0]
    bod_fail = bod[(bod["kind"] == "value") & (bod["num"] > bod_max)]
    ph_fail = ph[ph_out_mask]
    lowest = do.loc[do["num"].idxmin()] if len(do) else None
    highest_bod = bod.loc[bod["num"].idxmax()] if len(bod) else None

    def ref(row):
        return {
            "value": float(row["num"]),
            "season": _season_label(row["year"], row["festival"]),
            "season_hi": _season_label_hi(row["year"], row["festival"]),
            "phase": row["phase"],
            "source": cite(row["year"], row["source_page"]),
        }

    strip = _season_strip(sdf)
    missing_seasons = [s for s in strip if s["table_missing"]]
    partial_seasons = [s for s in strip if not s["table_missing"] and s.get("partial")]

    # Coverage of the three Class B parameters across every expected season x phase
    expected_cells = len(expected_seasons()) * 3 * 3
    got_cells = int(sdf[sdf["parameter"].isin(["Dissolved oxygen", "BOD", "pH"]) & (sdf["kind"] != "missing")].shape[0])
    coverage = round(100 * got_cells / expected_cells) if expected_cells else 0

    # Data confidence: of all readings we should have (13 tests x every festival x 3 times), how many exist?
    expected_all = len(PARAM_ORDER) * len(expected_seasons()) * 3
    found_all = int((sdf["kind"] != "missing").sum())
    conf_pct = round(100 * found_all / expected_all) if expected_all else 0
    confidence = {
        "pct": conf_pct,
        "level": "high" if conf_pct >= 90 else "medium" if conf_pct >= 75 else "low",
        "found": found_all,
        "expected": expected_all,
        "missing_tables": len(missing_seasons),
        "missing_readings": expected_all - found_all,
    }

    # Before -> during -> after for the most recent festival that has a table (for sparklines)
    def _phase_trend(year, fest):
        g = sdf[(sdf["year"] == year) & (sdf["festival"] == fest)]
        out = {"year": int(year), "festival": fest, "do": [], "bod": []}
        for key, p in (("do", "Dissolved oxygen"), ("bod", "BOD")):
            for ph in PHASES:
                c = g[(g["parameter"] == p) & (g["phase"] == ph)]
                if len(c) and c.iloc[0]["kind"] != "missing":
                    out[key].append({"phase": ph, "value": float(c.iloc[0]["num"]) if c.iloc[0]["kind"] == "value" else 0.0,
                                     "printed": c.iloc[0]["value_as_printed"]})
                else:
                    out[key].append({"phase": ph, "value": None, "printed": None})
        page = g["source_page"].dropna()
        out["source"] = cite(year, int(page.iloc[0]) if len(page) else None)
        return out

    phase_trends = [_phase_trend(s["year"], s["festival"]) for s in strip if not s["table_missing"]]
    latest_trend = phase_trends[-1] if phase_trends else None
    latest_full = next((p for p in reversed(phase_trends) if all(x["value"] is not None for x in p["do"])), None)

    # NGT: immersion in Upper and Lower Lake is banned. Facts only from the cited news report.
    ngt = None
    if site["ngt_lake"]:
        lake_hi = "बड़ी झील" if site["water_body"] == "Upper Lake" else "छोटी झील"
        if site["in_bmc_2026_list"]:
            ngt = {
                "level": "check",
                "en": f"On {site['water_body']}: NGT has banned idol immersion in {site['water_body']}. BMC lists this "
                      f"ghat in its current immersion arrangements — make sure idols go into the kund or tank, not the lake.",
                "hi": f"{lake_hi} पर: NGT ने {lake_hi} में मूर्ति विसर्जन पर रोक लगाई है। BMC की मौजूदा विसर्जन व्यवस्था में यह "
                      f"घाट शामिल है — पक्का करें कि मूर्तियाँ कुंड या टैंक में जाएँ, झील में नहीं।",
            }
        else:
            ngt = {
                "level": "divert",
                "en": f"On {site['water_body']}: NGT has banned idol immersion in {site['water_body']}, and this ghat is NOT in "
                      f"BMC's current list of immersion sites. Confirm with BMC — if immersion is not allowed, send people "
                      f"to the permitted ghats.",
                "hi": f"{lake_hi} पर: NGT ने {lake_hi} में मूर्ति विसर्जन पर रोक लगाई है, और यह घाट BMC की मौजूदा विसर्जन "
                      f"सूची में नहीं है। BMC से पुष्टि करें — अगर विसर्जन की अनुमति नहीं, तो लोगों को अनुमति वाले घाटों पर भेजें।",
            }
        ngt["source"] = {
            "label": "Free Press Journal, 26 Feb 2026",
            "url": "https://www.freepressjournal.in/amp/bhopal/mp-news-idol-immersion-to-shift-from-lakes-to-safer-sites-ngt-ban-pushes-bmc-to-build-4-dedicated-ghats",
        }

    # --- plain-words reasons (EN + HI), most severe first
    reasons_en, reasons_hi = [], []
    if len(do_zero):
        reasons_en.append(
            f"Oxygen in the water fell to 0 mg/l in {len(do_zero)} test{'s' if len(do_zero) > 1 else ''} "
            f"({_years_text(do_zero['year'])}) — fish cannot live in it."
        )
        reasons_hi.append(
            f"{_years_text_hi(do_zero['year'])} में {len(do_zero)} बार पानी में ऑक्सीजन 0 mg/l हो गई — मछलियाँ नहीं जी सकतीं।"
        )
    if len(do):
        if len(do_fail):
            reasons_en.append(
                f"Oxygen below 5 in {len(do_fail)} of {len(do)} tests; lowest {fmt(lowest['num'])} mg/l "
                f"({_season_label(lowest['year'], lowest['festival'])})."
            )
            reasons_hi.append(
                f"{len(do)} में से {len(do_fail)} जाँच में ऑक्सीजन 5 से कम; सबसे कम {fmt(lowest['num'])} mg/l "
                f"({_season_label_hi(lowest['year'], lowest['festival'])})।"
            )
    n_bod_num = int((bod["kind"] == "value").sum() + (bod["kind"] == "bdl").sum())
    if n_bod_num:
        reasons_en.append(
            f"Too much waste (BOD above 3) in {len(bod_fail)} of {n_bod_num} tests; highest {fmt(highest_bod['num'])} mg/l "
            f"({_season_label(highest_bod['year'], highest_bod['festival'])}) — "
            f"{highest_bod['num'] / bod_max:.1f} times the limit."
        )
        reasons_hi.append(
            f"{n_bod_num} में से {len(bod_fail)} जाँच में गंदगी ज़्यादा (BOD 3 से ऊपर); सबसे ज़्यादा {fmt(highest_bod['num'])} mg/l "
            f"({_season_label_hi(highest_bod['year'], highest_bod['festival'])}) — सीमा का {highest_bod['num'] / bod_max:.1f} गुना।"
        )
    if len(ph_fail):
        vals = ", ".join(fmt(v) for v in ph_fail["num"])
        reasons_en.append(f"pH outside 6.5–8.5 in {len(ph_fail)} test(s): {vals}.")
        reasons_hi.append(f"{len(ph_fail)} जाँच में pH 6.5–8.5 से बाहर: {vals}।")
    if missing_seasons:
        labels = ", ".join(_season_label(s["year"], s["festival"]) for s in missing_seasons)
        labels_hi = ", ".join(_season_label_hi(s["year"], s["festival"]) for s in missing_seasons)
        reasons_en.append(f"No {labels} test in the MPPCB report — unknown, do not assume clean.")
        reasons_hi.append(f"MPPCB रिपोर्ट में {labels_hi} की जाँच नहीं — पता नहीं, साफ़ न मानें।")
    if len(do) and not len(do_fail):
        reasons_en.append(f"Oxygen was fine (5 or more) in all {len(do)} tests.")
        reasons_hi.append(f"सभी {len(do)} जाँच में ऑक्सीजन ठीक रही (5 या ज़्यादा)।")

    # --- traffic light for the ghat
    recent_fail = (
        len(do_fail[do_fail["year"] >= latest - 1]) + len(bod_fail[bod_fail["year"] >= latest - 1])
        + len(ph_fail[ph_fail["year"] >= latest - 1])
    )
    any_fail = len(do_fail) + len(bod_fail) + len(ph_fail)
    severe_do = (not np.isnan(worst_do_val)) and worst_do_val < 3
    if score >= RED_SCORE or severe_do:
        status = "red"
    elif any_fail and (score >= YELLOW_SCORE or recent_fail):
        status = "yellow"
    elif got_cells == 0:
        status = "grey"
    else:
        status = "green"

    # --- resource allocation engine: which of the officer's 3 teams to send, and why.
    # Every rule uses CPCB limits from data/cpcb_water_quality_criteria.csv; every item carries its evidence page.
    # Recent = the latest two report years. The officer decides; the tool only suggests.
    deploy = []
    recent = sdf[sdf["year"] >= latest - 1]

    def evidence(row, label_en, label_hi):
        return {
            "label": label_en, "label_hi": label_hi, "value": float(row["num"]),
            "season": _season_label(row["year"], row["festival"]), "season_hi": _season_label_hi(row["year"], row["festival"]),
            "phase": row["phase"], "source": cite(row["year"], row["source_page"]),
        }

    # 1. Aeration — low dissolved oxygen
    rdo = recent[(recent["parameter"] == "Dissolved oxygen") & (recent["kind"] == "value")]
    if len(rdo) and rdo["num"].min() < do_min:
        w = rdo.loc[rdo["num"].idxmin()]
        n_low = int((rdo["num"] < do_min).sum())
        urgent = w["num"] < 4  # below CPCB class C / D minimum (4 mg/l): water cannot support fish & wildlife
        deploy.append({
            "type": "aeration",
            "level": "deploy" if urgent else "standby",
            "priority": "high" if urgent else "medium",
            "rule": "Oxygen below 4 mg/l → deploy pumps (CPCB fish & wildlife limit); 4–5 mg/l → keep pumps on standby (bathing limit 5)",
            "rule_hi": "ऑक्सीजन 4 mg/l से कम → पंप लगाएँ (CPCB मछली व वन्यजीव सीमा); 4–5 → पंप तैयार रखें (नहाने की सीमा 5)",
            "en": (f"Deploy oxygen pumps (aerators) — oxygen fell to {fmt(w['num'])} mg/l ({_season_label(w['year'], w['festival'])}); "
                   f"below 5 in {n_low} recent test(s).") if urgent else
                  (f"Keep oxygen pumps on standby — oxygen {fmt(w['num'])} mg/l ({_season_label(w['year'], w['festival'])}), "
                   f"just under the bathing limit of 5."),
            "hi": (f"ऑक्सीजन पंप (एरेटर) लगाएँ — ऑक्सीजन {fmt(w['num'])} mg/l तक गिरी ({_season_label_hi(w['year'], w['festival'])}); "
                   f"हाल की {n_low} जाँच में 5 से कम।") if urgent else
                  (f"ऑक्सीजन पंप तैयार रखें — ऑक्सीजन {fmt(w['num'])} mg/l ({_season_label_hi(w['year'], w['festival'])}), "
                   f"नहाने की सीमा 5 से थोड़ी कम।"),
            "evidence": [evidence(w, "Lowest oxygen", "सबसे कम ऑक्सीजन")],
        })

    # 2. Extra cleaning — organic waste load (BOD)
    rbod = recent[(recent["parameter"] == "BOD") & (recent["kind"] == "value")]
    if len(rbod) and rbod["num"].max() > bod_max:
        w = rbod.loc[rbod["num"].idxmax()]
        urgent = w["num"] > 2 * bod_max
        rose = [e for e in impact_events if e["worse"] and e["year"] >= latest - 1]
        rose_en = f" Water got worse after immersion in {len(rose)} recent festival(s)." if rose else ""
        rose_hi = f" हाल के {len(rose)} त्योहारों में विसर्जन के बाद पानी बिगड़ा।" if rose else ""
        deploy.append({
            "type": "cleaning",
            "level": "deploy",
            "priority": "high" if urgent else "medium",
            "rule": "Waste load (BOD) above 3 mg/l → extra cleaning; above 6 (double the limit) → urgent",
            "rule_hi": "गंदगी (BOD) 3 mg/l से ज़्यादा → ज़्यादा सफ़ाई; 6 से ज़्यादा (सीमा का दोगुना) → तुरंत",
            "en": (f"Send extra cleaning staff — waste (BOD) reached {fmt(w['num'])} mg/l, {w['num'] / bod_max:.1f} times the limit "
                   f"({_season_label(w['year'], w['festival'])}). Collect flowers and offerings separately and clean up after "
                   f"immersion (CPCB 2020).{rose_en}"),
            "hi": (f"ज़्यादा सफ़ाई कर्मचारी भेजें — गंदगी (BOD) {fmt(w['num'])} mg/l, सीमा का {w['num'] / bod_max:.1f} गुना "
                   f"({_season_label_hi(w['year'], w['festival'])})। फूल व पूजा सामग्री अलग इकट्ठा करें और विसर्जन के बाद सफ़ाई "
                   f"करें (CPCB 2020)।{rose_hi}"),
            "evidence": [evidence(w, "Highest waste (BOD)", "सबसे ज़्यादा गंदगी (BOD)")],
        })

    # 3. Water testing — where we are blind
    gaps_recent = [s for s in missing_seasons + partial_seasons if s["year"] >= latest - 1]
    if gaps_recent or confidence["level"] == "low":
        labels = ", ".join(_season_label(s["year"], s["festival"]) for s in gaps_recent) or "several tests"
        labels_hi = ", ".join(_season_label_hi(s["year"], s["festival"]) for s in gaps_recent) or "कई जाँच"
        deploy.append({
            "type": "testing",
            "level": "today",
            "priority": "high",
            "rule": "Missing table or untested phase in the last 2 years, or data confidence below 75% → send testing team today",
            "rule_hi": "पिछले 2 साल में तालिका नहीं या कोई चरण बिना जाँच, या डेटा भरोसा 75% से कम → आज ही जाँच टीम भेजें",
            "en": f"Dispatch a water-testing team today, and test again during and after immersion — no data for {labels} "
                  f"(data confidence {confidence['pct']}%).",
            "hi": f"आज ही पानी जाँच टीम भेजें, और विसर्जन के दौरान व बाद फिर जाँच करें — {labels_hi} का डेटा नहीं "
                  f"(डेटा भरोसा {confidence['pct']}%)।",
            "evidence": [{"label": "Missing", "label_hi": "डेटा नहीं", "value": None, "season": s["festival"] + " " + str(s["year"]),
                          "season_hi": _season_label_hi(s["year"], s["festival"]), "phase": None,
                          "source": cite(s["year"], s.get("page"))} for s in gaps_recent],
        })
    if site["confidence"] != "high":
        deploy.append({
            "type": "testing",
            "level": "check",
            "priority": "medium",
            "rule": "Site name matches two places in the reports → confirm where the sample is taken",
            "rule_hi": "रिपोर्ट में नाम दो जगहों से मेल खाता है → पक्का करें नमूना कहाँ से लिया जाता है",
            "en": "Ask MPPCB where the sample was taken — the Ganesh and Durga tests may be from two different places.",
            "hi": "MPPCB से पूछें कि नमूना कहाँ से लिया — गणेश और दुर्गा की जाँच दो अलग जगहों की हो सकती है।",
            "evidence": [],
        })

    # 4. NGT — lake ghats
    if ngt:
        divert = ngt["level"] == "divert"
        deploy.insert(0, {
            "type": "ngt",
            "level": "divert" if divert else "check",
            "priority": "high",
            "rule": "Ghat on Upper / Lower Lake → NGT ban on lake immersion applies (Free Press Journal, 26 Feb 2026)",
            "rule_hi": "घाट बड़ी / छोटी झील पर → झील में विसर्जन पर NGT रोक लागू (फ़्री प्रेस जर्नल, 26 फ़र. 2026)",
            "en": ("Confirm with BMC whether immersion is allowed here; if not, put up signs and send people to the "
                   "permitted ghats listed below.") if divert else
                  f"Check that idols go into the kund / tank, not the lake — NGT ban on immersion in {site['water_body']}.",
            "hi": ("BMC से पुष्टि करें कि यहाँ विसर्जन की अनुमति है या नहीं; नहीं तो बोर्ड लगाएँ और लोगों को नीचे दिए "
                   "अनुमति वाले घाटों पर भेजें।") if divert else
                  "पक्का करें कि मूर्तियाँ कुंड / टैंक में जाएँ, झील में नहीं — झील में विसर्जन पर NGT की रोक।",
            "evidence": [],
        })

    actions = [{k: d[k] for k in ("type", "priority", "en", "hi", "level")} for d in deploy]

    return {
        "site_id": site_id,
        "name": site["name"],
        "name_hi": site["name_hi"],
        "water_body": site["water_body"],
        "water_body_hi": site["water_body_hi"],
        "site_match_confidence": site["confidence"],
        "score": score,
        "components": {k: round(v, 3) for k, v in components.items()},
        "component_weights": COMPONENT_WEIGHTS,
        "status": status,
        "primary_reason": reasons_en[0] if reasons_en else "No readings available.",
        "primary_reason_hi": reasons_hi[0] if reasons_hi else "कोई रीडिंग उपलब्ध नहीं।",
        "reasons": reasons_en,
        "reasons_hi": reasons_hi,
        "stats": {
            "do_readings": int(len(do)),
            "do_below_limit": int(len(do_fail)),
            "do_zero": int(len(do_zero)),
            "do_zero_years": sorted(set(int(y) for y in do_zero["year"])),
            "bod_readings": n_bod_num,
            "bod_above_limit": int(len(bod_fail)),
            "ph_readings": int(len(ph)),
            "ph_out_of_range": int(len(ph_fail)),
            "class_b_violations": int(any_fail),
            "lowest_do": ref(lowest) if lowest is not None else None,
            "highest_bod": ref(highest_bod) if highest_bod is not None else None,
            "worst_recent_do": None if np.isnan(worst_do_val) else worst_do_val,
        },
        "coverage_pct": coverage,
        "data_confidence": confidence,
        "phase_trend": latest_trend,
        "phase_trend_full": latest_full,
        "phase_trends": phase_trends,
        "ngt": ngt,
        "in_bmc_2026_list": site["in_bmc_2026_list"],
        "season_strip": strip,
        "missing_seasons": [_season_label(s["year"], s["festival"]) for s in missing_seasons],
        "partial_seasons": [_season_label(s["year"], s["festival"]) for s in partial_seasons],
        "has_blind_spot": bool(missing_seasons or partial_seasons),
        "immersion_events": impact_events,
        "deploy": deploy,
        "actions": actions,
    }


def _km(a, b) -> float:
    from math import asin, cos, radians, sin, sqrt
    lat1, lon1, lat2, lon2 = map(radians, (a["lat"], a["lon"], b["lat"], b["lon"]))
    h = sin((lat2 - lat1) / 2) ** 2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1) / 2) ** 2
    return 6371 * 2 * asin(sqrt(h))


def _divert_options(site_id: str, summaries: dict) -> list[dict]:
    """Permitted alternatives (BMC's current immersion list), nearest first by straight-line distance."""
    locs = load_locations()
    here = locs.get(site_id)
    out = []
    for sid, s in summaries.items():
        if sid == site_id or not SITE_BY_ID[sid]["in_bmc_2026_list"]:
            continue
        there = locs.get(sid)
        dist = round(_km(here, there), 1) if here and there else None
        approx = bool(here and there and (here["precision"] != "exact" or there["precision"] != "exact"))
        out.append({
            "site_id": sid, "name": s["name"], "name_hi": s["name_hi"], "status": s["status"], "score": s["score"],
            "on_lake": SITE_BY_ID[sid]["ngt_lake"], "km": dist, "approx": approx,
        })
    out.sort(key=lambda x: (x["km"] is None, x["km"] if x["km"] is not None else 0, x["score"]))
    return out


@lru_cache(maxsize=1)
def ranked() -> list[dict]:
    items = [site_summary(s["id"]) for s in SITES]
    items.sort(key=lambda x: (-x["score"], -x["stats"]["do_zero"], x["name"]))
    by_id = {it["site_id"]: it for it in items}
    locs = load_locations()
    out = []
    for i, it in enumerate(items, start=1):
        d = dict(it)
        d["rank"] = i
        d.pop("immersion_events", None)
        d["location"] = locs.get(d["site_id"])
        d["divert_to"] = _divert_options(d["site_id"], by_id) if d.get("ngt") else []
        out.append(d)
    return out


@lru_cache(maxsize=1)
def deployment_plan() -> dict:
    """City-wide view: for each of the officer's teams, which ghats need it, most urgent first."""
    order = {"high": 0, "medium": 1, "low": 2}
    teams = {"aeration": [], "cleaning": [], "testing": [], "ngt": []}
    for g in ranked():
        for d in g["deploy"]:
            teams[d["type"]].append({
                "site_id": g["site_id"], "name": g["name"], "name_hi": g["name_hi"], "rank": g["rank"],
                "status": g["status"], **{k: d[k] for k in ("level", "priority", "en", "hi", "rule", "rule_hi", "evidence")},
            })
    for k in teams:
        teams[k].sort(key=lambda x: (order[x["priority"]], x["rank"]))
    return {
        "teams": teams,
        "counts": {k: len({x["site_id"] for x in v}) for k, v in teams.items()},
        "urgent": {k: len({x["site_id"] for x in v if x["priority"] == "high"}) for k, v in teams.items()},
        "note": "Suggested from MPPCB readings (2024–2025) compared with CPCB limits. The officer decides.",
        "note_hi": "MPPCB रीडिंग (2024–2025) और CPCB सीमा की तुलना से सुझाव। फ़ैसला अधिकारी का।",
    }


def _trend(sdf: pd.DataFrame) -> list[dict]:
    lim = limits()
    rows = []
    for year in _all_years():
        for fest in FESTIVALS + ["All"]:
            g = sdf[sdf["year"] == year] if fest == "All" else sdf[(sdf["year"] == year) & (sdf["festival"] == fest)]
            do = g[(g["parameter"] == "Dissolved oxygen") & (g["kind"] == "value")]["num"]
            bod = g[(g["parameter"] == "BOD") & (g["kind"] == "value")]["num"]
            rows.append({
                "year": int(year),
                "festival": fest,
                "do_min": None if do.empty else float(do.min()),
                "do_mean": None if do.empty else round(float(do.mean()), 2),
                "do_fail": int((do < lim["Dissolved oxygen"]["min"]).sum()),
                "do_n": int(len(do)),
                "bod_max": None if bod.empty else float(bod.max()),
                "bod_mean": None if bod.empty else round(float(bod.mean()), 2),
                "bod_fail": int((bod > lim["BOD"]["max"]).sum()),
                "bod_n": int(len(bod)),
            })
    return rows


def _trend_text(trend: list[dict]) -> tuple[str, str]:
    allrows = [t for t in trend if t["festival"] == "All" and t["do_n"]]
    if len(allrows) < 2:
        return "Only one year of data — no trend.", "सिर्फ़ एक साल का डेटा — बदलाव नहीं दिखा सकते।"
    a, b = allrows[0], allrows[-1]
    parts_en, parts_hi = [], []
    if a["do_mean"] is not None and b["do_mean"] is not None:
        diff = b["do_mean"] - a["do_mean"]
        word = "improved" if diff > 0.3 else "worsened" if diff < -0.3 else "stayed about the same"
        word_hi = "बढ़ी (बेहतर)" if diff > 0.3 else "घटी (बदतर)" if diff < -0.3 else "लगभग वैसी ही रही"
        parts_en.append(f"Average oxygen {word} ({a['do_mean']:g} → {b['do_mean']:g} mg/l, {a['year']}→{b['year']})")
        parts_hi.append(f"औसत ऑक्सीजन {word_hi} ({a['do_mean']:g} → {b['do_mean']:g} mg/l, {a['year']}→{b['year']})")
    if a["bod_mean"] is not None and b["bod_mean"] is not None:
        diff = b["bod_mean"] - a["bod_mean"]
        word = "worsened" if diff > 0.5 else "improved" if diff < -0.5 else "stayed about the same"
        word_hi = "बढ़ी (बदतर)" if diff > 0.5 else "घटी (बेहतर)" if diff < -0.5 else "लगभग वैसी ही रही"
        parts_en.append(f"average waste (BOD) {word} ({a['bod_mean']:g} → {b['bod_mean']:g} mg/l)")
        parts_hi.append(f"औसत गंदगी (BOD) {word_hi} ({a['bod_mean']:g} → {b['bod_mean']:g} mg/l)")
    return "; ".join(parts_en) + ".", "; ".join(parts_hi) + "।"


@lru_cache(maxsize=16)
def site_detail(site_id: str) -> dict:
    summary = next(r for r in ranked() if r["site_id"] == site_id)
    sdf = _site_df(site_id)
    seasons = []
    for year, fest in expected_seasons():
        g = sdf[(sdf["year"] == year) & (sdf["festival"] == fest)]
        if g.empty:
            seasons.append({"year": year, "festival": fest, "table_missing": True, "rows": [], "source": None,
                            "site_as_printed": None})
            continue
        rows = []
        for p in PARAM_ORDER:
            pg = g[g["parameter"] == p]
            if pg.empty:
                rows.append({"parameter": p, **PARAM_META[p], "not_in_table": True, "cells": {}})
                continue
            cells = {}
            for ph in PHASES:
                c = pg[pg["phase"] == ph]
                cells[ph] = _reading_dict(c.iloc[0]) if len(c) else None
            rows.append({"parameter": p, **PARAM_META[p], "not_in_table": False, "cells": cells})
        page = int(g["source_page"].dropna().iloc[0]) if g["source_page"].notna().any() else None
        seasons.append({
            "year": year, "festival": fest, "table_missing": False, "rows": rows, "source": cite(year, page),
            "site_as_printed": g["site_as_printed"].iloc[0],
        })
    trend = _trend(sdf)
    t_en, t_hi = _trend_text(trend)
    return {
        **summary,
        "immersion_events": site_summary(site_id)["immersion_events"],
        "names_as_printed": sorted(sdf["site_as_printed"].unique().tolist()),
        "seasons": seasons,
        "trend": trend,
        "trend_text": t_en,
        "trend_text_hi": t_hi,
        "parameters": [PARAM_META[p] for p in PARAM_ORDER],
        "limits": limits(),
    }


# ---------------------------------------------------------------- anomalies
def _anomaly(aid, category, title_en, title_hi, detail_en, detail_hi, site_id=None, citations=None, severity="medium"):
    return {
        "id": aid,
        "category": category,  # gap | verify | ambiguity | scope
        "severity": severity,
        "site_id": site_id,
        "site_name": SITE_BY_ID[site_id]["name"] if site_id else None,
        "site_name_hi": SITE_BY_ID[site_id]["name_hi"] if site_id else None,
        "title": title_en,
        "title_hi": title_hi,
        "detail": detail_en,
        "detail_hi": detail_hi,
        "citations": citations or [],
    }


@lru_cache(maxsize=1)
def anomalies() -> list[dict]:
    df = load_readings()
    out: list[dict] = []
    lim = limits()

    # 1. Missing season tables per ghat
    for s in SITES:
        sdf = df[df["site_id"] == s["id"]]
        for year, fest in expected_seasons():
            if sdf[(sdf["year"] == year) & (sdf["festival"] == fest)].empty:
                out.append(_anomaly(
                    f"missing-table-{s['id']}-{year}-{fest}", "gap",
                    f"{s['name']}: no {fest} {year} test",
                    f"{s['name_hi']}: {FEST_HI[fest]} {year} की जाँच नहीं",
                    f"The MPPCB {year} report has no {fest} table for this ghat. We do not know how the water was "
                    f"during {fest} {year} — do not assume it was clean.",
                    f"MPPCB {year} रिपोर्ट में इस घाट की {FEST_HI[fest]} तालिका नहीं है। {FEST_HI[fest]} {year} में "
                    f"पानी कैसा था, पता नहीं — इसे साफ़ न मानें।",
                    site_id=s["id"], citations=[cite(year, None)], severity="high",
                ))

    # 2. Whole phases not sampled, and 3. scattered missing cells
    for (sid, year, fest), g in df.groupby(["site_id", "year", "festival"]):
        page = g["source_page"].dropna().iloc[0] if g["source_page"].notna().any() else None
        site = SITE_BY_ID[sid]
        whole_missing = [p for p in PHASES if (g[g["phase"] == p]["kind"] == "missing").all()]
        if whole_missing:
            ph_en = ", ".join(PHASE_EN[p] for p in whole_missing)
            ph_hi = ", ".join(PHASE_HI[p] for p in whole_missing)
            printed = sorted(set(g[(g["phase"].isin(whole_missing))]["value_as_printed"].replace("", "(blank)")))
            out.append(_anomaly(
                f"phase-missing-{sid}-{year}-{fest}", "gap",
                f"{site['name']}: {fest} {year} tested only {', '.join(PHASE_EN[p] for p in PHASES if p not in whole_missing)}",
                f"{site['name_hi']}: {FEST_HI[fest]} {year} में सिर्फ़ {', '.join(PHASE_HI[p] for p in PHASES if p not in whole_missing)} जाँच",
                f"No tests {ph_en} (report shows {' / '.join(printed)}). We cannot compare before and after.",
                f"{ph_hi} कोई जाँच नहीं (रिपोर्ट में {' / '.join(printed)})। पहले और बाद की तुलना नहीं हो सकती।",
                site_id=sid, citations=[cite(year, page)], severity="high",
            ))
        cells = g[(g["kind"] == "missing") & (~g["phase"].isin(whole_missing))]
        if len(cells):
            items = ", ".join(f"{r.parameter} ({PHASE_EN[r.phase]})" for r in cells.itertuples())
            items_hi = ", ".join(f"{PARAM_META[r.parameter]['label_hi']} ({PHASE_HI[r.phase]})" for r in cells.itertuples())
            out.append(_anomaly(
                f"cells-missing-{sid}-{year}-{fest}", "gap",
                f"{site['name']}: {len(cells)} empty box(es) in {fest} {year}",
                f"{site['name_hi']}: {FEST_HI[fest]} {year} में {len(cells)} खाली खाने",
                f"Printed as '_' or blank: {items}. Counted as 'not tested', never as zero.",
                f"'_' या खाली छपा: {items_hi}। इसे 'जाँच नहीं' माना, शून्य नहीं।",
                site_id=sid, citations=[cite(year, page)], severity="medium",
            ))

    # 4. Parameter missing from a whole season (e.g. suspended solids in Durga tables)
    for (year, fest), g in df.groupby(["year", "festival"]):
        absent = [p for p in PARAM_ORDER if p not in set(g["parameter"])]
        for p in absent:
            out.append(_anomaly(
                f"param-absent-{p}-{year}-{fest}", "gap",
                f"{PARAM_META[p]['label']} not tested in {fest} {year}",
                f"{FEST_HI[fest]} {year} में {PARAM_META[p]['label_hi']} की जाँच नहीं",
                f"The {fest} {year} tables have no '{p}' row for any Bhopal ghat.",
                f"{FEST_HI[fest]} {year} की तालिकाओं में किसी भी भोपाल घाट के लिए '{PARAM_META[p]['label_hi']}' नहीं है।",
                citations=[cite(year, int(g['source_page'].dropna().min()))], severity="low",
            ))

    # 5. Name ambiguity
    for s in SITES:
        if s["confidence"] != "high":
            sdf = df[df["site_id"] == s["id"]]
            by_fest = sdf.groupby("festival")["site_as_printed"].unique()
            g_names = "; ".join(sorted(set(by_fest.get("Ganesh", []))))
            d_names = "; ".join(sorted(set(by_fest.get("Durga", []))))
            out.append(_anomaly(
                f"name-{s['id']}", "ambiguity",
                f"'{s['name']}' may be two different places",
                f"'{s['name_hi']}' दो अलग जगहें हो सकती हैं",
                f"Ganesh tables say: {g_names}. Durga tables say: {d_names}. "
                f"The Ganesh tests (Kamla Park kund) and Durga tests (Lower Lake ghat) may not be the same water. "
                f"Be careful comparing years.",
                f"गणेश तालिकाओं में: {g_names}। दुर्गा तालिकाओं में: {d_names}। "
                f"गणेश (कमला पार्क कुंड) और दुर्गा (लोअर लेक घाट) की जाँच शायद एक ही पानी की नहीं। सालों की तुलना ध्यान से करें।",
                site_id=s["id"],
                citations=[cite(int(y), int(p)) for y, p in sdf.groupby("year")["source_page"].min().items()],
                severity="medium",
            ))

    # 6. Readings worth re-checking on the PDF
    do = df[(df["parameter"] == "Dissolved oxygen") & (df["kind"] == "value")]
    for sid, g in do[do["num"] == 0].groupby("site_id"):
        site = SITE_BY_ID[sid]
        where = ", ".join(f"{r.festival} {r.year} {PHASE_EN[r.phase]}" for r in g.itertuples())
        out.append(_anomaly(
            f"do-zero-{sid}", "verify",
            f"{site['name']}: oxygen 0 mg/l, {len(g)} time(s)",
            f"{site['name_hi']}: ऑक्सीजन {len(g)} बार 0 mg/l",
            f"{where}. With zero oxygen, fish cannot live in the water. The PDF says the same; worth testing again on site.",
            f"{where}। ऑक्सीजन शून्य हो तो मछलियाँ नहीं जी सकतीं। PDF में भी यही है; मौके पर फिर जाँच करवाएँ।",
            site_id=sid, citations=[cite(r.year, r.source_page) for r in g.itertuples()], severity="high",
        ))
    for sid, g in do[do["num"] > 10].groupby("site_id"):
        site = SITE_BY_ID[sid]
        vals = ", ".join(f"{r.num:g} ({r.festival} {r.year} {r.phase})" for r in g.itertuples())
        out.append(_anomaly(
            f"do-high-{sid}", "verify",
            f"{site['name']}: oxygen unusually high (above 10)",
            f"{site['name_hi']}: ऑक्सीजन बहुत ज़्यादा (10 से ऊपर)",
            f"{vals}. This can happen when algae grow in sunlight, or from a lab mistake. "
            f"It counts as 'within limit', but is not proof of clean water.",
            f"{vals}। धूप में काई (शैवाल) बढ़ने या लैब की गलती से ऐसा हो सकता है। इसे 'सीमा में' गिना है, "
            f"पर यह साफ़ पानी का सबूत नहीं।",
            site_id=sid, citations=[cite(r.year, r.source_page) for r in g.itertuples()], severity="low",
        ))

    # 7. Sudden jumps between phases (BOD x3 or more)
    bod = df[(df["parameter"] == "BOD") & (df["kind"] == "value")]
    for (sid, year, fest), g in bod.groupby(["site_id", "year", "festival"]):
        v = {r.phase: r.num for r in g.itertuples()}
        if "pre" in v and v["pre"] > 0:
            for ph in ("during", "after"):
                if ph in v and v[ph] >= 3 * v["pre"]:
                    site = SITE_BY_ID[sid]
                    out.append(_anomaly(
                        f"bod-jump-{sid}-{year}-{fest}-{ph}", "verify",
                        f"{site['name']}: waste (BOD) jumped {v[ph] / v['pre']:.1f} times {PHASE_EN[ph]} ({fest} {year})",
                        f"{site['name_hi']}: गंदगी (BOD) {PHASE_HI[ph]} {v[ph] / v['pre']:.1f} गुना बढ़ी ({FEST_HI[fest]} {year})",
                        f"BOD went from {v['pre']:g} before immersion to {v[ph]:g} {PHASE_EN[ph]}. "
                        f"Either a lot of waste from immersion, or a mistake in the report.",
                        f"BOD विसर्जन से पहले {v['pre']:g} था, {PHASE_HI[ph]} {v[ph]:g} हो गया। या तो विसर्जन से बहुत "
                        f"कचरा आया, या रिपोर्ट में गलती है।",
                        site_id=sid, citations=[cite(year, g["source_page"].iloc[0])], severity="medium",
                    ))

    # 8. Pre and after-week values identical (possible copy in report)
    identical = defaultdict(list)
    for (sid, year, fest), g in df[df["kind"] == "value"].groupby(["site_id", "year", "festival"]):
        piv = g.pivot_table(index="parameter", columns="phase", values="num", aggfunc="first")
        if {"pre", "after"} <= set(piv.columns):
            both = piv[["pre", "after"]].dropna()
            same = both[both["pre"] == both["after"]]
            if len(both) >= 6 and len(same) >= 4:
                identical[(year, fest)].append((sid, list(same.index), g["source_page"].iloc[0]))
    for (year, fest), hits in identical.items():
        names = ", ".join(SITE_BY_ID[s]["name"] for s, _, _ in hits)
        names_hi = ", ".join(SITE_BY_ID[s]["name_hi"] for s, _, _ in hits)
        params = sorted({p for _, ps, _ in hits for p in ps}, key=PARAM_ORDER.index)
        out.append(_anomaly(
            f"identical-{year}-{fest}", "verify",
            f"{fest} {year}: 'before' and 'week after' numbers are the same at {len(hits)} ghats",
            f"{FEST_HI[fest]} {year}: {len(hits)} घाटों पर 'पहले' और 'हफ़्ते बाद' के आँकड़े एक जैसे",
            f"At {names}, 4 or more tests ({', '.join(params)}) show exactly the same number before immersion "
            f"and a week later. That is very unlikely — the report may have copied a column. "
            f"Check with the MPPCB lab before trusting the 'week after' metal numbers.",
            f"{names_hi} पर 4 या ज़्यादा जाँच ({', '.join(PARAM_META[p]['label_hi'] for p in params)}) में विसर्जन से पहले और "
            f"हफ़्ते बाद बिल्कुल एक जैसे आँकड़े हैं। ऐसा होना मुश्किल है — शायद रिपोर्ट में कॉलम दोहराया गया। MPPCB लैब से पूछें।",
            citations=[cite(year, p) for _, _, p in hits], severity="low",
        ))

    # 9. Scope limits that apply to every ghat
    out.append(_anomaly(
        "scope-coliform", "scope",
        "Coliform (germs) never tested — bathing check is incomplete",
        "कोलीफॉर्म (कीटाणु) की जाँच कभी नहीं हुई — नहाने की जाँच अधूरी",
        f"The bathing limit (CPCB Class B) also covers total coliform {lim.get('Total coliform', {}).get('text', '<= 500 MPN/100 ml')}. "
        "No MPPCB visarjan table reports it, so this tool says nothing about it.",
        "नहाने की सीमा (CPCB क्लास B) में टोटल कोलीफॉर्म भी है (500 MPN/100 ml तक)। MPPCB की किसी विसर्जन तालिका में यह नहीं, "
        "इसलिए यह टूल इस पर कुछ नहीं कहता।",
        severity="medium",
    ))
    out.append(_anomaly(
        "scope-metals", "scope",
        "Only 4 metals tested, and the bathing limit has no number for them",
        "सिर्फ़ 4 धातुओं की जाँच, और नहाने की सीमा में इनका कोई आँकड़ा नहीं",
        "Chromium, lead, zinc and copper are in the reports. Other metals were not tested, and we do not guess them. "
        "'BDL' means too small to measure — very low, not missing, and not a risk.",
        "क्रोमियम, सीसा, जस्ता और तांबा ही रिपोर्ट में हैं। बाकी धातुओं की जाँच नहीं हुई, हम अंदाज़ा नहीं लगाते। "
        "'BDL' मतलब इतना कम कि नापा न जा सके — कम है, गायब नहीं, और खतरा नहीं।",
        severity="low",
    ))
    out.append(_anomaly(
        "scope-units", "scope",
        "Reports print no units",
        "रिपोर्ट में इकाई (unit) नहीं छपी",
        "We used the usual unit for each test (mg/l, NTU, µS/cm) — the PDFs print none.",
        "हर जाँच की आम इकाई (mg/l, NTU, µS/cm) मानी है — PDF में इकाई नहीं छपी।",
        severity="low",
    ))
    order = {"high": 0, "medium": 1, "low": 2}
    cat_order = {"gap": 0, "verify": 1, "ambiguity": 2, "scope": 3}
    out.sort(key=lambda a: (order[a["severity"]], cat_order[a["category"]]))
    return out


@lru_cache(maxsize=1)
def overview() -> dict:
    df = load_readings()
    lim = limits()
    do = df[(df["parameter"] == "Dissolved oxygen") & (df["kind"] == "value")]
    bod = df[(df["parameter"] == "BOD") & (df["kind"] != "missing")]
    ph = df[(df["parameter"] == "pH") & (df["kind"] == "value")]
    do_fail = int((do["num"] < lim["Dissolved oxygen"]["min"]).sum())
    bod_fail = int(((bod["kind"] == "value") & (bod["num"] > lim["BOD"]["max"])).sum())
    ph_fail = int(((ph["num"] < lim["pH"]["min"]) | (ph["num"] > lim["pH"]["max"])).sum())
    an = anomalies()
    r = ranked()
    return {
        "total_ghats": len(SITES),
        "years": _all_years(),
        "rows": int(len(df)),
        "critical_violations": do_fail + bod_fail + ph_fail,
        "do_below_limit": do_fail,
        "do_readings": int(len(do)),
        "do_zero": int((do["num"] == 0).sum()),
        "bod_above_limit": bod_fail,
        "bod_readings": int(len(bod)),
        "ph_out_of_range": ph_fail,
        "ph_readings": int(len(ph)),
        "missing_cells": int((df["kind"] == "missing").sum()),
        "bdl_cells": int((df["kind"] == "bdl").sum()),
        "blind_spots": sum(1 for a in an if a["category"] == "gap"),
        "anomalies_total": len(an),
        "status_counts": {k: sum(1 for x in r if x["status"] == k) for k in ("red", "yellow", "green", "grey")},
        "ghats_failing_bod_latest_year": sum(
            1 for s in SITES
            if ((df["site_id"] == s["id"]) & (df["year"] == max(_all_years())) & (df["parameter"] == "BOD")
                & (df["kind"] == "value") & (df["num"] > lim["BOD"]["max"])).any()
        ),
        "limits": lim,
        "method": {
            "standard": "CPCB Class B — Outdoor bathing (organised)",
            "why": "Devotees enter the water at ghats during visarjan, so the bathing standard is the closest fit.",
            "weights": COMPONENT_WEIGHTS,
            "year_weight_by_age": YEAR_WEIGHT_BY_AGE,
            "festival_weight": FESTIVAL_WEIGHT,
            "red_score": RED_SCORE,
            "yellow_score": YELLOW_SCORE,
        },
    }
