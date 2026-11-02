/**
 * Attendance Portal API — Google Apps Script backend.
 *
 * Setup:
 * 1. Create a Google Spreadsheet.
 * 2. Extensions > Apps Script; replace the editor contents with this file.
 * 3. Run setup() once and approve permissions.
 * 4. Deploy > New deployment > Web app > Execute as Me > Who has access: Anyone.
 * 5. Copy the /exec URL into API_URL in app.js.
 *
 * The frontend calls this API using JSONP. Requests are GET requests, including
 * writes, to avoid cross-origin preflight issues with GitHub Pages. Do not use
 * this pattern for sensitive data or high-volume systems. Anyone who can access
 * the public portal can read/write its data. Add proper authentication before
 * storing confidential information.
 */
const CONFIG = {
  PEOPLE_SHEET: "People",
  ATTENDANCE_SHEET: "Attendance",
  PEOPLE_HEADERS: ["Person ID", "Name", "Active", "Created At", "Updated At"],
  ATTENDANCE_HEADERS: ["Person ID", "Name", "Date", "Status", "Updated At"]
};

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Open Apps Script from the target Google Spreadsheet.");
  ensureSheet_(ss, CONFIG.PEOPLE_SHEET, CONFIG.PEOPLE_HEADERS);
  ensureSheet_(ss, CONFIG.ATTENDANCE_SHEET, CONFIG.ATTENDANCE_HEADERS);
  SpreadsheetApp.flush();
  return "Setup complete.";
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const callback = String(params.callback || "");
  const action = String(params.action || "");
  let result;
  try {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) throw new Error("Invalid callback.");
    const payload = params.payload ? JSON.parse(params.payload) : {};
    result = route_(action, payload);
  } catch (err) {
    result = { ok: false, error: err && err.message ? err.message : String(err) };
  }
  return ContentService.createTextOutput(callback + "(" + JSON.stringify(result) + ");")
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function route_(action, p) {
  const lock = LockService.getScriptLock();
  switch (action) {
    case "listPeople": return { ok: true, people: listPeople_() };
    case "getAttendance": return getAttendance_(p.date);
    case "getReport": return getReport_(p.from, p.to);
    case "addPerson":
      lock.waitLock(10000);
      try { return addPerson_(p); } finally { lock.releaseLock(); }
    case "updatePerson":
      lock.waitLock(10000);
      try { return updatePerson_(p); } finally { lock.releaseLock(); }
    case "saveAttendance":
      lock.waitLock(10000);
      try { return saveAttendance_(p); } finally { lock.releaseLock(); }
    default: throw new Error("Unknown action: " + action);
  }
}

