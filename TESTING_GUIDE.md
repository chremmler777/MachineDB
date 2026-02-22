# MachineDB Testing & Verification Guide

## Pre-Deployment Verification Checklist

### ✅ Start the Application

```bash
cd /home/nitrolinux/claude/machinedb
docker compose up --build
```

Wait for output showing:
```
✓ Backend server running on port 3001
✓ Frontend running on port 5173
```

### ✅ Initialize Database

In another terminal:
```bash
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

You should see:
```
✓ All migrations completed
✓ Users seeded successfully
```

---

## 🧪 Manual Testing Steps

### 1. Authentication

#### Test Login Page
1. Navigate to http://localhost:5173
2. Should see MachineDB login form
3. Try with demo credentials:
   - Username: `master`
   - Password: `master123`
4. Click Login
5. Should be redirected to Dashboard

✅ **Pass Criteria**: Login successful, redirected to dashboard

#### Test Demo Credentials
- Try `viewer_usa` / `viewer123` - Should login
- Try `viewer_mexico` / `viewer123` - Should login
- Try wrong password - Should show error

✅ **Pass Criteria**: All credentials work correctly, errors shown appropriately

### 2. Dashboard

#### Test Dashboard Stats
1. After login, Dashboard should show:
   - Total Machines count
   - USA Machines count
   - Mexico Machines count
   - Manufacturers count
2. All should be > 0 if data is imported

✅ **Pass Criteria**: Stats display correctly

#### Test Navigation
1. Click on "Machines" menu - Should go to machine list
2. Click on "Machine Finder" - Should go to finder
3. If master, "Admin" should be visible - Click it for admin panel
4. Click "MachineDB" title - Should go back to dashboard

✅ **Pass Criteria**: Navigation works smoothly

### 3. Machine List

#### Test Search
1. Go to Machines page
2. In search box, type "KM 80"
3. Results should filter in real-time
4. Clear search - All machines return

✅ **Pass Criteria**: Search filters results instantly

#### Test Plant Filter
1. Select "USA" from Plant dropdown
2. Only USA machines should show
3. Select "Mexico" - Only Mexico machines show
4. Select "All Plants" - All show

✅ **Pass Criteria**: Plant filter works correctly

#### Test Manufacturer Filter
1. Select a manufacturer from dropdown
2. Only that manufacturer's machines show
3. Clear filter - All show

✅ **Pass Criteria**: Manufacturer filter works

#### Test Pagination
1. List should show up to 50-100 machines per page
2. Try scrolling - Should load more if needed

✅ **Pass Criteria**: Table displays machines with proper limits

### 4. Machine Detail Page

#### Test Machine Navigation
1. From machine list, click "View" on any machine
2. Should show full machine details
3. "Back" button should return to list

✅ **Pass Criteria**: Detail view loads and navigation works

#### Test Detail View Content
On machine detail page, verify these sections:
- **Header**: Machine name, back button
- **Quick Info Card**: Manufacturer, Model, Year, Plant
- **Three Tabs**: Specifications, Files, History

✅ **Pass Criteria**: All sections display

#### Test Specifications Tab
1. Click "Specifications" tab
2. Should see two-column layout with:
   - Left: Dimensions, Clamping Unit
   - Right: Injection Unit 1, Remarks
3. All numeric values should display with units (mm, kN, cm³, etc.)

✅ **Pass Criteria**: Specs display correctly formatted

#### Test Files Tab (as Master)
1. Login as master user
2. Go to Machine Detail, Files tab
3. Should see "Upload File" form
4. Select a test file (PDF, image, any file)
5. Click "Upload File"
6. File should appear in list below
7. Click "Download" - File should download
8. Click "Delete" - File should be removed

✅ **Pass Criteria**: File upload/download/delete works

#### Test Files Tab (as Viewer)
1. Login as viewer user
2. Go to same machine, Files tab
3. Should see files but NO upload form
4. Should be able to download but NOT delete

✅ **Pass Criteria**: Viewer sees files but can't upload/delete

#### Test History Tab
1. Click "History" tab
2. Should see revision entries
3. Each should show:
   - Revision number
   - Change type (create/update)
   - Timestamp
   - Username who made change
4. For master-created machines, should see initial "create" revision

✅ **Pass Criteria**: Revision history displays

### 5. Machine Finder (Key Feature)

#### Test Machine Finder Page
1. Go to "Machine Finder" menu
2. Should see form on left with input fields:
   - Clamping Force (kN)
   - Mold Width (mm)
   - Mold Height (mm)
   - Shot Weight (g)
   - Core Pulls (Nozzle)
   - Centering Ring Nozzle (mm)
3. Right side should show helpful message

✅ **Pass Criteria**: Finder UI loads correctly

#### Test Basic Search
1. Enter a clamping force (e.g., 100 kN)
2. Click "Search"
3. Results should appear on right with color coding:
   - Green = Full Match (score >= 75%)
   - Yellow = Near Match (50-75%)
   - Red = Not Suitable (< 50%)
4. Results should be sorted by suitability

✅ **Pass Criteria**: Search returns results with proper sorting

#### Test Full Match (Green)
1. Enter specs of a machine that should match
   - E.g., for KM 80: clamping_force_kn=80, mold_width=500, etc.
2. Should see that machine highlighted in green
3. Should show "✓ Full Match" with high score

✅ **Pass Criteria**: Full matches identified correctly

#### Test Near Match (Yellow)
1. Enter specs slightly beyond a machine's capacity
   - E.g., clamping force 10% higher than a machine's max
2. Should see that machine in yellow
3. Should show "⚠ Near Match" with 50-75% score
4. Should list gaps like "Clamping force: 15kN short"

✅ **Pass Criteria**: Near matches identified with gap analysis

#### Test Result Click-Through
1. In search results, click any machine card
2. Should navigate to that machine's detail page
3. Should be able to review full specs

✅ **Pass Criteria**: Results linked to detail pages

#### Test Multiple Requirements
1. Enter multiple requirements (e.g., clamping force + mold dimensions + shot weight)
2. Results should consider all constraints
3. Machines meeting all should be ranked higher

✅ **Pass Criteria**: Multi-parameter matching works

### 6. Admin Panel (Master Only)

#### Test Admin Access
1. Login as `master`
2. Click "Admin" menu (should be visible)
3. Should see Admin Panel with tabs

✅ **Pass Criteria**: Only master sees admin menu

#### Test Admin Access as Viewer
1. Login as `viewer_usa`
2. Click "Admin" in URL directly: http://localhost:5173#/admin
3. Should NOT see admin panel (access denied or hidden)

✅ **Pass Criteria**: Viewers cannot access admin

#### Test Import Tab
1. Go to Admin Panel, "Import Data" tab
2. Should see file upload form
3. Upload `/home/nitrolinux/claude/Machinelist/MachineDataBase.xlsx`
4. Click "Import Machines"
5. Should see success message

✅ **Pass Criteria**: Import completes successfully

#### Test Imported Data
1. After import, go to Machines list
2. Machine count should increase
3. Should see USA and Mexico machines
4. Filter by plant should show both plants

✅ **Pass Criteria**: Imported machines appear in system

#### Test User Management Tab
1. Go to "User Management" tab
2. Should show demo users and their roles
3. (Full CRUD implementation ready for extension)

✅ **Pass Criteria**: User management UI loads

### 7. API Testing

#### Test Login API
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"master123"}'
```

