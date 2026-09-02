from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
import calendar
from .models import MealType, MenuItem, Menu, StudentMealSkip
from .serializers import (
    MealTypeSerializer, MenuItemSerializer, MenuSerializer,
    StudentMealSkipSerializer
)
from apps.student.models import HostelStudent

class MealTypeViewSet(viewsets.ModelViewSet):
    queryset = MealType.objects.all()
    serializer_class = MealTypeSerializer
    permission_classes = [permissions.IsAuthenticated]

class MenuItemViewSet(viewsets.ModelViewSet):
    queryset = MenuItem.objects.all()
    serializer_class = MenuItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['vegetarian', 'is_active']
    search_fields = ['name']

class MenuViewSet(viewsets.ModelViewSet):
    queryset = Menu.objects.all().select_related('hostel', 'meal_type').prefetch_related('items')
    serializer_class = MenuSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['hostel', 'day_of_week', 'meal_type']

    @action(detail=False, methods=['get'])
    def today_menu(self, request):
        hostel_id = request.query_params.get('hostel_id')
        today_dow = str(timezone.now().weekday()) # 0=Monday, 6=Sunday

        qs = Menu.objects.filter(day_of_week=today_dow)
        if hostel_id:
            qs = qs.filter(hostel_id=hostel_id)
        
        serializer = MenuSerializer(qs, many=True)
        return Response({
            'day_of_week': today_dow,
            'day_name': calendar.day_name[int(today_dow)],
            'meals': serializer.data
        })

class StudentMealSkipViewSet(viewsets.ModelViewSet):
    queryset = StudentMealSkip.objects.all().select_related('student', 'hostel', 'meal_type').order_by('-date')
    serializer_class = StudentMealSkipSerializer
    permission_classes = [permissions.IsAuthenticated]

    def perform_create(self, serializer):
        student = HostelStudent.objects.get(user=self.request.user)
        serializer.save(student=student, hostel=student.room.hostel)

    @action(detail=False, methods=['get'])
    def my_skips(self, request):
        try:
            student = HostelStudent.objects.get(user=request.user)
            skips = StudentMealSkip.objects.filter(student=student).order_by('-date')
            return Response(StudentMealSkipSerializer(skips, many=True).data)
        except HostelStudent.DoesNotExist:
            return Response({'error': 'Student not found'}, status=status.HTTP_404_NOT_FOUND)
