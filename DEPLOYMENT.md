# Guía de Despliegue: Insignia Mujeres Seguras

Sigue estos pasos para poner en marcha la aplicación web.

## 1. Configuración de Google Sheets
Crea un nuevo Spreadsheet de Google y renombra las hojas exactamente como se indica:

1. **Empresas**: Columnas: `ID_Empresa`, `RFC`, `Representante_Legal`, `Telefono`, `Email`, `Fecha_Registro`, `Estatus_Actual`
2. **Sucursales**: Columnas: `ID_Sucursal`, `ID_Empresa`, `Nombre`, `Direccion`, `Latitud`, `Longitud`, `Horario`, `Telefono_Local`, `Responsable`, `Cargo`
3. **Capacitaciones**: Columnas: `ID_Capacitacion`, `ID_Empresa`, `Fecha`, `Tipo`, `Asistentes`, `Evidencia_URL`
4. **Plan_Trabajo**: Columnas: `ID_Plan`, `ID_Empresa`, `Actividad`, `Fecha_Compromiso`, `Responsable`, `Estatus`
5. **Estatus_Insignia**: Columnas: `ID_Estatus`, `ID_Empresa`, `Estatus`, `Fecha_Actualizacion`
6. **Logs_Webhook**: Columnas: `ID_Log`, `Fecha`, `Payload`, `Resultado`

*Copia el ID del Spreadsheet de la URL.*

## 2. Configuración en Google Apps Script
1. Ve a [script.google.com](https://script.google.com).
2. Crea un "Nuevo proyecto".
3. Copia el contenido de los archivos proporcionados:
   - `Código.gs`
   - `Index.html`
   - `Estilos.html`
   - `JavaScript.html`
   - `Manifest.html`
   - `ServiceWorker.html`
4. En `Código.gs`, actualiza el objeto `CONFIG`:
   - `SHEET_ID`: El ID de tu Spreadsheet.
   - `MAPS_API_KEY`: Tu API Key de Google Maps (debes habilitar Maps JavaScript API y Geocoding API en Google Cloud Console).
   - `APPSHEET_APP_ID` y `APPSHEET_ACCESS_KEY`: Si ya tienes la app de AppSheet configurada.
5. En `JavaScript.html` (al final), reemplaza `YOUR_API_KEY` por tu API Key de Maps.

## 3. Despliegue de la Aplicación Web
1. Haz clic en el botón **"Implementar"** (Deploy) > **"Nueva implementación"**.
2. Tipo: **"Aplicación web"**.
3. Descripción: "Registro Mujeres Seguras v1".
4. Ejecutar como: **"Yo"** (Tu cuenta).
5. Quién tiene acceso: **"Cualquiera"** (o según tu organización).
6. Haz clic en "Implementar" y autoriza los permisos necesarios.
7. Copia la **URL de la aplicación web**.

## 4. Configuración del Webhook en AppSheet
Para la sincronización bidireccional:
1. En AppSheet, ve a **Automation** > **Tasks**.
2. Crea una nueva tarea de tipo **"Call a Webhook"**.
3. URL: La URL de la aplicación web que copiaste en el paso anterior.
4. HTTP Verb: `POST`.
5. Body: Configura el JSON que deseas enviar a la aplicación web (ej. el nuevo estatus).

## 5. Pruebas
1. Abre la URL de la aplicación web.
2. Completa el registro de una empresa y al menos una sucursal.
3. Verifica que los datos se guarden correctamente en Google Sheets.
4. Si configuraste AppSheet, verifica que se cree la fila correspondiente.
