import time
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

# Import database modules
from database import SessionLocal, create_tables, DBUnit, DBRole, DBEmployee, DBMetric, DBPermission, Base, engine

app = FastAPI(title="OOS Org Registry")

# --- CORS MIDDLEWARE ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- PYDANTIC MODELS ---

class UnitCreate(BaseModel):
    name: str
    type: str
    purpose: str
    parent_id: Optional[int] = None


class UnitUpdate(BaseModel):
    name: str
    type: str
    purpose: str
    functions: List[str] = []


class RoleCreate(BaseModel):
    unit_id: int
    title: str
    grade: str
    count: int


# Model for DESIGN MODE (Setting Targets)
class MetricDefinePayload(BaseModel):
    unit_id: int
    name: str
    measure_type: str = "Percentage"
    frequency: str = "Quarterly"
    t_q1: float = 0
    t_q2: float = 0
    t_q3: float = 0
    t_q4: float = 0


# Model for REPORT MODE (Setting Actuals)
class MetricReportPayload(BaseModel):
    unit_id: int
    name: str
    a_q1: float = 0
    a_q2: float = 0
    a_q3: float = 0
    a_q4: float = 0


class HireRequest(BaseModel):
    role_id: int
    candidate_name: str


class PermissionUpdate(BaseModel):
    role_id: int
    resource: str
    action: str
    value: bool


# --- DATABASE DEPENDENCY ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# --- STARTUP EVENT ---
@app.on_event("startup")
def startup_event():
    retries = 15
    while retries > 0:
        try:
            create_tables()
            print("--- Database Connected ---")
            break
        except OperationalError:
            retries -= 1
            time.sleep(3)

    if retries == 0:
        print("--- CRITICAL: Could not connect to Database. Exiting. ---")


# --- ENDPOINTS ---

@app.post("/api/org/unit")
def create_unit(item: UnitCreate, db: Session = Depends(get_db)):
    new_unit = DBUnit(
        name=item.name,
        type=item.type,
        purpose=item.purpose,
        parent_id=item.parent_id,
        functions=[]
    )
    db.add(new_unit)
    db.commit()
    db.refresh(new_unit)
    return new_unit


@app.put("/api/org/unit/{unit_id}")
def update_unit(unit_id: int, item: UnitUpdate, db: Session = Depends(get_db)):
    unit = db.query(DBUnit).filter(DBUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    unit.name = item.name
    unit.type = item.type
    unit.purpose = item.purpose
    unit.functions = item.functions

    db.commit()
    return {"status": "updated", "unit": unit.name}


@app.delete("/api/org/unit/{unit_id}")
def delete_unit(unit_id: int, db: Session = Depends(get_db)):
    unit = db.query(DBUnit).filter(DBUnit.id == unit_id).first()
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    db.query(DBMetric).filter(DBMetric.unit_id == unit_id).delete()
    roles = db.query(DBRole).filter(DBRole.unit_id == unit_id).all()
    for r in roles:
        db.query(DBPermission).filter(DBPermission.role_id == r.id).delete()
        db.delete(r)

    db.delete(unit)
    db.commit()
    return {"status": "deleted"}


@app.post("/api/org/role")
def add_role(item: RoleCreate, db: Session = Depends(get_db)):
    new_role = DBRole(title=item.title, grade=item.grade, count=item.count, unit_id=item.unit_id)
    db.add(new_role)
    db.commit()
    return {"status": "Role Added"}


@app.post("/api/org/hire")
def hire_employee(req: HireRequest, db: Session = Depends(get_db)):
    role = db.query(DBRole).filter(DBRole.id == req.role_id).first()
    if not role: raise HTTPException(status_code=404, detail="Role not found")

    new_emp = DBEmployee(
        name=req.candidate_name,
        email=f"{req.candidate_name.lower().replace(' ', '')}@gov.za"
    )
    db.add(new_emp)
    db.commit()

    role.employee_id = new_emp.id
    db.commit()
    return {"status": "Hired"}


@app.get("/api/org/employees")
def get_employees(db: Session = Depends(get_db)):
    return db.query(DBEmployee).all()


# --- METRICS: SPLIT ENDPOINTS ---

@app.post("/api/org/metric/define")
def define_metric(item: MetricDefinePayload, db: Session = Depends(get_db)):
    metric = db.query(DBMetric).filter(DBMetric.unit_id == item.unit_id, DBMetric.name == item.name).first()
    if not metric:
        metric = DBMetric(unit_id=item.unit_id, name=item.name)
        db.add(metric)

    metric.measure_type = item.measure_type
    metric.frequency = item.frequency
    metric.t_q1 = item.t_q1
    metric.t_q2 = item.t_q2
    metric.t_q3 = item.t_q3
    metric.t_q4 = item.t_q4

    db.commit()
    return {"status": "Targets Saved"}


@app.post("/api/org/metric/report")
def report_metric(item: MetricReportPayload, db: Session = Depends(get_db)):
    metric = db.query(DBMetric).filter(DBMetric.unit_id == item.unit_id, DBMetric.name == item.name).first()
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found. Define it in Design Mode first.")

    metric.a_q1 = item.a_q1
    metric.a_q2 = item.a_q2
    metric.a_q3 = item.a_q3
    metric.a_q4 = item.a_q4

    db.commit()
    return {"status": "Actuals Reported"}


@app.post("/api/org/permission")
def update_permission(req: PermissionUpdate, db: Session = Depends(get_db)):
    perm = db.query(DBPermission).filter(DBPermission.role_id == req.role_id,
                                         DBPermission.resource == req.resource).first()
    if not perm:
        perm = DBPermission(role_id=req.role_id, resource=req.resource)
        db.add(perm)
    if req.action == "C": perm.can_create = req.value
    if req.action == "R": perm.can_read = req.value
    if req.action == "U": perm.can_update = req.value
    if req.action == "D": perm.can_delete = req.value

    db.commit()
    return {"status": "updated"}


def build_tree(units):
    unit_map = {}
    for u in units:
        unit_map[u.id] = {
            "id": u.id,
            "name": u.name,
            "type": u.type,
            "purpose": u.purpose,
            "functions": u.functions or [],
            "roles": [{
                "id": r.id,
                "title": r.title,
                "grade": r.grade,
                "count": r.count,
                "occupant": r.employee.name if r.employee else "Vacant",
                "permissions": [{
                    "resource": p.resource,
                    "c": p.can_create,
                    "r": p.can_read,
                    "u": p.can_update,
                    "d": p.can_delete
                } for p in r.permissions]
            } for r in u.roles],
            "metrics": [{
                "id": m.id,
                "name": m.name,
                "measure_type": m.measure_type,
                "frequency": m.frequency,
                "targets": {"q1": m.t_q1, "q2": m.t_q2, "q3": m.t_q3, "q4": m.t_q4},
                "actuals": {"q1": m.a_q1, "q2": m.a_q2, "q3": m.a_q3, "q4": m.a_q4}
            } for m in u.metrics],
            "children": []
        }

    root = None
    for u in units:
        if u.parent_id:
            if u.parent_id in unit_map:
                unit_map[u.parent_id]["children"].append(unit_map[u.id])
        else:
            root = unit_map[u.id]

    return root


@app.get("/api/org/tree")
def get_org_tree(db: Session = Depends(get_db)):
    all_units = db.query(DBUnit).all()
    if not all_units: return {"root_unit": None}
    return {"root_unit": build_tree(all_units)}