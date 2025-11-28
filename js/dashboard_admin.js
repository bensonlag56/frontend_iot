/*************************************
 * CONFIG
 *************************************/
const BASE_URL = "https://asistencia-iot-api.onrender.com";

/*************************************
 * UTILIDADES
 *************************************/
function openModal(id) {
    document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
    document.getElementById(id).style.display = "none";
}

/*************************************
 * NAV SECTIONS
 *************************************/
function showSection(id) {
    document.querySelectorAll(".pane").forEach(p => p.style.display = "none");
    document.getElementById(id).style.display = "block";
}

document.getElementById("nav-register-employee").onclick = () => showSection("section-register-employee");
document.getElementById("nav-list-employees").onclick = () => {
    showSection("section-list-employees");
    loadEmployees();
};
document.getElementById("nav-schedules").onclick = () => {
    showSection("section-schedules");
    loadSchedules();
};
document.getElementById("nav-attendances").onclick = () => showSection("section-admin-attendances");

/*************************************
 * LOGOUT
 *************************************/
document.getElementById("logoutBtn").onclick = () => {
    localStorage.clear();
    window.location.href = "../pages/login.html";
};

/*************************************
 * REGISTRAR EMPLEADO
 *************************************/
document.getElementById("btn-save-employee").addEventListener("click", registerEmployee);

async function registerEmployee() {
    const nombre = empName.value.trim();
    const apellido = empLastName.value.trim();
    const username = empUsername.value.trim();
    const password = empPassword.value.trim();
    const genero = empGenero.value.trim();
    const fecha_nacimiento = empDOB.value;
    const fecha_contrato = empHireDate.value;
    const area_trabajo = emprea.value.trim();

    if (!nombre || !apellido || !username || !password) {
        alert("Complete todos los campos obligatorios");
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
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.msg || "Error al registrar empleado");
            return;
        }

        alert("Empleado registrado correctamente");
        loadEmployees();

    } catch (err) {
        alert("Error en el servidor");
        console.error(err);
    }
}

/*************************************
 * LISTAR EMPLEADOS
 *************************************/
async function loadEmployees() {
    try {
        const res = await fetch(`${BASE_URL}/users/?page=1&per_page=50`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
        });

        if (!res.ok) {
            alert("No se pudo cargar la lista de usuarios");
            return;
        }

        const data = await res.json();
        const tbody = document.getElementById("employeesTableBody");
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
                <td><button class="btn small" onclick="registerFingerprint(${u.id})">Registrar huella</button></td>
            `;
            tbody.appendChild(tr);
        });

    } catch (err) {
        console.error(err);
        alert("Error cargando usuarios");
    }
}

/*************************************
 * REGISTRAR HUELLA (SIMULADO)
 *************************************/
// Función mejorada para registrar huella
async function registerFingerprint(userId) {
    try {
        // 1. Obtener un ID de huella del backend
        const assignResponse = await fetch(`${BASE_URL}/users/huella/assign-id`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify({ user_id: userId })
        });

        const assignData = await assignResponse.json();
        
        if (!assignData.success) {
            alert("Error asignando ID de huella: " + assignData.message);
            return;
        }

        const huellaId = assignData.huella_id;
        
        // 2. Mostrar información al usuario
        const userConfirmation = confirm(
            `ID de Huella Asignado: ${huellaId}\n\n` +
            `1. El sistema ESP32 se pondrá en modo registro\n` +
            `2. Siga las instrucciones en la pantalla del dispositivo\n` +
            `3. Registre su huella cuando se lo solicite\n\n` +
            `¿Continuar con el registro?`
        );
        
        if (!userConfirmation) {
            return;
        }

        // 3. Intentar conectar via HTTP (más confiable que WebSocket)
        await sendCommandToESP32(huellaId);
        
    } catch (err) {
        alert("Error en el proceso de registro: " + err.message);
        console.error(err);
    }
}

// Función para enviar comando al ESP32
async function sendCommandToESP32(huellaId) {
    try {
        // Obtener la IP del ESP32 (podrías tener un campo de configuración)
        const esp32IP = localStorage.getItem('esp32_ip') || '192.168.1.100';
        
        const response = await fetch(`http://${esp32IP}/command`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                command: 'REGISTER_FINGERPRINT',
                huella_id: huellaId,
                timestamp: Date.now()
            })
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.status === 'success') {
            alert('✅ Dispositivo ESP32 notificado\n\n' +
                  'Por favor, diríjase al dispositivo y siga las instrucciones ' +
                  'en la pantalla para completar el registro de su huella.');
        } else {
            throw new Error(data.message || 'Error en la respuesta del ESP32');
        }
        
    } catch (error) {
        console.error('Error conectando al ESP32:', error);
        
        // Fallback: Mostrar instrucciones manuales
        alert(
            '⚠️ No se pudo conectar automáticamente al ESP32\n\n' +
            'Instrucciones manuales:\n' +
            '1. Vaya al dispositivo ESP32\n' +
            '2. En el menú, seleccione la opción 1 (Registrar Huella)\n' +
            '3. El sistema le asignará automáticamente el ID: ' + huellaId + '\n' +
            '4. Siga las instrucciones en pantalla\n\n' +
            'Nota: Configure la IP del ESP32 en la configuración del sistema.'
        );
    }
}

