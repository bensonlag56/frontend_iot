const BASE_URL = "https://asistencia-iot-api.onrender.com"; // Tu backend en Render
let ESP32_BASE_URL = 'https://f4f12bcf3348.ngrok-free.app'; // Tu ESP32 local

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
    // Agregar este código después de las otras navegaciones
    const navAccessReports = document.getElementById("nav-access-reports");
    if (navAccessReports) {
        navAccessReports.addEventListener("click", () => {
            showSection("section-access-reports");
            loadAccessReports();
            loadAccessUsers(); // Cargar usuarios en el select
        });
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
    const esp32IP = localStorage.getItem('esp32_ip') || 'f4f12bcf3348.ngrok-free.app';
    
    console.log(`[ADMIN] Enviando comando ${command} al ESP32 ${esp32IP}...`);
    
    // DETERMINAR SI ES URL HTTPS (ngrok) O IP LOCAL
    let url;
    if (esp32IP.includes('https://')) {
        // Ya es URL completa
        url = `${esp32IP}/command`;
    } else if (esp32IP.includes('.ngrok-free.app') || esp32IP.includes('.ngrok.io')) {
        // Es dominio ngrok sin protocolo
        url = `https://${esp32IP}/command`;
    } else {
        // Es IP local
        url = `http://${esp32IP}/command`;
    }
    
    console.log(`URL construida: ${url}`);
    
    try {
        console.log("[ADMIN] 1. Intentando conexión directa...");
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: command,
                huella_id: huellaId,
                user_id: userId,
                timestamp: Date.now(),
                is_admin: true
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
        
        // Si falla la conexión directa, intentar con proxy
        try {
            console.log("[ADMIN] 2. Intentando via proxy...");
            const proxyResult = await sendCommandViaProxy(command, huellaId, userId);
            return proxyResult;
        } catch (proxyError) {
            console.log("[ADMIN] ✗ Proxy también falló:", proxyError.message);
            
            throw new Error(
                `No se pudo conectar al ESP32.\n\n` +
                `Verifique que:\n` +
                `1. El ESP32 esté encendido\n` +
                `2. La URL ${esp32IP} sea correcta\n` +
                `3. Pueda acceder a ${url} desde el navegador\n` +
                `4. Si usa ngrok, verifique que el túnel esté activo`
            );
        }
    }
}
let serverNow = null;
async function loadAccessReports(page = 1) {
    try {
        console.log(`Cargando reportes, página ${page}...`);
        
        // Obtener valores de los filtros
        const userId = document.getElementById('accessUserSelect')?.value || '';
        const sensorType = document.getElementById('accessSensorSelect')?.value || '';
        const status = document.getElementById('accessStatusSelect')?.value || '';
        const actionType = document.getElementById('accessActionType')?.value || '';
        const startDate = document.getElementById('accessStart')?.value || '';
        const endDate = document.getElementById('accessEnd')?.value || '';
        
        // Construir URL
        let url = `${BASE_URL}/access/admin/reports`;
        const params = new URLSearchParams();
        params.append('page', page);
        
        if (userId) params.append('user_id', userId);
        if (sensorType) params.append('sensor_type', sensorType);
        if (status) params.append('status', status);
        if (actionType) params.append('action_type', actionType);
        
        if (startDate) {
            params.append('start_date', new Date(startDate).toISOString());
        }
        if (endDate) {
            params.append('end_date', new Date(endDate).toISOString());
        }
        
        params.append('per_page', 20);
        url = `${url}?${params.toString()}`;
        
        console.log('URL:', url);
        
        const response = await fetch(url, {
            headers: getAuthHeaders(),
            mode: 'cors'
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Error ${response.status}: ${errorText}`);
        }

        // ⬅️ CAPTURAR LA HORA DEL SERVIDOR DESDE HEADERS
        const serverDateHeader = response.headers.get("Date");
        if (serverDateHeader) {
            serverNow = new Date(serverDateHeader);
            console.log("Hora del servidor:", serverNow.toString());
        } else {
            serverNow = new Date();
            console.warn("El servidor NO envió header Date. Usando hora local.");
        }
        
        const data = await response.json();
        console.log('Respuesta del servidor:', data);
        
        if (data.success === false) {
            throw new Error(data.msg || 'Error en la respuesta');
        }
        
        // 1. Actualizar estadísticas
        if (data.statistics) {
            updateAccessStatistics(data.statistics);
        }
        
        // 2. Actualizar tabla
        renderAccessLogsTable(data.data || []);
        
        // 3. Actualizar paginación
        if (data.pagination) {
            console.log('Renderizando paginación:', data.pagination);
            renderAccessPagination(data.pagination, page);
        } else {
            const paginationContainer = document.getElementById('accessLogPagination');
            if (paginationContainer) {
                paginationContainer.innerHTML = `
                    <div style="color: #666; font-size: 14px;">
                        Total: ${data.data?.length || 0} registros
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error('Error cargando reportes:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: error.message
        });
    }
}

// Función para actualizar las estadísticas
function updateAccessStatistics(stats) {
    if (!stats) return;
    
    console.log('Actualizando estadísticas:', stats);
    
    const updateElement = (id, value) => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value || 0;
        }
    };
    
    updateElement('totalAccessCount', stats.total);
    updateElement('allowedAccessCount', stats.allowed);
    updateElement('deniedAccessCount', stats.denied);
    updateElement('fingerprintAccessCount', stats.fingerprint);
    updateElement('rfidAccessCount', stats.rfid);
}

