const STORAGE_KEY = "beautyBusinessManager.v3";
const SESSION_KEY = "beautyBusinessManager.session.v1";
const DELIVERY_PAY_PER_PRODUCT = 2;

const starterProducts = [
  ["Creme visage hydratante", 12, 8, 18, "none", 0, 30],
  ["Gel douche vanille", 18, 3.5, 8, "percent", 10, 20],
  ["Serum eclat", 8, 11, 25, "none", 0, 45],
  ["Lait corps", 10, 6, 14, "fixed", 11.99, 30],
  ["Gommage corps", 9, 5, 13, "none", 0, 25],
  ["Creme mains", 15, 2.8, 7, "none", 0, 30],
  ["Masque visage", 10, 4, 10, "percent", 15, 14],
  ["Huile cheveux", 7, 7, 16, "none", 0, 40],
  ["Savon doux", 20, 1.8, 5, "none", 0, 18],
  ["Brume parfumee", 6, 6.5, 15, "none", 0, 60],
];

const defaultAccounts = [
  {
    id: "owner_default",
    role: "owner",
    name: "Patron",
    username: "patron",
    password: "1234",
    phone: "",
  },
  {
    id: "driver_default",
    role: "driver",
    name: "Livreur exemple",
    username: "livreur",
    password: "1234",
    phone: "+33611111111",
  },
];

let state = loadState();
let currentUserId = sessionStorage.getItem(SESSION_KEY) || "";
let selectedClientId = "";

function uid(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeState(JSON.parse(saved));
  } catch (error) {
    console.warn("Sauvegarde locale illisible, demarrage avec les donnees de base.", error);
  }
  return createDefaultState();
}

function createDefaultState() {
  return normalizeState({
    ownerPhone: "",
    products: starterProducts.map(([name, stock, cost, price, promoType, promoValue, useDays]) => ({
      id: uid("prd"),
      name,
      stock,
      cost,
      price,
      promoType,
      promoValue,
      useDays,
    })),
    clients: [
      {
        id: uid("cli"),
        name: "Client exemple",
        phone: "+33600000000",
        address: "Adresse a remplacer",
        note: "Remplace ce client par un vrai client.",
      },
    ],
    sales: [],
    accounts: defaultAccounts,
  });
}

function normalizeState(data) {
  const normalized = {
    ownerPhone: data.ownerPhone || "",
    products: Array.isArray(data.products) ? data.products : [],
    clients: Array.isArray(data.clients) ? data.clients : [],
    sales: Array.isArray(data.sales) ? data.sales : [],
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
  };

  defaultAccounts.forEach((account) => {
    if (!normalized.accounts.some((existing) => existing.id === account.id || existing.username === account.username)) {
      normalized.accounts.push({ ...account });
    }
  });

  normalized.accounts = normalized.accounts.map((account) => ({
    id: account.id || uid("usr"),
    role: account.role === "owner" ? "owner" : "driver",
    name: account.name || account.username || "Compte",
    username: account.username || "",
    password: account.password || "1234",
    phone: account.phone || "",
  }));

  normalized.sales = normalized.sales.map((sale) => ({
    ...sale,
    deliveryStatus: sale.deliveryStatus || (sale.delivered ? "pending" : ""),
    driverId: sale.driverId || "",
    deliveryDoneAt: sale.deliveryDoneAt || "",
  }));

  return normalized;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getCurrentUser() {
  return state.accounts.find((account) => account.id === currentUserId) || null;
}

function saveSession(accountId) {
  currentUserId = accountId;
  sessionStorage.setItem(SESSION_KEY, accountId);
}

function clearSession() {
  currentUserId = "";
  sessionStorage.removeItem(SESSION_KEY);
}

function showLoginError(message = "") {
  const errorBox = document.querySelector("#loginError");
  errorBox.textContent = message;
  errorBox.classList.toggle("show", Boolean(message));
}

function resetDefaultAccess() {
  defaultAccounts.forEach((defaultAccount) => {
    const existingIndex = state.accounts.findIndex(
      (account) => account.id === defaultAccount.id || account.username === defaultAccount.username
    );
    if (existingIndex >= 0) {
      state.accounts[existingIndex] = { ...state.accounts[existingIndex], ...defaultAccount };
    } else {
      state.accounts.push({ ...defaultAccount });
    }
  });
  saveState();
}

function money(value) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value || 0);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("fr-FR").format(new Date(`${value}T12:00:00`));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function normalizePhone(phone) {
  return String(phone || "").replace(/[^\d+]/g, "");
}

