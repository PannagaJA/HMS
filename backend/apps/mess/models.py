from django.db import models
from apps.core.models import TimeStampedModel
from apps.hms_admin.models import Hostel
from apps.student.models import HostelStudent

class MealType(TimeStampedModel):
    MEAL_CHOICES = [
        ('BR', 'Breakfast'),
        ('LN', 'Lunch'),
        ('SN', 'Snacks'),
        ('DN', 'Dinner'),
    ]
    name = models.CharField(max_length=50, choices=MEAL_CHOICES, unique=True)
    description = models.TextField(blank=True, null=True)
    time_from = models.TimeField(null=True, blank=True)
    time_to = models.TimeField(null=True, blank=True)

    def __str__(self):
        return self.get_name_display()

class MenuItem(TimeStampedModel):
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True, null=True)
    vegetarian = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

class Menu(TimeStampedModel):
    DAY_CHOICES = [
        ('0', 'Monday'),
        ('1', 'Tuesday'),
        ('2', 'Wednesday'),
        ('3', 'Thursday'),
        ('4', 'Friday'),
        ('5', 'Saturday'),
        ('6', 'Sunday'),
    ]
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name='menus')
    day_of_week = models.CharField(max_length=1, choices=DAY_CHOICES)
    meal_type = models.ForeignKey(MealType, on_delete=models.CASCADE)
    items = models.ManyToManyField(MenuItem, related_name='menus')
    is_recurring = models.BooleanField(default=True)

    class Meta:
        unique_together = ('hostel', 'day_of_week', 'meal_type')

    def __str__(self):
        return f"{self.hostel.name} - {self.get_day_of_week_display()} ({self.meal_type.get_name_display()})"

class StudentMealSkip(TimeStampedModel):
    SKIP_TYPE_CHOICES = [
        ('SKIP', 'Skip Single Meal'),
        ('LEAVE', 'Mess Leave'),
        ('RETURN', 'Return from Leave'),
    ]
    student = models.ForeignKey(HostelStudent, on_delete=models.CASCADE, related_name='meal_skips')
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name='meal_skips')
    date = models.DateField()
    meal_type = models.ForeignKey(MealType, on_delete=models.SET_NULL, null=True, blank=True)
    skip_type = models.CharField(max_length=10, choices=SKIP_TYPE_CHOICES, default='SKIP')
    reason = models.TextField(blank=True, null=True)
    approved = models.BooleanField(default=True)

    class Meta:
        unique_together = ('student', 'date', 'meal_type')

    def __str__(self):
        return f"{self.student.student_name} - {self.date} ({self.skip_type})"

class MessBilling(TimeStampedModel):
    student = models.ForeignKey(HostelStudent, on_delete=models.CASCADE, related_name='mess_bills')
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name='mess_bills')
    month = models.DateField(help_text="First day of billing month")
    total_meals = models.PositiveIntegerField(default=0)
    meals_consumed = models.PositiveIntegerField(default=0)
    meals_skipped = models.PositiveIntegerField(default=0)
    rate_per_meal = models.DecimalField(max_digits=8, decimal_places=2, default=50.00)
    total_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    discounted_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    paid = models.BooleanField(default=False)
    paid_date = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('student', 'month')

    def __str__(self):
        return f"{self.student.student_name} - {self.month.strftime('%b %Y')} Bill"
