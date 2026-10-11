"""CPCB class matrix (A–E), city-wide data overview, and notifications."""

from __future__ import annotations

from collections import Counter
from datetime import date
from functools import lru_cache

import numpy as np
import pandas as pd

from .config import VISARJAN_DATE
from .data import PARAM_META, PARAM_ORDER, PHASES, SITE_BY_ID, SITES, load_cpcb, load_readings
from .engine import anomalies, cite, expected_seasons, ranked

# CPCB criteria parameter -> column in the MPPCB readings (None = never tested in the visarjan reports)
CRITERIA_MAP = {
    "pH": "pH",
    "Dissolved oxygen": "Dissolved oxygen",
    "BOD (5 days 20C)": "BOD",
    "Electrical conductivity at 25C": "Conductivity",
    "Total coliform": None,
    "Free ammonia (as N)": None,
    "Sodium absorption ratio": None,
    "Boron": None,
}
CLASS_HI = {
    "A": "पेयजल स्रोत (केवल कीटाणुशोधन के बाद)",
    "B": "संगठित बाहरी स्नान",
    "C": "पेयजल स्रोत (पारंपरिक उपचार के बाद)",
    "D": "वन्यजीव एवं मत्स्य पालन",
    "E": "सिंचाई, औद्योगिक शीतलन, नियंत्रित अपशिष्ट निपटान",
}
SHORT_EN = {"pH": "pH", "Dissolved oxygen": "DO", "BOD": "BOD", "Conductivity": "Conductivity"}


def _classes() -> list[dict]:
    c = load_cpcb()
    out = []
    for cls, g in c.groupby("class", sort=True):
        criteria, untestable = [], []
        for _, r in g.iterrows():
            col = CRITERIA_MAP.get(r["parameter"])
            unit = "" if pd.isna(r["unit"]) else str(r["unit"])
            text = f"{r['parameter']} {'≥' if r['limit_type'] == 'min' else '≤' if r['limit_type'] == 'max' else ''} {r['limit']} {unit}".strip()
            if col is None:
                untestable.append({"parameter": r["parameter"], "text": text})
                continue
            if r["limit_type"] == "range":
                lo, hi = (float(x) for x in str(r["limit"]).split("-"))
                criteria.append({"column": col, "min": lo, "max": hi, "text": f"{SHORT_EN[col]} {lo:g}–{hi:g}"})
            elif r["limit_type"] == "min":
                criteria.append({"column": col, "min": float(r["limit"]), "max": None, "text": f"{SHORT_EN[col]} ≥ {float(r['limit']):g} {unit}".strip()})
            else:
                criteria.append({"column": col, "min": None, "max": float(r["limit"]), "text": f"{SHORT_EN[col]} ≤ {float(r['limit']):g} {unit}".strip()})
        out.append({
            "class": cls,
            "use": g["designated_best_use"].iloc[0],
            "use_hi": CLASS_HI.get(cls, ""),
            "criteria": criteria,
            "untestable": untestable,
        })
    return out


def _passes(crit: dict, v: float) -> bool:
    if crit["min"] is not None and v < crit["min"]:
        return False
    if crit["max"] is not None and v > crit["max"]:
        return False
    return True


@lru_cache(maxsize=1)
def class_matrix() -> dict:
    """For every ghat and CPCB class: share of water samples meeting every testable criterion."""
    df = load_readings()
    classes = _classes()
    latest = int(df["year"].max())
    usable = df[df["kind"] != "missing"]
    rows = []
    rank_by_id = {r["site_id"]: r["rank"] for r in ranked()}
    for s in sorted(SITES, key=lambda x: rank_by_id[x["id"]]):
        sdf = usable[usable["site_id"] == s["id"]]
        samples = {k: g for k, g in sdf.groupby(["year", "festival", "phase"])}
        cells = []
        for cl in classes:
            evaluated = passed = 0
            latest_eval = latest_pass = 0
            fails = Counter()
            worst: dict[str, dict] = {}
            for (year, fest, phase), g in samples.items():
                vals = {r.parameter: (r.num, r.source_page) for r in g.itertuples()}
                tested = [c for c in cl["criteria"] if c["column"] in vals]
                if not tested:
                    continue
                evaluated += 1
                ok = True
                for c in tested:
                    v, page = vals[c["column"]]
                    if not _passes(c, v):
                        ok = False
                        fails[c["text"]] += 1
                        # remember the reading furthest from the limit
                        gap = (c["min"] - v) if c["min"] is not None and v < c["min"] else (v - c["max"]) if c["max"] is not None else 0
                        if c["text"] not in worst or gap > worst[c["text"]]["gap"]:
                            worst[c["text"]] = {"gap": gap, "value": float(v), "season": f"{fest} {year}", "phase": phase,
                                                "source": cite(year, page)}
                passed += ok
                if year == latest:
                    latest_eval += 1
                    latest_pass += ok
            pct = round(100 * passed / evaluated) if evaluated else None
            status = "grey" if pct is None else "green" if pct >= 90 else "yellow" if pct >= 50 else "red"
            issues = [
                {"criterion": k, "count": n, "worst": {kk: vv for kk, vv in worst[k].items() if kk != "gap"}}
                for k, n in fails.most_common()
            ]
            cells.append({
                "class": cl["class"],
                "status": status,
                "compliance_pct": pct,
                "samples_evaluated": evaluated,
                "samples_passed": passed,
                "latest_year_pct": round(100 * latest_pass / latest_eval) if latest_eval else None,
                "issues": issues,
                "major_issue": issues[0]["criterion"] if issues else None,
            })
        rows.append({
            "site_id": s["id"], "name": s["name"], "name_hi": s["name_hi"], "rank": rank_by_id[s["id"]], "cells": cells,
        })
    return {
        "classes": classes,
        "rows": rows,
        "latest_year": latest,
        "rule": "One sample = one ghat, one festival, one time (before / during / after). It passes a class only if "
                "every test we have is within that class's limit. Green = 90% or more pass, yellow = 50–89%, "
                "red = under 50%, grey = nothing to check.",
        "rule_hi": "एक नमूना = एक घाट, एक त्योहार, एक समय (पहले / दौरान / बाद)। किसी वर्ग में पास तभी, जब हमारी हर जाँच उस "
                   "वर्ग की सीमा में हो। हरा = 90% या ज़्यादा पास, पीला = 50–89%, लाल = 50% से कम, धूसर = जाँचने को कुछ नहीं।",
    }


