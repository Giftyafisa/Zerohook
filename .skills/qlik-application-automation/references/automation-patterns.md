# Advanced Automation Patterns

## 1. Bi-Directional Orchestration (Writeback)

This pattern extracts data from Qlik, transforms it, and pushes it to an external API (like a CRM or ERP).

### Use Case
A user makes adjustments to a forecast in a Qlik app using a writeback extension. An automation detects the changes and pushes them to Salesforce.

### Architecture
1. **App**: User clicks a "Sync to CRM" button.
2. **Button Action**: Triggers an Automation Webhook (passing the `AppID` and user details).
3. **Automation**:
   - `Trigger`: Webhook
   - `Qlik Services`: `Get Straight Table Data` (pulls the edited forecast numbers)
   - `Loop`: For each row in the table
     - `Salesforce`: `Update Record` (push new numbers)
   - `Qlik Services`: `Do Reload` (reloads the app to reflect the successfully synced data from Salesforce)
   - `Microsoft Teams`: "Forecast synced successfully by {User}"

## 2. Dynamic Data Alerting (Anomaly Detection)

Instead of a hardcoded threshold (e.g., "Margin < 15%"), alert when a metric deviates from its statistical norm.

### Architecture
1. **Load Script**: Calculate the mean and standard deviation for the KPI over the last 30 days. Store these as variables (`vMean`, `vStdDev`).
2. **Automation**:
   - `Trigger`: App Reload
   - `Qlik Services`: `Get Measure Value` for "Today's Margin"
   - `Qlik Services`: `Get Variable Value` for `vMean` and `vStdDev`
   - `Condition`: Is `Today's Margin` < `(vMean - (2 * vStdDev))`?
   - `Yes`: Trigger Alert. "Margin is 2 standard deviations below the 30-day average!"

## 3. Graceful Failure & Retry Logic

Automations communicating with external APIs often encounter rate limits or temporary network issues.

### Architecture
1. `Loop`: 3 times (Retry counter)
2. `Block with Error Handling`: (e.g., Jira `Create Ticket`)
   - Settings → On Error → **Continue**
3. `Condition`: Did the previous block succeed?
   - `Yes`: `Exit Loop` (Success!)
   - `No`: `Sleep` for 30 seconds.
4. `Condition` (Outside loop): Did the loop finish all 3 times without success?
   - `Yes`: `Send Slack Message` "API is down after 3 retries." -> `Stop Automation` (Failed).

## 4. Multi-Tenant / Hub-and-Spoke Deployment

For partners managing multiple client Qlik Cloud tenants, Automations can deploy a "master app" to all client tenants simultaneously.

### Architecture
1. **Master Tenant**: Developer updates the Master App and triggers the Deployment Automation.
2. **Automation (Master Tenant)**:
   - `Qlik Services`: `Export App` (Downloads the QVF to the automation's temporary storage)
   - `Loop`: Over a list of client tenant URLs and API keys (stored in a Qlik data file or AWS Secrets)
     - `Call URL` (Raw HTTP Block): POST to `{Client_URL}/api/v1/apps/import` attaching the QVF and authenticating with the client's API key.
     - `Call URL`: POST to trigger a reload in the client tenant.
3. **Completion**: Send an email with a summary of successful and failed deployments.

## 5. Security & Access Auditing

Automate the monitoring of who is accessing sensitive apps.

### Architecture
1. **Trigger**: Scheduled (Weekly on Friday)
2. **Qlik Services**: `List App Access` (for the HR/Payroll app)
3. **Filter**: Remove users in the "HR_Admins" group.
4. **Condition**: Are there any remaining users? (Unauthorized access detected!)
5. **Yes**:
   - `Qlik Services`: `Remove User Access`
   - `ServiceNow`: `Create Incident` "Unauthorized access removed from Payroll app. Please investigate."
