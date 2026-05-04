# KML and GeoJSON Integration

Qlik native map charts support loading geographic boundaries (polygons) from KML and GeoJSON files. This is essential for mapping custom sales territories, non-standard postal codes, or custom regions.

## Loading a KML File

KML (Keyhole Markup Language) files usually contain a `Name`, `Point` (center point), and `Area` (the polygon coordinates).

```qlik
// Loading from a KML file
// The table name is typically [Folder/Placemark] or similar depending on the file structure
_TerritoryBoundaries:
LOAD
    Name as TerritoryName,       // The identifier to link to your data
    Point as TerritoryCenter,    // Optional: center point for labels
    Area as TerritoryPolygon     // The actual boundary data
FROM [lib://GeoData/US_Sales_Territories.kml]
(kml, Table is [Folder/Placemark]);
```

## Loading a GeoJSON File

GeoJSON is a standard JSON format for encoding geographic data structures.

```qlik
// Qlik parses GeoJSON automatically if loaded via the REST connector or as a file
// Assuming the GeoJSON has "properties.name" and "geometry"
_GeoJSON:
LOAD
    "properties.name" as TerritoryName,
    "geometry" as TerritoryPolygon
FROM [lib://GeoData/custom_regions.geojson]
(json, utf8, embedded labels);
```

## Combining Boundaries with Fact Data

Once the boundary data is loaded, you must link it to your fact table using the common identifier.

```qlik
// 1. Load the KML boundaries
DimTerritoryMap:
LOAD
    Name as RegionID,
    Area as RegionPolygon
FROM [lib://GeoData/Regions.kml] (kml, Table is [Features]);

// 2. Load the fact data
FactSales:
LOAD
    OrderID,
    RegionID,  // This links to the KML data
    SalesAmount
FROM [lib://Data/Sales.qvd] (qvd);
```

### Map Chart Configuration
1. Add Map Chart
2. Add **Area Layer**
3. Dimension: `RegionID`
4. Location field: `RegionPolygon`
5. Color by measure: `Sum(SalesAmount)`

## Best Practices for Custom Boundaries

1. **Simplify Polygons**: High-resolution KML files (e.g., highly detailed coastlines) can be massive and will crash the browser. Use tools like [Mapshaper](https://mapshaper.org/) to simplify the geometry before loading into Qlik.
2. **Remove Unused Fields**: KML files often contain lots of metadata (descriptions, styling tags). Only load the `Name` and `Area` fields.
3. **Check Coordinate Systems**: Qlik expects coordinates in **WGS84 (EPSG:4326)**. If your KML uses a different projection, the polygons will render in the wrong place on the base map.
4. **Use `GeoGetBoundingBox()` for Zooming**: If you want the map to automatically zoom to a specific territory, you can use the polygon data to calculate the bounding box.
