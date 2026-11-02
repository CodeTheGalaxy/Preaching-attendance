/*
 * Attendance Portal frontend.
 * Configure API_URL below after deploying Code.gs as a Google Apps Script web app.
 * This starter uses JSONP so it can communicate with Apps Script from GitHub Pages
 * without a CORS preflight. Keep bulk submissions reasonably small.
 */
const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

const state = { people: [], attendance: {}, report: null, reportRows: [], busy: false };
const $ = (id) => document.getElementById(id);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const showToast = (message, error=false) => {
  const el=$("toast"); el.textContent=message; el.classList.toggle("error",error); el.classList.add("show");
  window.clearTimeout(showToast.timer); showToast.timer=window.setTimeout(()=>el.classList.remove("show"),3500);
};
function setConnection(online) {
  const el=$("connectionStatus"); el.textContent=online?"Connected to Google Sheets":"Not connected";
  el.className=`status-pill ${online?"status-online":"status-offline"}`;
}
function api(action, payload={}) {
  return new Promise((resolve,reject)=>{
    if (!API_URL || API_URL.includes("PASTE_YOUR")) return reject(new Error("Add your Apps Script Web App URL in app.js first."));
    const callback=`attPortalCb_${Date.now()}_${Math.floor(Math.random()*100000)}`;
    const script=document.createElement("script");
    const timeout=window.setTimeout(()=>finish(new Error("Request timed out. Check your Apps Script deployment and URL.")),20000);
    function finish(err,data) {
      window.clearTimeout(timeout); delete window[callback]; script.remove();
      err?reject(err):resolve(data);
    }
    window[callback]=(data)=>finish(null,data);
    script.onerror=()=>finish(new Error("Could not reach Apps Script. Check the deployment URL and access setting."));
    const params=new URLSearchParams({action,callback,payload:JSON.stringify(payload),_ts:String(Date.now())});
    script.src=`${API_URL}?${params.toString()}`;
    document.body.appendChild(script);
  });
}
function setBusy(button,busy,label) {
  button.disabled=busy;
  if (busy) { button.dataset.original=button.textContent; button.textContent=label||"Please wait…"; }
  else if (button.dataset.original) { button.textContent=button.dataset.original; delete button.dataset.original; }
}
async function loadPeople() {
  const result=await api("listPeople");
  if (!result.ok) throw new Error(result.error||"Unable to load people.");
  state.people=result.people||[];
  renderPeople(); renderAttendanceRows(); updateStats();
}
async function loadAttendance() {
  const date=$("attendanceDate").value;
  if (!date) throw new Error("Choose an attendance date.");
  const result=await api("getAttendance",{date});
  if (!result.ok) throw new Error(result.error||"Unable to load attendance.");
  state.attendance={};
  (result.records||[]).forEach(r=>state.attendance[r.personId]=r.status);
  renderAttendanceRows(); updateStats(result.summary);
}
function renderPeople() {
  const q=$("peopleSearch").value.trim().toLowerCase();
  const people=state.people.filter(p=>p.name.toLowerCase().includes(q)||p.personId.toLowerCase().includes(q));
  $("peopleRows").innerHTML=people.length?people.map(p=>`<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.personId)}</td><td><button class="link-button" data-edit="${escapeHtml(p.personId)}" type="button">Edit</button></td></tr>`).join(""):`<tr><td colspan="3" class="empty-state">No matching people.</td></tr>`;
}
function renderAttendanceRows() {
  const q=$("attendanceSearch").value.trim().toLowerCase();
  const people=state.people.filter(p=>p.name.toLowerCase().includes(q)||p.personId.toLowerCase().includes(q));
  $("attendanceRows").innerHTML=people.length?people.map(p=>{
    const status=state.attendance[p.personId]||"";
    return `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${escapeHtml(p.personId)}</td><td><select class="status-select" data-person="${escapeHtml(p.personId)}" aria-label="Attendance for ${escapeHtml(p.name)}"><option value="" ${status===""?"selected":""}>Not marked</option><option value="Present" ${status==="Present"?"selected":""}>Present</option><option value="Absent" ${status==="Absent"?"selected":""}>Absent</option></select></td></tr>`;
  }).join(""):`<tr><td colspan="3" class="empty-state">No people found. Add people in the People tab.</td></tr>`;
  $("attendanceCount").textContent=`${people.length} ${people.length===1?"person":"people"} shown`;
}
function updateStats(summary) {
  $("totalPeople").textContent=state.people.length;
  const marked=summary||Object.values(state.attendance).reduce((a,s)=>{if(s==="Present")a.present++;if(s==="Absent")a.absent++;return a;},{present:0,absent:0});
  $("presentToday").textContent=marked.present??0;
  $("absentToday").textContent=marked.absent??0;
  $("notMarkedToday").textContent=Math.max(0,state.people.length-(marked.present||0)-(marked.absent||0));
}
function resetPersonForm() {
  $("personForm").reset(); $("editingPersonId").value=""; $("personId").disabled=false;
  $("personFormTitle").textContent="Add a person"; $("savePersonBtn").textContent="Add person"; $("cancelEditBtn").classList.add("hidden");
}
function startEdit(personId) {
  const p=state.people.find(x=>x.personId===personId); if(!p)return;
  $("editingPersonId").value=p.personId; $("personId").value=p.personId; $("personName").value=p.name;
  $("personId").disabled=true; $("personFormTitle").textContent="Edit person"; $("savePersonBtn").textContent="Save changes";
  $("cancelEditBtn").classList.remove("hidden"); $("personName").focus();
}
function csvCell(value) { return `"${String(value??"").replace(/"/g,'""')}"`; }
function exportCsv(rows,filename) {
  const csv=rows.map(row=>row.map(csvCell).join(",")).join("\r\n");
  const blob=new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a"); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
}
async function refreshAll() {
  const btn=$("refreshBtn"); setBusy(btn,true,"Refreshing…");
  try { await loadPeople(); await loadAttendance(); setConnection(true); showToast("Portal data refreshed."); }
  catch(e) { setConnection(false); showToast(e.message,true); }
  finally { setBusy(btn,false); }
}
function switchTab(tab) {
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  ["attendance","people","reports"].forEach(name=>$(`${name}Panel`).classList.toggle("hidden",name!==tab));
}
async function savePerson(event) {
  event.preventDefault(); const id=$("personId").value.trim(); const name=$("personName").value.trim(); const editing=$("editingPersonId").value;
  if(!id||!name)return;
  const btn=$("savePersonBtn"); setBusy(btn,true,"Saving…");
  try {
    const result=await api(editing?"updatePerson":"addPerson",{personId:id,name});
    if(!result.ok)throw new Error(result.error||"Could not save person.");
    await loadPeople(); resetPersonForm(); showToast(editing?"Person updated.":"Person added.");
  } catch(e){showToast(e.message,true);} finally{setBusy(btn,false);}
}
async function saveAttendance() {
  const date=$("attendanceDate").value; if(!date){showToast("Choose a date first.",true);return;}
  const records=Array.from(document.querySelectorAll(".status-select")).map(el=>({personId:el.dataset.person,status:el.value})).filter(x=>x.status);
  // Include blank statuses for visible people so a previous mark can be cleared.
  const visible=Array.from(document.querySelectorAll(".status-select")).map(el=>({personId:el.dataset.person,status:el.value}));
  if(!visible.length){showToast("There are no people to update.",true);return;}
  const btn=$("saveAttendanceBtn");setBusy(btn,true,"Saving…");
  try {
    const result=await api("saveAttendance",{date,records:visible});
    if(!result.ok)throw new Error(result.error||"Could not save attendance.");
    await loadAttendance(); setConnection(true); showToast(`Attendance saved for ${result.savedCount} people.`);
  }catch(e){showToast(e.message,true);}finally{setBusy(btn,false);}
}
async function runReport() {
  const from=$("reportFrom").value,to=$("reportTo").value;
  if(!from||!to||from>to){showToast("Choose a valid date range.",true);return;}
  const btn=$("runReportBtn");setBusy(btn,true,"Generating…");
  try{
    const result=await api("getReport",{from,to});if(!result.ok)throw new Error(result.error||"Report failed.");
    state.report={from,to};state.reportRows=result.rows||[];
    $("reportSummary").textContent=`${state.reportRows.length} people · ${result.totalPresent} present marks · ${result.totalAbsent} absent marks · ${from} to ${to}`;
    $("reportRows").innerHTML=state.reportRows.length?state.reportRows.map(r=>`<tr><td><strong>${escapeHtml(r.name)}</strong></td><td>${escapeHtml(r.personId)}</td><td>${r.present}</td><td>${r.absent}</td><td>${r.markedDays}</td><td>${r.percentage}%</td></tr>`).join(""):`<tr><td colspan="6" class="empty-state">No people or attendance records in this range.</td></tr>`;
    $("exportReportBtn").disabled=!state.reportRows.length;setConnection(true);
  }catch(e){showToast(e.message,true);}finally{setBusy(btn,false);}
}
document.addEventListener("DOMContentLoaded",()=>{
  const today=todayISO();$("todayLabel").textContent=new Date(`${today}T00:00:00`).toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"});
  $("attendanceDate").value=today;$("reportFrom").value=today;$("reportTo").value=today;
  document.querySelectorAll(".tab").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));
  $("refreshBtn").addEventListener("click",refreshAll);$("loadAttendanceBtn").addEventListener("click",async()=>{try{await loadAttendance();setConnection(true);}catch(e){showToast(e.message,true);}});
  $("personForm").addEventListener("submit",savePerson);$("cancelEditBtn").addEventListener("click",resetPersonForm);
  $("peopleRows").addEventListener("click",e=>{const b=e.target.closest("[data-edit]");if(b)startEdit(b.dataset.edit);});
  $("peopleSearch").addEventListener("input",renderPeople);$("attendanceSearch").addEventListener("input",renderAttendanceRows);
  $("attendanceRows").addEventListener("change",e=>{const el=e.target.closest("[data-person]");if(el){if(el.value)state.attendance[el.dataset.person]=el.value;else delete state.attendance[el.dataset.person];updateStats();}});
  $("allPresentBtn").addEventListener("click",()=>{document.querySelectorAll(".status-select").forEach(el=>{el.value="Present";state.attendance[el.dataset.person]="Present";});updateStats();});
  $("allAbsentBtn").addEventListener("click",()=>{document.querySelectorAll(".status-select").forEach(el=>{el.value="Absent";state.attendance[el.dataset.person]="Absent";});updateStats();});
  $("saveAttendanceBtn").addEventListener("click",saveAttendance);$("runReportBtn").addEventListener("click",runReport);
  $("exportReportBtn").addEventListener("click",()=>{if(!state.reportRows.length)return;const rows=[["Name","Person ID","Present","Absent","Marked days","Attendance %"],...state.reportRows.map(r=>[r.name,r.personId,r.present,r.absent,r.markedDays,`${r.percentage}%`])];exportCsv(rows,`attendance_${state.report.from}_to_${state.report.to}.csv`);});
  refreshAll();
});
