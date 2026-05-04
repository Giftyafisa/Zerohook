# Picasso.js Scales & Mappings

A core concept in Picasso is the `scale`. A scale maps data values from the Qlik Engine into visual attributes (pixels, colors, opacity) for components.

## 1. Linear Scales (Continuous Data)

Used to map numeric values (like `Sum(Sales)`) to an axis length or size.

```javascript
settings: {
  scales: {
    yScale: {
      data: { field: 'qMeasureInfo/0' },  // E.g., Sales
      invert: true,                       // Y-axis usually starts top-down in canvas, invert it for bottom-up
      expand: 0.1                         // Add 10% padding so max value doesn't touch the top
    }
  }
}
```

## 2. Band Scales (Categorical Data)

Used to map discrete categories (like `Region`) to positions along an axis, creating uniform spacing for bars.

```javascript
settings: {
  scales: {
    xScale: {
      data: { extract: { field: 'qDimensionInfo/0' } }, // E.g., Region
      padding: 0.2                                      // Space between bars
    }
  }
}
```

## 3. Color Scales (Categorical / Continuous)

Used to color data points.

### Categorical Colors
Map each `Region` to a distinct color from a palette.
```javascript
settings: {
  scales: {
    colorScale: {
      type: 'color',                                    // Tell Picasso this is a color scale
      data: { extract: { field: 'qDimensionInfo/0' } }, // E.g., Region
      range: ['#3366CC', '#DC3912', '#FF9900']          // Custom palette
    }
  }
}
```

### Continuous (Gradient) Colors
Map a measure (e.g., `Sum(Profit)`) to a gradient (e.g., Red to Green).
```javascript
settings: {
  scales: {
    colorScale: {
      data: { field: 'qMeasureInfo/1' },  // E.g., Profit
      type: 'color',
      range: ['#DC3912', '#FFFFFF', '#109618'] // Red -> White -> Green
    }
  }
}
```

## 4. Size Scales (Scatter Plots)

Used to map a third measure to the radius of a circle in a scatter plot (Bubble chart).

```javascript
settings: {
  scales: {
    sizeScale: {
      data: { field: 'qMeasureInfo/2' }, // E.g., Order Quantity
      range: [5, 50]                     // Map min quantity to 5px, max to 50px radius
    }
  }
}
```

## Applying Scales to Components

Once defined, you reference the scale name in the component's `settings`.

```javascript
components: [
  {
    type: 'point',
    data: { extract: { field: 'qDimensionInfo/0', props: { 
      x: { field: 'qMeasureInfo/0' }, 
      y: { field: 'qMeasureInfo/1' },
      size: { field: 'qMeasureInfo/2' }
    } } },
    settings: {
      x: { scale: 'xScale' },
      y: { scale: 'yScale' },
      size: { scale: 'sizeScale' },
      fill: { scale: 'colorScale' },
      opacity: 0.8
    }
  }
]
```

## Advanced: Custom Functions in Scales

If you need a transformation that Picasso doesn't handle natively, you can pass a function to the component settings.

```javascript
settings: {
  fill: (datum) => {
    // If Sales < 0, red. Otherwise, green.
    return datum.y.value < 0 ? '#DC3912' : '#109618';
  }
}
```
