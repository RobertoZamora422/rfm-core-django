from calendar import monthrange
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, F, Q, Sum

from .models import (
    ConfiguracionNegocio,
    Contrato,
    CostoDirecto,
    Cotizacion,
    GastoFijoMensual,
    Paquete,
    TipoEvento,
)


def decimal_to_number(value):
    return float(round(value or Decimal('0.00'), 2))


def get_configuracion():
    configuracion, _ = ConfiguracionNegocio.objects.get_or_create(pk=1)
    return configuracion


def calcular_alquiler(numero_invitados):
    configuracion = get_configuracion()
    invitados = int(numero_invitados or 0)
    adicionales = max(0, invitados - configuracion.invitados_incluidos)
    costo_adicional = Decimal(adicionales) * configuracion.costo_invitado_adicional
    total = configuracion.tarifa_base_alquiler + costo_adicional
    return {
        'tarifa_base': decimal_to_number(configuracion.tarifa_base_alquiler),
        'invitados_incluidos': configuracion.invitados_incluidos,
        'personas_adicionales': adicionales,
        'costo_invitado_adicional': decimal_to_number(configuracion.costo_invitado_adicional),
        'costo_adicional': decimal_to_number(costo_adicional),
        'total_estimado': decimal_to_number(total),
    }


def configuracion_publica():
    configuracion = get_configuracion()
    return {
        'nombre_negocio': configuracion.nombre_negocio,
        'whatsapp': configuracion.whatsapp,
        'correo': configuracion.correo,
        'direccion': configuracion.direccion,
        'tarifa_base_alquiler': decimal_to_number(configuracion.tarifa_base_alquiler),
        'invitados_incluidos': configuracion.invitados_incluidos,
        'costo_invitado_adicional': decimal_to_number(configuracion.costo_invitado_adicional),
    }


def paquete_estimado(paquete, numero_invitados):
    invitados = int(numero_invitados or 0)
    total = paquete.precio_por_persona * Decimal(invitados)
    return {
        'id': paquete.id,
        'nombre': paquete.nombre,
        'descripcion': paquete.descripcion,
        'precio_por_persona': decimal_to_number(paquete.precio_por_persona),
        'tipo_servicio': paquete.tipo_servicio,
        'activo': paquete.activo,
        'total_estimado': decimal_to_number(total),
    }


def calcular_paquetes(numero_invitados):
    invitados = int(numero_invitados or 0)
    paquetes = []
    for paquete in Paquete.objects.filter(activo=True).order_by('precio_por_persona'):
        paquetes.append(paquete_estimado(paquete, invitados))
    return paquetes


def calcular_pre_cotizacion(numero_invitados, tipo_servicio, paquete=None):
    alquiler = calcular_alquiler(numero_invitados)
    paquetes = calcular_paquetes(numero_invitados)
    paquete_seleccionado = paquete_estimado(paquete, numero_invitados) if paquete else None

    if tipo_servicio == Cotizacion.SERVICIO_ALQUILER:
        return {
            'tipo_resultado': 'alquiler',
            'monto_estimado': alquiler['total_estimado'],
            'alquiler': alquiler,
            'configuracion': configuracion_publica(),
        }
    if tipo_servicio == Cotizacion.SERVICIO_COMPLETO:
        referencia = paquete_seleccionado or (paquetes[0] if paquetes else None)
        return {
            'tipo_resultado': 'servicio_completo',
            'monto_estimado': referencia['total_estimado'] if referencia else 0,
            'paquete': paquete_seleccionado,
            'paquetes': paquetes,
            'configuracion': configuracion_publica(),
        }

    opciones = [alquiler['total_estimado']]
    opciones.extend(item['total_estimado'] for item in paquetes)
    return {
        'tipo_resultado': 'comparacion',
        'monto_estimado': min(opciones) if opciones else 0,
        'alquiler': alquiler,
        'servicio_completo': {
            'desde': paquetes[0] if paquetes else None,
            'hasta': paquetes[-1] if paquetes else None,
            'paquetes': paquetes,
        },
        'configuracion': configuracion_publica(),
    }


def month_bounds(anio, mes):
    last_day = monthrange(anio, mes)[1]
    return date(anio, mes, 1), date(anio, mes, last_day)


MESES = [
    'enero',
    'febrero',
    'marzo',
    'abril',
    'mayo',
    'junio',
    'julio',
    'agosto',
    'septiembre',
    'octubre',
    'noviembre',
    'diciembre',
]


def nombre_mes(mes):
    return MESES[int(mes) - 1]


def periodo_label(anio, mes):
    return f'{nombre_mes(mes)} {anio}'


def previous_month(anio, mes):
    if mes == 1:
        return anio - 1, 12
    return anio, mes - 1


def shift_month(anio, mes, delta):
    total = (anio * 12) + (mes - 1) + delta
    return total // 12, (total % 12) + 1


def recent_months(anio, mes, cantidad=6):
    return [shift_month(anio, mes, offset) for offset in range(-(cantidad - 1), 1)]


def contratos_del_mes(anio, mes, incluir_cancelados=False):
    queryset = Contrato.objects.select_related(
        'cotizacion',
        'cotizacion__cliente',
        'cotizacion__tipo_evento',
        'cotizacion__paquete',
    ).filter(fecha_evento__year=anio, fecha_evento__month=mes)
    if not incluir_cancelados:
        queryset = queryset.exclude(estado_contrato=Contrato.ESTADO_CANCELADO)
    return queryset


def contratos_cerrados_del_mes(anio, mes):
    return Contrato.objects.filter(
        fecha_registro__year=anio,
        fecha_registro__month=mes,
    ).exclude(estado_contrato=Contrato.ESTADO_CANCELADO)


def cotizaciones_del_mes(anio, mes):
    return Cotizacion.objects.filter(fecha_registro__year=anio, fecha_registro__month=mes)


def ingresos_mes(anio, mes):
    total = contratos_del_mes(anio, mes).aggregate(total=Sum('valor_final'))['total']
    return total or Decimal('0.00')


def costos_directos_mes(anio, mes):
    contratos = contratos_del_mes(anio, mes)
    total = CostoDirecto.objects.filter(
        contrato__in=contratos,
    ).aggregate(total=Sum('valor'))['total']
    return total or Decimal('0.00')


