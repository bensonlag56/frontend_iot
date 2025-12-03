const BASE_URL = "https://asistencia-iot-api.onrender.com";
let ESP32_BASE_URL = '192.168.1.108'; 
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

// NUEVAS FUNCIONES PARA EL REGISTRO DEL ADMINISTRADOR
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

        // Decodificar el token para obtener el user_id
        const payload = JSON.parse(atob(token.split('.')[1]));
        const adminId = payload.user_id;

        // Obtener información del administrador actual
        const res = await fetch(`${BASE_URL}/users/${adminId}`, {
            headers: { "Authorization": "Bearer " + token }
        });

        if (!res.ok) {
            throw new Error('Error al cargar información del administrador');
        }

        const adminData = await res.json();
        
        // Actualizar la UI con la información del admin
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
        
        // Actualizar botones según estado
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
            title: 'Error al cargar información'
        });
    }
}

async function registerAdminFingerprint() {
    try {
        const token = localStorage.getItem("jwtToken");
        if (!token) {
            Toast.fire({
                icon: 'error',
                title: 'No hay sesión activa'
            });
            return;
        }

        // Decodificar el token para obtener el user_id
        const payload = JSON.parse(atob(token.split('.')[1]));
        const adminId = payload.user_id;

        console.log("Registrando huella para administrador ID:", adminId);
        
        // Verificar conexión con ESP32 primero
        await updateESP32Status();
        
        // 1. Asignar ID de huella
        const assignResponse = await fetch(`${BASE_URL}/users/huella/assign-manual`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({ user_id: adminId })
        });

        if (!assignResponse.ok) {
            const errorData = await assignResponse.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error del servidor al asignar ID');
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
        
        // 2. Asociar inmediatamente al usuario
        const assignHuellaResponse = await fetch(`${BASE_URL}/users/huella/assign-manual`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + token
            },
            body: JSON.stringify({
                user_id: adminId,
                huella_id: huellaId
            })
        });

        if (!assignHuellaResponse.ok) {
            const errorData = await assignHuellaResponse.json().catch(() => ({}));
            throw new Error('Error asociando huella: ' + (errorData.message || ''));
        }

        // 3. Actualizar información del admin
        await loadAdminInfo();
        
        // 4. Confirmación con el usuario
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO DE HUELLA',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Administrador:</strong> ID ${adminId}</p>
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
                    <p><small>El sistema verificará automáticamente cuando complete el registro</small></p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Continuar',
            cancelButtonText: 'Cancelar',
            width: 500
        });

        if (!confirmResult.isConfirmed) {
            return;
        }

        // 5. Enviar comando al ESP32
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            throw new Error('IP del ESP32 no configurada');
        }

        const commandResponse = await sendCommandToESP32Direct('REGISTER_FINGERPRINT', huellaId, adminId);
        
        if (!commandResponse || commandResponse.status !== 'success') {
            throw new Error(commandResponse?.message || 'Error enviando comando al ESP32');
        }

        // 6. Monitorear progreso
        let checkCount = 0;
        const maxChecks = 120; // 120 segundos (2 minutos)
        
        await Swal.fire({
            title: 'REGISTRO EN PROGRESO',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px;">Esperando registro físico...</p>
                    <p><small>Huella ID: ${huellaId}</small></p>
                    <p><small>Administrador ID: ${adminId}</small></p>
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
                    
                    // Verificar estado cada 2 segundos
                    if (checkCount % 2 === 0) {
                        try {
                            const verifyResponse = await fetch(`${BASE_URL}/users/huella/check/${huellaId}`, {
                                headers: {
                                    "Authorization": "Bearer " + token
                                }
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
                                    <p><strong>Estado actual:</strong></p>
                                    <ul>
                                        <li>Huella ID ${huellaId} asignado</li>
                                        <li>Puede que el registro físico esté en proceso</li>
                                        <li>Verifique el dispositivo ESP32</li>
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
                
                // Guardar el interval ID para limpiarlo si se cierra
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
                        <li>Revise la IP configurada en la sección "Control ESP32"</li>
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
            Toast.fire({
                icon: 'error',
                title: 'No hay sesión activa'
            });
            return;
        }

        // Decodificar el token para obtener el user_id
        const payload = JSON.parse(atob(token.split('.')[1]));
        const adminId = payload.user_id;

        console.log("Registrando RFID para administrador ID:", adminId);
        
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            Swal.fire({
                icon: 'error',
                title: 'IP no configurada',
                text: 'Configure la IP del ESP32 primero en la sección de control.',
                width: 400
            });
            return;
        }

        // 1. Mostrar confirmación
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO DE RFID',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Administrador:</strong> ID ${adminId}</p>
                    <p><strong>Dispositivo ESP32:</strong> ${esp32IP}</p>
                    <hr>
                    <p><strong>Instrucciones:</strong></p>
                    <ol>
                        <li>El ESP32 se activará en modo lectura RFID</li>
                        <li>Diríjase al dispositivo físico</li>
                        <li>Acercar el llavero RFID al lector</li>
                        <li>Espere el tono de confirmación</li>
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

        // 2. Enviar comando DIRECTAMENTE al ESP32
        const commandResponse = await sendCommandToESP32Direct('READ_RFID', null, adminId);
        
        if (!commandResponse || commandResponse.status !== 'success') {
            throw new Error(commandResponse?.message || 'Error enviando comando al ESP32');
        }

        // 3. Mostrar espera
        Swal.fire({
            title: 'ESPERANDO RFID',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px;">Acercar llavero RFID al dispositivo</p>
                    <p><small>IP: ${esp32IP}</small></p>
                    <p><small>Administrador ID: ${adminId}</small></p>
                    <div id="rfid-progress" style="margin-top: 15px; font-size: 12px;">
                        Esperando lectura...
                    </div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false,
            width: 400
        });

        // 4. Monitorear
        let checkCount = 0;
        const maxChecks = 60; // 60 segundos
        const checkInterval = setInterval(async () => {
            checkCount++;
            
            const progressEl = document.getElementById('rfid-progress');
            if (progressEl) {
                progressEl.innerHTML = `<p>Esperando lectura de RFID... (${checkCount}/${maxChecks})</p>`;
            }
            
            try {
                // Verificar si se asignó el RFID al usuario
                const userResponse = await fetch(`${BASE_URL}/users/${adminId}`, {
                    headers: { "Authorization": "Bearer " + token }
                });
                
                if (userResponse.ok) {
                    const userData = await userResponse.json();
                    
                    if (userData.rfid) {
                        // ¡RFID asignado exitosamente!
                        clearInterval(checkInterval);
                        Swal.close();
                        
                        await loadAdminInfo();
                        
                        Swal.fire({
                            icon: 'success',
                            title: '¡RFID REGISTRADO EXITOSAMENTE!',
                            html: `
                                <div style="text-align: left;">
                                    <p><strong>Administrador:</strong> ID ${adminId}</p>
                                    <p><strong>RFID Asignado:</strong> ${userData.rfid}</p>
                                    <p style="color: green; margin-top: 10px;">
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
            
            // Si se excede el tiempo máximo
            if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                Swal.fire({
                    icon: 'warning',
                    title: 'Tiempo de espera agotado',
                    html: `
                        <div style="text-align: left;">
                            <p>No se detectó ningún RFID.</p>
                            <p><strong>Opciones:</strong></p>
                            <ol>
                                <li>Asegúrese de que el llavero RFID esté funcionando</li>
                                <li>Acérquelo más al lector</li>
                                <li>Intente nuevamente</li>
                            </ol>
                        </div>
                    `,
                    confirmButtonText: 'Entendido',
                    width: 500
                }).then(() => {
                    loadAdminInfo();
                });
            }
        }, 1000); // Verificar cada segundo

    } catch (err) {
        console.error('Error en registro de RFID del admin:', err);
        
        Swal.fire({
            icon: 'error',
            title: 'ERROR EN EL REGISTRO',
            html: `
                <div style="text-align: left;">
                    <p><strong>Error:</strong> ${err.message}</p>
                    <hr>
                    <p><strong>Solución:</strong></p>
                    <ol>
                        <li>Verifique que el ESP32 esté encendido</li>
                        <li>Actualice la IP en "Control ESP32"</li>
                        <li>Pruebe la conexión con "Probar Conexión"</li>
                    </ol>
                </div>
            `,
            width: 500
        });
    }
}

// FUNCIONES EXISTENTES (las mismas que ya tenías)
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
        Toast.fire({
            icon: 'warning',
            title: 'Complete todos los campos obligatorios'
        });
        return;
    }

    const payload = {
        nombre,
        apellido,
        username,
        password,
        genero,
        fecha_nacimiento,
        fecha_contrato,
        area_trabajo,
        role: "empleado",
        rfid: null
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
            Toast.fire({
                icon: 'error',
                title: data.msg || "Error al registrar empleado"
            });
            return;
        }

        Toast.fire({
            icon: 'success',
            title: 'Empleado registrado correctamente'
        });
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
        Toast.fire({
            icon: 'error',
            title: 'Error en el servidor'
        });
        console.error(err);
    }
}

async function loadEmployees() {
    try {
        const res = await fetch(`${BASE_URL}/users/?page=1&per_page=50`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("jwtToken") }
        });

        if (!res.ok) {
            Toast.fire({
                icon: 'error',
                title: 'No se pudo cargar la lista de usuarios'
            });
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

        // Mostrar mensaje de éxito
        Toast.fire({
            icon: 'success',
            title: `Cargados ${data.users.length} empleados`
        });

    } catch (err) {
        console.error(err);
        Toast.fire({
            icon: 'error',
            title: 'Error cargando usuarios'
        });
    }
}

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

async function checkESP32Status() {
    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = 5000;

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        resolve(data);
                    } catch (e) {
                        resolve({ status: 'ready', message: 'Conexión exitosa' });
                    }
                } else {
                    resolve({
                        status: 'offline',
                        error: xhr.status === 0 ? 'No se pudo conectar' : `Error ${xhr.status}`
                    });
                }
            }
        };

        xhr.ontimeout = function () {
            resolve({ status: 'offline', error: 'Timeout - Sin respuesta' });
        };

        xhr.onerror = function () {
            resolve({ status: 'offline', error: 'Error de conexión' });
        };

        xhr.open('GET', `${ESP32_BASE_URL}/status`, true);
        xhr.send();
    });
}

async function updateESP32Status() {
    const statusElement = document.getElementById('esp32-status');
    const infoElement = document.getElementById('esp32-info');

    if (!statusElement) {
        console.log('Elemento esp32-status no encontrado');
        return;
    }

    statusElement.textContent = ' Consultando estado...';
    statusElement.className = 'status-box';

    try {
        const status = await checkESP32Status();

        if (status.status === 'ready') {
            statusElement.innerHTML =
                ` ESP32 CONECTADO | IP: ${ESP32_BASE_URL}<br>` +
                ` WiFi: ${status.ssid || 'Conectado'} (${status.rssi || '?'} dBm)<br>` +
                ` Huella ID Actual: ${status.huella_id_actual || 'Ninguno'}<br>` +
                ` Registro Activo: ${status.registro_activo ? 'Sí' : 'No'}`;
            statusElement.className = 'status-box status-online';

            if (infoElement) {
                infoElement.innerHTML = `
                    <p><strong>Estado del Sistema:</strong> ${status.sistema_listo ? 'Listo' : ' No listo'}</p>
                    <p><strong>Sensor de Huella:</strong> ${status.sistema_listo ? 'Conectado' : 'Desconectado'}</p>
                    <p><strong>Último ID:</strong> ${status.huella_id_actual || 'Ninguno'}</p>
                    <p><strong>Registro en Curso:</strong> ${status.registro_activo ? 'Activo' : 'Inactivo'}</p>
                `;
            }
        } else {
            statusElement.innerHTML =
                ` ESP32 DESCONECTADO<br>` +
                `Error: ${status.error || 'No se pudo conectar'}<br>` +
                `IP: ${ESP32_BASE_URL}`;
            statusElement.className = 'status-box status-offline';

            if (infoElement) {
                infoElement.innerHTML = '<p>No se pudo obtener información del dispositivo.</p>';
            }
        }
    } catch (error) {
        statusElement.innerHTML =
            ` ERROR DE CONEXIÓN<br>` +
            `Verifique la IP: ${ESP32_BASE_URL}`;
        statusElement.className = 'status-box status-offline';

        if (infoElement) {
            infoElement.innerHTML = '<p>Error al consultar el estado del dispositivo.</p>';
        }
    }
}

async function testESP32Connection() {
    const status = await checkESP32Status();
    if (status.status === 'ready') {
        Swal.fire({
            icon: 'success',
            title: 'Conexión exitosa al ESP32',
            html: `IP: ${ESP32_BASE_URL}<br>WiFi: ${status.ssid || 'Conectado'}<br>Estado: ${status.sistema_listo ? 'Sistema Listo' : 'Sistema No Listo'}`
        });
    } else {
        Swal.fire({
            icon: 'error',
            title: 'No se pudo conectar al ESP32',
            html: `IP configurada: ${ESP32_BASE_URL}<br><br>Verifique:<br>• La IP que aparece en la pantalla del ESP32<br>• Que el ESP32 esté encendido<br>• Que estén en la misma red WiFi<br>• Que no haya firewall bloqueando la conexión`
        });
    }
}

async function sendCommandToESP32(huellaId) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = 10000;

        xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                    try {
                        const data = JSON.parse(xhr.responseText);
                        if (data.status === 'success') {
                            resolve(data);
                        } else {
                            reject(new Error(data.message || 'Error en la respuesta del ESP32'));
                        }
                    } catch (e) {
                        resolve({ success: true, message: 'Comando enviado exitosamente' });
                    }
                } else {
                    reject(new Error(`Error HTTP: ${xhr.status}`));
                }
            }
        };

        xhr.ontimeout = function () {
            reject(new Error('Timeout - El ESP32 no respondió'));
        };

        xhr.onerror = function () {
            reject(new Error('Error de conexión con el ESP32'));
        };

        xhr.open('POST', `${ESP32_BASE_URL}/command`, true);
        xhr.setRequestHeader('Content-Type', 'application/json');

        const payload = JSON.stringify({
            command: 'REGISTER_FINGERPRINT',
            huella_id: huellaId,
            timestamp: Date.now()
        });

        xhr.send(payload);
    });
}

async function sendCommandToESP32Direct(command, huellaId = null, userId = null) {
    const esp32IP = localStorage.getItem('esp32_ip');
    if (!esp32IP) {
        throw new Error('IP del ESP32 no configurada');
    }

    const url = `http://${esp32IP}/command`;
    
    const payload = {
        command: command,
        timestamp: Date.now()
    };
    
    if (huellaId) {
        payload.huella_id = huellaId;
    }
    
    if (userId) {
        payload.user_id = userId;
    }

    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.timeout = 15000; // 15 segundos timeout
        
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
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
            }
        };
        
        xhr.ontimeout = function() {
            reject(new Error('Timeout - El ESP32 no respondió'));
        };
        
        xhr.onerror = function() {
            reject(new Error('Error de conexión con el ESP32'));
        };
        
        xhr.open('POST', url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify(payload));
    });
}

async function registerFingerprint(userId) {
    try {
        console.log("Iniciando registro de huella para usuario:", userId);
        
        // Verificar conexión primero
        await updateESP32Status();
        
        // 1. Asignar ID de huella
        const assignResponse = await fetch(`${BASE_URL}/users/huella/assign-id`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
            },
            body: JSON.stringify({ user_id: userId })
        });

        if (!assignResponse.ok) {
            const errorData = await assignResponse.json().catch(() => ({}));
            throw new Error(errorData.message || 'Error del servidor al asignar ID');
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
        
        // 2. Asociar inmediatamente al usuario
        const assignHuellaResponse = await fetch(`${BASE_URL}/users/huella/assign-manual`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
            },
            body: JSON.stringify({
                user_id: userId,
                huella_id: huellaId
            })
        });

        if (!assignHuellaResponse.ok) {
            const errorData = await assignHuellaResponse.json().catch(() => ({}));
            throw new Error('Error asociando huella: ' + (errorData.message || ''));
        }

        // 3. Actualizar tabla
        await loadEmployees();
        
        // 4. Confirmación con el usuario
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
                    <p><small>El sistema verificará automáticamente cuando complete el registro</small></p>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Continuar',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmResult.isConfirmed) {
            return;
        }

        // 5. Enviar comando al ESP32
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            throw new Error('IP del ESP32 no configurada');
        }

        const commandResponse = await sendCommandToESP32Direct('REGISTER_FINGERPRINT', huellaId, userId);
        
        if (!commandResponse || commandResponse.status !== 'success') {
            throw new Error(commandResponse?.message || 'Error enviando comando al ESP32');
        }

        // 6. Monitorear progreso
        let checkCount = 0;
        const maxChecks = 120; // 120 segundos (2 minutos)
        
        const { value: formValues } = await Swal.fire({
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
                    
                    // Verificar estado
                    try {
                        const verifyResponse = await fetch(`${BASE_URL}/users/huella/check/${huellaId}`, {
                            headers: {
                                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
                            }
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
                    
                    // Timeout
                    if (checkCount >= maxChecks) {
                        clearInterval(progressInterval);
                        Swal.fire({
                            icon: 'warning',
                            title: 'Tiempo agotado',
                            html: `
                                <div style="text-align: left;">
                                    <p>No se completó el registro en el tiempo esperado.</p>
                                    <p><strong>Estado actual:</strong></p>
                                    <ul>
                                        <li>Huella ID ${huellaId} asignado</li>
                                        <li>Puede que el registro físico esté en proceso</li>
                                        <li>Verifique el dispositivo ESP32</li>
                                    </ul>
                                </div>
                            `,
                            confirmButtonText: 'Entendido'
                        }).then(() => {
                            loadEmployees();
                        });
                    }
                }, 1000);
                
                // Guardar el interval ID para limpiarlo si se cierra
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
                        <li>Verifique que el backend esté funcionando</li>
                    </ol>
                    <button onclick="loadEmployees()" class="btn btn-primary mt-3">
                        Actualizar Tabla
                    </button>
                </div>
            `
        });
    }
}

async function registerRFID(userId) {
    try {
        console.log("Iniciando registro de RFID para usuario:", userId);
        
        const esp32IP = localStorage.getItem('esp32_ip');
        if (!esp32IP) {
            Swal.fire({
                icon: 'error',
                title: 'IP no configurada',
                text: 'Configure la IP del ESP32 primero en la sección de control.'
            });
            return;
        }

        // 1. Mostrar confirmación
        const confirmResult = await Swal.fire({
            icon: 'info',
            title: 'REGISTRO DE RFID',
            html: `
                <div style="text-align: left; font-size: 14px;">
                    <p><strong>Usuario:</strong> ID ${userId}</p>
                    <p><strong>Dispositivo ESP32:</strong> ${esp32IP}</p>
                    <hr>
                    <p><strong>Instrucciones:</strong></p>
                    <ol>
                        <li>El ESP32 se activará en modo lectura RFID</li>
                        <li>Diríjase al dispositivo físico</li>
                        <li>Acercar el llavero RFID al lector</li>
                        <li>Espere el tono de confirmación</li>
                    </ol>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'Iniciar Lectura',
            cancelButtonText: 'Cancelar'
        });

        if (!confirmResult.isConfirmed) {
            return;
        }

        // 2. Enviar comando DIRECTAMENTE al ESP32
        const commandResponse = await sendCommandToESP32Direct('READ_RFID', null, userId);
        
        if (!commandResponse || commandResponse.status !== 'success') {
            throw new Error(commandResponse?.message || 'Error enviando comando al ESP32');
        }

        // 3. Mostrar espera
        Swal.fire({
            title: 'ESPERANDO RFID',
            html: `
                <div style="text-align: center;">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Cargando...</span>
                    </div>
                    <p style="margin-top: 15px;">Acercar llavero RFID al dispositivo</p>
                    <p><small>IP: ${esp32IP}</small></p>
                    <p><small>Usuario ID: ${userId}</small></p>
                    <div id="rfid-progress" style="margin-top: 15px;"></div>
                </div>
            `,
            showConfirmButton: false,
            allowOutsideClick: false
        });

        // 4. Monitorear
        let checkCount = 0;
        const maxChecks = 60; // 60 segundos
        const checkInterval = setInterval(async () => {
            checkCount++;
            
            document.getElementById('rfid-progress').innerHTML = 
                `<p>Esperando lectura de RFID... (${checkCount}/${maxChecks})</p>`;
            
            try {
                const userResponse = await fetch(`${BASE_URL}/users/?page=1&per_page=50`, {
                    headers: { "Authorization": "Bearer " + localStorage.getItem("jwtToken") }
                });
                
                const usersData = await userResponse.json();
                const currentUser = usersData.users.find(u => u.id == userId);
                
                if (currentUser && currentUser.rfid) {
                    // ¡RFID asignado exitosamente!
                    clearInterval(checkInterval);
                    Swal.close();
                    
                    Swal.fire({
                        icon: 'success',
                        title: '¡RFID REGISTRADO EXITOSAMENTE!',
                        html: `
                            <div style="text-align: left;">
                                <p><strong>Usuario:</strong> ID ${userId}</p>
                                <p><strong>RFID Asignado:</strong> ${currentUser.rfid}</p>
                                <p style="color: green; margin-top: 10px;">
                                    ✅ El usuario ahora puede acceder con su RFID
                                </p>
                            </div>
                        `,
                        confirmButtonText: 'Aceptar'
                    }).then(() => {
                        loadEmployees();
                    });
                }
            } catch (error) {
                console.error("Error verificando RFID:", error);
            }
            

            if (checkCount >= maxChecks) {
                clearInterval(checkInterval);
                Swal.fire({
                    icon: 'warning',
                    title: 'Tiempo de espera agotado',
                    html: `
                        <div style="text-align: left;">
                            <p>No se detectó ningún RFID.</p>
                            <p><strong>Opciones:</strong></p>
                            <ol>
                                <li>Asegúrese de que el llavero RFID esté funcionando</li>
                                <li>Acérquelo más al lector</li>
                                <li>Intente nuevamente</li>
                            </ol>
                        </div>
                    `,
                    confirmButtonText: 'Entendido'
                });
            }
        }, 1000); 

    } catch (err) {
        console.error('Error en registro de RFID:', err);
        
        Swal.fire({
            icon: 'error',
            title: 'ERROR EN EL REGISTRO',
            html: `
                <div style="text-align: left;">
                    <p><strong>Error:</strong> ${err.message}</p>
                    <hr>
                    <p><strong>Solución:</strong></p>
                    <ol>
                        <li>Verifique que el ESP32 esté encendido</li>
                        <li>Actualice la IP en "Control ESP32"</li>
                        <li>Pruebe la conexión con "Probar Conexión"</li>
                    </ol>
                </div>
            `
        });
    }
}

function showManualInstructions(userId, errorMsg) {
    Swal.fire({
        icon: 'error',
        title: 'NO SE PUDO CONECTAR AL DISPOSITIVO',
        html: `Error: ${errorMsg}<br><br>` +
            `INSTRUCCIONES MANUALES:<br><br>` +
            `1. Vaya al dispositivo ESP32 físico<br>` +
            `2. En el menú, seleccione la opción 1 (Registrar Huella)<br>` +
            `3. Anote el ID que se asigne automáticamente<br>` +
            `4. Siga las instrucciones en pantalla<br><br>` +
            `CONFIGURACIÓN ACTUAL:<br>` +
            `• IP ESP32: ${ESP32_BASE_URL}<br>` +
            `• User ID: ${userId}`
    });
}

function initializeSchedules() {
    const btnOpenCreate = document.getElementById("btnOpenCreateSchedule");
    if (btnOpenCreate) {
        btnOpenCreate.addEventListener("click", () => openModal("createScheduleModal"));
    }

    const btnSaveSchedule = document.getElementById("btnSaveSchedule");
    if (btnSaveSchedule) {
        btnSaveSchedule.addEventListener("click", saveSchedule);
    }

    const btnSaveEdited = document.getElementById("btnSaveEditedSchedule");
    if (btnSaveEdited) {
        btnSaveEdited.addEventListener("click", saveEditedSchedule);
    }

    const btnAssign = document.getElementById("btnAssignSchedule");
    if (btnAssign) {
        btnAssign.addEventListener("click", assignSchedule);
    }
}

async function loadSchedules() {
    try {
        const res = await fetch(`${BASE_URL}/schedules/`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("jwtToken") }
        });

        if (!res.ok) {
            Toast.fire({
                icon: 'error',
                title: 'No se pudieron cargar los horarios'
            });
            return;
        }

        const schedules = await res.json();
        const container = document.getElementById("schedulesContainer");
        if (!container) return;

        container.innerHTML = "";

        schedules.forEach(s => {
            const card = document.createElement("div");
            card.className = "schedule-card";

            card.innerHTML = `
                <h4>${s.nombre}</h4>
                <p><b>Días:</b> ${s.dias}</p>
                <p><b>Entrada:</b> ${s.hora_entrada} (Tol: ${s.tolerancia_entrada}m)</p>
                <p><b>Salida:</b> ${s.hora_salida} (Tol: ${s.tolerancia_salida}m)</p>
                <p><b>Tipo:</b> ${s.tipo}</p>

                <button class="btn small" onclick="openEditSchedule(${s.id}, '${s.nombre}', '${s.dias}', 
                    '${s.tipo}', '${s.hora_entrada}', '${s.tolerancia_entrada}', 
                    '${s.hora_salida}', '${s.tolerancia_salida}')">Editar</button>
                <button class="btn small" onclick="openAssignScheduleModal(${s.id})">Asignar</button>
            `;
            container.appendChild(card);
        });

    } catch (err) {
        console.error(err);
        Toast.fire({
            icon: 'error',
            title: 'Error cargando horarios'
        });
    }
}

