from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.utils import timezone
from .models import GatePassRequest, VisitorLog
from .serializers import GatePassRequestSerializer, VisitorLogSerializer
from apps.student.models import HostelStudent
from apps.core.permissions import IsHMSAdmin, IsWarden, IsSecurity, IsStudent

class GatePassRequestViewSet(viewsets.ModelViewSet):
    queryset = GatePassRequest.objects.all().select_related('student', 'hostel', 'student__room').order_by('-created_at')
    serializer_class = GatePassRequestSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['status', 'pass_type', 'hostel']
    search_fields = ['student__student_name', 'student__enrollment_no', 'reason']

    def perform_create(self, serializer):
        student = HostelStudent.objects.get(user=self.request.user)
        serializer.save(student=student, hostel=student.room.hostel)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_passes(self, request):
        try:
            student = HostelStudent.objects.get(user=request.user)
            passes = GatePassRequest.objects.filter(student=student).order_by('-created_at')
            return Response(GatePassRequestSerializer(passes, many=True).data)
        except HostelStudent.DoesNotExist:
            return Response({'error': 'Student record not found'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def warden_action(self, request, pk=None):
        if not (request.user.role in ['ADMIN', 'WARDEN'] or request.user.is_superuser):
            return Response({'error': 'Only Wardens or Admins can action gate passes'}, status=status.HTTP_403_FORBIDDEN)

        pass_req = self.get_object()
        action_type = request.data.get('action') # 'approve' or 'reject'
        note = request.data.get('note', '')

        if action_type == 'approve':
            pass_req.status = 'approved'
        elif action_type == 'reject':
            pass_req.status = 'rejected'
        else:
            return Response({'error': 'Action must be approve or reject'}, status=status.HTTP_400_BAD_REQUEST)

        pass_req.approved_by = request.user
        pass_req.action_note = note
        pass_req.actioned_at = timezone.now()
        pass_req.save()

        return Response(GatePassRequestSerializer(pass_req).data)

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def verify_token(self, request):
        token_or_code = request.query_params.get('code')
        if not token_or_code:
            return Response({'error': 'Token or student enrollment code required'}, status=status.HTTP_400_BAD_REQUEST)

        # Search by UUID token or enrollment number
        pass_req = GatePassRequest.objects.filter(
            token=token_or_code
        ).select_related('student', 'hostel', 'student__room').first()

        if not pass_req:
            pass_req = GatePassRequest.objects.filter(
                student__enrollment_no=token_or_code,
                status='approved'
            ).select_related('student', 'hostel', 'student__room').order_by('-created_at').first()

        if not pass_req:
            return Response({'valid': False, 'message': 'No approved active pass found for this code.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'valid': pass_req.status == 'approved',
            'pass': GatePassRequestSerializer(pass_req).data
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def log_movement(self, request, pk=None):
        pass_req = self.get_object()
        movement_type = request.data.get('movement_type') # 'EXIT' or 'ENTRY'

        now = timezone.now()
        pass_req.security_guard = request.user

        if movement_type == 'EXIT':
            pass_req.actual_exit_time = now
            pass_req.save()
            return Response({'message': 'Exit timestamp logged successfully', 'pass': GatePassRequestSerializer(pass_req).data})
        elif movement_type == 'ENTRY':
            pass_req.actual_entry_time = now
            pass_req.status = 'completed'
            # Check if overdue
            # expected return comparison
            pass_req.save()
            return Response({'message': 'Return entry timestamp logged successfully', 'pass': GatePassRequestSerializer(pass_req).data})
        else:
            return Response({'error': 'Invalid movement type. Use EXIT or ENTRY.'}, status=status.HTTP_400_BAD_REQUEST)

class VisitorLogViewSet(viewsets.ModelViewSet):
    queryset = VisitorLog.objects.all().select_related('student', 'hostel').order_by('-check_in_time')
    serializer_class = VisitorLogSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['hostel', 'student']
    search_fields = ['visitor_name', 'mobile_number', 'student__student_name']

    def perform_create(self, serializer):
        serializer.save(recorded_by=self.request.user)

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def check_out(self, request, pk=None):
        visitor = self.get_object()
        visitor.check_out_time = timezone.now()
        visitor.save()
        return Response(VisitorLogSerializer(visitor).data)

class SecurityDashboardViewSet(viewsets.ViewSet):
    permission_classes = [permissions.IsAuthenticated]

    @action(detail=False, methods=['get'])
    def metrics(self, request):
        today = timezone.now().date()
        today_exits = GatePassRequest.objects.filter(actual_exit_time__date=today).count()
        today_entries = GatePassRequest.objects.filter(actual_entry_time__date=today).count()
        currently_outside = GatePassRequest.objects.filter(
            actual_exit_time__isnull=False,
            actual_entry_time__isnull=True,
            status__in=['approved', 'pending']
        ).count()
        total_visitors_today = VisitorLog.objects.filter(check_in_time__date=today).count()

        return Response({
            'today_exits': today_exits,
            'today_entries': today_entries,
            'currently_outside': currently_outside,
            'total_visitors_today': total_visitors_today,
        })
