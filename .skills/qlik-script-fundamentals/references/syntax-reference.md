# Qlik Script Syntax Reference

## Keywords (Always UPPERCASE)

### Data Loading
| Keyword | Usage |
|---|---|
| `LOAD` | Load fields from a source |
| `FROM` | Specify file source |
| `RESIDENT` | Load from an existing in-memory table |
| `INLINE` | Define data inline in the script |
| `AUTOGENERATE` | Generate rows without a source |
| `EXTENSION` | Call SSE (Server-Side Extension) function |
| `WHERE` | Filter rows |
| `GROUP BY` | Aggregate data |
| `ORDER BY` | Sort data (rarely needed in script) |
| `DISTINCT` | Remove duplicate rows |

### Table Operations
| Keyword | Usage |
|---|---|
| `LEFT JOIN` | Join keeping all left rows |
| `INNER JOIN` | Join keeping only matching rows |
| `RIGHT JOIN` | Join keeping all right rows |
| `OUTER JOIN` | Join keeping all rows from both |
| `CONCATENATE` | Append rows to an existing table |
| `NOCONCATENATE` | Prevent auto-concatenation |
| `QUALIFY` | Prefix field names with table name |
| `UNQUALIFY` | Stop qualifying field names |
| `RENAME TABLE` | Rename a table |
| `RENAME FIELD` | Rename a field |
| `DROP TABLE` | Remove a table from memory |
| `DROP FIELD` | Remove a field from all tables |
| `DROP TABLES` | Remove multiple tables |
| `DROP FIELDS` | Remove multiple fields |

### Mapping
| Keyword | Usage |
|---|---|
| `MAPPING LOAD` | Create a mapping table |
| `ApplyMap('MapName', Key, Default)` | Look up a value in a mapping table |
| `MapSubstring('MapName', Field)` | Replace substrings using a mapping table |

### Variables
| Keyword | Usage |
|---|---|
| `SET` | Define a literal variable (not evaluated until used) |
| `LET` | Define an evaluated variable (computed immediately) |

### Flow Control
| Keyword | Usage |
|---|---|
| `IF ... THEN ... ELSEIF ... ELSE ... END IF` | Conditional script execution |
| `FOR ... TO ... STEP ... NEXT` | Numeric loop |
| `FOR EACH ... IN ... NEXT` | Iterate over list |
| `DO ... WHILE ... LOOP` | While loop |
| `SUB ... END SUB` | Define a subroutine |
| `CALL` | Execute a subroutine |
| `EXIT SCRIPT` | Stop script execution |
| `EXIT FOR` | Break out of a FOR loop |
| `EXIT DO` | Break out of a DO loop |

### File Operations
| Keyword | Usage |
|---|---|
| `STORE` | Save a table to QVD/CSV/TXT |
| `LIB CONNECT TO` | Connect to a data source |
| `DIRECTORY` | Set default file directory |

### Other
| Keyword | Usage |
|---|---|
| `TRACE` | Print message to reload log |
| `COMMENT TABLE` | Add metadata comment to a table |
| `COMMENT FIELD` | Add metadata comment to a field |
| `TAG FIELD` | Add a tag to a field |
| `UNTAG FIELD` | Remove a tag from a field |
| `SECTION ACCESS` | Begin row-level security section |
| `SECTION APPLICATION` | Return to normal data section |

## File Format Specifications

### CSV / Text
```qlik
FROM [lib://Data/file.csv]
(txt, utf8, embedded labels, delimiter is ',');
```

Options: `utf8`, `unicode`, `ansi`, `embedded labels`, `no labels`, `delimiter is ','`, `delimiter is '\t'`, `msq` (multi-line), `no eof`

### QVD
```qlik
FROM [lib://Data/file.qvd] (qvd);
```

### Excel
```qlik
FROM [lib://Data/file.xlsx]
(ooxml, embedded labels, table is Sheet1);
```

Options: `ooxml` (xlsx) or `biff` (xls), `table is SheetName`, `header is N lines`

### Inline
```qlik
LOAD * INLINE [
    ID, Name, Value
    1, Alpha, 100
    2, Beta, 200
    3, Gamma, 300
];
```

## Aggregation Functions

