"""
SimWorld Simulation API Routes

Core endpoints for the simulation lifecycle:
- Create simulation (with file upload or text)
- Poll progress
- Get results (executive summary, timeline, agents, narratives)
- Chat with agents

Uses SimulationOrchestrator which auto-detects MiroFish availability
and falls back to mock data when needed.
"""

import logging
import uuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.responses import Response

from app.services.orchestrator import SimulationOrchestrator
from app.services.mock_adapter import MockMirofishAdapter
from app.services.pdf_export import generate_report_pdf
from app.utils.auth import get_current_user
from app.utils.supabase import get_credits_for_org, deduct_credits

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory job store (replaced by Supabase in production)
_jobs: dict = {}

# Orchestrator handles MiroFish → mock fallback
orchestrator = SimulationOrchestrator()
mock_adapter = MockMirofishAdapter()

# Plan limits: plan_id → max_agents
PLAN_AGENT_LIMITS = {"free": 50, "pro": 200, "team": 1000}


def _seed_demo_simulation():
    """Pre-load a completed demo simulation so first-time users see results immediately."""
    demo_id = "sim_demo_001"
    if demo_id in _jobs:
        return

    question = "How will the public react to a major tech company announcing an AI-powered hiring tool?"
    result = mock_adapter.generate_mock_result(
        prediction_question=question,
        agent_count=50,
        platforms="both",
    )

    # Override executive summary with a polished demo-specific version
    result["executive_summary"] = {
        "overall_sentiment": "mixed",
        "sentiment_score": -0.08,
        "risk_tier": "medium",
        "confidence": 0.84,
        "top_narratives": [
            "Privacy & Data Concerns",
            "Innovation Enthusiasts",
            "Economic Impact Worriers",
        ],
        "recommended_actions": [
            "Publish a transparency report detailing how the AI model was trained and what data it uses",
            "Partner with civil rights organizations for a third-party bias audit before launch",
            "Prepare talking points addressing job displacement fears with concrete upskilling commitments",
            "Brief key tech journalists under embargo to shape initial coverage",
        ],
    }

    _jobs[demo_id] = {
        "simulation_id": demo_id,
        "project_name": "Demo: AI Hiring Tool Announcement",
        "status": "completed",
        "stage": "complete",
        "stage_message": "Simulation complete",
        "progress": 100,
        "prediction_question": question,
        "audience": "general_public",
        "geography": "US",
        "agent_count": 50,
        "platforms": "both",
        "crisis_mode": False,
        "credits_required": 0,
        "seed_source": "text",
        "filenames": [],
        "created_at": "2026-03-29T00:00:00",
        "updated_at": "2026-03-29T00:01:30",
        "result": result,
        "error": None,
        "is_demo": True,
    }
    logger.info("Demo simulation seeded: %s", demo_id)


# Seed the demo on module load
_seed_demo_simulation()


@router.post("/create")
async def create_simulation(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(None),
    seed_text: str = Form(None),
    seed_url: str = Form(None),
    project_name: str = Form("Untitled Simulation"),
    prediction_question: str = Form(...),
    audience: str = Form("general_public"),
    geography: str = Form("US"),
    agent_count: int = Form(200),
    platforms: str = Form("both"),
    crisis_mode: bool = Form(False),
    user: dict = Depends(get_current_user),
):
    """
    Create a new simulation from uploaded seed material.
    Checks credit balance, then kicks off the pipeline via SimulationOrchestrator.
    """
    job_id = f"sim_{uuid.uuid4().hex[:12]}"
    now = datetime.utcnow().isoformat()

    # Calculate credits
    credit_map = {50: 1, 200: 4, 1000: 20}
    credits_required = credit_map.get(agent_count, 4)

    # Check plan agent limit
    max_agents = PLAN_AGENT_LIMITS.get(user.get("plan", "free"), 50)
    if agent_count > max_agents:
        raise HTTPException(
            status_code=403,
            detail=f"Your plan allows up to {max_agents} agents. Upgrade to use {agent_count}.",
        )

    # Check credit balance
    org_id = user.get("org_id", "dev_org_001")
    credits = get_credits_for_org(org_id)
    if credits["credits_remaining"] < credits_required:
        raise HTTPException(
            status_code=402,
            detail={
                "error": "Insufficient credits",
                "credits_remaining": credits["credits_remaining"],
                "credits_required": credits_required,
            },
        )

    # Deduct credits
    deduct_credits(org_id, credits_required)

    # Determine seed source and read file bytes
    seed_source = "none"
    filenames = []
    file_data: list[tuple[str, bytes, str]] = []

    if files and len(files) > 0 and files[0].filename:
        seed_source = "file"
        for f in files:
            if f.filename:
                content = await f.read()
                file_data.append((f.filename, content, f.content_type or "application/octet-stream"))
                filenames.append(f.filename)
    elif seed_text:
        seed_source = "text"
    elif seed_url:
        seed_source = "url"

    job = {
        "simulation_id": job_id,
        "project_name": project_name,
        "status": "queued",
        "stage": "queued",
        "stage_message": "Simulation queued...",
        "progress": 0,
        "prediction_question": prediction_question,
        "audience": audience,
        "geography": geography,
        "agent_count": agent_count,
        "platforms": platforms,
        "crisis_mode": crisis_mode,
        "credits_required": credits_required,
        "seed_source": seed_source,
        "filenames": filenames,
        "created_at": now,
        "updated_at": now,
        "result": None,
        "error": None,
    }
    _jobs[job_id] = job

    # Run the pipeline in background via orchestrator
    background_tasks.add_task(
        _run_pipeline,
        job_id,
        file_data if file_data else None,
        seed_text,
    )

    return {"success": True, "data": job}