function priceForProduct(product, promoMode = "auto") {
  if (!product || promoMode === "none" || product.promoType === "none") return product?.price || 0;
  if (product.promoType === "percent") return Math.max(0, product.price * (1 - product.promoValue / 100));
  if (product.promoType === "fixed") return Math.max(0, product.promoValue);
  return product.price;
}

function calculateSale(items, delivered) {
  let revenue = 0;
  let cost = 0;
  let productCount = 0;
  const lines = [];

  items.forEach((item) => {
    const product = item.snapshot || state.products.find((p) => p.id === item.productId);
    if (!product) return;
    const qty = Number(item.qty || 0);
    const unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : priceForProduct(product, item.promoMode);
    const lineRevenue = unitPrice * qty;
    const lineCost = Number(product.cost || 0) * qty;
    revenue += lineRevenue;
    cost += lineCost;
    productCount += qty;
    lines.push({ product, qty, unitPrice, lineRevenue, lineCost, promoMode: item.promoMode });
  });

  const deliveryCost = delivered ? productCount * DELIVERY_PAY_PER_PRODUCT : 0;
  return {
    lines,
    revenue,
    cost,
    productCount,
    deliveryCost,
    profit: revenue - cost - deliveryCost,
  };
}

function saleTotals(sale) {
  return calculateSale(sale.items || [], sale.delivered);
}

function phoneLink(phone, message) {
  const clean = normalizePhone(phone);
  return `https://wa.me/${clean.replace("+", "")}?text=${encodeURIComponent(message)}`;
}

function setToday() {
  document.querySelector("#saleDate").value = todayString();
}

function canAccessTab(tabName) {
  const user = getCurrentUser();
  if (!user) return false;
  if (user.role === "driver") return tabName === "driver";
  return tabName !== "driver";
}

function switchTab(tabName) {
  const user = getCurrentUser();
  const safeTabName = canAccessTab(tabName) ? tabName : user?.role === "driver" ? "driver" : "dashboard";
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === safeTabName));
  document.querySelectorAll(".panel").forEach((panel) => panel.classList.toggle("active", panel.id === safeTabName));
}

function render() {
  renderAuth();
  if (!getCurrentUser()) return;
  renderSelects();
  renderProducts();
  renderClients();
  renderAccounts();
  renderDashboard();
  renderAllSales();
  renderDeliveries();
  renderReminders();
  renderClientHistory();
  renderDriverDashboard();
  updateSalePreview();
}

function renderAuth() {
  const user = getCurrentUser();
  const isLoggedIn = Boolean(user);
  document.querySelector("#loginScreen").classList.toggle("hidden", isLoggedIn);
  document.querySelector("#appShell").classList.toggle("hidden", !isLoggedIn);

  if (!isLoggedIn) return;

  const isOwner = user.role === "owner";
  document.querySelector("#accountBadge").textContent = `${isOwner ? "Patron" : "Livreur"}: ${user.name}`;
  document.querySelectorAll(".owner-only, .owner-tab, .owner-panel").forEach((element) => {
    element.hidden = !isOwner;
  });
  document.querySelectorAll(".driver-tab, .driver-panel").forEach((element) => {
    element.hidden = isOwner;
  });

  const activePanel = document.querySelector(".panel.active");
  if (!activePanel || activePanel.hidden || !canAccessTab(activePanel.id)) {
    switchTab(isOwner ? "dashboard" : "driver");
  }
}

function renderSelects() {
  const clientSelect = document.querySelector("#saleClient");
  clientSelect.innerHTML = state.clients.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

  const driverSelect = document.querySelector("#driverAccount");
  const selectedDriver = driverSelect.value;
  const drivers = state.accounts.filter((account) => account.role === "driver");
  driverSelect.innerHTML = [
    `<option value="">Aucun livreur choisi</option>`,
    ...drivers.map((driver) => `<option value="${driver.id}">${escapeHtml(driver.name)} - ${escapeHtml(driver.phone || "sans numero")}</option>`),
  ].join("");
  if (drivers.some((driver) => driver.id === selectedDriver)) driverSelect.value = selectedDriver;

  document.querySelectorAll(".item-product").forEach(fillProductSelect);
}