Should return:
```json
{
  "token": "eyJhbG...",
  "user": {
    "id": 1,
    "username": "master",
    "role": "master",
    "plant": "USA"
  }
}
```

✅ **Pass Criteria**: Returns valid JWT token

#### Test Authenticated Requests
```bash
# Get machines list (replace TOKEN)
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/machines

# Get single machine
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3001/api/machines/1
```

Should return machine data

✅ **Pass Criteria**: Auth header validates requests

#### Test Unauthorized Request
```bash
curl http://localhost:3001/api/machines
```

Should return:
```json
{"error": "No token provided"}
```

✅ **Pass Criteria**: Rejects unauthenticated requests

#### Test Machine Finder API
```bash
curl -X POST http://localhost:3001/api/machines/finder/search \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clamping_force_kn": 100,
    "mold_width": 300,
    "shot_weight_g": 1000
  }'
```

Should return scored machines with gaps

✅ **Pass Criteria**: Finder returns ranked results

### 8. Database Verification

#### Check Users Table
```bash
docker compose exec postgres psql -U postgres -d machinedb -c "SELECT id, username, role, plant FROM users;"
```

Should show:
```
 id | username      | role   | plant
----+---------------+--------+--------
  1 | master        | master | USA
  2 | viewer_usa    | viewer | USA
  3 | viewer_mexico | viewer | Mexico
```

✅ **Pass Criteria**: Users created correctly

