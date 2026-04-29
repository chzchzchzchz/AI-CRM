#!/usr/bin/env python3
"""
Marketing Agent - Brand awareness, content, lead generation
Like gstack's marketing specialist
"""
import json
import os
from pathlib import Path
from datetime import datetime

AGENT_NAME = "Marketing"
AGENT_ROLE = "Brand awareness, content marketing, lead generation"
TASK_BOARD_PATH = Path(__file__).parent.parent / "docs" / "TASK_BOARD.json"
EMPLOYEE_ROLES_PATH = Path(__file__).parent.parent / "EMPLOYEE_ROLES.md"

def read_role():
    if not EMPLOYEE_ROLES_PATH.exists():
        return "Marketing role not found"
    with open(EMPLOYEE_ROLES_PATH) as f:
        content = f.read()
    start = content.find("### Marketing")
    if start == -1:
        return content[:500]
    end = content.find("### ", start + 1)
    if end == -1:
        end = len(content)
    return content[start:end].strip()

def load_task_board():
    if not TASK_BOARD_PATH.exists():
        return {"ready": [], "in_progress": [], "review": [], "done": []}
    with open(TASK_BOARD_PATH) as f:
        return json.load(f)

def pick_up_task():
    board = load_task_board()
    my_tasks = [t for t in board.get("ready", []) if t.get("assigned_to") == AGENT_NAME]
    if not my_tasks:
        my_tasks = [t for t in board.get("ready", []) 
                    if t.get("assigned_to") == "unassigned" and 
                    t.get("department") == "marketing"]
    if my_tasks:
        task = my_tasks[0]
        task["assigned_to"] = AGENT_NAME
        task["status"] = "in_progress"
        task["started_at"] = datetime.now().isoformat()
        with open(TASK_BOARD_PATH, 'w') as f:
            json.dump(board, f, indent=2)
        return task["id"], task["title"]
    return None, None

def complete_task(task_id):
    board = load_task_board()
    for task in board.get("in_progress", []) + board.get("ready", []):
        if task.get("id") == task_id and task.get("assigned_to") == AGENT_NAME:
            task["status"] = "done"
            task["completed_at"] = datetime.now().isoformat()
            for key in ["ready", "in_progress", "review"]:
                board[key] = [t for t in board[key] if t["id"] != task_id]
            if "done" not in board:
                board["done"] = []
            board["done"].append(task)
            with open(TASK_BOARD_PATH, 'w') as f:
                json.dump(board, f, indent=2)
            return True, "Task completed"
    return False, "Task not found or not assigned to me"

def do_work(task_id, task_title):
    print(f"[{AGENT_NAME}] Marketing: {task_title}")
    if "blog" in task_title.lower():
        print(f"[{AGENT_NAME}] Writing blog post...")
    elif "content" in task_title.lower():
        print(f"[{AGENT_NAME}] Creating content...")
    elif "seo" in task_title.lower():
        print(f"[{AGENT_NAME}] Optimizing SEO...")
    else:
        print(f"[{AGENT_NAME}] Executing marketing task...")
    return True

if __name__ == "__main__":
    print(f"=== {AGENT_NAME} Agent Starting ===")
    role = read_role()
    print(f"Role loaded: {len(role)} characters")
    print()
    task_id, title = pick_up_task()
    if task_id:
        print(f"Picked up task: {task_id} - {title}")
        success = do_work(task_id, title)
        if success:
            ok, msg = complete_task(task_id)
            print(f"{msg}")
    else:
        print("No tasks available. Waiting...")
    print(f"\n=== {AGENT_NAME} Agent Done ===")
