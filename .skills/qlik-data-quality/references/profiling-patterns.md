# Data Profiling Patterns

## Field Profiling

Generate a complete profile of any field — cardinality, min/max, distribution, and patterns.

### Universal Field Profiler
```qlik
SUB ProfileField(vTableName, vFieldName)
    TRACE [PROFILE] $(vTableName).$(vFieldName);
    
    _Profile:
    LOAD
        Count([$(vFieldName)]) as TotalValues,
        Count(DISTINCT [$(vFieldName)]) as UniqueValues,
        Count(If(IsNull([$(vFieldName)]), 1)) as NullCount,
        Count(If(Len(Trim([$(vFieldName)])) = 0, 1)) as EmptyCount,
        Min([$(vFieldName)]) as MinValue,
        Max([$(vFieldName)]) as MaxValue,
        Avg(If(IsNum([$(vFieldName)]), [$(vFieldName)])) as AvgValue,
        Median(If(IsNum([$(vFieldName)]), [$(vFieldName)])) as MedianValue,
        Stdev(If(IsNum([$(vFieldName)]), [$(vFieldName)])) as StdDev,
        Min(Len([$(vFieldName)])) as MinLength,
        Max(Len([$(vFieldName)])) as MaxLength,
        Avg(Len([$(vFieldName)])) as AvgLength
    RESIDENT [$(vTableName)];
    
    LET vTotal = Peek('TotalValues', 0, '_Profile');
    LET vUnique = Peek('UniqueValues', 0, '_Profile');
    LET vNulls = Peek('NullCount', 0, '_Profile');
    LET vMin = Peek('MinValue', 0, '_Profile');
    LET vMax = Peek('MaxValue', 0, '_Profile');
    
    TRACE [PROFILE]   Total: $(vTotal) | Unique: $(vUnique) | Nulls: $(vNulls);
    TRACE [PROFILE]   Min: $(vMin) | Max: $(vMax);
    
    DROP TABLE _Profile;
END SUB
```

### Frequency Distribution (Top N)
```qlik
SUB TopValues(vTableName, vFieldName, vTopN)
    _TopN:
    LOAD
        [$(vFieldName)] as Value,
        Count(*) as Frequency
    RESIDENT [$(vTableName)]
    GROUP BY [$(vFieldName)]
    ORDER BY Count(*) DESC;
    
    TRACE [PROFILE] Top $(vTopN) values for $(vFieldName):;
    
    LET vRows = If(NoOfRows('_TopN') < $(vTopN), NoOfRows('_TopN'), $(vTopN));
    FOR vI = 0 TO vRows - 1
        LET vVal = Peek('Value', vI, '_TopN');
        LET vFreq = Peek('Frequency', vI, '_TopN');
        TRACE [PROFILE]   $(vVal): $(vFreq);
    NEXT vI
    
    DROP TABLE _TopN;
END SUB

CALL TopValues('Orders', 'Region', 10);
```

## Pattern Detection

### Detect Value Patterns (Regex-Like)
```qlik
// Classify field values by pattern
_Patterns:
LOAD
    [PhoneNumber],
    If(WildMatch([PhoneNumber], '+*'), 'International',
       If(WildMatch([PhoneNumber], '(*)*'), 'US-Format',
          If(Len([PhoneNumber]) = 10 AND IsNum([PhoneNumber]), 'Plain-10',
             'Other'))) as PhonePattern
RESIDENT Customers;

_PatternSummary:
LOAD
    PhonePattern,
    Count(*) as PatternCount
RESIDENT _Patterns
GROUP BY PhonePattern;

// Log results
LET vRows = NoOfRows('_PatternSummary');
TRACE [PROFILE] Phone number patterns:;
FOR vI = 0 TO vRows - 1
    LET vPat = Peek('PhonePattern', vI, '_PatternSummary');
    LET vCnt = Peek('PatternCount', vI, '_PatternSummary');
    TRACE [PROFILE]   $(vPat): $(vCnt);
NEXT vI

DROP TABLES _Patterns, _PatternSummary;
```

## Cardinality Analysis

### High-Cardinality Field Detection
```qlik
SUB FindHighCardinality(vTableName, vThresholdPct)
    LET vRowCount = NoOfRows('$(vTableName)');
    LET vFieldCount = NoOfFields('$(vTableName)');
    
    TRACE [PROFILE] High cardinality fields in $(vTableName) (>$(vThresholdPct)% unique):;
    
    FOR vF = 1 TO vFieldCount
        LET vFieldName = FieldName(vF, '$(vTableName)');
        LET vCardinality = FieldValueCount('$(vFieldName)');
        LET vPct = Round(vCardinality / vRowCount * 100, 0.1);
        
        IF vPct > $(vThresholdPct) THEN
            TRACE [PROFILE]   $(vFieldName): $(vCardinality) unique values ($(vPct)%);
        END IF
    NEXT vF
END SUB

// Fields with >50% unique values are candidates for Autonumber or removal
CALL FindHighCardinality('FactSales', 50);
```

## Data Freshness Check
```qlik
SUB CheckFreshness(vTableName, vDateField, vMaxAgeDays)
    _Fresh:
    LOAD Max([$(vDateField)]) as LatestDate RESIDENT [$(vTableName)];
    
    LET vLatest = Peek('LatestDate', 0, '_Fresh');
    LET vAge = Floor(Today() - vLatest);
    DROP TABLE _Fresh;
    
    IF vAge > $(vMaxAgeDays) THEN
        TRACE [QUALITY] STALE DATA: $(vTableName).$(vDateField) latest is $(vLatest) ($(vAge) days old, max=$(vMaxAgeDays));
    ELSE
        TRACE [QUALITY] $(vTableName).$(vDateField) is fresh: $(vLatest) ($(vAge) days old);
    END IF
END SUB

CALL CheckFreshness('Orders', 'OrderDate', 7);
```

## Full Table Profile Report
```qlik
SUB ProfileTable(vTableName)
    LET vRows = NoOfRows('$(vTableName)');
    LET vFields = NoOfFields('$(vTableName)');
    
    TRACE ============================================;
    TRACE DATA PROFILE: $(vTableName);
    TRACE Rows: $(vRows) | Fields: $(vFields);
    TRACE ============================================;
    
    FOR vF = 1 TO vFields
        LET vFieldName = FieldName(vF, '$(vTableName)');
        LET vCardinality = FieldValueCount('$(vFieldName)');
        
        _FP:
        LOAD
            Count(If(IsNull([$(vFieldName)]), 1)) as Nulls,
            Min(Len([$(vFieldName)])) as MinLen,
            Max(Len([$(vFieldName)])) as MaxLen
        RESIDENT [$(vTableName)];
        
        LET vNulls = Peek('Nulls', 0, '_FP');
        LET vMinLen = Peek('MinLen', 0, '_FP');
        LET vMaxLen = Peek('MaxLen', 0, '_FP');
        DROP TABLE _FP;
        
        LET vNullPct = If(vRows > 0, Round(vNulls / vRows * 100, 0.1), 0);
        LET vCardPct = If(vRows > 0, Round(vCardinality / vRows * 100, 0.1), 0);
        
        TRACE   $(vFieldName): unique=$(vCardinality)($(vCardPct)%) nulls=$(vNulls)($(vNullPct)%) len=$(vMinLen)-$(vMaxLen);
    NEXT vF
    
    TRACE ============================================;
END SUB

CALL ProfileTable('Customers');
```
