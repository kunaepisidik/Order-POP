import { hidePageLoading, requireRole, setButtonLoading, setMessage, showPageLoading, supabase, TABLES } from "./supabaseClient.js";
import { createNotification } from "./notifications.js";

const user = requireRole(["karyawan"]);
const form = document.getElementById("orderForm");
const message = document.getElementById("message");
const submitButton = form.querySelector('button[type="submit"]');
const ukuranKertasInput = document.getElementById("ukuranKertas");
const lembarInput = document.getElementById("lembar");
const brandInput = document.getElementById("brand");
const kategoriInput = document.getElementById("kategori");
const promoInput = document.getElementById("promo");

if (user && brandInput) {
  brandInput.value = user.brand || "";
}

function parseLembar(value) {
  const normalizedValue = value.trim().toUpperCase().replace(/\s+/g, "");
  const numberOnlyMatch = normalizedValue.match(/^([1-9]\d*)$/);
  if (numberOnlyMatch) return Number(numberOnlyMatch[1]);

  const bbMatch = normalizedValue.match(/^([1-9]\d*)X?BB$/);
  if (bbMatch) return Number(bbMatch[1]) * 2;

  return null;
}

function applySimilarOrderDraft() {
  const draft = sessionStorage.getItem("similarOrder");
  if (!draft) return;

  try {
    const order = JSON.parse(draft);
    ukuranKertasInput.value = order.ukuran_kertas || "";
    lembarInput.value = order.lembar || "";
    brandInput.value = order.brand || user?.brand || "";
    kategoriInput.value = order.kategori || "";
    promoInput.value = order.promo || "";
  } catch {
    // Abaikan data draft yang rusak.
  } finally {
    sessionStorage.removeItem("similarOrder");
  }
}

applySimilarOrderDraft();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!user) return;

  const ukuranKertas = ukuranKertasInput.value.trim();
  const lembarRaw = lembarInput.value;
  const lembar = parseLembar(lembarRaw);
  const brand = brandInput.value.trim();
  const kategori = kategoriInput.value.trim();
  const promo = promoInput.value.trim();

  if (!ukuranKertas || !lembar || !brand || !kategori || !promo) {
    setMessage(message, "error", "Ukuran kertas, lembar, brand, kategori, dan promo wajib diisi dengan valid. Format lembar yang diperbolehkan: 1, 2BB, atau 2XBB.");
    return;
  }

  let shouldResetLoading = true;
  setButtonLoading(submitButton, true, "Mengirim...");
  showPageLoading("Mengirim order...");

  try {
    const { data: insertedOrder, error } = await supabase.from(TABLES.orders).insert({
      user_id: user.id,
      nama: user.nama,
      username: user.username,
      brand,
      kategori,
      ukuran_kertas: ukuranKertas,
      lembar,
      promo,
      status: "belum diproses",
      admin_nama: null,
    }).select("id").single();

    if (error) {
      setMessage(message, "error", "Order gagal disimpan. Silahkan coba lagi.");
      return;
    }

    await createNotification({
      targetRole: "admin",
      orderId: insertedOrder?.id || null,
      title: "Order POP Baru",
      message: `${user.nama || user.username} membuat order ${brand} - ${kategori}. Promo: ${promo}.`,
    });

    sessionStorage.setItem("orderSuccess", "Orderan Anda Akan Segera Di Proses Oleh VM, Mohon Menunggu. Terima Kasih");
    shouldResetLoading = false;
    window.location.href = "riwayat.html";
  } finally {
    if (shouldResetLoading) {
      setButtonLoading(submitButton, false);
      hidePageLoading();
    }
  }
});
