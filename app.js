/* ==========================================================================
   FORTALECERNOS SAC - SISTEMA DE GESTIÓN DE PDV (TEX ICA II)
   MOTOR DE LÓGICA CORE: CONTROLADOR MODULAR EMERXENTE v1.10 (PRODUCCIÓN)
   ========================================================================== */

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let filtroTiempo = 'dia';
let streamCamara = null;
const fechaHoyISO = '2026-06-26'; // Fecha unificada hoy viernes 26
let evidenciaCargadaLocal = false; 

const baseClientesMock = { 
    "12345678": "JUAN ROSALES PAREDES", 
    "98765432": "MARÍA ELENA GÓMEZ" 
};

// --- CONMUTACIÓN DE TEMAS ---
function toggleTema(checkbox) { 
    if (checkbox.checked) {
        document.documentElement.setAttribute('data-theme', 'white');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

// --- INICIALIZADOR DEL SISTEMA ---
window.onload = function() {
    inicializarFechas();
    actualizarDashboard(); // SE RECONECTA LA INYECCIÓN DEL DASHBOARD
    setMapaCoordenadas(-14.0639, -75.7292);
};

function inicializarFechas() {
    const inputsFecha = ['filtroFecha', 'fechaRegistroVenta', 'fechaRegistroInteraccion'];
    inputsFecha.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = fechaHoyISO;
    });
    cambioFecha(fechaHoyISO);
}

// --- ALTERNANCIA DE TEXTOS DE SALUDO DINÁMICOS ---
function cambioFecha(val) {
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const p = val.split('-');
    const titulo = document.getElementById('tituloDinamico');
    
    if (p.length === 3 && titulo) {
        const diaInt = parseInt(p[2], 10);
        const mesTxt = meses[parseInt(p[1], 10) - 1];
        
        if (val === fechaHoyISO) {
            titulo.innerText = `Hola Carlos, hoy 26 de junio vendimos:`;
        } else {
            titulo.innerText = `Hola Carlos, el ${diaInt} de ${mesTxt} vendimos:`;
        }
    }
}

// --- GESTIÓN DE NAVEGACIÓN SPA ---
function cambiarSeccion(sec) {
    const secciones = ['viewRegistro', 'viewDashboard', 'viewLogistica', 'viewAsistencia'];
    const menus = ['menuRegistro', 'menuDashboard', 'menuLogistica', 'menuAsistencia'];
    
    secciones.forEach(id => {
        const vista = document.getElementById(id);
        if (vista) {
            vista.classList.toggle('active-view', id === `view${sec.charAt(0).toUpperCase() + sec.slice(1)}`);
        }
    });

    menus.forEach(id => {
        const itemMenu = document.getElementById(id);
        if (itemMenu) {
            itemMenu.classList.toggle('active', id === `menu${sec.charAt(0).toUpperCase() + sec.slice(1)}`);
        }
    });
    
    if (sec === 'asistencia') { 
        iniciarCamara(); 
    } else { 
        detenerCamara(); 
    }
}

function switchLogistica(tipo) {
    document.getElementById('tabStock').classList.toggle('active-tab', tipo === 'stock');
    document.getElementById('tabGestion').classList.toggle('active-tab', tipo === 'gestion');
    document.getElementById('tabInventario').classList.toggle('active-tab', tipo === 'inventario');
    
    document.getElementById('subViewStock').style.display = (tipo === 'stock') ? 'block' : 'none';
    document.getElementById('subViewGestion').style.display = (tipo === 'gestion') ? 'block' : 'none';
    document.getElementById('subViewInventario').style.display = (tipo === 'inventario') ? 'block' : 'none';
}

// --- GESTIÓN DE STOCK: ENVIAR / RECIBIR MESA ---
function evaluarExclusividadFiltro(criterio) {
    const txtSku = document.getElementById('txtSkuFiltroMesa');
    const txtImei = document.getElementById('txtImeiFiltroMesa');
    
    if (criterio === 'sku' && txtSku.value.trim() !== "") {
        txtImei.value = "";
        txtImei.disabled = true;
    } else if (criterio === 'imei' && txtImei.value.trim() !== "") {
        txtSku.value = "";
        txtSku.disabled = true;
    } else {
        txtSku.disabled = false;
        txtImei.disabled = false;
    }
}