def gastos_fijos_queryset_mes(anio, mes):
    start, end = month_bounds(anio, mes)
    return GastoFijoMensual.objects.filter(activo=True).filter(
        Q(anio=anio, mes=mes)
        | (
            (Q(anio__isnull=True) | Q(mes__isnull=True))
            & Q(frecuencia=GastoFijoMensual.FRECUENCIA_MENSUAL)
            & (Q(fecha_inicio__isnull=True) | Q(fecha_inicio__lte=end))
            & (Q(fecha_fin__isnull=True) | Q(fecha_fin__gte=start))
        )
    )


def gastos_fijos_mes(anio, mes):
    total = gastos_fijos_queryset_mes(anio, mes).aggregate(total=Sum('valor'))['total']
    return total or Decimal('0.00')


def rentabilidad_mensual(anio, mes):
    contratos = contratos_del_mes(anio, mes)
    cantidad_contratos = contratos.count()
    ingresos = ingresos_mes(anio, mes)
    costos = costos_directos_mes(anio, mes)
    gastos = gastos_fijos_mes(anio, mes)
    utilidad_bruta = ingresos - costos
    margen_bruto = Decimal('0.00') if not ingresos else (utilidad_bruta / ingresos) * Decimal('100')
    utilidad_neta = utilidad_bruta - gastos
    margen_neto = Decimal('0.00') if not ingresos else (utilidad_neta / ingresos) * Decimal('100')
    ticket_promedio = Decimal('0.00') if cantidad_contratos == 0 else ingresos / Decimal(cantidad_contratos)
    return {
        'ingresos_mes': ingresos,
        'costos_directos_mes': costos,
        'gastos_fijos_mes': gastos,
        'utilidad_bruta': utilidad_bruta,
        'margen_bruto': margen_bruto,
        'utilidad_neta': utilidad_neta,
        'margen_neto': margen_neto,
        'ticket_promedio': ticket_promedio,
        'contratos_confirmados': cantidad_contratos,
    }


def tasa_conversion(anio, mes):
    cotizaciones = cotizaciones_del_mes(anio, mes).count()
    contratos = contratos_cerrados_del_mes(anio, mes).count()
    conversion = 0 if cotizaciones == 0 else (contratos / cotizaciones) * 100
    return cotizaciones, contratos, round(conversion, 2)


def hay_datos_periodo(anio, mes):
    return (
        contratos_del_mes(anio, mes).exists()
        or gastos_fijos_queryset_mes(anio, mes).exists()
        or cotizaciones_del_mes(anio, mes).exists()
    )


def porcentaje(parte, total):
    if not total:
        return Decimal('0.00')
    return (parte / total) * Decimal('100')


def proporcion_ingresos(valor, ingresos):
    if not ingresos:
        return {
            'valor': 0,
            'texto': 'No hay ingresos para calcular proporcion',
            'hay_base': False,
        }
    porcentaje_valor = porcentaje(valor, ingresos)
    return {
        'valor': decimal_to_number(porcentaje_valor),
        'texto': f'{decimal_to_number(porcentaje_valor):.2f}% de los ingresos del mes',
        'hay_base': True,
    }


def comparar_metricas(actual, anterior, hay_anterior, etiqueta_anterior):
    actual = actual or Decimal('0.00')
    anterior = anterior or Decimal('0.00')
    diferencia = actual - anterior

    if not hay_anterior or anterior == 0:
        return {
            'hay_datos': False,
            'direccion': 'none',
            'porcentaje': None,
            'diferencia': decimal_to_number(diferencia),
            'texto': 'Sin datos suficientes para comparar',
            'texto_diferencia': '',
            'mes_anterior': etiqueta_anterior,
        }

    variacion = porcentaje(diferencia, anterior)
    if abs(diferencia) < Decimal('0.01'):
        direccion = 'flat'
        texto = 'Sin variacion vs mes anterior'
        texto_diferencia = ''
    elif diferencia > 0:
        direccion = 'up'
        texto = f'+{abs(decimal_to_number(variacion)):.2f}% vs mes anterior'
        texto_diferencia = f'${decimal_to_number(abs(diferencia)):.2f} mas que {etiqueta_anterior}'
    else:
        direccion = 'down'
        texto = f'-{abs(decimal_to_number(variacion)):.2f}% vs mes anterior'
        texto_diferencia = f'${decimal_to_number(abs(diferencia)):.2f} menos que {etiqueta_anterior}'

    return {
        'hay_datos': True,
        'direccion': direccion,
        'porcentaje': decimal_to_number(variacion),
        'diferencia': decimal_to_number(diferencia),
        'texto': texto,
        'texto_diferencia': texto_diferencia,
        'mes_anterior': etiqueta_anterior,
    }


def costos_por_contrato(contratos):
    ids = [contrato.id for contrato in contratos]
    if not ids:
        return {}
    rows = (
        CostoDirecto.objects.filter(contrato_id__in=ids)
        .values('contrato_id')
        .annotate(total=Sum('valor'))
    )
    return {row['contrato_id']: row['total'] or Decimal('0.00') for row in rows}


