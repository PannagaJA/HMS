from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel

class HostelWarden(TimeStampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='warden_profile', null=True, blank=True)
    name = models.CharField(max_length=200)
    email = models.EmailField(max_length=200, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    designation = models.CharField(max_length=100, blank=True, null=True, default='Hostel Warden')
    experience = models.PositiveIntegerField(default=0, help_text="Years of experience")
    address = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class HostelCaretaker(TimeStampedModel):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='caretaker_profile', null=True, blank=True)
    name = models.CharField(max_length=200)
    email = models.EmailField(max_length=200, blank=True, null=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    experience = models.PositiveIntegerField(default=0)

    def __str__(self):
        return self.name

class HostelCourse(TimeStampedModel):
    ROOM_CHOICE = [
        ('S', 'Single Occupancy'),
        ('D', 'Double Occupancy'),
        ('P', 'Reserved for Research Scholars'),
        ('B', 'Both Single and Double Occupancy'),
    ]
    code = models.CharField(max_length=100, unique=True)
    name = models.CharField(max_length=200, blank=True, null=True)
    room_type = models.CharField(choices=ROOM_CHOICE, max_length=1, default='D')

    def __str__(self):
        return self.code

class Hostel(TimeStampedModel):
    GENDER_CHOICES = [
        ('M', 'Male'),
        ('F', 'Female'),
        ('C', 'Co-ed'),
    ]
    name = models.CharField(max_length=150, unique=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    floor_count = models.IntegerField(default=1)
    courses = models.ManyToManyField(HostelCourse, blank=True, related_name='hostels')
    warden = models.ForeignKey(HostelWarden, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_hostels')
    caretaker = models.ForeignKey(HostelCaretaker, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_hostels')
    address = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.name

class HostelRoom(TimeStampedModel):
    ROOM_CHOICE = [
        ('S', 'Single Occupancy'),
        ('D', 'Double Occupancy'),
        ('T', 'Triple Occupancy'),
        ('P', 'Reserved for Research Scholars'),
        ('B', 'Both Single and Double Occupancy'),
    ]
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name='rooms')
    no = models.CharField(max_length=20)
    name = models.CharField(max_length=50)
    room_type = models.CharField(choices=ROOM_CHOICE, max_length=1, default='D')
    floor = models.IntegerField(default=0)
    capacity = models.PositiveIntegerField(default=2)
    vacant = models.BooleanField(default=True)

    class Meta:
        unique_together = ('hostel', 'no')
        ordering = ['hostel', 'floor', 'no']

    def __str__(self):
        return f"{self.hostel.name} - Room {self.no}"
