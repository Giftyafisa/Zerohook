---
name: qlik-extensions-picasso
description: >
  Build custom data visualizations for Qlik Sense using Picasso.js and
  nebula.js. Covers defining the data model (qHyperCubeDef), mapping data
  to visual components (bars, points, lines), scale configurations, and
  integrating with Qlik's selection model. Use when standard Qlik charts
  cannot achieve the required visual design.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-development
---

# Qlik Extensions & Picasso.js

## When to Use

- User needs a highly customized chart (e.g., Gantt, Radar, custom network graph)
- User wants to build a Qlik Sense Extension
- User mentions "Picasso.js" or "nebula.js"
- User needs to map Qlik data (HyperCube) into a visual component
- User asks how to make a custom D3/Picasso chart interactive (selections)

## What is Picasso.js?

Picasso.js is an open-source charting library by Qlik built specifically to work with the Qlik Engine's data structure (HyperCubes).
Instead of writing imperative D3 code, you define charts declaratively using JSON configurations for `components` (bars, axes, tooltips) and `scales` (linear, categorical).

## Building an Extension with nebula.js

Nebula.js is a collection of tools to build Qlik Sense extensions easily.

### 1. Initialize a new extension
```bash
npx @nebula.js/cli create hello-picasso --picasso
cd hello-picasso
npm run start
```
This scaffolds an extension that can be uploaded to Qlik Sense or embedded in a web app.

### 2. Anatomy of a Picasso Chart

A Picasso chart requires three things:
1. **Data**: The Qlik HyperCube.
2. **Scales**: How to translate data values to pixels (e.g., mapping `$0 - $1000` to `0px - 500px`).
3. **Components**: The actual visual elements (bars, axes, labels).

### 3. Basic Picasso Configuration (Bar Chart)

```javascript
import { picassoQ } from '@nebula.js/stardust';

export default function render(element, layout) {
  // 1. Initialize Picasso on the DOM element
  const pic = picasso({ renderer: { prio: ['canvas'] } });
  const chart = pic.chart({ element });

  // 2. Define the chart configuration
  chart.update({
    data: [
      {
        type: 'q',          // Tell Picasso to parse Qlik HyperCube format
        key: 'qHyperCube',
        data: layout.qHyperCube,
      }
    ],
    settings: {
      // SCALES: Map data to pixels/colors
      scales: {
        x: { data: { extract: { field: 'qDimensionInfo/0' } } }, // Region
        y: { data: { field: 'qMeasureInfo/0' }, invert: true },  // Sales
        color: { type: 'color', data: { extract: { field: 'qDimensionInfo/0' } } }
      },
      
      // COMPONENTS: Visual elements
      components: [
        {
          type: 'axis',
          dock: 'bottom',
          scale: 'x'
        },
        {
          type: 'axis',
          dock: 'left',
          scale: 'y'
        },
        {
          type: 'box',      // 'box' renders bars
          data: { extract: { field: 'qDimensionInfo/0', props: { end: { field: 'qMeasureInfo/0' } } } },
          settings: {
            major: { scale: 'x' },
            minor: { scale: 'y', ref: 'end' },
            box: {
              fill: { scale: 'color' }
            }
          }
        }
      ]
    }
  });
}
```

## Adding Interactivity (Selections)

To make the chart native to Qlik, it must support selections (brushing).

1. Define a `brush` in the settings.
2. Tell the `box` component to respond to the brush (e.g., lower opacity of unselected bars).
3. Listen to the `brush` event and pass it to the Qlik Engine via nebula.js.

```javascript
// Inside settings:
settings: {
  interactions: [
    {
      type: 'native',
      events: { mousedown: function(e) { this.chart.component('brush').emit('start', e); } }
    }
  ],
  components: [
    {
      key: 'bars',
      type: 'box',
      data: { extract: { field: 'qDimensionInfo/0', props: { end: { field: 'qMeasureInfo/0' } } } },
      brush: {
        trigger: [{ on: 'tap', contexts: ['select'] }],
        consume: [{ context: 'select', style: { inactive: { opacity: 0.3 } } }]
      },
      settings: { ... }
    }
  ]
}

// Outside settings, link Picasso brush to Qlik Engine
const brush = chart.brush('select');
brush.on('update', () => {
  const selections = brush.brushes();
  // Pass selections to Qlik Engine using nebula.js useSelections hook
});
```

## Component Types Available

Picasso supports many primitives out of the box:
- `box` (Bars, Gantt, Candlestick)
- `point` (Scatter plots, dot plots)
- `line` (Line charts, sparklines)
- `pie` (Pie, donut, nightingale rose)
- `text` (Labels, KPIs)
- `axis` & `grid-line` (Background formatting)

To build a complex chart (like a Waterfall or Violin plot), you combine these primitives.

[See references/picasso-scales.md for advanced scale configurations]
[See assets/picasso-scatter-template.js for a complete scatter plot example]
