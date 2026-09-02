from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from .serializers import CustomTokenObtainPairSerializer, UserSerializer
from apps.hms_admin.models import HostelWarden, HostelCaretaker
from apps.student.models import HostelStudent

User = get_user_model()

class CustomTokenObtainPairView(TokenObtainPairView):
    serializer_class = CustomTokenObtainPairSerializer

class LogoutView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            return Response({'success': True, 'message': 'Successfully logged out and token blacklisted.'}, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

class CurrentUserProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        serializer = UserSerializer(user, data=request.data, partial=True)
        if serializer.is_valid():
            updated_user = serializer.save()

            # Synchronize full name and phone across domain profile records
            full_name = f"{updated_user.first_name} {updated_user.last_name}".strip() or updated_user.username

            if updated_user.role == 'WARDEN':
                HostelWarden.objects.filter(user=updated_user).update(
                    name=full_name,
                    phone=updated_user.phone or '',
                    email=updated_user.email or ''
                )
            elif updated_user.role == 'SECURITY':
                HostelCaretaker.objects.filter(user=updated_user).update(
                    name=full_name,
                    phone=updated_user.phone or '',
                    email=updated_user.email or ''
                )
            elif updated_user.role == 'STUDENT':
                HostelStudent.objects.filter(user=updated_user).update(
                    student_name=full_name
                )

            return Response(UserSerializer(updated_user).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        # Change Password handling
        user = request.user
        current_password = request.data.get('current_password')
        new_password = request.data.get('new_password')

        if not current_password or not new_password:
            return Response({'message': 'Both current and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if not check_password(current_password, user.password):
            return Response({'message': 'Current password is incorrect.'}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 6:
            return Response({'message': 'New password must be at least 6 characters.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({'message': 'Password updated successfully.'}, status=status.HTTP_200_OK)
