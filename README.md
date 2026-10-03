# @orvix-id/omp

[Oh My Pi (omp)](https://omp.sh) extension for the **Orvix Coding Plan**. omp runs the agent; this extension
connects it to `https://api.orvix.id/coding/v1` and keeps every session on the prompt cache.

Using OpenCode or Pi instead? See [@orvix-id/opencode](https://github.com/Orvix-id/opencode-plugin) and
[@orvix-id/pi](https://github.com/Orvix-id/pi-plugin).

## Setup

omp needs Bun 1.3.14 or newer.

1. **Create a Coding key.** In [platform.orvix.id/api-keys](https://platform.orvix.id/api-keys), create a key and
   tick **Orvix Coding** (`coding:invoke`). The default AI Router scope (`ai:invoke`) is not enough; Coding
   endpoints answer `401 coding:invoke scope required`.
2. **Expose the key** to omp:

   ```bash
   export ORVIX_CODING_API_KEY="orv-sk_live_..."
   ```

   Put it in your shell profile or secret manager rather than typing it into commands you share.
3. **Install the extension**, then restart omp or run `/reload-plugins`:

   ```bash
   omp plugin install @orvix-id/omp
   ```

4. **Pick a model:** `omp --model orvix-coding/deepseek-v4-flash`.

## Models

The model list comes from `GET /coding/v1/models` when the key is available, so it always matches your plan.
Without network access the extension falls back to the lineup it shipped with. Model ids drop the `orvix/`
prefix: `orvix-coding/glm-5.2` calls `orvix/glm-5.2`.

## What the extension does

| Piece | Why |
| --- | --- |
| Provider `orvix-coding` on omp's built-in `openai-completions` API | Message conversion, tools, and usage accounting stay omp's own. |
| `session_id` added in `before_provider_request` | Orvix keeps a session on the same upstream route and prompt cache only when the request body carries `session_id`. omp's session id is stable across `--continue`. |
| `x-orvix-coding-client` header | Reports the client name and extension version. Used for diagnostics only. |

## Cache behaviour to know about

omp rewrites parts of its own prompt on purpose, and each rewrite costs one cache miss from that point on:

- **Skill summaries.** omp shortens skill descriptions with a model call and swaps the summary into the system
  prompt after the first turn. This happens once per new skill.
- **Superseded reads.** When a file is read again, omp replaces the older result with
  `[Superseded by a newer read of this file]`. It only does this while few tokens follow the old result, or
  after the session has been idle for a while, so the cost stays small.

omp's system prompt is also the largest of the supported harnesses. Expect the first session on a new machine
or project to use more uncached tokens than OpenCode or Pi.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `SyntaxError: Unexpected identifier` at startup | Bun is older than 1.3.14. |
| No `orvix-coding` models | The extension is not installed, or `ORVIX_CODING_API_KEY` is not set in omp's environment. |
| `401 coding:invoke scope required` | The key was created without the **Orvix Coding** scope. |
| `429 coding_concurrency_exceeded` | Too many Coding requests in flight at once. omp retries; `retry_after` is a few seconds. |
| `429 coding_quota_exceeded` | A 5-hour, weekly, or monthly window is used up. `resets_at` says when. |

## Development

```bash
bun install
bun run check
PROBE_CLI=omp bun run probe   # 3 real omp turns against a local mock, reports prefix reuse per request
```

## License

MIT
