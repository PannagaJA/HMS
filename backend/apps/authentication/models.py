from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [
        ('ADMIN', 'HMS Admin'),
        ('WARDEN', 'Hostel Warden'),
        ('SECURITY', 'Security Guard'),
        ('STUDENT', 'Hostel Student'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='STUDENT')
    phone = models.CharField(max_length=20, blank=True, null=True)
    avatar_url = models.URLField(max_length=500, blank=True, null=True)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"
