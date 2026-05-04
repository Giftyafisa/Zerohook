# JSON Parsing in Qlik REST Connector

## How Qlik Parses JSON

The REST connector converts JSON into a relational table structure using:
- `__KEY_` fields — Primary keys for each JSON object/array
- `__FK_` fields — Foreign keys linking nested objects to their parents
- `PK` / `FK` keywords — Define the relationships in the SQL SELECT

## Flat Array

```json
{"items": [{"id": 1, "name": "A"}, {"id": 2, "name": "B"}]}
```

```qlik
SQL SELECT
    "__KEY_root",
    (SELECT "id", "name", "__FK_items"
     FROM "items" FK "__FK_items")
FROM JSON (wrap on) "root" PK "__KEY_root";

// Extract
Data: LOAD [id], [name] RESIDENT RestConnectorMasterTable WHERE NOT IsNull([__FK_items]);
DROP TABLE RestConnectorMasterTable;
```

## Nested Object

```json
{"user": {"id": 1, "profile": {"name": "Alice", "age": 30}}}
```

```qlik
SQL SELECT
    "__KEY_root",
    (SELECT
        "id",
        "__KEY_user",
        (SELECT "name", "age", "__FK_profile"
         FROM "profile" FK "__FK_profile")
    FROM "user" FK "__FK_user" PK "__KEY_user")
FROM JSON (wrap on) "root" PK "__KEY_root";

// Join parent + child
_Users: LOAD [id], [__KEY_user] RESIDENT RestConnectorMasterTable WHERE NOT IsNull([__FK_user]);
_Profiles: LOAD [name], [age], [__FK_profile] as [__KEY_user] RESIDENT RestConnectorMasterTable WHERE NOT IsNull([__FK_profile]);

Result:
LOAD u.[id], p.[name], p.[age]
RESIDENT _Users as u LEFT JOIN (_Profiles) as p ON u.[__KEY_user] = p.[__KEY_user];

DROP TABLES RestConnectorMasterTable, _Users, _Profiles;
```

## Array of Arrays

```json
{"orders": [{"id": 1, "items": [{"sku": "A1", "qty": 5}, {"sku": "B2", "qty": 3}]}]}
```

```qlik
SQL SELECT
    "__KEY_root",
    (SELECT
        "id" as "orderId",
        "__KEY_orders",
        "__FK_orders",
        (SELECT "sku", "qty", "__FK_items"
         FROM "items" FK "__FK_items")
    FROM "orders" FK "__FK_orders" PK "__KEY_orders")
FROM JSON (wrap on) "root" PK "__KEY_root";

// Extract orders
_Orders: LOAD [orderId], [__KEY_orders] RESIDENT RestConnectorMasterTable WHERE NOT IsNull([__FK_orders]);

// Extract items (FK links to parent order)
_Items: LOAD [sku], [qty], [__FK_items] as [__KEY_orders] RESIDENT RestConnectorMasterTable WHERE NOT IsNull([__FK_items]);

// Join
OrderItems:
LOAD o.[orderId], i.[sku], i.[qty]
RESIDENT _Orders as o LEFT JOIN (_Items) as i ON o.[__KEY_orders] = i.[__KEY_orders];

DROP TABLES RestConnectorMasterTable, _Orders, _Items;
```

## Handling Null/Missing Fields

If a JSON field is sometimes missing, it will appear as null:

```qlik
Data:
LOAD
    [id],
    If(IsNull([email]), 'N/A', [email]) as Email,
    If(IsNull([phone]), '', [phone]) as Phone
RESIDENT RestConnectorMasterTable
WHERE NOT IsNull([__FK_data]);
```

## Renaming Fields During Parse

```qlik
SQL SELECT
    "__KEY_root",
    (SELECT
        "id" as "userId",
        "first_name" as "firstName",
        "last_name" as "lastName",
        "__FK_data"
    FROM "data" FK "__FK_data")
FROM JSON (wrap on) "root" PK "__KEY_root";
```

## Tips

1. **Use the REST connector wizard first** — It auto-generates the SQL SELECT with correct PK/FK
2. **Always filter with `WHERE NOT IsNull([__FK_...])`** — Otherwise you get the parent row mixed in
3. **Rename fields in the SQL SELECT** — Easier than renaming after load
4. **Drop the MasterTable immediately** — It's large and not needed after extraction
5. **For deeply nested JSON**, consider using the LOAD...FROM...WHERE pattern with multiple passes
