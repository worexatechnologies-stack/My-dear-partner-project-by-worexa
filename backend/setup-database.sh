#!/bin/bash
# Database Setup Script for Mac/Linux/Git Bash
# Run this after git pull to ensure database is up to date

echo "🚀 Starting database setup..."

# Step 1: Run migrations
echo ""
echo "📦 Running database migrations..."
python manage.py migrate
if [ $? -ne 0 ]; then
    echo "❌ Migration failed. Please check your database connection."
    exit 1
fi
echo "✅ Migrations complete"

# Step 2: Seed membership plans
echo ""
echo "💎 Seeding membership plans..."
python manage.py seed_membership_plans
if [ $? -ne 0 ]; then
    echo "❌ Seeding failed."
    exit 1
fi
echo "✅ Membership plans seeded"

# Step 3: Verify Free plan exists
echo ""
echo "🔍 Verifying Free plan..."
python manage.py shell <<EOF
from apps.core.models import MembershipPlan
free = MembershipPlan.objects.filter(slug='free', is_active=True).first()
if free:
    print(f'✅ Free plan exists: {free.name} (Price: {free.price})')
else:
    print('❌ Free plan not found or inactive')
    exit(1)
EOF

if [ $? -ne 0 ]; then
    echo "❌ Free plan verification failed"
    exit 1
fi

echo ""
echo "✨ Database setup complete!"
echo "You can now start the development server."
echo ""
