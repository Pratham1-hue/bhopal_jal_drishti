from pathlib import Path
import os

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

load_dotenv(BACKEND_DIR / ".env")
load_dotenv(REPO_DIR / ".env")

DATA_DIR = Path(os.getenv("DATA_DIR", REPO_DIR / "data"))
RESOURCES_DIR = Path(os.getenv("RESOURCES_DIR", REPO_DIR / "resources"))
FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", REPO_DIR / "frontend" / "dist"))

# Set DATASET=sample to prototype on the 2025-only subset.
DATASET_FILE = (
    "sample_bhopal_2025.csv" if os.getenv("DATASET", "full").lower() == "sample" else "bhopal_ghats_2023_2025.csv"
)

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5").strip()

VISARJAN_DATE = "2026-10-20"

REPORT_PDFS = {
    2025: {
        "file": "Ganesh_and_Durga_visarjan_report-2025.pdf",
        "title": "MPPCB Ganesh & Durga Visarjan Report 2025",
        "url": "https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2025.pdf",
        "pages": 92,
    },
    2024: {
        "file": "Ganesh_and_Durga_visarjan_report-2024.pdf",
        "title": "MPPCB Ganesh & Durga Visarjan Report 2024",
        "url": "https://www.mppcb.mp.gov.in/proc/mon/Ganesh_and_Durga_visarjan_report-2024.pdf",
        "pages": 118,
    },
    2023: {
        "file": "Idol_immer._Report_23_CPCB.pdf",
        "title": "MPPCB Idol Immersion Report 2023 (CPCB format)",
        "url": "https://www.mppcb.mp.gov.in/proc/mon/Idol_immer._Report_23_CPCB.pdf",
        "pages": 87,
    },
}
