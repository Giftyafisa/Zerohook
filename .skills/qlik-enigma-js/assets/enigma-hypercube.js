/**
 * Node.js script to extract raw data from a Qlik App using enigma.js
 * 
 * Prerequisites:
 * npm install enigma.js ws
 */
const enigma = require('enigma.js');
const schema = require('enigma.js/schemas/12.1657.0.json');
const WebSocket = require('ws');

// Configuration
const TENANT_URL = 'your-tenant.us.qlikcloud.com';
const API_KEY = 'YOUR_API_KEY_HERE';
const APP_ID = 'your-app-id-here';

async function extractData() {
  const url = `wss://${TENANT_URL}/app/${APP_ID}`;

  // 1. Create enigma session
  const session = enigma.create({
    schema,
    url,
    createSocket: url => new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    })
  });

  try {
    // 2. Open the global engine and the document (app)
    const global = await session.open();
    const app = await global.openDoc(APP_ID);
    console.log(`Connected to app: ${APP_ID}`);

    // 3. Define the HyperCube (Data Table)
    const cubeDef = {
      qInfo: { qType: 'extract-cube' },
      qHyperCubeDef: {
        qDimensions: [
          { qDef: { qFieldDefs: ['Region'] } },
          { qDef: { qFieldDefs: ['Category'] } }
        ],
        qMeasures: [
          { qDef: { qDef: 'Sum(Sales)' } },
          { qDef: { qDef: 'Sum(Profit)' } }
        ],
        qInitialDataFetch: [
          { qTop: 0, qLeft: 0, qWidth: 4, qHeight: 1000 }
        ]
      }
    };

    // 4. Create the Session Object
    const qObject = await app.createSessionObject(cubeDef);

    // 5. Get the layout (which triggers the data fetch defined above)
    const layout = await qObject.getLayout();
    const matrix = layout.qHyperCube.qDataPages[0].qMatrix;

    console.log(`\nExtracted ${matrix.length} rows:\n`);
    
    // Print Header
    console.log('Region\tCategory\tSales\tProfit');
    console.log('------------------------------------------------');

    // 6. Iterate and parse the data matrix
    matrix.forEach(row => {
      const region = row[0].qText;
      const category = row[1].qText;
      const sales = row[2].qNum; // Using qNum to get the raw float value
      const profit = row[3].qNum;

      console.log(`${region}\t${category}\t${sales.toFixed(2)}\t${profit.toFixed(2)}`);
    });

    // Clean up
    await app.destroySessionObject(qObject.id);

  } catch (err) {
    console.error('Error extracting data:', err);
  } finally {
    // Always close the session to avoid lingering WebSockets
    await session.close();
  }
}

extractData();
