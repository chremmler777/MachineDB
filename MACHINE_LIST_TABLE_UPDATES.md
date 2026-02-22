# Machine List Table Updates

## Overview
Updated the machine list table in the frontend to improve readability, usability, and visual organization. The table displays machine data with color-coded column groups, sticky positioning, column sorting, and advanced filters.

---

## Features

### 1. Sticky First Column
- The "Machine" column stays visible when scrolling horizontally
- `position: sticky; left: 0` with z-index: 1 on data cells, z-index: 4 on headers
- Black text on fully opaque background to prevent ghosting

### 2. Color-Coded Column Groups
Nine distinct column groups with soft pastel colors:
| Group | Color |
|---|---|
| Machine Info | Light Blue `rgba(173, 216, 230, 1)` |
| Machine Dimensions | Light Cyan `rgba(175, 238, 238, 1)` |
| Clamping Unit | Light Yellow `rgba(255, 255, 153, 1)` |
| Tool Connections | Light Orange `rgba(255, 218, 185, 1)` |
| Interfaces | Light Purple `rgba(221, 160, 221, 1)` |
| Injection Unit 1 | Light Green `rgba(144, 238, 144, 1)` |
| Injection Unit 2 | Soft Red `rgba(255, 130, 130, 1)` — clearly distinct from IU1 |
| Robot | Light Pink `rgba(255, 192, 203, 1)` |
| Additional Info | Light Gray `rgba(211, 211, 211, 1)` |

- Headers: 100% opacity (fully solid, no ghosting)
- Data cells: 12% opacity (subtle color hint)
- First column: 100% opacity (prevents scroll glitch)

### 3. Double Header Row
- **Row 1 (Group)**: Group names, sticky vertically, dark text `#1a1a1a`, scrolls horizontally with columns
- **Row 2 (Columns)**: Individual column names, sticky vertically, black text `#000000`, first cell also sticky horizontally

### 4. Column Sorting
- Click any column header to sort ascending ▲
- Click again to sort descending ▼
- Inactive columns show faint ▲ indicator
- Uses **natural sort** (`localeCompare` with `numeric: true`) — KM 80 sorts correctly after KM 1000, not before

### 5. Filters (Two Rows)
**Row 1:**
- Full-text search (machine name, manufacturer, model)
- Plant (All / USA / Mexico)
- Manufacturer (dynamic dropdown from data)

**Row 2:**
- Clamping force range in tons (Min – Max)
- IU1 Screw diameter range in mm (Min – Max)
- 2-Shot: All / Yes / No (based on IU2 presence)
- Robot: All / Yes / No
- Rotary Table: All / Yes / No

### 6. Dark Mode Support
- Two separate text color variables:
  - `textColor` — dark, used on table headers (light pastel backgrounds)
  - `uiTextColor` — light in dark mode (`#e5e7eb`), used for all filter inputs and labels

---

## Data Corrections

### Clamping Force — KM Machines
All 25 KM machines had empty clamping force. Auto-populated directly from machine name:
```sql
UPDATE machines
SET clamping_force_kn = CAST(SPLIT_PART(REPLACE(internal_name, 'KM ', ''), '-', 1) AS NUMERIC)
WHERE internal_name LIKE 'KM %';
```
Result: KM 80 → 80t, KM 550 → 550t, KM 1300 → 1300t, etc.

### Injection Unit Data — All 52 Machines
Original import had a 3-column shift error in IU1 and IU2 fields:
| DB Field | Was Storing | Now Correct |
|---|---|---|
| `iu1_screw_diameter_mm` | Injection pressure (bar) | Screw diameter (mm) |
| `iu1_shot_volume_cm3` | Shot weight (g) | Shot volume (cm³) |
| `iu1_injection_pressure_bar` | Plasticizing rate | Injection pressure (bar) |
| All IU2 fields | Same shift | Corrected |

Fixed by re-importing from correct Excel columns in both sheets (USA + Mexico).

### Column Label
- `Force (kN)` renamed to `Clamping (t)` — values represent metric tons

---

## File Modified
`frontend/src/pages/MachineListPage.tsx`

---

## Known Limitations
1. Header cell borders visible only with darker border color (#555555)
2. Cell content truncated at 150px with ellipsis
3. No column width resizing

## Future Improvements
- Export to CSV/Excel
- Column width resizing
- Print layout