#### Check Machines Table
```bash
docker compose exec postgres psql -U postgres -d machinedb -c "SELECT COUNT(*) FROM machines;"
```

Should show machine count > 0 after import

✅ **Pass Criteria**: Machines imported successfully

#### Check Revisions Table
```bash
docker compose exec postgres psql -U postgres -d machinedb -c "SELECT COUNT(*) FROM machine_revisions;"
```

Should have revisions for each machine

✅ **Pass Criteria**: Revision tracking working

#### Check Files Table
```bash
docker compose exec postgres psql -U postgres -d machinedb -c "SELECT COUNT(*) FROM machine_files;"
```

Should show file count after uploads

✅ **Pass Criteria**: Files tracked in database

### 9. Performance Testing

#### Test List Performance
1. Go to Machines list
2. With search filter applied
3. Should respond in < 1 second

✅ **Pass Criteria**: List filters perform well

#### Test Finder Performance
1. Enter all requirements
2. Click Search
3. Should return results in < 2 seconds

✅ **Pass Criteria**: Finder performs well with all machines

#### Test File Upload Performance
1. Upload a 5-10 MB file
2. Should complete in reasonable time
3. Should be downloadable after

✅ **Pass Criteria**: File operations handle reasonable sizes

### 10. Browser Compatibility

#### Test on Different Screen Sizes
1. **Desktop** (1920x1080): UI should display properly
2. **Tablet** (768x1024): Should be responsive
3. **Mobile** (375x667): Should be usable

✅ **Pass Criteria**: Works on all screen sizes

#### Test on Different Browsers
- Chrome: Should work
- Firefox: Should work
- Safari: Should work
- Edge: Should work

✅ **Pass Criteria**: Cross-browser compatible

### 11. Error Handling

#### Test Login Error
1. Enter wrong credentials
2. Should show error message
3. Should NOT navigate away

✅ **Pass Criteria**: Errors handled gracefully

#### Test Network Error
1. Stop backend: `docker compose stop backend`
2. Try to load machine list
3. Should show error (connection refused)
4. Restart backend: `docker compose start backend`

✅ **Pass Criteria**: Network errors caught and shown

#### Test Invalid File Upload
1. Try to upload a file > 50 MB
2. Should show error or reject
3. Should not crash UI

✅ **Pass Criteria**: File validation working

### 12. Data Integrity

#### Test Concurrent Updates
1. Open same machine in 2 browser windows
2. Edit in window 1, save
3. Edit different field in window 2, save
4. Both edits should be persisted
5. Refresh and check - both appear

✅ **Pass Criteria**: Concurrent updates don't conflict

#### Test Revision Chain
1. Update a machine multiple times
2. Each update creates new revision
3. Revision numbers should be sequential
4. All previous data should be in revisions

✅ **Pass Criteria**: Audit trail complete and accurate

---

## 🚨 Troubleshooting During Testing

### Container Won't Start
```bash
docker compose logs postgres
docker compose logs backend
docker compose logs frontend
```

### API Responding with 500 Error
```bash
docker compose logs backend
# Check database connection:
docker compose logs postgres
```

### Files Not Persisting
```bash
ls -la data/files/
# Verify Docker volume mounted:
docker inspect machinedb_backend | grep Mounts
```

### CSS Not Loading
```bash
# Frontend build might have failed
docker compose logs frontend
# Rebuild:
docker compose up --build frontend
```

---

## ✅ Final Checklist

Before considering the project complete, verify:

- [ ] Docker services start without errors
- [ ] Database migrations run successfully
- [ ] Demo users are created
- [ ] Login works with all credentials
- [ ] Dashboard loads with stats
- [ ] Machine list displays and filters work
- [ ] Machine detail view shows all specs
- [ ] Files can be uploaded and downloaded (master)
- [ ] Revision history appears
- [ ] Machine Finder returns results
- [ ] Admin panel visible to master only
- [ ] Excel import works
- [ ] All API endpoints respond correctly
- [ ] Responsive design works on mobile
- [ ] Error messages display appropriately
- [ ] No console errors in browser DevTools

---

## 🎉 Success Criteria

All tests pass when:
1. ✅ All 12 test categories pass
2. ✅ All features work as designed
3. ✅ No errors in console/logs
4. ✅ Data persists across restarts
5. ✅ Role-based access enforced
6. ✅ Machine Finder matches machines correctly
7. ✅ File operations secure and working

---

**System is ready for production deployment when all tests pass!** 🚀