def filas_rentabilidad_agrupada(contratos, tipo):
    contratos = list(contratos)
    costos_map = costos_por_contrato(contratos)
    grupos = {}

    for contrato in contratos:
        if tipo == 'paquete':
            objeto = contrato.cotizacion.paquete
        else:
            objeto = contrato.cotizacion.tipo_evento
        if not objeto:
            continue

        key = objeto.id
        if key not in grupos:
            grupos[key] = {
                'id': key,
                'nombre': objeto.nombre,
                'contratos': 0,
                'ingresos': Decimal('0.00'),
                'costos_directos': Decimal('0.00'),
                'utilidad': Decimal('0.00'),
                'margenes': [],
            }

        costos = costos_map.get(contrato.id, Decimal('0.00'))
        utilidad = contrato.valor_final - costos
        margen = porcentaje(utilidad, contrato.valor_final)
        grupo = grupos[key]
        grupo['contratos'] += 1
        grupo['ingresos'] += contrato.valor_final
        grupo['costos_directos'] += costos
        grupo['utilidad'] += utilidad
        grupo['margenes'].append(margen)

    rows = []
    for grupo in grupos.values():
        margen_promedio = (
            sum(grupo['margenes'], Decimal('0.00')) / Decimal(len(grupo['margenes']))
            if grupo['margenes']
            else Decimal('0.00')
        )
        utilidad_promedio = (
            grupo['utilidad'] / Decimal(grupo['contratos'])
            if grupo['contratos']
            else Decimal('0.00')
        )
        rows.append({
            'id': grupo['id'],
            'nombre': grupo['nombre'],
            'contratos': grupo['contratos'],
            'ingresos': decimal_to_number(grupo['ingresos']),
            'costos_directos': decimal_to_number(grupo['costos_directos']),
            'utilidad': decimal_to_number(grupo['utilidad']),
            'utilidad_promedio': decimal_to_number(utilidad_promedio),
            'margen_promedio': decimal_to_number(margen_promedio),
            'margen_total': decimal_to_number(porcentaje(grupo['utilidad'], grupo['ingresos'])),
        })
    rows.sort(key=lambda item: (item['utilidad'], item['ingresos']), reverse=True)
    return rows


def rentabilidad_por_paquete(anio, mes):
    contratos = contratos_del_mes(anio, mes).exclude(cotizacion__paquete__isnull=True)
    return filas_rentabilidad_agrupada(contratos, 'paquete')


def analisis_por_tipo_evento(anio, mes):
    contratos = contratos_del_mes(anio, mes).exclude(cotizacion__tipo_evento__isnull=True)
    return filas_rentabilidad_agrupada(contratos, 'tipo_evento')


def top_por_contratos(rows):
    if not rows:
        return None
    return sorted(rows, key=lambda item: (item['contratos'], item['ingresos']), reverse=True)[0]


def top_por_margen(rows):
    if not rows:
        return None
    return sorted(rows, key=lambda item: (item['margen_promedio'], item['utilidad']), reverse=True)[0]


def tipo_evento_mas_frecuente(anio=None, mes=None):
    rows = analisis_por_tipo_evento(anio, mes) if anio and mes else filas_rentabilidad_agrupada(
        Contrato.objects.exclude(estado_contrato=Contrato.ESTADO_CANCELADO),
        'tipo_evento',
    )
    row = top_por_contratos(rows)
    if not row:
        return None
    return {'nombre': row['nombre'], 'eventos': row['contratos']}


def paquete_mas_vendido(anio=None, mes=None):
    rows = rentabilidad_por_paquete(anio, mes) if anio and mes else filas_rentabilidad_agrupada(
        Contrato.objects.exclude(estado_contrato=Contrato.ESTADO_CANCELADO),
        'paquete',
    )
    row = top_por_contratos(rows)
    if not row:
        return None
    return {'nombre': row['nombre'], 'contratos': row['contratos']}


def utilidad_contratos(queryset):
    queryset = queryset.exclude(estado_contrato=Contrato.ESTADO_CANCELADO)
    ingresos = queryset.aggregate(total=Sum('valor_final'))['total'] or Decimal('0.00')
    costos = CostoDirecto.objects.filter(contrato__in=queryset).aggregate(total=Sum('valor'))['total'] or Decimal('0.00')
    utilidad = ingresos - costos
    margen = Decimal('0.00') if not ingresos else (utilidad / ingresos) * Decimal('100')
    return ingresos, costos, utilidad, margen


def paquete_mas_rentable(anio=None, mes=None):
    rows = rentabilidad_por_paquete(anio, mes) if anio and mes else filas_rentabilidad_agrupada(
        Contrato.objects.exclude(estado_contrato=Contrato.ESTADO_CANCELADO),
        'paquete',
    )
    row = top_por_margen(rows)
    if not row:
        return None
    return {
        'nombre': row['nombre'],
        'ingresos': row['ingresos'],
        'utilidad': row['utilidad'],
        'margen': row['margen_promedio'],
    }


def tipo_evento_mas_rentable(anio, mes):
    row = top_por_margen(analisis_por_tipo_evento(anio, mes))
    if not row:
        return None
    return {
        'nombre': row['nombre'],
        'eventos': row['contratos'],
        'utilidad': row['utilidad'],
        'margen': row['margen_promedio'],
    }


def top_eventos_rentables(anio, mes, limit=5):
    contratos = list(contratos_del_mes(anio, mes))
    costos_map = costos_por_contrato(contratos)
    rows = []
    for contrato in contratos:
        costos = costos_map.get(contrato.id, Decimal('0.00'))
        utilidad = contrato.valor_final - costos
        rows.append({
            'id': contrato.id,
            'cliente': contrato.cotizacion.cliente.nombre,
            'tipo_evento': contrato.cotizacion.tipo_evento.nombre if contrato.cotizacion.tipo_evento else 'Sin tipo',
            'paquete': contrato.cotizacion.paquete.nombre if contrato.cotizacion.paquete else 'No aplica',
            'fecha_evento': contrato.fecha_evento.isoformat(),
            'ingresos': decimal_to_number(contrato.valor_final),
            'costos_directos': decimal_to_number(costos),
            'utilidad': decimal_to_number(utilidad),
            'margen': decimal_to_number(porcentaje(utilidad, contrato.valor_final)),
            'detalle_url': f'/contratos/{contrato.id}',
        })
    rows.sort(key=lambda item: (item['utilidad'], item['margen']), reverse=True)
    return rows[:limit]


def evento_extremo_rentabilidad(anio, mes, reverse=True):
    eventos = top_eventos_rentables(anio, mes, limit=1000)
    if not eventos:
        return None
    return sorted(eventos, key=lambda item: item['utilidad'], reverse=reverse)[0]


