# Impact Analysis Guide

## When You Need Impact Analysis

- Renaming or removing a field from a source table
- Changing a data connection or QVD path
- Modifying a transformation (calculation, mapping, filter)
- Dropping a table from the data model
- Changing a key field name

## Systematic Impact Analysis Process

### Step 1: Identify the Change

Document exactly what is changing:

```
Change: Rename field "CustomerName" to "Customer_Name" in CRM source
Scope: dbo.Customers table
```

### Step 2: Trace Forward (Source → Consumers)

Find everything downstream of the change:

```
dbo.Customers.CustomerName
  ↓ (loaded by)
ETL_Extract_CRM → customers_raw.qvd [CustomerName field]
  ↓ (loaded by)
ETL_Transform → dim_customers.qvd [CustomerName field]
  ↓ (loaded by)
Sales Dashboard [CustomerName field]
Finance Report [CustomerName field]
Executive Summary [CustomerName field]
  ↓ (used in)
Master Dimension: "Customer"
Charts: "Top 10 Customers", "Customer Revenue Table"
Set Analysis: {<CustomerName={"*Corp*"}>}
Variables: vSelectedCustomer
```

### Step 3: Assess Impact

| Affected Item | Impact | Action Needed |
|---|---|---|
| ETL_Extract script | LOAD statement references old name | Update field name or add alias |
| customers_raw.qvd | Field name changes | Regenerate QVD |
| ETL_Transform script | References CustomerName | Update or alias |
| dim_customers.qvd | Field name changes | Regenerate QVD |
| Sales Dashboard | Loads CustomerName | Update script if explicit field list |
| Master Dimension | Uses CustomerName | Update definition |
| Charts | Dimension = CustomerName | May auto-update if master item is fixed |
| Set Analysis | Hardcoded field name | Must update expressions |

### Step 4: Plan the Migration

```
1. Update ETL_Extract: Add alias (CustomerName as Customer_Name) — OR rename
2. Reload ETL_Extract → new QVDs
3. Update ETL_Transform references
4. Reload ETL_Transform → new transformed QVDs
5. Update each presentation app:
   a. Script field references
   b. Master items
   c. Expressions with hardcoded field names
   d. Set analysis references
   e. Variables
6. Reload all presentation apps
7. Test all affected charts
```

## Using MCP Tools for Impact Analysis

### Find All Apps Using a Field
```
For each app:
  get_available_fields(appId) → Check if field exists
  get_script(appId) → Search for field name in script text
```

### Find All Expressions Using a Field
```
For each app:
  get_master_items(appId) → Search measures/dimensions for field
  get_sheet_layouts(appId) → Search chart expressions for field
  get_variables(appId) → Search variable definitions for field
```

### Automated Script Search Pattern
```javascript
// Using execute_script MCP tool to search across apps
const apps = await qlik.client.get('/api/v1/items?resourceType=app&limit=100');

for (const app of apps.data.data) {
  const script = await qlik.engine.withDoc(app.resourceId, async (doc) => {
    return await doc.getScript();
  });
  
  if (script.includes('CustomerName')) {
    console.log(`Found in: ${app.name} (${app.resourceId})`);
  }
}
```

## Common Impact Scenarios

### Scenario: Removing a Source Field
```
Impact: All downstream QVDs, apps, expressions lose the field
Risk: HIGH — charts will break with "field not found"
Mitigation: 
  1. Check all consumers first
  2. Add dummy field if needed for backward compatibility
  3. Coordinate with app owners
```

### Scenario: Changing a Key Field Name
```
Impact: All table associations break
Risk: CRITICAL — data model collapses
Mitigation:
  1. Update ALL tables that use the key simultaneously
  2. Test data model (no synthetic keys, no islands)
  3. Verify row counts match before/after
```

### Scenario: Changing a QVD Path
```
Impact: All apps loading from that path fail
Risk: HIGH — reload failures
Mitigation:
  1. Use variables for paths (easy to update in one place)
  2. Keep old QVDs available during transition
  3. Update all consuming apps before removing old path
```

### Scenario: Modifying a Calculation
```
Impact: All downstream measures change values
Risk: MEDIUM — no errors, but numbers change
Mitigation:
  1. Document the before/after calculation
  2. Notify stakeholders of expected value changes
  3. Compare key KPIs before/after
```

## Impact Analysis Checklist

For any data model change:

- [ ] Identified all QVDs affected
- [ ] Identified all apps affected
- [ ] Identified all master items affected
- [ ] Identified all chart expressions affected
- [ ] Identified all variables affected
- [ ] Identified all set analysis references affected
- [ ] Created migration plan with ordered steps
- [ ] Communicated to stakeholders
- [ ] Tested in DEV/TEST before PROD
- [ ] Verified KPIs match expected values after change
- [ ] Updated data dictionary / documentation
