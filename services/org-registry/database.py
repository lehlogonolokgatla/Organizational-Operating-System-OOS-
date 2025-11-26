import os
from sqlalchemy import create_engine, Column, Integer, String, ForeignKey, JSON, Float, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://oos_user:oos_password@db/oos_db")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- ORG STRUCTURE ---
class DBUnit(Base):
    __tablename__ = "units"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    type = Column(String)
    purpose = Column(String)
    functions = Column(JSON)
    parent_id = Column(Integer, ForeignKey("units.id"), nullable=True)

    children = relationship("DBUnit", backref="parent", remote_side=[id])
    roles = relationship("DBRole", back_populates="unit")
    metrics = relationship("DBMetric", back_populates="unit")


class DBRole(Base):
    __tablename__ = "roles"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    grade = Column(String)
    count = Column(Integer)
    unit_id = Column(Integer, ForeignKey("units.id"))
    employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)

    unit = relationship("DBUnit", back_populates="roles")
    employee = relationship("DBEmployee", back_populates="role")
    permissions = relationship("DBPermission", back_populates="role")


class DBEmployee(Base):
    __tablename__ = "employees"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True)
    role = relationship("DBRole", back_populates="employee", uselist=False)


class DBPermission(Base):
    __tablename__ = "permissions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"))
    resource = Column(String)
    can_create = Column(Boolean, default=False)
    can_read = Column(Boolean, default=False)
    can_update = Column(Boolean, default=False)
    can_delete = Column(Boolean, default=False)
    role = relationship("DBRole", back_populates="permissions")


class DBMetric(Base):
    __tablename__ = "metrics"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    unit_id = Column(Integer, ForeignKey("units.id"))
    name = Column(String)
    measure_type = Column(String)
    frequency = Column(String, default="Quarterly")

    t_q1 = Column(Float, default=0.0)
    t_q2 = Column(Float, default=0.0)
    t_q3 = Column(Float, default=0.0)
    t_q4 = Column(Float, default=0.0)
    a_q1 = Column(Float, default=0.0)
    a_q2 = Column(Float, default=0.0)
    a_q3 = Column(Float, default=0.0)
    a_q4 = Column(Float, default=0.0)

    unit = relationship("DBUnit", back_populates="metrics")


def create_tables():
    Base.metadata.create_all(bind=engine)