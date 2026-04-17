"""Mock MiroFish client that returns fake simulation data for frontend development."""

import uuid
import random
from datetime import datetime, timedelta


MOCK_AGENTS = [
    {"id": "agent_001", "name": "Sarah Chen", "role": "Tech Journalist", "platform": "twitter", "sentiment": "negative", "stance": "critical", "bio": "Senior tech reporter at TechCrunch. Covers AI, startups, and corporate governance.", "avatar_seed": "sarah"},
    {"id": "agent_002", "name": "Marcus Williams", "role": "Retail Investor", "platform": "reddit", "sentiment": "positive", "stance": "supportive", "bio": "Active r/wallstreetbets member. Has held the stock for 3 years.", "avatar_seed": "marcus"},
    {"id": "agent_003", "name": "Dr. Emily Park", "role": "Industry Analyst", "platform": "twitter", "sentiment": "neutral", "stance": "analytical", "bio": "VP of Research at Gartner. Specializes in enterprise AI adoption trends.", "avatar_seed": "emily"},
    {"id": "agent_004", "name": "Jake Rodriguez", "role": "Software Engineer", "platform": "reddit", "sentiment": "negative", "stance": "skeptical", "bio": "Staff engineer at a FAANG company. Active on HN and Reddit tech subs.", "avatar_seed": "jake"},
    {"id": "agent_005", "name": "Amanda Foster", "role": "PR Professional", "platform": "twitter", "sentiment": "positive", "stance": "diplomatic", "bio": "15 years in crisis communications. Runs a boutique PR firm.", "avatar_seed": "amanda"},
    {"id": "agent_006", "name": "David Kim", "role": "Hedge Fund Analyst", "platform": "twitter", "sentiment": "negative", "stance": "bearish", "bio": "Equity analyst at Citadel. Covers tech sector. CFA charterholder.", "avatar_seed": "david"},
    {"id": "agent_007", "name": "Lisa Thompson", "role": "Consumer Advocate", "platform": "reddit", "sentiment": "negative", "stance": "critical", "bio": "Runs a consumer rights blog. 50K followers on social media.", "avatar_seed": "lisa"},
    {"id": "agent_008", "name": "Prof. Robert Chang", "role": "AI Ethics Researcher", "platform": "twitter", "sentiment": "neutral", "stance": "cautious", "bio": "Professor of Computer Science at Stanford. Focus on AI governance.", "avatar_seed": "robert"},
    {"id": "agent_009", "name": "Michelle Santos", "role": "Small Business Owner", "platform": "reddit", "sentiment": "positive", "stance": "pragmatic", "bio": "Runs an e-commerce business. Uses AI tools daily for operations.", "avatar_seed": "michelle"},
    {"id": "agent_010", "name": "Ryan O'Brien", "role": "Regulatory Analyst", "platform": "twitter", "sentiment": "neutral", "stance": "regulatory", "bio": "Former SEC analyst. Now consulting on tech regulation compliance.", "avatar_seed": "ryan"},
]

MOCK_NARRATIVES = [
    {"id": "n1", "label": "Privacy Concerns Camp", "sentiment": "negative", "agent_count": 15, "description": "Group focused on data privacy implications and potential misuse of personal information.", "key_themes": ["data collection", "surveillance", "consent"]},
    {"id": "n2", "label": "Innovation Supporters", "sentiment": "positive", "agent_count": 12, "description": "Enthusiastic about technological progress and competitive advantages.", "key_themes": ["progress", "efficiency", "market leadership"]},
    {"id": "n3", "label": "Wait and See Moderates", "sentiment": "neutral", "agent_count": 18, "description": "Cautious observers who want more details before forming strong opinions.", "key_themes": ["need more info", "cautious optimism", "implementation details"]},
    {"id": "n4", "label": "Economic Impact Worriers", "sentiment": "negative", "agent_count": 8, "description": "Concerned about job displacement and economic disruption.", "key_themes": ["job loss", "automation", "inequality"]},
    {"id": "n5", "label": "Competitive Analysts", "sentiment": "neutral", "agent_count": 7, "description": "Focused on market positioning and competitive dynamics.", "key_themes": ["market share", "competitor response", "valuation"]},
]


def _generate_timeline(rounds: int = 20):
    """Generate a fake sentiment timeline."""
    timeline = []
    base_positive = 0.35
    base_negative = 0.30
    base_neutral = 0.35

    for i in range(rounds):
        noise_p = random.uniform(-0.05, 0.05)
        noise_n = random.uniform(-0.05, 0.05)

        if i > 7:
            base_negative += 0.01
            base_positive -= 0.005

        positive = max(0.05, min(0.8, base_positive + noise_p))
        negative = max(0.05, min(0.8, base_negative + noise_n))
        neutral = max(0.05, 1.0 - positive - negative)

        timeline.append({
            "round": i + 1,
            "timestamp": (datetime.now() - timedelta(hours=rounds - i)).isoformat(),
            "positive": round(positive, 3),
            "negative": round(negative, 3),
            "neutral": round(neutral, 3),
            "total_posts": random.randint(5, 25),
            "total_interactions": random.randint(20, 150),
        })

    return timeline


