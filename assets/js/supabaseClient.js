import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

export const supabaseUrl = "https://zwrwyfmkfxnqdcgklrrs.supabase.co";
export const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3cnd5Zm1rZnhucWRjZ2tscnJzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMDEyNzAsImV4cCI6MjA5NDU3NzI3MH0.JK5URjx8gfrXUGegwDNzePThYtnzjAVkXL65UiLUf8A";

export const supabase = createClient(supabaseUrl, supabaseKey);

export const TABLES = {
  employees: "karyawan",
  orders: "order",
};

export const DEFAULT_PROFILE_PHOTO = "https://cdn.pixabay.com/photo/2023/02/18/11/00/icon-7797704_1280.png";

export function setMessage(element, type, text) {
  if (!element) return;
  element.textContent = text;
  element.className = `message ${type}`;
}

export function clearMessage(element) {
  if (!element) return;
  element.textContent = "";
  element.className = "message hidden";
}

export function showPageLoading(text) {
  window.OrderPopUI?.showPageLoading(text);
}

export function hidePageLoading() {
  window.OrderPopUI?.hidePageLoading();
}

export function setButtonLoading(button, isLoading, text) {
  if (window.OrderPopUI?.setButtonLoading) {
    window.OrderPopUI.setButtonLoading(button, isLoading, text);
    return;
  }

  if (!button) return;
  button.disabled = isLoading;
}

export function getSession() {
  try {
    return JSON.parse(localStorage.getItem("orderPopUser"));
  } catch {
    return null;
  }
}

export function saveSession(user) {
  localStorage.setItem("orderPopUser", JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem("orderPopUser");
}

export function getRoleHome(role) {
  return role === "admin" ? "admin.html" : "dashboard.html";
}

export function redirectToRoleHome(user) {
  const target = getRoleHome(user?.role);
  showPageLoading("Mengalihkan halaman...");
  window.location.replace(target);
}

export function redirectIfAuthenticated() {
  const user = getSession();
  if (!user) return null;
  redirectToRoleHome(user);
  return user;
}

export function requireRole(allowedRoles) {
  const user = getSession();

  if (!user) {
    showPageLoading("Mengalihkan ke login...");
    window.location.replace("login.html");
    return null;
  }

  if (!allowedRoles.includes(user.role)) {
    redirectToRoleHome(user);
    return null;
  }

  return user;
}

export function formatDate(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export async function deleteExpiredOrders() {
  const limitDate = new Date();
  limitDate.setDate(limitDate.getDate() - 31);
  await supabase
    .from(TABLES.orders)
    .delete()
    .lt("created_at", limitDate.toISOString());
}
