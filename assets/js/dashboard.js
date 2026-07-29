import { clearSession, DEFAULT_PROFILE_PHOTO, hidePageLoading, requireRole, saveSession, setButtonLoading, showPageLoading, supabase, TABLES } from "./supabaseClient.js";

const user = requireRole(["karyawan"]);
const dashboardPhoto = document.getElementById("dashboardPhoto");
const dashboardName = document.getElementById("dashboardName");
const dashboardUsername = document.getElementById("dashboardUsername");
const dashboardBrand = document.getElementById("dashboardBrand");
const logoutBtn = document.getElementById("logoutBtn");

if (user) {
  dashboardName.textContent = user.nama || user.username || "Karyawan";
  dashboardUsername.textContent = user.username ? `@${user.username}` : "@username";
  dashboardBrand.textContent = user.brand || "-";
  dashboardPhoto.src = user.foto || DEFAULT_PROFILE_PHOTO;
}

dashboardPhoto.addEventListener("error", () => {
  dashboardPhoto.src = DEFAULT_PROFILE_PHOTO;
});

async function loadDashboardProfile() {
  if (!user) return;
  showPageLoading("Memuat dashboard...");

  try {
    const { data, error } = await supabase
      .from(TABLES.employees)
      .select("id,nama,username,brand,role,foto")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) return;

    dashboardName.textContent = data.nama || data.username || "Karyawan";
    dashboardUsername.textContent = data.username ? `@${data.username}` : "@username";
    dashboardBrand.textContent = data.brand || "-";
    dashboardPhoto.src = data.foto || DEFAULT_PROFILE_PHOTO;

    saveSession({
      ...user,
      nama: data.nama,
      username: data.username,
      brand: data.brand,
      role: data.role || user.role,
      foto: data.foto || "",
    });
  } finally {
    hidePageLoading();
  }
}

logoutBtn.addEventListener("click", () => {
  setButtonLoading(logoutBtn, true, "Keluar...");
  showPageLoading("Keluar dari akun...");
  clearSession();
  window.location.href = "login.html";
});

loadDashboardProfile();
