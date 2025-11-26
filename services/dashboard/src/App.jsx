import React, { useEffect, useState, useCallback } from 'react';
import ReactFlow, {
  useNodesState, useEdgesState, Controls, Background, Handle, Position, ReactFlowProvider, useReactFlow
} from 'reactflow';
import dagre from 'dagre';
import axios from 'axios';
import 'reactflow/dist/style.css';
import './index.css';

// --- STYLES ---
const styles = {
  layout: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8f9fa', overflow: 'hidden' },
  topBar: { height: '60px', background: 'white', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', zIndex: 10 },
  mainArea: { position: 'relative', flex: 1, overflow: 'hidden', display: 'flex' },
  sidebarContainer: (isOpen) => ({
    position: 'absolute', top: 0, right: 0, height: '100%', width: '400px', background: 'white', borderLeft: '1px solid #ddd',
    boxShadow: '-5px 0 15px rgba(0,0,0,0.1)', transform: isOpen ? 'translateX(0)' : 'translateX(100%)', transition: 'transform 0.3s ease-in-out',
    zIndex: 20, display: 'flex', flexDirection: 'column'
  }),
  closeBtn: { position: 'absolute', top: 15, right: 15, cursor: 'pointer', fontSize: '18px', color: '#999', background: 'none', border: 'none', zIndex: 25 },
  tabBar: { display: 'flex', borderBottom: '1px solid #eee', background: '#f8f9fa', marginTop: '40px' },
  tab: (active) => ({
    flex: 1, padding: '12px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', textAlign: 'center',
    background: active ? 'white' : 'transparent', borderTop: active ? '3px solid #007bff' : '3px solid transparent', color: active ? '#007bff' : '#666', borderBottom: active ? 'none' : '1px solid #eee'
  }),
  content: { padding: '20px', overflowY: 'auto', flex: 1 },
  input: { width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', boxSizing: 'border-box', minHeight: '60px', fontFamily: 'sans-serif' },
  select: { width: '100%', padding: '8px', marginBottom: '10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' },
  btn: (color = '#007bff') => ({ padding: '8px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', color: 'white', width: '100%', marginBottom: '5px', background: color }),
  label: { fontSize: '11px', fontWeight: 'bold', color: '#888', display: 'block', marginBottom: '4px' },
  roleBadge: { display: 'inline-block', fontSize: '10px', background: '#e3f2fd', color: '#007bff', padding: '2px 6px', borderRadius: '4px', marginBottom: '2px', border: '1px solid #b6d4fe' },
  funcItem: { display: 'flex', gap: '8px', marginBottom: '5px', alignItems: 'center' },
  removeBtn: { background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '4px 8px', height: '100%' },
  funcNum: { fontSize: '12px', color: '#999', fontWeight: 'bold', minWidth: '20px' },
  statusBadge: (status) => ({
    background: status === 'Critical' ? '#dc3545' : status === 'At Risk' ? '#ffc107' : '#28a745',
    color: 'white', padding: '2px 8px', borderRadius: '10px', fontSize: '10px', fontWeight: 'bold', float: 'right'
  }),
  crudBtn: (active) => ({
    fontSize: '9px', padding: '2px 6px', marginRight: '2px', border: '1px solid #ccc', borderRadius: '3px',
    cursor: 'pointer', background: active ? '#007bff' : 'white', color: active ? 'white' : '#333'
  }),
  modeBtn: (active) => ({
    padding: '6px 15px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
    background: active ? '#007bff' : 'transparent', color: active ? 'white' : '#555', transition: '0.2s'
  })
};

// --- COMPONENTS ---
const OrgNode = ({ data }) => {
  const visibleRoles = data.original.roles ? data.original.roles.slice(0, 3) : [];
  return (
    <div style={{ padding: '10px', borderRadius: '6px', background: 'white', border: '1px solid #ccc', width: '240px', minHeight: '80px', borderLeft: `6px solid ${data.isSelected ? '#007bff' : '#28a745'}`, boxShadow: '0 4px 6px rgba(0,0,0,0.05)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <Handle type="target" position={Position.Top} />
      <div style={{fontWeight: 'bold', fontSize: '14px', marginBottom: '2px', color: '#333', textAlign: 'center'}}>{data.label}</div>
      <div style={{fontSize: '10px', color: '#888', textTransform: 'uppercase', textAlign: 'center', marginBottom: '8px'}}>{data.type}</div>
      {visibleRoles.length > 0 && (
          <div style={{borderTop: '1px solid #eee', paddingTop: '5px', marginTop: '2px'}}>
            {visibleRoles.map((r, i) => (
                <div key={i} style={{fontSize: '11px', display: 'flex', justifyContent: 'space-between', marginBottom: '2px'}}>
                    <span style={{fontWeight: 'bold', color: '#555'}}>{r.title}</span>
                    <span style={{color: r.occupant === 'Vacant' ? '#dc3545' : '#28a745', fontSize: '10px'}}>{r.occupant === 'Vacant' ? 'Vacant' : '●'}</span>
                </div>
            ))}
          </div>
      )}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
};
const nodeTypes = { orgNode: OrgNode };

// --- LAYOUT ---
const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: direction });
  nodes.forEach((node) => dagreGraph.setNode(node.id, { width: 260, height: 120 }));
  edges.forEach((edge) => dagreGraph.setEdge(edge.source, edge.target));
  dagre.layout(dagreGraph);
  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = { x: nodeWithPosition.x - 130, y: nodeWithPosition.y - 60 };
  });
  return { nodes, edges };
};

