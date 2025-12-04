const BASE_URL = "https://asistencia-iot-api.onrender.com"; // Tu backend en Render
let ESP32_BASE_URL = 'http://192.168.1.108'; // Tu ESP32 local

// Asegúrate de tener esta constante definida
const API_BASE_URL = BASE_URL;

const Toast = Swal.mixin({
    toast: true,
    position: 'top-end',
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    didOpen: (toast) => {
        toast.addEventListener('mouseenter', Swal.stopTimer)
        toast.addEventListener('mouseleave', Swal.resumeTimer)
    }
});

// FUNCIONES BÁSICAS
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "flex";
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "none";
}

function showSection(id) {
    document.querySelectorAll(".pane").forEach(p => {
        p.style.display = "none";
    });
    const section = document.getElementById(id);
    if (section) {
        section.style.display = "block";
    }
    if (id === "section-list-employees") {
        loadEmployees();
    } else if (id === "section-schedules") {
        loadSchedules();
    } else if (id === "section-esp32-control") {
        updateESP32Status();
    } else if (id === "section-admin-attendances") {
        loadUsersForAttendance();
        loadAttendanceSummary();
    } else if (id === "section-admin-registration") {
        loadAdminInfo();
    } else if (id === "section-access-reports") {
        // Cargar reportes al mostrar la sección
        setTimeout(() => {
            loadAccessReports();
        }, 100);
    }
}

// Función para obtener los headers de autenticación
function getAuthHeaders() {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        Toast.fire({
            icon: 'error',
            title: 'No hay sesión activa'
        });
        throw new Error('No hay token de autenticación');
    }
    
    return {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    };
}

// ========== NAVEGACIÓN ==========
function initializeNavigation() {
    const navRegister = document.getElementById("nav-register-employee");
    if (navRegister) {
        navRegister.addEventListener("click", () => showSection("section-register-employee"));
    }
    
    const navList = document.getElementById("nav-list-employees");
    if (navList) {
        navList.addEventListener("click", () => {
            showSection("section-list-employees");
            loadEmployees();
        });
    }
    
    const navSchedules = document.getElementById("nav-schedules");
    if (navSchedules) {
        navSchedules.addEventListener("click", () => {
            showSection("section-schedules");
            loadSchedules();
        });
    }
    
    const navAttendances = document.getElementById("nav-attendances");
    if (navAttendances) {
        navAttendances.addEventListener("click", () => showSection("section-admin-attendances"));
    }
    
    // AGREGAR ESTO PARA REPORTES DE ACCESO
    const navAccessReports = document.getElementById("nav-access-reports");
    if (navAccessReports) {
        navAccessReports.addEventListener("click", () => {
            showSection("section-access-reports");
        });
    }
    
    const navEsp32Control = document.getElementById("nav-esp32-control");
    if (navEsp32Control) {
        navEsp32Control.addEventListener("click", () => showSection("section-esp32-control"));
    }
    
    // Botón de Mis Credenciales (si está en el HTML)
    const navAdminRegistration = document.getElementById("nav-admin-registration");
    if (navAdminRegistration) {
        navAdminRegistration.addEventListener("click", () => {
            showSection("section-admin-registration");
            loadAdminInfo();
        });
    }
    
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "../pages/login.html";
        });
    }
}

