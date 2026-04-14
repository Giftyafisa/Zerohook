# Incident Recovery Runbook

This runbook is a command-first checklist for emergency user-data recovery.

## 1. Preconditions

- Use a terminal in `server/`.
- Ensure `MONGODB_URI` is set to the intended target database.
- Keep apply steps gated behind explicit dry-run validation.

PowerShell (session-only URI):

```powershell
Set-Location C:/Users/OS/Desktop/Zerohook/server
$env:MONGODB_URI = "<secure-uri-here>"
```

## 2. Read-Only Audit

```powershell
node scripts/incident-db-audit.js
```

Expected output includes:

- collection counts
- user integrity stats
- `adminFlagged(is_admin/role=admin)`
- orphan reference counts

## 3. Stabilize Corrupted Users (Archive + Suspend)

Dry run:

```powershell
node scripts/incident-stabilize-users.js
```

Apply:

```powershell
node scripts/incident-stabilize-users.js --apply
```

## 4. Cloudinary-Guided Remediation

Dry run:

```powershell
node scripts/incident-cloudinary-remediate-users.js
```

Apply:

```powershell
node scripts/incident-cloudinary-remediate-users.js --apply
```

## 5. Rebuild Recovered Users as Test Profiles

Dry run:

```powershell
node scripts/incident-build-test-profiles-from-cloudinary.js
```

Apply:

```powershell
node scripts/incident-build-test-profiles-from-cloudinary.js --apply
```

## 6. Normalize Admin Flag Consistency

Dry run:

```powershell
node scripts/incident-normalize-admin-flags.js
```

Apply:

```powershell
node scripts/incident-normalize-admin-flags.js --apply
```

Normalization rules:

- `role='admin'` implies `is_admin=true`
- `is_admin=true` implies `role='admin'`

## 7. Restore From Trusted Snapshot JSON (If Available)

Dry run:

```powershell
node scripts/incident-restore-users-from-json.js --input "<path-to-snapshot.json>"
```

Apply:

```powershell
node scripts/incident-restore-users-from-json.js --input "<path-to-snapshot.json>" --apply
```

## 8. Post-Apply Verification

```powershell
node scripts/incident-db-audit.js
```

Hard checks:

- no encrypted corruption signatures in active users
- no orphan references in key collections
- admin mismatch count is 0

## 9. Commit and Push Incident Artifacts

From repo root:

```powershell
Set-Location C:/Users/OS/Desktop/Zerohook
git add .gitignore server/scripts/incident-*.js server/scripts/incident-recovery-runbook.md
git commit -m "chore: add incident recovery runbook and admin flag normalization"
git push origin main
```