// Función para renderizar paginación
function renderAccessPagination(pagination, currentPage) {
    const container = document.getElementById('accessLogPagination');
    if (!container) {
        console.error('No se encontró el contenedor de paginación con ID: accessLogPagination');
        return;
    }
    
    container.innerHTML = '';
    
    if (!pagination || pagination.pages <= 1) {
        const info = document.createElement('div');
        info.className = 'pagination-info';
        info.textContent = `Total: ${pagination?.total || 0} registros`;
        container.appendChild(info);
        return;
    }
    
    console.log(`Renderizando paginación: página ${currentPage} de ${pagination.pages}`);
    
    // Contenedor de botones
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'pagination-buttons';
    
    // Botón anterior
    if (currentPage > 1) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'pagination-btn';
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
        prevBtn.title = 'Página anterior';
        prevBtn.onclick = () => {
            console.log('Navegando a página:', currentPage - 1);
            loadAccessReports(currentPage - 1);
        };
        buttonsContainer.appendChild(prevBtn);
    }
    
    // Números de página
    for (let i = 1; i <= pagination.pages; i++) {
        // Mostrar solo algunas páginas alrededor de la actual
        if (i === 1 || i === pagination.pages || (i >= currentPage - 1 && i <= currentPage + 1)) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
            pageBtn.textContent = i;
            pageBtn.onclick = () => {
                console.log('Navegando a página:', i);
                loadAccessReports(i);
            };
            buttonsContainer.appendChild(pageBtn);
        } else if (i === currentPage - 2 || i === currentPage + 2) {
            // Agregar puntos suspensivos
            const dots = document.createElement('span');
            dots.className = 'pagination-dots';
            dots.textContent = '...';
            dots.style.padding = '8px 4px';
            buttonsContainer.appendChild(dots);
        }
    }
    
    // Botón siguiente
    if (currentPage < pagination.pages) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'pagination-btn';
        nextBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
        nextBtn.title = 'Página siguiente';
        nextBtn.onclick = () => {
            console.log('Navegando a página:', currentPage + 1);
            loadAccessReports(currentPage + 1);
        };
        buttonsContainer.appendChild(nextBtn);
    }
    
    container.appendChild(buttonsContainer);
    
    // Información
    const info = document.createElement('div');
    info.className = 'pagination-info';
    info.innerHTML = `
        Página <strong>${currentPage}</strong> de <strong>${pagination.pages}</strong> 
        | Total: <strong>${pagination.total}</strong> registros
        | Mostrando <strong>${pagination.per_page}</strong> por página
    `;
    container.appendChild(info);
}
function renderAccessLogsTable(logs) {
    const tbody = document.getElementById('accessLogTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 20px;">
                    No se encontraron registros de acceso con los filtros seleccionados
                </td>
            </tr>
        `;
        return;
    }
    
    logs.forEach(log => {
        let statusClass = '';
        let statusText = log.status || 'N/A';
        if (statusText === 'Permitido') statusClass = 'status-success';
        else if (statusText === 'Denegado') statusClass = 'status-error';
        
        let sensorIcon = '';
        let sensorText = log.sensor_type || 'Desconocido';
        
        let actionIcon = '';
        let actionText = 'ACCESO';
        if (log.full_action_type) {
            if (log.full_action_type.includes('ENTRADA')) actionText = 'ENTRADA';
            else if (log.full_action_type.includes('SALIDA')) actionText = 'SALIDA';
            else if (log.full_action_type.includes('ZONA_SEGURA')) actionText = 'ZONA SEGURA';
        }

        let accessMethod = log.access_method || 'Desconocido';
        const userName = log.user_name || `Usuario ${log.user_id}`;
        const userUsername = log.user_username || 'N/A';
        
        // Usar local_time si existe, sino usar timestamp
        const displayTime = log.local_time || log.timestamp || 'N/A';
        
        // DEBUG para el primer registro
        if (log.id === logs[0].id) {
            console.log("DEBUG - Primer registro:", {
                id: log.id,
                timestamp: log.timestamp,
                local_time: log.local_time,
                displayTime: displayTime,
                calculated: calculateExactTimeDifference(displayTime)
            });
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${log.id || 'N/A'}</td>
            <td>
                <div style="font-weight: 500;">${userName}</div>
                <small style="color: #666;">ID: ${log.user_id} | @${userUsername}</small>
            </td>
            <td>
                <div style="font-weight: 500;">${displayTime}</div>
                <small style="color: #666;">
                     ${calculateExactTimeDifference(displayTime)}
                </small>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 5px;">
                    ${sensorIcon}
                    <span>${sensorText}</span>
                </div>
            </td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${statusText}
                </span>
            </td>
            <td>
                <code style="font-size: 11px; background: #f5f5f5; padding: 2px 6px; border-radius: 3px;">
                    ${accessMethod}
                </code>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 5px;">
                    ${actionIcon}
                    <span>${actionText}</span>
                </div>
            </td>
            <td style="max-width: 200px; word-wrap: break-word;">
                ${log.reason || log.motivo_decision || 'N/A'}
            </td>
            <td>
                <button onclick="showAccessDetails(${log.id})" class="btn small">
                    <i class="fas fa-eye"></i> Ver
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function getPeruTimeNow() {
    const now = new Date();
    // Crear fecha en UTC
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    // Perú es UTC-5
    const peruOffset = -5 * 3600000; // -5 horas en milisegundos
    return new Date(utc + peruOffset);
}

function convertToPeruTime(timestamp) {
    // Si el timestamp viene como "2025-12-04 18:04:54"
    const dateStr = timestamp.replace(" ", "T");
    
    // Crear fecha local (asumiendo que viene en hora local del servidor/ESP32)
    const localDate = new Date(dateStr);
    
    // Convertir a Perú (GMT-5)
    // Primero obtener offset local
    const localOffset = localDate.getTimezoneOffset() * 60000;
    // Convertir a UTC
    const utc = localDate.getTime() - localOffset;
    // Aplicar offset de Perú
    const peruOffset = -5 * 3600000; // -5 horas
    return new Date(utc + peruOffset);
}

function calculateExactTimeDifference(timeStr) {
    if (!timeStr || timeStr === "N/A") return "N/A";

    try {
        // DEBUG: Ver qué estamos recibiendo
        console.log("Timestamp original:", timeStr);
        
        let logDate;
        
        // Si es formato ISO UTC (con "T" y ".")
        if (timeStr.includes("T") && timeStr.includes(".")) {
            // Formato: "2025-12-04T23:04:54.871349" (UTC)
            logDate = new Date(timeStr);
            console.log("Parseado como UTC:", logDate.toISOString());
            
            // Convertir UTC a Perú (UTC-5)
            const peruOffset = -5 * 60 * 60000; // -5 horas en milisegundos
            logDate = new Date(logDate.getTime() + peruOffset);
            console.log("Convertido a Perú:", logDate.toISOString());
        } 
        // Si es formato simple con espacio
        else if (timeStr.includes(" ")) {
            // Formato: "2025-12-04 18:04:54" (ya está en hora Perú)
            // Añadir "T" para formato ISO y especificar zona Perú (UTC-5)
            logDate = new Date(timeStr.replace(" ", "T") + "-05:00");
            console.log("Parseado como hora Perú:", logDate.toISOString());
        }
        // Si es formato ISO sin milisegundos
        else if (timeStr.includes("T")) {
            // Formato: "2025-12-04T23:04:54" (UTC)
            logDate = new Date(timeStr);
            
            // Convertir UTC a Perú (UTC-5)
            const peruOffset = -5 * 60 * 60000;
            logDate = new Date(logDate.getTime() + peruOffset);
        }
        // Otro formato
        else {
            logDate = new Date(timeStr);
        }
        
        // Verificar si la fecha es válida
        if (isNaN(logDate.getTime())) {
            console.error("Fecha inválida después de parsear:", timeStr);
            return "N/A";
        }
        
        // Obtener hora actual en Perú
        const now = new Date();
        
        // Ajustar ahora a Perú si es necesario
        // Perú es UTC-5 (300 minutos)
        const browserOffset = now.getTimezoneOffset(); // minutos (positivo para zonas al oeste de UTC)
        const peruOffset = 300; // Perú es UTC-5 = +300 minutos
        
        let peruNow;
        if (browserOffset !== peruOffset) {
            // Ajustar la hora actual a Perú
            // Si browserOffset es 300 (Perú), no hay que ajustar
            // Si browserOffset es diferente, ajustar
            const offsetDiff = (peruOffset - browserOffset) * 60000;
            peruNow = new Date(now.getTime() + offsetDiff);
            console.log("Ajustada hora actual a Perú:", peruNow.toISOString());
        } else {
            peruNow = now;
            console.log("Ya está en Perú, sin ajuste:", peruNow.toISOString());
        }
        
        // Calcular diferencia
        const diffMs = peruNow - logDate;
        
        console.log("Diferencia calculada (ms):", diffMs);
        console.log("Diferencia (minutos):", Math.floor(diffMs / 60000));
        
        // Si la diferencia es muy pequeña o negativa (por ajustes de tiempo)
        if (diffMs < 1000) { // Menos de 1 segundo
            return "Justo ahora";
        }
        
        // Convertir a unidades legibles
        const diffSeconds = Math.floor(diffMs / 1000);
        const diffMinutes = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        // Mostrar formato apropiado
        if (diffDays >= 1) {
            if (diffDays === 1) {
                const remainingHours = Math.floor((diffMs % 86400000) / 3600000);
                if (remainingHours > 0) {
                    return `Hace 1 día ${remainingHours}h`;
                }
                return "Hace 1 día";
            }
            return `Hace ${diffDays} días`;
        } else if (diffHours >= 1) {
            const remainingMinutes = Math.floor((diffMs % 3600000) / 60000);
            if (remainingMinutes > 0) {
                return `Hace ${diffHours}h ${remainingMinutes}m`;
            }
            return `Hace ${diffHours}h`;
        } else if (diffMinutes >= 1) {
            return `Hace ${diffMinutes}m`;
        } else if (diffSeconds >= 30) {
            return `Hace ${diffSeconds}s`;
        } else {
            return "Justo ahora";
        }
        
    } catch (e) {
        console.error("Error calculando diferencia:", e, "Timestamp:", timeStr);
        return "N/A";
    }
}

// Función de prueba para verificar la conversión
function testTimeConversion() {
    const testCases = [
        "2025-12-04T23:04:54.871349", // UTC (debería ser 18:04:54 Perú)
        "2025-12-04 18:04:54", // Hora Perú
        new Date().toISOString() // Ahora UTC
    ];
    
    console.log("=== PRUEBA DE CONVERSIÓN DE HORA ===");
    testCases.forEach((time, i) => {
        console.log(`Caso ${i + 1}: ${time}`);
        console.log(`Resultado: ${calculateExactTimeDifference(time)}`);
    });
    
    // Mostrar hora actual en Perú
    const now = new Date();
    const peruTime = now.toLocaleString("en-US", { 
        timeZone: "America/Lima",
        hour12: false
    });
    console.log("Hora actual en Perú:", peruTime);
    console.log("Hora del navegador:", now.toString());
}
async function showAccessDetails(logId) {
    try {
        // Usamos el endpoint de history con filtro por ID
        const response = await fetch(`${BASE_URL}/access/history?user_id=&date=&sensor_type=&log_id=${logId}`, {
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
        
        // Obtener información del usuario si existe
        let userInfo = '';
        if (log.user_id) {
            try {
                const userRes = await fetch(`${BASE_URL}/users/${log.user_id}`, {
                    headers: getAuthHeaders()
                });
                if (userRes.ok) {
                    const userData = await userRes.json();
                    userInfo = `
                        <p><strong>Usuario:</strong> ${userData.nombre} ${userData.apellido}</p>
                        <p><strong>Username:</strong> ${userData.username}</p>
                        <p><strong>Rol:</strong> ${userData.role}</p>
                    `;
                }
            } catch (e) {
                console.error('Error obteniendo usuario:', e);
            }
        }
        
        // Crear contenido del modal
        const detailsHtml = `
            <div style="text-align: left; max-width: 500px;">
                <h3>Detalles del Acceso</h3>
                
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0;">
                    <p><strong>ID Registro:</strong> ${log.id}</p>
                    <p><strong>Fecha/Hora:</strong> ${formattedDate}</p>
                    <p><strong>Sensor:</strong> ${log.sensor_type || 'N/A'}</p>
                    <p><strong>Estado:</strong> 
                        <span class="${log.status === 'Permitido' ? 'status-success' : 'status-error'}">
                            ${log.status}
                        </span>
                    </p>
                    ${userInfo}
                    <p><strong>Usuario ID:</strong> ${log.user_id || 'N/A'}</p>
                    ${log.rfid ? `<p><strong>RFID:</strong> <code>${log.rfid}</code></p>` : ''}
                    ${log.huella_id ? `<p><strong>Huella ID:</strong> ${log.huella_id}</p>` : ''}
                    ${log.reason ? `<p><strong>Motivo/Detalles:</strong> ${log.reason}</p>` : ''}
                </div>
                
                <div style="margin-top: 15px; font-size: 12px; color: #666;">
                    <p><i class="fas fa-info-circle"></i> Este registro fue generado automáticamente por el sistema</p>
                </div>
            </div>
        `;
        
        Swal.fire({
            title: 'Información de Acceso',
            html: detailsHtml,
            icon: 'info',
            confirmButtonText: 'Cerrar',
            width: '550px',
            showCloseButton: true
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
        
        // Construir URL CORRECTAMENTE
        let url = `${BASE_URL}/access/admin/reports/export`;
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
        
        console.log('Exportando desde:', url);
        
        const response = await fetch(url, {
            headers: getAuthHeaders(),
            mode: 'cors'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        // Crear blob y descargar
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        
        // Nombre del archivo con fecha
        const now = new Date();
        const dateStr = now.toISOString().slice(0,10).replace(/-/g, '');
        const timeStr = now.toTimeString().slice(0,8).replace(/:/g, '');
        a.download = `reporte_accesos_${dateStr}_${timeStr}.csv`;
        
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(downloadUrl);
        
        Toast.fire({
            icon: 'success',
            title: 'Reporte exportado correctamente'
        });
        
    } catch (error) {
        console.error('Error exportando:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se pudo exportar el reporte: ' + error.message
        });
    }
}
// Función para cargar datos iniciales
function loadInitialAccessData() {
    // Establecer fechas por defecto (últimos 7 días)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    const accessStart = document.getElementById('accessStart');
    const accessEnd = document.getElementById('accessEnd');
    
    if (accessStart && accessEnd) {
        // Formato YYYY-MM-DDThh:mm para input datetime-local
        accessStart.value = startDate.toISOString().slice(0, 16);
        accessEnd.value = endDate.toISOString().slice(0, 16);
    }
    
    // Cargar reportes iniciales
    loadAccessReports(1);
}

// Modificar el event listener del botón
document.addEventListener('DOMContentLoaded', function() {
    // ... código existente ...
    
    // Agregar eventos para reportes de acceso
    document.getElementById('btnLoadAccessLogs')?.addEventListener('click', () => loadAccessReports(1));
    document.getElementById('btnExportAccessCSV')?.addEventListener('click', exportAccessCSV);
    
    // Cargar datos iniciales
    loadInitialAccessData();
    loadAccessUsers();
});

// Función para cargar usuarios en el select
async function loadAccessUsers() {
    try {
        const response = await fetch(`${BASE_URL}/users`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) throw new Error('Error al cargar usuarios');
        
        const data = await response.json();
        const users = data.users || [];
        const select = document.getElementById('accessUserSelect');
        
        if (!select) return;
        
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
function parseServerDate(dateStr) {
    if (!dateStr) return null;

    if (dateStr.includes("T")) return new Date(dateStr);

    return new Date(dateStr.replace(" ", "T") + "-05:00");
}


function formatRelativeTime(timestamp) {
    if (!timestamp) return "";
    
    try {
        // Parsear la fecha del timestamp
        const logDate = new Date(timestamp);
        if (isNaN(logDate.getTime())) return "";
        
        // Usar hora del servidor si está disponible, sino usar hora local
        const now = serverNow ? new Date(serverNow) : new Date();
        
        // Calcular diferencia en milisegundos
        const diffMs = now - logDate;
        
        // Si es futuro (por problemas de zona horaria), mostrar fecha completa
        if (diffMs < 0) {
            return logDate.toLocaleString("es-PE", {
                day: "2-digit",
                month: "2-digit",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            });
        }
        
        // Convertir a minutos
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        
        if (diffMinutes < 1) {
            return "hace unos segundos";
        } else if (diffMinutes < 60) {
            return diffMinutes === 1 ? "hace 1 minuto" : `hace ${diffMinutes} minutos`;
        } else if (diffMinutes < 1440) { // menos de 24 horas
            const diffHours = Math.floor(diffMinutes / 60);
            return diffHours === 1 ? "hace 1 hora" : `hace ${diffHours} horas`;
        } else {
            const diffDays = Math.floor(diffMinutes / 1440);
            return diffDays === 1 ? "hace 1 día" : `hace ${diffDays} días`;
        }
        
    } catch (e) {
        console.error("Error calculando tiempo relativo:", e);
        return "";
    }
}


document.addEventListener('DOMContentLoaded', function() {
    // ... código existente ...
    
    // Agregar eventos para reportes de acceso
    document.getElementById('btnLoadAccessLogs')?.addEventListener('click', () => loadAccessReports());
    document.getElementById('btnExportAccessCSV')?.addEventListener('click', exportAccessCSV);
    
    const btnLoadAccessLogs = document.getElementById('btnLoadAccessLogs');
    if (btnLoadAccessLogs) {
        btnLoadAccessLogs.addEventListener('click', () => loadAccessReports(1));
    }
    
    const btnExportAccessCSV = document.getElementById('btnExportAccessCSV');
    if (btnExportAccessCSV) {
        btnExportAccessCSV.addEventListener('click', exportAccessCSV);
    }
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
     const accessStart = document.getElementById('accessStart');
    const accessEnd = document.getElementById('accessEnd');
    
    if (accessStart && accessEnd) {
        accessStart.value = startDate.toISOString().slice(0, 16);
        accessEnd.value = endDate.toISOString().slice(0, 16);
    }
    
    loadAccessUsers();
});

function configureESP32IP() {
    const currentIP = localStorage.getItem('esp32_ip') || 'f4f12bcf3348.ngrok-free.app';
    const newIP = prompt('CONFIGURAR URL DEL ESP32\n\nIngrese la IP o URL del dispositivo:\n\n• Para ngrok: f4f12bcf3348.ngrok-free.app\n• Para IP local: 192.168.1.108\n\nURL actual:', currentIP);

    if (newIP) {
        // Validar que sea una IP o URL válida
        const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
        const urlRegex = /^[a-zA-Z0-9.-]+(\.ngrok-free\.app|\.ngrok\.io)$/;
        
        if (ipRegex.test(newIP) || urlRegex.test(newIP) || newIP.includes('https://')) {
            // Si el usuario puso https://, quitarlo para almacenar solo el dominio/IP
            let cleanIP = newIP.replace(/^https?:\/\//, '');
            localStorage.setItem('esp32_ip', cleanIP);
            ESP32_BASE_URL = cleanIP.includes('.') && !ipRegex.test(cleanIP) 
                ? `https://${cleanIP}`
                : `http://${cleanIP}`;
            
            document.getElementById('current-ip').textContent = cleanIP;
            Toast.fire({
                icon: 'success',
                title: 'URL configurada correctamente: ' + cleanIP
            });
            updateESP32Status();
        } else {
            Toast.fire({
                icon: 'error',
                title: 'Formato inválido. Ejemplos:\n• 192.168.1.108 (IP local)\n• f4f12bcf3348.ngrok-free.app (ngrok)\n• https://f4f12bcf3348.ngrok-free.app'
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
        const esp32IP = localStorage.getItem('esp32_ip') || 'f4f12bcf3348.ngrok-free.app';
        
        // Determinar si es ngrok (HTTPS) o IP local (HTTP)
        const isNgrok = esp32IP.includes('.ngrok-free.app') || esp32IP.includes('.ngrok.io');
        const protocol = isNgrok ? 'https://' : 'http://';
        const fullUrl = `${protocol}${esp32IP}`;
        
        // Usar el proxy del backend
        const response = await fetch(`${BASE_URL}/esp32/proxy/status`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('jwtToken')
            },
            body: JSON.stringify({
                esp32_ip: esp32IP,
                protocol: isNgrok ? 'https' : 'http'
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.status === 'online') {
                const displayProtocol = isNgrok ? 'HTTPS (ngrok)' : 'HTTP (local)';
                statusElement.innerHTML =
                    ` ESP32 CONECTADO<br>` +
                    ` URL: ${esp32IP}<br>` +
                    ` Via: ${displayProtocol}`;
                statusElement.className = 'status-box status-online';

                if (infoElement) {
                    infoElement.innerHTML = `
                        <p><strong>Conexión:</strong> Via ${displayProtocol}</p>
                        <p><strong>URL:</strong> ${esp32IP}</p>
                        <p><strong>Protocolo:</strong> ${isNgrok ? 'HTTPS' : 'HTTP'}</p>
                        <p><strong>Estado:</strong> ✅ Conectado</p>
                        <p><strong>Mensaje:</strong> ${data.message || 'OK'}</p>
                    `;
                }
            } else {
                statusElement.innerHTML =
                    ` ESP32 DESCONECTADO<br>` +
                    ` URL: ${esp32IP}<br>` +
                    ` Mensaje: ${data.message || 'Error de conexión'}`;
                statusElement.className = 'status-box status-offline';
            }
        } else {
            throw new Error(`Error del proxy: ${response.status}`);
        }
        
    } catch (error) {
        const esp32IP = localStorage.getItem('esp32_ip') || 'f4f12bcf3348.ngrok-free.app';
        
        console.error("Error conectando al ESP32:", error);
        
        statusElement.innerHTML =
            ` ESP32 DESCONECTADO<br>` +
            ` URL: ${esp32IP}<br>` +
            ` Error: ${error.message}`;
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
async function sendCommandToESP32Direct(command, huellaId = null, userId = null, isAdmin = false) {
    try {
        const esp32IP = localStorage.getItem('esp32_ip') || 'f4f12bcf3348.ngrok-free.app';
        
        console.log(`[DIRECT] Enviando ${command} a ESP32...`);
        
        // Determinar URL (HTTPS para ngrok, HTTP para IP local)
        let url;
        if (esp32IP.includes('https://')) {
            url = `${esp32IP}/command`;
        } else if (esp32IP.includes('.ngrok-free.app') || esp32IP.includes('.ngrok.io')) {
            url = `https://${esp32IP}/command`;
        } else {
            url = `http://${esp32IP}/command`;
        }
        
        console.log(`URL de destino: ${url}`);
        
        // Intentar conexión directa
        try {
            console.log("Intentando conexión directa...");
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    command: command,
                    huella_id: huellaId,
                    user_id: userId,
                    timestamp: Date.now(),
                    is_admin: isAdmin
                }),
                signal: AbortSignal.timeout(8000)
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const responseText = await response.text();
            console.log("Respuesta del ESP32:", responseText);
            
            try {
                const data = JSON.parse(responseText);
                console.log("✓ Respuesta JSON parseada:", data);
                return data;
            } catch (e) {
                // Si no es JSON válido, puede ser HTML
                if (responseText.includes('<html>') || responseText.includes('<!DOCTYPE')) {
                    console.error("ESP32 respondió con HTML, no JSON");
                    throw new Error('ESP32 respondió con página HTML. Verifica que el endpoint /command esté funcionando.');
                }
                // Si es texto plano pero exitoso
                console.log("Respuesta texto plano, asumiendo éxito:", responseText);
                return { status: 'success', message: 'Comando enviado' };
            }
            
        } catch (directError) {
            console.log("✗ Conexión directa falló:", directError.message);
            
            // Si falla la conexión directa, usar proxy
            console.log("Intentando via proxy del backend...");
            return await sendCommandViaProxy(command, huellaId, userId);
        }
        
    } catch (error) {
        console.error('Error enviando comando:', error);
        throw new Error(`No se pudo enviar comando: ${error.message}`);
    }
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

// ========== FUNCIONES PARA GESTIÓN DE USUARIOS (ACTUALIZACIÓN Y SUSPENSIÓN) ==========

async function loadEmployees() {
    try {
        // Usa el endpoint que muestra TODOS los usuarios (no solo activos)
        const res = await fetch(`${BASE_URL}/users/all`, {
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
                    <td colspan="13" style="text-align: center; padding: 20px;">
                        No hay empleados registrados
                    </td>
                </tr>
            `;
            return;
        }

        data.users.forEach(u => {
            // Determinar clase CSS para estado
            const statusClass = u.is_active === false ? 'status-suspended' : 'status-active';
            const statusText = u.is_active === false ? 'Suspendido' : 'Activo';
            const statusIcon = u.is_active === false ? '⛔' : '✅';

            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td><input type="checkbox" class="user-checkbox" value="${u.id}"></td>
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
                    <span class="status-badge ${statusClass}">
                        ${statusIcon} ${statusText}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn small btn-edit" onclick="openEditUserModal(${u.id})">
                            <i class="fas fa-edit"></i> Editar
                        </button>
                        <button class="btn small ${u.is_active === false ? 'btn-activate' : 'btn-suspend'}" 
                                onclick="${u.is_active === false ? `activateUser(${u.id})` : `suspendUser(${u.id})`}">
                            <i class="fas ${u.is_active === false ? 'fa-play' : 'fa-pause'}"></i>
                            ${u.is_active === false ? 'Activar' : 'Suspender'}
                        </button>
                    </div>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn small btn-fingerprint" 
                                onclick="registerFingerprint(${u.id})"
                                ${u.huella_id || u.is_active === false ? 'disabled' : ''}>
                            ${u.huella_id ? '✓ Huella' : 'Huella'}
                        </button>
                        <button class="btn small btn-rfid" 
                                onclick="${u.rfid ? `updateRFIDFromTable(${u.id}, '${u.rfid}')` : `registerRFID(${u.id})`}"
                                ${u.is_active === false ? 'disabled' : ''}>
                            ${u.rfid ? '🔄 Actualizar RFID' : '➕ Agregar RFID'}
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
// ========== ACTUALIZAR RFID DESDE TABLA ==========
async function updateRFIDFromTable(userId, currentRfid) {
    try {
        const confirm = await Swal.fire({
            title: 'Actualizar RFID',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Usuario ID:</strong> ${userId}</p>
                    <p><strong>RFID Actual:</strong> <code>${currentRfid}</code></p>
                    <hr>
                    <p><strong>¿Qué desea hacer?</strong></p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Registrar Nuevo RFID',
            denyButtonText: 'Eliminar RFID Actual',
            cancelButtonText: 'Cancelar',
            width: 500
        });
        
        if (confirm.isConfirmed) {
            // Cambiar a proceso de lectura física con ESP32
            await startPhysicalRFIDUpdateFromTable(userId, currentRfid);
            
        } else if (confirm.isDenied) {
            // Eliminar RFID
            const deleteConfirm = await Swal.fire({
                title: '¿Eliminar RFID?',
                text: 'El usuario no podrá acceder con RFID hasta que se asigne uno nuevo.',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            });
            
            if (deleteConfirm.isConfirmed) {
                const token = localStorage.getItem("jwtToken");
                const deleteResponse = await fetch(`${BASE_URL}/users/${userId}/remove-rfid`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (deleteResponse.ok) {
                    Toast.fire({
                        icon: 'success',
                        title: 'RFID eliminado correctamente'
                    });
                    await loadEmployees();
                }
            }
        }
        
    } catch (error) {
        console.error('Error actualizando RFID desde tabla:', error);
        Toast.fire({
            icon: 'error',
            title: 'Error: ' + error.message
        });
    }
}
async function startPhysicalRFIDUpdateFromTable(userId, oldRfid) {
    try {
        console.log(`Iniciando actualización RFID desde tabla para usuario ${userId}`);
        
        // 1. Verificar conexión ESP32
        await updateESP32Status();
        
        const statusElement = document.getElementById('esp32-status');
        if (!statusElement || !statusElement.className.includes('status-online')) {
            throw new Error('ESP32 no conectado. Verifique la conexión en "Control ESP32".');
        }
        
        // 2. Obtener datos del usuario
        const token = localStorage.getItem("jwtToken");
        const userResponse = await fetch(`${BASE_URL}/users/${userId}`, {
            headers: { "Authorization": "Bearer " + token }
        });
        
        if (!userResponse.ok) {
            throw new Error('Error obteniendo datos del usuario');
        }
        
        const userData = await userResponse.json();
        
        // 3. Confirmar con el usuario
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'ACTUALIZAR RFID FÍSICAMENTE',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Usuario:</strong> ${userData.nombre} ${userData.apellido}</p>
                    <p><strong>ID Usuario:</strong> ${userId}</p>
                    <p><strong>RFID Actual:</strong> <code>${oldRfid}</code></p>
                    <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0;">
                        <p style="margin: 0; color: #856404;">
                            <i class="fas fa-exclamation-triangle"></i> 
                            <strong>IMPORTANTE:</strong> El ESP32 debe mostrar "ESPERANDO RFID"
                        </p>
                    </div>
                    <p style="color: green; margin-top: 10px;">
                        ✅ Preparado para lectura física de nuevo RFID
                    </p>
                    <hr>
                    <p><strong>Instrucciones:</strong></p>
                    <ol>
                        <li>Diríjase al dispositivo ESP32</li>
                        <li>Verifique que aparezca "ESPERANDO RFID"</li>
                        <li>Acercar NUEVO llavero/tarjeta RFID al lector</li>
                        <li>Espere el sonido de confirmación (BEEP)</li>
                        <li>El sistema actualizará automáticamente el RFID</li>
                    </ol>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Iniciar Lectura',
            cancelButtonText: 'Cancelar',
            width: 500
        });

        if (!confirmResult.isConfirmed) {
            return;
        }

        // 4. Enviar comando al ESP32 para leer nuevo RFID
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            throw new Error('IP del ESP32 no configurada');
        }
        
        console.log(`Enviando comando UPDATE_RFID_TABLE a ESP32 ${esp32IP} para usuario ${userId}`);
        
        const commandResponse = await fetch(`http://${esp32IP}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: 'UPDATE_RFID',
                user_id: userId,
                old_rfid: oldRfid,
                timestamp: Date.now(),
                source: 'admin_dashboard_table'
            })
        });
        
        if (!commandResponse.ok) {
            throw new Error(`Error HTTP ${commandResponse.status} enviando comando al ESP32`);
        }
        
        const commandData = await commandResponse.json();
        console.log('Respuesta ESP32:', commandData);
        
        if (!commandData.status || commandData.status !== 'success') {
            throw new Error(commandData.message || 'Error en ESP32');
        }

        // 5. Monitorear lectura
        let checkCount = 0;
        const maxChecks = 90;
        
        await Swal.fire({
            title: 'ESPERANDO NUEVO RFID',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px; font-size: 16px;">
                        <strong>Acercar NUEVO llavero/tarjeta RFID</strong>
                    </p>
                    <p><small>Usuario: ${userData.nombre} ${userData.apellido}</small></p>
                    <p><small>RFID Actual: ${oldRfid}</small></p>
                    
                    <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            <i class="fas fa-clock"></i> Tiempo: 
                            <span id="rfid-table-timer">0</span>/${maxChecks} segundos
                        </p>
                    </div>
                    
                    <div style="margin-top: 15px; font-size: 12px; color: #666; text-align: left;">
                        <p><i class="fas fa-check-circle" style="color: green;"></i> <strong>Verifique en el ESP32:</strong></p>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            <li>Debe decir: "ESPERANDO RFID"</li>
                            <li>Acercar suficientemente el NUEVO llavero</li>
                            <li>Espere sonido de confirmación (BEEP)</li>
                            <li>El sistema detectará automáticamente el cambio</li>
                        </ul>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: 500,
            willOpen: () => {
                const progressInterval = setInterval(async () => {
                    checkCount++;
                    const timerEl = document.getElementById('rfid-table-timer');
                    if (timerEl) {
                        timerEl.textContent = checkCount;
                    }
                    
                    // Verificar cada 3 segundos
                    if (checkCount % 3 === 0) {
                        try {
                            const currentUserResponse = await fetch(`${BASE_URL}/users/${userId}`, {
                                headers: { "Authorization": "Bearer " + token }
                            });
                            
                            if (currentUserResponse.ok) {
                                const currentUserData = await currentUserResponse.json();
                                
                                // Verificar si el RFID ha cambiado (se actualizó)
                                if (currentUserData.rfid && currentUserData.rfid !== oldRfid) {
                                    clearInterval(progressInterval);
                                    Swal.close();
                                    
                                    // Recargar lista de empleados
                                    await loadEmployees();
                                    
                                    // Mostrar éxito
                                    Swal.fire({
                                        icon: 'success',
                                        title: '¡RFID ACTUALIZADO EXITOSAMENTE!',
                                        html: `
                                            <div style="text-align: center;">
                                                <div style="font-size: 50px; color: green; margin: 20px 0;">
                                                    <i class="fas fa-check-circle"></i>
                                                </div>
                                                <p><strong>Usuario:</strong> ${userData.nombre} ${userData.apellido}</p>
                                                <p><strong>RFID Anterior:</strong> ${oldRfid}</p>
                                                <p><strong>RFID Nuevo:</strong> <code>${currentUserData.rfid}</code></p>
                                                <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 15px 0;">
                                                    <p style="margin: 0; color: #155724;">
                                                        <i class="fas fa-info-circle"></i> 
                                                        El RFID ha sido actualizado físicamente en el ESP32.
                                                    </p>
                                                </div>
                                            </div>
                                        `,
                                        confirmButtonText: 'Aceptar',
                                        width: 550
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
                                    <p>No se detectó un nuevo RFID en 90 segundos.</p>
                                    <p><strong>Estado actual:</strong></p>
                                    <ul>
                                        <li>RFID Actual: ${oldRfid}</li>
                                        <li>Usuario: ${userData.nombre} ${userData.apellido}</li>
                                        <li>Tiempo: ${maxChecks} segundos</li>
                                    </ul>
                                    <p><strong>¿Qué revisar?</strong></p>
                                    <ol>
                                        <li>¿El ESP32 muestra "ESPERANDO RFID"?</li>
                                        <li>¿El NUEVO llavero/tarjeta está funcionando?</li>
                                        <li>¿Acercó suficientemente al lector?</li>
                                        <li>¿Escuchó el sonido de confirmación?</li>
                                    </ol>
                                    <div style="margin-top: 20px;">
                                        <button onclick="startPhysicalRFIDUpdateFromTable(${userId}, '${oldRfid}')" 
                                                class="btn btn-primary" 
                                                style="padding: 8px 16px; margin-right: 10px;">
                                            <i class="fas fa-redo"></i> Reintentar
                                        </button>
                                        <button onclick="showSection('section-esp32-control')" 
                                                class="btn btn-secondary"
                                                style="padding: 8px 16px; margin-right: 10px;">
                                            <i class="fas fa-microchip"></i> Verificar ESP32
                                        </button>
                                        <button onclick="loadEmployees()" 
                                                class="btn btn-info"
                                                style="padding: 8px 16px;">
                                            <i class="fas fa-sync"></i> Actualizar Lista
                                        </button>
                                    </div>
                                </div>
                            `,
                            confirmButtonText: 'Cerrar',
                            width: 600
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
        console.error('Error actualizando RFID desde tabla:', err);
        
        Swal.fire({
            icon: 'error',
            title: 'ERROR EN ACTUALIZACIÓN DE RFID',
            html: `
                <div style="text-align: left;">
                    <p><strong>Error:</strong> ${err.message}</p>
                    <hr>
                    <p><strong>Solución paso a paso:</strong></p>
                    <ol>
                        <li>Vaya a <strong>"Control ESP32"</strong></li>
                        <li>Verifique estado: debe decir <strong>"ESP32 CONECTADO"</strong></li>
                        <li>Si dice desconectado, haga clic en <strong>"Probar Conexión"</strong></li>
                        <li>Configure IP correcta con <strong>"Configurar IP"</strong></li>
                        <li>La IP debe ser la que aparece en pantalla del ESP32</li>
                    </ol>
                    <div style="margin-top: 20px;">
                        <button onclick="showSection('section-esp32-control')" 
                                class="btn btn-primary" 
                                style="padding: 8px 16px; margin-right: 10px;">
                            <i class="fas fa-microchip"></i> Ir a Control ESP32
                        </button>
                        <button onclick="startPhysicalRFIDUpdateFromTable(${userId}, '${oldRfid}')" 
                                class="btn btn-warning" 
                                style="padding: 8px 16px; margin-right: 10px;">
                            <i class="fas fa-redo"></i> Reintentar
                        </button>
                        <button onclick="loadEmployees()" 
                                class="btn btn-info"
                                style="padding: 8px 16px;">
                            <i class="fas fa-sync"></i> Actualizar
                        </button>
                    </div>
                </div>
            `,
            width: 650
        });
    }
}
async function openEditUserModal(userId) {
    try {
        const token = localStorage.getItem("jwtToken");
        
        // Obtener datos del usuario
        const res = await fetch(`${BASE_URL}/users/${userId}`, {
            headers: { 
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            throw new Error('No se pudo cargar los datos del usuario');
        }

        const userData = await res.json();
        
        // Llenar el formulario con los datos del usuario
        document.getElementById('editUserId').value = userData.id;
        document.getElementById('editUsername').value = userData.username;
        document.getElementById('editNombre').value = userData.nombre;
        document.getElementById('editApellido').value = userData.apellido;
        document.getElementById('editGenero').value = userData.genero || '';
        
        // Formatear fechas para input type="date"
        if (userData.fecha_nacimiento) {
            document.getElementById('editFechaNacimiento').value = userData.fecha_nacimiento.split('T')[0];
        }
        
        if (userData.fecha_contrato) {
            document.getElementById('editFechaContrato').value = userData.fecha_contrato.split('T')[0];
        }
        
        document.getElementById('editAreaTrabajo').value = userData.area_trabajo || '';
        
        // Guardar valores antiguos para comparación
        const huellaInput = document.getElementById('editHuellaId');
        const rfidInput = document.getElementById('editRfid');
        
        huellaInput.value = userData.huella_id || '';
        huellaInput.setAttribute('data-old-value', userData.huella_id || '');
        
        rfidInput.value = userData.rfid || '';
        rfidInput.setAttribute('data-old-value', userData.rfid || '');
        
        // Manejar el rol
        const roleSelect = document.getElementById('editRole');
        if (roleSelect) {
            roleSelect.value = userData.role || 'empleado';
        }
        
        // Mostrar el modal
        openModal('editUserModal');
        
    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
        Toast.fire({
            icon: 'error',
            title: 'Error al cargar datos del usuario'
        });
    }
}
// ========== ACTUALIZAR HUELLA PARA USUARIO EXISTENTE ==========
async function updateUserFingerprint(userId, oldHuellaId, newHuellaId) {
    try {
        console.log(`Actualizando huella para usuario ${userId}: ${oldHuellaId} -> ${newHuellaId}`);
        
        await updateESP32Status();
        
        const statusElement = document.getElementById('esp32-status');
        if (statusElement && !statusElement.className.includes('status-online')) {
            throw new Error('ESP32 no conectado. Verifique la conexión.');
        }
        
        // 1. Primero actualizar en backend
        const token = localStorage.getItem("jwtToken");
        const updateResponse = await fetch(`${BASE_URL}/users/${userId}/update-complete`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify({
                huella_id: newHuellaId
            })
        });
        
        if (!updateResponse.ok) {
            throw new Error('Error actualizando huella en backend');
        }
        
        // 2. Enviar comando al ESP32 para registrar nueva huella
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            throw new Error('IP del ESP32 no configurada');
        }
        
        const commandResponse = await fetch(`http://${esp32IP}/update-fingerprint`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                old_huella_id: oldHuellaId,
                new_huella_id: newHuellaId,
                user_id: userId
            })
        });
        
        if (!commandResponse.ok) {
            throw new Error('Error enviando comando al ESP32');
        }
        
        const commandData = await commandResponse.json();
        
        if (commandData.status !== 'success') {
            throw new Error(commandData.message || 'Error en ESP32');
        }
        
        // 3. Monitorear progreso (similar al registro normal)
        let checkCount = 0;
        const maxChecks = 120;
        
        await Swal.fire({
            title: 'ACTUALIZANDO HUELLA',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px;">Registrando nueva huella física...</p>
                    <p><small>Huella ID: ${newHuellaId}</small></p>
                    <p><small>Usuario ID: ${userId}</small></p>
                    <div id="update-fingerprint-progress" style="margin-top: 15px; font-size: 12px;">
                        Tiempo: 0/${maxChecks} segundos
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: 400
        });
        
        // 4. Verificar registro (puedes reutilizar la lógica existente)
        // ... (similar a la función registerFingerprint)
        
        return true;
        
    } catch (error) {
        console.error('Error actualizando huella:', error);
        throw error;
    }
}

// ========== ACTUALIZAR RFID PARA USUARIO EXISTENTE ==========
async function updateUserRFID(userId, oldRfid, newRfid) {
    try {
        console.log(`Actualizando RFID para usuario ${userId}`);
        
        await updateESP32Status();
        
        const statusElement = document.getElementById('esp32-status');
        if (statusElement && !statusElement.className.includes('status-online')) {
            throw new Error('ESP32 no conectado. Verifique la conexión.');
        }
        
        // 1. Enviar comando al ESP32 para leer nuevo RFID
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            throw new Error('IP del ESP32 no configurada');
        }
        
        const commandResponse = await fetch(`http://${esp32IP}/update-rfid`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                old_rfid: oldRfid,
                new_rfid: newRfid,
                user_id: userId
            })
        });
        
        if (!commandResponse.ok) {
            throw new Error('Error enviando comando al ESP32');
        }
        
        const commandData = await commandResponse.json();
        
        if (commandData.status !== 'success') {
            throw new Error(commandData.message || 'Error en ESP32');
        }
        
        // 2. Monitorear lectura (similar al registro normal)
        let checkCount = 0;
        const maxChecks = 60;
        
        await Swal.fire({
            title: 'ACTUALIZANDO RFID',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px;">Acercar nuevo llavero RFID...</p>
                    <p><small>Usuario ID: ${userId}</small></p>
                    <div id="update-rfid-progress" style="margin-top: 15px; font-size: 12px;">
                        Tiempo: 0/${maxChecks} segundos
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: 400
        });
        
       
        
        return true;
        
    } catch (error) {
        console.error('Error actualizando RFID:', error);
        throw error;
    }
}

async function updateUser() {
    try {
        const token = localStorage.getItem("jwtToken");
        const userId = document.getElementById('editUserId').value;
        
        // Recopilar datos del formulario
        const userData = {
            username: document.getElementById('editUsername').value.trim(),
            nombre: document.getElementById('editNombre').value.trim(),
            apellido: document.getElementById('editApellido').value.trim(),
            genero: document.getElementById('editGenero').value,
            fecha_nacimiento: document.getElementById('editFechaNacimiento').value || null,
            fecha_contrato: document.getElementById('editFechaContrato').value || null,
            area_trabajo: document.getElementById('editAreaTrabajo').value.trim() || null
        };
        
        // Agregar rol si está presente
        const roleSelect = document.getElementById('editRole');
        if (roleSelect && roleSelect.value) {
            userData.role = roleSelect.value;
        }
        
        // Agregar contraseña si se proporciona
        const password = document.getElementById('editPassword').value;
        if (password) {
            userData.password = password;
        }
        
        // Manejar huella ID
        const huellaId = document.getElementById('editHuellaId').value;
        if (huellaId) {
            userData.huella_id = parseInt(huellaId) || null;
        } else {
            userData.huella_id = null;
        }
        
        // Manejar RFID - Solo guardamos el valor del formulario
        const rfid = document.getElementById('editRfid').value;
        const oldRfid = document.getElementById('editRfid').getAttribute('data-old-value');
        
        // Solo incluir RFID si hay valor
        if (rfid && rfid.trim() !== '') {
            userData.rfid = rfid.trim();
        } else {
            userData.rfid = null;
        }
        
        console.log('Actualizando usuario:', userId, 'con datos:', userData);
        
        // Mostrar loading
        Swal.fire({
            title: 'Actualizando usuario...',
            text: 'Por favor espere',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const res = await fetch(`${BASE_URL}/users/${userId}/update-complete`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(userData)
        });
        
        const responseText = await res.text();
        console.log('Respuesta cruda:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Error parseando JSON:', e);
            throw new Error('Respuesta del servidor inválida');
        }
        
        console.log('Datos de respuesta:', data);
        
        Swal.close();
        
        if (res.ok && data.success) {
            Toast.fire({
                icon: 'success',
                title: 'Usuario actualizado correctamente'
            });
            
            // Cerrar modal
            closeModal('editUserModal');
            
            // Limpiar campos
            document.getElementById('editPassword').value = '';
            
            // Recargar lista de empleados
            await loadEmployees();
            
            // Si se cambió huella o RFID, preguntar si quiere registrar físicamente
            const oldHuellaId = document.getElementById('editHuellaId').getAttribute('data-old-value');
            const oldRfidValue = document.getElementById('editRfid').getAttribute('data-old-value');
            const newHuellaId = userData.huella_id;
            const newRfidValue = userData.rfid;
            
            // 1. Para HUELLA - SOLO si el usuario YA tenía una huella (oldHuellaId existe)
            // y cambió a una NUEVA huella
            if (newHuellaId && newHuellaId !== oldHuellaId) {
                // Mostrar opción para registrar huella físicamente
                const confirm = await Swal.fire({
                    title: 'Nueva huella asignada',
                    text: `¿Desea registrar físicamente la huella ID ${newHuellaId} en el ESP32?`,
                    html: `
                        <div style="text-align: left; font-size: 14px;">
                            <p><strong>Usuario ID:</strong> ${userId}</p>
                            <p><strong>Huella Anterior:</strong> ${oldHuellaId || 'Ninguna'}</p>
                            <p><strong>Huella Nueva:</strong> ${newHuellaId}</p>
                            <p style="color: blue; margin-top: 10px;">
                                <i class="fas fa-info-circle"></i> El ID de huella ya está asignado en la base de datos. Ahora necesita registrarlo físicamente en el ESP32.
                            </p>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, registrar físicamente',
                    cancelButtonText: 'No, solo actualizar ID',
                    showDenyButton: true,
                    denyButtonText: 'Cancelar todo',
                    width: 500
                });
                
                if (confirm.isConfirmed) {
                    // Usar la NUEVA función para usuarios existentes
                    await registerExistingUserFingerprint(userId, newHuellaId);
                } else if (confirm.isDenied) {
                    // Opción de cancelar (no hacer nada)
                    console.log('Usuario canceló registro físico de huella');
                }
            }
            
            // 2. Para RFID - SOLO si el usuario YA tenía un RFID (oldRfidValue existe)
            // y cambió a un NUEVO RFID
            if (newRfidValue && newRfidValue !== oldRfidValue) {
                // Mostrar opción para registrar RFID físicamente usando el ESP32
                const confirm = await Swal.fire({
                    title: 'Actualizar RFID Físicamente',
                    text: `¿Desea leer el nuevo RFID físicamente desde el ESP32?`,
                    html: `
                        <div style="text-align: left; font-size: 14px;">
                            <p><strong>Usuario ID:</strong> ${userId}</p>
                            <p><strong>RFID Anterior:</strong> ${oldRfidValue || 'Ninguno'}</p>
                            <p><strong>RFID Nuevo (en BD):</strong> ${newRfidValue}</p>
                            <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0;">
                                <p style="margin: 0; color: #856404;">
                                    <i class="fas fa-exclamation-triangle"></i> 
                                    <strong>IMPORTANTE:</strong> Necesita leer físicamente el nuevo RFID en el ESP32
                                </p>
                            </div>
                            <p style="color: green; margin-top: 10px;">
                                ✅ Preparado para lectura RFID física
                            </p>
                        </div>
                    `,
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonText: 'Sí, leer RFID físico',
                    cancelButtonText: 'No, solo actualizar en BD',
                    showDenyButton: true,
                    denyButtonText: 'Cancelar',
                    width: 550
                });
                
                if (confirm.isConfirmed) {
                    // Iniciar proceso de lectura física del RFID
                    await startPhysicalRFIDUpdate(userId, oldRfidValue, newRfidValue);
                } else if (confirm.isDenied) {
                    // Opción de cancelar (no hacer nada)
                    console.log('Usuario canceló lectura física de RFID');
                    Toast.fire({
                        icon: 'info',
                        title: 'RFID actualizado solo en base de datos'
                    });
                }
            }
            
        } else {
            throw new Error(data.msg || data.message || 'Error desconocido');
        }
        
    } catch (error) {
        console.error('Error completo actualizando usuario:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al actualizar usuario',
            text: error.message || 'Error desconocido'
        });
    }
}

// ========== FUNCIÓN PARA ACTUALIZAR RFID FÍSICAMENTE ==========
async function startPhysicalRFIDUpdate(userId, oldRfid, newRfid) {
    try {
        console.log(`Actualizando RFID físicamente para usuario ${userId}: ${oldRfid} -> ${newRfid}`);
        
        // 1. Verificar conexión ESP32
        await updateESP32Status();
        
        const statusElement = document.getElementById('esp32-status');
        if (!statusElement || !statusElement.className.includes('status-online')) {
            throw new Error('ESP32 no conectado. Verifique la conexión en "Control ESP32".');
        }
        
        // 2. Confirmar con el usuario
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'LECTURA DE RFID FÍSICO',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Usuario ID:</strong> ${userId}</p>
                    <p><strong>RFID Esperado:</strong> <code>${newRfid}</code></p>
                    <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0;">
                        <p style="margin: 0; color: #856404;">
                            <i class="fas fa-exclamation-triangle"></i> 
                            <strong>IMPORTANTE:</strong> El ESP32 debe mostrar "ESPERANDO RFID"
                        </p>
                    </div>
                    <p style="color: green; margin-top: 10px;">
                        ✅ Preparado para lectura física
                    </p>
                    <hr>
                    <p><strong>Instrucciones:</strong></p>
                    <ol>
                        <li>Diríjase al dispositivo ESP32</li>
                        <li>Verifique que aparezca "ESPERANDO RFID"</li>
                        <li>Acercar llavero/tarjeta RFID al lector</li>
                        <li>Espere el sonido de confirmación (BEEP)</li>
                        <li>Regrese aquí para verificar</li>
                    </ol>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Iniciar Lectura',
            cancelButtonText: 'Cancelar',
            width: 500
        });

        if (!confirmResult.isConfirmed) {
            return;
        }

        // 3. Enviar comando al ESP32 para leer RFID
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            throw new Error('IP del ESP32 no configurada');
        }
        
        console.log(`Enviando comando UPDATE_RFID a ESP32 ${esp32IP} para usuario ${userId}`);
        
        const commandResponse = await fetch(`http://${esp32IP}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: 'READ_RFID',
                user_id: userId,
                old_rfid: oldRfid,
                new_rfid: newRfid,
                timestamp: Date.now(),
                source: 'admin_dashboard_update'
            })
        });
        
        if (!commandResponse.ok) {
            throw new Error(`Error HTTP ${commandResponse.status} enviando comando al ESP32`);
        }
        
        const commandData = await commandResponse.json();
        console.log('Respuesta ESP32:', commandData);
        
        if (!commandData.status || commandData.status !== 'success') {
            throw new Error(commandData.message || 'Error en ESP32');
        }

        // 4. Monitorear lectura
        let checkCount = 0;
        const maxChecks = 90;
        
        await Swal.fire({
            title: 'ESPERANDO RFID',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px; font-size: 16px;">
                        <strong>Acercar nuevo llavero/tarjeta RFID</strong>
                    </p>
                    <p><small>Usuario ID: ${userId}</small></p>
                    <p><small>RFID Esperado: ${newRfid}</small></p>
                    
                    <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            <i class="fas fa-clock"></i> Tiempo: 
                            <span id="rfid-update-timer">0</span>/${maxChecks} segundos
                        </p>
                    </div>
                    
                    <div style="margin-top: 15px; font-size: 12px; color: #666; text-align: left;">
                        <p><i class="fas fa-check-circle" style="color: green;"></i> <strong>Verifique en el ESP32:</strong></p>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            <li>Debe decir: "ESPERANDO RFID"</li>
                            <li>Acercar suficientemente el llavero</li>
                            <li>Espere sonido de confirmación (BEEP)</li>
                        </ul>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: 500,
            willOpen: () => {
                const progressInterval = setInterval(async () => {
                    checkCount++;
                    const timerEl = document.getElementById('rfid-update-timer');
                    if (timerEl) {
                        timerEl.textContent = checkCount;
                    }
                    
                    // Verificar cada 3 segundos
                    if (checkCount % 3 === 0) {
                        try {
                            const token = localStorage.getItem("jwtToken");
                            const userResponse = await fetch(`${BASE_URL}/users/${userId}`, {
                                headers: { "Authorization": "Bearer " + token }
                            });
                            
                            if (userResponse.ok) {
                                const currentUserData = await userResponse.json();
                                
                                // Verificar si el RFID coincide con el que esperamos
                                if (currentUserData.rfid && currentUserData.rfid === newRfid) {
                                    clearInterval(progressInterval);
                                    Swal.close();
                                    
                                    // Recargar lista de empleados
                                    await loadEmployees();
                                    
                                    // Mostrar éxito
                                    Swal.fire({
                                        icon: 'success',
                                        title: '¡RFID ACTUALIZADO EXITOSAMENTE!',
                                        html: `
                                            <div style="text-align: center;">
                                                <div style="font-size: 50px; color: green; margin: 20px 0;">
                                                    <i class="fas fa-check-circle"></i>
                                                </div>
                                                <p><strong>Usuario ID:</strong> ${userId}</p>
                                                <p><strong>RFID Anterior:</strong> ${oldRfid || 'Ninguno'}</p>
                                                <p><strong>RFID Nuevo:</strong> <code>${currentUserData.rfid}</code></p>
                                                <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 15px 0;">
                                                    <p style="margin: 0; color: #155724;">
                                                        <i class="fas fa-info-circle"></i> 
                                                        El RFID ahora está actualizado tanto en la base de datos 
                                                        como físicamente en el ESP32.
                                                    </p>
                                                </div>
                                            </div>
                                        `,
                                        confirmButtonText: 'Aceptar',
                                        width: 550
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
                                    <p>No se detectó el RFID esperado en 90 segundos.</p>
                                    <p><strong>Estado actual:</strong></p>
                                    <ul>
                                        <li>RFID Esperado: ${newRfid}</li>
                                        <li>Usuario ID: ${userId}</li>
                                        <li>Tiempo: ${maxChecks} segundos</li>
                                    </ul>
                                    <p><strong>¿Qué revisar?</strong></p>
                                    <ol>
                                        <li>¿El ESP32 muestra "ESPERANDO RFID"?</li>
                                        <li>¿El llavero/tarjeta está funcionando?</li>
                                        <li>¿Acercó suficientemente al lector?</li>
                                        <li>¿Escuchó el sonido de confirmación?</li>
                                    </ol>
                                    <div style="margin-top: 20px;">
                                        <button onclick="startPhysicalRFIDUpdate(${userId}, '${oldRfid}', '${newRfid}')" 
                                                class="btn btn-primary" 
                                                style="padding: 8px 16px; margin-right: 10px;">
                                            <i class="fas fa-redo"></i> Reintentar
                                        </button>
                                        <button onclick="showSection('section-esp32-control')" 
                                                class="btn btn-secondary"
                                                style="padding: 8px 16px; margin-right: 10px;">
                                            <i class="fas fa-microchip"></i> Verificar ESP32
                                        </button>
                                        <button onclick="loadEmployees()" 
                                                class="btn btn-info"
                                                style="padding: 8px 16px;">
                                            <i class="fas fa-sync"></i> Actualizar Lista
                                        </button>
                                    </div>
                                </div>
                            `,
                            confirmButtonText: 'Cerrar',
                            width: 600
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
        console.error('Error actualizando RFID físicamente:', err);
        
        Swal.fire({
            icon: 'error',
            title: 'ERROR EN ACTUALIZACIÓN DE RFID',
            html: `
                <div style="text-align: left;">
                    <p><strong>Error:</strong> ${err.message}</p>
                    <hr>
                    <p><strong>Solución paso a paso:</strong></p>
                    <ol>
                        <li>Vaya a <strong>"Control ESP32"</strong></li>
                        <li>Verifique estado: debe decir <strong>"ESP32 CONECTADO"</strong></li>
                        <li>Si dice desconectado, haga clic en <strong>"Probar Conexión"</strong></li>
                        <li>Configure IP correcta con <strong>"Configurar IP"</strong></li>
                        <li>La IP debe ser la que aparece en pantalla del ESP32</li>
                    </ol>
                    <div style="margin-top: 20px;">
                        <button onclick="showSection('section-esp32-control')" 
                                class="btn btn-primary" 
                                style="padding: 8px 16px; margin-right: 10px;">
                            <i class="fas fa-microchip"></i> Ir a Control ESP32
                        </button>
                        <button onclick="startPhysicalRFIDUpdate(${userId}, '${oldRfid}', '${newRfid}')" 
                                class="btn btn-warning" 
                                style="padding: 8px 16px; margin-right: 10px;">
                            <i class="fas fa-redo"></i> Reintentar
                        </button>
                        <button onclick="loadEmployees()" 
                                class="btn btn-info"
                                style="padding: 8px 16px;">
                            <i class="fas fa-sync"></i> Actualizar
                        </button>
                    </div>
                </div>
            `,
            width: 650
        });
    }
}

async function registerExistingUserFingerprint(userId, huellaId) {
    try {
        // 1. Obtener IP del ESP32
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            throw new Error('IP del ESP32 no configurada');
        }
        
        // 2. Verificar conexión primero
        await updateESP32Status();
        
        const statusElement = document.getElementById('esp32-status');
        if (!statusElement || !statusElement.className.includes('status-online')) {
            throw new Error('ESP32 no conectado. Verifique la conexión.');
        }
        
        // 3. Obtener datos del usuario
        const token = localStorage.getItem("jwtToken");
        const userResponse = await fetch(`${BASE_URL}/users/${userId}`, {
            headers: { "Authorization": "Bearer " + token }
        });
        
        if (!userResponse.ok) {
            throw new Error('Error obteniendo datos del usuario');
        }
        
        const userData = await userResponse.json();
        
        // 4. Mostrar confirmación
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO FÍSICO DE HUELLA',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Usuario:</strong> ${userData.nombre} ${userData.apellido}</p>
                    <p><strong>ID Usuario:</strong> ${userId}</p>
                    <p><strong>Huella ID:</strong> ${huellaId}</p>
                    <p style="color: green; margin-top: 10px;">
                        ✅ Preparado para registro físico en ESP32
                    </p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Iniciar Registro Físico',
            cancelButtonText: 'Cancelar',
            width: 500
        });

        if (!confirmResult.isConfirmed) {
            return;
        }

        // 5. Enviar comando al ESP32
        console.log(`Enviando REGISTER_FINGERPRINT a ESP32 ${esp32IP}...`);
        
        const commandResponse = await sendCommandToESP32Direct('REGISTER_FINGERPRINT', huellaId, userId, false);
        
        if (!commandResponse || (commandResponse.status !== 'success' && !commandResponse.success)) {
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
                    <p style="margin-top: 15px; font-size: 16px;">
                        <strong>Registrando huella físicamente...</strong>
                    </p>
                    <p><small>Usuario: ${userData.nombre} ${userData.apellido}</small></p>
                    <p><small>Huella ID: ${huellaId}</small></p>
                    
                    <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            <i class="fas fa-clock"></i> Tiempo: 
                            <span id="fingerprint-progress">0</span>/${maxChecks} segundos
                        </p>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: 500,
            willOpen: () => {
                const progressInterval = setInterval(async () => {
                    checkCount++;
                    const progressEl = document.getElementById('fingerprint-progress');
                    if (progressEl) {
                        progressEl.textContent = checkCount;
                    }
                    
                    // Verificar cada 3 segundos
                    if (checkCount % 3 === 0) {
                        try {
                            console.log(`Verificando huella ${huellaId}...`);
                            const verifyResponse = await fetch(`${BASE_URL}/users/huella/check/${huellaId}`, {
                                headers: { 
                                    'Authorization': 'Bearer ' + token,
                                    'Content-Type': 'application/json'
                                }
                            });
                            
                            console.log("Estado respuesta:", verifyResponse.status);
                            if (verifyResponse.ok) {
                                const verifyData = await verifyResponse.json();
                                console.log("Datos verificación:", verifyData);
                                
                                if (verifyData.success && verifyData.exists && verifyData.has_template) {
                                    clearInterval(progressInterval);
                                    Swal.close();
                                    
                                    // Recargar lista de empleados
                                    await loadEmployees();
                                    
                                    // Mostrar éxito
                                    Swal.fire({
                                        icon: 'success',
                                        title: '¡HUELLA REGISTRADA EXITOSAMENTE!',
                                        html: `
                                            <div style="text-align: center;">
                                                <div style="font-size: 50px; color: green; margin: 20px 0;">
                                                    <i class="fas fa-check-circle"></i>
                                                </div>
                                                <p><strong>Usuario:</strong> ${userData.nombre} ${userData.apellido}</p>
                                                <p><strong>Huella ID:</strong> ${huellaId}</p>
                                                <p><strong>Template:</strong> ${verifyData.template_size || '0'} bytes guardados</p>
                                                <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 15px 0;">
                                                    <p style="margin: 0; color: #155724;">
                                                        <i class="fas fa-check"></i> 
                                                        La huella fue registrada físicamente en el ESP32 y 
                                                        guardada en la base de datos.
                                                    </p>
                                                </div>
                                            </div>
                                        `,
                                        confirmButtonText: 'Aceptar',
                                        width: 550
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
                                    <p>No se completó el registro en ${maxChecks} segundos.</p>
                                    <p><strong>¿Qué puede estar pasando?</strong></p>
                                    <ul>
                                        <li>El ESP32 no pudo registrar la huella físicamente</li>
                                        <li>No se colocó correctamente el dedo</li>
                                        <li>El ESP32 no pudo conectar al backend</li>
                                        <li>El sensor de huella tiene problemas</li>
                                    </ul>
                                    <div style="margin-top: 20px;">
                                        <button onclick="registerExistingUserFingerprint(${userId}, ${huellaId})" 
                                                class="btn btn-primary" 
                                                style="padding: 8px 16px; margin-right: 10px;">
                                            <i class="fas fa-redo"></i> Reintentar
                                        </button>
                                        <button onclick="updateESP32Status()" 
                                                class="btn btn-info"
                                                style="padding: 8px 16px; margin-right: 10px;">
                                            <i class="fas fa-wifi"></i> Probar Conexión ESP32
                                        </button>
                                        <button onclick="loadEmployees()" 
                                                class="btn btn-secondary"
                                                style="padding: 8px 16px;">
                                            <i class="fas fa-sync"></i> Actualizar
                                        </button>
                                    </div>
                                </div>
                            `,
                            confirmButtonText: 'Cerrar',
                            width: 600
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
        console.error('Error registrando huella:', err);
        
        Swal.fire({
            icon: 'error',
            title: 'ERROR EN EL REGISTRO',
            html: `
                <div style="text-align: left;">
                    <p><strong>Error:</strong> ${err.message}</p>
                    <hr>
                    <p><strong>Solución paso a paso:</strong></p>
                    <ol>
                        <li>Vaya a la sección <strong>"Control ESP32"</strong></li>
                        <li>Verifique estado: debe decir <strong>"ESP32 CONECTADO"</strong></li>
                        <li>Si dice desconectado, haga clic en <strong>"Probar Conexión"</strong></li>
                        <li>Configure IP correcta con <strong>"Configurar IP"</strong></li>
                        <li>La IP debe ser la que aparece en pantalla del ESP32</li>
                    </ol>
                    <div style="margin-top: 20px;">
                        <button onclick="showSection('section-esp32-control')" 
                                class="btn btn-primary" 
                                style="padding: 8px 16px; margin-right: 10px;">
                            <i class="fas fa-microchip"></i> Ir a Control ESP32
                        </button>
                        <button onclick="registerExistingUserFingerprint(${userId}, ${huellaId})" 
                                class="btn btn-warning" 
                                style="padding: 8px 16px; margin-right: 10px;">
                            <i class="fas fa-redo"></i> Reintentar
                        </button>
                        <button onclick="loadEmployees()" 
                                class="btn btn-info"
                                style="padding: 8px 16px;">
                            <i class="fas fa-sync"></i> Actualizar
                        </button>
                    </div>
                </div>
            `,
            width: 700
        });
    }
}
// Función para probar conexión al backend
async function testBackendConnection() {
    try {
        console.log("Probando endpoints públicos del backend...");
        
        // Probar endpoint público de huella
        const testResponse = await fetch(`${BASE_URL}/users/huella/public/check/1`);
        const testData = await testResponse.json();
        
        if (testData.success !== undefined) {
            Swal.fire({
                icon: 'success',
                title: 'Backend funcionando',
                html: `
                    <div style="text-align: left;">
                        <p><strong>Backend URL:</strong> ${BASE_URL}</p>
                        <p><strong>Endpoint público:</strong> /users/huella/public/check/{id}</p>
                        <p><strong>Respuesta:</strong> ${JSON.stringify(testData)}</p>
                        <p style="color: green; margin-top: 10px;">
                            ✅ El backend está listo para recibir peticiones del ESP32
                        </p>
                    </div>
                `,
                width: 600
            });
        } else {
            throw new Error('Respuesta inesperada del backend');
        }
        
    } catch (error) {
        Swal.fire({
            icon: 'error',
            title: 'Error conectando al backend',
            html: `
                <div style="text-align: left;">
                    <p><strong>Error:</strong> ${error.message}</p>
                    <p><strong>URL probada:</strong> ${BASE_URL}/users/huella/public/check/1</p>
                    <p><strong>¿Qué puede ser?</strong></p>
                    <ol>
                        <li>El backend está caído</li>
                        <li>Problemas de CORS en el backend</li>
                        <li>El endpoint no existe</li>
                        <li>Problemas de red</li>
                    </ol>
                </div>
            `,
            width: 600
        });
    }
}
// ========== REGISTRAR RFID PARA USUARIO EXISTENTE (YA TIENE CÓDIGO ASIGNADO) ==========
async function registerExistingUserRFID(userId, expectedRfid) {
    try {
        console.log(`Registrando RFID para usuario existente ${userId}, esperando: ${expectedRfid}`);
        
        // 1. Verificar conexión ESP32
        await updateESP32Status();
        
        const statusElement = document.getElementById('esp32-status');
        if (!statusElement || !statusElement.className.includes('status-online')) {
            throw new Error('ESP32 no conectado. Verifique la conexión en "Control ESP32".');
        }
        
        // 2. Verificar que el RFID esperado esté asignado en BD
        const token = localStorage.getItem("jwtToken");
        const userCheck = await fetch(`${BASE_URL}/users/${userId}`, {
            headers: { "Authorization": "Bearer " + token }
        });
        
        if (!userCheck.ok) {
            throw new Error('Error verificando usuario en base de datos');
        }
        
        const userData = await userCheck.json();
        
        if (!userData.rfid) {
            throw new Error('El usuario no tiene RFID asignado en la base de datos');
        }
        
        if (userData.rfid !== expectedRfid) {
            throw new Error(`RFID en BD (${userData.rfid}) no coincide con el esperado (${expectedRfid})`);
        }
        
        // 3. Confirmación con el usuario
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO FÍSICO DE RFID',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Usuario:</strong> ${userData.nombre} ${userData.apellido}</p>
                    <p><strong>ID Usuario:</strong> ${userId}</p>
                    <p><strong>RFID Esperado:</strong> <code>${expectedRfid}</code></p>
                    <div style="background: #fff3cd; padding: 10px; border-radius: 5px; margin: 10px 0;">
                        <p style="margin: 0; color: #856404;">
                            <i class="fas fa-exclamation-triangle"></i> 
                            <strong>IMPORTANTE:</strong> El ESP32 ya debe mostrar "ESPERANDO RFID"
                        </p>
                    </div>
                    <p style="color: green; margin-top: 10px;">
                        ✅ Preparado para lectura RFID
                    </p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Iniciar Lectura',
            cancelButtonText: 'Cancelar',
            width: 500
        });

        if (!confirmResult.isConfirmed) {
            return;
        }

        // 4. Enviar comando al ESP32
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            throw new Error('IP del ESP32 no configurada');
        }
        
        console.log(`Enviando comando READ_RFID a ESP32 ${esp32IP} para usuario ${userId}`);
        
        const commandResponse = await fetch(`http://${esp32IP}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: 'READ_RFID',
                user_id: userId,
                timestamp: Date.now(),
                source: 'admin_dashboard_update'
            })
        });
        
        if (!commandResponse.ok) {
            throw new Error(`Error HTTP ${commandResponse.status} enviando comando al ESP32`);
        }
        
        const commandData = await commandResponse.json();
        console.log('Respuesta ESP32:', commandData);
        
        if (!commandData.status || commandData.status !== 'success') {
            throw new Error(commandData.message || 'Error en ESP32');
        }

        // 5. Monitorear lectura
        let checkCount = 0;
        const maxChecks = 90; // 90 segundos para RFID
        
        await Swal.fire({
            title: 'ESPERANDO RFID',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px; font-size: 16px;">
                        <strong>Acercar llavero/tarjeta RFID</strong>
                    </p>
                    <p><small>Usuario: ${userData.nombre} ${userData.apellido}</small></p>
                    <p><small>RFID Esperado: ${expectedRfid}</small></p>
                    
                    <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <p style="margin: 0; font-size: 12px; color: #666;">
                            <i class="fas fa-clock"></i> Tiempo: 
                            <span id="rfid-timer">0</span>/${maxChecks} segundos
                        </p>
                    </div>
                    
                    <div style="margin-top: 15px; font-size: 12px; color: #666; text-align: left;">
                        <p><i class="fas fa-check-circle" style="color: green;"></i> <strong>Verifique en el ESP32:</strong></p>
                        <ul style="margin: 5px 0; padding-left: 20px;">
                            <li>Debe decir: "ESPERANDO RFID"</li>
                            <li>Acercar suficientemente el llavero</li>
                            <li>Espere sonido de confirmación (BEEP)</li>
                        </ul>
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: 500,
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
                                const currentUserData = await userResponse.json();
                                
                                // Verificar si el RFID coincide con el que esperamos
                                if (currentUserData.rfid && currentUserData.rfid === expectedRfid) {
                                    clearInterval(progressInterval);
                                    Swal.close();
                                    
                                    // Recargar lista de empleados
                                    await loadEmployees();
                                    
                                    // Mostrar éxito
                                    Swal.fire({
                                        icon: 'success',
                                        title: '¡RFID REGISTRADO EXITOSAMENTE!',
                                        html: `
                                            <div style="text-align: center;">
                                                <div style="font-size: 50px; color: green; margin: 20px 0;">
                                                    <i class="fas fa-check-circle"></i>
                                                </div>
                                                <p><strong>Usuario:</strong> ${userData.nombre} ${userData.apellido}</p>
                                                <p><strong>RFID Registrado:</strong> <code>${currentUserData.rfid}</code></p>
                                                <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 15px 0;">
                                                    <p style="margin: 0; color: #155724;">
                                                        <i class="fas fa-info-circle"></i> 
                                                        El RFID ahora está registrado tanto en la base de datos 
                                                        como físicamente en el ESP32.
                                                    </p>
                                                </div>
                                            </div>
                                        `,
                                        confirmButtonText: 'Aceptar',
                                        width: 550
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
                                    <p>No se detectó el RFID esperado en 90 segundos.</p>
                                    <p><strong>Estado actual:</strong></p>
                                    <ul>
                                        <li>RFID en BD: ${expectedRfid}</li>
                                        <li>Usuario: ${userData.nombre} ${userData.apellido}</li>
                                        <li>Tiempo: ${maxChecks} segundos</li>
                                    </ul>
                                    <p><strong>¿Qué revisar?</strong></p>
                                    <ol>
                                        <li>¿El ESP32 muestra "ESPERANDO RFID"?</li>
                                        <li>¿El llavero/tarjeta está funcionando?</li>
                                        <li>¿Acercó suficientemente al lector?</li>
                                        <li>¿Escuchó el sonido de confirmación?</li>
                                    </ol>
                                    <div style="margin-top: 20px;">
                                        <button onclick="registerExistingUserRFID(${userId}, '${expectedRfid}')" 
                                                class="btn btn-primary" 
                                                style="padding: 8px 16px; margin-right: 10px;">
                                            <i class="fas fa-redo"></i> Reintentar Registro
                                        </button>
                                        <button onclick="showSection('section-esp32-control')" 
                                                class="btn btn-secondary"
                                                style="padding: 8px 16px; margin-right: 10px;">
                                            <i class="fas fa-microchip"></i> Verificar ESP32
                                        </button>
                                        <button onclick="loadEmployees()" 
                                                class="btn btn-info"
                                                style="padding: 8px 16px;">
                                            <i class="fas fa-sync"></i> Actualizar Lista
                                        </button>
                                    </div>
                                </div>
                            `,
                            confirmButtonText: 'Cerrar',
                            width: 600
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
        console.error('Error registrando RFID para usuario existente:', err);
        
        Swal.fire({
            icon: 'error',
            title: 'ERROR EN REGISTRO DE RFID',
            html: `
                <div style="text-align: left;">
                    <p><strong>Error:</strong> ${err.message}</p>
                    <hr>
                    <p><strong>Solución paso a paso:</strong></p>
                    <ol>
                        <li>Vaya a <strong>"Control ESP32"</strong></li>
                        <li>Verifique estado: debe decir <strong>"ESP32 CONECTADO"</strong></li>
                        <li>Si dice desconectado, haga clic en <strong>"Probar Conexión"</strong></li>
                        <li>Configure IP correcta con <strong>"Configurar IP"</strong></li>
                        <li>La IP debe ser la que aparece en pantalla del ESP32</li>
                    </ol>
                    <div style="margin-top: 20px;">
                        <button onclick="showSection('section-esp32-control')" 
                                class="btn btn-primary" 
                                style="padding: 8px 16px; margin-right: 10px;">
                            <i class="fas fa-microchip"></i> Ir a Control ESP32
                        </button>
                        <button onclick="registerExistingUserRFID(${userId}, '${expectedRfid}')" 
                                class="btn btn-warning" 
                                style="padding: 8px 16px; margin-right: 10px;">
                            <i class="fas fa-redo"></i> Reintentar
                        </button>
                        <button onclick="loadEmployees()" 
                                class="btn btn-info"
                                style="padding: 8px 16px;">
                            <i class="fas fa-sync"></i> Actualizar
                        </button>
                    </div>
                </div>
            `,
            width: 650
        });
    }
}
// ========== FUNCIÓN PARA SUSPENDER USUARIO ==========
async function suspendUser(userId) {
    try {
        const confirmResult = await Swal.fire({
            title: '¿Suspender usuario?',
            text: 'El usuario no podrá acceder al sistema hasta que sea reactivado.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, suspender',
            cancelButtonText: 'Cancelar'
        });
        
        if (confirmResult.isConfirmed) {
            const token = localStorage.getItem("jwtToken");
            
            console.log('Suspender usuario:', userId);
            
            const res = await fetch(`${BASE_URL}/users/${userId}/suspend`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Respuesta suspender:', res.status);
            
            if (res.ok) {
                const data = await res.json();
                console.log('Datos suspender:', data);
                
                if (data.success) {
                    Toast.fire({
                        icon: 'success',
                        title: 'Usuario suspendido correctamente'
                    });
                    
                    // Recargar lista de empleados
                    await loadEmployees();
                    
                } else {
                    throw new Error(data.msg || 'Error al suspender usuario');
                }
            } else {
                const errorText = await res.text();
                throw new Error(`Error HTTP ${res.status}: ${errorText}`);
            }
        }
        
    } catch (error) {
        console.error('Error suspendiendo usuario:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al suspender usuario',
            text: error.message
        });
    }
}

async function activateUser(userId) {
    try {
        const confirmResult = await Swal.fire({
            title: '¿Activar usuario?',
            text: 'El usuario podrá acceder nuevamente al sistema.',
            icon: 'question',
            showCancelButton: true,
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, activar',
            cancelButtonText: 'Cancelar'
        });
        
        if (confirmResult.isConfirmed) {
            const token = localStorage.getItem("jwtToken");
            
            console.log('Activar usuario:', userId);
            
            const res = await fetch(`${BASE_URL}/users/${userId}/activate`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            
            console.log('Respuesta activar:', res.status);
            
            if (res.ok) {
                const data = await res.json();
                console.log('Datos activar:', data);
                
                if (data.success) {
                    Toast.fire({
                        icon: 'success',
                        title: 'Usuario activado correctamente'
                    });
                    
                    // Recargar lista de empleados
                    await loadEmployees();
                    
                } else {
                    throw new Error(data.msg || 'Error al activar usuario');
                }
            } else {
                const errorText = await res.text();
                throw new Error(`Error HTTP ${res.status}: ${errorText}`);
            }
        }
        
    } catch (error) {
        console.error('Error activando usuario:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al activar usuario',
            text: error.message
        });
    }
}
// ========== FUNCIÓN PARA REMOVER HUELLA ==========
async function removeHuella(userId) {
    try {
        const confirmResult = await Swal.fire({
            title: '¿Remover huella?',
            text: 'El usuario no podrá acceder con huella digital hasta que se registre una nueva.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, remover',
            cancelButtonText: 'Cancelar'
        });
        
        if (confirmResult.isConfirmed) {
            const token = localStorage.getItem("jwtToken");
            
            const res = await fetch(`${BASE_URL}/users/${userId}/remove-huella`, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await res.json();
            
            if (res.ok && data.success) {
                Toast.fire({
                    icon: 'success',
                    title: 'Huella removida correctamente'
                });
                
                // Recargar lista de empleados
                loadEmployees();
                
            } else {
                throw new Error(data.msg || 'Error al remover huella');
            }
        }
        
    } catch (error) {
        console.error('Error removiendo huella:', error);
        Toast.fire({
            icon: 'error',
            title: 'Error al remover huella: ' + error.message
        });
    }
}
async function loadSuspendedUsers() {
    try {
        // Puedes usar un endpoint específico o filtrar del endpoint all
        const res = await fetch(`${BASE_URL}/users/all`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("jwtToken") }
        });

        if (!res.ok) {
            throw new Error('Error cargando usuarios');
        }

        const data = await res.json();
        
        // Filtrar solo usuarios suspendidos
        const suspendedUsers = data.users.filter(u => u.is_active === false);
        
        console.log('Usuarios suspendidos encontrados:', suspendedUsers.length);
        
        if (suspendedUsers.length === 0) {
            Toast.fire({
                icon: 'info',
                title: 'No hay usuarios suspendidos'
            });
        }
        
        return suspendedUsers;
        
    } catch (err) {
        console.error('Error cargando usuarios suspendidos:', err);
        return [];
    }
}

// Actualiza bulkActivateUsers para usar la nueva función
async function bulkActivateUsers() {
    try {
        // Cargar usuarios suspendidos
        const suspendedUsers = await loadSuspendedUsers();
        
        if (suspendedUsers.length === 0) {
            Toast.fire({
                icon: 'info',
                title: 'No hay usuarios suspendidos para activar'
            });
            return;
        }
        
        const userIds = suspendedUsers.map(u => u.id);
        
        const confirmResult = await Swal.fire({
            title: `¿Activar ${suspendedUsers.length} usuarios suspendidos?`,
            text: 'Los usuarios podrán acceder nuevamente al sistema.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: `Sí, activar ${suspendedUsers.length} usuarios`,
            cancelButtonText: 'Cancelar'
        });
        
        if (confirmResult.isConfirmed) {
            const token = localStorage.getItem("jwtToken");
            
            const res = await fetch(`${BASE_URL}/users/bulk-activate`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_ids: userIds })
            });
            
            const data = await res.json();
            
            if (res.ok && data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Activación masiva completada',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>Activaciones exitosas:</strong> ${data.activated.length}</p>
                            <p><strong>Fallidas:</strong> ${data.failed.length}</p>
                        </div>
                    `
                });
                
                // Recargar lista de empleados
                await loadEmployees();
                
            } else {
                throw new Error(data.msg || 'Error en activación masiva');
            }
        }
        
    } catch (error) {
        console.error('Error en activación masiva:', error);
        Toast.fire({
            icon: 'error',
            title: 'Error en activación masiva: ' + error.message
        });
    }
}
// ========== FUNCIÓN PARA REMOVER RFID ==========
async function removeRFID(userId) {
    try {
        const confirmResult = await Swal.fire({
            title: '¿Remover RFID?',
            text: 'El usuario no podrá acceder con RFID hasta que se registre uno nuevo.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#dc3545',
            cancelButtonColor: '#6c757d',
            confirmButtonText: 'Sí, remover',
            cancelButtonText: 'Cancelar'
        });
        
        if (confirmResult.isConfirmed) {
            const token = localStorage.getItem("jwtToken");
            
            const res = await fetch(`${BASE_URL}/users/${userId}/remove-rfid`, {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await res.json();
            
            if (res.ok && data.success) {
                Toast.fire({
                    icon: 'success',
                    title: 'RFID removido correctamente'
                });
                
                // Recargar lista de empleados
                loadEmployees();
                
            } else {
                throw new Error(data.msg || 'Error al remover RFID');
            }
        }
        
    } catch (error) {
        console.error('Error removiendo RFID:', error);
        Toast.fire({
            icon: 'error',
            title: 'Error al remover RFID: ' + error.message
        });
    }
}

// ========== FUNCIÓN PARA SUSPENSIÓN MASIVA ==========
async function bulkSuspendUsers() {
    try {
        // Obtener usuarios seleccionados
        const selectedUsers = getSelectedUsers();
        
        if (selectedUsers.length === 0) {
            Toast.fire({
                icon: 'warning',
                title: 'Seleccione al menos un usuario'
            });
            return;
        }
        
        const confirmResult = await Swal.fire({
            title: `¿Suspender ${selectedUsers.length} usuarios?`,
            text: 'Los usuarios seleccionados no podrán acceder al sistema.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: `Sí, suspender ${selectedUsers.length} usuarios`,
            cancelButtonText: 'Cancelar'
        });
        
        if (confirmResult.isConfirmed) {
            const token = localStorage.getItem("jwtToken");
            
            const res = await fetch(`${BASE_URL}/users/bulk-suspend`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_ids: selectedUsers })
            });
            
            const data = await res.json();
            
            if (res.ok && data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Suspensión masiva completada',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>Suspensiones exitosas:</strong> ${data.suspended.length}</p>
                            <p><strong>Fallidas:</strong> ${data.failed.length}</p>
                            ${data.failed.length > 0 ? 
                                `<p><strong>Errores:</strong></p>
                                <ul style="max-height: 200px; overflow-y: auto;">
                                    ${data.failed.map(f => `<li>Usuario ${f.user_id}: ${f.reason}</li>`).join('')}
                                </ul>` : ''
                            }
                        </div>
                    `
                });
                
                // Recargar lista de empleados
                loadEmployees();
                
            } else {
                throw new Error(data.msg || 'Error en suspensión masiva');
            }
        }
        
    } catch (error) {
        console.error('Error en suspensión masiva:', error);
        Toast.fire({
            icon: 'error',
            title: 'Error en suspensión masiva: ' + error.message
        });
    }
}

// ========== FUNCIÓN PARA ACTIVACIÓN MASIVA ==========
async function bulkActivateUsers() {
    try {
        // Obtener usuarios suspendidos
        const suspendedUsers = getSuspendedUsers();
        
        if (suspendedUsers.length === 0) {
            Toast.fire({
                icon: 'info',
                title: 'No hay usuarios suspendidos para activar'
            });
            return;
        }
        
        const confirmResult = await Swal.fire({
            title: `¿Activar ${suspendedUsers.length} usuarios suspendidos?`,
            text: 'Los usuarios podrán acceder nuevamente al sistema.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#6c757d',
            confirmButtonText: `Sí, activar ${suspendedUsers.length} usuarios`,
            cancelButtonText: 'Cancelar'
        });
        
        if (confirmResult.isConfirmed) {
            const token = localStorage.getItem("jwtToken");
            
            const res = await fetch(`${BASE_URL}/users/bulk-activate`, {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_ids: suspendedUsers })
            });
            
            const data = await res.json();
            
            if (res.ok && data.success) {
                Swal.fire({
                    icon: 'success',
                    title: 'Activación masiva completada',
                    html: `
                        <div style="text-align: left;">
                            <p><strong>Activaciones exitosas:</strong> ${data.activated.length}</p>
                            <p><strong>Fallidas:</strong> ${data.failed.length}</p>
                        </div>
                    `
                });
                
                // Recargar lista de empleados
                loadEmployees();
                
            } else {
                throw new Error(data.msg || 'Error en activación masiva');
            }
        }
        
    } catch (error) {
        console.error('Error en activación masiva:', error);
        Toast.fire({
            icon: 'error',
            title: 'Error en activación masiva: ' + error.message
        });
    }
}

// ========== FUNCIONES AUXILIARES ==========
function getSelectedUsers() {
    // Implementar lógica para obtener usuarios seleccionados
    // Esto podría ser mediante checkboxes en la tabla
    const selected = [];
    const checkboxes = document.querySelectorAll('.user-checkbox:checked');
    
    checkboxes.forEach(checkbox => {
        selected.push(parseInt(checkbox.value));
    });
    
    return selected;
}

function getSuspendedUsers() {
    // Obtener todos los usuarios suspendidos de la tabla actual
    const suspendedUsers = [];
    const rows = document.querySelectorAll('#employeesTableBody tr');
    
    rows.forEach(row => {
        const cells = row.cells;
        if (cells.length >= 10) { // Asegurarse de que la fila tiene suficientes celdas
            const statusCell = cells[9]; // Columna de estado (índice 9)
            if (statusCell && (statusCell.textContent.includes('Suspendido') || 
                               statusCell.innerHTML.includes('⛔'))) {
                const userId = parseInt(cells[1].textContent); // ID está en la celda 1
                if (!isNaN(userId)) {
                    suspendedUsers.push(userId);
                }
            }
        }
    });
    
    console.log("Usuarios suspendidos encontrados:", suspendedUsers);
    return suspendedUsers;
}
// ========== AGREGAR ESTOS ESTILOS AL INICIO DEL ARCHIVO ==========
const additionalStyles = `
    /* Estilos para estado de usuarios */
    .status-badge {
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: bold;
        display: inline-block;
        min-width: 80px;
        text-align: center;
    }
    
    .status-active {
        background: #d4edda;
        color: #155724;
        border: 1px solid #c3e6cb;
    }
    
    .status-suspended {
        background: #f8d7da;
        color: #721c24;
        border: 1px solid #f5c6cb;
    }
    
    /* Estilos para botones de acción */
    .btn-edit {
        background: #17a2b8;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        margin-right: 5px;
    }
    
    .btn-edit:hover {
        background: #138496;
    }
    
    .btn-suspend {
        background: #ffc107;
        color: black;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    
    .btn-suspend:hover {
        background: #e0a800;
    }
    
    .btn-activate {
        background: #28a745;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
    }
    
    .btn-activate:hover {
        background: #218838;
    }
    
    /* Estilos para el modal de edición */
    .modal-content .form {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .modal-content .form label {
        font-weight: 500;
        margin-top: 10px;
    }
    
    .modal-content .form input,
    .modal-content .form select {
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
    }
    
    .form-row {
        display: flex;
        gap: 10px;
    }
    
    .form-row > div {
        flex: 1;
    }
    
    /* Estilos para acciones masivas */
    .bulk-actions {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
        flex-wrap: wrap;
    }
    
    .bulk-btn {
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        border: none;
    }
    
    .bulk-suspend {
        background: #ffc107;
        color: black;
    }
    
    .bulk-activate {
        background: #28a745;
        color: white;
    }
`;

// Agregar estilos al documento
if (typeof document !== 'undefined') {
    const styleSheet = document.createElement("style");
    styleSheet.type = "text/css";
    styleSheet.innerText = additionalStyles;
    document.head.appendChild(styleSheet);
}

// ========== REGISTRO DE HUELLA PARA EMPLEADOS ==========
async function registerFingerprint(userId) {
    try {
        console.log("Iniciando registro de huella para usuario:", userId);
        
        // 1. Verificar conexión ESP32
        await updateESP32Status();
        
        const statusElement = document.getElementById('esp32-status');
        if (statusElement && !statusElement.className.includes('status-online')) {
            Swal.fire({
                icon: 'warning',
                title: 'ESP32 no conectado',
                text: 'Verifique la conexión antes de continuar'
            });
            return;
        }
        
        // 2. Obtener datos del usuario
        const token = localStorage.getItem("jwtToken");
        const userResponse = await fetch(`${BASE_URL}/users/${userId}`, {
            headers: { "Authorization": "Bearer " + token }
        });
        
        if (!userResponse.ok) throw new Error('Error obteniendo datos del usuario');
        const userData = await userResponse.json();
        
        // 3. Asignar ID de huella primero
        const assignResponse = await fetch(`${BASE_URL}/users/huella/assign-id`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ user_id: Number(userId) })
        });
        
        if (!assignResponse.ok) throw new Error('Error asignando ID de huella');
        const assignData = await assignResponse.json();
        
        if (!assignData.success) {
            Toast.fire({
                icon: 'error',
                title: "Error: " + (assignData.message || "No se pudo asignar ID")
            });
            return;
        }
        
        const huellaId = assignData.huella_id;
        
        // 4. Mostrar confirmación
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO DE HUELLA',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Usuario:</strong> ${userData.nombre} ${userData.apellido}</p>
                    <p><strong>ID Usuario:</strong> ${userId}</p>
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

        // 5. USAR LA MISMA FUNCIÓN QUE RFID (esto es clave)
        const commandResponse = await sendCommandToESP32Direct('REGISTER_FINGERPRINT', huellaId, userId, false);
        
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
                    <p><small>Usuario: ${userData.nombre} ${userData.apellido}</small></p>
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
                                    
                                    // Asignar al usuario
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
                                    
                                    if (assignHuellaResponse.ok) {
                                        await loadEmployees();
                                        
                                        Swal.fire({
                                            icon: 'success',
                                            title: '¡HUELLA REGISTRADA!',
                                            html: `
                                                <div style="text-align: left;">
                                                    <p><strong>Usuario:</strong> ${userData.nombre} ${userData.apellido}</p>
                                                    <p><strong>Huella ID:</strong> ${huellaId}</p>
                                                    <p><strong>Estado:</strong> Template guardado correctamente</p>
                                                    <p style="color: green; margin-top: 10px;">
                                                        ✅ Ahora puede acceder con su huella
                                                    </p>
                                                </div>
                                            `,
                                            confirmButtonText: 'Aceptar',
                                            width: 500
                                        });
                                        return;
                                    }
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
                                    <button onclick="loadEmployees()" class="btn btn-primary mt-3">
                                        Actualizar Tabla
                                    </button>
                                </div>
                            `,
                            confirmButtonText: 'Entendido',
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
                        <li>Revise la IP configurada en "Control ESP32"</li>
                        <li>Pruebe la conexión con el botón "Probar Conexión"</li>
                    </ol>
                </div>
            `,
            width: 500
        });
    }
}
async function sendUniversalCommand(command, huellaId = null, userId = null) {
    const esp32IP = localStorage.getItem('esp32_ip');
    if (!esp32IP) {
        throw new Error('IP del ESP32 no configurada');
    }

    console.log(`[UNIVERSAL] Enviando ${command} a ESP32 ${esp32IP}...`);
    
    // PRIMERO intentar conexión directa
    try {
        console.log("1. Intentando conexión directa...");
        const response = await fetch(`http://${esp32IP}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: command,
                huella_id: huellaId,
                user_id: userId,
                timestamp: Date.now()
            }),
            signal: AbortSignal.timeout(8000)
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log("✓ Conexión directa exitosa:", data);
            return data;
        }
    } catch (directError) {
        console.log("✗ Conexión directa falló:", directError.message);
    }
    
    // SEGUNDO intentar con proxy (para mixed content)
    try {
        console.log("2. Intentando con proxy...");
        const proxyResponse = await fetch(`${BASE_URL}/esp32/proxy/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('jwtToken')
            },
            body: JSON.stringify({
                esp32_ip: esp32IP,
                command: command,
                huella_id: huellaId,
                user_id: userId
            })
        });
        
        const proxyData = await proxyResponse.json();
        console.log("Respuesta proxy:", proxyData);
        return proxyData;
        
    } catch (proxyError) {
        console.log("✗ Proxy también falló:", proxyError.message);
        throw new Error(
            `No se pudo conectar al ESP32.\n\n` +
            `Verifique que:\n` +
            `1. El ESP32 esté encendido (https://f4f12bcf3348.ngrok-free.app)\n` +
            `2. Su computadora esté en la misma red WiFi\n` +
            `3. La IP ${esp32IP} sea correcta\n` +
            `4. Pueda acceder a http://${esp32IP} desde el navegador`
        );
    }
}
function generateTemporaryFingerprintId() {
   
    return Math.floor(Math.random() * 127) + 1;
}

