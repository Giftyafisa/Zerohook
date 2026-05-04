---
name: qlik-nprinting
description: >
  Automate report generation and distribution with Qlik NPrinting.
  Covers connecting NPrinting to Qlik Sense and QlikView, creating
  report templates (Excel, Word, PowerPoint, HTML, PixelPerfect),
  scheduling, distribution lists, conditions, filters, and API
  automation. Use when generating automated reports from Qlik apps.
license: Apache-2.0
platforms: ["client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-reporting
---

# Qlik NPrinting

## When to Use

- User needs to generate automated PDF, Excel, or PowerPoint reports from Qlik apps
- User asks about report scheduling, distribution lists, or email delivery
- User mentions NPrinting, report templates, or pixel-perfect reports
- User needs to burst reports (one per region/customer/etc.)
- User wants to integrate NPrinting with their workflow via API

## NPrinting Overview

Qlik NPrinting is an on-premise reporting server that connects to Qlik Sense and QlikView apps to generate formatted reports.

### Supported Output Formats

| Format | Engine | Use Case |
|---|---|---|
| **Excel** | Excel template | Data exports, pivot tables, formatted spreadsheets |
| **Word** | Word template | Narrative reports with embedded charts |
| **PowerPoint** | PPT template | Executive slide decks with live data |
| **HTML** | HTML template | Web-hosted reports, email body |
| **PixelPerfect** | Built-in designer | Invoices, labels, pixel-exact layouts |
| **QlikEntity** | Image export | Chart images for embedding elsewhere |

## Architecture

```
Qlik Sense / QlikView  ←→  NPrinting Engine  →  Report Output
     (data source)           (generates)         (PDF/Excel/PPT)
                                  ↓
                          NPrinting Scheduler
                                  ↓
                          Distribution (Email/Folder/Hub)
```

### Components

| Component | Purpose |
|---|---|
| **NPrinting Server** | Web console, scheduling, user management |
| **NPrinting Engine** | Renders reports (can have multiple for load balancing) |
| **NPrinting Designer** | Windows app for creating report templates |
| **NewsStand** | Web portal where users access their reports |

## Connection Setup

### Connect to Qlik Sense
1. **NPrinting Web Console → Apps → Add app**
2. Select "Qlik Sense" as the source type
3. Enter Qlik Sense server URL and credentials
4. Select the app to connect to
5. Import metadata (fields, objects, variables)

### Connect to QlikView
1. **NPrinting Web Console → Apps → Add app**
2. Select "QlikView" as the source type
3. Enter QlikView Server address
4. Select the QVW document
5. Import metadata

### Metadata Import
After connecting, NPrinting imports:
- **Fields** — All fields in the data model
- **Objects** — Charts, tables, KPIs (by object ID)
- **Variables** — All script/app variables

**Important:** Re-import metadata after modifying the Qlik app's data model.

## Report Templates

### Excel Report

Create in NPrinting Designer:

1. Open a blank Excel workbook
2. Drag fields from the NPrinting panel to cells
3. Add **levels** (grouping) and **pages** (separate sheets/files)

```
Cell A1: <CustomerName>     ← Field tag
Cell B1: <Sum(Sales)>       ← Expression tag
Cell C1: <OrderDate>        ← Field tag

Level: Region               ← Groups rows by Region
Page: Region                ← Creates one sheet per Region
```

#### Excel Tips
- Use `<field>` tags for individual values
- Use **Table** objects for dynamic row expansion
- Add **Levels** for grouping (like GROUP BY)
- Add **Pages** for separate sheets or files per dimension value
- Native Excel formulas work alongside NPrinting tags

### Word Report

1. Open a Word template in NPrinting Designer
2. Insert text, tables, and images
3. Drag chart objects (renders as images) and field tags

```
Dear <CustomerName>,

Your total sales for <Year> were <Sum(Sales)>.

[Chart: Sales Trend]    ← Embedded chart image
[Table: Order Details]  ← Dynamic table
```

### PowerPoint Report

1. Create slides in NPrinting Designer
2. Add chart images and text tags
3. Use **Pages** to create one slide deck per dimension value

### PixelPerfect Report

For precise layouts (invoices, shipping labels):

1. Open PixelPerfect designer (built into NPrinting Designer)
2. Draw layout bands: Header, Detail, Footer, Group Header/Footer
3. Place fields in exact positions with formatting
4. Set page size, margins, orientation

## Report Distribution

### Distribution Methods

| Method | Description |
|---|---|
| **Email** | Send report as attachment or inline HTML |
| **Folder** | Save to network share or local folder |
| **Hub** | Publish to Qlik Sense Hub (appears in user's app list) |
| **NewsStand** | NPrinting web portal for on-demand access |

### Email Configuration

1. **NPrinting Web Console → Settings → SMTP**
2. Configure SMTP server, port, credentials
3. Set sender address

### Distribution Lists

1. **NPrinting Web Console → Users → Add users**
2. Create groups (e.g., "Sales Managers", "Finance Team")
3. Assign users to groups
4. Map groups to report publish tasks

## Scheduling

### Creating a Publish Task

1. **NPrinting Web Console → Publish Tasks → Create**
2. Configure:
   - **Report**: Select the report template
   - **Output format**: PDF, Excel, etc.
   - **Recipients**: Users or groups
   - **Delivery**: Email, folder, hub, newsstand
   - **Schedule**: Daily, weekly, monthly, or triggered

### Schedule Options

| Frequency | Example |
|---|---|
| **Daily** | Every weekday at 7:00 AM |
| **Weekly** | Every Monday at 8:00 AM |
| **Monthly** | 1st of each month at 6:00 AM |
| **Event-triggered** | After Qlik app reload completes |
| **On-demand** | Manual trigger via Web Console or API |

### Task Chaining
Run NPrinting tasks after Qlik reload completes:
1. QSEoW task triggers an external program task
2. External task calls NPrinting API to start publish task
3. Reports are generated with fresh data

## Report Bursting (One Per Entity)

Generate separate reports for each value in a dimension:

### Setup
1. In the report template, add a **Page** level on the dimension (e.g., `Region`)
2. In the publish task, enable **"Create one report per page"**
3. Configure dynamic recipients:
   - Map each Region value to specific email addresses
   - Or use an NPrinting filter per user/group

### Dynamic File Names
```
Report_<Region>_<Year>_<MonthName>.pdf
→ Report_North_2024_January.pdf
→ Report_South_2024_January.pdf
```

## Filters & Selections

### Report-Level Filters
Apply selections before generating a report:

1. In the publish task, add a **Filter**
2. Select field and values (e.g., Year = 2024)
3. The report is generated with only that data

### User-Level Filters
Different users see different data:

1. **NPrinting Web Console → Filters → Create**
2. Map users to filter values:
   - User "john.smith" → Region = "North"
   - User "jane.doe" → Region = "South"
3. Assign filter to the publish task

### Dynamic Filters via Section Access
If the Qlik app uses Section Access, NPrinting respects it:
- Each user's report only contains their allowed data
- No additional NPrinting filters needed

## NPrinting API

### Authentication
```bash
# Get authentication token
curl -X POST "https://nprinting-server:4993/api/v1/login/ntlm" \
  -u "DOMAIN\\username:password" \
  --ntlm \
  -c cookies.txt

# Use cookies for subsequent requests
```

### Common API Calls

#### List Reports
```bash
curl "https://nprinting-server:4993/api/v1/reports" \
  -b cookies.txt
```

#### Trigger a Publish Task
```bash
# Get task ID first
curl "https://nprinting-server:4993/api/v1/tasks" -b cookies.txt

# Execute task
curl -X POST "https://nprinting-server:4993/api/v1/tasks/TASK_ID/executions" \
  -b cookies.txt \
  -H "Content-Type: application/json" \
  -d '{"type": "Publish"}'
```

#### Check Execution Status
```bash
curl "https://nprinting-server:4993/api/v1/tasks/TASK_ID/executions" \
  -b cookies.txt
```

#### Download Generated Report
```bash
curl "https://nprinting-server:4993/api/v1/tasks/TASK_ID/executions/EXEC_ID/result" \
  -b cookies.txt \
  -o report.pdf
```

## Best Practices

1. **Keep templates simple** — Complex templates are slow to render
2. **Use QVD-based apps** — NPrinting re-opens the app for each report; fast reload = fast reports
3. **Schedule after data refresh** — Chain NPrinting tasks after Qlik reload tasks
4. **Test with a small dataset first** — Especially for bursted reports (100 regions = 100 reports)
5. **Re-import metadata** after any data model changes in the Qlik app
6. **Use Section Access** for user-level filtering instead of NPrinting filters when possible
7. **Monitor engine load** — Add more NPrinting Engine nodes for heavy report volumes
8. **Version templates** — Keep backups of .npx template files

## Troubleshooting

| Issue | Fix |
|---|---|
| "Connection failed" | Check Qlik server URL, certs, and user permissions |
| Missing fields/objects | Re-import metadata in NPrinting app connection |
| Blank report | Check filters — user may have no matching data |
| Slow generation | Simplify template, reduce data volume, add engines |
| Email not sent | Check SMTP settings, spam filters, recipient addresses |
| Charts missing | Ensure object IDs haven't changed after app modification |

[See references/template-patterns.md for template design patterns]
[See assets/ for report configuration examples]