async def _run_pipeline(
    job_id: str,
    files: list[tuple[str, bytes, str]] | None,
    seed_text: str | None,
):
    """Background task — delegates to SimulationOrchestrator."""
    job = _jobs.get(job_id)
    if not job:
        return

    await orchestrator.run_pipeline(job, files=files, seed_text=seed_text)


@router.get("/{simulation_id}")
async def get_simulation(simulation_id: str):
    """Get simulation status, progress, and results."""
    job = _jobs.get(simulation_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Simulation not found: {simulation_id}")
    return {"success": True, "data": job}


@router.get("/{simulation_id}/result")
async def get_simulation_result(simulation_id: str):
    """Get full simulation results (only available when status=completed)."""
    job = _jobs.get(simulation_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Simulation not found: {simulation_id}")
    if job["status"] != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"Simulation not complete. Current status: {job['status']}",
        )
    return {"success": True, "data": job["result"]}


@router.get("/{simulation_id}/pdf")
async def download_simulation_pdf(simulation_id: str):
    """Download a PDF report of the simulation results."""
    job = _jobs.get(simulation_id)
    if not job:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Simulation not complete")

    pdf_bytes = generate_report_pdf(job)
    filename = f"simworld-{simulation_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{simulation_id}/share")
async def get_share_token(simulation_id: str):
    """Generate a share token for read-only access to simulation results."""
    job = _jobs.get(simulation_id)
    if not job:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if job["status"] != "completed":
        raise HTTPException(status_code=400, detail="Simulation not complete")

    # For now, the simulation_id itself acts as the share token.
    # In production, generate a separate opaque token stored in Supabase.
    return {"success": True, "data": {"share_id": simulation_id}}


@router.get("/{simulation_id}/agents")
async def get_simulation_agents(
    simulation_id: str,
    sentiment: Optional[str] = None,
    role: Optional[str] = None,
):
    """Get agent explorer data with optional filters."""
    job = _jobs.get(simulation_id)
    if not job:
        raise HTTPException(status_code=404, detail="Simulation not found")
    if not job.get("result"):
        raise HTTPException(status_code=400, detail="Results not ready yet")

    agents = job["result"].get("agents", [])

    if sentiment:
        agents = [a for a in agents if a.get("sentiment") == sentiment]
    if role:
        agents = [a for a in agents if a.get("role") == role]

    return {"success": True, "data": {"agents": agents, "count": len(agents)}}


@router.post("/{simulation_id}/agents/{agent_id}/chat")
async def chat_with_agent(simulation_id: str, agent_id: str, body: dict):
    """Chat with a specific agent from the simulation."""
    import asyncio
    import os

    job = _jobs.get(simulation_id)
    if not job:
        raise HTTPException(status_code=404, detail="Simulation not found")

    message = body.get("message", "")

    # Use LLM-powered chat if API key is set and we have agent data
    from app.config import get_settings
    if get_settings().ANTHROPIC_API_KEY and job.get("result"):
        agents = job["result"].get("agents", [])
        agent = next((a for a in agents if a["id"] == agent_id), None)
        if agent:
            from app.services.llm_simulation import chat_with_agent as llm_chat
            question = job.get("prediction_question", "")
            reply = await asyncio.to_thread(llm_chat, agent, message, question)
            return {"success": True, "data": {"agent_id": agent_id, "message": reply}}

    # Fallback to mock
    response = mock_adapter.mock_agent_chat(agent_id, message)
    return {"success": True, "data": response}


@router.get("/")
async def list_simulations():
    """List all simulations for the current user."""
    sims = sorted(_jobs.values(), key=lambda x: x["created_at"], reverse=True)
    return {
        "success": True,
        "data": [
            {
                "simulation_id": s["simulation_id"],
                "project_name": s["project_name"],
                "status": s["status"],
                "stage": s["stage"],
                "progress": s["progress"],
                "agent_count": s["agent_count"],
                "created_at": s["created_at"],
            }
            for s in sims
        ],
        "count": len(sims),
    }