function ensureSheet_(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold").setBackground("#e8eef6");
  return sheet;
}
function getSheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error("Spreadsheet not found. Run setup() from the bound spreadsheet.");
  return ensureSheet_(ss, name, headers);
}
function values_(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
}
function clean_(value, max) {
  const s = String(value == null ? "" : value).trim();
  if (!s) throw new Error("Required value is missing.");
  if (s.length > max) throw new Error("Value is too long.");
  return s;
}
function listPeople_() {
  const rows = values_(getSheet_(CONFIG.PEOPLE_SHEET, CONFIG.PEOPLE_HEADERS));
  return rows.filter(r => String(r[0]).trim() && String(r[2]).toLowerCase() !== "false")
    .map(r => ({ personId: String(r[0]), name: String(r[1]), active: true }))
    .sort((a,b) => a.name.localeCompare(b.name));
}
function addPerson_(p) {
  const id = clean_(p.personId, 40);
  const name = clean_(p.name, 120);
  const sheet = getSheet_(CONFIG.PEOPLE_SHEET, CONFIG.PEOPLE_HEADERS);
  const exists = values_(sheet).some(r => String(r[0]).toLowerCase() === id.toLowerCase());
  if (exists) throw new Error("That Person ID already exists. Use Edit to change the person's name.");
  const now = new Date();
  sheet.appendRow([id, name, true, now, now]);
  return { ok: true, person: { personId: id, name: name } };
}
function updatePerson_(p) {
  const id = clean_(p.personId, 40);
  const name = clean_(p.name, 120);
  const sheet = getSheet_(CONFIG.PEOPLE_SHEET, CONFIG.PEOPLE_HEADERS);
  const rows = values_(sheet);
  const index = rows.findIndex(r => String(r[0]).toLowerCase() === id.toLowerCase());
  if (index < 0) throw new Error("Person ID not found.");
  const rowNumber = index + 2;
  sheet.getRange(rowNumber, 2).setValue(name);
  sheet.getRange(rowNumber, 5).setValue(new Date());
  // Keep historical attendance names consistent with the current directory.
  const attendance = getSheet_(CONFIG.ATTENDANCE_SHEET, CONFIG.ATTENDANCE_HEADERS);
  const aRows = values_(attendance);
  aRows.forEach((r,i) => {
    if (String(r[0]).toLowerCase() === id.toLowerCase()) attendance.getRange(i+2,2).setValue(name);
  });
  return { ok: true, person: { personId: id, name: name } };
}
function validDate_(value) {
  const s = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Date must be in YYYY-MM-DD format.");
  const d = new Date(s + "T00:00:00");
  if (isNaN(d.getTime()) || Utilities.formatDate(d, "UTC", "yyyy-MM-dd") !== s) throw new Error("Invalid date.");
  return s;
}
function dateString_(value) {
  if (value instanceof Date) return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(value || "").slice(0,10);
}
function getAttendance_(dateValue) {
  const date = validDate_(dateValue);
  const sheet = getSheet_(CONFIG.ATTENDANCE_SHEET, CONFIG.ATTENDANCE_HEADERS);
  const records = values_(sheet).filter(r => dateString_(r[2]) === date)
    .map(r => ({ personId: String(r[0]), name: String(r[1]), date: date, status: String(r[3]) }));
  const summary = records.reduce((a,r) => { if(r.status==="Present")a.present++; if(r.status==="Absent")a.absent++; return a; }, {present:0,absent:0});
  return { ok: true, records: records, summary: summary };
}
function saveAttendance_(p) {
  const date = validDate_(p.date);
  if (!Array.isArray(p.records)) throw new Error("Attendance records are required.");
  const people = listPeople_();
  const peopleMap = {};
  people.forEach(person => peopleMap[person.personId.toLowerCase()] = person);
  const sheet = getSheet_(CONFIG.ATTENDANCE_SHEET, CONFIG.ATTENDANCE_HEADERS);
  const rows = values_(sheet);
  const index = {};
  rows.forEach((r,i) => { index[String(r[0]).toLowerCase()+"|"+dateString_(r[2])] = i+2; });
  const now = new Date();
  let savedCount = 0;
  p.records.forEach(record => {
    const id = clean_(record.personId,40);
    const person = peopleMap[id.toLowerCase()];
    if (!person) throw new Error("Unknown or inactive Person ID: " + id);
    const status = String(record.status || "").trim();
    const key = id.toLowerCase()+"|"+date;
    if (status !== "Present" && status !== "Absent" && status !== "") throw new Error("Invalid status for " + id);
    const rowNumber = index[key];
    if (status === "") {
      if (rowNumber) sheet.getRange(rowNumber,1,1,5).clearContent();
    } else if (rowNumber) {
      sheet.getRange(rowNumber,1,1,5).setValues([[person.personId,person.name,dateAsDate_(date),status,now]]);
    } else {
      sheet.appendRow([person.personId,person.name,dateAsDate_(date),status,now]);
    }
    savedCount++;
  });
  return { ok: true, savedCount: savedCount };
}
function dateAsDate_(iso) {
  const parts = iso.split("-").map(Number);
  return new Date(parts[0], parts[1]-1, parts[2], 12, 0, 0);
}
function getReport_(fromValue,toValue) {
  const from = validDate_(fromValue), to = validDate_(toValue);
  if (from > to) throw new Error("From date must be on or before To date.");
  const people = listPeople_();
  const stats = {};
  people.forEach(p => stats[p.personId.toLowerCase()] = {personId:p.personId,name:p.name,present:0,absent:0,markedDays:0,percentage:0});
  const sheet = getSheet_(CONFIG.ATTENDANCE_SHEET, CONFIG.ATTENDANCE_HEADERS);
  values_(sheet).forEach(r => {
    const date = dateString_(r[2]);
    if (date < from || date > to) return;
    const item = stats[String(r[0]).toLowerCase()];
    if (!item) return;
    if (String(r[3]) === "Present") item.present++;
    if (String(r[3]) === "Absent") item.absent++;
  });
  const rows = Object.keys(stats).map(k => {
    const x=stats[k]; x.markedDays=x.present+x.absent;
    x.percentage=x.markedDays?Math.round((x.present/x.markedDays)*1000)/10:0;
    return x;
  }).sort((a,b)=>a.name.localeCompare(b.name));
  return {ok:true,rows:rows,totalPresent:rows.reduce((n,x)=>n+x.present,0),totalAbsent:rows.reduce((n,x)=>n+x.absent,0)};
}
