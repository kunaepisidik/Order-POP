import { DEFAULT_PROFILE_PHOTO, deleteExpiredOrders, requireRole, setButtonLoading, setMessage, supabase, TABLES } from "./supabaseClient.js";

const user = requireRole(["karyawan"]);
const list = document.getElementById("historyList");
const emptyState = document.getElementById("emptyState");
const message = document.getElementById("message");
const historyLoading = document.getElementById("historyLoading");
const addOrderBtn = document.getElementById("addOrderBtn");
const ordersById = new Map();

const orderSuccess = sessionStorage.getItem("orderSuccess");
if (orderSuccess) {
  setMessage(message, "success", orderSuccess);
  sessionStorage.removeItem("orderSuccess");
}

function statusClass(status) {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "sedang diproses") return "proses";
  if (normalizedStatus === "selesai") return "selesai";
  if (normalizedStatus === "ditolak") return "ditolak";
  return "";
}

function escapeHtml(value) {
  return String(value ?? "-").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[character]);
}

function normalizeStatus(status) {
  return (status || "belum diproses").toLowerCase();
}

function statusLabel(status) {
  return normalizeStatus(status)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatHistoryDate(value) {
  if (!value) return "-";

  const date = new Date(value);
  const day = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(date);
  const datePart = new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date).replace(/\//g, "-");
  const timePart = new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(".", ":");

  return `${day}, ${datePart}, ${timePart}`;
}

function renderOrders(orders) {
  list.innerHTML = "";
  ordersById.clear();
  emptyState.classList.toggle("hidden", orders.length > 0);

  orders.forEach((order) => {
    ordersById.set(String(order.id), order);
    const card = document.createElement("article");
    card.className = "order-card history-card history-slip-card";
    const adminPhoto = order.admin_foto || DEFAULT_PROFILE_PHOTO;
    const adminName = order.admin_nama || "Belum ada admin";

    card.innerHTML = `
      <div class="history-slip-head">
        <img class="history-slip-photo" src="${escapeHtml(adminPhoto)}" alt="Foto ${escapeHtml(adminName)}" loading="lazy">
        <div class="history-slip-worker">
          <span>Dikerjakan Oleh</span>
          <strong>${escapeHtml(adminName)}</strong>
        </div>
        <span class="status-pill history-slip-status ${statusClass(order.status)}">${statusLabel(order.status)}</span>
      </div>
      <div class="history-slip-main">
        <div class="history-slip-row">
          <span>Brand</span>
          <strong>: ${escapeHtml(order.brand || "-")}</strong>
        </div>
        <div class="history-slip-row">
          <span>Kategori</span>
          <strong>: ${escapeHtml(order.kategori || "-")}</strong>
        </div>
        <div class="history-slip-row">
          <span>Promo</span>
          <strong>: ${escapeHtml(order.promo || "-")}</strong>
        </div>
        ${normalizeStatus(order.status) === "ditolak" ? `
          <div class="history-slip-row history-reject-reason">
            <span>Alasan Ditolak</span>
            <strong>: ${escapeHtml(order.alasan_tolak || "-")}</strong>
          </div>
        ` : ""}
      </div>
      <div class="history-slip-bottom">
        <div class="history-slip-row history-slip-metric">
          <span>Ukuran</span><br>
          <strong>${escapeHtml(order.ukuran_kertas || "-")}</strong>
        </div>
        <div class="history-slip-row history-slip-metric">
          <span>Jumlah</span><br>
          <strong>${escapeHtml(order.lembar || "-")} Lembar</strong>
        </div>
        <div class="history-slip-date">
          <span>Tanggal</span>
          <strong>${escapeHtml(formatHistoryDate(order.created_at))}</strong>
        </div>
      </div>
      <div class="history-card-actions">
        ${normalizeStatus(order.status) === "ditolak" ? `
          <button class="btn primary similar-order-btn" type="button" data-order-id="${escapeHtml(order.id)}">Perbaiki Orderan</button>
        ` : ""}
        <button class="btn secondary similar-order-btn" type="button" data-order-id="${escapeHtml(order.id)}">Order Hampir Serupa</button>
      </div>
    `;
    card.querySelector(".history-slip-photo").addEventListener("error", (event) => {
      event.currentTarget.src = DEFAULT_PROFILE_PHOTO;
    });
    list.appendChild(card);
  });
}

function setHistoryLoading(isLoading) {
  historyLoading.classList.toggle("hidden", !isLoading);
  list.classList.toggle("hidden", isLoading);
  if (isLoading) {
    emptyState.classList.add("hidden");
  }
}

function createSimilarOrder(order) {
  sessionStorage.setItem("similarOrder", JSON.stringify({
    ukuran_kertas: order.ukuran_kertas || "",
    lembar: order.lembar || "",
    brand: order.brand || "",
    kategori: order.kategori || "",
    promo: order.promo || "",
  }));
}

async function attachAdminPhotos(orderData) {
  const hasAdminInfo = orderData.some((order) => order.admin_id || order.admin_nama);
  if (!hasAdminInfo) return orderData;

  const { data: admins, error } = await supabase
    .from(TABLES.employees)
    .select("id,nama,username,foto,role")
    .eq("role", "admin");

  if (error) return orderData;

  const adminById = new Map((admins || []).map((admin) => [admin.id, admin]));
  const adminByName = new Map();

  (admins || []).forEach((admin) => {
    if (admin.nama) adminByName.set(admin.nama.toLowerCase(), admin);
    if (admin.username) adminByName.set(admin.username.toLowerCase(), admin);
  });

  return orderData.map((order) => {
    const adminFromId = order.admin_id ? adminById.get(order.admin_id) : null;
    const adminFromName = order.admin_nama ? adminByName.get(order.admin_nama.toLowerCase()) : null;
    const admin = adminFromId || adminFromName;

    return {
      ...order,
      admin_foto: admin?.foto || "",
      admin_nama: order.admin_nama || admin?.nama || admin?.username || "",
    };
  });
}

async function loadHistory() {
  if (!user) return;
  setHistoryLoading(true);

  try {
    await deleteExpiredOrders();

    const { data, error } = await supabase
    .from(TABLES.orders)
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

    if (error) {
      setMessage(message, "error", "Riwayat gagal dimuat. Silahkan coba lagi.");
      return;
    }

    const orders = await attachAdminPhotos(data || []);
    renderOrders(orders);
  } finally {
    setHistoryLoading(false);
  }
}

addOrderBtn.addEventListener("click", () => {
  sessionStorage.removeItem("similarOrder");
});

list.addEventListener("click", (event) => {
  const button = event.target.closest(".similar-order-btn");
  if (!button) return;

  const order = ordersById.get(button.dataset.orderId);
  if (!order) return;

  setButtonLoading(button, true, "Membuka...");
  createSimilarOrder(order);
  window.location.href = "order.html";
});

loadHistory();
