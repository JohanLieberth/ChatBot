# BitFix v3 - Taller de Reparaciones (Google Apps Script Web App)

Aplicación web completa desarrollada sobre Google Apps Script (`HtmlService` + `SpreadsheetApp` + `GmailApp`) para la gestión integral de órdenes de servicio, seguimiento técnico, portal cliente, recompensas por puntos, tarjetas NFC y facturación/pagos en el taller **BitFix v3**.

---

## 🛠 Características Principales

1. **Tres Perfiles de Usuario**:
   - **Administrador / Recepción**: Gestión completa de órdenes, equipos, técnicos, reasignaciones, cobros, reenvío de correos, canje de puntos, vinculación NFC e impresión de tickets/etiquetas.
   - **Técnico**: Panel simplificado de trabajos asignados, actualización de diagnósticos y fallas, avance de estatus con correo automático al cliente en "Listo para recolección", y bitácora de tiempo/minutos trabajados.
   - **Cliente (Portal Público)**: Autenticación segura mediante Teléfono + Contraseña (SHA-256), consulta en tiempo real del estado de sus equipos, saldo e historial de puntos, UID de NFC y recibos de pago.

2. **Consulta Rápida Pública**:
   - Permite a cualquier usuario consultar el avance de su reparación mediante su **ServicioID** (ej. `SRV001`) sin exponer datos personales sensibles.

3. **Impresión Térmica y Etiquetas**:
   - **Comprobante**: Ticket térmico en formato de 58 mm de ancho.
   - **Etiqueta**: Etiqueta adhesiva para dispositivo en formato 50x30 mm con código QR dinamizado mediante `api.qrserver.com`.

4. **Reglas de Negocio & Seguridad**:
   - Manejo de concurrencia mediante `LockService.getScriptLock()`.
   - Control estricto de roles en el backend para todos los endpoints.
   - Generación de IDs correlativos con ceros a la izquierda (`OS001`, `DET001`, `SRV001`, etc.).
   - Recálculo automático de totales y estado general de la orden (soporte para *Entregado Parcial*).
   - Notificaciones por correo electrónico con registro de auditoría en `NotificacionesLog` e idempotencia.

---

## 📋 Hojas de Cálculo Utilizadas (Modelo de Datos)

El sistema utiliza el archivo Excel/Spreadsheet de la operación del taller con las siguientes hojas:

| Hoja | Llave Primaria | Uso en la App |
| --- | --- | --- |
| `Clientes` | `Telefono` | Registro de clientes/talleres (badge diferenciado). |
| `UsuariosPortal` | `UsuarioID` | Autenticación del portal de clientes. |
| `Equipos` | `EquipoID` | Dispositivos pertenecientes a los clientes. |
| `OrdenServicio` | `OrdenID` | Encabezado de la orden de recepción. |
| `DetalleOrden` | `DetalleID` | Relación 1 equipo ↔ 1 orden con estatus individual. |
| `Servicios` | `ServicioID` | Diagnósticos, soluciones, garantía y costos. |
| `Asignaciones` | `AsignacionID` | Asignaciones históricas/múltiples de técnicos. |
| `ActividadesTecnico` | `ActividadID` | Bitácora de minutos e intervenciones por técnico. |
| `HistorialServicio` | `HistorialID` | Auditoría de cambios de estatus. |
| `Pagos` | `PagoID` | Registro de abonos y saldos pendientes. |
| `NFC` | `NFC_ID` | Vinculación de UID físico de tarjetas NFC con cliente. |
| `MovimientosPuntos` | `MovimientoID` | Bitácora de acumulación y canje de puntos. |
| `SaldoPuntos` | `Telefono` | Saldo materializado de puntos. |
| `Talleres` | `Telefono` | Datos extendidos para clientes tipo Taller. |
| `Admins` | `AdminID` | Roles del sistema (Administrador / Recepción / Técnico) y Email de Google. |
| `TablaPuntos` | `Accion` | Reglas de bonificación de puntos. |
| `Configuracion` | `Parametro` | Configuración global, plantillas y URLs. |
| `NotificacionesLog` | `NotifID` | **(Nueva)** Auditoría de envíos de correos. |
| `EtiquetasImpresas` | `EtiquetaID` | **(Nueva)** Auditoría de impresiones de tickets y etiquetas. |

