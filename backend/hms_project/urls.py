from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Modular Role APIs
    path('api/auth/', include('apps.authentication.urls')),
    path('api/hms/', include('apps.hms_admin.urls')),
    path('api/warden/', include('apps.warden.urls')),
    path('api/security/', include('apps.security.urls')),
    path('api/student/', include('apps.student.urls')),
    path('api/mess/', include('apps.mess.urls')),
]