// Envía comando al ESP32 para registrar huella
async function sendFingerprintRegistrationCommand(huellaId, userId) {
    const esp32IP = localStorage.getItem('esp32_ip');
    if (!esp32IP) {
        throw new Error('IP del ESP32 no configurada');
    }

    console.log(`Enviando comando REGISTER_FINGERPRINT a ESP32 ${esp32IP}...`);
    
    try {
        const response = await fetch(`http://${esp32IP}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                command: 'REGISTER_FINGERPRINT',
                huella_id: huellaId,
                user_id: userId,
                timestamp: Date.now(),
                source: 'admin_dashboard'
            }),
            signal: AbortSignal.timeout(10000)
        });
        
        if (response.ok) {
            return await response.json();
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.error("Error enviando comando al ESP32:", error);
        throw new Error('No se pudo conectar al ESP32 para registro de huella');
    }
}

async function verifyFingerprintOnESP32(huellaId) {
    const esp32IP = localStorage.getItem('esp32_ip');
    if (!esp32IP) {
        throw new Error('IP del ESP32 no configurada');
    }

    try {
        // Usar el backend como proxy para verificar
        const response = await fetch(`${BASE_URL}/esp32/proxy/verify-fingerprint`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('jwtToken')
            },
            body: JSON.stringify({
                esp32_ip: esp32IP,
                huella_id: huellaId
            }),
            signal: AbortSignal.timeout(8000)
        });
        
        if (response.ok) {
            const data = await response.json();
            return data;
        }
        return null;
    } catch (error) {
        console.error("Error verificando huella via proxy:", error);
        return null;
    }
}

// Asigna la huella al usuario SOLO después de verificación exitosa
async function assignFingerprintToUserAfterVerification(userId, huellaId, verificationData) {
    try {
        const token = localStorage.getItem("jwtToken");
        
        console.log("Asignando huella verificada a usuario...", { userId, huellaId, verificationData });
        
        // 1. Asignar ID en backend
        const assignResponse = await fetch(`${BASE_URL}/users/huella/assign-complete`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ 
                user_id: userId, 
                huella_id: huellaId,
                verification_data: verificationData
            })
        });

        if (!assignResponse.ok) {
            throw new Error('Error asignando huella en backend');
        }
        
        const assignData = await assignResponse.json();
        
        if (!assignData.success) {
            throw new Error(assignData.message || 'Error en asignación');
        }

        // 2. Mostrar éxito
        await Swal.fire({
            icon: 'success',
            title: '¡HUELLA REGISTRADA EXITOSAMENTE!',
            html: `
                <div style="text-align: center;">
                    <div style="font-size: 50px; color: green; margin: 20px 0;">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <p><strong>Usuario:</strong> ${assignData.user_nombre || userId}</p>
                    <p><strong>Huella ID:</strong> ${huellaId}</p>
                    <p><strong>Estado:</strong> Registrada físicamente y asignada</p>
                    <div style="background: #d4edda; padding: 10px; border-radius: 5px; margin: 15px 0;">
                        <p style="margin: 0; color: #155724;">
                            <i class="fas fa-info-circle"></i> 
                            La huella ahora está registrada tanto en el ESP32 como en la base de datos.
                        </p>
                    </div>
                </div>
            `,
            confirmButtonText: 'Aceptar',
            width: 550
        });

        // 3. Recargar lista de empleados
        await loadEmployees();
        
        return assignData;
        
    } catch (error) {
        console.error('Error asignando huella después de verificación:', error);
        
        // Mostrar error pero informar que físicamente SÍ se registró
        await Swal.fire({
            icon: 'warning',
            title: 'Registro físico exitoso pero error en asignación',
            html: `
                <div style="text-align: left;">
                    <p>La huella se registró físicamente en el ESP32, pero hubo un error al guardar en la base de datos.</p>
                    <p><strong>Huella ID:</strong> ${huellaId}</p>
                    <p><strong>Error:</strong> ${error.message}</p>
                    <hr>
                    <p><strong>¿Qué hacer?</strong></p>
                    <ol>
                        <li>La huella física está registrada en el ESP32 (ID: ${huellaId})</li>
                        <li>Puede intentar asignarla manualmente desde "Editar usuario"</li>
                        <li>Contacte al administrador del sistema si el problema persiste</li>
                    </ol>
                </div>
            `,
            confirmButtonText: 'Entendido',
            width: 550
        });
        
        throw error;
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
                    <p style="color: green;">Preparado para lectura RFID</p>
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
                                                 El usuario ahora puede acceder con su RFID
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


async function sendCommandToESP32Direct(command, huellaId = null, userId = null, isAdmin = false) {
    try {
        console.log(`Enviando ${command} via proxy del backend...`);
        
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            throw new Error('IP del ESP32 no configurada en el navegador');
        }
        
      
        const response = await fetch(`${BASE_URL}/esp32/proxy/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + localStorage.getItem('jwtToken')
            },
            body: JSON.stringify({
                esp32_ip: esp32IP,  
                command: command,
                huella_id: huellaId,
                user_id: userId,
                is_admin: isAdmin
            })
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}: ${await response.text()}`);
        }
        
        const data = await response.json();
        return data;
        
    } catch (error) {
        console.error('Error enviando comando via proxy:', error);
        throw new Error(`No se pudo enviar comando: ${error.message}`);
    }
}

async function loadUsersForAttendance() {
    try {
        const res = await fetch(`${BASE_URL}/users`, {
            headers: getAuthHeaders()
        });
        
        if (!res.ok) return;
        
        const data = await res.json();
        const select = document.getElementById('attendanceUserSelect');
        if (!select) return;
        
        while (select.options.length > 1) {
            select.remove(1);
        }
        
        data.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.nombre} ${user.apellido}`;
            select.appendChild(option);
        });
        
    } catch (err) {
        console.error('Error cargando usuarios para asistencia:', err);
    }
}

