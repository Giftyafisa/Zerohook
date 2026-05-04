---
name: qlik-security-identity
description: >
  Configure security and identity for Qlik Cloud with clear guidance on SSO,
  SCIM, group-based access, tenant roles, and space governance, plus short
  client-managed notes where needed. Use when designing access models or
  troubleshooting identity flows.
license: Apache-2.0
platforms: ["cloud", "client-managed"]
runtime_scope: "shared"
metadata:
  author: raptor-codex
  version: "2.0"
  category: qlik-security
---

# Qlik Security & Identity Management

## When to Use

- User asks about Qlik Cloud SSO, SCIM, or IdP integration
- User wants to manage access through groups instead of individual users
- User needs guidance on Tenant Admin, Analytics Admin, or space roles
- User is troubleshooting group claims, subject mapping, or provisioning behavior
- User mentions QSEoW security rules and needs a client-managed comparison

## Cloud-First Security Model

In Qlik Cloud, default to this hierarchy:

1. Identity comes from the IdP
2. Users and groups are provisioned with SCIM where possible
3. Space roles control app and content access
4. Tenant roles are reserved for platform administration

Best-practice defaults:
- Use group-based assignment, not named-user assignment
- Keep production access in Managed spaces
- Separate tenant administration from everyday app development
- Treat identity mappings as part of platform governance, not just login setup

## SSO And Identity Provider Guidance

For Qlik Cloud, prefer OIDC unless the user is locked into SAML.

Critical mapping rules:
- Map the subject claim to an immutable identifier
- Ensure the same identifier is stable across login and provisioning flows
- Pass groups from the IdP when group-based governance is required
- Avoid changeable usernames as the primary identity key

If users lose access after a profile change, check the subject mapping first.

## SCIM And Group Provisioning

Use SCIM whenever the tenant needs predictable access before first login.

SCIM is especially important when:
- space access must be ready before onboarding day
- licenses or roles are managed centrally
- access reviews depend on group membership

Recommended operating model:
- Create business or platform groups in the IdP
- Sync users and groups into Qlik Cloud
- Assign space roles to groups
- Review tenant roles separately from app access

## Space Roles In Qlik Cloud

Default guidance:

- Shared spaces are for collaboration and controlled editing
- Managed spaces are for governed consumption and publication
- Use `Can Edit` or equivalent contributor roles for builders in Shared spaces
- Use `Can Publish`, `Can Contribute`, and `Can View` deliberately in Managed spaces

Avoid:
- granting broad admin roles to solve a narrow content-access problem
- assigning individuals directly when a stable group should own the access pattern
- mixing development and governed production consumption in the same space

## Tenant Roles

Use tenant roles sparingly and intentionally:

| Role Type | Use For |
|---|---|
| Tenant Admin | Tenant-wide identity, policy, and platform settings |
| Analytics Admin | Space, app, and analytics operations without full identity ownership |
| Other admin roles | Only when their scope is clearly required |

A user who only needs to view or publish analytics usually does not need a tenant-wide admin role.

## Troubleshooting Sequence

When access is failing in Qlik Cloud, check in this order:

1. Can the user authenticate successfully?
2. Does the subject claim match the expected Qlik identity?
3. Did SCIM or first-login provisioning create the user and groups?
4. Are the correct groups present in the tenant?
5. Does the target space grant the right role to the right group?
6. Is a tenant-wide role being confused with a space-level permission?

## If Client-Managed

For QSEoW, the access model shifts from Cloud roles to security rules and streams.

Short client-managed guidance:
- Use security rules and custom properties for ABAC patterns
- Keep stream access and app-specific access separate
- Do not reuse Cloud space-role guidance as if it mapped directly to QSEoW

If the user is clearly on client-managed, switch to `qlik-qseow-administration` for detailed rule patterns.

## Delivery Expectations

When responding:
- Default to Cloud identity and group governance
- State whether the issue is IdP, SCIM, tenant-role, or space-role related
- Mention client-managed differences only when they materially affect the answer

## References

- Pair with `qlik-cloud-spaces-governance` when access design depends on space operating models
- Pair with `qlik-section-access` when the user also needs row-level data reduction
