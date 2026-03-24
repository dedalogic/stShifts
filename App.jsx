import { useState, useEffect, useRef } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const DAYS = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
const DAY_SHORT = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const AREAS = ["Cocina","Caja"];
const PALETTE = [
  "#4B6CB7","#2E7D8C","#5A7A5A","#7A5A8C","#8C6A3A",
  "#3A6A8C","#6A3A5A","#5A8C6A","#8C3A3A","#6A5A3A",
  "#708090","#5C7A6B","#7A6B5C","#6B5C7A","#5C6B7A",
];

// ─── FIXED USERS (always present, not deletable) ──────────────────────────────
const FIXED_USERS = [
  { id:"u1",  name:"Miriam Muñoz",  role:"Cocinera", area:"Cocina", color:"#4B6CB7" },
  { id:"u2",  name:"Bettys Corona", role:"Cocinera", area:"Cocina", color:"#2E7D8C" },
  { id:"u3",  name:"Carmen",        role:"Cocinera", area:"Cocina", color:"#5A7A5A" },
  { id:"u4",  name:"Roxedy",        role:"Cocinera", area:"Cocina", color:"#7A5A8C" },
  { id:"u5",  name:"Ayerim",        role:"Cocinera", area:"Cocina", color:"#8C6A3A" },
  { id:"u6",  name:"Rocío",         role:"Cajera",   area:"Caja",   color:"#3A6A8C" },
  { id:"u7",  name:"Fernanda",      role:"Cajera",   area:"Caja",   color:"#6A3A5A" },
  { id:"u8",  name:"Liz",           role:"Cajera",   area:"Caja",   color:"#5A8C6A" },
  { id:"u9",  name:"Sabrina",       role:"Cajera",   area:"Caja",   color:"#8C3A3A" },
  { id:"u10", name:"Alicia",        role:"Cajera",   area:"Caja",   color:"#6A5A3A" },
];

const DEFAULT_SHIFTS = [
  { id:"am1", name:"AM Apertura", start:"09:00", end:"18:30", color:"#4B6CB7" },
  { id:"am2", name:"AM Normal",   start:"09:00", end:"15:30", color:"#2E7D8C" },
  { id:"pm1", name:"PM Normal",   start:"15:00", end:"22:00", color:"#5A7A5A" },
  { id:"pm2", name:"PM Cierre",   start:"14:30", end:"00:30", color:"#708090" },
];

const SPECIAL = {
  LIBRE:   { id:"__libre__",   label:"Libre",        sym:"",   bg:"#F0FAF4", border:"#A8DDB8", color:"#2D7A4A", exportAs:null },
  FALTA:   { id:"__falta__",   label:"Falta",        sym:"",   bg:"#FDF2F2", border:"#F0C0C0", color:"#9B2335", exportAs:"Falta" },
  VENDIDO: { id:"__vendido__", label:"Turno vendido",sym:"",   bg:"#FDFAF0", border:"#E8D88A", color:"#7A5C00", exportAs:"Turno vendido" },
  DOBLE:   { id:"__doble__",   label:"Doble turno",  sym:"",   bg:"#F3F0FA", border:"#C9BEE8", color:"#4A3580", exportAs:null, hidden:true },
};

const RULES = { MAX_CONSECUTIVE:6, BREAK_MIN:30, MAX_DAY_H:10, WEEK_H:44 };

// ─── ROTATING TASKS SETUP ─────────────────────────────────────────────────────
// Anchor: the week that contains today is "anchor week"
// That week's assignment is defined by ANCHOR_ASSIGNMENT below.
// Each subsequent week shifts +1 (task and user both rotate).

// Order of kitchen staff for rotation (by id)
const ROTATION_USER_ORDER = ["u5","u4","u1","u2","u3"]; // Ayerim, Roxedy, Miriam, Bettys, Carmen

// Rotating tasks in order
const ROTATING_TASKS = [
  "Mantenedor y Ventanas",
  "Repisa",
  "Lavaplatos y porta novas",
  "Basureros",
  "Estante blanco y de verduras",
  "Cocina y mesón del medio",
  "Freidoras y calentador de papas",
];

// Fixed tasks (same order, same people — don't rotate by design, but keep same order)
const FIXED_TASKS = [
  "Congelador",
  "Refrigerador Horizontal",
  "Refrigerador Salsera",
  "Campana y Plancha",
  "Refrigerador Vertical",
];

// Anchor assignment for THIS week (week containing today):
// Ayerim → Basureros (index 3), Roxedy → Estante blanco (4), Miriam → Cocina y mesón (5),
// Bettys → Freidoras (6), Carmen → Mantenedor (0)
// So: for anchor week, user[i] gets task[(ANCHOR_TASK_OFFSETS[i]) % 7]
// User order: Ayerim(0), Roxedy(1), Miriam(2), Bettys(3), Carmen(4)
// Tasks they got: Basureros(3), Estante(4), Cocina(5), Freidoras(6), Mantenedor(0)
// Pattern: userIndex 0 → taskIndex 3, meaning base offset = 3
const ANCHOR_TASK_OFFSET = 3; // this week: user[0] (Ayerim) starts at task index 3

// Fixed tasks anchor (same week, same people): same order
const ANCHOR_FIXED_OFFSET = 0; // user[0] (Ayerim) → fixed task index 0

/**
 * Get rotating task assignment for a given weekOffset (0 = current week)
 * Returns: { [userId]: taskName, [taskName]: userId }
 */
function getRotatingAssignment(weekOffset) {
  const n = ROTATING_TASKS.length; // 7
  const u = ROTATION_USER_ORDER.length; // 5
  const result = {};
  ROTATION_USER_ORDER.forEach((uid, userIdx) => {
    const taskIdx = ((ANCHOR_TASK_OFFSET + userIdx + weekOffset) % n + n) % n;
    result[uid] = ROTATING_TASKS[taskIdx];
  });
  return result;
}

function getFixedAssignment(weekOffset) {
  // Fixed tasks never rotate — always same person, same task regardless of week
  const result = {};
  ROTATION_USER_ORDER.forEach((uid, userIdx) => {
    result[uid] = FIXED_TASKS[userIdx % FIXED_TASKS.length];
  });
  return result;
}

// ─── WEEK HELPERS ─────────────────────────────────────────────────────────────
const t2m = t => { if(!t) return 0; const [h,m]=t.split(":").map(Number); return h*60+m; };
const shiftH = s => { let a=t2m(s.start),b=t2m(s.end); if(b<=a) b+=1440; return (b-a-RULES.BREAK_MIN)/60; };
const isSpec = v => v && Object.values(SPECIAL).some(s=>s.id===v);
const getSpec = v => Object.values(SPECIAL).find(s=>s.id===v);
const wKey = wo => `w${wo}`;

function getMonday(wo) {
  const n=new Date(), m=new Date(n);
  m.setDate(n.getDate()-((n.getDay()+6)%7)+wo*7); m.setHours(0,0,0,0); return m;
}
function weekLabel(wo) {
  const m=getMonday(wo), s=new Date(m); s.setDate(m.getDate()+6);
  const f=d=>d.toLocaleDateString("es-CL",{day:"numeric",month:"short"});
  return `${f(m)} — ${f(s)}`;
}
function weekDates(wo) {
  const m=getMonday(wo);
  return DAYS.map((_,i)=>{ const d=new Date(m); d.setDate(m.getDate()+i); return d; });
}
function dateToWO(date) {
  const n=new Date(), cm=new Date(n);
  cm.setDate(n.getDate()-((n.getDay()+6)%7)); cm.setHours(0,0,0,0);
  const tm=new Date(date); tm.setDate(date.getDate()-((date.getDay()+6)%7)); tm.setHours(0,0,0,0);
  return Math.round((tm-cm)/(7*24*3600*1000));
}
function monthDates(y,mo) {
  const r=[],d=new Date(y,mo,1);
  while(d.getMonth()===mo){ r.push(new Date(d)); d.setDate(d.getDate()+1); } return r;
}
function cellByDate(sched,date,uid) {
  const wo=dateToWO(date), wk=wKey(wo), dn=DAYS[(date.getDay()+6)%7];
  return (sched[wk]||{})[`${dn}-${uid}`];
}

// ─── THEME ────────────────────────────────────────────────────────────────────
function getD(dark){ return dark ? {
  bg:"#141414", bg2:"#1C1C1C", bg3:"#242424", bg4:"#2A2A2A",
  border:"#2E2E2E", border2:"#383838",
  text:"#EDEDEB", text2:"#888", text3:"#444",
  nav:"#111", navBorder:"#252525",
  cell:"#1A1A1A", cellHover:"#202020",
  tableHead:"#181818", tableRow:"#141414", tableAlt:"#181818",
  input:"#1C1C1C", inputBorder:"#333",
  btnBg:"#222", btnBorder:"#333",
  tabActive:"#EDEDEB", tabActiveText:"#111",
  scrollThumb:"#333",
} : {
  bg:"#fff", bg2:"#FAFAFA", bg3:"#F5F5F5", bg4:"#F0F0F0",
  border:"#EBEBEB", border2:"#E0E0E0",
  text:"#111", text2:"#888", text3:"#CCC",
  nav:"#fff", navBorder:"#EBEBEB",
  cell:"#fff", cellHover:"#F8F8F8",
  tableHead:"#FAFAFA", tableRow:"#fff", tableAlt:"#FAFAFA",
  input:"#fff", inputBorder:"#E5E7EB",
  btnBg:"#F5F5F5", btnBorder:"#E8E8E8",
  tabActive:"#111", tabActiveText:"#fff",
  scrollThumb:"#E0E0E0",
}; }
function loadExtra() { const r=localStorage.getItem("so_extra"); return r?JSON.parse(r):[]; }
function loadShifts() { const r=localStorage.getItem("so_shifts"); return r?JSON.parse(r):DEFAULT_SHIFTS; }
function loadSchedule() { const r=localStorage.getItem("so_schedule"); return r?JSON.parse(r):{}; }

