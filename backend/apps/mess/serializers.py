from rest_framework import serializers
from .models import MealType, MenuItem, Menu, StudentMealSkip, MessBilling

class MealTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealType
        fields = '__all__'

class MenuItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MenuItem
        fields = '__all__'

class MenuSerializer(serializers.ModelSerializer):
    meal_type_name = serializers.ReadOnlyField(source='meal_type.get_name_display')
    items_detail = MenuItemSerializer(source='items', many=True, read_only=True)

    class Meta:
        model = Menu
        fields = '__all__'

class StudentMealSkipSerializer(serializers.ModelSerializer):
    meal_type_name = serializers.ReadOnlyField(source='meal_type.get_name_display')
    student_name = serializers.ReadOnlyField(source='student.student_name')

    class Meta:
        model = StudentMealSkip
        fields = '__all__'
        read_only_fields = ['student', 'hostel']

class MessBillingSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.student_name')
    enrollment_no = serializers.ReadOnlyField(source='student.enrollment_no')

    class Meta:
        model = MessBilling
        fields = '__all__'