function fillProductSelect(select) {
  const selected = select.value;
  select.innerHTML = state.products
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name)} - stock ${p.stock}</option>`)
    .join("");
  if (selected) select.value = selected;
}

function renderProducts() {
  const list = document.querySelector("#productsList");
  list.innerHTML = state.products
    .map((p) => {
      const promo =
        p.promoType === "percent"
          ? `Promo -${p.promoValue}%`
          : p.promoType === "fixed"
            ? `Promo ${money(p.promoValue)}`
            : "Pas de promo";
      return `
        <article class="row">
          <div class="row-title">
            <strong>${escapeHtml(p.name)}</strong>
            <span class="tag ${p.stock <= 2 ? "warn" : ""}">Stock ${p.stock}</span>
          </div>
          <div class="meta">
            <span>Achat ${money(p.cost)}</span>
            <span>Vente ${money(p.price)}</span>
            <span>${promo}</span>
            <span>${p.useDays} jours</span>
          </div>
          <div class="actions">
            <button type="button" data-edit-product="${p.id}">Modifier</button>
            <button class="danger" type="button" data-delete-product="${p.id}">Supprimer</button>
          </div>
        </article>`;
    })
    .join("");
}

function getClient(clientId) {
  return state.clients.find((client) => client.id === clientId) || null;
}

function getClientSales(clientId) {
  return state.sales.filter((sale) => sale.clientId === clientId);
}

function getClientStats(clientId) {
  return getClientSales(clientId).reduce(
    (acc, sale) => {
      const total = saleTotals(sale);
      acc.sales += 1;
      acc.spent += total.revenue;
      acc.products += total.productCount;
      return acc;
    },
    { sales: 0, spent: 0, products: 0 }
  );
}

function saleProductSummary(total) {
  return total.lines.map((line) => `${line.qty} x ${line.product.name} (${money(line.unitPrice)})`).join(", ");
}

function renderClients() {
  const list = document.querySelector("#clientsList");
  list.innerHTML = state.clients
    .map((c) => {
      const stats = getClientStats(c.id);
      return `
        <article class="row">
          <div class="row-title">
            <button class="link-button" type="button" data-view-client-history="${c.id}">${escapeHtml(c.name)}</button>
            <span>${escapeHtml(c.phone)}</span>
          </div>
          <div class="meta">
            <span>${escapeHtml(c.address || "Adresse vide")}</span>
            <span>${escapeHtml(c.note || "Pas de note")}</span>
            <span>${stats.sales} vente(s)</span>
            <span>Total achete ${money(stats.spent)}</span>
          </div>
          <div class="actions">
            <button type="button" data-edit-client="${c.id}">Modifier</button>
            <button class="danger" type="button" data-delete-client="${c.id}">Supprimer</button>
          </div>
        </article>`;
    })
    .join("");
}

function renderAccounts() {
  const list = document.querySelector("#accountsList");
  const ownerCount = state.accounts.filter((account) => account.role === "owner").length;
  list.innerHTML = state.accounts
    .map((account) => {
      const isCurrent = account.id === currentUserId;
      const cannotDelete = isCurrent || (account.role === "owner" && ownerCount <= 1);
      return `<article class="row">
        <div class="row-title">
          <strong>${escapeHtml(account.name)}</strong>
          <span class="tag">${account.role === "owner" ? "Patron" : "Livreur"}</span>
        </div>
        <div class="meta">
          <span>Identifiant: ${escapeHtml(account.username)}</span>
          <span>${escapeHtml(account.phone || "Numero vide")}</span>
          ${isCurrent ? "<span>Compte connecte</span>" : ""}
        </div>
        <div class="actions">
          <button type="button" data-edit-account="${account.id}">Modifier</button>
          <button class="danger" type="button" data-delete-account="${account.id}" ${cannotDelete ? "disabled" : ""}>Supprimer</button>
        </div>
      </article>`;
    })
    .join("");
}

function renderDashboard() {
  const totals = state.sales.reduce(
    (acc, sale) => {
      const saleTotal = saleTotals(sale);
      acc.revenue += saleTotal.revenue;
      acc.profit += saleTotal.profit;
      return acc;
    },
    { revenue: 0, profit: 0 }
  );
  const dueReminders = getReminders().filter((r) => r.due).length;
  const lowStock = state.products.filter((p) => p.stock <= 2).length;

  document.querySelector("#statRevenue").textContent = money(totals.revenue);
  document.querySelector("#statProfit").textContent = money(totals.profit);
  document.querySelector("#statLowStock").textContent = lowStock;
  document.querySelector("#statDue").textContent = dueReminders;

  const alerts = [
    ...state.products.filter((p) => p.stock <= 2).map((p) => `Stock bas: ${p.name} (${p.stock})`),
    ...getReminders()
      .filter((r) => r.due)
      .map((r) => `Rappel client: ${r.client.name} pour ${r.product.name}`),
  ];
  document.querySelector("#alertsList").innerHTML = alerts.length
    ? alerts.map((a) => `<div class="row">${escapeHtml(a)}</div>`).join("")
    : "Aucune alerte pour le moment.";

  document.querySelector("#salesList").innerHTML = state.sales.length
    ? [...state.sales]
        .reverse()
        .slice(0, 8)
        .map((sale) => {
          const client = getClient(sale.clientId);
          const total = saleTotals(sale);
          return `<article class="row">
            <div class="row-title">
              <button class="link-button" type="button" data-view-client-history="${sale.clientId}">${escapeHtml(client?.name || "Client supprime")}</button>
              <span>${formatDate(sale.date)}</span>
            </div>
            <div class="meta"><span>Total ${money(total.revenue)}</span><span>Benefice ${money(total.profit)}</span><span>${total.productCount} produit(s)</span></div>
          </article>`;
        })
        .join("")
    : "Aucune vente enregistree.";
}

function renderAllSales() {
  const list = document.querySelector("#allSalesList");
  list.innerHTML = state.sales.length
    ? [...state.sales].reverse().map(renderOwnerSaleRow).join("")
    : "Aucune vente enregistree.";
}

function renderOwnerSaleRow(sale) {
  const client = getClient(sale.clientId);
  const total = saleTotals(sale);
  const delivery = sale.delivered ? getSaleDeliveryDetails(sale) : null;
  const deliveryInfo = sale.delivered
    ? `<span>Livraison: ${delivery.status}</span><span>Livreur: ${escapeHtml(delivery.driverName)}</span><span>A encaisser ${money(total.revenue)}</span>`
    : "<span>Sans livraison</span>";

  return `<article class="row">
    <div class="row-title">
      <button class="link-button" type="button" data-view-client-history="${sale.clientId}">${escapeHtml(client?.name || "Client supprime")}</button>
      <span>${formatDate(sale.date)}</span>
    </div>
    <div class="meta">
      <span>Tel: ${escapeHtml(client?.phone || "numero vide")}</span>
      <span>Adresse: ${escapeHtml(sale.deliveryAddress || client?.address || "adresse vide")}</span>
      ${deliveryInfo}
    </div>
    <div class="meta">
      <span>Produits: ${escapeHtml(saleProductSummary(total) || "aucun")}</span>
    </div>
    <div class="meta">
      <span>Total client ${money(total.revenue)}</span>
      <span>Cout achat ${money(total.cost)}</span>
      <span>Livreur ${money(total.deliveryCost)}</span>
      <span>Benefice ${money(total.profit)}</span>
    </div>
  </article>`;
}

function renderClientHistory() {
  const title = document.querySelector("#clientHistoryTitle");
  const list = document.querySelector("#clientHistoryList");
  const client = getClient(selectedClientId);

  if (!client) {
    title.textContent = "Historique client";
    list.innerHTML = "Aucun client selectionne.";
    return;
  }

  const sales = getClientSales(client.id);
  const stats = getClientStats(client.id);
  title.textContent = `Historique de ${client.name}`;

  list.innerHTML = `
    <article class="row">
      <div class="row-title"><strong>${escapeHtml(client.name)}</strong><span>${escapeHtml(client.phone)}</span></div>
      <div class="meta">
        <span>${escapeHtml(client.address || "Adresse vide")}</span>
        <span>${stats.sales} vente(s)</span>
        <span>${stats.products} produit(s)</span>
        <span>Total achete ${money(stats.spent)}</span>
      </div>
    </article>
    ${
      sales.length
        ? [...sales]
            .reverse()
            .map((sale) => {
              const total = saleTotals(sale);
              return `<article class="row">
                <div class="row-title"><strong>${formatDate(sale.date)}</strong><span>${money(total.revenue)}</span></div>
                <div class="meta"><span>${escapeHtml(saleProductSummary(total))}</span></div>
                <div class="meta"><span>Benefice ${money(total.profit)}</span><span>${sale.delivered ? "Livraison" : "Sans livraison"}</span></div>
              </article>`;
            })
            .join("")
        : `<article class="row">Aucun achat enregistre pour ce client.</article>`
    }`;
}

function getSaleDriver(sale) {
  return state.accounts.find((account) => account.id === sale.driverId) || null;
}

function getSaleDeliveryDetails(sale) {
  const client = state.clients.find((c) => c.id === sale.clientId);
  const total = saleTotals(sale);
  const driver = getSaleDriver(sale);
  const driverName = driver?.name || sale.driverName || "Livreur";
  const driverPhone = driver?.phone || sale.driverPhone || "";
  const products = total.lines.map((line) => `${line.qty} x ${line.product.name}`).join(", ");
  const address = sale.deliveryAddress || client?.address || "";
  const status = sale.deliveryStatus === "done" ? "Livree" : "En attente";
  return { client, total, driver, driverName, driverPhone, products, address, status };
}

function renderDeliveries() {
  const deliveries = state.sales.filter((sale) => sale.delivered);
  document.querySelector("#deliveriesList").innerHTML = deliveries.length
    ? deliveries.map(renderDeliveryRow).join("")
    : "Aucune livraison.";
}

function renderDeliveryRow(sale) {
  const details = getSaleDeliveryDetails(sale);
  const message = `Livraison pour ${details.client?.name || "client"}\nAdresse: ${details.address}\nProduits: ${details.products}\nA encaisser: ${money(details.total.revenue)}\nGain livreur: ${money(details.total.deliveryCost)}`;
  const phoneAction = details.driverPhone
    ? `<a target="_blank" href="${phoneLink(details.driverPhone, message)}">Envoyer au livreur</a>`
    : "";
  const statusAction =
    sale.deliveryStatus === "done"
      ? `<button type="button" data-mark-delivery-pending="${sale.id}">Remettre en attente</button>`
      : `<button type="button" data-mark-delivery-done="${sale.id}">Marquer livree</button>`;

  return `<article class="row">
    <div class="row-title">
      <strong>${escapeHtml(details.driverName)}</strong>
      <span class="tag ${sale.deliveryStatus === "done" ? "" : "warn"}">${details.status}</span>
    </div>
    <div class="meta">
      <span>${escapeHtml(details.client?.name || "Client supprime")}</span>
      <span>${escapeHtml(details.address)}</span>
      <span>${details.total.productCount} produit(s)</span>
      <span>A encaisser ${money(details.total.revenue)}</span>
      <span>Gain ${money(details.total.deliveryCost)}</span>
    </div>
    <div class="actions">
      ${phoneAction}
      ${statusAction}
    </div>
  </article>`;
}

function isSaleAssignedToDriver(sale, driver) {
  if (!driver || driver.role !== "driver") return false;
  return sale.driverId === driver.id || (driver.phone && normalizePhone(sale.driverPhone) === normalizePhone(driver.phone));
}

function getDriverSales(driver) {
  return state.sales.filter((sale) => sale.delivered && isSaleAssignedToDriver(sale, driver));
}

function renderDriverDashboard() {
  const driver = getCurrentUser();
  if (!driver || driver.role !== "driver") return;

  const sales = getDriverSales(driver);
  const totals = sales.reduce(
    (acc, sale) => {
      const total = saleTotals(sale);
      if (sale.deliveryStatus === "done") {
        acc.done += 1;
      } else {
        acc.pending += 1;
        acc.cashToCollect += total.revenue;
      }
      acc.earnings += total.deliveryCost;
      acc.products += total.productCount;
      return acc;
    },
    { pending: 0, done: 0, earnings: 0, products: 0, cashToCollect: 0 }
  );

  document.querySelector("#driverPending").textContent = totals.pending;
  document.querySelector("#driverEarnings").textContent = money(totals.earnings);
  document.querySelector("#driverCashToCollect").textContent = money(totals.cashToCollect);
  document.querySelector("#driverProducts").textContent = totals.products;
  document.querySelector("#driverDone").textContent = totals.done;
  document.querySelector("#driverDeliveriesList").innerHTML = sales.length
    ? sales.map(renderDriverDeliveryRow).join("")
    : "Aucune livraison assignee.";
}

function renderDriverDeliveryRow(sale) {
  const details = getSaleDeliveryDetails(sale);
  const clientMessage = `Bonjour ${details.client?.name || ""}, je suis votre livreur pour la commande: ${details.products}. J'arrive pour la livraison.`;
  const clientAction = details.client?.phone
    ? `<a target="_blank" href="${phoneLink(details.client.phone, clientMessage)}">Message client</a>`
    : "";
  const doneAction =
    sale.deliveryStatus === "done"
      ? `<button type="button" data-mark-delivery-pending="${sale.id}">Pas encore livree</button>`
      : `<button class="primary" type="button" data-mark-delivery-done="${sale.id}">Livraison terminee</button>`;

  return `<article class="row">
    <div class="row-title">
      <strong>${escapeHtml(details.client?.name || "Client")}</strong>
      <span class="tag ${sale.deliveryStatus === "done" ? "" : "warn"}">${details.status}</span>
    </div>
    <div class="meta">
      <span>${escapeHtml(details.address)}</span>
      <span>${escapeHtml(details.products)}</span>
      <span>A encaisser ${money(details.total.revenue)}</span>
      <span>Gain ${money(details.total.deliveryCost)}</span>
    </div>
    <div class="actions">
      ${clientAction}
      ${doneAction}
    </div>
  </article>`;
}

