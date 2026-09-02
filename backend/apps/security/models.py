import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone
from apps.core.models import TimeStampedModel
from apps.hms_admin.models import Hostel, HostelWarden
from apps.student.models import HostelStudent

class GatePassRequest(TimeStampedModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('expired', 'Expired'),
        ('completed', 'Completed'),
    ]
    PASS_TYPE_CHOICES = [
        ('DAY_OUT', 'Day Outing'),
        ('NIGHT_OUT', 'Night Out'),
        ('HOME_VISIT', 'Home Visit / Leave'),
        ('EMERGENCY', 'Emergency'),
    ]
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    student = models.ForeignKey(HostelStudent, on_delete=models.CASCADE, related_name='gate_passes')
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name='gate_passes')
    pass_type = models.CharField(max_length=20, choices=PASS_TYPE_CHOICES, default='DAY_OUT')
    reason = models.TextField()
    out_date = models.DateField()
    out_time = models.TimeField()
    expected_return_date = models.DateField()
    expected_return_time = models.TimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    
    # Action taken by Warden
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_gate_passes')
    action_note = models.TextField(blank=True, null=True)
    actioned_at = models.DateTimeField(null=True, blank=True)

    # Actual Gate Movement recorded by Security
    actual_exit_time = models.DateTimeField(null=True, blank=True)
    actual_entry_time = models.DateTimeField(null=True, blank=True)
    is_late = models.BooleanField(default=False)
    security_guard = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_gate_passes')

    def __str__(self):
        return f"{self.student.student_name} - {self.get_status_display()} ({self.out_date})"

class VisitorLog(TimeStampedModel):
    student = models.ForeignKey(HostelStudent, on_delete=models.CASCADE, related_name='visitor_logs')
    hostel = models.ForeignKey(Hostel, on_delete=models.SET_NULL, null=True, blank=True, related_name='visitor_logs')
    visitor_name = models.CharField(max_length=200)
    mobile_number = models.CharField(max_length=20)
    purpose = models.TextField()
    check_in_time = models.DateTimeField(default=timezone.now)
    check_out_time = models.DateTimeField(null=True, blank=True)
    recorded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"{self.visitor_name} visiting {self.student.student_name}"
