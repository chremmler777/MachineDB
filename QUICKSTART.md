# MachineDB - Quick Start Guide

## 🚀 Start in 3 Steps

### Step 1: Build and Start Docker Containers
```bash
cd /home/nitrolinux/claude/machinedb
docker compose up --build
```

Wait for all services to start. You should see:
```
✓ Backend server running on port 3001
✓ Frontend running on port 5173
```

### Step 2: Initialize Database (in another terminal)
```bash
cd /home/nitrolinux/claude/machinedb
docker compose exec backend npm run migrate
docker compose exec backend npm run seed
```

### Step 3: Access the Application
- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **Database**: postgres://postgres:postgres@localhost:5432/machinedb

## 🔐 Demo Credentials

**Master User** (Full Access)
- Username: `master`
- Password: `master123`

**Viewer Users** (Read-Only)
- USA: `viewer_usa` / `viewer123`
- Mexico: `viewer_mexico` / `viewer123`

## 📊 What You Can Do

1. **Login** with any demo credential
2. **View Dashboard** - Summary stats per plant
3. **Browse Machines** - List with filters (plant, manufacturer, clamping force, year)
4. **Search Machines** - Real-time search by name/model
5. **View Details** - Full specs, files, revision history
6. **Machine Finder** - Enter tool requirements, find suitable machines
7. **Admin Panel** (Master only):
   - Import machines from Excel
   - Upload files to machines
   - View revision history

## 📥 Import Excel Data

1. Login as `master`
2. Click "Admin" menu
3. Go to "Import Data" tab
4. Upload `/home/nitrolinux/claude/Machinelist/MachineDataBase.xlsx`
5. Click "Import Machines"

The system will import both USA and Mexico machines with all specifications.

## 📁 Project Structure

```
machinedb/
├── backend/           # Node.js + Express + TypeScript
├── frontend/          # React + Vite
├── data/files/        # Uploaded files storage
├── docker-compose.yml
└── README.md
```

## 🐳 Docker Commands

```bash
# Start all services
docker compose up

# Stop all services
docker compose down

# View logs
docker compose logs -f

# Access backend shell
docker compose exec backend sh

# Access PostgreSQL
docker compose exec postgres psql -U postgres -d machinedb

# Rebuild after code changes
docker compose up --build
```

## 🔌 API Examples

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"master","password":"master123"}'
```

### List Machines
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3001/api/machines?limit=10
```

### Machine Finder
```bash
curl -X POST http://localhost:3001/api/machines/finder/search \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clamping_force_kn": 100,
    "mold_width": 200,
    "mold_height": 150,
    "shot_weight_g": 500
  }'
```

## 🐛 Troubleshooting

### Services won't start
```bash
# Check if ports are already in use
lsof -i :3001
lsof -i :5173
lsof -i :5432

# Kill existing processes or use different ports
```

### Database migration failed
```bash
# Check database logs
docker compose logs postgres

# Manually run migration
docker compose exec backend npm run migrate
```

### Can't login
```bash
# Verify users were seeded
docker compose exec postgres psql -U postgres -d machinedb -c "SELECT * FROM users;"

# Re-seed if needed
docker compose exec backend npm run seed
```

### Files not uploading
```bash
# Check file directory permissions
ls -la data/files/

# Ensure directory exists
mkdir -p data/files/

# Set permissions
chmod 777 data/files/
```

## 📚 Next Steps

1. **Explore Machine Finder** - The key feature for finding machines by specs
2. **View Revisions** - See how machine specs change over time
3. **Upload Files** - Add drawings and 3D models to machines
4. **Import More Data** - Add machines from Excel files
5. **Manage Users** - Create additional admin or viewer accounts (via backend seed.ts)

## 📖 Full Documentation

See `README.md` for:
- Complete API reference
- Database schema details
- Development setup
- Deployment guide
- Security notes

## 🆘 Need Help?

Check the logs:
```bash
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f postgres
```

Each service outputs detailed error messages that will help diagnose issues.

---

**Happy machining! 🏭**
