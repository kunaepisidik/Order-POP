import { clearMessage, getSession, hidePageLoading, setButtonLoading, setMessage, showPageLoading, supabase, TABLES } from "./supabaseClient.js";

const form = document.getElementById("registerForm");
const message = document.getElementById("message");
const submitButton = form.querySelector('button[type="submit"]');
const accessNotice = document.getElementById("registerAccessNotice");
const contactVmButton = document.getElementById("contactVmButton");
const currentUser = getSession();
const canRegister = currentUser?.role === "admin";
const whatsappMessage = `Halo Visual Merchandiser, saya ingin mendaftarkan akun Order POP.%0A%0AMohon dibantu untuk pendaftaran dengan data berikut:%0ANama:%0ABrand:`;
const whatsappNumber = "628978826864";

contactVmButton.href = `https://wa.me/${whatsappNumber}?text=${whatsappMessage}`;

function setRegisterAccess() {
  if (canRegister) {
    accessNotice.classList.add("hidden");
    form.querySelectorAll("input, button").forEach((element) => {
      element.disabled = false;
    });
    return;
  }

  setMessage(message, "error", "Pendaftaran akun hanya dapat dilakukan oleh admin.");
  accessNotice.classList.remove("hidden");
  form.querySelectorAll("input, button").forEach((element) => {
    element.disabled = true;
  });
}

setRegisterAccess();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearMessage(message);

  if (!canRegister) {
    setRegisterAccess();
    return;
  }

  const nama = document.getElementById("nama").value.trim();
  const username = document.getElementById("username").value.trim();
  const brand = document.getElementById("brand").value.trim();
  const kataSandi = document.getElementById("kataSandi").value;
  const konfirmasiKataSandi = document.getElementById("konfirmasiKataSandi").value;
  const role = document.getElementById("role").value;

  if (!nama || !username || !brand || !kataSandi || !konfirmasiKataSandi || kataSandi.length < 4) {
    setMessage(message, "error", "Semua input harus diisi dengan valid.");
    return;
  }

  if (kataSandi !== konfirmasiKataSandi) {
    setMessage(message, "error", "Kata sandi yang dimasukkan tidak sesuai.");
    return;
  }

  let shouldResetLoading = true;
  setButtonLoading(submitButton, true, "Menyimpan...");
  showPageLoading("Menyimpan registrasi...");

  try {
    const { data: existingUser, error: checkError } = await supabase
      .from(TABLES.employees)
      .select("id")
      .eq("username", username)
      .maybeSingle();

    if (checkError) {
      setMessage(message, "error", "Terjadi kendala saat mengecek username. Silahkan coba lagi.");
      return;
    }

    if (existingUser) {
      setMessage(message, "error", "Anda Tidak Dapat Menggunakan Username Tersebut. Gunakan Username Yang lain!");
      return;
    }

    const { error: insertError } = await supabase
      .from(TABLES.employees)
      .insert({ nama, username, brand, kata_sandi: kataSandi, role });

    if (insertError) {
      setMessage(message, "error", "Registrasi gagal disimpan. Silahkan coba lagi.");
      return;
    }

    setMessage(message, "success", "Akun karyawan berhasil didaftarkan.");
    form.reset();
  } finally {
    if (shouldResetLoading) {
      setButtonLoading(submitButton, false);
      hidePageLoading();
    }
  }
});
