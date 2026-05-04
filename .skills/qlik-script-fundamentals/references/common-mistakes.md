# Common Qlik Script Mistakes & Fixes

## 1. Using SQL Instead of Qlik

**Wrong:**
```sql
SELECT CustomerID, CustomerName FROM Customers WHERE Region = 'North'
```

**Correct:**
```qlik
LOAD
    CustomerID,
    CustomerName
FROM [lib://Data/customers.csv]
(txt, utf8, embedded labels, delimiter is ',')
WHERE Region = 'North';
```

**Why:** Qlik uses `LOAD` statements, not SQL `SELECT`. The `WHERE` clause comes after the source specification.

---

## 2. Not Parsing Dates Explicitly

**Wrong:**
```qlik
LOAD
    Date(DateField) as OrderDate
FROM [lib://Data/orders.csv];
```

**Correct:**
```qlik
LOAD
    Date#(DateField, 'YYYY-MM-DD') as OrderDate
FROM [lib://Data/orders.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

**Why:** `Date()` formats an already-numeric date. `Date#()` parses a string into a date. Without the format mask, Qlik guesses — and often guesses wrong, especially with MM/DD vs DD/MM ambiguity.

---

## 3. Lowercase Keywords

**Wrong:**
```qlik
load CustomerID, CustomerName from [lib://Data/customers.csv];
```

**Correct:**
```qlik
LOAD
    CustomerID,
    CustomerName
FROM [lib://Data/customers.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

**Why:** While Qlik keywords are technically case-insensitive, UPPERCASE is the universal convention. It makes scripts readable and distinguishes keywords from field names.

---

## 4. Missing Library Reference

**Wrong:**
```qlik
LOAD * FROM customers.csv;
```

**Correct:**
```qlik
LOAD * FROM [lib://DataFiles/customers.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

**Why:** Qlik Cloud requires `[lib://ConnectionName/path]` references. Bare filenames don't work and are a security risk in on-premise environments.

---

## 5. Field Name Case Mismatch

**Wrong:**
```qlik
// Source has "CustomerID" but you wrote:
LOAD customerid FROM [lib://Data/file.csv];

// Later trying to join on:
LEFT JOIN LOAD CustomerID FROM [lib://Data/other.csv];
```

**Why:** `customerid` and `CustomerID` are different fields in Qlik. This creates duplicate fields and synthetic keys instead of a proper join.

**Fix:** Always match exact casing from the source. Use `TRACE` or a test load to verify field names.

---

## 6. Forgetting to DROP Temporary Tables

**Wrong:**
```qlik
TempCalc:
LOAD *, Price * Qty as LineTotal
RESIDENT Orders;

// TempCalc stays in memory forever...
```

**Correct:**
```qlik
TempCalc:
LOAD *, Price * Qty as LineTotal
RESIDENT Orders;

// Use TempCalc for further processing...

DROP TABLE TempCalc;
```

**Why:** Every undropped table consumes RAM in the Qlik engine. Large temp tables can cause out-of-memory failures.

---

## 7. Creating Synthetic Keys

**Wrong:**
```qlik
// Both tables have CustomerID AND Region as common fields
Customers: LOAD CustomerID, Region, Name FROM ...;
Orders: LOAD CustomerID, Region, Amount FROM ...;
// → Qlik creates a synthetic key on CustomerID+Region
```

**Correct — Option A: Rename conflicting field:**
```qlik
Customers: LOAD CustomerID, Region as CustomerRegion, Name FROM ...;
Orders: LOAD CustomerID, Region as OrderRegion, Amount FROM ...;
```

**Correct — Option B: Drop the duplicate:**
```qlik
Customers: LOAD CustomerID, Region, Name FROM ...;
Orders: LOAD CustomerID, Amount FROM ...; // Don't load Region from Orders
```

**Why:** Synthetic keys create compound keys that hurt performance and cause confusing associations. Always ensure tables share exactly one key field.

---

## 8. Using LOAD * When Only a Few Fields Are Needed

**Wrong:**
```qlik
// Source has 200 columns, you need 3
LOAD * FROM [lib://Data/huge_table.csv];
```

**Correct:**
```qlik
LOAD
    CustomerID,
    OrderDate,
    Amount
FROM [lib://Data/huge_table.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

**Why:** Loading unnecessary fields wastes memory and slows reloads. Only load what the app actually needs.

---

## 9. Missing Format Specification

**Wrong:**
```qlik
LOAD * FROM [lib://Data/file.csv];
```

**Correct:**
```qlik
LOAD * FROM [lib://Data/file.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

**Why:** Without format specs, Qlik tries to auto-detect. This can fail with unusual delimiters, encodings, or header configurations. Always be explicit.

---

## 10. Using JOIN When ApplyMap Is Better

**Wrong (for simple lookups):**
```qlik
Orders: LOAD * FROM [lib://Data/orders.qvd] (qvd);
LEFT JOIN(Orders)
LOAD CustomerID, CustomerName FROM [lib://Data/customers.qvd] (qvd);
```

**Better:**
```qlik
CustomerMap:
MAPPING LOAD CustomerID, CustomerName
FROM [lib://Data/customers.qvd] (qvd);

Orders:
LOAD
    *,
    ApplyMap('CustomerMap', CustomerID, 'Unknown') as CustomerName
FROM [lib://Data/orders.qvd] (qvd);
```

**Why:** `ApplyMap` is faster and uses less memory than `JOIN` for 1:1 lookups. Use `JOIN` only when you need multiple fields or complex relationships.

---

## 11. Hardcoding Values Instead of Variables

**Wrong:**
```qlik
LOAD * FROM [lib://Data/orders.qvd] (qvd)
WHERE OrderDate >= '2024-01-01';
```

**Correct:**
```qlik
LET vStartDate = Date(YearStart(Today()), 'YYYY-MM-DD');

LOAD * FROM [lib://Data/orders.qvd] (qvd)
WHERE OrderDate >= '$(vStartDate)';
```

**Why:** Hardcoded dates break when the year changes. Variables make scripts self-maintaining.

---

## 12. Missing Semicolons

**Wrong:**
```qlik
LOAD * FROM [lib://Data/file.qvd] (qvd)
DROP TABLE TempTable
```

**Correct:**
```qlik
LOAD * FROM [lib://Data/file.qvd] (qvd);
DROP TABLE TempTable;
```

**Why:** Every Qlik statement must end with `;`. Missing semicolons cause cryptic parse errors.
