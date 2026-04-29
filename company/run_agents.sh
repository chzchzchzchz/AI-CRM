#!/bin/bash
# AI-CRM Autonomous Agent Runner
# Continuously runs agents to pick up and execute tasks

AGENT_DIR="/Users/MohssineChazi2/AI-CRM/AI-CRM/company/employees"
LOG_FILE="/Users/MohssineChazi2/AI-CRM/AI-CRM/company/logs/agent-runner.log"

mkdir -p "$(dirname "$LOG_FILE")"

echo "[$(date)] AI-CRM Agent Runner started" >> "$LOG_FILE"

while true; do
    echo "[$(date)] Checking for tasks..." >> "$LOG_FILE"
    
    # Run each agent
    for agent in ceo_agent sales_lead_agent backend_dev_agent frontend_dev_agent designer_agent \
                   eng_lead_agent qa_lead_agent devops_agent marketing_agent \
                   support_agent db_architect_agent security_agent release_agent \
                   performance_agent sre_agent data_analyst_agent office_hours_agent \
                   plan_ceo_review_agent plan_eng_review_agent design_review_agent \
                   metrics_agent cso_agent land_and_deploy_agent canary_agent \
                   scout_agent api_agent ci_cd_agent docs_agent integration_agent \
                   mobile_agent hr_agent legal_agent sales_ops_agent; do
        
        if [ -f "$AGENT_DIR/$agent.py" ]; then
            echo "[$(date)] Running $agent..." >> "$LOG_FILE"
            cd "$AGENT_DIR" && python3 "$agent.py" >> "$LOG_FILE" 2>&1
        fi
    done
    
    echo "[$(date)] Sleep 60s..." >> "$LOG_FILE"
    sleep 60
done
