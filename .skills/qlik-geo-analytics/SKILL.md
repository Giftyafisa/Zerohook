---
name: qlik-geo-analytics
description: >
  Implement geographic analysis using Qlik GeoAnalytics and native map charts.
  Covers GeoMakePoint for coordinate mapping, GeoGetPolygon/GeoGetBoundingBox
  for area mapping, KML/GeoJSON integration, spatial binning, distance
  calculations, and map layer configuration (point, area, line, density).
  Use when analyzing location data, building territory maps, or calculating
  distances between points.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-data
---

# Qlik GeoAnalytics & Map Charts

## When to Use

- User needs to build a map chart
- User has latitude/longitude coordinates and needs to map them
- User asks about KML, GeoJSON, or Shapefiles
- User wants to map custom sales territories or regions
- User needs to calculate distances between locations
- User mentions `GeoMakePoint()`, `GeoGetPolygon()`, or spatial binning

## Core Geospatial Functions

Qlik provides native functions to handle geographic data in the load script.

### GeoMakePoint (Coordinates)
Converts Latitude and Longitude into a spatial point object that Qlik's map engine understands.

```qlik
// Syntax: GeoMakePoint(Latitude, Longitude)
// MUST be Lat first, then Long!

Customers:
LOAD
    CustomerID,
    CustomerName,
    Lat,
    Lng,
    // Create the point field for the map chart
    GeoMakePoint(Lat, Lng) as CustomerLocation
FROM [lib://Data/customers.csv] (txt, ...);
```

### Map Layer Configurations
Once `CustomerLocation` is created, use it in a **Map Chart**:
1. Add a Map chart to the sheet
2. Add a **Point Layer**
3. Set the dimension to `CustomerID`
4. Set the Location field to `CustomerLocation`

## Area Mapping (Polygons)

To map countries, states, or zip codes as shaded regions, you need polygons.

### 1. Native Qlik Location Service
Qlik automatically recognizes standard geographic names (Countries, US States, major Cities) if you use them as the location field in an Area Layer.

```qlik
// Qlik's map service will automatically resolve these names:
LOAD
    Country,      // 'United States', 'France'
    StateCode,    // 'CA', 'NY'
    City,
    Sales
FROM ...;
```

### 2. Loading Custom Boundaries (KML / GeoJSON)
For custom territories (e.g., Sales Regions) or unsupported zip codes, load a KML or GeoJSON file.

```qlik
// Load the KML file containing the polygon geometry
_Territories:
LOAD
    Name as TerritoryName,
    Point as TerritoryCenter,
    Area as TerritoryPolygon   // This contains the polygon coordinates
FROM [lib://GeoData/sales_territories.kml] (kml, Table is [Folder/Placemark]);

// Join to your sales data
FactSales:
LOAD
    OrderID,
    TerritoryName,
    Amount
FROM [lib://Data/sales.csv] (txt, ...);
```
*In the Map Chart, create an **Area Layer** using `TerritoryName` as the dimension and `TerritoryPolygon` as the location field.*

### 3. GeoGetPolygon (GeoAnalytics Connector)
If you have the GeoAnalytics connector, you can fetch polygons dynamically for known areas.

```qlik
// Syntax: GeoGetPolygon('AreaName', 'CountryCode')
LOAD
    ZipCode,
    GeoGetPolygon(ZipCode, 'US') as ZipPolygon
FROM [lib://Data/zipcodes.csv] (txt, ...);
```

## Advanced Spatial Operations

### Distance Calculations
Calculate the straight-line (haversine) distance between two points.

```qlik
// E.g., distance from store to customer
LOAD
    OrderID,
    CustomerID,
    GeoMakePoint(CustomerLat, CustomerLng) as CustomerLoc,
    StoreID,
    GeoMakePoint(StoreLat, StoreLng) as StoreLoc,
    
    // GeoDistance(Point1, Point2) returns distance in meters
    GeoDistance(
        GeoMakePoint(CustomerLat, CustomerLng),
        GeoMakePoint(StoreLat, StoreLng)
    ) / 1000 as DistanceKM
FROM ...;
```

### Spatial Binning (Hexbin/Grid)
For mapping millions of points without crashing the browser, group them into bins.

```qlik
// GeoGetBoundingBox clusters points into a grid
// The second parameter controls grid size (smaller number = larger grid)
LOAD
    GeoGetBoundingBox(GeoMakePoint(Lat, Lng), 0.05) as GeoBin,
    Count(CustomerID) as CustomerDensity
GROUP BY GeoGetBoundingBox(GeoMakePoint(Lat, Lng), 0.05);
```
*Alternative: Use a **Density Layer** in the Map chart, which handles clustering automatically in the UI.*

### Line/Route Mapping
To draw lines between origins and destinations (e.g., flight paths, shipping routes).

```qlik
// A line requires a GeoLine object, created from two points
LOAD
    RouteID,
    OriginCity,
    DestCity,
    OriginLat, OriginLng,
    DestLat, DestLng,
    
    // Create the line geometry
    GeoMakePoint(OriginLat, OriginLng) & '],[' & 
    GeoMakePoint(DestLat, DestLng) as RouteLine
FROM [lib://Data/flights.csv] (txt, ...);
```
*In the Map Chart, use a **Line Layer** with `RouteLine` as the location.*

## Common Map Chart Layers

| Layer Type | Best For | Requirement |
|---|---|---|
| **Point Layer** | Stores, customers, exact locations | Point geometry (`GeoMakePoint`) |
| **Area Layer** | Heatmaps by state, country, zip | Polygon geometry (`KML` or names) |
| **Line Layer** | Routes, flow, connections | Two points combined |
| **Density Layer** | Heatmaps of dense point data | Point geometry (clusters automatically) |
| **Chart Layer** | Mini pie/bar charts on a map | Point geometry |
| **Background** | Satellite, terrain, custom images | WMS/TMS URL |

## Best Practices

1. **Always pre-calculate `GeoMakePoint()` in the script**. Doing it in the chart expression is slow.
2. **Use KML/GeoJSON** for boundaries rather than relying entirely on Qlik's name resolution (names can be ambiguous, e.g., "Paris, France" vs "Paris, Texas").
3. **Limit point layers to < 10,000 points**. For larger datasets, use a Density Layer or pre-aggregate the data geographically.
4. **Use `GeoMakePoint(Lat, Lng)`**. The order is strictly Latitude first, then Longitude. (A common mistake is reversing them).

[See references/kml-integration.md for custom boundaries]
[See assets/geo-distance-template.qlik for distance and radius calculations]
