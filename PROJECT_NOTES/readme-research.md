# README Research: Recruiter-Friendly OSS Examples → Outline for YunHai.io

Purpose: source material for rewriting `/home/user/GuideMe/README.md` so a recruiter/hiring
manager understands the product and the engineering behind it in ~60-90 seconds. All content
below was fetched from primary sources (raw READMEs and live GitHub pages) on 2026-09-12, not
from secondary "best README" listicles. Star counts are live snapshots as of that date and will
drift.

---

## 1. excalidraw/excalidraw

- **URL:** https://github.com/excalidraw/excalidraw
- **Stars:** ~131.7k as shown on the live repo page ([github.com/excalidraw/excalidraw](https://github.com/excalidraw/excalidraw), fetched 2026-09-12). A secondary source ([star-history.com](https://www.star-history.com/excalidraw/excalidraw/), via search) had it at 124.6k / global rank #69 slightly earlier — consistent growth trend, no discrepancy.
- **One-line description (from GitHub "About"):** "Virtual whiteboard for sketching hand-drawn like diagrams." ([github.com/excalidraw/excalidraw](https://github.com/excalidraw/excalidraw))
- **Structure (top-level headers, in order):** Features → Excalidraw.com → Quick start → Contributing → Integrations → Who's integrating Excalidraw → Sponsors & support → Thank you. (Source: [raw README](https://raw.githubusercontent.com/excalidraw/excalidraw/master/README.md))
- **Techniques used near the top:**
  - One-line tagline immediately under the logo: *"An open source virtual hand-drawn style whiteboard. Collaborative and end-to-end encrypted."*
  - Badge row: license, npm downloads/month, PRs-welcome, Discord, DeepWiki, Twitter — all functional/credibility signals, not vanity.
  - **Features section comes before anything else**, as an emoji-prefixed bullet list (💯 Free & open-source, 🎨 Infinite canvas, ✍️ Hand-drawn style, 🌓 Dark mode, 🏗️ Customizable, 📷 Image support, etc.) — scannable in seconds.
  - Live demo link (excalidraw.com) surfaces immediately after features, before install instructions.
  - Install/quickstart is a 2-line `npm install` block — minimal, no verbose setup.
- **What helps a recruiter fast:** the emoji feature list answers "what is this" in under 5 seconds without reading prose; the live-demo-before-install ordering signals "try it, don't just read about it."

## 2. supabase/supabase

- **URL:** https://github.com/supabase/supabase
- **Stars:** ~109.1k on the live repo page ([github.com/supabase/supabase](https://github.com/supabase/supabase), fetched 2026-09-12). Supabase's own blog announced the 100,000-star milestone ([supabase.com/blog/100000-github-stars](https://supabase.com/blog/100000-github-stars)).
- **Structure:** Supabase (title/tagline) → Documentation → Community & Support → How it works (with an embedded architecture diagram) → Badges → Translations. (Source: [raw README](https://raw.githubusercontent.com/supabase/supabase/master/README.md))
- **Techniques used near the top:**
  - One-line positioning against a category the reader already knows: *"Supabase is the Postgres development platform. We're building the features of Firebase using enterprise-grade open source tools."* — borrowed familiarity (Firebase) does a lot of explanatory work in one sentence.
  - Immediately follows with a checkbox-style feature list (Hosted Postgres, Auth, Auto-generated REST/GraphQL/Realtime APIs, Edge Functions, Storage, AI/Vector toolkit, Dashboard) — each item is a **product surface**, not a marketing adjective.
  - Dedicated **"How it works" section with an architecture diagram** (`apps/docs/public/img/supabase-architecture.svg`) naming every internal component (PostgREST, GoTrue, Realtime/Elixir, Storage, pg_graphql, postgres-meta, Envoy) — this is the single clearest precedent for a "how the system fits together" section.
  - No quickstart code block at all in the root README — it routes straight to hosted docs instead, on the logic that most visitors self-host via the dashboard, not `git clone`.
- **What helps a recruiter fast:** the architecture section is the standout — it names real components and how they compose, which is exactly the "can this person design a system" signal a hiring manager is scanning for.

## 3. tldraw/tldraw

- **URL:** https://github.com/tldraw/tldraw
- **Stars:** ~50.3k on the live repo page ([github.com/tldraw/tldraw](https://github.com/tldraw/tldraw), fetched 2026-09-12).
- **Structure:** Feature highlights → Who's using tldraw → Quick start → Starter kits → Local development → Documentation → Community → Contributing → License → Trademarks → Contributors → Star History. (Source: [raw README](https://raw.githubusercontent.com/tldraw/tldraw/main/README.md))
- **Techniques used near the top:**
  - Tagline as an active capability, not a noun phrase: *"Build infinite canvas apps in React with the tldraw SDK."*
  - **Social proof section placed second**, right after features: a named list of companies using it in production (Google, Shopify, BlackRock, Autodesk, ClickUp, Replit, Runway, …) — this is a strong "is this real / battle-tested" signal placed deliberately high.
  - Feature list uses **bold lead-word + em-dash explanation** per bullet (e.g., "**Multiplayer** — self-hostable real-time collaboration with `@tldraw/sync`") rather than emoji — reads as more technical/serious than emoji-heavy lists.
  - Quickstart is two tiny code blocks: an install line, then a ~6-line working component — provably "you could be running this in 30 seconds."
- **What helps a recruiter fast:** the "who's using this" list converts abstract credibility into a snap judgment ("real companies bet on this, therefore this is not a toy") faster than any amount of feature prose.

## 4. PostHog/posthog

- **URL:** https://github.com/PostHog/posthog
- **Stars:** ~39.8k on the live repo page ([github.com/PostHog/posthog](https://github.com/PostHog/posthog), fetched 2026-09-12).
- **Structure:** Title/tagline → Table of Contents → Getting started → Setting up PostHog → Learning more → Contributing → Open-source vs. paid → We're hiring! (Source: [raw README](https://raw.githubusercontent.com/PostHog/posthog/master/README.md))
- **Techniques used near the top:**
  - Title itself is the pitch: *"PostHog is the open source platform for building self-driving products."*
  - GitHub's own repo description doubles as a dense feature list: "AI observability, analytics, session replay, flags, experiments, error tracking, logs" — packed into one line.
  - Badge row is **activity-based, not vanity**: contributors, Docker pulls, commit activity, closed-issues — these signal "this project is alive and shippable," a different message than a star-count badge.
  - Embedded YouTube demo thumbnail near the top — a 90-second video substitutes for paragraphs of explanation.
  - Explicit **"Open-source vs. paid" section** — transparently draws the line between free self-hosted and the hosted product, preempting the reader's "what's the catch" question, and states a concrete scaling limit ("~100k events/month" before recommending migration to Cloud). This is a strong direct precedent for a documented "why flat JSON, and its limit" section.
  - One-line curl-to-deploy install command (a single `bash -c "$(curl ...)"` string) for the self-hosted path.
- **What helps a recruiter fast:** the "Open-source vs. paid" section models exactly the kind of engineering-tradeoff transparency ("here's the boundary and why") that reads as senior judgment rather than hype.

## 5. ollama/ollama

- **URL:** https://github.com/ollama/ollama
- **Stars:** ~180.7k on the live repo page ([github.com/ollama/ollama](https://github.com/ollama/ollama), fetched 2026-09-12).
- **Structure:** Ollama (title) → Download → Get started → REST API → Supported backends → Documentation → Community Integrations. (Source: [raw README](https://raw.githubusercontent.com/ollama/ollama/main/README.md))
- **Techniques used near the top:**
  - Radically minimal: a centered 200px logo, then straight into a one-line tagline ("Start building with open models.") and the install command — no marketing paragraph at all.
  - Install command is the literal first code the reader sees: `curl -fsSL https://ollama.com/install.sh | sh` — one line, zero configuration, works on the platform the reader is presumably already using.
  - Uses platform-specific tabs/variants (macOS/Linux curl vs. Windows PowerShell) right at the top rather than burying OS-specific instructions later.
- **What helps a recruiter fast:** almost nothing to read — the product is legible purely from "one command, then it runs." For a technical README this radical brevity is itself the signal of confidence; it's a useful **counterpoint** data point (not every strong README needs a "why" essay), though it under-serves a *recruiter* audience specifically since it never explains what's happening under the hood — a caution against copying it wholesale for this project.

## 6. n8n-io/n8n

- **URL:** https://github.com/n8n-io/n8n
- **Stars:** ~204.1k on the live repo page ([github.com/n8n-io/n8n](https://github.com/n8n-io/n8n), fetched 2026-09-12); n8n's own community forum recorded passing 150k in Oct 2025 ([community.n8n.io/t/150-000-stars-on-github](https://community.n8n.io/t/150-000-stars-on-github/208779)), consistent with continued growth.
- **Structure:** Title/tagline → Key Capabilities → Quick Start → Resources → Support → License → Contributing → Join the Team → What does n8n mean? (Source: [raw README](https://raw.githubusercontent.com/n8n-io/n8n/master/README.md))
- **Techniques used near the top:**
  - Tagline packs category + differentiator + deployment flexibility + scale into one sentence: *"Fair-code platform to build and deploy AI agents and workflows. Combine a visual canvas with custom code, run it self-hosted or in the cloud, and connect to 1500+ integrations."*
  - "Key Capabilities" section uses **bold capability name + one-sentence explanation** per bullet (e.g., "**Model Flexibility, No Lock-In**: Connect to OpenAI, Anthropic, Google, or open-source models") — this is close to the multi-LLM story this project needs to tell.
  - Quantified scale claims inline ("1500+ integrations," "9,000+ templates") rather than vague superlatives.
  - Two install paths shown back-to-back: a one-line curl installer AND a Docker command with the exact `docker run` flags — covers both "just try it" and "I want to see the real deployment shape" readers.
- **What helps a recruiter fast:** "Key Capabilities" is effectively a mapping from feature → underlying technical decision (multi-provider LLM support, code-when-you-need-it, RBAC/audit for enterprise) — a near-direct template for how to present the multi-LLM orchestration and integration surface of this project.

## 7. immich-app/immich

- **URL:** https://github.com/immich-app/immich
- **Stars:** ~113.9k on the live repo page ([github.com/immich-app/immich](https://github.com/immich-app/immich), fetched 2026-09-12); it passed 90k around early 2026 per project discussion ([immich-app/immich discussion #25577](https://github.com/immich-app/immich/discussions/25577)).
- **Structure:** Links → Demo → Features → Translations → Repository activity → Contributors. (Source: [raw README](https://raw.githubusercontent.com/immich-app/immich/main/README.md))
- **Techniques used near the top:**
  - Tagline is purely functional, no adjectives: *"High performance self-hosted photo and video management solution."*
  - **Live public demo link with real login credentials given inline** (`demo@immich.app` / `demo`) right under the tagline — removes all friction between "curious visitor" and "seeing the real product," a strong precedent given YunHai.io already has a public live URL.
  - Feature list is presented as a **Mobile vs. Web capability table**, not a flat bullet list — useful when a product has more than one surface (this project has planner UI + chat + calendar sync + email ingestion, which could similarly be tabulated by surface).
  - A single bolded caution note used sparingly for one real caveat ("⚠️ Always follow 3-2-1 backup plan...") rather than a wall of disclaimers — shows restraint.
- **What helps a recruiter fast:** the demo-credentials-inline pattern converts "read about it" into "click and use it" instantly — directly reusable since YunHai.io is live at yunhai.io.

## 8. directus/directus

- **URL:** https://github.com/directus/directus
- **Stars:** ~37.9k on the live repo page ([github.com/directus/directus](https://github.com/directus/directus), fetched 2026-09-12).
- **One-line GitHub description:** "The flexible backend for all your projects 🐰 Turn your DB into a headless CMS, admin panels, or apps with a custom UI, instant APIs, auth & more." ([github.com/directus/directus](https://github.com/directus/directus))
- **Structure:** "The Collaborative Backend for Builders & AI" (hero title) → Introduction → AI & MCP → Directus Cloud → One-Click Deployment Options → Community Help → Contributing → License. (Source: live [github.com/directus/directus](https://github.com/directus/directus) page, README rendered)
- **Techniques used near the top:**
  - Hero title is a **positioning statement, not the product name** ("The Collaborative Backend for Builders & AI") — the repo name is assumed known/secondary; the value prop leads.
  - Quantified traction stated as plain numbers directly under the tagline: *"45M+ downloads · 500K+ projects deployed"* — social proof as data, no chart needed.
  - Second section is specifically **"AI & MCP"** — a dedicated section calling out the project's AI-agent integration story (native MCP server, AI assistant embedded in the UI) as a first-class differentiator, not an afterthought buried in a feature list.
  - Feature bullets follow the same "**bold name:** one-sentence description" pattern seen in n8n/tldraw.
- **What helps a recruiter fast:** the standalone "AI & MCP" section is a direct precedent for giving this project's multi-LLM orchestration and memory system their own named section instead of folding them into a generic "Features" list — a recruiter scanning headers alone would still catch "this person built real AI infrastructure."

---

## Aside: cal.com → Cal.diy (verification note, not a structural model)

Worth flagging since Cal.com was on the candidate list: **Cal.com went closed-source in April 2026**
and relaunched its public MIT-licensed repo as `calcom/cal.diy` ("Going Closed-Source: Technical
Changes Behind Cal.diy," [cal.com/blog/cal-diy-open-source-to-closed-source](https://cal.com/blog/cal-diy-open-source-to-closed-source);
also covered at [gigazine.net/gsc_news/en/20260422-cal-diy](https://gigazine.net/gsc_news/en/20260422-cal-diy)).
The current `cal.diy` README ([raw](https://raw.githubusercontent.com/calcom/cal.diy/main/README.md), ~48.4k stars per the live GitHub page)
has **37 top-level headers** dominated by deployment-target instructions (Railway, Northflank,
Vercel, Render, Elestio, Docker, Gitpod, …) with no architecture or "why" section and no live demo
link. It is a useful **negative example**: header sprawl and deployment-matrix detail crowd out the
value prop a recruiter needs in the first screen. Excluded from the 8 core examples above for that
reason, but the underlying event is real and independently confirmed, so it's included here for
accuracy rather than silently dropped.

---

## 2. Synthesized Recommended Outline for YunHai.io's README

Design principles pulled from the above, applied to this project specifically:
- **Front-load like ollama/immich**: logo/name → one-line value prop → live link, before any prose.
- **Name the AI orchestration as its own section like directus's "AI & MCP" and n8n's "Key
  Capabilities"** — don't let the multi-LLM/memory/scheduler work dissolve into a generic feature
  bullet list where it reads as "yet another CRUD app with a chatbot bolted on."
- **Include a real architecture diagram/section like supabase** — this project has an actually
  interesting one (LLM judgment vs. deterministic scheduler split; multi-provider routing).
  Reuse concepts already in `/home/user/GuideMe/PROJECT_NOTES/architecture.md` if present, translated for an external reader.
- **Include an explicit tradeoffs / "why not a database" section like PostHog's "Open-source vs.
  paid"** — flat JSON + documented scaling ceiling is a *decision*, and stating it plainly reads as
  engineering maturity, not a gap to hide.
- **Use bold-name + one-line description bullets (n8n/tldraw/directus style)**, not emoji spam
  (excalidraw's emoji list works for a whiteboard toy; a hiring manager evaluating a serious AI
  SaaS product should get the more technical-reading format).
- **Give the live demo top billing with a concrete path to try it**, immich-style (demo creds or at
  minimum a "sign up free" link), since YunHai.io actually has a production URL to point to.
- Keep total length closer to excalidraw/tldraw/directus (roughly 150-250 lines) than to
  cal.diy's sprawl — badges and deploy-target minutiae belong in a docs site or `DEPLOYMENT.md`,
  not the first screen.

### Recommended section order

1. **Hero block** — Project name (YunHai.io) + logo/wordmark if one exists, a badge row (license,
   build status if CI exists, live-site-status), and a single-sentence tagline: what it is (AI
   travel itinerary planner) + who it's for. One line, no paragraph. *(Model: excalidraw, ollama.)*

2. **Try it now** — `https://yunhai.io` as a prominent link/button-style line, plus a one-line
   note on what a visitor can do without signing up (or how fast sign-up is). *(Model: immich's
   inline demo credentials, excalidraw's demo-before-install ordering.)*

3. **What it does (30-second version)** — 4-6 bullets, bold-lead-word style, in plain product
   terms (Cities → Activities → Arrange → Review → Trip Health workflow; chat concierge; calendar
   export; auto-detected bookings from forwarded emails). No architecture talk yet — this section
   is for "what does a user experience," not "how is it built." *(Model: n8n's Key Capabilities,
   directus's Introduction.)*

4. **Why this is technically interesting** — the centerpiece section, given its own header (not
   buried under "Features"). Subsections, each 2-4 sentences max, each naming the real mechanism:
   - *Multi-LLM orchestration* — 4 models/providers routed by task (GPT-5.6 for planning,
     GPT-5.4-mini for chat/refinement, Claude Sonnet 4.6 for arrange, Haiku for memory/summaries),
     behind a global concurrency semaphore (10 concurrent calls system-wide) with 3-city parallel
     planning. *(Model: directus's "AI & MCP," n8n's "Model Flexibility, No Lock-In.")*
   - *Deterministic scheduling engine* — the LLM only makes the judgment call (which day); a
     separate scheduler does all arithmetic (commute-minimizing ordering, meal-window anchoring,
     opening-hours compliance, time-slot assignment), making time/overlap violations structurally
     impossible — and it's unit-tested with no API key required. This is the single strongest
     "this person can architect, not just prompt" data point; give it real prominence, maybe even
     a small before/after or flow diagram.
   - *Agent memory system* — a custom A-MEM/Mem0-inspired store: synchronous relevance-ranked
     recall (no LLM call, so it's fast) plus fire-and-forget LLM-driven reconciliation
     (ADD/UPDATE/DELETE) that lets the assistant learn preferences across chat, planning, and
     feedback over time.
   - *Trip Health engine* — validates itinerary consistency (overlaps, missing times/bookings),
     returns a status plus an actionable checklist — a concrete example of turning fuzzy travel
     data into a deterministic, testable domain model.
   - *Real integrations, not just LLM wrappers* — Google Calendar OAuth export with duplicate-safe
     fingerprinting; inbound email parsing that auto-detects flight/hotel/car confirmations from a
     per-user forwarding address; Google Places + Unsplash with a quota-aware cache; Brave Search
     with task-based query routing to stay under a free-tier quota. *(Model: PostHog's frank
     "here's the constraint and how we handle it" tone.)*
   *(Model for the whole section: supabase's "How it works," but narrated as a list of mechanisms
   rather than a static component diagram — this project's interesting part is the orchestration
   logic, not a service topology.)*

5. **Architecture at a glance** — a short diagram or compact list: Express backend, vanilla-JS
   frontend (deliberate, explain why below), Clerk auth, flat-JSON persistence, Docker Compose +
   Traefik deployment. Optional simple diagram (request → auth → LLM semaphore → provider → parse
   → persist). *(Model: supabase's architecture SVG, scaled down to fit a smaller product.)*

6. **Deliberate tradeoffs ("why not X")** — short, confident, bullet-per-tradeoff format:
   flat JSON instead of a database (sufficient to ~100 concurrent users, documented scaling path
   to Redis + a job queue); no frontend framework (intentionally monolithic `app.js`, kept that
   way past a certain size rather than fragmented prematurely); one-way integrations only
   (Calendar export, email ingest) as a privacy-first choice. *(Model: PostHog's "Open-source vs.
   paid" directness.)*

7. **Tech stack** — compact list or badge row: Express.js, vanilla JS, Clerk, Docker Compose,
   Traefik, OpenAI + Anthropic APIs, Google Calendar API, Brave Search, Unsplash/Google Places.
   *(Model: cal.diy's "Built With" list — one of the few things worth keeping from that example —
   kept short, not the 37-header sprawl around it.)*

8. **Quickstart / local setup** — the existing `cp .env.example .env && npm install && npm start`
   sequence, kept to the current ~4-line block. Short, like ollama/tldraw's install blocks — this
   section is proof-of-runnability, not a tutorial.

9. **Testing** — one or two lines: Node's built-in test runner, what's covered (scheduler logic
   unit-tested without an API key, Brave routing, trip-health/overlap detection), since "this is
   tested" is itself a signal worth a line, not a whole section.

10. **License / links footer** — license badge, docs link if any, contact/contributing note if
    open to it. Keep minimal; this is not an open-source community project seeking contributors in
    the same way the examples above are, so skip community-building sections (Discord badges,
    "good first issue" labels, contributor walls) that don't apply.

**What to deliberately leave out**, based on the negative/contrast examples above: no wall of
deployment-target badges (Railway/Vercel/Render/etc. à la cal.diy) unless YunHai.io actually
supports one-click deploys elsewhere; no emoji-per-bullet feature spam (fine for excalidraw's
whiteboard-toy tone, wrong register for "I built production AI infrastructure"); no marketing
copy ("revolutionary," "seamless") — the strongest examples above (ollama, immich, directus) use
plain, technical, almost terse language and let the specificity of what's described do the
persuading.
