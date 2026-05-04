---
name: qlik-enigma-js
description: >
  Build custom web applications communicating directly with the Qlik Engine
  via WebSockets using enigma.js. Covers session creation, opening documents,
  creating session objects (hypercubes, list objects), calculating dynamic
  expressions, and rendering raw data. Use when building headless BI,
  custom React/Angular frontends, or server-side automation scripts.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-development
---

# Qlik Engine API via enigma.js

## When to Use

- User wants to build a custom React/Angular/Vue dashboard powered by Qlik data
- User mentions "enigma.js" or "Engine API"
- User wants to extract raw data/hypercubes from a Qlik app via JavaScript
- User wants to automate a script that interacts with the Qlik engine directly
- User asks how to communicate with Qlik without using iframes or the standard UI

## What is enigma.js?

`enigma.js` is an open-source JavaScript library by Qlik. It acts as a wrapper around the Qlik Engine JSON API (WebSocket). It translates standard JavaScript Promises into the JSON-RPC messages required to speak to the Qlik Engine.

It does **not** render charts (that is `nebula.js` or Qlik Sense UI). It only fetches raw data, metadata, and calculates expressions.

## Basic Setup (Node.js)

```bash
npm install enigma.js ws
```

### 1. Connecting to the Engine (Cloud / Desktop)
```javascript
const enigma = require('enigma.js');
const schema = require('enigma.js/schemas/12.1657.0.json'); // Standard schema
const WebSocket = require('ws');

// Qlik Desktop URL: 'ws://localhost:4848/app/engineData'
// Qlik Cloud URL: 'wss://your-tenant.qlikcloud.com/app/' + appId
const session = enigma.create({
  schema,
  url: 'ws://localhost:4848/app/engineData',
  createSocket: url => new WebSocket(url, {
    headers: {
      // For Qlik Cloud, you must pass an API key
      // 'Authorization': 'Bearer YOUR_API_KEY'
    }
  }),
});
```

### 2. Opening an App
Once connected, open a document (app) to interact with it.

```javascript
async function runApp() {
  // 1. Connect to global engine
  const global = await session.open();
  
  // 2. Open specific app
  const app = await global.openDoc('Sales_Dashboard.qvf');
  
  console.log('App opened:', await app.getAppProperties());
  
  // Clean up
  await session.close();
}
```

## Evaluating Simple Expressions

If you just need to calculate a number (e.g., total sales) without rendering a chart:

```javascript
// Calculate a dynamic expression against the current data model
const reply = await app.evaluateEx('Sum({<Year={2024}>} Sales)');
console.log('Sales 2024:', reply.qValue.qText); // e.g., "$1,200.50"
console.log('Raw number:', reply.qValue.qNumber); // e.g., 1200.5
```

## Working with Data (HyperCubes)

To get tabular data (like a bar chart or straight table), you create a **Session Object** containing a `qHyperCubeDef`.

A HyperCube defines dimensions, measures, and how much data to fetch.

### Creating a HyperCube
```javascript
const cubeDef = {
  qInfo: { qType: 'my-cube' },
  qHyperCubeDef: {
    qDimensions: [
      { qDef: { qFieldDefs: ['Region'] } }
    ],
    qMeasures: [
      { qDef: { qDef: 'Sum(Sales)' } }
    ],
    qInitialDataFetch: [
      { qTop: 0, qLeft: 0, qWidth: 2, qHeight: 100 } // Fetch 100 rows, 2 columns
    ]
  }
};

// Create the object in the engine memory
const object = await app.createSessionObject(cubeDef);

// Retrieve the layout (which contains the data defined in qInitialDataFetch)
const layout = await object.getLayout();

// Parse the data matrix
const dataPages = layout.qHyperCube.qDataPages[0].qMatrix;
dataPages.forEach(row => {
  const region = row[0].qText;
  const sales = row[1].qText;
  console.log(`Region: ${region}, Sales: ${sales}`);
});
```

## Making Selections

Selections made via enigma.js affect the engine state immediately. If you have an active HyperCube, its data will update.

```javascript
// 1. Get a handle to a specific field
const field = await app.getField('Region');

// 2. Select values (true = toggle state)
await field.selectValues([
  { qText: 'North' },
  { qText: 'South' }
], false, false);

console.log('Selections applied!');

// 3. Clear selections
await field.clear();
// or clear everything in the app:
await app.clearAll();
```

## Real-Time Data Binding (Reactivity)

The true power of WebSockets is that the Qlik Engine will notify your code when the data changes (e.g., because the user clicked a filter or the app reloaded).

```javascript
// Listen to the "changed" event on the object we created earlier
object.on('changed', async () => {
  console.log('Engine state changed! Fetching new data...');
  const newLayout = await object.getLayout();
  // Update your React/Vue state with newLayout
});
```

## QSEoW Authentication (Certificates)

If running an enigma.js script against Qlik Sense Enterprise on Windows (On-Premise) from a backend Node.js server, you must pass the Qlik client certificates.

```javascript
const https = require('https');
const fs = require('fs');

const certPath = 'C:/ProgramData/Qlik/Sense/Repository/Exported Certificates/.Local Certificates/';

const session = enigma.create({
  schema,
  url: 'wss://qlik-server.local:4747/app/', // Note port 4747 for Engine API
  createSocket: url => new WebSocket(url, {
    ca: [fs.readFileSync(certPath + 'root.pem')],
    key: fs.readFileSync(certPath + 'client_key.pem'),
    cert: fs.readFileSync(certPath + 'client.pem'),
    headers: {
      'X-Qlik-User': 'UserDirectory=INTERNAL;UserId=sa_api'
    }
  })
});
```

[See references/enigma-react-hooks.md for React implementation patterns]
[See assets/enigma-hypercube.js for a complete data extraction script]
