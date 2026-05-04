---
name: qlik-advanced-scripting
description: >
  Advanced Qlik scripting patterns: SUB routines, FOR EACH loops, error
  handling, dynamic script generation, parameterized includes, logging
  frameworks, and script modularization. Use when building maintainable,
  reusable, production-grade Qlik load scripts.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-core
---

# Qlik Advanced Scripting

## When to Use

- User needs reusable script components (subroutines, includes)
- User asks about FOR EACH, FOR loops, DO WHILE, or iteration
- User needs error handling, logging, or script debugging patterns
- User wants dynamic script generation or parameterized loads
- User asks about script modularization or code reuse
- User mentions ErrorMode, ScriptError, or ScriptErrorDetails

## Subroutines (SUB / END SUB / CALL)

Subroutines are Qlik's functions — reusable blocks of script code.

### Basic Subroutine
```qlik
SUB LoadTable(vTableName, vFilePath)
    TRACE Loading $(vTableName) from $(vFilePath)...;
    
    [$(vTableName)]:
    LOAD * FROM [$(vFilePath)] (qvd);
    
    LET vRows = NoOfRows('$(vTableName)');
    TRACE $(vTableName): $(vRows) rows loaded;
END SUB

// Call it
CALL LoadTable('Customers', 'lib://QVD/customers.qvd');
CALL LoadTable('Orders', 'lib://QVD/orders.qvd');
CALL LoadTable('Products', 'lib://QVD/products.qvd');
```

### Subroutine with Logic
```qlik
SUB IncrementalLoad(vTableName, vQvdPath, vSourcePath, vDateField)
    LET vQvdFile = '$(vQvdPath)/$(vTableName).qvd';
    LET vQvdExists = IF(FileSize('$(vQvdFile)') > 0, 1, 0);
    
    IF vQvdExists = 1 THEN
        TRACE [$(vTableName)] Incremental mode;
        
        _Existing:
        LOAD * FROM [$(vQvdFile)] (qvd);
        LET vMaxDate = Peek('$(vDateField)', NoOfRows('_Existing') - 1, '_Existing');
        
        _New:
        LOAD * FROM [$(vSourcePath)/$(vTableName).csv]
        (txt, utf8, embedded labels, delimiter is ',')
        WHERE $(vDateField) > '$(vMaxDate)';
        
        IF NoOfRows('_New') > 0 THEN
            CONCATENATE(_Existing) LOAD * RESIDENT _New;
            DROP TABLE _New;
        ELSE
            DROP TABLE _New;
        END IF
        
        STORE _Existing INTO [$(vQvdFile)] (qvd);
        LET vFinalRows = NoOfRows('_Existing');
        TRACE [$(vTableName)] Stored $(vFinalRows) rows;
        DROP TABLE _Existing;
    ELSE
        TRACE [$(vTableName)] Full load (first run);
        
        _Full:
        LOAD * FROM [$(vSourcePath)/$(vTableName).csv]
        (txt, utf8, embedded labels, delimiter is ',');
        
        STORE _Full INTO [$(vQvdFile)] (qvd);
        TRACE [$(vTableName)] Stored $(NoOfRows('_Full')) rows;
        DROP TABLE _Full;
    END IF
END SUB

// Call for each table
CALL IncrementalLoad('Sales', 'lib://QVD', 'lib://Source', 'OrderDate');
CALL IncrementalLoad('Returns', 'lib://QVD', 'lib://Source', 'ReturnDate');
```

### Nested Subroutine Calls
```qlik
SUB LogMessage(vLevel, vMessage)
    LET vTimestamp = Timestamp(Now(), 'YYYY-MM-DD hh:mm:ss');
    TRACE [$(vTimestamp)] [$(vLevel)] $(vMessage);
END SUB

SUB LoadAndValidate(vTable, vPath, vMinRows)
    CALL LogMessage('INFO', 'Loading $(vTable)...');
    
    [$(vTable)]:
    LOAD * FROM [$(vPath)] (qvd);
    
    LET vRows = NoOfRows('$(vTable)');
    
    IF vRows < $(vMinRows) THEN
        CALL LogMessage('WARN', '$(vTable) has only $(vRows) rows (expected >= $(vMinRows))');
    ELSE
        CALL LogMessage('INFO', '$(vTable) loaded: $(vRows) rows');
    END IF
END SUB

CALL LoadAndValidate('Customers', 'lib://QVD/customers.qvd', 100);
```

