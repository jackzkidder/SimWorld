"""
Mock MiroFish adapter that generates realistic fake simulation data.
Used during Phase 1-2 development so the frontend can be built
without the MiroFish engine running.
"""

import random
from datetime import datetime, timedelta


AGENT_TEMPLATES = [
    {"name": "Sarah Chen", "role": "Tech Journalist", "platform": "twitter", "stance": "critical"},
    {"name": "Marcus Williams", "role": "Retail Investor", "platform": "reddit", "stance": "supportive"},
    {"name": "Dr. Emily Park", "role": "Industry Analyst", "platform": "twitter", "stance": "analytical"},
    {"name": "Jake Rodriguez", "role": "Software Engineer", "platform": "reddit", "stance": "skeptical"},
    {"name": "Amanda Foster", "role": "PR Professional", "platform": "twitter", "stance": "diplomatic"},
    {"name": "David Kim", "role": "Hedge Fund Analyst", "platform": "twitter", "stance": "bearish"},
    {"name": "Lisa Thompson", "role": "Consumer Advocate", "platform": "reddit", "stance": "critical"},
    {"name": "Prof. Robert Chang", "role": "AI Ethics Researcher", "platform": "twitter", "stance": "cautious"},
    {"name": "Michelle Santos", "role": "Small Business Owner", "platform": "reddit", "stance": "pragmatic"},
    {"name": "Ryan O'Brien", "role": "Regulatory Analyst", "platform": "twitter", "stance": "regulatory"},
    {"name": "Priya Patel", "role": "Venture Capitalist", "platform": "twitter", "stance": "bullish"},
    {"name": "Tom Bradley", "role": "Union Representative", "platform": "reddit", "stance": "adversarial"},
    {"name": "Kenji Tanaka", "role": "Product Manager", "platform": "reddit", "stance": "supportive"},
    {"name": "Rachel Green", "role": "Social Media Influencer", "platform": "twitter", "stance": "sensationalist"},
    {"name": "Omar Hassan", "role": "Policy Researcher", "platform": "twitter", "stance": "analytical"},
    {"name": "Carla Reyes", "role": "Startup Founder", "platform": "reddit", "stance": "enthusiastic"},
    {"name": "Brian Murphy", "role": "Short Seller", "platform": "twitter", "stance": "bearish"},
    {"name": "Dr. Wei Liu", "role": "Data Scientist", "platform": "reddit", "stance": "neutral"},
    {"name": "Natasha Volkov", "role": "Investigative Reporter", "platform": "twitter", "stance": "aggressive"},
    {"name": "Chris Patterson", "role": "IT Director", "platform": "reddit", "stance": "pragmatic"},
]

SENTIMENT_MAP = {
    "critical": "negative",
    "skeptical": "negative",
    "bearish": "negative",
    "adversarial": "negative",
    "aggressive": "negative",
    "sensationalist": "mixed",
    "supportive": "positive",
    "bullish": "positive",
    "enthusiastic": "positive",
    "diplomatic": "positive",
    "analytical": "neutral",
    "cautious": "neutral",
    "regulatory": "neutral",
    "pragmatic": "neutral",
    "neutral": "neutral",
}


