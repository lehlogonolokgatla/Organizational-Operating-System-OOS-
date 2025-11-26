from typing import List, Optional
from pydantic import BaseModel

class Role(BaseModel):
    title: str
    grade: str
    count: int = 1

class Unit(BaseModel):
    name: str
    type: str
    purpose: str
    functions: List[str] = []
    roles: List[Role] = []
    children: List['Unit'] = []

class Organization(BaseModel):
    name: str
    description: str
    root_unit: Unit

class Blueprint(BaseModel):
    organization: Organization