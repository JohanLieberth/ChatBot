# Guía de Integración con AppSheet

Para la administración y seguimiento por parte del equipo evaluador, se recomienda utilizar AppSheet conectado al mismo Google Sheet.

## 1. Crear la App en AppSheet
1. Vaya a [appsheet.com](https://www.appsheet.com).
2. Cree una nueva App desde sus propios datos (`Create` > `App` > `Start with existing data`).
3. Seleccione el Google Sheet que está utilizando para el sistema.

## 2. Configuración de Tablas
Agregue las siguientes tablas desde el Sheet:
- `Empresas_Registradas`
- `Sucursales`
- `Plan_Trabajo`
- `Log_Cambios_Estatus`

### Configuración Recomendada:
- **Empresas_Registradas:**
  - Marque `RFC` como Label.
  - El campo `Estatus` debe ser un `Enum` con los valores: `En revisión`, `Plan de trabajo asignado`, `En implementación`, `Evaluación`, `Insignia Otorgada`, `Rechazada`.
- **Sucursales:**
  - Configure `Latitud` y `Longitud` como tipo `LatLong`.
  - Cree un Virtual Column para mostrar un mapa.

## 3. Vistas (UX)
- **Dashboard:** Cree una vista tipo Dashboard que combine un Mapa de sucursales y un Gráfico de empresas por estatus.
- **Lista de Empresas:** Vista tipo Deck o Table para ver rápidamente los registros.

## 4. Automatizaciones (Bot)
- **Cambio de Estatus:** Puede configurar un Bot en AppSheet que envíe un correo cada vez que el equipo evaluador cambie el valor de la columna `Estatus`.
- **Recordatorios:** Configure un Bot programado para alertar sobre actividades del `Plan_Trabajo` que estén cerca de su `Fecha_Compromiso`.

## 5. Seguridad
- Active el `Require user authentication` en AppSheet.
- Use la tabla `Usuarios_Admin` para controlar quién puede entrar a la app de administración.