function getReminders() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const reminders = [];
  state.sales.forEach((sale) => {
    const client = state.clients.find((c) => c.id === sale.clientId);
    if (!client) return;
    sale.items.forEach((item) => {
      const product = item.snapshot || state.products.find((p) => p.id === item.productId);
      if (!product) return;
      const finishDate = addDays(sale.date, product.useDays);
      const finish = new Date(`${finishDate}T00:00:00`);
      reminders.push({ sale, client, product, qty: item.qty, finishDate, due: finish <= today });
    });
  });
  return reminders.sort((a, b) => a.finishDate.localeCompare(b.finishDate));
}

function renderReminders() {
  const reminders = getReminders();
  document.querySelector("#remindersList").innerHTML = reminders.length
    ? reminders
        .map((r) => {
          const message = `Bonjour ${r.client.name}, votre ${r.product.name} arrive bientot a la fin. Voulez-vous que je vous en remette un de cote ?`;
          return `<article class="row">
            <div class="row-title">
              <strong>${escapeHtml(r.client.name)} - ${escapeHtml(r.product.name)}</strong>
              <span class="tag ${r.due ? "warn" : ""}">${formatDate(r.finishDate)}</span>
            </div>
            <div class="meta"><span>${escapeHtml(r.client.phone)}</span><span>Quantite achetee: ${r.qty}</span></div>
            <div class="actions">
              <a target="_blank" href="${phoneLink(r.client.phone, message)}">Message client</a>
            </div>
          </article>`;
        })
        .join("")
    : "Aucun rappel.";
}

