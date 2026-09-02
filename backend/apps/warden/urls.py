from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WardenDashboardViewSet, HostelIssueViewSet

router = DefaultRouter()
router.register(r'issues', HostelIssueViewSet, basename='issue')

urlpatterns = [
    path('dashboard/', WardenDashboardViewSet.as_view({'get': 'overview'}), name='warden_dashboard'),
    path('', include(router.urls)),
]