async function saveSchedule() {
    const nombre = document.getElementById("schName").value.trim();
    const tipo = document.getElementById("schTipo").value;
    const entrada = document.getElementById("schEntrada").value;
    const salida = document.getElementById("schSalida").value;
    const tolEnt = document.getElementById("schTolEnt").value;
    const tolSal = document.getElementById("schTolSal").value;

    const dias = [...document.querySelectorAll(".sch-day:checked")].map(d => d.value);

    if (!nombre || dias.length === 0 || !entrada || !salida) {
        Toast.fire({
            icon: 'warning',
            title: 'Complete los campos obligatorios'
        });
        return;
    }

    const payload = {
        nombre,
        tipo,
        dias: dias.join(","),
        hora_entrada: entrada,
        hora_salida: salida,
        tolerancia_entrada: tolEnt,
        tolerancia_salida: tolSal
    };

    try {
        const res = await fetch(`${BASE_URL}/schedules/`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            Toast.fire({
                icon: 'error',
                title: data.msg || "Error creando horario"
            });
            return;
        }

        Toast.fire({
            icon: 'success',
            title: 'Horario creado'
        });
        closeModal("createScheduleModal");
        loadSchedules();

    } catch (err) {
        console.error(err);
        Toast.fire({
            icon: 'error',
            title: 'Error en el servidor'
        });
    }
}

