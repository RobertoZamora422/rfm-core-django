from django.contrib import admin

from .models import (
    Cliente,
    ConfiguracionNegocio,
    Contrato,
    CostoDirecto,
    Cotizacion,
    GastoFijoMensual,
    Paquete,
    TipoEvento,
)


@admin.register(TipoEvento)
class TipoEventoAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'activo')
    search_fields = ('nombre',)
    list_filter = ('activo',)


@admin.register(Cliente)
class ClienteAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'telefono', 'correo', 'fecha_registro')
    search_fields = ('nombre', 'telefono', 'correo')


@admin.register(Paquete)
class PaqueteAdmin(admin.ModelAdmin):
    list_display = ('nombre', 'precio_por_persona', 'tipo_servicio', 'activo')
    search_fields = ('nombre',)
    list_filter = ('activo', 'tipo_servicio')


@admin.register(Cotizacion)
class CotizacionAdmin(admin.ModelAdmin):
    list_display = ('id', 'cliente', 'tipo_evento', 'tipo_servicio', 'monto_estimado', 'estado', 'fecha_registro')
    list_filter = ('estado', 'tipo_servicio', 'tipo_evento')
    search_fields = ('cliente__nombre', 'cliente__telefono')


class CostoDirectoInline(admin.TabularInline):
    model = CostoDirecto
    extra = 0


@admin.register(Contrato)
class ContratoAdmin(admin.ModelAdmin):
    list_display = ('id', 'cotizacion', 'fecha_evento', 'valor_final', 'estado_contrato', 'estado_pago', 'monto_abonado')
    list_filter = ('estado_contrato', 'estado_pago', 'fecha_evento')
    search_fields = ('cotizacion__cliente__nombre',)
    inlines = [CostoDirectoInline]


@admin.register(CostoDirecto)
class CostoDirectoAdmin(admin.ModelAdmin):
    list_display = ('concepto', 'contrato', 'valor', 'fecha_registro')
    search_fields = ('concepto', 'contrato__cotizacion__cliente__nombre')


@admin.register(GastoFijoMensual)
class GastoFijoMensualAdmin(admin.ModelAdmin):
    list_display = ('concepto', 'mes', 'anio', 'valor')
    list_filter = ('anio', 'mes')
    search_fields = ('concepto',)


@admin.register(ConfiguracionNegocio)
class ConfiguracionNegocioAdmin(admin.ModelAdmin):
    list_display = ('nombre_negocio', 'whatsapp', 'tarifa_base_alquiler', 'invitados_incluidos')

# Register your models here.
