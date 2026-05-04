# Qlik Cloud Deployment Checklist

## Pre-Deployment

- [ ] App reloads successfully in DEV with clean log (no warnings)
- [ ] Data model verified in Data Model Viewer (no synthetic keys)
- [ ] Section Access configured and tested (if required)
- [ ] All `lib://` paths use variables for environment portability
- [ ] Environment variable (`vEnvironment`) set correctly for target
- [ ] No hardcoded paths, credentials, or tenant URLs in script
- [ ] TRACE statements present for key pipeline steps
- [ ] Temporary tables dropped after use

## Data Connections

- [ ] Target space has all required data connections
- [ ] Connection names match what the script expects
- [ ] Credentials are valid and not expired
- [ ] Data Gateway is healthy (if using on-premise sources)
- [ ] QVD storage space has sufficient quota

## Space & Permissions

- [ ] Target space exists (shared for TEST, managed for PROD)
- [ ] Space members assigned with correct roles
- [ ] App owner has at least "contributor" role in target space
- [ ] Data connections are shared with the target space

## Reload Schedule

- [ ] Schedule configured with correct frequency
- [ ] Time zone set correctly
- [ ] Reload window doesn't conflict with source system maintenance
- [ ] Monitoring configured for reload failure alerts
- [ ] Task chain set up if multiple apps depend on each other

## Publishing (Managed Space)

- [ ] App published from shared space to managed space
- [ ] Published app name is clear and follows naming convention
- [ ] Previous version archived or removed
- [ ] End users notified of new/updated app

## Post-Deployment

- [ ] First scheduled reload completed successfully
- [ ] Data verified against source (spot-check row counts, KPIs)
- [ ] Section Access verified with test users
- [ ] Bookmarks and sheets display correctly
- [ ] Performance acceptable (load times, responsiveness)
- [ ] Backup exported (app without data)

## Rollback Plan

- [ ] Previous app version exported and stored
- [ ] Rollback steps documented
- [ ] Data connections for previous version still available
