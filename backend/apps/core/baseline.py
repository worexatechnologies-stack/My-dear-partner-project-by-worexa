from .models import SupportCategory, SupportSlaRule, MembershipPlan


SUPPORT_CATEGORIES = {
    'GENERAL': 'General',
    'PAYMENTS': 'Payments',
    'PROFILE_VERIFICATION': 'Profile verification',
    'TECHNICAL': 'Technical',
    'REFUNDS': 'Refunds',
    'SAFETY': 'Safety',
}


def seed_membership_plans():
    plans = [
        {
            'name': 'Free',
            'slug': 'free',
            'price': 0.00,
            'duration': '30 Days',
            'highlighted': False,
            'badge': '',
            'color': 'from-gray-400 to-gray-600',
            'features': [
                'Basic profile search',
                'Send 3 interests daily',
                'View primary photos only',
            ],
        },
        {
            'name': 'Gold',
            'slug': 'gold',
            'price': 2999.00,
            'duration': '3 Months',
            'highlighted': False,
            'badge': '',
            'color': 'from-amber-500 to-yellow-600',
            'features': [
                'Everything in Free',
                'Unlimited interests',
                'Advanced search filters',
                'View all photos',
                'Direct messaging',
                'Profile highlighting',
                'Email support',
            ],
        },
        {
            'name': 'Elite',
            'slug': 'elite',
            'price': 5999.00,
            'duration': '6 Months',
            'highlighted': True,
            'badge': '✦ Most Popular',
            'color': 'from-blue-500 to-indigo-600',
            'features': [
                'Everything in Gold',
                'AI matchmaking engine',
                'Priority profile visibility',
                'Video call feature',
                'Relationship manager',
                'Profile verification status',
                'Phone support',
                'Horoscope matching',
            ],
        },
        {
            'name': 'Premium',
            'slug': 'premium',
            'price': 14999.00,
            'duration': '12 Months',
            'highlighted': False,
            'badge': '✦ Premium',
            'color': 'from-slate-800 to-slate-950',
            'features': [
                'Everything in Elite',
                'Dedicated matchmaker',
                'Premium profile showcase',
                'Background verification',
                'Concierge service',
                'Exclusive events access',
                'Priority 24/7 support',
                'Guaranteed matches',
                'Wedding planning assistance',
            ],
        }
    ]
    for plan_data in plans:
        MembershipPlan.objects.update_or_create(
            slug=plan_data['slug'],
            defaults={
                'name': plan_data['name'],
                'price': plan_data['price'],
                'duration': plan_data['duration'],
                'features': plan_data['features'],
                'highlighted': plan_data['highlighted'],
                'badge': plan_data['badge'],
                'color': plan_data['color'],
            }
        )


def seed_support_baseline():
    seed_membership_plans()
    for code, name in SUPPORT_CATEGORIES.items():
        category, _ = SupportCategory.objects.update_or_create(
            code=code,
            defaults={'name': name, 'is_active': True},
        )
        for priority, response, resolution in (
            ('LOW', 480, 4320),
            ('NORMAL', 240, 2880),
            ('HIGH', 60, 720),
            ('URGENT', 15, 240),
        ):
            SupportSlaRule.objects.update_or_create(
                category=category,
                priority=priority,
                defaults={
                    'first_response_minutes': response,
                    'resolution_minutes': resolution,
                    'is_active': True,
                },
            )