function addSaleItem(productId = "") {
  const template = document.querySelector("#saleItemTemplate");
  const node = template.content.firstElementChild.cloneNode(true);
  fillProductSelect(node.querySelector(".item-product"));
  if (productId) node.querySelector(".item-product").value = productId;
  document.querySelector("#saleItems").appendChild(node);
  updateSalePreview();
}

function getSaleItemsFromForm() {
  return [...document.querySelectorAll(".sale-item")].map((row) => ({
    productId: row.querySelector(".item-product").value,
    qty: Number(row.querySelector(".item-qty").value || 1),
    promoMode: row.querySelector(".item-promo").value,
  }));
}

function updateSalePreview() {
  const delivered = document.querySelector("#saleDelivery").value === "yes";
  const total = calculateSale(getSaleItemsFromForm(), delivered);
  document.querySelector("#saleTotal").textContent = money(total.revenue);
  document.querySelector("#saleProfitPreview").textContent = `Benefice prevu: ${money(total.profit)}`;
  document.querySelector("#saleCalc").innerHTML = total.lines.length
    ? `
      <div class="list">
        ${total.lines
          .map(
            (line) => `<div class="row">
              <div class="row-title"><strong>${escapeHtml(line.product.name)}</strong><span>${line.qty} x ${money(line.unitPrice)}</span></div>
              <div class="meta"><span>Vente ${money(line.lineRevenue)}</span><span>Cout ${money(line.lineCost)}</span></div>
            </div>`
          )
          .join("")}
        <div class="row">
          <strong>Resume</strong>
          <div class="meta"><span>Total: ${money(total.revenue)}</span><span>Cout produits: ${money(total.cost)}</span><span>Livreur: ${money(total.deliveryCost)}</span><span>Benefice: ${money(total.profit)}</span></div>
        </div>
      </div>`
    : "Ajoute les produits pour voir le total, les promos, le cout, la livraison et le benefice.";
}

