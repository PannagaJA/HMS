from django.db import models
from django.conf import settings
from apps.core.models import TimeStampedModel
from apps.hms_admin.models import Hostel, HostelRoom
from apps.student.models import HostelStudent

class HostelIssue(TimeStampedModel):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('waiting_for_workers', 'Waiting for Workers'),
        ('completed', 'Completed'),
    ]
    CATEGORY_CHOICES = [
        ('PLUMBING', 'Plumbing'),
        ('ELECTRICAL', 'Electrical'),
        ('CARPENTRY', 'Carpentry'),
        ('WIFI', 'Wi-Fi / Internet'),
        ('CLEANLINESS', 'Cleanliness & Hygiene'),
        ('OTHER', 'Other'),
    ]
    student = models.ForeignKey(HostelStudent, on_delete=models.CASCADE, related_name='issues')
    hostel = models.ForeignKey(Hostel, on_delete=models.CASCADE, related_name='issues')
    room = models.ForeignKey(HostelRoom, on_delete=models.CASCADE, related_name='issues')
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES, default='OTHER')
    title = models.CharField(max_length=200)
    description = models.TextField()
    status = models.CharField(max_length=30, choices=STATUS_CHOICES, default='pending')
    resolved_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.title} ({self.get_status_display()})"

class IssueUpdate(TimeStampedModel):
    issue = models.ForeignKey(HostelIssue, on_delete=models.CASCADE, related_name='updates')
    old_status = models.CharField(max_length=30, choices=HostelIssue.STATUS_CHOICES, null=True, blank=True)
    new_status = models.CharField(max_length=30, choices=HostelIssue.STATUS_CHOICES)
    note = models.TextField(blank=True, null=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)

    def __str__(self):
        return f"Issue #{self.issue.id} update: {self.new_status}"
