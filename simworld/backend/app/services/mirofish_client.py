"""
HTTP client for communicating with the MiroFish engine.
Handles the full pipeline: ontology → graph → simulation → report.
All async operations use the poll-until-done pattern.
"""

import asyncio
import logging
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

POLL_INTERVAL = 3  # seconds between task polls
POLL_TIMEOUT = 600  # max seconds to wait for a task


class MirofishError(Exception):
    """Raised when MiroFish returns an error or is unreachable."""

    def __init__(self, message: str, status_code: int = 0, detail: str = ""):
        self.message = message
        self.status_code = status_code
        self.detail = detail
        super().__init__(message)


class MirofishClient:
    """Real MiroFish API client for the full simulation pipeline."""

    def __init__(self):
        settings = get_settings()
        self.base_url = settings.MIROFISH_BASE_URL
        self.client = httpx.AsyncClient(base_url=self.base_url, timeout=300.0)

    # ─── Health ───────────────────────────────────────────────────

    async def health_check(self) -> bool:
        """Check if MiroFish is reachable."""
        try:
            resp = await self.client.get("/api/graph/project/list?limit=1", timeout=5.0)
            return resp.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException):
            return False

    # ─── Helpers ──────────────────────────────────────────────────

    def _check_response(self, resp: httpx.Response, context: str) -> dict:
        """Validate response and return parsed JSON."""
        if resp.status_code >= 400:
            detail = ""
            try:
                body = resp.json()
                detail = body.get("error", body.get("message", ""))
            except Exception:
                detail = resp.text[:500]
            raise MirofishError(
                f"MiroFish {context} failed (HTTP {resp.status_code})",
                status_code=resp.status_code,
                detail=detail,
            )
        data = resp.json()
        if isinstance(data, dict) and data.get("success") is False:
            raise MirofishError(
                f"MiroFish {context} returned error",
                detail=data.get("error", str(data)),
            )
        return data

    async def _poll_task(
        self,
        task_id: str,
        context: str = "task",
        on_progress: Optional[callable] = None,
    ) -> dict:
        """
        Poll GET /api/graph/task/{task_id} until completed or failed.
        Returns the task result on success.
        Calls on_progress(progress, message) if provided.
        """
        elapsed = 0
        while elapsed < POLL_TIMEOUT:
            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

            try:
                resp = await self.client.get(f"/api/graph/task/{task_id}")
                data = self._check_response(resp, f"poll {context}")
            except MirofishError:
                raise
            except Exception as e:
                logger.warning(f"Poll error for {context}: {e}")
                continue

            task = data.get("data", data)
            status = task.get("status", "")
            progress = task.get("progress", 0)
            message = task.get("message", "")

            if on_progress:
                try:
                    on_progress(progress, message)
                except Exception:
                    pass

            if status == "completed":
                logger.info(f"Task {context} completed: {task_id}")
                return task.get("result", task)
            elif status == "failed":
                error = task.get("error", "Unknown error")
                raise MirofishError(f"MiroFish {context} failed: {error}", detail=error)

        raise MirofishError(f"MiroFish {context} timed out after {POLL_TIMEOUT}s")

    async def _poll_prepare_status(
        self,
        task_id: str,
        simulation_id: str,
        on_progress: Optional[callable] = None,
    ) -> dict:
        """Poll POST /api/simulation/prepare/status for preparation tasks."""
        elapsed = 0
        while elapsed < POLL_TIMEOUT:
            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

            try:
                resp = await self.client.post(
                    "/api/simulation/prepare/status",
                    json={"task_id": task_id, "simulation_id": simulation_id},
                )
                data = self._check_response(resp, "poll prepare")
            except MirofishError:
                raise
            except Exception as e:
                logger.warning(f"Poll prepare error: {e}")
                continue

            task = data.get("data", data)
            status = task.get("status", "")
            progress = task.get("progress", 0)
            message = task.get("message", "")

            if on_progress:
                try:
                    on_progress(progress, message)
                except Exception:
                    pass

            if status == "completed":
                return task.get("result", task)
            elif status == "failed":
                error = task.get("error", "Unknown error")
                raise MirofishError(f"Simulation prepare failed: {error}", detail=error)

        raise MirofishError(f"Simulation prepare timed out after {POLL_TIMEOUT}s")

    async def _poll_run_status(
        self,
        simulation_id: str,
        on_progress: Optional[callable] = None,
    ) -> dict:
        """Poll GET /api/simulation/{id}/run-status until completed."""
        elapsed = 0
        while elapsed < POLL_TIMEOUT:
            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

            try:
                resp = await self.client.get(
                    f"/api/simulation/{simulation_id}/run-status"
                )
                data = self._check_response(resp, "poll run-status")
            except MirofishError:
                raise
            except Exception as e:
                logger.warning(f"Poll run-status error: {e}")
                continue

            run = data.get("data", data)
            status = run.get("runner_status", "")
            progress = run.get("progress_percent", 0)
            current = run.get("current_round", 0)
            total = run.get("total_rounds", 0)

            if on_progress:
                try:
                    on_progress(progress, f"Round {current}/{total}")
                except Exception:
                    pass

            if status == "completed":
                return run
            elif status in ("failed", "stopped"):
                error = run.get("error", f"Simulation {status}")
                raise MirofishError(f"Simulation {status}: {error}", detail=error)

        raise MirofishError(f"Simulation run timed out after {POLL_TIMEOUT}s")

    async def _poll_report_status(
        self,
        task_id: str,
        simulation_id: str,
        on_progress: Optional[callable] = None,
    ) -> dict:
        """Poll POST /api/report/generate/status for report generation."""
        elapsed = 0
        while elapsed < POLL_TIMEOUT:
            await asyncio.sleep(POLL_INTERVAL)
            elapsed += POLL_INTERVAL

            try:
                resp = await self.client.post(
                    "/api/report/generate/status",
                    json={"task_id": task_id, "simulation_id": simulation_id},
                )
                data = self._check_response(resp, "poll report")
            except MirofishError:
                raise
            except Exception as e:
                logger.warning(f"Poll report error: {e}")
                continue

            task = data.get("data", data)
            status = task.get("status", "")
            progress = task.get("progress", 0)
            message = task.get("message", "")

            if on_progress:
                try:
                    on_progress(progress, message)
                except Exception:
                    pass

            if status in ("completed", "ready"):
                return task.get("result", task)
            elif status == "failed":
                error = task.get("error", "Unknown error")
                raise MirofishError(f"Report generation failed: {error}", detail=error)

        raise MirofishError(f"Report generation timed out after {POLL_TIMEOUT}s")

    # ─── Step 1: Upload & Ontology ────────────────────────────────

    async def generate_ontology(
        self,
        files: list[tuple[str, bytes, str]],
        simulation_requirement: str,
        project_name: str = "SimWorld Project",
        additional_context: str = "",
    ) -> dict:
        """
        Upload files and generate ontology. SYNCHRONOUS call (blocks until LLM returns).

        Args:
            files: List of (filename, content_bytes, content_type) tuples
            simulation_requirement: What to simulate (maps from prediction_question)
            project_name: Project name
            additional_context: Extra context for ontology

        Returns:
            {project_id, project_name, ontology, analysis_summary, files, total_text_length}
        """
        form_files = [("files", (fname, content, ctype)) for fname, content, ctype in files]
        form_data = {
            "simulation_requirement": simulation_requirement,
            "project_name": project_name,
        }
        if additional_context:
            form_data["additional_context"] = additional_context

        resp = await self.client.post(
            "/api/graph/ontology/generate",
            files=form_files,
            data=form_data,
            timeout=120.0,  # ontology gen can be slow
        )
        data = self._check_response(resp, "generate ontology")
        return data.get("data", data)

    # ─── Step 2: Build Graph ──────────────────────────────────────

    async def build_graph(
        self,
        project_id: str,
        graph_name: str = "SimWorld Graph",
        on_progress: Optional[callable] = None,
    ) -> dict:
        """
        Build knowledge graph. ASYNC — polls until done.

        Returns:
            {project_id, graph_id, node_count, edge_count, chunk_count}
        """
        resp = await self.client.post(
            "/api/graph/build",
            json={"project_id": project_id, "graph_name": graph_name},
        )
        data = self._check_response(resp, "build graph")
        task_id = data.get("data", data).get("task_id")
        if not task_id:
            raise MirofishError("No task_id returned from build graph")

        return await self._poll_task(task_id, "build graph", on_progress)

    # ─── Step 3: Create Simulation ────────────────────────────────

    async def create_simulation(
        self,
        project_id: str,
        graph_id: Optional[str] = None,
        enable_twitter: bool = True,
        enable_reddit: bool = True,
    ) -> dict:
        """
        Create a new simulation. SYNCHRONOUS.

        Returns:
            {simulation_id, project_id, graph_id, status, enable_twitter, enable_reddit}
        """
        body = {
            "project_id": project_id,
            "enable_twitter": enable_twitter,
            "enable_reddit": enable_reddit,
        }
        if graph_id:
            body["graph_id"] = graph_id

        resp = await self.client.post("/api/simulation/create", json=body)
        data = self._check_response(resp, "create simulation")
        return data.get("data", data)

    # ─── Step 4: Prepare Simulation ───────────────────────────────

    async def prepare_simulation(
        self,
        simulation_id: str,
        entity_types: Optional[list[str]] = None,
        use_llm_for_profiles: bool = True,
        on_progress: Optional[callable] = None,
    ) -> dict:
        """
        Prepare simulation environment (generate profiles, config). ASYNC — polls until done.

        Returns preparation result.
        """
        body: dict = {
            "simulation_id": simulation_id,
            "use_llm_for_profiles": use_llm_for_profiles,
        }
        if entity_types:
            body["entity_types"] = entity_types

        resp = await self.client.post("/api/simulation/prepare", json=body)
        data = self._check_response(resp, "prepare simulation")

        inner = data.get("data", data)
        # If already prepared, return immediately
        if inner.get("already_prepared"):
            return inner

        task_id = inner.get("task_id")
        if not task_id:
            raise MirofishError("No task_id returned from prepare simulation")

        return await self._poll_prepare_status(task_id, simulation_id, on_progress)

    # ─── Step 5: Run Simulation ───────────────────────────────────

    async def start_simulation(
        self,
        simulation_id: str,
        platform: str = "parallel",
        max_rounds: Optional[int] = None,
        on_progress: Optional[callable] = None,
    ) -> dict:
        """
        Start and monitor simulation. ASYNC — polls run-status until done.

        Args:
            platform: "twitter", "reddit", or "parallel" (both)
            max_rounds: Cap on simulation rounds (None = use MiroFish default)

        Returns run-status result on completion.
        """
        body: dict = {"simulation_id": simulation_id, "platform": platform}
        if max_rounds:
            body["max_rounds"] = max_rounds

        resp = await self.client.post("/api/simulation/start", json=body)
        self._check_response(resp, "start simulation")

        return await self._poll_run_status(simulation_id, on_progress)

    async def stop_simulation(self, simulation_id: str) -> dict:
        """Stop a running simulation."""
        resp = await self.client.post(
            "/api/simulation/stop", json={"simulation_id": simulation_id}
        )
        return self._check_response(resp, "stop simulation")

    # ─── Step 6: Generate Report ──────────────────────────────────

    async def generate_report(
        self,
        simulation_id: str,
        on_progress: Optional[callable] = None,
    ) -> dict:
        """
        Generate analysis report. ASYNC — polls until done.

        Returns:
            {report_id, simulation_id, status, ...}
        """
        resp = await self.client.post(
            "/api/report/generate", json={"simulation_id": simulation_id}
        )
        data = self._check_response(resp, "generate report")
        inner = data.get("data", data)

        # If already generated
        if inner.get("already_generated") and inner.get("report_id"):
            return inner

        task_id = inner.get("task_id")
        if not task_id:
            raise MirofishError("No task_id returned from generate report")

        return await self._poll_report_status(task_id, simulation_id, on_progress)

    # ─── Report Access ────────────────────────────────────────────

    async def get_report(self, report_id: str) -> dict:
        """Get full report content."""
        resp = await self.client.get(f"/api/report/{report_id}")
        data = self._check_response(resp, "get report")
        return data.get("data", data)

    async def get_report_by_simulation(self, simulation_id: str) -> dict:
        """Get report by simulation ID."""
        resp = await self.client.get(f"/api/report/by-simulation/{simulation_id}")
        data = self._check_response(resp, "get report by simulation")
        return data.get("data", data)

    # ─── Data Access ──────────────────────────────────────────────

    async def get_simulation_state(self, simulation_id: str) -> dict:
        """Get simulation state."""
        resp = await self.client.get(f"/api/simulation/{simulation_id}")
        data = self._check_response(resp, "get simulation")
        return data.get("data", data)

    async def get_profiles(
        self, simulation_id: str, platform: str = "twitter"
    ) -> list[dict]:
        """Get agent profiles for a simulation."""
        resp = await self.client.get(
            f"/api/simulation/{simulation_id}/profiles",
            params={"platform": platform},
        )
        data = self._check_response(resp, "get profiles")
        return data.get("data", data)

    async def get_run_status(self, simulation_id: str) -> dict:
        """Get current run status (single poll)."""
        resp = await self.client.get(
            f"/api/simulation/{simulation_id}/run-status"
        )
        data = self._check_response(resp, "get run-status")
        return data.get("data", data)

    async def get_actions(
        self,
        simulation_id: str,
        platform: str = "twitter",
        limit: int = 100,
        offset: int = 0,
        agent_id: Optional[int] = None,
        round_num: Optional[int] = None,
    ) -> dict:
        """Get agent action history."""
        params: dict = {"platform": platform, "limit": limit, "offset": offset}
        if agent_id is not None:
            params["agent_id"] = agent_id
        if round_num is not None:
            params["round_num"] = round_num

        resp = await self.client.get(
            f"/api/simulation/{simulation_id}/actions", params=params
        )
        data = self._check_response(resp, "get actions")
        return data.get("data", data)

    async def get_timeline(
        self, simulation_id: str, start_round: int = 0, end_round: int = 0
    ) -> dict:
        """Get per-round summary timeline."""
        params: dict = {}
        if start_round:
            params["start_round"] = start_round
        if end_round:
            params["end_round"] = end_round

        resp = await self.client.get(
            f"/api/simulation/{simulation_id}/timeline", params=params
        )
        data = self._check_response(resp, "get timeline")
        return data.get("data", data)

    async def get_agent_stats(self, simulation_id: str) -> dict:
        """Get per-agent statistics."""
        resp = await self.client.get(
            f"/api/simulation/{simulation_id}/agent-stats"
        )
        data = self._check_response(resp, "get agent-stats")
        return data.get("data", data)

    async def get_posts(
        self,
        simulation_id: str,
        platform: str = "twitter",
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Get posts from simulation database."""
        resp = await self.client.get(
            f"/api/simulation/{simulation_id}/posts",
            params={"platform": platform, "limit": limit, "offset": offset},
        )
        data = self._check_response(resp, "get posts")
        return data.get("data", data)

    async def get_graph_data(self, graph_id: str) -> dict:
        """Get graph nodes and edges from Zep."""
        resp = await self.client.get(f"/api/graph/data/{graph_id}")
        data = self._check_response(resp, "get graph data")
        return data.get("data", data)

    async def get_simulation_config(self, simulation_id: str) -> dict:
        """Get LLM-generated simulation config."""
        resp = await self.client.get(f"/api/simulation/{simulation_id}/config")
        data = self._check_response(resp, "get config")
        return data.get("data", data)

    # ─── Interaction ──────────────────────────────────────────────

    async def interview_agent(
        self,
        simulation_id: str,
        agent_id: int,
        prompt: str,
        platform: str = "twitter",
        timeout: int = 60,
    ) -> dict:
        """Interview a single agent in character."""
        resp = await self.client.post(
            "/api/simulation/interview",
            json={
                "simulation_id": simulation_id,
                "agent_id": agent_id,
                "prompt": prompt,
                "platform": platform,
                "timeout": timeout,
            },
            timeout=float(timeout + 10),
        )
        data = self._check_response(resp, "interview agent")
        return data.get("data", data)

    async def chat_with_report_agent(
        self, simulation_id: str, message: str, chat_history: Optional[list] = None
    ) -> dict:
        """Chat with the report agent about simulation results."""
        resp = await self.client.post(
            "/api/report/chat",
            json={
                "simulation_id": simulation_id,
                "message": message,
                "chat_history": chat_history or [],
            },
        )
        data = self._check_response(resp, "chat with report agent")
        return data.get("data", data)

    # ─── Cleanup ──────────────────────────────────────────────────

    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
