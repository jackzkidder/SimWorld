"""
LLM-powered simulation engine using Anthropic Claude.

Replaces the mock adapter with real AI-generated simulation results.
Each simulation makes ~4 Claude calls to:
  1. Generate contextual agent personas
  2. Simulate multiple rounds of agent reactions
  3. Analyze the simulation for narratives and inflection points
  4. Generate an executive summary with recommendations

Results are unique per prediction question — not hardcoded.
"""

import json
import logging
import os
from datetime import datetime, timedelta

import anthropic

logger = logging.getLogger(__name__)

MODEL = "claude-sonnet-4-20250514"
MAX_TOKENS = 4096


def _client() -> anthropic.Anthropic:
    from app.config import get_settings
    key = get_settings().ANTHROPIC_API_KEY or os.getenv("ANTHROPIC_API_KEY", "")
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set")
    return anthropic.Anthropic(api_key=key)


def _call(system: str, prompt: str, max_tokens: int = MAX_TOKENS) -> str:
    """Make a single Claude call and return the text response."""
    client = _client()
    msg = client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text


def _parse_json(text: str) -> dict | list:
    """Extract JSON from a Claude response that may contain markdown fences."""
    text = text.strip()
    if text.startswith("```"):
        # Strip markdown code fences
        lines = text.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        text = "\n".join(lines).strip()
    return json.loads(text)


# ─── Stage 1: Generate Agents ──────────────────────────────────

AGENT_SYSTEM = """You are a simulation engine that generates realistic agent personas for scenario simulation.
Output valid JSON only — no markdown, no explanation. Return a JSON array of agent objects."""

AGENT_PROMPT = """Generate {count} unique agent personas who would react to this scenario:

"{question}"

Audience: {audience}
Geography: {geography}
Platforms: {platforms}

For each agent, return:
- name: realistic full name
- role: their job/role (e.g. "Tech Journalist", "Retail Investor", "Policy Researcher")
- platform: "twitter" or "reddit"
- stance: one of [supportive, critical, skeptical, analytical, enthusiastic, cautious, adversarial, neutral, pragmatic, bullish, bearish]
- bio: one sentence about their perspective (max 20 words)

Make agents diverse in demographics, expertise, and viewpoints. Include a realistic mix of supporters, critics, and neutral observers. Ensure the distribution feels natural for this specific topic.

Return ONLY a JSON array. No markdown fences."""


def generate_agents(question: str, count: int, audience: str, geography: str, platforms: str) -> list[dict]:
    """Generate contextual agent personas via Claude."""
    sentiment_map = {
        "critical": "negative", "skeptical": "negative", "bearish": "negative",
        "adversarial": "negative", "supportive": "positive", "bullish": "positive",
        "enthusiastic": "positive", "analytical": "neutral", "cautious": "neutral",
        "neutral": "neutral", "pragmatic": "neutral",
    }

    # Generate agents in batches if needed (Claude handles up to ~50 well)
    batch_size = min(count, 50)
    all_templates: list[dict] = []
    seen_names: set[str] = set()

    while len(all_templates) < count:
        needed = min(batch_size, count - len(all_templates))
        raw = _call(AGENT_SYSTEM, AGENT_PROMPT.format(
            count=needed, question=question, audience=audience,
            geography=geography, platforms=platforms,
        ))

        templates = _parse_json(raw)
        if not isinstance(templates, list):
            templates = templates.get("agents", [])

        for t in templates:
            name = t.get("name", "")
            # Deduplicate names
            if name in seen_names:
                name = f"{name} ({t.get('role', 'Agent')})"
            seen_names.add(name)
            all_templates.append({**t, "name": name})

            if len(all_templates) >= count:
                break

    agents = []
    for i, t in enumerate(all_templates[:count]):
        stance = t.get("stance", "neutral")
        plat = t.get("platform", "twitter")
        if platforms == "twitter":
            plat = "twitter"
        elif platforms == "reddit":
            plat = "reddit"

        agents.append({
            "id": f"agent_{i:04d}",
            "name": t.get("name", f"Agent {i}"),
            "role": t.get("role", "Participant"),
            "platform": plat,
            "stance": stance,
            "sentiment": sentiment_map.get(stance, "neutral"),
            "bio": t.get("bio", ""),
            "posts_count": 0,
            "interactions_count": 0,
            "influence_score": round(0.3 + (hash(t.get("name", "")) % 70) / 100, 2),
            "key_quotes": [],
        })
    return agents