async function loadAttendanceSummary() {
    console.log("Cargando resumen de asistencias...");
 
}
document.getElementById('btnLoadAttendance')?.addEventListener('click', loadAttendanceData);

async function loadAttendanceData() {
    try {
        const userId = document.getElementById('attendanceUserSelect')?.value || '';
        const startDate = document.getElementById('attendanceStart')?.value || '';
        const endDate = document.getElementById('attendanceEnd')?.value || '';
        const area = document.getElementById('attendanceArea')?.value || '';
        
        let url = `${BASE_URL}/attendance/reports`;
        const params = new URLSearchParams();
        
        if (userId) params.append('user_id', userId);
        if (startDate) params.append('start_date', startDate);
        if (endDate) params.append('end_date', endDate);
        if (area) params.append('area', area);
        
        if (params.toString()) {
            url += `?${params.toString()}`;
        }
        
        const res = await fetch(url, {
            headers: getAuthHeaders()
        });
        
        if (!res.ok) throw new Error('Error cargando asistencias');
        
        const data = await res.json();
        const tbody = document.getElementById('attendanceTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        if (!data.data || data.data.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; padding: 20px;">
                        No se encontraron registros de asistencia
                    </td>
                </tr>
            `;
            return;
        }
        
        data.data.forEach(record => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${record.user_nombre || 'N/A'}</td>
                <td>${record.area_trabajo || 'N/A'}</td>
                <td>${record.entry_time || 'N/A'}</td>
                <td>${record.exit_time || 'En curso'}</td>
                <td>${record.duration || 'N/A'}</td>
                <td>${record.status || 'N/A'}</td>
            `;
            tbody.appendChild(tr);
        });
        
    } catch (err) {
        console.error('Error cargando asistencias:', err);
        Toast.fire({
            icon: 'error',
            title: 'Error al cargar asistencias'
        });
    }
}
function toggleSelectAllUsers() {
    const selectAll = document.getElementById('selectAllUsers');
    const checkboxes = document.querySelectorAll('.user-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAll.checked;
    });
}
function initializeSchedules() {
    const btnSaveSchedule = document.getElementById("btn-save-schedule");
    if (btnSaveSchedule) {
        btnSaveSchedule.addEventListener("click", saveSchedule);
    }
    const btnOpenCreateSchedule = document.getElementById("btnOpenCreateSchedule");
    if (btnOpenCreateSchedule) {
        btnOpenCreateSchedule.addEventListener("click", () => {
            openModal('createScheduleModal');
        });
    }
    const btnSaveScheduleModal = document.getElementById("btnSaveSchedule");
    if (btnSaveScheduleModal) {
        btnSaveScheduleModal.addEventListener("click", saveSchedule);
    }
    const btnSaveEditedSchedule = document.getElementById("btnSaveEditedSchedule");
    if (btnSaveEditedSchedule) {
        btnSaveEditedSchedule.addEventListener("click", saveEditedSchedule);
    }
}
async function saveEditedSchedule() {
    try {
        const scheduleId = document.getElementById('editScheduleId').value;
        const nombre = document.getElementById('editScheduleName').value.trim();
        const hora_entrada = document.getElementById('editScheduleEntrada').value;
        const hora_salida = document.getElementById('editScheduleSalida').value;
        const tipo = document.getElementById('editScheduleTipo').value;
        const diasElements = document.querySelectorAll('.edit-sch-day:checked');
        const tolerancia_entrada = parseInt(document.getElementById('editScheduleTolEnt').value) || 0;
        const tolerancia_salida = parseInt(document.getElementById('editScheduleTolSal').value) || 0;
        
        if (!scheduleId) {
            Toast.fire({ icon: 'error', title: 'ID de horario no válido' });
            return;
        }
        
        if (!nombre) {
            Toast.fire({ icon: 'warning', title: 'El nombre es obligatorio' });
            return;
        }
        
        if (!hora_entrada || !hora_salida) {
            Toast.fire({ icon: 'warning', title: 'Las horas de entrada y salida son obligatorias' });
            return;
        }
        
        if (diasElements.length === 0) {
            Toast.fire({ icon: 'warning', title: 'Seleccione al menos un día' });
            return;
        }
        
        const dias = Array.from(diasElements).map(d => d.value).join(',');
        
        const payload = {
            nombre,
            hora_entrada,
            hora_salida,
            tipo,
            dias,
            tolerancia_entrada,
            tolerancia_salida
        };
        
        console.log("Actualizando horario:", payload);
        
        const res = await fetch(`${BASE_URL}/schedules/${scheduleId}`, {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.msg || errorData.message || `Error ${res.status}`);
        }
        
        Toast.fire({ 
            icon: 'success', 
            title: 'Horario actualizado correctamente' 
        });
        
        closeModal('editScheduleModal');
        loadSchedules();
        
    } catch (err) {
        console.error("Error actualizando horario:", err);
        Toast.fire({ 
            icon: 'error', 
            title: 'Error al actualizar horario: ' + err.message 
        });
    }
}
async function loadSchedules() {
    try {
        const res = await fetch(`${BASE_URL}/schedules/`, {
            headers: getAuthHeaders()
        });
        
        if (!res.ok) {
            Toast.fire({ 
                icon: 'error', 
                title: 'Error cargando horarios: ' + res.status 
            });
            return;
        }
        
        const data = await res.json();
        console.log("Horarios cargados:", data);
        
        const container = document.getElementById("schedulesContainer");
        if (!container) {
            console.error("No se encontró schedulesContainer");
            return;
        }
        
        container.innerHTML = "";
        
        if (!data || data.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; grid-column: 1 / -1;">
                    <i class="fas fa-calendar-times" style="font-size: 48px; color: #ccc; margin-bottom: 15px;"></i>
                    <p style="color: #666; font-size: 16px;">No hay horarios registrados</p>
                    <button onclick="openModal('createScheduleModal')" class="btn primary" style="margin-top: 15px;">
                        <i class="fas fa-plus"></i> Crear primer horario
                    </button>
                </div>
            `;
            return;
        }
        
        data.forEach(s => {
            const card = document.createElement("div");
            card.className = "schedule-card";
            card.style.cssText = `
                background: white;
                border-radius: 10px;
                padding: 20px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                border-left: 4px solid #007bff;
                transition: transform 0.2s;
            `;
            card.onmouseenter = function() { this.style.transform = 'translateY(-5px)'; };
            card.onmouseleave = function() { this.style.transform = 'translateY(0)'; };
            
            // Formatear días para mostrar mejor
            const diasArray = s.dias ? s.dias.split(',') : [];
            const diasHTML = diasArray.map(dia => `<span style="display: inline-block; background: #e9ecef; padding: 3px 8px; border-radius: 12px; margin: 2px; font-size: 12px;">${dia.trim()}</span>`).join('');
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                        <h3 style="margin: 0 0 5px 0; color: #333;">${s.nombre || 'Sin nombre'}</h3>
                        <span style="font-size: 12px; color: #666; background: #f8f9fa; padding: 2px 8px; border-radius: 10px;">
                            ${s.tipo === 'fijo' ? 'Horario Fijo' : 'Horario Rotativo'}
                        </span>
                    </div>
                    <div style="color: #666; font-size: 14px;">
                        ID: ${s.id}
                    </div>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #666;">Entrada:</span>
                        <span style="font-weight: bold;">${s.hora_entrada || 'N/A'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                        <span style="color: #666;">Salida:</span>
                        <span style="font-weight: bold;">${s.hora_salida || 'N/A'}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span style="color: #666;">Tolerancia:</span>
                        <span>${s.tolerancia_entrada || 0} min / ${s.tolerancia_salida || 0} min</span>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <div style="color: #666; font-size: 14px; margin-bottom: 5px;">Días:</div>
                    <div style="display: flex; flex-wrap: wrap; gap: 5px;">
                        ${diasHTML || '<span style="color: #999;">No asignado</span>'}
                    </div>
                </div>
                
                <div style="display: flex; gap: 8px; border-top: 1px solid #eee; padding-top: 15px;">
                    <button onclick="openEditScheduleModal(${s.id})" class="btn small" style="flex: 1;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="deleteSchedule(${s.id})" class="btn small btn-danger" style="flex: 1;">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                    <button onclick="assignScheduleToUser(${s.id})" class="btn small btn-secondary" style="flex: 1;">
                        <i class="fas fa-user-plus"></i> Asignar
                    </button>
                </div>
            `;
            
            container.appendChild(card);
        });
        
        Toast.fire({ 
            icon: 'success', 
            title: `Cargados ${data.length} horarios` 
        });
        
    } catch (err) {
        console.error("Error cargando horarios:", err);
        Toast.fire({ 
            icon: 'error', 
            title: 'Error cargando horarios: ' + err.message 
        });
    }
}
async function assignScheduleToUser(scheduleId) {
    try {
        // Primero cargar usuarios
        const usersRes = await fetch(`${BASE_URL}/users/`, {
            headers: getAuthHeaders()
        });
        
        if (!usersRes.ok) {
            throw new Error('Error cargando usuarios');
        }
        
        const usersData = await usersRes.json();
        const users = usersData.users || [];
        
        // Llenar select de usuarios
        const select = document.getElementById('assignUserSelect');
        select.innerHTML = '<option value="">Seleccionar usuario</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.nombre} ${user.apellido} (${user.username})`;
            select.appendChild(option);
        });
        
        // Guardar ID del horario
        document.getElementById('assignScheduleId').value = scheduleId;
        
        // Establecer fecha de inicio como hoy
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('assignStartDate').value = today;
        document.getElementById('assignEndDate').value = '';
        
        // Abrir modal
        openModal('assignScheduleModal');
        
    } catch (err) {
        console.error("Error preparando asignación:", err);
        Toast.fire({ 
            icon: 'error', 
            title: 'Error al cargar usuarios: ' + err.message 
        });
    }
}
async function assignSchedule() {
    try {
        const scheduleId = document.getElementById('assignScheduleId').value;
        const userId = document.getElementById('assignUserSelect').value;
        const startDate = document.getElementById('assignStartDate').value;
        const endDate = document.getElementById('assignEndDate').value || null;
        
        if (!userId) {
            Toast.fire({ icon: 'warning', title: 'Seleccione un usuario' });
            return;
        }
        
        if (!startDate) {
            Toast.fire({ icon: 'warning', title: 'La fecha de inicio es obligatoria' });
            return;
        }
        
        const payload = {
            user_id: parseInt(userId),
            schedule_id: parseInt(scheduleId),
            start_date: startDate
        };
        
        if (endDate) {
            payload.end_date = endDate;
        }
        
        console.log("Asignando horario:", payload);
        
        const res = await fetch(`${BASE_URL}/schedules/assign`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.msg || data.message || `Error ${res.status}`);
        }
        
        Toast.fire({ 
            icon: 'success', 
            title: 'Horario asignado correctamente' 
        });
        
        closeModal('assignScheduleModal');
        
    } catch (err) {
        console.error("Error asignando horario:", err);
        Toast.fire({ 
            icon: 'error', 
            title: 'Error al asignar horario: ' + err.message 
        });
    }
}
document.addEventListener('DOMContentLoaded', function() {
    const btnAssignSchedule = document.getElementById('btnAssignSchedule');
    if (btnAssignSchedule) {
        btnAssignSchedule.addEventListener('click', async function() {
            await assignSchedule();
        });
    }
});
async function deleteSchedule(scheduleId) {
    try {
        const confirmResult = await Swal.fire({
            title: '¿Eliminar horario?',
            text: 'Esta acción no se puede deshacer.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Sí, eliminar',
            cancelButtonText: 'Cancelar'
        });
        
        if (!confirmResult.isConfirmed) return;
        
        const res = await fetch(`${BASE_URL}/schedules/${scheduleId}`, {
            method: "DELETE",
            headers: getAuthHeaders()
        });
        
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.msg || errorData.message || `Error ${res.status}`);
        }
        
        Toast.fire({ 
            icon: 'success', 
            title: 'Horario eliminado correctamente' 
        });
        
        loadSchedules();
        
    } catch (err) {
        console.error("Error eliminando horario:", err);
        Toast.fire({ 
            icon: 'error', 
            title: 'Error al eliminar horario: ' + err.message 
        });
    }
}

