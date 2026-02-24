# SteerAgent Pilot: What We Measure and How

CoinSwitch pilot -- 14 developers, 2 weeks.

## Metrics

### Primary Metrics

| Metric                | Definition                                        | Target after 2 weeks        |
| --------------------- | ------------------------------------------------- | --------------------------- |
| Gate calls/day/dev    | Total gate calls divided by active developers     | >= 5 (tool is being used)   |
| Average score         | Mean score across all gate calls                  | Increasing week over week   |
| Block rate            | % of prompts scoring <= 3                         | Decreasing week over week   |
| Override rate         | % of BLOCKED prompts where user overrides         | < 50%                       |

### Secondary Metrics

| Metric                | Definition                                        | What it tells us            |
| --------------------- | ------------------------------------------------- | --------------------------- |
| Most common missing   | Top missing sections across all gate calls        | Where devs need most help   |
| Model tier breakdown  | % of calls routed to small/mid/high               | Cost distribution           |
| NEEDS_INFO rate       | % of calls scoring 4-6                            | How many prompts are "close"|
| Turn depth            | Average turnId per taskId                         | Are devs iterating?         |

## Telemetry Location

- **Cursor Extension:** `<globalStorageUri>/telemetry.jsonl` (managed by Cursor, per-workspace)
- **CLI:** `./data/telemetry.jsonl` (relative to working directory)

Each line is a JSON object with these fields:

```json
{
  "timestamp": "2026-02-24T10:30:00.000Z",
  "taskId": "task_m1abc_x9y2z3",
  "turnId": 1,
  "mode": "dev",
  "score": 5,
  "status": "NEEDS_INFO",
  "missing": ["LIMITS", "REVIEW"],
  "modelTier": "mid",
  "estimatedCostUsd": 0.0042,
  "hasGitImpact": true
}
```

## How to Extract Metrics

### Average score

```bash
cat telemetry.jsonl | jq -s '[.[].score] | add / length'
```

### Block rate (% of calls with score <= 3)

```bash
cat telemetry.jsonl | jq -s '[.[].score | select(. <= 3)] | length as $blocked | [.[]] | length as $total | ($blocked / $total * 100)'
```

### Gate calls per day

```bash
cat telemetry.jsonl | jq -rs '[.[] | .timestamp[:10]] | group_by(.) | map({date: .[0], count: length})'
```

### Most common missing sections

```bash
cat telemetry.jsonl | jq -rs '[.[].missing[]] | group_by(.) | map({section: .[0], count: length}) | sort_by(-.count)'
```

### Override rate

Override events are logged separately with `"event": "applyToChat"` and `"overrideUsed": true`:

```bash
cat telemetry.jsonl | jq -s '[.[] | select(.event == "applyToChat")] | length as $total | [.[] | select(.overrideUsed == true)] | length as $overrides | ($overrides / $total * 100)'
```

### Model tier breakdown

```bash
cat telemetry.jsonl | jq -rs '[.[].modelTier] | group_by(.) | map({tier: .[0], count: length, pct: (length / ([.[]] | length) * 100)})'
```

### Average turns per task

```bash
cat telemetry.jsonl | jq -rs 'group_by(.taskId) | map({taskId: .[0].taskId, turns: ([.[].turnId] | max)}) | [.[].turns] | add / length'
```

## Success Criteria (after 2 weeks)

### Green flags (pilot is working)

- Block rate is decreasing -- developers are learning to write better prompts
- Average score is increasing -- prompt quality improving over time
- Gate calls/day stays >= 5 -- tool is being used, not avoided
- Override rate < 50% -- thresholds feel fair

### Red flags (action needed)

| Signal                        | Diagnosis                                | Action                           |
| ----------------------------- | ---------------------------------------- | -------------------------------- |
| Override rate > 50%           | Threshold too aggressive                 | Lower block threshold to <= 2    |
| Avg score not improving       | Scoring may not be teaching              | Add more specific follow-ups     |
| Gate calls/day dropping       | Devs disabling or avoiding the tool      | Check friction points, interview |
| Same sections always missing  | Devs don't understand what's needed      | Add examples to follow-ups       |
| High model tier > 40%         | Cost may be too high                     | Review routing rules             |

## Collecting Data

### From extension (all developers)

The extension writes telemetry automatically to `globalStorageUri`. To collect:

1. Ask each developer to share their telemetry file, or
2. Set up a shared directory mount, or
3. Add a "Submit Telemetry" command in a future release

### From CLI

```bash
# Merge all developer telemetry files
cat dev1/data/telemetry.jsonl dev2/data/telemetry.jsonl > combined.jsonl
```

### Quick dashboard

```bash
echo "=== Pilot Summary ==="
echo -n "Total gate calls: " && wc -l < telemetry.jsonl
echo -n "Average score: " && cat telemetry.jsonl | jq -s '[.[].score] | add / length'
echo -n "Block rate: " && cat telemetry.jsonl | jq -s '([.[].score | select(. <= 3)] | length) / ([.[]] | length) * 100 | tostring + "%"'
echo -n "Unique tasks: " && cat telemetry.jsonl | jq -rs '[.[].taskId] | unique | length'
```

## Timeline

| Week | Focus                                         |
| ---- | --------------------------------------------- |
| 0    | Install on all 14 dev machines (this guide)   |
| 1    | Observe, collect initial data, fix friction   |
| 2    | Analyze trends, decide on Phase 2 scope       |
