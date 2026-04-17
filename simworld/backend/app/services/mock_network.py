"""
Mock network data generator for the Agent Network Web View.
Generates 150 agents, ~400 edges, 20 rounds with 3 opinion clusters.
Uses seeded random for deterministic output.
"""

import random
import hashlib
from typing import Optional

# Seeded RNG for deterministic data
_rng = random.Random(42)

# ─── Constants ─────────────────────────────────────────────────────

FIRST_NAMES = [
    "Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Quinn",
    "Avery", "Jamie", "Drew", "Blake", "Skyler", "Dakota", "Reese", "Harper",
    "Emerson", "Rowan", "Sage", "Phoenix", "Kai", "River", "Ellis", "Finley",
    "Hayden", "Jessie", "Lane", "Micah", "Noel", "Parker", "Remy", "Shiloh",
    "Tatum", "Val", "Winter", "Zion", "Adrian", "Cameron", "Devon", "Eden",
    "Frankie", "Gray", "Hollis", "Indigo", "Jules", "Kendall", "Lee", "Marlow",
    "Nico", "Oakley", "Peyton", "Robin", "Sterling", "True", "Uri", "Vesper",
    "Wren", "Xen", "Yael", "Zephyr", "Arlo", "Briar", "Cruz", "Darcy",
    "Elliot", "Flynn", "Glenn", "Honor", "Ira", "Justice", "Kit", "Lux",
    "Merit", "Nash", "Onyx", "Palmer", "Raven", "Scout", "Teagan", "Unity",
]

LAST_NAMES = [
    "Chen", "Rivera", "Okafor", "Petrov", "Kim", "Santos", "Mueller", "Nakamura",
    "Williams", "Andersen", "Gupta", "Hernandez", "Larsson", "Osei", "Patel",
    "Reyes", "Singh", "Torres", "Volkov", "Walsh", "Yamamoto", "Zhang", "Ali",
    "Brooks", "Cruz", "Diaz", "Evans", "Foster", "Garcia", "Hayes", "Ibrahim",
]

OCCUPATIONS = {
    "general_public": [
        "Software Engineer", "Teacher", "Nurse", "Accountant", "Marketing Manager",
        "Graphic Designer", "Sales Rep", "Electrician", "Student", "Small Business Owner",
        "Freelance Writer", "Restaurant Manager", "Real Estate Agent", "Data Analyst",
    ],
    "media": ["Tech Journalist", "News Reporter", "Podcast Host", "Newsletter Writer",
              "Industry Analyst", "Media Producer", "Editorial Director"],
    "adversarial": ["Privacy Activist", "Consumer Rights Advocate", "Ethics Researcher",
                    "Investigative Blogger", "Whistleblower Advocate", "Labor Organizer"],
    "institutional": ["Policy Analyst", "Regulatory Consultant", "University Professor",
                      "Think Tank Fellow", "Investment Analyst", "Corporate Attorney"],
    "seed": ["Product Manager", "CEO", "VP of Communications", "Head of Marketing",
             "Chief Strategy Officer"],
}

LOCATIONS = [
    "San Francisco, CA", "New York, NY", "Austin, TX", "Seattle, WA",
    "Chicago, IL", "Boston, MA", "Los Angeles, CA", "Denver, CO",
    "Portland, OR", "Atlanta, GA", "Miami, FL", "London, UK",
    "Toronto, CA", "Berlin, DE", "Sydney, AU", "Tokyo, JP",
]

CLUSTER_INFO = [
    {"id": 0, "name": "Supporters", "dominant_narrative": "Innovation potential outweighs risks"},
    {"id": 1, "name": "Critics", "dominant_narrative": "Significant risks being downplayed by proponents"},
    {"id": 2, "name": "Cautious Observers", "dominant_narrative": "Wait-and-see approach with measured expectations"},
]

PERSONAS = {
    0: [
        "Enthusiastic early adopter who sees transformative potential",
        "Pragmatic optimist focused on economic benefits and job creation",
        "Tech-forward thinker excited about efficiency improvements",
    ],
    1: [
        "Concerned citizen worried about privacy and surveillance",
        "Skeptic who has seen similar promises fail to deliver",
        "Vocal critic highlighting regulatory gaps and corporate overreach",
    ],
    2: [
        "Analytical observer weighing evidence from both sides carefully",
        "Moderate voice calling for balanced regulation and oversight",
        "Pragmatist interested in real-world results before forming opinion",
    ],
}

