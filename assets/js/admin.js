import { clearSession, DEFAULT_PROFILE_PHOTO, deleteExpiredOrders, formatDate, hidePageLoading, requireRole, setButtonLoading, setMessage, showPageLoading, supabase, TABLES } from "./supabaseClient.js";
import { createNotification, initBrowserNotifications } from "./notifications.js";

const admin = requireRole(["admin"]);
const logoutBtn = document.getElementById("logoutBtn");
const ordersContainer = document.getElementById("adminOrders");
const emptyState = document.getElementById("emptyState");
const message = document.getElementById("message");
const filterButtons = document.querySelectorAll(".filter-btn");
const adminWelcomeText = document.getElementById("adminWelcomeText");
const adminLoading = document.getElementById("adminLoading");
const rejectModal = document.getElementById("rejectModal");
const rejectForm = document.getElementById("rejectForm");
const rejectReason = document.getElementById("rejectReason");
const cancelRejectBtn = document.getElementById("cancelRejectBtn");
const submitRejectBtn = document.getElementById("submitRejectBtn");

let currentFilter = "semua";
let orders = [];
let pendingRejectOrderId = null;

if (admin && adminWelcomeText) {
  adminWelcomeText.textContent = admin.nama || admin.username || "Admin";
}

initBrowserNotifications(admin, {
  onNewNotification: () => loadOrders(),
});

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

function statusClass(status) {
  const normalizedStatus = normalizeStatus(status);
  if (normalizedStatus === "sedang diproses") return "proses";
  if (normalizedStatus === "selesai") return "selesai";
  if (normalizedStatus === "ditolak") return "ditolak";
  return "";
}

function statusLabel(status) {
  return normalizeStatus(status)
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function visibleOrders() {
  if (currentFilter === "semua") return orders;
  return orders.filter((order) => normalizeStatus(order.status) === currentFilter);
}

function renderActions(order) {
  const status = normalizeStatus(order.status);

  if (status === "selesai" || status === "ditolak") {
    return `
      <div class="admin-actions single">
        <button class="done" type="button" disabled>Selesai</button>
      </div>
    `;
  }

  return `
    <div class="admin-actions">
      <button class="done" type="button" data-id="${escapeHtml(order.id)}" data-status="selesai">Selesai</button>
      <button class="reject" type="button" data-id="${escapeHtml(order.id)}" data-status="ditolak">Tolak</button>
    </div>
  `;
}

function setAdminLoading(isLoading) {
  adminLoading.classList.toggle("hidden", !isLoading);
  ordersContainer.classList.toggle("hidden", isLoading);
  if (isLoading) {
    emptyState.classList.add("hidden");
  }
}

function openRejectModal(orderId) {
  pendingRejectOrderId = orderId;
  rejectReason.value = "";
  rejectModal.classList.remove("hidden");
  rejectReason.focus();
}

function closeRejectModal() {
  pendingRejectOrderId = null;
  rejectReason.value = "";
  rejectModal.classList.add("hidden");
}

function renderOrders() {
  const filtered = visibleOrders();
  ordersContainer.innerHTML = "";
  emptyState.classList.toggle("hidden", filtered.length > 0);

  filtered.forEach((order) => {
    const card = document.createElement("article");
    card.className = "order-card admin-order-card";
    const status = normalizeStatus(order.status);
    const photo = order.user_foto || DEFAULT_PROFILE_PHOTO;

    card.innerHTML = `
      <div class="admin-order-head">
        <img class="admin-order-photo" src="${escapeHtml(photo)}" alt="Foto ${escapeHtml(order.nama || "pemesan")}" loading="lazy">
        <div class="admin-order-title">
          <h3>${escapeHtml(order.nama || "-")}</h3>
          <p>${escapeHtml(order.username || "-")}</p>
        </div>
      </div>
      <div class="admin-order-meta">
        <span class="status-pill ${statusClass(status)}">${statusLabel(status)}</span>
        <span>${escapeHtml(formatDate(order.created_at))}</span>
      </div>
      <div class="admin-detail-list">
        <div><span>Ukuran Kertas</span><strong>${escapeHtml(order.ukuran_kertas || "-")}</strong></div>
        <div><span>Jumlah Kertas</span><strong>${escapeHtml(order.lembar || "-")}</strong></div>
        <div><span>Brand</span><strong>${escapeHtml(order.brand || "-")}</strong></div>
        <div><span>Kategori</span><strong>${escapeHtml(order.kategori || "Order POP")}</strong></div>
        <div class="wide"><span>Promo</span><strong>${escapeHtml(order.promo || "-")}</strong></div>
        <div><span>Oleh</span><strong>${escapeHtml(order.admin_nama || "-")}</strong></div>
      </div>
      ${renderActions(order)}
    `;
    card.querySelector(".admin-order-photo").addEventListener("error", (event) => {
      event.currentTarget.src = DEFAULT_PROFILE_PHOTO;
    });
    ordersContainer.appendChild(card);
  });
}

async function attachOrderPhotos(orderData) {
  const userIds = [...new Set(orderData.map((order) => order.user_id).filter(Boolean))];
  if (userIds.length === 0) return orderData;

  const { data: employees, error } = await supabase
    .from(TABLES.employees)
    .select("id,foto")
    .in("id", userIds);

  if (error) return orderData;

  const photoByUserId = new Map((employees || []).map((employee) => [employee.id, employee.foto]));
  return orderData.map((order) => ({
    ...order,
    user_foto: photoByUserId.get(order.user_id) || "",
  }));
}

async function loadOrders() {
  if (!admin) return;
  setAdminLoading(true);

  try {
    await deleteExpiredOrders();

    const { data, error } = await supabase
      .from(TABLES.orders)
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage(message, "error", "Pesanan gagal dimuat. Silahkan coba lagi.");
      return;
    }

    orders = await attachOrderPhotos(data || []);
    renderOrders();
  } finally {
    setAdminLoading(false);
  }
}

