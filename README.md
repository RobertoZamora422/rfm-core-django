# Sistema Comercial-Financiero para Salon de Eventos

Sistema web que conecta la pre-cotizacion publica de clientes con la gestion comercial interna, contratos y analisis financiero de un salon de eventos.

Flujo principal:

```text
pre-cotizacion publica -> cotizacion -> seguimiento -> contrato -> costos directos -> gastos fijos -> dashboard -> reportes
```

El sistema no reemplaza la asesoria humana ni el cierre comercial. Ayuda a captar solicitudes, organizarlas, dar seguimiento y analizar el desempeno del negocio con datos registrados en base de datos.

## Stack

- Django
- Django REST Framework
- SQLite
- React
- Vite
- Axios
- React Router

## Rutas publicas

- `/login`
- `/pre-cotizacion`
- `/pre-cotizacion/alquiler`
- `/pre-cotizacion/servicio-completo`
- `/pre-cotizacion/comparacion`

La pre-cotizacion publica no requiere login y no renderiza el layout administrativo.

## Rutas protegidas

- `/inicio`
- `/dashboard-financiero`
- `/paquetes`
- `/cotizaciones`
- `/cotizaciones/:id`
- `/cotizaciones/:id/convertir`
- `/contratos`
- `/eventos`
- `/clientes`
- `/costos-directos`
- `/gastos-fijos`
- `/reportes`
- `/configuracion`

Las rutas protegidas requieren token de DRF y usan el layout administrativo con sidebar y header.

## Credenciales demo

```text
usuario: admin
password: admin12345
```

## Comandos backend

```bash
python manage.py migrate
python manage.py seed_demo
python manage.py runserver
```

Si se usa el entorno virtual incluido en Windows:

```bash
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py seed_demo
.\venv\Scripts\python.exe manage.py runserver
```

## Comandos frontend

```bash
cd frontend
npm install
npm run dev
```

## Verificacion

```bash
python manage.py check
python manage.py test negocio
```

```bash
cd frontend
npm run build
```

## Datos reales vs simulados

Los modulos criticos consumen API real de Django:

- Pre-cotizacion publica
- Resultado de alquiler
- Resultado de servicio completo
- Resultado de comparacion
- Configuracion
- Clientes
- Paquetes
- Cotizaciones
- Conversion a contrato
- Contratos
- Costos directos
- Gastos fijos
- Dashboard financiero
- Reportes

No se usan archivos `mockData` ni fallbacks silenciosos en el frontend. Si la API falla, la interfaz muestra error y no inventa datos.

El comando `seed_demo` solo crea datos iniciales necesarios para operar el sistema:

- usuario `admin`
- configuracion inicial del negocio
- tipos de evento
- paquetes activos iniciales

No crea clientes, cotizaciones, contratos, costos directos ni gastos fijos. Esos registros se generan por el uso normal del sistema.

Exportaciones: en esta version academica solo se implementa `Imprimir reporte` con la funcionalidad nativa del navegador. No hay exportacion real a PDF ni Excel.

## Calculos financieros

Los calculos principales se realizan en backend:

- Monto estimado de alquiler con tarifa base, invitados incluidos y costo por invitado adicional.
- Monto estimado de servicio completo con `precio_por_persona * numero_invitados`.
- Total de costos directos por contrato.
- Utilidad bruta por evento.
- Margen bruto por evento.
- Ingresos mensuales.
- Costos directos mensuales.
- Gastos fijos mensuales.
- Utilidad neta mensual.
- Margen neto mensual.
- Tasa de conversion.
- Paquete mas vendido.
- Paquete mas rentable cuando hay datos suficientes.
- Tipo de evento mas frecuente.
- Comparacion con mes anterior.

Cuando no hay datos suficientes, la API devuelve ceros o mensajes controlados para interpretacion.

## Flujo de prueba recomendado

1. Abrir `/pre-cotizacion` sin login.
2. Llenar el formulario publico.
3. Ver el resultado calculado por backend.
4. Abrir WhatsApp y confirmar que usa el numero de `/api/configuracion/`.
5. Iniciar sesion con `admin / admin12345`.
6. Abrir `/cotizaciones` y revisar la cotizacion creada.
7. Entrar al detalle y cambiar estado.
8. Convertir la cotizacion a contrato.
9. Confirmar que el contrato aparece en `/contratos`.
10. Registrar un costo directo asociado al contrato.
11. Registrar un gasto fijo mensual.
12. Revisar `/dashboard-financiero` con mes/anio actual.
13. Revisar `/reportes` por tipo y usar `Imprimir reporte`.

## Alcance mantenido

El sistema se mantiene como herramienta academica comercial-financiera. No incluye pagos en linea, reservas automaticas, inventario completo, facturacion electronica, IA ni decisiones automaticas de venta.