---

## 🚀 Instrucciones de Configuración e Instalación

### 1. Vincular el Script a la Hoja de Cálculo
1. Abre tu hoja de cálculo de Google Spreadsheet (*BitFix_V3_Operacion_Taller*).
2. Ve al menú **Extensiones** → **Apps Script**.
3. Copia todos los archivos de este repositorio (`Code.gs`, `Auth.gs`, `Ordenes.gs`, `Servicios.gs`, `Tecnicos.gs`, `Admin.gs`, `Portal.gs`, `Puntos.gs`, `NFC.gs`, `Pagos.gs`, `Impresion.gs`, `Notificaciones.gs`, `setup.gs`, `Utils.gs`, `appsscript.json` y las plantillas HTML) en el editor de Apps Script.

### 2. Autorizar Permisos y Scopes
Al ejecutar por primera vez cualquier función, Google solicitará autorización para los siguientes ámbitos (scopes):
- `https://www.googleapis.com/auth/spreadsheets` (Lectura y escritura en la base de datos de Sheets)
- `https://www.googleapis.com/auth/gmail.send` (Envío de notificaciones por correo)
- `https://www.googleapis.com/auth/userinfo.email` (Verificación del correo de la sesión activa de Google)

### 3. Inicializar el Esquema (`setupSchema`)
1. Recarga la pestaña de la Hoja de Cálculo. Aparecerá un menú superior llamado **BitFix**.
2. Haz clic en **BitFix** → **Inicializar sistema** (o ejecuta manualmente la función `setupSchema()` desde el editor de Apps Script).
3. `setupSchema()` es **idempotente**:
   - Agregará automáticamente las columnas faltantes (`Equipos.NoSerie`, `OrdenServicio.FechaHoraRecepcion`, `OrdenServicio.CostoEstimado`, `OrdenServicio.TotalFinal`, `Servicios.CostoDiagnostico`, `Servicios.CostoFinal`, `Servicios.FallaReportada`, `Servicios.ListoParaRecoleccion`, `DetalleOrden.TecnicoAsignadoID`, `UsuariosPortal.PasswordHash`, `UsuariosPortal.FechaRegistro`, `Admins.Email`).
   - Creará las hojas `NotificacionesLog` y `EtiquetasImpresas` si no existen.
   - Sembrará la configuración por defecto y las plantillas de correo en `Configuracion` y `TablaPuntos`.

### 4. Desplegar como Web App
1. En la esquina superior derecha del editor de Apps Script, haz clic en **Desplegar** → **Nuevo despliegue**.
2. Selecciona **Aplicación web**:
   - **Ejecutar como**: *Usuario que accede a la aplicación web* o *Yo (tu cuenta)* (`USER_DEPLOYING`).
   - **Quién tiene acceso**: *Cualquier persona* (`ANYONE_ANONYMOUS`).
3. Haz clic en **Desplegar** y copia la URL proporcionada.
4. Actualiza el parámetro `URLPortal` en la hoja `Configuracion` con la URL de tu despliegue.

---

## 👥 Cuentas de Prueba Preexistentes

Puedes probar los 3 perfiles utilizando los datos existentes en la hoja de cálculo:

1. **Perfil Administrador / Recepción**:
   - **Cuenta**: `ADM001` (Admin Principal). Asegúrate de agregar tu correo de Google en la columna `Email` de la hoja `Admins` para acceder como admin con tu sesión iniciada.
   - **Acceso**: Menú "Acceso Taller" o navegando a `?page=admin`.

2. **Perfil Técnico**:
   - **Cuenta**: `ADM003` (Técnico de consolas).
   - **Acceso**: Menú "Acceso Taller" o navegando a `?page=tecnico`.
   - **Órdenes asignadas**: `OS001` / `SRV001`.

3. **Perfil Cliente (Portal Público)**:
   - **Teléfono de prueba**: `9991000001` (Juan Pérez).
   - **Registro / Login**: Navega a `?page=portal_registro` para crear una contraseña con el teléfono `9991000001`, o inicia sesión directamente en `?page=login` tras registrarte.
