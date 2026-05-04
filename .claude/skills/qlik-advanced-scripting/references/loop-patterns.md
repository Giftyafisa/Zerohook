# Loop Patterns in Qlik

## FOR Loop — Numeric Range

```qlik
// Basic counting loop
FOR vI = 1 TO 10
    TRACE Iteration $(vI);
NEXT vI

// With step
FOR vYear = 2020 TO 2024 STEP 1
    TRACE Year: $(vYear);
NEXT vYear

// Countdown
FOR vI = 10 TO 1 STEP -1
    TRACE Countdown: $(vI);
NEXT vI
```

## FOR EACH — Iterating Lists

### Comma-Separated Values
```qlik
FOR EACH vTable IN 'Customers', 'Orders', 'Products'
    [$(vTable)]: LOAD * FROM [lib://QVD/$(vTable).qvd] (qvd);
NEXT vTable
```

### File List (Wildcard)
```qlik
// All QVDs in a folder
FOR EACH vFile IN FileList('lib://QVD/*.qvd')
    LET vName = SubField(SubField('$(vFile)', '/', -1), '.', 1);
    [$(vName)]: LOAD * FROM [$(vFile)] (qvd);
NEXT vFile

// All CSVs matching a pattern
FOR EACH vFile IN FileList('lib://Data/sales_*.csv')
    CONCATENATE(AllSales) LOAD * FROM [$(vFile)]
    (txt, utf8, embedded labels, delimiter is ',');
NEXT vFile
```

### Directory List
```qlik
// Iterate subfolders
FOR EACH vDir IN DirList('lib://Data/*')
    TRACE Found directory: $(vDir);
NEXT vDir
```

### Field Value List
```qlik
// Iterate over distinct values of a loaded field
FOR EACH vRegion IN FieldValueList('Region')
    _RegionExport:
    NOCONCATENATE LOAD * RESIDENT AllData WHERE Region = '$(vRegion)';
    STORE _RegionExport INTO [lib://Export/data_$(vRegion).qvd] (qvd);
    DROP TABLE _RegionExport;
NEXT vRegion
```

## DO WHILE / DO UNTIL

### DO WHILE (Check Before Each Iteration)
```qlik
LET vCounter = 0;
DO WHILE vCounter < 5
    LET vCounter = vCounter + 1;
    TRACE Counter: $(vCounter);
LOOP
```

### DO UNTIL (Check After Each Iteration)
```qlik
LET vPage = 0;
DO
    LET vPage = vPage + 1;
    // Load page
    _Page: LOAD * FROM [lib://API/data?page=$(vPage)] (qvd);
    LET vRows = NoOfRows('_Page');
    
    IF vRows > 0 THEN
        CONCATENATE(AllData) LOAD * RESIDENT _Page;
    END IF
    DROP TABLE _Page;
LOOP UNTIL vRows = 0 OR vPage > 100
```

## Pattern: Iterate Table Rows

```qlik
// Use Peek() to read each row of a config/metadata table
_Config:
LOAD * INLINE [
    Source, Target, KeyField
    customers.csv, Customers, CustomerID
    orders.csv, Orders, OrderID
];

LET vRows = NoOfRows('_Config');
FOR vI = 0 TO vRows - 1
    LET vSource = Peek('Source', vI, '_Config');
    LET vTarget = Peek('Target', vI, '_Config');
    LET vKey = Peek('KeyField', vI, '_Config');
    
    TRACE Loading $(vTarget) from $(vSource) (key=$(vKey));
    [$(vTarget)]: LOAD * FROM [lib://Data/$(vSource)]
    (txt, utf8, embedded labels, delimiter is ',');
NEXT vI

DROP TABLE _Config;
```

## Pattern: Batch Processing

```qlik
// Process data in batches of N rows
LET vBatchSize = 10000;
LET vTotalRows = NoOfRows('LargeTable');
LET vBatches = Ceil(vTotalRows / vBatchSize);

FOR vBatch = 1 TO vBatches
    LET vStart = (vBatch - 1) * vBatchSize;
    LET vEnd = vStart + vBatchSize - 1;
    
    TRACE Processing batch $(vBatch)/$(vBatches) (rows $(vStart)-$(vEnd));
    
    _Batch:
    LOAD * RESIDENT LargeTable WHERE RecNo() >= $(vStart) AND RecNo() <= $(vEnd);
    
    // Process batch...
    
    DROP TABLE _Batch;
NEXT vBatch
```

## Pattern: Dynamic Table Union

```qlik
// Combine all monthly files into one table
LET vFirst = 1;
FOR EACH vFile IN FileList('lib://Data/sales_2024_*.csv')
    IF vFirst = 1 THEN
        AllSales:
        LOAD * FROM [$(vFile)] (txt, utf8, embedded labels, delimiter is ',');
        LET vFirst = 0;
    ELSE
        CONCATENATE(AllSales)
        LOAD * FROM [$(vFile)] (txt, utf8, embedded labels, delimiter is ',');
    END IF
NEXT vFile
```

## Safety: Preventing Infinite Loops

```qlik
LET vMaxIterations = 1000;
LET vIteration = 0;

DO WHILE vCondition = 1
    LET vIteration = vIteration + 1;
    
    IF vIteration > vMaxIterations THEN
        TRACE ERROR: Max iterations reached. Breaking loop.;
        EXIT DO;
    END IF
    
    // ... loop body ...
LOOP
```
