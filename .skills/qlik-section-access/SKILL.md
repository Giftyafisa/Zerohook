---
name: qlik-section-access
description: >
  Implement row-level security in Qlik with Section Access. Covers access
  control tables, USERID/NTNAME/GROUP fields, reduction fields, OMIT,
  strict exclusion, Section Access in Qlik Cloud vs on-premise, and
  common pitfalls. Use when securing a Qlik app so users only see their
  authorized data.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-core
---

# Qlik Section Access

## When to Use

- User needs row-level security in a Qlik app
- User asks about data authorization, user access, or data reduction
- User mentions Section Access, USERID, NTNAME, GROUP, or OMIT
- User wants to restrict which data specific users or groups can see
- User needs to hide fields or tables from certain users

## What Is Section Access?

Section Access is Qlik's built-in row-level security mechanism. It controls:
1. **Who can open the app** — authentication
2. **What data each user sees** — data reduction via key fields
3. **What fields are hidden** — OMIT fields

```qlik
SECTION ACCESS;
// Access control table here

SECTION APPLICATION;
// Normal data loading here
```

Everything between `SECTION ACCESS;` and `SECTION APPLICATION;` defines the security rules.

## Required Fields

| Field | Purpose | Values |
|---|---|---|
| `ACCESS` | Access level | `ADMIN` or `USER` |
| `USERID` | Qlik Cloud: user's email/subject. QSEoW: DOMAIN\username | Match against authenticated user |
| `NTNAME` | (QSEoW only) Windows NT domain\username | Alternative to USERID |
| `GROUP` | User directory group name | For group-based access |

**At least one identity field** (`USERID`, `NTNAME`, or `GROUP`) is required alongside `ACCESS`.

## Data Reduction

Reduction fields link the access table to the data model. When a user logs in, Qlik filters ALL associated tables to only rows matching that user's reduction field values.

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, REGION
    ADMIN, admin@company.com, *
    USER, alice@company.com, North
    USER, bob@company.com, South
    USER, charlie@company.com, North
    USER, charlie@company.com, South
];

SECTION APPLICATION;

// REGION field in Section Access matches REGION field in the data model
// Alice only sees North data, Bob only sees South, Charlie sees both
```

### How Reduction Works

1. User logs in → Qlik looks up their USERID in the Section Access table
2. Finds their reduction field values (e.g., REGION = 'North')
3. Filters ALL tables in the data model that contain the REGION field
4. User only sees rows where REGION = 'North'

### Wildcard `*`

The `*` value grants access to **all values** in that field. Use for admin users:

```qlik
ADMIN, admin@company.com, *
```

## Basic Patterns

### Inline Table (Simple)
```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, REGION
    ADMIN, admin@company.com, *
    USER, alice@company.com, North
    USER, bob@company.com, South
];

SECTION APPLICATION;
```

### From File (Production)
```qlik
SECTION ACCESS;
LOAD
    Upper(ACCESS) as ACCESS,
    Upper(USERID) as USERID,
    Upper(REGION) as REGION
