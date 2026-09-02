from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Core Authentication & Profile
    path('api/auth/', include('apps.authentication.urls')),
    
    # Unified HMS Router (Matching Reference System Architecture)
    path('api/hms/', include('apps.hms_admin.urls')),
    
    # Individual App Namespaces (For Direct Module Access)
    path('api/student/', include('apps.student.urls')),
    path('api/warden/', include('apps.warden.urls')),
    path('api/security/', include('apps.security.urls')),
    path('api/mess/', include('apps.mess.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
