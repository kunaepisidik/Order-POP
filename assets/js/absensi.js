import { DEFAULT_PROFILE_PHOTO, requireRole, supabase, TABLES } from "./supabaseClient.js";

const user = requireRole(["karyawan", "admin"]);
const elements = {
  alert: document.getElementById("status-alert"),
  today: document.getElementById("attendance-today"),
  complete: document.getElementById("attendance-complete"),
  profilePhoto: document.getElementById("attendance-user-photo"),
  backLink: document.getElementById("absensi-back-link"),
  note: document.getElementById("attendance-note"),
  start: document.getElementById("start-container"),
  camera: document.getElementById("camera-container"),
  preview: document.getElementById("preview-container"),
  video: document.getElementById("video-webcam"),
  image: document.getElementById("foto-preview"),
  timestamp: document.getElementById("waktu-foto"),
  canvas: document.getElementById("canvas-capture"),
  fileInput: document.getElementById("input-file-cadangan"),
  openCamera: document.getElementById("btn-buka-kamera"),
  openLabel: document.getElementById("btn-buka-label"),
  cancel: document.getElementById("btn-batal"),
  capture: document.getElementById("btn-ambil-foto"),
  closePreview: document.getElementById("btn-tutup-preview"),
};

let mediaStream = null;
let objectUrl = null;
let todayRecord = null;
let pendingType = "masuk";
const trackingStartDate = new Date(2026, 10, 19);
const PAGE_SIZE = 1000;

function setVisible(element, visible) {
  element.classList.toggle("hidden", !visible);
}

function showMessage(message, type = "success") {
  elements.alert.textContent = message;
  elements.alert.className = `absensi-alert ${type}`;
}

function clearMessage() {
  elements.alert.textContent = "";
  elements.alert.className = "absensi-alert hidden";
}

function stopCamera() {
  mediaStream?.getTracks().forEach((track) => track.stop());
  mediaStream = null;
  elements.video.srcObject = null;
}

function releasePreviewUrl() {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = null;
}

function attendanceType() {
  if (!todayRecord?.jam_masuk) return "masuk";
  if (!todayRecord.jam_pulang) return "pulang";
  return null;
}

function renderToday() {
  const checkIn = todayRecord?.jam_masuk;
  const checkOut = todayRecord?.jam_pulang;
  const parts = [];
  if (checkIn) parts.push(`Masuk ${checkIn}`);
  if (checkOut) parts.push(`Pulang ${checkOut}`);

  elements.today.textContent = parts.length
    ? `Absensi hari ini: ${parts.join(" · ")}${checkOut ? " · Lengkap" : ""}`
    : "Belum ada absensi hari ini.";
  elements.note.disabled = Boolean(checkOut);

  const nextType = attendanceType();
  elements.openCamera.disabled = !nextType;
  elements.openCamera.classList.toggle("hidden", !nextType);
  elements.complete.classList.toggle("hidden", Boolean(nextType));
  if (nextType) elements.openLabel.textContent = `Absen ${nextType === "masuk" ? "Masuk" : "Pulang"}`;
}

async function loadTodayRecord() {
  const now = new Date();
  const { data, error } = await supabase
    .from("absensi")
    .select("id,jam_masuk,jam_pulang,keterangan")
    .eq("user_id", user.id)
    .eq("tanggal", now.getDate())
    .eq("bulan", now.getMonth() + 1)
    .eq("tahun", now.getFullYear())
    .maybeSingle();

  if (error) throw error;
  todayRecord = data;
  elements.note.value = data?.keterangan || "";
  renderToday();
}

async function loadUserPhoto() {
  if (!user) return;
  elements.profilePhoto.alt = `Foto profil ${user.nama || user.username || "pengguna"}`;
  elements.profilePhoto.src = user.foto || DEFAULT_PROFILE_PHOTO;

  const { data, error } = await supabase
    .from(TABLES.employees)
    .select("nama,foto")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !data) return;
  elements.profilePhoto.alt = `Foto profil ${data.nama || user.nama || user.username || "pengguna"}`;
  elements.profilePhoto.src = data.foto || DEFAULT_PROFILE_PHOTO;
}

