# Sistema administrativo de paquetes para un salón de eventos

## Descripción
Este proyecto consiste en una aplicación web desarrollada con Django que implementa un sistema de autenticación de usuarios y un CRUD completo sobre la entidad **Paquete**.

La aplicación fue desarrollada aplicando el patrón **MVC/MVT** y asegurando que las rutas protegidas no sean accesibles sin autenticación.

## Objetivo
Permitir que un usuario autenticado pueda administrar paquetes de un salón de eventos mediante las operaciones CRUD.

## Funcionalidades
- Inicio de sesión con usuario y contraseña
- Cierre de sesión
- Protección de rutas mediante autenticación
- Listado de paquetes
- Creación de paquetes
- Edición de paquetes
- Eliminación de paquetes

## Tecnologías utilizadas
- Python
- Django
- SQLite
- HTML

## Estructura del proyecto
- `models.py`: definición del modelo `Paquete`
- `views.py`: lógica del CRUD
- `urls.py`: rutas de la aplicación
- `templates/`: interfaces HTML
- `settings.py`: configuración general del proyecto

## Patrón aplicado
Aunque Django trabaja con el patrón **MVT**, este se considera académicamente una variante del patrón **MVC**:

- **Model** → `models.py`
- **View / lógica** → `views.py`
- **Template** → archivos HTML en `templates`

## Modelo principal

### Paquete
- `nombre`
- `descripcion`
- `precio`
- `estado`

## Requisitos
- Python 3.x
- pip
- entorno virtual recomendado

## Instalación y ejecución

### 1. Clonar el repositorio
```bash
git clone https://github.com/RobertoZamora422/rfm-core-django.git
cd rfm-core-django
```

### 2. Crear entorno virtual
```bash
python -m venv venv
```

### 3. Activar entorno virtual

#### En Windows PowerShell
```bash
venv\Scripts\Activate.ps1
```

#### En Windows CMD
```bash
venv\Scripts\activate
```

### 4. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 5. Aplicar migraciones
```bash
python manage.py makemigrations
python manage.py migrate
```

### 6. Crear superusuario
```bash
python manage.py createsuperuser
```

### 7. Ejecutar el servidor
```bash
python manage.py runserver
```

## Acceso al sistema
- Ruta principal: `http://127.0.0.1:8000/`
- Panel de administración: `http://127.0.0.1:8000/admin/`

## Cumplimiento
- Implementa autenticación con login
- Protege las rutas del CRUD
- Impide el acceso sin iniciar sesión
- Permite crear, leer, actualizar y eliminar paquetes

## Autor
Roberto Zamora