(() => {
    const BASE_URL = "https://asistencia-iot-api.onrender.com";

    const loginForm = document.getElementById("loginForm");

    if (!loginForm) {
        console.warn("login.js cargado en una página sin loginForm. Se detuvo la ejecución.");
        return;
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const usernameInput = document.getElementById("username");
        const passwordInput = document.getElementById("password");

        if (!usernameInput || !passwordInput) return;

        const username = usernameInput.value.trim();
        const password = passwordInput.value.trim();

        if (!username || !password) {
            alert("Completa todos los campos");
            return;
        }

        try {
            const res = await fetch(`${BASE_URL}/auth/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, password })
            });

            const data = await res.json();

            if (!res.ok) {
                alert(data.msg || "Credenciales incorrectas");
                return;
            }

            // Guardar token e info del usuario
            localStorage.setItem("token", data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));

            // Redirigir según rol
            if (data.user.role === "admin") {
                window.location.href = "../pages/dashboard_admin.html";
            } else {
                window.location.href = "../pages/dashboard_employee.html";
            }

        } catch (err) {
            console.error("Error login:", err);
            alert("No se pudo conectar con el servidor");
        }
    });
})();