function dateKey(year, month, day) {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

async function fillMissedDaysAsOff(today) {
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  if (yesterday < trackingStartDate) return;

  const existingDates = new Set();
  let offset = 0;
  while (true) {
    const { data, error } = await supabase
      .from("absensi")
      .select("tanggal,bulan,tahun")
      .eq("user_id", user.id)
      .gte("tahun", trackingStartDate.getFullYear())
      .lte("tahun", today.getFullYear())
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw new Error(`Gagal memeriksa tanggal absensi: ${error.message}`);

    (data || []).forEach((record) => {
      existingDates.add(dateKey(Number(record.tahun), Number(record.bulan), Number(record.tanggal)));
    });
    if (!data || data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  const missingDates = [];
  const cursor = new Date(trackingStartDate);
  while (cursor <= yesterday) {
    const tahun = cursor.getFullYear();
    const bulan = cursor.getMonth() + 1;
    const tanggal = cursor.getDate();
    if (!existingDates.has(dateKey(tahun, bulan, tanggal))) {
      missingDates.push({
        user_id: user.id,
        tanggal,
        bulan,
        tahun,
        jam: null,
        foto_url: null,
        jam_masuk: null,
        foto_masuk_url: null,
        jam_pulang: null,
        foto_pulang_url: null,
        keterangan: "OFF",
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  for (let index = 0; index < missingDates.length; index += 500) {
    const { error } = await supabase.from("absensi").insert(missingDates.slice(index, index + 500));
    if (error) throw new Error(`Gagal menyimpan keterangan OFF: ${error.message}`);
  }
}

async function openCamera() {
  pendingType = attendanceType();
  if (!pendingType) return;

  clearMessage();
  releasePreviewUrl();
  setVisible(elements.start, false);
  setVisible(elements.preview, false);

  if (!navigator.mediaDevices?.getUserMedia) {
    setVisible(elements.start, true);
    elements.fileInput.click();
    return;
  }

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false,
    });
    elements.video.srcObject = mediaStream;
    elements.capture.textContent = `Simpan Absen ${pendingType === "masuk" ? "Masuk" : "Pulang"}`;
    setVisible(elements.camera, true);
  } catch {
    setVisible(elements.camera, false);
    setVisible(elements.start, true);
    showMessage("Kamera tidak dapat dibuka. Silakan pilih atau ambil foto dari perangkat.", "error");
    elements.fileInput.click();
  }
}

function cancelCamera() {
  stopCamera();
  setVisible(elements.camera, false);
  setVisible(elements.start, true);
  clearMessage();
}

async function capturePhoto() {
  const { video, canvas } = elements;
  if (!video.videoWidth || !video.videoHeight) {
    showMessage("Kamera belum siap. Coba lagi sebentar.", "error");
    return;
  }

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) {
    showMessage("Foto gagal diproses. Silakan coba lagi.", "error");
    return;
  }
  await saveAttendance(blob, URL.createObjectURL(blob));
}

async function handleFallbackPhoto(event) {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  pendingType = attendanceType();
  if (!pendingType) return;
  releasePreviewUrl();
  await saveAttendance(file, URL.createObjectURL(file));
}

function setSaving(isSaving) {
  elements.capture.disabled = isSaving;
  elements.cancel.disabled = isSaving;
  elements.openCamera.disabled = isSaving || !attendanceType();
  elements.capture.textContent = isSaving
    ? "Menyimpan..."
    : `Simpan Absen ${pendingType === "masuk" ? "Masuk" : "Pulang"}`;
}

async function saveAttendance(file, previewUrl) {
  setSaving(true);
  clearMessage();

  const now = new Date();
  const tanggal = now.getDate();
  const bulan = now.getMonth() + 1;
  const tahun = now.getFullYear();
  const jam = now.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).replace(/\./g, ":");
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const namaFile = `absen_${user.id}_${tahun}-${bulan}-${tanggal}_${pendingType}_${Date.now()}.${extension}`;

  try {
    if (pendingType === "masuk") await fillMissedDaysAsOff(now);

    const { error: uploadError } = await supabase.storage
      .from("foto-absensi")
      .upload(namaFile, file, { contentType: file.type || "image/jpeg" });
    if (uploadError) throw new Error(`Gagal upload foto: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from("foto-absensi").getPublicUrl(namaFile);
    if (pendingType === "masuk") {
      const checkInData = {
        user_id: user.id,
        tanggal,
        bulan,
        tahun,
        jam_masuk: jam,
        foto_masuk_url: urlData.publicUrl,
        keterangan: elements.note.value.trim() || null,
        jam,
        foto_url: urlData.publicUrl,
      };
      const query = todayRecord?.id
        ? supabase.from("absensi").update(checkInData).eq("id", todayRecord.id).eq("user_id", user.id)
        : supabase.from("absensi").insert(checkInData);
      const { data, error } = await query.select("id,jam_masuk,jam_pulang,keterangan").single();
      if (error) throw new Error(`Gagal menyimpan absen masuk: ${error.message}`);
      todayRecord = data;
    } else {
      const { data: updatedRecord, error } = await supabase.from("absensi").update({
        jam_pulang: jam,
        foto_pulang_url: urlData.publicUrl,
        keterangan: elements.note.value.trim() || todayRecord.keterangan || "Hadir",
      }).eq("id", todayRecord.id).eq("user_id", user.id).select("id").maybeSingle();
      if (error) throw new Error(`Gagal menyimpan absen pulang: ${error.message}`);
      if (!updatedRecord) throw new Error("Data absen masuk tidak ditemukan untuk diperbarui.");
      todayRecord = { ...todayRecord, jam_pulang: jam, keterangan: elements.note.value.trim() || todayRecord.keterangan || "Hadir" };
    }

    stopCamera();
    releasePreviewUrl();
    objectUrl = previewUrl;
    elements.image.src = objectUrl;
    elements.timestamp.textContent = `Absen ${pendingType} tersimpan pukul ${jam}`;
    setVisible(elements.camera, false);
    setVisible(elements.start, false);
    setVisible(elements.preview, true);
    renderToday();
    showMessage(`Foto absen ${pendingType} berhasil disimpan.`, "success");
  } catch (error) {
    URL.revokeObjectURL(previewUrl);
    showMessage(error.message || "Terjadi kesalahan saat menyimpan absensi.", "error");
  } finally {
    setSaving(false);
    renderToday();
  }
}

async function initialize() {
  if (!user) return;
  if (user.role === "admin") elements.backLink.href = "../admin.html";
  void loadUserPhoto();
  elements.openCamera.disabled = true;
  try {
    await loadTodayRecord();
  } catch (error) {
    elements.today.textContent = "Status absensi hari ini gagal dimuat.";
    showMessage(`Gagal memuat absensi: ${error.message || "Terjadi kesalahan."}`, "error");
    elements.openCamera.disabled = true;
  }
}

elements.openCamera.addEventListener("click", openCamera);
elements.cancel.addEventListener("click", cancelCamera);
elements.capture.addEventListener("click", capturePhoto);
elements.closePreview.addEventListener("click", () => {
  setVisible(elements.preview, false);
  setVisible(elements.start, true);
});
elements.fileInput.addEventListener("change", handleFallbackPhoto);
elements.profilePhoto.addEventListener("error", () => {
  if (elements.profilePhoto.src !== DEFAULT_PROFILE_PHOTO) {
    elements.profilePhoto.src = DEFAULT_PROFILE_PHOTO;
  }
});
window.addEventListener("pagehide", () => {
  stopCamera();
  releasePreviewUrl();
});

initialize();
