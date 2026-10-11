from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .brief import generate_brief
from .config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL, DATASET_FILE, FRONTEND_DIST, REPORT_PDFS, RESOURCES_DIR
from .data import SITE_BY_ID, load_cpcb, load_locations, load_readings
from .engine import _all_years, anomalies, deployment_plan, overview, ranked, site_detail, site_summary
from .guidelines import guidelines
from .insights import class_matrix, data_summary, notifications

app = FastAPI(
    title="Bhopal Jal Drishti API",
    description="Ranks Bhopal immersion ghats by CPCB Class B breaches in MPPCB 2023-2025 reports.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class BriefRequest(BaseModel):
    site_id: str = Field(..., description="Ghat id from /api/ghats/ranked, or 'all' for a city-wide brief")
    use_ai: bool = True
    issues: list[str] | None = Field(None, description="Subset of: do, bod, ph, gaps, name")
    manager: str | None = Field(None, max_length=120, description="Ghat manager the brief is addressed to")
    note: str | None = Field(None, max_length=1000, description="Officer's own note, appended verbatim (never sent to AI)")
    language: Literal["en", "hi", "both"] = "both"
    instruction: str | None = Field(None, max_length=600, description="Ask Claude to revise `previous`")
    previous: str | None = Field(None, max_length=8000)
    audience: Literal["bmc", "police", "public"] = "bmc"


@app.get("/api/health")
def health():
    return {
        "ok": True,
        "dataset": DATASET_FILE,
        "ai_enabled": bool(ANTHROPIC_API_KEY),
        "ai_model": ANTHROPIC_MODEL if ANTHROPIC_API_KEY else None,
    }


@app.get("/api/overview")
def get_overview():
    return overview()


@app.get("/api/ghats/ranked")
def get_ranked():
    return {"ghats": ranked(), "overview": overview()}


@app.get("/api/ghats/{site_id}")
def get_ghat(site_id: str):
    if site_id not in SITE_BY_ID:
        raise HTTPException(404, f"Unknown ghat '{site_id}'. Valid ids: {', '.join(SITE_BY_ID)}")
    return site_detail(site_id)


@app.get("/api/anomalies")
def get_anomalies():
    items = anomalies()
    return {
        "anomalies": items,
        "counts": {c: sum(1 for a in items if a["category"] == c) for c in ("gap", "verify", "ambiguity", "scope")},
    }


@app.post("/api/brief/generate")
def post_brief(req: BriefRequest):
    if req.site_id != "all" and req.site_id not in SITE_BY_ID:
        raise HTTPException(404, f"Unknown ghat '{req.site_id}'")
    return generate_brief(
        req.site_id, use_ai=req.use_ai, issues=req.issues, manager=req.manager, note=req.note,
        language=req.language, instruction=req.instruction, previous=req.previous, audience=req.audience,
    )


@app.get("/api/plan")
def get_plan():
    return deployment_plan()


@app.get("/api/cpcb/matrix")
def get_class_matrix():
    return class_matrix()


@app.get("/api/data/summary")
def get_data_summary():
    return data_summary()


@app.get("/api/guidelines")
def get_guidelines():
    return guidelines()


@app.get("/api/notifications")
def get_notifications():
    return {"items": notifications()}


@app.post("/api/refresh")
def refresh():
    """Re-read the CSVs and recompute everything (use after replacing files in data/)."""
    for fn in (load_readings, load_cpcb, load_locations, site_summary, site_detail, ranked, deployment_plan, overview, anomalies,
               _all_years, class_matrix, data_summary):
        fn.cache_clear()
    o = overview()
    return {"ok": True, "rows": o["rows"], "anomalies": o["anomalies_total"]}


@app.get("/api/pdf/{year}")
def get_pdf(year: int):
    meta = REPORT_PDFS.get(year)
    if not meta:
        raise HTTPException(404, "No report for that year")
    path = RESOURCES_DIR / meta["file"]
    if not path.exists():
        raise HTTPException(404, f"PDF not found locally. Public copy: {meta['url']}")
    return FileResponse(path, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{meta["file"]}"'})


# Serve the built React app (frontend/dist) from the same port when it exists.
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        candidate = FRONTEND_DIST / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(FRONTEND_DIST / "index.html")
