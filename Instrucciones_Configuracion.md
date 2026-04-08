# Instrucciones de Configuración - Sistema Mujeres Seguras

Este sistema está desarrollado para funcionar sobre la plataforma de Google Apps Script.

## 1. Preparación del Google Sheet
1. Cree un nuevo Google Sheet.
2. No es necesario crear las hojas manualmente, el script las creará en la primera ejecución, pero asegúrese de tener permisos de edición.
3. Copie el **ID del Spreadsheet** (se encuentra en la URL: `https://docs.google.com/spreadsheets/d/ID_AQUI/edit`).

## 2. Configuración en Apps Script
1. Abra el Google Sheet y vaya a `Extensiones` > `Apps Script`.
2. Cree los siguientes archivos y pegue el código correspondiente proporcionado en este repositorio:
   - `Código.gs`
   - `Index.html`
   - `Panel.html`
   - `CSS.html`
   - `JS.html`
3. En `Código.gs`, busque la variable `SPREADSHEET_ID` y reemplace `YOUR_SPREADSHEET_ID` con el ID de su hoja de cálculo.

## 3. Despliegue de la Web App
1. Haga clic en el botón `Implementar` (Deploy) > `Nueva implementación`.
2. Seleccione el tipo `Aplicación web`.
3. Configuración:
   - **Descripción:** Sistema Registro Mujeres Seguras v1
   - **Ejecutar como:** Yo (su cuenta)
   - **Quién tiene acceso:** Cualquier persona (para permitir registros públicos)
4. Haga clic en `Implementar`.
5. Autorice los permisos necesarios (Google Sheets, Gmail, Drive).
6. Copie la **URL de la aplicación web** generada.

## 4. Configuración de Google Drive
El sistema creará automáticamente una carpeta llamada `Mujeres_Seguras_Evidencias` en su unidad para guardar los archivos subidos por las empresas. Asegúrese de que la cuenta que despliega el script tenga espacio suficiente.

## 5. Pruebas Iniciales
1. Abra la URL de la aplicación web.
2. Realice un registro de prueba.
3. Verifique que se cree la fila en el Google Sheet y se envíe el correo de confirmación.
4. Intente reingresar al Panel usando el RFC registrado.
