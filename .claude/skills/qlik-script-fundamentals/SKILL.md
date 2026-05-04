---
name: qlik-script-fundamentals
description: >
  Write correct Qlik load scripts with proper syntax, keywords, and patterns.
  Covers LOAD statements, date parsing, field naming, variables, set analysis,
  mapping loads, resident loads, and script organization. Use when writing or
  reviewing any Qlik script code.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-core
---

# Qlik Script Fundamentals

## When to Use

- User is writing or editing a Qlik load script
- User asks about Qlik syntax, keywords, or functions
- User is loading data from CSV, QVD, Excel, or database sources
- User needs help with date parsing, field naming, or variables
- User is debugging a Qlik script error
- User mentions "Qlik", "load script", "QVS", or "script tab"

## Critical Rule — Qlik Is NOT SQL

**STOP** before writing any Qlik code. Verify you are using Qlik syntax:

| SQL (WRONG) | Qlik (CORRECT) |
|---|---|
| `SELECT * FROM table` | `LOAD * FROM [lib://Data/file.csv]` |
| `INSERT INTO` | Not supported — use `STORE` |
| `UPDATE SET` | Not supported — reload replaces data |
| `DELETE FROM` | Not supported — use `WHERE` to filter |
| `CREATE TABLE` | Table created implicitly by `LOAD` |

## Mandatory Syntax Rules

1. **LOAD not SELECT** — `LOAD Field1, Field2 FROM [lib://Connection/file.ext];`
2. **UPPERCASE keywords** — `LOAD`, `FROM`, `WHERE`, `JOIN`, `RESIDENT`, `DROP`, `LET`, `SET`
3. **Library connections** — Always `[lib://ConnectionName/path/file.ext]`
4. **Date parsing** — Always `Date#(Field, 'YYYY-MM-DD')`, never bare `Date(Field)`
5. **Case-sensitive fields** — `CustomerID` ≠ `customerId` ≠ `CUSTOMERID`
6. **Semicolons** — Every statement ends with `;`
7. **Tab markers** — Use `///$tab TabName` to organize scripts

## Load Statement Patterns

