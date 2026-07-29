import { clearMessage, hidePageLoading, redirectIfAuthenticated, saveSession, setButtonLoading, setMessage, showPageLoading, supabase, TABLES } from "./supabaseClient.js";

redirectIfAuthenticated();

const form = document.getElementById("loginForm");
const message = document.getElementById("message");
const submitButton = form.querySelector('button[type="submit"]');

const successMessage = sessionStorage.getItem("registerSuccess");
if (successMessage) {
  setMessage(message, "success", successMessage);
  sessionStorage.removeItem("registerSuccess");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(message);

  const username = document.getElementById("username").value.trim();
  const kataSandi = document.getElementById("kataSandi").value;

  if (!username || !kataSandi) {
    setMessage(message, "error", "Username dan kata sandi wajib diisi.");
    return;
  }

  let shouldResetLoading = true;
  setButtonLoading(submitButton, true, "Mengecek...");
  showPageLoading("Mengecek data login...");

  try {
    const { data: user, error } = await supabase
      .from(TABLES.employees)
      .select("id,nama,username,brand,kata_sandi,role")
      .eq("username", username)
      .maybeSingle();

    if (error) {
      setMessage(message, "error", "Terjadi kendala saat mengecek data. Silahkan coba lagi.");
      return;
    }

    if (!user) {
      setMessage(message, "error", "Data Yang Anda Masukkan Tidak Terdaftar. Silahkan Lakukan Registrasi!");
      return;
    }

    if (user.kata_sandi !== kataSandi) {
      setMessage(message, "error", "Data Yang Anda Masukkan Salah. Silahkan Cek Kembali!");
      return;
    }

    saveSession({
      id: user.id,
      nama: user.nama,
      username: user.username,
      brand: user.brand,
      role: user.role || "karyawan",
    });

    shouldResetLoading = false;
    window.location.href = user.role === "admin" ? "admin.html" : "dashboard.html";
  } finally {
    if (shouldResetLoading) {
      setButtonLoading(submitButton, false);
      hidePageLoading();
    }
  }
});
