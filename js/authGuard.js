export function requireAuth() {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "../pages/login.html";
    }
}

export function requireRole(requiredRole) {
    const userData = localStorage.getItem("user");
    if (!userData) {
        window.location.href = "../pages/login.html";
        return;
    }

    const user = JSON.parse(userData);

    if (user.role !== requiredRole) {
        window.location.href = "../pages/login.html";
    }
}