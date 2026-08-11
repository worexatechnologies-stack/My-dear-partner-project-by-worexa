# Database Setup Script for Windows PowerShell
# Run this after git pull to ensure database is up to date

Write-Host "🚀 Starting database setup..." -ForegroundColor Cyan

# Step 1: Run migrations
Write-Host "`n📦 Running database migrations..." -ForegroundColor Yellow
python manage.py migrate
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Migration failed. Please check your database connection." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Migrations complete" -ForegroundColor Green

# Step 2: Seed membership plans
Write-Host "`n💎 Seeding membership plans..." -ForegroundColor Yellow
python manage.py seed_membership_plans
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Seeding failed." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Membership plans seeded" -ForegroundColor Green

# Step 3: Verify Free plan exists
Write-Host "`n🔍 Verifying Free plan..." -ForegroundColor Yellow
$verifyScript = @"
from apps.core.models import MembershipPlan
free = MembershipPlan.objects.filter(slug='free', is_active=True).first()
if free:
    print(f'✅ Free plan exists: {free.name} (Price: {free.price})')
else:
    print('❌ Free plan not found or inactive')
    exit(1)
"@

python manage.py shell -c $verifyScript
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Free plan verification failed" -ForegroundColor Red
    exit 1
}

Write-Host "`n✨ Database setup complete!" -ForegroundColor Green
Write-Host "You can now start the development server.`n" -ForegroundColor Cyan
