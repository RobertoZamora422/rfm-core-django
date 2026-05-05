from decimal import Decimal

from django.db import models


class TipoEvento(models.Model):
    nombre = models.CharField(max_length=100, unique=True)
    descripcion = models.TextField(blank=True)
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ['nombre']
        verbose_name = 'tipo de evento'
        verbose_name_plural = 'tipos de evento'

    def __str__(self) -> str:
        return self.nombre


class Cliente(models.Model):
    nombre = models.CharField(max_length=150)
    telefono = models.CharField(max_length=20)
    correo = models.EmailField(blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['nombre']

    def __str__(self) -> str:
        return self.nombre


class Paquete(models.Model):
    nombre = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    precio_por_persona = models.DecimalField(max_digits=10, decimal_places=2)
    tipo_servicio = models.CharField(max_length=50, default='Servicio completo')
    activo = models.BooleanField(default=True)

    class Meta:
        ordering = ['precio_por_persona', 'nombre']

    def __str__(self) -> str:
        return self.nombre


class Cotizacion(models.Model):
    ESTADO_NUEVO = 'nuevo'
    ESTADO_CONTACTADO = 'contactado'
    ESTADO_CONFIRMADO = 'confirmado'
    ESTADO_CONVERTIDO = 'convertido'
    ESTADO_DESCARTADO = 'descartado'

    ESTADOS = [
        (ESTADO_NUEVO, 'Nuevo'),
        (ESTADO_CONTACTADO, 'Contactado'),
        (ESTADO_CONFIRMADO, 'Confirmado'),
        (ESTADO_CONVERTIDO, 'Convertido'),
        (ESTADO_DESCARTADO, 'Descartado'),
    ]

    SERVICIO_COMPLETO = 'servicio_completo'
    SERVICIO_ALQUILER = 'alquiler'
    SERVICIO_NO_SEGURO = 'no_seguro'

    TIPOS_SERVICIO = [
        (SERVICIO_COMPLETO, 'Servicio completo'),
        (SERVICIO_ALQUILER, 'Alquiler del local'),
        (SERVICIO_NO_SEGURO, 'Aun no estoy seguro'),
    ]

    cliente = models.ForeignKey(Cliente, on_delete=models.CASCADE, related_name='cotizaciones')
    tipo_evento = models.ForeignKey(TipoEvento, on_delete=models.SET_NULL, null=True, related_name='cotizaciones')
    paquete = models.ForeignKey(Paquete, on_delete=models.SET_NULL, null=True, blank=True, related_name='cotizaciones')
    fecha_tentativa = models.DateField()
    numero_invitados = models.PositiveIntegerField()
    tipo_servicio = models.CharField(max_length=30, choices=TIPOS_SERVICIO)
    monto_estimado = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    estado = models.CharField(max_length=20, choices=ESTADOS, default=ESTADO_NUEVO)
    notas = models.TextField(blank=True)
    ultimo_contacto = models.DateField(null=True, blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_registro']
        verbose_name = 'cotizacion'
        verbose_name_plural = 'cotizaciones'

    def __str__(self) -> str:
        return f'Cotizacion {self.pk} - {self.cliente.nombre}'


class Contrato(models.Model):
    ESTADO_CONFIRMADO = 'confirmado'
    ESTADO_CANCELADO = 'cancelado'

    ESTADOS_CONTRATO = [
        (ESTADO_CONFIRMADO, 'Confirmado'),
        (ESTADO_CANCELADO, 'Cancelado'),
    ]

    PAGO_PENDIENTE = 'pendiente'
    PAGO_ABONADO = 'abonado'
    PAGO_PAGADO = 'pagado'

    ESTADOS_PAGO = [
        (PAGO_PENDIENTE, 'Pendiente'),
        (PAGO_ABONADO, 'Abonado'),
        (PAGO_PAGADO, 'Pagado'),
    ]

    cotizacion = models.OneToOneField(Cotizacion, on_delete=models.CASCADE, related_name='contrato')
    fecha_evento = models.DateField()
    valor_final = models.DecimalField(max_digits=10, decimal_places=2)
    estado_contrato = models.CharField(max_length=20, choices=ESTADOS_CONTRATO, default=ESTADO_CONFIRMADO)
    estado_pago = models.CharField(max_length=20, choices=ESTADOS_PAGO, default=PAGO_PENDIENTE)
    monto_abonado = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    observaciones = models.TextField(blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-fecha_evento']

    def __str__(self) -> str:
        return f'Contrato {self.pk} - {self.cotizacion.cliente.nombre}'

    def total_costos_directos(self) -> Decimal:
        total = self.costos.aggregate(total=models.Sum('valor'))['total']
        return total or Decimal('0.00')

    def utilidad_bruta(self) -> Decimal:
        return self.valor_final - self.total_costos_directos()

    def margen_bruto(self) -> Decimal:
        if not self.valor_final:
            return Decimal('0.00')
        return (self.utilidad_bruta() / self.valor_final) * Decimal('100')

    def saldo_pendiente(self) -> Decimal:
        return self.valor_final - self.monto_abonado


class CostoDirecto(models.Model):
    contrato = models.ForeignKey(Contrato, on_delete=models.CASCADE, related_name='costos')
    concepto = models.CharField(max_length=100)
    descripcion = models.TextField(blank=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['concepto']
        verbose_name = 'costo directo'
        verbose_name_plural = 'costos directos'

    def __str__(self) -> str:
        return self.concepto


class GastoFijoMensual(models.Model):
    FRECUENCIA_MENSUAL = 'mensual'

    FRECUENCIAS = [
        (FRECUENCIA_MENSUAL, 'Mensual'),
    ]

    anio = models.PositiveIntegerField(null=True, blank=True)
    mes = models.PositiveIntegerField(null=True, blank=True)
    concepto = models.CharField(max_length=100)
    categoria = models.CharField(max_length=80, default='General')
    descripcion = models.TextField(blank=True)
    valor = models.DecimalField(max_digits=10, decimal_places=2)
    frecuencia = models.CharField(max_length=20, choices=FRECUENCIAS, default=FRECUENCIA_MENSUAL)
    activo = models.BooleanField(default=True)
    fecha_inicio = models.DateField(null=True, blank=True)
    fecha_fin = models.DateField(null=True, blank=True)
    fecha_registro = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-anio', '-mes', 'concepto']
        verbose_name = 'gasto fijo mensual'
        verbose_name_plural = 'gastos fijos mensuales'

    def __str__(self) -> str:
        periodo = f'{self.mes}/{self.anio}' if self.anio and self.mes else self.frecuencia
        return f'{self.concepto} - {periodo}'


class ConfiguracionNegocio(models.Model):
    nombre_negocio = models.CharField(max_length=150, default='Salon de Eventos')
    whatsapp = models.CharField(max_length=20, default='0991234567')
    correo = models.EmailField(default='contacto@correo.com')
    direccion = models.CharField(max_length=255, blank=True, default='Esmeraldas, Ecuador')
    tarifa_base_alquiler = models.DecimalField(max_digits=10, decimal_places=2, default=350)
    invitados_incluidos = models.PositiveIntegerField(default=100)
    costo_invitado_adicional = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('1.50'))

    class Meta:
        verbose_name = 'configuracion del negocio'
        verbose_name_plural = 'configuraciones del negocio'

    def __str__(self) -> str:
        return self.nombre_negocio

