import math

from fastapi.testclient import TestClient

from app.brief import generate_brief, violates_guardrails
from app.data import classify_printed, load_readings
from app.engine import anomalies, cell_status, overview, ranked, site_detail
from app.main import app

client = TestClient(app)


def test_bdl_is_tiny_positive_never_risk():
    num, kind = classify_printed("BDL", float("nan"), "BDL")
    assert kind == "bdl" and 0 < num < 0.01
    assert cell_status("BOD", num, kind) == "green"
    assert cell_status("Lead", num, kind) == "bdl"


def test_missing_is_never_zero_or_clean():
    for printed, flag in [("_", "not sampled"), ("*", "*"), ("**", "**"), ("", "not sampled"), ("-", "")]:
        num, kind = classify_printed(printed, float("nan"), flag)
        assert kind == "missing" and math.isnan(num)
        assert cell_status("Dissolved oxygen", num, kind) == "grey"
    df = load_readings()
    assert df[df["kind"] == "missing"]["num"].isna().all()


def test_headline_numbers_match_problem_statement():
    o = overview()
    assert (o["do_below_limit"], o["do_readings"]) == (42, 116)
    assert (o["bod_above_limit"], o["bod_readings"]) == (100, 112)
    assert o["rows"] == 1524


def test_bairagarh_ranked_first_with_zero_do():
    r = ranked()
    assert len(r) == 7 and [x["rank"] for x in r] == list(range(1, 8))
    top = r[0]
    assert top["site_id"] == "bairagarh"
    assert top["stats"]["do_zero"] == 4 and top["stats"]["do_zero_years"] == [2023, 2025]
    assert "0 mg/l" in top["primary_reason"]


def test_missing_durga_2025_tables_flagged():
    ids = {a["id"] for a in anomalies()}
    assert "missing-table-bairagarh-2025-Durga" in ids
    assert "missing-table-malikhedi-2025-Durga" in ids
    d = site_detail("malikhedi")
    season = next(s for s in d["seasons"] if s["year"] == 2025 and s["festival"] == "Durga")
    assert season["table_missing"] is True


def test_every_reading_has_page():
    d = site_detail("shahpura")
    cells = [c for s in d["seasons"] for row in s["rows"] for c in row["cells"].values() if c]
    assert len(cells) == 228
    assert all(c["source"]["page"] for c in cells)


def test_api_endpoints():
    assert client.get("/api/ghats/ranked").status_code == 200
    assert client.get("/api/ghats/hathaikheda").json()["site_id"] == "hathaikheda"
    assert client.get("/api/ghats/nope").status_code == 404
    assert client.get("/api/anomalies").json()["counts"]["gap"] > 0


def test_template_brief_bilingual_and_safe():
    b = generate_brief("bairagarh", use_ai=False)
    assert b["source"] == "template"
    assert "MPPCB" in b["english"] and "MPPCB" in b["hindi"]
    assert not violates_guardrails(b["combined"])
    assert not violates_guardrails(generate_brief("all", use_ai=False)["combined"])


def test_class_matrix_shape_and_honesty():
    m = client.get("/api/cpcb/matrix").json()
    assert [c["class"] for c in m["classes"]] == ["A", "B", "C", "D", "E"]
    assert len(m["rows"]) == 7 and m["rows"][0]["site_id"] == "bairagarh"
    b = next(c for c in m["classes"] if c["class"] == "B")
    assert any(u["parameter"] == "Total coliform" for u in b["untestable"])
    bair_b = next(c for c in m["rows"][0]["cells"] if c["class"] == "B")
    assert bair_b["status"] == "red" and bair_b["issues"]


def test_data_summary_and_misc_endpoints():
    s = client.get("/api/data/summary").json()
    assert s["tables_found"] == 40 and s["tables_expected"] == 42
    ss = next(c for c in s["coverage"] if c["key"] == "Suspended solids")
    assert ss["not_in_table"] == 36
    assert client.get("/api/guidelines").json()["items"]
    assert client.get("/api/notifications").json()["items"]
    assert client.post("/api/refresh").json()["rows"] == 1524


