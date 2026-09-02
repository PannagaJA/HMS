from rest_framework import serializers
from .models import GatePassRequest, VisitorLog

class GatePassRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.student_name')
    enrollment_no = serializers.ReadOnlyField(source='student.enrollment_no')
    hostel_name = serializers.ReadOnlyField(source='student.room.hostel.name')
    room_no = serializers.ReadOnlyField(source='student.room.no')
    approved_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GatePassRequest
        fields = '__all__'
        extra_kwargs = {
            'student': {'required': False},
            'hostel': {'required': False},
        }

    def get_approved_by_name(self, obj):
        if not obj.approved_by:
            return None
        return obj.approved_by.get_full_name() or obj.approved_by.username

class VisitorLogSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.student_name')
    student_room = serializers.ReadOnlyField(source='student.room.no')
    hostel_name = serializers.ReadOnlyField(source='student.room.hostel.name')
    status = serializers.SerializerMethodField()

    class Meta:
        model = VisitorLog
        fields = '__all__'
        extra_kwargs = {
            'recorded_by': {'required': False},
        }

    def get_status(self, obj):
        return 'CHECKED_OUT' if obj.check_out_time else 'CHECKED_IN'
