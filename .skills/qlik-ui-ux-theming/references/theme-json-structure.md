# Qlik Custom Theme JSON Structure

This reference outlines the full schema for a Qlik Sense `theme.json` file. Use this as a guide when modifying or extending a custom theme.

## 1. Top-Level Structure

```json
{
  "_inherit": true,
  "_variables": {},
  "customProperties": {},
  "palettes": {
    "data": [],
    "ui": []
  },
  "scales": [],
  "color": "#333333",
  "fontSize": "13px",
  "fontFamily": "Arial, sans-serif",
  "backgroundColor": "#F5F5F5",
  "object": {},
  "dataColors": {}
}
```

- `_inherit: true`: Inherit missing properties from the default "Sense Horizon" theme. (Highly recommended).
- `_variables`: Local variables mapped via `@` prefix (e.g., `"@red": "#FF0000"`).

## 2. Palettes (Discrete Colors)

Used when coloring by Dimension.

```json
"palettes": {
  "data": [
    {
      "name": "12 Colors",
      "translation": "Corporate 12 Colors",
      "propertyValue": "12",
      "type": "pyramid",
      "colors": [
        "#3366CC", "#DC3912", "#FF9900", "#109618",
        "#990099", "#0099C6", "#DD4477", "#66AA00",
        "#B82E2E", "#316395", "#994499", "#22AA99"
      ]
    },
    {
      "name": "100 Colors",
      "translation": "Corporate 100 Colors",
      "propertyValue": "100",
      "type": "row",
      "colors": ["#...", "#..."]
    }
  ]
}
```
*Note: `type: "pyramid"` means Qlik will use the first N colors depending on how many dimension values exist. `type: "row"` means it will loop through the colors sequentially.*

## 3. Scales (Continuous Gradients)

Used when coloring by Measure, Maps, and Heatmaps.

```json
"scales": [
  {
    "name": "Sequential Theme",
    "translation": "Corporate Sequential",
    "propertyValue": "sg",
    "type": "gradient",
    "colors": ["#E8F4F8", "#006580"]
  },
  {
    "name": "Diverging Theme",
    "translation": "Corporate Diverging",
    "propertyValue": "dg",
    "type": "gradient",
    "colors": ["#DC3912", "#E8F4F8", "#109618"]
  }
]
```

## 4. Default Data Colors

Set the default colors for various chart elements so users don't have to select them manually.

```json
"dataColors": {
  "primaryColor": "#006580",
  "othersColor": "#CCCCCC",
  "errorColor": "#DC3912",
  "nullColor": "#999999"
}
```

## 5. Object-Specific Styling

You can override global styles for specific objects.

```json
"object": {
  "title": {
    "main": {
      "color": "#006580",
      "fontSize": "16px",
      "fontWeight": "bold"
    },
    "subTitle": {
      "color": "#666666",
      "fontSize": "13px"
    },
    "footer": {
      "color": "#999999",
      "fontSize": "11px",
      "fontStyle": "italic"
    }
  },
  "barChart": {
    "backgroundColor": "#FFFFFF",
    "outOfRange": { "color": "#FF0000" }
  },
  "lineChart": {
    "dataPoint": { "color": "#006580" }
  },
  "pieChart": {
    "backgroundColor": "transparent"
  },
  "kpi": {
    "backgroundColor": "#FFFFFF",
    "title": {
      "main": {
        "color": "#666666",
        "fontSize": "14px",
        "fontWeight": "normal"
      }
    },
    "value": {
      "color": "#006580",
      "fontSize": "32px",
      "fontWeight": "bold"
    }
  },
  "table": {
    "backgroundColor": "#FFFFFF",
    "header": {
      "color": "#006580",
      "fontSize": "13px",
      "fontWeight": "bold"
    },
    "content": {
      "color": "#333333",
      "fontSize": "13px"
    },
    "hover": {
      "color": "#000000",
      "backgroundColor": "#F0F8FA"
    }
  },
  "filterpane": {
    "backgroundColor": "#FFFFFF",
    "header": {
      "color": "#006580"
    }
  }
}
```

## Applying Custom Properties to UI Elements

```json
"customProperties": {
  "title": {
    "fontFamily": "Roboto, sans-serif"
  }
}
```
*Note: Available keys in `object` include: `barChart`, `lineChart`, `pieChart`, `scatterPlot`, `comboChart`, `treemap`, `table`, `pivotTable`, `kpi`, `gauge`, `histogram`, `boxplot`, `distributionPlot`, `waterfallChart`, `map`, `filterpane`, `text-image`.*