function ejecutarBusquedaMesaOrigen() {
    const skuVal = document.getElementById('txtSkuFiltroMesa').value.trim().toUpperCase();
    const imeiVal = document.getElementById('txtImeiFiltroMesa').value.trim();
    const filas = document.querySelectorAll('#cuerpoTransferenciaOrigen tr');

    filas.forEach(fila => {
        const skuFila = fila.getAttribute('data-sku') || '';
        const imeiFila = fila.getAttribute('data-imei') || '';

        if (skuVal !== "" && !skuFila.includes(skuVal)) {
            fila.style.display = "none";
        } else if (imeiVal !== "" && !imeiFila.includes(imeiVal)) {
            fila.style.display = "none";
        } else {
            fila.style.display = "";
        }
    });
}

function switchSubGestion(subTipo) {
    document.getElementById('tabRecibir').classList.toggle('active-tab', subTipo === 'recibir');
    document.getElementById('tabEnviar').classList.toggle('active-tab', subTipo === 'enviar');
    
    if(subTipo === 'recibir') {
        alert("Bandeja de Entrada de Almacén vacía. No cuenta con órdenes de despacho pendientes.");
        switchSubGestion('enviar'); 
    }
}

function ejecutarTraspasoVisual() {
    const checkedBoxes = document.querySelectorAll('#cuerpoTransferenciaOrigen .chk-transfer:checked');
    const tbodyDestino = document.getElementById('cuerpoTransferenciaDestino');
    const rowVacia = document.getElementById('rowVaciaDestino');
    
    if (checkedBoxes.length === 0) {
        alert("Por favor, seleccione al menos un IMEI del cuadro de existencias de origen.");
        return;
    }

    if (rowVacia) rowVacia.remove();

    checkedBoxes.forEach(box => {
        const filaOrigen = box.closest('tr');
        const idFila = filaOrigen.getAttribute('data-id');
        const sku = filaOrigen.querySelectorAll('td')[1].innerText;
        const imei = filaOrigen.querySelectorAll('td')[2].innerText;

        if (!document.getElementById(`dest_${idFila}`)) {
            const nuevaFila = document.createElement('tr');
            nuevaFila.id = `dest_${idFila}`;
            nuevaFila.innerHTML = `
                <td style="padding: 6px 10px;"><strong>${sku}</strong></td>
                <td style="padding: 6px 10px; color: #10b981;">${imei}</td>
            `;
            tbodyDestino.appendChild(nuevaFila);
            filaOrigen.style.opacity = "0.4";
            box.checked = false;
        }
    });
}

function registrarArchivoEvidencia(input) {
    if (input.files && input.files[0]) {
        evidenciaCargadaLocal = true;
        const btn = document.getElementById('btnDispararCarga');
        if (btn) {
            btn.innerText = "✓ Evidencia Lista";
            btn.style.color = "#10b981";
            btn.style.borderColor = "rgba(16, 185, 129, 0.4)";
            btn.style.background = "rgba(16, 185, 129, 0.1)";
        }
    }
}

function solicitarAprobacionTransferencia() {
    const itemsCargados = document.querySelectorAll('#cuerpoTransferenciaDestino tr:not(#rowVaciaDestino)');
    const tiendaDestino = document.getElementById('transferenciaTiendaDestino').value;
    
    if (itemsCargados.length === 0) {
        alert("Error: El cuadro de despacho se encuentra vacío. Debe traspasar terminales válidas antes de enviar.");
        return;
    }

    if (!evidenciaCargadaLocal) {
        alert("Restricción de Auditoría: Debe adjuntar de forma obligatoria la foto de la evidencia de la transferencia antes de notificar al Supervisor.");
        return;
    }

    const lblEstado = document.getElementById('lblEstadoSeguimiento');
    if (lblEstado) {
        lblEstado.innerText = "Aprobado";
        lblEstado.style.background = "rgba(16, 185, 129, 0.15)";
        lblEstado.style.color = "#10b981";
        lblEstado.style.borderColor = "rgba(16, 185, 129, 0.3)";
    }

    alert(`Transferencia de Stock enviada con Éxito de la tienda TEX ICA II a la nueva tienda ${tiendaDestino}`);
}

