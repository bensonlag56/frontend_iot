const BASE_URL = "https://asistencia-iot-api.onrender.com"; // Tu backend en Render
let ESP32_BASE_URL = 'http://192.168.1.108'; // Tu ESP32 local

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

// FUNCIONES BÁSICAS (igual que antes)
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
    }
}

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
    const navEsp32Control = document.getElementById("nav-esp32-control");
    if (navEsp32Control) {
        navEsp32Control.addEventListener("click", () => showSection("section-esp32-control"));
    }
    
    // Crear y añadir el botón de "Mis Credenciales" al sidebar
    const sidebar = document.querySelector('.sidebar nav');
    if (sidebar) {
        const navAdminReg = document.createElement("button");
        navAdminReg.id = "nav-admin-registration";
        navAdminReg.className = "sidebar-btn";
        navAdminReg.textContent = "Mis Credenciales";
        navAdminReg.addEventListener("click", () => {
            showSection("section-admin-registration");
        });
        sidebar.appendChild(navAdminReg);
    }
    
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "../pages/login.html";
        });
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
        const commandResponse = await sendCommandToESP32Direct('REGISTER_FINGERPRINT', huellaId, userId, true);
        
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

async function registerAdminRFID() {
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

        console.log("Registrando RFID para admin ID:", userId);
        
        // 1. Verificar conexión primero
        await updateESP32Status();
        
        const statusElement = document.getElementById('esp32-status');
        if (statusElement && !statusElement.className.includes('status-online')) {
            Swal.fire({
                icon: 'warning',
                title: 'ESP32 no conectado',
                text: 'Verifique la conexión antes de continuar',
                confirmButtonText: 'OK'
            });
            return;
        }
        
        // 2. Mostrar confirmación
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO DE RFID PARA ADMIN',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Administrador ID:</strong> ${userId}</p>
                    <p style="color: green;">✅ Preparado para lectura RFID</p>
                    <hr>
                    <p><strong>Instrucciones paso a paso:</strong></p>
                    <ol>
                        <li>Diríjase al dispositivo ESP32</li>
                        <li>En el ESP32 debe aparecer: <strong>"ESPERANDO RFID"</strong></li>
                        <li>Acercar llavero RFID al lector</li>
                        <li>Espere el sonido de confirmación <strong>"BEEP"</strong></li>
                        <li>Regrese aquí para verificar</li>
                    </ol>
                    <p style="color: blue; margin-top: 10px;">
                        <i class="fas fa-info-circle"></i> Este proceso es igual al de los empleados
                    </p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Iniciar Lectura',
            cancelButtonText: 'Cancelar',
            width: 500
        });

        if (!confirmResult.isConfirmed) return;

        // 3. Enviar comando ESPECÍFICO para admin
        const commandResponse = await sendAdminCommandToESP32('READ_RFID', null, userId);
        
        if (!commandResponse || commandResponse.status !== 'success') {
            throw new Error(commandResponse?.message || 'Error enviando comando al ESP32');
        }

        // 4. Monitorear (tiempo más corto para admin)
        let checkCount = 0;
        const maxChecks = 45; // 45 segundos
        
        await Swal.fire({
            title: 'ESPERANDO RFID',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px; font-size: 16px;">
                        <strong>Acercar llavero RFID al dispositivo</strong>
                    </p>
                    <p><small>Administrador ID: ${userId}</small></p>
                    <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            <i class="fas fa-clock"></i> Tiempo: 
                            <span id="rfid-timer">0</span>/${maxChecks} segundos
                        </p>
                    </div>
                    <div style="margin-top: 15px; font-size: 12px; color: #666;">
                        <p><i class="fas fa-lightbulb"></i> Verifique en el ESP32 que dice "ESPERANDO RFID"</p>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: 450,
            willOpen: () => {
                const progressInterval = setInterval(async () => {
                    checkCount++;
                    const timerEl = document.getElementById('rfid-timer');
                    if (timerEl) {
                        timerEl.textContent = checkCount;
                    }
                    
                    // Verificar cada 3 segundos
                    if (checkCount % 3 === 0) {
                        try {
                            const userResponse = await fetch(`${BASE_URL}/users/${userId}`, {
                                headers: { "Authorization": "Bearer " + token }
                            });
                            
                            if (userResponse.ok) {
                                const userData = await userResponse.json();
                                
                                if (userData.rfid) {
                                    clearInterval(progressInterval);
                                    Swal.close();
                                    
                                    // Actualizar UI
                                    await loadAdminInfo();
                                    
                                    // Mostrar éxito
                                    Swal.fire({
                                        icon: 'success',
                                        title: '¡RFID REGISTRADO EXITOSAMENTE!',
                                        html: `
                                            <div style="text-align: center;">
                                                <div style="font-size: 50px; color: green; margin: 20px 0;">
                                                    <i class="fas fa-check-circle"></i>
                                                </div>
                                                <p><strong>RFID:</strong> ${userData.rfid}</p>
                                                <p><strong>Administrador:</strong> ${userData.nombre} ${userData.apellido}</p>
                                                <p style="color: green; margin-top: 20px;">
                                                    ✅ Ahora puedes acceder con tu RFID
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
                            console.error("Error verificando RFID:", error);
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
                                    <p>No se detectó ningún RFID en 45 segundos.</p>
                                    <p><strong>¿Qué revisar?</strong></p>
                                    <ul>
                                        <li>¿El ESP32 muestra "ESPERANDO RFID"?</li>
                                        <li>¿Acercó suficientemente el llavero?</li>
                                        <li>¿Escuchó el sonido de confirmación?</li>
                                        <li>¿El llavero RFID está funcionando?</li>
                                    </ul>
                                    <p style="margin-top: 15px;">
                                        <button onclick="registerAdminRFID()" class="btn btn-primary" 
                                                style="padding: 8px 16px; margin-right: 10px;">
                                            <i class="fas fa-redo"></i> Reintentar
                                        </button>
                                        <button onclick="loadAdminInfo()" class="btn btn-secondary"
                                                style="padding: 8px 16px;">
                                            <i class="fas fa-sync"></i> Actualizar
                                        </button>
                                    </p>
                                </div>
                            `,
                            width: 500
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
        console.error('Error en registro de RFID del admin:', err);
        
        Swal.fire({
            icon: 'error',
            title: 'ERROR DE CONEXIÓN',
            html: `
                <div style="text-align: left;">
                    <p><strong>Error:</strong> ${err.message}</p>
                    <hr>
                    <p><strong>Solución paso a paso:</strong></p>
                    <ol>
                        <li>Vaya a la sección <strong>"Control ESP32"</strong></li>
                        <li>Verifique que el estado diga <strong>"ESP32 CONECTADO"</strong></li>
                        <li>Si dice desconectado, haga clic en <strong>"Probar Conexión"</strong></li>
                        <li>Si sigue sin conectar, configure la IP correcta con <strong>"Configurar IP"</strong></li>
                        <li>La IP debe ser la misma que aparece en la pantalla del ESP32</li>
                    </ol>
                    <div style="margin-top: 20px;">
                        <button onclick="showSection('section-esp32-control')" 
                                class="btn btn-primary" 
                                style="padding: 8px 16px; margin-right: 10px;">
                            <i class="fas fa-microchip"></i> Ir a Control ESP32
                        </button>
                        <button onclick="registerAdminRFID()" 
                                class="btn btn-warning" 
                                style="padding: 8px 16px;">
                            <i class="fas fa-redo"></i> Reintentar
                        </button>
                    </div>
                </div>
            `,
            width: 600
        });
    }
}
async function sendAdminCommandToESP32(command, huellaId = null, userId = null) {
    const esp32IP = localStorage.getItem('esp32_ip');
    if (!esp32IP) {
        throw new Error('IP del ESP32 no configurada');
    }

    console.log(`[ADMIN] Enviando comando ${command} al ESP32 ${esp32IP}...`);
    
    // PRIMERO intentar conexión directa simple
    try {
        console.log("[ADMIN] 1. Intentando conexión directa simple...");
        const response = await fetch(`http://${esp32IP}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: command,
                huella_id: huellaId,
                user_id: userId,
                timestamp: Date.now(),
                is_admin: true  // Agregar bandera para admin
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log("[ADMIN] ✓ Conexión directa exitosa:", data);
            return data;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (directError) {
        console.log("[ADMIN] ✗ Conexión directa falló:", directError.message);
        

        try {
            console.log("[ADMIN] 2. Intentando con XMLHttpRequest...");
            const result = await sendCommandToESP32(command, huellaId, userId);
            return result;
        } catch (xhrError) {
            console.log("[ADMIN] ✗ XMLHttpRequest también falló:", xhrError.message);
            

            try {
                console.log("[ADMIN] 3. Intentando via proxy...");
                const proxyResult = await sendCommandViaProxy(command, huellaId, userId);
                return proxyResult;
            } catch (proxyError) {
                console.log("[ADMIN] ✗ Proxy también falló:", proxyError.message);
                
                throw new Error(
                    `No se pudo conectar al ESP32.\n\n` +
                    `Verifique que:\n` +
                    `1. El ESP32 esté encendido\n` +
                    `2. Su computadora esté en la misma red WiFi\n` +
                    `3. La IP ${esp32IP} sea correcta\n` +
                    `4. Pueda acceder a http://${esp32IP} desde el navegador`
                );
            }
        }
    }
}
async function loadAccessReports(page = 1) {
    try {
        // Obtener valores de los filtros
        const userId = document.getElementById('accessUserSelect').value || '';
        const sensorType = document.getElementById('accessSensorSelect').value || '';
        const status = document.getElementById('accessStatusSelect').value || '';
        const actionType = document.getElementById('accessActionType').value || '';
        const startDate = document.getElementById('accessStart').value || '';
        const endDate = document.getElementById('accessEnd').value || '';
        
        // Construir URL con parámetros
        let url = `${API_BASE_URL}/access/admin/reports?page=${page}`;
        if (userId) url += `&user_id=${userId}`;
        if (sensorType) url += `&sensor_type=${sensorType}`;
        if (status) url += `&status=${status}`;
        if (actionType) url += `&action_type=${actionType}`;
        if (startDate) url += `&start_date=${new Date(startDate).toISOString()}`;
        if (endDate) url += `&end_date=${new Date(endDate).toISOString()}`;
        
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al cargar reportes');
        
        const data = await response.json();
        
        // Actualizar estadísticas
        updateAccessStatistics(data.statistics);
        
        // Actualizar tabla
        renderAccessLogsTable(data.data);
        
        // Actualizar paginación
        renderAccessPagination(data.pagination, page);
        
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'No se pudieron cargar los reportes de acceso', 'error');
    }
}

// Función para actualizar las estadísticas
function updateAccessStatistics(stats) {
    document.getElementById('totalAccessCount').textContent = stats.total || 0;
    document.getElementById('allowedAccessCount').textContent = stats.allowed || 0;
    document.getElementById('deniedAccessCount').textContent = stats.denied || 0;
    document.getElementById('fingerprintAccessCount').textContent = stats.fingerprint || 0;
    document.getElementById('rfidAccessCount').textContent = stats.rfid || 0;
}

// Función para renderizar la tabla de logs
function renderAccessLogsTable(logs) {
    const tbody = document.getElementById('accessLogTableBody');
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
        
        // Determinar ícono según tipo de acción
        let actionIcon = '↔️';
        if (log.action_type === 'ENTRADA') actionIcon = '⬇️';
        else if (log.action_type === 'SALIDA') actionIcon = '⬆️';
        else if (log.action_type.includes('ZONA SEGURA')) actionIcon = '🔐';
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.id}</td>
            <td>
                <strong>${log.user_name}</strong><br>
                <small>@${log.user_username || 'N/A'}</small>
            </td>
            <td>
                ${log.local_time}<br>
                <small style="color: #666;">${formatRelativeTime(log.timestamp)}</small>
            </td>
            <td>${sensorIcon} ${log.sensor_type}</td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${log.status}
                </span>
            </td>
            <td>
                <small style="font-family: monospace;">${log.access_method}</small>
            </td>
            <td>
                ${actionIcon} ${log.action_type}
            </td>
            <td>
                ${log.reason || 'N/A'}
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

// Función para renderizar paginación
function renderAccessPagination(pagination, currentPage) {
    const container = document.getElementById('accessLogPagination');
    container.innerHTML = '';
    
    if (pagination.pages <= 1) return;
    
    // Botón anterior
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'btn small';
        prevBtn.innerHTML = '&laquo; Anterior';
        prevBtn.onclick = () => loadAccessReports(currentPage - 1);
        container.appendChild(prevBtn);
    }
    
    // Números de página
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(pagination.pages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `btn small ${i === currentPage ? 'primary' : 'secondary'}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => loadAccessReports(i);
        container.appendChild(pageBtn);
    }
    
    // Botón siguiente
    if (currentPage < pagination.pages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'btn small';
        nextBtn.innerHTML = 'Siguiente &raquo;';
        nextBtn.onclick = () => loadAccessReports(currentPage + 1);
        container.appendChild(nextBtn);
    }
}

// Función para mostrar detalles de un acceso específico
async function showAccessDetails(logId) {
    try {
        const response = await fetch(`${API_BASE_URL}/access/history?log_id=${logId}`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al obtener detalles');
        
        const logs = await response.json();
        const log = logs.find(l => l.id === logId) || logs[0];
        
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

// Función para exportar a CSV
async function exportAccessCSV() {
    try {
        // Obtener valores de filtros
        const userId = document.getElementById('accessUserSelect').value || '';
        const sensorType = document.getElementById('accessSensorSelect').value || '';
        const status = document.getElementById('accessStatusSelect').value || '';
        const actionType = document.getElementById('accessActionType').value || '';
        const startDate = document.getElementById('accessStart').value || '';
        const endDate = document.getElementById('accessEnd').value || '';
        
        // Construir URL
        let url = `${API_BASE_URL}/access/admin/reports/export`;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        if (sensorType) params.append('sensor_type', sensorType);
        if (status) params.append('status', status);
        if (actionType) params.append('action_type', actionType);
        if (startDate) params.append('start_date', new Date(startDate).toISOString());
        if (endDate) params.append('end_date', new Date(endDate).toISOString());
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        // Descargar el archivo
        const response = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al exportar');
        
        // Crear blob y descargar
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `reporte_accesos_${new Date().toISOString().slice(0,10)}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        
        Swal.fire('Éxito', 'Reporte exportado correctamente', 'success');
        
    } catch (error) {
        console.error('Error:', error);
        Swal.fire('Error', 'No se pudo exportar el reporte', 'error');
    }
}

// Función para cargar usuarios en el select
async function loadAccessUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al cargar usuarios');
        
        const users = await response.json();
        const select = document.getElementById('accessUserSelect');
        
        // Limpiar opciones excepto la primera
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        // Agregar usuarios
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.nombre} ${user.apellido} (${user.username})`;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
    }
}

// Función auxiliar para formatear tiempo relativo
function formatRelativeTime(timestamp) {
    if (!timestamp) return '';
    
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
}

// Inicializar cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // ... código existente ...
    
    // Agregar eventos para reportes de acceso
    document.getElementById('btnLoadAccessLogs')?.addEventListener('click', () => loadAccessReports());
    document.getElementById('btnExportAccessCSV')?.addEventListener('click', exportAccessCSV);
    
    // Configurar fecha por defecto (últimos 7 días)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    document.getElementById('accessStart').value = startDate.toISOString().slice(0, 16);
    document.getElementById('accessEnd').value = endDate.toISOString().slice(0, 16);
    
    // Cargar lista de usuarios
    loadAccessUsers();
});

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

// ========== FUNCIÓN MODIFICADA PARA ADMIN ==========
async function sendCommandToESP32(command, huellaId = null, userId = null) {
    const esp32IP = localStorage.getItem('esp32_ip');
    if (!esp32IP) {
        throw new Error('IP del ESP32 no configurada');
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `http://${esp32IP}/command`;
        
        console.log("Enviando comando a:", url);
        
        xhr.timeout = 10000; // Reducir timeout a 10 segundos
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        const payload = {
            command: command,
            timestamp: Date.now(),
            source: 'admin_dashboard'
        };
        
        if (huellaId) payload.huella_id = huellaId;
        if (userId) payload.user_id = userId;
        
        xhr.onload = function() {
            console.log("Respuesta recibida:", xhr.status, xhr.responseText);
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data);
                } catch (e) {
                    console.log("Respuesta no JSON, asumiendo éxito:", xhr.responseText);
                    resolve({ status: 'success', message: 'Comando enviado' });
                }
            } else {
                console.error("Error HTTP:", xhr.status, xhr.statusText);
                reject(new Error(`Error HTTP ${xhr.status}: ${xhr.statusText}`));
            }
        };
        
        xhr.onerror = function() {
            console.error("Error de red al conectar con:", url);
            reject(new Error('Error de conexión con el ESP32. Verifique la red.'));
        };
        
        xhr.ontimeout = function() {
            console.error("Timeout al conectar con:", url);
            reject(new Error('Timeout - El ESP32 no respondió. Verifique que esté encendido.'));
        };
        
        console.log("Enviando payload:", payload);
        xhr.send(JSON.stringify(payload));
    });
}
async function sendCommandViaProxy(command, huellaId = null, userId = null) {
    const esp32IP = localStorage.getItem('esp32_ip');
    if (!esp32IP) {
        throw new Error('IP del ESP32 no configurada');
    }

    const url = `${BASE_URL}/esp32/proxy/command`;
    
    const payload = {
        esp32_ip: esp32IP,
        command: command
    };
    
    if (huellaId) payload.huella_id = huellaId;
    if (userId) payload.user_id = userId;

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('jwtToken')
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('Error enviando comando via proxy:', error);
        throw error;
    }
}

