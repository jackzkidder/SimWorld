/**
 * Client-side mock data for the Agent Network Web View.
 * Generates 150 agents, 400 edges, 20 rounds with 3 opinion clusters.
 * Uses seeded random for consistency.
 */

// Seeded random number generator
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = mulberry32(42);
function rand() { return rng(); }
function randInt(min: number, max: number) { return Math.floor(rand() * (max - min + 1)) + min; }
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }

// Types
export interface NetworkAgent {
  id: string;
  name: string;
  persona: string;
  age: number;
  occupation: string;
  location: string;
  agent_type: "general_public" | "media" | "adversarial" | "institutional" | "seed";
  initial_sentiment: number;
  influence_score: number;
  avatar_seed: string;
  platform: "twitter" | "reddit";
  cluster_id: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  weight: number;
  interaction_type: "positive" | "negative" | "neutral";
  rounds_active: number[];
}

export interface NetworkNode {
  id: string;
  sentiment_by_round: number[];
  influence_score: number;
  agent_type: string;
  cluster_id: number;
}

export interface TimelineRound {
  round_number: number;
  aggregate_sentiment: number;
  active_agent_count: number;
  key_event: string | null;
  cluster_snapshot: { cluster_id: number; size: number; dominant_narrative: string }[];
}

export interface AgentAction {
  round: number;
  type: "post" | "comment" | "like" | "repost" | "follow" | "mute";
  content: string;
  target_agent_id: string | null;
}

export interface AgentConnection {
  agent_id: string;
  interaction_count: number;
  relationship_type: "positive" | "negative" | "neutral";
}

export interface AgentDetail {
  profile: NetworkAgent;
  sentiment_timeline: { round: number; score: number; trigger_event: string | null }[];
  actions: AgentAction[];
  connections: AgentConnection[];
}

// Data
const FIRST_NAMES = [
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
];

const LAST_NAMES = [
  "Chen", "Rivera", "Okafor", "Petrov", "Kim", "Santos", "Mueller", "Nakamura",
  "Williams", "Andersen", "Gupta", "Hernandez", "Larsson", "Osei", "Patel",
  "Reyes", "Singh", "Torres", "Volkov", "Walsh", "Yamamoto", "Zhang", "Ali",
  "Brooks", "Cruz", "Diaz", "Evans", "Foster", "Garcia", "Hayes", "Ibrahim",
  "Johansson", "Khan", "Lin", "Martinez", "Nguyen", "O'Brien", "Park",
];

const OCCUPATIONS_BY_TYPE: Record<string, string[]> = {
  general_public: [
    "Software Engineer", "Teacher", "Nurse", "Accountant", "Marketing Manager",
    "Graphic Designer", "Sales Representative", "Electrician", "Student",
    "Small Business Owner", "Freelance Writer", "Restaurant Manager",
    "Real Estate Agent", "Physical Therapist", "Data Analyst",
  ],
  media: [
    "Tech Journalist", "News Reporter", "Podcast Host", "Newsletter Writer",
    "Industry Analyst", "Media Producer", "Editorial Director",
  ],
  adversarial: [
    "Privacy Activist", "Consumer Rights Advocate", "Ethics Researcher",
    "Investigative Blogger", "Whistleblower Advocate", "Labor Organizer",
  ],
  institutional: [
    "Policy Analyst", "Regulatory Consultant", "University Professor",
    "Think Tank Fellow", "Investment Analyst", "Corporate Attorney",
  ],
  seed: [
    "Product Manager", "CEO", "VP of Communications", "Head of Marketing",
    "Chief Strategy Officer",
  ],
};

const LOCATIONS = [
  "San Francisco, CA", "New York, NY", "Austin, TX", "Seattle, WA",
  "Chicago, IL", "Boston, MA", "Los Angeles, CA", "Denver, CO",
  "Portland, OR", "Atlanta, GA", "Miami, FL", "Detroit, MI",
  "Minneapolis, MN", "Nashville, TN", "Philadelphia, PA", "London, UK",
  "Toronto, CA", "Berlin, DE", "Sydney, AU", "Tokyo, JP",
];