POST_TEMPLATES = {
    "positive": [
        "This could genuinely change how we approach {topic}. The early data looks promising.",
        "People dismissing this haven't looked at the actual research. It's solid work.",
        "Hot take: this is exactly what the industry needed. Competition drives innovation.",
    ],
    "negative": [
        "Am I the only one seeing the massive red flags here? This is concerning.",
        "The privacy implications alone should give everyone pause. Where's the oversight?",
        "Corporate press release ≠ reality. Let's talk about what they're NOT saying.",
    ],
    "neutral": [
        "Interesting development. Going to wait for independent analysis before forming an opinion.",
        "Some valid points on both sides here. The truth is probably somewhere in the middle.",
        "Worth watching but too early to draw conclusions. Need more data.",
    ],
}

TOPICS = [
    "AI governance", "data privacy", "market disruption", "workforce automation",
    "platform economics", "digital infrastructure", "regulatory compliance",
    "public trust", "innovation cycles", "sustainable growth",
]

# ─── Cache ─────────────────────────────────────────────────────────

_cached_data: Optional[dict] = None


def _generate_agents() -> list[dict]:
    agents = []
    type_dist = [
        ("general_public", 100), ("media", 15), ("adversarial", 12),
        ("institutional", 15), ("seed", 8),
    ]
    idx = 0
    for agent_type, count in type_dist:
        for _ in range(count):
            first = _rng.choice(FIRST_NAMES)
            last = _rng.choice(LAST_NAMES)
            age = _rng.randint(22, 65)
            occupation = _rng.choice(OCCUPATIONS[agent_type])
            location = _rng.choice(LOCATIONS)

            # Cluster assignment
            if agent_type == "seed":
                cluster_id = 0
            elif agent_type == "adversarial":
                cluster_id = 1
            elif agent_type == "media":
                cluster_id = _rng.choices([0, 1, 2], weights=[30, 30, 40])[0]
            elif agent_type == "institutional":
                cluster_id = _rng.choices([0, 1, 2], weights=[30, 20, 50])[0]
            else:
                cluster_id = _rng.choices([0, 1, 2], weights=[33, 27, 40])[0]

            # Sentiment
            if cluster_id == 0:
                initial_sentiment = round(0.3 + _rng.random() * 0.5, 2)
            elif cluster_id == 1:
                initial_sentiment = round(-0.8 + _rng.random() * 0.5, 2)
            else:
                initial_sentiment = round(-0.2 + _rng.random() * 0.4, 2)

            # Influence
            base_inf = {"media": 50, "seed": 60, "adversarial": 40, "institutional": 35}.get(agent_type, 5)
            influence = base_inf + _rng.randint(5, 45)

            persona = _rng.choice(PERSONAS[cluster_id])
            platform = _rng.choice(["twitter", "twitter", "twitter", "reddit", "reddit"])
            avatar_seed = f"{first.lower()}-{last.lower()}-{idx}"

            agents.append({
                "id": f"agent_{idx:03d}",
                "name": f"{first} {last}",
                "persona": f"{persona}. {age}-year-old {occupation.lower()} based in {location}.",
                "age": age,
                "occupation": occupation,
                "location": location,
                "agent_type": agent_type,
                "initial_sentiment": initial_sentiment,
                "influence_score": min(influence, 100),
                "avatar_seed": avatar_seed,
                "platform": platform,
                "cluster_id": cluster_id,
            })
            idx += 1
    return agents


def _generate_sentiment_timeline(agent: dict) -> list[dict]:
    timeline = []
    score = agent["initial_sentiment"]
    cluster = agent["cluster_id"]

    for r in range(1, 21):
        trigger = None
        if r == 5:
            shifts = {0: -0.08, 1: -0.15, 2: -0.18}
            score += shifts.get(cluster, -0.1) + (_rng.random() - 0.5) * 0.05
            triggers = {
                0: "Saw viral criticism, maintained mostly positive view",
                1: "Amplified critical talking points from influential thread",
                2: "Reacted to @TechGuru's critical analysis thread",
            }
            trigger = triggers.get(cluster)
        elif r == 12:
            shifts = {0: 0.12, 1: 0.03, 2: 0.10}
            score += shifts.get(cluster, 0.05) + (_rng.random() - 0.5) * 0.03
            triggers = {
                0: "Official response validated initial optimism",
                1: "Noted official response but remained skeptical",
                2: "Company's response addressed some key concerns",
            }
            trigger = triggers.get(cluster)
        else:
            drift = (_rng.random() - 0.5) * 0.06
            center = {0: 0.5, 1: -0.5, 2: 0.1}.get(cluster, 0)
            gravity = (center - score) * 0.03
            score += drift + gravity

        score = max(-1.0, min(1.0, score))
        timeline.append({"round": r, "score": round(score, 3), "trigger_event": trigger})
    return timeline