function filtrarHistorialKardex(modo) {
    document.getElementById('tabHistEnviados').classList.toggle('active-tab', modo === 'ENVIADO');
    document.getElementById('tabHistRecibidos').classList.toggle('active-tab', modo === 'RECIBIDO');

    const filas = document.querySelectorAll('#cuerpoHistorialKardex tr');
    filas.forEach(fila => {
        const tipoFila = fila.getAttribute('data-kardex');
        fila.style.display = (tipoFila === modo) ? "" : "none";
    });
}

function desplegarImagenEvidencia(codigo) {
    document.getElementById('lblFotoModalId').innerText = `Evidencia: ${codigo}`;
    document.getElementById('modalVisualizadorFoto').classList.add('active');
}

// --- LOGÍSTICA: FILTRADO DINÁMICO ---
function filtrarLogistica() {
    const tipoSel = document.getElementById('filtroTipo').value;
    const marcaSel = document.getElementById('filtroMarca').value;
    const modeloTxt = document.getElementById('filtroModelo').value.trim().toUpperCase();
    const skuTxt = document.getElementById('filtroSku').value.trim().toUpperCase();

    const filas = document.querySelectorAll('#cuerpoStockLogistica tr');

    filas.forEach(fila => {
        const tipoFila = fila.getAttribute('data-tipo') || '';
        const marcaFila = fila.getAttribute('data-marca') || '';
        const modeloFila = fila.getAttribute('data-modelo') || '';
        const skuFila = fila.getAttribute('data-sku') || '';

        const cumpleTipo = (tipoSel === "" || tipoFila === tipoSel);
        const cumpleMarca = (marcaSel === "" || marcaFila === marcaSel);
        const cumpleModelo = (modeloTxt === "" || modeloFila.includes(modeloTxt));
        const cumpleSku = (skuTxt === "" || skuFila.includes(skuTxt));

        if (cumpleTipo && cumpleMarca && cumpleModelo && cumpleSku) {
            fila.style.display = "";
        } else {
            fila.style.display = "none";
        }
    });
}

function limpiarFiltrosLogistica() {
    document.getElementById('filtroTipo').value = "";
    document.getElementById('filtroMarca').value = "";
    document.getElementById('filtroModelo').value = "";
    document.getElementById('filtroSku').value = "";

    const filas = document.querySelectorAll('#cuerpoStockLogistica tr');
    filas.forEach(fila => { fila.style.display = ""; });
    
    document.getElementById('txtSkuFiltroMesa').value = "";
    document.getElementById('txtImeiFiltroMesa').value = "";
    document.getElementById('txtSkuFiltroMesa').disabled = false;
    document.getElementById('txtImeiFiltroMesa').disabled = false;
    document.querySelectorAll('#cuerpoTransferenciaOrigen tr').forEach(r => r.style.display = "");
}

// --- LOGÍSTICA: GENERADOR DINÁMICO DE IMEIS ---
function verImeis(sku, cantidad) {
    const lblSku = document.getElementById('lblSkuModal');
    const tbody = document.getElementById('listaImeisCuerpo');
    if (!lblSku || !tbody) return;

    lblSku.innerText = sku;
    let htmlInyeccion = "";
    const prefijosImei = { "HONOR": "86214506", "SGLXY": "35412811", "XIA": "86995405" };
    const marca = sku.substring(0, 5);
    const baseImei = prefijosImei[marca] || "86001245";

    for (let i = 1; i <= cantidad; i++) {
        const imeiCorrelativo = `${baseImei}74125${i}`;
        const fechaRecepcion = `1${i}/06/2026`; 
        htmlInyeccion += `<tr><td><strong>${imeiCorrelativo}</strong></td><td style="color: #6366f1; font-weight: 600;">${fechaRecepcion}</td></tr>`;
    }

    tbody.innerHTML = htmlInyeccion;
    document.getElementById('modalImeis').classList.add('active');
}

