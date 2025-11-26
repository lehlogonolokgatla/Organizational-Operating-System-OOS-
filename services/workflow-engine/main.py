from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uuid
from datetime import datetime

app = FastAPI(title="OOS Workflow Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class WorkflowCreate(BaseModel):
    type: str
    requester_role: str
    details: dict

class Task(BaseModel):
    id: str
    status: str
    type: str
    created_at: str
    details: dict

# In-memory store
tasks = []

@app.post("/api/workflows/start", response_model=Task)
def start_workflow(wf: WorkflowCreate):
    task_id = str(uuid.uuid4())
    new_task = Task(
        id=task_id,
        status="PENDING_APPROVAL",
        type=wf.type,
        created_at=datetime.now().strftime("%H:%M"),
        details=wf.details
    )
    tasks.insert(0, new_task) # Add to top of list
    return new_task

@app.get("/api/workflows/tasks")
def get_tasks():
    return tasks

# --- NEW: ACTION ENDPOINTS ---

@app.post("/api/workflows/{task_id}/approve")
def approve_task(task_id: str):
    for task in tasks:
        if task.id == task_id:
            task.status = "APPROVED"
            return task
    raise HTTPException(status_code=404, detail="Task not found")

@app.post("/api/workflows/{task_id}/reject")
def reject_task(task_id: str):
    for task in tasks:
        if task.id == task_id:
            task.status = "REJECTED"
            return task
    raise HTTPException(status_code=404, detail="Task not found")