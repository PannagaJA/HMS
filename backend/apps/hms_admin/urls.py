from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    HostelViewSet, HostelRoomViewSet, HostelCourseViewSet,
    HostelWardenViewSet, HostelCaretakerViewSet
)

router = DefaultRouter()
router.register(r'hostels', HostelViewSet, basename='hostel')
router.register(r'rooms', HostelRoomViewSet, basename='room')
router.register(r'courses', HostelCourseViewSet, basename='course')
router.register(r'wardens', HostelWardenViewSet, basename='warden')
router.register(r'caretakers', HostelCaretakerViewSet, basename='caretaker')

urlpatterns = [
    path('', include(router.urls)),
]