FROM [lib://Security/access_control.xlsx]
(ooxml, embedded labels, table is Sheet1);

SECTION APPLICATION;
```

### From QVD (Best Performance)
```qlik
SECTION ACCESS;
_RawAccess:
LOAD * FROM [lib://Security/section_access.qvd] (qvd);

LOAD
    Upper(ACCESS) as ACCESS,
    Upper(USERID) as USERID,
    Upper(REDUCTION_FIELD) as REDUCTION_FIELD
RESIDENT _RawAccess;

DROP TABLE _RawAccess;

SECTION APPLICATION;
```

## Critical Rules

### 1. All Values Must Be UPPERCASE

Section Access fields are **case-insensitive** but Qlik converts everything to uppercase internally. **Always use `Upper()`** to avoid mismatches:

```qlik
SECTION ACCESS;
LOAD
    Upper(ACCESS) as ACCESS,
    Upper(USERID) as USERID,
    Upper(REGION) as REGION
FROM [lib://Security/access.csv];
```

### 2. Reduction Field Names Must Match Exactly

The field name in Section Access must **exactly match** the field name in the data model (after uppercase conversion):

```qlik
// Section Access has: REGION
// Data model has: Region
// → Qlik uppercases both → REGION = REGION → match ✓

// Section Access has: REGION_CODE
// Data model has: RegionCode
// → REGION_CODE ≠ REGIONCODE → NO match ✗
```

### 3. ADMIN vs USER Access Levels

| Level | Can See | Can Do |
|---|---|---|
| `ADMIN` | All data (no reduction applied) | Full access |
| `USER` | Only data matching reduction fields | Restricted view |

**Always have at least one ADMIN row** — otherwise you can lock yourself out.

### 4. Strict Exclusion

If a user is **not listed** in Section Access, they **cannot open the app at all**. There is no "default allow."

## OMIT — Hiding Fields

Use the `OMIT` field to hide specific fields from specific users:

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, OMIT
    ADMIN, admin@company.com,
    USER, alice@company.com, Salary;Bonus
    USER, bob@company.com, Salary
];
```

- Alice cannot see the `Salary` or `Bonus` fields
- Bob cannot see the `Salary` field
- Multiple fields separated by `;` (semicolon)
- Admin has no OMIT value → sees everything

## Qlik Cloud vs On-Premise

### Qlik Cloud
- `USERID` = user's **email address** or **subject claim** from IdP
- No `NTNAME` support
- `GROUP` = groups from IdP (if configured)
- Test with: `USERID` matching the email you log in with

### QSEoW (On-Premise)
- `USERID` = `DOMAIN\username` from Active Directory
- `NTNAME` = alternative, same format
- `GROUP` = AD group membership
- Test with: `USERID` matching `UserDirectory\UserId` from QMC

### Getting the Current User ID

```qlik
// In a chart expression to find the current user:
=OSUser()        // On-premise: DOMAIN\username
=GetObjectField('USERID')  // Section Access user ID
```

## Multiple Reduction Fields

You can reduce on multiple fields simultaneously:

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, REGION, DEPARTMENT
    ADMIN, admin@company.com, *, *
    USER, alice@company.com, North, Sales
    USER, alice@company.com, North, Marketing
    USER, bob@company.com, *, Finance
];
```

- Alice sees North+Sales AND North+Marketing rows
- Bob sees Finance data across ALL regions (wildcard)
- Each row is an OR condition for the same user

## Testing Section Access

### Step 1: Start with ADMIN Only
```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID
    ADMIN, your-email@company.com
];
SECTION APPLICATION;
```
Verify you can still open the app.

### Step 2: Add One USER Row
```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, REGION
    ADMIN, your-email@company.com, *
    USER, test-user@company.com, North
];
SECTION APPLICATION;
```
Log in as the test user and verify they only see North data.

### Step 3: Verify Reduction
Add a chart showing `Count(DISTINCT REGION)` — the USER should see only 1 value.

### Step 4: Check OMIT
If using OMIT, verify hidden fields don't appear in field lists or charts.

## Common Pitfalls

| Pitfall | Symptom | Fix |
|---|---|---|
| Forgot `Upper()` | User can't open app despite being listed | Apply `Upper()` to ALL Section Access fields |
| Reduction field name mismatch | No data reduction (user sees everything) | Ensure field names match exactly (case-insensitive) |
| No ADMIN row | Locked out of app entirely | Always include at least one ADMIN row |
| Wildcard `*` not set for ADMIN | Admin sees no data | Use `*` for all reduction fields on ADMIN rows |
| Testing in development | Can't log in as test user | Use Qlik's impersonation or create test accounts |
| Section Access after data load | Section Access not applied | `SECTION ACCESS;` must come BEFORE `SECTION APPLICATION;` |
| Forgot `SECTION APPLICATION;` | All data treated as access table | Always close with `SECTION APPLICATION;` |
| Multiple rows same user | Unexpected data | Each row adds access (OR logic), not replaces |

## Complete Example

```qlik
///$tab Section-Access
SECTION ACCESS;

AccessControl:
LOAD
    Upper(ACCESS) as ACCESS,
    Upper(USERID) as USERID,
    Upper(REGION) as REGION,
    OMIT
FROM [lib://Security/access_control.xlsx]
(ooxml, embedded labels, table is Sheet1);

TRACE Section Access loaded: $(NoOfRows('AccessControl')) rules;

SECTION APPLICATION;

///$tab Data-Load
// Normal data loading continues here
// The REGION field in your data will be used for reduction
Customers:
LOAD
    CustomerID,
    CustomerName,
    Upper(Region) as REGION,
    Salary,
    Bonus
FROM [lib://Data/customers.qvd] (qvd);
```

**Note:** The reduction field in the data model (`REGION`) must also be uppercased to match Section Access.

[See references/section-access-patterns.md for advanced patterns]
[See references/testing-guide.md for testing strategies]
[See assets/ for ready-to-use templates]