class MockMirofishAdapter:
    """Generates realistic mock simulation data for frontend development."""

    def generate_mock_result(
        self,
        prediction_question: str,
        agent_count: int = 200,
        platforms: str = "both",
    ) -> dict:
        """Generate a complete mock simulation result."""

        # Scale agents
        agents = self._generate_agents(agent_count, platforms)
        timeline = self._generate_timeline(rounds=20)
        narratives = self._generate_narratives(agent_count)
        inflection_points = self._generate_inflection_points()

        # Calculate summary stats
        sentiment_scores = [
            1 if a["sentiment"] == "positive" else -1 if a["sentiment"] == "negative" else 0
            for a in agents
        ]
        avg_sentiment = sum(sentiment_scores) / len(sentiment_scores) if sentiment_scores else 0

        if avg_sentiment > 0.2:
            risk_tier = "low"
            overall_sentiment = "positive"
        elif avg_sentiment < -0.2:
            risk_tier = "high"
            overall_sentiment = "negative"
        else:
            risk_tier = "medium"
            overall_sentiment = "mixed"

        # Generate contextual recommended actions
        top_narrative_labels = [n["label"] for n in narratives[:3]]
        recommended_actions = self._generate_contextual_actions(
            prediction_question, top_narrative_labels, overall_sentiment, risk_tier
        )

        return {
            "executive_summary": {
                "overall_sentiment": overall_sentiment,
                "sentiment_score": round(avg_sentiment, 2),
                "risk_tier": risk_tier,
                "confidence": round(random.uniform(0.7, 0.92), 2),
                "top_narratives": top_narrative_labels,
                "recommended_actions": recommended_actions,
            },
            "timeline": timeline,
            "narratives": narratives,
            "inflection_points": inflection_points,
            "agents": agents,
            "stats": {
                "total_agents": len(agents),
                "total_rounds": len(timeline),
                "total_posts": sum(t["total_posts"] for t in timeline),
                "total_interactions": sum(t["total_interactions"] for t in timeline),
                "sentiment_breakdown": {
                    "positive": len([a for a in agents if a["sentiment"] == "positive"]),
                    "negative": len([a for a in agents if a["sentiment"] == "negative"]),
                    "neutral": len([a for a in agents if a["sentiment"] == "neutral"]),
                    "mixed": len([a for a in agents if a["sentiment"] == "mixed"]),
                },
            },
        }

    def _generate_agents(self, count: int, platforms: str) -> list:
        """Generate agent list scaled to the requested count."""
        agents = []
        for i in range(count):
            template = AGENT_TEMPLATES[i % len(AGENT_TEMPLATES)]
            suffix = f" #{i // len(AGENT_TEMPLATES) + 1}" if i >= len(AGENT_TEMPLATES) else ""

            platform = template["platform"]
            if platforms == "twitter":
                platform = "twitter"
            elif platforms == "reddit":
                platform = "reddit"

            agents.append({
                "id": f"agent_{i:04d}",
                "name": f"{template['name']}{suffix}",
                "role": template["role"],
                "platform": platform,
                "stance": template["stance"],
                "sentiment": SENTIMENT_MAP.get(template["stance"], "neutral"),
                "posts_count": random.randint(2, 15),
                "interactions_count": random.randint(10, 80),
                "influence_score": round(random.uniform(0.1, 1.0), 2),
                "key_quotes": [
                    f"This is a significant development that will reshape the industry. [{template['name']}]",
                    f"From a {template['role'].lower()} perspective, the implications are clear. [{template['name']}]",
                ],
            })
        return agents

    def _generate_timeline(self, rounds: int = 20) -> list:
        """Generate sentiment timeline data."""
        timeline = []
        pos, neg, neu = 0.35, 0.30, 0.35

        for i in range(rounds):
            pos += random.uniform(-0.04, 0.04)
            neg += random.uniform(-0.04, 0.04)

            # Simulate a controversy spike around round 5-8
            if 5 <= i <= 8:
                neg += 0.02
                pos -= 0.01

            # Normalize
            total = pos + neg + neu
            pos, neg, neu = pos / total, neg / total, neu / total

            timeline.append({
                "round": i + 1,
                "timestamp": (datetime.utcnow() - timedelta(hours=rounds - i)).isoformat(),
                "positive": round(max(0.05, pos), 3),
                "negative": round(max(0.05, neg), 3),
                "neutral": round(max(0.05, neu), 3),
                "total_posts": random.randint(8, 30),
                "total_interactions": random.randint(30, 200),
            })
        return timeline

    def _generate_narratives(self, agent_count: int) -> list:
        return [
            {
                "id": "n1",
                "label": "Privacy & Data Concerns",
                "sentiment": "negative",
                "agent_count": int(agent_count * 0.25),
                "description": "Group focused on data privacy implications and potential misuse of personal information.",
                "key_themes": ["data collection", "surveillance", "consent", "GDPR"],
            },
            {
                "id": "n2",
                "label": "Innovation Enthusiasts",
                "sentiment": "positive",
                "agent_count": int(agent_count * 0.20),
                "description": "Supporters who see this as technological progress and competitive necessity.",
                "key_themes": ["progress", "efficiency", "market leadership", "AI"],
            },
            {
                "id": "n3",
                "label": "Wait-and-See Moderates",
                "sentiment": "neutral",
                "agent_count": int(agent_count * 0.30),
                "description": "Cautious observers wanting more details before forming strong opinions.",
                "key_themes": ["need more info", "cautious optimism", "implementation"],
            },
            {
                "id": "n4",
                "label": "Economic Impact Worriers",
                "sentiment": "negative",
                "agent_count": int(agent_count * 0.15),
                "description": "Concerned about job displacement and widening economic inequality.",
                "key_themes": ["job loss", "automation", "inequality", "retraining"],
            },
            {
                "id": "n5",
                "label": "Competitive Strategists",
                "sentiment": "neutral",
                "agent_count": int(agent_count * 0.10),
                "description": "Analysts focused on market positioning and competitive dynamics.",
                "key_themes": ["market share", "competitor response", "valuation", "moat"],
            },
        ]

    def _generate_inflection_points(self) -> list:
        return [
            {
                "round": 3,
                "description": "Privacy concerns article goes viral on Twitter",
                "sentiment_shift": -0.12,
                "trigger": "Tech journalist publishes critical analysis thread",
            },
            {
                "round": 8,
                "description": "Regulatory analyst raises compliance questions",
                "sentiment_shift": -0.08,
                "trigger": "Former regulator weighs in on potential enforcement actions",
            },
            {
                "round": 12,
                "description": "Industry analyst publishes balanced assessment",
                "sentiment_shift": 0.04,
                "trigger": "Major research firm releases detailed report",
            },
            {
                "round": 15,
                "description": "Small business owners share positive use cases",
                "sentiment_shift": 0.06,
                "trigger": "Organic grassroots support emerges on Reddit",
            },
        ]

    def _generate_contextual_actions(
        self,
        question: str,
        top_narratives: list[str],
        sentiment: str,
        risk_tier: str,
    ) -> list[str]:
        """Generate recommended actions that reference the actual simulation context."""
        q_lower = question.lower()
        actions = []

        # First action: address the top concern narrative
        if top_narratives:
            actions.append(
                f'Proactively address "{top_narratives[0]}" — the dominant narrative — '
                f"with a dedicated response before going public"
            )

        # Sentiment-specific actions
        if sentiment == "negative" or risk_tier == "high":
            actions.append(
                "Consider delaying the announcement and running a smaller pilot first "
                "to build positive case studies that counter the negative sentiment"
            )
        elif sentiment == "mixed":
            actions.append(
                "Prepare a detailed FAQ addressing the split in opinion, "
                "with concrete data points for skeptics and clear benefits for supporters"
            )
        else:
            actions.append(
                "Leverage the positive sentiment by amplifying supportive voices "
                "through early access programs and testimonial campaigns"
            )

        # Topic-aware actions
        if any(w in q_lower for w in ["ai", "artificial intelligence", "machine learning", "algorithm"]):
            actions.append(
                "Commission an independent bias audit and publish the results "
                "alongside the announcement to preempt ethical concerns"
            )
        elif any(w in q_lower for w in ["price", "pricing", "cost", "fee", "subscription"]):
            actions.append(
                "Lead with a value comparison showing ROI relative to alternatives, "
                "and offer a free trial to reduce price sensitivity"
            )
        elif any(w in q_lower for w in ["policy", "regulation", "law", "legislation"]):
            actions.append(
                "Engage key industry stakeholders and advocacy groups early "
                "to build a coalition of support before the public debate begins"
            )
        else:
            actions.append(
                "Brief 3-5 key journalists and industry analysts under embargo "
                "to ensure informed coverage shapes the initial narrative"
            )

        # Second narrative action
        if len(top_narratives) >= 2:
            actions.append(
                f'Monitor the "{top_narratives[1]}" narrative closely — '
                f"it has potential to become the dominant storyline within 48 hours"
            )

        return actions

    def mock_agent_chat(self, agent_id: str, message: str) -> dict:
        """Generate a mock chat response from an agent."""
        idx = int(agent_id.split("_")[-1]) if "_" in agent_id else 0
        template = AGENT_TEMPLATES[idx % len(AGENT_TEMPLATES)]

        return {
            "agent_id": agent_id,
            "agent_name": template["name"],
            "response": (
                f"As a {template['role']}, I've been following this closely. "
                f"My {template['stance']} perspective leads me to believe that "
                f"the key issue here is about building trust with stakeholders. "
                f"The simulation showed that public opinion shifted significantly "
                f"when concrete evidence was presented. I think the most important "
                f"thing right now is transparency about intentions and implementation details."
            ),
            "sentiment": SENTIMENT_MAP.get(template["stance"], "neutral"),
            "timestamp": datetime.utcnow().isoformat(),
        }
