---
name: qlik-license-management
description: >
  Manage Qlik Sense licenses, including Professional, Analyzer, and Capacity
  minutes. Covers the Qlik Licensing Service (QLS), assigning licenses to
  users and groups, tracking capacity usage, and handling license assignments
  via the Qlik Cloud Management Console and QSEoW QMC.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "1.0"
  category: qlik-security
---

# Qlik License Management

## When to Use

- User asks about the difference between Professional and Analyzer licenses
- User needs to assign a license to a user or group
- User mentions "Capacity minutes" or "Analyzer Capacity"
- User asks how to revoke a license from an inactive user
- User mentions the Qlik Licensing Service (QLS) or Qlik Cloud subscriptions

## License Types Overview

Qlik Sense uses a user-based and capacity-based licensing model.

| License Type | Capabilities | Typical User |
|---|---|---|
| **Professional** | Can create, edit, publish apps, load data, create spaces. Full developer and admin capabilities. | Developers, Admins, Power Users |
| **Analyzer** | Can only view published apps, create bookmarks, and export data. Cannot edit scripts or create charts. | Consumers, Executives |
| **Analyzer Capacity** | Same capabilities as Analyzer, but billed by the minute (time spent active in an app). | Infrequent users, public dashboards |

## Assigning Licenses (Qlik Cloud)

### Manual Assignment
1. Go to Qlik Cloud Management Console → **Users**.
2. Select a user → Click **Assign license**.
3. Choose Professional or Analyzer.

### Automatic Assignment via IdP Groups (Best Practice)
Instead of manually assigning licenses when users log in, set up auto-assignment rules based on Identity Provider (IdP) groups.

1. Go to Qlik Cloud Management Console → **Settings** → **Entitlement settings**.
2. Under "Auto-assign licenses", click **Create rule**.
3. **Condition:** If `Groups` contains `Qlik_Developers`.
4. **Action:** Assign `Professional` access.
5. Create a second rule: If `Groups` contains `Qlik_Consumers`, assign `Analyzer`.

*Now, when a user logs in for the first time (or is synced via SCIM), they automatically get the correct license based on their Active Directory/Okta group.*

### Analyzer Capacity Rules
If you have a pool of Analyzer Capacity minutes, you can configure Qlik Cloud to automatically consume minutes for users who don't have a dedicated license.
- In **Entitlement settings**, toggle **Enable dynamic assignment of Analyzer Capacity**.
- *Warning:* A user who leaves a dashboard open all day will drain your capacity minutes quickly. Use the session timeout settings (usually 30 mins of inactivity) to prevent this.

## Assigning Licenses (QSEoW On-Premise)

On-premise QSEoW uses the Qlik Licensing Service (QLS) to validate licenses with Qlik's cloud servers over port 443.

### License Allocation Rules
Similar to Qlik Cloud, you should automate license assignment using rules.

1. Go to QMC → **License management** → **Professional access rules** (or Analyzer).
2. Click **Create new**.
3. **Condition:** `user.group = "Qlik_Developers"`
4. When a user in that group logs in, they are instantly allocated a Professional license if one is available.

### Revoking Licenses
If a user leaves the company, their license remains "assigned" until you manually revoke it.
1. Go to QMC → **License management** → **Professional access allocations**.
2. Select the user → Click **Deallocate**.
3. *Note: In QSEoW, there is a 7-day quarantine period after deallocation before the license can be assigned to someone else. In Qlik Cloud, licenses can be reassigned immediately.*

## Monitoring License Usage

### Qlik Cloud
- Go to Management Console → **Home**. The dashboard shows total allocated licenses and Analyzer Capacity consumed this month.
- For detailed tracking, download the **Entitlement Analyzer** app from the Qlik Community and upload it to your tenant. It reads the Qlik Cloud Audit API to show exactly who is using capacity minutes.

### QSEoW
- Import the **License Monitor** app (found in `%ProgramData%\Qlik\Sense\Repository\DefaultApps`).
- This app reads the QSR database and log files to show license allocations, inactive users holding licenses, and peak concurrency.

[See references/license-troubleshooting.md for fixing common licensing errors]