class MockMirofishClient:
    """Returns realistic fake data so the frontend can be developed without MiroFish running."""

    _simulations: dict = {}

    async def create_simulation(self, sim_config) -> dict:
        sim_id = f"sim_{uuid.uuid4().hex[:12]}"
        now = datetime.now().isoformat()

        sim = {
            "id": sim_id,
            "title": sim_config.title,
            "status": "completed",
            "prediction_question": sim_config.prediction_question,
            "audience": sim_config.audience,
            "geography": sim_config.geography,
            "agent_count": sim_config.agent_count,
            "platforms": sim_config.platforms,
            "crisis_mode": sim_config.crisis_mode,
            "progress": 100,
            "progress_message": "Simulation complete",
            "created_at": now,
            "updated_at": now,
        }

        MockMirofishClient._simulations[sim_id] = sim
        return sim

    async def get_simulation(self, simulation_id: str) -> dict:
        return MockMirofishClient._simulations.get(simulation_id)

    async def get_progress(self, simulation_id: str) -> dict:
        sim = MockMirofishClient._simulations.get(simulation_id)
        if not sim:
            return {"simulation_id": simulation_id, "status": "not_found"}

        return {
            "simulation_id": simulation_id,
            "status": sim["status"],
            "progress": sim["progress"],
            "message": sim["progress_message"],
            "stages": [
                {"name": "Building knowledge graph", "status": "completed", "progress": 100},
                {"name": "Generating agent personas", "status": "completed", "progress": 100},
                {"name": "Running simulation", "status": "completed", "progress": 100},
                {"name": "Compiling report", "status": "completed", "progress": 100},
            ],
        }

    async def get_results(self, simulation_id: str) -> dict:
        sim = MockMirofishClient._simulations.get(simulation_id)
        if not sim or sim["status"] != "completed":
            return None

        timeline = _generate_timeline(20)

        return {
            "simulation_id": simulation_id,
            "executive_summary": {
                "overall_sentiment": "mixed_negative",
                "sentiment_score": -0.15,
                "risk_tier": "medium",
                "confidence": 0.78,
                "top_narratives": [
                    "Privacy concerns dominate early discourse",
                    "Industry analysts largely wait-and-see",
                    "Retail investors show cautious optimism",
                ],
                "recommended_actions": [
                    "Proactively address privacy concerns with a detailed data handling FAQ",
                    "Engage key tech journalists with early access or exclusive briefings",
                    "Prepare response for job displacement narratives before they gain traction",
                ],
            },
            "timeline": timeline,
            "narratives": MOCK_NARRATIVES,
            "inflection_points": [
                {
                    "round": 3,
                    "description": "Privacy concerns article goes viral",
                    "sentiment_shift": -0.12,
                    "trigger": "Tech journalist publishes critical thread",
                },
                {
                    "round": 8,
                    "description": "Regulatory analyst raises compliance questions",
                    "sentiment_shift": -0.08,
                    "trigger": "Former SEC analyst weighs in on regulatory risk",
                },
                {
                    "round": 15,
                    "description": "Small business owners share positive use cases",
                    "sentiment_shift": 0.06,
                    "trigger": "Organic grassroots support emerges",
                },
            ],
            "agent_count": len(MOCK_AGENTS),
            "total_rounds": 20,
            "total_posts": sum(t["total_posts"] for t in timeline),
            "total_interactions": sum(t["total_interactions"] for t in timeline),
        }

    async def get_agents(
        self, simulation_id: str, sentiment: str = None, role: str = None
    ) -> dict:
        agents = [a.copy() for a in MOCK_AGENTS]
        if sentiment:
            agents = [a for a in agents if a["sentiment"] == sentiment]
        if role:
            agents = [a for a in agents if role.lower() in a["role"].lower()]

        for agent in agents:
            agent["posts_count"] = random.randint(2, 15)
            agent["interactions_count"] = random.randint(10, 80)
            agent["influence_score"] = round(random.uniform(0.1, 1.0), 2)
            agent["key_quotes"] = [
                f"This is a mock quote from {agent['name']} about the scenario.",
                f"Another perspective from {agent['name']} showing their {agent['stance']} stance.",
            ]

        return {"agents": agents, "count": len(agents)}

    async def chat_with_agent(
        self, simulation_id: str, agent_id: str, message: str
    ) -> dict:
        agent = next((a for a in MOCK_AGENTS if a["id"] == agent_id), None)
        if not agent:
            return {"error": "Agent not found"}

        return {
            "agent_id": agent_id,
            "agent_name": agent["name"],
            "response": (
                f"As a {agent['role']}, I think this is an important question. "
                f"Based on my analysis and the reactions I've observed from others "
                f"in the simulation, I believe the key issue here is about trust "
                f"and transparency. The public needs to see concrete evidence "
                f"before they'll change their stance. "
                f"[Mock response from {agent['name']}]"
            ),
            "sentiment": agent["sentiment"],
            "timestamp": datetime.now().isoformat(),
        }
