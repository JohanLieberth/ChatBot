import os
import re
from playwright.sync_api import sync_playwright

def prepare_html():
    with open('Index.html', 'r') as f:
        html = f.read()

    # Replace includes
    def replace_include(match):
        filename = match.group(1).strip("'").strip('"')
        filepath = f"{filename}.html"
        if os.path.exists(filepath):
            with open(filepath, 'r') as inc:
                return inc.read()
        return f"<!-- {filename} not found -->"

    html = re.sub(r"<\?!= include\((.*?)\); \?>", replace_include, html)

    # Mock google.script.run
    mock_script = """
    <script>
    window.google = {
        script: {
            run: {
                withSuccessHandler: function(handler) {
                    return {
                        validarRFC: function(rfc) {
                            setTimeout(() => handler(true), 50);
                        },
                        geocodificarDireccion: function(dir) {
                            setTimeout(() => handler({lat: 20.967, lng: -89.623, formatted_address: 'Mérida, Yuc.'}), 50);
                        },
                        procesarRegistroCompleto: function(data) {
                            setTimeout(() => handler({success: true, empresaId: 'EMP-12345'}), 100);
                        },
                        obtenerEstatusInsignia: function(id) {
                            setTimeout(() => handler({
                                idEmpresa: id,
                                estatus: 'Capacitación programada',
                                progreso: 50,
                                capacitaciones: [
                                    {tipo: 'Sensibilización de Género', fecha: '12/10/2023', asistentes: 15, evidencia: '#'}
                                ],
                                planTrabajo: [
                                    {actividad: 'Instalación de botones de pánico', fecha: '15/10/2023', responsable: 'Luis M.', estatus: 'Pendiente'}
                                ],
                                sucursales: []
                            }), 100);
                        },
                        generarCredencialPDF: function(id) {
                            setTimeout(() => handler('https://example.com/mock.pdf'), 50);
                        }
                    };
                }
            }
        }
    };
    </script>
    """
    html = html.replace('</head>', mock_script + '</head>')

    with open('preview.html', 'w') as f:
        f.write(html)

def run_cuj(page):
    page.goto(f"file://{os.getcwd()}/preview.html")
    page.wait_for_timeout(500)

    # Step 1: Fill Fiscal Data
    page.fill('#rfc', 'GARM800101XYZ')
    page.fill('#representante', 'Juan Perez')
    page.fill('#telefono', '9991234567')
    page.fill('#email', 'juan@empresa.com')
    page.wait_for_timeout(500)

    page.click('button:has-text("Guardar y continuar")')
    page.wait_for_timeout(500)

    # Step 2: Branches
    page.fill('input[onchange*="nombre"]', 'Sucursal Norte')
    page.fill('input[onchange*="direccion"]', 'Calle 60, Merida')
    page.wait_for_timeout(500)

    page.click('button:has-text("Continuar al mapa")')
    page.wait_for_timeout(500)

    # Step 3: Map
    page.click('#submit-btn')
    page.wait_for_timeout(2000)

    # Step 4: Tracking Panel
    page.screenshot(path="/home/jules/verification/screenshots/tracking_panel.png")
    page.wait_for_timeout(500)

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    prepare_html()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 1280, 'height': 900}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()
            browser.close()
