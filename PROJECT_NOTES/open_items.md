# Open Items

Mutable. Remove an item when it is resolved.

---

## [2026-04-16] Tighten activity generation specificity

**Status:** Deferred
**Description:** Planner currently produces generic cards like "Get Ramen Lunch in Dotonbori" instead of naming specific venues. This pushes work onto `/refine` (users must manually pin a venue) and weakens the "blunt, opinionated" positioning.
**Context:** Surfaced while designing the Modify vs Replace split. The better the generator pins specific venues up front, the less load on refinement endpoints and the more useful cards are out of the gate.
**Next action:** Audit `planCity()` prompt in `src/claude.js` — likely needs stronger rules forcing named restaurants/venues/operators, with "generic" allowed only for walks/sunsets/free activities.


