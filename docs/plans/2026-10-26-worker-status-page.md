# Worker Status Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the Worker root URL's 404 with a safe operational status page.

**Architecture:** Handle `GET /` before the protected `/states` branch in the existing Worker fetch handler. Preserve authentication and behavior for `/states`, and preserve 404s for every other route.

**Tech Stack:** Cloudflare Workers, TypeScript, Node test runner, Wrangler

---

### Task 1: Add and deploy the status route

**Files:**
- Modify: `tests/opensky-worker.test.ts`
- Modify: `worker/opensky-proxy.ts`

**Step 1: Write the failing test**

Add a test that requests `https://proxy.example/`, expects status `200`, expects a `text/html` content type, and checks for `ARGUS OpenSky Proxy is operational`.

**Step 2: Run the focused test to verify it fails**

Run: `npm test -- --test-name-pattern='status page'`
Expected: FAIL because the current root response is `404`.

**Step 3: Write the minimal implementation**

Add a `GET /` branch returning a static HTML response and `Content-Type: text/html; charset=UTF-8`. Do not alter `/states`.

**Step 4: Run verification**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build`
Expected: build exits successfully.

**Step 5: Deploy and verify production**

Run: `npx wrangler deploy`
Expected: deployment succeeds for `argus-opensky-proxy`.

Request the root URL and verify status `200` plus the operational message. Request `/states` without a token and verify it remains `401`.