## FOR / FOR EACH Loops

### FOR Loop (Numeric)
```qlik
// Process years 2020 to 2024
FOR vYear = 2020 TO 2024
    TRACE Processing year $(vYear)...;
    
    _YearData:
    LOAD * FROM [lib://QVD/sales_$(vYear).qvd] (qvd);
    
    CONCATENATE(AllSales) LOAD * RESIDENT _YearData;
    DROP TABLE _YearData;
NEXT vYear
```

### FOR Loop with STEP
```qlik
// Process every other month
FOR vMonth = 1 TO 12 STEP 2
    TRACE Month: $(vMonth);
NEXT vMonth
```

### FOR EACH ... IN (File List)
```qlik
// Load all QVDs from a folder
FOR EACH vFile IN FileList('lib://QVD/*.qvd')
    LET vTableName = SubField(SubField('$(vFile)', '/', -1), '.', 1);
    TRACE Loading $(vTableName) from $(vFile);
    
    [$(vTableName)]:
    LOAD * FROM [$(vFile)] (qvd);
NEXT vFile
```

### FOR EACH ... IN (Comma-Separated List)
```qlik
// Process specific tables
FOR EACH vTable IN 'Customers', 'Orders', 'Products', 'Regions'
    TRACE Processing $(vTable)...;
    
    [$(vTable)]:
    LOAD * FROM [lib://QVD/$(vTable).qvd] (qvd);
    
    LET vRows = NoOfRows('$(vTable)');
    TRACE $(vTable): $(vRows) rows;
NEXT vTable
```

### FOR EACH ... IN (Field Values)
```qlik
// Iterate over distinct values in a field
FOR EACH vRegion IN FieldValueList('Region')
    TRACE Exporting region: $(vRegion);
    
    _RegionData:
    NOCONCATENATE LOAD * RESIDENT AllSales WHERE Region = '$(vRegion)';
    
    STORE _RegionData INTO [lib://Export/sales_$(vRegion).qvd] (qvd);
    DROP TABLE _RegionData;
NEXT vRegion
```

### Nested Loops
```qlik
FOR vYear = 2023 TO 2024
    FOR EACH vRegion IN 'North', 'South', 'East', 'West'
        LET vFile = 'lib://QVD/sales_$(vRegion)_$(vYear).qvd';
        
        IF FileSize('$(vFile)') > 0 THEN
            CONCATENATE(AllSales)
            LOAD *, '$(vRegion)' as Region, $(vYear) as Year
            FROM [$(vFile)] (qvd);
        END IF
    NEXT vRegion
NEXT vYear
```

## DO WHILE / DO UNTIL Loops

```qlik
// Paginated API loading
LET vPage = 1;
LET vHasMore = 1;

DO WHILE vHasMore = 1
    _PageData:
    LOAD * FROM [lib://REST/api?page=$(vPage)] (qvd);
    
    LET vPageRows = NoOfRows('_PageData');
    
    IF vPageRows > 0 THEN
        CONCATENATE(AllData) LOAD * RESIDENT _PageData;
        DROP TABLE _PageData;
        LET vPage = vPage + 1;
    ELSE
        DROP TABLE _PageData;
        LET vHasMore = 0;
    END IF
LOOP

TRACE Loaded $(NoOfRows('AllData')) total rows across $(vPage) pages;
```

## Error Handling

### ErrorMode
```qlik
// ErrorMode controls what happens on errors:
// 0 = Continue on error (log and proceed)
// 1 = Default (stop on error)
// 2 = Stop on all errors including warnings

SET ErrorMode = 0;  // Don't stop on errors

// Attempt a risky operation
_RiskyLoad:
LOAD * FROM [lib://MayNotExist/data.qvd] (qvd);

// Check if it failed
IF ScriptError > 0 THEN
    TRACE ERROR: $(ScriptErrorDetails);
    // Handle the error (load fallback, skip, etc.)
ELSE
    TRACE Load succeeded: $(NoOfRows('_RiskyLoad')) rows;
END IF

SET ErrorMode = 1;  // Restore default
```

