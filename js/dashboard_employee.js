// js/dashboard_employee.js
// Dashboard de Empleado - Integrado con backend real

(() => {
  const API_BASE = 'https://asistencia-iot-api.onrender.com';
  let currentUser = null;

  // Mostrar/ocultar secciones
  function showSection(id) {
    const sections = document.querySelectorAll('.pane');
    sections.forEach(s => s.style.display = 'none');
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  }

  // Convertir UTC a hora de Lima (UTC-5)
  function convertUTCToLima(utcDateString) {
    if (!utcDateString) return null;
    
    try {
      const utcDate = new Date(utcDateString);
      
      // Lima está en UTC-5
      const limaOffset = -5 * 60; // UTC-5 en minutos
      const localOffset = utcDate.getTimezoneOffset(); // Offset local del navegador
      
      // Ajustar la fecha a hora de Lima
      const limaTime = new Date(utcDate.getTime() + (localOffset * 60 * 1000) + (limaOffset * 60 * 1000));
      
      return limaTime;
    } catch (error) {
      console.error('Error convirtiendo fecha:', error);
      return null;
    }
  }

  // Formatear fecha para display (hora de Lima)
  function formatDate(dateString) {
    if (!dateString) return '—';
    const date = convertUTCToLima(dateString);
    if (!date) return '—';
    return date.toLocaleDateString('es-ES', {
      timeZone: 'America/Lima'
    });
  }

  // Formatear hora para display (hora de Lima)
  function formatTime(dateString) {
    if (!dateString) return '—';
    const date = convertUTCToLima(dateString);
    if (!date) return '—';
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: 'America/Lima'
    });
  }

  // Obtener token JWT
  function getToken() {
    return localStorage.getItem('jwtToken');
  }

  // Verificar autenticación
  function checkAuth() {
    const token = getToken();
    const user = localStorage.getItem('user');
    
    console.log('Verificando autenticación:', { 
      token: token ? 'Presente' : 'Falta',
      user: user ? 'Presente' : 'Falta'
    });
    
    if (!token || !user) {
      console.log('No autenticado, redirigiendo a login');
      window.location.href = '../pages/login.html';
      return false;
    }
    
    try {
      currentUser = JSON.parse(user);
      updateUserInfo();
      return true;
    } catch (error) {
      console.error('Error parseando usuario:', error);
      window.location.href = '../pages/login.html';
      return false;
    }
  }

  // Actualizar información del usuario en la UI
  function updateUserInfo() {
    if (!currentUser) return;
    
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    const userRoleEl = document.getElementById('userRole');
    
    if (userNameEl && currentUser.nombre) {
      userNameEl.textContent = `${currentUser.nombre} ${currentUser.apellido || ''}`.trim();
    }
    
    if (userAvatarEl && currentUser.nombre) {
      const initials = (currentUser.nombre.charAt(0) + (currentUser.apellido ? currentUser.apellido.charAt(0) : '')).toUpperCase();
      userAvatarEl.textContent = initials;
    }
    
    if (userRoleEl) {
      userRoleEl.textContent = currentUser.role === 'admin' ? 'Administrador' : 'Empleado';
    }
  }

  // Fetch con autenticación
  async function fetchWithAuth(url, options = {}) {
    if (!checkAuth()) throw new Error('No autenticado');

    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    };

    console.log(`Haciendo request a: ${API_BASE}${url}`);

    try {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
      });

      console.log(`Response status: ${response.status}`);

      if (response.status === 401) {
        // Token expirado o inválido
        localStorage.removeItem('jwtToken');
        localStorage.removeItem('user');
        window.location.href = '../pages/login.html';
        throw new Error('Sesión expirada');
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Error ${response.status}:`, errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);
      return data;
    } catch (error) {
      console.error('Error en fetch:', error);
      throw error;
    }
  }

  // Cargar asistencias del usuario - Versión mejorada con manejo de errores
  async function loadAttendances(startDate = null, endDate = null) {
    const loadingEl = document.getElementById('loadingAttendances');
    const noDataEl = document.getElementById('noAttendances');
    const tbody = document.querySelector('#myAttendancesTable tbody');

    if (!loadingEl || !noDataEl || !tbody) {
      console.error('Elementos del DOM no encontrados');
      return;
    }

    // Mostrar loading
    loadingEl.style.display = 'block';
    noDataEl.style.display = 'none';
    tbody.innerHTML = '';

    try {
      // Intentar diferentes endpoints posibles
      let attendances = [];
      let url = '/attendance/history';
      
      const params = new URLSearchParams();
      params.append('per_page', '50');
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      console.log('Cargando asistencias desde:', url);
      
      const data = await fetchWithAuth(url);
      
      // Manejar diferentes estructuras de respuesta
      if (Array.isArray(data)) {
        attendances = data;
      } else if (data.items && Array.isArray(data.items)) {
        attendances = data.items;
      } else if (data.data && Array.isArray(data.data)) {
        attendances = data.data;
      } else if (data.attendances && Array.isArray(data.attendances)) {
        attendances = data.attendances;
      } else {
        console.warn('Estructura de datos inesperada:', data);
        attendances = [];
      }
      
      loadingEl.style.display = 'none';

      if (attendances.length === 0) {
        noDataEl.style.display = 'block';
        return;
      }

      console.log(`Mostrando ${attendances.length} asistencias`);

      // Renderizar tabla
      attendances.forEach(attendance => {
        const tr = document.createElement('tr');
        
        const entryDate = attendance.entry_time ? convertUTCToLima(attendance.entry_time) : null;
        const exitDate = attendance.exit_time ? convertUTCToLima(attendance.exit_time) : null;
        
        // Calcular duración si hay entrada y salida
        let duracion = '—';
        if (entryDate && exitDate) {
          const durationMs = exitDate - entryDate;
          const hours = Math.floor(durationMs / (1000 * 60 * 60));
          const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
          duracion = `${hours}h ${minutes}m`;
        }
        
        // Determinar estado
        const estado = attendance.estado_entrada || attendance.status || '—';
        
        tr.innerHTML = `
          <td>${entryDate ? entryDate.toLocaleDateString('es-ES', { timeZone: 'America/Lima' }) : '—'}</td>
          <td>${entryDate ? entryDate.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'America/Lima'
          }) : '—'}</td>
          <td>${exitDate ? exitDate.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit',
            timeZone: 'America/Lima'
          }) : '—'}</td>
          <td>
            <span class="status-badge ${getStatusClass(estado)}">
              ${getStatusText(estado)}
            </span>
          </td>
          <td>${duracion}</td>
        `;
        tbody.appendChild(tr);
      });

    } catch (error) {
      loadingEl.style.display = 'none';
      console.error('Error cargando asistencias:', error);
      
      // Mostrar mensaje de error en la tabla
      noDataEl.innerHTML = `
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
        <p>Error al cargar las asistencias</p>
        <p style="font-size: 0.9rem; margin-top: 10px; color: #7f8c8d;">
          ${error.message}
        </p>
        <button onclick="loadAttendances()" class="btn primary" style="margin-top: 10px;">
          <i class="fas fa-redo"></i> Reintentar
        </button>
      `;
      noDataEl.style.display = 'block';
    }
  }

  // Clase CSS para estados
  function getStatusClass(status) {
    if (!status) return 'status-default';
    
    const statusMap = {
      'presente': 'status-present',
      'a_tiempo': 'status-present',
      'tarde': 'status-late',
      'late': 'status-late',
      'sin_horario': 'status-no-schedule',
      'no_schedule': 'status-no-schedule',
      'fuera_de_horario': 'status-outside',
      'outside_schedule': 'status-outside',
      'absent': 'status-outside'
    };
    return statusMap[status.toLowerCase()] || 'status-default';
  }

  // Texto para estados
  function getStatusText(status) {
    if (!status) return '—';
    
    const textMap = {
      'presente': 'A tiempo',
      'a_tiempo': 'A tiempo',
      'tarde': 'Tardanza',
      'late': 'Tardanza',
      'sin_horario': 'Sin horario',
      'no_schedule': 'Sin horario',
      'fuera_de_horario': 'Fuera de horario',
      'outside_schedule': 'Fuera de horario',
      'absent': 'Ausente'
    };
    return textMap[status.toLowerCase()] || status || '—';
  }

  // Cargar horario del usuario - Versión mejorada
  async function loadSchedule() {
    const loadingEl = document.getElementById('loadingSchedule');
    const noDataEl = document.getElementById('noSchedule');
    const scheduleCard = document.getElementById('myScheduleCard');

    if (!loadingEl || !noDataEl || !scheduleCard) {
      console.error('Elementos del DOM no encontrados');
      return;
    }

    loadingEl.style.display = 'block';
    noDataEl.style.display = 'none';
    scheduleCard.style.display = 'none';
    scheduleCard.innerHTML = '';

    try {
      // Intentar diferentes endpoints posibles
      let schedules = [];
      
      try {
        const data = await fetchWithAuth('/schedules/my');
        schedules = Array.isArray(data) ? data : (data.items || data.data || []);
      } catch (error) {
        console.log('Endpoint /schedules/my falló, intentando alternativas...');
        // Intentar otro endpoint si el primero falla
        try {
          const data = await fetchWithAuth('/schedule/current');
          schedules = Array.isArray(data) ? data : [data].filter(Boolean);
        } catch (secondError) {
          console.log('Todos los endpoints de horario fallaron');
          throw new Error('No se pudo cargar el horario');
        }
      }
      
      loadingEl.style.display = 'none';

      if (!schedules || schedules.length === 0) {
        noDataEl.style.display = 'block';
        return;
      }

      // Tomar el primer horario (podrías filtrar por fecha actual)
      const currentSchedule = schedules[0];
      
      // Formatear los días para mejor visualización
      let diasFormateados = 'No especificado';
      if (currentSchedule.dias) {
        diasFormateados = currentSchedule.dias.split(',').map(dia => {
          const diasCompletos = {
            'Lun': 'Lunes',
            'Mar': 'Martes',
            'Mie': 'Miércoles',
            'Mier': 'Miércoles',
            'Jue': 'Jueves',
            'Vie': 'Viernes',
            'Sab': 'Sábado',
            'Dom': 'Domingo',
            'Mon': 'Lunes',
            'Tue': 'Martes',
            'Wed': 'Miércoles',
            'Thu': 'Jueves',
            'Fri': 'Viernes',
            'Sat': 'Sábado',
            'Sun': 'Domingo'
          };
          return diasCompletos[dia.trim()] || dia.trim();
        }).join(', ');
      }

      scheduleCard.innerHTML = `
        <div class="schedule-card">
          <h3>${currentSchedule.nombre || 'Horario asignado'}</h3>
          <div class="schedule-details">
            ${currentSchedule.hora_entrada ? `
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-clock"></i> Horario:</span>
              <span class="schedule-value">${currentSchedule.hora_entrada} - ${currentSchedule.hora_salida || 'No definido'} (Hora Lima)</span>
            </div>
            ` : ''}
            ${currentSchedule.dias ? `
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-calendar-day"></i> Días:</span>
              <span class="schedule-value">${diasFormateados}</span>
            </div>
            ` : ''}
            ${currentSchedule.tolerancia_entrada ? `
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-user-clock"></i> Tolerancia entrada:</span>
              <span class="schedule-value">${currentSchedule.tolerancia_entrada} minutos</span>
            </div>
            ` : ''}
            ${currentSchedule.tolerancia_salida ? `
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-user-clock"></i> Tolerancia salida:</span>
              <span class="schedule-value">${currentSchedule.tolerancia_salida} minutos</span>
            </div>
            ` : ''}
            ${currentSchedule.tipo ? `
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-tag"></i> Tipo:</span>
              <span class="schedule-value">${currentSchedule.tipo === 'fijo' ? 'Horario Fijo' : 'Horario Rotativo'}</span>
            </div>
            ` : ''}
            ${currentSchedule.start_date ? `
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-calendar-check"></i> Vigente desde:</span>
              <span class="schedule-value">${formatDate(currentSchedule.start_date)}</span>
            </div>
            ` : ''}
            ${currentSchedule.end_date ? `
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-calendar-times"></i> Hasta:</span>
              <span class="schedule-value">${formatDate(currentSchedule.end_date)}</span>
            </div>
            ` : ''}
          </div>
          <div style="margin-top: 15px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px; font-size: 0.85rem;">
            <i class="fas fa-info-circle"></i> Todas las horas mostradas están en horario de Lima (UTC-5)
          </div>
        </div>
      `;
      scheduleCard.style.display = 'block';

    } catch (error) {
      loadingEl.style.display = 'none';
      noDataEl.style.display = 'block';
      console.error('Error cargando horario:', error);
      
      noDataEl.innerHTML = `
        <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
        <p>Error al cargar el horario</p>
        <p style="font-size: 0.9rem; margin-top: 10px; color: #7f8c8d;">
          ${error.message}
        </p>
        <button onclick="loadSchedule()" class="btn primary" style="margin-top: 10px;">
          <i class="fas fa-redo"></i> Reintentar
        </button>
      `;
    }
  }

  // Configurar filtros
  function setupFilters() {
    const filterBtn = document.getElementById('filterBtn');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

    if (!filterBtn || !clearFilterBtn || !startDateInput || !endDateInput) {
      console.error('Elementos de filtro no encontrados');
      return;
    }

    // Establecer fechas por defecto (últimos 30 días)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    startDateInput.value = startDate.toISOString().split('T')[0];
    endDateInput.value = endDate.toISOString().split('T')[0];

    filterBtn.addEventListener('click', () => {
      const startDate = startDateInput.value;
      const endDate = endDateInput.value;

      if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        alert('La fecha inicial no puede ser mayor que la fecha final');
        return;
      }

      loadAttendances(startDate, endDate);
    });

    clearFilterBtn.addEventListener('click', () => {
      // Restablecer a últimos 30 días
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      startDateInput.value = startDate.toISOString().split('T')[0];
      endDateInput.value = endDate.toISOString().split('T')[0];
      
      loadAttendances(startDateInput.value, endDateInput.value);
    });
  }

  // Cerrar sesión
  function logout() {
    localStorage.removeItem('jwtToken');
    localStorage.removeItem('user');
    window.location.href = '../pages/login.html';
  }

  // Conectar eventos
  function wireEvents() {
    const btnAttendances = document.getElementById('nav-my-attendances');
    const btnSchedule = document.getElementById('nav-my-schedule');
    const logoutBtn = document.getElementById('logoutBtn');

    if (btnAttendances) {
      btnAttendances.addEventListener('click', () => {
        showSection('section-my-attendances');
        loadAttendances();
      });
    }

    if (btnSchedule) {
      btnSchedule.addEventListener('click', () => {
        showSection('section-my-schedule');
        loadSchedule();
      });
    }

    if (logoutBtn) {
      logoutBtn.addEventListener('click', logout);
    }
  }

  // Mostrar hora actual de Lima
  function updateLimaTime() {
    try {
      const now = new Date();
      const limaTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Lima"}));
      
      // Actualizar en el header si existe el elemento
      const limaTimeElement = document.getElementById('limaTime');
      if (limaTimeElement) {
        limaTimeElement.textContent = `Hora Lima: ${limaTime.toLocaleTimeString('es-ES', { 
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        })}`;
      }
    } catch (error) {
      console.error('Error actualizando hora Lima:', error);
    }
  }

  // Inicializar
  async function init() {
    console.log('Inicializando dashboard empleado...');
    
    if (!checkAuth()) {
      console.log('Usuario no autenticado');
      return;
    }

    try {
      wireEvents();
      setupFilters();
      
      // Actualizar hora de Lima cada segundo
      setInterval(updateLimaTime, 1000);
      updateLimaTime();
      
      // Cargar sección por defecto
      showSection('section-my-attendances');
      await loadAttendances();
      
      console.log('Dashboard inicializado correctamente');
      
    } catch (error) {
      console.error('Error inicializando dashboard:', error);
      alert('Error al inicializar el dashboard: ' + error.message);
    }
  }

  // Hacer funciones globales para los botones de reintento
  window.loadAttendances = loadAttendances;
  window.loadSchedule = loadSchedule;

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
