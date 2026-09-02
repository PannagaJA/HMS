from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from django.db.models import Q
from .models import HostelIssue, IssueUpdate
from .serializers import HostelIssueSerializer, IssueUpdateSerializer
from apps.student.models import HostelStudent
from apps.student.serializers import HostelStudentSerializer
from apps.security.models import GatePassRequest, VisitorLog
from apps.security.serializers import GatePassRequestSerializer, VisitorLogSerializer
from apps.hms_admin.models import Hostel, HostelRoom
from apps.hms_admin.serializers import HostelRoomSerializer

def get_warden_hostels(user):
    hostels = Hostel.objects.filter(warden__user=user)
    if not hostels.exists():
        hostels = Hostel.objects.all()
    return hostels

class WardenDashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        user = request.user
        hostels = get_warden_hostels(user)
        hostel_ids = hostels.values_list('id', flat=True)

        total_residents = HostelStudent.objects.filter(room__hostel_id__in=hostel_ids, room_allotted=True).count()
        pending_gate_passes = GatePassRequest.objects.filter(hostel_id__in=hostel_ids, status='pending').count()
        open_issues = HostelIssue.objects.filter(hostel_id__in=hostel_ids).exclude(status='completed').count()

        rooms = HostelRoom.objects.filter(hostel_id__in=hostel_ids)
        total_capacity = sum(r.capacity for r in rooms) or 1
        occupied = sum(r.occupants.count() for r in rooms)

        return Response({
            'managed_hostels': [{'id': h.id, 'name': h.name, 'gender': h.gender, 'floors': getattr(h, 'floors', 4)} for h in hostels],
            'total_residents': total_residents,
            'total_rooms': rooms.count(),
            'total_capacity': total_capacity,
            'pending_gate_passes': pending_gate_passes,
            'open_issues': open_issues,
            'occupancy_rate': round((occupied / total_capacity) * 100, 1),
        })

class WardenStudentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = HostelStudentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        hostels = get_warden_hostels(user)
        hostel_ids = hostels.values_list('id', flat=True)
        queryset = HostelStudent.objects.filter(room__hostel_id__in=hostel_ids).select_related('room', 'room__hostel')

        hostel_filter = self.request.query_params.get('hostel_id')
        if hostel_filter:
            queryset = queryset.filter(room__hostel_id=hostel_filter)

        floor_filter = self.request.query_params.get('floor')
        if floor_filter and floor_filter != 'all':
            queryset = queryset.filter(room__floor=floor_filter)

        search_query = self.request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(
                Q(student_name__icontains=search_query) |
                Q(enrollment_no__icontains=search_query) |
                Q(room__no__icontains=search_query) |
                Q(guardian_phone__icontains=search_query)
            )

        return queryset.order_by('student_name')

class WardenRoomViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = HostelRoomSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        hostels = get_warden_hostels(user)
        hostel_ids = hostels.values_list('id', flat=True)
        queryset = HostelRoom.objects.filter(hostel_id__in=hostel_ids).prefetch_related('occupants')

        hostel_filter = self.request.query_params.get('hostel_id')
        if hostel_filter:
            queryset = queryset.filter(hostel_id=hostel_filter)

        floor_filter = self.request.query_params.get('floor')
        if floor_filter and floor_filter != 'all':
            queryset = queryset.filter(floor=floor_filter)

        return queryset.order_by('floor', 'no')

class WardenVisitorLogViewSet(viewsets.ModelViewSet):
    serializer_class = VisitorLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        hostels = get_warden_hostels(user)
        hostel_ids = hostels.values_list('id', flat=True)
        queryset = VisitorLog.objects.filter(hostel_id__in=hostel_ids).select_related('student', 'hostel')

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(visitor_name__icontains=search) |
                Q(student__student_name__icontains=search) |
                Q(mobile_number__icontains=search)
            )
        return queryset.order_by('-check_in_time')

    @action(detail=True, methods=['post'])
    def checkout(self, request, pk=None):
        log = self.get_object()
        if log.check_out_time:
            return Response({'error': 'Visitor already checked out'}, status=status.HTTP_400_BAD_REQUEST)
        log.check_out_time = timezone.now()
        log.save()
        return Response(VisitorLogSerializer(log).data)

class HostelIssueViewSet(viewsets.ModelViewSet):
    queryset = HostelIssue.objects.all().select_related('student', 'hostel', 'room').prefetch_related('updates')
    serializer_class = HostelIssueSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        hostels = get_warden_hostels(user)
        hostel_ids = hostels.values_list('id', flat=True)
        queryset = HostelIssue.objects.filter(hostel_id__in=hostel_ids).select_related('student', 'hostel', 'room').prefetch_related('updates')

        status_filter = self.request.query_params.get('status')
        if status_filter and status_filter != 'all':
            queryset = queryset.filter(status=status_filter)

        category_filter = self.request.query_params.get('category')
        if category_filter and category_filter != 'all':
            queryset = queryset.filter(category=category_filter)

        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(title__icontains=search) |
                Q(description__icontains=search) |
                Q(student__student_name__icontains=search)
            )

        return queryset.order_by('-created_at')

    def perform_create(self, serializer):
        student = HostelStudent.objects.filter(user=self.request.user).first()
        if student and student.room:
            serializer.save(
                student=student,
                hostel=student.room.hostel,
                room=student.room
            )
        else:
            serializer.save()

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def update_status(self, request, pk=None):
        issue = self.get_object()
        new_status = request.data.get('status')
        note = request.data.get('note', '')

        if new_status not in [c[0] for c in HostelIssue.STATUS_CHOICES]:
            return Response({'error': 'Invalid status'}, status=status.HTTP_400_BAD_REQUEST)

        old_status = issue.status
        issue.status = new_status
        if new_status == 'completed':
            issue.resolved_at = timezone.now()
        issue.save()

        IssueUpdate.objects.create(
            issue=issue,
            old_status=old_status,
            new_status=new_status,
            note=note,
            updated_by=request.user
        )

        return Response(HostelIssueSerializer(issue).data)