// ========== REPORTES DE ACCESO ==========
async function loadAccessReports(page = 1) {
    try {
        console.log("Cargando reportes de acceso...");
        
        // Obtener valores de los filtros
        const userId = document.getElementById('accessUserSelect')?.value || '';
        const sensorType = document.getElementById('accessSensorSelect')?.value || '';
        const status = document.getElementById('accessStatusSelect')?.value || '';
        const actionType = document.getElementById('accessActionType')?.value || '';
        const startDate = document.getElementById('accessStart')?.value || '';
        const endDate = document.getElementById('accessEnd')?.value || '';
        
        // Construir URL usando el endpoint /access/history (que ya existe)
        let url = `${BASE_URL}/access/history?`;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        if (sensorType) params.append('sensor_type', sensorType);
        
        // Si hay fecha de inicio, usarla como filtro de fecha
        if (startDate) {
            const date = new Date(startDate);
            params.append('date', date.toISOString().split('T')[0]);
        }
        
        url += params.toString();
        
        console.log("URL de consulta:", url);
        
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error("Error en respuesta:", errorText);
            throw new Error(`Error ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        console.log("Datos recibidos:", data);
        
        // Calcular estadísticas
        const stats = calculateAccessStatistics(data);
        updateAccessStatistics(stats);
        
        // Actualizar tabla
        renderAccessLogsTable(data);
        
        // Mostrar mensaje si no hay datos
        const paginationContainer = document.getElementById('accessLogPagination');
        if (paginationContainer) {
            if (!data || data.length === 0) {
                paginationContainer.innerHTML = 
                    '<p style="color: #666; text-align: center;">No hay registros de acceso</p>';
            } else {
                paginationContainer.innerHTML = 
                    `<small>Mostrando ${data.length} registros</small>`;
            }
        }
        
    } catch (error) {
        console.error('Error:', error);
        Swal.fire({
            icon: 'error', 
            title: 'Error', 
            text: 'No se pudieron cargar los reportes de acceso: ' + error.message,
            timer: 3000
        });
    }
}

function calculateAccessStatistics(logs) {
    const stats = {
        total: logs.length || 0,
        allowed: 0,
        denied: 0,
        fingerprint: 0,
        rfid: 0
    };
    
    if (!logs || !Array.isArray(logs)) return stats;
    
    logs.forEach(log => {
        if (log.status === 'Permitido') stats.allowed++;
        if (log.status === 'Denegado') stats.denied++;
        if (log.sensor_type === 'Huella') stats.fingerprint++;
        if (log.sensor_type === 'RFID') stats.rfid++;
    });
    
    return stats;
}

function updateAccessStatistics(stats) {
    const totalEl = document.getElementById('totalAccessCount');
    const allowedEl = document.getElementById('allowedAccessCount');
    const deniedEl = document.getElementById('deniedAccessCount');
    const fingerprintEl = document.getElementById('fingerprintAccessCount');
    const rfidEl = document.getElementById('rfidAccessCount');
    
    if (totalEl) totalEl.textContent = stats.total || 0;
    if (allowedEl) allowedEl.textContent = stats.allowed || 0;
    if (deniedEl) deniedEl.textContent = stats.denied || 0;
    if (fingerprintEl) fingerprintEl.textContent = stats.fingerprint || 0;
    if (rfidEl) rfidEl.textContent = stats.rfid || 0;
}

function renderAccessLogsTable(logs) {
    const tbody = document.getElementById('accessLogTableBody');
    if (!tbody) {
        console.error("No se encontró el elemento accessLogTableBody");
        return;
    }
    
    tbody.innerHTML = '';
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 20px;">
                    No se encontraron registros de acceso
                </td>
            </tr>
        `;
        return;
    }
    
    logs.forEach(log => {
        // Determinar clase de estado
        let statusClass = '';
        if (log.status === 'Permitido') {
            statusClass = 'status-success';
        } else if (log.status === 'Denegado') {
            statusClass = 'status-error';
        }
        
        // Determinar ícono según sensor
        let sensorIcon = '🟢';
        if (log.sensor_type === 'Huella') sensorIcon = '👆';
        else if (log.sensor_type === 'RFID') sensorIcon = '🪪';
        else if (log.sensor_type === 'ZonaSegura') sensorIcon = '🔒';
        
        // Determinar tipo de acción (extraer de action_type si existe)
        let actionType = 'ACCESO';
        if (log.action_type) {
            if (log.action_type.includes('ENTRADA')) actionType = 'ENTRADA';
            else if (log.action_type.includes('SALIDA')) actionType = 'SALIDA';
            else if (log.action_type.includes('ZONA_SEGURA')) actionType = 'ZONA SEGURA';
        }
        
        // Determinar ícono según tipo de acción
        let actionIcon = '↔️';
        if (actionType === 'ENTRADA') actionIcon = '⬇️';
        else if (actionType === 'SALIDA') actionIcon = '⬆️';
        else if (actionType.includes('ZONA SEGURA')) actionIcon = '🔐';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.id}</td>
            <td>
                <strong>${log.user_id || 'N/A'}</strong><br>
                <small>Usuario ID</small>
            </td>
            <td>
                ${formatDateTime(log.timestamp)}<br>
                <small style="color: #666;">${formatRelativeTime(log.timestamp)}</small>
            </td>
            <td>${sensorIcon} ${log.sensor_type}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${log.status}
                </span>
            </td>
            <td>
                <small style="font-family: monospace;">
                    ${log.rfid ? `RFID: ${log.rfid}` : log.huella_id ? `Huella ID: ${log.huella_id}` : 'N/A'}
                </small>
            </td>
            <td>
                ${actionIcon} ${actionType}
            </td>
            <td>
                ${log.reason || log.motivo_decision || 'N/A'}
            </td>
            <td>
                <button onclick="showAccessDetails(${log.id})" class="btn small">
                    Detalles
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function formatDateTime(timestamp) {
    if (!timestamp) return 'N/A';
    
    try {
        const date = new Date(timestamp);
        return date.toLocaleString('es-ES', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        return timestamp;
    }
}

async function showAccessDetails(logId) {
    try {
        Swal.fire({
            title: 'Cargando detalles...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const response = await fetch(`${BASE_URL}/access/history`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al obtener detalles');
        
        const logs = await response.json();
        const log = logs.find(l => l.id === logId);
        
        if (!log) {
            Swal.fire('Error', 'No se encontró el registro', 'error');
            return;
        }
        
        // Formatear fecha
        const date = new Date(log.timestamp);
        const formattedDate = date.toLocaleString('es-ES', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        // Crear contenido del modal
        let detailsHtml = `
            <div style="text-align: left; max-width: 500px;">
                <h3>Detalles del Acceso</h3>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                    <p><strong>ID Registro:</strong> ${log.id}</p>
                    <p><strong>Fecha/Hora:</strong> ${formattedDate}</p>
                    <p><strong>Sensor:</strong> ${log.sensor_type}</p>
                    <p><strong>Estado:</strong> 
                        <span class="${log.status === 'Permitido' ? 'status-success' : 'status-error'}">
                            ${log.status}
                        </span>
                    </p>
                    <p><strong>Usuario ID:</strong> ${log.user_id}</p>
        `;
        
        if (log.rfid) {
            detailsHtml += `<p><strong>RFID:</strong> <code>${log.rfid}</code></p>`;
        }
        
        if (log.huella_id) {
            detailsHtml += `<p><strong>Huella ID:</strong> ${log.huella_id}</p>`;
        }
        
        if (log.action_type) {
            detailsHtml += `<p><strong>Tipo de acción:</strong> ${log.action_type}</p>`;
        }
        
        if (log.reason) {
            detailsHtml += `<p><strong>Motivo/Detalles:</strong> ${log.reason}</p>`;
        }
        
        detailsHtml += `</div>`;
        
        Swal.fire({
            title: 'Información de Acceso',
            html: detailsHtml,
            icon: 'info',
            confirmButtonText: 'Cerrar',
            width: '600px'
        });
        
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'No se pudieron cargar los detalles', 'error');
    }
}

async function exportAccessCSV() {
    try {
        Swal.fire({
            title: 'Generando archivo CSV...',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Obtener todos los logs (sin filtros por ahora)
        const response = await fetch(`${BASE_URL}/access/history`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al exportar');
        
        const logs = await response.json();
        
        // Crear contenido CSV
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "ID,Usuario ID,Fecha/Hora,Sensor,Estado,RFID,Huella ID,Acción,Motivo\n";
        
        logs.forEach(log => {
            const row = [
                log.id,
                log.user_id || '',
                log.timestamp ? new Date(log.timestamp).toLocaleString('es-ES') : '',
                log.sensor_type || '',
                log.status || '',
                log.rfid || '',
                log.huella_id || '',
                log.action_type || '',
                (log.reason || '').replace(/"/g, '""') // Escapar comillas
            ];
            csvContent += '"' + row.join('","') + '"\n';
        });
        
        // Descargar archivo
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `reporte_accesos_${new Date().toISOString().slice(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        Swal.close();
        Toast.fire({
            icon: 'success',
            title: 'CSV generado y descargado'
        });
        
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'No se pudo exportar el reporte', 'error');
    }
}

async function loadAccessUsers() {
    try {
        const response = await fetch(`${BASE_URL}/users/`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al cargar usuarios');
        
        const data = await response.json();
        const select = document.getElementById('accessUserSelect');
        
        if (!select) return;
        
        // Limpiar opciones excepto la primera
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Agregar usuarios
        const users = data.users || data;
        
        if (users && Array.isArray(users)) {
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.nombre} ${user.apellido} (${user.username})`;
                select.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error al cargar usuarios para filtro:', error);
    }
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    
    try {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'hace unos segundos';
        if (diffMins < 60) return `hace ${diffMins} min`;
        if (diffHours < 24) return `hace ${diffHours} horas`;
        if (diffDays < 7) return `hace ${diffDays} días`;
        
        return date.toLocaleDateString('es-ES');
    } catch (error) {
        return '';
    }
}

// ========== FUNCIONES PARA EL REGISTRO DEL ADMINISTRADOR ==========
async function loadAdminInfo() {
    try {
        const token = localStorage.getItem("jwtToken");
        if (!token) {
            Toast.fire({
                icon: 'error',
                title: 'No hay sesión activa'
            });
            return;
        }

        // Decodificar el token
        const payload = decodeJWT(token);
        const userId = payload.sub || payload.user_id || payload.id;
        
        if (!userId) {
            Toast.fire({
                icon: 'error',
                title: 'Error: No se pudo identificar al administrador'
            });
            return;
        }

        // Obtener información del administrador
        const res = await fetch(`${BASE_URL}/users/${userId}`, {
            headers: { 
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            throw new Error(`Error ${res.status}`);
        }

        const adminData = await res.json();
        
        // Actualizar la UI
        document.getElementById('admin-name').textContent = 
            `${adminData.nombre} ${adminData.apellido}`;
        document.getElementById('admin-username').textContent = adminData.username;
        
        const huellaElement = document.getElementById('admin-huella');
        const rfidElement = document.getElementById('admin-rfid');
        
        if (adminData.huella_id) {
            huellaElement.textContent = adminData.huella_id;
            huellaElement.style.color = 'green';
            huellaElement.style.fontWeight = 'bold';
        } else {
            huellaElement.textContent = "No asignado";
            huellaElement.style.color = 'red';
        }
        
        if (adminData.rfid) {
            rfidElement.textContent = adminData.rfid;
            rfidElement.style.color = 'green';
            rfidElement.style.fontWeight = 'bold';
        } else {
            rfidElement.textContent = "No asignado";
            rfidElement.style.color = 'red';
        }
        
        // Actualizar botones
        const fingerprintBtn = document.querySelector('button[onclick="registerAdminFingerprint()"]');
        const rfidBtn = document.querySelector('button[onclick="registerAdminRFID()"]');
        
        if (fingerprintBtn) {
            if (adminData.huella_id) {
                fingerprintBtn.textContent = '✓ Huella Registrada';
                fingerprintBtn.disabled = true;
                fingerprintBtn.style.background = '#6c757d';
            } else {
                fingerprintBtn.textContent = 'Registrar mi Huella';
                fingerprintBtn.disabled = false;
                fingerprintBtn.style.background = '#28a745';
            }
        }
        
        if (rfidBtn) {
            if (adminData.rfid) {
                rfidBtn.textContent = '✓ RFID Registrado';
                rfidBtn.disabled = true;
                rfidBtn.style.background = '#6c757d';
            } else {
                rfidBtn.textContent = 'Registrar mi RFID';
                rfidBtn.disabled = false;
                rfidBtn.style.background = '#ffc107';
            }
        }

    } catch (err) {
        console.error("Error cargando info admin:", err);
        Toast.fire({
            icon: 'error',
            title: 'Error al cargar información: ' + err.message
        });
    }
}

function decodeJWT(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        
        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error("Error decodificando JWT:", error);
        return {};
    }
}

// ========== REGISTRO DE HUELLA PARA ADMIN ==========
async function registerAdminFingerprint() {
    try {
        const token = localStorage.getItem("jwtToken");
        if (!token) {
            Toast.fire({ icon: 'error', title: 'No hay sesión activa' });
            return;
        }

        const payload = decodeJWT(token);
        const userId = payload.sub;
        
        if (!userId) {
            Toast.fire({ icon: 'error', title: 'No se pudo identificar al administrador' });
            return;
        }

        console.log("Registrando huella para admin ID:", userId);
        
        // Verificar conexión con ESP32
        await updateESP32Status();
        
        // 1. Asignar ID de huella
        const assignResponse = await fetch(`${BASE_URL}/users/huella/assign-id`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ user_id: Number(userId) })
        });

        if (!assignResponse.ok) {
            throw new Error('Error asignando ID de huella');
        }

        const assignData = await assignResponse.json();

        if (!assignData.success) {
            Toast.fire({
                icon: 'error',
                title: "Error: " + (assignData.message || "No se pudo asignar ID")
            });
            return;
        }

        const huellaId = assignData.huella_id;
        
        // 2. Asociar al usuario
        const assignHuellaResponse = await fetch(`${BASE_URL}/users/huella/assign-manual`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                user_id: Number(userId),
                huella_id: huellaId
            })
        });

        if (!assignHuellaResponse.ok) {
            throw new Error('Error asociando huella');
        }

        // 3. Actualizar información
        await loadAdminInfo();
        
        // 4. Confirmación
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO DE HUELLA',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Administrador:</strong> ID ${userId}</p>
                    <p><strong>Huella ID Asignado:</strong> ${huellaId}</p>
                    <p style="color: green;">✅ Preparado para registro físico</p>
                    <hr>
                    <p><strong>Instrucciones:</strong></p>
                    <ol>
                        <li>Diríjase al dispositivo ESP32</li>
                        <li>Espere que aparezca "REGISTRO REMOTO"</li>
                        <li>Siga las instrucciones en pantalla</li>
                        <li>Coloque el dedo cuando se lo indique</li>
                    </ol>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Continuar',
            cancelButtonText: 'Cancelar',
            width: 500
        });

        if (!confirmResult.isConfirmed) return;

        // 5. Enviar comando al ESP32
        const commandResponse = await sendAdminCommandToESP32('REGISTER_FINGERPRINT', huellaId, userId, true);
        
        if (!commandResponse || commandResponse.status !== 'success') {
            throw new Error(commandResponse?.message || 'Error enviando comando al ESP32');
        }

        // 6. Monitorear progreso
        let checkCount = 0;
        const maxChecks = 120;
        
        await Swal.fire({
            title: 'REGISTRO EN PROGRESO',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px;">Esperando registro físico...</p>
                    <p><small>Huella ID: ${huellaId}</small></p>
                    <p><small>Administrador ID: ${userId}</small></p>
                    <div id="fingerprint-progress" style="margin-top: 15px; font-size: 12px;">
                        Tiempo: 0/${maxChecks} segundos
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: 400,
            willOpen: () => {
                const progressInterval = setInterval(async () => {
                    checkCount++;
                    const progressEl = document.getElementById('fingerprint-progress');
                    if (progressEl) {
                        progressEl.innerHTML = `Tiempo: ${checkCount}/${maxChecks} segundos`;
                    }
                    
                    // Verificar cada 2 segundos
                    if (checkCount % 2 === 0) {
                        try {
                            const verifyResponse = await fetch(`${BASE_URL}/users/huella/check/${huellaId}`, {
                                headers: { "Authorization": "Bearer " + token }
                            });
                            
                            if (verifyResponse.ok) {
                                const verifyData = await verifyResponse.json();
                                
                                if (verifyData.success && verifyData.exists && verifyData.has_template) {
                                    clearInterval(progressInterval);
                                    Swal.close();
                                    
                                    await loadAdminInfo();
                                    
                                    Swal.fire({
                                        icon: 'success',
                                        title: '¡HUELLA REGISTRADA!',
                                        html: `
                                            <div style="text-align: left;">
                                                <p><strong>Huella ID:</strong> ${huellaId}</p>
                                                <p><strong>Estado:</strong> Template guardado correctamente</p>
                                                <p style="color: green; margin-top: 10px;">
                                                    ✅ Ahora puedes acceder con tu huella
                                                </p>
                                            </div>
                                        `,
                                        confirmButtonText: 'Aceptar',
                                        width: 500
                                    });
                                    return;
                                }
                            }
                        } catch (error) {
                            console.error("Error verificando:", error);
                        }
                    }
                    
                    // Timeout
                    if (checkCount >= maxChecks) {
                        clearInterval(progressInterval);
                        Swal.fire({
                            icon: 'warning',
                            title: 'Tiempo agotado',
                            html: `
                                <div style="text-align: left;">
                                    <p>No se completó el registro en el tiempo esperado.</p>
                                    <p><strong>Verifique:</strong></p>
                                    <ul>
                                        <li>Que el ESP32 esté encendido</li>
                                        <li>Que siguió las instrucciones en pantalla</li>
                                        <li>Que colocó correctamente el dedo</li>
                                    </ul>
                                </div>
                            `,
                            confirmButtonText: 'Entendido',
                            width: 500
                        }).then(() => {
                            loadAdminInfo();
                        });
                    }
                }, 1000);
                
                Swal.getPopup().setAttribute('data-interval-id', progressInterval);
            },
            willClose: () => {
                const intervalId = Swal.getPopup().getAttribute('data-interval-id');
                if (intervalId) clearInterval(intervalId);
            }
        });

    } catch (err) {
        console.error('Error en registro de huella del admin:', err);
        
        Swal.fire({
            icon: 'error',
            title: 'ERROR EN EL REGISTRO',
            html: `
                <div style="text-align: left;">
                    <p><strong>Error:</strong> ${err.message}</p>
                    <hr>
                    <p><strong>Posibles soluciones:</strong></p>
                    <ol>
                        <li>Verifique la conexión con el ESP32</li>
                        <li>Asegúrese que el ESP32 esté encendido</li>
                        <li>Revise la IP configurada en "Control ESP32"</li>
                        <li>Pruebe la conexión con el botón "Probar Conexión"</li>
                    </ol>
                    <button onclick="loadAdminInfo()" class="btn btn-primary mt-3" style="padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        Actualizar Información
                    </button>
                </div>
            `,
            width: 500
        });
    }
}

// ========== OTRAS FUNCIONES (debes completar estas si no las tienes) ==========

function initializeEmployeeRegistration() {
    const btnSaveEmployee = document.getElementById("btn-save-employee");
    if (btnSaveEmployee) {
        btnSaveEmployee.addEventListener("click", registerEmployee);
    }
}

async function registerEmployee() {
    // Tu código existente para registrar empleado
    const nombre = document.getElementById("empName").value.trim();
    const apellido = document.getElementById("empLastName").value.trim();
    const username = document.getElementById("empUsername").value.trim();
    const password = document.getElementById("empPassword").value.trim();
    const genero = document.getElementById("empGenero").value.trim();
    const fecha_nacimiento = document.getElementById("empDOB").value;
    const fecha_contrato = document.getElementById("empHireDate").value;
    const area_trabajo = document.getElementById("emprea").value.trim();

    if (!nombre || !apellido || !username || !password) {
        Toast.fire({ icon: 'warning', title: 'Complete todos los campos obligatorios' });
        return;
    }

    const payload = {
        nombre, apellido, username, password, genero,
        fecha_nacimiento, fecha_contrato, area_trabajo,
        role: "empleado", rfid: null
    };

    try {
        const res = await fetch(`${BASE_URL}/users/create`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            Toast.fire({ icon: 'error', title: data.msg || "Error al registrar empleado" });
            return;
        }

        Toast.fire({ icon: 'success', title: 'Empleado registrado correctamente' });
        
        // Limpiar campos
        document.getElementById("empName").value = "";
        document.getElementById("empLastName").value = "";
        document.getElementById("empUsername").value = "";
        document.getElementById("empPassword").value = "";
        document.getElementById("empGenero").value = "";
        document.getElementById("empDOB").value = "";
        document.getElementById("empHireDate").value = "";
        document.getElementById("emprea").value = "";

        loadEmployees();

    } catch (err) {
        Toast.fire({ icon: 'error', title: 'Error en el servidor' });
        console.error(err);
    }
}

async function loadEmployees() {
    // Tu código existente para cargar empleados
    try {
        const res = await fetch(`${BASE_URL}/users/?page=1&per_page=50`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("jwtToken") }
        });

        if (!res.ok) {
            Toast.fire({ icon: 'error', title: 'No se pudo cargar la lista de usuarios' });
            return;
        }

        const data = await res.json();
        const tbody = document.getElementById("employeesTableBody");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (data.users && data.users.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 20px;">
                        No hay empleados registrados
                    </td>
                </tr>
            `;
            return;
        }

        data.users.forEach(u => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.nombre}</td>
                <td>${u.apellido}</td>
                <td>${u.role}</td>
                <td>${u.area_trabajo || "-"}</td>
                <td>
                    ${u.huella_id || "-"}
                    ${u.huella_id ? '<br><small style="color: green;">✓ Asignado</small>' : ''}
                </td>
                <td>
                    ${u.rfid || "-"}
                    ${u.rfid ? '<br><small style="color: green;">✓ Asignado</small>' : ''}
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn small btn-fingerprint" 
                                onclick="registerFingerprint(${u.id})"
                                ${u.huella_id ? 'disabled' : ''}>
                            ${u.huella_id ? '✓ Huella' : 'Registrar huella'}
                        </button>
                        <button class="btn small btn-rfid" 
                                onclick="registerRFID(${u.id})"
                                ${u.rfid ? 'disabled' : ''}>
                            ${u.rfid ? '✓ RFID' : 'Registrar RFID'}
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });

        Toast.fire({ icon: 'success', title: `Cargados ${data.users.length} empleados` });

    } catch (err) {
        console.error(err);
        Toast.fire({ icon: 'error', title: 'Error cargando usuarios' });
    }
}

// ========== FUNCIONES ESP32 (existentes) ==========
function configureESP32IP() {
    const currentIP = localStorage.getItem('esp32_ip') || '192.168.1.108';
    const newIP = prompt(' CONFIGURAR IP DEL ESP32\n\nIngrese la IP del dispositivo:', currentIP);

    if (newIP) {
        if (newIP.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
            localStorage.setItem('esp32_ip', newIP);
            ESP32_BASE_URL = `http://${newIP}`;
            document.getElementById('current-ip').textContent = newIP;
            Toast.fire({
                icon: 'success',
                title: 'IP configurada correctamente: ' + newIP
            });
            updateESP32Status();
        } else {
            Toast.fire({
                icon: 'error',
                title: 'Formato de IP inválido. Ejemplo: 192.168.1.108'
            });
        }
    }
}

