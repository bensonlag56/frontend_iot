/*************************************
 * CONFIGURACIÓN GLOBAL
 *************************************/
const BASE_URL = "https://asistencia-iot-api.onrender.com";
let ESP32_BASE_URL = '10.139.102.152'; // IP por defecto

// Configuración de Toast (SweetAlert2)
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

/*************************************
 * UTILIDADES
 *************************************/
function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "flex";
}

function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.style.display = "none";
}

function showSection(id) {
    // Ocultar todas las secciones
    document.querySelectorAll(".pane").forEach(p => {
        p.style.display = "none";
    });

    // Mostrar la sección solicitada
    const section = document.getElementById(id);
    if (section) {
        section.style.display = "block";
    }

    // Ejecutar acciones específicas de cada sección
    if (id === "section-list-employees") {
        loadEmployees();
    } else if (id === "section-schedules") {
        loadSchedules();
    } else if (id === "section-esp32-control") {
        updateESP32Status();
    } else if (id === "section-admin-attendances") {
        loadUsersForAttendance();
        loadAttendanceSummary();
    }
}

/*************************************
 * INICIALIZACIÓN DE NAVEGACIÓN
 *************************************/
function initializeNavigation() {
    // Registrar empleado
    const navRegister = document.getElementById("nav-register-employee");
    if (navRegister) {
        navRegister.addEventListener("click", () => showSection("section-register-employee"));
    }

    // Lista de empleados
    const navList = document.getElementById("nav-list-employees");
    if (navList) {
        navList.addEventListener("click", () => {
            showSection("section-list-employees");
            loadEmployees();
        });
    }

    // Horarios
    const navSchedules = document.getElementById("nav-schedules");
    if (navSchedules) {
        navSchedules.addEventListener("click", () => {
            showSection("section-schedules");
            loadSchedules();
        });
    }

    // Asistencias
    const navAttendances = document.getElementById("nav-attendances");
    if (navAttendances) {
        navAttendances.addEventListener("click", () => showSection("section-admin-attendances"));
    }

    // Control ESP32 (ya configurado en HTML)

    // Logout
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", () => {
            localStorage.clear();
            window.location.href = "../pages/login.html";
        });
    }
}

/*************************************
 * REGISTRAR EMPLEADO
 *************************************/
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
        // Limpiar formulario
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

/*************************************
 * LISTAR EMPLEADOS
 *************************************/
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

        data.users.forEach(u => {
            const tr = document.createElement("tr");
            tr.innerHTML = `
                <td>${u.id}</td>
                <td>${u.username}</td>
                <td>${u.nombre}</td>
                <td>${u.apellido}</td>
                <td>${u.role}</td>
                <td>${u.area_trabajo || "-"}</td>
                <td>${u.huella_id || "-"}</td>
                <td>${u.rfid || "-"}</td>
                <td>
                    <button class="btn small btn-fingerprint" onclick="registerFingerprint(${u.id})">
                         Registrar huella
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        Toast.fire({
            icon: 'error',
            title: 'Error cargando usuarios'
        });
    }
}

/*************************************
 * FUNCIONES ESP32
 *************************************/

// Configurar IP del ESP32
function configureESP32IP() {
    const currentIP = localStorage.getItem('esp32_ip') || '10.139.102.152';
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
                title: 'Formato de IP inválido. Ejemplo: 10.139.102.152'
            });
        }
    }
}

// Verificar estado del ESP32
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

// Actualizar estado en la interfaz
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

// Probar conexión al ESP32
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

// Función para enviar comando al ESP32
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

// Función para registrar huella
async function registerFingerprint(userId) {
    try {
        console.log("Iniciando registro de huella para usuario:", userId);

        // 1. Obtener un ID de huella del backend
        const assignResponse = await fetch(`${BASE_URL}/users/huella/assign-id`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("jwtToken")
            },
            body: JSON.stringify({ user_id: userId })
        });

        if (!assignResponse.ok) {
            throw new Error('Error del servidor al asignar ID');
        }

        const assignData = await assignResponse.json();

        if (!assignData.success) {
            Toast.fire({
                icon: 'error',
                title: "Error asignando ID de huella: " + assignData.message
            });
            return;
        }

        const huellaId = assignData.huella_id;

        // 2. Mostrar confirmación al usuario
        const userConfirmation = confirm(
            ` REGISTRO DE HUELLA\n\n` +
            `ID Asignado: ${huellaId}\n` +
            `Usuario ID: ${userId}\n\n` +
            `El sistema ESP32 se activará en modo registro.\n` +
            `Diríjase al dispositivo y siga las instrucciones\n` +
            `en la pantalla.\n\n` +
            `¿Continuar con el registro?`
        );

        if (!userConfirmation) {
            return;
        }

        // 3. Enviar comando al ESP32
        await sendCommandToESP32(huellaId);

        Swal.fire({
            icon: 'success',
            title: 'COMANDO ENVIADO EXITOSAMENTE',
            html: 'El dispositivo ESP32 ha sido activado en modo registro.<br><br>' +
                'Por favor:<br>' +
                '1. Diríjase al dispositivo físico<br>' +
                '2. Siga las instrucciones en la pantalla<br>' +
                '3. Complete el registro de su huella<br><br>' +
                'El sistema confirmará automáticamente cuando termine.'
        });

    } catch (err) {
        console.error('Error en registro de huella:', err);
        showManualInstructions(userId, err.message);
    }
}

// Función de fallback para instrucciones manuales
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

/*************************************
 * HORARIOS
 *************************************/
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

    // CARGAR EMPLEADOS EN SELECT
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

/*************************************
 * ASISTENCIAS
 *************************************/
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

        // Mantener la opción "Todos"
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

/*************************************
 * INICIALIZACIÓN COMPLETA
 *************************************/
document.addEventListener("DOMContentLoaded", function () {
    console.log(" Inicializando Dashboard Admin...");

    // 1. Configurar IP inicial del ESP32
    const savedIP = localStorage.getItem('esp32_ip');
    if (savedIP) {
        ESP32_BASE_URL = `http://${savedIP}`;
        const currentIpElement = document.getElementById('current-ip');
        if (currentIpElement) {
            currentIpElement.textContent = savedIP;
        }
    }

    // 2. Inicializar todas las funcionalidades
    initializeNavigation();
    initializeEmployeeRegistration();
    initializeSchedules();
    initializeAttendance();

    // 3. Cargar datos iniciales
    loadUsersForAttendance();
    loadAttendanceSummary();

    // 4. Actualizar estado ESP32 cada 30 segundos
    setInterval(updateESP32Status, 30000);

    console.log("Dashboard Admin inicializado correctamente");
});
