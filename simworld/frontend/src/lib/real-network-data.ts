/**
 * Transforms real simulation data (from `/api/simulations/:id`) into the
 * NetworkAgent / NetworkNode / NetworkEdge / TimelineRound shape that the
 * ForceGraph visualization expects.
 *
 * The backend doesn't model explicit edges between agents, so we synthesize
 * plausible connections: within-cluster agents connect more often than
 * cross-cluster; influential agents attract extra edges. Sentiment trajectories
 * are generated per-agent by anchoring to the agent's base sentiment and
 * following the aggregate timeline's positive/negative ratio per round.
 */
import type {
  NetworkAgent,
  NetworkEdge,
  NetworkNode,
  TimelineRound,
} from "./mock-network-data";
import { CLUSTER_INFO } from "./mock-network-data";

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface RealAgent {
  id: string;
  name: string;
  role: string;
  platform: string;
  stance: string;
  sentiment: string; // positive | negative | neutral
  bio: string;
  posts_count: number;
  interactions_count: number;
  influence_score: number;
  key_quotes?: string[];
}

interface RealTimelineEntry {
  round: number;
  timestamp?: string;
  positive: number;
  negative: number;
  neutral: number;
  total_posts: number;
  total_interactions: number;
  key_event: string | null;
}

interface RealNarrative {
  id?: string;
  label: string;
  sentiment?: string;
  agent_count?: number;
  description?: string;
  key_themes?: string[];
}

export interface RealNetworkData {
  agents: NetworkAgent[];
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  timeline: TimelineRound[];
  agentTimelines: Map<string, { round: number; score: number; trigger_event: string | null }[]>;
  clusterInfo: { id: number; name: string; dominant_narrative: string }[];
}

function inferAgentType(role: string, stance: string): NetworkAgent["agent_type"] {
  const r = role.toLowerCase();
  if (/journalist|reporter|podcast|media|writer|editor|blogger|newsletter/.test(r)) return "media";
  if (/activist|advocate|critic|organizer|whistle/.test(r) || stance === "adversarial") return "adversarial";
  if (/professor|analyst|researcher|policy|fellow|attorney|consultant|regulator|academic/.test(r)) return "institutional";
  if (/ceo|founder|vp|chief|head of|product manager|director|executive/.test(r)) return "seed";
  return "general_public";
}

function clusterFromSentiment(sentiment: string): number {
  if (sentiment === "positive") return 0;
  if (sentiment === "negative") return 1;
  return 2;
}

function firstName(name: string): string {
  return name.split(" ")[0] || name;
}

function lastName(name: string): string {
  const parts = name.split(" ");
  return parts[parts.length - 1] || "";
}

function buildSentimentTimeline(
  agent: RealAgent,
  timeline: RealTimelineEntry[],
  rand: () => number,
): { round: number; score: number; trigger_event: string | null }[] {
  const base =
    agent.sentiment === "positive" ? 0.4 + rand() * 0.4
    : agent.sentiment === "negative" ? -0.8 + rand() * 0.4
    : -0.15 + rand() * 0.3;

  const result: { round: number; score: number; trigger_event: string | null }[] = [];
  let score = base;

  for (let i = 0; i < timeline.length; i++) {
    const t = timeline[i];
    // Aggregate "mood" delta: positive ratio minus negative ratio, centered.
    const mood = (t.positive - t.negative); // range roughly [-1, 1]
    // Pull gently toward the aggregate mood, but anchor to the agent's base.
    const anchor = base * 0.7 + mood * 0.3;
    const gravity = (anchor - score) * 0.15;
    const drift = (rand() - 0.5) * 0.08;
    score = Math.max(-1, Math.min(1, score + gravity + drift));

    result.push({
      round: t.round ?? i + 1,
      score: Math.round(score * 100) / 100,
      trigger_event: t.key_event || null,
    });
  }
  return result;
}

