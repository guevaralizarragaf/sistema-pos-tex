/* ==========================================================================
   FORTALECERNOS SAC - SISTEMA DE GESTIÓN DE PDV (TEX ICA II)
   MOTOR DE LÓGICA CORE: CONTROLADOR MODULAR EMERXENTE v1.1
   ========================================================================== */

// --- ESTADO GLOBAL DE LA APLICACIÓN ---
let filtroTiempo = 'dia';
let streamCamara = null;
const fechaHoyISO = '2026-06-25'; // Manteniendo consistencia con la interfaz original

// Base de datos Mock para simulación de búsqueda rápida en punto de venta
const baseClientesMock = { 
    "12345678": "JUAN ROSALES PAREDES", 
    "98765432": "MARÍA ELENA GÓMEZ" 
};

// --- INICIALIZADOR DEL SISTEMA ---
window.onload = function() {
    // Sincronizar fechas por defecto en los formularios y filtros de cristal
    inicializarFechas();
    
    // Renderizar la matriz analítica por primera vez
    actualizarDashboard();
    
    // Posicionar mapa base por defecto en coordenadas de Ica (TEX ICA II)
    setMapaCoordenadas(-14.0639, -75.7292);
};

/**
 * Inicializa y unifica los selectores de fecha globales
 */
function inicializarFechas() {
    const inputsFecha = ['filtroFecha', 'fechaRegistroVenta', 'fechaRegistroInteraccion'];
    inputsFecha.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) elemento.value = fechaHoyISO;
    });
    cambioFecha(fechaHoyISO);
}

// --- GESTIÓN DE NAVEGACIÓN SPA (SINGLE PAGE APPLICATION) ---
/**
 * Cambia la sección activa modificando el DOM y controlando el hardware de la cámara
 * @param {string} sec - Identificador de la sección ('registro', 'dashboard', 'asistencia')
 */
function cambiarSeccion(sec) {
    const secciones = ['viewRegistro', 'viewDashboard', 'viewAsistencia'];
    const menus = ['menuRegistro', 'menuDashboard', 'menuAsistencia'];
    
    // Alternar visibilidad de vistas principales
    secciones.forEach(id => {
        const vista = document.getElementById(id);
        if (vista) {
            vista.classList.toggle('active-view', id === `view${sec.charAt(0).toUpperCase() + sec.slice(1)}`);
        }
    });

    // Alternar estados activos en la barra de menús
    menus.forEach(id => {
        const itemMenu = document.getElementById(id);
        if (itemMenu) {
            itemMenu.classList.toggle('active', id === `menu${sec.charAt(0).toUpperCase() + sec.slice(1)}`);
        }
    });
    
    // Orquestación del hardware fotográfico
    if (sec === 'asistencia') { 
        iniciarCamara(); 
    } else { 
        detenerCamara(); 
    }
}

/**
 * Actualiza dinámicamente la cabecera de saludo según la fecha seleccionada
 */
function cambioFecha(val) {
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const partes = val.split('-');
    const titulo = document.getElementById('tituloDinamico');
    
    if (partes.length === 3 && titulo) {
        const dia = parseInt(partes[2], 10);
        const mes = meses[parseInt(partes[1], 10) - 1];
        const prefijo = (val === fechaHoyISO) ? 'hoy' : 'el';
        titulo.innerText = `Hola Carlos, ${prefijo} ${dia} de ${mes} vendimos:`;
    }
}

// --- FORMULARIOS Y VALIDACIÓN DE CLIENTES EN BASE ---
/**
 * Captura pulsaciones de teclas para disparar búsquedas rápidas mediante tabulaciones o enter
 */
function verificarTab(e, destId) {
    if (e.keyCode === 9 || e.keyCode === 13) {
        e.preventDefault();
        buscarClienteBase(e.target.id, destId);
    }
}

/**
 * Busca un cliente en el mock local y rellena de forma automatizada los inputs del popup de cristal
 */
function buscarClienteBase(origId, destId) {
    const documento = document.getElementById(origId).value.trim();
    const destino = document.getElementById(destId);
    
    if (!destino) return;

    if (baseClientesMock[documento]) { 
        destino.value = baseClientesMock[documento]; 
    } else { 
        destino.value = ""; 
        destino.focus(); 
        alert("Documento no registrado en la base de datos."); 
    }
}

/**
 * Sanitiza la entrada de texto forzando el formato en mayúsculas tipo base de datos formal
 */
