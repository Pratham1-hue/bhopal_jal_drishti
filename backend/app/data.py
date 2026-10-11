"""Load and clean the MPPCB Bhopal ghat readings.

Rules (see data/DATA_DICTIONARY.md):
- BDL / ND  -> below detection. Kept as a tiny positive number (0.001) for math,
               never flagged as a risk, and shown as printed.
- blank, "_", "-", "*", "**", "not sampled" -> missing (NaN). Never zero, never clean.
"""

from functools import lru_cache

import numpy as np
import pandas as pd

from .config import DATA_DIR, DATASET_FILE

BDL_VALUE = 0.001
BDL_CODES = {"BDL", "ND"}
MISSING_CODES = {"", "_", "-", "*", "**", "NOT SAMPLED", "NAN", "NA"}

SITES = [
    {
        "id": "bairagarh",
        "name": "Bairagarh (Sant Hirdaram) kund",
        "name_hi": "बैरागढ़ (संत हिरदाराम) कुंड",
        "water_body": "Upper Lake",
        "water_body_hi": "बड़ी झील (अपर लेक)",
        "confidence": "high",
    },
    {
        "id": "khatlapura",
        "name": "Khatlapura ghat",
        "name_hi": "खटलापुरा घाट",
        "water_body": "Lower Lake",
        "water_body_hi": "छोटी झील (लोअर लेक)",
        "confidence": "high",
    },
    {
        "id": "prempura",
        "name": "Prempura ghat",
        "name_hi": "प्रेमपुरा घाट",
        "water_body": "Upper Lake",
        "water_body_hi": "बड़ी झील (अपर लेक)",
        "confidence": "high",
    },
    {
        "id": "rani-kamlapati",
        "name": "Rani Kamlapati ghat / Kamla Park kund",
        "name_hi": "रानी कमलापति घाट / कमला पार्क कुंड",
        "water_body": "Lower Lake",
        "water_body_hi": "छोटी झील (लोअर लेक)",
        "confidence": "medium",
    },
    {
        "id": "hathaikheda",
        "name": "Hathaikheda dam / kund",
        "name_hi": "हथाईखेड़ा डैम / कुंड",
        "water_body": "Hathaikheda dam",
        "water_body_hi": "हथाईखेड़ा डैम",
        "confidence": "high",
    },
    {
        "id": "malikhedi",
        "name": "Malikhedi kund",
        "name_hi": "मालीखेड़ी कुंड",
        "water_body": "Kund",
        "water_body_hi": "कुंड",
        "confidence": "high",
    },
    {
        "id": "shahpura",
        "name": "Shahpura lake ghat",
        "name_hi": "शाहपुरा झील घाट",
        "water_body": "Shahpura Lake",
        "water_body_hi": "शाहपुरा झील",
        "confidence": "high",
    },
]
# NGT ban on immersion in Upper Lake (Bada Talab) and Lower Lake (Chhota Talab), and BMC's list of
# current immersion arrangements — both from Free Press Journal, 26 Feb 2026 (see guidelines.py).
NGT_LAKES = {"Upper Lake", "Lower Lake"}
BMC_2026_ARRANGEMENT = {"bairagarh", "malikhedi", "prempura", "khatlapura", "hathaikheda"}
for _s in SITES:
    _s["ngt_lake"] = _s["water_body"] in NGT_LAKES
    _s["in_bmc_2026_list"] = _s["id"] in BMC_2026_ARRANGEMENT

SITE_BY_ID = {s["id"]: s for s in SITES}
SITE_ID_BY_NAME = {s["name"]: s["id"] for s in SITES}

PARAMETERS = [
    # key, display EN, display HI, unit, group
    ("pH", "pH", "पीएच", "", "classB"),
    ("Dissolved oxygen", "Dissolved oxygen (DO)", "घुलित ऑक्सीजन (DO)", "mg/l", "classB"),
    ("BOD", "BOD", "बीओडी (BOD)", "mg/l", "classB"),
    ("COD", "COD", "सीओडी (COD)", "mg/l", "organic"),
    ("Total solids", "Total solids", "कुल ठोस", "mg/l", "physical"),
    ("Dissolved solids", "Dissolved solids", "घुलित ठोस", "mg/l", "physical"),
    ("Suspended solids", "Suspended solids", "निलंबित ठोस", "mg/l", "physical"),
    ("Turbidity", "Turbidity", "गंदलापन (टर्बिडिटी)", "NTU", "physical"),
    ("Conductivity", "Conductivity", "चालकता", "µS/cm", "physical"),
    ("Chromium", "Chromium (Cr)", "क्रोमियम (Cr)", "mg/l", "metal"),
    ("Lead", "Lead (Pb)", "सीसा (Pb)", "mg/l", "metal"),
    ("Zinc", "Zinc (Zn)", "जस्ता (Zn)", "mg/l", "metal"),
    ("Copper", "Copper (Cu)", "तांबा (Cu)", "mg/l", "metal"),
]
PARAM_META = {p[0]: {"key": p[0], "label": p[1], "label_hi": p[2], "unit": p[3], "group": p[4]} for p in PARAMETERS}
PARAM_ORDER = [p[0] for p in PARAMETERS]

