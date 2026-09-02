from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
import calendar
from datetime import date
from .models import MealType, MenuItem, Menu, StudentMealSkip, MessBilling
from .serializers import (
    MealTypeSerializer, MenuItemSerializer, MenuSerializer,
    StudentMealSkipSerializer, MessBillingSerializer
)
from apps.student.models import HostelStudent
from apps.hms_admin.models import Hostel

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

class MessBillingViewSet(viewsets.ModelViewSet):
    queryset = MessBilling.objects.all().select_related('student', 'hostel').order_by('-month')
    serializer_class = MessBillingSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['hostel', 'student', 'paid', 'month']

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def generate_monthly_bills(self, request):
        if not (request.user.role == 'ADMIN' or request.user.is_superuser):
            return Response({'error': 'Admin only'}, status=status.HTTP_403_FORBIDDEN)

        year = int(request.data.get('year', timezone.now().year))
        month = int(request.data.get('month', timezone.now().month))
        rate_per_meal = float(request.data.get('rate_per_meal', 60.00))

        first_day = date(year, month, 1)
        _, num_days = calendar.monthrange(year, month)
        total_planned_meals = num_days * 3 # e.g. 3 meals/day

        students = HostelStudent.objects.filter(room_allotted=True)
        created_bills = []

        for student in students:
            if not student.room or not student.room.hostel:
                continue

            skips_count = StudentMealSkip.objects.filter(
                student=student,
                date__year=year,
                date__month=month
            ).count()

            consumed = max(0, total_planned_meals - skips_count)
            total_cost = total_planned_meals * rate_per_meal
            discounted_cost = consumed * rate_per_meal

            bill, _ = MessBilling.objects.update_or_create(
                student=student,
                month=first_day,
                defaults={
                    'hostel': student.room.hostel,
                    'total_meals': total_planned_meals,
                    'meals_consumed': consumed,
                    'meals_skipped': skips_count,
                    'rate_per_meal': rate_per_meal,
                    'total_cost': total_cost,
                    'discounted_cost': discounted_cost,
                }
            )
            created_bills.append(bill)

        return Response({
            'message': f"Generated mess bills for {len(created_bills)} students for {first_day.strftime('%B %Y')}",
            'count': len(created_bills)
        })