function forzarMayusculas(input) { 
    input.value = input.value.toUpperCase(); 
}

// --- REGLAS DE NEGOCIO DINÁMICAS (POPUP DE VENTAS) ---
/**
 * Aplica visualización condicional y restricciones de precios según el tipo de producto seleccionado
 */
function aplicarReglasNegocio() {
    const producto = document.getElementById('producto').value;
    const gCliente = document.getElementById('groupCliente');
    const gTipoProducto = document.getElementById('groupTipoProducto');
    const selTipoProducto = document.getElementById('tipoProducto');
    const gLinea = document.getElementById('groupLinea');
    const gPrecioSim = document.getElementById('groupPrecioSim');
    const fieldsFisicos = ['groupIccid', 'groupModeloSim'];
    
    // Reseteos e interacciones condicionales por producto
    if (producto === "Accesorio") {
        ocultarElementos([gCliente, gTipoProducto, gLinea, gPrecioSim, document.getElementById('groupImei'), document.getElementById('groupEquipo'), document.getElementById('groupPrecioEquipo')]);
        fieldsFisicos.forEach(id => document.getElementById(id).style.display = 'none');
        document.getElementById('groupPrecioAccesorio').style.style.display = 'flex';
    } else if (producto === "Mis In") {
        mostrarElementos([gLinea, gPrecioSim, gCliente, gTipoProducto]);
        document.getElementById('cliente').value = "Base";
        document.getElementById('cliente').disabled = true;
        selTipoProducto.value = "SIM";
        selTipoProducto.disabled = true;
        fieldsFisicos.forEach(id => document.getElementById(id).style.display = 'none');
        ocultarElementos([document.getElementById('groupImei'), document.getElementById('groupEquipo'), document.getElementById('groupPrecioEquipo'), document.getElementById('groupPrecioAccesorio')]);
        evaluarReglasPrecios();
    } else {
        mostrarElementos([gCliente, gTipoProducto, gLinea, gPrecioSim]);
        fieldsFisicos.forEach(id => document.getElementById(id).style.display = 'flex');
        document.getElementById('groupPrecioAccesorio').style.display = 'none';
        document.getElementById('cliente').disabled = false;
        selTipoProducto.disabled = false;
        
        if (producto === "Renovación") {
            document.getElementById('cliente').value = "Base";
            document.getElementById('cliente').disabled = true;
            selTipoProducto.value = "PACK";
            selTipoProducto.disabled = true;
        }
        toggleCamposEquipo();
    }
}

function toggleCamposEquipo() {
    const tipoProducto = document.getElementById('tipoProducto').value;
    const esPack = (tipoProducto === "PACK");
    const displayValue = esPack ? 'flex' : 'none';
    
    document.getElementById('groupImei').style.display = displayValue;
    document.getElementById('groupEquipo').style.display = displayValue;
    document.getElementById('groupPrecioEquipo').style.display = displayValue;
    evaluarReglasPrecios();
}

/**
 * Automatiza precios en cero para transacciones intangibles
 */
function evaluarReglasPrecios() {
    const prod = document.getElementById('producto').value;
    const modeloSim = document.getElementById('modeloSim').value;
    const inputPrecioSim = document.getElementById('precioSim');
    
    if (prod === "Renovación" || prod === "Mis In" || modeloSim === "eSIM") { 
        inputPrecioSim.value = 0; 
        inputPrecioSim.disabled = true; 
    } else { 
        inputPrecioSim.disabled = false; 
        if (inputPrecioSim.value == "0") inputPrecioSim.value = ""; 
    }
}

// Helpers visuales internos
function ocultarElementos(arr) { arr.forEach(el => { if(el) el.style.display = 'none'; }); }
function mostrarElementos(arr) { arr.forEach(el => { if(el) el.style.display = 'flex'; }); }

// --- MODALES (APERTURA Y CIERRE CON ANIMACIÓN DE CONTROL) ---
function openModal(tipo) {
    const modalId = (tipo === 'venta') ? 'modalVenta' : 'modalInteraccion';
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        if (tipo === 'venta') aplicarReglasNegocio();
    }
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove('active');
}

// --- HARDWARE: ASISTENCIA, CÁMARA WEB Y GEOLOCALIZACIÓN GPS ---
function iniciarCamara() {
    const video = document.getElementById('webcam');
    if (video && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) { 
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then(stream => {
                streamCamara = stream; 
                video.srcObject = stream;
            })
            .catch(err => console.warn("Acceso a cámara web denegado o no disponible:", err));
    }
}