def build_kpis(rentabilidad, rentabilidad_previa, hay_anterior, etiqueta_anterior):
    ingresos = rentabilidad['ingresos_mes']
    costos = rentabilidad['costos_directos_mes']
    gastos = rentabilidad['gastos_fijos_mes']
    utilidad_bruta = rentabilidad['utilidad_bruta']
    utilidad_neta = rentabilidad['utilidad_neta']
    ticket = rentabilidad['ticket_promedio']

    return {
        'ingresos_mes': {
            'titulo': 'Ingresos del mes',
            'valor': decimal_to_number(ingresos),
            'comparacion': comparar_metricas(ingresos, rentabilidad_previa['ingresos_mes'], hay_anterior, etiqueta_anterior),
            'detalle': f"{rentabilidad['contratos_confirmados']} contrato(s) confirmado(s)",
            'estado_vacio': 'Aun no hay contratos confirmados para este mes.',
        },
        'costos_directos_mes': {
            'titulo': 'Costos directos',
            'valor': decimal_to_number(costos),
            'proporcion_ingresos': proporcion_ingresos(costos, ingresos),
            'comparacion': comparar_metricas(costos, rentabilidad_previa['costos_directos_mes'], hay_anterior, etiqueta_anterior),
            'estado_vacio': 'No hay costos registrados en este periodo.',
        },
        'utilidad_bruta': {
            'titulo': 'Utilidad bruta',
            'valor': decimal_to_number(utilidad_bruta),
            'margen': decimal_to_number(rentabilidad['margen_bruto']),
            'comparacion': comparar_metricas(utilidad_bruta, rentabilidad_previa['utilidad_bruta'], hay_anterior, etiqueta_anterior),
            'estado_vacio': 'Aun no hay informacion suficiente para calcular utilidad bruta.',
        },
        'gastos_fijos_mes': {
            'titulo': 'Gastos fijos',
            'valor': decimal_to_number(gastos),
            'proporcion_ingresos': proporcion_ingresos(gastos, ingresos),
            'comparacion': comparar_metricas(gastos, rentabilidad_previa['gastos_fijos_mes'], hay_anterior, etiqueta_anterior),
            'estado_vacio': 'No hay gastos fijos registrados para este mes.',
        },
        'utilidad_neta': {
            'titulo': 'Utilidad neta',
            'valor': decimal_to_number(utilidad_neta),
            'margen': decimal_to_number(rentabilidad['margen_neto']),
            'comparacion': comparar_metricas(utilidad_neta, rentabilidad_previa['utilidad_neta'], hay_anterior, etiqueta_anterior),
            'estado_vacio': 'Aun no hay informacion suficiente para calcular utilidad neta.',
        },
        'ticket_promedio': {
            'titulo': 'Ticket promedio',
            'valor': decimal_to_number(ticket),
            'comparacion': comparar_metricas(ticket, rentabilidad_previa['ticket_promedio'], hay_anterior, etiqueta_anterior),
            'detalle': 'Promedio por contrato confirmado',
            'estado_vacio': 'Aun no hay contratos confirmados para calcular ticket promedio.',
        },
    }


def evolucion_mensual(anio, mes):
    rows = []
    for item_anio, item_mes in recent_months(anio, mes, 6):
        data = rentabilidad_mensual(item_anio, item_mes)
        rows.append({
            'anio': item_anio,
            'mes': item_mes,
            'periodo': f'{item_anio}-{item_mes:02d}',
            'periodo_label': nombre_mes(item_mes).capitalize(),
            'ingresos': decimal_to_number(data['ingresos_mes']),
            'costos_directos': decimal_to_number(data['costos_directos_mes']),
            'gastos_fijos': decimal_to_number(data['gastos_fijos_mes']),
            'utilidad_bruta': decimal_to_number(data['utilidad_bruta']),
            'utilidad_neta': decimal_to_number(data['utilidad_neta']),
            'ticket_promedio': decimal_to_number(data['ticket_promedio']),
        })
    return rows


def comparativo_mes_anterior(rentabilidad, rentabilidad_previa, hay_anterior, etiqueta_actual, etiqueta_anterior):
    categorias = [
        ('ingresos', 'Ingresos', 'ingresos_mes'),
        ('costos_directos', 'Costos directos', 'costos_directos_mes'),
        ('utilidad_bruta', 'Utilidad bruta', 'utilidad_bruta'),
        ('gastos_fijos', 'Gastos fijos', 'gastos_fijos_mes'),
        ('utilidad_neta', 'Utilidad neta', 'utilidad_neta'),
        ('ticket_promedio', 'Ticket promedio', 'ticket_promedio'),
    ]
    return {
        'hay_datos': hay_anterior,
        'mes_actual': etiqueta_actual,
        'mes_anterior': etiqueta_anterior,
        'categorias': [
            {
                'key': key,
                'label': label,
                'actual': decimal_to_number(rentabilidad[field]),
                'anterior': decimal_to_number(rentabilidad_previa[field]),
            }
            for key, label, field in categorias
        ],
    }


def estado_pagos_cobranza(anio, mes):
    contratos = list(contratos_del_mes(anio, mes, incluir_cancelados=True))
    resumen = {
        'pagados': 0,
        'abonados': 0,
        'pendientes': 0,
        'cancelados': 0,
        'total_contratos': len(contratos),
    }
    monto_pendiente = Decimal('0.00')
    pendientes = []

    for contrato in contratos:
        if contrato.estado_contrato == Contrato.ESTADO_CANCELADO:
            resumen['cancelados'] += 1
            continue

        if contrato.estado_pago == Contrato.PAGO_PAGADO:
            resumen['pagados'] += 1
        elif contrato.estado_pago == Contrato.PAGO_ABONADO:
            resumen['abonados'] += 1
        else:
            resumen['pendientes'] += 1

        saldo = contrato.saldo_pendiente()
        if saldo > 0:
            monto_pendiente += saldo
            pendientes.append({
                'id': contrato.id,
                'cliente': contrato.cotizacion.cliente.nombre,
                'tipo_evento': contrato.cotizacion.tipo_evento.nombre if contrato.cotizacion.tipo_evento else 'Sin tipo',
                'estado_pago': contrato.estado_pago,
                'saldo_pendiente': decimal_to_number(saldo),
                'detalle_url': f'/contratos/{contrato.id}',
            })

    pendientes.sort(key=lambda item: item['saldo_pendiente'], reverse=True)
    return {
        **resumen,
        'monto_pendiente_por_cobrar': decimal_to_number(monto_pendiente),
        'pendientes': pendientes[:5],
        'estado_vacio': 'No hay contratos registrados en este mes para analizar cobranza.',
    }


