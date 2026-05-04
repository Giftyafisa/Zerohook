# Testing Section Access

## The Golden Rule

**Always keep at least one ADMIN row with your own USERID.** If you don't, you will lock yourself out of the app.

## Testing Strategy

### Phase 1: Verify You're Not Locked Out

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID
    ADMIN, YOUR-EMAIL@COMPANY.COM
];
SECTION APPLICATION;

// Your normal data load
```

Reload and verify you can still open the app and see all data.

### Phase 2: Add One Test User with Reduction

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, REGION
    ADMIN, YOUR-EMAIL@COMPANY.COM, *
    USER, TEST-USER@COMPANY.COM, NORTH
];
SECTION APPLICATION;
```

Log in as the test user and verify:
- [ ] App opens successfully
- [ ] Only "NORTH" data is visible
- [ ] Charts and KPIs reflect filtered data
- [ ] No other regions appear in filter panes

### Phase 3: Verify Strict Exclusion

Try to open the app as a user NOT in the access table. They should get an "Access denied" error.

### Phase 4: Test OMIT (If Used)

```qlik
SECTION ACCESS;
LOAD * INLINE [
    ACCESS, USERID, OMIT
    ADMIN, YOUR-EMAIL@COMPANY.COM,
    USER, TEST-USER@COMPANY.COM, Salary;Bonus
];
SECTION APPLICATION;
```

As the test user, verify:
- [ ] Salary field doesn't appear in field lists
- [ ] Bonus field doesn't appear in field lists
- [ ] Charts referencing Salary/Bonus show no data or are hidden

## Debugging Checklist

### "User can't open the app"

1. Is the user listed in Section Access? (strict exclusion)
2. Is `Upper()` applied to USERID? (case mismatch)
3. Does the USERID format match?
   - Cloud: `alice@company.com` → `ALICE@COMPANY.COM`
   - QSEoW: `DOMAIN\USERNAME`
4. Is there a typo in the email/username?

### "User sees all data (no reduction)"

1. Does the reduction field name in Section Access match the data model? (exact match after uppercase)
2. Is the reduction field loaded with `Upper()` in BOTH Section Access AND the data model?
3. Is the user's ACCESS level `ADMIN`? (admins bypass reduction)
4. Is the wildcard `*` set for the reduction field? (grants all values)

### "User sees no data"

1. Does the reduction field value match any data? (e.g., 'NORTH' exists in the data?)
2. Are there multiple reduction fields? (all must match)
3. Is the data model field also uppercased?

### "Some tables not reduced"

Reduction only applies to tables that **contain the reduction field**. If a table doesn't have the REGION field, it won't be filtered by REGION-based reduction.

Fix: Ensure the reduction field exists in all tables that should be restricted, or use a common key field.

## Verification Expressions

Add these to a hidden sheet for testing:

```qlik
// Current user
=OSUser()

// Number of distinct values in reduction field (should be 1 for restricted users)
=Count(DISTINCT REGION)

// Total rows visible (compare against expected)
=Count(OrderID)

// Check if Section Access is active
=IsPartialReload()
```

## Testing in Qlik Cloud

1. **Use a second browser profile** — Log in as the test user in an incognito/private window
2. **Check the audit log** — Management Console → Audit → filter by app name
3. **Use the API** — `GET /api/v1/apps/{appId}/data/metadata` to verify available fields

## Testing in QSEoW

1. **QMC User impersonation** — Use the virtual proxy with a test user header
2. **Audit log** — Check Engine logs for Section Access evaluation
3. **Data Model Viewer** — Open as different users to verify field visibility