def _generate_edges(agents: list[dict]) -> list[dict]:
    edges = []
    edge_set = set()

    def add_edge(a_idx: int, b_idx: int):
        key = (min(a_idx, b_idx), max(a_idx, b_idx))
        if key in edge_set:
            return
        edge_set.add(key)

        a, b = agents[a_idx], agents[b_idx]
        same_cluster = a["cluster_id"] == b["cluster_id"]

        if same_cluster:
            itype = _rng.choices(["positive", "negative", "neutral"], weights=[75, 10, 15])[0]
        else:
            itype = _rng.choices(["positive", "negative", "neutral"], weights=[15, 55, 30])[0]

        weight = _rng.randint(2, 8) if same_cluster else _rng.randint(1, 4)
        num_rounds = _rng.randint(1, 10)
        rounds_active = sorted(_rng.sample(range(1, 21), min(num_rounds, 20)))

        edges.append({
            "source": a["id"],
            "target": b["id"],
            "weight": weight,
            "interaction_type": itype,
            "rounds_active": rounds_active,
        })

    # Within-cluster edges (dense)
    for cid in range(3):
        cluster_indices = [i for i, a in enumerate(agents) if a["cluster_id"] == cid]
        target_edges = int(len(cluster_indices) * 1.8)
        for _ in range(target_edges):
            a = _rng.choice(cluster_indices)
            b = _rng.choice(cluster_indices)
            if a != b:
                add_edge(a, b)

    # Cross-cluster edges
    for _ in range(80):
        a = _rng.randint(0, len(agents) - 1)
        b = _rng.randint(0, len(agents) - 1)
        attempts = 0
        while (agents[b]["cluster_id"] == agents[a]["cluster_id"] or a == b) and attempts < 20:
            b = _rng.randint(0, len(agents) - 1)
            attempts += 1
        if a != b:
            add_edge(a, b)

    # Extra edges for influential agents
    for i, agent in enumerate(agents):
        if agent["influence_score"] > 70:
            for _ in range(_rng.randint(5, 12)):
                t = _rng.randint(0, len(agents) - 1)
                if t != i:
                    add_edge(i, t)

    return edges


def _generate_timeline(agents: list[dict]) -> list[dict]:
    rounds = []
    for r in range(1, 21):
        if r <= 4:
            agg = 0.15 - r * 0.02
        elif r <= 8:
            agg = 0.07 - (r - 4) * 0.08
        elif r <= 12:
            agg = -0.25 + (r - 8) * 0.05
        else:
            agg = -0.05 + (r - 12) * 0.03
        agg += (_rng.random() - 0.5) * 0.05
        agg = max(-1.0, min(1.0, round(agg, 3)))

        active = min(len(agents), int(len(agents) * (0.4 + _rng.random() * 0.4)))

        key_event = None
        if r == 5:
            key_event = "Major influencer @TechGuru publishes critical thread"
        elif r == 12:
            key_event = "Company releases official response addressing concerns"

        c0 = len([a for a in agents if a["cluster_id"] == 0])
        c1 = len([a for a in agents if a["cluster_id"] == 1])
        c2 = len(agents) - c0 - c1

        rounds.append({
            "round_number": r,
            "aggregate_sentiment": agg,
            "active_agent_count": active,
            "key_event": key_event,
            "cluster_snapshot": [
                {"cluster_id": 0, "size": c0, "dominant_narrative": CLUSTER_INFO[0]["dominant_narrative"]},
                {"cluster_id": 1, "size": c1, "dominant_narrative": CLUSTER_INFO[1]["dominant_narrative"]},
                {"cluster_id": 2, "size": c2, "dominant_narrative": CLUSTER_INFO[2]["dominant_narrative"]},
            ],
        })
    return rounds


