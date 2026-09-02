from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    HostelViewSet, 
    HostelRoomViewSet, 
    HostelWardenViewSet, 
    HostelCaretakerViewSet, 
    HostelCourseViewSet,
    DashboardStatsView,
    HostelManagementInitView,
    HostelRoomsByIdView,
    StaffEnrollmentView
)
from apps.student.views import HostelStudentViewSet, HostelOutsideStudentViewSet
from apps.mess.views import MealTypeViewSet, MenuItemViewSet, MenuViewSet
from apps.warden.views import HostelIssueViewSet
from apps.security.views import GatePassRequestViewSet, VisitorLogViewSet

router = DefaultRouter()
router.register(r'hostels', HostelViewSet, basename='hostel')
router.register(r'rooms', HostelRoomViewSet, basename='room')
router.register(r'students', HostelStudentViewSet, basename='student')
router.register(r'outside-students', HostelOutsideStudentViewSet, basename='outside-student')
router.register(r'wardens', HostelWardenViewSet, basename='warden')
router.register(r'caretakers', HostelCaretakerViewSet, basename='caretaker')
router.register(r'courses', HostelCourseViewSet, basename='course')
router.register(r'meal-types', MealTypeViewSet, basename='meal-type')
router.register(r'menu-items', MenuItemViewSet, basename='menu-item')
router.register(r'menus', MenuViewSet, basename='menu')
router.register(r'issues', HostelIssueViewSet, basename='issue')
router.register(r'gate-passes', GatePassRequestViewSet, basename='gate-pass')
router.register(r'visitor-logs', VisitorLogViewSet, basename='visitor-log')

urlpatterns = [
    path('dashboard/stats/', DashboardStatsView.as_view(), name='dashboard-stats'),
    path('hostels/details/', HostelManagementInitView.as_view(), name='hostels-details'),
    path('hostels/<int:hostel_id>/rooms/', HostelRoomsByIdView.as_view(), name='hostel-rooms'),
    path('staff/enrollment/', StaffEnrollmentView.as_view(), name='staff-enrollment'),
    path('', include(router.urls)),
]
