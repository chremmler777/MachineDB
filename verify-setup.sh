#!/bin/bash

echo "🔍 MachineDB Setup Verification"
echo "================================"
echo ""

# Check Docker
echo "✓ Checking Docker..."
if ! command -v docker &> /dev/null; then
    echo "  ✗ Docker not found"
    exit 1
fi
echo "  ✓ Docker installed"

# Check Docker Compose
echo "✓ Checking Docker Compose..."
if ! docker compose version &> /dev/null; then
    echo "  ✗ Docker Compose not found"
    exit 1
fi
echo "  ✓ Docker Compose installed"

# Check project files
echo "✓ Checking project structure..."
files=(
    "backend/package.json"
    "backend/Dockerfile"
    "backend/src/index.ts"
    "frontend/package.json"
    "frontend/Dockerfile"
    "frontend/src/App.tsx"
    "docker-compose.yml"
    "README.md"
)

for file in "${files[@]}"; do
    if [ ! -f "$file" ]; then
        echo "  ✗ Missing: $file"
        exit 1
    fi
done
echo "  ✓ All project files present"

# Check directories
echo "✓ Checking directories..."
dirs=(
    "backend/src/routes"
    "backend/src/db"
    "backend/src/middleware"
    "frontend/src/pages"
    "data/files"
)

for dir in "${dirs[@]}"; do
    if [ ! -d "$dir" ]; then
        echo "  ✗ Missing directory: $dir"
        exit 1
    fi
done
echo "  ✓ All directories present"

# Check Excel files exist
echo "✓ Checking Excel files..."
if [ -f "/home/nitrolinux/claude/Machinelist/MachineDataBase.xlsx" ]; then
    echo "  ✓ MachineDataBase.xlsx found"
else
    echo "  ⚠ MachineDataBase.xlsx not found (needed for import)"
fi

if [ -f "/home/nitrolinux/claude/Machinelist/MachineList_USA.xlsx" ]; then
    echo "  ✓ MachineList_USA.xlsx found"
else
    echo "  ⚠ MachineList_USA.xlsx not found (optional)"
fi

echo ""
echo "================================"
echo "✅ Setup verification complete!"
echo ""
echo "Next steps:"
echo "1. Run: docker compose up --build"
echo "2. In another terminal: docker compose exec backend npm run migrate"
echo "3. Then: docker compose exec backend npm run seed"
echo "4. Visit: http://localhost:5173"
echo ""
echo "Demo credentials:"
echo "  Master: master / master123"
echo "  Viewer: viewer_usa / viewer123"
echo ""
