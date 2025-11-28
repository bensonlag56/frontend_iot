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
    
    const utcDate = new Date(utcDateString);
    
    // Lima está en UTC-5, pero durante horario de verano puede ser UTC-4
    // Para simplificar, usaremos UTC-5 que es la mayoría del año
    const limaOffset = -5 * 60; // UTC-5 en minutos
    const localOffset = utcDate.getTimezoneOffset(); // Offset local del navegador
    
    // Ajustar la fecha a hora de Lima
    const limaTime = new Date(utcDate.getTime() + (localOffset * 60 * 1000) + (limaOffset * 60 * 1000));
    
    return limaTime;
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

  // Formatear fecha y hora completas (hora de Lima)
  function formatDateTime(dateString) {
    if (!dateString) return '—';
    const date = convertUTCToLima(dateString);
    if (!date) return '—';
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
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
    if (!token) {
      window.location.href = '../pages/login.html';
      return false;
    }
    return true;
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

    try {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
      });

      if (response.status === 401) {
        // Token expirado o inválido
        localStorage.removeItem('jwtToken');
        window.location.href = '../pages/login.html';
        throw new Error('Sesión expirada');
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error en fetch:', error);
      throw error;
    }
  }

  // Cargar asistencias del usuario
  async function loadAttendances(startDate = null, endDate = null) {
    const loadingEl = document.getElementById('loadingAttendances');
    const noDataEl = document.getElementById('noAttendances');
    const tbody = document.querySelector('#myAttendancesTable tbody');

    // Mostrar loading
    loadingEl.style.display = 'block';
    noDataEl.style.display = 'none';
    tbody.innerHTML = '';

    try {
      // Usar el endpoint correcto: /attendance/history
      let url = '/attendance/history';
      
      // El endpoint /history usa paginación, así que podemos pedir más items
      const params = new URLSearchParams();
      params.append('per_page', '100'); // Pedir más registros
      
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const data = await fetchWithAuth(url);
      
      loadingEl.style.display = 'none';

      // El endpoint /history devuelve {items: [], page: X, total: Y}
      const attendances = data.items || [];
      
      if (attendances.length === 0) {
        noDataEl.style.display = 'block';
        return;
      }

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
            <span class="status-badge ${getStatusClass(attendance.estado_entrada)}">
              ${getStatusText(attendance.estado_entrada)}
            </span>
          </td>
          <td>${duracion}</td>
        `;
        tbody.appendChild(tr);
      });

    } catch (error) {
      loadingEl.style.display = 'none';
      console.error('Error cargando asistencias:', error);
      
      // Mostrar mensaje más específico
      if (error.message.includes('404')) {
        alert('Endpoint no encontrado. Verifica la URL del API.');
      } else if (error.message.includes('401')) {
        alert('Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else {
        alert('Error al cargar las asistencias: ' + error.message);
      }
    }
  }

  // Clase CSS para estados
  function getStatusClass(status) {
    const statusMap = {
      'presente': 'status-present',
      'tarde': 'status-late',
      'sin_horario': 'status-no-schedule',
      'fuera_de_horario': 'status-outside'
    };
    return statusMap[status] || 'status-default';
  }

  // Texto para estados
  function getStatusText(status) {
    const textMap = {
      'presente': 'A tiempo',
      'tarde': 'Tardanza',
      'sin_horario': 'Sin horario',
      'fuera_de_horario': 'Fuera de horario'
    };
    return textMap[status] || status || '—';
  }

  // Cargar horario del usuario
  async function loadSchedule() {
    const loadingEl = document.getElementById('loadingSchedule');
    const noDataEl = document.getElementById('noSchedule');
    const scheduleCard = document.getElementById('myScheduleCard');

    loadingEl.style.display = 'block';
    noDataEl.style.display = 'none';
    scheduleCard.style.display = 'none';
    scheduleCard.innerHTML = '';

    try {
      // Usar el endpoint correcto para obtener el horario del usuario
      const schedules = await fetchWithAuth('/schedules/my');
      
      loadingEl.style.display = 'none';

      if (!schedules || schedules.length === 0) {
        noDataEl.style.display = 'block';
        return;
      }

      // Tomar el primer horario (o podrías filtrar por fecha actual)
      const currentSchedule = schedules[0];
      
      // Formatear los días para mejor visualización
      const diasFormateados = currentSchedule.dias.split(',').map(dia => {
        const diasCompletos = {
          'Lun': 'Lunes',
          'Mar': 'Martes',
          'Mie': 'Miércoles',
          'Jue': 'Jueves',
          'Vie': 'Viernes',
          'Sab': 'Sábado',
          'Dom': 'Domingo'
        };
        return diasCompletos[dia.trim()] || dia;
      }).join(', ');

      scheduleCard.innerHTML = `
        <div class="schedule-card">
          <h3>${currentSchedule.nombre}</h3>
          <div class="schedule-details">
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-clock"></i> Horario:</span>
              <span class="schedule-value">${currentSchedule.hora_entrada} - ${currentSchedule.hora_salida} (Hora Lima)</span>
            </div>
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-calendar-day"></i> Días:</span>
              <span class="schedule-value">${diasFormateados}</span>
            </div>
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-user-clock"></i> Tolerancia entrada:</span>
              <span class="schedule-value">${currentSchedule.tolerancia_entrada} minutos</span>
            </div>
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-user-clock"></i> Tolerancia salida:</span>
              <span class="schedule-value">${currentSchedule.tolerancia_salida} minutos</span>
            </div>
            <div class="schedule-item">
              <span class="schedule-label"><i class="fas fa-tag"></i> Tipo:</span>
              <span class="schedule-value">${currentSchedule.tipo === 'fijo' ? 'Horario Fijo' : 'Horario Rotativo'}</span>
            </div>
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
      
      // Mostrar mensaje de error específico
      if (error.message.includes('404')) {
        noDataEl.innerHTML = `
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
          <p>Endpoint de horarios no disponible</p>
          <p style="font-size: 0.9rem; margin-top: 10px; color: #7f8c8d;">
            Contacta con administración para más información
          </p>
        `;
      } else {
        noDataEl.innerHTML = `
          <i class="fas fa-exclamation-circle" style="font-size: 3rem; margin-bottom: 15px; opacity: 0.5;"></i>
          <p>Error al cargar el horario</p>
          <p style="font-size: 0.9rem; margin-top: 10px; color: #7f8c8d;">
            ${error.message}
          </p>
        `;
      }
    }
  }

  // Configurar filtros
  function setupFilters() {
    const filterBtn = document.getElementById('filterBtn');
    const clearFilterBtn = document.getElementById('clearFilterBtn');
    const startDateInput = document.getElementById('startDate');
    const endDateInput = document.getElementById('endDate');

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
  }

  // Inicializar
  async function init() {
    if (!checkAuth()) return;

    try {
      wireEvents();
      setupFilters();
      
      // Actualizar hora de Lima cada segundo
      setInterval(updateLimaTime, 1000);
      updateLimaTime();
      
      // Cargar sección por defecto
      showSection('section-my-attendances');
      await loadAttendances();
      
    } catch (error) {
      console.error('Error inicializando dashboard:', error);
      alert('Error al inicializar el dashboard: ' + error.message);
    }
  }

  // Iniciar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();