def test_composer_options():
    b = generate_brief("hathaikheda", use_ai=False, issues=["bod"], manager="R. Sharma", note="Crew at 6 am", language="hi")
    assert "R. Sharma" in b["english"] and "Crew at 6 am" in b["hindi"]
    assert "Oxygen (DO) below" not in b["english"]
    assert b["text"] == b["hindi"]


def test_ngt_flags_follow_the_source():
    r = {x["site_id"]: x for x in ranked()}
    lake = {k for k, v in r.items() if v["ngt"]}
    assert lake == {"bairagarh", "khatlapura", "prempura", "rani-kamlapati"}
    # Rani Kamlapati is the only lake ghat not in BMC's current arrangement list
    assert r["rani-kamlapati"]["ngt"]["level"] == "divert"
    assert all(r[k]["ngt"]["level"] == "check" for k in lake - {"rani-kamlapati"})
    assert r["hathaikheda"]["ngt"] is None
    b = generate_brief("prempura", use_ai=False)
    assert "NGT" in b["english"] and "NGT" in b["hindi"]


def test_data_confidence_and_trends():
    r = {x["site_id"]: x for x in ranked()}
    assert r["bairagarh"]["data_confidence"]["pct"] < r["shahpura"]["data_confidence"]["pct"]
    assert r["bairagarh"]["data_confidence"]["missing_tables"] == 1
    t = r["bairagarh"]["phase_trend"]
    assert (t["year"], t["festival"]) == (2025, "Ganesh")
    assert t["do"][0]["value"] is None and t["do"][1]["value"] == 0.0  # pre not tested, during = 0


def test_resource_engine_rules_and_evidence():
    r = {x["site_id"]: x for x in ranked()}
    bair = {d["type"]: d for d in r["bairagarh"]["deploy"]}
    assert bair["aeration"]["level"] == "deploy"          # DO 0 < 4
    assert bair["testing"]["level"] == "today"            # Durga 2025 table missing
    assert bair["aeration"]["evidence"][0]["source"]["page"]
    hath = {d["type"]: d for d in r["hathaikheda"]["deploy"]}
    assert "aeration" not in hath                          # DO never below 5 in 2024-25
    assert hath["cleaning"]["priority"] == "high"          # BOD 22 > 6
    for g in r.values():                                   # no unsourced "24 hours" promise
        assert all("24 hours" not in d["en"] for d in g["deploy"])
    plan = client.get("/api/plan").json()
    assert plan["counts"]["cleaning"] == 7 and plan["counts"]["testing"] >= 2


def test_divert_routes_and_locations():
    r = {x["site_id"]: x for x in ranked()}
    rk = r["rani-kamlapati"]
    assert rk["divert_to"] and all(a["site_id"] != "rani-kamlapati" for a in rk["divert_to"])
    assert all(SITE["in_bmc_2026_list"] for SITE in [__import__("app.data", fromlist=["SITE_BY_ID"]).SITE_BY_ID[a["site_id"]] for a in rk["divert_to"]])
    assert rk["divert_to"][0]["km"] is not None and rk["divert_to"][-1]["site_id"] == "hathaikheda"  # no coords -> last
    assert r["hathaikheda"]["location"] is None and r["prempura"]["location"]["precision"] == "exact"


def test_brief_audiences():
    p = generate_brief("rani-kamlapati", use_ai=False, audience="police")
    assert "NGT" in p["english"] and "confirm with BMC" in p["english"] and "mg/l" not in p["english"]
    pub = generate_brief("all", use_ai=False, audience="public")
    assert "mg/l" not in pub["combined"] and not violates_guardrails(pub["combined"])
    assert client.post("/api/brief/generate", json={"site_id": "all", "audience": "police"}).json()["audience"] == "police"


def test_guardrail_catches_health_claims():
    assert violates_guardrails("Risk of cholera outbreak")
    assert violates_guardrails("पानी से बीमारी फैल सकती है")
