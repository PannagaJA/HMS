from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import GatePassRequestViewSet, VisitorLogViewSet, SecurityDashboardViewSet

router = DefaultRouter()
router.register(r'gate-passes', GatePassRequestViewSet, basename='gatepass')
router.register(r'visitors', VisitorLogViewSet, basename='visitor')

urlpatterns = [
    path('dashboard/metrics/', SecurityDashboardViewSet.as_view({'get': 'metrics'}), name='security_metrics'),
    path('', include(router.urls)),
]
