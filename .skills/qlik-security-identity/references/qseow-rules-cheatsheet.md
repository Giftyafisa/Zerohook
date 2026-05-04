# Qlik Sense Enterprise on Windows (QSEoW) Security Rules Cheatsheet

QSEoW uses an Attribute-Based Access Control (ABAC) engine. This cheatsheet covers the most common and powerful security rule patterns.

## 1. The Core Principle: Additive Access
Qlik security rules are purely additive. You **cannot explicitly deny** access in a rule. If 100 rules say "False" and 1 rule says "True", the user gets access. To restrict access, you must alter the rules granting "True".

## 2. Resource Filters
The `Resource filter` determines what objects the rule applies to.

| Filter | Applies To |
|---|---|
| `App_*` | All Apps |
| `App_b0e9b...` | A specific App by ID |
| `Stream_*` | All Streams |
| `ReloadTask_*` | All Reload Tasks |
| `DataConnection_*` | All Data Connections |

## 3. Basic Stream Access by Active Directory Group
Grant read access to a stream if the user is in an Active Directory group with the exact same name as the stream.

**Filter**: `Stream_*`
**Actions**: Read
**Condition**:
```text
user.group = resource.name
```
*Why this is powerful: You write ONE rule, and it handles access for every stream automatically based on AD groups.*

## 4. App-Level Access via Custom Properties
Grant access to specific apps within a stream without granting access to the entire stream.

1. Create a Custom Property called `AppAccess` for both `App` and `User`.
2. Assign the value "HR_Dashboards" to an app.
3. Assign the value "HR_Dashboards" to a user.

**Filter**: `App_*`
**Actions**: Read
**Condition**:
```text
resource.@AppAccess = user.@AppAccess
```
*(Note: They also need read access to the stream to see the app in the hub).*

## 5. Developer Access to Specific Data Connections
Allow users in a specific group (e.g., "SQL_Developers") to use a specific data connection (e.g., "Finance_DB").

1. Create Custom Property `DBAccess` on `DataConnection` and `User`.
2. Assign "Finance" to the connection and the user.

**Filter**: `DataConnection_*`
**Actions**: Read
**Condition**:
```text
resource.@DBAccess = user.@DBAccess
```

## 6. The "Root Admin" Rule
By default, the `RootAdmin` role has access to everything. This is defined in the out-of-the-box rule `Security rule for RootAdmin`.

**Filter**: `*`
**Actions**: Create, Read, Update, Delete, Export, Publish, Change owner, Change role
**Condition**:
```text
user.roles = "RootAdmin"
```

## 7. Reload Task Delegation (Task Admins)
Allow specific users to trigger and monitor reload tasks for specific apps, without giving them full QMC access.

**Filter**: `ReloadTask_*`
**Actions**: Read, Update
**Condition**:
```text
user.group = "TaskAdmins" and resource.app.@AppAccess = user.@AppAccess
```
*(This allows users in the TaskAdmins group to manage reloads for apps they have custom property access to).*

## 8. Identifying Overly Permissive Rules
If a user can see an app they shouldn't, use the **Audit** section in the QMC.
1. Go to QMC → Audit.
2. Target Resource: Select the App.
3. Users: Select the specific user.
4. Click **Audit**.
5. Click on the "Read" cell in the grid. It will tell you *exactly* which Security Rule evaluated to `True` to grant that access.
