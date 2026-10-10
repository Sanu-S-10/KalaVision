from fastapi import APIRouter, Body, Query, Response

from app.services.report_service import build_report_model, render_csv, render_json, render_pdf
from app.services.session_store import session_store
from app.utils.exceptions import bad_request, not_found

router = APIRouter(prefix="/api/performances", tags=["reports"])

_MEDIA_TYPES = {
    "json": "application/json",
    "csv": "text/csv",
    "pdf": "application/pdf",
}


@router.get("/{performance_id}/report")
async def export_report(
    performance_id: str,
    format: str = Query(default="json", pattern="^(json|csv|pdf)$"),
):
    """Exports a performance session as a professional report: info,
    duration, detected mudras/expressions, confidence stats, detection
    timeline, and story interpretation — suitable for demonstration.
    Formats: json, csv, pdf."""
    session = session_store.get_session(performance_id)
    if not session:
        raise not_found("Performance")

    detections = [d for d in session.get("detections", []) if not d.get("is_deleted")]
    story_events = session.get("story_events", [])

    if not detections:
        raise bad_request("This performance has no detections yet — nothing to report.")

    model = build_report_model(session, detections, story_events)
    filename_base = f"kalavision_report_{performance_id}"

    if format == "json":
        content = render_json(model)
    elif format == "csv":
        content = render_csv(model)
    else:
        content = render_pdf(model)

    return Response(
        content=content,
        media_type=_MEDIA_TYPES[format],
        headers={"Content-Disposition": f'attachment; filename="{filename_base}.{format}"'},
    )


@router.post("/report/generate")
async def generate_report_from_data(
    payload: dict = Body(...),
    format: str = Query(default="pdf", pattern="^(json|csv|pdf)$"),
):
    """Directly generates a report from provided analysis results without
    requiring session or database persistence."""
    performance = payload.get("performance", {"title": "KalaVision Analysis", "mode": "video", "status": "completed"})
    detections = payload.get("detections", [])
    story_events = payload.get("story_events", [])

    if not detections:
        raise bad_request("At least one detection is required to generate a report.")

    model = build_report_model(performance, detections, story_events)
    filename_base = "kalavision_performance_report"

    if format == "json":
        content = render_json(model)
    elif format == "csv":
        content = render_csv(model)
    else:
        content = render_pdf(model)

    return Response(
        content=content,
        media_type=_MEDIA_TYPES[format],
        headers={"Content-Disposition": f'attachment; filename="{filename_base}.{format}"'},
    )
