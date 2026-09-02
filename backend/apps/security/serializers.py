from rest_framework import serializers
from .models import GatePassRequest, VisitorLog

class GatePassRequestSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.student_name')
    enrollment_no = serializers.ReadOnlyField(source='student.enrollment_no')
    hostel_name = serializers.ReadOnlyField(source='student.room.hostel.name')
    room_no = serializers.ReadOnlyField(source='student.room.no')
    approved_by_name = serializers.ReadOnlyField(source='approved_by.name')

    class Meta:
        model = GatePassRequest
        fields = '__all__'

class VisitorLogSerializer(serializers.ModelSerializer):
    student_name = serializers.ReadOnlyField(source='student.student_name')
    student_room = serializers.ReadOnlyField(source='student.room.no')
    status = serializers.SerializerMethodField()

    class Meta:
        model = VisitorLog
        fields = '__all__'

    def get_status(self, obj):
        return 'CHECKED_OUT' if obj.check_out_time else 'CHECKED_IN'