function detenerCamara() { 
    if (streamCamara) { 
        streamCamara.getTracks().forEach(track => track.stop()); 
        streamCamara = null;
    } 
}

function marcarAsistenciaWithGPS(tipoLog) {
    const flash = document.getElementById('flash');
    if (flash) {
        flash.classList.add('flash-active');
        setTimeout(() => flash.classList.remove('flash-active'), 400);
    }

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                const lat = pos.coords.latitude; 
                const lon = pos.coords.longitude;
                document.getElementById('txtCoordenadas').innerText = `Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`;
                setMapaCoordenadas(lat, lon);
                document.getElementById('logHoy').innerHTML = `<span class="badge badge-postpago" style="background:rgba(16,185,129,0.2); color:#10b981;">${tipoLog} OK</span>`;
            },
            err => {
                alert("Ubicación obligatoria para marcar asistencia. Activando coordenadas TEX ICA II de contingencia.");
                document.getElementById('logHoy').innerHTML = `<span class="badge badge-prepago">${tipoLog} (Manual)</span>`;
            }
        );
    }
}

function setMapaCoordenadas(lat, lon) {
    const mapa = document.getElementById('mapaIframe');
    if (mapa) {
        mapa.src = `https://maps.google.com/maps?q=${lat},${lon}&z=16&output=embed`;
    }
}

// --- CONMUTACIÓN DE TEMAS ---
function toggleTema(checkbox) { 
    document.documentElement.setAttribute('data-theme', checkbox.checked ? 'white' : ''); 
}

// --- MOTOR INYECTOR DE DATOS PARA DASHBOARD (PROYECCIÓN & CUMPLIMIENTO) ---
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

    // Repositorio analítico estructurado
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

    // Inyección de Cards Analíticas con barras de progreso Liquid Glass
    container.innerHTML = cardsData[filtroTiempo].map(item => {
        const isPt = item.title.includes("Postpago Total");
        const isPre = item.title.includes("Prepago");
        
        let subGridAvanzado = (filtroTiempo === 'mes') ? `
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
                ${subGridAvanzado}
            </div>`;
    }).join('');

    // Inyección de Tablas Cruzadas de Rendimiento de Asesores por Región
    if (filtroTiempo === 'mes') {
        const productos = ["⚡ Postpago Total", "Renovación", "Prepago Total", "Porta Origen Post", "Porta Origen Pre", "Línea Nueva"];
        const asesoresMock = [
            { name: "Carlos Mendoza (Tú)", datos: { "⚡ Postpago Total": { o: 50, l: 32, i: 30, d: 2, p: "64 und (128%)" }, "Renovación": { o: 20, l: 14, i: 13, d: 1, p: "28 und (140%)" }, "Prepago Total": { o: 60, l: 48, i: 40, d: 8, p: "96 und (160%)" }, "Porta Origen Post": { o: 20, l: 12, i: 12, d: 0, p: "24 und (120%)" }, "Porta Origen Pre": { o: 15, l: 11, i: 10, d: 1, p: "22 und (146%)" }, "Línea Nueva": { o: 15, l: 9, i: 9, d: 0, p: "18 und (120%)" } } },
            { name: "Ana Torres", datos: { "⚡ Postpago Total": { o: 50, l: 33, i: 30, d: 3, p: "66 und (132%)" }, "Renovación": { o: 20, l: 10, i: 13, d: -3, p: "20 und (100%)" }, "Prepago Total": { o: 60, l: 48, i: 40, d: 8, p: "96 und (160%)" }, "Porta Origen Post": { o: 20, l: 13, i: 12, d: 1, p: "26 und (130%)" }, "Porta Origen Pre": { o: 15, l: 10, i: 10, d: 0, p: "20 und (133%)" }, "Línea Nueva": { o: 15, l: 10, i: 9, d: 1, p: "20 und (133%)" } } }
        ];

        tablas.innerHTML = productos.map(p => {
            let topAsesor = "Carlos Mendoza (Tú)";
            if (p === "⚡ Postpago Total" || p === "Porta Origen Post" || p === "Línea Nueva") topAsesor = "Ana Torres";
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
                <div class="top-performer-banner">🏆 Asesor Top en Proyección: ${topAsesor}</div>
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