function resetAccountForm() {
  document.querySelector("#accountForm").reset();
  document.querySelector("#accountId").value = "";
  document.querySelector("#accountRole").value = "driver";
}

function syncDriverFields() {
  const driverId = document.querySelector("#driverAccount").value;
  const driver = state.accounts.find((account) => account.id === driverId);
  if (!driver) return;
  document.querySelector("#driverName").value = driver.name;
  document.querySelector("#driverPhone").value = driver.phone || "";
}

function markDelivery(saleId, status) {
  const user = getCurrentUser();
  const sale = state.sales.find((item) => item.id === saleId);
  if (!sale) return;
  if (user.role !== "owner" && !isSaleAssignedToDriver(sale, user)) return;
  sale.deliveryStatus = status;
  sale.deliveryDoneAt = status === "done" ? todayString() : "";
  saveState();
  render();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const username = document.querySelector("#loginUsername").value.trim().toLowerCase();
  const password = document.querySelector("#loginPassword").value;
  let account = state.accounts.find(
    (item) => item.username.toLowerCase() === username && item.password === password
  );

  if (!account && defaultAccounts.some((item) => item.username === username && item.password === password)) {
    resetDefaultAccess();
    account = state.accounts.find((item) => item.username.toLowerCase() === username && item.password === password);
  }

  if (!account) {
    showLoginError("Identifiant ou mot de passe incorrect. Essaie patron / 1234, ou reinitialise les acces.");
    return;
  }

  showLoginError("");
  saveSession(account.id);
  event.target.reset();
  render();
});

