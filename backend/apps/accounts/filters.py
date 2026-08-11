import django_filters

from .models import Member


class MemberFilter(django_filters.FilterSet):
    min_age = django_filters.NumberFilter(method='filter_min_age')
    max_age = django_filters.NumberFilter(method='filter_max_age')
    religion = django_filters.CharFilter(field_name='profile__religion', lookup_expr='iexact')
    location = django_filters.CharFilter(field_name='profile__work_location', lookup_expr='icontains')

    class Meta:
        model = Member
        fields = ('gender', 'religion', 'location')

    def filter_min_age(self, queryset, name, value):
        return queryset

    def filter_max_age(self, queryset, name, value):
        return queryset


UserFilter = MemberFilter
