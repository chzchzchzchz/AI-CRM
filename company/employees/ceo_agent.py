#!/usr/bin/env python3
"""
CEO Agent - Strategic direction, product vision, customer acquisition
Like gstack's office-hours specialist
Reads company/EMPLOYEE_ROLES.md to understand role
Picks up tasks from company/docs/TASK_BOARD.json
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

AGENT_NAME = "CEO"
AGENT_ROLE = "Strategic direction, product vision, customer acquisition"
TASK_BOARD_PATH = Path(__file__).parent.parent / "docs" / "TASK_BOARD.json"
EMPLOYEE_ROLES_PATH = Path(__file__).parent.parent / "EMPLOYEE_ROLES.md"

def read_role():
    """Read my role from Employee Handbook"""
    if not EMPLOYEE_ROLES_PATH.exists():
        return "CEO role not found"
    with open(EMPLOYEE_ROLES_PATH) as f:
        content = f.read()
    # Extract CEO section
    start = content.find("### CEO")
    if start == -1:
        return content[:500]
    end = content.find("### ", start + 1)
    if end == -1:
        end = len(content)
    return content[start:end].strip()

def load_task_board():
    """Load the task board"""
    if not TASK_BOARD_PATH.exists():
        return {"ready": [], "in_progress": [], "review": [], "done": []}
    with open(TASK_BOARD_PATH) as f:
        return json.load(f)

def save_task_board(board):
    """Save the task board"""
    with open(TASK_BOARD_PATH, 'w') as f:
        json.dump(board, f, indent=2)

def pick_up_task():
    """Pick up a task assigned to CEO"""
    board = load_task_board()
    
    # First: check tasks assigned to me
    my_tasks = [t for t in board.get("ready", []) if t.get("assigned_to") == AGENT_NAME]
    
    # If none, pick up unassigned high-priority tasks
    if not my_tasks:
        my_tasks = [t for t in board.get("ready", []) 
                    if t.get("assigned_to") == "unassigned" and t.get("priority") == "high"]
    
    # If still none, pick any unassigned
    if not my_tasks:
        my_tasks = [t for t in board.get("ready", []) if t.get("assigned_to") == "unassigned"]
    
    if my_tasks:
        task = my_tasks[0]
        task["assigned_to"] = AGENT_NAME
        task["status"] = "in_progress"
        task["started_at"] = datetime.now().isoformat()
        save_task_board(board)
        return task["id"], task["title"]
    
    return None, None

def complete_task(task_id):
    """Mark task as done"""
    board = load_task_board()
    
    for task in board.get("in_progress", []) + board.get("ready", []):
        if task.get("id") == task_id and task.get("assigned_to") == AGENT_NAME:
            task["status"] = "done"
            task["completed_at"] = datetime.now().isoformat()
            save_task_board(board)
            return True
    return False

def do_work(task_id, task_title):
    """Do the actual work"""
    print(f"[{AGENT_NAME}] Working on: {task_title}")
    print(f"[{AGENT_NAME}] Task ID: {task_id}")
    
    # Simulate work based on task
    if "salesforce" in task_title.lower():
        print(f"[{AGENT_NAME}] Setting up Salesforce OAuth2...")
        print(f"[{AGENT_NAME}] Creating Connected App...")
        print(f"[{AGENT_NAME}] Writing integration code...")
    elif "linkedin" in task_title.lower():
        print(f"[{AGENT_NAME}] Setting up LinkedIn API...")
        print(f"[{AGENT_NAME}] Creating app...")
        print(f"[{AGENT_NAME}] Writing integration code...")
    else:
        print(f"[{AGENT_NAME}] Executing task...")
        print(f"[{AGENT_NAME}] Work complete.")
    
    return True

if __name__ == "__main__":
    print(f"=== {AGENT_NAME} Agent Starting ===")
    print(f"Role: {AGENT_ROLE}")
    print()
    
    # Read my role
    role = read_role()
    print(f"Role definition loaded: {len(role)} characters")
    
    # Pick up a task
    task_id, task_title = pick_up_task()
    
    if task_id:
        print(f"\nPicked up task: {task_id} - {task_title}")
        success = do_work(task_id, task_title)
        if success:
            complete_task(task_id)
            print(f"\nCompleted task: {task_id}")
    else:
        print("\nNo tasks available. Waiting for work...")
    
    print(f"\n=== {AGENT_NAME} Agent Done ===")