document.querySelector("#resetLoginBtn").addEventListener("click", () => {
  resetDefaultAccess();
  showLoginError("Acces remis: patron / 1234 et livreur / 1234.");
});

document.addEventListener("click", (event) => {
  const tab = event.target.closest(".tab");
  if (tab) switchTab(tab.dataset.tab);

  const historyClientId = event.target.dataset.viewClientHistory;
  if (historyClientId) {
    selectedClientId = historyClientId;
    renderClientHistory();
    switchTab("clients");
  }

  if (event.target.id === "logoutBtn") {
    clearSession();
    render();
  }

  if (event.target.id === "addSaleItem") addSaleItem();

  if (event.target.classList.contains("remove-item")) {
    event.target.closest(".sale-item").remove();
    updateSalePreview();
  }

  const editProductId = event.target.dataset.editProduct;
  if (editProductId) {
    const p = state.products.find((product) => product.id === editProductId);
    document.querySelector("#productId").value = p.id;
    document.querySelector("#productName").value = p.name;
    document.querySelector("#productStock").value = p.stock;
    document.querySelector("#productCost").value = p.cost;
    document.querySelector("#productPrice").value = p.price;
    document.querySelector("#productPromoType").value = p.promoType;
    document.querySelector("#productPromoValue").value = p.promoValue;
    document.querySelector("#productUseDays").value = p.useDays;
  }

  const deleteProductId = event.target.dataset.deleteProduct;
  if (deleteProductId && confirm("Supprimer ce produit ?")) {
    state.products = state.products.filter((p) => p.id !== deleteProductId);
    saveState();
    render();
  }

  const editClientId = event.target.dataset.editClient;
  if (editClientId) {
    const c = state.clients.find((client) => client.id === editClientId);
    document.querySelector("#clientId").value = c.id;
    document.querySelector("#clientName").value = c.name;
    document.querySelector("#clientPhone").value = c.phone;
    document.querySelector("#clientAddress").value = c.address;
    document.querySelector("#clientNote").value = c.note;
  }

  const deleteClientId = event.target.dataset.deleteClient;
  if (deleteClientId && confirm("Supprimer ce client ?")) {
    state.clients = state.clients.filter((c) => c.id !== deleteClientId);
    if (selectedClientId === deleteClientId) selectedClientId = "";
    saveState();
    render();
  }

  const editAccountId = event.target.dataset.editAccount;
  if (editAccountId) {
    const account = state.accounts.find((item) => item.id === editAccountId);
    document.querySelector("#accountId").value = account.id;
    document.querySelector("#accountName").value = account.name;
    document.querySelector("#accountUsername").value = account.username;
    document.querySelector("#accountPassword").value = account.password;
    document.querySelector("#accountRole").value = account.role;
    document.querySelector("#accountPhone").value = account.phone;
  }

  const deleteAccountId = event.target.dataset.deleteAccount;
  if (deleteAccountId && !event.target.disabled && confirm("Supprimer ce compte ?")) {
    state.accounts = state.accounts.filter((account) => account.id !== deleteAccountId);
    saveState();
    render();
  }

  if (event.target.id === "resetAccountForm") resetAccountForm();

  const doneSaleId = event.target.dataset.markDeliveryDone;
  if (doneSaleId) markDelivery(doneSaleId, "done");

  const pendingSaleId = event.target.dataset.markDeliveryPending;
  if (pendingSaleId) markDelivery(pendingSaleId, "pending");

  if (event.target.id === "ownerMessageBtn") {
    const alerts = [...document.querySelectorAll("#alertsList .row")].map((row) => row.textContent.trim());
    const message = alerts.length ? `Alertes boutique:\n- ${alerts.join("\n- ")}` : "Aucune alerte boutique.";
    navigator.clipboard?.writeText(message);
    alert("Message copie. Tu peux le coller dans WhatsApp ou SMS.");
  }
});