async function sendCommandToESP32(command, huellaId = null, userId = null) {
    const esp32IP = localStorage.getItem('esp32_ip');
    if (!esp32IP) {
        throw new Error('IP del ESP32 no configurada');
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        const url = `http://${esp32IP}/command`;
        console.log("Enviando comando a:", url);
        
        xhr.timeout = 15000;
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        
        const payload = {
            command: command,
            timestamp: Date.now()
        };
        
        if (huellaId) payload.huella_id = huellaId;
        if (userId) payload.user_id = userId;
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve(data);
                } catch (e) {
                    resolve({ status: 'success', message: 'Comando enviado' });
                }
            } else {
                reject(new Error(`Error HTTP ${xhr.status}: ${xhr.statusText}`));
            }
        };
        
        xhr.onerror = function() {
            reject(new Error('Error de conexión con el ESP32'));
        };
        
        xhr.ontimeout = function() {
            reject(new Error('Timeout - El ESP32 no respondió'));
        };
        
        xhr.send(JSON.stringify(payload));
    });
}


function initializeEmployeeRegistration() {
    const btnSaveEmployee = document.getElementById("btn-save-employee");
    if (btnSaveEmployee) {
        btnSaveEmployee.addEventListener("click", registerEmployee);
    }
}

async function registerEmployee() {
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

// ========== REGISTRO DE HUELLA PARA EMPLEADOS ==========
async function registerFingerprint(userId) {
    try {
        console.log("Iniciando registro de huella para usuario:", userId);
        
        await updateESP32Status();
        
        // Asignar ID de huella
        const assignResponse = await fetch(`${BASE_URL}/users/huella/assign-id`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
            },
            body: JSON.stringify({ user_id: userId })
        });

        if (!assignResponse.ok) throw new Error('Error asignando ID');
        
        const assignData = await assignResponse.json();
        if (!assignData.success) {
            Toast.fire({ icon: 'error', title: "Error: " + (assignData.message || "No se pudo asignar ID") });
            return;
        }

        const huellaId = assignData.huella_id;
        
        // Asociar al usuario
        const assignHuellaResponse = await fetch(`${BASE_URL}/users/huella/assign-manual`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
            },
            body: JSON.stringify({ user_id: userId, huella_id: huellaId })
        });

        if (!assignHuellaResponse.ok) throw new Error('Error asociando huella');
        
        await loadEmployees();
        
        // Confirmación
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO DE HUELLA',
            html: `
                <div style="text-align: left; font-size: 14px;">
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
            cancelButtonText: 'Cancelar'
        });

        if (!confirmResult.isConfirmed) return;

        // Enviar comando
        const commandResponse = await sendCommandToESP32Direct('REGISTER_FINGERPRINT', huellaId, userId,);
        
        if (!commandResponse || commandResponse.status !== 'success') {
            throw new Error(commandResponse?.message || 'Error enviando comando al ESP32');
        }

        // Monitorear
        let checkCount = 0;
        const maxChecks = 120;
        
        await Swal.fire({
            title: 'REGISTRO EN PROGRESO',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px;">Esperando registro físico...</p>
                    <p><small>Huella ID: ${huellaId}</small></p>
                    <p><small>Usuario ID: ${userId}</small></p>
                    <div id="fingerprint-progress" style="margin-top: 15px; font-size: 12px;">
                        Tiempo: 0/${maxChecks} segundos
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            willOpen: () => {
                const progressInterval = setInterval(async () => {
                    checkCount++;
                    const progressEl = document.getElementById('fingerprint-progress');
                    if (progressEl) {
                        progressEl.innerHTML = `Tiempo: ${checkCount}/${maxChecks} segundos`;
                    }
                    
                    // Verificar
                    if (checkCount % 2 === 0) {
                        try {
                            const verifyResponse = await fetch(`${BASE_URL}/users/huella/check/${huellaId}`, {
                                headers: { "Authorization": "Bearer " + localStorage.getItem("jwtToken") }
                            });
                            
                            if (verifyResponse.ok) {
                                const verifyData = await verifyResponse.json();
                                
                                if (verifyData.success && verifyData.exists && verifyData.has_template) {
                                    clearInterval(progressInterval);
                                    Swal.close();
                                    
                                    await loadEmployees();
                                    
                                    Swal.fire({
                                        icon: 'success',
                                        title: '¡HUELLA REGISTRADA!',
                                        html: `
                                            <div style="text-align: left;">
                                                <p><strong>Huella ID:</strong> ${huellaId}</p>
                                                <p><strong>Estado:</strong> Template guardado correctamente</p>
                                                <p style="color: green; margin-top: 10px;">
                                                    ✅ El usuario puede acceder con su huella
                                                </p>
                                            </div>
                                        `,
                                        confirmButtonText: 'Aceptar'
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
                            confirmButtonText: 'Entendido'
                        }).then(() => {
                            loadEmployees();
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
        console.error('Error en registro de huella:', err);
        
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
                        <li>Revise la IP configurada</li>
                    </ol>
                    <button onclick="loadEmployees()" class="btn btn-primary mt-3">
                        Actualizar Tabla
                    </button>
                </div>
            `
        });
    }
}