// Función para configurar la IP del ESP32
function configureESP32IP() {
    const currentIP = localStorage.getItem('esp32_ip') || '192.168.1.100';
    const newIP = prompt('Ingrese la IP del dispositivo ESP32:', currentIP);
    
    if (newIP) {
        localStorage.setItem('esp32_ip', newIP);
        alert('IP del ESP32 configurada: ' + newIP);
    }
}

// Agregar botón de configuración en tu HTML o interfaz

/*************************************
 * HORARIOS - LISTAR
 *************************************/
async function loadSchedules() {
    try {
        const res = await fetch(`${BASE_URL}/schedules/`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
        });

        if (!res.ok) {
            alert("No se pudieron cargar los horarios");
            return;
        }

        const schedules = await res.json();
        const container = document.getElementById("schedulesContainer");
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
        alert("Error cargando horarios");
    }
}

/*************************************
 * HORARIOS - MODAL CREAR
 *************************************/
document.getElementById("btnOpenCreateSchedule").onclick = () => openModal("createScheduleModal");

document.getElementById("btnSaveSchedule").onclick = async () => {
    const nombre = schName.value.trim();
    const tipo = schTipo.value;
    const entrada = schEntrada.value;
    const salida = schSalida.value;
    const tolEnt = schTolEnt.value;
    const tolSal = schTolSal.value;

    const dias = [...document.querySelectorAll(".sch-day:checked")].map(d => d.value);

    if (!nombre || dias.length === 0 || !entrada || !salida) {
        alert("Complete los campos obligatorios");
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
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.msg || "Error creando horario");
            return;
        }

        alert("Horario creado");
        closeModal("createScheduleModal");
        loadSchedules();

    } catch (err) {
        console.error(err);
        alert("Error en el servidor");
    }
};

/*************************************
 * HORARIOS - EDITAR
 *************************************/
function openEditSchedule(id, nombre, dias, tipo, entrada, tolEnt, salida, tolSal) {
    document.getElementById("editScheduleId").value = id;
    editScheduleName.value = nombre;
    editScheduleTipo.value = tipo;
    editScheduleEntrada.value = entrada;
    editScheduleTolEnt.value = tolEnt;
    editScheduleSalida.value = salida;
    editScheduleTolSal.value = tolSal;

    document.querySelectorAll(".edit-sch-day").forEach(chk => {
        chk.checked = dias.includes(chk.value);
    });

    openModal("editScheduleModal");
}