document.addEventListener("input", (event) => {
  if (event.target.closest("#saleForm")) updateSalePreview();
});

document.addEventListener("change", (event) => {
  if (event.target.id === "driverAccount") syncDriverFields();
});

document.querySelector("#productForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#productId").value || uid("prd");
  const product = {
    id,
    name: document.querySelector("#productName").value.trim(),
    stock: Number(document.querySelector("#productStock").value),
    cost: Number(document.querySelector("#productCost").value),
    price: Number(document.querySelector("#productPrice").value),
    promoType: document.querySelector("#productPromoType").value,
    promoValue: Number(document.querySelector("#productPromoValue").value || 0),
    useDays: Number(document.querySelector("#productUseDays").value || 30),
  };
  state.products = state.products.some((p) => p.id === id)
    ? state.products.map((p) => (p.id === id ? product : p))
    : [...state.products, product];
  event.target.reset();
  document.querySelector("#productId").value = "";
  saveState();
  render();
});

document.querySelector("#clientForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#clientId").value || uid("cli");
  const client = {
    id,
    name: document.querySelector("#clientName").value.trim(),
    phone: document.querySelector("#clientPhone").value.trim(),
    address: document.querySelector("#clientAddress").value.trim(),
    note: document.querySelector("#clientNote").value.trim(),
  };
  state.clients = state.clients.some((c) => c.id === id)
    ? state.clients.map((c) => (c.id === id ? client : c))
    : [...state.clients, client];
  event.target.reset();
  document.querySelector("#clientId").value = "";
  saveState();
  render();
});

document.querySelector("#accountForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const id = document.querySelector("#accountId").value || uid("usr");
  const username = document.querySelector("#accountUsername").value.trim();
  const duplicate = state.accounts.find(
    (account) => account.username.toLowerCase() === username.toLowerCase() && account.id !== id
  );

  if (duplicate) {
    alert("Cet identifiant existe deja.");
    return;
  }

  const account = {
    id,
    name: document.querySelector("#accountName").value.trim(),
    username,
    password: document.querySelector("#accountPassword").value,
    role: document.querySelector("#accountRole").value,
    phone: document.querySelector("#accountPhone").value.trim(),
  };
  state.accounts = state.accounts.some((item) => item.id === id)
    ? state.accounts.map((item) => (item.id === id ? account : item))
    : [...state.accounts, account];
  saveState();
  resetAccountForm();
  render();
});

document.querySelector("#saleForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const items = getSaleItemsFromForm();
  const delivered = document.querySelector("#saleDelivery").value === "yes";
  const total = calculateSale(items, delivered);
  const outOfStock = total.lines.find((line) => {
    const currentProduct = state.products.find((product) => product.id === line.product.id);
    return currentProduct && line.qty > currentProduct.stock;
  });

  if (outOfStock) {
    alert(`Stock insuffisant pour ${outOfStock.product.name}.`);
    return;
  }

  const driverId = delivered ? document.querySelector("#driverAccount").value : "";
  const driver = state.accounts.find((account) => account.id === driverId);
  const sale = {
    id: uid("sale"),
    clientId: document.querySelector("#saleClient").value,
    date: document.querySelector("#saleDate").value,
    delivered,
    deliveryStatus: delivered ? "pending" : "",
    deliveryDoneAt: "",
    driverId,
    driverName: delivered ? driver?.name || document.querySelector("#driverName").value.trim() : "",
    driverPhone: delivered ? driver?.phone || document.querySelector("#driverPhone").value.trim() : "",
    deliveryAddress: delivered ? document.querySelector("#deliveryAddress").value.trim() : "",
    items: items.map((item) => {
      const product = state.products.find((p) => p.id === item.productId);
      return {
        ...item,
        snapshot: { ...product },
        unitPrice: priceForProduct(product, item.promoMode),
      };
    }),
  };

  sale.items.forEach((item) => {
    const product = state.products.find((p) => p.id === item.productId);
    product.stock -= item.qty;
  });
  state.sales.push(sale);
  saveState();
  document.querySelector("#saleItems").innerHTML = "";
  addSaleItem();
  event.target.reset();
  setToday();
  render();
  switchTab("dashboard");
});

document.querySelector("#exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `gestion-beaute-${todayString()}.json`;
  link.click();
  URL.revokeObjectURL(url);
});

document.querySelector("#importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  state = normalizeState(JSON.parse(await file.text()));
  if (currentUserId && !getCurrentUser()) clearSession();
  saveState();
  render();
});

saveState();
setToday();
addSaleItem();
render();
