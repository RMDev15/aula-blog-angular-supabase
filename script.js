// Alterna entre os temas claro e escuro do Bootstrap 5.3.
document.addEventListener('DOMContentLoaded', function() {
    const botaoTema = document.querySelector("#tema");
    const html = document.documentElement;

    if (botaoTema) {
        botaoTema.addEventListener("click", function () {
            if (html.getAttribute("data-bs-theme") === "dark") {
                html.setAttribute("data-bs-theme", "light");
                botaoTema.textContent = "🌙 Modo escuro";
            } else {
                html.setAttribute("data-bs-theme", "dark");
                botaoTema.textContent = "☀️️ Modo claro";
            }
        });
    }
});