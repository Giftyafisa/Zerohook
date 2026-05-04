---
name: qlik-ui-ux-theming
description: >
  Best practices for Qlik Sense UI/UX design and custom theming. Covers
  the DAR (Dashboard, Analysis, Reporting) methodology, grid layouts,
  color palettes, and the structure of Qlik Sense custom themes (JSON/CSS).
  Use when designing dashboards, standardizing corporate branding, or
  building custom themes.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-ui
---

# Qlik UI/UX & Custom Theming

## When to Use

- User asks how to apply corporate branding or colors to an app
- User wants to build a custom Qlik Sense Theme
- User asks for dashboard design best practices
- User mentions "DAR methodology", UI, UX, or layout guidelines
- User needs to standardize fonts, font sizes, or color palettes across charts

## Dashboard Design Best Practices (DAR)

The standard methodology for Qlik application design is **DAR**:

### 1. Dashboard (High-Level)
- **Purpose**: Answer "What is happening right now?"
- **Audience**: Executives, managers.
- **Content**: KPIs, gauges, high-level line/bar charts.
- **Interactivity**: Minimal. No deep drill-downs.

### 2. Analysis (Exploratory)
- **Purpose**: Answer "Why is this happening?"
- **Audience**: Analysts, domain experts.
- **Content**: Scatter plots, treemaps, multi-dimensional bar charts.
- **Interactivity**: High. Lots of filter panes, drill-down dimensions, and set analysis comparing selections.

### 3. Reporting (Granular)
- **Purpose**: Answer "What are the exact details?"
- **Audience**: Operations, line workers, data exporters.
- **Content**: Straight tables, pivot tables.
- **Interactivity**: Moderate. Filtering down to export data to Excel.

## Layout & Grid Rules

1. **The "F" Pattern**: Users read left-to-right, top-to-bottom.
   - Top-left: Most important KPI or global filters.
   - Top-right: Secondary KPIs.
   - Bottom-left: High-level chart.
   - Bottom-right: Detail table or granular chart.
2. **Filter Placement**: Keep filter panes consistent. Either a horizontal bar across the top (below the title) or a vertical pane on the left side. Never scatter filters randomly.
3. **White Space**: Don't cram 15 charts onto a sheet. Aim for 4-6 objects maximum. Use white space to let the data breathe.

## Custom Themes Overview

A Qlik Sense Custom Theme allows you to define global styles (colors, fonts, sizes, backgrounds) so developers don't have to style charts individually.

### Theme Structure
A theme consists of at least 3 files zipped together:
1. `theme.qext`: Metadata (name, author, version).
2. `theme.json`: The core styling definitions (palettes, font sizes, chart-specific settings).
3. `theme.css`: Optional CSS for overriding specific Qlik Sense DOM elements (use sparingly, as DOM changes break between Qlik versions).

### Installing a Theme
- **Qlik Cloud**: Management Console → Themes → Add.
- **QSEoW**: QMC → Extensions → Import (zipped theme folder).

## Understanding the JSON Structure

The `theme.json` file is divided into several key sections:

### 1. Variables
Define reusable colors and font sizes.
```json
"_variables": {
  "@primary": "#006580",
  "@secondary": "#0098C3",
  "@fontFamily": "Open Sans, sans-serif"
}
```

### 2. Color Palettes
Define the colors used for dimensions and measures.
```json
"palettes": {
  "data": [
    {
      "name": "Corporate Palette",
      "translation": "Corporate Colors",
      "type": "pyramid",
      "colors": ["#006580", "#0098C3", "#E5F2F5", "#F2F2F2", "#666666"]
    }
  ],
  "ui": [
    {
      "name": "UI Colors",
      "colors": ["#FFFFFF", "#000000", "@primary"]
    }
  ]
}
```

### 3. Scales (Gradients)
Define gradients used in heatmaps, maps, and color-by-measure.
```json
"scales": [
  {
    "name": "Sequential",
    "translation": "Sequential Blue",
    "type": "gradient",
    "colors": ["#E5F2F5", "#006580"]
  }
]
```

### 4. Global Settings (Fonts & Backgrounds)
```json
"color": "@primary",
"fontSize": "13px",
"fontFamily": "@fontFamily",
"backgroundColor": "#F8F8F8"
```

### 5. Object-Specific Styling
Override global settings for specific chart types.
```json
"object": {
  "barChart": {
    "title": {
      "main": {
        "color": "@primary",
        "fontSize": "16px"
      }
    }
  },
  "kpi": {
    "title": { "fontSize": "14px" },
    "value": { "fontSize": "24px", "color": "@secondary" }
  }
}
```

## Theme CSS Best Practices

Use the `theme.css` file **only** when `theme.json` cannot achieve the desired result (e.g., hiding specific buttons, changing scrollbar appearance, or tweaking sheet titles).

```css
/* Change the sheet title background */
.qv-panel-sheet .sheet-title-container {
    background-color: #006580;
    color: white;
}

/* Hide the Qlik logo in the top bar (if permitted by license) */
.qui-button__icon.lui-icon--qlik {
    display: none !important;
}

/* Custom scrollbars */
::-webkit-scrollbar {
    width: 8px;
    height: 8px;
}
::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 4px;
}
```

[See references/theme-json-structure.md for the complete JSON schema]
[See assets/theme.json for a starter template]
