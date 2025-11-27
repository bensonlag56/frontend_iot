// login.js

const API_LOGIN = "https://asistencia-iot-api.onrender.com/auth/login";

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();

    if (!username || !password) {
        alert("Completa todos los campos");
        return;
    }

    try {
        const res = await fetch(API_LOGIN, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                password
            })
        });

        const data = await res.json();

        if (!res.ok) {
            alert(data.msg || "Credenciales incorrectas");
            return;
        }

        // GUARDAR TOKEN
        localStorage.setItem("access_token", data.access_token);

        // GUARDAR INFO DEL USUARIO
        localStorage.setItem("user", JSON.stringify(data.user));

        const userRole = data.user.role;

        // REDIRECCIÓN POR ROL
        if (userRole === "admin") {
            window.location.href = "../pages/dashboard_admin.html";
        } else if (userRole === "empleado") {
            window.location.href = "../pages/dashboard_employee.html";
        } else {
            alert("Rol desconocido. Consulta con el administrador.");
        }

    } catch (err) {
        console.error(err);
        alert("Error de conexión con el servidor");
    }
});