function checkRules(sched,users,shifts,wk) {
  const alerts=[];
  users.forEach(u=>{
    const week=sched[wk]||{}; let tH=0,wDs=[];
    DAYS.forEach((day,di)=>{
      const c=week[`${day}-${u.id}`]; if(!c||isSpec(c)) return;
      const s=shifts.find(x=>x.id===c); if(!s) return;
      const h=shiftH(s); tH+=h; wDs.push(di);
      if(h>RULES.MAX_DAY_H) alerts.push({type:"error",msg:`${u.name}: excede 10h el ${day}`});
    });
    if(tH>RULES.WEEK_H) alerts.push({type:"error",msg:`${u.name}: ${tH.toFixed(1)}h — excede 44h`});
    else if(tH>0&&tH<RULES.WEEK_H-2) alerts.push({type:"warn",msg:`${u.name}: ${tH.toFixed(1)}h de 44h`});
    if(wDs.length>1){ let st=1; for(let i=1;i<wDs.length;i++){ if(wDs[i]===wDs[i-1]+1){st++;if(st>RULES.MAX_CONSECUTIVE){alerts.push({type:"error",msg:`${u.name}: +6 días seguidos`});break;}}else st=1;}}
  });
  DAYS.forEach((day,di)=>{
    const week=sched[wk]||{}; let am=0,pm=0;
    users.forEach(u=>{
      const c=week[`${day}-${u.id}`]; if(!c||isSpec(c)) return;
      const s=shifts.find(x=>x.id===c); if(!s) return;
      t2m(s.start)/60<13?am++:pm++;
    });
    const rPM=di>=4?3:2;
    if(am<2) alerts.push({type:"warn",msg:`${day}: AM incompleto (${am}/2)`});
    if(pm<rPM) alerts.push({type:"warn",msg:`${day}: PM incompleto (${pm}/${rPM})`});
  });
  return alerts;
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [extra,    setExtra]    = useState(loadExtra);
  const [shifts,   setShifts]   = useState(loadShifts);
  const [schedule, setSchedule] = useState(loadSchedule);
  const [wo,       setWo]       = useState(0);
  const [view,     setView]     = useState("week");
  const [tab,      setTab]      = useState("schedule");
  const [areaF,    setAreaF]    = useState("Todas");
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [ghostPos, setGhostPos] = useState(null); // {x,y,label,color}
  const [picker,   setPicker]   = useState(null);
  const [userModal,setUserModal]= useState(false);
  const [shiftModal,setShiftModal]=useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editShift,setEditShift]= useState(null);
  const [alerts,   setAlerts]   = useState([]);
  const [profileUser, setProfileUser] = useState(null);
  const [collapsed,setCollapsed]= useState({turnos:false,estados:false,alertas:false});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [reportModal, setReportModal] = useState(false);
  const [templateModal, setTemplateModal] = useState(false);
  const [templates, setTemplates] = useState(()=>JSON.parse(localStorage.getItem("so_templates")||"[]"));
  const [dark,     setDark]     = useState(()=>localStorage.getItem("so_dark")==="1");
  const [monthRef, setMonthRef] = useState(()=>{ const n=new Date(); return{y:n.getFullYear(),m:n.getMonth()}; });

  const setCell_ref=useRef(null);

  // ── pointer-drag ghost tracking ──
  useEffect(()=>{
    if(!dragging) return;
    const onMove=e=>{
      const p=e.touches?e.touches[0]:e;
      setGhostPos({x:p.clientX,y:p.clientY});
      const el=document.elementFromPoint(p.clientX,p.clientY);
      const cell=el?.closest("[data-cellkey]");
      setDragOver(cell?cell.getAttribute("data-cellkey"):null);
    };
    const onUp=e=>{
      document.body.classList.remove("is-dragging");
      const p=e.touches?e.changedTouches[0]:e;
      const el=document.elementFromPoint(p.clientX,p.clientY);
      const cell=el?.closest("[data-cellkey]");
      if(cell){
        const [day,uid]=cell.getAttribute("data-cellkey").split("||");
        if(dragging.t==="user") setPicker({day,uid:dragging.uid});
        else {
          setCell_ref.current(day,uid,dragging.id);
          // If dragged from a cell (move), remove source unless same cell
          if(dragging._srcDay && dragging._srcUid){
            if(!(dragging._srcDay===day && dragging._srcUid===uid)){
              delCell_ref.current(dragging._srcDay, dragging._srcUid);
            }
          }
        }
      }
      setDragging(null); setGhostPos(null); setDragOver(null);
    };
    window.addEventListener("pointermove",onMove);
    window.addEventListener("pointerup",onUp);
    return()=>{ window.removeEventListener("pointermove",onMove); window.removeEventListener("pointerup",onUp); };
  },[dragging]);

  setCell_ref.current=(day,uid,val)=>assignW(day,uid,val);
  const delCell_ref=useRef(null);
  delCell_ref.current=(day,uid)=>removeW(day,uid);

  const users = [...FIXED_USERS, ...extra];
  const visible = areaF==="Todas" ? users : users.filter(u=>u.area===areaF);
  const wk = wKey(wo);
  const dates = weekDates(wo);
  const wSched = schedule[wk]||{};

  useEffect(()=>{ localStorage.setItem("so_extra",   JSON.stringify(extra));    },[extra]);
  useEffect(()=>{ localStorage.setItem("so_shifts",  JSON.stringify(shifts));   },[shifts]);
  useEffect(()=>{ localStorage.setItem("so_schedule",JSON.stringify(schedule)); },[schedule]);
  useEffect(()=>{ localStorage.setItem("so_templates",JSON.stringify(templates)); },[templates]);
  useEffect(()=>{ localStorage.setItem("so_dark", dark?"1":"0"); },[dark]);
  useEffect(()=>{ setAlerts(checkRules(schedule,visible,shifts,wk)); },[schedule,extra,areaF,shifts,wk]);

  const setCell=(wk2,dn,uid,val)=>setSchedule(p=>({...p,[wk2]:{...(p[wk2]||{}),[`${dn}-${uid}`]:val}}));
  const delCell=(wk2,dn,uid)=>setSchedule(p=>{ const w={...(p[wk2]||{})}; delete w[`${dn}-${uid}`]; return{...p,[wk2]:w}; });
  const assignW=(day,uid,val)=>setCell(wk,day,uid,val);
  const removeW=(day,uid)=>delCell(wk,day,uid);
  const assignM=(date,uid,val)=>setCell(wKey(dateToWO(date)),DAYS[(date.getDay()+6)%7],uid,val);
  const removeM=(date,uid)=>delCell(wKey(dateToWO(date)),DAYS[(date.getDay()+6)%7],uid);

  const userHoursW=uid=>{ let t=0; DAYS.forEach(d=>{ const c=wSched[`${d}-${uid}`]; if(!c||isSpec(c)) return; const s=shifts.find(x=>x.id===c); if(s) t+=shiftH(s); }); return t; };

  // ── templates ──
  function saveAsTemplate(name){
    // Store current week's assignments keyed by userId+day (relative, not by date)
    const data={};
    users.forEach(u=>{
      DAYS.forEach(day=>{
        const v=wSched[`${day}-${u.id}`];
        if(v) data[`${day}-${u.id}`]=v;
      });
    });
    const tpl={ id:`tpl${Date.now()}`, name, data, savedAt: new Date().toLocaleDateString("es-CL"), weekLabel:weekLabel(wo) };
    setTemplates(p=>[tpl,...p]);
  }

  function applyTemplate(tpl, targetWo){
    // Apply to a single week
    const wk2=wKey(targetWo);
    setSchedule(p=>({ ...p, [wk2]: { ...(p[wk2]||{}), ...tpl.data } }));
  }

  function applyTemplateMonth(tpl, year, month){
    // Apply to every week of the month
    const allDates=monthDates(year,month);
    // Get unique week offsets in this month
    const weekOffsets=[...new Set(allDates.map(d=>dateToWO(d)))];
    setSchedule(p=>{
      const next={...p};
      weekOffsets.forEach(wo2=>{
        const wk2=wKey(wo2);
        next[wk2]={ ...(next[wk2]||{}), ...tpl.data };
      });
      return next;
    });
  }

  function ghostLabel(d){ if(!d) return {label:"",color:"#888"}; if(d.t==="user"){ const u=users.find(x=>x.id===d.uid); return {label:u?.name||"",color:u?.color||"#888"}; } if(d.t==="shift"){ const s=shifts.find(x=>x.id===d.id); return {label:s?.name||"",color:s?.color||"#888"}; } if(d.t==="special"){ const st=Object.values(SPECIAL).find(x=>x.id===d.id); return {label:st?.label||"",color:st?.color||"#888"}; } return {label:"",color:"#888"}; }

  function startDrag(e,payload){
    e.preventDefault();
    e.stopPropagation();
    try{ e.target.setPointerCapture(e.pointerId); }catch(_){}
    document.body.classList.add("is-dragging");
    setDragging(payload);
    const p=e.touches?e.touches[0]:e;
    setGhostPos({x:p.clientX,y:p.clientY});
  }

  function handleCellPointerEnter(ck){ if(dragging) setDragOver(ck); }
  function handleCellPointerLeave(){ if(dragging) setDragOver(null); }
  function handleCellPointerUp(day,uid){ if(!dragging) return; if(dragging.t==="user") setPicker({day,uid:dragging.uid}); else if(dragging.t==="shift") assignW(day,uid,dragging.id); else if(dragging.t==="special") assignW(day,uid,dragging.id); setDragging(null); setGhostPos(null); setDragOver(null); }
  function handleMonthCellPointerUp(date,uid){ if(!dragging) return; if(dragging.t==="user") setPicker({date,uid:dragging.uid}); else if(dragging.t==="shift") assignM(date,uid,dragging.id); else if(dragging.t==="special") assignM(date,uid,dragging.id); setDragging(null); setGhostPos(null); setDragOver(null); }

  function dropW(day,uid){ handleCellPointerUp(day,uid); }
  function dropM(date,uid){ handleMonthCellPointerUp(date,uid); }
  function tog(k){ setCollapsed(p=>({...p,[k]:!p[k]})); }

  function exportXLSX(){
    // Build data
    const header=["Persona","Cargo","Área",...DAYS,"Total horas"];
    const rows=[header];
    visible.forEach(u=>{
      const row=[u.name,u.role||"",u.area||""];
      DAYS.forEach(day=>{
        const c=wSched[`${day}-${u.id}`];
        if(!c){row.push("");return;}
        const sp=getSpec(c); if(sp){row.push(sp.hidden?"":sp.exportAs||sp.label);return;}
        const s=shifts.find(x=>x.id===c); row.push(s?`${s.name} ${s.start}–${s.end}`:"");
      });
      row.push(userHoursW(u.id).toFixed(1)+"h"); rows.push(row);
    });
    if(window.XLSX){
      const ws=window.XLSX.utils.aoa_to_sheet(rows);
      const wb=window.XLSX.utils.book_new();
      window.XLSX.utils.book_append_sheet(wb,ws,"Horario");
      window.XLSX.writeFile(wb,`horario_${wk}.xlsx`);
    } else {
      const s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload=()=>{
        const ws=window.XLSX.utils.aoa_to_sheet(rows);
        const wb=window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb,ws,"Horario");
        window.XLSX.writeFile(wb,`horario_${wk}.xlsx`);
      };
      document.head.appendChild(s);
    }
  }

  function saveBackup() {
    const keys = ["so_extra","so_shifts","so_schedule","so_rot_names","so_fix_names","so_colacion","so_plancha","so_templates"];
    const data = {};
    keys.forEach(k=>{ const v=localStorage.getItem(k); if(v) data[k]=v; });
    data.__version = "1";
    data.__saved = new Date().toISOString();
    const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `stShifts_backup_${new Date().toLocaleDateString("es-CL").replace(/\//g,"-")}.json`;
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  }

  function loadBackup() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = ".json";
    input.onchange = e => {
      const file = e.target.files[0]; if(!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const data = JSON.parse(ev.target.result);
          if(!data.__version) { alert("Archivo no válido."); return; }
          const keys = ["so_extra","so_shifts","so_schedule","so_rot_names","so_fix_names","so_colacion","so_plancha","so_templates"];
          keys.forEach(k=>{ if(data[k]!=null) localStorage.setItem(k,data[k]); });
          window.location.reload();
        } catch { alert("Error al leer el archivo."); }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  const errN=alerts.filter(a=>a.type==="error").length;
  const warnN=alerts.filter(a=>a.type==="warn").length;

  const D = getD(dark);

  return (
    <div style={{fontFamily:"'Inter',sans-serif",background:D.bg,minHeight:"100vh",color:D.text,colorScheme:dark?"dark":"light"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;user-select:none;-webkit-user-select:none;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-thumb{background:${D.scrollThumb};border-radius:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        .btn{cursor:pointer;border:none;font-family:'Inter',sans-serif;transition:all .18s cubic-bezier(.4,0,.2,1);}
        .btn:hover{opacity:.72;}
        .btn:active{transform:scale(.97);}
        .tab{cursor:pointer;padding:6px 13px;border-radius:6px;font-size:13px;font-weight:500;color:${D.text2};border:none;background:none;font-family:'Inter',sans-serif;transition:all .15s;}
        .tab.active{background:${D.tabActive};color:${D.tabActiveText};}
        .tab:hover:not(.active){background:${D.bg3};color:${D.text};}
        .vtab{cursor:pointer;padding:4px 10px;border-radius:5px;font-size:12px;font-weight:500;color:${D.text2};border:1px solid transparent;background:none;font-family:'Inter',sans-serif;transition:all .15s;}
        .vtab.active{border-color:${D.border2};background:${D.bg2};color:${D.text};box-shadow:0 1px 3px rgba(0,0,0,.15);}
        .atab{cursor:pointer;padding:4px 10px;border-radius:5px;font-size:12px;font-weight:500;color:${D.text2};border:none;background:none;font-family:'Inter',sans-serif;transition:all .15s;}
        .atab.active{background:${D.tabActive};color:${D.tabActiveText};}
        .modal-bg{position:fixed;inset:0;background:rgba(0,0,0,${dark?.45:.18});display:flex;align-items:center;justify-content:center;z-index:100;animation:fadeIn .15s ease;}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .modal{background:${D.bg2};border-radius:14px;padding:26px;width:360px;box-shadow:0 12px 40px rgba(0,0,0,${dark?.5:.12});animation:slideUp .18s cubic-bezier(.4,0,.2,1);border:1px solid ${D.border};}
        input,select,textarea{user-select:text;-webkit-user-select:text;}
        input,select{width:100%;padding:8px 11px;border:1px solid ${D.inputBorder};border-radius:7px;font-size:13px;font-family:'Inter',sans-serif;outline:none;color:${D.text};background:${D.input};transition:border-color .15s;}
        input:focus,select:focus{border-color:${dark?"#555":"#555"};box-shadow:0 0 0 3px rgba(${dark?"255,255,255":"0,0,0"},.06);}
        option{background:${D.bg2};color:${D.text};}
        .lbl{font-size:10px;font-weight:700;color:${D.text2};display:block;margin-bottom:4px;margin-top:14px;text-transform:uppercase;letter-spacing:.7px;}
        .nav-btn{background:none;border:1px solid ${D.btnBorder};border-radius:6px;padding:5px 10px;cursor:pointer;font-size:13px;color:${D.text};font-family:'Inter',sans-serif;transition:all .15s;}
        .nav-btn:hover{background:${D.bg3};border-color:${D.border2};}
        .nav-btn:active{transform:scale(.97);}
        .wcell{transition:background .12s;cursor:pointer;position:relative;user-select:none;-webkit-user-drag:none;}
        .wcell *{user-select:none;-webkit-user-drag:none;-webkit-user-select:none;}
        .wcell:hover{background:${D.cellHover}!important;}
        .drag-ov{background:${dark?"#222":"#F8F8F8"}!important;}
        .wrow td{transition:background .1s;}
        .wrow:hover td{background:${D.cellHover};}
        .wrow:hover td:first-child{background:${D.cellHover}!important;}
        .rm{opacity:0!important;transition:opacity .15s!important;}
        .wrow:hover .rm{opacity:1!important;}
        .sec-hdr{display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:5px 0 4px;user-select:none;border-bottom:1px solid ${D.border};margin-bottom:8px;}
        .sec-ttl{font-size:11px;font-weight:600;color:${D.text};letter-spacing:.1px;}
        .sec-hdr:hover .sec-ttl{color:${dark?"#fff":"#000"};}
        .tog{width:14px;height:14px;border-radius:50%;background:${dark?"#333":"#F0F0F0"};display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s;}
        .tog.open{background:${dark?"#EEE":"#111"};}
        .tog span{display:block;width:6px;height:1.5px;background:${dark?"#888":"#888"};border-radius:1px;transition:background .15s;}
        .tog.open span{background:${dark?"#111":"#fff"};}
        .cal-cell{transition:background .12s;border-right:1px solid ${D.border};}
        .cal-cell:hover{background:${D.cellHover}!important;}
        .task-row:hover{background:${D.bg2};}
        .urow:hover{background:${D.bg2};}
        .sb-row{display:flex;align-items:flex-start;gap:8px;padding:6px 4px;border-radius:6px;cursor:grab;transition:background .12s,transform .12s;margin-bottom:2px;user-select:none;touch-action:none;}
        .sb-row:hover{background:${D.bg3};}
        .sb-row:active{cursor:grabbing;transform:scale(.98);opacity:.7;}
        .drag-ghost{position:fixed;pointer-events:none;z-index:9999;opacity:.92;transform:rotate(1.5deg) scale(1.04);transition:none;filter:drop-shadow(0 8px 24px rgba(0,0,0,.35));animation:ghostPop .12s cubic-bezier(.4,0,.2,1);}
        @keyframes ghostPop{from{opacity:0;transform:rotate(1.5deg) scale(.9)}to{opacity:.92;transform:rotate(1.5deg) scale(1.04)}}
        .cell-filled{animation:cellIn .15s cubic-bezier(.4,0,.2,1);}
        @keyframes cellIn{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
        .no-select{user-select:none!important;-webkit-user-select:none!important;-moz-user-select:none!important;}
        body.is-dragging{user-select:none!important;-webkit-user-select:none!important;cursor:grabbing!important;}
        body.is-dragging *{user-select:none!important;-webkit-user-select:none!important;}
        .cell-drop-hint{position:absolute;inset:3px;border-radius:6px;border:1.5px dashed ${dark?"#555":"#CCC"};opacity:0;transition:opacity .12s;pointer-events:none;}
        .drag-ov .cell-drop-hint{opacity:1;}
        .wrow:hover .fill-handle{opacity:1!important;cursor:crosshair;}
        .wrow:hover .cell-plus{opacity:1!important;}
      `}</style>

      {/* ── NAV ── */}
      <div style={{borderBottom:`1px solid ${D.navBorder}`,padding:"0 20px",display:"flex",alignItems:"center",gap:14,height:50,background:D.nav}}>
        <span style={{fontWeight:700,fontSize:14,letterSpacing:"-0.4px",color:D.text}}>stShifts</span>
        <div style={{display:"flex",gap:2}}>
          {[["schedule","Horario"],["tasks","Tareas"],["users","Personas"],["shifts","Turnos"]].map(([t,l])=>(
            <button key={t} className={`tab ${tab===t?"active":""}`} onClick={()=>setTab(t)}>{l}</button>
          ))}
        </div>
        <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5}}>
          {/* Dark mode toggle */}
          <button className="btn" onClick={()=>setDark(d=>!d)} title={dark?"Modo claro":"Modo oscuro"}
            style={{background:"none",border:`1px solid ${D.btnBorder}`,borderRadius:6,padding:"6px 7px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {dark
              ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="3" stroke={D.text2} strokeWidth="1.3"/>
                  <path d="M6.5 1v1M6.5 11v1M1 6.5h1M11 6.5h1M2.8 2.8l.7.7M9.5 9.5l.7.7M2.8 10.2l.7-.7M9.5 3.5l.7-.7" stroke={D.text2} strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
              : <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="#888" strokeWidth="1.3"/>
                  <path d="M6.5 1.5 A5 5 0 0 0 6.5 11.5 Z" fill="#888"/>
                </svg>
            }
          </button>
          {/* Templates */}
          <button className="btn" onClick={()=>setTemplateModal(true)} title="Plantillas de horario"
            style={{background:"none",border:`1px solid ${D.btnBorder}`,borderRadius:6,padding:"6px 7px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x="1" y="1" width="4.5" height="4.5" rx="1" stroke={D.text2} strokeWidth="1.3"/>
              <rect x="7.5" y="1" width="4.5" height="4.5" rx="1" stroke={D.text2} strokeWidth="1.3"/>
              <rect x="1" y="7.5" width="4.5" height="4.5" rx="1" stroke={D.text2} strokeWidth="1.3"/>
              <rect x="7.5" y="7.5" width="4.5" height="4.5" rx="1" stroke={D.text2} strokeWidth="1.3"/>
            </svg>
          </button>
          {/* Backup save */}
          <button className="btn" onClick={saveBackup} title="Guardar copia de seguridad"
            style={{background:"none",border:`1px solid ${D.btnBorder}`,borderRadius:6,padding:"6px 7px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 10.5h9M6.5 2v6M4 6l2.5 2.5L9 6" stroke={D.text2} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Backup load */}
          <button className="btn" onClick={loadBackup} title="Restaurar copia de seguridad"
            style={{background:"none",border:`1px solid ${D.btnBorder}`,borderRadius:6,padding:"6px 7px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M2 10.5h9M6.5 8V2M4 4.5L6.5 2 9 4.5" stroke={D.text2} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          {/* Excel export */}
          <button className="btn" onClick={exportXLSX} title="Exportar a Excel"
            style={{background:"none",border:`1px solid ${D.btnBorder}`,borderRadius:6,padding:"6px 7px",display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <rect x=".75" y=".75" width="8.5" height="11.5" rx="1.5" stroke={D.text2} strokeWidth="1.2"/>
              <path d="M3 4h5M3 6.5h5M3 9h3" stroke={D.text2} strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M7.5.75V3.5H10" stroke={D.text2} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>

      {tab==="schedule" && (
        <div style={{display:"flex",height:"calc(100vh - 50px)"}}>

          {/* Sidebar toggle button */}
          <button className="btn" onClick={()=>setSidebarOpen(o=>!o)}
            title={sidebarOpen?"Ocultar panel":"Mostrar panel"}
            style={{position:"absolute",left:sidebarOpen?168:8,top:66,zIndex:20,width:20,height:20,borderRadius:"50%",background:D.bg2,border:`1px solid ${D.border2}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:D.text2,boxShadow:`0 1px 4px rgba(0,0,0,${dark?.3:.1})`,transition:"left .2s",padding:0,flexShrink:0}}>
            {sidebarOpen?"‹":"›"}
          </button>

          {/* Sidebar */}
          <div style={{width:sidebarOpen?160:0,borderRight:`1px solid ${D.border}`,padding:sidebarOpen?"16px 13px":"0",overflowY:"auto",overflowX:"hidden",flexShrink:0,display:"flex",flexDirection:"column",gap:16,transition:"width .2s, padding .2s",background:D.bg}}>

            {/* Turnos */}
            <div>
              <div className="sec-hdr" onClick={()=>tog("turnos")}>
                <span className="sec-ttl">Turnos</span>
                <span className={`tog ${!collapsed.turnos?"open":""}`}><span/></span>
              </div>
              {!collapsed.turnos && shifts.map(s=>(
                <div key={s.id}
                  onPointerDown={e=>startDrag(e,{t:"shift",id:s.id})}
                  className="sb-row no-select">
                  <div style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0,marginTop:2}}/>
                  <div>
                    <div style={{fontSize:11,fontWeight:500,color:D.text,lineHeight:1.3}}>{s.name}</div>
                    <div style={{fontSize:10,color:D.text2,marginTop:1}}>{s.start}–{s.end}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Estados */}
            <div>
              <div className="sec-hdr" onClick={()=>tog("estados")}>
                <span className="sec-ttl">Estados</span>
                <span className={`tog ${!collapsed.estados?"open":""}`}><span/></span>
              </div>
              {!collapsed.estados && Object.values(SPECIAL).map(st=>(
                <div key={st.id}
                  onPointerDown={e=>startDrag(e,{t:"special",id:st.id})}
                  className="sb-row no-select">
                  <div style={{width:8,height:8,borderRadius:"50%",background:st.color,flexShrink:0,marginTop:2}}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:11,fontWeight:500,color:D.text,lineHeight:1.3}}>{st.label}</div>
                    <div style={{fontSize:10,color:D.text2,marginTop:1}}></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Alertas */}
            {alerts.length>0 && (
              <div>
                <div className="sec-hdr" onClick={()=>tog("alertas")}>
                  <span className="sec-ttl">Alertas {alerts.length>0 && <span style={{color:errN>0?"#9B2335":"#AAA"}}>({alerts.length})</span>}</span>
                  <span className={`tog ${!collapsed.alertas?"open":""}`}><span/></span>
                </div>
                {!collapsed.alertas && alerts.slice(0,8).map((a,i)=>(
                  <div key={i} className="sb-row" style={{cursor:"default",alignItems:"flex-start"}}>
                    <div style={{width:5,height:5,borderRadius:"50%",background:a.type==="error"?"#9B2335":"#C8A000",flexShrink:0,marginTop:3}}/>
                    <div style={{fontSize:11,fontWeight:400,color:D.text,lineHeight:1.4}}>{a.msg}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Main */}
          <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",background:D.bg}}>
            <div style={{padding:"8px 16px",borderBottom:`1px solid ${D.border}`,display:"flex",alignItems:"center",gap:9,flexShrink:0,paddingLeft:44,background:D.bg}}>
              <div style={{background:"#F3F4F6",borderRadius:6,padding:3,display:"flex",gap:1}}>
                <button className={`vtab ${view==="week"?"active":""}`} onClick={()=>setView("week")}>WK</button>
                <button className={`vtab ${view==="month"?"active":""}`} onClick={()=>setView("month")}>Mes</button>
              </div>
              {view==="week" && <>
                <button className="nav-btn" onClick={()=>setWo(w=>w-1)}>‹</button>
                <span style={{fontSize:13,fontWeight:500,color:D.text,minWidth:158,textAlign:"center"}}>{weekLabel(wo)}</span>
                <button className="nav-btn" onClick={()=>setWo(w=>w+1)}>›</button>
                <button className="nav-btn" onClick={()=>setWo(0)} style={{fontSize:11,color:"#999",background:wo===0?"#F0F0F0":"none"}}>Hoy</button>
              </>}
              {view==="month" && <>
                <button className="nav-btn" onClick={()=>setMonthRef(m=>{ const d=new Date(m.y,m.m-1,1); return{y:d.getFullYear(),m:d.getMonth()}; })}>‹</button>
                <span style={{fontSize:13,fontWeight:500,color:D.text,minWidth:130,textAlign:"center"}}>{MONTH_NAMES[monthRef.m]} {monthRef.y}</span>
                <button className="nav-btn" onClick={()=>setMonthRef(m=>{ const d=new Date(m.y,m.m+1,1); return{y:d.getFullYear(),m:d.getMonth()}; })}>›</button>
                <button className="nav-btn" onClick={()=>{ const n=new Date(); setMonthRef({y:n.getFullYear(),m:n.getMonth()}); }} style={{fontSize:11,color:"#999",background:(()=>{const n=new Date();return monthRef.m===n.getMonth()&&monthRef.y===n.getFullYear()?"#F0F0F0":"none";})()}}>Hoy</button>
              </>}
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:8}}>
                <div style={{display:"flex",gap:2,background:"#F3F4F6",borderRadius:6,padding:3}}>
                  {["Todas","Cocina","Caja"].map(a=>(
                    <button key={a} className={`atab ${areaF===a?"active":""}`} onClick={()=>setAreaF(a)}>{a}</button>
                  ))}
                </div>
                <button className="nav-btn" onClick={()=>setReportModal(true)} title="Generar reporte"
                  style={{fontSize:11,color:"#555",display:"flex",alignItems:"center",gap:4}}>
                  <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x=".5" y=".5" width="12" height="12" rx="2" stroke="#888"/><line x1="3" y1="4" x2="10" y2="4" stroke="#888" strokeWidth="1.2"/><line x1="3" y1="6.5" x2="10" y2="6.5" stroke="#888" strokeWidth="1.2"/><line x1="3" y1="9" x2="7" y2="9" stroke="#888" strokeWidth="1.2"/></svg>
                  Reporte
                </button>
              </div>
            </div>

            {view==="week"
              ? <WeekGrid users={visible} shifts={shifts} dates={dates} wSched={wSched}
                  dragging={dragging} dragOver={dragOver}
                  setPicker={setPicker} removeW={removeW}
                  userHoursW={userHoursW} areaF={areaF} onUserClick={u=>setProfileUser(u)}
                  assignW={assignW} startDrag={startDrag} dark={dark} D={D} />
              : <MonthCal users={visible} shifts={shifts} schedule={schedule} monthRef={monthRef} dark={dark}
                  dragging={dragging} dragOver={dragOver} setDragOver={setDragOver}
                  setPicker={setPicker} dropM={dropM} removeM={removeM} setDragging={setDragging} />
            }
          </div>
        </div>
      )}

      {/* ── TAREAS ── */}
      {tab==="tasks" && <TasksTab users={users} schedule={schedule} dark={dark} />}

      {/* ── PERSONAS ── */}
      {tab==="users" && (
        <div style={{maxWidth:680,margin:"32px auto",padding:"0 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <div><div style={{fontSize:18,fontWeight:700}}>Personas</div><div style={{fontSize:13,color:"#888",marginTop:2}}>{users.length} personas</div></div>
            <button className="btn" onClick={()=>{ setEditUser(null); setUserModal(true); }} style={{background:"#111",color:"#fff",padding:"7px 14px",borderRadius:6,fontSize:13,fontWeight:500}}>+ Nueva persona</button>
          </div>
          {["Cocina","Caja"].map(area=>(
            <div key={area} style={{marginBottom:28}}>
              <div style={{fontSize:11,fontWeight:700,color:"#AAA",textTransform:"uppercase",letterSpacing:".7px",marginBottom:10}}>{area}</div>
              {users.filter(u=>u.area===area).map(u=>(
                <div key={u.id} className="urow" style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,marginBottom:3,border:"1px solid #F0F0F0",cursor:"pointer"}} onClick={()=>setProfileUser(u)}>
                  <Av name={u.name} color={u.color} size={32}/>
                  <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500}}>{u.name}</div><div style={{fontSize:12,color:"#AAA"}}>{u.role||"Sin cargo"}</div></div>
                  <div style={{display:"flex",gap:6}} onClick={e=>e.stopPropagation()}>
                    <button className="btn" onClick={()=>{ setEditUser(u); setUserModal(true); }} style={{background:"#F5F5F5",color:"#333",padding:"5px 11px",borderRadius:5,fontSize:12}}>Editar</button>
                    {!FIXED_USERS.some(f=>f.id===u.id) && <button className="btn" onClick={()=>setExtra(p=>p.filter(x=>x.id!==u.id))} style={{background:"#FBF0F0",color:"#9B2335",padding:"5px 11px",borderRadius:5,fontSize:12}}>Eliminar</button>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── TURNOS ── */}
      {tab==="shifts" && (
        <div style={{maxWidth:680,margin:"32px auto",padding:"0 24px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
            <div><div style={{fontSize:18,fontWeight:700}}>Turnos</div><div style={{fontSize:13,color:"#888",marginTop:2}}>{shifts.length} turnos · −30 min colación</div></div>
            <button className="btn" onClick={()=>{ setEditShift(null); setShiftModal(true); }} style={{background:"#111",color:"#fff",padding:"7px 14px",borderRadius:6,fontSize:13,fontWeight:500}}>+ Nuevo turno</button>
          </div>
          {shifts.map(s=>(
            <div key={s.id} style={{display:"flex",alignItems:"center",gap:12,padding:"10px 14px",borderRadius:8,marginBottom:3,border:`1px solid ${s.color}22`,background:`${s.color}07`}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:s.color,flexShrink:0}}/>
              <div style={{flex:1}}><div style={{fontSize:14,fontWeight:500}}>{s.name}</div><div style={{fontSize:12,color:"#AAA"}}>{s.start} – {s.end} · {shiftH(s).toFixed(1)}h efectivas</div></div>
              <div style={{display:"flex",gap:6}}>
                <button className="btn" onClick={()=>{ setEditShift(s); setShiftModal(true); }} style={{background:"#F5F5F5",color:"#333",padding:"5px 11px",borderRadius:5,fontSize:12}}>Editar</button>
                <button className="btn" onClick={()=>setShifts(p=>p.filter(x=>x.id!==s.id))} style={{background:"#FBF0F0",color:"#9B2335",padding:"5px 11px",borderRadius:5,fontSize:12}}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {picker && <PickerModal context={picker} users={users} shifts={shifts} dark={dark}
        onPick={val=>{ if(picker.date) assignM(picker.date,picker.uid,val); else assignW(picker.day,picker.uid,val); setPicker(null); }}
        onClose={()=>setPicker(null)} />}

      {reportModal && <ReportModal users={users} shifts={shifts} schedule={schedule} wo={wo} monthRef={monthRef} dark={dark} onClose={()=>setReportModal(false)} />}

      {templateModal && <TemplateModal
        templates={templates} setTemplates={setTemplates}
        wo={wo} monthRef={monthRef}
        currentWeekLabel={weekLabel(wo)}
        onSave={saveAsTemplate}
        onApplyWeek={(tpl,wo2)=>applyTemplate(tpl,wo2)}
        onApplyMonth={(tpl,y,m)=>applyTemplateMonth(tpl,y,m)}
        onClose={()=>setTemplateModal(false)} />}}

      {profileUser && <ProfileModal user={profileUser} users={users} shifts={shifts} schedule={schedule} dark={dark}
        onClose={()=>setProfileUser(null)} onEdit={u=>{ setEditUser(u); setUserModal(true); setProfileUser(null); }} />}

      {userModal && <UserModal initial={editUser} dark={dark} isFixed={editUser?FIXED_USERS.some(f=>f.id===editUser.id):false}
        onSave={u=>{
          if(editUser){ if(FIXED_USERS.some(f=>f.id===editUser.id)){ setExtra(p=>{ const ex=p.find(x=>x.id===editUser.id); return ex?p.map(x=>x.id===editUser.id?{...x,...u}:x):[...p,{...editUser,...u}]; }); } else setExtra(p=>p.map(x=>x.id===editUser.id?{...x,...u}:x)); }
          else setExtra(p=>[...p,{...u,id:`ux${Date.now()}`}]);
          setUserModal(false); setEditUser(null);
        }}
        onClose={()=>{ setUserModal(false); setEditUser(null); }} />}

      {shiftModal && <ShiftModal initial={editShift} dark={dark}
        onSave={s=>{ if(editShift) setShifts(p=>p.map(x=>x.id===editShift.id?{...x,...s}:x)); else setShifts(p=>[...p,{...s,id:`sx${Date.now()}`}]); setShiftModal(false); setEditShift(null); }}
        onClose={()=>{ setShiftModal(false); setEditShift(null); }} />}

      {/* ── DRAG GHOST ── */}
      {dragging && ghostPos && (()=>{
        const d=dragging;
        let content=null;
        if(d.t==="user"){
          const u=users.find(x=>x.id===d.uid);
          content=<div style={{display:"flex",alignItems:"center",gap:7,padding:"5px 9px",background:D.bg2,border:`1px solid ${D.border}`,borderRadius:7,whiteSpace:"nowrap"}}>
            <Av name={u?.name||"?"} color={u?.color||"#888"} size={20}/>
            <span style={{fontSize:12,fontWeight:500,color:D.text}}>{u?.name||""}</span>
          </div>;
        } else if(d.t==="shift"){
          const s=shifts.find(x=>x.id===d.id);
          if(s){ const nc=dark?lighten(s.color):darken(s.color);
            content=<div style={{background:dark?`${s.color}28`:`${s.color}14`,border:`1px solid ${dark?s.color+"55":`${s.color}35`}`,borderRadius:6,padding:"4px 7px",minWidth:80}}>
              <div style={{fontSize:10,fontWeight:700,color:nc,lineHeight:1.3}}>{s.name}</div>
              <div style={{fontSize:9,fontWeight:500,color:`${nc}99`,marginTop:1}}>{s.start}–{s.end}</div>
            </div>;
          }
        } else if(d.t==="special"){
          const st=Object.values(SPECIAL).find(x=>x.id===d.id);
          if(st){ const sc=dark?lighten(st.color):st.color;
            content=<div style={{background:dark?`${st.color}28`:st.bg,border:`1px solid ${dark?st.color+"55":st.border}`,borderRadius:6,padding:"4px 7px",minWidth:60}}>
              <div style={{fontSize:10,fontWeight:600,color:sc,lineHeight:1.3}}>{st.label}</div>
              <div style={{fontSize:9,marginTop:1}}>&nbsp;</div>
            </div>;
          }
        }
        return content ? <div className="drag-ghost" style={{left:ghostPos.x-44,top:ghostPos.y-20,pointerEvents:"none"}}>{content}</div> : null;
      })()}
    </div>
  );
}

// ─── WEEK GRID ────────────────────────────────────────────────────────────────
function WeekGrid({ users, shifts, dates, wSched, dragging, dragOver, setPicker, removeW, userHoursW, areaF, onUserClick, assignW, startDrag, dark, D }) {
  const today=new Date(); today.setHours(0,0,0,0);
  const showSep=areaF==="Todas";
  const rows=[];
  if(showSep){ ["Cocina","Caja"].forEach(area=>{ const au=users.filter(u=>u.area===area); if(!au.length) return; rows.push({sep:true,label:area}); au.forEach(u=>rows.push({sep:false,u})); }); }
  else users.forEach(u=>rows.push({sep:false,u}));

  // Fill handle — supports horizontal (same user, multiple days) AND vertical (same day, multiple users)
  const [filling, setFilling] = useState(null);
  const fillRef = useRef(null);

  function startFill(e, uid, day, val) {
    e.preventDefault(); e.stopPropagation();
    const fromDayIdx = DAYS.indexOf(day);
    const fromRowUid = uid;
    fillRef.current = { uid, val, fromDayIdx, toDayIdx: fromDayIdx, fromRowUid, toRowUid: uid };
    setFilling({ ...fillRef.current });
    document.body.classList.add("is-dragging");
    const onMove = e2 => {
      const el = document.elementFromPoint(e2.clientX, e2.clientY);
      const cell = el?.closest("[data-fillkey]");
      if (cell) {
        const toDayIdx = parseInt(cell.getAttribute("data-fillidx"));
        const toRowUid = cell.getAttribute("data-filluid");
        // Determine direction: if moved more horizontally stay horizontal, else vertical
        const sameDayMove = toDayIdx !== fromDayIdx;
        const sameRowMove = toRowUid !== fromRowUid;
        if (sameDayMove && !sameRowMove) {
          // horizontal fill
          fillRef.current = { ...fillRef.current, toDayIdx, toRowUid: uid };
        } else if (sameRowMove && !sameDayMove) {
          // vertical fill — same day, different users
          fillRef.current = { ...fillRef.current, toDayIdx: fromDayIdx, toRowUid };
        } else if (sameDayMove || sameRowMove) {
          fillRef.current = { ...fillRef.current, toDayIdx, toRowUid };
        }
        setFilling({ ...fillRef.current });
      }
    };
    const onUp = () => {
      document.body.classList.remove("is-dragging");
      const { uid: u, val: v, fromDayIdx: fd, toDayIdx: td, fromRowUid: fr, toRowUid: tr } = fillRef.current;
      // Get all user ids in range (for vertical)
      const allUids = rows.filter(r=>!r.sep).map(r=>r.u.id);
      const frIdx = allUids.indexOf(fr), trIdx = allUids.indexOf(tr);
      const loU = Math.min(frIdx, trIdx), hiU = Math.max(frIdx, trIdx);
      const loD = Math.min(fd, td), hiD = Math.max(fd, td);
      for (let ui = loU; ui <= hiU; ui++) {
        for (let di = loD; di <= hiD; di++) {
          assignW(DAYS[di], allUids[ui], v);
        }
      }
      setFilling(null); fillRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div style={{overflowX:"auto",overflowY:"auto",flex:1}} className={dragging||filling?"no-select":""} onDragStart={e=>e.preventDefault()}>
      <table style={{borderCollapse:"collapse",width:"100%",minWidth:760}}>
        <thead>
          <tr style={{background:D.tableHead}}>
            <th style={{padding:"10px 16px",textAlign:"left",fontSize:11,fontWeight:600,color:D.text,borderBottom:`1px solid ${D.border}`,position:"sticky",left:0,background:D.tableHead,zIndex:5,width:136}}>Persona</th>
            {DAYS.map((day,di)=>{
              const d=dates[di], isToday=d&&d.toDateString()===today.toDateString(), isSun=di===6;
              return <th key={day} style={{padding:"10px 6px",textAlign:"center",fontSize:11,fontWeight:600,color:isSun?D.text3:D.text,borderBottom:`1px solid ${D.border}`,borderLeft:`1px solid ${D.border}`,minWidth:100}}>
                <div style={{display:"inline-flex",flexDirection:"column",alignItems:"center",gap:2}}>
                  <span style={{fontSize:9,color:D.text2,fontWeight:500,textTransform:"uppercase",letterSpacing:".5px"}}>{DAY_SHORT[di]}</span>
                  <span style={{fontSize:14,fontWeight:700,background:isToday?D.text:"transparent",color:isToday?D.bg:"inherit",borderRadius:5,padding:"2px 7px",lineHeight:1.3}}>{d?.getDate()}</span>
                </div>
              </th>;
            })}
            <th style={{padding:"10px 8px",textAlign:"center",fontSize:11,fontWeight:600,color:D.text,borderBottom:`1px solid ${D.border}`,minWidth:50}}>hrs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row,ri)=>{
            if(row.sep) return <tr key={`s${ri}`}><td colSpan={9} style={{padding:"5px 16px",fontSize:9,fontWeight:700,color:D.text3,textTransform:"uppercase",letterSpacing:"1px",background:D.bg2,borderBottom:`1px solid ${D.border}`}}>{row.label}</td></tr>;
            const u=row.u, hrs=userHoursW(u.id), over=hrs>RULES.WEEK_H;
            return <tr key={u.id} className="wrow" style={{borderBottom:`1px solid ${D.border}`}}>
              <td style={{padding:"6px 16px",position:"sticky",left:0,background:D.cell,zIndex:2}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div onPointerDown={e=>startDrag(e,{t:"user",uid:u.id})} className="no-select"
                    style={{cursor:"grab",flexShrink:0}}>
                    <Av name={u.name} color={u.color} size={22}/>
                  </div>
                  <div style={{cursor:"pointer",minWidth:0}} onClick={()=>onUserClick(u)}>
                    <div style={{fontSize:12,fontWeight:500,color:D.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{u.name}</div>
                    <div style={{fontSize:10,color:D.text3}}>{u.role}</div>
                  </div>
                </div>
              </td>
              {DAYS.map((day,di)=>{
                const ck=`${day}||${u.id}`, isOver=dragOver===ck, val=wSched[`${day}-${u.id}`];
                const allUids = rows.filter(r=>!r.sep).map(r=>r.u.id);
                const myRowIdx = allUids.indexOf(u.id);
                const isFillHighlight = filling && (() => {
                  const loD=Math.min(filling.fromDayIdx,filling.toDayIdx), hiD=Math.max(filling.fromDayIdx,filling.toDayIdx);
                  const frIdx=allUids.indexOf(filling.fromRowUid), trIdx=allUids.indexOf(filling.toRowUid);
                  const loU=Math.min(frIdx,trIdx), hiU=Math.max(frIdx,trIdx);
                  return di>=loD && di<=hiD && myRowIdx>=loU && myRowIdx<=hiU;
                })();
                return <td key={day} className={`wcell ${isOver?"drag-ov":""}`}
                  data-cellkey={`${day}||${u.id}`}
                  data-fillkey="1" data-filluid={u.id} data-fillidx={di}
                  onClick={()=>{ if(!dragging && !filling && !val) setPicker({day,uid:u.id}); }}
                  style={{padding:"4px 4px",borderRadius:isOver?6:0,borderLeft:`1px solid ${D.border}`,cursor:val?"grab":"pointer",background:isFillHighlight?(dark?"#252525":"#F5F5F5"):D.cell}}>
                  <div style={{position:"relative",minHeight:38}} className={val?"cell-filled":""}
                    onPointerDown={val?e=>{
                      // Only start move drag if not clicking the rm button or fill handle
                      if(e.target.closest(".rm")||e.target.closest(".fill-handle")) return;
                      e.preventDefault(); e.stopPropagation();
                      // Determine drag type based on val
                      const dragPayload = isSpec(val)
                        ? {t:"special", id:val}
                        : {t:"shift", id:val};
                      // Remove from source on drop — store source info
                      dragPayload._srcDay = day;
                      dragPayload._srcUid = u.id;
                      startDrag(e, dragPayload);
                    }:undefined}>
                    {isOver && <div className="cell-drop-hint"/>}
                    <CellTag val={val} shifts={shifts} dark={dark}/>
                    {val && (
                      <div
                        onPointerDown={e=>{ e.stopPropagation(); startFill(e, u.id, day, val); }}
                        style={{position:"absolute",bottom:2,right:2,width:14,height:10,cursor:"crosshair",zIndex:4,background:"transparent"}}
                        className="fill-handle"
                      />
                    )}
                    {val && <button className="btn rm" onPointerDown={e=>e.stopPropagation()} onClick={e=>{ e.stopPropagation(); removeW(day,u.id); }}
                      style={{position:"absolute",top:2,right:2,background:dark?"rgba(30,30,30,.95)":"rgba(255,255,255,.96)",color:D.text2,fontSize:10,lineHeight:1,padding:"2px 4px",borderRadius:4,border:`1px solid ${D.border}`,opacity:0,zIndex:5}}>×</button>}
                    {!val && <div className="cell-plus" style={{height:38,display:"flex",alignItems:"center",justifyContent:"center",color:D.text3,fontSize:6,opacity:0,transition:"opacity .1s"}}>{isOver?"↓":"+"}</div>}
                  </div>
                </td>;
              })}
              <td style={{textAlign:"center",fontSize:12,fontWeight:600,color:over?"#9B2335":hrs>=42?"#3D7A61":D.text2,paddingRight:8,whiteSpace:"nowrap"}}>{hrs.toFixed(1)}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── MONTH CALENDAR (Google Calendar style) ───────────────────────────────────
function MonthCal({ users, shifts, schedule, monthRef, dark, dragging, dragOver, setDragOver, setPicker, dropM, removeM, setDragging }) {
  const D=getD(dark);
  const {y,m}=monthRef;
  const today=new Date(); today.setHours(0,0,0,0);
  const first=new Date(y,m,1);
  const offset=(first.getDay()+6)%7;
  const all=monthDates(y,m);
  const cells=[...Array(offset).fill(null),...all];
  while(cells.length%7!==0) cells.push(null);
  const weeks=[];
  for(let i=0;i<cells.length;i+=7) weeks.push(cells.slice(i,i+7));

  return (
    <div style={{flex:1,overflowY:"auto",background:D.bg}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${D.border}`,background:D.bg2,position:"sticky",top:0,zIndex:3}}>
        {DAY_SHORT.map((d,i)=>(
          <div key={d} style={{padding:"7px 0",textAlign:"center",fontSize:11,fontWeight:600,color:i===6?D.text3:D.text2}}>{d}</div>
        ))}
      </div>
      {weeks.map((week,wi)=>(
        <div key={wi} style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`1px solid ${D.border}`}}>
          {week.map((date,di)=>{
            if(!date) return <div key={di} style={{minHeight:90,background:D.bg2,borderRight:di<6?`1px solid ${D.border}`:"none"}}/>;
            const isToday=date.toDateString()===today.toDateString();
            const isSun=(date.getDay()+6)%7===6;
            const ck=`cal-${date.toDateString()}`;
            const isOver=dragOver===ck;
            const events=users.map(u=>{ const v=cellByDate(schedule,date,u.id); return v?{u,v}:null; }).filter(Boolean);
            return (
              <div key={di} className="cal-cell"
                onDragOver={e=>{ e.preventDefault(); setDragOver(ck); }}
                onDragLeave={()=>setDragOver(null)}
                onDrop={()=>{ if(!dragging) return; setDragOver(null); if(dragging.t==="user") setPicker({date,uid:dragging.uid}); setDragging(null); }}
                style={{minHeight:90,padding:"5px 4px",background:isOver?D.bg3:isToday?D.bg2:isSun?D.bg2:D.bg,borderRight:di<6?`1px solid ${D.border}`:"none",position:"relative"}}>
                <div style={{textAlign:"right",marginBottom:3}}>
                  <span style={{fontSize:12,fontWeight:isToday?700:400,color:isToday?D.bg:isSun?D.text3:D.text2,background:isToday?D.text:"transparent",borderRadius:"50%",width:22,height:22,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{date.getDate()}</span>
                </div>
                {events.slice(0,4).map(({u,v},ei)=>{
                  if(isSpec(v)){
                    const st=getSpec(v);
                    return <div key={ei} title={`${u.name}: ${st.label}`}
                      style={{fontSize:9,fontWeight:500,color:dark?lighten(st.color):st.color,background:dark?`${st.color}28`:st.bg,border:`1px solid ${dark?st.color+"44":st.border}`,borderRadius:3,padding:"1px 4px",marginBottom:1,display:"flex",alignItems:"center",gap:2,overflow:"hidden",whiteSpace:"nowrap",cursor:"default"}}>
                      <div style={{width:4,height:4,borderRadius:"50%",background:u.color,flexShrink:0}}/>
                      <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{u.name.split(" ")[0]} · {st.label}</span>
                    </div>;
                  }
                  const s=shifts.find(x=>x.id===v);
                  if(!s) return null;
                  return <div key={ei} title={`${u.name}: ${s.name} ${s.start}–${s.end}`}
                    style={{fontSize:9,fontWeight:500,color:dark?lighten(s.color):darken(s.color),background:dark?`${s.color}28`:`${s.color}12`,border:`1px solid ${dark?s.color+"44":`${s.color}22`}`,borderRadius:3,padding:"1px 4px",marginBottom:1,display:"flex",alignItems:"center",gap:2,overflow:"hidden",whiteSpace:"nowrap",cursor:"default"}}>
                    <div style={{width:4,height:4,borderRadius:"50%",background:s.color,flexShrink:0}}/>
                    <span style={{overflow:"hidden",textOverflow:"ellipsis"}}>{u.name.split(" ")[0]} · {s.name}</span>
                  </div>;
                })}
                {events.length>4 && <div style={{fontSize:9,color:D.text3,paddingLeft:2}}>+{events.length-4} más</div>}
                <div onClick={()=>{ if(users.length>0) setPicker({date,uid:users[0].id}); }}
                  style={{position:"absolute",top:4,left:4,fontSize:9,color:D.text3,cursor:"pointer",lineHeight:1,opacity:0,transition:"opacity .13s"}}
                  onMouseEnter={e=>e.currentTarget.style.opacity=1} onMouseLeave={e=>e.currentTarget.style.opacity=0}>+</div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── TASKS TAB ────────────────────────────────────────────────────────────────
// Plancha: rotates every OTHER day among all kitchen staff except Miriam (u1)
// Colación: one person per day among kitchen staff working that day (manual assignment stored)
// MIRIAM_ID constant
const MIRIAM_ID = "u1";
const PLANCHA_USERS = ROTATION_USER_ORDER.filter(id=>id!==MIRIAM_ID); // Ayerim,Roxedy,Bettys,Carmen

// Plancha anchor: day 0 = Monday of anchor week (wo=0) → user index 0 (Ayerim)
// Rotates every 2 days: Mon=0,Wed=0,Fri=0,Sun=0 / Tue=1,Thu=1,Sat=1 etc.
function getPlanchaForDay(dateObj){
  // Count business days from an anchor Monday
  const anchor=new Date(2025,2,24); // fixed anchor Monday (adjust if needed)
  anchor.setHours(0,0,0,0);
  const d=new Date(dateObj); d.setHours(0,0,0,0);
  const diffDays=Math.round((d-anchor)/(24*3600*1000));
  const slot=Math.floor(((diffDays%2)+2)%2===0?diffDays/2:( diffDays-1)/2);
  // simpler: every day count / 2
  const idx2=Math.floor((((diffDays)%PLANCHA_USERS.length*2)+PLANCHA_USERS.length*2)/(2))%PLANCHA_USERS.length;
  // Actually: alternate every day (not every 2 days as in business days — "día por medio" = every other calendar day)
  const absDay=Math.round((d-anchor)/(24*3600*1000));
  const n=PLANCHA_USERS.length;
  const planchaIdx=((Math.floor(absDay/2)%n)+n)%n;
  return PLANCHA_USERS[planchaIdx];
}

function TasksTab({ users, schedule, dark }) {
  const D = getD(dark);
  const [wo, setWo] = useState(0);
  const [rotNames, setRotNames] = useState(()=>JSON.parse(localStorage.getItem("so_rot_names")||JSON.stringify(ROTATING_TASKS)));
  const [fixNames, setFixNames] = useState(()=>JSON.parse(localStorage.getItem("so_fix_names")||JSON.stringify(FIXED_TASKS)));
  const [colacion, setColacion] = useState(()=>JSON.parse(localStorage.getItem("so_colacion")||"{}"));
  const [planchaOverride, setPlanchaOverride] = useState(()=>JSON.parse(localStorage.getItem("so_plancha")||"{}"));
  const [editingRot, setEditingRot] = useState(null);
  const [editingFix, setEditingFix] = useState(null);
  const [editVal,    setEditVal]    = useState("");

  useEffect(()=>{ localStorage.setItem("so_rot_names",JSON.stringify(rotNames)); },[rotNames]);
  useEffect(()=>{ localStorage.setItem("so_fix_names",JSON.stringify(fixNames)); },[fixNames]);
  useEffect(()=>{ localStorage.setItem("so_colacion", JSON.stringify(colacion));  },[colacion]);
  useEffect(()=>{ localStorage.setItem("so_plancha",  JSON.stringify(planchaOverride)); },[planchaOverride]);

  const kitchenUsers = ROTATION_USER_ORDER.map(id=>users.find(u=>u.id===id)).filter(Boolean);
  const planchaUsers = kitchenUsers.filter(u=>u.id!==MIRIAM_ID);
  const dates = weekDates(wo);

  function getRotAssignment(wo){
    const n=rotNames.length; const result={};
    ROTATION_USER_ORDER.forEach((uid,ui)=>{ result[uid]=rotNames[((ANCHOR_TASK_OFFSET+ui+wo)%n+n)%n]; });
    return result;
  }
  function getFixAssignment(wo){
    const result={};
    ROTATION_USER_ORDER.forEach((uid,ui)=>{ result[uid]=fixNames[ui % fixNames.length]; });
    return result;
  }

  const rotating=getRotAssignment(wo);
  const fixed=getFixAssignment(wo);

  function startEdit(type,i,val){ if(type==="rot"){setEditingRot(i);setEditingFix(null);}else{setEditingFix(i);setEditingRot(null);} setEditVal(val); }
  function saveEdit(type,i){ if(type==="rot"){setRotNames(p=>{const a=[...p];a[i]=editVal.trim()||p[i];return a;});setEditingRot(null);}else{setFixNames(p=>{const a=[...p];a[i]=editVal.trim()||p[i];return a;});setEditingFix(null);} }

  function setColDay(dateKey,uid){ setColacion(p=>({...p,[dateKey]:uid})); }

  // Table header component
  const TH=({children,w})=>(
    <th style={{textAlign:"left",fontSize:11,fontWeight:600,color:D.text,padding:"9px 14px",borderBottom:`1px solid ${D.border2}`,background:D.bg2,width:w||"auto"}}>{children}</th>
  );

  const SectionTitle=({children})=>(
    <div style={{fontSize:13,fontWeight:600,color:D.text,marginBottom:10,marginTop:28}}>{children}</div>
  );

  return (
    <div style={{maxWidth:720,margin:"32px auto",padding:"0 24px",color:D.text}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
        <div>
          <div style={{fontSize:18,fontWeight:700,color:D.text}}>Tareas</div>
          <div style={{fontSize:13,color:D.text2,marginTop:2}}>Cocina · rotación automática</div>
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          <button className="nav-btn" onClick={()=>setWo(w=>w-1)}>‹</button>
          <span style={{fontSize:13,fontWeight:500,color:D.text,minWidth:158,textAlign:"center"}}>{weekLabel(wo)}</span>
          <button className="nav-btn" onClick={()=>setWo(w=>w+1)}>›</button>
          <button className="nav-btn" onClick={()=>setWo(0)} style={{fontSize:11,color:D.text2}}>Hoy</button>
        </div>
      </div>

      {/* ── PLANCHA ── */}
      <SectionTitle>Plancha</SectionTitle>
      <div style={{border:`1px solid ${D.border}`,borderRadius:10,overflow:"hidden",marginBottom:4}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH w="16%">Día</TH><TH w="20%">Fecha</TH><TH>Persona</TH></tr></thead>
          <tbody>
            {DAYS.map((day,di)=>{
              const date=dates[di];
              const dateKey=`pl-${date?.toDateString()}`;
              const autoUid=getPlanchaForDay(date);
              const assignedId=planchaOverride[dateKey]||autoUid;
              const u=planchaUsers.find(x=>x.id===assignedId)||planchaUsers.find(x=>x.id===autoUid);
              const isOverridden=!!planchaOverride[dateKey];
              return (
                <tr key={day} className="task-row" style={{borderBottom:di<6?`1px solid ${D.border}`:"none"}}>
                  <td style={{padding:"9px 14px",fontSize:12,fontWeight:500,color:D.text}}>{day}</td>
                  <td style={{padding:"9px 14px",fontSize:12,color:D.text2}}>{date?.toLocaleDateString("es-CL",{day:"numeric",month:"short"})}</td>
                  <td style={{padding:"7px 14px"}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <select value={assignedId||""}
                        onChange={e=>setPlanchaOverride(p=>({...p,[dateKey]:e.target.value}))}
                        style={{fontSize:12,color:D.text,background:isOverridden?(dark?"#2A2200":"#FDFAF0"):D.bg2,border:`1px solid ${isOverridden?"#E8D88A":D.border}`,borderRadius:5,padding:"4px 8px",width:190,cursor:"pointer",fontFamily:"inherit"}}>
                        {planchaUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      {isOverridden && <button className="btn" onClick={()=>setPlanchaOverride(p=>{ const n={...p}; delete n[dateKey]; return n; })}
                        style={{fontSize:10,color:"#C8A000",background:"none",padding:"0 2px",textDecoration:"underline"}}>auto</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{fontSize:10,color:D.text3,marginBottom:28,paddingLeft:2}}>Miriam no hace plancha. Rotación automática día por medio. Puedes editar cualquier día manualmente.</div>

      {/* ── COLACIÓN ── */}
      <SectionTitle>Colación de cocina</SectionTitle>
      <div style={{border:`1px solid ${D.border}`,borderRadius:10,overflow:"hidden",marginBottom:4}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH w="16%">Día</TH><TH w="20%">Fecha</TH><TH>Asignada a</TH></tr></thead>
          <tbody>
            {DAYS.map((day,di)=>{
              const date=dates[di];
              const dateKey=`col-${date?.toDateString()}`;
              const assignedId=colacion[dateKey];
              const assigned=kitchenUsers.find(u=>u.id===assignedId);
              const wo2=dateToWO(date);
              const wk2=wKey(wo2);
              const daySched=schedule[wk2]||{};
              const availableUsers=kitchenUsers.filter(u=>{
                const v=daySched[`${day}-${u.id}`];
                return v && !Object.values(SPECIAL).some(s=>s.id===v);
              });
              const assignedStillWorking=assigned && availableUsers.some(u=>u.id===assigned.id);
              return (
                <tr key={day} className="task-row" style={{borderBottom:di<6?`1px solid ${D.border}`:"none"}}>
                  <td style={{padding:"9px 14px",fontSize:12,fontWeight:500,color:D.text}}>{day}</td>
                  <td style={{padding:"9px 14px",fontSize:12,color:D.text2}}>{date?.toLocaleDateString("es-CL",{day:"numeric",month:"short"})}</td>
                  <td style={{padding:"7px 14px"}}>
                    {availableUsers.length===0
                      ? <span style={{fontSize:12,color:D.text3}}>Sin turnos asignados</span>
                      : <div style={{display:"flex",alignItems:"center",gap:10}}>
                          {assignedStillWorking
                            ? <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                                <Av name={assigned.name} color={assigned.color} size={22}/>
                                <span style={{fontSize:12,fontWeight:500,color:D.text}}>{assigned.name}</span>
                                <button className="btn" onClick={()=>setColDay(dateKey,null)}
                                  style={{marginLeft:"auto",color:D.text2,fontSize:12,background:"none",padding:"0 4px"}}>×</button>
                              </div>
                            : <select value="" onChange={e=>{ if(e.target.value) setColDay(dateKey,e.target.value); }}
                                style={{fontSize:12,color:D.text2,background:D.bg2,border:`1px solid ${D.border}`,borderRadius:5,padding:"4px 8px",width:180,cursor:"pointer",fontFamily:"inherit"}}>
                                <option value="">Sin asignar...</option>
                                {availableUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                              </select>
                          }
                        </div>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{fontSize:10,color:D.text3,marginBottom:28,paddingLeft:2}}>Solo aparecen personas con turno asignado ese día.</div>

      {/* ── ROTATIVAS ── */}
      <SectionTitle>Tareas rotativas</SectionTitle>
      <div style={{border:`1px solid ${D.border}`,borderRadius:10,overflow:"hidden",marginBottom:6}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH w="45%">Tarea</TH><TH>Persona</TH><TH w="20%">Cargo</TH></tr></thead>
          <tbody>
            {rotNames.map((taskName,i)=>{
              const assignedId=Object.keys(rotating).find(uid=>rotating[uid]===taskName);
              const u=kitchenUsers.find(x=>x.id===assignedId);
              const isEditing=editingRot===i;
              return (
                <tr key={i} className="task-row" style={{borderBottom:i<rotNames.length-1?`1px solid ${D.border}`:"none"}}>
                  <td style={{padding:"9px 14px",fontSize:12,color:D.text}}>
                    {isEditing
                      ? <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <input value={editVal} onChange={e=>setEditVal(e.target.value)} autoFocus
                            onKeyDown={e=>{ if(e.key==="Enter") saveEdit("rot",i); if(e.key==="Escape") setEditingRot(null); }}
                            style={{fontSize:12,padding:"3px 7px",borderRadius:4,width:"100%"}}/>
                          <button className="btn" onClick={()=>saveEdit("rot",i)} style={{background:D.tabActive,color:D.tabActiveText,fontSize:11,padding:"3px 8px",borderRadius:4,flexShrink:0}}>ok</button>
                        </div>
                      : <span style={{cursor:"default"}} onDoubleClick={()=>startEdit("rot",i,taskName)}>{taskName}</span>}
                  </td>
                  <td style={{padding:"9px 14px",fontSize:12}}>{u?<div style={{display:"flex",alignItems:"center",gap:8}}><Av name={u.name} color={u.color} size={22}/><span style={{fontWeight:500,color:D.text}}>{u.name}</span></div>:<span style={{color:D.text3}}>—</span>}</td>
                  <td style={{padding:"9px 14px",fontSize:12,color:D.text2}}>{u?.role||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{fontSize:10,color:D.text3,marginBottom:28,paddingLeft:2}}>Doble clic en el nombre de la tarea para renombrarla.</div>

      {/* ── FIJAS ── */}
      <SectionTitle>Tareas fijas</SectionTitle>
      <div style={{border:`1px solid ${D.border}`,borderRadius:10,overflow:"hidden",marginBottom:6}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr><TH w="45%">Tarea</TH><TH>Persona</TH><TH w="20%">Cargo</TH></tr></thead>
          <tbody>
            {fixNames.map((taskName,i)=>{
              const assignedId=Object.keys(fixed).find(uid=>fixed[uid]===taskName);
              const u=kitchenUsers.find(x=>x.id===assignedId);
              const isEditing=editingFix===i;
              return (
                <tr key={i} className="task-row" style={{borderBottom:i<fixNames.length-1?`1px solid ${D.border}`:"none"}}>
                  <td style={{padding:"9px 14px",fontSize:12,color:D.text}}>
                    {isEditing
                      ? <div style={{display:"flex",gap:6,alignItems:"center"}}>
                          <input value={editVal} onChange={e=>setEditVal(e.target.value)} autoFocus
                            onKeyDown={e=>{ if(e.key==="Enter") saveEdit("fix",i); if(e.key==="Escape") setEditingFix(null); }}
                            style={{fontSize:12,padding:"3px 7px",borderRadius:4,width:"100%"}}/>
                          <button className="btn" onClick={()=>saveEdit("fix",i)} style={{background:D.tabActive,color:D.tabActiveText,fontSize:11,padding:"3px 8px",borderRadius:4,flexShrink:0}}>ok</button>
                        </div>
                      : <span style={{cursor:"default"}} onDoubleClick={()=>startEdit("fix",i,taskName)}>{taskName}</span>}
                  </td>
                  <td style={{padding:"9px 14px",fontSize:12}}>{u?<div style={{display:"flex",alignItems:"center",gap:8}}><Av name={u.name} color={u.color} size={22}/><span style={{fontWeight:500,color:D.text}}>{u.name}</span></div>:<span style={{color:D.text3}}>—</span>}</td>
                  <td style={{padding:"9px 14px",fontSize:12,color:D.text2}}>{u?.role||"—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{fontSize:10,color:D.text3,paddingLeft:2}}>Doble clic en el nombre de la tarea para renombrarla.</div>
    </div>
  );
}

// ─── PROFILE MODAL ────────────────────────────────────────────────────────────
function ProfileModal({ user, users, shifts, schedule, dark, onClose, onEdit }) {
  const D = getD(dark);
  const [wo, setWo] = useState(0);
  const printRef = useRef();
  const wk = wKey(wo);
  const wSched = schedule[wk]||{};
  const dates = weekDates(wo);
  const rotating = getRotatingAssignment(wo);
  const fixed    = getFixedAssignment(wo);
  const rotTask = user.area==="Cocina" ? rotating[user.id] : null;
  const fixTask = user.area==="Cocina" ? fixed[user.id] : null;

  let totalH=0;
  const dayRows=DAYS.map((day,di)=>{
    const val=wSched[`${day}-${user.id}`];
    let label="—", timeLabel=null;
    if(val){
      if(isSpec(val)){ label=getSpec(val).label; }
      else { const s=shifts.find(x=>x.id===val); if(s){ timeLabel=`${s.start}–${s.end}`; label=timeLabel; const h=shiftH(s); totalH+=h; }}
    }
    return {day, date:dates[di], label, timeLabel};
  });

  // Colación — check if this user is assigned colación any day this week
  const colacionStorage = JSON.parse(localStorage.getItem("so_colacion")||"{}");
  const colacionDays = dates.filter(d=>{
    const key=`col-${d?.toDateString()}`;
    return colacionStorage[key]===user.id;
  }).map(d=>DAYS[(d.getDay()+6)%7]);

  function printPDF(){
    const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Perfil ${user.name}</title>
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
      *{box-sizing:border-box;margin:0;padding:0;}
      body{font-family:'Inter',sans-serif;color:#111;background:#fff;padding:48px 56px;max-width:680px;margin:0 auto;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      h1{font-size:22px;font-weight:700;letter-spacing:-0.5px;margin-bottom:3px;}
      .meta{font-size:12px;color:#888;margin-bottom:32px;}
      .sec-title{font-size:9px;font-weight:700;color:#AAA;text-transform:uppercase;letter-spacing:1.4px;margin-bottom:8px;margin-top:28px;}
      table{width:100%;border-collapse:collapse;}
      th{text-align:left;font-size:11px;font-weight:600;color:#111;padding:8px 12px;background:#FAFAFA;border-bottom:1px solid #DEDEDE;}
      td{font-size:12px;color:#222;padding:9px 12px;border-bottom:1px solid #F2F2F2;}
      tr:last-child td{border-bottom:none;}
      td.day{font-weight:500;color:#111;white-space:nowrap;}
      td.dim{color:#AAA;}
      .task-item{padding:9px 12px;border-bottom:1px solid #F2F2F2;font-size:12px;color:#222;}
      .task-item:last-child{border-bottom:none;}
      .footer{margin-top:44px;font-size:10px;color:#CCC;border-top:1px solid #EBEBEB;padding-top:12px;display:flex;justify-content:space-between;}
      @media print{body{padding:28px 36px;}}
    </style></head><body>
    <h1>${user.name}</h1>
    <div class="meta">${user.role||"Sin cargo"} &nbsp;·&nbsp; ${user.area} &nbsp;·&nbsp; ${weekLabel(wo)}</div>

    <div class="sec-title">Horario</div>
    <table>
      <thead><tr><th style="width:38%">Día</th><th>Horario</th></tr></thead>
      <tbody>
      ${dayRows.map(r=>{
        const dateStr=r.date?.toLocaleDateString("es-CL",{day:"numeric",month:"long"});
        const dayDate=`${r.day} ${r.date?.getDate()}`;
        const isOff=r.label==="—"||r.label==="Libre";
        return `<tr>
          <td class="day">${dayDate}</td>
          <td class="${isOff?"dim":""}">${r.label}</td>
        </tr>`;
      }).join("")}
      </tbody>
    </table>

    ${user.area==="Cocina"&&(rotTask||fixTask||colacionDays.length>0)?`
    <div class="sec-title">Tareas esta semana</div>
    <div style="border:1px solid #EBEBEB;border-radius:6px;overflow:hidden;">
      ${rotTask?`<div class="task-item">${rotTask}</div>`:""}
      ${fixTask?`<div class="task-item">${fixTask}</div>`:""}
      ${colacionDays.length>0?`<div class="task-item">Colación — ${colacionDays.join(", ")}</div>`:""}
    </div>`:""}

    <div class="footer">
      <span>stShifts</span>
      <span>Generado el ${new Date().toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"})}</span>
    </div>
    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
    </body></html>`;
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const w=window.open(url,"_blank","width=800,height=900");
    if(!w){ const a=document.createElement("a"); a.href=url; a.target="_blank"; a.click(); }
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:D.bg2,borderRadius:14,padding:0,width:520,maxHeight:"88vh",overflowY:"auto",boxShadow:"0 12px 40px rgba(0,0,0,.25)",border:`1px solid ${D.border}`}}>
        {/* Header */}
        <div style={{padding:"22px 24px 18px",borderBottom:`1px solid ${D.border}`,display:"flex",alignItems:"center",gap:14}}>
          <Av name={user.name} color={user.color} size={44}/>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:700,color:D.text}}>{user.name}</div>
            <div style={{fontSize:12,color:D.text2,marginTop:2}}>{user.role||"Sin cargo"} · {user.area}</div>
          </div>
          <div style={{display:"flex",gap:7}}>
            <button className="btn" onClick={printPDF} style={{background:D.tabActive,color:D.tabActiveText,padding:"6px 13px",borderRadius:6,fontSize:12,fontWeight:500}}>↓ PDF</button>
            <button className="btn" onClick={()=>onEdit(user)} style={{background:D.bg3,color:D.text,padding:"6px 11px",borderRadius:6,fontSize:12}}>Editar</button>
            <button className="btn" onClick={onClose} style={{background:"none",color:D.text2,fontSize:18,padding:"0 4px"}}>×</button>
          </div>
        </div>

        {/* Week nav */}
        <div style={{padding:"10px 24px",borderBottom:`1px solid ${D.border}`,display:"flex",alignItems:"center",gap:8}}>
          <button className="nav-btn" onClick={()=>setWo(w=>w-1)}>‹</button>
          <span style={{fontSize:12,fontWeight:500,color:D.text,flex:1,textAlign:"center"}}>{weekLabel(wo)}</span>
          <button className="nav-btn" onClick={()=>setWo(w=>w+1)}>›</button>
          <button className="nav-btn" onClick={()=>setWo(0)} style={{fontSize:10,color:D.text2}}>Hoy</button>
        </div>

        <div ref={printRef} style={{padding:"18px 24px"}}>
          {/* Schedule */}
          <div style={{fontSize:10,fontWeight:700,color:D.text2,textTransform:"uppercase",letterSpacing:".7px",marginBottom:10}}>Horario</div>
          <table style={{width:"100%",borderCollapse:"collapse",marginBottom:6}}>
            <thead>
              <tr style={{background:D.tableHead}}>
                <th style={{textAlign:"left",fontSize:11,fontWeight:600,color:D.text,padding:"7px 10px",borderBottom:`1px solid ${D.border}`,width:"42%"}}>Día</th>
                <th style={{textAlign:"left",fontSize:11,fontWeight:600,color:D.text,padding:"7px 10px",borderBottom:`1px solid ${D.border}`}}>Horario</th>
              </tr>
            </thead>
            <tbody>
              {dayRows.map((r,i)=>(
                <tr key={r.day} style={{borderBottom:i<6?`1px solid ${D.border}`:"none"}}>
                  <td style={{padding:"8px 10px",fontSize:12,fontWeight:500,color:D.text,whiteSpace:"nowrap"}}>
                    {r.day} <span style={{fontWeight:400,color:D.text2}}>{r.date?.getDate()}</span>
                  </td>
                  <td style={{padding:"8px 10px",fontSize:12,color:r.label==="—"?D.text3:D.text}}>{r.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{textAlign:"right",fontSize:11,color:totalH>RULES.WEEK_H?"#9B2335":totalH>=42?"#3D7A61":D.text2,marginBottom:22}}>
            {totalH.toFixed(1)}h / 44h
          </div>

          {/* Tasks */}
          {user.area==="Cocina" && (rotTask||fixTask||colacionDays.length>0) && (
            <>
              <div style={{fontSize:10,fontWeight:700,color:D.text2,textTransform:"uppercase",letterSpacing:".7px",marginBottom:10}}>Tareas esta semana</div>
              <div style={{border:`1px solid ${D.border}`,borderRadius:8,overflow:"hidden"}}>
                {rotTask && <div style={{padding:"9px 14px",borderBottom:(fixTask||colacionDays.length>0)?`1px solid ${D.border}`:"none",fontSize:13,fontWeight:500,color:D.text}}>{rotTask}</div>}
                {fixTask && <div style={{padding:"9px 14px",borderBottom:colacionDays.length>0?`1px solid ${D.border}`:"none",fontSize:13,fontWeight:500,color:D.text}}>{fixTask}</div>}
                {colacionDays.length>0 && <div style={{padding:"9px 14px",fontSize:13,fontWeight:500,color:D.text}}>Colación — <span style={{fontWeight:400,color:D.text2}}>{colacionDays.join(", ")}</span></div>}
              </div>
            </>
          )}
          {user.area==="Cocina" && !rotTask && !fixTask && colacionDays.length===0 && (
            <><div style={{fontSize:10,fontWeight:700,color:D.text2,textTransform:"uppercase",letterSpacing:".7px",marginBottom:10}}>Tareas esta semana</div><div style={{padding:"12px 14px",fontSize:12,color:D.text3,border:`1px solid ${D.border}`,borderRadius:8}}>Sin tareas esta semana.</div></>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── REPORT MODAL ─────────────────────────────────────────────────────────────
function ReportModal({ users, shifts, schedule, wo, monthRef, dark, onClose }) {
  const D = getD(dark);
  const [area, setArea] = useState("Cocina");
  const [period, setPeriod] = useState("week-current"); // "week-current"|"week-prev"|"month-current"|"custom"
  const today = new Date();
  // Custom range state
  const [customWo1, setCustomWo1] = useState(wo);
  const [customWo2, setCustomWo2] = useState(wo);

  function getLabel() {
    if(period==="week-current") return weekLabel(wo);
    if(period==="week-prev") return weekLabel(wo-1);
    if(period==="month-current") return `${MONTH_NAMES[monthRef.m]} ${monthRef.y}`;
    return `${weekLabel(customWo1)} — ${weekLabel(customWo2)}`;
  }

  function buildHTML(filterArea) {
    let tableHTML="";
    if(period==="week-current"||period==="week-prev") {
      const w = period==="week-prev" ? wo-1 : wo;
      const wk2=wKey(w), wSched=schedule[wk2]||{};
      const au=users.filter(u=>u.area===filterArea);
      const wd=weekDates(w);
      tableHTML=`<h2>${filterArea} · ${weekLabel(w)}</h2><table>
        <thead><tr><th>Persona</th>${wd.map((d,di)=>`<th>${DAY_SHORT[di]}<br><span style="font-weight:400;color:#888">${d.getDate()}</span></th>`).join("")}<th>hrs</th></tr></thead>
        <tbody>${au.map(u=>{
          let th=0;
          const cells=DAYS.map(day=>{ const c=wSched[`${day}-${u.id}`]; if(!c) return "<td>—</td>"; const sp=getSpec(c); if(sp) return `<td>${sp.hidden?"":sp.label}</td>`; const s=shifts.find(x=>x.id===c); if(!s) return "<td>—</td>"; th+=shiftH(s); return `<td>${s.name}<br><span style="color:#888;font-size:10px">${s.start}–${s.end}</span></td>`; }).join("");
          return `<tr><td class="name">${u.name}</td>${cells}<td class="hrs">${th.toFixed(1)}h</td></tr>`;
        }).join("")}</tbody></table>`;
    } else if(period==="month-current") {
      const au=users.filter(u=>u.area===filterArea);
      const allD=monthDates(monthRef.y,monthRef.m);
      tableHTML=`<h2>${filterArea} · ${MONTH_NAMES[monthRef.m]} ${monthRef.y}</h2><table>
        <thead><tr><th>Día</th><th>Fecha</th>${au.map(u=>`<th>${u.name.split(" ")[0]}</th>`).join("")}</tr></thead>
        <tbody>${allD.map(date=>{ const di=(date.getDay()+6)%7; const cells=au.map(u=>{ const c=cellByDate(schedule,date,u.id); if(!c) return "<td>—</td>"; const sp=getSpec(c); if(sp) return `<td>${sp.hidden?"":sp.label}</td>`; const s=shifts.find(x=>x.id===c); if(!s) return "<td>—</td>"; return `<td>${s.name}</td>`; }).join(""); return `<tr style="${di===6?'color:#AAA':''}"><td>${DAY_SHORT[di]}</td><td style="color:#888">${date.getDate()}</td>${cells}</tr>`; }).join("")}</tbody></table>`;
    } else {
      // custom — iterate each week in range
      const lo=Math.min(customWo1,customWo2), hi=Math.max(customWo1,customWo2);
      const au=users.filter(u=>u.area===filterArea);
      tableHTML="";
      for(let w=lo;w<=hi;w++){
        const wk2=wKey(w), wSched=schedule[wk2]||{};
        const wd=weekDates(w);
        tableHTML+=`<h2>${filterArea} · ${weekLabel(w)}</h2><table>
          <thead><tr><th>Persona</th>${wd.map((d,di)=>`<th>${DAY_SHORT[di]}<br><span style="font-weight:400;color:#888">${d.getDate()}</span></th>`).join("")}<th>hrs</th></tr></thead>
          <tbody>${au.map(u=>{ let th=0; const cells=DAYS.map(day=>{ const c=wSched[`${day}-${u.id}`]; if(!c) return "<td>—</td>"; const sp=getSpec(c); if(sp) return `<td>${sp.hidden?"":sp.label}</td>`; const s=shifts.find(x=>x.id===c); if(!s) return "<td>—</td>"; th+=shiftH(s); return `<td>${s.name}<br><span style="color:#888;font-size:10px">${s.start}–${s.end}</span></td>`; }).join(""); return `<tr><td class="name">${u.name}</td>${cells}<td class="hrs">${th.toFixed(1)}h</td></tr>`; }).join("")}</tbody></table>`;
      }
    }
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Reporte ${filterArea}</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}body{font-family:'Inter',sans-serif;color:#111;background:#fff;padding:40px 48px;-webkit-print-color-adjust:exact;}
    h1{font-size:20px;font-weight:700;margin-bottom:4px;}h2{font-size:13px;font-weight:600;color:#333;margin-bottom:10px;margin-top:24px;}
    .meta{font-size:11px;color:#888;margin-bottom:28px;}table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:6px;}
    th{text-align:left;font-weight:600;color:#111;padding:6px 9px;border-bottom:2px solid #111;white-space:nowrap;}
    td{padding:6px 9px;border-bottom:1px solid #F0F0F0;vertical-align:top;}.name{font-weight:500;}.hrs{font-weight:600;text-align:right;white-space:nowrap;}
    .footer{margin-top:36px;font-size:10px;color:#CCC;border-top:1px solid #EBEBEB;padding-top:10px;display:flex;justify-content:space-between;}
    @media print{body{padding:24px 32px;}}</style></head><body>
    <h1>stShifts · ${filterArea}</h1>
    <div class="meta">Generado el ${today.toLocaleDateString("es-CL",{day:"numeric",month:"long",year:"numeric"})}</div>
    ${tableHTML}
    <div class="footer"><span>stShifts</span><span>${getLabel()}</span></div>
    <script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
    </body></html>`;
  }

  function printReport(){
    const html=buildHTML(area);
    const blob=new Blob([html],{type:"text/html;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const w=window.open(url,"_blank","width=1000,height=800");
    if(!w){ const a=document.createElement("a"); a.href=url; a.target="_blank"; a.click(); }
    setTimeout(()=>URL.revokeObjectURL(url),10000);
  }

  const SelBtn=({active,onClick,children})=>(
    <button className="btn" onClick={onClick} style={{flex:1,padding:"7px 6px",borderRadius:6,fontSize:12,fontWeight:500,
      background:active?D.tabActive:D.bg3,color:active?D.tabActiveText:D.text2,
      border:`1px solid ${active?D.tabActive:D.border}`}}>
      {children}
    </button>
  );

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{width:370,background:D.bg2,border:`1px solid ${D.border}`,padding:0,overflow:"hidden"}}>
        {/* Header */}
        <div style={{padding:"16px 18px 12px",borderBottom:`1px solid ${D.border}`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:14,fontWeight:600,color:D.text}}>Generar reporte</div>
            <div style={{fontSize:11,color:D.text2,marginTop:2}}>Horario por área · imprimible</div>
          </div>
          <button className="btn" onClick={onClose} style={{background:"none",color:D.text2,fontSize:16,padding:"2px 5px",borderRadius:4,lineHeight:1}}>×</button>
        </div>

        <div style={{padding:"16px 18px"}}>
          {/* Área */}
          <span className="lbl">Área</span>
          <div style={{display:"flex",gap:5,marginTop:6,marginBottom:14}}>
            <SelBtn active={area==="Cocina"} onClick={()=>setArea("Cocina")}>Cocina</SelBtn>
            <SelBtn active={area==="Caja"} onClick={()=>setArea("Caja")}>Caja</SelBtn>
          </div>

          {/* Período */}
          <span className="lbl">Período</span>
          <div style={{display:"flex",gap:5,marginTop:6,marginBottom:6}}>
            <SelBtn active={period==="week-current"} onClick={()=>setPeriod("week-current")}>Semana actual</SelBtn>
            <SelBtn active={period==="week-prev"} onClick={()=>setPeriod("week-prev")}>Semana anterior</SelBtn>
          </div>
          <div style={{display:"flex",gap:5,marginBottom:14}}>
            <SelBtn active={period==="month-current"} onClick={()=>setPeriod("month-current")}>Mes actual</SelBtn>
            <SelBtn active={period==="custom"} onClick={()=>setPeriod("custom")}>Personalizado</SelBtn>
          </div>

          {/* Custom range */}
          {period==="custom" && (
            <div style={{background:D.bg3,borderRadius:8,padding:"12px 14px",marginBottom:14}}>
              <div style={{fontSize:11,color:D.text2,marginBottom:10}}>Selecciona rango de semanas</div>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:8}}>
                <span style={{fontSize:11,color:D.text2,width:36,flexShrink:0}}>Desde</span>
                <button className="nav-btn" onClick={()=>setCustomWo1(w=>w-1)} style={{padding:"3px 7px"}}>‹</button>
                <span style={{flex:1,textAlign:"center",fontSize:11,fontWeight:500,color:D.text}}>{weekLabel(customWo1)}</span>
                <button className="nav-btn" onClick={()=>setCustomWo1(w=>w+1)} style={{padding:"3px 7px"}}>›</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <span style={{fontSize:11,color:D.text2,width:36,flexShrink:0}}>Hasta</span>
                <button className="nav-btn" onClick={()=>setCustomWo2(w=>w-1)} style={{padding:"3px 7px"}}>‹</button>
                <span style={{flex:1,textAlign:"center",fontSize:11,fontWeight:500,color:D.text}}>{weekLabel(customWo2)}</span>
                <button className="nav-btn" onClick={()=>setCustomWo2(w=>w+1)} style={{padding:"3px 7px"}}>›</button>
              </div>
            </div>
          )}

          {/* Generate */}
          <button className="btn" onClick={printReport}
            style={{width:"100%",background:D.tabActive,color:D.tabActiveText,padding:"10px",borderRadius:7,fontSize:13,fontWeight:500}}>
            ↓ Generar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TEMPLATE MODAL ───────────────────────────────────────────────────────────
function TemplateModal({ templates, setTemplates, wo, monthRef, currentWeekLabel, onSave, onApplyWeek, onApplyMonth, onClose }) {
  const [view,      setView]      = useState("list"); // "list" | "save" | "apply"
  const [saveName,  setSaveName]  = useState(`WK${templates.length+1}`);
  const [selTpl,    setSelTpl]    = useState(null);
  const [applyMode, setApplyMode] = useState("week"); // "week" | "month"
  const [applyWo,   setApplyWo]   = useState(wo);
  const [applyMonth,setApplyMonth]= useState(monthRef);
  const [confirm,   setConfirm]   = useState(false);

  const today=new Date();

  function doApply(){
    if(!selTpl) return;
    if(applyMode==="week") onApplyWeek(selTpl, applyWo);
    else onApplyMonth(selTpl, applyMonth.y, applyMonth.m);
    onClose();
  }

  const MONTH_NAMES_SHORT=["Ene","Feb","Mar","Apr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{width:440,maxHeight:"88vh",overflowY:"auto",padding:0}}>

        {/* Header */}
        <div style={{padding:"20px 24px 16px",borderBottom:"1px solid #F0F0F0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div>
            <div style={{fontSize:15,fontWeight:700}}>Plantillas de horario</div>
            <div style={{fontSize:12,color:"#AAA",marginTop:2}}>Guarda y aplica semanas completas</div>
          </div>
          <button className="btn" onClick={onClose} style={{background:"none",color:"#BBB",fontSize:18,padding:"0 4px"}}>×</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",borderBottom:"1px solid #F0F0F0",padding:"0 24px"}}>
          {[["list","Mis plantillas"],["save","Guardar actual"],["apply","Aplicar"]].map(([v,l])=>(
            <button key={v} className="btn" onClick={()=>setView(v)}
              style={{padding:"11px 0",marginRight:20,fontSize:13,fontWeight:500,color:view===v?"#111":"#AAA",borderBottom:view===v?"2px solid #111":"2px solid transparent",borderRadius:0,background:"none"}}>
              {l}
            </button>
          ))}
        </div>

        <div style={{padding:"20px 24px"}}>

          {/* LIST */}
          {view==="list" && (
            <div>
              {templates.length===0 && (
                <div style={{textAlign:"center",padding:"32px 0",color:"#AAA"}}>
                  <div style={{fontSize:28,marginBottom:8}}>📋</div>
                  <div style={{fontSize:13}}>Sin plantillas aún.</div>
                  <button className="btn" onClick={()=>setView("save")} style={{marginTop:12,background:"#111",color:"#fff",padding:"7px 16px",borderRadius:6,fontSize:12}}>
                    Guardar semana actual
                  </button>
                </div>
              )}
              {templates.map(tpl=>(
                <div key={tpl.id} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",borderRadius:9,border:"1px solid #F0F0F0",marginBottom:6,transition:"background .12s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="#FAFAFA"} onMouseLeave={e=>e.currentTarget.style.background="#fff"}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:"#111"}}>{tpl.name}</div>
                    <div style={{fontSize:11,color:"#AAA",marginTop:2}}>Guardada el {tpl.savedAt} · basada en {tpl.weekLabel}</div>
                    <div style={{fontSize:11,color:"#888",marginTop:1}}>{Object.keys(tpl.data).length} asignaciones</div>
                  </div>
                  <div style={{display:"flex",gap:6,flexShrink:0}}>
                    <button className="btn" onClick={()=>{ setSelTpl(tpl); setView("apply"); }}
                      style={{background:"#111",color:"#fff",padding:"5px 11px",borderRadius:6,fontSize:12,fontWeight:500}}>
                      Aplicar
                    </button>
                    <button className="btn" onClick={()=>setTemplates(p=>p.filter(x=>x.id!==tpl.id))}
                      style={{background:"#FBF0F0",color:"#9B2335",padding:"5px 10px",borderRadius:6,fontSize:12}}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* SAVE */}
          {view==="save" && (
            <div>
              <div style={{fontSize:12,color:"#666",marginBottom:16,lineHeight:1.6}}>
                Guarda el horario de la semana <strong style={{color:"#111"}}>{currentWeekLabel}</strong> como plantilla reutilizable. Incluye todos los turnos asignados de Cocina y Caja.
              </div>
              <span className="lbl">Nombre de la plantilla</span>
              <input value={saveName} onChange={e=>setSaveName(e.target.value)}
                placeholder="Ej: WK1, Turno habitual, Semana punta..." autoFocus
                style={{marginTop:6}}
                onKeyDown={e=>{ if(e.key==="Enter"&&saveName.trim()){ onSave(saveName.trim()); setView("list"); setSaveName(`WK${templates.length+2}`); }}}/>
              <div style={{fontSize:11,color:"#AAA",marginTop:8}}>Presiona Enter o clic en Guardar.</div>
              <div style={{display:"flex",gap:8,marginTop:20}}>
                <button className="btn" onClick={()=>setView("list")} style={{flex:1,background:"#F3F4F6",color:"#555",padding:"9px",borderRadius:7,fontSize:13}}>Cancelar</button>
                <button className="btn" onClick={()=>{ if(saveName.trim()){ onSave(saveName.trim()); setView("list"); setSaveName(`WK${templates.length+2}`); }}}
                  style={{flex:1,background:"#111",color:"#fff",padding:"9px",borderRadius:7,fontSize:13,fontWeight:500}}>
                  Guardar plantilla
                </button>
              </div>
            </div>
          )}

          {/* APPLY */}
          {view==="apply" && (
            <div>
              {/* Seleccionar plantilla */}
              <span className="lbl">Plantilla</span>
              <div style={{marginTop:6,marginBottom:16}}>
                {templates.length===0 && <div style={{fontSize:12,color:"#AAA"}}>No hay plantillas guardadas.</div>}
                {templates.map(tpl=>(
                  <div key={tpl.id} onClick={()=>setSelTpl(tpl)}
                    style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,marginBottom:4,border:`1.5px solid ${selTpl?.id===tpl.id?"#111":"#EBEBEB"}`,cursor:"pointer",transition:"all .13s",background:selTpl?.id===tpl.id?"#FAFAFA":"#fff"}}>
                    <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${selTpl?.id===tpl.id?"#111":"#DDD"}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {selTpl?.id===tpl.id && <div style={{width:6,height:6,borderRadius:"50%",background:"#111"}}/>}
                    </div>
                    <div>
                      <div style={{fontSize:13,fontWeight:500,color:"#111"}}>{tpl.name}</div>
                      <div style={{fontSize:11,color:"#AAA"}}>{Object.keys(tpl.data).length} asignaciones · {tpl.savedAt}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Modo */}
              <span className="lbl">Aplicar a</span>
              <div style={{display:"flex",gap:6,marginTop:6,marginBottom:16}}>
                {[["week","Semana"],["month","Mes completo"]].map(([v,l])=>(
                  <button key={v} className="btn" onClick={()=>setApplyMode(v)}
                    style={{flex:1,padding:"8px",borderRadius:7,fontSize:13,fontWeight:500,background:applyMode===v?"#111":"#F5F5F5",color:applyMode===v?"#fff":"#444",border:"none",transition:"all .15s"}}>
                    {l}
                  </button>
                ))}
              </div>

              {/* Selector semana/mes */}
              {applyMode==="week" && (
                <div>
                  <span className="lbl">Semana</span>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                    <button className="nav-btn" onClick={()=>setApplyWo(w=>w-1)}>‹</button>
                    <span style={{flex:1,textAlign:"center",fontSize:13,fontWeight:500,color:"#333"}}>{weekLabel(applyWo)}</span>
                    <button className="nav-btn" onClick={()=>setApplyWo(w=>w+1)}>›</button>
                    <button className="nav-btn" onClick={()=>setApplyWo(wo)} style={{fontSize:11,color:"#999"}}>Actual</button>
                  </div>
                </div>
              )}

              {applyMode==="month" && (
                <div>
                  <span className="lbl">Mes</span>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                    <button className="nav-btn" onClick={()=>setApplyMonth(m=>{ const d=new Date(m.y,m.m-1,1); return{y:d.getFullYear(),m:d.getMonth()}; })}>‹</button>
                    <span style={{flex:1,textAlign:"center",fontSize:13,fontWeight:500,color:"#333"}}>{["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][applyMonth.m]} {applyMonth.y}</span>
                    <button className="nav-btn" onClick={()=>setApplyMonth(m=>{ const d=new Date(m.y,m.m+1,1); return{y:d.getFullYear(),m:d.getMonth()}; })}>›</button>
                    <button className="nav-btn" onClick={()=>setApplyMonth({y:today.getFullYear(),m:today.getMonth()})} style={{fontSize:11,color:"#999"}}>Actual</button>
                  </div>
                  <div style={{fontSize:11,color:"#AAA",marginTop:8}}>Se aplicará el mismo horario a todas las semanas del mes.</div>
                </div>
              )}

              {/* Confirm warning */}
              {selTpl && (
                <div style={{marginTop:16,padding:"10px 12px",borderRadius:7,background:"#FFFBF0",border:"1px solid #FDE68A"}}>
                  <div style={{fontSize:12,color:"#92400E"}}>
                    ⚠ Esto <strong>sobreescribirá</strong> los turnos ya asignados en {applyMode==="week"?`la semana del ${weekLabel(applyWo)}`:`${["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][applyMonth.m]} ${applyMonth.y}`}.
                  </div>
                </div>
              )}

              <div style={{display:"flex",gap:8,marginTop:16}}>
                <button className="btn" onClick={()=>setView("list")} style={{flex:1,background:"#F3F4F6",color:"#555",padding:"9px",borderRadius:7,fontSize:13}}>Cancelar</button>
                <button className="btn" onClick={doApply} disabled={!selTpl}
                  style={{flex:2,background:selTpl?"#111":"#E0E0E0",color:selTpl?"#fff":"#AAA",padding:"9px",borderRadius:7,fontSize:13,fontWeight:500,cursor:selTpl?"pointer":"not-allowed",transition:"all .15s"}}>
                  Aplicar plantilla
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SMALL SHARED ─────────────────────────────────────────────────────────────
function Av({ name, color, size=24 }) {
  return <div style={{width:size,height:size,borderRadius:"50%",background:color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.4,fontWeight:700,color:"#fff",flexShrink:0}}>{name.charAt(0).toUpperCase()}</div>;
}

function CellTag({ val, shifts, dark }) {
  if(!val) return null;
  if(isSpec(val)){
    const st=getSpec(val);
    return <div draggable="false" style={{background:dark?`${st.color}28`:st.bg,border:`1px solid ${dark?st.color+"55":st.border}`,borderRadius:6,padding:"4px 7px",userSelect:"none"}}>
      <div style={{fontSize:10,fontWeight:600,color:dark?lighten(st.color):st.color,lineHeight:1.3}}>{st.label}</div>
      <div style={{fontSize:9,marginTop:1}}>&nbsp;</div>
    </div>;
  }
  const s=shifts.find(x=>x.id===val);
  if(!s) return null;
  const nameColor = dark ? lighten(s.color) : darken(s.color);
  const timeColor = dark ? `${lighten(s.color)}BB` : `${darken(s.color)}99`;
  return <div draggable="false" style={{background:dark?`${s.color}28`:`${s.color}14`,border:`1px solid ${dark?s.color+"55":`${s.color}35`}`,borderRadius:6,padding:"4px 7px",userSelect:"none"}}>
    <div style={{fontSize:10,fontWeight:700,color:nameColor,lineHeight:1.3}}>{s.name}</div>
    <div style={{fontSize:9,fontWeight:500,color:timeColor,marginTop:1}}>{s.start}–{s.end}</div>
  </div>;
}

function lighten(hex){
  // lighten a hex color for dark backgrounds
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  const lr=Math.min(255,r+80), lg=Math.min(255,g+80), lb=Math.min(255,b+80);
  return `#${lr.toString(16).padStart(2,"0")}${lg.toString(16).padStart(2,"0")}${lb.toString(16).padStart(2,"0")}`;
}
function darken(hex){
  // darken a hex color for light backgrounds
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  const dr=Math.max(0,r-30), dg=Math.max(0,g-30), db=Math.max(0,b-30);
  return `#${dr.toString(16).padStart(2,"0")}${dg.toString(16).padStart(2,"0")}${db.toString(16).padStart(2,"0")}`;
}

function PickerModal({ context, users, shifts, dark, onPick, onClose }) {
  const D=getD(dark);
  const user=users.find(u=>u.id===context.uid);
  const label=context.date?context.date.toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"}):context.day;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={e=>e.stopPropagation()} style={{maxHeight:"82vh",overflowY:"auto",background:D.bg2,border:`1px solid ${D.border}`}}>
        <div style={{fontSize:14,fontWeight:700,color:D.text,marginBottom:2}}>Asignar</div>
        <div style={{fontSize:12,color:D.text2,marginBottom:16,textTransform:"capitalize"}}>{label} · {user?.name}</div>
        <span className="lbl">Turnos</span>
        {shifts.map(s=>(
          <button key={s.id} className="btn" onClick={()=>onPick(s.id)} style={{width:"100%",display:"flex",alignItems:"center",gap:8,padding:"8px 10px",borderRadius:6,marginBottom:3,border:`1px solid ${s.color}33`,background:`${s.color}11`,textAlign:"left"}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:s.color,flexShrink:0}}/>
            <div><div style={{fontSize:12,fontWeight:600,color:dark?lighten(s.color):darken(s.color)}}>{s.name}</div><div style={{fontSize:10,color:D.text2}}>{s.start}–{s.end} · {shiftH(s).toFixed(1)}h</div></div>
          </button>
        ))}
        <span className="lbl" style={{marginTop:14}}>Estados</span>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:14}}>
          {Object.values(SPECIAL).map(st=>(
            <button key={st.id} className="btn" onClick={()=>onPick(st.id)} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 9px",borderRadius:6,border:`1px solid ${dark?st.color+"44":st.border}`,background:dark?`${st.color}22`:st.bg,textAlign:"left"}}>
              <div><div style={{fontSize:11,fontWeight:500,color:st.color}}>{st.label}</div></div>
            </button>
          ))}
        </div>
        <button className="btn" onClick={onClose} style={{width:"100%",background:D.bg3,color:D.text,padding:"8px",borderRadius:6,fontSize:13}}>Cancelar</button>
      </div>
    </div>
  );
}

function UserModal({ initial, isFixed, dark, onSave, onClose }) {
  const D=getD(dark);
  const [name,setName]=useState(initial?.name||""); const [role,setRole]=useState(initial?.role||"");
  const [area,setArea]=useState(initial?.area||"Cocina"); const [color,setColor]=useState(initial?.color||PALETTE[0]);
  return (
    <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{background:D.bg2,border:`1px solid ${D.border}`}}>
      <div style={{fontSize:15,fontWeight:700,color:D.text,marginBottom:20}}>{initial?"Editar persona":"Nueva persona"}</div>
      <span className="lbl">Nombre</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nombre completo" autoFocus disabled={isFixed&&!initial?.name?.includes("test")}/>
      <span className="lbl">Cargo</span><input value={role} onChange={e=>setRole(e.target.value)} placeholder="Ej: Cajera, Cocinera..."/>
      <span className="lbl">Área</span><select value={area} onChange={e=>setArea(e.target.value)} disabled={isFixed}>{AREAS.map(a=><option key={a} value={a}>{a}</option>)}</select>
      <span className="lbl">Color</span>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
        {PALETTE.map(c=><button key={c} className="btn" onClick={()=>setColor(c)} style={{width:22,height:22,borderRadius:"50%",background:c,border:color===c?`2.5px solid ${D.text}`:"2px solid transparent",outline:color===c?`2px solid ${D.bg2}`:"none",outlineOffset:"-4px"}}/>)}
      </div>
      <div style={{display:"flex",gap:8,marginTop:22}}>
        <button className="btn" onClick={onClose} style={{flex:1,background:D.bg3,color:D.text,padding:"9px",borderRadius:6,fontSize:13}}>Cancelar</button>
        <button className="btn" onClick={()=>{if(name.trim()) onSave({name:name.trim(),role:role.trim(),area,color});}} style={{flex:1,background:D.tabActive,color:D.tabActiveText,padding:"9px",borderRadius:6,fontSize:13,fontWeight:500}}>{initial?"Guardar":"Agregar"}</button>
      </div>
    </div></div>
  );
}

function ShiftModal({ initial, dark, onSave, onClose }) {
  const D=getD(dark);
  const [name,setName]=useState(initial?.name||""); const [start,setStart]=useState(initial?.start||"09:00");
  const [end,setEnd]=useState(initial?.end||"18:30"); const [color,setColor]=useState(initial?.color||PALETTE[0]);
  const dur=start&&end?shiftH({start,end}):0, over=dur>RULES.MAX_DAY_H;
  return (
    <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e=>e.stopPropagation()} style={{background:D.bg2,border:`1px solid ${D.border}`}}>
      <div style={{fontSize:15,fontWeight:700,color:D.text,marginBottom:20}}>{initial?"Editar turno":"Nuevo turno"}</div>
      <span className="lbl">Nombre</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Ej: AM Apertura" autoFocus/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div><span className="lbl">Entrada</span><input type="time" value={start} onChange={e=>setStart(e.target.value)}/></div>
        <div><span className="lbl">Salida</span><input type="time" value={end} onChange={e=>setEnd(e.target.value)}/></div>
      </div>
      {start&&end&&<div style={{marginTop:9,padding:"6px 10px",borderRadius:5,background:over?"#FBF0F0":"#F0F7F0",fontSize:12,color:over?"#9B2335":"#3D7A61"}}>{dur.toFixed(1)}h efectivas (−30 min){over?" ⚠ Excede 10h":" ✓"}</div>}
      <span className="lbl">Color</span>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
        {PALETTE.map(c=><button key={c} className="btn" onClick={()=>setColor(c)} style={{width:22,height:22,borderRadius:"50%",background:c,border:color===c?`2.5px solid ${D.text}`:"2px solid transparent",outline:color===c?`2px solid ${D.bg2}`:"none",outlineOffset:"-4px"}}/>)}
      </div>
      <div style={{display:"flex",gap:8,marginTop:22}}>
        <button className="btn" onClick={onClose} style={{flex:1,background:D.bg3,color:D.text,padding:"9px",borderRadius:6,fontSize:13}}>Cancelar</button>
        <button className="btn" onClick={()=>{if(name.trim()&&start&&end) onSave({name:name.trim(),start,end,color});}} style={{flex:1,background:D.tabActive,color:D.tabActiveText,padding:"9px",borderRadius:6,fontSize:13,fontWeight:500}}>{initial?"Guardar":"Agregar"}</button>
      </div>
    </div></div>
  );
}
