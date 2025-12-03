(() => {
    const BASE_URL = "https://asistencia-iot-api.onrender.com";

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
            Toast.fire({
                icon: 'warning',
                title: 'Completa todos los campos'
            });
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
                Toast.fire({
                    icon: 'error',
                    title: data.msg || "Credenciales incorrectas"
                });
                return;
            }

            console.log("Respuesta del login:", data); // Para debug

            const token = data.access_token || data.access || data.token || data.jwt;

            if (!token) {
                console.error("⚠️ No se encontró token en la respuesta:", data);
                Toast.fire({
                    icon: 'error',
                    title: "Error: el servidor no devolvió un token válido"
                });
                return;
            }

            localStorage.setItem("jwtToken", token);
            localStorage.setItem("user", JSON.stringify(data.user || data));

            Toast.fire({
                icon: 'success',
                title: 'Inicio de sesión exitoso'
            });

            setTimeout(() => {
                // Redirigir según rol
                if ((data.user && data.user.role === "admin") || data.role === "admin") {
                    window.location.href = "../pages/dashboard_admin.html";
                } else {
                    window.location.href = "../pages/dashboard_employee.html";
                }
            }, 1500);

        } catch (err) {
            console.error("Error login:", err);
            Toast.fire({
                icon: 'error',
                title: "No se pudo conectar con el servidor"
            });
        }
    });
})();
