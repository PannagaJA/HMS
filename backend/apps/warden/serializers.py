from rest_framework import serializers
from .models import HostelIssue, IssueUpdate
from apps.hms_admin.serializers import HostelRoomSerializer

class IssueUpdateSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.SerializerMethodField()

    class Meta:
        model = IssueUpdate
        fields = '__all__'

    def get_updated_by_name(self, obj):
        if not obj.updated_by:
            return 'Hostel Administration'
        
        user = obj.updated_by
        # 1. Full name if present
        full_name = user.get_full_name()
        if full_name and full_name.strip():
            role_label = f" ({user.get_role_display()})" if hasattr(user, 'get_role_display') else ""
            return f"{full_name.strip()}{role_label}"
        
        # 2. Check if linked to HostelWarden profile
        if hasattr(user, 'warden_profile') and user.warden_profile.name:
            return f"{user.warden_profile.name} (Hostel Warden)"

        # 3. Check role display
        if hasattr(user, 'get_role_display'):
            role_display = user.get_role_display()
            if user.username.lower() in ['admin', 'hms_admin', 'root']:
                return f"Chief Warden / {role_display}"
            return f"{user.username.capitalize()} ({role_display})"

        if user.username.lower() in ['admin', 'hms_admin']:
            return "Hostel Administrator"

        return user.username.capitalize()

class HostelIssueSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.student_name')
    enrollment_no = serializers.ReadOnlyField(source='student.enrollment_no')
    room_no = serializers.ReadOnlyField(source='room.no')
    hostel_name = serializers.ReadOnlyField(source='hostel.name')
    updates = IssueUpdateSerializer(many=True, read_only=True)

    class Meta:
        model = HostelIssue
        fields = '__all__'
        read_only_fields = ['student', 'hostel', 'room']
