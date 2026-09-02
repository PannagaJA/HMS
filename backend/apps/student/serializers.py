from rest_framework import serializers
from .models import HostelStudent, HostelOutsideStudent
from apps.hms_admin.serializers import HostelRoomSerializer

class HostelStudentSerializer(serializers.ModelSerializer):
    room_detail = HostelRoomSerializer(source='room', read_only=True)
    hostel_id = serializers.ReadOnlyField(source='room.hostel.id')
    hostel_name = serializers.ReadOnlyField(source='room.hostel.name')

    class Meta:
        model = HostelStudent
        fields = '__all__'

class HostelOutsideStudentSerializer(serializers.ModelSerializer):
    room_detail = HostelRoomSerializer(source='room', read_only=True)
    hostel_name = serializers.ReadOnlyField(source='hostel.name')
    room_no = serializers.ReadOnlyField(source='room.no')

    class Meta:
        model = HostelOutsideStudent
        fields = '__all__'

class StudentRoomAllocationSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    room_id = serializers.IntegerField()
    bed_number = serializers.CharField(max_length=10, required=False, default='1')
    is_outside = serializers.BooleanField(required=False, default=False)