def _generate_agent_actions(agent: dict, all_agents: list[dict]) -> list[dict]:
    actions = []
    count = _rng.randint(3, 15)
    sentiment_key = "positive" if agent["cluster_id"] == 0 else "negative" if agent["cluster_id"] == 1 else "neutral"

    for i in range(count):
        r = _rng.randint(1, 20)
        template = _rng.choice(POST_TEMPLATES[sentiment_key])
        content = template.replace("{topic}", _rng.choice(TOPICS))
        action_type = "post" if i == 0 else _rng.choice(["post", "comment", "like", "repost", "follow"])
        target = _rng.choice(all_agents)["id"] if action_type != "post" else None
        actions.append({"round": r, "type": action_type, "content": content, "target_agent_id": target})

    actions.sort(key=lambda x: x["round"])
    return actions


def get_mock_network_data() -> dict:
    """Returns the full mock network dataset, cached after first generation."""
    global _cached_data
    if _cached_data is not None:
        return _cached_data

    agents = _generate_agents()
    edges = _generate_edges(agents)
    timeline = _generate_timeline(agents)

    # Pre-compute sentiment timelines for all agents
    agent_timelines = {}
    nodes = []
    for agent in agents:
        st = _generate_sentiment_timeline(agent)
        agent_timelines[agent["id"]] = st
        nodes.append({
            "id": agent["id"],
            "sentiment_by_round": [t["score"] for t in st],
            "influence_score": agent["influence_score"],
            "agent_type": agent["agent_type"],
            "cluster_id": agent["cluster_id"],
        })

    _cached_data = {
        "agents": agents,
        "nodes": nodes,
        "edges": edges,
        "timeline": timeline,
        "agent_timelines": agent_timelines,
    }
    return _cached_data


def get_mock_agent_detail(agent_id: str) -> Optional[dict]:
    """Returns detailed data for a single agent."""
    data = get_mock_network_data()
    agent = next((a for a in data["agents"] if a["id"] == agent_id), None)
    if not agent:
        return None

    sentiment_timeline = data["agent_timelines"].get(agent_id, [])
    actions = _generate_agent_actions(agent, data["agents"])

    # Build connections from edges
    connections = {}
    for edge in data["edges"]:
        if edge["source"] == agent_id:
            other = edge["target"]
        elif edge["target"] == agent_id:
            other = edge["source"]
        else:
            continue
        if other in connections:
            connections[other]["interaction_count"] += edge["weight"]
        else:
            connections[other] = {
                "agent_id": other,
                "interaction_count": edge["weight"],
                "relationship_type": edge["interaction_type"],
            }

    conn_list = sorted(connections.values(), key=lambda x: x["interaction_count"], reverse=True)

    return {
        "profile": agent,
        "sentiment_timeline": sentiment_timeline,
        "actions": actions,
        "connections": conn_list,
    }


def mock_agent_chat(agent_id: str, message: str, history: list = None) -> dict:
    """Generate a mock in-character chat response."""
    data = get_mock_network_data()
    agent = next((a for a in data["agents"] if a["id"] == agent_id), None)
    if not agent:
        return {"reply": "I'm not sure how to respond to that."}

    sentiment = "optimistic" if agent["cluster_id"] == 0 else "skeptical" if agent["cluster_id"] == 1 else "cautious"
    responses = [
        f"That's a great question. As a {agent['occupation'].lower()}, I've been thinking about this a lot. "
        f"My view is {sentiment} — I think the evidence points to {'significant potential' if agent['cluster_id'] == 0 else 'real concerns' if agent['cluster_id'] == 1 else 'a need for more data'}.",
        f"I've been following this closely from {agent['location']}. The local reaction has been mixed, "
        f"but I remain {sentiment}. {'The opportunities are real.' if agent['cluster_id'] == 0 else 'We need stronger safeguards.' if agent['cluster_id'] == 1 else 'Time will tell.'}",
        f"Based on my experience in {agent['occupation'].lower()}, I'd say the {sentiment} view is well-founded. "
        f"{'Innovation always faces resistance initially.' if agent['cluster_id'] == 0 else 'History has shown us to be careful with promises like these.' if agent['cluster_id'] == 1 else 'Both sides have valid points.'}",
    ]
    idx = hash(message) % len(responses)
    return {"reply": responses[idx]}
