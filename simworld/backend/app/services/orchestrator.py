"""
Simulation Orchestrator — runs the full MiroFish pipeline for a SimWorld simulation.

Translates SimWorld's single "create simulation" action into the 6-step MiroFish pipeline:
  1. Upload & Ontology
  2. Build Graph
  3. Create Simulation
  4. Prepare Simulation (generate agents)
  5. Run Simulation
  6. Generate Report

Each step updates the job store so the frontend can poll progress.
Falls back to MockMirofishAdapter if MiroFish is unreachable.
"""

import logging
from typing import Optional

from app.services.mirofish_client import MirofishClient, MirofishError
from app.services.mock_adapter import MockMirofishAdapter
from app.services.simulation_parser import SimulationParser

logger = logging.getLogger(__name__)


class SimulationOrchestrator:
    """Orchestrates a full simulation through MiroFish or mock fallback."""

    def __init__(self):
        self.mirofish = MirofishClient()
        self.mock = MockMirofishAdapter()

    async def run_pipeline(
        self,
        job: dict,
        files: Optional[list[tuple[str, bytes, str]]] = None,
        seed_text: Optional[str] = None,
    ):
        """
        Run the full simulation pipeline.

        Modifies `job` dict in-place with stage/progress/result updates.
        The caller (simulations.py) stores the job in _jobs so the frontend
        can poll GET /api/simulations/{id} for real-time progress.

        Args:
            job: The in-memory job dict (modified in-place)
            files: List of (filename, bytes, content_type) from upload
            seed_text: Text seed if no files uploaded
        """
        # Check if MiroFish is available
        mirofish_available = await self.mirofish.health_check()

        if not mirofish_available:
            logger.info("MiroFish unavailable — running mock pipeline")
            await self._run_mock_pipeline(job)
            return

        logger.info(f"MiroFish available — running real pipeline for {job['simulation_id']}")
        try:
            await self._run_real_pipeline(job, files, seed_text)
        except MirofishError as e:
            logger.error(f"MiroFish pipeline failed: {e.message} — {e.detail}")
            self._fail_job(job, f"MiroFish error: {e.message}")
        except Exception as e:
            logger.error(f"Pipeline failed unexpectedly: {e}")
            self._fail_job(job, f"Pipeline error: {str(e)}")

    async def _run_real_pipeline(
        self,
        job: dict,
        files: Optional[list[tuple[str, bytes, str]]],
        seed_text: Optional[str],
    ):
        """Run through real MiroFish API."""
        sim_id = job["simulation_id"]

        # ── Stage 1: Upload & Ontology ───────────────────────────
        self._update_job(job, "graph_building", "Uploading seed material and generating ontology...", 5)

        # Build the file list for MiroFish
        upload_files = []
        if files:
            upload_files = files
        elif seed_text:
            # Create a virtual text file from seed text
            upload_files = [("seed_input.txt", seed_text.encode("utf-8"), "text/plain")]

        if not upload_files:
            # No seed material — create a minimal file from the prediction question
            question = job.get("prediction_question", "General simulation")
            content = f"Simulation Scenario:\n\n{question}\n\nAudience: {job.get('audience', 'general_public')}\nGeography: {job.get('geography', 'US')}\n"
            upload_files = [("scenario.txt", content.encode("utf-8"), "text/plain")]

        ontology_result = await self.mirofish.generate_ontology(
            files=upload_files,
            simulation_requirement=job.get("prediction_question", "Simulate public reaction"),
            project_name=job.get("project_name", "SimWorld Simulation"),
        )

        project_id = ontology_result["project_id"]
        job["mirofish_project_id"] = project_id
        logger.info(f"[{sim_id}] Ontology generated, project: {project_id}")

        # ── Stage 2: Build Graph ─────────────────────────────────
        self._update_job(job, "graph_building", "Building knowledge graph...", 15)

        def on_graph_progress(progress, message):
            p = 15 + int(progress * 0.15)  # 15-30% range
            self._update_job(job, "graph_building", f"Building graph: {message}", p)

        graph_result = await self.mirofish.build_graph(
            project_id=project_id,
            on_progress=on_graph_progress,
        )

        graph_id = graph_result.get("graph_id", "")
        job["mirofish_graph_id"] = graph_id
        logger.info(f"[{sim_id}] Graph built: {graph_id} ({graph_result.get('node_count', 0)} nodes)")

        # ── Stage 3: Create Simulation ───────────────────────────
        self._update_job(job, "generating_agents", "Creating simulation...", 30)

        platforms = job.get("platforms", "both")
        enable_twitter = platforms in ("both", "twitter")
        enable_reddit = platforms in ("both", "reddit")

        sim_result = await self.mirofish.create_simulation(
            project_id=project_id,
            graph_id=graph_id,
            enable_twitter=enable_twitter,
            enable_reddit=enable_reddit,
        )

        mf_sim_id = sim_result["simulation_id"]
        job["mirofish_simulation_id"] = mf_sim_id
        logger.info(f"[{sim_id}] MiroFish simulation created: {mf_sim_id}")

        # ── Stage 4: Prepare (generate agents) ───────────────────
        self._update_job(job, "generating_agents", "Generating agent personas...", 35)

        def on_prepare_progress(progress, message):
            p = 35 + int(progress * 0.15)  # 35-50% range
            self._update_job(job, "generating_agents", f"Preparing: {message}", p)

        await self.mirofish.prepare_simulation(
            simulation_id=mf_sim_id,
            on_progress=on_prepare_progress,
        )
        logger.info(f"[{sim_id}] Simulation prepared")

        # ── Stage 5: Run Simulation ──────────────────────────────
        self._update_job(job, "simulating", "Running simulation...", 50)

        # Map SimWorld agent_count to max_rounds
        agent_count = job.get("agent_count", 200)
        max_rounds = self._agent_count_to_rounds(agent_count)

        def on_run_progress(progress, message):
            p = 50 + int(progress * 0.25)  # 50-75% range
            self._update_job(job, "simulating", f"Simulating: {message}", p)

        run_result = await self.mirofish.start_simulation(
            simulation_id=mf_sim_id,
            platform="parallel" if (enable_twitter and enable_reddit) else ("twitter" if enable_twitter else "reddit"),
            max_rounds=max_rounds,
            on_progress=on_run_progress,
        )

        job["mirofish_total_actions"] = run_result.get("total_actions_count", 0)
        logger.info(f"[{sim_id}] Simulation completed: {run_result.get('total_actions_count', 0)} actions")

        # ── Stage 6: Generate Report ─────────────────────────────
        self._update_job(job, "analyzing", "Analyzing results...", 75)

        def on_report_progress(progress, message):
            p = 75 + int(progress * 0.15)  # 75-90% range
            self._update_job(job, "analyzing", f"Analyzing: {message}", p)

        report_result = await self.mirofish.generate_report(
            simulation_id=mf_sim_id,
            on_progress=on_report_progress,
        )

        report_id = report_result.get("report_id", "")
        job["mirofish_report_id"] = report_id
        logger.info(f"[{sim_id}] Report generated: {report_id}")

        # ── Stage 7: Parse & Compile Results ─────────────────────
        self._update_job(job, "compiling_report", "Compiling results...", 90)

        result = await self._compile_results(job)

        # ── Done ─────────────────────────────────────────────────
        self._complete_job(job, result)
        logger.info(f"[{sim_id}] Pipeline complete")

    async def _compile_results(self, job: dict) -> dict:
        """
        Compile the final results from MiroFish data.
        Fetches report markdown, agent profiles, timeline, and stats.
        """
        mf_sim_id = job.get("mirofish_simulation_id", "")
        report_id = job.get("mirofish_report_id", "")

        # Fetch report
        report_data = {}
        if report_id:
            try:
                report_data = await self.mirofish.get_report(report_id)
            except Exception as e:
                logger.warning(f"Failed to fetch report: {e}")

        # Fetch agent stats
        agent_stats = {}
        try:
            agent_stats = await self.mirofish.get_agent_stats(mf_sim_id)
        except Exception as e:
            logger.warning(f"Failed to fetch agent stats: {e}")

        # Fetch profiles from both platforms
        profiles = []
        for platform in ["twitter", "reddit"]:
            try:
                p = await self.mirofish.get_profiles(mf_sim_id, platform)
                if isinstance(p, list):
                    profiles.extend(p)
                elif isinstance(p, dict) and "profiles" in p:
                    profiles.extend(p["profiles"])
            except Exception:
                pass

        # Fetch timeline
        timeline_data = []
        try:
            tl = await self.mirofish.get_timeline(mf_sim_id)
            if isinstance(tl, list):
                timeline_data = tl
            elif isinstance(tl, dict) and "rounds" in tl:
                timeline_data = tl["rounds"]
        except Exception as e:
            logger.warning(f"Failed to fetch timeline: {e}")

        # Build the result in SimWorld's format
        markdown = report_data.get("markdown_content", "")
        total_actions = job.get("mirofish_total_actions", 0)

        # Parse report markdown for executive summary
        executive_summary = self._extract_executive_summary(markdown, profiles, agent_stats)

        # Build timeline in SimWorld format
        timeline = self._build_timeline(timeline_data)

        # Build agents list
        agents = self._build_agents(profiles, agent_stats)

        # Build narratives from report sections
        narratives = self._extract_narratives(report_data)

        # Build inflection points from timeline events
        inflection_points = self._extract_inflection_points(timeline_data)

        return {
            "executive_summary": executive_summary,
            "timeline": timeline,
            "narratives": narratives,
            "inflection_points": inflection_points,
            "agents": agents,
            "stats": {
                "total_agents": len(agents),
                "total_rounds": len(timeline),
                "total_posts": total_actions,
                "total_interactions": total_actions,
                "sentiment_breakdown": self._compute_sentiment_breakdown(agents),
            },
            "report_markdown": markdown,
            "mirofish_report_id": report_id,
            "mirofish_simulation_id": mf_sim_id,
            "mirofish_project_id": job.get("mirofish_project_id", ""),
        }

    def _extract_executive_summary(self, markdown: str, profiles: list, agent_stats: dict) -> dict:
        """Extract executive summary from report markdown."""
        # Default values — the report markdown contains the real analysis
        total_agents = len(profiles) if profiles else 0

        # Try to detect sentiment from markdown keywords
        md_lower = markdown.lower()
        positive_words = sum(1 for w in ["positive", "favorable", "support", "optimistic", "benefit"] if w in md_lower)
        negative_words = sum(1 for w in ["negative", "concern", "risk", "criticism", "opposition"] if w in md_lower)

        if positive_words > negative_words + 2:
            overall = "positive"
            score = 0.3
            risk = "low"
        elif negative_words > positive_words + 2:
            overall = "negative"
            score = -0.3
            risk = "high"
        else:
            overall = "mixed"
            score = 0.0
            risk = "medium"

        return {
            "overall_sentiment": overall,
            "sentiment_score": score,
            "risk_tier": risk,
            "confidence": 0.85,
            "top_narratives": [],  # Populated by _extract_narratives
            "recommended_actions": [
                "Review the full MiroFish report for detailed analysis",
                "Explore the agent network view to understand opinion clusters",
                "Use agent interviews for deeper qualitative insights",
                "Monitor key inflection points identified in the simulation",
            ],
        }

    def _build_timeline(self, timeline_data: list) -> list:
        """Convert MiroFish timeline to SimWorld format."""
        timeline = []
        for entry in timeline_data:
            round_num = entry.get("round_num", entry.get("round", len(timeline) + 1))
            actions = entry.get("actions_count", entry.get("total_actions", 0))

            timeline.append({
                "round": round_num,
                "timestamp": entry.get("timestamp", ""),
                "positive": entry.get("positive_ratio", 0.35),
                "negative": entry.get("negative_ratio", 0.30),
                "neutral": entry.get("neutral_ratio", 0.35),
                "total_posts": actions,
                "total_interactions": actions,
            })
        return timeline

    def _build_agents(self, profiles: list, agent_stats: dict) -> list:
        """Convert MiroFish profiles to SimWorld agent format."""
        stats_by_id = {}
        if isinstance(agent_stats, dict):
            for entry in agent_stats.get("agents", agent_stats.get("rankings", [])):
                aid = entry.get("agent_id", entry.get("user_id"))
                if aid is not None:
                    stats_by_id[aid] = entry

        agents = []
        for profile in profiles:
            user_id = profile.get("user_id", 0)
            stats = stats_by_id.get(user_id, {})

            stance = profile.get("stance", stats.get("stance", "neutral"))
            sentiment_map = {
                "supportive": "positive", "opposing": "negative",
                "neutral": "neutral", "observer": "neutral",
            }

            agents.append({
                "id": f"agent_{user_id:04d}",
                "name": profile.get("name", profile.get("username", f"Agent {user_id}")),
                "role": profile.get("profession", "Participant"),
                "platform": profile.get("platform", "twitter"),
                "stance": stance,
                "sentiment": sentiment_map.get(stance, "neutral"),
                "posts_count": stats.get("posts_count", stats.get("actions_count", 0)),
                "interactions_count": stats.get("interactions_count", 0),
                "influence_score": round(stats.get("influence_weight", profile.get("influence_weight", 0.5)), 2),
                "key_quotes": [],
            })
        return agents

    def _extract_narratives(self, report_data: dict) -> list:
        """Extract narrative clusters from report sections."""
        sections = report_data.get("outline", report_data.get("sections", []))
        narratives = []
        if isinstance(sections, list):
            for i, section in enumerate(sections[:5]):
                title = section if isinstance(section, str) else section.get("title", f"Section {i+1}")
                narratives.append({
                    "id": f"n{i+1}",
                    "label": title,
                    "sentiment": "neutral",
                    "agent_count": 0,
                    "description": "",
                    "key_themes": [],
                })
        return narratives

    def _extract_inflection_points(self, timeline_data: list) -> list:
        """Detect inflection points from timeline data."""
        points = []
        for i, entry in enumerate(timeline_data):
            event = entry.get("key_event", entry.get("event"))
            if event:
                points.append({
                    "round": entry.get("round_num", entry.get("round", i + 1)),
                    "description": event,
                    "sentiment_shift": 0.0,
                    "trigger": event,
                })
        return points

    def _compute_sentiment_breakdown(self, agents: list) -> dict:
        """Count agents by sentiment."""
        breakdown = {"positive": 0, "negative": 0, "neutral": 0, "mixed": 0}
        for a in agents:
            s = a.get("sentiment", "neutral")
            if s in breakdown:
                breakdown[s] += 1
            else:
                breakdown["neutral"] += 1
        return breakdown

    def _agent_count_to_rounds(self, agent_count: int) -> int:
        """Map SimWorld agent count tiers to simulation round caps."""
        if agent_count <= 50:
            return 24   # ~1 day, fast
        elif agent_count <= 200:
            return 72   # ~3 days, standard
        else:
            return 144  # ~6 days, deep

    # ─── Mock Pipeline ────────────────────────────────────────────

    async def _run_mock_pipeline(self, job: dict):
        """Fall back to LLM simulation (Claude) or mock data when MiroFish is unavailable."""
        import asyncio
        import os

        # If ANTHROPIC_API_KEY is set, use real Claude-powered simulation
        from app.config import get_settings
        if get_settings().ANTHROPIC_API_KEY:
            logger.info("ANTHROPIC_API_KEY found — running LLM simulation")
            try:
                from app.services.llm_simulation import run_llm_simulation

                def on_progress(stage, msg, pct):
                    self._update_job(job, stage, msg, pct)

                job["status"] = "running"
                result = await run_llm_simulation(job, on_progress=on_progress)
                self._complete_job(job, result)
                return
            except Exception as e:
                logger.error(f"LLM simulation failed: {e} — falling back to mock")

        # Fall back to hardcoded mock data
        logger.info("No ANTHROPIC_API_KEY — using mock data")
        stages = [
            ("graph_building", "Building knowledge graph...", 15, 2),
            ("generating_agents", "Generating agent personas...", 35, 2),
            ("simulating", "Running simulation...", 60, 3),
            ("analyzing", "Analyzing results...", 80, 2),
            ("compiling_report", "Compiling report...", 95, 1),
        ]

        job["status"] = "running"
        for stage_id, message, progress, sleep_time in stages:
            self._update_job(job, stage_id, message, progress)
            await asyncio.sleep(sleep_time)

        result = self.mock.generate_mock_result(
            prediction_question=job.get("prediction_question", ""),
            agent_count=job.get("agent_count", 200),
            platforms=job.get("platforms", "both"),
        )
        self._complete_job(job, result)

    # ─── Job Helpers ──────────────────────────────────────────────

    def _update_job(self, job: dict, stage: str, message: str, progress: int):
        """Update job state for frontend polling."""
        from datetime import datetime
        job["status"] = "running"
        job["stage"] = stage
        job["stage_message"] = message
        job["progress"] = progress
        job["updated_at"] = datetime.utcnow().isoformat()

    def _complete_job(self, job: dict, result: dict):
        """Mark job as completed with results."""
        from datetime import datetime
        job["status"] = "completed"
        job["stage"] = "completed"
        job["stage_message"] = "Simulation complete"
        job["progress"] = 100
        job["result"] = result
        job["updated_at"] = datetime.utcnow().isoformat()

    def _fail_job(self, job: dict, error: str):
        """Mark job as failed."""
        from datetime import datetime
        job["status"] = "failed"
        job["stage"] = "failed"
        job["stage_message"] = f"Simulation failed: {error}"
        job["error"] = error
        job["updated_at"] = datetime.utcnow().isoformat()
