UI Overhaul

Overhaul the existing Ul to feel clean, premium, and modern. Apply the design system below consistently across every page, component, and layout that currently exists. Do not add or remove pages or features — redesign what's already there to match this aesthetic.
The vibe: confident, spacious, polished. Think high-end SaaS -bold typography, generous whitespace, card-based layouts, soft shadows, and clear visual hierarchy. Nothing should feel crowded or cheap. Content areas should have a comfortable max-width and consistent spacing tokens throughout.


**Design Principles**
Read these first - they govern every decision that follows.

1.    Shadow hierarchy. Three tiers: small for inline cards, medium for featured content, large for floating/hero elements. Soft and diffuse, never harsh.
2.    Visual hierarchy through size and weight, not color clutter. Let the navy/blue/grey palette do the work -don't reach for more colors.
3. Dark surfaces for anchoring. Primary dark blue on nav, headers, CTA banners. Egg-shell base in between stays calm and open.
4.    Accent with restraint. Ocean blue draws the eye to the one thing you want clicked per section. Don't scatter it.
5.    No heavy borders. Separate content through spacing, background color shifts, and soft shadows instead.
6.    No pure white or pure black. Egg-shell base for backgrounds, charcoal for body text, navy for headings.
7.    Limit font weights. 2-3 per page max. Don't introduce colors outside the palette without reason.
8.    Accessibility first. All text must meet WAG AA contrast. Never sacrifice readability for aesthetics.


**Color Palette**
Replace existing colors with these tokens. Define them as CSS custom properties and extend your Tailwind/styling config.
Role	Hex	Where to use it
Primary	#0B2545	Dark deep-sea blue — navbars, sidebars, dark backgrounds, primary buttons
Primary Light	#133C73	Hover/active states on primary surfaces, gradients
Secondary	#C4CDD5	Cool light grey - borders, dividers, subtle outlines (NOT for text)
Secondary Light	#E2E8F0	Alternating section backgrounds, input borders, inactive tabs
Base	#F5F0EB	Egg-shell off-white — default page/content background
Base Light	#FAF8F5	Card surfaces, elevated containers, modals I
Accent	#2A7DE1	Bright ocean blue - CTA button fills, active/selected states
Accent Link	#1D6DC1	Darker ocean blue - inline text links (WCAG AA on egg-shell)
Accent Soft	#EDF2FB	Tinted blue backgrounds for highlights, selected items
Heading	#0B2545	Page titles, section headings, display text
Text	#1E293B	Neutral charcoal — body paragraphs, labels, readable text
Text Muted	#475569	Secondary copy, metadata, placeholders (WCAG AA on egg-shell)
Text On Dark	#F5FØEB	Text on primary/dark backgrounds
		Use semantic status colors where needed (success green, warning amber, error red) that harmonize with this palette.


**Typography**
*   Headings: Geometric sans-serif (Plus Jakarta Sans or DM Sans), bold, tight leading (1.1-1.2).
*   Body: Clean sans (Inter), relaxed leading (1.6).
*   Clear scale with obvious jumps: hero titles → section headings → card titles → body → metadata.

**Responsive Behavior**
Every screen size should look intentional — not like a desktop layout squeezed down. Think in three layout tiers; content reflows naturally between them.
Tier	Viewport	Mental model
Compact	< 768px	Single column. Stacked. Thumb-friendly.
Medium	768-1024px	2-column grids where appropriate. Sidebars collapse.
Wide	> 1024px	Full layout — sidebars, multi-column grids, side-by-side panels.

**Universal Rules**
*   Max-width content on wide screens — centered, egg-shell fills the margins.
*   Scale padding with viewport - tighter on compact, generous on wide.
*   44x44px minimum touch targets on compact.
*   Body text ≥ 16px on all devices. Hero headings scale down but stay dominant.
*   No page-level horizontal scroll. Only inside dedicated scroll containers.
*   Test the 768-1024px range most responsive bugs live there.
*   Hover is not a feature. Anything hover-revealed must also be accessible via tap or visible button.

**How Components Adapt**
*   Navigation: Wide = full navbar/sidebar. Medium = hamburger or icon-only rail. Compact = hamburger drawer or bottom tab bar.
*   Grids: Wide = 3-4 cols. Medium = 2 cols. Compact = 1 col. Never squish cards — fewer columns > cramming.
*   Sidebars: Wide = persistent. Medium = collapsible rail/overlay. Compact = hidden, accessible via menu. Main content always fills available width.
*   Two-column layouts: Wide = side by side. Compact = stacked, primary content first.
*   Tables: Wide = full. Medium = hide low-priority columns or scroll within container. Compact = card-per-row layout.
*   Forms: Wide = multi-column where logical. Medium/Compact = single column, full-width inputs, labels above. Submit buttons full-width on compact.
*   Modals: Wide/Medium = centered floating card. Compact = full-screen bottom sheet.
*   Scroll containers: Scroll-snap, partial next-card peek, hidden scrollbars. On wide, prefer grid over scroll.
*   Heroes: Wide = side by side. Compact = stacked (text first, visual below, scales gracefully).
*   Toasts: Wide = fixed-width, top-right. Compact = full-width, top or bottom of viewport.