export function buildNetworkFromSimulation(sim: {
  agents?: RealAgent[];
  timeline?: RealTimelineEntry[];
  narratives?: RealNarrative[];
}): RealNetworkData {
  const realAgents = sim.agents || [];
  const realTimeline = sim.timeline || [];
  const narratives = sim.narratives || [];

  // Seed RNG so the layout/edges stay stable across renders for the same data.
  const seed = realAgents.length * 1000 + realTimeline.length;
  const rand = mulberry32(seed);

  // --- Build NetworkAgents ---
  const agents: NetworkAgent[] = realAgents.map((a, idx) => {
    const agent_type = inferAgentType(a.role || "", a.stance || "");
    const cluster_id = clusterFromSentiment(a.sentiment || "neutral");
    const initial_sentiment =
      a.sentiment === "positive" ? 0.4 + rand() * 0.4
      : a.sentiment === "negative" ? -0.8 + rand() * 0.4
      : -0.15 + rand() * 0.3;

    return {
      id: a.id,
      name: a.name || `Agent ${idx}`,
      persona: a.bio || `${a.role || "Participant"} with a ${a.stance || "neutral"} stance.`,
      age: 22 + Math.floor(rand() * 44),
      occupation: a.role || "Participant",
      location: "—",
      agent_type,
      initial_sentiment: Math.round(initial_sentiment * 100) / 100,
      influence_score: Math.max(5, Math.round((a.influence_score || 0.4) * 100)),
      avatar_seed: `${firstName(a.name).toLowerCase()}-${lastName(a.name).toLowerCase()}-${idx}`,
      platform: (a.platform === "reddit" ? "reddit" : "twitter") as NetworkAgent["platform"],
      cluster_id,
    };
  });

  // --- Build sentiment timelines per agent ---
  const agentTimelines = new Map<
    string,
    { round: number; score: number; trigger_event: string | null }[]
  >();

  const nodes: NetworkNode[] = agents.map((agent) => {
    const realAgent = realAgents.find((r) => r.id === agent.id)!;
    const st = buildSentimentTimeline(realAgent, realTimeline, rand);
    agentTimelines.set(agent.id, st);
    return {
      id: agent.id,
      sentiment_by_round: st.map((s) => s.score),
      influence_score: agent.influence_score,
      agent_type: agent.agent_type,
      cluster_id: agent.cluster_id,
    };
  });

  // --- Synthesize edges ---
  const edges: NetworkEdge[] = [];
  const edgeSet = new Set<string>();

  function addEdge(aIdx: number, bIdx: number) {
    if (aIdx === bIdx) return;
    const key = aIdx < bIdx ? `${aIdx}-${bIdx}` : `${bIdx}-${aIdx}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    const source = agents[aIdx];
    const target = agents[bIdx];
    const sameCluster = source.cluster_id === target.cluster_id;
    const interaction_type: "positive" | "negative" | "neutral" =
      sameCluster
        ? rand() < 0.72 ? "positive" : rand() < 0.5 ? "neutral" : "negative"
        : rand() < 0.18 ? "positive" : rand() < 0.55 ? "negative" : "neutral";
    const weight = sameCluster
      ? 2 + Math.floor(rand() * 6)
      : 1 + Math.floor(rand() * 3);
    const totalRounds = Math.max(1, realTimeline.length);
    const numRounds = 1 + Math.floor(rand() * Math.min(10, totalRounds));
    const rounds_active: number[] = [];
    for (let i = 0; i < numRounds; i++) {
      const r = 1 + Math.floor(rand() * totalRounds);
      if (!rounds_active.includes(r)) rounds_active.push(r);
    }
    rounds_active.sort((a, b) => a - b);
    edges.push({
      source: source.id,
      target: target.id,
      weight,
      interaction_type,
      rounds_active,
    });
  }

  // Within-cluster edges
  for (let clusterId = 0; clusterId < 3; clusterId++) {
    const indices = agents
      .map((a, i) => ({ a, i }))
      .filter(({ a }) => a.cluster_id === clusterId)
      .map(({ i }) => i);
    const targetEdges = Math.floor(indices.length * 1.8);
    for (let e = 0; e < targetEdges; e++) {
      const a = indices[Math.floor(rand() * indices.length)];
      const b = indices[Math.floor(rand() * indices.length)];
      if (a !== undefined && b !== undefined) addEdge(a, b);
    }
  }

  // Cross-cluster edges
  const crossEdges = Math.max(20, Math.floor(agents.length * 0.4));
  for (let e = 0; e < crossEdges; e++) {
    const a = Math.floor(rand() * agents.length);
    let b = Math.floor(rand() * agents.length);
    let tries = 0;
    while (tries < 5 && (a === b || agents[a].cluster_id === agents[b].cluster_id)) {
      b = Math.floor(rand() * agents.length);
      tries++;
    }
    addEdge(a, b);
  }

  // Influential agents get extra edges
  agents.forEach((agent, i) => {
    if (agent.influence_score > 65) {
      const extra = 4 + Math.floor(rand() * 8);
      for (let e = 0; e < extra; e++) {
        addEdge(i, Math.floor(rand() * agents.length));
      }
    }
  });

  // --- Build timeline ---
  const sortedNarratives = [...narratives].sort(
    (a, b) => (b.agent_count || 0) - (a.agent_count || 0),
  );
  const narrativeBySentiment: Record<string, string> = {
    positive: "",
    negative: "",
    neutral: "",
  };
  for (const n of sortedNarratives) {
    const key = n.sentiment || "neutral";
    if (!narrativeBySentiment[key]) narrativeBySentiment[key] = n.label || "";
  }

  const clusterNames = [
    narrativeBySentiment.positive || "Supporters",
    narrativeBySentiment.negative || "Critics",
    narrativeBySentiment.neutral || "Observers",
  ];

  const timeline: TimelineRound[] = realTimeline.map((t, i) => {
    const aggregate = t.positive - t.negative;
    // Cluster sizes scale with round ratios
    const c0 = Math.max(1, Math.round(agents.length * t.positive));
    const c1 = Math.max(1, Math.round(agents.length * t.negative));
    const c2 = Math.max(1, agents.length - c0 - c1);
    const active_agent_count = Math.min(
      agents.length,
      Math.max(1, Math.floor(agents.length * (0.4 + rand() * 0.4))),
    );
    return {
      round_number: t.round ?? i + 1,
      aggregate_sentiment: Math.round(aggregate * 100) / 100,
      active_agent_count,
      key_event: t.key_event || null,
      cluster_snapshot: [
        { cluster_id: 0, size: c0, dominant_narrative: clusterNames[0] },
        { cluster_id: 1, size: c1, dominant_narrative: clusterNames[1] },
        { cluster_id: 2, size: c2, dominant_narrative: clusterNames[2] },
      ],
    };
  });

  const clusterInfo = [
    { id: 0, name: "Supporters", dominant_narrative: clusterNames[0] },
    { id: 1, name: "Critics", dominant_narrative: clusterNames[1] },
    { id: 2, name: "Observers", dominant_narrative: clusterNames[2] },
  ];

  // If there are no agents yet, fall back to the mock cluster info so labels render.
  if (agents.length === 0) {
    return {
      agents,
      nodes,
      edges,
      timeline,
      agentTimelines,
      clusterInfo: CLUSTER_INFO.map((c) => ({
        id: c.id,
        name: c.name,
        dominant_narrative: c.dominant_narrative,
      })),
    };
  }

  return { agents, nodes, edges, timeline, agentTimelines, clusterInfo };
}
