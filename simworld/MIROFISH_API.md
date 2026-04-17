# MiroFish API Contract

> Auto-generated from source code analysis of MiroFish engine.
> Base URL: `http://localhost:5001`
> Framework: Flask (Python 3.11+)
> All endpoints return JSON with envelope: `{ success: bool, data?: any, error?: string }`

---

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Workflow Overview](#workflow-overview)
3. [Graph API](#graph-api) — `/api/graph/*`
4. [Simulation API](#simulation-api) — `/api/simulation/*`
5. [Report API](#report-api) — `/api/report/*`
6. [Data Models](#data-models)
7. [SimWorld Mapping Notes](#simworld-mapping-notes)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `LLM_API_KEY` | ✅ | API key for any OpenAI-compatible LLM |
| `LLM_BASE_URL` | ✅ | LLM API base URL (default: `https://api.openai.com/v1`) |
| `LLM_MODEL_NAME` | ✅ | Model name (default: `gpt-4o-mini`) |
| `ZEP_API_KEY` | ✅ | Zep Cloud API key for knowledge graph |
| `LLM_BOOST_API_KEY` | ❌ | Optional accelerated LLM key |
| `LLM_BOOST_BASE_URL` | ❌ | Optional accelerated LLM base URL |
| `LLM_BOOST_MODEL_NAME` | ❌ | Optional accelerated LLM model |

---

## Workflow Overview

The MiroFish pipeline has 5 sequential stages:

```
1. Upload & Ontology  →  POST /api/graph/ontology/generate     [SYNC]
2. Build Graph         →  POST /api/graph/build                 [ASYNC — poll task]
3. Create & Prepare    →  POST /api/simulation/create           [SYNC]
                       →  POST /api/simulation/prepare          [ASYNC — poll task]
4. Run Simulation      →  POST /api/simulation/start            [ASYNC — poll status]
5. Generate Report     →  POST /api/report/generate             [ASYNC — poll task]
6. Deep Interaction    →  POST /api/report/chat                 [SYNC]
                       →  POST /api/simulation/interview        [SYNC]
```

---

## Graph API

Blueprint prefix: `/api/graph`

### Project Management

#### `GET /api/graph/project/<project_id>`
Get project details.

**Response:**
```json
{ "success": true, "data": { Project object } }
```

#### `GET /api/graph/project/list?limit=50`
List all projects (sorted by creation time, descending).

**Response:**
```json
{ "success": true, "data": [ Project, ... ], "count": N }
```

#### `DELETE /api/graph/project/<project_id>`
Delete a project and all its files.

#### `POST /api/graph/project/<project_id>/reset`
Reset project state (for re-building graph). Resets to `ontology_generated` or `created`.

---

### Ontology Generation

#### `POST /api/graph/ontology/generate`
Upload files and generate ontology definition. **Synchronous** — blocks until LLM returns.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `files` | File[] | ✅ | PDF, MD, TXT files |
| `simulation_requirement` | string | ✅ | Natural language description of what to simulate |
| `project_name` | string | ❌ | Project name (default: "Unnamed Project") |
| `additional_context` | string | ❌ | Extra context for ontology generation |

**Response:**
```json
{
  "success": true,
  "data": {
    "project_id": "proj_xxxxxxxxxxxx",
    "project_name": "...",
    "ontology": {
      "entity_types": [ ... ],
      "edge_types": [ ... ]
    },
    "analysis_summary": "...",
    "files": [{ "filename": "...", "size": 12345 }],
    "total_text_length": 12345
  }
}
```

---

### Graph Building

#### `POST /api/graph/build`
Build knowledge graph from project text. **Asynchronous** — returns `task_id`.

**Request:** JSON
```json
{
  "project_id": "proj_xxxx",       // required
  "graph_name": "My Graph",        // optional
  "chunk_size": 500,               // optional (default 500)
  "chunk_overlap": 50,             // optional (default 50)
  "force": false                   // optional — force rebuild
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "project_id": "proj_xxxx",
    "task_id": "uuid-string",
    "message": "图谱构建任务已启动"
  }
}
```

**Task result (on completion):**
```json
{
  "project_id": "proj_xxxx",
  "graph_id": "mirofish_xxxx",
  "node_count": 150,
  "edge_count": 300,
  "chunk_count": 25
}
```

---

### Task Polling

#### `GET /api/graph/task/<task_id>`
Get task status. Used to poll async operations.

**Response:**
```json
{
  "success": true,
  "data": {
    "task_id": "uuid",
    "task_type": "...",
    "status": "pending | processing | completed | failed",
    "progress": 0-100,
    "message": "...",
    "progress_detail": { ... },
    "result": { ... },
    "error": null,
    "metadata": { ... },
    "created_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

#### `GET /api/graph/tasks`
List all tasks.

---

### Graph Data

#### `GET /api/graph/data/<graph_id>`
Get graph nodes and edges from Zep.

#### `DELETE /api/graph/delete/<graph_id>`
Delete a Zep graph.

---

## Simulation API

Blueprint prefix: `/api/simulation`

### Entity Reading

#### `GET /api/simulation/entities/<graph_id>?entity_types=Student,Professor&enrich=true`
Get filtered entities from the knowledge graph.

**Query params:**
- `entity_types` — comma-separated type filter
- `enrich` — include edge info (default: true)

#### `GET /api/simulation/entities/<graph_id>/<entity_uuid>`
Get single entity with full context.

#### `GET /api/simulation/entities/<graph_id>/by-type/<entity_type>?enrich=true`
Get all entities of a specific type.

---

### Simulation Lifecycle

#### `POST /api/simulation/create`
Create a new simulation.

**Request:** JSON
```json
{
  "project_id": "proj_xxxx",     // required
  "graph_id": "mirofish_xxxx",   // optional (from project if omitted)
  "enable_twitter": true,         // optional (default true)
  "enable_reddit": true           // optional (default true)
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "simulation_id": "sim_xxxx",
    "project_id": "proj_xxxx",
    "graph_id": "mirofish_xxxx",
    "status": "created",
    "enable_twitter": true,
    "enable_reddit": true,
    "created_at": "ISO8601"
  }
}
```

#### `POST /api/simulation/prepare`
Prepare simulation environment. **Asynchronous** — returns `task_id`.

Stages: reading entities → generating profiles → generating config → preparing scripts

**Request:** JSON
```json
{
  "simulation_id": "sim_xxxx",                  // required
  "entity_types": ["Student", "PublicFigure"],   // optional
  "use_llm_for_profiles": true,                  // optional (default true)
  "parallel_profile_count": 5,                   // optional (default 5)
  "force_regenerate": false                      // optional (default false)
}
```

**Response:** Returns `task_id` or `already_prepared: true` if done.

#### `POST /api/simulation/prepare/status`
Poll preparation progress.

**Request:** JSON
```json
{
  "task_id": "task_xxxx",        // optional
  "simulation_id": "sim_xxxx"   // optional
}
```

#### `GET /api/simulation/<simulation_id>`
Get simulation state.

#### `GET /api/simulation/list?project_id=proj_xxxx`
List all simulations. Optional `project_id` filter.

#### `GET /api/simulation/history?limit=20`
Get enriched simulation history with project details, report IDs, run state.

---

### Simulation Running

#### `POST /api/simulation/start`
Start running the simulation. **Asynchronous** — poll via run-status.

**Request:** JSON
```json
{
  "simulation_id": "sim_xxxx",           // required
  "platform": "parallel",                // optional: twitter | reddit | parallel
  "max_rounds": 100,                     // optional: cap simulation length
  "enable_graph_memory_update": false,   // optional: write agent actions to Zep
  "force": false                         // optional: force restart
}
```

#### `POST /api/simulation/stop`
Stop a running simulation.

**Request:** JSON
```json
{ "simulation_id": "sim_xxxx" }
```

---

### Runtime Monitoring

#### `GET /api/simulation/<simulation_id>/run-status`
Get real-time run status (for polling).

**Response:**
```json
{
  "success": true,
  "data": {
    "simulation_id": "sim_xxxx",
    "runner_status": "running | stopped | completed | idle",
    "current_round": 5,
    "total_rounds": 144,
    "progress_percent": 3.5,
    "twitter_running": true,
    "reddit_running": true,
    "twitter_actions_count": 150,
    "reddit_actions_count": 200,
    "total_actions_count": 350,
    "started_at": "ISO8601",
    "updated_at": "ISO8601"
  }
}
```

#### `GET /api/simulation/<simulation_id>/run-status/detail?platform=twitter`
Get detailed status with all action history.

#### `GET /api/simulation/<simulation_id>/actions?limit=100&offset=0&platform=twitter&agent_id=3&round_num=5`
Get agent action history with filters.

#### `GET /api/simulation/<simulation_id>/timeline?start_round=0&end_round=50`
Get per-round summary timeline.

#### `GET /api/simulation/<simulation_id>/agent-stats`
Get per-agent statistics (activity ranking, action distribution).

---

### Profiles & Config

#### `GET /api/simulation/<simulation_id>/profiles?platform=reddit`
Get agent profiles for a simulation.

#### `GET /api/simulation/<simulation_id>/profiles/realtime?platform=reddit`
Real-time profile reading (during generation). Returns `is_generating`, `total_expected`.

#### `GET /api/simulation/<simulation_id>/config`
Get LLM-generated simulation config (time, agents, events, platforms).

#### `GET /api/simulation/<simulation_id>/config/realtime`
Real-time config reading (during generation).

#### `GET /api/simulation/<simulation_id>/config/download`
Download simulation config as JSON file.

---

### Simulation Data (SQLite)

#### `GET /api/simulation/<simulation_id>/posts?platform=reddit&limit=50&offset=0`
Get posts from simulation database.

#### `GET /api/simulation/<simulation_id>/comments?post_id=X&limit=50&offset=0`
Get comments (Reddit only).

---

### Agent Interview

#### `POST /api/simulation/interview`
Interview a single agent. Requires simulation env running.

**Request:** JSON
```json
{
  "simulation_id": "sim_xxxx",
  "agent_id": 0,
  "prompt": "What do you think about this?",
  "platform": "twitter",    // optional
  "timeout": 60             // optional (default 60s)
}
```

#### `POST /api/simulation/interview/batch`
Batch interview multiple agents.

**Request:** JSON
```json
{
  "simulation_id": "sim_xxxx",
  "interviews": [
    { "agent_id": 0, "prompt": "..." },
    { "agent_id": 1, "prompt": "..." }
  ]
}
```

---

### Utilities

#### `POST /api/simulation/generate-profiles`
Generate profiles without creating a simulation.

#### `GET /api/simulation/script/<script_name>/download`
Download simulation scripts. Allowed: `run_twitter_simulation.py`, `run_reddit_simulation.py`, `run_parallel_simulation.py`, `action_logger.py`.

#### `POST /api/simulation/close-env`
Gracefully close simulation environment.

#### `POST /api/simulation/env-status`
Check simulation environment status.

---

## Report API

Blueprint prefix: `/api/report`

### Report Generation

#### `POST /api/report/generate`
Generate analysis report. **Asynchronous** — returns `task_id`.

**Request:** JSON
```json
{
  "simulation_id": "sim_xxxx",    // required
  "force_regenerate": false        // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "simulation_id": "sim_xxxx",
    "report_id": "report_xxxxxxxxxxxx",
    "task_id": "uuid",
    "status": "generating",
    "already_generated": false
  }
}
```

#### `POST /api/report/generate/status`
Poll report generation progress.

**Request:** JSON
```json
{
  "task_id": "task_xxxx",
  "simulation_id": "sim_xxxx"
}
```

---

### Report Access

#### `GET /api/report/<report_id>`
Get full report.

**Response includes:**
- `report_id`, `simulation_id`, `status`
- `outline` — report structure
- `markdown_content` — full report in markdown
- `created_at`, `completed_at`

#### `GET /api/report/by-simulation/<simulation_id>`
Get report by simulation ID.

#### `GET /api/report/list?simulation_id=sim_xxxx&limit=50`
List all reports.

#### `GET /api/report/<report_id>/download`
Download report as markdown file.

#### `DELETE /api/report/<report_id>`
Delete a report.

#### `GET /api/report/check/<simulation_id>`
Check if simulation has a report and its status. Returns `interview_unlocked: bool`.

---

### Report Progress & Sections

#### `GET /api/report/<report_id>/progress`
Real-time report generation progress.

**Response:**
```json
{
  "data": {
    "status": "generating",
    "progress": 45,
    "message": "Generating section: Key Findings",
    "current_section": "Key Findings",
    "completed_sections": ["Executive Summary", "Background"]
  }
}
```

#### `GET /api/report/<report_id>/sections`
Get all generated sections (supports incremental loading).

#### `GET /api/report/<report_id>/section/<section_index>`
Get a single section by index.

---

### Report Agent Chat

#### `POST /api/report/chat`
Chat with the Report Agent about simulation results.

**Request:** JSON
```json
{
  "simulation_id": "sim_xxxx",
  "message": "Explain the sentiment trends",
  "chat_history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "Agent response...",
    "tool_calls": [ ... ],
    "sources": [ ... ]
  }
}
```

---

### Agent Logs

#### `GET /api/report/<report_id>/agent-log?from_line=0`
Incremental structured JSON log of agent actions.

#### `GET /api/report/<report_id>/agent-log/stream`
Full agent log dump.

#### `GET /api/report/<report_id>/console-log?from_line=0`
Incremental console text log.

#### `GET /api/report/<report_id>/console-log/stream`
Full console log dump.

---

### Debug Tools

#### `POST /api/report/tools/search`
Search the knowledge graph directly.

**Request:** JSON
```json
{ "graph_id": "mirofish_xxxx", "query": "search term", "limit": 10 }
```

#### `POST /api/report/tools/statistics`
Get graph statistics.

**Request:** JSON
```json
{ "graph_id": "mirofish_xxxx" }
```

---

## Data Models

### Project

| Field | Type | Description |
|-------|------|-------------|
| `project_id` | string | `proj_` prefix + 12 hex chars |
| `name` | string | Project name |
| `status` | enum | `created` → `ontology_generated` → `graph_building` → `graph_completed` / `failed` |
| `files` | array | `[{ filename, size }]` |
| `total_text_length` | int | Total extracted text chars |
| `ontology` | object | `{ entity_types: [], edge_types: [] }` |
| `analysis_summary` | string | LLM analysis summary |
| `graph_id` | string | Zep graph ID |
| `simulation_requirement` | string | Natural language requirement |
| `chunk_size` | int | Text chunking size (default 500) |
| `chunk_overlap` | int | Chunk overlap (default 50) |

### Task

| Field | Type | Description |
|-------|------|-------------|
| `task_id` | string | UUID |
| `task_type` | string | Task category |
| `status` | enum | `pending` → `processing` → `completed` / `failed` |
| `progress` | int | 0-100 |
| `message` | string | Human-readable status |
| `progress_detail` | object | Stage-specific progress info |
| `result` | object | Final result (on completion) |
| `error` | string | Error message (on failure) |

### SimulationState

| Field | Type | Description |
|-------|------|-------------|
| `simulation_id` | string | `sim_` prefix |
| `project_id` | string | Parent project |
| `graph_id` | string | Associated graph |
| `status` | enum | `created` → `preparing` → `ready` → `running` → `completed` / `paused` / `failed` |
| `enable_twitter` | bool | Twitter platform enabled |
| `enable_reddit` | bool | Reddit platform enabled |
| `entities_count` | int | Number of entities |
| `entity_types` | array | Entity type list |
| `profiles_count` | int | Generated profiles count |

---

## SimWorld Mapping Notes

### How SimWorld maps to MiroFish endpoints

| SimWorld Feature | MiroFish Endpoint(s) |
|-----------------|---------------------|
| **Upload & Configure** | `POST /api/graph/ontology/generate` |
| **Build Knowledge Graph** | `POST /api/graph/build` → poll `GET /api/graph/task/<id>` |
| **Create Simulation** | `POST /api/simulation/create` |
| **Prepare Agents** | `POST /api/simulation/prepare` → poll `POST /api/simulation/prepare/status` |
| **Run Simulation** | `POST /api/simulation/start` → poll `GET /api/simulation/<id>/run-status` |
| **Progress Screen** | `GET /api/simulation/<id>/run-status`, `/timeline`, `/agent-stats` |
| **Results Dashboard** | `GET /api/simulation/<id>/posts`, `/comments`, `/actions`, `/agent-stats` |
| **Agent Explorer** | `GET /api/simulation/<id>/profiles`, `POST /api/simulation/interview` |
| **Generate Report** | `POST /api/report/generate` → poll `POST /api/report/generate/status` |
| **View Report** | `GET /api/report/<id>`, `GET /api/report/<id>/sections` |
| **Chat with Report Agent** | `POST /api/report/chat` |
| **Chat with Agent** | `POST /api/simulation/interview` (single) or `/interview/batch` |
| **Export PDF** | `GET /api/report/<id>/download` (markdown — we render PDF ourselves) |
| **Simulation History** | `GET /api/simulation/history` |

### Async Pattern

All long-running operations follow the same pattern:
1. Call endpoint → receive `task_id`
2. Poll `GET /api/graph/task/<task_id>` every 2-3 seconds
3. Check `status` field: `processing` (continue), `completed` (done), `failed` (error)
4. Read `progress` (0-100) and `message` for UI updates

### File Upload

- Accepted formats: PDF, MD, TXT, Markdown
- Max size: 50MB
- Sent as `multipart/form-data` with field name `files`

### Platform Types

MiroFish simulates two social media platforms:
- **Twitter-style**: Posts, likes, reposts, quotes, follows
- **Reddit-style**: Posts, comments, likes/dislikes, search, trending
- **Parallel**: Both platforms simultaneously (default)
