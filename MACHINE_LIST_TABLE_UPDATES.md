# Machine List Table Updates

## Overview
Updated the machine list table in the frontend to improve readability, usability, and visual organization. The table now displays machine data with color-coded column groups, sticky positioning for easy navigation, and improved text contrast.

## Key Features Implemented

### 1. **Sticky First Column**
- The "Machine" column (internal_name) remains visible when scrolling horizontally
- Uses `position: sticky; left: 0` with z-index: 1
- Helps users maintain context while viewing technical specifications
- First column text is black (#000000) for contrast on opaque background

### 2. **Color-Coded Column Groups**
Nine distinct column groups with soft pastel colors:
- **Machine Info** - Light Blue (rgba(173, 216, 230, 1))
- **Machine Dimensions** - Light Cyan (rgba(175, 238, 238, 1))
- **Clamping Unit** - Light Yellow (rgba(255, 255, 153, 1))
- **Tool Connections** - Light Orange (rgba(255, 218, 185, 1))
- **Interfaces** - Light Purple (rgba(221, 160, 221, 1))
- **Injection Unit 1** - Light Green (rgba(144, 238, 144, 1))
- **Injection Unit 2** - Light Mint (rgba(152, 251, 152, 1))
- **Robot** - Light Pink (rgba(255, 192, 203, 1))
- **Additional Info** - Light Gray (rgba(211, 211, 211, 1))

### 3. **Header Structure**
- **Group Header Row** (top): Shows column group names, sticky vertically with top: 0
  - Dark gray text (#1a1a1a) for visibility on light backgrounds
  - Fully opaque background (100%) to prevent ghosting

- **Column Header Row** (second): Shows individual column names
  - Black text (#000000) for readability
  - Sticky on first column (Machine) with position: sticky; left: 0; zIndex: 4
  - Borders with darker color (#555555) for cell separation

### 4. **Data Rows Styling**
- First column: Black text on full opacity background (no transparency)
- Other columns: White text on semi-transparent backgrounds (12% opacity)
- Alternating row colors for better readability:
  - Even rows: Dark or light background
  - Odd rows: Slightly different shade
- Hover effect: Highlighted row on mouse enter

### 5. **Horizontal Scrolling**
- Group headers scroll freely horizontally with their columns
- Column headers remain visible at top during vertical scroll
- First column stays pinned to left edge during horizontal scroll
- Smooth scrolling with proper z-index layering

## Technical Implementation

### File Modified
`frontend/src/pages/MachineListPage.tsx`

### Key Code Structures

```typescript
// Column groups definition
const COLUMN_GROUPS = [
  {
    group: 'Machine Info',
    color: 'rgba(173, 216, 230, 1)',
    columns: [...]
  },
  // ... 8 more groups
];

// Color functions
const getColumnColor = (key: string): string => {
  // Returns 12% opacity version of group color
  return color.replace(', 1)', ', 0.12)');
};

const getFirstRowColumnColor = (key: string): string => {
  // Returns full opacity version for first data row
  return color.replace(', 0.12)', ', 1)');
};
```

### Z-Index Layering
- Group header cells (first column): z-index 4
- Column header cells (first column): z-index 4
- Data cells (first column): z-index 1
- Other header cells: z-index 2-3
- Regular data cells: z-index 0

## Styling Details

### Headers
- Padding: 8px 12px (group), 8px 6px (columns)
- Font-weight: 700 (group), 600 (columns)
- Font-size: 11px (group), 10px (columns)
- Borders: 1px solid #555555 (right and bottom)
- Background: Full opacity group color

### Data Cells
- Padding: 6px 4px
- Font-size: 11px
- Max-width: 150px with ellipsis overflow
- Text-align: right for numeric fields, left for text
- Background: 12% opacity group color (or 100% for first row/column)
- Borders: 1px solid borderColor

## Browser Compatibility
- Uses CSS `position: sticky` (supported in all modern browsers)
- Uses CSS `rgba()` colors (supported in all modern browsers)
- Uses CSS Grid and Flexbox concepts through inline styles

## Performance Considerations
- Table uses `borderCollapse: 'collapse'` for rendering efficiency
- Sticky positioning uses GPU acceleration in modern browsers
- Column color map cached for O(1) lookups
- Row hover effects use inline style updates (acceptable for ~50 rows)

## Data Source
- Displays data from MachineDataBase.xlsx structure
- Supports both USA and Mexico tabs
- Total 52 machines in database

## Known Limitations
1. Header cell borders may appear faint on some color combinations
2. Very long cell content is truncated with ellipsis
3. No horizontal scrollbar indicator (browser default)

## Future Improvements
- Add column width resizing
- Add sorting by column
- Add filtering by column
- Export to CSV/Excel
- Print styling optimizations
