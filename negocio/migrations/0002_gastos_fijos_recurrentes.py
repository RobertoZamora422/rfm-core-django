from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('negocio', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='gastofijomensual',
            name='anio',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AlterField(
            model_name='gastofijomensual',
            name='mes',
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='gastofijomensual',
            name='activo',
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name='gastofijomensual',
            name='categoria',
            field=models.CharField(default='General', max_length=80),
        ),
        migrations.AddField(
            model_name='gastofijomensual',
            name='fecha_fin',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='gastofijomensual',
            name='fecha_inicio',
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='gastofijomensual',
            name='frecuencia',
            field=models.CharField(choices=[('mensual', 'Mensual')], default='mensual', max_length=20),
        ),
    ]