// --- VALIDACIÓN DE CLIENTES ---
function verificarTab(e, destId) {
    if (e.keyCode === 9 || e.keyCode === 13) {
        e.preventDefault();
        buscarClienteBase(e.target.id, destId);
    }
}

function buscarClienteBase(origId, destId) {
    const documento = document.getElementById(origId).value.trim();
    const destino = document.getElementById(destId);
    if (baseClientesMock[documento]) { destino.value = baseClientesMock[documento]; } 
    else { destino.value = ""; destino.focus(); alert("Documento no registrado."); }
}

function forzarMayusculas(input) { input.value = input.value.toUpperCase(); }

// --- REGLAS DE NEGOCIO (POPUP DE VENTAS) ---
function aplicarReglasNegocio() {
    const producto = document.getElementById('producto').value;
    const gCliente = document.getElementById('groupCliente');
    const gTipoProducto = document.getElementById('groupTipoProducto');
    const selTipoProducto = document.getElementById('tipoProducto');
    const fieldsFisicos = ['groupIccid','groupModeloSim'];
    
    if (producto === "Accesorio") {
        ocultarElementos([gCliente, gTipoProducto, document.getElementById('groupLinea'), document.getElementById('groupPrecioSim'), document.getElementById('groupImei'), document.getElementById('groupEquipo'), document.getElementById('groupPrecioEquipo')]);
        fieldsFisicos.forEach(id => document.getElementById(id).style.display = 'none');
        document.getElementById('groupPrecioAccesorio').style.display = 'flex';
    } else if (producto === "Mis In") {
        mostrarElementos([document.getElementById('groupLinea'), document.getElementById('groupPrecioSim'), gCliente, gTipoProducto]);
        document.getElementById('cliente').value = "Base"; document.getElementById('cliente').disabled = true;
        selTipoProducto.value = "SIM"; selTipoProducto.disabled = true;
        fieldsFisicos.forEach(id => document.getElementById(id).style.display = 'none');
        [document.getElementById('groupImei'), document.getElementById('groupEquipo'), document.getElementById('groupPrecioEquipo'), document.getElementById('groupPrecioAccesorio')].forEach(d=>d.style.display='none');
        evaluarReglasPrecios();
    } else {
        mostrarElementos([gCliente, gTipoProducto, document.getElementById('groupLinea'), document.getElementById('groupPrecioSim')]);
        fieldsFisicos.forEach(id => document.getElementById(id).style.display = 'flex');
        document.getElementById('groupPrecioAccesorio').style.display = 'none';
        document.getElementById('cliente').disabled = false; selTipoProducto.disabled = false;
        if (producto === "Renovación") { document.getElementById('cliente').value = "Base"; document.getElementById('cliente').disabled = true; selTipoProducto.value = "PACK"; selTipoProducto.disabled = true; }
        toggleCamposEquipo();
    }
}

function toggleCamposEquipo() {
    const tp = document.getElementById('tipoProducto').value;
    const mostrar = (tp==="PACK");
    document.getElementById('groupImei').style.display = mostrar ? 'flex' : 'none';
    document.getElementById('groupEquipo').style.display = mostrar ? 'flex' : 'none';
    document.getElementById('groupPrecioEquipo').style.display = mostrar ? 'flex' : 'none';
    evaluarReglasPrecios();
}

function evaluarReglasPrecios() {
    const prod = document.getElementById('producto').value;
    const modeloSim = document.getElementById('modeloSim').value;
    const inputPrecioSim = document.getElementById('precioSim');
    if (prod === "Renovación" || prod === "Mis In" || modeloSim === "eSIM") { inputPrecioSim.value = 0; inputPrecioSim.disabled = true; } 
    else { inputPrecioSim.disabled = false; if (inputPrecioSim.value == "0") inputPrecioSim.value = ""; }
}

function ocultarElementos(arr) { arr.forEach(el => { if(el) el.style.display = 'none'; }); }
function mostrarElementos(arr) { arr.forEach(el => { if(el) el.style.display = 'flex'; }); }

// --- CONTROLES MODALES ---
function openModal(tipo) {
    const modalId = (tipo === 'venta') ? 'modalVenta' : 'modalInteraccion';
    document.getElementById(modalId).classList.add('active');
    if (tipo === 'venta') aplicarReglasNegocio();
}
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

