import { expect, test } from "bun:test";
import { KNOWN_MODELS } from "../src/constants.ts";
import orvixCoding, { withSessionID } from "../src/index.ts";
import { fetchModelIDs, toModelConfig } from "../src/models.ts";

test("withSessionID adds the session and respects an existing one", () => {
  expect(withSessionID({ model: "glm-5.2" }, "s1")).toEqual({ model: "glm-5.2", session_id: "s1" });
  expect(withSessionID({ session_id: "mine" }, "s1")).toBeUndefined();
  expect(withSessionID({ model: "x" }, undefined)).toBeUndefined();
});

test("thinking uses omp's effort vocabulary without none", () => {
  const glm = toModelConfig("orvix/glm-5.2");
  expect(glm.id).toBe("glm-5.2");
  expect(glm.thinking).toEqual({ mode: "effort", efforts: ["minimal", "low", "medium", "high", "xhigh", "max"] });
  expect(toModelConfig("orvix/glm-5.3-flash").thinking).toBeUndefined();
});

test("fetchModelIDs reads the OpenAI list shape", async () => {
  const fake = (async () => Response.json({ data: [{ id: "orvix/glm-5.2" }] })) as unknown as typeof fetch;
  expect(await fetchModelIDs("https://x/coding/v1", "k", fake)).toEqual(["orvix/glm-5.2"]);
});

test("extension registers the provider and only touches its own requests", async () => {
  let provider: any;
  const handlers: Record<string, Function> = {};
  orvixCoding({
    registerProvider: (name, config) => (provider = { name, config }),
    on: (event, fn) => (handlers[event] = fn),
  });
  expect(provider.name).toBe("orvix-coding");
  expect(provider.config.apiKey).toBe("ORVIX_CODING_API_KEY");
  expect(provider.config.models.length).toBe(Object.keys(KNOWN_MODELS).length);
  expect((await provider.config.fetchDynamicModels(undefined)).length).toBe(Object.keys(KNOWN_MODELS).length);

  const hook = handlers.before_provider_request!;
  const ctx = (p: string) => ({ model: { provider: p }, sessionManager: { getSessionId: () => "s1" } });
  expect(hook({ payload: { a: 1 } }, ctx("orvix-coding"))).toEqual({ a: 1, session_id: "s1" });
  expect(hook({ payload: { a: 1 } }, ctx("openai"))).toBeUndefined();
});
