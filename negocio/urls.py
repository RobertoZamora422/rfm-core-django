from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    ClienteViewSet,
    ConfiguracionAPIView,
    ContratoViewSet,
    CostoDirectoViewSet,
    CotizacionViewSet,
    DashboardFinancieroAPIView,
    GastoFijoMensualViewSet,
    LoginAPIView,
    LogoutAPIView,
    MeAPIView,
    PaqueteViewSet,
    PreCotizacionAPIView,
    ReporteComercialAPIView,
    ReporteEventosAPIView,
    ReporteFinancieroAPIView,
    ReportePaquetesAPIView,
    TipoEventoViewSet,
)

router = DefaultRouter()
router.register('tipos-evento', TipoEventoViewSet, basename='tipo-evento')
router.register('clientes', ClienteViewSet, basename='cliente')
router.register('paquetes', PaqueteViewSet, basename='paquete')
router.register('cotizaciones', CotizacionViewSet, basename='cotizacion')
router.register('contratos', ContratoViewSet, basename='contrato')
router.register('costos-directos', CostoDirectoViewSet, basename='costo-directo')
router.register('gastos-fijos', GastoFijoMensualViewSet, basename='gasto-fijo')

urlpatterns = [
    path('auth/login/', LoginAPIView.as_view(), name='api-login'),
    path('auth/logout/', LogoutAPIView.as_view(), name='api-logout'),
    path('auth/me/', MeAPIView.as_view(), name='api-me'),
    path('pre-cotizacion/', PreCotizacionAPIView.as_view(), name='api-pre-cotizacion'),
    path('dashboard-financiero/', DashboardFinancieroAPIView.as_view(), name='api-dashboard-financiero'),
    path('reportes/financiero/', ReporteFinancieroAPIView.as_view(), name='api-reporte-financiero'),
    path('reportes/comercial/', ReporteComercialAPIView.as_view(), name='api-reporte-comercial'),
    path('reportes/eventos/', ReporteEventosAPIView.as_view(), name='api-reporte-eventos'),
    path('reportes/paquetes/', ReportePaquetesAPIView.as_view(), name='api-reporte-paquetes'),
    path('configuracion/', ConfiguracionAPIView.as_view(), name='api-configuracion'),
    path('', include(router.urls)),
]
