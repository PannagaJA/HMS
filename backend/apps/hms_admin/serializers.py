from rest_framework import serializers
from .models import Hostel, HostelRoom, HostelCourse, HostelWarden, HostelCaretaker

class HostelCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelCourse
        fields = '__all__'

class HostelWardenSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelWarden
        fields = '__all__'

class HostelCaretakerSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelCaretaker
        fields = '__all__'

class HostelRoomSerializer(serializers.ModelSerializer):
    hostel_name = serializers.ReadOnlyField(source='hostel.name')
    occupied_count = serializers.SerializerMethodField()

    class Meta:
        model = HostelRoom
        fields = '__all__'

    def get_occupied_count(self, obj):
        return obj.occupants.count()

class HostelSerializer(serializers.ModelSerializer):
    warden_detail = HostelWardenSerializer(source='warden', read_only=True)
    caretaker_detail = HostelCaretakerSerializer(source='caretaker', read_only=True)
    total_rooms = serializers.SerializerMethodField()
    total_capacity = serializers.SerializerMethodField()
    occupied_beds = serializers.SerializerMethodField()

    class Meta:
        model = Hostel
        fields = '__all__'

    def get_total_rooms(self, obj):
        return obj.rooms.count()

    def get_total_capacity(self, obj):
        return sum(room.capacity for room in obj.rooms.all())

    def get_occupied_beds(self, obj):
        return sum(room.occupants.count() for room in obj.rooms.all())