// --- HARDWARE: ASISTENCIA ---
function iniciarCamara() {
    const video = document.getElementById('webcam');
    if (video && navigator.mediaDevices) { 
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(stream => { streamCamara = stream; video.srcObject = stream; })
            .catch(err => console.warn("Camera restricted:", err));
    }
}
function detenerCamara() { if (streamCamara) { streamCamara.getTracks().forEach(t => t.stop()); streamCamara = null; } }

// --- DASHBOARD ANALÍTICO CORE ---
function switchTiempo(tiempo) { 
    filtroTiempo = tiempo; 
    document.getElementById('tabMes').classList.toggle('active-tab', tiempo === 'mes');
    document.getElementById('tabDia').classList.toggle('active-tab', tiempo === 'dia');
    actualizarDashboard(); 
}

function actualizarDashboard() {
    const container = document.getElementById('cardsDashboard');
    const tablas = document.getElementById('contenedorTablasAsesores');
    if (!container) return;

    const cardsData = {
        mes: [
            { title: "⚡ Postpago Total", obj: 100, log: 65, idl: 60, des: 5, proy: 108, pct: 65, c: "green" },
            { title: "Renovación", obj: 40, log: 24, idl: 26, des: -2, proy: 38, pct: 60, c: "blue" },
            { title: "Prepago Total", obj: 120, log: 96, idl: 80, des: 16, proy: 135, pct: 80, c: "orange" },
            { title: "Porta Origen Post", obj: 40, log: 25, idl: 24, des: 1, proy: 42, pct: 62, c: "blue" },
            { title: "Porta Origen Pre", obj: 30, log: 21, idl: 18, des: 3, proy: 33, pct: 70, c: "blue" },
            { title: "Línea Nueva", obj: 30, log: 19, idl: 18, des: 1, proy: 31, pct: 63, c: "blue" }
        ],
        dia: [
            { title: "⚡ Postpago Total", obj: 18, log: 13, pct: 72, c: "green" },
            { title: "Renovación", obj: 8, log: 5, pct: 62, c: "blue" },
            { title: "Prepago Total", obj: 15, log: 12, pct: 80, c: "orange" },
            { title: "Porta Origen Post", obj: 6, log: 4, pct: 66, c: "blue" },
            { title: "Porta Origen Pre", obj: 3, log: 3, pct: 100, c: "blue" },
            { title: "Línea Nueva", obj: 9, log: 6, pct: 66, c: "blue" }
        ]
    };

    container.innerHTML = cardsData[filtroTiempo].map(item => {
        const isPt = item.title.includes("Postpago Total");
        const isPre = item.title.includes("Prepago");
        let adv = (filtroTiempo === 'mes') ? `
            <div class="metrics-grid-advanced">
                <div class="metric-subblock"><span class="metric-sublabel">Ideal</span><span class="metric-subvalue">${item.idl}</span></div>
                <div class="metric-subblock"><span class="metric-sublabel">Desfase</span><span class="metric-subvalue ${item.des >= 0 ? 'up' : 'down'}">${item.des >= 0 ? '+' : ''}${item.des}</span></div>
                <div class="metric-subblock" style="grid-column: span 2;"><span class="metric-sublabel">Proyección</span><span class="metric-subvalue" style="color:#6366f1;">${item.proy} und (${Math.round((item.proy / item.obj) * 100)}%)</span></div>
            </div>` : '';
            
        return `
            <div class="card" ${isPt ? 'style="border-color: rgba(16, 185, 129, 0.25);"' : ''}>
                <div class="card-title ${isPt ? 'postpago-total-title' : (isPre ? 'prepago-title' : '')}">${item.title}</div>
                <div class="metric-split">
                    <div class="metric-block"><div class="metric-label">Objetivo</div><div class="metric-value">${item.obj}</div></div>
                    <div class="metric-block"><div class="metric-label">Logrado</div><div class="metric-value ${isPt ? 'highlight-total' : (isPre ? 'highlight-prepago' : 'highlight')}">${item.log}</div></div>
                </div>
                <div class="progress-container"><div class="progress-bar ${item.c}" style="width: ${item.pct}%"></div></div>
                ${adv}
            </div>`;
    }).join('');

    if (filtroTiempo === 'mes') {
        const prods = ["⚡ Postpago Total", "Renovación", "Prepago Total", "Porta Origen Post", "Porta Origen Pre", "Línea Nueva"];
        const asesoresMock = [
            { name: "Carlos Mendoza (Tú)", datos: { "⚡ Postpago Total": { o: 50, l: 32, i: 30, d: 2, p: "64 und (128%)" }, "Renovación": { o: 20, l: 14, i: 13, d: 1, p: "28 und (140%)" }, "Prepago Total": { o: 60, l: 48, i: 40, d: 8, p: "96 und (160%)" }, "Porta Origen Post": { o: 20, l: 12, i: 12, d: 0, p: "24 und (120%)" }, "Porta Origen Pre": { o: 15, l: 11, i: 10, d: 1, p: "22 und (146%)" }, "Línea Nueva": { o: 15, l: 9, i: 9, d: 0, p: "18 und (120%)" } } },
            { name: "Ana Torres", datos: { "⚡ Postpago Total": { o: 50, l: 33, i: 30, d: 3, p: "66 und (132%)" }, "Renovación": { o: 20, l: 10, i: 13, d: -3, p: "20 und (100%)" }, "Prepago Total": { o: 60, l: 48, i: 40, d: 8, p: "96 und (160%)" }, "Porta Origen Post": { o: 20, l: 13, i: 12, d: 1, p: "26 und (130%)" }, "Porta Origen Pre": { o: 15, l: 10, i: 10, d: 0, p: "20 und (133%)" }, "Línea Nueva": { o: 15, l: 10, i: 9, d: 1, p: "20 und (133%)" } } }
        ];

        tablas.innerHTML = prods.map(p => {
            let topName = "Carlos Mendoza (Tú)";
            if (p === "⚡ Postpago Total" || p === "Porta Origen Post" || p === "Línea Nueva") topName = "Ana Torres";
            return `
            <div class="table-container">
                <div class="table-title">Avance Mensual: ${p}</div>
                <div class="table-slider-container" style="border:none; box-shadow:none; margin-bottom:0;">
                    <table>
                        <thead><tr><th>Asesor</th><th>Objetivo</th><th>Logrado</th><th>Ideal</th><th>Desfase</th><th>Proyección Cierre</th></tr></thead>
                        <tbody>
                            ${asesoresMock.map(ase => `
                                <tr>
                                    <td><strong>${ase.name}</strong></td>
                                    <td>${ase.datos[p].o}</td>
                                    <td>${ase.datos[p].l}</td>
                                    <td>${ase.datos[p].i}</td>
                                    <td style="color:${ase.datos[p].d >= 0 ? '#10b981' : '#ef4444'}">${ase.datos[p].d >= 0 ? '+' : ''}${ase.datos[p].d}</td>
                                    <td><strong>${ase.datos[p].p}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="top-performer-banner">🏆 Asesor Top en Proyección: ${topName}</div>
            </div>`;
        }).join('');
    } else {
        tablas.innerHTML = `
            <div class="table-container">
                <div class="table-title">Productividad Cruzada del Equipo — Vista Diaria</div>
                <div class="table-slider-container" style="border:none; box-shadow:none; margin-bottom:0;">
                    <table>
                        <thead>
                            <tr><th>Asesor</th><th>⚡ Postpago Total</th><th>Renovación</th><th>Prepago Total</th><th>Porta Origen Post</th><th>Porta Origen Pre</th><th>Línea Nueva</th></tr>
                        </thead>
                        <tbody>
                            <tr><td><strong>Carlos Mendoza (Tú)</strong></td><td style="color:#10b981; font-weight:700;">4</td><td>2</td><td style="color:#f97316; font-weight:700;">4</td><td>1</td><td>1</td><td>2</td></tr>
                            <tr><td>Ana Torres</td><td style="color:#10b981; font-weight:700;">9</td><td>3</td><td style="color:#f97316; font-weight:700;">8</td><td>3</td><td>2</td><td>4</td></tr>
                        </tbody>
                    </table>
                </div>
            </div>`;
    }
}