# ODAG Dynamic SQL Patterns

When building an On-Demand App Generation (ODAG) or Dynamic View template app, the core challenge is converting Qlik's selection state into a valid SQL `WHERE` clause that your underlying database understands.

## 1. The Basic IN Clause (Strings)

Qlik's default `$(odag_FieldName)` binding returns a comma-separated list of single-quoted strings: `'A', 'B', 'C'`.

```qlik
// Initialize default (for testing the template app without ODAG)
SET odag_Region = '';

// Build the WHERE clause
LET vWhereRegion = '1=1';

IF Len('$(odag_Region)') > 0 THEN
    // Returns: Region IN ('North', 'South')
    LET vWhereRegion = 'Region IN (' & '$(odag_Region)' & ')';
END IF

// Construct final SQL
LIB CONNECT TO 'SalesDB';

SQL SELECT 
    OrderID, CustomerID, Region, Amount 
FROM Sales.FactOrders
WHERE $(vWhereRegion);
```

## 2. The Numeric IN Clause (Integers)

If your database field is an integer (e.g., `CustomerID INT`), passing `'1001', '1002'` might cause performance issues (implicit conversion) or errors. You need the raw numbers: `1001, 1002`.

```qlik
// Use the active numeric value binding
// Syntax: $(odag_active(odag_numeric_value, FieldName))

SET vActiveCustomers = '$(odag_active(odag_numeric_value, CustomerID))';

LET vWhereCustomer = '1=1';

IF Len(vActiveCustomers) > 0 THEN
    // Returns: CustomerID IN (1001, 1002)
    LET vWhereCustomer = 'CustomerID IN (' & vActiveCustomers & ')';
END IF
```

## 3. Handling Dates and Timestamps

Databases are notoriously picky about date formats in SQL strings. Qlik's ODAG binding will pass whatever string format the user selected. You must cast it to the database's expected format.

### Example: PostgreSQL / SQL Server

```qlik
// Assuming the user selects '2024-01-01', '2024-01-02'
SET odag_OrderDate = '';

LET vWhereDate = '1=1';

IF Len('$(odag_OrderDate)') > 0 THEN
    // We need to loop through the selected dates and cast them
    // E.g., CAST('2024-01-01' AS DATE)
    
    LET vDateList = '$(odag_OrderDate)'; // e.g., '2024-01-01','2024-01-02'
    
    // Replace the simple comma with the casting syntax for the database
    // This turns: '2024-01-01','2024-01-02'
    // Into: CAST('2024-01-01' AS DATE), CAST('2024-01-02' AS DATE)
    LET vDateListCast = Replace(vDateList, ',', ' AS DATE), CAST(');
    LET vDateListCast = 'CAST(' & vDateListCast & ' AS DATE)';
    
    LET vWhereDate = 'OrderDate IN (' & vDateListCast & ')';
END IF
```

## 4. Multi-Field AND/OR Logic

When passing multiple selections, combine them with `AND`.

```qlik
SUB BuildComplexWhere
    LET vWhere = '1=1';
    
    // 1. Region (String)
    IF Len('$(odag_Region)') > 0 THEN
        LET vWhere = vWhere & ' AND Region IN (' & '$(odag_Region)' & ')';
    END IF
    
    // 2. Year (Numeric)
    LET vYears = '$(odag_active(odag_numeric_value, Year))';
    IF Len(vYears) > 0 THEN
        LET vWhere = vWhere & ' AND Year IN (' & vYears & ')';
    END IF
    
    // 3. Category (String)
    IF Len('$(odag_Category)') > 0 THEN
        LET vWhere = vWhere & ' AND Category IN (' & '$(odag_Category)' & ')';
    END IF
    
    // Store result in global variable
    SET vFinalWhere = '$(vWhere)';
END SUB

CALL BuildComplexWhere;

SQL SELECT * FROM Sales WHERE $(vFinalWhere);
```

## 5. Handling Maximum Binding Limits

Most databases have a limit on how many items can be in an `IN (...)` clause (e.g., Oracle limits to 1000). If the user selects 5,000 customers, the query will fail.

**Solution:** Enforce row limits in the ODAG Link settings (in the Selection App). Set the limit expression to `=Count(DISTINCT CustomerID)` and the limit to 1000. This prevents the user from generating the app if they select too many values.

## 6. ODAG Variable States

You can access metadata about the ODAG request:

| Binding | What it returns | Use Case |
|---|---|---|
| `$(odag_request_id)` | `123e4567-e89b...` | Logging the generation request |
| `$(odag_app_id)` | `Template App ID` | Referencing the source template |
| `$(odag_user_id)` | `john.doe` | Audit logging, Row Level Security |

```qlik
// Log the generation request
_OdagLog:
LOAD * INLINE [
    RequestID, User, Timestamp, FilterCount
    '$(odag_request_id)', '$(odag_user_id)', '$(=Now())', '$(odag_CustomerID_count)'
];

// Optional: Store to a QVD for auditing
STORE _OdagLog INTO [lib://Logs/odag_audit.qvd] (qvd);
```
