import os
from decimal import Decimal

from django.conf import settings
from django.contrib.auth.models import User
from django.core.management.base import BaseCommand, CommandError

from negocio.models import ConfiguracionNegocio, Paquete, TipoEvento


class Command(BaseCommand):
    help = 'Crea datos iniciales minimos para operar el sistema comercial-financiero.'

    def handle(self, *args, **options):
        allow_production = os.environ.get('ALLOW_DEMO_SEED_IN_PRODUCTION', '').strip().lower() in {'1', 'true', 'yes', 'si', 'sí'}
        if not settings.DEBUG and not allow_production:
            raise CommandError('seed_demo crea credenciales demo; no debe ejecutarse con DEBUG=False.')

        user, _ = User.objects.get_or_create(username='admin')
        user.email = 'admin@salon.test'
        user.is_staff = True
        user.is_superuser = True
        user.set_password('admin12345')
        user.save()

        ConfiguracionNegocio.objects.update_or_create(
            pk=1,
            defaults={
                'nombre_negocio': 'Salon de Eventos',
                'whatsapp': '0991234567',
                'correo': 'contacto@salon.test',
                'direccion': 'Esmeraldas, Ecuador',
                'tarifa_base_alquiler': Decimal('350.00'),
                'invitados_incluidos': 100,
                'costo_invitado_adicional': Decimal('1.50'),
            },
        )

        for nombre in [
            'Boda',
            'Quinceanios',
            'Cumpleanios',
            'Bautizo',
            'Graduacion',
            'Baby shower',
            'Evento corporativo',
            'Evento social',
            'Otros',
        ]:
            TipoEvento.objects.update_or_create(
                nombre=nombre,
                defaults={'activo': True, 'descripcion': f'Tipo de evento: {nombre}.'},
            )

        for nombre, precio in [('Estandar', '10.00'), ('Premium', '15.00'), ('VIP', '21.00')]:
            Paquete.objects.update_or_create(
                nombre=nombre,
                defaults={
                    'descripcion': f'Paquete {nombre} para servicio completo.',
                    'precio_por_persona': Decimal(precio),
                    'tipo_servicio': 'Servicio completo',
                    'activo': True,
                },
            )

        self.stdout.write(self.style.SUCCESS('Datos iniciales creados. Usuario: admin / admin12345'))
