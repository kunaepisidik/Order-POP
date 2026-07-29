import { DEFAULT_PROFILE_PHOTO, getRoleHome, hidePageLoading, requireRole, setMessage, showPageLoading, supabase, TABLES } from "./supabaseClient.js";

const user = requireRole(["karyawan", "admin"]);
const message = document.getElementById("message");
const backLink = document.getElementById("backLink");
const profileBackButton = document.getElementById("profileBackButton");
const profilePhoto = document.getElementById("profilePhoto");
const profileNama = document.getElementById("profileNama");
const profileUsername = document.getElementById("profileUsername");
const profileBrand = document.getElementById("profileBrand");

const successMessage = sessionStorage.getItem("profileSuccess");
if (successMessage) {
  setMessage(message, "success", successMessage);
  sessionStorage.removeItem("profileSuccess");
}

if (user) {
  const home = getRoleHome(user.role);
  backLink.href = home;
  profileBackButton.href = home;
}

profilePhoto.addEventListener("error", () => {
  profilePhoto.src = DEFAULT_PROFILE_PHOTO;
});

async function loadProfile() {
  if (!user) return;
  showPageLoading("Memuat profil...");

  try {
    const { data, error } = await supabase
      .from(TABLES.employees)
      .select("id,nama,username,brand,role,foto")
      .eq("id", user.id)
      .maybeSingle();

    if (error || !data) {
      setMessage(message, "error", "Data profil gagal dimuat. Silahkan coba lagi.");
      return;
    }

    profilePhoto.src = data.foto || DEFAULT_PROFILE_PHOTO;
    profileNama.textContent = data.nama || "-";
    profileUsername.textContent = data.username || "-";
    profileBrand.textContent = data.brand || "-";
  } finally {
    hidePageLoading();
  }
}

loadProfile();