# ─── Stage 2: Simulate Rounds ──────────────────────────────────

SIMULATE_SYSTEM = """You are a multi-agent simulation engine. You simulate how groups of people react to scenarios over time.
Output valid JSON only — no markdown, no explanation."""

SIMULATE_PROMPT = """Simulate {rounds} rounds of public reaction to this scenario:

"{question}"

The {agent_count} participants include these types:
{agent_summary}

For each round, simulate:
- How sentiment shifts (positive/negative/neutral ratios, must sum to 1.0)
- Total posts and interactions for that round
- A key_event if something notable happens that round (null otherwise)

Model realistic dynamics:
- Initial reactions are often polarized
- Controversy spikes when influential voices weigh in
- Sentiment can shift as new information or perspectives emerge
- Some rounds are quieter than others
- Not every round has a key event

Return a JSON array of round objects:
[{{"round": 1, "positive": 0.35, "negative": 0.30, "neutral": 0.35, "total_posts": 25, "total_interactions": 140, "key_event": "string or null"}}]

Make the dynamics feel organic and specific to this scenario. Return ONLY a JSON array."""


def simulate_rounds(question: str, agents: list[dict], rounds: int = 20) -> list[dict]:
    """Simulate rounds of agent reactions via Claude."""
    # Build agent summary for context
    from collections import Counter
    role_counts = Counter(a["role"] for a in agents[:30])
    stance_counts = Counter(a["stance"] for a in agents)
    summary_lines = [f"- {count}x {role}" for role, count in role_counts.most_common(10)]
    summary_lines.append(f"\nStance breakdown: {dict(stance_counts)}")
    agent_summary = "\n".join(summary_lines)

    raw = _call(SIMULATE_SYSTEM, SIMULATE_PROMPT.format(
        rounds=rounds, question=question, agent_count=len(agents),
        agent_summary=agent_summary,
    ), max_tokens=8192)

    timeline_raw = _parse_json(raw)
    if not isinstance(timeline_raw, list):
        timeline_raw = timeline_raw.get("rounds", [])

    now = datetime.utcnow()
    timeline = []
    for i, entry in enumerate(timeline_raw[:rounds]):
        r = entry if isinstance(entry, dict) else {}
        timeline.append({
            "round": r.get("round", i + 1),
            "timestamp": (now - timedelta(hours=rounds - i)).isoformat(),
            "positive": round(max(0.05, r.get("positive", 0.33)), 3),
            "negative": round(max(0.05, r.get("negative", 0.33)), 3),
            "neutral": round(max(0.05, r.get("neutral", 0.34)), 3),
            "total_posts": r.get("total_posts", 15),
            "total_interactions": r.get("total_interactions", 80),
            "key_event": r.get("key_event"),
        })

    # Update agent post counts based on simulation
    total_posts = sum(t["total_posts"] for t in timeline)
    for a in agents:
        a["posts_count"] = max(1, total_posts // len(agents) + (hash(a["id"]) % 5))
        a["interactions_count"] = a["posts_count"] * 6 + (hash(a["name"]) % 20)

    return timeline


# ─── Stage 3: Analyze ──────────────────────────────────────────

ANALYZE_SYSTEM = """You are an analytical AI that extracts insights from simulation data.
Output valid JSON only — no markdown, no explanation."""

ANALYZE_PROMPT = """Analyze this simulation about:
"{question}"

Timeline summary (round → sentiment):
{timeline_summary}

Agent breakdown:
- Total agents: {agent_count}
- Sentiment: {sentiment_breakdown}

Key events that occurred:
{events}

Extract:

1. "narratives": Array of 4-6 narrative clusters. Each:
   - id: "n1", "n2", etc.
   - label: short name (3-5 words)
   - sentiment: "positive", "negative", or "neutral"
   - agent_count: estimated number of agents in this cluster
   - description: 1-2 sentences
   - key_themes: array of 3-4 keywords

2. "inflection_points": Array of 2-5 key turning points. Each:
   - round: which round
   - description: what happened
   - sentiment_shift: numeric change (-0.2 to 0.2)
   - trigger: what caused it

Make the analysis specific to "{question}". Return ONLY a JSON object with "narratives" and "inflection_points" keys."""


def analyze_simulation(question: str, agents: list[dict], timeline: list[dict]) -> dict:
    """Extract narratives and inflection points via Claude."""
    from collections import Counter

    sentiment_counts = Counter(a["sentiment"] for a in agents)
    events = [f"Round {t['round']}: {t['key_event']}" for t in timeline if t.get("key_event")]

    timeline_summary = ", ".join(
        f"R{t['round']}: +{t['positive']:.0%}/-{t['negative']:.0%}"
        for t in timeline[::4]  # Sample every 4th round
    )

    raw = _call(ANALYZE_SYSTEM, ANALYZE_PROMPT.format(
        question=question,
        timeline_summary=timeline_summary,
        agent_count=len(agents),
        sentiment_breakdown=dict(sentiment_counts),
        events="\n".join(events) if events else "None recorded",
    ))

    result = _parse_json(raw)
    if not isinstance(result, dict):
        result = {"narratives": [], "inflection_points": []}

    return result


# ─── Stage 4: Executive Summary ────────────────────────────────

SUMMARY_SYSTEM = """You are a strategic analyst generating executive briefings from simulation data.
Output valid JSON only — no markdown, no explanation."""

SUMMARY_PROMPT = """Generate an executive summary for a simulation about:
"{question}"

Simulation results:
- {agent_count} agents simulated over {round_count} rounds
- Overall sentiment breakdown: {sentiment_breakdown}
- Key narratives: {narratives}
- Notable events: {events}
- Final sentiment trend: {final_trend}

Return a JSON object:
{{
  "overall_sentiment": "positive" | "negative" | "mixed",
  "sentiment_score": -1.0 to 1.0,
  "risk_tier": "low" | "medium" | "high" | "critical",
  "confidence": 0.0 to 1.0,
  "top_narratives": ["top 3 narrative labels"],
  "recommended_actions": ["4 specific, actionable recommendations tailored to this scenario"]
}}

Make recommendations concrete and specific to "{question}". Each recommendation should be 1-2 sentences with a clear action.
Return ONLY a JSON object."""


def generate_summary(question: str, agents: list[dict], timeline: list[dict], analysis: dict) -> dict:
    """Generate executive summary via Claude."""
    from collections import Counter

    sentiment_counts = dict(Counter(a["sentiment"] for a in agents))
    narrative_labels = [n.get("label", "") for n in analysis.get("narratives", [])]
    events = [ip.get("description", "") for ip in analysis.get("inflection_points", [])]

    # Detect final trend
    if len(timeline) >= 4:
        last = timeline[-1]
        prev = timeline[-4]
        trend_delta = last["positive"] - prev["positive"]
        if trend_delta > 0.03:
            final_trend = "improving"
        elif trend_delta < -0.03:
            final_trend = "deteriorating"
        else:
            final_trend = "stable"
    else:
        final_trend = "stable"

    raw = _call(SUMMARY_SYSTEM, SUMMARY_PROMPT.format(
        question=question,
        agent_count=len(agents),
        round_count=len(timeline),
        sentiment_breakdown=sentiment_counts,
        narratives=", ".join(narrative_labels[:5]),
        events="; ".join(events[:5]) if events else "None",
        final_trend=final_trend,
    ))

    summary = _parse_json(raw)
    if not isinstance(summary, dict):
        summary = {}

    # Ensure required fields
    summary.setdefault("overall_sentiment", "mixed")
    summary.setdefault("sentiment_score", 0.0)
    summary.setdefault("risk_tier", "medium")
    summary.setdefault("confidence", 0.8)
    summary.setdefault("top_narratives", narrative_labels[:3])
    summary.setdefault("recommended_actions", [])

    return summary


# ─── Agent Chat ────────────────────────────────────────────────

CHAT_SYSTEM = """You are {name}, a {role} participating in a simulation about a public scenario.
Your stance is {stance}. You are on {platform}.
Bio: {bio}

Stay in character. Respond naturally as this person would — with their biases, expertise, and communication style.
Keep responses conversational, 2-4 sentences. Reference the scenario when relevant."""


def chat_with_agent(agent: dict, message: str, question: str) -> str:
    """Generate an in-character response from an agent via Claude."""
    system = CHAT_SYSTEM.format(
        name=agent.get("name", "Agent"),
        role=agent.get("role", "Participant"),
        stance=agent.get("stance", "neutral"),
        platform=agent.get("platform", "twitter"),
        bio=agent.get("bio", "A participant in the simulation."),
    )
    prompt = f"Scenario being discussed: \"{question}\"\n\nSomeone asks you: {message}"

    return _call(system, prompt)


# ─── Full Pipeline ─────────────────────────────────────────────

async def run_llm_simulation(job: dict, on_progress=None) -> dict:
    """
    Run a full LLM-powered simulation. Called by the orchestrator.

    Makes ~4 Claude API calls total. Returns a complete result dict
    in the same format as MockMirofishAdapter.generate_mock_result().
    """
    import asyncio

    question = job.get("prediction_question", "General scenario simulation")
    agent_count = job.get("agent_count", 50)
    audience = job.get("audience", "general_public")
    geography = job.get("geography", "US")
    platforms = job.get("platforms", "both")

    def update(stage, msg, pct):
        if on_progress:
            on_progress(stage, msg, pct)

    # Stage 1: Generate agents
    update("generating_agents", "Generating agent personas with Claude...", 10)
    agents = await asyncio.to_thread(
        generate_agents, question, agent_count, audience, geography, platforms
    )
    update("generating_agents", f"Generated {len(agents)} agents", 25)

    # Stage 2: Simulate rounds
    rounds = 20 if agent_count <= 200 else 30
    update("simulating", "Simulating agent reactions...", 35)
    timeline = await asyncio.to_thread(
        simulate_rounds, question, agents, rounds
    )
    update("simulating", f"Simulated {len(timeline)} rounds", 55)

    # Stage 3: Analyze
    update("analyzing", "Analyzing narratives and inflection points...", 65)
    analysis = await asyncio.to_thread(
        analyze_simulation, question, agents, timeline
    )
    update("analyzing", "Analysis complete", 80)

    # Stage 4: Executive summary
    update("compiling_report", "Generating executive summary...", 85)
    summary = await asyncio.to_thread(
        generate_summary, question, agents, timeline, analysis
    )
    update("compiling_report", "Report complete", 95)

    # Compile result
    narratives = analysis.get("narratives", [])
    inflection_points = analysis.get("inflection_points", [])

    # Add key quotes from agent bios
    for a in agents[:20]:
        a["key_quotes"] = [f"{a.get('bio', '')} — {a['name']}, {a['role']}"]

    total_posts = sum(t["total_posts"] for t in timeline)
    total_interactions = sum(t["total_interactions"] for t in timeline)

    from collections import Counter
    sentiment_breakdown = dict(Counter(a["sentiment"] for a in agents))

    return {
        "executive_summary": summary,
        "timeline": timeline,
        "narratives": narratives,
        "inflection_points": inflection_points,
        "agents": agents,
        "stats": {
            "total_agents": len(agents),
            "total_rounds": len(timeline),
            "total_posts": total_posts,
            "total_interactions": total_interactions,
            "sentiment_breakdown": sentiment_breakdown,
        },
    }