def inicio_resumen(fecha_referencia=None):
    today = fecha_referencia or date.today()
    start_month, end_month = month_bounds(today.year, today.month)
    in_15_days = today + timedelta(days=15)

    contratos_confirmados = Contrato.objects.filter(estado_contrato=Contrato.ESTADO_CONFIRMADO)
    eventos_proximos_queryset = (
        contratos_confirmados
        .filter(fecha_evento__gte=today)
        .select_related('cotizacion', 'cotizacion__cliente', 'cotizacion__tipo_evento', 'cotizacion__paquete')
        .order_by('fecha_evento', 'id')
    )
    eventos_proximos = [
        {
            'id': contrato.id,
            'cliente_nombre': contrato.cotizacion.cliente.nombre,
            'evento_nombre': contrato.cotizacion.tipo_evento.nombre if contrato.cotizacion.tipo_evento else 'Sin tipo',
            'paquete_nombre': contrato.cotizacion.paquete.nombre if contrato.cotizacion.paquete else 'No aplica',
            'fecha_evento': contrato.fecha_evento.isoformat(),
            'estado_contrato': contrato.estado_contrato,
            'estado_pago': contrato.estado_pago,
            'saldo_pendiente': decimal_to_number(contrato.saldo_pendiente()),
        }
        for contrato in eventos_proximos_queryset[:5]
    ]

    kpis = {
        'cotizaciones_nuevas': Cotizacion.objects.filter(estado=Cotizacion.ESTADO_NUEVO).count(),
        'cotizaciones_mes': Cotizacion.objects.filter(fecha_registro__date__range=(start_month, end_month)).count(),
        'contratos_evento_mes': contratos_confirmados.filter(fecha_evento__range=(start_month, end_month)).count(),
        'eventos_realizados_mes': contratos_confirmados.filter(fecha_evento__range=(start_month, today)).count(),
    }

    paquetes_sin_precio = Paquete.objects.filter(activo=True, precio_por_persona__lte=0).count()
    cotizaciones_nuevas_sin_contacto = Cotizacion.objects.filter(
        estado=Cotizacion.ESTADO_NUEVO,
        ultimo_contacto__isnull=True,
    ).count()
    eventos_proximos_con_saldo = contratos_confirmados.filter(
        fecha_evento__range=(today, in_15_days),
        monto_abonado__lt=F('valor_final'),
    ).count()
    eventos_realizados_sin_costos = (
        contratos_confirmados
        .filter(fecha_evento__lt=today)
        .annotate(costos_registrados=Count('costos'))
        .filter(costos_registrados=0)
        .count()
    )
    cotizaciones_sin_contrato = Cotizacion.objects.filter(
        estado__in=[Cotizacion.ESTADO_CONTACTADO, Cotizacion.ESTADO_CONFIRMADO],
        contrato__isnull=True,
    ).count()

    clientes_sin_telefono = set(
        Cotizacion.objects.filter(
            estado__in=[Cotizacion.ESTADO_NUEVO, Cotizacion.ESTADO_CONTACTADO, Cotizacion.ESTADO_CONFIRMADO],
            cliente__telefono='',
        ).values_list('cliente_id', flat=True)
    )
    clientes_sin_telefono.update(
        contratos_confirmados.filter(cotizacion__cliente__telefono='').values_list('cotizacion__cliente_id', flat=True)
    )

    alertas = [
        {
            'tipo': 'paquetes_sin_precio',
            'prioridad': 'Alta prioridad',
            'cantidad': paquetes_sin_precio,
            'texto': f'{paquetes_sin_precio} paquetes activos no tienen precio por persona definido.',
            'ruta': '/paquetes',
        },
        {
            'tipo': 'cotizaciones_nuevas_sin_contacto',
            'prioridad': 'Alta prioridad',
            'cantidad': cotizaciones_nuevas_sin_contacto,
            'texto': f'{cotizaciones_nuevas_sin_contacto} cotizaciones nuevas están pendientes de revisión o contacto.',
            'ruta': '/cotizaciones',
        },
        {
            'tipo': 'eventos_proximos_con_saldo',
            'prioridad': 'Alta prioridad',
            'cantidad': eventos_proximos_con_saldo,
            'texto': f'{eventos_proximos_con_saldo} eventos próximos tienen saldo o pago pendiente en los próximos 15 días.',
            'ruta': f'/contratos?desde={today.isoformat()}&hasta={in_15_days.isoformat()}',
        },
        {
            'tipo': 'eventos_realizados_sin_costos',
            'prioridad': 'Alta prioridad',
            'cantidad': eventos_realizados_sin_costos,
            'texto': f'{eventos_realizados_sin_costos} eventos realizados no tienen costos directos registrados.',
            'ruta': '/costos-directos',
        },
        {
            'tipo': 'cotizaciones_sin_contrato',
            'prioridad': 'Media prioridad',
            'cantidad': cotizaciones_sin_contrato,
            'texto': f'{cotizaciones_sin_contrato} cotizaciones contactadas o confirmadas aún no tienen contrato asociado.',
            'ruta': '/cotizaciones',
        },
        {
            'tipo': 'clientes_sin_telefono',
            'prioridad': 'Media prioridad',
            'cantidad': len(clientes_sin_telefono),
            'texto': f'{len(clientes_sin_telefono)} clientes con gestión activa no tienen teléfono registrado.',
            'ruta': '/clientes',
        },
    ]

    return {
        'fecha_referencia': today.isoformat(),
        'kpis': kpis,
        'eventos_proximos': eventos_proximos,
        'pendientes_importantes': [alerta for alerta in alertas if alerta['cantidad'] > 0][:5],
    }


