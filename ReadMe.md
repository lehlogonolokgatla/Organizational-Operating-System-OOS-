Organizational Operating System (OOS)

A Digital Twin platform for modeling, staffing, and analyzing organizational performance in real-time.

<img width="1297" height="616" alt="node creation" src="https://github.com/user-attachments/assets/880a20f7-a167-487c-82ef-eeb560c17afb" />


📌 Overview

OOS enables governments, hospitals and enterprises to design their organograms, allocate staff, define KPIs/metrics, and monitor performance over time — all inside an interactive digital twin.

🚀 Key Features
🏛 Digital Twin

Visualize the full organizational structure using ReactFlow-powered node trees.

🧩 Org Designer

Drag-and-drop creation of Departments, Units, Roles & Reporting Lines.
<img width="1297" height="616" alt="staff overview" src="https://github.com/user-attachments/assets/b10e68ca-a6e6-4890-96a0-91414ab538de" />

📊 M&E Engine
<img width="1297" height="616" alt="metrics" src="https://github.com/user-attachments/assets/6eacb78d-db63-4f36-95f7-86114824ad2d" />

Track Planned Targets vs Actuals, analyze variance, and monitor scorecards live.

🔍 Smart Diagnostics

Automated Health Check flags performance risks such as:

High vacancy rates

Underperformance on scorecard metrics

Budget overspend alerts

🔐 Governance & RBAC

Role-based access control for managing authorization & permissions.

🛠 Tech Stack
Layer	Technology
Frontend	React + Vite + ReactFlow
Backend	FastAPI (Python)
Database	PostgreSQL (Docker)
Deployment	Docker Compose
⚡ Quick Start
docker-compose up --build


Then open:

http://localhost:5173

📸 Platform Screenshots
🔹 Organogram View (Digital Twin)

🔹 Staff Assignment Screen

🔹 Metrics & Scorecard Tracking

📡 Capabilities Summary
Mode	Functionality
Design Mode	Build org charts, units, roles, hierarchies
Staff Mode	Assign personnel to posts, manage grades & roles
Metrics Mode	Define KPIs, targets, scorecards & track progress
Governance Mode	RBAC + health compliance modelling
View Mode	Visual roll-up indicators (traffic lights, variance bars)
Report Mode	Capture quarterly actual performance values
🔥 Future Add-Ons

AI-based workforce optimization

Document + process map linking

API export to ERP / HR systems
