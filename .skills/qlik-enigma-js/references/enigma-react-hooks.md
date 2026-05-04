# Using enigma.js with React (Custom Hooks)

When building a custom web application using React and enigma.js, the biggest challenge is managing the asynchronous WebSocket connection and ensuring components re-render when the Qlik Engine state changes.

## 1. The Global Qlik Context

Instead of creating a new WebSocket connection for every component, create a global context that holds the active enigma `app` session.

```tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import enigma from 'enigma.js';
import schema from 'enigma.js/schemas/12.1657.0.json';

const QlikContext = createContext<any>(null);

export const QlikProvider = ({ children }) => {
  const [app, setApp] = useState(null);

  useEffect(() => {
    const session = enigma.create({
      schema,
      url: `wss://your-tenant.qlikcloud.com/app/your-app-id`,
      createSocket: url => new WebSocket(url, {
        headers: { 'Authorization': 'Bearer YOUR_API_KEY' }
      }),
    });

    session.open().then(global => {
      global.openDoc('your-app-id').then(qApp => {
        setApp(qApp);
      });
    });

    return () => { session.close(); };
  }, []);

  if (!app) return <div>Connecting to Qlik Engine...</div>;

  return (
    <QlikContext.Provider value={app}>
      {children}
    </QlikContext.Provider>
  );
};

export const useQlik = () => useContext(QlikContext);
```

## 2. The Custom Hook: `useHyperCube`

To render data (e.g., a custom D3 or Recharts bar chart), you need a hook that creates a Session Object, fetches the initial data, and listens for changes (e.g., when the user filters data elsewhere in the app).

```tsx
import { useState, useEffect } from 'react';
import { useQlik } from './QlikProvider';

export function useHyperCube(dimensions: string[], measures: string[]) {
  const app = useQlik();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!app) return;

    let qObject: any = null;

    const createCube = async () => {
      setLoading(true);
      
      const qDimensions = dimensions.map(d => ({ qDef: { qFieldDefs: [d] } }));
      const qMeasures = measures.map(m => ({ qDef: { qDef: m } }));

      // Create the generic object in the engine
      qObject = await app.createSessionObject({
        qInfo: { qType: 'custom-cube' },
        qHyperCubeDef: {
          qDimensions,
          qMeasures,
          qInitialDataFetch: [{ qTop: 0, qLeft: 0, qHeight: 100, qWidth: dimensions.length + measures.length }]
        }
      });

      // Define the update function
      const updateData = async () => {
        const layout = await qObject.getLayout();
        const matrix = layout.qHyperCube.qDataPages[0].qMatrix;
        
        // Parse the matrix into a friendly JSON array for React charts
        const parsed = matrix.map(row => {
          const item: any = {};
          dimensions.forEach((dim, i) => { item[dim] = row[i].qText; });
          measures.forEach((meas, i) => { item[meas] = row[dimensions.length + i].qNum; });
          return item;
        });
        
        setData(parsed);
        setLoading(false);
      };

      // 1. Initial fetch
      await updateData();

      // 2. Listen for changes (e.g., selections)
      qObject.on('changed', updateData);
    };

    createCube();

    // Cleanup: Destroy the session object when the component unmounts
    return () => {
      if (qObject) {
        app.destroySessionObject(qObject.id);
      }
    };
  }, [app, dimensions.join(','), measures.join(',')]);

  return { data, loading };
}
```

## 3. Using the Hook in a Component

Now, any React component can easily fetch live Qlik data and render a custom UI.

```tsx
import React from 'react';
import { useHyperCube } from './hooks/useHyperCube';

export const SalesByRegionList = () => {
  // Use our custom hook to fetch Region and Sum(Sales)
  const { data, loading } = useHyperCube(['Region'], ['Sum(Sales)']);

  if (loading) return <div>Loading data...</div>;

  return (
    <ul>
      {data.map((row, i) => (
        <li key={i}>
          <strong>{row['Region']}:</strong> ${row['Sum(Sales)'].toFixed(2)}
        </li>
      ))}
    </ul>
  );
};
```
