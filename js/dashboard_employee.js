// js/dashboard_employee.js
// Mock frontend para Dashboard de Empleado (sin backend)

(() => {
  // Mock data
  const mockAttendance = [
    { date: "2025-11-01", checkIn: "08:02", checkOut: "17:00", status: "Asistencia" },
    { date: "2025-11-02", checkIn: "08:45", checkOut: "17:10", status: "Tardanza" },
    { date: "2025-11-03", checkIn: null,   checkOut: null,    status: "Falta" },
    { date: "2025-11-04", checkIn: "07:58", checkOut: "16:55", status: "Asistencia" },
  ];

  const mockSchedule = {
    name: "Horario Mañana",
    time: "Lun-Vie · 08:00 - 17:00",
    notes: "Entrada a las 08:00, salida 17:00. Almuerzo 12:30 - 13:00."
  };

  // Show / hide sections
  function showSection(id) {
    const sections = document.querySelectorAll('.pane');
    sections.forEach(s => s.style.display = 'none');
    const el = document.getElementById(id);
    if (el) el.style.display = '';
  }

  // Render attendance table
  function renderAttendance() {
    const tbody = document.querySelector('#myAttendancesTable tbody');
    tbody.innerHTML = '';

    if (!mockAttendance.length) {
      tbody.innerHTML = '<tr><td colspan="4">No hay registros</td></tr>';
      return;
    }

    mockAttendance.forEach(row => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${row.date || '—'}</td>
                      <td>${row.checkIn || '—'}</td>
                      <td>${row.checkOut || '—'}</td>
                      <td>${row.status || '—'}</td>`;
      tbody.appendChild(tr);
    });
  }

  // Render schedule
  function renderSchedule() {
    const el = document.getElementById('myScheduleCard');
    el.innerHTML = `<h3>${mockSchedule.name}</h3>
                    <div class="help">${mockSchedule.time}</div>
                    <div style="margin-top:8px">${mockSchedule.notes}</div>`;
  }

  // Simulate logout (front-only)
  function logoutSimulated() {
    alert('Cierre de sesión simulado. Volviendo a login.');
    window.location.href = '../pages/login.html';
  }

  // Wire buttons
  function wireEvents() {
    const btnAttendances = document.getElementById('nav-my-attendances');
    const btnSchedule = document.getElementById('nav-my-schedule');
    const logoutBtn = document.getElementById('logoutBtn');

    if (btnAttendances) {
      btnAttendances.addEventListener('click', () => {
        showSection('section-my-attendances');
        renderAttendance();
      });
    }
    if (btnSchedule) {
      btnSchedule.addEventListener('click', () => {
        showSection('section-my-schedule');
        renderSchedule();
      });
    }
    if (logoutBtn) logoutBtn.addEventListener('click', logoutSimulated);
  }

  // Init
  function init() {
    wireEvents();
    // Default: mostrar asistencias
    renderAttendance();
    showSection('section-my-attendances');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window._mockEmployeeDashboard = { mockAttendance, mockSchedule, renderAttendance, renderSchedule, showSection };
})();
