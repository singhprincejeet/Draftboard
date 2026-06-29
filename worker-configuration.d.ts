/// <reference types="@cloudflare/workers-types" />

// Defines the Cloudflare Workers bindings for this app.
// Update this file when bindings change in your Webflow Cloud project.
// Run `wrangler types` to regenerate from wrangler.json if available.

interface CloudflareEnv {
  DB: D1Database;
}