### Basic File Load
```qlik
LOAD
    CustomerID,
    CustomerName,
    Region
FROM [lib://Data/customers.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

### QVD Load (Fastest)
```qlik
LOAD * FROM [lib://QVD/customers.qvd] (qvd);
```

### Excel Load
```qlik
LOAD * FROM [lib://Data/report.xlsx]
(ooxml, embedded labels, table is Sheet1);
```

### Resident Load
```qlik
TempTable:
LOAD * FROM [lib://Data/source.csv]
(txt, utf8, embedded labels, delimiter is ',');

FinalTable:
LOAD
    Field1,
    Upper(Field2) as Field2Clean
RESIDENT TempTable
WHERE Field1 > 0;

DROP TABLE TempTable;
```

### Mapping Load
```qlik
RegionMap:
MAPPING LOAD
    RegionCode,
    RegionName
FROM [lib://Data/regions.csv]
(txt, utf8, embedded labels, delimiter is ',');

LOAD
    OrderID,
    ApplyMap('RegionMap', RegionCode, 'Unknown') as RegionName
FROM [lib://Data/orders.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

### Concatenate
```qlik
AllOrders:
LOAD * FROM [lib://Data/orders_2023.qvd] (qvd);

CONCATENATE(AllOrders)
LOAD * FROM [lib://Data/orders_2024.qvd] (qvd);
```

### Join
```qlik
Orders:
LOAD * FROM [lib://Data/orders.qvd] (qvd);

LEFT JOIN(Orders)
LOAD
    CustomerID,
    CustomerName
FROM [lib://Data/customers.qvd] (qvd);
```

## Date Handling

**Always parse dates explicitly:**
```qlik
LOAD
    Date#(DateField, 'YYYY-MM-DD') as OrderDate,
    Timestamp#(TsField, 'YYYY-MM-DD hh:mm:ss') as CreatedAt,
    Date(Date#(DateField, 'YYYY-MM-DD'), 'DD/MM/YYYY') as DisplayDate
FROM [lib://Data/file.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

**Common date functions:**
- `Date(Today())` — current date
- `MonthStart(Date)` — first of month
- `YearStart(Date)` — first of year
- `AddMonths(Date, n)` — offset months
- `WeekDay(Date)` — day of week (0=Mon)
- `Year(Date)`, `Month(Date)`, `Day(Date)` — extract parts

## Variables

```qlik
SET vToday = Today();                       // Literal — not evaluated until used
LET vMaxDate = Date(Max(OrderDate));        // Evaluated immediately
SET vThreshold = 100;
LET vRowCount = NoOfRows('TableName');
```

**Use in expressions:** `$(vToday)`, `$(vMaxDate)`, `$(vThreshold)`

## Set Analysis

```qlik
// Basic filter
Sum({<Year={2024}>} Sales)

// Current year
Sum({<Year={$(=Year(Today()))}>} Sales)

// Ignore selections on Region
Sum({1<Region=>} Sales)

// Multiple values
Sum({<Month={'Jan','Feb','Mar'}>} Sales)

// Date range (YTD)
Sum({<OrderDate={">=$(=YearStart(Today()))<=$(=Today())"}>} Sales)

// Exclude specific values
Sum({<Category-={'Archived'}>} Sales)
```

## Field Naming Conventions

- **PascalCase** — `CustomerName`, `OrderDate`, `TotalAmount`
- **Key prefix** — `%CustomerKey`, `%OrderKey`
- **Flag prefix** — `IsActive`, `HasOrders`, `IsDeleted`
- **No spaces** — Use `CustomerName` not `[Customer Name]`
- **No reserved words** as bare names — prefix if needed: `OrderDate` not `Date`

## Script Organization

```qlik
///$tab Main
SET ThousandSep=',';
SET DecimalSep='.';
SET DateFormat='YYYY-MM-DD';
SET TimestampFormat='YYYY-MM-DD hh:mm:ss';
SET ErrorMode = 1;

///$tab Variables
LET vToday = Today();
SET vDataPath = 'lib://DataFiles';

///$tab Extract
// Load raw data from sources

///$tab Transform
// Business logic, lookups, calculations

///$tab Data Model
// Final fact and dimension tables

///$tab Cleanup
DROP TABLES TempTable1, TempTable2;
```

## Debugging

```qlik
TRACE Loading customer data...;
Customers:
LOAD * FROM [lib://Data/customers.qvd] (qvd);
TRACE Loaded $(NoOfRows('Customers')) customers;

LET vFirstDate = Peek('OrderDate', 0, 'Orders');
TRACE First order date: $(vFirstDate);
```

## Performance Rules

**DO:**
- Use QVD files for staging (10-100x faster than CSV)
- Load only required fields (not `LOAD *` from large sources)
- Filter early with `WHERE`
- `DROP TABLE` immediately after use
- Use `ApplyMap()` instead of `JOIN` where possible
- Use `STORE` to create QVD intermediates

**DON'T:**
- Create synthetic keys (multiple shared field names between tables)
- Keep large temporary tables in memory
- Use complex calculations in script that belong in the UI
- Use `LOAD *` from database/CSV when only 3 fields are needed
- Hardcode file paths — always use `[lib://...]`

## Error Handling

```qlik
// Continue on missing file
SET ErrorMode = 0;
LOAD * FROM [lib://Data/optional_file.qvd] (qvd);
SET ErrorMode = 1;

// Null handling
LOAD
    If(IsNull(Amount), 0, Amount) as Amount,
    Alt(CustomerName, 'Unknown') as CustomerName
FROM [lib://Data/orders.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

## Common String Functions

- `Upper(s)`, `Lower(s)`, `Trim(s)`, `Len(s)`
- `Left(s, n)`, `Right(s, n)`, `Mid(s, start, len)`
- `SubField(s, delimiter, index)` — split and pick
- `Replace(s, old, new)`, `PurgeChar(s, chars)`
- `TextBetween(s, start, end)`, `Index(s, sub)`
- `Hash128(fields...)`, `Hash256(fields...)` — deterministic hashing

## Qlik Cloud Specifics

- **No OLEDB/ODBC** — use REST connector or file-based sources
- **Library connections only** — `[lib://ConnectionName/file]`
- **Supported formats** — QVD, CSV, TXT, XLSX, JSON (via REST), Parquet (via S3)
- **Section Access** — use `LOAD * INLINE` or file-based for row-level security

[See references/common-mistakes.md for anti-patterns and fixes]
[See references/set-analysis.md for advanced set analysis patterns]
[See assets/ for ready-to-use script templates]
