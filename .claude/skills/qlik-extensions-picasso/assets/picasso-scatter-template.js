import { picassoQ } from '@nebula.js/stardust';
import picasso from 'picasso.js';
import qPlugin from 'picasso-plugin-q';

picasso.use(qPlugin);

export default function render(element, layout) {
  // Clear any existing chart in the element
  element.innerHTML = '';

  const pic = picasso({ renderer: { prio: ['canvas'] } });
  const chart = pic.chart({
    element,
    data: [
      {
        type: 'q',
        key: 'qHyperCube',
        data: layout.qHyperCube,
      },
    ],
    settings: {
      scales: {
        xScale: {
          data: { field: 'qMeasureInfo/0' }, // E.g. Sales
          expand: 0.1,
          invert: false
        },
        yScale: {
          data: { field: 'qMeasureInfo/1' }, // E.g. Profit
          expand: 0.1,
          invert: true
        },
        colorScale: {
          type: 'color',
          data: { extract: { field: 'qDimensionInfo/0' } } // E.g. Customer
        },
        sizeScale: {
          data: { field: 'qMeasureInfo/2' }, // E.g. Margin
          range: [0.1, 1.5]
        }
      },
      components: [
        {
          key: 'xAxis',
          type: 'axis',
          dock: 'bottom',
          scale: 'xScale',
          formatter: {
            type: 'd3-number',
            format: '$,.2f'
          }
        },
        {
          key: 'yAxis',
          type: 'axis',
          dock: 'left',
          scale: 'yScale',
          formatter: {
            type: 'd3-number',
            format: '$,.2f'
          }
        },
        {
          key: 'points',
          type: 'point',
          data: {
            extract: {
              field: 'qDimensionInfo/0', // Primary Key (Customer)
              props: {
                x: { field: 'qMeasureInfo/0' },
                y: { field: 'qMeasureInfo/1' },
                size: { field: 'qMeasureInfo/2' }
              }
            }
          },
          settings: {
            x: { scale: 'xScale' },
            y: { scale: 'yScale' },
            size: { scale: 'sizeScale' },
            fill: { scale: 'colorScale' },
            opacity: 0.8,
            strokeWidth: 1,
            stroke: '#fff'
          }
        },
        {
          // Simple Tooltip component (requires picasso-plugin-q tooltip or custom implementation)
          key: 'tooltip',
          type: 'tooltip',
          displayOrder: 1,
          settings: {
            appendTo: element,
            extract: ({ node }) => [
              { title: 'Customer', value: node.data.label },
              { title: 'Sales', value: node.data.x.label },
              { title: 'Profit', value: node.data.y.label }
            ]
          }
        }
      ]
    }
  });

  return chart;
}