@lru_cache(maxsize=1)
def data_summary() -> dict:
    df = load_readings()
    tables = df.groupby(["site_id", "year", "festival"]).ngroups
    by_season = []
    for (year, fest), g in df.groupby(["year", "festival"]):
        do = g[(g["parameter"] == "Dissolved oxygen") & (g["kind"] == "value")]["num"]
        bod = g[(g["parameter"] == "BOD") & (g["kind"] != "missing")]["num"]
        by_season.append({
            "year": int(year), "festival": fest,
            "ghats_reported": int(g["site_id"].nunique()),
            "do_n": int(len(do)), "do_fail": int((do < 5).sum()),
            "do_mean": round(float(do.mean()), 2) if len(do) else None,
            "do_min": float(do.min()) if len(do) else None,
            "bod_n": int(len(bod)), "bod_fail": int((bod > 3).sum()),
            "bod_mean": round(float(bod.mean()), 2) if len(bod) else None,
            "bod_max": float(bod.max()) if len(bod) else None,
            "pages": sorted({int(p) for p in g["source_page"].dropna()}),
        })
    coverage = []
    for p in PARAM_ORDER:
        g = df[df["parameter"] == p]
        expected = tables * len(PHASES)
        coverage.append({
            **PARAM_META[p],
            "expected": expected,
            "value": int((g["kind"] == "value").sum()),
            "bdl": int((g["kind"] == "bdl").sum()),
            "missing": int((g["kind"] == "missing").sum()),
            "not_in_table": int(expected - len(g)),
        })
    phase_effect = []
    for ph in PHASES:
        do = df[(df["parameter"] == "Dissolved oxygen") & (df["phase"] == ph) & (df["kind"] == "value")]["num"]
        bod = df[(df["parameter"] == "BOD") & (df["phase"] == ph) & (df["kind"] == "value")]["num"]
        phase_effect.append({
            "phase": ph,
            "do_mean": round(float(do.mean()), 2), "do_fail_pct": round(100 * float((do < 5).mean())),
            "bod_mean": round(float(bod.mean()), 2), "bod_fail_pct": round(100 * float((bod > 3).mean())),
        })
    return {
        "rows": int(len(df)),
        "ghats": len(SITES),
        "years": sorted(int(y) for y in df["year"].unique()),
        "tables_found": tables,
        "tables_expected": len(SITES) * len(expected_seasons()),
        "kinds": {k: int(v) for k, v in df["kind"].value_counts().items()},
        "by_season": by_season,
        "phase_effect": phase_effect,
        "coverage": coverage,
    }


def notifications() -> list[dict]:
    days = (date.fromisoformat(VISARJAN_DATE) - date.today()).days
    out = []
    if days >= 0:
        out.append({
            "id": "countdown", "level": "info" if days > 3 else "high",
            "title": f"{days} days to Durga visarjan (20 Oct 2026)" if days else "Durga visarjan is today",
            "title_hi": f"दुर्गा विसर्जन में {days} दिन (20 अक्टूबर 2026)" if days else "आज दुर्गा विसर्जन है",
            "body": "Fix oxygen pumps, cleaning teams and MPPCB water tests for the red ghats.",
            "body_hi": "लाल घाटों के लिए ऑक्सीजन पंप, सफ़ाई टीम और MPPCB पानी जाँच तय करें।",
            "target": {"view": "dashboard"},
        })
    for r in ranked():
        if r["stats"]["do_zero"]:
            out.append({
                "id": f"zero-do-{r['site_id']}", "level": "high",
                "title": f"{r['name']}: oxygen hit 0, {r['stats']['do_zero']} times",
                "title_hi": f"{r['name_hi']}: ऑक्सीजन {r['stats']['do_zero']} बार 0",
                "body": r["primary_reason"], "body_hi": r["primary_reason_hi"],
                "target": {"view": "dashboard", "site_id": r["site_id"]},
            })
    for a in anomalies():
        if a["category"] == "gap" and a["severity"] == "high":
            out.append({
                "id": a["id"], "level": "warning", "title": a["title"], "title_hi": a["title_hi"],
                "body": a["detail"], "body_hi": a["detail_hi"],
                "target": {"view": "anomalies", "site_id": a["site_id"]},
            })
    return out