async function updateStatus(orderId, status, button, reason = "") {
  setButtonLoading(button, true, "Menyimpan...");
  showPageLoading("Memperbarui status order...");

  try {
    const updateData = {
      status,
      admin_id: admin.id,
      admin_nama: admin.nama || admin.username,
      alasan_tolak: status === "ditolak" ? reason : null,
    };

    let { error } = await supabase
      .from(TABLES.orders)
      .update(updateData)
      .eq("id", orderId);

    if (error && String(error.message || "").toLowerCase().includes("admin_id")) {
      delete updateData.admin_id;
      const fallbackResult = await supabase
        .from(TABLES.orders)
        .update(updateData)
        .eq("id", orderId);

      error = fallbackResult.error;
    }

    if (error && String(error.message || "").toLowerCase().includes("alasan_tolak")) {
      setMessage(message, "error", "Kolom alasan_tolak belum tersedia di Supabase. Jalankan SQL tambahan terlebih dahulu.");
      return false;
    }

    if (error) {
      setMessage(message, "error", "Status pesanan gagal diperbarui.");
      return false;
    }

    const updatedOrder = orders.find((order) => String(order.id) === String(orderId));
    if (updatedOrder?.user_id && (status === "selesai" || status === "ditolak")) {
      const statusText = status === "selesai" ? "selesai" : "ditolak";
      const reasonText = status === "ditolak" && reason ? ` Alasan: ${reason}` : "";

      await createNotification({
        targetUserId: updatedOrder.user_id,
        orderId,
        title: `Order POP ${statusText.charAt(0).toUpperCase() + statusText.slice(1)}`,
        message: `Order ${updatedOrder.brand || "-"} - ${updatedOrder.kategori || "Order POP"} (${updatedOrder.promo || "-"}) telah ${statusText} oleh ${admin.nama || admin.username}.${reasonText}`,
      });
    }

    setMessage(message, "success", "Status pesanan berhasil diperbarui.");
    await loadOrders();
    return true;
  } finally {
    setButtonLoading(button, false);
    hidePageLoading();
  }
}

filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    filterButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    currentFilter = button.dataset.filter;
    renderOrders();
  });
});

ordersContainer.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;

  if (button.dataset.status === "ditolak") {
    openRejectModal(button.dataset.id);
    return;
  }

  updateStatus(button.dataset.id, button.dataset.status, button);
});

cancelRejectBtn.addEventListener("click", closeRejectModal);

rejectModal.addEventListener("click", (event) => {
  if (event.target === rejectModal) {
    closeRejectModal();
  }
});

rejectForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const reason = rejectReason.value.trim();

  if (!pendingRejectOrderId || !reason) {
    setMessage(message, "error", "Alasan penolakan wajib diisi.");
    return;
  }

  const isUpdated = await updateStatus(pendingRejectOrderId, "ditolak", submitRejectBtn, reason);
  if (isUpdated) {
    closeRejectModal();
  }
});

logoutBtn.addEventListener("click", () => {
  setButtonLoading(logoutBtn, true, "Keluar...");
  showPageLoading("Keluar dari akun...");
  clearSession();
  window.location.href = "login.html";
});

loadOrders();
