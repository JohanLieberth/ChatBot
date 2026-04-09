import os

def generate_preview(main_file, output_file, is_panel=False):
    with open(main_file, 'r') as f:
        content = f.read()

    with open('CSS.html', 'r') as f:
        css = f.read()

    js_content = ""
    if not is_panel:
        with open('JS.html', 'r') as f:
            js_content = f.read()

    combined = content.replace("<?!= include('CSS'); ?>", css)
    if not is_panel:
        combined = combined.replace("<?!= include('JS'); ?>", js_content)

    # Mock GAS script.run and add validation bypass logic
    # We use a script at the very end to ensure it runs after JS.html
    mock_script = """
    <script>
      // GAS Mock
      window.google = {
        script: {
          run: {
            withSuccessHandler: function(cb) { this.successCb = cb; return this; },
            withFailureHandler: function(cb) { this.failureCb = cb; return this; },
            checkRFCExists: function(rfc) {
              console.log('Mock: checkRFCExists', rfc);
              if (this.successCb) this.successCb(false);
            },
            processRegistration: function(data) {
              console.log('Mock: processRegistration', data);
              if (this.successCb) this.successCb({success: true, folio: 'MS-PREVIEW-123'});
            },
            validateRFC: function(rfc) {
              console.log('Mock: validateRFC', rfc);
              if (this.successCb) this.successCb({
                success: true,
                empresa: {folio: 'MS-PREVIEW', razonSocial: 'Empresa Preview', estatus: 'En revisión'}
              });
            },
            getWorkPlan: function(folio) {
              console.log('Mock: getWorkPlan', folio);
              if (this.successCb) this.successCb([
                {id: '1', nombre: 'Actividad 1', descripcion: 'Desc 1', responsable: 'Resp 1', fechaCompromiso: '2024-12-31', estatus: 'En proceso'}
              ]);
            },
            getEmpresaBranches: function(folio) {
              console.log('Mock: getEmpresaBranches', folio);
              if (this.successCb) this.successCb([{nombre: 'Sucursal 1', direccion: 'Calle 123', lat: '19.4', lng: '-99.1'}]);
            },
            saveWorkPlanActivity: function(act) {
               console.log('Mock: saveWorkPlanActivity', act);
               if (this.successCb) this.successCb({success: true});
            },
            uploadFile: function(d, n, f) {
               console.log('Mock: uploadFile', n);
               if (this.successCb) this.successCb({url: '#'});
            }
          }
        }
      };

      // Validation Bypass Logic
      function applyBypass() {
        console.log('Applying bypass...');
        window.bypassActive = true;

        // Disable Step 1-4 validations
        window.validateStep1 = () => { console.log('Bypass Step 1'); return true; };
        window.validateStep3 = () => { console.log('Bypass Step 3'); return true; };
        window.validateStep4 = () => { console.log('Bypass Step 4'); return true; };
        window.validateBranchCommitments = () => { console.log('Bypass Branch Comp'); return true; };

        // Mock branch if empty
        if (typeof state !== 'undefined' && state.branches.length === 0) {
           state.branches.push({
             nombre: 'Sucursal Preview',
             direccion: 'Direccion Preview',
             lat: '19.4326',
             lng: '-99.1332',
             responsable: 'Responsable Preview',
             cargo: 'Cargo Preview',
             telefono: '1234567890',
             horarioTexto: 'L-V 9-6',
             compromisos: {protocolo: true, proteccionCivil: true, areaSeguimiento: true, nom25: true, nom35: true}
           });
        }

        const bypassBtn = document.createElement('button');
        bypassBtn.innerText = 'Bypass Validations (ON)';
        bypassBtn.style.position = 'fixed';
        bypassBtn.style.bottom = '10px';
        bypassBtn.style.right = '10px';
        bypassBtn.style.zIndex = '9999';
        bypassBtn.style.background = '#2ecc71';
        bypassBtn.style.color = 'white';
        bypassBtn.style.padding = '5px 10px';
        bypassBtn.style.borderRadius = '5px';
        bypassBtn.style.fontSize = '12px';
        bypassBtn.onclick = () => {
          window.bypassActive = !window.bypassActive;
          bypassBtn.innerText = `Bypass Validations (${window.bypassActive ? 'ON' : 'OFF'})`;
          bypassBtn.style.background = window.bypassActive ? '#2ecc71' : '#e74c3c';
        };
        document.body.appendChild(bypassBtn);

        window.alert = (msg) => console.log('Alert suppressed:', msg);
      }

      window.addEventListener('load', applyBypass);
    </script>
    """
    # Inject before </body> to ensure it can override JS.html functions
    combined = combined.replace("</body>", mock_script + "</body>")

    with open(output_file, 'w') as f:
        f.write(combined)

if __name__ == "__main__":
    if not os.path.exists('preview'):
        os.makedirs('preview')
    generate_preview('Index.html', 'preview/index_preview.html')
    generate_preview('Panel.html', 'preview/panel_preview.html', is_panel=True)
