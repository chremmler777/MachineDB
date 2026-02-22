# MachineDB - Injection Molding Machine Database

A comprehensive web application for managing injection molding machine specifications across multiple plants with role-based access, file storage, and revision tracking.

## Quick Start

### With Docker Compose (Recommended)

```bash
# Build and start all services
docker compose up --build

# On first run, create seed users:
docker exec machinedb_backend npm run seed
```

Then visit `http://localhost:5173`

**Demo Credentials:**
- Master: `master` / `master123`
- Viewer USA: `viewer_usa` / `viewer123`
- Viewer Mexico: `viewer_mexico` / `viewer123`

### Local Development

#### Backend Setup
```bash
cd backend
npm install
cp .env.example .env
npm run migrate
npm run seed
npm run dev
```

#### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## Features

### Core Features
- **Machine Database**: Store ~54 machines with detailed specifications
- **Role-Based Access**: Master (full) and Viewer (read-only) roles
- **Search & Filter**: Filter by plant, manufacturer, clamping force, year, etc.
- **Machine Comparison**: Side-by-side comparison of 2-4 machines
- **Revision Tracking**: Full history of changes with previous/new data
- **File Storage**: Upload/download drawings, 3D models, documentation

### Machine Finder (Key Feature)
Enter tool requirements and find suitable machines:
- **Green (Full Match)**: Machine meets all requirements
- **Yellow (Near Match)**: Close fit, shows what needs upgrading
- **Red (Unsuitable)**: Too far off

Requirements tracked:
- Clamping force
- Mold dimensions (width, height)
- Shot weight
- Core pulls
- Centering ring size
- Injection flow parameters

### Admin Features (Master Only)
- Import machines from Excel files
- Add/Edit/Delete machines
- Upload files to machines
- View system revision log
- User management

## Project Structure

```
machinedb/
├── backend/               # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/       # API endpoints
│   │   ├── db/           # Database connection & migrations
│   │   ├── middleware/   # Authentication
│   │   ├── services/     # Business logic
│   │   └── types/        # TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
├── frontend/             # React + Vite + Tailwind
│   ├── src/
│   │   ├── pages/        # Page components
│   │   ├── components/   # Reusable components
│   │   ├── services/     # API client
│   │   ├── context/      # React context (auth)
│   │   └── types/        # TypeScript interfaces
│   ├── Dockerfile
│   └── package.json
├── data/                 # Mounted volume for file storage
└── docker-compose.yml
```

## Database Schema

### Users
- id, username, password_hash, role (master/viewer), plant, created_at

### Machines
- 70+ fields covering:
  - Basic info (internal name, manufacturer, model, serial, order number, year)
  - Dimensions (length, width, height, weight)
  - Clamping unit (force, centering rings, mold heights, rotary table)
  - Tool connections (temperature circuits, hot runners, core pulls)
  - Ejector specs
  - Interfaces (mechanical & electrical)
  - Injection units 1 & 2 (screw diameter, shot volume, L/D ratio, etc.)
  - Robot specs
  - Meta (remarks, special controls)

### Machine Revisions
- Track all changes with before/after JSONB data

### Machine Files
- Store drawings, 3D models, documentation with metadata

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login, get JWT
- `GET /api/auth/me` - Current user info

### Machines
- `GET /api/machines` - List with filters
- `GET /api/machines/:id` - Single machine
- `POST /api/machines` - Create (master only)
- `PUT /api/machines/:id` - Update (master only)
- `DELETE /api/machines/:id` - Delete (master only)
- `GET /api/machines/:id/revisions` - Change history
- `GET /api/machines/compare/:ids` - Compare multiple
- `POST /api/machines/finder/search` - Machine finder

### Files
- `GET /api/files/machine/:machineId` - List files
- `POST /api/files/machine/:machineId/upload` - Upload (master only)
- `GET /api/files/download/:fileId` - Download
- `DELETE /api/files/:fileId` - Delete (master only)

### Import
- `POST /api/import/excel` - Import from Excel (master only)

## Importing Data

1. Login as master user
2. Go to Admin Panel → Import Data
3. Select Excel file (MachineDataBase.xlsx or MachineList_USA.xlsx)
4. Click "Import Machines"

The system will:
- Parse the Excel file
- Map columns to database fields
- Create revisions for each machine
- Handle duplicates gracefully

## Environment Variables

**Backend (.env)**
```
DATABASE_URL=postgresql://user:password@host:5432/machinedb
JWT_SECRET=your-secret-key
NODE_ENV=production
PORT=3001
FRONTEND_URL=http://localhost:5173
```

**Frontend**
- Proxies API calls to backend via Vite dev server

## Technology Stack

- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 16
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Authentication**: JWT with bcrypt passwords
- **File Upload**: Multer
- **Excel Import**: xlsx library
- **Deployment**: Docker Compose

## Development

### Running Tests
```bash
# Backend (add tests as needed)
cd backend && npm test

# Frontend (add tests as needed)
cd frontend && npm test
```

### Building for Production
```bash
docker compose up --build
```

### Accessing Services
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001
- PostgreSQL: localhost:5432 (postgres/postgres)

## Database Migrations

To run migrations manually:
```bash
# Inside backend container
npm run migrate

# Or locally with local PostgreSQL
npm run migrate
```

## File Storage

Files are stored in `./data/files/` (mounted Docker volume):
- Accessible to both containers
- Persists after container restart
- Backed by file system

## Security Notes

- Change `JWT_SECRET` in production
- Use HTTPS in production
- Store credentials securely
- Validate all user inputs
- Use environment variables for sensitive data
- Database backups recommended

## Troubleshooting

### Database Connection Failed
```bash
# Check if PostgreSQL is running
docker compose ps

# View logs
docker compose logs postgres
```

### Import Not Working
- Verify Excel file format matches expected columns
- Check user has master role
- Review backend logs: `docker compose logs backend`

### Files Not Uploading
- Check file permissions: `ls -la data/files/`
- Verify Docker volume mounting: `docker compose exec backend ls /data/files/`
- Check disk space: `df -h`

## Future Enhancements

- Advanced comparison (highlight differences)
- Batch operations (bulk import, export)
- Machine specifications templates
- Real-time notifications
- Integration with PLM2 system
- Mobile app
- Advanced analytics
