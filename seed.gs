/**
 * seed.gs - Idempotent test data seeding for BitFix v3
 */

/**
 * Main seeding function. Idempotent execution using LockService and check guard.
 */
function seedData() {
  return withLock(function() {
    var ss = getDbSpreadsheet();

    // Ensure schema is setup before seeding
    setupSchemaInternal(ss);

    var configSheet = ss.getSheetByName("Configuracion");
    var configData = getSheetObjects("Configuracion");
    var seededVer = configData.filter(function(row) {
      return row.Parametro === "SeededVersion";
    })[0];

    // Check if OS001 already exists to prevent duplicate seeding
    var ordenesExistentes = getSheetObjects("OrdenServicio");
    var yaExisteOS001 = ordenesExistentes.some(function(o) { return String(o.OrdenID) === "OS001"; });

    if (seededVer && seededVer.Valor === "v3.0" && yaExisteOS001) {
      Logger.log("Dataset de prueba ya se encuentra sembrado (SeededVersion = v3.0). Skipping.");
      return { success: true, message: "El dataset de prueba ya estaba sembrado previamente." };
    }

    var counts = {};
    var passHash123456 = hashPassword("123456");

    // Helper to seed sheet rows without duplicating existing keys
    function seedTable(sheetName, keyCol, rows, headerArray) {
      var sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(headerArray);
      }
      var existingData = getSheetObjects(sheetName);
      var existingKeys = existingData.map(function(item) { return String(item[keyCol]); });

      var insertedCount = 0;
      rows.forEach(function(rowArray) {
        var rowKey = String(rowArray[0]);
        if (existingKeys.indexOf(rowKey) === -1) {
          sheet.appendRow(rowArray);
          existingKeys.push(rowKey);
          insertedCount++;
        }
      });
      counts[sheetName] = insertedCount;
    }

    // 1. Admins
    seedTable("Admins", "AdminID", [
      ["ADM001", "Admin Principal", "Administrador", "9990000001", "Si", "admin@bitfix.mx", passHash123456],
      ["ADM002", "Recepción Taller", "Recepcion", "9990000002", "Si", "recepcion@bitfix.mx", passHash123456],
      ["ADM003", "Carlos Técnico Consolas", "Tecnico", "9990000003", "Si", "carlos.tecnico@bitfix.mx", passHash123456],
      ["ADM004", "Luis Técnico Laptops", "Tecnico", "9990000004", "Si", "luis.tecnico@bitfix.mx", passHash123456],
      ["ADM005", "Admin Sakurazukamori", "Administrador", "9990000005", "Si", "sakurazukamori21@gmail.com", passHash123456]
    ], ["AdminID", "Nombre", "Rol", "Telefono", "Activo", "Email", "PasswordHash"]);

    // 2. Clientes
    seedTable("Clientes", "Telefono", [
      ["9991000001", "Juan Pérez", "juan.perez@example.com", "Cliente"],
      ["9991000002", "Maria López", "maria.lopez@example.com", "Cliente"],
      ["9991000003", "Pedro Gómez", "pedro.gomez@example.com", "Cliente"],
      ["9992000001", "Taller GameFix", "contacto@gamefix.com", "Taller"],
      ["9992000002", "Taller ElectroLab", "ventas@electrolab.com", "Taller"]
    ], ["Telefono", "Nombre", "Correo", "TipoCliente"]);

    // 3. Talleres
    seedTable("Talleres", "Telefono", [
      ["9992000001", "Taller GameFix (Gold)"],
      ["9992000002", "Taller ElectroLab (Silver)"]
    ], ["Telefono", "NombreComercial"]);

    // 4. UsuariosPortal (Pass hash for '123456')
    seedTable("UsuariosPortal", "UsuarioID", [
      ["UP001", "9991000001", "Juan Pérez", "Si", passHash123456, "2026-01-01 10:00:00"],
      ["UP002", "9991000002", "Maria López", "Si", passHash123456, "2026-01-02 11:30:00"],
      ["UP003", "9992000001", "Taller GameFix", "Si", passHash123456, "2026-01-03 12:00:00"]
    ], ["UsuarioID", "Telefono", "Nombre", "Activo", "PasswordHash", "FechaRegistro"]);

    // 5. Equipos
    seedTable("Equipos", "EquipoID", [
      ["EQ001", "9991000001", "Consola", "Sony", "PlayStation 5", "PS5-1001-XYZ"],
      ["EQ002", "9991000001", "Laptop", "Dell", "Inspiron 15", "DELL-8821-ABC"],
      ["EQ003", "9991000002", "Consola", "Nintendo", "Switch OLED", "NSW-9920-OLED"],
      ["EQ004", "9991000003", "Laptop", "Lenovo", "ThinkPad T14", "LNV-3310-TP"],
      ["EQ005", "9992000001", "Consola", "Microsoft", "Xbox Series X", "XSX-7712-SERX"],
      ["EQ006", "9992000002", "Laptop", "HP", "Pavilion Gaming", "HP-5541-PAV"]
    ], ["EquipoID", "TelefonoCliente", "Tipo", "Marca", "Modelo", "No.Serie"]);

    // 6. OrdenServicio
    seedTable("OrdenServicio", "OrdenID", [
      ["OS001", "9991000001", "2026-01-10", "Entregado Parcial", "2026-01-10 09:30:00", 300, 1700, "No", "", ""],
      ["OS002", "9991000002", "2026-01-12", "En Proceso", "2026-01-12 11:00:00", 150, 450, "No", "", ""],
      ["OS003", "9992000001", "2026-01-14", "Abierta", "2026-01-14 14:15:00", 200, 0, "No", "", ""],
      ["OS004", "9991000003", "2026-01-15", "Cerrada", "2026-01-15 16:00:00", 250, 1200, "No", "", ""],
      ["OS005", "9992000002", "2026-01-16", "Cancelada", "2026-01-16 10:00:00", 150, 0, "No", "", ""]
    ], [
      "OrdenID", "Telefono", "FechaRecepcion", "EstatusGeneral",
      "FechaHoraRecepcion", "CostoEstimado", "TotalFinal",
      "Eliminada", "FechaEliminacion", "AdminID_Elimino"
    ]);

    // 7. DetalleOrden
    seedTable("DetalleOrden", "DetalleID", [
      ["DET001", "OS001", "EQ001", "Entregado", "2026-01-11 18:00:00", "Si", "ADM003"],
      ["DET002", "OS001", "EQ002", "Listo para Recoleccion", "", "No", "ADM004"],
      ["DET003", "OS002", "EQ003", "En Reparacion", "", "No", "ADM003"],
      ["DET004", "OS003", "EQ005", "Diagnostico", "", "No", "ADM003"],
      ["DET005", "OS004", "EQ004", "Entregado", "2026-01-16 12:00:00", "Si", "ADM004"],
      ["DET006", "OS005", "EQ006", "Cancelado", "", "No", "ADM004"]
    ], ["DetalleID", "OrdenID", "EquipoID", "Estatus", "FechaLiberacion", "Entregado", "TecnicoAsignadoID"]);

    // 8. Servicios
    seedTable("Servicios", "ServicioID", [
      ["SRV001", "DET001", "Fuente dañada", "Reemplazo de fuente de poder", 90, 150, 1200, "No enciende tras descarga eléctrica", "Si"],
      ["SRV002", "DET002", "Teclado sulfatado", "Limpieza ultrasónica y cambio de teclado", 60, 150, 500, "Teclas no responden", "Si"],
      ["SRV003", "DET003", "Lector SD defectuoso", "En proceso de micro-soldadura", 60, 150, 450, "No lee tarjetas SD", "No"],
      ["SRV004", "DET004", "Pendiente de revisión", "En espera de diagnóstico inicial", 0, 200, 0, "Calentamiento excesivo", "No"],
      ["SRV005", "DET005", "Disco NVMe dañado", "Cambio de SSD NVMe 1TB e instalación de SO", 90, 250, 1200, "Pantalla azul intermitente", "Si"],
      ["SRV006", "DET006", "Revisión cancelada", "Cliente declinó reparación", 0, 150, 0, "Parpadeo de pantalla", "No"]
    ], ["ServicioID", "DetalleID", "Diagnostico", "Solucion", "GarantiaDias", "CostoDiagnostico", "CostoFinal", "FallaReportada", "ListoParaRecoleccion"]);

    // 9. Asignaciones
    seedTable("Asignaciones", "AsignacionID", [
      ["ASG001", "SRV001", "ADM003", "2026-01-10 10:00:00", "Terminado", 2.5],
      ["ASG002", "SRV001", "ADM004", "2026-01-10 14:00:00", "Terminado", 1.0],
      ["ASG003", "SRV002", "ADM004", "2026-01-10 11:00:00", "Terminado", 1.5],
      ["ASG004", "SRV003", "ADM003", "2026-01-12 12:00:00", "En proceso", 2.0],
      ["ASG005", "SRV004", "ADM003", "2026-01-14 15:00:00", "Asignado", 0.5],
      ["ASG006", "SRV005", "ADM004", "2026-01-15 16:30:00", "Terminado", 2.0],
      ["ASG007", "SRV006", "ADM004", "2026-01-16 10:30:00", "Terminado", 0.5]
    ], ["AsignacionID", "ServicioID", "TecnicoID", "FechaAsignacion", "Estatus", "HorasInvertidas"]);

    // 10. ActividadesTecnico
    seedTable("ActividadesTecnico", "ActividadID", [
      ["ACT001", "ADM003", "SRV001", "2026-01-10 10:30:00", "Desarme y diagnóstico de fuente", 60],
      ["ACT002", "ADM003", "SRV001", "2026-01-10 12:00:00", "Instalación de nueva fuente", 90],
      ["ACT003", "ADM004", "SRV001", "2026-01-10 14:30:00", "Pruebas de estrés y rendimiento", 60],
      ["ACT004", "ADM004", "SRV002", "2026-01-11 09:00:00", "Limpieza ultrasónica de teclado", 90],
      ["ACT005", "ADM003", "SRV003", "2026-01-12 13:00:00", "Micro-soldadura de pin lector SD", 120],
      ["ACT006", "ADM003", "SRV004", "2026-01-14 15:30:00", "Inspección térmica preliminar", 30],
      ["ACT007", "ADM004", "SRV005", "2026-01-15 17:00:00", "Clonación y cambio de SSD NVMe", 120],
      ["ACT008", "ADM004", "SRV006", "2026-01-16 10:45:00", "Evaluación visual y armado", 30]
    ], ["ActividadID", "TecnicoID", "ServicioID", "Fecha", "Accion", "Minutos"]);

    // 11. HistorialServicio
    seedTable("HistorialServicio", "HistorialID", [
      ["HIS001", "SRV001", "2026-01-10 09:30:00", "-", "Diagnostico", "ADM001", "Recepción de equipo PS5"],
      ["HIS002", "SRV001", "2026-01-10 11:30:00", "Diagnostico", "En Reparacion", "ADM003", "Aprobada reparación de fuente"],
      ["HIS003", "SRV001", "2026-01-10 16:00:00", "En Reparacion", "Listo para Recoleccion", "ADM003", "Equipo probado y listo"],
      ["HIS004", "SRV001", "2026-01-11 18:00:00", "Listo para Recoleccion", "Entregado", "ADM001", "Entrega a cliente"],
      ["HIS005", "SRV002", "2026-01-10 09:30:00", "-", "Diagnostico", "ADM001", "Recepción de laptop Dell"],
      ["HIS006", "SRV002", "2026-01-11 10:00:00", "Diagnostico", "Listo para Recoleccion", "ADM004", "Limpieza de teclado terminada"],
      ["HIS007", "SRV003", "2026-01-12 11:00:00", "-", "Diagnostico", "ADM001", "Recepción de Nintendo Switch"],
      ["HIS008", "SRV003", "2026-01-12 13:30:00", "Diagnostico", "En Reparacion", "ADM003", "En proceso de micro-soldadura"],
      ["HIS009", "SRV005", "2026-01-15 16:00:00", "-", "Diagnostico", "ADM001", "Recepción Lenovo ThinkPad"],
      ["HIS010", "SRV005", "2026-01-16 12:00:00", "Diagnostico", "Entregado", "ADM001", "Cambio SSD y entrega realizada"]
    ], ["HistorialID", "ServicioID", "FechaHora", "EstatusAnterior", "EstatusNuevo", "UsuarioID", "Notas"]);

    // 12. Pagos
    seedTable("Pagos", "PagoID", [
      ["PAG001", "OS001", "2026-01-10 09:30:00", 300, "Anticipo de diagnóstico"],
      ["PAG002", "OS001", "2026-01-11 18:00:00", 1400, "Liquidación de orden"],
      ["PAG003", "OS002", "2026-01-12 11:00:00", 150, "Abono inicial"],
      ["PAG004", "OS004", "2026-01-15 16:00:00", 1200, "Pago total en efectivo"]
    ], ["PagoID", "OrdenID", "Fecha", "Importe", "Concepto"]);

    // 13. NFC
    seedTable("NFC", "NFC_ID", [
      ["NFC001", "04A1B2C3D4", "9991000001"],
      ["NFC002", "04E5F67890", "9991000002"]
    ], ["NFC_ID", "UID", "TelefonoCliente"]);

    // 14. MovimientosPuntos
    seedTable("MovimientosPuntos", "MovimientoID", [
      ["MOV001", "9991000001", "2026-01-05 10:00:00", 25, "Referido: Registro de amigo"],
      ["MOV002", "9991000001", "2026-01-11 18:00:00", 10, "Puntos por entrega de servicio SRV001"],
      ["MOV003", "9991000001", "2026-01-13 14:00:00", -15, "Canje: Descuento en mano de obra"],
      ["MOV004", "9991000002", "2026-01-08 11:00:00", 10, "Servicio Mayor: Mantenimiento previo"],
      ["MOV005", "9992000001", "2026-01-03 12:00:00", 25, "Referido: Taller aliado"],
      ["MOV006", "9991000003", "2026-01-16 12:00:00", 10, "Puntos por entrega de servicio SRV005"]
    ], ["MovimientoID", "TelefonoCliente", "Fecha", "Puntos", "Concepto"]);

    // 15. SaldoPuntos
    seedTable("SaldoPuntos", "Telefono", [
      ["9991000001", 20],
      ["9991000002", 10],
      ["9992000001", 25],
      ["9991000003", 10]
    ], ["Telefono", "Saldo"]);

    // Set SeededVersion in Configuracion
    if (configSheet) {
      if (seededVer) {
        updateCellInSheet(configSheet, "Parametro", "SeededVersion", "Valor", "v3.0");
      } else {
        configSheet.appendRow(["SeededVersion", "v3.0"]);
      }
    }

    Logger.log("=== RESUMEN DE DATOS SEMBRADOS ===");
    Object.keys(counts).forEach(function(tbl) {
      Logger.log(tbl + ": " + counts[tbl] + " filas insertadas.");
    });

    return {
      success: true,
      message: "Dataset de prueba sembrado con éxito.",
      counts: counts
    };
  });
}
