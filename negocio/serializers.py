from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework import serializers

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


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'is_staff')


class TipoEventoSerializer(serializers.ModelSerializer):
    class Meta:
        model = TipoEvento
        fields = '__all__'

    def validate_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError('El nombre del tipo de evento es obligatorio.')
        return value.strip()


class ClienteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cliente
        fields = '__all__'
        read_only_fields = ('fecha_registro',)

    def validate_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError('El nombre del cliente es obligatorio.')
        return value.strip()

    def validate_telefono(self, value):
        digits = ''.join(char for char in str(value or '') if char.isdigit())
        if len(digits) < 7:
            raise serializers.ValidationError('El teléfono debe tener al menos 7 dígitos.')
        return value.strip()


class PaqueteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Paquete
        fields = '__all__'

    def validate_nombre(self, value):
        if not value.strip():
            raise serializers.ValidationError('El nombre del paquete es obligatorio.')
        return value.strip()

    def validate_precio_por_persona(self, value):
        if value <= 0:
            raise serializers.ValidationError('El precio por persona debe ser mayor a cero.')
        return value


class CotizacionSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cliente.nombre', read_only=True)
    cliente_telefono = serializers.CharField(source='cliente.telefono', read_only=True)
    tipo_evento_nombre = serializers.CharField(source='tipo_evento.nombre', read_only=True)
    paquete_nombre = serializers.CharField(source='paquete.nombre', read_only=True)
    tiene_contrato = serializers.SerializerMethodField()

    class Meta:
        model = Cotizacion
        fields = (
            'id',
            'cliente',
            'cliente_nombre',
            'cliente_telefono',
            'tipo_evento',
            'tipo_evento_nombre',
            'paquete',
            'paquete_nombre',
            'fecha_tentativa',
            'numero_invitados',
            'tipo_servicio',
            'monto_estimado',
            'estado',
            'notas',
            'ultimo_contacto',
            'fecha_registro',
            'tiene_contrato',
        )
        read_only_fields = ('fecha_registro', 'tiene_contrato')

    def get_tiene_contrato(self, obj):
        annotated_value = getattr(obj, 'tiene_contrato_annotated', None)
        if annotated_value is not None:
            return annotated_value
        return hasattr(obj, 'contrato')


class ContratoSerializer(serializers.ModelSerializer):
    cliente_nombre = serializers.CharField(source='cotizacion.cliente.nombre', read_only=True)
    cliente_telefono = serializers.CharField(source='cotizacion.cliente.telefono', read_only=True)
    evento_nombre = serializers.CharField(source='cotizacion.tipo_evento.nombre', read_only=True)
    paquete_nombre = serializers.CharField(source='cotizacion.paquete.nombre', read_only=True)
    monto_estimado = serializers.DecimalField(source='cotizacion.monto_estimado', max_digits=10, decimal_places=2, read_only=True)
    diferencia_valor = serializers.SerializerMethodField()
    total_costos_directos = serializers.SerializerMethodField()
    utilidad_bruta = serializers.SerializerMethodField()
    margen_bruto = serializers.SerializerMethodField()
    saldo_pendiente = serializers.SerializerMethodField()

    class Meta:
        model = Contrato
        fields = (
            'id',
            'cotizacion',
            'cliente_nombre',
            'cliente_telefono',
            'evento_nombre',
            'paquete_nombre',
            'monto_estimado',
            'diferencia_valor',
            'fecha_evento',
            'valor_final',
            'estado_contrato',
            'estado_pago',
            'monto_abonado',
            'saldo_pendiente',
            'observaciones',
            'fecha_registro',
            'total_costos_directos',
            'utilidad_bruta',
            'margen_bruto',
        )
        read_only_fields = ('fecha_registro',)

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        cotizacion = attrs.get('cotizacion')
        if instance and cotizacion and cotizacion.pk != instance.cotizacion_id:
            raise serializers.ValidationError({
                'cotizacion': 'No se puede cambiar la cotización asociada a un contrato existente.'
            })
        valor_final = attrs.get('valor_final', getattr(instance, 'valor_final', Decimal('0.00')))
        estado_pago = attrs.get('estado_pago', getattr(instance, 'estado_pago', Contrato.PAGO_PENDIENTE))
        monto_abonado = attrs.get('monto_abonado', getattr(instance, 'monto_abonado', None))

        if monto_abonado is None:
            monto_abonado = valor_final if estado_pago == Contrato.PAGO_PAGADO else Decimal('0.00')

        if valor_final <= 0:
            raise serializers.ValidationError({'valor_final': 'El valor final debe ser mayor a cero.'})
        if monto_abonado < 0:
            raise serializers.ValidationError({'monto_abonado': 'El monto abonado no puede ser negativo.'})
        if monto_abonado > valor_final:
            raise serializers.ValidationError({'monto_abonado': 'El monto abonado no puede superar el valor final.'})

        if estado_pago == Contrato.PAGO_PAGADO:
            attrs['monto_abonado'] = valor_final
        elif estado_pago == Contrato.PAGO_PENDIENTE and monto_abonado > 0:
            raise serializers.ValidationError({'estado_pago': 'Un contrato pendiente no debe tener monto abonado.'})
        elif estado_pago == Contrato.PAGO_ABONADO and monto_abonado <= 0:
            raise serializers.ValidationError({'monto_abonado': 'Registra un monto abonado mayor a cero.'})
        elif estado_pago == Contrato.PAGO_ABONADO and monto_abonado >= valor_final:
            raise serializers.ValidationError({'monto_abonado': 'Un contrato abonado debe conservar saldo pendiente.'})

        return attrs

    def get_diferencia_valor(self, obj):
        return obj.valor_final - obj.cotizacion.monto_estimado

    def get_total_costos_directos(self, obj):
        annotated_value = getattr(obj, 'total_costos_directos_annotated', None)
        if annotated_value is not None:
            return annotated_value
        return obj.total_costos_directos()

    def get_utilidad_bruta(self, obj):
        annotated_value = getattr(obj, 'total_costos_directos_annotated', None)
        if annotated_value is not None:
            return obj.valor_final - annotated_value
        return obj.utilidad_bruta()

    def get_margen_bruto(self, obj):
        annotated_value = getattr(obj, 'total_costos_directos_annotated', None)
        if annotated_value is not None:
            if not obj.valor_final:
                return Decimal('0.00')
            utilidad = obj.valor_final - annotated_value
            return round((utilidad / obj.valor_final) * Decimal('100'), 2)
        return round(obj.margen_bruto(), 2)

    def get_saldo_pendiente(self, obj):
        return obj.saldo_pendiente()


