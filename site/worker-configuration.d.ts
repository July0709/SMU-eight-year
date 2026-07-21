/// <reference types="@cloudflare/workers-types" />

// Cloudflare Workers bindings for this project.
// Mirrors what `wrangler types` would generate; keep in sync with the
// control-plane bindings (see .openai/hosting.json).
declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
  }
}