document.getElementById("btnSaveEditedSchedule").onclick = async () => {
    const id = editScheduleId.value;

    const dias = [...document.querySelectorAll(".edit-sch-day:checked")].map(d => d.value);

    const payload = {
        nombre: editScheduleName.value,
        tipo: editScheduleTipo.value,
        dias: dias.join(","),
        hora_entrada: editScheduleEntrada.value,
        hora_salida: editScheduleSalida.value,
        tolerancia_entrada: editScheduleTolEnt.value,
        tolerancia_salida: editScheduleTolSal.value
    };

    try {
        const res = await fetch(`${BASE_URL}/schedules/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) {
            alert(data.msg || "Error actualizando horario");
            return;
        }

        alert("Horario actualizado");
        closeModal("editScheduleModal");
        loadSchedules();

    } catch (err) {
        console.error(err);
        alert("Error en el servidor");
    }
}

/*************************************
 * ABRIR MODAL PARA ASIGNAR HORARIO
 *************************************/
async function openAssignScheduleModal(scheduleId) {
    document.getElementById("assignScheduleId").value = scheduleId;
    openModal("assignScheduleModal");

    // CARGAR EMPLEADOS EN SELECT
    const userSelect = document.getElementById("assignUserSelect");
    userSelect.innerHTML = "<option>Cargando...</option>";

    try {
        const res = await fetch(`${BASE_URL}/users/?page=1&per_page=200`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
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
        alert("Error cargando empleados");
    }
}

/*************************************
 * ASIGNAR HORARIO
 *************************************/
document.getElementById("btnAssignSchedule").onclick = assignSchedule;

async function assignSchedule() {
    const scheduleId = document.getElementById("assignScheduleId").value;
    const userId = document.getElementById("assignUserSelect").value;
    const startDate = document.getElementById("assignStartDate").value;
    const endDate = document.getElementById("assignEndDate").value;

    if (!userId || !scheduleId || !startDate) {
        alert("Debe seleccionar empleado y fecha de inicio");
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
                "Authorization": "Bearer " + localStorage.getItem("token")
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.msg || "Error asignando horario");
            return;
        }

        alert("Horario asignado correctamente");
        closeModal("assignScheduleModal");

    } catch (err) {
        console.error(err);
        alert("Error en el servidor");
    }
}

/*************************************
 * CARGAR EMPLEADOS EN SELECT (ASISTENCIAS)
 *************************************/
async function loadAttendanceUsers() {
    const select = document.getElementById("attendanceUserSelect");
    select.innerHTML = "<option value=''>Todos</option>";

    try {
        const res = await fetch(`${BASE_URL}/users/?page=1&per_page=200`, {
            headers: { "Authorization": "Bearer " + localStorage.getItem("token") }
        });

        const data = await res.json();

        data.users.forEach(u => {
            select.innerHTML += `
                <option value="${u.id}">
                    ${u.nombre} ${u.apellido} (${u.username})
                </option>`;
        });
    } catch (err) {
        console.error(err);
        alert("Error cargando usuarios para asistencias");
    }
}

async function loadUsersForAttendance() {
    try {
        const res = await fetch(`${BASE_URL}/attendance/admin/users`, {
            method: 'GET',
            headers: { 
                "Authorization": "Bearer " + localStorage.getItem("token"),
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) throw new Error('Error al cargar usuarios');
        
        const data = await res.json();
        const select = document.getElementById("attendanceUserSelect");
        
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
                "Authorization": "Bearer " + localStorage.getItem("token"),
                "Content-Type": "application/json"
            }
        });

        if (!res.ok) {
            const errorTxt = await res.text();
            throw new Error(`Error ${res.status}: ${errorTxt}`);
        }

        const data = await res.json();
        const tbody = document.getElementById("attendanceTableBody");
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

window.addEventListener("DOMContentLoaded", () => {
    loadUsersForAttendance();
    loadAttendanceSummary(); 
    document.getElementById("btnLoadAttendance").addEventListener("click", loadAttendanceSummary);
});


document.getElementById("btnExportAttendance").onclick = () => {
    const userId = document.getElementById("attendanceUserSelect").value;
    const start = document.getElementById("attendanceStart").value;
    const end = document.getElementById("attendanceEnd").value;
    const mode = document.getElementById("attendanceMode").value;

    let url = `${BASE_URL}/attendance/summary/export/csv?mode=${mode}`;

    if (userId) url += `&user_id=${userId}`;
    if (start) url += `&start_date=${start}`;
    if (end) url += `&end_date=${end}`;

    window.open(url, "_blank");
};

/*************************************
 * Hook al cambiar de sección
 *************************************/
function showSection(id) {
    document.querySelectorAll(".pane").forEach(p => p.style.display = "none");
    document.getElementById(id).style.display = "block";

    if (id === "section-attendance") {
        loadAttendanceUsers();
    }
};