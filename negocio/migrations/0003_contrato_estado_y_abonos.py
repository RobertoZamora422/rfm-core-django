from decimal import Decimal

from django.db import migrations, models


def inicializar_montos_abonados(apps, schema_editor):
    Contrato = apps.get_model('negocio', 'Contrato')
    for contrato in Contrato.objects.all():
        if contrato.estado_pago == 'pagado':
            contrato.monto_abonado = contrato.valor_final
        elif contrato.estado_pago == 'pendiente':
            contrato.monto_abonado = Decimal('0.00')
        contrato.save(update_fields=['monto_abonado'])


class Migration(migrations.Migration):

    dependencies = [
        ('negocio', '0002_gastos_fijos_recurrentes'),
    ]

    operations = [
        migrations.AddField(
            model_name='contrato',
            name='estado_contrato',
            field=models.CharField(choices=[('confirmado', 'Confirmado'), ('cancelado', 'Cancelado')], default='confirmado', max_length=20),
        ),
        migrations.AddField(
            model_name='contrato',
            name='monto_abonado',
            field=models.DecimalField(decimal_places=2, default=Decimal('0.00'), max_digits=10),
        ),
        migrations.RunPython(inicializar_montos_abonados, migrations.RunPython.noop),
    ]
