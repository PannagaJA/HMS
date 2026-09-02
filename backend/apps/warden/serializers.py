from rest_framework import serializers
from .models import HostelIssue, IssueUpdate
from apps.hms_admin.serializers import HostelRoomSerializer

class IssueUpdateSerializer(serializers.ModelSerializer):
    updated_by_name = serializers.ReadOnlyField(source='updated_by.username')

    class Meta:
        model = IssueUpdate
        fields = '__all__'

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