def dashboard_financiero(anio, mes):
    rentabilidad = rentabilidad_mensual(anio, mes)
    cotizaciones, contratos, conversion = tasa_conversion(anio, mes)
    prev_anio, prev_mes = previous_month(anio, mes)
    rentabilidad_previa = rentabilidad_mensual(prev_anio, prev_mes)
    cotizaciones_previas, contratos_previos, conversion_previa = tasa_conversion(prev_anio, prev_mes)

    etiqueta_actual = periodo_label(anio, mes)
    etiqueta_anterior = periodo_label(prev_anio, prev_mes)
    hay_anterior = hay_datos_periodo(prev_anio, prev_mes)
    comparacion_ingresos = comparar_metricas(
        rentabilidad['ingresos_mes'],
        rentabilidad_previa['ingresos_mes'],
        hay_anterior,
        etiqueta_anterior,
    )
    comparacion_utilidad = comparar_metricas(
        rentabilidad['utilidad_neta'],
        rentabilidad_previa['utilidad_neta'],
        hay_anterior,
        etiqueta_anterior,
    )
    paquetes = rentabilidad_por_paquete(anio, mes)
    tipos_evento = analisis_por_tipo_evento(anio, mes)
    paquete_vendido_row = top_por_contratos(paquetes)
    paquete_rentable_row = top_por_margen(paquetes)
    tipo_frecuente_row = top_por_contratos(tipos_evento)
    tipo_rentable_row = top_por_margen(tipos_evento)
    paquete_vendido = (
        {'nombre': paquete_vendido_row['nombre'], 'contratos': paquete_vendido_row['contratos']}
        if paquete_vendido_row
        else None
    )
    paquete_rentable = (
        {
            'nombre': paquete_rentable_row['nombre'],
            'ingresos': paquete_rentable_row['ingresos'],
            'utilidad': paquete_rentable_row['utilidad'],
            'margen': paquete_rentable_row['margen_promedio'],
        }
        if paquete_rentable_row
        else None
    )
    tipo_frecuente = (
        {'nombre': tipo_frecuente_row['nombre'], 'eventos': tipo_frecuente_row['contratos']}
        if tipo_frecuente_row
        else None
    )
    tipo_rentable = (
        {
            'nombre': tipo_rentable_row['nombre'],
            'eventos': tipo_rentable_row['contratos'],
            'utilidad': tipo_rentable_row['utilidad'],
            'margen': tipo_rentable_row['margen_promedio'],
        }
        if tipo_rentable_row
        else None
    )
    eventos_rentables = top_eventos_rentables(anio, mes, limit=1000)
    comparacion = {
        'ingresos': comparacion_ingresos['porcentaje'] or 0,
        'utilidad': comparacion_utilidad['porcentaje'] or 0,
        'conversion': round(conversion - conversion_previa, 2),
        'mes_anterior': {'anio': prev_anio, 'mes': prev_mes},
        'hay_mes_anterior': hay_anterior,
    }
    data = {
        'anio': anio,
        'mes': mes,
        'periodo': {
            'anio': anio,
            'mes': mes,
            'label': etiqueta_actual,
            'mes_anterior_label': etiqueta_anterior,
        },
        'ingresos_mes': decimal_to_number(rentabilidad['ingresos_mes']),
        'costos_directos_mes': decimal_to_number(rentabilidad['costos_directos_mes']),
        'gastos_fijos_mes': decimal_to_number(rentabilidad['gastos_fijos_mes']),
        'utilidad_bruta': decimal_to_number(rentabilidad['utilidad_bruta']),
        'margen_bruto': decimal_to_number(rentabilidad['margen_bruto']),
        'utilidad_neta': decimal_to_number(rentabilidad['utilidad_neta']),
        'margen_neto': decimal_to_number(rentabilidad['margen_neto']),
        'ticket_promedio': decimal_to_number(rentabilidad['ticket_promedio']),
        'cotizaciones_mes': cotizaciones,
        'contratos_cerrados': contratos,
        'contratos_confirmados': rentabilidad['contratos_confirmados'],
        'tasa_conversion': conversion,
        'paquete_mas_vendido': paquete_vendido,
        'paquete_mas_rentable': paquete_rentable,
        'tipo_evento_mas_frecuente': tipo_frecuente,
        'tipo_evento_mas_rentable': tipo_rentable,
        'evento_mas_rentable': eventos_rentables[0] if eventos_rentables else None,
        'evento_menos_rentable': sorted(eventos_rentables, key=lambda item: item['utilidad'])[0] if eventos_rentables else None,
        'comparacion_mes_anterior': comparacion,
        'kpis': build_kpis(rentabilidad, rentabilidad_previa, hay_anterior, etiqueta_anterior),
        'desempeno_comercial': {
            'paquete_mas_vendido': paquete_vendido,
            'paquete_mas_rentable': paquete_rentable,
            'tipo_evento_mas_frecuente': tipo_frecuente,
            'tipo_evento_mas_rentable': tipo_rentable,
        },
        'evolucion_mensual': evolucion_mensual(anio, mes),
        'comparativo_mes_anterior': comparativo_mes_anterior(
            rentabilidad,
            rentabilidad_previa,
            hay_anterior,
            etiqueta_actual,
            etiqueta_anterior,
        ),
        'rentabilidad_por_paquete': paquetes,
        'analisis_por_tipo_evento': tipos_evento,
        'top_eventos_rentables': eventos_rentables[:5],
        'estado_pagos_cobranza': estado_pagos_cobranza(anio, mes),
    }
    data['interpretacion'] = interpretar_dashboard(data)
    return data


