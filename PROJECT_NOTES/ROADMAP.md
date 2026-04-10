# ROADMAP

## Now
- Shipping the **Robust Calendar & Sync Mode MVP** for low-noise calendar export.
- Active build focus:
  - Metadata toggle support (compact/full) in calendar export flow.
  - ICS export metadata mode via `?metadata=compact|full`.
  - Google Calendar one-way sync with OAuth endpoints and token persistence.
  - Pre-sync conflict detection against existing Google events.
  - Dedupe-safe sync mapping to prevent duplicate event creation per itinerary item fingerprint.

## Next
- Add refresh-token flow and graceful retry handling for expired Google access tokens.
- Add selective sync scope controls (city/date filters).
- Add per-item conflict resolution UI in sync flow.
- Add tests for calendar item fingerprint stability and sync dedupe behavior.

## Later
> **Proposal C — Group & Family Collaboration Suite**
> Multi-user collaboration: editable itineraries, family templates (pacing/kid-friendly POIs), cost-splitting, and read-only public share links that don't require sign-up. Role-based permissions (owner/editor/viewer).
> Why it matters: Many users ask for easier family/group planning and sharing without forcing recipients to sign up. High viral growth potential via easy sharing.
> Hold: complexity in conflict resolution, permission scoping, and public link security. Revisit once core product is solid.
