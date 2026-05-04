# Section Access Patterns

## Pattern 1: Region-Based Access

The most common pattern — users see data only for their assigned regions.

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, REGION
    ADMIN, admin@company.com, *
    USER, north-manager@company.com, NORTH
    USER, south-manager@company.com, SOUTH
    USER, multi-region@company.com, NORTH
    USER, multi-region@company.com, SOUTH
];
SECTION APPLICATION;

// Data model must have a REGION field (uppercased)
Sales:
LOAD *, Upper(Region) as REGION FROM [lib://Data/sales.qvd] (qvd);
```

## Pattern 2: Department + Region Matrix

Users restricted by both department and region:

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, DEPARTMENT, REGION
    ADMIN, admin@company.com, *, *
    USER, alice@company.com, SALES, NORTH
    USER, alice@company.com, SALES, SOUTH
    USER, bob@company.com, FINANCE, *
    USER, charlie@company.com, *, NORTH
];
SECTION APPLICATION;
```

- Alice: Sales department, North + South regions
- Bob: Finance department, all regions
- Charlie: All departments, North region only

## Pattern 3: Manager Hierarchy

Managers see their direct reports' data:

```qlik
// Access control file has: USERID, EMPLOYEE_GROUP
// Where EMPLOYEE_GROUP links to employees in the data model

SECTION ACCESS;
LOAD
    Upper('USER') as ACCESS,
    Upper(ManagerEmail) as USERID,
    Upper(TeamCode) as TEAM_CODE
FROM [lib://Security/manager_teams.xlsx]
(ooxml, embedded labels, table is Sheet1);

// Add admin row
LOAD * INLINE [
    ACCESS, USERID, TEAM_CODE
    ADMIN, admin@company.com, *
];

SECTION APPLICATION;

// Data model
Employees:
LOAD *, Upper(TeamCode) as TEAM_CODE
FROM [lib://Data/employees.qvd] (qvd);
```

## Pattern 4: Dynamic Access from Database

For large organizations, maintain access in a database/spreadsheet that's refreshed each reload:

```qlik
SECTION ACCESS;

// Load from external source
_RawAccess:
LOAD *
FROM [lib://Security/user_access.csv]
(txt, utf8, embedded labels, delimiter is ',');

// Apply uppercase and load
LOAD
    Upper(AccessLevel) as ACCESS,
    Upper(Email) as USERID,
    Upper(Region) as REGION,
    Upper(Department) as DEPARTMENT
RESIDENT _RawAccess;

DROP TABLE _RawAccess;

// Always ensure admin fallback
LOAD * INLINE [
    ACCESS, USERID, REGION, DEPARTMENT
    ADMIN, admin@company.com, *, *
];

SECTION APPLICATION;
```

## Pattern 5: OMIT for Sensitive Fields

Hide salary, cost, or personal data from certain users:

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, OMIT
    ADMIN, admin@company.com,
    ADMIN, hr-manager@company.com,
    USER, manager@company.com, Salary;SSN;BirthDate
    USER, analyst@company.com, Salary;SSN;BirthDate;Address
];
SECTION APPLICATION;
```

- OMIT uses `;` to separate multiple field names
- OMIT is independent of data reduction — it hides fields entirely
- Admin rows with empty OMIT see all fields

## Pattern 6: Group-Based Access (QSEoW)

Use Active Directory groups instead of individual users:

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, GROUP, REGION
    ADMIN, DOMAIN\QlikAdmins, *
    USER, DOMAIN\SalesNorth, NORTH
    USER, DOMAIN\SalesSouth, SOUTH
    USER, DOMAIN\SalesAll, *
];
SECTION APPLICATION;
```

## Pattern 7: Combining USERID and GROUP

```qlik
SECTION ACCESS;
// Group-based rules
LOAD * INLINE [
    ACCESS, GROUP, REGION
    USER, DOMAIN\SalesTeam, *
];

// Individual overrides
LOAD * INLINE [
    ACCESS, USERID, REGION
    ADMIN, admin@company.com, *
    USER, restricted-user@company.com, NORTH
];

SECTION APPLICATION;
```

If a user matches both a GROUP rule and a USERID rule, the **union** of their access applies.

## Pattern 8: Audit Trail

Log who has access to what:

```qlik
SECTION ACCESS;
AccessRules:
LOAD
    Upper(ACCESS) as ACCESS,
    Upper(USERID) as USERID,
    Upper(REGION) as REGION
FROM [lib://Security/access.csv]
(txt, utf8, embedded labels, delimiter is ',');

// Store the access rules for audit purposes
STORE AccessRules INTO [lib://Audit/section_access_$(=Date(Today(),'YYYYMMDD')).qvd] (qvd);

SECTION APPLICATION;
```

## Pattern 9: Environment-Specific Access

Different access rules for DEV/TEST/PROD:

```qlik
SET vEnvironment = 'PROD';  // Change per environment

SECTION ACCESS;

IF '$(vEnvironment)' = 'PROD' THEN
    LOAD Upper(ACCESS) as ACCESS, Upper(USERID) as USERID, Upper(REGION) as REGION
    FROM [lib://Security/access_prod.csv]
    (txt, utf8, embedded labels, delimiter is ',');
ELSEIF '$(vEnvironment)' = 'TEST' THEN
    // In test: everyone is admin
    LOAD * INLINE [
        ACCESS, USERID, REGION
        ADMIN, *, *
    ];
END IF

SECTION APPLICATION;
```
