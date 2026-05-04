# Advanced Embedding Patterns

## Multi-Object Dashboard

Embed multiple Qlik objects in a single page with shared selections:

### iframe Approach (Simple)
```html
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
  <iframe src="https://tenant.qlikcloud.com/single/?appid=APP&obj=CHART1&qlik-web-integration-id=WID"
          style="border:none; height:400px;"></iframe>
  <iframe src="https://tenant.qlikcloud.com/single/?appid=APP&obj=CHART2&qlik-web-integration-id=WID"
          style="border:none; height:400px;"></iframe>
  <iframe src="https://tenant.qlikcloud.com/single/?appid=APP&obj=TABLE1&qlik-web-integration-id=WID"
          style="border:none; height:400px;" colspan="2"></iframe>
</div>
```

**Note:** Each iframe opens a separate session. Selections in one iframe do NOT propagate to others.

### Shared Session (nebula.js)
```javascript
// Single app connection — all charts share selections
const app = await openApp('APP_ID');
const nebula = embed(app, { types: [...] });

await nebula.render({ element: document.getElementById('chart1'), id: 'OBJ1' });
await nebula.render({ element: document.getElementById('chart2'), id: 'OBJ2' });
await nebula.render({ element: document.getElementById('table1'), id: 'OBJ3' });

// Selection in chart1 automatically filters chart2 and table1
```

## Selection Bar

### nebula.js Selection Bar
```javascript
const selections = await nebula.selections();
selections.mount(document.getElementById('selection-bar'));
// Shows current selections with clear/back/forward buttons
```

### Custom Selection UI
```javascript
// Get field values
const field = await app.getField('Region');
const listObject = await app.createSessionObject({
  qListObjectDef: {
    qDef: { qFieldDefs: ['Region'] },
    qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 100, qWidth: 1 }],
  },
});

const layout = await listObject.getLayout();
const values = layout.qListObject.qDataPages[0].qMatrix.map(row => ({
  text: row[0].qText,
  state: row[0].qState, // 'S' = selected, 'O' = optional, 'X' = excluded
  elemNumber: row[0].qElemNumber,
}));

// Make selection
await field.selectValues([{ qText: 'North', qIsNumeric: false }]);

// Clear field
await field.clear();

// Clear all
await app.clearAll();
```

## Responsive Embedding

### Auto-Resize iframe
```javascript
// Parent page
window.addEventListener('message', function(event) {
  if (event.data.type === 'qlik-resize') {
    document.getElementById('qlik-frame').style.height = event.data.height + 'px';
  }
});
```

### Lazy Loading with IntersectionObserver
```javascript
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const container = entry.target;
      const objectId = container.dataset.qlikObject;
      nebula.render({ element: container, id: objectId });
      observer.unobserve(container);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('[data-qlik-object]').forEach(el => observer.observe(el));
```

## Theming

### Custom Theme for Embedded Content
```javascript
const nebula = embed(app, {
  context: {
    theme: 'my-custom-theme',
  },
  themes: [{
    id: 'my-custom-theme',
    load: () => Promise.resolve({
      type: 'light',
      color: '#333',
      fontFamily: 'Inter, sans-serif',
      palettes: {
        data: [{ colors: ['#1e88e5', '#43a047', '#fb8c00', '#e53935'] }],
      },
      scales: [{
        properties: { dataColors: { primaryColor: '#1e88e5' } },
      }],
    }),
  }],
});
```

## Printing & Export

### Export to PDF (via API)
```javascript
// Qlik Cloud
const response = await fetch(`https://tenant.qlikcloud.com/api/v1/apps/${appId}/objects/${objectId}/export/pdf`, {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + apiKey },
});
const pdfUrl = response.headers.get('Location');
```

### Export Data to CSV
```javascript
const object = await app.getObject('OBJECT_ID');
const data = await object.exportData('CSV_C', '/qHyperCubeDef');
// data.qUrl contains the download URL
```

## Error Handling

```javascript
// Handle WebSocket disconnects
session.on('closed', () => {
  console.warn('Qlik session closed — reconnecting...');
  // Implement reconnection logic
});

session.on('suspended', (evt) => {
  console.warn('Session suspended:', evt.code);
  if (evt.code === 4003) {
    // Session expired — re-authenticate
  }
});

// Handle missing objects
try {
  await nebula.render({ element: el, id: objectId });
} catch (err) {
  el.innerHTML = '<p>Visualization unavailable</p>';
  console.error('Failed to render:', err);
}
```

## Security Considerations

1. **Always use HTTPS** for embedded content
2. **Web Integration IDs** restrict which domains can embed
3. **CSP headers** must allow Qlik tenant as frame source
4. **API keys** should be scoped to minimum required permissions
5. **JWT tokens** should have short expiry (15-30 min)
6. **Never expose API keys** in client-side JavaScript
