from rest_framework import serializers
from .models import GatePassRequest, VisitorLog
from apps.student.serializers import HostelStudentSerializer

class GatePassRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.student_name')
    enrollment_no = serializers.ReadOnlyField(source='student.enrollment_no')
    hostel_name = serializers.ReadOnlyField(source='hostel.name')
    room_no = serializers.ReadOnlyField(source='student.room.no')
    approved_by_name = serializers.ReadOnlyField(source='approved_by.username')

    class Meta:
        model = GatePassRequest
        fields = '__all__'
        read_only_fields = ['token', 'status', 'approved_by', 'actioned_at', 'actual_exit_time', 'actual_entry_time', 'is_late', 'security_guard']

class VisitorLogSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.student_name')
    enrollment_no = serializers.ReadOnlyField(source='student.enrollment_no')
    hostel_name = serializers.ReadOnlyField(source='hostel.name')
    recorded_by_name = serializers.ReadOnlyField(source='recorded_by.username')

    class Meta:
        model = VisitorLog
        fields = '__all__'
        read_only_fields = ['recorded_by']