**Avoid**
*   Don't hide important content on mobile restructure, don't remove.
*   Don't use fixed pixel widths — use percentage or max-width.
*   Don't let compact become an endless scroll - use collapsible sections or tabs for long pages.

**Component Style Guide**
Apply the principles and tokens above to every component below. Every element should look like it belongs to the same family.

***Buttons***
All buttons are pill-shaped (fully rounded). Smooth transitions on hover subtle scale-up + shadow shift and active (gentle press-down).
*   Primary CTA: Accent fill, white text. Use sparingly — one per section. Hover: darker accent + lift.
*   Secondary / Outlined: Primary border and text, transparent bg. Hover. fills with primary, text flips white.
*   Ghost: No bg, no border, muted text. Hover: faint secondary-light bg.
*   Icon buttons: Circular ghost style. Muted icon, hover: accent color.
*   Button groups: Connected pills, shared border. Active: accent fill + white text. Inactive: transparent + muted text.

***Cards & Containers***
*   Background: Base-light. Border: Secondary at low opacity. Corners: Generously rounded (x) - inner elements touching edges match the radius.
*   Shadow: Soft, diffuse - follows the three-tier hierarchy from Design Principles. Hover: shadow deepens.
*   Padding: Generous. Never cramped.
*   Nested containers: Secondary-light bg with subtler borders for visual layering.

***Inputs & Form Controls***
All inputs share the same base: base-light bg, secondary border, rounded (Ig). On focus: accent border + soft accent-tinted ring. Placeholder text in muted color.
*   Search bars: Pill-shaped variant with leading icon.
*   Textareas: Same style, rounded-lg (not xl).
*   Selects: Match text input styling. Dropdown panel: base-light bg, soft shadow. Selected item: accent-soft bg. Hover: secondary-light bg.
*   Date pickers: Accent fill on selected dates, accent-soft ring on today, accent-tinted band for ranges.


***Toggles & Switches***
*   Off: Secondary track, white knob. On: Accent track, white knob.
*   Smooth slide + color fill transition. Size proportional to adjacent text.

***Checkboxes & Radio Buttons***
*   Unchecked: Secondary border, base-light fill (rounded for checkboxes, circle for radios).
*   Checked: Accent fill, white checkmark/dot. Hover: Border shifts to accent. Focus: Soft accent ring.

***Badges, Pills & Tags***
Fully rounded capsules. Small uppercase text with wide letter-spacing for labels; normal case for content tags.
*   Outlined: Secondary border, transparent bg, muted text.
*   Filled: Bg tinted to match meaning (accent-soft, success, warning, danger). Text uses a darker shade of the same color.
*   Interactive: Selected = accent fill + white text. Unselected = secondary-light bg + muted text. Small x for removable.

***Tabs***
*   Active: Accent text + 2px accent underline (text-width only), or filled accent pill + white text.
*   Inactive: Muted text. Hover: darkens toward primary.

***Navigation***
*   Top navbar/sidebar: Primary dark blue bg the visual anchor of the page.
*   Links on dark: Egg-shell text at reduced opacity. Hover: full opacity. Active: accent indicator (underline, left border, or bg highlight).
*   Sidebar items: Icon + label. Active: lighter-navy bg + accent left edge.
*   Breadcrumbs: Muted text, • separators. Current page in primary (not linked).
Modals & Dialogs
*   Base-light bg, rounded (xl+), soft shadow, dim backdrop.
*   Spacious padding. Ghost × close button top-right. Actions right-aligned: primary CTA + ghost cancel.
Tooltips & Popovers
*   Dark tooltips: Primary bg, egg-shell text, rounded-lg, subtle shadow, directional caret.
*   Light popovers: Base-light bg, primary text, same shape.
*   Fade in with slight upward slide.

***Tables & Data Lists***
*   Headers: Muted, small/uppercase, secondary bottom border only.
*   Rows: No borders. Alternating secondary-light bg only when dense. Hover: faint secondary-light highlight.
*   Generous cell padding. Sort icons muted, accent on hover.

***Progress Bars***
Secondary-light track, accent (or success) fill, fully rounded. Subtle pulse on active states.
Alerts & Toasts
*   Rounded-Ig, 4px colored left border matching alert type. Tinted bg (accent-soft, success, warning, danger). Status icon left, primary text.
*   Toasts: Floating variant with soft shadow. Slide in, auto-dismiss with fade.

***Avatars***
Circular, thin secondary border. Fallback primary bg + egg-shell initials. Groups: overlapping with white ring separators.

***Loading States***
Skeleton blocks in secondary-light with slow pulse, matching content layout shapes. Accent ring spinner. Semi-transparent base overlay for loading states.

***Empty States***
Centered: muted icon → heading - one-line subtitle - primary CTA. Friendly tone ("No trips yet — let's plan one").
