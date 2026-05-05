import re
from datetime import date
from decimal import Decimal

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import DecimalField, Exists, OuterRef, Q, Sum, Value
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_date
from rest_framework import status, viewsets
from rest_framework.authtoken.models import Token
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

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
from .serializers import (
    ClienteSerializer,
    ConfiguracionNegocioSerializer,
    ContratoSerializer,
    CostoDirectoSerializer,
    CotizacionSerializer,
    GastoFijoMensualSerializer,
    PaqueteSerializer,
    TipoEventoSerializer,
    UserSerializer,
)
from .services import (
    calcular_pre_cotizacion,
    dashboard_financiero,
    desempeno_paquetes,
    get_configuracion,
    inicio_resumen,
    month_bounds,
    reporte_comercial,
    reporte_financiero,
    reporte_por_campo,
)


TRUTHY_VALUES = {'1', 'true', 'si', 'sí', 'yes'}


def parse_bool_param(value):
    return str(value).strip().lower() in TRUTHY_VALUES


def parse_int_param(value, field_name):
    try:
        return int(value)
    except (TypeError, ValueError):
        raise ValidationError({field_name: f'{field_name} debe ser numérico.'})


def validate_month(value, field_name='mes'):
    mes = parse_int_param(value, field_name)
    if not 1 <= mes <= 12:
        raise ValidationError({field_name: 'El mes debe estar entre 1 y 12.'})
    return mes


def parse_year_month_params(params):
    anio_value = params.get('anio')
    mes_value = params.get('mes')
    anio = parse_int_param(anio_value, 'anio') if anio_value else None
    mes = validate_month(mes_value) if mes_value else None
    return anio, mes


def parse_month_period(value, field_name):
    parts = str(value or '').split('-')
    if len(parts) != 2:
        raise ValidationError({field_name: 'Usa el formato YYYY-MM.'})
    anio = parse_int_param(parts[0], field_name)
    mes = validate_month(parts[1], field_name)
    return anio, mes


def parse_date_param(value, field_name):
    parsed = parse_date(str(value or ''))
    if not parsed:
        raise ValidationError({field_name: 'Usa el formato YYYY-MM-DD.'})
    return parsed


def parse_date_range_params(params):
    desde_value = params.get('desde')
    hasta_value = params.get('hasta')
    desde = parse_date_param(desde_value, 'desde') if desde_value else None
    hasta = parse_date_param(hasta_value, 'hasta') if hasta_value else None
    if desde and hasta and hasta < desde:
        raise ValidationError({'hasta': 'La fecha hasta no puede ser anterior a la fecha desde.'})
    return desde, hasta


def contrato_queryset_base():
    return Contrato.objects.select_related(
        'cotizacion',
        'cotizacion__cliente',
        'cotizacion__tipo_evento',
        'cotizacion__paquete',
    ).annotate(
        total_costos_directos_annotated=Coalesce(
            Sum('costos__valor'),
            Value(Decimal('0.00')),
            output_field=DecimalField(max_digits=10, decimal_places=2),
        )
    )


class LoginAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username') or request.data.get('correo') or request.data.get('email')
        password = request.data.get('password') or request.data.get('contraseña')

        if not username or not password:
            return Response({'detail': 'Usuario/correo y contraseña son requeridos.'}, status=status.HTTP_400_BAD_REQUEST)

        auth_username = username
        if '@' in username:
            user = User.objects.filter(email__iexact=username).first()
            auth_username = user.username if user else username

        user = authenticate(request, username=auth_username, password=password)
        if not user:
            return Response({'detail': 'Credenciales inválidas.'}, status=status.HTTP_400_BAD_REQUEST)

        token, _ = Token.objects.get_or_create(user=user)
        return Response({'token': token.key, 'user': UserSerializer(user).data})


class LogoutAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        Token.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class TipoEventoViewSet(viewsets.ModelViewSet):
    queryset = TipoEvento.objects.all()
    serializer_class = TipoEventoSerializer

    def get_permissions(self):
        if self.request.method in ['GET', 'HEAD', 'OPTIONS']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        activo = self.request.query_params.get('activo')
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(activo=True)
        elif activo is not None:
            queryset = queryset.filter(activo=parse_bool_param(activo))
        return queryset