PHASES = ["pre", "during", "after"]
FESTIVALS = ["Ganesh", "Durga"]


def classify_printed(printed, value, flag):
    """Return (numeric_for_math, kind) where kind is 'value' | 'bdl' | 'missing'."""
    p = "" if printed is None or (isinstance(printed, float) and np.isnan(printed)) else str(printed).strip()
    f = "" if flag is None or (isinstance(flag, float) and np.isnan(flag)) else str(flag).strip()
    if p.upper() in BDL_CODES or f.upper() in BDL_CODES:
        return BDL_VALUE, "bdl"
    if f.upper() in MISSING_CODES - {""} or (p.upper() in MISSING_CODES - {""}):
        return np.nan, "missing"
    for candidate in (value, p):
        try:
            num = float(candidate)
        except (TypeError, ValueError):
            continue
        if not np.isnan(num):
            return num, "value"
    return np.nan, "missing"


@lru_cache(maxsize=1)
def load_readings() -> pd.DataFrame:
    df = pd.read_csv(DATA_DIR / DATASET_FILE, dtype=str, encoding="utf-8-sig", keep_default_na=False)
    df["year"] = df["year"].astype(int)
    df["source_page"] = pd.to_numeric(df["source_page"], errors="coerce").astype("Int64")
    raw_value = pd.to_numeric(df["value"].replace("", np.nan), errors="coerce")
    nums, kinds = [], []
    for printed, val, flag in zip(df["value_as_printed"], raw_value, df["flag"]):
        n, k = classify_printed(printed, val, flag)
        nums.append(n)
        kinds.append(k)
    df["num"] = nums
    df["kind"] = kinds
    df["site_id"] = df["site"].map(SITE_ID_BY_NAME)
    df["unit"] = df["parameter"].map(lambda p: PARAM_META.get(p, {}).get("unit", ""))
    df.loc[df["value_as_printed"].str.strip() == "", "value_as_printed"] = ""
    return df


@lru_cache(maxsize=1)
def load_locations() -> dict:
    """Ghat coordinates from data/ghat_locations.csv. Ghats without coordinates are left off the map."""
    path = DATA_DIR / "ghat_locations.csv"
    if not path.exists():
        return {}
    df = pd.read_csv(path, dtype=str, keep_default_na=False)
    out = {}
    for r in df.itertuples():
        try:
            out[r.site_id] = {"lat": float(r.lat), "lon": float(r.lon), "precision": r.precision,
                              "located_by": r.located_by, "source": r.source}
        except ValueError:
            continue
    return out


@lru_cache(maxsize=1)
def load_cpcb() -> pd.DataFrame:
    return pd.read_csv(DATA_DIR / "cpcb_water_quality_criteria.csv", encoding="utf-8-sig")


def class_b_limits() -> dict:
    """Read Class B (outdoor bathing) limits from the CPCB file."""
    c = load_cpcb()
    b = c[c["class"] == "B"]
    out = {}
    for _, r in b.iterrows():
        p = r["parameter"]
        if p == "pH":
            lo, hi = (float(x) for x in str(r["limit"]).split("-"))
            out["pH"] = {"min": lo, "max": hi, "text": f"{lo:g} to {hi:g}"}
        elif p == "Dissolved oxygen":
            out["Dissolved oxygen"] = {"min": float(r["limit"]), "text": f">= {float(r['limit']):g} mg/l"}
        elif p.startswith("BOD"):
            out["BOD"] = {"max": float(r["limit"]), "text": f"<= {float(r['limit']):g} mg/l"}
        elif p == "Total coliform":
            out["Total coliform"] = {"max": float(r["limit"]), "text": f"<= {float(r['limit']):g} MPN/100 ml"}
    return out
