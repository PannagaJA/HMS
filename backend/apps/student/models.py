from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.hms_admin.models import Hostel, HostelRoom, HostelCourse

class HostelStudent(TimeStampedModel):
    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female')]
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_profile', null=True, blank=True)
    student_name = models.CharField(max_length=200)
    father_name = models.CharField(max_length=200, blank=True, null=True)
    enrollment_no = models.CharField(max_length=50, unique=True)
    course = models.ForeignKey(HostelCourse, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    room = models.ForeignKey(HostelRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='occupants')
    bed_number = models.CharField(max_length=10, blank=True, null=True)
    room_allotted = models.BooleanField(default=False)
    no_dues = models.BooleanField(default=True)
    guardian_phone = models.CharField(max_length=20, blank=True, null=True)
    emergency_contact = models.CharField(max_length=20, blank=True, null=True)

    def __str__(self):
        return f"{self.student_name} ({self.enrollment_no})"

class HostelOutsideStudent(TimeStampedModel):
    GENDER_CHOICES = [('M', 'Male'), ('F', 'Female')]
    name = models.CharField(max_length=200)
    usn = models.CharField(max_length=50, unique=True)
    outside_college_name = models.CharField(max_length=255, default='')
    outside_course_name = models.CharField(max_length=255, default='')
    outside_year = models.CharField(max_length=50, blank=True, null=True)
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    father_name = models.CharField(max_length=200, blank=True, null=True)
    father_phone = models.CharField(max_length=20, blank=True, null=True)
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, default='M')
    hostel = models.ForeignKey(Hostel, on_delete=models.SET_NULL, null=True, blank=True, related_name='outside_students')
    room = models.ForeignKey(HostelRoom, on_delete=models.SET_NULL, null=True, blank=True, related_name='outside_occupants')
    bed_number = models.CharField(max_length=10, blank=True, null=True)
    room_allotted = models.BooleanField(default=False)
    no_dues = models.BooleanField(default=True)
    joining_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"{self.name} ({self.usn}) - {self.outside_college_name}"