### ScriptError & ScriptErrorDetails
```qlik
// After any statement, check:
// ScriptError = 0 means no error
// ScriptError > 0 means error occurred
// ScriptErrorDetails contains the error message

SET ErrorMode = 0;

LOAD * FROM [lib://Data/missing_file.csv]
(txt, utf8, embedded labels, delimiter is ',');

IF ScriptError > 0 THEN
    LET vError = ScriptErrorDetails;
    TRACE File load failed: $(vError);
    
    // Fallback: load from QVD cache
    LOAD * FROM [lib://QVD/cached_data.qvd] (qvd);
    TRACE Loaded from cache instead;
END IF

SET ErrorMode = 1;
```

### Try/Catch Pattern
```qlik
SUB TryLoad(vSource, vFallback, vTableName)
    SET ErrorMode = 0;
    
    [$(vTableName)]:
    LOAD * FROM [$(vSource)];
    
    IF ScriptError > 0 THEN
        TRACE [TryLoad] Primary source failed: $(ScriptErrorDetails);
        
        IF '$(vFallback)' <> '' THEN
            TRACE [TryLoad] Attempting fallback: $(vFallback);
            
            [$(vTableName)]:
            LOAD * FROM [$(vFallback)] (qvd);
            
            IF ScriptError > 0 THEN
                TRACE [TryLoad] FATAL: Fallback also failed: $(ScriptErrorDetails);
            ELSE
                TRACE [TryLoad] Fallback succeeded: $(NoOfRows('$(vTableName)')) rows;
            END IF
        END IF
    ELSE
        TRACE [TryLoad] Success: $(NoOfRows('$(vTableName)')) rows;
    END IF
    
    SET ErrorMode = 1;
END SUB

CALL TryLoad('lib://Source/sales.csv', 'lib://QVD/sales_cache.qvd', 'Sales');
```

## Dynamic Script Generation

### Building SQL Dynamically
```qlik
// Build a field list dynamically
LET vFields = '';
FOR EACH vField IN 'CustomerID', 'Name', 'Region', 'Segment'
    IF Len('$(vFields)') > 0 THEN
        LET vFields = '$(vFields), $(vField)';
    ELSE
        LET vFields = '$(vField)';
    END IF
NEXT vField

TRACE Loading fields: $(vFields);

Customers:
LOAD $(vFields) FROM [lib://Data/customers.qvd] (qvd);
```

### Generating Tables from Metadata
```qlik
// Table-driven loading: a metadata table defines what to load
_LoadConfig:
LOAD * INLINE [
    TableName, SourcePath, KeyField
    Customers, lib://QVD/customers.qvd, CustomerID
    Orders, lib://QVD/orders.qvd, OrderID
    Products, lib://QVD/products.qvd, ProductID
];

LET vConfigRows = NoOfRows('_LoadConfig');

FOR vIdx = 0 TO vConfigRows - 1
    LET vTable = Peek('TableName', vIdx, '_LoadConfig');
    LET vSource = Peek('SourcePath', vIdx, '_LoadConfig');
    LET vKey = Peek('KeyField', vIdx, '_LoadConfig');
    
    TRACE Loading $(vTable) (key: $(vKey)) from $(vSource);
    
    [$(vTable)]:
    LOAD * FROM [$(vSource)] (qvd);
    
    TRACE $(vTable): $(NoOfRows('$(vTable)')) rows;
NEXT vIdx

DROP TABLE _LoadConfig;
```

## Logging Framework

