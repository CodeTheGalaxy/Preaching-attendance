# Attendance Portal

A small attendance manager with a GitHub Pages frontend and Google Sheets + Apps Script backend.

## Included features

- **Add** people with a unique Person ID.
- **Edit** a person's name without changing their ID.
- **Update** attendance for a selected date.
- Bulk mark all visible people Present or Absent.
- Clear an existing attendance mark by selecting **Not marked** and saving.
- Daily dashboard counts.
- Date-range report with present/absent counts and attendance percentage.
- Export report to CSV (opens in Excel).

## Architecture

- `index.html`, `styles.css`, `app.js`: static website hosted on GitHub Pages.
- `Code.gs`: Apps Script API connected to your Google Spreadsheet.
- Google Sheets stores the `People` and `Attendance` tabs.

## Part A — Set up Google Sheets and Apps Script

1. Create a new Google Spreadsheet, for example **Attendance Database**.
2. Open **Extensions → Apps Script**.
3. Remove the sample code and paste the full contents of `Code.gs`.
4. Save the project.
5. In the Apps Script editor, choose the function **setup** and click **Run**.
6. Approve the requested Google permissions. The script creates two tabs:
   - `People`: Person ID, Name, Active, Created At, Updated At
   - `Attendance`: Person ID, Name, Date, Status, Updated At
7. Return to the spreadsheet. You can optionally add your initial people directly in the `People` tab. Keep the headers unchanged and use unique IDs.
8. In Apps Script, click **Deploy → New deployment**.
9. Select the gear icon / deployment type **Web app**.
10. Set **Execute as** to **Me**.
11. Set **Who has access** to **Anyone** (or the broadest option your Google Workspace permits).
12. Click **Deploy**, authorize if prompted, and copy the Web app URL ending in `/exec`.

> Important security note: this starter API uses JSONP so the GitHub Pages site can call Apps Script without CORS preflight. The deployment is public, and the API does not authenticate individual users. Anyone who obtains the portal/API URL can read and modify the attendance database. Use it only for non-sensitive attendance data in a trusted setting. Do not put private, medical, financial, or confidential information in this version. For a private deployment, add a proper authenticated backend (for example Firebase Authentication or a Google Apps Script HTML-service app restricted to your Workspace).

## Part B — Connect the website to Apps Script

1. Open `app.js`.
2. Find this line near the top:

   ```js
   const API_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";
   ```

3. Replace the placeholder with your copied `/exec` URL. Keep the quotation marks.
4. Save `app.js`.

If you change the Apps Script code after deployment, go to **Deploy → Manage deployments → Edit** and create a new version of the existing deployment. The `/exec` URL normally stays the same.

## Part C — Publish on GitHub Pages

1. Create a new GitHub repository, for example `attendance-portal`.
2. Upload these files to the repository root:
   - `index.html`
   - `styles.css`
   - `app.js`
3. You do not need to upload `Code.gs` for the website to run, but keep it in the repository if you want a backup copy. It contains backend source code, not credentials.
4. In the repository, open **Settings → Pages**.
5. Under **Build and deployment**, choose **Deploy from a branch**.
6. Choose branch `main` and folder `/ (root)`, then click **Save**.
7. Wait for GitHub Pages to publish. Your portal URL will look like:

   `https://YOUR-GITHUB-USERNAME.github.io/attendance-portal/`

8. Open the URL, confirm the status says **Connected to Google Sheets**, and test adding one sample person.

## How to use

### Add a person
1. Open the **People** tab.
2. Enter a unique Person ID (for example `P001`) and full name.
3. Click **Add person**.

### Edit a person
1. In the People list, click **Edit**.
2. Change the name and click **Save changes**.
3. Person ID remains fixed so historical attendance remains linked.

### Update attendance
1. Open **Attendance**.
2. Select the attendance date.
3. Set each person's status to **Present**, **Absent**, or **Not marked**.
4. Use **All present** or **All absent** for bulk marking.
5. Click **Save attendance**.

The app updates the existing record for the same Person ID + date rather than creating a duplicate. Selecting **Not marked** and saving clears a previous mark for that date.

### Reports
1. Open **Reports**.
2. Select the From and To dates.
3. Click **Generate report**.
4. Click **Export CSV** to download a file that can be opened in Excel.

Attendance percentage is calculated as:

`Present / (Present + Absent) × 100`

Dates with no saved attendance are not counted as marked days.

## Data rules and notes

- Person ID is the permanent key. Do not reuse an ID for a different person.
- Do not delete rows or change the column order in the two system tabs.
- If a person should no longer appear in the portal, you can set their `Active` cell to `FALSE` in the People tab. Their historic attendance remains in the sheet but they will not appear in the current portal or report.
- Reports include active people only.
- The date in attendance is stored as a spreadsheet date value.
- The app currently supports Present and Absent. Add other statuses only if you also update the frontend and Apps Script validation.
- This is a simple starter for a small group. For a large group or multiple concurrent administrators, move to an authenticated backend and consider pagination/audit logs.

## Troubleshooting

**“Add your Apps Script Web App URL…”**
- The `API_URL` placeholder in `app.js` has not been replaced.

**“Could not reach Apps Script” / timeout**
- Confirm the URL ends in `/exec`, not `/dev`.
- Confirm the deployment is a Web app and access is set to Anyone.
- If you edited the script, deploy a new version.
- Open the `/exec` URL directly in a browser. It may show an invalid callback message; that is expected because the portal supplies a JSONP callback.

**Google Workspace does not offer “Anyone”**
- Your organization may restrict public Apps Script deployments. Use an account where public web apps are permitted or choose an authenticated architecture.

**People do not appear**
- Confirm the `People` tab has the exact headers created by `setup()`.
- Confirm each row has Person ID and Name, and Active is not `FALSE`.

**Attendance is saved but report looks empty**
- Check the date range and spreadsheet timezone. Set the Apps Script project timezone to your local timezone under Project Settings.

## Suggested next improvements

- Admin authentication and role-based access.
- Attendance audit log (who changed what and when).
- Additional statuses such as Leave / Holiday.
- Monthly calendar and per-person attendance sheet.
- Print-ready PDF reports.
