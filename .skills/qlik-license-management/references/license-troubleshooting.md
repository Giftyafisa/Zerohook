# License Troubleshooting

This guide covers common errors encountered when allocating or managing Qlik Sense licenses.

## 1. "No access pass" Error on Login
**Symptom:** User logs into Qlik Sense but sees "You do not have an access pass". They cannot open any apps.
**Cause:** The user has authenticated successfully via the IdP (e.g., Okta/AD), but Qlik Sense has not allocated them a Professional or Analyzer license.
**Fix (Cloud):**
- Go to Management Console → Users → Assign a license manually.
- Or, set up an Auto-assign rule in Entitlement settings based on their IdP group.
**Fix (QSEoW):**
- Go to QMC → License Management → Professional/Analyzer access rules. Ensure a rule exists that matches their `user.group` or `user.userId`.
- Or, assign them an access pass manually.

## 2. QSEoW "Signed License Key not valid"
**Symptom:** QMC shows the Signed License Key (SLK) is invalid or cannot communicate with Qlik's licensing servers.
**Cause:** QSEoW uses a Signed License Key (a long string starting with `eyJhb...`) that must "phone home" to Qlik over port 443. The firewall is blocking outbound traffic to `license.qlikcloud.com`.
**Fix:**
- Ensure the Qlik Sense Central Node server has outbound internet access on port 443 to `license.qlikcloud.com`.
- If using a proxy, configure the proxy settings in the QMC under "License management".
- If the server is fully offline, you cannot use an SLK; you must use a legacy License Enabler File (LEF), which requires a special offline exception from Qlik Support.

## 3. "Too many users allocated"
**Symptom:** You try to allocate a Professional license to a new developer, but the QMC/Cloud console says you are out of licenses, even though you just removed an old user.
**Cause (QSEoW):** Qlik Sense on-premise has a **7-day quarantine period** for Professional and Analyzer licenses. If you remove User A's license today, you cannot give it to User B until 7 days have passed. This is to prevent "license multiplexing" (sharing one license among multiple people by swapping it daily).
**Fix (QSEoW):** You must wait 7 days, or purchase more licenses.
**Cause (Cloud):** Qlik Cloud does *not* have a 7-day quarantine. If you remove a license, it is immediately available. If you see this error in Cloud, you are truly out of licenses and must purchase more from your Qlik Account Manager.

## 4. Analyzer Capacity Minutes Draining Too Fast
**Symptom:** Your monthly pool of Analyzer Capacity minutes is exhausted within the first few days of the month.
**Cause:**
1. A user left a dashboard open in their browser overnight.
2. A TV or wall-monitor is displaying a dashboard 24/7 without a dedicated Analyzer license.
3. An automated script or testing tool is constantly refreshing the page.
**Fix:**
- **Short Session Timeout:** Ensure the session timeout in the QMC (QSEoW) or Management Console (Cloud) is set to 30 minutes. If a user is inactive, their session will end and they will stop consuming capacity minutes.
- **Dedicated License for TVs:** For wall-monitors displaying dashboards 24/7, assign them a dedicated Analyzer license instead of using Capacity minutes. One month has ~43,000 minutes; a 24/7 monitor will burn through an entire capacity pack in a week.
- **Monitor Usage:** Use the Entitlement Analyzer (Cloud) or License Monitor (QSEoW) apps to identify which specific users or IPs are consuming the most minutes and address them directly.