class ClienteViewSet(viewsets.ModelViewSet):
    queryset = Cliente.objects.all()
    serializer_class = ClienteSerializer


class PaqueteViewSet(viewsets.ModelViewSet):
    queryset = Paquete.objects.all()
    serializer_class = PaqueteSerializer

    def get_permissions(self):
        if self.action == 'desempeno':
            return [IsAuthenticated()]
        if self.request.method in ['GET', 'HEAD', 'OPTIONS']:
            return [AllowAny()]
        return [IsAuthenticated()]

    def get_queryset(self):
        queryset = super().get_queryset()
        activo = self.request.query_params.get('activo')
        if not self.request.user.is_authenticated:
            queryset = queryset.filter(activo=True)
        elif activo is not None:
            queryset = queryset.filter(activo=parse_bool_param(activo))
        return queryset

    @action(detail=False, methods=['get'], url_path='desempeno')
    def desempeno(self, request):
        return Response(desempeno_paquetes())


class CotizacionViewSet(viewsets.ModelViewSet):
    queryset = Cotizacion.objects.select_related('cliente', 'tipo_evento', 'paquete').annotate(
        tiene_contrato_annotated=Exists(Contrato.objects.filter(cotizacion_id=OuterRef('pk')))
    )
    serializer_class = CotizacionSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        estado = self.request.query_params.get('estado')
        servicio = self.request.query_params.get('tipo_servicio')
        if estado:
            queryset = queryset.filter(estado=estado)
        if servicio:
            queryset = queryset.filter(tipo_servicio=servicio)
        return queryset

    @action(detail=True, methods=['post'], url_path='cambiar-estado')
    def cambiar_estado(self, request, pk=None):
        cotizacion = self.get_object()
        estado = request.data.get('estado')
        estados_validos = [item[0] for item in Cotizacion.ESTADOS]
        if estado not in estados_validos:
            return Response({'detail': 'Estado de cotización inválido.'}, status=status.HTTP_400_BAD_REQUEST)
        tiene_contrato = hasattr(cotizacion, 'contrato')
        if estado == Cotizacion.ESTADO_CONVERTIDO and not tiene_contrato:
            return Response(
                {'detail': 'Usa la acción de conversión para marcar una cotización como convertida.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if tiene_contrato and estado != Cotizacion.ESTADO_CONVERTIDO:
            return Response(
                {'detail': 'Una cotización con contrato asociado debe permanecer en estado convertido.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        cotizacion.estado = estado
        cotizacion.ultimo_contacto = request.data.get('ultimo_contacto') or cotizacion.ultimo_contacto
        cotizacion.notas = request.data.get('notas', cotizacion.notas)
        cotizacion.save(update_fields=['estado', 'ultimo_contacto', 'notas'])
        return Response(self.get_serializer(cotizacion).data)

    @action(detail=True, methods=['post'], url_path='convertir-contrato')
    def convertir_contrato(self, request, pk=None):
        cotizacion = self.get_object()
        if hasattr(cotizacion, 'contrato'):
            return Response({'detail': 'Esta cotización ya tiene un contrato.'}, status=status.HTTP_400_BAD_REQUEST)

        data = {
            'cotizacion': cotizacion.id,
            'fecha_evento': request.data.get('fecha_evento') or cotizacion.fecha_tentativa,
            'valor_final': request.data.get('valor_final') or cotizacion.monto_estimado,
            'estado_contrato': request.data.get('estado_contrato') or Contrato.ESTADO_CONFIRMADO,
            'estado_pago': request.data.get('estado_pago') or Contrato.PAGO_PENDIENTE,
            'monto_abonado': request.data.get('monto_abonado'),
            'observaciones': request.data.get('observaciones', ''),
        }
        serializer = ContratoSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            contrato = serializer.save()
            cotizacion.estado = Cotizacion.ESTADO_CONVERTIDO
            cotizacion.save(update_fields=['estado'])
        return Response(ContratoSerializer(contrato).data, status=status.HTTP_201_CREATED)


class ContratoViewSet(viewsets.ModelViewSet):
    queryset = contrato_queryset_base()
    serializer_class = ContratoSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        anio, mes = parse_year_month_params(self.request.query_params)
        desde, hasta = parse_date_range_params(self.request.query_params)
        if anio and mes:
            queryset = queryset.filter(fecha_evento__year=anio, fecha_evento__month=mes)
        if desde:
            queryset = queryset.filter(fecha_evento__gte=desde)
        if hasta:
            queryset = queryset.filter(fecha_evento__lte=hasta)
        return queryset

    def perform_create(self, serializer):
        with transaction.atomic():
            contrato = serializer.save()
            Cotizacion.objects.filter(pk=contrato.cotizacion_id).update(estado=Cotizacion.ESTADO_CONVERTIDO)

    @action(detail=True, methods=['get'], url_path='costos')
    def costos(self, request, pk=None):
        contrato = self.get_object()
        serializer = CostoDirectoSerializer(contrato.costos.all(), many=True)
        return Response(serializer.data)


class CostoDirectoViewSet(viewsets.ModelViewSet):
    queryset = CostoDirecto.objects.select_related('contrato', 'contrato__cotizacion', 'contrato__cotizacion__cliente').all()
    serializer_class = CostoDirectoSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        contrato = self.request.query_params.get('contrato')
        if contrato:
            queryset = queryset.filter(contrato_id=contrato)
        return queryset


class GastoFijoMensualViewSet(viewsets.ModelViewSet):
    queryset = GastoFijoMensual.objects.all()
    serializer_class = GastoFijoMensualSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        anio, mes = parse_year_month_params(self.request.query_params)
        activo = self.request.query_params.get('activo')
        if anio and mes:
            start, end = month_bounds(anio, mes)
            queryset = queryset.filter(
                Q(anio=anio, mes=mes)
                | (
                    (Q(anio__isnull=True) | Q(mes__isnull=True))
                    & Q(frecuencia=GastoFijoMensual.FRECUENCIA_MENSUAL)
                    & (Q(fecha_inicio__isnull=True) | Q(fecha_inicio__lte=end))
                    & (Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=start))
                )
            )
        elif anio:
            queryset = queryset.filter(Q(anio=anio) | Q(anio__isnull=True))
        elif mes:
            queryset = queryset.filter(Q(mes=mes) | Q(mes__isnull=True))
        if activo is not None:
            queryset = queryset.filter(activo=parse_bool_param(activo))
        return queryset


class ConfiguracionAPIView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAuthenticated()]

    def get(self, request):
        return Response(ConfiguracionNegocioSerializer(get_configuracion()).data)

    def put(self, request):
        configuracion = get_configuracion()
        serializer = ConfiguracionNegocioSerializer(configuracion, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)


class DashboardFinancieroAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        today = date.today()
        anio, mes = parse_year_month_params(request.query_params)
        anio = anio or today.year
        mes = mes or today.month
        return Response(dashboard_financiero(anio, mes))


class InicioResumenAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(inicio_resumen())


class PreCotizacionAPIView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        required = ['nombre', 'telefono', 'tipo_evento', 'fecha_tentativa', 'numero_invitados', 'tipo_servicio']
        missing = [field for field in required if request.data.get(field) in [None, '']]
        if missing:
            return Response(
                {'detail': 'Campos requeridos incompletos.', 'campos': missing},
                status=status.HTTP_400_BAD_REQUEST,
            )

        telefono = limpiar_telefono(request.data.get('telefono'))
        if len(re.sub(r'\D', '', telefono)) < 7:
            return Response({'detail': 'El telefono o WhatsApp no tiene un formato valido.'}, status=status.HTTP_400_BAD_REQUEST)

        fecha_tentativa = parse_date(str(request.data.get('fecha_tentativa')))
        if not fecha_tentativa:
            return Response({'detail': 'La fecha tentativa no tiene un formato valido.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invitados = int(request.data.get('numero_invitados') or request.data.get('invitados'))
        except (TypeError, ValueError):
            return Response({'detail': 'El numero de invitados debe ser numerico.'}, status=status.HTTP_400_BAD_REQUEST)
        if invitados <= 0:
            return Response({'detail': 'El numero de invitados debe ser mayor a cero.'}, status=status.HTTP_400_BAD_REQUEST)

        tipo_servicio = request.data.get('tipo_servicio')
        tipos_validos = [item[0] for item in Cotizacion.TIPOS_SERVICIO]
        if tipo_servicio not in tipos_validos:
            return Response({'detail': 'Tipo de servicio invalido.'}, status=status.HTTP_400_BAD_REQUEST)

        tipo_evento = resolver_tipo_evento(request.data.get('tipo_evento'))
        if not tipo_evento:
            return Response({'detail': 'Tipo de evento invalido.'}, status=status.HTTP_400_BAD_REQUEST)

        paquete = None
        paquete_value = request.data.get('paquete') or request.data.get('paquete_id')
        if paquete_value:
            paquete = resolver_paquete(paquete_value)
            if not paquete:
                return Response({'detail': 'Paquete invalido o inactivo.'}, status=status.HTTP_400_BAD_REQUEST)

        if tipo_servicio == Cotizacion.SERVICIO_COMPLETO and not paquete:
            return Response(
                {'detail': 'Selecciona un paquete activo para calcular el servicio completo.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        calculo = calcular_pre_cotizacion(invitados, tipo_servicio, paquete)
        monto_estimado = Decimal(str(calculo.get('monto_estimado') or 0))
        notas = 'Origen: pre-cotizacion publica.'
        if tipo_servicio == Cotizacion.SERVICIO_NO_SEGURO:
            notas += ' Cliente solicito comparacion; el monto estimado corresponde a la menor referencia disponible.'

        with transaction.atomic():
            cliente = Cliente.objects.filter(telefono=telefono).order_by('id').first()
            created = cliente is None
            if created:
                cliente = Cliente(telefono=telefono)
            cliente.nombre = request.data.get('nombre').strip()
            if request.data.get('correo') is not None:
                cliente.correo = request.data.get('correo', '').strip()
            cliente.save()

            cotizacion = Cotizacion.objects.create(
                cliente=cliente,
                tipo_evento=tipo_evento,
                paquete=paquete if tipo_servicio == Cotizacion.SERVICIO_COMPLETO else None,
                fecha_tentativa=fecha_tentativa,
                numero_invitados=invitados,
                tipo_servicio=tipo_servicio,
                monto_estimado=monto_estimado,
                estado=Cotizacion.ESTADO_NUEVO,
                notas=notas,
            )

        return Response(
            {
                **calculo,
                'cliente': ClienteSerializer(cliente).data,
                'cliente_creado': created,
                'cotizacion': CotizacionSerializer(cotizacion).data,
                'tipo_servicio': tipo_servicio,
                'detalle_calculo': calculo,
            },
            status=status.HTTP_201_CREATED,
        )


def limpiar_telefono(value):
    return re.sub(r'[^\d+]', '', str(value or '').strip())


def resolver_tipo_evento(value):
    value = str(value).strip()
    if not value:
        return None
    if value.isdigit():
        return TipoEvento.objects.filter(pk=value, activo=True).first()
    evento = TipoEvento.objects.filter(nombre__iexact=value, activo=True).first()
    if evento:
        return evento
    if TipoEvento.objects.filter(nombre__iexact=value).exists():
        return None
    return TipoEvento.objects.create(nombre=value.title(), activo=True)


def resolver_paquete(value):
    value = str(value).strip()
    if not value:
        return None
    if value.isdigit():
        return Paquete.objects.filter(pk=value, activo=True).first()
    return Paquete.objects.filter(nombre__iexact=value, activo=True).first()


def parse_periodo(request):
    today = date.today()
    desde = request.query_params.get('desde') or f'{today.year}-{today.month:02d}'
    hasta = request.query_params.get('hasta') or desde
    desde_periodo = parse_month_period(desde, 'desde')
    hasta_periodo = parse_month_period(hasta, 'hasta')
    if desde_periodo > hasta_periodo:
        raise ValidationError({'hasta': 'El periodo hasta no puede ser anterior al periodo desde.'})
    return desde_periodo, hasta_periodo


class ReporteFinancieroAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(reporte_financiero(*parse_periodo(request)))


class ReporteComercialAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(reporte_comercial(*parse_periodo(request)))


class ReporteEventosAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(reporte_por_campo(*parse_periodo(request), 'cotizacion__tipo_evento', 'tipo_evento'))


class ReportePaquetesAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(reporte_por_campo(*parse_periodo(request), 'cotizacion__paquete', 'paquete'))
