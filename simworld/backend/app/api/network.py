"""
Agent Network Web View API Endpoints

Serves the graph data for the interactive agent network visualization.
Tries real MiroFish data via SimulationParser first, falls back to mock.
"""

import logging

from fastapi import APIRouter, HTTPException

from app.services.mock_network import (
    get_mock_network_data,
    get_mock_agent_detail,
    mock_agent_chat,
)
from app.services.simulation_parser import SimulationParser
from app.services.mirofish_client import MirofishClient

logger = logging.getLogger(__name__)

router = APIRouter()

# In-memory job store reference (shared with simulations.py)
# Imported lazily to avoid circular imports
_jobs_ref: dict | None = None


def _get_jobs() -> dict:
    """Get the shared job store from simulations module."""
    global _jobs_ref
    if _jobs_ref is None:
        from app.api.simulations import _jobs
        _jobs_ref = _jobs
    return _jobs_ref


def _get_parser(simulation_id: str) -> SimulationParser | None:
    """
    Try to build a SimulationParser for a simulation.
    Returns None if no real MiroFish data exists.
    """
    jobs = _get_jobs()
    job = jobs.get(simulation_id, {})

    project_id = job.get("mirofish_project_id")
    mf_sim_id = job.get("mirofish_simulation_id")

    if project_id and mf_sim_id:
        parser = SimulationParser(project_id, mf_sim_id)
        if parser.has_data():
            return parser
    return None


@router.get("/{simulation_id}/agents")
async def get_network_agents(simulation_id: str):
    """Get all agent profiles for the network visualization."""
    parser = _get_parser(simulation_id)
    if parser:
        agents = parser.build_network_agents()
        if agents:
            return {"success": True, "data": {"agents": agents, "count": len(agents)}}

    # Fallback to mock
    data = get_mock_network_data()
    return {"success": True, "data": {"agents": data["agents"], "count": len(data["agents"])}}


@router.get("/{simulation_id}/graph")
async def get_network_graph(simulation_id: str):
    """Get nodes and edges for the force-directed graph."""
    parser = _get_parser(simulation_id)
    if parser:
        network = parser.build_full_network()
        if network:
            return {"success": True, "data": {"nodes": network["nodes"], "edges": network["edges"]}}

    data = get_mock_network_data()
    return {"success": True, "data": {"nodes": data["nodes"], "edges": data["edges"]}}


@router.get("/{simulation_id}/timeline")
async def get_network_timeline(simulation_id: str):
    """Get per-round timeline data for the scrubber."""
    parser = _get_parser(simulation_id)
    if parser:
        timeline = parser.build_network_timeline()
        if timeline:
            return {"success": True, "data": {"rounds": timeline}}

    data = get_mock_network_data()
    return {"success": True, "data": {"rounds": data["timeline"]}}


@router.get("/{simulation_id}/agent/{agent_id}")
async def get_agent_detail(simulation_id: str, agent_id: str):
    """Get detailed profile, timeline, actions, and connections for a single agent."""
    parser = _get_parser(simulation_id)
    if parser:
        detail = parser.get_agent_detail(agent_id)
        if detail:
            return {"success": True, "data": detail}

    detail = get_mock_agent_detail(agent_id)
    if not detail:
        raise HTTPException(status_code=404, detail=f"Agent not found: {agent_id}")
    return {"success": True, "data": detail}


@router.post("/{simulation_id}/agent/{agent_id}/chat")
async def chat_with_agent(simulation_id: str, agent_id: str, body: dict):
    """
    Chat with an agent in character.
    Proxies to MiroFish interview API if available, otherwise uses mock.
    """
    message = body.get("message", "")
    history = body.get("history", [])

    # Try real MiroFish interview
    jobs = _get_jobs()
    job = jobs.get(simulation_id, {})
    mf_sim_id = job.get("mirofish_simulation_id")

    if mf_sim_id:
        try:
            # Extract numeric agent ID
            agent_num = int(agent_id.split("_")[1])
            client = MirofishClient()
            try:
                result = await client.interview_agent(
                    simulation_id=mf_sim_id,
                    agent_id=agent_num,
                    prompt=message,
                )
                return {"success": True, "data": {"response": result.get("response", str(result))}}
            finally:
                await client.close()
        except Exception as e:
            logger.warning(f"MiroFish interview failed, using mock: {e}")

    result = mock_agent_chat(agent_id, message, history)
    return {"success": True, "data": result}
