---
name: qlik-migration-guide
description: >
  Strategies and patterns for migrating QlikView to Qlik Sense, and
  Qlik Sense Enterprise on Windows (QSEoW) to Qlik Cloud. Covers script
  conversion, connection remapping, macro replacements, variable handling,
  and UI rebuild methodologies. Use when modernizing legacy Qlik apps.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-migration
---

# Qlik Migration Guide

## When to Use

- User is migrating from QlikView to Qlik Sense
- User is migrating from on-premise Qlik Sense (QSEoW) to Qlik Cloud
- User asks how to convert legacy connection strings to `lib://`
- User asks for alternatives to QlikView macros or triggers
- User needs to rebuild a legacy dashboard

## QlikView to Qlik Sense Migration

### The Migration Process
1. **Lift and Shift (Data Model)**: QlikView scripts and data models are 95% compatible with Qlik Sense. You can drag and drop a `.qvw` file into Qlik Sense Desktop/Cloud to extract the script and data model.
2. **Convert Connections**: Legacy absolute paths must be converted to `lib://` connections.
3. **Rebuild UI**: QlikView front-end objects cannot be automatically converted to Qlik Sense. The UI must be rebuilt.
4. **Replace Macros**: Qlik Sense does not support VBScript macros. Use extensions, variables, or automations instead.

### Script Conversion: Data Connections

**Legacy QlikView (Absolute/Relative Paths):**
```qlik
// ❌ Not supported in standard Qlik Sense
LOAD * FROM [C:\QlikData\Sales\orders.csv];
LOAD * FROM [..\Data\customers.qvd] (qvd);
OLEDB CONNECT TO [Provider=SQLOLEDB;...];
```

**Qlik Sense (`lib://` Connections):**
```qlik
// ✅ Standard Qlik Sense pattern
// First, create the connection in the hub/QMC
LOAD * FROM [lib://SalesData/orders.csv] (txt, ...);
LOAD * FROM [lib://QVD_Store/customers.qvd] (qvd);
LIB CONNECT TO 'SQL_Database_Prod';
```

### Script Conversion: Hidden Scripts
QlikView allowed "Hidden Scripts" (often used for section access).
In Qlik Sense, these are just regular script tabs. When migrating a QVW, the hidden script is placed in a tab called `HiddenScript` but is visible to any developer.

### Replacing QlikView Features

| QlikView Feature | Qlik Sense Alternative |
|---|---|
| **VBScript Macros** | Extensions, Qlik Application Automation, Dashboard Bundles (buttons) |
| **Document/Sheet Triggers** | "Button" object actions (navigate, set variable, select) |
| **Input Boxes** | "Variable input" object (Custom Objects → Qlik Dashboard bundle) |
| **Linked Objects** | Master Items (linked across all sheets) |
| **Cyclic Groups** | Alternative Dimensions (in chart properties) |
| **Drill-down Groups** | Master Item Drill-down Dimensions |
| **Trellis Charts** | Trellis container (Custom Objects → Qlik Visualization bundle) |
| **Show/Hide Conditions** | "Show condition" in chart properties or Container object |

## On-Premise (QSEoW) to Qlik Cloud Migration

### Script Changes

Qlik Sense scripts are highly compatible between on-premise and cloud, but there are environment differences.

#### 1. Data Connections
On-premise paths like `lib://C_Drive_Data` must be recreated in Qlik Cloud.
- **Files**: Upload to Qlik Cloud Data Spaces.
- **Databases**: Create Cloud connections or use **Qlik Data Gateway** for behind-firewall databases.

#### 2. Folder Iteration
Qlik Cloud restricts path traversal.
```qlik
// ❌ Cloud blocks relative path traversal for security
FOR EACH vFile in FileList('lib://Data/../Shared/*.qvd')

// ✅ Must use absolute defined connections
FOR EACH vFile in FileList('lib://Shared/*.qvd')
```

#### 3. EXECUTE Commands
```qlik
// ❌ EXECUTE is entirely blocked in Qlik Cloud SaaS
EXECUTE cmd.exe /c "copy A.csv B.csv";

// ✅ Alternative: Use Qlik Application Automation to run external tasks
```

#### 4. REST API Calls
On-premise scripts hitting `localhost` or internal APIs will fail in the cloud unless exposed publicly or via Data Gateway.

### Migration Strategy (On-Prem to Cloud)

1. **Assess via Qlik Cloud Readiness App**: Use the standard Qlik tool to analyze on-prem apps for unsupported features (Extensions, EXECUTE, ODAG).
2. **Setup Spaces**: Map on-prem Streams to Cloud Spaces (Shared/Managed).
3. **Migrate Connections**: Recreate all `lib://` connections in the target Cloud Spaces.
4. **Update Scripts**: Implement environment variables to allow apps to run in both during transition.
5. **Migrate Extensions**: Ensure UI extensions are Cloud-certified and upload them to the Cloud Management Console.

## Dynamic Environment Mapping

To maintain a single script that works in both QlikView/QSEoW (Dev) and Qlik Cloud (Prod):

```qlik
// Detect environment automatically
LET vIsCloud = If(WildMatch(ComputerName(), '*qlikcloud*') OR Len(ComputerName())=0, 1, 0);

IF vIsCloud = 1 THEN
    // Qlik Cloud connections
    SET vDataPath = 'lib://DataFiles';
    SET vQvdPath = 'lib://DataSpace_QVDs';
ELSE
    // On-Premise / QlikView connections
    SET vDataPath = 'lib://Local_Data';
    SET vQvdPath = 'lib://Local_QVD';
    // For QlikView: SET vDataPath = 'C:\Data';
END IF

// Script uses variables
LOAD * FROM [$(vDataPath)/orders.csv] (txt, ...);
```

## UI Rebuild Strategy (DAR Methodology)

When rebuilding from QlikView to Qlik Sense, don't just copy the layout. QlikView apps often have crowded screens. Use the **DAR** methodology:

1. **Dashboard (High-level)**: KPIs, gauges, high-level bar charts. Answers "What is happening?"
2. **Analysis (Interactive)**: Scatter plots, line charts, filtering. Answers "Why is it happening?"
3. **Reporting (Granular)**: Straight tables, pivot tables. Answers "What are the details?"

*Split crowded QlikView tabs into multiple Qlik Sense sheets following this flow.*

[See references/macro-replacements.md for converting triggers and macros]
[See assets/connection-mapper.qlik for automated connection switching]
