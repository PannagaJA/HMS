from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import HostelStudentViewSet, HostelOutsideStudentViewSet

router = DefaultRouter()
router.register(r'students', HostelStudentViewSet, basename='student')
router.register(r'outside-students', HostelOutsideStudentViewSet, basename='outside-student')

urlpatterns = [
    path('', include(router.urls)),
]
