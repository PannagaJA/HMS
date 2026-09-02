from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.core.permissions import IsHMSAdmin
from .models import Hostel, HostelRoom, HostelCourse, HostelWarden, HostelCaretaker
from .serializers import (
    HostelSerializer, HostelRoomSerializer, HostelCourseSerializer,
    HostelWardenSerializer, HostelCaretakerSerializer
)
from apps.student.models import HostelStudent
from apps.security.models import GatePassRequest
from apps.warden.models import HostelIssue

class HostelViewSet(viewsets.ModelViewSet):
    queryset = Hostel.objects.all().prefetch_related('rooms', 'rooms__occupants')
    serializer_class = HostelSerializer
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def dashboard_stats(self, request):
        total_hostels = Hostel.objects.count()
        total_rooms = HostelRoom.objects.count()
        total_students = HostelStudent.objects.count()
        allocated_students = HostelStudent.objects.filter(room_allotted=True).count()
        
        # Calculate total capacity
        rooms = HostelRoom.objects.all()
        total_capacity = sum(r.capacity for r in rooms) or 1
        occupied_beds = sum(r.occupants.count() for r in rooms)
        occupancy_rate = round((occupied_beds / total_capacity) * 100, 1)

        pending_gate_passes = GatePassRequest.objects.filter(status='pending').count()
        active_issues = HostelIssue.objects.exclude(status='completed').count()

        return Response({
            'total_hostels': total_hostels,
            'total_rooms': total_rooms,
            'total_students': total_students,
            'total_capacity': total_capacity,
            'occupied_beds': occupied_beds,
            'vacant_beds': max(0, total_capacity - occupied_beds),
            'occupancy_rate': occupancy_rate,
            'pending_gate_passes': pending_gate_passes,
            'active_issues': active_issues,
        })

class HostelRoomViewSet(viewsets.ModelViewSet):
    queryset = HostelRoom.objects.all().select_related('hostel').prefetch_related('occupants')
    serializer_class = HostelRoomSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['hostel', 'floor', 'room_type', 'vacant']

    @action(detail=False, methods=['post'], permission_classes=[IsHMSAdmin])
    def bulk_create_rooms(self, request):
        hostel_id = request.data.get('hostel_id')
        floor = request.data.get('floor', 0)
        start_no = int(request.data.get('start_no', 101))
        count = int(request.data.get('count', 10))
        capacity = int(request.data.get('capacity', 2))
        room_type = request.data.get('room_type', 'D')

        try:
            hostel = Hostel.objects.get(id=hostel_id)
        except Hostel.DoesNotExist:
            return Response({'error': 'Hostel not found'}, status=status.HTTP_404_NOT_FOUND)

        created_rooms = []
        for i in range(count):
            r_no = str(start_no + i)
            room, _ = HostelRoom.objects.get_or_create(
                hostel=hostel,
                no=r_no,
                defaults={
                    'name': f"Room {r_no}",
                    'floor': floor,
                    'capacity': capacity,
                    'room_type': room_type,
                    'vacant': True
                }
            )
            created_rooms.append(room)

        serializer = HostelRoomSerializer(created_rooms, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

class HostelCourseViewSet(viewsets.ModelViewSet):
    queryset = HostelCourse.objects.all()
    serializer_class = HostelCourseSerializer
    permission_classes = [permissions.IsAuthenticated]

class HostelWardenViewSet(viewsets.ModelViewSet):
    queryset = HostelWarden.objects.all()
    serializer_class = HostelWardenSerializer
    permission_classes = [permissions.IsAuthenticated]

class HostelCaretakerViewSet(viewsets.ModelViewSet):
    queryset = HostelCaretaker.objects.all()
    serializer_class = HostelCaretakerSerializer
    permission_classes = [permissions.IsAuthenticated]