class CostoDirectoSerializer(serializers.ModelSerializer):
    contrato_cliente = serializers.CharField(source='contrato.cotizacion.cliente.nombre', read_only=True)
    contrato_evento = serializers.CharField(source='contrato.cotizacion.tipo_evento.nombre', read_only=True)

    class Meta:
        model = CostoDirecto
        fields = '__all__'
        read_only_fields = ('fecha_registro',)

    def validate_concepto(self, value):
        if not value.strip():
            raise serializers.ValidationError('El concepto del costo directo es obligatorio.')
        return value.strip()

    def validate_valor(self, value):
        if value <= 0:
            raise serializers.ValidationError('El valor del costo directo debe ser mayor a cero.')
        return value


class GastoFijoMensualSerializer(serializers.ModelSerializer):
    class Meta:
        model = GastoFijoMensual
        fields = '__all__'
        read_only_fields = ('fecha_registro',)

    def validate_concepto(self, value):
        if not value.strip():
            raise serializers.ValidationError('El concepto del gasto fijo es obligatorio.')
        return value.strip()

    def validate_mes(self, value):
        if value is not None and not 1 <= value <= 12:
            raise serializers.ValidationError('El mes debe estar entre 1 y 12.')
        return value

    def validate_valor(self, value):
        if value <= 0:
            raise serializers.ValidationError('El valor del gasto fijo debe ser mayor a cero.')
        return value

    def validate(self, attrs):
        instance = getattr(self, 'instance', None)
        fecha_inicio = attrs.get('fecha_inicio', getattr(instance, 'fecha_inicio', None))
        fecha_fin = attrs.get('fecha_fin', getattr(instance, 'fecha_fin', None))
        if fecha_inicio and fecha_fin and fecha_fin < fecha_inicio:
            raise serializers.ValidationError({'fecha_fin': 'La fecha de fin no puede ser anterior a la fecha de inicio.'})
        return attrs


class ConfiguracionNegocioSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionNegocio
        fields = '__all__'

    def validate_nombre_negocio(self, value):
        if not value.strip():
            raise serializers.ValidationError('El nombre del negocio es obligatorio.')
        return value.strip()

    def validate_whatsapp(self, value):
        digits = ''.join(char for char in str(value or '') if char.isdigit())
        if len(digits) < 7:
            raise serializers.ValidationError('El WhatsApp debe tener al menos 7 dígitos.')
        return value.strip()

    def validate_tarifa_base_alquiler(self, value):
        if value < 0:
            raise serializers.ValidationError('La tarifa base no puede ser negativa.')
        return value

    def validate_invitados_incluidos(self, value):
        if value < 0:
            raise serializers.ValidationError('Los invitados incluidos no pueden ser negativos.')
        return value

    def validate_costo_invitado_adicional(self, value):
        if value < 0:
            raise serializers.ValidationError('El costo por invitado adicional no puede ser negativo.')
        return value
