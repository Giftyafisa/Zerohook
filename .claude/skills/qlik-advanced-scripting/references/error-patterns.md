# Error Handling Patterns in Qlik

## ErrorMode Settings

```qlik
SET ErrorMode = 0;  // Continue on error (log and proceed)
SET ErrorMode = 1;  // Default — stop on error
SET ErrorMode = 2;  // Stop on all errors AND warnings
```

## Basic Error Check

```qlik
SET ErrorMode = 0;

LOAD * FROM [lib://Data/might_not_exist.csv]
(txt, utf8, embedded labels, delimiter is ',');

IF ScriptError > 0 THEN
    TRACE ERROR: $(ScriptErrorDetails);
ELSE
    TRACE Success: loaded data;
END IF

SET ErrorMode = 1;
```

## Try/Catch Pattern

```qlik
SUB TryLoad(vSource, vFallback, vTableName)
    SET ErrorMode = 0;
    
    [$(vTableName)]:
    LOAD * FROM [$(vSource)];
    
    IF ScriptError > 0 THEN
        LET vErr = ScriptErrorDetails;
        TRACE [WARN] Primary failed for $(vTableName): $(vErr);
        
        IF Len('$(vFallback)') > 0 THEN
            [$(vTableName)]:
            LOAD * FROM [$(vFallback)] (qvd);
            
            IF ScriptError > 0 THEN
                TRACE [FATAL] Fallback also failed for $(vTableName);
            ELSE
                TRACE [INFO] $(vTableName) loaded from fallback;
            END IF
        END IF
    ELSE
        TRACE [INFO] $(vTableName) loaded from primary source;
    END IF
    
    SET ErrorMode = 1;
END SUB
```

## File Existence Check (Prevent Errors)

```qlik
// Check before loading
LET vFile = 'lib://QVD/data.qvd';
LET vExists = IF(FileSize('$(vFile)') > 0, 1, 0);

IF vExists = 1 THEN
    LOAD * FROM [$(vFile)] (qvd);
ELSE
    TRACE File does not exist: $(vFile);
END IF
```

## Table Existence Check

```qlik
// Check if a table was loaded before operating on it
IF NOT IsNull(TableNumber('MyTable')) THEN
    LET vRows = NoOfRows('MyTable');
    TRACE MyTable exists with $(vRows) rows;
ELSE
    TRACE MyTable does not exist;
END IF
```

## Safe DROP

```qlik
SUB DropIfExists(vTableName)
    IF NOT IsNull(TableNumber('$(vTableName)')) THEN
        DROP TABLE [$(vTableName)];
    END IF
END SUB

CALL DropIfExists('_TempTable');
CALL DropIfExists('_StagingData');
```

## Validation Pattern

```qlik
SUB ValidateLoad(vTableName, vMinRows, vRequiredFields)
    LET vRows = NoOfRows('$(vTableName)');
    LET vValid = 1;
    
    // Check row count
    IF vRows < $(vMinRows) THEN
        TRACE [VALIDATION FAIL] $(vTableName): $(vRows) rows < minimum $(vMinRows);
        LET vValid = 0;
    END IF
    
    // Check required fields exist
    FOR EACH vField IN $(vRequiredFields)
        LET vFieldExists = 0;
        FOR vF = 1 TO NoOfFields('$(vTableName)')
            IF FieldName(vF, '$(vTableName)') = '$(vField)' THEN
                LET vFieldExists = 1;
            END IF
        NEXT vF
        
        IF vFieldExists = 0 THEN
            TRACE [VALIDATION FAIL] $(vTableName): Missing field $(vField);
            LET vValid = 0;
        END IF
    NEXT vField
    
    IF vValid = 1 THEN
        TRACE [VALIDATION OK] $(vTableName): $(vRows) rows, all fields present;
    END IF
END SUB

CALL ValidateLoad('Customers', 100, 'CustomerID', 'CustomerName', 'Region');
```

## Reload Summary Pattern

```qlik
// At the end of the script, summarize all loaded tables
TRACE ====================================;
TRACE RELOAD SUMMARY;
TRACE ====================================;

LET vTableCount = NoOfTables();
FOR vT = 0 TO vTableCount - 1
    LET vTName = TableName(vT);
    LET vTRows = NoOfRows('$(vTName)');
    LET vTFields = NoOfFields('$(vTName)');
    TRACE   $(vTName): $(vTRows) rows, $(vTFields) fields;
NEXT vT

LET vEnd = Now();
TRACE ====================================;
TRACE Reload completed at $(vEnd);
TRACE ====================================;
```

## Error Escalation

```qlik
// Track errors and fail at the end if any occurred
LET vErrorCount = 0;

SET ErrorMode = 0;

// Load 1
LOAD * FROM [lib://Data/file1.csv] (txt, utf8, embedded labels, delimiter is ',');
IF ScriptError > 0 THEN
    LET vErrorCount = vErrorCount + 1;
    TRACE ERROR loading file1: $(ScriptErrorDetails);
END IF

// Load 2
LOAD * FROM [lib://Data/file2.csv] (txt, utf8, embedded labels, delimiter is ',');
IF ScriptError > 0 THEN
    LET vErrorCount = vErrorCount + 1;
    TRACE ERROR loading file2: $(ScriptErrorDetails);
END IF

SET ErrorMode = 1;

// Final check
IF vErrorCount > 0 THEN
    TRACE FATAL: $(vErrorCount) errors occurred during reload;
    // Force a failure so the reload shows as "Failed" in QMC/Cloud
    EXIT SCRIPT;
END IF
```