// ========== REGISTRO DE RFID PARA EMPLEADOS ==========
async function registerRFID(userId) {
    try {
        console.log("Iniciando registro de RFID para usuario:", userId);
        
        await updateESP32Status();
        
        // Confirmación
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO DE RFID',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Usuario:</strong> ID ${userId}</p>
                    <p style="color: green;">✅ Preparado para lectura RFID</p>
                    <hr>
                    <p><strong>Instrucciones:</strong></p>
                    <ol>
                        <li>Diríjase al dispositivo ESP32</li>
                        <li>Espere que aparezca "LECTURA RFID"</li>
                        <li>Acercar llavero RFID al lector</li>
                        <li>Espere el tono de confirmación</li>
                    </ol>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Continuar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmResult.isConfirmed) return;

        // Enviar comando
        const commandResponse = await sendCommandToESP32Direct('READ_RFID', null, userId, true);
        
        if (!commandResponse || commandResponse.status !== 'success') {
            throw new Error(commandResponse?.message || 'Error enviando comando al ESP32');
        }

        // Monitorear
        let checkCount = 0;
        const maxChecks = 60;
        
        await Swal.fire({
            title: 'ESPERANDO RFID',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px;">Acercar llavero RFID al dispositivo...</p>
                    <p><small>Usuario ID: ${userId}</small></p>
                    <div id="rfid-progress" style="margin-top: 15px; font-size: 12px;">
                        Tiempo: 0/${maxChecks} segundos
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            willOpen: () => {
                const progressInterval = setInterval(async () => {
                    checkCount++;
                    const progressEl = document.getElementById('rfid-progress');
                    if (progressEl) {
                        progressEl.innerHTML = `Tiempo: ${checkCount}/${maxChecks} segundos`;
                    }
                    
                    // Verificar
                    if (checkCount % 2 === 0) {
                        try {
                            const userResponse = await fetch(`${BASE_URL}/users/?page=1&per_page=50`, {
                                headers: { "Authorization": "Bearer " + localStorage.getItem("jwtToken") }
                            });
                            
                            const usersData = await userResponse.json();
                            const currentUser = usersData.users.find(u => u.id == userId);
                            
                            if (currentUser && currentUser.rfid) {
                                clearInterval(progressInterval);
                                Swal.close();
                                
                                await loadEmployees();
                                
                                Swal.fire({
                                    icon: 'success',
                                    title: '¡RFID REGISTRADO!',
                                    html: `
                                        <div style="text-align: left;">
                                            <p><strong>RFID:</strong> ${currentUser.rfid}</p>
                                            <p><strong>Estado:</strong> Asignado correctamente</p>
                                            <p style="color: green; margin-top: 10px;">
                                                ✅ El usuario ahora puede acceder con su RFID
                                            </p>
                                        </div>
                                    `,
                                    confirmButtonText: 'Aceptar'
                                });
                                return;
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
                                        <li>Que el llavero RFID esté funcionando</li>
                                        <li>Que el ESP32 muestre "LECTURA RFID"</li>
                                        <li>Que acerque suficientemente el llavero</li>
                                    </ul>
                                </div>
                            `,
                            confirmButtonText: 'Entendido'
                        }).then(() => {
                            loadEmployees();
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
        console.error('Error en registro de RFID:', err);
        
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
                        <li>Revise la IP configurada</li>
                    </ol>
                    <button onclick="loadEmployees()" class="btn btn-primary mt-3">
                        Actualizar Tabla
                    </button>
                </div>
            `
        });
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
    loadUsersForAttendance();
    loadAttendanceSummary();
    
    // Actualizar estado del ESP32 cada 30 segundos
    updateESP32Status();
    setInterval(updateESP32Status, 30000);
    
    console.log("Dashboard Admin inicializado correctamente - Modo LOCAL");
});
