# Booking Checklist - Design Spec
--

A complete spec for a flat, category-grouped booking checklist with collapsed/expanded item states, consistent date/time inputs, and reuse of existing modules.
--
## Structure
No outer wrapper. The page is a vertical stack of independent containers following the design system's Cards spec (base-light bg, rounded-xl corners, soft shadow, generous padding). Each has its own header and '+ Add Item button':
secondary border at low opacity,
1.    **Transportation** - trains, buses, flights, etc.
2.    **Accommodation** - hotels, Airbnb, etc.
3.    **City #1 Activities** - all activities for the first city
4.    **City #2 Activities** - etc. (one container per city)
I
All items within every container are **sorted by date ascending**. For round-trip transportation, sort by the departure date.
---
## Search Bar
A **pill-shaped search bar** sits above all containers (top of the page), following the design system's search input spec - leading Phosphor magnifying-glass icon, muted placeholder text ("Search bookings..."). Always visible.
-   **Searches item mames only** - not notes, locations, or other fields. Browser Cd+F covers broad text search.
-   **Autofi11 dropdown** appears as the user types, showing matching names across all containers. Each result displays: "Name - Category badge" (e-g-, "Delta Flight 1234 • Transportation*).
-   **On select:** Search clears, page scrolls to the matched item, and the item gets a brief accent-soft background flash (~1s) to draw the eye.
-   **No matches:** Dropdown shows "No bookings found" in muted text.
---
## Item States
Every checklist item has two visual states:

### Collapsed (default)
A single scannable row. Only the essentials - no price, no notes, no location detati.
| Type | Collapsed display |
|---|---|
| **Transportation (one-way)** | '☐ Name • Start → End • Jun 15, 2:30 PM' |
| **Transportation (round trip)** | '☐ Name • Start -><- • End Jun 15 - Jun 22' |
| **Accommodation** | '☐ Name • City • Jun 15 - Jun 18 |
| **Activity** |'☐ Name • Jun 16, 10:00 AM' |

**Location truncation:** Google Maps Locations can be long. In collapsed rows, truncate location names to the city/short name (~28 chars max) with ellipsis. Full name visible on expand.
**Typography in collapsed rows:**
-   **Container header:** Heading color, bold, geometric sans-serif.
-   **Item Name:** Text color (#1E293B"), medium weight.
-   **Metadata** (locations, dates, '•' separators): Text Muted color ('#475569*').

-   Click/tap the row to **expands** for editing.
-   The checkbox is always accessible in collapsed state (no need to expand to check off).

## Expanded (on click)
The full form appears below the collapsed summary. Clicking outside or a collapse chevron returns to collapsed state.
**Delete action:**A ghost Phosphor trash icon button in the expanded view (top-right, next to the collapse chevron). On click: item is removed immediately and a brief "*undo toast** appears ("Item deleted • Undo") rather than a confirmation modal - faster and less disruptive.

### Two-Zone Progressive Disclosure
To keep the form clean, the expanded view is split into two zones:

**primary zone (always visible)** - the "what, where, when" flelds you fill in every time:


|Transportation | Accommodation | Activity |
|---|---|---|
| Name | Name | Name |
| One-way / Round trip toggle | City | Location |
| Start location | Check-in date | Date + time |
| End location | Check-out date | |
| Departure date + time | | |
| Return date + time (if RT) | | |

On **wide screens**, use multi-field rows to compress vertical space: Name + toggle side by side, Start + End side by side, DatePicker + TimePicker side by side.
**Secondary zone (collapsed by default)** - behind a **"More details"** ghost text link with a Phosphor caret-down icon:

| Field | Input type | Notes |
|---|---|---|
| **Reference #** | Text input | Confirmation code / ticket number |
| **Price (USD)** | Number input with '$' prefix | Optional - shows  *-* when empty |
|**Notes** | Expandable text box | Existing module |

These three fields are **identical across all item types** - same order, same inputs, same zone.

**Smart auto-expand:** If any secondary field already has data, the secondary zone opens automatically on expand. If all are empty, it stays collapsed.

---
## Checked-Off Behavior
Items **stay in place** (no reordering), On check;
1.    Checkbox fills with accent + white checkmark,
2.    Row shadow fLattens to zero (elevation drops),
3.    Name text gets a subtle strikethrough, All text shifts to Text Muted color,
4.    Smooth 200-380ms ease transition.

No opacity reduction - that would break WCAG AA contrast, The item recedes through color shift + shadow loss while remaining legible.


## Fields Per Item Type
primary fields are in the walways-visible zone. Secondary fields (Reference #, Price, Notes) are shared across all types and live in the s"More details" zone** - see Two-Zone Progressive Disclosure above.

### Transportation - Primary Fields
| Field | Input type | Required | Notes |
|---|---|---|---|
| **Name** | Text input | Yes | e-g-, "Delta Flight 1234" |
| **One-way / Round trip** | Toggle | Yes | Default: one-way. Controls date/time layout. I
| **Start Location** | Google Maps search bar | Yes | Existing module - tied to coordinates |
| **End location** | Google Maps search bar | Yes | Existing module - tied to coordinates |
| **Departure date + time** | *[DatePicker] [TimePicker]* | Yes | Side by side |
| **Return date + time** | *[DatePicker] [TimePicker]* | If round trip | Only visible when round trip is toggled on |

### Accommodation - Primary Fields
| Field | Input type | Recuired | Notes |
|---|---|---|---|
| **Name** | Text input | Yes | e.g., "Hilton Paris Opera" |
| **City** | Google Maps search bar | Yes | Existing module - tied to coordinates |
| **Check-in date** | *[DatePicker]* | Yes | |
| **Check-out date** | *[DatePicker]* | Yes | Displayed as range: 'Jun 15 - Jun 18' |

### Activity - Primary Fields
| Field | Input type | Required | Notes |
|---|---|---|---|
| **Name** | Text input | Yes | Auto-filled if from Step 2 Review approval |
| **Location** | Google Maps search bar | No | Existing module - tied to coordinates |
| **Date + time** | *[DatePicker] [TimePicker]* | Yes | Side-by-side |

## Secondary Fields (all item types)
| Field | Input type | Required | Notes |
|---|---|---|---|
| **Reference #** | Text Input | No | Confirmation code / ticket number |
| **Price (USD)** | Number input with $ prefix | No | optional - shows "" when empty |
| **Notes** | Expandable text box | No | Existing module - starts small, expands |


## Date/Time Input system
Two atomic components sharing identical visual styling (border, radius, icon placement, focus ring, font):
- *[DatePicker]* - calendar icon, selects a date, opens a calendar popup.
_ *[TimePicker]* - clock icon, selects a time of day, dropdown or scroll picker.

Composed differently per item type but always the same visual atoms:

| Type | Composition | Collapsed format |
|---|---|---|
| **Transportation (one-way)** | *[DatePicker]* *[TimePicker]* Side-By-Side | 'Jun 15, 2:30 PM' |
| **Transportation (round-trip)** | *[DatePicker]* *[TimePicker]* + *[DatePicker]* *[TimePicker]* (two rows: Depart / Return) | 'Jun 15 - Jun 22' |
| **Accommodation** | *[DatePicker]* Check-in - *[DatePicker]* Check-out | 'Jun 15 - Jun 18' |
| **Activity** | *[DatePicker]* *[TimePicker]* Side-by-side | 'Jun 16, 10:00 am' |

---
## Existing Modules & Conventions
**Google Maps search bars** - autofill, coordinate binding. Used for: Transport start/end, Accommodation city, Activity location.
**Expandable text boxes** - starts compact, grows on focus/content. Used for: Notes field on all item types.
**All icons must be Phosphor icons** - calendar, clock, map pin, chevrons, checkmarks, add/remove, etc. No mixing icon libraries.
---
## Container Behavior
-   Each container has a **header** (category name) at the top and a **+ Add Item button** pinned below the last checklist item inside that container.
-   **Container headers are clickable to collapse/expand** the entire container. Collapsed state shows just the header + item count badge (e.g., "Transportation (4)").
Useful on long trips with many city containers,
-   **+ Add Item is a Ghost button** - muted text, no bg/border, leading Phosphor '+' icon. Hoven: faint secondary-light bg. It must not compete with primary CAS elsewhere on the page.
-  Clicking "+ Add Item" appends a new expanded item form directly above the button, Once saved, the Item sorts into its correct date position.
-   City activity containers are generated dynamically based on the trip's cities,
empty containers show: muted Phosphor icon (e.B, airplane for Transportation, bed for Accommodation, map-pin for Activities) → muted text like "No transportation booked yet"→ the "+ Add Item" button,
-   **per-container cost subtotal** A small muted line above the "+ Add Item" button showing "Total: $XXXX" - only visible if any items in the container have a price filled in. If no prices, the line is hidden.
-  **Grand total:** A standalone muted Line below all containers showing the sum across all categories, Same visibility rule -only shows if any prices exist.


## Responsive Behavior
Follows the design system's three layout tiers (Compact < 768px, Medium 768-1024px, Wide > 1024px).

**Collapsed rows：**
-   **Wide/Medium;** Single 1ine - "• Name • metadata • date .
-   **Compact:** Two 1ines - Name on the first line, metadata + date wrapping to a second line. Name truncates with ellipsis if tao long-

**Expanded forms：**
-   **Wide:** Multi-field rows where logical (e.g», DatePicker + TimePicker side by side, Start + End location side by side).
-   **Medium/Compact:** All fields stack to single column. Full-width inputs. Labels above fields.
-   DatePicker + TimePicker stack vertically on compact,

**Containers**
-   Padding scales with viewport - tighter on compast, generous on wide,
-  Containers stack in a single column at all tiers (they're already single-column by nature).

**Touch targets:**
- Checkboxes, expand/collapse hit areas, and + Add Item must be ≥ 44x44px on compact,