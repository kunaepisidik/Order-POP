(function () {
  const overlay = document.createElement("div");
  overlay.className = "page-loader";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");
  overlay.innerHTML = `
    <div class="loader-box">
      <span class="loader-spinner" aria-hidden="true"></span>
      <span class="loader-text">Memuat halaman...</span>
    </div>
  `;

  function ensureOverlay() {
    if (!document.body.contains(overlay)) {
      document.body.appendChild(overlay);
    }
  }

  function showPageLoading(text) {
    ensureOverlay();
    overlay.querySelector(".loader-text").textContent = text || "Sedang loading...";
    overlay.classList.add("active");
  }

  function hidePageLoading() {
    overlay.classList.remove("active");
  }

  function setButtonLoading(button, isLoading, text) {
    if (!button) return;

    if (isLoading) {
      if (!button.dataset.originalHtml) {
        button.dataset.originalHtml = button.innerHTML;
      }
      button.classList.add("loading");
      button.setAttribute("aria-busy", "true");
      button.disabled = true;
      button.innerHTML = `<span class="btn-spinner" aria-hidden="true"></span><span>${text || "Loading..."}</span>`;
      return;
    }

    button.classList.remove("loading");
    button.removeAttribute("aria-busy");
    button.disabled = false;
    if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      delete button.dataset.originalHtml;
    }
  }

  function resetLoadingState() {
    hidePageLoading();
    document.querySelectorAll(".loading, [aria-busy='true']").forEach((element) => {
      setButtonLoading(element, false);
    });
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem("orderPopUser"));
    } catch {
      return null;
    }
  }

  function createWhatsAppFloatingButton() {
    const currentPage = window.location.pathname.split("/").pop() || "index.html";
    const blockedPages = ["index.html", "login.html"];
    const user = getSession();

    if (blockedPages.includes(currentPage) || user?.role !== "karyawan") return;

    const message = encodeURIComponent('Saya ingin bertanya tentang ini "Masukkan pesan Anda"');
    const button = document.createElement("a");
    button.className = "floating-whatsapp";
    button.href = `https://wa.me/628978826864?text=${message}`;
    button.target = "_blank";
    button.rel = "noopener";
    button.setAttribute("aria-label", "Hubungi admin melalui WhatsApp");
    button.innerHTML = `
      <img src="assets/logo/whatsapp.png" alt="WhatsApp" class="floating-whatsapp-icon" />
    `;
    document.body.appendChild(button);
  }

  window.OrderPopUI = {
    showPageLoading,
    hidePageLoading,
    setButtonLoading,
    resetLoadingState,
  };

  showPageLoading("Memuat halaman...");

  window.addEventListener("load", () => {
    setTimeout(resetLoadingState, 250);
  });

  createWhatsAppFloatingButton();

  window.addEventListener("pageshow", () => {
    setTimeout(resetLoadingState, 50);
  });

  window.addEventListener("pagehide", () => {
    resetLoadingState();
  });

  window.addEventListener("popstate", () => {
    resetLoadingState();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      resetLoadingState();
    }
  });

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a[href]");
    if (!link || link.target || link.hasAttribute("download")) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

    setButtonLoading(link, true, "Membuka...");
    showPageLoading("Membuka halaman...");
  });
})();
