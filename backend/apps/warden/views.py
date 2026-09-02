from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import HostelIssue, IssueUpdate
from .serializers import HostelIssueSerializer, IssueUpdateSerializer
from apps.student.models import HostelStudent
from apps.security.models import GatePassRequest
from apps.security.serializers import GatePassRequestSerializer
from apps.hms_admin.models import Hostel, HostelRoom

class WardenDashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def overview(self, request):
        user = request.user
        # Find hostels assigned to this warden
        hostels = Hostel.objects.filter(warden__user=user)
        if not hostels.exists():
            hostels = Hostel.objects.all()

        hostel_ids = hostels.values_list('id', flat=True)
        total_residents = HostelStudent.objects.filter(room__hostel_id__in=hostel_ids, room_allotted=True).count()
        pending_gate_passes = GatePassRequest.objects.filter(hostel_id__in=hostel_ids, status='pending').count()
        open_issues = HostelIssue.objects.filter(hostel_id__in=hostel_ids).exclude(status='completed').count()

        rooms = HostelRoom.objects.filter(hostel_id__in=hostel_ids)
        total_capacity = sum(r.capacity for r in rooms) or 1
        occupied = sum(r.occupants.count() for r in rooms)

        return Response({
            'managed_hostels': [{'id': h.id, 'name': h.name} for h in hostels],
            'total_residents': total_residents,
            'pending_gate_passes': pending_gate_passes,
            'open_issues': open_issues,
            'occupancy_rate': round((occupied / total_capacity) * 100, 1),
        })

class HostelIssueViewSet(viewsets.ModelViewSet):
    queryset = HostelIssue.objects.all().select_related('student', 'hostel', 'room').prefetch_related('updates')
    serializer_class = HostelIssueSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['hostel', 'status', 'category']
    search_fields = ['title', 'description', 'student__student_name']

    def perform_create(self, serializer):
        student = HostelStudent.objects.get(user=self.request.user)
        serializer.save(
            student=student,
            hostel=student.room.hostel,
            room=student.room
        )

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
