from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q, Sum
from .models import Hostel, HostelRoom, HostelWarden, HostelCaretaker, HostelCourse
from .serializers import (
    HostelSerializer, 
    HostelRoomSerializer, 
    HostelWardenSerializer, 
    HostelCaretakerSerializer, 
    HostelCourseSerializer
)
from apps.student.models import HostelStudent, HostelOutsideStudent
from apps.warden.models import HostelIssue
from apps.security.models import GatePassRequest

class DashboardStatsView(APIView):
    """
    Get all dashboard statistics in a single optimized database payload.
    Matches DashboardStatsView from reference system.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        hostels = Hostel.objects.select_related('warden', 'caretaker').prefetch_related('rooms', 'rooms__occupants', 'rooms__outside_occupants').all()
        rooms = HostelRoom.objects.select_related('hostel').all()
        students_count = HostelStudent.objects.filter(room_allotted=True).count()
        outside_students_count = HostelOutsideStudent.objects.filter(room_allotted=True).count()
        wardens_count = HostelWarden.objects.count()
        caretakers_count = HostelCaretaker.objects.count()

        total_capacity = sum(r.capacity for r in rooms)
        occupied_beds = students_count + outside_students_count
        occupancy_rate = round((occupied_beds / total_capacity * 100), 1) if total_capacity > 0 else 0
        pending_gate_passes = GatePassRequest.objects.filter(status='pending').count()
        active_issues = HostelIssue.objects.exclude(status='completed').count()

        hostels_serializer = HostelSerializer(hostels, many=True)

        return Response({
            'success': True,
            'hostels': hostels_serializer.data,
            'statistics': {
                'total_hostels': hostels.count(),
                'total_rooms': rooms.count(),
                'total_students': occupied_beds,
                'total_wardens': wardens_count,
                'total_caretakers': caretakers_count,
                'total_capacity': total_capacity,
                'occupied_beds': occupied_beds,
                'vacant_beds': max(0, total_capacity - occupied_beds),
                'occupancy_rate': occupancy_rate,
                'pending_gate_passes': pending_gate_passes,
                'active_issues': active_issues,
            }
        }, status=status.HTTP_200_OK)

class HostelManagementInitView(APIView):
    """
    Initialization payload for hostel management screens.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        hostels = Hostel.objects.select_related('warden', 'caretaker').all()
        wardens = HostelWarden.objects.all()
        caretakers = HostelCaretaker.objects.all()
        courses = HostelCourse.objects.all()

        return Response({
            'success': True,
            'hostels': HostelSerializer(hostels, many=True).data,
            'wardens': HostelWardenSerializer(wardens, many=True).data,
            'caretakers': HostelCaretakerSerializer(caretakers, many=True).data,
            'courses': HostelCourseSerializer(courses, many=True).data,
        })

class HostelRoomsByIdView(APIView):
    """
    Get rooms for a specific hostel.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, hostel_id):
        rooms = HostelRoom.objects.filter(hostel_id=hostel_id).select_related('hostel')
        return Response({
            'success': True,
            'rooms': HostelRoomSerializer(rooms, many=True).data
        })

class StaffEnrollmentView(APIView):
    """
    Get wardens and caretakers for dropdown enrollment.
    """
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        wardens = HostelWarden.objects.all()
        caretakers = HostelCaretaker.objects.all()
        return Response({
            'wardens': HostelWardenSerializer(wardens, many=True).data,
            'caretakers': HostelCaretakerSerializer(caretakers, many=True).data,
        })

class HostelViewSet(viewsets.ModelViewSet):
    queryset = Hostel.objects.all().select_related('warden', 'caretaker').prefetch_related('rooms')
    serializer_class = HostelSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['gender']
    search_fields = ['name', 'address']

    @action(detail=False, methods=['get'])
    def names(self, request):
        """Fast lookup of hostel names & IDs for dropdown selectors"""
        hostels = self.get_queryset().values('id', 'name', 'gender')
        return Response(list(hostels))

class HostelRoomViewSet(viewsets.ModelViewSet):
    queryset = HostelRoom.objects.all().select_related('hostel').prefetch_related('occupants', 'outside_occupants')
    serializer_class = HostelRoomSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['hostel', 'floor', 'vacant', 'room_type']
    search_fields = ['no', 'name']

    @action(detail=False, methods=['get'])
    def floors(self, request):
        """Get unique floor numbers for a hostel"""
        hostel_id = request.query_params.get('hostel')
        if not hostel_id:
            return Response({'error': 'Hostel ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        floors = HostelRoom.objects.filter(hostel_id=hostel_id).values_list('floor', flat=True).distinct().order_by('floor')
        return Response(list(floors))

    @action(detail=False, methods=['get'])
    def by_hostel(self, request):
        """Get all rooms grouped by floor for a hostel matrix"""
        hostel_id = request.query_params.get('hostel')
        if not hostel_id:
            return Response({'error': 'Hostel ID is required'}, status=status.HTTP_400_BAD_REQUEST)
        rooms = self.get_queryset().filter(hostel_id=hostel_id).order_by('floor', 'no')
        return Response(HostelRoomSerializer(rooms, many=True).data)

    @action(detail=False, methods=['post'])
    def bulk_create_rooms(self, request):
        hostel_id = request.data.get('hostel_id')
        floor = request.data.get('floor')
        room_count = request.data.get('room_count', 10)
        capacity = request.data.get('capacity', 2)
        room_type = request.data.get('room_type', 'D')
        prefix = request.data.get('prefix', f'{floor}0')

        if not hostel_id or floor is None:
            return Response({'error': 'Hostel ID and floor are required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            hostel = Hostel.objects.get(id=hostel_id)
        except Hostel.DoesNotExist:
            return Response({'error': 'Hostel not found'}, status=status.HTTP_404_NOT_FOUND)

        created_rooms = []
        for i in range(1, int(room_count) + 1):
            room_no = f"{prefix}{i:02d}"
            room, _ = HostelRoom.objects.get_or_create(
                hostel=hostel,
                no=room_no,
                defaults={
                    'name': f"Room {room_no}",
                    'floor': int(floor),
                    'capacity': int(capacity),
                    'room_type': room_type,
                    'vacant': True
                }
            )
            created_rooms.append(room)

        return Response({
            'message': f"Successfully generated {len(created_rooms)} rooms on Floor {floor} for {hostel.name}",
            'rooms': HostelRoomSerializer(created_rooms, many=True).data
        }, status=status.HTTP_201_CREATED)

class HostelWardenViewSet(viewsets.ModelViewSet):
    queryset = HostelWarden.objects.all()
    serializer_class = HostelWardenSerializer
    permission_classes = [permissions.IsAuthenticated]

class HostelCaretakerViewSet(viewsets.ModelViewSet):
    queryset = HostelCaretaker.objects.all()
    serializer_class = HostelCaretakerSerializer
    permission_classes = [permissions.IsAuthenticated]

class HostelCourseViewSet(viewsets.ModelViewSet):
    queryset = HostelCourse.objects.all()
    serializer_class = HostelCourseSerializer
    permission_classes = [permissions.IsAuthenticated]