async function openEditScheduleModal(scheduleId) {
    try {
        const res = await fetch(`${BASE_URL}/schedules/${scheduleId}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) {
            throw new Error('Error cargando horario');
        }
        const schedule = await res.json();
        document.getElementById('editScheduleId').value = schedule.id;
        document.getElementById('editScheduleName').value = schedule.nombre || '';
        document.getElementById('editScheduleEntrada').value = schedule.hora_entrada || '';
        document.getElementById('editScheduleSalida').value = schedule.hora_salida || '';
        document.getElementById('editScheduleTipo').value = schedule.tipo || 'fijo';
        document.getElementById('editScheduleTolEnt').value = schedule.tolerancia_entrada || 0;
        document.getElementById('editScheduleTolSal').value = schedule.tolerancia_salida || 0;
        document.querySelectorAll('.edit-sch-day').forEach(cb => {
            cb.checked = false;
        });
        
        if (schedule.dias) {
            const diasArray = schedule.dias.split(',');
            diasArray.forEach(dia => {
                const checkbox = document.querySelector(`.edit-sch-day[value="${dia.trim()}"]`);
                if (checkbox) {
                    checkbox.checked = true;
                }
            });
        }
        openModal('editScheduleModal');
        
    } catch (err) {
        console.error("Error abriendo modal de edición:", err);
        Toast.fire({ 
            icon: 'error', 
            title: 'Error al cargar horario' 
        });
    }
}
async function saveSchedule() {
    try {
        const nombre = document.getElementById("schName").value.trim();
        const hora_entrada = document.getElementById("schEntrada").value;
        const hora_salida = document.getElementById("schSalida").value;
        const tipo = document.getElementById("schTipo").value;
        const diasElements = document.querySelectorAll('.sch-day:checked');
        const tolerancia_entrada = parseInt(document.getElementById("schTolEnt").value) || 0;
        const tolerancia_salida = parseInt(document.getElementById("schTolSal").value) || 0;
        if (!nombre) {
            Toast.fire({ icon: 'warning', title: 'El nombre es obligatorio' });
            return;
        }
        
        if (!hora_entrada || !hora_salida) {
            Toast.fire({ icon: 'warning', title: 'Las horas de entrada y salida son obligatorias' });
            return;
        }
        
        if (diasElements.length === 0) {
            Toast.fire({ icon: 'warning', title: 'Seleccione al menos un día' });
            return;
        }
        const dias = Array.from(diasElements).map(d => d.value).join(',');
        
        const payload = {
            nombre,
            hora_entrada,
            hora_salida,
            tipo,
            dias,
            tolerancia_entrada,
            tolerancia_salida
        };
        
        console.log("Enviando horario:", payload);
        
        const res = await fetch(`${BASE_URL}/schedules/`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.msg || data.message || `Error ${res.status}`);
        }
        
        Toast.fire({ 
            icon: 'success', 
            title: 'Horario creado correctamente' 
        });

        closeModal('createScheduleModal');
        document.getElementById("schName").value = "";
        document.getElementById("schEntrada").value = "";
        document.getElementById("schSalida").value = "";
        document.getElementById("schTipo").value = "fijo";
        document.getElementById("schTolEnt").value = "0";
        document.getElementById("schTolSal").value = "0";
        document.querySelectorAll('.sch-day').forEach(cb => cb.checked = false);

        loadSchedules();
        
    } catch (err) {
        console.error("Error creando horario:", err);
        Toast.fire({ 
            icon: 'error', 
            title: 'Error al crear horario: ' + err.message 
        });
    }
}
function getAuthHeaders() {
    const token = localStorage.getItem("jwtToken");
    return {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json"
    };
}
document.addEventListener("DOMContentLoaded", function () {
    if (!localStorage.getItem('esp32_ip')) {
        localStorage.setItem('esp32_ip', 'https://f4f12bcf3348.ngrok-free.app');
        ESP32_BASE_URL = 'https://f4f12bcf3348.ngrok-free.app';
    } else {
        ESP32_BASE_URL = `http://${localStorage.getItem('esp32_ip')}`;
    }
    
    
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

    updateESP32Status();
    setInterval(updateESP32Status, 30000);
    
    console.log("Dashboard Admin inicializado correctamente - Modo LOCAL");
});

