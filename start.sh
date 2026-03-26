#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== MachineDB Start ==="
echo ""

# Kill any existing processes on ports 3001 and 5175
echo "[0/7] Cleaning up existing processes..."
fuser -k 3001/tcp 2>/dev/null || true
fuser -k 5175/tcp 2>/dev/null || true
pkill -f "tsx watch" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 1
echo "      ✓ Cleaned up"

# Stop Docker backend/frontend (but keep postgres)
echo "[1/8] Stopping Docker backend/frontend if running..."
if docker compose stop backend frontend 2>/dev/null; then
    echo "      ✓ Stopped"
else
    echo "      ✓ Not running (OK)"
fi
docker compose rm -f backend frontend 2>/dev/null || true
sleep 1

# Start postgres if not running
echo "[2/8] Checking PostgreSQL..."
if ! docker ps --format '{{.Names}}' | grep -q machinedb_postgres; then
    echo "      → Starting PostgreSQL..."
    docker compose up -d postgres
    echo "      → Waiting for PostgreSQL to be healthy..."
    until docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do
        sleep 1
    done
    echo "      ✓ PostgreSQL ready"
else
    echo "      ✓ PostgreSQL already running"
fi

# Create files directory if it doesn't exist
echo "[3/8] Checking files directory..."
FILES_DIR="${HOME}/.machinedb/data/files"
if [ ! -d "$FILES_DIR" ]; then
    echo "      → Creating $FILES_DIR..."
    mkdir -p "$FILES_DIR"
    echo "      ✓ Created"
else
    echo "      ✓ Directory exists"
fi

# Install dependencies if needed
echo "[4/8] Checking dependencies..."
if [ ! -d "backend/node_modules" ]; then
    echo "      → Installing backend dependencies..."
    (cd backend && npm install > /dev/null 2>&1)
    echo "      ✓ Backend installed"
else
    echo "      ✓ Backend dependencies OK"
fi

if [ ! -d "frontend/node_modules" ]; then
    echo "      → Installing frontend dependencies..."
    (cd frontend && npm install > /dev/null 2>&1)
    echo "      ✓ Frontend installed"
else
    echo "      ✓ Frontend dependencies OK"
fi

if [ ! -d "node_modules" ]; then
    echo "      → Installing root dependencies..."
    npm install > /dev/null 2>&1
    echo "      ✓ Root installed"
else
    echo "      ✓ Root dependencies OK"
fi

# Run migrations with Docker PostgreSQL connection
echo "[5/8] Running database migrations..."
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/machinedb"
if (cd backend && npm run migrate 2>&1 | tail -1); then
    echo "      ✓ Migrations completed"
fi

# Set environment variables
echo "[6/8] Setting environment..."
export DATABASE_URL="postgresql://postgres:postgres@localhost:5433/machinedb"
export FILES_DIR="$FILES_DIR"
export NODE_ENV="development"
export PORT="3001"
export FRONTEND_URL="http://localhost:5175"
echo "      ✓ Env configured"

# Start backend and frontend
echo "[7/8] Starting services..."
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ MachineDB is starting:"
echo "  • Frontend: http://localhost:5175/machinedb/"
echo "  • Backend:  http://localhost:3001/api"
echo "  • Via Nginx: http://localhost/machinedb/"
echo ""
echo "Database: postgresql://localhost:5433/machinedb"
echo "Files: $FILES_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

npm run dev