function openEditSchedule(id, nombre, dias, tipo, entrada, tolEnt, salida, tolSal) {
    document.getElementById("editScheduleId").value = id;
    document.getElementById("editScheduleName").value = nombre;
    document.getElementById("editScheduleTipo").value = tipo;
    document.getElementById("editScheduleEntrada").value = entrada;
    document.getElementById("editScheduleTolEnt").value = tolEnt;
    document.getElementById("editScheduleSalida").value = salida;
    document.getElementById("editScheduleTolSal").value = tolSal;

    document.querySelectorAll(".edit-sch-day").forEach(chk => {
        chk.checked = dias.includes(chk.value);
    });

    openModal("editScheduleModal");
}

async function saveEditedSchedule() {
    const id = document.getElementById("editScheduleId").value;

    const dias = [...document.querySelectorAll(".edit-sch-day:checked")].map(d => d.value);

    const payload = {
        nombre: document.getElementById("editScheduleName").value,
        tipo: document.getElementById("editScheduleTipo").value,
        dias: dias.join(","),
        hora_entrada: document.getElementById("editScheduleEntrada").value,
        hora_salida: document.getElementById("editScheduleSalida").value,
        tolerancia_entrada: document.getElementById("editScheduleTolEnt").value,
        tolerancia_salida: document.getElementById("editScheduleTolSal").value
    };

    try {
        const res = await fetch(`${BASE_URL}/schedules/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            Toast.fire({
                icon: 'error',
                title: data.msg || "Error actualizando horario"
            });
            return;
        }

        Toast.fire({
            icon: 'success',
            title: 'Horario actualizado'
        });
        closeModal("editScheduleModal");
        loadSchedules();

    } catch (err) {
        console.error(err);
        Toast.fire({
            icon: 'error',
            title: 'Error en el servidor'
        });
    }
}

async function openAssignScheduleModal(scheduleId) {
    document.getElementById("assignScheduleId").value = scheduleId;
    openModal("assignScheduleModal");
    const userSelect = document.getElementById("assignUserSelect");
    if (!userSelect) return;

    userSelect.innerHTML = "<option>Cargando...</option>";

    try {
        const res = await fetch(`${BASE_URL}/users/?page=1&per_page=200`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("jwtToken") }
        });

        const data = await res.json();

        userSelect.innerHTML = "";

        data.users.forEach(u => {
            userSelect.innerHTML += `
                <option value="${u.id}">
                  ${u.nombre} ${u.apellido} (${u.username})
                </option>`;
        });

    } catch (err) {
        console.error(err);
        Toast.fire({
            icon: 'error',
            title: 'Error cargando empleados'
        });
    }
}

async function assignSchedule() {
    const scheduleId = document.getElementById("assignScheduleId").value;
    const userId = document.getElementById("assignUserSelect").value;
    const startDate = document.getElementById("assignStartDate").value;
    const endDate = document.getElementById("assignEndDate").value;

    if (!userId || !scheduleId || !startDate) {
        Toast.fire({
            icon: 'warning',
            title: 'Debe seleccionar empleado y fecha de inicio'
        });
        return;
    }
    const payload = {
        schedule_id: Number(scheduleId),
        user_id: Number(userId),
        start_date: startDate,
        end_date: endDate || null
    };

    try {
        const res = await fetch(`${BASE_URL}/schedules/assign`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            Toast.fire({
                icon: 'error',
                title: data.msg || "Error asignando horario"
            });
            return;
        }

        Toast.fire({
            icon: 'success',
            title: 'Horario asignado correctamente'
        });
        closeModal("assignScheduleModal");

    } catch (err) {
        console.error(err);
        Toast.fire({
            icon: 'error',
            title: 'Error en el servidor'
        });
    }
}
function initializeAttendance() {
    const btnLoadAttendance = document.getElementById("btnLoadAttendance");
    if (btnLoadAttendance) {
        btnLoadAttendance.addEventListener("click", loadAttendanceSummary);
    }
}
async function loadUsersForAttendance() {
    try {
        const res = await fetch(`${BASE_URL}/attendance/admin/users`, {
            method: 'GET',
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("jwtToken"),
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) throw new Error('Error al cargar usuarios');

        const data = await res.json();
        const select = document.getElementById("attendanceUserSelect");
        if (!select) return;

        select.innerHTML = '<option value="">Todos</option>';

        data.users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.nombre} ${user.apellido} (${user.area_trabajo || 'Sin área'})`;
            select.appendChild(option);
        });
    } catch (err) {
        console.error("Error cargando usuarios:", err);
    }
}

