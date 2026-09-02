from rest_framework import serializers
from .models import MealType, MenuItem, Menu, MessBilling, StudentMealSkip
from apps.hms_admin.models import Hostel

class MealTypeSerializer(serializers.ModelSerializer):
    start_time = serializers.SerializerMethodField()
    end_time = serializers.SerializerMethodField()

    class Meta:
        model = MealType
        fields = '__all__'

    def get_start_time(self, obj):
        return str(obj.time_from) if hasattr(obj, 'time_from') else '08:00:00'

    def get_end_time(self, obj):
        return str(obj.time_to) if hasattr(obj, 'time_to') else '10:00:00'

class MenuItemSerializer(serializers.ModelSerializer):
    is_veg = serializers.SerializerMethodField()

    class Meta:
        model = MenuItem
        fields = '__all__'

    def get_is_veg(self, obj):
        return getattr(obj, 'vegetarian', True)

class MenuSerializer(serializers.ModelSerializer):
    meal_type_name = serializers.ReadOnlyField(source='meal_type.name')
    items_detail = MenuItemSerializer(source='items', many=True, read_only=True)
    hostel = serializers.PrimaryKeyRelatedField(queryset=Hostel.objects.all(), required=False)

    class Meta:
        model = Menu
        fields = '__all__'

    def validate(self, attrs):
        if 'hostel' not in attrs:
            default_hostel = Hostel.objects.first()
            if default_hostel:
                attrs['hostel'] = default_hostel
        return attrs

class StudentMealSkipSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentMealSkip
        fields = '__all__'

class MessBillingSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.student_name')
    enrollment_no = serializers.ReadOnlyField(source='student.enrollment_no')

    class Meta:
        model = MessBilling
        fields = '__all__'
