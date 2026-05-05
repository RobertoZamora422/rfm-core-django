import os

from django.contrib import admin
from django.urls import include, path
from django.views.generic import RedirectView

FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://127.0.0.1:5173').rstrip('/')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('negocio.urls')),
    path('', RedirectView.as_view(url=f'{FRONTEND_URL}/', permanent=False), name='frontend-root'),
    path('login/', RedirectView.as_view(url=f'{FRONTEND_URL}/login', permanent=False), name='frontend-login'),
    path('pre-cotizacion/', RedirectView.as_view(url=f'{FRONTEND_URL}/pre-cotizacion', permanent=False), name='frontend-pre-cotizacion'),
]
