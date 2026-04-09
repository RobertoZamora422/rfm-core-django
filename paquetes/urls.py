from django.urls import path
from .views import (
    PaqueteListView,
    PaqueteCreateView,
    PaqueteUpdateView,
    PaqueteDeleteView,
)

urlpatterns = [
    path('', PaqueteListView.as_view(), name='lista_paquetes'),
    path('nuevo/', PaqueteCreateView.as_view(), name='crear_paquete'),
    path('editar/<int:pk>/', PaqueteUpdateView.as_view(), name='editar_paquete'),
    path('eliminar/<int:pk>/', PaqueteDeleteView.as_view(), name='eliminar_paquete'),
]