async function updateESP32Status() {
    const statusElement = document.getElementById('esp32-status');
    const infoElement = document.getElementById('esp32-info');

    if (!statusElement) return;

    statusElement.textContent = ' Consultando estado...';
    statusElement.className = 'status-box';

    try {
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            statusElement.innerHTML = 'IP no configurada<br>Configure la IP del ESP32';
            statusElement.className = 'status-box status-offline';
            return;
        }

        const esp32Url = `http://${esp32IP}`;
        console.log("Probando conexión a:", esp32Url);
        
        // Intentar con timeout corto
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(`${esp32Url}/status`, {
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
            const data = await response.json();
            
            statusElement.innerHTML =
                ` ESP32 CONECTADO<br>` +
                ` IP: ${esp32IP}<br>` +
                ` Estado: ${data.status}<br>` +
                ` Sistema: ${data.sistema_listo ? '✅ Listo' : '❌ No listo'}`;
            statusElement.className = 'status-box status-online';

            if (infoElement) {
                infoElement.innerHTML = `
                    <p><strong>Conexión:</strong> Local (Red WiFi)</p>
                    <p><strong>IP:</strong> ${data.ip}</p>
                    <p><strong>Registro activo:</strong> ${data.registro_activo ? '✅ Sí' : '❌ No'}</p>
                    <p><strong>RFID activo:</strong> ${data.lectura_rfid_activa ? '✅ Sí' : '❌ No'}</p>
                `;
            }
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
        
    } catch (error) {
        const esp32IP = localStorage.getItem('esp32_ip');
        
        console.error("Error conectando al ESP32:", error);
        
        statusElement.innerHTML =
            ` ESP32 DESCONECTADO<br>` +
            ` IP: ${esp32IP || 'No configurada'}<br>` +
            ` Error: ${error.name === 'AbortError' ? 'Timeout (5s)' : error.message}`;
        statusElement.className = 'status-box status-offline';
    }
}

async function testESP32Connection() {
    await updateESP32Status();
    const statusElement = document.getElementById('esp32-status');
    
    if (statusElement.className.includes('status-online')) {
        Swal.fire({
            icon: 'success',
            title: 'Conexión exitosa al ESP32',
            html: `IP: ${ESP32_BASE_URL}<br>Estado: Conectado`
        });
    } else {
        Swal.fire({
            icon: 'error',
            title: 'No se pudo conectar al ESP32',
            html: `IP configurada: ${ESP32_BASE_URL}<br><br>Verifique:<br>• La IP que aparece en la pantalla del ESP32<br>• Que el ESP32 esté encendido<br>• Que estén en la misma red WiFi`
        });
    }
}

// ========== FUNCIONES QUE TE FALTAN ==========
// Añade estas funciones si no las tienes

function initializeSchedules() {
    // Tu código para inicializar horarios
    const btnOpenCreateSchedule = document.getElementById("btnOpenCreateSchedule");
    if (btnOpenCreateSchedule) {
        btnOpenCreateSchedule.addEventListener("click", () => openModal("createScheduleModal"));
    }
}

function initializeAttendance() {
    // Tu código para inicializar asistencias
    const btnLoadAttendance = document.getElementById("btnLoadAttendance");
    if (btnLoadAttendance) {
        btnLoadAttendance.addEventListener("click", loadAttendanceSummary);
    }
}

async function loadUsersForAttendance() {
    // Tu código para cargar usuarios para asistencias
    try {
        const response = await fetch(`${BASE_URL}/users/`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al cargar usuarios');
        
        const data = await response.json();
        const select = document.getElementById("attendanceUserSelect");
        
        if (!select) return;
        
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        const users = data.users || data;
        
        if (users && Array.isArray(users)) {
            users.forEach(user => {
                const option = document.createElement('option');
                option.value = user.id;
                option.textContent = `${user.nombre} ${user.apellido}`;
                select.appendChild(option);
            });
        }
        
    } catch (error) {
        console.error('Error al cargar usuarios para asistencias:', error);
    }
}

async function loadAttendanceSummary() {
    // Tu código para cargar resumen de asistencias
    try {
        const userId = document.getElementById("attendanceUserSelect")?.value || '';
        const startDate = document.getElementById("attendanceStart")?.value || '';
        const endDate = document.getElementById("attendanceEnd")?.value || '';
        const area = document.getElementById("attendanceArea")?.value || '';
        
        let url = `${BASE_URL}/attendance/summary?`;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (area) params.append('area', area);
        
        url += params.toString();
        
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al cargar asistencias');
        
        const data = await response.json();
        
        // Actualizar tabla de asistencias
        const tbody = document.getElementById("attendanceTableBody");
        if (tbody) {
            tbody.innerHTML = '';
            
            if (data.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; padding: 20px;">
                            No hay registros de asistencia
                        </td>
                    </tr>
                `;
                return;
            }
            
            data.forEach(attendance => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${attendance.user_name || 'N/A'}</td>
                    <td>${attendance.area || '-'}</td>
                    <td>${attendance.entry_time ? new Date(attendance.entry_time).toLocaleString() : '-'}</td>
                    <td>${attendance.exit_time ? new Date(attendance.exit_time).toLocaleString() : '-'}</td>
                    <td>${attendance.duration || '-'}</td>
                    <td>${attendance.state || '-'}</td>
                `;
                tbody.appendChild(row);
            });
        }
        
    } catch (error) {
        console.error('Error cargando asistencias:', error);
        Swal.fire('Error', 'No se pudieron cargar las asistencias', 'error');
    }
}

// ========== INICIALIZACIÓN ==========
document.addEventListener("DOMContentLoaded", function () {
    // Configurar IP por defecto si no existe
    if (!localStorage.getItem('esp32_ip')) {
        localStorage.setItem('esp32_ip', '192.168.1.108');
        ESP32_BASE_URL = 'http://192.168.1.108';
    } else {
        ESP32_BASE_URL = `http://${localStorage.getItem('esp32_ip')}`;
    }
    
    // Mostrar IP actual
    const currentIpElement = document.getElementById('current-ip');
    if (currentIpElement) {
        currentIpElement.textContent = localStorage.getItem('esp32_ip');
    }

    initializeNavigation();
    initializeEmployeeRegistration();
    initializeSchedules();
    initializeAttendance();
    
    // Inicializar eventos para reportes de acceso
    const btnLoadAccessLogs = document.getElementById('btnLoadAccessLogs');
    if (btnLoadAccessLogs) {
        btnLoadAccessLogs.addEventListener('click', () => loadAccessReports());
    }
    
    const btnExportAccessCSV = document.getElementById('btnExportAccessCSV');
    if (btnExportAccessCSV) {
        btnExportAccessCSV.addEventListener('click', exportAccessCSV);
    }
    
    // Configurar fecha por defecto (últimos 7 días)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const accessStartEl = document.getElementById('accessStart');
    const accessEndEl = document.getElementById('accessEnd');
    
    if (accessStartEl) {
        accessStartEl.value = startDate.toISOString().slice(0, 16);
    }
    
    if (accessEndEl) {
        accessEndEl.value = endDate.toISOString().slice(0, 16);
    }
    
    // Cargar usuarios para los filtros
    setTimeout(() => {
        loadAccessUsers();
        loadUsersForAttendance();
    }, 1000);
    
    // Actualizar estado del ESP32 cada 30 segundos
    updateESP32Status();
    setInterval(updateESP32Status, 30000);
    
    console.log("Dashboard Admin inicializado correctamente");
});