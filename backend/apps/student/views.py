from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import HostelStudent, HostelOutsideStudent
from .serializers import (
    HostelStudentSerializer, 
    HostelOutsideStudentSerializer, 
    StudentRoomAllocationSerializer
)
from apps.hms_admin.models import HostelRoom
from apps.core.permissions import IsHMSAdmin, IsWarden, IsStudent

class HostelStudentViewSet(viewsets.ModelViewSet):
    queryset = HostelStudent.objects.all().select_related('user', 'room', 'room__hostel', 'course')
    serializer_class = HostelStudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['gender', 'room_allotted', 'no_dues', 'room__hostel']
    search_fields = ['student_name', 'enrollment_no', 'father_name']

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def my_profile(self, request):
        try:
            student = HostelStudent.objects.select_related('room', 'room__hostel', 'course').get(user=request.user)
            serializer = HostelStudentSerializer(student)
            
            roommates = []
            if student.room:
                roommate_qs = HostelStudent.objects.filter(room=student.room).exclude(id=student.id)
                roommates = HostelStudentSerializer(roommate_qs, many=True).data

            return Response({
                'profile': serializer.data,
                'roommates': roommates,
            })
        except HostelStudent.DoesNotExist:
            return Response({'error': 'No student profile found for this user account'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def allocate_room(self, request):
        if not (request.user.role in ['ADMIN', 'WARDEN'] or request.user.is_superuser):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        serializer = StudentRoomAllocationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        student_id = serializer.validated_data['student_id']
        room_id = serializer.validated_data['room_id']
        bed_no = serializer.validated_data.get('bed_number', '1')
        is_outside = serializer.validated_data.get('is_outside', False)

        try:
            room = HostelRoom.objects.get(id=room_id)
            if is_outside:
                student = HostelOutsideStudent.objects.get(id=student_id)
            else:
                student = HostelStudent.objects.get(id=student_id)
        except (HostelStudent.DoesNotExist, HostelOutsideStudent.DoesNotExist, HostelRoom.DoesNotExist):
            return Response({'error': 'Student or Room not found'}, status=status.HTTP_404_NOT_FOUND)

        current_occupants = room.occupants.count() + room.outside_occupants.count()
        if current_occupants >= room.capacity:
            return Response({'error': f'Room {room.no} is already at full capacity ({room.capacity})'}, status=status.HTTP_400_BAD_REQUEST)

        student.room = room
        student.bed_number = bed_no
        student.room_allotted = True
        student.save()

        if (room.occupants.count() + room.outside_occupants.count()) >= room.capacity:
            room.vacant = False
            room.save()

        return Response({
            'message': f"Resident allocated to Room {room.no} (Bed {bed_no})",
        })

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def vacate_room(self, request, pk=None):
        if not (request.user.role in ['ADMIN', 'WARDEN'] or request.user.is_superuser):
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        student = self.get_object()
        room = student.room
        student.room = None
        student.bed_number = None
        student.room_allotted = False
        student.save()

        if room:
            room.vacant = True
            room.save()

        return Response({'message': f"Student {student.student_name} vacated successfully."})

class HostelOutsideStudentViewSet(viewsets.ModelViewSet):
    queryset = HostelOutsideStudent.objects.all().select_related('hostel', 'room')
    serializer_class = HostelOutsideStudentSerializer
    permission_classes = [permissions.IsAuthenticated]
    filterset_fields = ['hostel', 'gender', 'room_allotted', 'outside_college_name']
    search_fields = ['name', 'usn', 'outside_college_name', 'phone']