const formatMetric = (value, type) => {
    if (!value) return "0";
    if (type === 'Percentage') return `${value}%`;
    if (type === 'Currency') return `R${value.toLocaleString()}`;
    return value.toLocaleString();
};

function Dashboard() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [orgData, setOrgData] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeMetrics, setNodeMetrics] = useState(null);
  const [mode, setMode] = useState('view');
  const [activeTab, setActiveTab] = useState('Overview');
  const [orientation, setOrientation] = useState('vertical');
  const [isSidebarOpen, setSidebarOpen] = useState(false);

  const [showReport, setShowReport] = useState(false);
  const [diagnostics, setDiagnostics] = useState([]);
  const [headcount, setHeadcount] = useState("0 / 0");

  // Inputs
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("");
  const [editPurpose, setEditPurpose] = useState("");
  const [editFunctions, setEditFunctions] = useState([]);
  const [newChildName, setNewChildName] = useState("");
  const [newChildType, setNewChildType] = useState("Sub-Directorate");
  const [newChildPurpose, setNewChildPurpose] = useState("");
  const [newRoleTitle, setNewRoleTitle] = useState("");
  const [newRoleGrade, setNewRoleGrade] = useState("SL");
  const [metricName, setMetricName] = useState("");
  const [metricType, setMetricType] = useState("Percentage");
  const [metricFreq, setMetricFreq] = useState("Quarterly");
  const [targets, setTargets] = useState({q1:0, q2:0, q3:0, q4:0});
  const [actuals, setActuals] = useState({q1:0, q2:0, q3:0, q4:0});

  const { fitView } = useReactFlow();
  useEffect(() => { refreshData(true); }, []);

  const refreshData = (shouldFitView = false) => {
    axios.get('http://localhost:8000/api/org/tree').then(res => {
      if(res.data.root_unit) {
        setOrgData(res.data); // Save raw data for export
        const { nodes: layoutNodes, edges: layoutEdges } = convertTreeToGraph(res.data.root_unit);
        const { nodes: finalNodes, edges: finalEdges } = getLayoutedElements(layoutNodes, layoutEdges, orientation === 'vertical' ? 'TB' : 'LR');
        setNodes(finalNodes);
        setEdges(finalEdges);
        if (shouldFitView) setTimeout(() => fitView({ padding: 0.2 }), 100);
        if(selectedNode) {
            const updated = findNodeRecursive(res.data.root_unit, selectedNode.id);
            if(updated) selectNode(updated, false);
            else { setSelectedNode(null); setSidebarOpen(false); }
        }
      }
    });
    axios.get('http://localhost:8002/api/analytics/headcount').then(res => { setHeadcount(`${res.data.filled} / ${res.data.total}`); }).catch(err => console.error("Headcount error", err));
  };

  // --- CSV EXPORT ---
  const handleExport = () => {
      const rows = [["Unit Name", "Type", "Purpose", "Roles (Filled/Total)"]];
      const traverse = (node) => {
          const total = node.roles.length;
          const filled = node.roles.filter(r => r.occupant !== 'Vacant').length;
          // Escape quotes for CSV
          const safePurpose = (node.purpose || "").replace(/"/g, '""');

          rows.push([
              `"${node.name}"`,
              node.type,
              `"${safePurpose}"`,
              `${filled}/${total}`
          ]);
          if(node.children) node.children.forEach(traverse);
      };
      if(orgData && orgData.root_unit) {
          traverse(orgData.root_unit);
          const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement("a");
          link.setAttribute("href", encodedUri);
          link.setAttribute("download", "OOS_Executive_Report.csv");
          document.body.appendChild(link);
          link.click();
          link.remove();
      } else { alert("No data to export"); }
  };

  const fetchDiagnostics = () => {
      axios.get('http://localhost:8002/api/analytics/diagnostics')
           .then(res => { setDiagnostics(res.data); setShowReport(true); });
  };

  const findNodeRecursive = (node, id) => {
      if(node.id === id) return node;
      for(let child of node.children) {
          const found = findNodeRecursive(child, id);
          if(found) return found;
      }
      return null;
  };

  const convertTreeToGraph = (root) => {
    let nodes = [];
    let edges = [];
    const traverse = (node) => {
      nodes.push({ id: node.id.toString(), type: 'orgNode', data: { label: node.name, type: node.type, original: node, isSelected: selectedNode?.id === node.id }, position: { x: 0, y: 0 } });
      if (node.children) {
        node.children.forEach(child => {
          edges.push({ id: `e${node.id}-${child.id}`, source: node.id.toString(), target: child.id.toString(), type: 'smoothstep' });
          traverse(child);
        });
      }
    };
    traverse(root);
    return { nodes, edges };
  };

  const onNodeClick = (event, node) => selectNode(node.data.original, true);

  const selectNode = (nodeData, updateState = true) => {
    setSelectedNode(nodeData);
    setSidebarOpen(true);
    if(updateState) {
        setEditName(nodeData.name); setEditType(nodeData.type); setEditPurpose(nodeData.purpose || ""); setEditFunctions(nodeData.functions || []);
        setActiveTab('Overview');
        setMetricName(""); setMetricFreq("Quarterly"); setTargets({q1:0, q2:0, q3:0, q4:0}); setActuals({q1:0, q2:0, q3:0, q4:0});
        setNewChildName(""); setNewChildPurpose(""); setNewRoleTitle(""); setNewRoleGrade("SL");
    }
    setNodes((nds) => nds.map((n) => ({ ...n, data: { ...n.data, isSelected: n.id === nodeData.id.toString() } })));
    axios.get(`http://localhost:8002/api/analytics/performance/${nodeData.name}`).then(res => setNodeMetrics(res.data)).catch(() => setNodeMetrics(null));
  };

  // --- ACTIONS ---
  const handleCreateRoot = () => { const name = prompt("Organisation Name:"); if(!name) return; axios.post('http://localhost:8000/api/org/unit', { name, type: "Organisation", purpose: "Head", parent_id: null }).then(() => refreshData(true)); };
  const handleUpdate = () => axios.put(`http://localhost:8000/api/org/unit/${selectedNode.id}`, { name: editName, type: editType, purpose: editPurpose, functions: editFunctions }).then(() => refreshData(false));
  const handleAddChild = () => axios.post('http://localhost:8000/api/org/unit', { name: newChildName, type: newChildType, purpose: newChildPurpose, parent_id: selectedNode.id }).then(() => { setNewChildName(""); setNewChildPurpose(""); refreshData(false); });
  const handleDelete = () => { if(confirm("Delete node?")) axios.delete(`http://localhost:8000/api/org/unit/${selectedNode.id}`).then(() => { setSelectedNode(null); setSidebarOpen(false); refreshData(true); }); };
  const handleAddRole = () => axios.post('http://localhost:8000/api/org/role', { unit_id: selectedNode.id, title: newRoleTitle, grade: newRoleGrade, count: 1 }).then(() => { setNewRoleTitle(""); refreshData(false); });
  const handleFillVacancy = (roleId) => { const personName = prompt("Enter Staff Name:"); if(!personName) return; axios.post('http://localhost:8000/api/org/hire', { role_id: roleId, candidate_name: personName }).then(() => { alert("Staff Assigned!"); refreshData(false); }); };
  const addFunction = () => setEditFunctions([...editFunctions, ""]);
  const updateFunction = (index, value) => { const newFuncs = [...editFunctions]; newFuncs[index] = value; setEditFunctions(newFuncs); };
  const removeFunction = (index) => { const newFuncs = editFunctions.filter((_, i) => i !== index); setEditFunctions(newFuncs); };

  const handleEditMetricClick = (m) => {
      if(mode === 'view') return;
      setMetricName(m.name); setMetricType(m.type); setMetricFreq(m.frequency || "Quarterly");
      setTargets(m.targets); setActuals(m.actuals);
  };

  const handleSaveMetric = () => {
    if (mode === 'design') {
        axios.post('http://localhost:8000/api/org/metric/define', {
            unit_id: selectedNode.id, name: metricName, measure_type: metricType, frequency: metricFreq,
            t_q1: Number(targets.q1), t_q2: Number(targets.q2), t_q3: Number(targets.q3), t_q4: Number(targets.q4)
        }).then(() => { alert("✅ Metric Saved"); setMetricName(""); refreshData(false); fetchMetrics(); });
    } else {
        axios.post('http://localhost:8000/api/org/metric/report', {
            unit_id: selectedNode.id, name: metricName,
            a_q1: Number(actuals.q1), a_q2: Number(actuals.q2), a_q3: Number(actuals.q3), a_q4: Number(actuals.q4)
        }).then(() => { alert("✅ Report Submitted"); setMetricName(""); refreshData(false); fetchMetrics(); });
    }
  };

  const fetchMetrics = () => {
      axios.get(`http://localhost:8002/api/analytics/performance/${selectedNode.name}`)
           .then(res => setNodeMetrics(res.data));
  }

  const togglePermission = (roleId, resource, action, currentValue) => { if (mode !== 'design') return; axios.post('http://localhost:8000/api/org/permission', { role_id: roleId, resource, action, value: !currentValue }).then(() => refreshData(false)); };
  const checkPerm = (role, resource, action) => { const p = role.permissions?.find(p => p.resource === resource); if (!p) return false; return action === 'C' ? p.c : action === 'R' ? p.r : action === 'U' ? p.u : p.d; };

  return (
    <div style={styles.layout}>
      <div style={styles.topBar}>
        <div style={{display:'flex', alignItems:'center', gap:'10px'}}><span style={{fontSize: '24px'}}>🏛️</span><h2 style={{margin:0, fontSize:'18px', color:'#333'}}>OOS Digital Twin</h2>
            <span style={{marginLeft:'15px', background:'#e3f2fd', color:'#007bff', padding:'4px 10px', borderRadius:'20px', fontSize:'12px', fontWeight:'bold'}}>👥 Staff: {headcount}</span>
        </div>
        <div style={{display:'flex', gap:'10px'}}>
            <button onClick={handleExport} style={{...styles.btn('#17a2b8'), width:'auto', marginBottom:0}}>⬇️ Export</button>
            <button onClick={fetchDiagnostics} style={{...styles.btn('#6f42c1'), width:'auto', marginBottom:0}}>🩺 Health Check</button>
            <div style={{display:'flex', background:'#e9ecef', padding:'4px', borderRadius:'20px'}}>
                <button onClick={()=>setMode('view')} style={styles.modeBtn(mode==='view')}>👁️ View</button>
                <button onClick={()=>setMode('design')} style={styles.modeBtn(mode==='design')}>✏️ Design</button>
                <button onClick={()=>setMode('report')} style={styles.modeBtn(mode==='report')}>📊 Report</button>
            </div>
        </div>
      </div>

      <div style={styles.mainArea}>
        <div style={{ flex: 1, position: 'relative' }}>
            {nodes.length > 0 ? ( <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onNodeClick={onNodeClick} nodeTypes={nodeTypes} fitView><Background color="#f0f0f0" gap={20} /><Controls /></ReactFlow> ) : ( <div style={{display:'flex', justifyContent:'center', alignItems:'center', height:'100%'}}><button onClick={handleCreateRoot} style={{...styles.btn('#28a745'), width:'200px'}}>+ Create Organization</button></div> )}
            <div style={{position:'absolute', top:10, right:10, zIndex:5}}><button onClick={() => {setOrientation(orientation === 'vertical' ? 'horizontal' : 'vertical'); refreshData(true);}} style={{...styles.btn('#6c757d'), width:'auto', marginBottom:0}}>🔄 Rotate Layout</button></div>
        </div>

        {showReport && (
            <div style={{position:'fixed', top:0, left:0, width:'100%', height:'100%', background:'rgba(0,0,0,0.5)', zIndex:100, display:'flex', justifyContent:'center', alignItems:'center'}} onClick={() => setShowReport(false)}>
                <div style={{background:'white', width:'600px', padding:'20px', borderRadius:'8px'}} onClick={e => e.stopPropagation()}>
                    <h2>🩺 Organizational Health Report</h2>
                    {diagnostics.length === 0 ? <p style={{color:'green'}}>✅ All systems healthy.</p> : diagnostics.map((issue, i) => (
                        <div key={i} style={{borderLeft:`4px solid ${issue.severity==='Critical'?'red':'orange'}`, padding:'10px', background:'#f9f9f9', margin:'5px 0'}}>
                            <strong>{issue.unit}</strong> <small>({issue.type})</small><br/>{issue.message}
                        </div>
                    ))}
                </div>
            </div>
        )}

        <div style={styles.sidebarContainer(isSidebarOpen)}>
            <button onClick={() => setSidebarOpen(false)} style={styles.closeBtn}>✖</button>
            {selectedNode && (
                <>
                    <div style={{padding:'20px', paddingTop:'40px', background:'#fff', borderBottom:'1px solid #eee'}}><h2 style={{margin:0, color:'#007bff', fontSize:'18px'}}>{selectedNode.name}</h2><small style={{color:'#888', textTransform:'uppercase', fontSize:'10px'}}>{selectedNode.type}</small></div>
                    <div style={styles.tabBar}>{['Overview', 'Staff', 'Metrics', 'Governance'].map(t => ( <div key={t} style={styles.tab(activeTab === t)} onClick={() => setActiveTab(t)}>{t}</div> ))}</div>
                    <div style={styles.content}>
                        {activeTab === 'Overview' && ( <> <div style={{marginBottom:'20px'}}><span style={styles.label}>Unit Name</span><input style={styles.input} value={editName} onChange={e => setEditName(e.target.value)} disabled={mode !== 'design'} /><span style={styles.label}>Type</span><select style={styles.select} value={editType} onChange={e => setEditType(e.target.value)} disabled={mode !== 'design'}><option>Organisation</option><option>Department</option><option>Chief Directorate</option><option>Directorate</option><option>Sub-Directorate</option><option>Unit</option></select><span style={styles.label}>Purpose</span><textarea style={styles.textarea} value={editPurpose} onChange={e => setEditPurpose(e.target.value)} disabled={mode !== 'design'} /><span style={styles.label}>Key Functions</span>{editFunctions.map((func, idx) => ( <div key={idx} style={styles.funcItem}><span style={styles.funcNum}>{idx + 1}.</span><input style={{...styles.input, marginBottom:0}} value={func} onChange={(e) => updateFunction(idx, e.target.value)} disabled={mode !== 'design'} />{mode === 'design' && <button onClick={() => removeFunction(idx)} style={styles.removeBtn}>x</button>}</div> ))}{mode === 'design' && <button onClick={addFunction} style={{...styles.btn('transparent'), color:'#007bff', border:'1px dashed #007bff', marginTop:'5px'}}>+ Add Function</button>}{mode === 'design' && <button onClick={handleUpdate} style={{...styles.btn('#007bff'), marginTop:'15px'}}>Save Changes</button>}</div>{mode === 'design' && ( <> <hr style={{border:'0', borderTop:'1px solid #eee', margin:'20px 0'}} /><div style={{padding:'15px', background:'#f8f9fa', borderRadius:'8px', border:'1px dashed #ccc'}}><h4 style={{marginTop:0, color:'#007bff'}}>Add Sub-Unit</h4><input style={styles.input} placeholder="Name (e.g. Logistics)" value={newChildName} onChange={e => setNewChildName(e.target.value)} /><select style={styles.select} value={newChildType} onChange={e => setNewChildType(e.target.value)}><option>Department</option><option>Chief Directorate</option><option>Directorate</option><option>Sub-Directorate</option><option>Unit</option></select><input style={styles.input} placeholder="Description" value={newChildPurpose} onChange={e => setNewChildPurpose(e.target.value)} /><button onClick={handleAddChild} style={styles.btn('#28a745')}>+ Create Child Node</button></div><button onClick={handleDelete} style={{...styles.btn('#dc3545'), marginTop:'30px'}}>Delete This Unit</button> </> )} </> )}
                        {activeTab === 'Staff' && ( <> {selectedNode.roles.length === 0 && <p style={{fontSize:'12px', color:'#999'}}>No roles defined.</p>} {selectedNode.roles.map((r, i) => ( <div key={i} style={{padding:'10px', border:'1px solid #eee', marginBottom:'8px', borderRadius:'5px', background:'white', display:'flex', justifyContent:'space-between', alignItems:'center'}}> <div> <div style={{fontWeight:'bold', fontSize:'13px'}}>{r.title} <span style={styles.roleBadge}>{r.grade}</span></div> <div style={{fontSize:'11px', color: r.occupant === 'Vacant' ? '#dc3545' : '#28a745'}}>{r.occupant === 'Vacant' ? '🔴 Vacant' : `🟢 ${r.occupant}`}</div> </div> {r.occupant === 'Vacant' ? ( <button onClick={() => handleFillVacancy(r.id)} style={{...styles.btn('#28a745'), width:'auto', padding:'4px 8px', fontSize:'10px', marginBottom:0}}>+ Fill</button> ) : ( <button style={{...styles.btn('transparent'), width:'auto', padding:'4px', fontSize:'10px', color:'#999', border:'1px solid #eee'}}>Edit</button> )} </div> ))} {mode === 'design' && ( <div style={{marginTop:'15px', borderTop:'1px solid #eee', paddingTop:'15px'}}> <span style={styles.label}>Add New Role</span> <input style={styles.input} placeholder="Role Title" value={newRoleTitle} onChange={e => setNewRoleTitle(e.target.value)} /> <select style={styles.select} value={newRoleGrade} onChange={e => setNewRoleGrade(e.target.value)}><option value="SL">Select Grade...</option><option value="SL16">SL16 (DG)</option><option value="SL15">SL15 (DDG)</option><option value="SL14">SL14 (CD)</option><option value="SL13">SL13 (Dir)</option><option value="SL11">SL11/12 (DD)</option><option value="SL9">SL9/10 (AD)</option><option value="SL8">SL8 (Snr Admin)</option><option value="SL7">SL7 (Admin Officer)</option></select> <button onClick={handleAddRole} style={styles.btn('#6c757d')}>+ Create Role</button> </div> )} </> )}
                        {activeTab === 'Metrics' && ( <> <div style={{display:'flex', justifyContent:'space-between', marginBottom:'10px'}}><strong style={{fontSize:'14px'}}>Scorecard</strong>{nodeMetrics && <span style={styles.statusBadge(nodeMetrics.overall_status)}>{nodeMetrics.overall_score}%</span>}</div> {nodeMetrics && nodeMetrics.metrics.map((m, i) => { const t = Object.values(m.targets).reduce((a,b)=>a+b,0); const a = Object.values(m.actuals).reduce((a,b)=>a+b,0); const pct = t > 0 ? (a/t)*100 : 0; return ( <div key={i} style={{marginBottom:'10px', borderBottom:'1px solid #f0f0f0', paddingBottom:'5px', cursor:'pointer', background: metricName===m.name ? '#e3f2fd' : 'transparent'}} onClick={() => handleEditMetricClick(m)}> <div style={{display:'flex', justifyContent:'space-between', fontSize:'12px'}}><span>{m.name}</span><strong style={{color: pct<50?'red': pct<90?'orange':'green'}}>{pct.toFixed(0)}%</strong></div> <div style={{width:'100%', height:'6px', background:'#eee', marginTop:'2px'}}><div style={{width:`${Math.min(pct,100)}%`, height:'100%', background: pct<50?'red': pct<90?'orange':'green'}}></div></div> </div> ) })} {mode !== 'view' && ( <div style={{background:'#f8f9fa', padding:'10px', marginTop:'15px', borderRadius:'5px', border:'1px dashed #ccc'}}> <span style={styles.label}>{mode === 'design' ? "Define Metric (Plan)" : "Report Actuals (Execute)"}</span> <div style={{display:'flex', gap:'5px'}}> <input style={styles.input} placeholder="Metric Name" value={metricName} onChange={e=>setMetricName(e.target.value)} disabled={mode==='report'} /> <select style={{...styles.input, width:'100px'}} value={metricFreq} onChange={e=>setMetricFreq(e.target.value)} disabled={mode==='report'}><option>Quarterly</option><option>Annually</option></select> <select style={{...styles.input, width:'100px'}} value={metricType} onChange={e=>setMetricType(e.target.value)} disabled={mode==='report'}><option>Percentage</option><option>Currency</option><option>Number</option></select> </div> <div style={{display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'5px'}}> {mode === 'design' ? ( <> <input type="number" style={styles.input} value={targets.q1} onChange={e=>setTargets({...targets, q1:e.target.value})} placeholder="T1"/> <input type="number" style={styles.input} value={targets.q2} onChange={e=>setTargets({...targets, q2:e.target.value})} placeholder="T2"/> <input type="number" style={styles.input} value={targets.q3} onChange={e=>setTargets({...targets, q3:e.target.value})} placeholder="T3"/> <input type="number" style={styles.input} value={targets.q4} onChange={e=>setTargets({...targets, q4:e.target.value})} placeholder="T4"/> </> ) : ( <> <input type="number" style={styles.input} value={actuals.q1} onChange={e=>setActuals({...actuals, q1:e.target.value})} placeholder="A1"/> <input type="number" style={styles.input} value={actuals.q2} onChange={e=>setActuals({...actuals, q2:e.target.value})} placeholder="A2"/> <input type="number" style={styles.input} value={actuals.q3} onChange={e=>setActuals({...actuals, q3:e.target.value})} placeholder="A3"/> <input type="number" style={styles.input} value={actuals.q4} onChange={e=>setActuals({...actuals, q4:e.target.value})} placeholder="A4"/> </> )} </div> <button onClick={handleSaveMetric} style={styles.btn('#6c757d')}>{mode === 'design' ? 'Save Definition' : 'Submit Report'}</button> </div> )} </> )}
                        {activeTab === 'Governance' && ( <table style={{width: '100%', fontSize: '11px', borderCollapse: 'collapse'}}> <thead><tr style={{background:'#f8f9fa'}}><th style={{textAlign:'left', padding:'5px'}}>Role</th><th>Rights</th></tr></thead> <tbody> {selectedNode.roles.map((role, i) => ( <tr key={i} style={{borderBottom:'1px solid #eee'}}> <td style={{padding:'5px', fontWeight:'bold'}}>{role.title}</td> <td style={{padding:'5px'}}> <div style={{display:'flex', gap:'2px'}}> {['C','R','U','D'].map(a => { const isActive = checkPerm(role, "Financials", a); return <div key={a} onClick={() => togglePermission(role.id, "Financials", a, isActive)} style={styles.crudBtn(isActive)}>{a}</div> })} </div> </td> </tr> ))} </tbody> </table> )}
                    </div>
                </>
            )}
        </div>
      </div>
    </div>
  );
}

export default function WrappedApp() {
  return (
    <ReactFlowProvider>
      <Dashboard />
    </ReactFlowProvider>
  );
}