```qlik
// Structured logging with timestamps and levels
SUB Log(vLevel, vComponent, vMessage)
    LET vLogTime = Timestamp(Now(), 'YYYY-MM-DD hh:mm:ss.fff');
    TRACE [$(vLogTime)] [$(vLevel)] [$(vComponent)] $(vMessage);
    
    // Optionally append to a log table
    _LogEntry:
    LOAD
        '$(vLogTime)' as LogTimestamp,
        '$(vLevel)' as LogLevel,
        '$(vComponent)' as LogComponent,
        '$(vMessage)' as LogMessage
    AUTOGENERATE 1;
    
    IF NOT IsNull(TableNumber('_ReloadLog')) THEN
        CONCATENATE(_ReloadLog) LOAD * RESIDENT _LogEntry;
    ELSE
        RENAME TABLE _LogEntry TO _ReloadLog;
    END IF
    
    IF TableNumber('_LogEntry') >= 0 THEN
        DROP TABLE _LogEntry;
    END IF
END SUB

// Usage
CALL Log('INFO', 'Extract', 'Starting data extraction');
CALL Log('WARN', 'Transform', 'Missing values in Region field: 42 rows');
CALL Log('ERROR', 'Load', 'Failed to connect to source database');

// At end of script: store log
// STORE _ReloadLog INTO [lib://Logs/reload_log_$(=Date(Today(),'YYYYMMDD')).qvd] (qvd);
```

## Script Modularization

### INCLUDE / MUST_INCLUDE
```qlik
// Include shared scripts (stored in data connections)
$(MUST_INCLUDE=[lib://Scripts/config.qvs]);
$(MUST_INCLUDE=[lib://Scripts/subroutines.qvs]);
$(MUST_INCLUDE=[lib://Scripts/logging.qvs]);

// INCLUDE silently fails if file missing
// MUST_INCLUDE throws error if file missing
$(INCLUDE=[lib://Scripts/optional_module.qvs]);
```

### Config File Pattern (config.qvs)
```qlik
// config.qvs — shared across all apps
SET vEnvironment = 'PROD';
SET vQvdPath = 'lib://PROD_QVD';
SET vDataPath = 'lib://PROD_Data';
SET vLogPath = 'lib://PROD_Logs';
SET vSseConnection = 'PyTools';
SET DateFormat = 'YYYY-MM-DD';
SET ThousandSep = ',';
SET DecimalSep = '.';
```

### Subroutine Library (subroutines.qvs)
```qlik
// subroutines.qvs — reusable across all apps
SUB LoadQvd(vTable, vPath)
    [$(vTable)]: LOAD * FROM [$(vPath)] (qvd);
    TRACE [LoadQvd] $(vTable): $(NoOfRows('$(vTable)')) rows;
END SUB

SUB StoreQvd(vTable, vPath)
    STORE [$(vTable)] INTO [$(vPath)] (qvd);
    TRACE [StoreQvd] $(vTable): $(NoOfRows('$(vTable)')) rows stored;
END SUB

SUB DropIfExists(vTable)
    IF NOT IsNull(TableNumber('$(vTable)')) THEN
        DROP TABLE [$(vTable)];
        TRACE [DropIfExists] Dropped $(vTable);
    END IF
END SUB
```

## Useful Script Functions

| Function | Purpose | Example |
|---|---|---|
| `NoOfRows('Table')` | Row count of a table | `LET vRows = NoOfRows('Sales');` |
| `NoOfFields('Table')` | Field count | `LET vFields = NoOfFields('Sales');` |
| `FieldName(n, 'Table')` | Nth field name | `LET vName = FieldName(1, 'Sales');` |
| `TableNumber('Table')` | Table index (null if missing) | `IF NOT IsNull(TableNumber('T'))...` |
| `TableName(n)` | Nth table name | `LET vT = TableName(0);` |
| `NoOfTables()` | Total loaded tables | `LET vCount = NoOfTables();` |
| `FileSize('path')` | File size (0 if missing) | `IF FileSize('$(vFile)') > 0 THEN` |
| `FileTime('path')` | File modification time | `LET vMod = FileTime('$(vFile)');` |
| `Peek('Field', Row, 'Table')` | Read a field value | `LET vMax = Peek('Date', -1, 'T');` |
| `FieldValueCount('Field')` | Distinct value count | `LET vUnique = FieldValueCount('Region');` |
| `FieldValue('Field', n)` | Nth distinct value | `LET vVal = FieldValue('Region', 1);` |

[See references/loop-patterns.md for iteration patterns]
[See references/error-patterns.md for error handling strategies]
[See assets/ for reusable script libraries]