| Function | Description |
|---|---|
| `Sum(Field)` | Total |
| `Count(Field)` | Count non-null values |
| `Count(DISTINCT Field)` | Count unique values |
| `Avg(Field)` | Average |
| `Min(Field)` | Minimum |
| `Max(Field)` | Maximum |
| `Median(Field)` | Median |
| `Stdev(Field)` | Standard deviation |
| `Only(Field)` | Value if exactly one exists, else NULL |
| `FirstSortedValue(Field, SortField)` | First value when sorted |
| `Concat(Field, Delimiter)` | Concatenate all values |
| `RangeSum(v1, v2, ...)` | Sum that treats NULL as 0 |
| `RangeCount(v1, v2, ...)` | Count non-null |
| `RangeAvg(v1, v2, ...)` | Average ignoring NULL |
| `RangeMin(v1, v2, ...)` | Minimum ignoring NULL |
| `RangeMax(v1, v2, ...)` | Maximum ignoring NULL |

## Date & Time Functions

| Function | Description |
|---|---|
| `Date#(String, Format)` | Parse string → date |
| `Date(Number, Format)` | Format number → date string |
| `Timestamp#(String, Format)` | Parse string → timestamp |
| `Today()` | Current date |
| `Now()` | Current date+time |
| `Year(Date)` | Extract year |
| `Month(Date)` | Extract month name |
| `Day(Date)` | Extract day of month |
| `WeekDay(Date)` | Day of week (0=Mon) |
| `Week(Date)` | Week number |
| `MonthStart(Date)` | First day of month |
| `MonthEnd(Date)` | Last day of month |
| `YearStart(Date)` | First day of year |
| `YearEnd(Date)` | Last day of year |
| `AddMonths(Date, N)` | Add N months |
| `AddYears(Date, N)` | Add N years |
| `DayNumberOfYear(Date)` | Day number (1-366) |
| `MakeDate(Year, Month, Day)` | Construct a date |

## String Functions

| Function | Description |
|---|---|
| `Len(s)` | String length |
| `Upper(s)` | Uppercase |
| `Lower(s)` | Lowercase |
| `Capitalize(s)` | Title case |
| `Trim(s)` | Remove leading/trailing spaces |
| `LTrim(s)` | Remove leading spaces |
| `RTrim(s)` | Remove trailing spaces |
| `Left(s, n)` | First n characters |
| `Right(s, n)` | Last n characters |
| `Mid(s, start, len)` | Substring |
| `SubField(s, delim, index)` | Split and pick |
| `Replace(s, old, new)` | Replace substring |
| `PurgeChar(s, chars)` | Remove specific characters |
| `KeepChar(s, chars)` | Keep only specific characters |
| `TextBetween(s, start, end)` | Extract between delimiters |
| `Index(s, sub, count)` | Position of substring |
| `Repeat(s, n)` | Repeat string |
| `Hash128(fields...)` | 128-bit hash |
| `Hash256(fields...)` | 256-bit hash |

## Conditional Functions

| Function | Description |
|---|---|
| `If(cond, true, false)` | Conditional value |
| `Alt(v1, v2, ..., default)` | First non-null value |
| `Pick(n, v1, v2, ...)` | Pick nth value |
| `Match(s, v1, v2, ...)` | Case-sensitive match (returns position) |
| `MixMatch(s, v1, v2, ...)` | Case-insensitive match |
| `WildMatch(s, p1, p2, ...)` | Wildcard match |
| `IsNull(v)` | Check for null |
| `IsNum(v)` | Check if numeric |
| `IsText(v)` | Check if text |
| `Null()` | Return null value |

## System Functions (Script Only)

| Function | Description |
|---|---|
| `NoOfRows('Table')` | Row count of a table |
| `NoOfFields('Table')` | Field count |
| `FieldName(n, 'Table')` | Name of nth field |
| `Peek('Field', Row, 'Table')` | Value from specific row |
| `Previous(Field)` | Value from previous row during LOAD |
| `RowNo()` | Current row number during LOAD |
| `RecNo()` | Current record number |
| `IterNo()` | Current iteration in `WHILE` clause |
| `FieldValueCount('Field')` | Number of distinct values |
| `FieldValue('Field', n)` | Nth distinct value |

## STORE Statement

```qlik
// Store to QVD (recommended)
STORE TableName INTO [lib://QVD/output.qvd] (qvd);

// Store to CSV
STORE TableName INTO [lib://Data/output.csv] (txt);

// Store subset of fields
STORE Field1, Field2 FROM TableName INTO [lib://QVD/partial.qvd] (qvd);
```

**Note:** `STORE` automatically creates any subdirectories in the target path. No need to manually create folders on the server.
