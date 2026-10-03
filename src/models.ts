import { DEFAULT_CONTEXT, DEFAULT_OUTPUT, type Effort, KNOWN_MODELS, MODEL_PREFIX } from "./constants.ts";

/**
 * The slice of omp's `ProviderModelConfig` this extension fills in. Typed
 * structurally so the package does not pin omp's internal type graph.
 */
export interface OmpModelConfig {
  id: string;
  name: string;
  reasoning: boolean;
  thinking?: { mode: "effort"; efforts: Exclude<Effort, "none">[] };
  input: ("text" | "image")[];
  cost: { input: number; output: number; cacheRead: number; cacheWrite: number };
  contextWindow: number;
  maxTokens: number;
  compat?: Record<string, unknown>;
}

/** `orvix/glm-5.2` -> `glm-5.2`, so users pick `orvix-coding/glm-5.2`. */
export function localID(upstreamID: string): string {
  return upstreamID.startsWith(MODEL_PREFIX) ? upstreamID.slice(MODEL_PREFIX.length) : upstreamID;
}

export function toModelConfig(upstreamID: string): OmpModelConfig {
  const id = localID(upstreamID);
  const known = KNOWN_MODELS[id];
  // omp's effort vocabulary has no "none"; turning thinking off is its own control.
  const efforts = (known?.efforts ?? []).filter((e): e is Exclude<Effort, "none"> => e !== "none");
  const reasoning = efforts.length > 0;
  return {
    id,
    name: known?.name ?? id,
    reasoning,
    ...(reasoning ? { thinking: { mode: "effort", efforts } } : {}),
    input: known?.image ? ["text", "image"] : ["text"],
    // Orvix bills the Coding Plan against plan quota, not per token.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: DEFAULT_CONTEXT,
    maxTokens: known?.output ?? DEFAULT_OUTPUT,
    compat: {
      supportsStore: false,
      supportsDeveloperRole: false,
      supportsReasoningEffort: reasoning,
      supportsUsageInStreaming: true,
    },
  };
}

export const FALLBACK_MODELS: OmpModelConfig[] = Object.keys(KNOWN_MODELS).map(toModelConfig);

/** Ids from `GET {baseUrl}/models`, the Coding allowlist (not the `/v1` catalogue). */
export async function fetchModelIDs(baseUrl: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const res = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/models`, {
    headers: { authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GET /models returned ${res.status}`);
  const body = (await res.json()) as { data?: Array<{ id?: unknown }> };
  return (body.data ?? [])
    .map((entry) => entry.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
}
