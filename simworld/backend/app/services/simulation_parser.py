"""
Parser for MiroFish simulation output.
Reads SQLite trace tables, actions.jsonl, profiles, and run_state.json
to produce structured data for the Agent Network Web View.

MiroFish file layout:
  mirofish-engine/projects/{project_id}/simulations/{sim_id}/
    twitter_simulation.db       — SQLite with `trace` table
    reddit_simulation.db        — SQLite with `trace` table
    twitter/actions.jsonl       — per-action log
    reddit/actions.jsonl        — per-action log
    twitter_profiles.csv        — agent profiles
    reddit_profiles.json        — agent profiles
    run_state.json              — runtime state snapshot
    simulation.log              — text log

SQLite trace schema:
    CREATE TABLE trace (user_id INTEGER, action TEXT, info TEXT, created_at TIMESTAMP)
    - info is a JSON string with action-specific data
    - action is an ActionType enum value (e.g. "CREATE_POST", "LIKE", "FOLLOW", "INTERVIEW")

actions.jsonl entry:
    {round, timestamp, agent_id, agent_name, action_type, action_args, result, success}
    Special events: round_start, round_end, simulation_start, simulation_end
"""

import csv
import io
import json
import logging
import sqlite3
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)


class SimulationParser:
    """Parses raw MiroFish simulation output into structured data for the network view."""

    def __init__(self, project_id: str, simulation_id: str, base_dir: str = "../mirofish-engine/projects"):
        self.project_id = project_id
        self.simulation_id = simulation_id
        self.base_path = Path(base_dir) / project_id / "simulations" / simulation_id

    def has_data(self) -> bool:
        """Check if raw MiroFish output exists."""
        return self.base_path.exists()

    # ─── Profiles ─────────────────────────────────────────────────

    def parse_profiles(self) -> list[dict]:
        """Read agent profiles from CSV/JSON files."""
        profiles = []

        # Twitter profiles (CSV)
        twitter_csv = self.base_path / "twitter_profiles.csv"
        if twitter_csv.exists():
            try:
                with open(twitter_csv, encoding="utf-8") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        row["platform"] = "twitter"
                        profiles.append(row)
            except Exception as e:
                logger.warning(f"Error reading twitter profiles: {e}")

        # Reddit profiles (JSON)
        reddit_json = self.base_path / "reddit_profiles.json"
        if reddit_json.exists():
            try:
                with open(reddit_json, encoding="utf-8") as f:
                    data = json.load(f)
                    items = data if isinstance(data, list) else data.get("profiles", [])
                    for profile in items:
                        profile["platform"] = "reddit"
                        profiles.append(profile)
            except Exception as e:
                logger.warning(f"Error reading reddit profiles: {e}")

        return profiles

    # ─── SQLite Trace ─────────────────────────────────────────────

    def _query_trace_db(self, db_name: str, query: str, params: tuple = ()) -> list[dict]:
        """Query a trace database and return rows as dicts."""
        db_path = self.base_path / db_name
        if not db_path.exists():
            return []

        try:
            conn = sqlite3.connect(str(db_path))
            conn.row_factory = sqlite3.Row
            cursor = conn.execute(query, params)
            rows = [dict(row) for row in cursor.fetchall()]
            conn.close()
            return rows
        except Exception as e:
            logger.warning(f"Error querying {db_name}: {e}")
            return []

    def parse_trace(self, platform: str = "twitter", limit: int = 10000) -> list[dict]:
        """Read all trace entries from a platform's database."""
        db_name = f"{platform}_simulation.db"
        rows = self._query_trace_db(
            db_name,
            "SELECT user_id, action, info, created_at FROM trace ORDER BY created_at LIMIT ?",
            (limit,),
        )
        # Parse JSON info field
        for row in rows:
            try:
                row["info"] = json.loads(row["info"]) if row.get("info") else {}
            except (json.JSONDecodeError, TypeError):
                row["info"] = {}
        return rows

    def parse_agent_trace(self, agent_id: int, platform: str = "twitter") -> list[dict]:
        """Read trace entries for a specific agent."""
        db_name = f"{platform}_simulation.db"
        rows = self._query_trace_db(
            db_name,
            "SELECT user_id, action, info, created_at FROM trace WHERE user_id = ? ORDER BY created_at",
            (agent_id,),
        )
        for row in rows:
            try:
                row["info"] = json.loads(row["info"]) if row.get("info") else {}
            except (json.JSONDecodeError, TypeError):
                row["info"] = {}
        return rows

    # ─── Actions.jsonl ────────────────────────────────────────────

    def parse_actions(self, platform: str = "twitter") -> list[dict]:
        """Read actions.jsonl for a platform."""
        actions_path = self.base_path / platform / "actions.jsonl"
        if not actions_path.exists():
            return []

        actions = []
        try:
            with open(actions_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            actions.append(json.loads(line))
                        except json.JSONDecodeError:
                            continue
        except Exception as e:
            logger.warning(f"Error reading {actions_path}: {e}")
        return actions

    def parse_all_actions(self) -> list[dict]:
        """Read actions from both platforms, merged and sorted."""
        twitter = self.parse_actions("twitter")
        reddit = self.parse_actions("reddit")
        for a in twitter:
            a["platform"] = "twitter"
        for a in reddit:
            a["platform"] = "reddit"
        combined = twitter + reddit
        combined.sort(key=lambda x: (x.get("round", 0), x.get("timestamp", "")))
        return combined

    # ─── Run State ────────────────────────────────────────────────

    def parse_run_state(self) -> Optional[dict]:
        """Read run_state.json."""
        state_path = self.base_path / "run_state.json"
        if not state_path.exists():
            return None
        try:
            with open(state_path, encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Error reading run_state.json: {e}")
            return None

    # ─── Network View Data ────────────────────────────────────────

    def build_network_agents(self) -> list[dict]:
        """Build agent list for network view from profiles + trace data."""
        profiles = self.parse_profiles()
        if not profiles:
            return []

        # Get action counts per agent from both platforms
        action_counts: dict[int, int] = {}
        for platform in ["twitter", "reddit"]:
            actions = self.parse_actions(platform)
            for action in actions:
                if "agent_id" in action:
                    aid = action["agent_id"]
                    action_counts[aid] = action_counts.get(aid, 0) + 1

        agents = []
        for profile in profiles:
            user_id = int(profile.get("user_id", 0))
            name = profile.get("name", profile.get("username", f"Agent {user_id}"))
            occupation = profile.get("profession", "Participant")
            platform = profile.get("platform", "twitter")
            age = int(profile.get("age", 30))
            location = profile.get("country", "Unknown")
            bio = profile.get("bio", "")
            persona = profile.get("persona", bio)

            # Determine agent type from profession/role
            agent_type = self._infer_agent_type(occupation, persona)

            # Compute influence from action count
            count = action_counts.get(user_id, 0)
            influence = min(100, int(count * 2) + 10)

            # Sentiment bias from profile
            sentiment_bias = float(profile.get("sentiment_bias", 0.0))
            stance = profile.get("stance", "neutral")

            agents.append({
                "id": f"agent_{user_id:03d}",
                "name": name,
                "persona": persona[:200] if persona else f"{age}-year-old {occupation.lower()} based in {location}.",
                "age": age,
                "occupation": occupation,
                "location": location,
                "agent_type": agent_type,
                "initial_sentiment": round(sentiment_bias, 2),
                "influence_score": influence,
                "avatar_seed": f"{name.lower().replace(' ', '-')}-{user_id}",
                "platform": platform,
                "cluster_id": self._stance_to_cluster(stance, sentiment_bias),
            })

        return agents

    def build_network_edges(self, agents: list[dict]) -> list[dict]:
        """Build edge list from trace data (follows, likes, reposts, comments)."""
        agent_id_map = {}
        for a in agents:
            # Extract numeric ID from "agent_XXX"
            try:
                num_id = int(a["id"].split("_")[1])
                agent_id_map[num_id] = a["id"]
            except (ValueError, IndexError):
                pass

        edges: dict[tuple, dict] = {}  # (source, target) -> edge

        for platform in ["twitter", "reddit"]:
            actions = self.parse_actions(platform)
            for action in actions:
                if action.get("event_type"):
                    continue  # Skip meta events

                agent_id = action.get("agent_id")
                action_type = action.get("action_type", "")
                args = action.get("action_args", {})
                round_num = action.get("round", 0)

                source_id = agent_id_map.get(agent_id)
                if not source_id:
                    continue

                # Determine target from action
                target_num = None
                if isinstance(args, dict):
                    target_num = args.get("target_user_id", args.get("user_id"))
                if target_num is None:
                    continue

                target_id = agent_id_map.get(target_num)
                if not target_id or source_id == target_id:
                    continue

                # Classify interaction
                itype = self._action_to_interaction_type(action_type)

                key = (min(source_id, target_id), max(source_id, target_id))
                if key in edges:
                    edges[key]["weight"] += 1
                    if round_num not in edges[key]["rounds_active"]:
                        edges[key]["rounds_active"].append(round_num)
                    # Upgrade interaction type if stronger
                    if itype != "neutral":
                        edges[key]["interaction_type"] = itype
                else:
                    edges[key] = {
                        "source": source_id,
                        "target": target_id,
                        "weight": 1,
                        "interaction_type": itype,
                        "rounds_active": [round_num] if round_num else [],
                    }

        return list(edges.values())

    def build_network_timeline(self) -> list[dict]:
        """Build per-round timeline from actions."""
        all_actions = self.parse_all_actions()
        if not all_actions:
            return []

        rounds: dict[int, dict] = {}
        for action in all_actions:
            if action.get("event_type") == "round_start":
                r = action.get("round", 0)
                rounds.setdefault(r, {
                    "round_number": r,
                    "aggregate_sentiment": 0.0,
                    "active_agent_count": 0,
                    "key_event": None,
                    "cluster_snapshot": [],
                    "action_count": 0,
                })
            elif action.get("event_type") == "round_end":
                r = action.get("round", 0)
                if r in rounds:
                    rounds[r]["action_count"] = action.get("actions_count", 0)
            elif action.get("agent_id") is not None:
                r = action.get("round", 0)
                rounds.setdefault(r, {
                    "round_number": r,
                    "aggregate_sentiment": 0.0,
                    "active_agent_count": 0,
                    "key_event": None,
                    "cluster_snapshot": [],
                    "action_count": 0,
                })
                rounds[r]["action_count"] = rounds[r].get("action_count", 0) + 1

        # Count unique agents per round
        agents_per_round: dict[int, set] = {}
        for action in all_actions:
            if action.get("agent_id") is not None:
                r = action.get("round", 0)
                agents_per_round.setdefault(r, set()).add(action["agent_id"])

        for r, agents in agents_per_round.items():
            if r in rounds:
                rounds[r]["active_agent_count"] = len(agents)

        return sorted(rounds.values(), key=lambda x: x["round_number"])

    def build_full_network(self) -> Optional[dict]:
        """
        Full parse: combine all sources into network data.
        Returns same structure as mock_network.get_mock_network_data().
        """
        if not self.has_data():
            return None

        agents = self.build_network_agents()
        if not agents:
            return None

        edges = self.build_network_edges(agents)
        timeline = self.build_network_timeline()

        # Build nodes (simplified — no per-round sentiment from trace)
        nodes = []
        for agent in agents:
            nodes.append({
                "id": agent["id"],
                "sentiment_by_round": [agent["initial_sentiment"]] * max(len(timeline), 1),
                "influence_score": agent["influence_score"],
                "agent_type": agent["agent_type"],
                "cluster_id": agent["cluster_id"],
            })

        return {
            "agents": agents,
            "nodes": nodes,
            "edges": edges,
            "timeline": timeline,
        }

    # ─── Agent Detail ─────────────────────────────────────────────

    def get_agent_detail(self, agent_id: str) -> Optional[dict]:
        """Get detailed data for a single agent."""
        agents = self.build_network_agents()
        agent = next((a for a in agents if a["id"] == agent_id), None)
        if not agent:
            return None

        # Extract numeric user_id
        try:
            user_id = int(agent_id.split("_")[1])
        except (ValueError, IndexError):
            return None

        # Get this agent's actions from both platforms
        actions = []
        for platform in ["twitter", "reddit"]:
            for action in self.parse_actions(platform):
                if action.get("agent_id") == user_id and not action.get("event_type"):
                    actions.append({
                        "round": action.get("round", 0),
                        "type": action.get("action_type", "post").lower().replace("create_", ""),
                        "content": self._extract_content(action),
                        "target_agent_id": None,
                    })
        actions.sort(key=lambda x: x["round"])

        # Build connections from edges
        edges = self.build_network_edges(agents)
        connections = []
        for edge in edges:
            if edge["source"] == agent_id:
                connections.append({
                    "agent_id": edge["target"],
                    "interaction_count": edge["weight"],
                    "relationship_type": edge["interaction_type"],
                })
            elif edge["target"] == agent_id:
                connections.append({
                    "agent_id": edge["source"],
                    "interaction_count": edge["weight"],
                    "relationship_type": edge["interaction_type"],
                })
        connections.sort(key=lambda x: x["interaction_count"], reverse=True)

        return {
            "profile": agent,
            "sentiment_timeline": [{"round": i + 1, "score": agent["initial_sentiment"], "trigger_event": None} for i in range(20)],
            "actions": actions,
            "connections": connections,
        }

    # ─── Helpers ──────────────────────────────────────────────────

    def _infer_agent_type(self, occupation: str, persona: str) -> str:
        """Infer agent_type from occupation and persona text."""
        text = f"{occupation} {persona}".lower()
        if any(w in text for w in ["journalist", "reporter", "media", "editor", "podcast", "newsletter"]):
            return "media"
        if any(w in text for w in ["activist", "advocate", "critic", "whistleblower", "organizer"]):
            return "adversarial"
        if any(w in text for w in ["analyst", "professor", "regulator", "policy", "attorney", "consultant"]):
            return "institutional"
        if any(w in text for w in ["ceo", "founder", "vp", "head of", "chief", "product manager"]):
            return "seed"
        return "general_public"

    def _stance_to_cluster(self, stance: str, sentiment_bias: float) -> int:
        """Map stance/sentiment to cluster ID."""
        if stance == "supportive" or sentiment_bias > 0.3:
            return 0  # Supporters
        elif stance == "opposing" or sentiment_bias < -0.3:
            return 1  # Critics
        return 2  # Cautious Observers

    def _action_to_interaction_type(self, action_type: str) -> str:
        """Classify action as positive/negative/neutral interaction."""
        action = action_type.upper()
        if action in ("LIKE", "REPOST", "FOLLOW", "QUOTE_POSITIVE"):
            return "positive"
        if action in ("MUTE", "BLOCK", "DISLIKE", "QUOTE_NEGATIVE"):
            return "negative"
        return "neutral"

    def _extract_content(self, action: dict) -> str:
        """Extract human-readable content from an action entry."""
        args = action.get("action_args", {})
        if isinstance(args, dict):
            return args.get("content", args.get("text", str(action.get("result", ""))))
        return str(action.get("result", ""))
