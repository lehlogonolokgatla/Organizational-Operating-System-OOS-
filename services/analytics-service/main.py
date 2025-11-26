import requests
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="OOS Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

REGISTRY_URL = "http://org-registry:8000/api/org/tree"


# --- ANALYTICS ENGINE ---

def calculate_stats(node, stats=None):
    if stats is None:
        stats = {"filled": 0, "total": 0}

    for role in node.get('roles', []):
        count = role.get('count', 1)
        occupant = role.get('occupant', 'Vacant')

        stats["total"] += count
        if occupant != 'Vacant':
            stats["filled"] += 1  # Assuming 1 person per role for MVP logic

    for child in node.get('children', []):
        calculate_stats(child, stats)

    return stats


def analyze_node(node, depth=0, issues=None):
    if issues is None: issues = []

    # 1. Staffing Health
    roles = node.get('roles', [])
    total_roles = sum([r.get('count', 1) for r in roles])
    vacant_roles = len([r for r in roles if r.get('occupant') == 'Vacant'])

    # Flag if roles exist but are empty
    if total_roles > 0:
        vacancy_rate = (vacant_roles / total_roles) * 100
        if vacancy_rate == 100:
            issues.append({"unit": node['name'], "severity": "Critical", "type": "Staffing",
                           "message": "Unit is completely vacant (100%)."})
        elif vacancy_rate > 30:
            issues.append({"unit": node['name'], "severity": "Warning", "type": "Staffing",
                           "message": f"High vacancy rate ({vacancy_rate:.0f}%)."})

    # 2. Performance Health
    metrics = node.get('metrics', [])
    metric_sum = 0;
    metric_count = 0

    for m in metrics:
        targets = m.get('targets', {})
        actuals = m.get('actuals', {})
        q_scores = []
        for q in ['q1', 'q2', 'q3', 'q4']:
            t = targets.get(q, 0)
            a = actuals.get(q, 0)
            if t > 0: q_scores.append(min((a / t) * 100, 120))

        if q_scores:
            metric_sum += sum(q_scores) / len(q_scores)
            metric_count += 1

    if metric_count > 0:
        avg_score = metric_sum / metric_count
        if avg_score < 60:
            issues.append({"unit": node['name'], "severity": "Critical", "type": "Performance",
                           "message": f"Critical underperformance ({avg_score:.0f}% achievement)."})

    # Recurse
    for child in node.get('children', []):
        analyze_node(child, depth + 1, issues)

    return issues


def find_node_by_name(node, name):
    if node['name'] == name: return node
    for child in node.get('children', []):
        found = find_node_by_name(child, name)
        if found: return found
    return None


# --- ENDPOINTS ---

@app.get("/api/analytics/headcount")
def get_headcount():
    try:
        response = requests.get(REGISTRY_URL)
        if response.status_code != 200: return {"error": "Registry unavailable"}
        root = response.json().get('root_unit')
        if not root: return {"filled": 0, "total": 0}

        stats = calculate_stats(root)
        return stats
    except Exception as e:
        return {"error": str(e)}


@app.get("/api/analytics/diagnostics")
def get_system_diagnostics():
    try:
        response = requests.get(REGISTRY_URL)
        root = response.json().get('root_unit')
        if not root: return []
        return analyze_node(root)
    except Exception as e:
        return []


@app.get("/api/analytics/performance/{unit_name}")
def get_unit_performance(unit_name: str):
    try:
        response = requests.get(REGISTRY_URL)
        root = response.json().get('root_unit')
        target_node = find_node_by_name(root, unit_name)

        # Logic reused from analyze_node but specific to single unit for sidebar
        metrics = target_node.get('metrics', [])
        metric_sum = 0;
        metric_count = 0
        for m in metrics:
            targets = m.get('targets', {})
            actuals = m.get('actuals', {})
            q_scores = []
            for q in ['q1', 'q2', 'q3', 'q4']:
                t = targets.get(q, 0)
                a = actuals.get(q, 0)
                if t > 0: q_scores.append(min((a / t) * 100, 120))
            if q_scores:
                metric_sum += sum(q_scores) / len(q_scores)
                metric_count += 1

        final_score = (metric_sum / metric_count) if metric_count > 0 else None
        status = "Healthy"
        if final_score is not None:
            if final_score < 60:
                status = "Critical"
            elif final_score < 90:
                status = "At Risk"
            final_score = round(final_score, 1)
        else:
            final_score = "N/A"
            status = "No Data"

        return {
            "unit": unit_name,
            "overall_score": final_score,
            "overall_status": status,
            "metrics": metrics
        }
    except Exception as e:
        return {"error": str(e)}