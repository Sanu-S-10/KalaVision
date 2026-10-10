"""
Performance Report export — builds a professional summary of a completed
performance (info, duration, detected mudras/expressions, confidence
stats, detection timeline, story interpretation) in JSON, CSV, or PDF.

Kept intentionally simple: one function builds a shared "report model"
dict from the performance + its detections + its story events, and three
small functions render that same dict into each output format.
"""
import csv
from datetime import datetime, timezone
import io
import json
from collections import Counter

from fpdf import FPDF
from fpdf.enums import XPos, YPos


def build_report_model(performance: dict, detections: list[dict], story_events: list[dict]) -> dict:
    mudra_counts = Counter(d.get("mudra_name", "") for d in detections)
    expression_counts = Counter(d.get("expression_name", "") for d in detections)
    uncertain_count = sum(
        1 for d in detections if d.get("mudra_is_uncertain") or d.get("expression_is_uncertain")
    )
    corrected_count = sum(1 for d in detections if d.get("is_corrected"))

    avg_confidence = 0.0
    if detections:
        avg_confidence = round(
            sum(d.get("mudra_confidence", 0.0) + d.get("expression_confidence", 0.0) for d in detections)
            / (len(detections) * 2),
            4,
        )

    duration_seconds = None
    if performance.get("started_at") and performance.get("ended_at"):
        started = performance["started_at"]
        ended = performance["ended_at"]
        if hasattr(started, "timestamp") and hasattr(ended, "timestamp"):
            duration_seconds = (ended - started).total_seconds()
        elif isinstance(started, (int, float)) and isinstance(ended, (int, float)):
            duration_seconds = float(ended - started)

    return {
        "performance": {
            "title": performance.get("title", "KalaVision Analysis"),
            "mode": performance.get("mode", "video"),
            "status": performance.get("status", "completed"),
            "started_at": str(performance.get("started_at", "")),
            "ended_at": str(performance.get("ended_at", "")),
            "duration_seconds": duration_seconds,
        },
        "stats": {
            "total_detections": len(detections),
            "average_confidence": avg_confidence,
            "uncertain_predictions": uncertain_count,
            "corrected_predictions": corrected_count,
            "most_common_mudra": mudra_counts.most_common(1)[0][0] if mudra_counts else None,
            "most_common_expression": expression_counts.most_common(1)[0][0] if expression_counts else None,
        },
        "mudra_frequency": dict(mudra_counts),
        "expression_frequency": dict(expression_counts),
        "timeline": [
            {
                "timestamp": d.get("timestamp", 0.0),
                "mudra": d.get("mudra_name", "Unknown"),
                "mudra_confidence": d.get("mudra_confidence", 0.0),
                "expression": d.get("expression_name", "Unknown"),
                "expression_confidence": d.get("expression_confidence", 0.0),
                "interpretation": d.get("interpretation", ""),
                "mudra_source": d.get("source", "real"),
                "expression_source": d.get("expression_source", d.get("source", "real")),
                "uncertain": bool(d.get("mudra_is_uncertain") or d.get("expression_is_uncertain")),
                "corrected": bool(d.get("is_corrected")),
            }
            for d in sorted(detections, key=lambda x: x.get("timestamp", 0.0))
        ],
        "story": [
            e.get("text", "") if isinstance(e, dict) else str(e)
            for e in sorted(story_events, key=lambda x: x.get("timestamp", 0.0) if isinstance(x, dict) else 0.0)
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def render_json(model: dict) -> bytes:
    return json.dumps(model, indent=2, default=str).encode("utf-8")


def render_csv(model: dict) -> bytes:
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "timestamp", "mudra", "mudra_confidence", "mudra_source",
        "expression", "expression_confidence", "expression_source",
        "interpretation", "uncertain", "corrected",
    ])
    for row in model["timeline"]:
        writer.writerow([
            row["timestamp"], row["mudra"], row["mudra_confidence"], row["mudra_source"],
            row["expression"], row["expression_confidence"], row["expression_source"],
            row["interpretation"], row["uncertain"], row["corrected"],
        ])
    return buf.getvalue().encode("utf-8")


_UNICODE_TO_ASCII = {
    "\u2014": "-", "\u2013": "-", "\u2018": "'", "\u2019": "'",
    "\u201c": '"', "\u201d": '"', "\u2026": "...",
}


def _pdf_safe(text: str) -> str:
    for uni, ascii_eq in _UNICODE_TO_ASCII.items():
        text = text.replace(uni, ascii_eq)
    return text.encode("latin-1", errors="replace").decode("latin-1")


def render_pdf(model: dict) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "KalaVision AI - Performance Report", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "", 11)
    perf = model["performance"]
    pdf.cell(0, 8, _pdf_safe(f"Title: {perf['title']}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 8, f"Mode: {perf['mode']}   Status: {perf['status']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if perf.get("duration_seconds"):
        pdf.cell(0, 8, f"Duration: {round(perf['duration_seconds'], 1)}s", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, "Statistics", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 11)
    stats = model["stats"]
    pdf.cell(0, 7, f"Total detections: {stats['total_detections']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 7, f"Average confidence: {round(stats['average_confidence'] * 100, 1)}%", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 7, f"Uncertain predictions: {stats['uncertain_predictions']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(0, 7, f"Corrected predictions: {stats['corrected_predictions']}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if stats.get("most_common_mudra"):
        pdf.cell(0, 7, _pdf_safe(f"Most common mudra: {stats['most_common_mudra']}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    if stats.get("most_common_expression"):
        pdf.cell(0, 7, _pdf_safe(f"Most common expression: {stats['most_common_expression']}"), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, "Detection Timeline", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "", 9)
    for row in model["timeline"][:60]:
        uncertain_tag = " (uncertain)" if row["uncertain"] else ""
        corrected_tag = " (corrected)" if row["corrected"] else ""
        line = f"[{row['timestamp']:.1f}s] {row['mudra']} / {row['expression']}{uncertain_tag}{corrected_tag}"
        pdf.multi_cell(0, 5, _pdf_safe(line), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    if model.get("story"):
        pdf.ln(4)
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, "Story Interpretation", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        pdf.set_font("Helvetica", "", 9)
        for line in model["story"][:60]:
            pdf.multi_cell(0, 5, _pdf_safe(line), new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    return bytes(pdf.output())
