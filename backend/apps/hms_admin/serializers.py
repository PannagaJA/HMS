from rest_framework import serializers
from .models import Hostel, HostelRoom, HostelWarden, HostelCaretaker, HostelCourse

class HostelWardenSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelWarden
        fields = '__all__'

class HostelCaretakerSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelCaretaker
        fields = '__all__'

class HostelCourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = HostelCourse
        fields = '__all__'

class HostelRoomSerializer(serializers.ModelSerializer):
    hostel_name = serializers.ReadOnlyField(source='hostel.name')
    occupied_count = serializers.SerializerMethodField()
    room_type_display = serializers.SerializerMethodField()

    class Meta:
        model = HostelRoom
        fields = '__all__'

    def get_occupied_count(self, obj):
        return obj.occupants.count() + getattr(obj, 'outside_occupants', []).count()

    def get_room_type_display(self, obj):
        type_map = {
            'S': 'Single Room',
            'D': 'Double Sharing',
            'T': 'Triple Sharing',
            'P': 'Scholar / Research Room',
            'B': 'Both / Custom'
        }
        return type_map.get(obj.room_type, 'Standard')

class HostelSerializer(serializers.ModelSerializer):
    warden_detail = HostelWardenSerializer(source='warden', read_only=True)
    caretaker_detail = HostelCaretakerSerializer(source='caretaker', read_only=True)
    total_rooms = serializers.SerializerMethodField()
    total_capacity = serializers.SerializerMethodField()
    occupied_beds = serializers.SerializerMethodField()
    occupancy_rate = serializers.SerializerMethodField()

    class Meta:
        model = Hostel
        fields = '__all__'

    def get_total_rooms(self, obj):
        return obj.rooms.count()

    def get_total_capacity(self, obj):
        return sum(r.capacity for r in obj.rooms.all())

    def get_occupied_beds(self, obj):
        return sum(r.occupants.count() + getattr(r, 'outside_occupants', []).count() for r in obj.rooms.all())

    def get_occupancy_rate(self, obj):
        cap = self.get_total_capacity(obj)
        occ = self.get_occupied_beds(obj)
        return round((occ / cap * 100), 1) if cap > 0 else 0