const CLUSTER_NARRATIVES = [
  {
    id: 0,
    name: "Supporters",
    dominant_narrative: "Innovation potential outweighs risks",
    personas: [
      "Enthusiastic early adopter who sees transformative potential",
      "Pragmatic optimist focused on economic benefits and job creation",
      "Tech-forward thinker excited about efficiency improvements",
    ],
  },
  {
    id: 1,
    name: "Critics",
    dominant_narrative: "Significant risks being downplayed by proponents",
    personas: [
      "Concerned citizen worried about privacy and surveillance",
      "Skeptic who has seen similar promises fail to deliver",
      "Vocal critic highlighting regulatory gaps and corporate overreach",
    ],
  },
  {
    id: 2,
    name: "Cautious Observers",
    dominant_narrative: "Wait-and-see approach with measured expectations",
    personas: [
      "Analytical observer weighing evidence from both sides carefully",
      "Moderate voice calling for balanced regulation and oversight",
      "Pragmatist interested in real-world results before forming opinion",
    ],
  },
];

const POST_TEMPLATES = {
  positive: [
    "This could genuinely change how we approach {topic}. The early data looks promising.",
    "I've been following this closely and I'm cautiously optimistic. The team seems competent.",
    "People dismissing this haven't looked at the actual research. It's solid work.",
    "Just attended the demo. Color me impressed. This is real progress.",
    "Hot take: this is exactly what the industry needed. Competition drives innovation.",
    "The implications for {topic} are massive. We're at an inflection point.",
  ],
  negative: [
    "Am I the only one seeing the massive red flags here? This is concerning.",
    "We've been sold this story before. Remember when {topic} was going to 'change everything'?",
    "The privacy implications alone should give everyone pause. Where's the oversight?",
    "This feels like a solution looking for a problem. Who actually asked for this?",
    "Thread 🧵: Here's why the hype around this is fundamentally misguided...",
    "Corporate press release ≠ reality. Let's talk about what they're NOT saying about {topic}.",
  ],
  neutral: [
    "Interesting development. Going to wait for independent analysis before forming an opinion.",
    "Some valid points on both sides here. The truth is probably somewhere in the middle.",
    "Worth watching but too early to draw conclusions. Need more data on {topic}.",
    "Can someone explain the technical details? The reporting has been surface-level.",
    "Balanced take: there are real opportunities AND real risks. Let's acknowledge both.",
    "Reserving judgment. The initial reactions seem driven by hype rather than substance.",
  ],
};

const TOPICS = [
  "AI governance", "data privacy", "market disruption", "workforce automation",
  "platform economics", "digital infrastructure", "regulatory compliance",
  "public trust", "innovation cycles", "sustainable growth",
];

