import {
  API_KEY_ENV,
  BASE_URL_ENV,
  CLIENT_HEADER,
  CLIENT_NAME,
  CLIENT_VERSION_HEADER,
  DEFAULT_BASE_URL,
  PLUGIN_VERSION,
  PROVIDER_ID,
} from "./constants.ts";
import { FALLBACK_MODELS, fetchModelIDs, type OmpModelConfig, toModelConfig } from "./models.ts";

/** The slice of omp's `ExtensionAPI` this extension uses. */
export interface OmpExtensionAPI {
  registerProvider(name: string, config: Record<string, unknown>): void;
  on(
    event: "before_provider_request",
    handler: (
      event: { payload: unknown },
      ctx: { model?: { provider?: string }; sessionManager: { getSessionId(): string | undefined } },
    ) => unknown,
  ): void;
}

/**
 * Adds `session_id` to a chat payload so `/coding/v1` keeps route affinity and
 * the prompt cache. The API reads it only from the body. A payload that
 * already carries one is left alone.
 */
export function withSessionID(payload: unknown, sessionID: string | undefined): unknown {
  if (!sessionID || !payload || typeof payload !== "object" || Array.isArray(payload)) return undefined;
  const record = payload as Record<string, unknown>;
  if (typeof record.session_id === "string" && record.session_id.trim()) return undefined;
  return { ...record, session_id: sessionID };
}

export default function orvixCoding(pi: OmpExtensionAPI) {
  const baseUrl = process.env[BASE_URL_ENV] || DEFAULT_BASE_URL;

  pi.registerProvider(PROVIDER_ID, {
    baseUrl,
    // omp takes the variable name, not `$NAME` interpolation.
    apiKey: API_KEY_ENV,
    api: "openai-completions",
    headers: {
      [CLIENT_HEADER]: CLIENT_NAME,
      [CLIENT_VERSION_HEADER]: PLUGIN_VERSION,
    },
    models: FALLBACK_MODELS,
    async fetchDynamicModels(apiKey: string | undefined): Promise<readonly OmpModelConfig[]> {
      const key = apiKey || process.env[API_KEY_ENV];
      if (!key) return FALLBACK_MODELS;
      try {
        const ids = await fetchModelIDs(baseUrl, key);
        return ids.length > 0 ? ids.map(toModelConfig) : FALLBACK_MODELS;
      } catch {
        return FALLBACK_MODELS;
      }
    },
  });

  pi.on("before_provider_request", (event, ctx) => {
    if (ctx.model?.provider !== PROVIDER_ID) return;
    return withSessionID(event.payload, ctx.sessionManager.getSessionId());
  });
}
