"""
PDF report generator for SimWorld simulation results.
Uses fpdf2 to create a clean executive report.
"""

import io
from fpdf import FPDF


class SimWorldPDF(FPDF):
    """Custom PDF with SimWorld branding."""

    def header(self):
        self.set_font("Helvetica", "B", 10)
        self.set_text_color(99, 102, 241)  # primary indigo
        self.cell(0, 8, "SimWorld Report", align="L")
        self.ln(4)
        self.set_draw_color(30, 30, 46)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(6)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "", 8)
        self.set_text_color(136, 136, 160)
        self.cell(0, 10, f"Page {self.page_no()}/{{nb}}", align="C")


def generate_report_pdf(job: dict) -> bytes:
    """Generate a PDF report from a completed simulation job."""
    result = job.get("result", {})
    summary = result.get("executive_summary", {})
    stats = result.get("stats", {})
    narratives = result.get("narratives", [])
    inflection_points = result.get("inflection_points", [])
    agents = result.get("agents", [])

    pdf = SimWorldPDF()
    pdf.alias_nb_pages()
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    # Title
    pdf.set_font("Helvetica", "B", 22)
    pdf.set_text_color(228, 228, 239)
    pdf.cell(0, 12, _safe(job.get("project_name", "Simulation Report")), new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)

    # Prediction question
    pdf.set_font("Helvetica", "", 11)
    pdf.set_text_color(136, 136, 160)
    pdf.multi_cell(0, 6, _safe(job.get("prediction_question", "")))
    pdf.ln(4)

    # Meta info line
    pdf.set_font("Helvetica", "", 9)
    meta = f"{stats.get('total_agents', 0)} agents  |  {stats.get('total_rounds', 0)} rounds  |  {stats.get('total_posts', 0)} posts  |  {job.get('geography', 'US')}  |  {job.get('audience', 'general_public')}"
    pdf.cell(0, 5, meta, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)

    # ── Executive Summary ──────────────────────────────
    _section_heading(pdf, "Executive Summary")

    # Summary cards in a row
    sentiment = summary.get("overall_sentiment", "mixed").capitalize()
    risk = summary.get("risk_tier", "medium").upper()
    confidence = f"{round(summary.get('confidence', 0) * 100)}%"
    score = summary.get("sentiment_score", 0)

    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(228, 228, 239)
    col_w = 45
    pdf.cell(col_w, 6, f"Sentiment: {sentiment}", new_x="RIGHT")
    pdf.cell(col_w, 6, f"Risk: {risk}", new_x="RIGHT")
    pdf.cell(col_w, 6, f"Confidence: {confidence}", new_x="RIGHT")
    pdf.cell(col_w, 6, f"Score: {score:+.2f}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # Sentiment breakdown
    breakdown = stats.get("sentiment_breakdown", {})
    if breakdown:
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(136, 136, 160)
        parts = [f"{k}: {v}" for k, v in breakdown.items()]
        pdf.cell(0, 5, "Sentiment breakdown: " + "  |  ".join(parts), new_x="LMARGIN", new_y="NEXT")
        pdf.ln(4)

    # ── Top Narratives ─────────────────────────────────
    _section_heading(pdf, "Top Narratives")

    for i, label in enumerate(summary.get("top_narratives", [])[:5]):
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(228, 228, 239)
        pdf.cell(0, 6, f"  {i + 1}. {_safe(label)}", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    # ── Narrative Details ──────────────────────────────
    if narratives:
        _section_heading(pdf, "Narrative Details")
        for n in narratives:
            pdf.set_font("Helvetica", "B", 10)
            pdf.set_text_color(228, 228, 239)
            pdf.cell(0, 6, f"{_safe(n['label'])}  ({n.get('agent_count', 0)} agents, {n.get('sentiment', 'neutral')})", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(136, 136, 160)
            pdf.multi_cell(0, 5, _safe(n.get("description", "")))
            themes = n.get("key_themes", [])
            if themes:
                pdf.set_font("Helvetica", "I", 8)
                pdf.cell(0, 5, "Themes: " + ", ".join(themes), new_x="LMARGIN", new_y="NEXT")
            pdf.ln(3)

    # ── Key Inflection Points ──────────────────────────
    if inflection_points:
        _section_heading(pdf, "Key Inflection Points")
        for ip in inflection_points:
            shift = ip.get("sentiment_shift", 0)
            shift_str = f"+{shift}" if shift > 0 else str(shift)
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(99, 102, 241)
            pdf.cell(20, 5, f"Round {ip['round']}", new_x="RIGHT")
            pdf.set_font("Helvetica", "", 9)
            pdf.set_text_color(228, 228, 239)
            pdf.cell(0, 5, f"{_safe(ip['description'])}  (shift: {shift_str})", new_x="LMARGIN", new_y="NEXT")
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(136, 136, 160)
            pdf.cell(0, 4, f"    Trigger: {_safe(ip.get('trigger', ''))}", new_x="LMARGIN", new_y="NEXT")
            pdf.ln(2)

    # ── Recommended Actions ────────────────────────────
    actions = summary.get("recommended_actions", [])
    if actions:
        _section_heading(pdf, "Recommended Actions")
        for i, action in enumerate(actions):
            pdf.set_font("Helvetica", "B", 9)
            pdf.set_text_color(99, 102, 241)
            pdf.cell(8, 6, f"{i + 1}.", new_x="RIGHT")
            pdf.set_font("Helvetica", "", 10)
            pdf.set_text_color(228, 228, 239)
            x = pdf.get_x()
            pdf.multi_cell(0, 6, _safe(action))
            pdf.set_x(10)
            pdf.ln(1)
        pdf.ln(3)

    # ── Top Agents ─────────────────────────────────────
    if agents:
        _section_heading(pdf, "Top Agents by Influence")
        top = sorted(agents, key=lambda a: a.get("influence_score", 0), reverse=True)[:15]

        # Table header
        pdf.set_font("Helvetica", "B", 8)
        pdf.set_text_color(136, 136, 160)
        pdf.cell(50, 5, "Name", new_x="RIGHT")
        pdf.cell(40, 5, "Role", new_x="RIGHT")
        pdf.cell(25, 5, "Platform", new_x="RIGHT")
        pdf.cell(25, 5, "Sentiment", new_x="RIGHT")
        pdf.cell(20, 5, "Influence", new_x="RIGHT")
        pdf.cell(20, 5, "Posts", new_x="LMARGIN", new_y="NEXT")

        for agent in top:
            pdf.set_font("Helvetica", "", 8)
            pdf.set_text_color(228, 228, 239)
            pdf.cell(50, 5, _safe(agent.get("name", "")[:25]), new_x="RIGHT")
            pdf.cell(40, 5, _safe(agent.get("role", "")[:20]), new_x="RIGHT")
            pdf.cell(25, 5, agent.get("platform", ""), new_x="RIGHT")
            pdf.cell(25, 5, agent.get("sentiment", ""), new_x="RIGHT")
            pdf.cell(20, 5, str(agent.get("influence_score", 0)), new_x="RIGHT")
            pdf.cell(20, 5, str(agent.get("posts_count", 0)), new_x="LMARGIN", new_y="NEXT")

    # Generate bytes
    buf = io.BytesIO()
    pdf.output(buf)
    return buf.getvalue()


def _section_heading(pdf: FPDF, text: str):
    """Render a section heading."""
    pdf.ln(2)
    pdf.set_draw_color(30, 30, 46)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(4)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(228, 228, 239)
    pdf.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)


def _safe(text: str) -> str:
    """Sanitize text for PDF output (remove unsupported chars)."""
    if not text:
        return ""
    return text.encode("latin-1", errors="replace").decode("latin-1")