async function loadAttendanceSummary() {
    console.log("Cargando reporte de admin...");

    const userId = document.getElementById("attendanceUserSelect").value;
    const start = document.getElementById("attendanceStart").value;
    const end = document.getElementById("attendanceEnd").value;
    const area = document.getElementById("attendanceArea").value;

    const params = new URLSearchParams();
    if (userId) params.append("user_id", userId);
    if (start) params.append("start_date", start);
    if (end) params.append("end_date", end);
    if (area) params.append("area", area);

    const url = `${BASE_URL}/attendance/admin/report?${params}`;

    try {
        const res = await fetch(url, {
            method: 'GET',
            headers: {
                "Authorization": "Bearer " + localStorage.getItem("jwtToken"),
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            const errorTxt = await res.text();
            throw new Error(`Error ${res.status}: ${errorTxt}`);
        }

        const data = await res.json();
        const tbody = document.getElementById("attendanceTableBody");
        if (!tbody) return;

        tbody.innerHTML = "";

        if (!data.asistencias || data.asistencias.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center">No se encontraron registros</td></tr>`;
            return;
        }
        const formatLimaDate = (isoString) => {
            if (!isoString) return "---";
            return new Date(isoString).toLocaleString("es-PE", {
                timeZone: "America/Lima",
                hour12: false
            });
        };
        data.asistencias.forEach(r => {
            const entryStr = formatLimaDate(r.entry_time);
            const exitStr = formatLimaDate(r.exit_time);
            const nombreCompleto = `${r.nombre} ${r.apellido}`;

            tbody.innerHTML += `
                <tr>
                    <td>
                        <strong>${nombreCompleto}</strong><br>
                        <small style="color:gray;">${r.username}</small>
                    </td>
                    <td>${r.area_trabajo || "N/A"}</td>
                    <td>${entryStr}</td>
                    <td>${exitStr}</td>
                    <td>${r.duracion_jornada || "En curso"}</td>
                    <td>
                        <span class="estado-badge estado-${r.estado_entrada}">
                            ${r.estado_entrada}
                        </span>
                    </td>
                </tr>
            `;
        });

    } catch (err) {
        console.error("Error al cargar asistencias:", err);
        alert("Error generando resumen: " + err.message);
    }
}
document.addEventListener("DOMContentLoaded", function () {
    const savedIP = localStorage.getItem('esp32_ip');
    if (savedIP) {
        ESP32_BASE_URL = `http://${savedIP}`;
        const currentIpElement = document.getElementById('current-ip');
        if (currentIpElement) {
            currentIpElement.textContent = savedIP;
        }
    }

    initializeNavigation();
    initializeEmployeeRegistration();
    initializeSchedules();
    initializeAttendance();
    loadUsersForAttendance();
    loadAttendanceSummary();
    setInterval(updateESP32Status, 30000);
    if (document.getElementById("section-admin-registration") && 
        document.getElementById("section-admin-registration").style.display === "block") {
        loadAdminInfo();
    }

    console.log("Dashboard Admin inicializado correctamente");
});