import { clearMessage, DEFAULT_PROFILE_PHOTO, getRoleHome, getSession, hidePageLoading, requireRole, saveSession, setButtonLoading, setMessage, showPageLoading, supabase, TABLES } from "./supabaseClient.js";

const user = requireRole(["karyawan", "admin"]);
const form = document.getElementById("updateProfileForm");
const message = document.getElementById("message");
const submitButton = form.querySelector('button[type="submit"]');
const backLink = document.getElementById("backLink");
const updateBackButton = document.getElementById("updateBackButton");
const namaInput = document.getElementById("nama");
const usernameInput = document.getElementById("username");
const brandInput = document.getElementById("brand");
const kataSandiInput = document.getElementById("kataSandi");
const konfirmasiKataSandiInput = document.getElementById("konfirmasiKataSandi");
const fotoInput = document.getElementById("foto");
const photoPreview = document.getElementById("photoPreview");

let currentPhoto = "";
let selectedPhoto = "";

if (user) {
  const home = getRoleHome(user.role);
  backLink.href = home;
  updateBackButton.href = home;
}

photoPreview.addEventListener("error", () => {
  photoPreview.src = DEFAULT_PROFILE_PHOTO;
});

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Foto gagal dibaca."));
    reader.readAsDataURL(file);
  });
}

async function loadProfile() {
  if (!user) return;
  showPageLoading("Memuat data...");

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

    namaInput.value = data.nama || "";
    usernameInput.value = data.username || "";
    brandInput.value = data.brand || "";
    currentPhoto = data.foto || "";
    photoPreview.src = currentPhoto || DEFAULT_PROFILE_PHOTO;
  } finally {
    hidePageLoading();
  }
}

fotoInput.addEventListener("change", async () => {
  clearMessage(message);
  const file = fotoInput.files?.[0];

  if (!file) {
    selectedPhoto = "";
    photoPreview.src = currentPhoto || DEFAULT_PROFILE_PHOTO;
    return;
  }

  if (!file.type.startsWith("image/")) {
    fotoInput.value = "";
    selectedPhoto = "";
    photoPreview.src = currentPhoto || DEFAULT_PROFILE_PHOTO;
    setMessage(message, "error", "File foto harus berupa gambar.");
    return;
  }

  try {
    selectedPhoto = await readImageAsDataUrl(file);
    photoPreview.src = selectedPhoto;
  } catch {
    setMessage(message, "error", "Foto gagal dibaca. Silahkan pilih foto lain.");
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!user) return;
  clearMessage(message);

  const nama = namaInput.value.trim();
  const username = usernameInput.value.trim();
  const brand = brandInput.value.trim();
  const kataSandi = kataSandiInput.value;
  const konfirmasiKataSandi = konfirmasiKataSandiInput.value;

  if (!nama || !username || !brand) {
    setMessage(message, "error", "Nama, username, dan brand wajib diisi.");
    return;
  }

  if ((kataSandi || konfirmasiKataSandi) && kataSandi !== konfirmasiKataSandi) {
    setMessage(message, "error", "Kata sandi yang dimasukkan tidak sesuai.");
    return;
  }

  if (kataSandi && kataSandi.length < 4) {
    setMessage(message, "error", "Kata sandi minimal 4 karakter.");
    return;
  }

  let shouldResetLoading = true;
  setButtonLoading(submitButton, true, "Memperbarui...");
  showPageLoading("Memperbarui data...");

  try {
    const { data: existingUser, error: checkError } = await supabase
      .from(TABLES.employees)
      .select("id")
      .eq("username", username)
      .neq("id", user.id)
      .maybeSingle();

    if (checkError) {
      setMessage(message, "error", "Terjadi kendala saat mengecek username. Silahkan coba lagi.");
      return;
    }

    if (existingUser) {
      setMessage(message, "error", "Anda Tidak Dapat Menggunakan Username Tersebut. Gunakan Username Yang lain!");
      return;
    }

    const updateData = {
      nama,
      username,
      brand,
      foto: selectedPhoto || currentPhoto || null,
    };

    if (kataSandi) {
      updateData.kata_sandi = kataSandi;
    }

    const { error: updateError } = await supabase
      .from(TABLES.employees)
      .update(updateData)
      .eq("id", user.id);

    if (updateError) {
      setMessage(message, "error", "Data gagal diperbarui. Silahkan coba lagi.");
      return;
    }

    const latestSession = getSession() || user;
    saveSession({
      ...latestSession,
      nama,
      username,
      brand,
    });

    sessionStorage.setItem("profileSuccess", "Data Berhasil Diperbarui");
    shouldResetLoading = false;
    window.location.href = "profile.html";
  } finally {
    if (shouldResetLoading) {
      setButtonLoading(submitButton, false);
      hidePageLoading();
    }
  }
});

loadProfile();
