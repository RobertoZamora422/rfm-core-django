from decimal import Decimal
from datetime import date, timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

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


class NegocioApiTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='admin', password='admin12345')
        self.api = APIClient()
        self.api.force_authenticate(user=self.user)

        ConfiguracionNegocio.objects.create(
            nombre_negocio='Salon de Eventos',
            whatsapp='0991234567',
            tarifa_base_alquiler=Decimal('350.00'),
            invitados_incluidos=100,
            costo_invitado_adicional=Decimal('1.50'),
        )
        self.evento = TipoEvento.objects.create(nombre='Boda')
        self.paquete = Paquete.objects.create(nombre='Premium', precio_por_persona=Decimal('15.00'))
        self.cliente = Cliente.objects.create(nombre='Ana García', telefono='0991111111')
        self.cotizacion = Cotizacion.objects.create(
            cliente=self.cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa='2026-07-20',
            numero_invitados=150,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('2250.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        self.contrato = Contrato.objects.create(
            cotizacion=self.cotizacion,
            fecha_evento='2026-07-20',
            valor_final=Decimal('2200.00'),
            estado_pago=Contrato.PAGO_ABONADO,
            monto_abonado=Decimal('500.00'),
        )
        CostoDirecto.objects.create(contrato=self.contrato, concepto='Catering', valor=Decimal('900.00'))
        CostoDirecto.objects.create(contrato=self.contrato, concepto='Decoración', valor=Decimal('250.00'))
        GastoFijoMensual.objects.create(anio=2026, mes=7, concepto='Publicidad', valor=Decimal('150.00'))

    def test_contrato_calcula_utilidad_y_margen_bruto(self):
        self.assertEqual(self.contrato.total_costos_directos(), Decimal('1150.00'))
        self.assertEqual(self.contrato.utilidad_bruta(), Decimal('1050.00'))
        self.assertAlmostEqual(float(self.contrato.margen_bruto()), 47.73, places=2)
        self.assertEqual(self.contrato.saldo_pendiente(), Decimal('1700.00'))

    def test_dashboard_financiero_mensual(self):
        response = self.api.get('/api/dashboard-financiero/?anio=2026&mes=7')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['ingresos_mes'], 2200.0)
        self.assertEqual(response.data['costos_directos_mes'], 1150.0)
        self.assertEqual(response.data['gastos_fijos_mes'], 150.0)
        self.assertEqual(response.data['utilidad_neta'], 900.0)
        self.assertEqual(response.data['ticket_promedio'], 2200.0)
        self.assertEqual(response.data['estado_pagos_cobranza']['abonados'], 1)
        self.assertEqual(response.data['estado_pagos_cobranza']['monto_pendiente_por_cobrar'], 1700.0)

    def test_dashboard_excluye_contratos_cancelados_de_finanzas(self):
        cliente = Cliente.objects.create(nombre='Luis Mora', telefono='0992222222')
        cotizacion = Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa='2026-07-21',
            numero_invitados=80,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1200.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        contrato_cancelado = Contrato.objects.create(
            cotizacion=cotizacion,
            fecha_evento='2026-07-21',
            valor_final=Decimal('1200.00'),
            estado_contrato=Contrato.ESTADO_CANCELADO,
            estado_pago=Contrato.PAGO_PENDIENTE,
        )
        CostoDirecto.objects.create(contrato=contrato_cancelado, concepto='Musica', valor=Decimal('300.00'))

        response = self.api.get('/api/dashboard-financiero/?anio=2026&mes=7')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['ingresos_mes'], 2200.0)
        self.assertEqual(response.data['costos_directos_mes'], 1150.0)
        self.assertEqual(response.data['contratos_confirmados'], 1)
        self.assertEqual(response.data['estado_pagos_cobranza']['cancelados'], 1)
        self.assertEqual(response.data['estado_pagos_cobranza']['monto_pendiente_por_cobrar'], 1700.0)

    def test_pre_cotizacion_publica_crea_cliente_y_cotizacion(self):
        public_api = APIClient()
        response = public_api.post('/api/pre-cotizacion/', {
            'nombre': 'Cliente Publico',
            'telefono': '0995555555',
            'tipo_evento': self.evento.id,
            'fecha_tentativa': '2026-08-15',
            'numero_invitados': 150,
            'tipo_servicio': 'no_seguro',
        }, format='json')
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['tipo_resultado'], 'comparacion')
        self.assertEqual(response.data['alquiler']['total_estimado'], 425.0)
        self.assertTrue(Cliente.objects.filter(telefono='0995555555').exists())
        self.assertTrue(Cotizacion.objects.filter(cliente__telefono='0995555555', estado='nuevo').exists())

    def test_configuracion_get_es_publico(self):
        public_api = APIClient()
        response = public_api.get('/api/configuracion/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['whatsapp'], '0991234567')

    def test_desempeno_paquetes_incluye_eventos_realizados_sin_cancelados(self):
        paquete = Paquete.objects.create(nombre='Basico', precio_por_persona=Decimal('10.00'))
        cliente = Cliente.objects.create(nombre='Mario Ruiz', telefono='0993333333')
        cotizacion_confirmada = Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=paquete,
            fecha_tentativa=date.today(),
            numero_invitados=100,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1000.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        Contrato.objects.create(
            cotizacion=cotizacion_confirmada,
            fecha_evento=date.today(),
            valor_final=Decimal('1000.00'),
            estado_contrato=Contrato.ESTADO_CONFIRMADO,
            estado_pago=Contrato.PAGO_PAGADO,
        )
        cotizacion_cancelada = Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=paquete,
            fecha_tentativa=date.today(),
            numero_invitados=80,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('800.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        Contrato.objects.create(
            cotizacion=cotizacion_cancelada,
            fecha_evento=date.today(),
            valor_final=Decimal('800.00'),
            estado_contrato=Contrato.ESTADO_CANCELADO,
            estado_pago=Contrato.PAGO_PENDIENTE,
        )

        response = self.api.get('/api/paquetes/desempeno/')

        self.assertEqual(response.status_code, 200)
        row = next(item for item in response.data if item['id'] == paquete.id)
        self.assertEqual(row['cotizaciones'], 2)
        self.assertEqual(row['contratos'], 1)
        self.assertEqual(row['contratos_confirmados'], 1)
        self.assertEqual(row['eventos_realizados'], 1)
        self.assertEqual(row['conversion'], 50.0)

    def test_no_permite_marcar_cotizacion_como_convertida_sin_contrato(self):
        cotizacion = Cotizacion.objects.create(
            cliente=self.cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa='2026-08-20',
            numero_invitados=80,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1200.00'),
            estado=Cotizacion.ESTADO_NUEVO,
        )

        response = self.api.post(f'/api/cotizaciones/{cotizacion.id}/cambiar-estado/', {
            'estado': Cotizacion.ESTADO_CONVERTIDO,
        }, format='json')

        self.assertEqual(response.status_code, 400)
        cotizacion.refresh_from_db()
        self.assertEqual(cotizacion.estado, Cotizacion.ESTADO_NUEVO)

    def test_convertir_cotizacion_requiere_estado_confirmado(self):
        cotizacion = Cotizacion.objects.create(
            cliente=self.cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa='2026-08-20',
            numero_invitados=80,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1200.00'),
            estado=Cotizacion.ESTADO_CONTACTADO,
        )

        response = self.api.post(f'/api/cotizaciones/{cotizacion.id}/convertir-contrato/', {}, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertFalse(Contrato.objects.filter(cotizacion=cotizacion).exists())

    def test_convertir_cotizacion_confirmada_crea_contrato_pendiente(self):
        cotizacion = Cotizacion.objects.create(
            cliente=self.cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa='2026-08-20',
            numero_invitados=80,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1200.00'),
            estado=Cotizacion.ESTADO_CONFIRMADO,
        )

        response = self.api.post(f'/api/cotizaciones/{cotizacion.id}/convertir-contrato/', {}, format='json')

        self.assertEqual(response.status_code, 201)
        contrato = Contrato.objects.get(cotizacion=cotizacion)
        self.assertEqual(response.data['id'], contrato.id)
        self.assertEqual(contrato.fecha_evento, date(2026, 8, 20))
        self.assertEqual(contrato.valor_final, Decimal('1200.00'))
        self.assertEqual(contrato.estado_pago, Contrato.PAGO_PENDIENTE)
        self.assertEqual(contrato.monto_abonado, Decimal('0.00'))
        cotizacion.refresh_from_db()
        self.assertEqual(cotizacion.estado, Cotizacion.ESTADO_CONVERTIDO)

    def test_crear_contrato_por_api_sincroniza_estado_de_cotizacion(self):
        cotizacion = Cotizacion.objects.create(
            cliente=self.cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa='2026-08-21',
            numero_invitados=100,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1500.00'),
            estado=Cotizacion.ESTADO_CONFIRMADO,
        )

        response = self.api.post('/api/contratos/', {
            'cotizacion': cotizacion.id,
            'fecha_evento': '2026-08-21',
            'valor_final': '1500.00',
            'estado_contrato': Contrato.ESTADO_CONFIRMADO,
            'estado_pago': Contrato.PAGO_PENDIENTE,
            'monto_abonado': '0.00',
            'observaciones': '',
        }, format='json')

        self.assertEqual(response.status_code, 201)
        cotizacion.refresh_from_db()
        self.assertEqual(cotizacion.estado, Cotizacion.ESTADO_CONVERTIDO)

    def test_abonado_no_puede_igualar_el_valor_final(self):
        response = self.api.patch(f'/api/contratos/{self.contrato.id}/', {
            'estado_pago': Contrato.PAGO_ABONADO,
            'monto_abonado': str(self.contrato.valor_final),
        }, format='json')

        self.assertEqual(response.status_code, 400)
        self.assertIn('monto_abonado', response.data)

    def test_inicio_resumen_requiere_autenticacion(self):
        public_api = APIClient()
        response = public_api.get('/api/inicio-resumen/')

        self.assertIn(response.status_code, [401, 403])

    def test_inicio_resumen_excluye_cancelados_y_devuelve_id_de_contrato(self):
        today = date.today()
        cliente = Cliente.objects.create(nombre='Carla Vera', telefono='0994444444')
        cotizacion_confirmada = Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa=today + timedelta(days=3),
            numero_invitados=120,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1800.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        contrato_confirmado = Contrato.objects.create(
            cotizacion=cotizacion_confirmada,
            fecha_evento=today + timedelta(days=3),
            valor_final=Decimal('1800.00'),
            estado_contrato=Contrato.ESTADO_CONFIRMADO,
            estado_pago=Contrato.PAGO_PENDIENTE,
        )
        cotizacion_cancelada = Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa=today + timedelta(days=1),
            numero_invitados=80,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1200.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        contrato_cancelado = Contrato.objects.create(
            cotizacion=cotizacion_cancelada,
            fecha_evento=today + timedelta(days=1),
            valor_final=Decimal('1200.00'),
            estado_contrato=Contrato.ESTADO_CANCELADO,
            estado_pago=Contrato.PAGO_PENDIENTE,
        )

        response = self.api.get('/api/inicio-resumen/')

        self.assertEqual(response.status_code, 200)
        ids = [item['id'] for item in response.data['eventos_proximos']]
        self.assertIn(contrato_confirmado.id, ids)
        self.assertNotIn(contrato_cancelado.id, ids)

    def test_inicio_resumen_construye_pendientes_con_datos_reales(self):
        today = date.today()
        cliente = Cliente.objects.create(nombre='Sin Telefono', telefono='')
        Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa=today + timedelta(days=5),
            numero_invitados=90,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1350.00'),
            estado=Cotizacion.ESTADO_NUEVO,
        )
        cotizacion_evento = Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa=today + timedelta(days=4),
            numero_invitados=100,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1500.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        Contrato.objects.create(
            cotizacion=cotizacion_evento,
            fecha_evento=today + timedelta(days=4),
            valor_final=Decimal('1500.00'),
            estado_contrato=Contrato.ESTADO_CONFIRMADO,
            estado_pago=Contrato.PAGO_ABONADO,
            monto_abonado=Decimal('500.00'),
        )
        cotizacion_sin_costos = Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa=today - timedelta(days=1),
            numero_invitados=100,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1500.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        Contrato.objects.create(
            cotizacion=cotizacion_sin_costos,
            fecha_evento=today - timedelta(days=1),
            valor_final=Decimal('1500.00'),
            estado_contrato=Contrato.ESTADO_CONFIRMADO,
            estado_pago=Contrato.PAGO_PAGADO,
            monto_abonado=Decimal('1500.00'),
        )

        response = self.api.get('/api/inicio-resumen/')

        self.assertEqual(response.status_code, 200)
        tipos = {item['tipo'] for item in response.data['pendientes_importantes']}
        self.assertIn('cotizaciones_nuevas_sin_contacto', tipos)
        self.assertIn('eventos_proximos_con_saldo', tipos)
        self.assertIn('eventos_realizados_sin_costos', tipos)
        self.assertIn('clientes_sin_telefono', tipos)

    def test_contratos_filtra_por_desde_y_hasta(self):
        cliente = Cliente.objects.create(nombre='Filtro Fecha', telefono='0995550000')
        cotizacion_dentro = Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa='2030-01-15',
            numero_invitados=100,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1500.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        contrato_dentro = Contrato.objects.create(
            cotizacion=cotizacion_dentro,
            fecha_evento='2030-01-15',
            valor_final=Decimal('1500.00'),
            estado_contrato=Contrato.ESTADO_CONFIRMADO,
            estado_pago=Contrato.PAGO_PENDIENTE,
        )
        cotizacion_fuera = Cotizacion.objects.create(
            cliente=cliente,
            tipo_evento=self.evento,
            paquete=self.paquete,
            fecha_tentativa='2030-02-15',
            numero_invitados=100,
            tipo_servicio=Cotizacion.SERVICIO_COMPLETO,
            monto_estimado=Decimal('1500.00'),
            estado=Cotizacion.ESTADO_CONVERTIDO,
        )
        contrato_fuera = Contrato.objects.create(
            cotizacion=cotizacion_fuera,
            fecha_evento='2030-02-15',
            valor_final=Decimal('1500.00'),
            estado_contrato=Contrato.ESTADO_CONFIRMADO,
            estado_pago=Contrato.PAGO_PENDIENTE,
        )

        response = self.api.get('/api/contratos/?desde=2030-01-01&hasta=2030-01-31')

        self.assertEqual(response.status_code, 200)
        ids = [item['id'] for item in response.data]
        self.assertIn(contrato_dentro.id, ids)
        self.assertNotIn(contrato_fuera.id, ids)

    def test_contratos_rechaza_fechas_invalidas_o_invertidas(self):
        response_invalida = self.api.get('/api/contratos/?desde=fecha-mala')
        response_invertida = self.api.get('/api/contratos/?desde=2030-02-01&hasta=2030-01-01')

        self.assertEqual(response_invalida.status_code, 400)
        self.assertEqual(response_invertida.status_code, 400)