def interpretar_dashboard(data):
    mensajes = []
    ingresos = Decimal(str(data['ingresos_mes']))
    costos = Decimal(str(data['costos_directos_mes']))
    utilidad = Decimal(str(data['utilidad_neta']))
    margen = Decimal(str(data['margen_neto']))
    conversion = Decimal(str(data['tasa_conversion']))
    gastos = Decimal(str(data['gastos_fijos_mes']))
    comparacion = data['comparacion_mes_anterior']
    contratos = data['contratos_confirmados']
    cobranza = data['estado_pagos_cobranza']

    if contratos == 0:
        mensajes.append('Aun no hay contratos confirmados para este mes; no se registran ingresos financieros del periodo.')
    elif utilidad > 0:
        mensajes.append('El periodo muestra utilidad neta positiva despues de costos directos y gastos fijos.')
    else:
        mensajes.append('La utilidad neta no es positiva; conviene revisar costos directos, gastos fijos o valores finales negociados.')

    if contratos > 0 and costos == 0:
        mensajes.append('No hay costos directos registrados para los contratos confirmados del periodo; la utilidad bruta puede estar incompleta.')

    if gastos == 0:
        mensajes.append('No hay gastos fijos registrados para este mes.')

    if ingresos > 0 and gastos / ingresos > Decimal('0.35'):
        mensajes.append('Los gastos fijos representan una proporcion alta frente a los ingresos del mes.')

    if conversion == 0 and data['cotizaciones_mes'] > 0:
        mensajes.append('Hay cotizaciones recibidas sin contratos cerrados; el seguimiento comercial es prioritario.')
    elif conversion < 25 and data['cotizaciones_mes'] > 0:
        mensajes.append('La tasa de conversion es baja; conviene reforzar contacto y negociacion de cotizaciones nuevas.')
    elif conversion >= 25:
        mensajes.append('La conversion comercial ya genera contratos; puede analizarse que paquetes o eventos explican mejor el cierre.')

    if comparacion['hay_mes_anterior']:
        if comparacion['utilidad'] > 0:
            mensajes.append('La utilidad neta aumento frente al mes anterior, lo que sugiere mejor ingreso o mayor control de costos.')
        elif comparacion['utilidad'] < 0:
            mensajes.append('La utilidad neta bajo frente al mes anterior; se recomienda revisar cambios en ingresos, costos y gastos.')
    else:
        mensajes.append('No hay datos suficientes del mes anterior para una comparacion historica completa.')

    if data.get('paquete_mas_vendido'):
        mensajes.append(f"El paquete con mayor demanda es {data['paquete_mas_vendido']['nombre']}; puede priorizarse en publicaciones y seguimiento.")
    if data.get('paquete_mas_rentable'):
        mensajes.append(f"El paquete con mejor margen promedio es {data['paquete_mas_rentable']['nombre']}.")
    if data.get('tipo_evento_mas_frecuente'):
        mensajes.append(f"El tipo de evento mas frecuente es {data['tipo_evento_mas_frecuente']['nombre']}; ayuda a orientar la oferta comercial.")
    if data.get('tipo_evento_mas_rentable'):
        mensajes.append(f"El tipo de evento con mejor margen promedio es {data['tipo_evento_mas_rentable']['nombre']}.")
    if cobranza['monto_pendiente_por_cobrar'] > 0:
        mensajes.append('Existen contratos con saldo pendiente; conviene priorizar seguimiento de cobranza.')
    if margen < 10 and ingresos > 0:
        mensajes.append('El margen neto es reducido; una decision posible es renegociar costos directos o ajustar precios.')

    if not mensajes:
        mensajes.append('Aun no hay informacion suficiente para generar una interpretacion financiera.')

    return mensajes


def iter_months(desde, hasta):
    anio, mes = desde
    hasta_anio, hasta_mes = hasta
    while (anio, mes) <= (hasta_anio, hasta_mes):
        yield anio, mes
        if mes == 12:
            anio += 1
            mes = 1
        else:
            mes += 1


def reporte_financiero(desde, hasta):
    rows = []
    total_ingresos = Decimal('0.00')
    total_costos = Decimal('0.00')
    total_gastos = Decimal('0.00')
    total_utilidad = Decimal('0.00')
    for anio, mes in iter_months(desde, hasta):
        data = rentabilidad_mensual(anio, mes)
        total_ingresos += data['ingresos_mes']
        total_costos += data['costos_directos_mes']
        total_gastos += data['gastos_fijos_mes']
        total_utilidad += data['utilidad_neta']
        rows.append({
            'periodo': f'{anio}-{mes:02d}',
            'ingresos': decimal_to_number(data['ingresos_mes']),
            'costos_directos': decimal_to_number(data['costos_directos_mes']),
            'gastos_fijos': decimal_to_number(data['gastos_fijos_mes']),
            'utilidad_neta': decimal_to_number(data['utilidad_neta']),
            'margen_neto': decimal_to_number(data['margen_neto']),
        })
    margen_promedio = Decimal('0.00') if not total_ingresos else (total_utilidad / total_ingresos) * Decimal('100')
    data = {
        'resumen': {
            'ingresos_totales': decimal_to_number(total_ingresos),
            'costos_directos': decimal_to_number(total_costos),
            'gastos_fijos': decimal_to_number(total_gastos),
            'utilidad_neta': decimal_to_number(total_utilidad),
            'margen_neto_promedio': decimal_to_number(margen_promedio),
        },
        'resultados': rows,
    }
    data['interpretacion'] = interpretar_reporte_financiero(data)
    return data


def reporte_comercial(desde, hasta):
    rows = []
    total_cotizaciones = 0
    total_contratos = 0
    for anio, mes in iter_months(desde, hasta):
        cotizaciones, contratos, conversion = tasa_conversion(anio, mes)
        total_cotizaciones += cotizaciones
        total_contratos += contratos
        rows.append({
            'periodo': f'{anio}-{mes:02d}',
            'cotizaciones': cotizaciones,
            'contratos': contratos,
            'conversion': conversion,
        })
    conversion_total = 0 if total_cotizaciones == 0 else round((total_contratos / total_cotizaciones) * 100, 2)
    start, _ = month_bounds(*desde)
    _, end = month_bounds(*hasta)
    estados = (
        Cotizacion.objects.filter(fecha_registro__date__range=(start, end))
        .values('estado')
        .annotate(total=Count('id'))
        .order_by('estado')
    )
    data = {
        'resumen': {
            'cotizaciones': total_cotizaciones,
            'contratos': total_contratos,
            'conversion': conversion_total,
            'estados': {row['estado']: row['total'] for row in estados},
        },
        'resultados': rows,
    }
    data['interpretacion'] = interpretar_reporte_comercial(data)
    return data