// Generate agents
function generateAgents(): NetworkAgent[] {
  const agents: NetworkAgent[] = [];
  const typeDistribution: [string, number][] = [
    ["general_public", 100],
    ["media", 15],
    ["adversarial", 12],
    ["institutional", 15],
    ["seed", 8],
  ];

  let idx = 0;
  for (const [type, count] of typeDistribution) {
    for (let i = 0; i < count; i++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const name = `${firstName} ${lastName}`;
      const occupation = pick(OCCUPATIONS_BY_TYPE[type]);
      const location = pick(LOCATIONS);
      const age = randInt(22, 65);

      // Assign clusters with weighted distribution
      let cluster_id: number;
      if (type === "seed") {
        cluster_id = 0; // Seed agents are supporters
      } else if (type === "adversarial") {
        cluster_id = 1; // Adversarial agents are critics
      } else if (type === "media") {
        cluster_id = rand() < 0.3 ? 1 : rand() < 0.5 ? 0 : 2;
      } else if (type === "institutional") {
        cluster_id = rand() < 0.4 ? 2 : rand() < 0.7 ? 0 : 1;
      } else {
        // General public: roughly 50 supporters, 40 critics, 60 observers
        const r = rand();
        cluster_id = r < 0.33 ? 0 : r < 0.6 ? 1 : 2;
      }

      // Initial sentiment based on cluster
      let initial_sentiment: number;
      if (cluster_id === 0) initial_sentiment = 0.3 + rand() * 0.5; // 0.3 to 0.8
      else if (cluster_id === 1) initial_sentiment = -0.8 + rand() * 0.5; // -0.8 to -0.3
      else initial_sentiment = -0.2 + rand() * 0.4; // -0.2 to 0.2

      // Influence score
      let influence_score: number;
      if (type === "media") influence_score = 50 + randInt(20, 50);
      else if (type === "seed") influence_score = 60 + randInt(20, 40);
      else if (type === "adversarial") influence_score = 40 + randInt(15, 45);
      else if (type === "institutional") influence_score = 35 + randInt(20, 45);
      else influence_score = randInt(5, 60);

      const persona = pick(CLUSTER_NARRATIVES[cluster_id].personas);
      const platform = rand() < 0.6 ? "twitter" : "reddit";

      agents.push({
        id: `agent_${String(idx).padStart(3, "0")}`,
        name,
        persona: `${persona}. ${age}-year-old ${occupation.toLowerCase()} based in ${location}.`,
        age,
        occupation,
        location,
        agent_type: type as NetworkAgent["agent_type"],
        initial_sentiment: Math.round(initial_sentiment * 100) / 100,
        influence_score,
        avatar_seed: `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${idx}`,
        platform: platform as "twitter" | "reddit",
        cluster_id,
      });
      idx++;
    }
  }
  return agents;
}

// Generate sentiment timeline for an agent over 20 rounds
function generateAgentSentimentTimeline(agent: NetworkAgent): { round: number; score: number; trigger_event: string | null }[] {
  const timeline: { round: number; score: number; trigger_event: string | null }[] = [];
  let score = agent.initial_sentiment;

  for (let round = 1; round <= 20; round++) {
    let trigger_event: string | null = null;

    // Key events affect sentiment
    if (round === 5) {
      // Critical thread causes negative shift
      if (agent.cluster_id === 2) {
        score -= 0.15 + rand() * 0.15;
        trigger_event = "Reacted to @TechGuru's critical analysis thread";
      } else if (agent.cluster_id === 0) {
        score -= 0.05 + rand() * 0.1;
        trigger_event = "Saw viral criticism, maintained mostly positive view";
      } else {
        score -= 0.1 + rand() * 0.1;
        trigger_event = "Amplified critical talking points from influential thread";
      }
    } else if (round === 12) {
      // Company response causes positive recovery
      if (agent.cluster_id === 0) {
        score += 0.1 + rand() * 0.15;
        trigger_event = "Official response validated initial optimism";
      } else if (agent.cluster_id === 2) {
        score += 0.1 + rand() * 0.1;
        trigger_event = "Company's response addressed some key concerns";
      } else {
        score += 0.02 + rand() * 0.05;
        trigger_event = "Noted official response but remained skeptical";
      }
    } else {
      // Natural drift
      const drift = (rand() - 0.5) * 0.08;
      // Cluster gravity: pull toward cluster center
      const clusterCenter = agent.cluster_id === 0 ? 0.5 : agent.cluster_id === 1 ? -0.5 : 0.1;
      const gravity = (clusterCenter - score) * 0.03;
      score += drift + gravity;
    }

    // Clamp
    score = Math.max(-1, Math.min(1, score));
    timeline.push({
      round,
      score: Math.round(score * 100) / 100,
      trigger_event,
    });
  }
  return timeline;
}

