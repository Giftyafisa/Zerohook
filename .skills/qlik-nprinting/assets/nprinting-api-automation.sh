#!/bin/bash
# ============================================================
# NPrinting API Automation Script
# ============================================================
# Usage: ./nprinting-api-automation.sh <action> [options]
# Actions: login, list-reports, list-tasks, run-task, status
#
# Prerequisites:
# - curl with NTLM support
# - NPrinting Server accessible
# ============================================================

NPRINTING_SERVER="https://nprinting-server:4993"
NPRINTING_DOMAIN="YOURDOMAIN"
NPRINTING_USER="serviceaccount"
NPRINTING_PASS="password"
COOKIE_FILE="/tmp/nprinting_cookies.txt"

# --- Login ---
login() {
    echo "Authenticating to NPrinting..."
    curl -s -X POST "${NPRINTING_SERVER}/api/v1/login/ntlm" \
        -u "${NPRINTING_DOMAIN}\\${NPRINTING_USER}:${NPRINTING_PASS}" \
        --ntlm \
        -c "${COOKIE_FILE}" \
        -o /dev/null -w "%{http_code}"
    echo ""
}

# --- List Reports ---
list_reports() {
    echo "Listing reports..."
    curl -s "${NPRINTING_SERVER}/api/v1/reports" \
        -b "${COOKIE_FILE}" | python3 -m json.tool
}

# --- List Publish Tasks ---
list_tasks() {
    echo "Listing publish tasks..."
    curl -s "${NPRINTING_SERVER}/api/v1/tasks" \
        -b "${COOKIE_FILE}" | python3 -m json.tool
}

# --- Run a Publish Task ---
run_task() {
    TASK_ID=$1
    if [ -z "$TASK_ID" ]; then
        echo "Usage: run-task <TASK_ID>"
        exit 1
    fi
    
    echo "Triggering task ${TASK_ID}..."
    curl -s -X POST "${NPRINTING_SERVER}/api/v1/tasks/${TASK_ID}/executions" \
        -b "${COOKIE_FILE}" \
        -H "Content-Type: application/json" \
        -d '{"type": "Publish"}' | python3 -m json.tool
}

# --- Check Task Status ---
task_status() {
    TASK_ID=$1
    if [ -z "$TASK_ID" ]; then
        echo "Usage: status <TASK_ID>"
        exit 1
    fi
    
    echo "Checking status for task ${TASK_ID}..."
    curl -s "${NPRINTING_SERVER}/api/v1/tasks/${TASK_ID}/executions?limit=5" \
        -b "${COOKIE_FILE}" | python3 -m json.tool
}

# --- Main ---
ACTION=$1
shift

case $ACTION in
    login)       login ;;
    list-reports) list_reports ;;
    list-tasks)  list_tasks ;;
    run-task)    run_task "$1" ;;
    status)      task_status "$1" ;;
    *)
        echo "NPrinting API Automation"
        echo "Usage: $0 <action> [options]"
        echo ""
        echo "Actions:"
        echo "  login         Authenticate to NPrinting"
        echo "  list-reports  List all report templates"
        echo "  list-tasks    List all publish tasks"
        echo "  run-task ID   Trigger a publish task"
        echo "  status ID     Check task execution status"
        ;;
esac