def reporte_por_campo(desde, hasta, campo, etiqueta):
    start, _ = month_bounds(*desde)
    _, end = month_bounds(*hasta)
    campo_id = f'{campo}_id'
    campo_nombre = f'{campo}__nombre'
    costo_campo_id = f'contrato__{campo}_id'

    contratos_base = (
        Contrato.objects.filter(fecha_evento__range=(start, end))
        .exclude(estado_contrato=Contrato.ESTADO_CANCELADO)
        .exclude(**{f'{campo}__isnull': True})
    )
    contratos_rows = contratos_base.values(campo_id, campo_nombre).annotate(
        contratos=Count('id'),
        ingresos=Sum('valor_final'),
    )
    costos_rows = (
        CostoDirecto.objects.filter(contrato__fecha_evento__range=(start, end))
        .exclude(contrato__estado_contrato=Contrato.ESTADO_CANCELADO)
        .exclude(**{f'contrato__{campo}__isnull': True})
        .values(costo_campo_id)
        .annotate(costos=Sum('valor'))
    )
    costos_map = {
        row[costo_campo_id]: row['costos'] or Decimal('0.00')
        for row in costos_rows
    }

    rows = []
    for row in contratos_rows:
        ingresos = row['ingresos'] or Decimal('0.00')
        costos = costos_map.get(row[campo_id], Decimal('0.00'))
        utilidad = ingresos - costos
        margen = Decimal('0.00') if not ingresos else (utilidad / ingresos) * Decimal('100')
        rows.append({
            etiqueta: row[campo_nombre],
            'contratos': row['contratos'],
            'ingresos': decimal_to_number(ingresos),
            'utilidad': decimal_to_number(utilidad),
            'margen': decimal_to_number(margen),
        })
    rows.sort(key=lambda item: item['utilidad'], reverse=True)
    data = {'resumen': rows[0] if rows else {}, 'resultados': rows}
    data['interpretacion'] = interpretar_reporte_agrupado(data, etiqueta)
    return data


def desempeno_paquetes():
    paquetes = list(Paquete.objects.all())
    paquete_ids = [paquete.id for paquete in paquetes]
    cotizaciones_map = {
        row['paquete_id']: row['total']
        for row in Cotizacion.objects.filter(paquete_id__in=paquete_ids).values('paquete_id').annotate(total=Count('id'))
    }
    contratos_map = {
        row['cotizacion__paquete_id']: row
        for row in (
            Contrato.objects.filter(cotizacion__paquete_id__in=paquete_ids)
            .exclude(estado_contrato=Contrato.ESTADO_CANCELADO)
            .values('cotizacion__paquete_id')
            .annotate(
                contratos=Count('id'),
                eventos_realizados=Count('id', filter=Q(fecha_evento__lte=date.today())),
                ingresos=Sum('valor_final'),
            )
        )
    }
    costos_map = {
        row['contrato__cotizacion__paquete_id']: row['costos'] or Decimal('0.00')
        for row in (
            CostoDirecto.objects.filter(contrato__cotizacion__paquete_id__in=paquete_ids)
            .exclude(contrato__estado_contrato=Contrato.ESTADO_CANCELADO)
            .values('contrato__cotizacion__paquete_id')
            .annotate(costos=Sum('valor'))
        )
    }

    rows = []
    for paquete in paquetes:
        cotizaciones = cotizaciones_map.get(paquete.id, 0)
        contrato_data = contratos_map.get(paquete.id, {})
        contratos_count = contrato_data.get('contratos', 0)
        eventos_realizados = contrato_data.get('eventos_realizados', 0)
        ingresos = contrato_data.get('ingresos') or Decimal('0.00')
        utilidad = ingresos - costos_map.get(paquete.id, Decimal('0.00'))
        margen = Decimal('0.00') if not ingresos else (utilidad / ingresos) * Decimal('100')
        conversion = 0 if cotizaciones == 0 else round((contratos_count / cotizaciones) * 100, 2)
        rows.append({
            'id': paquete.id,
            'nombre': paquete.nombre,
            'contratos': contratos_count,
            'contratos_confirmados': contratos_count,
            'eventos_realizados': eventos_realizados,
            'cotizaciones': cotizaciones,
            'conversion': conversion,
            'ingresos': decimal_to_number(ingresos),
            'utilidad': decimal_to_number(utilidad),
            'margen': decimal_to_number(margen),
        })
    rows.sort(key=lambda item: item['contratos'], reverse=True)
    return rows


def interpretar_reporte_financiero(data):
    resumen = data['resumen']
    mensajes = []
    if not data['resultados']:
        return ['No hay datos suficientes para el periodo seleccionado.']
    if resumen['ingresos_totales'] == 0:
        mensajes.append('El periodo no registra ingresos por contratos; el resultado financiero se mantiene en cero o negativo si existen gastos.')
    elif resumen['utilidad_neta'] > 0:
        mensajes.append('El periodo acumula utilidad neta positiva despues de cubrir costos directos y gastos fijos.')
    else:
        mensajes.append('El periodo no genera utilidad neta positiva; se debe revisar estructura de costos, gastos fijos y precios finales.')
    mensajes.append('La comparacion mensual permite identificar meses con mejor desempeno y explicar variaciones de rentabilidad.')
    return mensajes


def interpretar_reporte_comercial(data):
    resumen = data['resumen']
    mensajes = []
    if resumen['cotizaciones'] == 0:
        return ['No hay cotizaciones registradas en el periodo seleccionado.']
    mensajes.append(f"Durante el periodo se recibieron {resumen['cotizaciones']} cotizaciones y se cerraron {resumen['contratos']} contratos.")
    if resumen['conversion'] < 25:
        mensajes.append('La conversion comercial es baja; conviene reforzar seguimiento de cotizaciones nuevas y contactadas.')
    else:
        mensajes.append('La conversion comercial muestra cierres defendibles para analizar que servicios convierten mejor.')
    if resumen.get('estados'):
        mensajes.append('La distribucion por estados ayuda a ubicar solicitudes que requieren contacto o decision comercial.')
    return mensajes


def interpretar_reporte_agrupado(data, etiqueta):
    rows = data['resultados']
    if not rows:
        return ['No hay contratos suficientes para calcular frecuencia o rentabilidad en este reporte.']
    principal = rows[0]
    nombre = principal.get(etiqueta, 'Sin clasificar')
    mensajes = [
        f"El grupo con mayor utilidad del periodo es {nombre}, con {principal['contratos']} contrato(s).",
        'Esta lectura permite decidir que ofertas, eventos o segmentos priorizar en campanas y seguimiento comercial.',
    ]
    if principal['margen'] <= 0:
        mensajes.append('La rentabilidad del grupo principal no es positiva; se recomienda revisar costos asociados o valor final negociado.')
    return mensajes