// Generate edges
function generateEdges(agents: NetworkAgent[]): NetworkEdge[] {
  const edges: NetworkEdge[] = [];
  const edgeSet = new Set<string>();

  function addEdge(sourceIdx: number, targetIdx: number) {
    const key = `${sourceIdx}-${targetIdx}`;
    const keyReverse = `${targetIdx}-${sourceIdx}`;
    if (edgeSet.has(key) || edgeSet.has(keyReverse)) return;
    edgeSet.add(key);

    const source = agents[sourceIdx];
    const target = agents[targetIdx];
    const sameCluster = source.cluster_id === target.cluster_id;

    const interaction_type: "positive" | "negative" | "neutral" =
      sameCluster
        ? rand() < 0.75 ? "positive" : rand() < 0.5 ? "neutral" : "negative"
        : rand() < 0.15 ? "positive" : rand() < 0.6 ? "negative" : "neutral";

    const weight = sameCluster ? randInt(2, 8) : randInt(1, 4);

    // Active in random subset of rounds
    const numRounds = randInt(1, 10);
    const rounds_active: number[] = [];
    for (let i = 0; i < numRounds; i++) {
      const r = randInt(1, 20);
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

  // Within-cluster edges (denser)
  for (let clusterId = 0; clusterId < 3; clusterId++) {
    const clusterAgents = agents
      .map((a, i) => ({ agent: a, idx: i }))
      .filter(({ agent }) => agent.cluster_id === clusterId);

    const targetEdges = Math.floor(clusterAgents.length * 1.8);
    for (let e = 0; e < targetEdges; e++) {
      const a = pick(clusterAgents);
      const b = pick(clusterAgents);
      if (a.idx !== b.idx) addEdge(a.idx, b.idx);
    }
  }

  // Cross-cluster edges (sparser)
  for (let e = 0; e < 80; e++) {
    const a = randInt(0, agents.length - 1);
    let b = randInt(0, agents.length - 1);
    while (agents[b].cluster_id === agents[a].cluster_id || a === b) {
      b = randInt(0, agents.length - 1);
    }
    addEdge(a, b);
  }

  // Influential agents get extra edges
  const influential = agents
    .map((a, i) => ({ agent: a, idx: i }))
    .filter(({ agent }) => agent.influence_score > 70);
  for (const inf of influential) {
    const extraEdges = randInt(5, 12);
    for (let e = 0; e < extraEdges; e++) {
      const target = randInt(0, agents.length - 1);
      if (target !== inf.idx) addEdge(inf.idx, target);
    }
  }

  return edges;
}

// Generate timeline
function generateTimeline(agents: NetworkAgent[]): TimelineRound[] {
  const rounds: TimelineRound[] = [];

  for (let r = 1; r <= 20; r++) {
    // Base sentiment follows the narrative arc
    let aggregate: number;
    if (r <= 4) aggregate = 0.15 - r * 0.02;
    else if (r <= 8) aggregate = 0.07 - (r - 4) * 0.08; // Drops during controversy
    else if (r <= 12) aggregate = -0.25 + (r - 8) * 0.05; // Slowly recovers
    else aggregate = -0.05 + (r - 12) * 0.03; // Gradual recovery

    aggregate += (rand() - 0.5) * 0.05;
    aggregate = Math.max(-1, Math.min(1, Math.round(aggregate * 100) / 100));

    const active_agent_count = Math.min(
      agents.length,
      Math.floor(agents.length * (0.4 + rand() * 0.4))
    );

    let key_event: string | null = null;
    if (r === 5) key_event = "Major influencer @TechGuru publishes critical thread";
    if (r === 12) key_event = "Company releases official response addressing concerns";

    // Cluster sizes evolve
    const c0Size = Math.floor(agents.filter(a => a.cluster_id === 0).length * (0.9 + r * 0.005));
    const c1Size = Math.floor(agents.filter(a => a.cluster_id === 1).length * (r <= 8 ? 1 + r * 0.02 : 1.16 - (r - 8) * 0.01));
    const c2Size = agents.length - c0Size - c1Size;

    rounds.push({
      round_number: r,
      aggregate_sentiment: aggregate,
      active_agent_count,
      key_event,
      cluster_snapshot: [
        { cluster_id: 0, size: Math.max(1, c0Size), dominant_narrative: CLUSTER_NARRATIVES[0].dominant_narrative },
        { cluster_id: 1, size: Math.max(1, c1Size), dominant_narrative: CLUSTER_NARRATIVES[1].dominant_narrative },
        { cluster_id: 2, size: Math.max(1, c2Size), dominant_narrative: CLUSTER_NARRATIVES[2].dominant_narrative },
      ],
    });
  }
  return rounds;
}

// Generate actions for an agent
function generateAgentActions(agent: NetworkAgent, allAgents: NetworkAgent[]): AgentAction[] {
  const actions: AgentAction[] = [];
  const postCount = randInt(3, 15);

  for (let i = 0; i < postCount; i++) {
    const round = randInt(1, 20);
    const sentiment = agent.cluster_id === 0 ? "positive" : agent.cluster_id === 1 ? "negative" : "neutral";
    const templateSet = POST_TEMPLATES[sentiment as keyof typeof POST_TEMPLATES];
    const template = pick(templateSet);
    const topic = pick(TOPICS);
    const content = template.replace("{topic}", topic);

    const actionTypes: AgentAction["type"][] = ["post", "comment", "like", "repost", "follow"];
    const type = i === 0 ? "post" : pick(actionTypes);

    const target = type !== "post" ? pick(allAgents).id : null;
    actions.push({ round, type, content, target_agent_id: target });
  }

  actions.sort((a, b) => a.round - b.round);
  return actions;
}

// Cached data
let _cachedData: {
  agents: NetworkAgent[];
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  timeline: TimelineRound[];
  agentTimelines: Map<string, { round: number; score: number; trigger_event: string | null }[]>;
} | null = null;

export function getMockNetworkData() {
  if (_cachedData) return _cachedData;

  const agents = generateAgents();
  const edges = generateEdges(agents);
  const timeline = generateTimeline(agents);

  const agentTimelines = new Map<string, { round: number; score: number; trigger_event: string | null }[]>();
  const nodes: NetworkNode[] = agents.map((agent) => {
    const sentimentTimeline = generateAgentSentimentTimeline(agent);
    agentTimelines.set(agent.id, sentimentTimeline);
    return {
      id: agent.id,
      sentiment_by_round: sentimentTimeline.map((t) => t.score),
      influence_score: agent.influence_score,
      agent_type: agent.agent_type,
      cluster_id: agent.cluster_id,
    };
  });

  _cachedData = { agents, nodes, edges, timeline, agentTimelines };
  return _cachedData;
}

export function getMockAgentDetail(agentId: string): AgentDetail | null {
  const data = getMockNetworkData();
  const agent = data.agents.find((a) => a.id === agentId);
  if (!agent) return null;

  const sentimentTimeline = data.agentTimelines.get(agentId) || [];
  const actions = generateAgentActions(agent, data.agents);

  // Find connections from edges
  const connections: AgentConnection[] = [];
  const connMap = new Map<string, { count: number; type: "positive" | "negative" | "neutral" }>();

  for (const edge of data.edges) {
    if (edge.source === agentId) {
      const existing = connMap.get(edge.target);
      if (existing) existing.count += edge.weight;
      else connMap.set(edge.target, { count: edge.weight, type: edge.interaction_type });
    } else if (edge.target === agentId) {
      const existing = connMap.get(edge.source);
      if (existing) existing.count += edge.weight;
      else connMap.set(edge.source, { count: edge.weight, type: edge.interaction_type });
    }
  }

  connMap.forEach(({ count, type }, aid) => {
    connections.push({ agent_id: aid, interaction_count: count, relationship_type: type });
  });

  connections.sort((a, b) => b.interaction_count - a.interaction_count);

  return {
    profile: agent,
    sentiment_timeline: sentimentTimeline,
    actions,
    connections,
  };
}

export const CLUSTER_INFO = CLUSTER_NARRATIVES;
