let products = [
  {
    id: "oleo-essencial",
    name: "Óleo Essencial de Lavanda",
    brand: "Alma Botânica",
    category: "bem-estar",
    tag: "Mais amado",
    price: 68,
    image: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=800&q=80",
    alt: "Frasco de óleo essencial natural",
  },
  {
    id: "shampoo-nutritivo",
    name: "Shampoo Nutritivo Botânico",
    brand: "Raiz & Flor",
    category: "cabelo",
    tag: "Uso diário",
    price: 82,
    image: "https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=800&q=80",
    alt: "Produtos botânicos para cuidado dos cabelos",
  },
  {
    id: "creme-facial",
    name: "Creme Facial Calmante",
    brand: "Casa Serena",
    category: "pele",
    tag: "Novo",
    price: 96,
    image: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=800&q=80",
    alt: "Creme natural para cuidados com a pele",
  },
  {
    id: "mascara-hidratacao",
    name: "Máscara de Hidratação Profunda",
    brand: "Raiz & Flor",
    category: "cabelo",
    tag: "",
    price: 114,
    image: "https://images.unsplash.com/photo-1556229010-6c3f2c9ca5f8?auto=format&fit=crop&w=800&q=80",
    alt: "Máscara de tratamento em pote",
  },
];

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const grid = document.querySelector(".product-grid");
const searchInput = document.querySelector("#product-search");
const categoryButtons = [...document.querySelectorAll(".category-button")];
const cart = new Map();
let activeCategory = "todos";
let toastTimer;
let supabaseClient = null;
let isAdmin = false;
let adminImageObjectUrl = "";

const adminDialog = document.querySelector(".admin-dialog");
const adminBackdrop = document.querySelector(".admin-backdrop");
const adminLogin = document.querySelector(".admin-login");
const adminManagement = document.querySelector(".admin-management");
const adminProductForm = document.querySelector(".admin-product-form");
const adminImageInput = adminProductForm.elements.image;
const adminImagePreview = document.querySelector(".admin-image-preview");
const adminFormError = document.querySelector(".admin-form-error");
const productImageBucket = "product-images";
const maxProductImageBytes = 5 * 1024 * 1024;
const productImageExtensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

function clearAdminImagePreview() {
  if (adminImageObjectUrl) URL.revokeObjectURL(adminImageObjectUrl);
  adminImageObjectUrl = "";
  adminImagePreview.querySelector("img").removeAttribute("src");
  adminImagePreview.querySelector("p").textContent = "";
  adminImagePreview.hidden = true;
}

function showAdminImagePreview(src, message) {
  adminImagePreview.querySelector("img").src = src;
  adminImagePreview.querySelector("p").textContent = message;
  adminImagePreview.hidden = false;
}

function validateProductImage(file) {
  if (!productImageExtensions[file.type]) {
    return "Escolha uma imagem JPG, PNG ou WebP.";
  }
  if (file.size > maxProductImageBytes) {
    return "A imagem deve ter no máximo 5 MB.";
  }
  return "";
}

async function uploadProductImage(file) {
  const extension = productImageExtensions[file.type];
  const path = `products/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await supabaseClient.storage
    .from(productImageBucket)
    .upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
  if (error) throw error;
  const { data: publicData } = supabaseClient.storage.from(productImageBucket).getPublicUrl(data.path);
  return { path: data.path, url: publicData.publicUrl };
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function renderProducts() {
  const query = searchInput.value.trim().toLocaleLowerCase("pt-BR");
  const visibleProducts = products.filter((product) => {
    const matchesCategory = activeCategory === "todos" || product.category === activeCategory;
    const matchesSearch = `${product.name} ${product.brand}`.toLocaleLowerCase("pt-BR").includes(query);
    return matchesCategory && matchesSearch;
  });

  grid.innerHTML = visibleProducts.map((product) => `
    <article class="product-card">
      <div class="product-image">
        <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.alt)}" loading="lazy" />
        ${product.tag ? `<span class="product-tag">${escapeHtml(product.tag)}</span>` : ""}
        <button class="quick-add" type="button" data-add="${escapeHtml(product.id)}">Adicionar</button>
      </div>
      <div class="product-info">
        <p class="product-brand">${escapeHtml(product.brand)}</p>
        <h3 class="product-name">${escapeHtml(product.name)}</h3>
        <div class="product-bottom">
          <span class="product-price">${currency.format(product.price)}<small>ou 2x sem juros</small></span>
        </div>
        ${isAdmin ? `<div class="product-admin-actions"><button type="button" data-edit="${escapeHtml(product.id)}">Editar produto</button></div>` : ""}
      </div>
    </article>
  `).join("");
  document.querySelector(".empty-message").hidden = visibleProducts.length > 0;
  document.querySelector(".admin-add-product").hidden = !isAdmin;
}

function getCartCount() {
  return [...cart.values()].reduce((total, item) => total + item.quantity, 0);
}

function getWhatsAppOrderUrl() {
  const items = [...cart.values()];
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  const orderLines = items.map(({ product, quantity }) =>
    `${quantity}x ${product.name} - ${currency.format(product.price * quantity)}`
  );
  const message = [
    "Olá! Gostaria de finalizar este pedido no Refúgio Botânico:",
    "",
    ...orderLines,
    "",
    `Total: ${currency.format(subtotal)}`,
    "",
    "Podem me ajudar a concluir?",
  ].join("\n");

  return `https://wa.me/5565992128239?text=${encodeURIComponent(message)}`;
}

function renderCart() {
  const count = getCartCount();
  const items = [...cart.values()];
  document.querySelector(".cart-count").textContent = count;
  document.querySelector(".drawer-count").textContent = `(${count})`;
  document.querySelector(".cart-empty").hidden = items.length > 0;
  document.querySelector(".cart-items").innerHTML = items.map(({ product, quantity }) => `
    <article class="cart-row">
      <img src="${escapeHtml(product.image)}" alt="" />
      <div>
        <h3>${escapeHtml(product.name)}</h3>
        <p>${currency.format(product.price)}</p>
        <div class="quantity-control" aria-label="Quantidade de ${escapeHtml(product.name)}">
          <button type="button" data-quantity="${product.id}" data-change="-1" aria-label="Diminuir quantidade">Diminuir</button>
          <span>${quantity}</span>
          <button type="button" data-quantity="${product.id}" data-change="1" aria-label="Aumentar quantidade">Aumentar</button>
        </div>
      </div>
      <div class="cart-row-price">
        ${currency.format(product.price * quantity)}
        <button class="remove-item" type="button" data-remove="${product.id}">Remover</button>
      </div>
    </article>
  `).join("");
  const subtotal = items.reduce((total, item) => total + item.product.price * item.quantity, 0);
  document.querySelector(".cart-total strong").textContent = currency.format(subtotal);
  document.querySelector(".checkout-button").textContent = items.length > 0 ? "Finalizar pedido" : "Continuar comprando";
}

function setCartOpen(isOpen) {
  const drawer = document.querySelector(".cart-drawer");
  const backdrop = document.querySelector(".cart-backdrop");
  drawer.classList.toggle("is-open", isOpen);
  drawer.inert = !isOpen;
  backdrop.hidden = !isOpen;
  drawer.setAttribute("aria-hidden", String(!isOpen));
  document.body.classList.toggle("cart-open", isOpen);
  if (isOpen) {
    requestAnimationFrame(() => backdrop.classList.add("is-open"));
    document.querySelector(".close-cart").focus();
  } else {
    backdrop.classList.remove("is-open");
    document.querySelector(".cart-trigger").focus();
  }
}

function showToast(message) {
  const toast = document.querySelector(".toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2300);
}

function setAdminDialogOpen(isOpen) {
  adminDialog.classList.toggle("is-open", isOpen);
  adminDialog.inert = !isOpen;
  adminDialog.setAttribute("aria-hidden", String(!isOpen));
  adminBackdrop.hidden = !isOpen;
  document.body.classList.toggle("admin-open", isOpen);
  if (isOpen) {
    requestAnimationFrame(() => adminBackdrop.classList.add("is-open"));
    (isAdmin ? document.querySelector(".admin-close") : adminLogin.querySelector("input"))?.focus();
  } else {
    adminBackdrop.classList.remove("is-open");
    document.querySelector(".brand")?.focus();
  }
}

function openAdminDialog() {
  adminProductForm.hidden = true;
  adminManagement.hidden = !isAdmin;
  adminLogin.hidden = isAdmin;
  const status = document.querySelector(".admin-status");
  if (!supabaseClient) {
    adminLogin.hidden = true;
    adminManagement.hidden = true;
    status.textContent = "O acesso administrativo ainda não está configurado. Adicione a URL e a chave pública do Supabase em supabase-config.js e aplique as instruções de configuração do README.";
  } else if (isAdmin) {
    status.textContent = "Você está autenticado como administrador. As alterações são salvas no catálogo online.";
    renderAdminProductList();
  } else {
    status.textContent = "Entre com a conta de administrador para editar o catálogo.";
  }
  setAdminDialogOpen(true);
}

async function loadCatalog() {
  const { data, error } = await supabaseClient
    .from("products")
    .select("id,name,brand,category,tag,price,image_url,image_path,alt_text")
    .order("name");
  if (error) throw error;

  products = data.map((product) => ({
    id: product.id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    tag: product.tag || "",
    price: Number(product.price),
    image: product.image_url,
    imagePath: product.image_path,
    alt: product.alt_text,
  }));
  for (const item of cart.values()) {
    const updatedProduct = products.find((product) => product.id === item.product.id);
    if (updatedProduct) item.product = updatedProduct;
  }
  renderProducts();
  renderCart();
}

function renderAdminProductList() {
  const list = document.querySelector(".admin-product-list");
  list.innerHTML = products.map((product) => `
    <div class="admin-product-entry">
      <span>${escapeHtml(product.name)}</span>
      <div><button type="button" data-admin-edit="${escapeHtml(product.id)}">Editar</button></div>
    </div>
  `).join("");
}

function openProductEditor(productId = "") {
  if (!isAdmin) return;
  const product = products.find((item) => item.id === productId);
  adminManagement.hidden = true;
  adminProductForm.hidden = false;
  adminProductForm.reset();
  clearAdminImagePreview();
  adminProductForm.elements.id.value = product?.id || "";
  adminProductForm.elements.name.value = product?.name || "";
  adminProductForm.elements.brand.value = product?.brand || "";
  adminProductForm.elements.category.value = product?.category || "cabelo";
  adminProductForm.elements.price.value = product?.price ?? "";
  adminProductForm.elements.tag.value = product?.tag || "";
  adminProductForm.elements.image_path.value = product?.imagePath || "";
  adminImageInput.required = !product;
  if (product) showAdminImagePreview(product.image, "Foto atual. Selecione outra para substituí-la.");
  adminProductForm.elements.alt.value = product?.alt || "";
  document.querySelector(".admin-form-title").textContent = product ? "Editar produto" : "Novo produto";
  adminFormError.hidden = true;
  adminProductForm.elements.name.focus();
}

adminImageInput.addEventListener("change", () => {
  const file = adminImageInput.files[0];
  if (!file) return;
  const validationError = validateProductImage(file);
  if (validationError) {
    adminFormError.textContent = validationError;
    adminFormError.hidden = false;
    adminImageInput.value = "";
    return;
  }
  adminFormError.hidden = true;
  clearAdminImagePreview();
  adminImageObjectUrl = URL.createObjectURL(file);
  showAdminImagePreview(adminImageObjectUrl, "Nova foto selecionada.");
});

async function refreshAdminSession(session) {
  isAdmin = session?.user?.app_metadata?.role === "admin";
  if (session && !isAdmin) {
    document.querySelector(".admin-status").textContent = "Esta conta não tem permissão de administrador.";
  }
  renderProducts();
  if (adminDialog.classList.contains("is-open")) {
    adminLogin.hidden = isAdmin;
    adminManagement.hidden = !isAdmin;
    adminProductForm.hidden = true;
    if (isAdmin) {
      document.querySelector(".admin-status").textContent = "Você está autenticado como administrador. As alterações são salvas no catálogo online.";
      renderAdminProductList();
    }
  }
}

async function initializeSupabase() {
  const config = window.REFUGIO_SUPABASE;
  if (!config?.url || !config?.anonKey) return;
  if (!window.supabase?.createClient) {
    throw new Error("Não foi possível carregar o cliente Supabase. Verifique a conexão e recarregue a página.");
  }

  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  await refreshAdminSession(data.session);
  await loadCatalog();
  supabaseClient.auth.onAuthStateChange((_event, session) => {
    window.setTimeout(() => {
      refreshAdminSession(session).catch((error) => {
        console.error("Falha ao atualizar o acesso de administrador.", error);
        showToast("Não foi possível atualizar a sessão administrativa.");
      });
    }, 0);
  });
}

grid.addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-edit]");
  if (editButton && isAdmin) {
    openProductEditor(editButton.dataset.edit);
    return;
  }
  const addButton = event.target.closest("[data-add]");
  if (!addButton) return;
  const product = products.find(({ id }) => id === addButton.dataset.add);
  if (!product) return;
  const existing = cart.get(product.id);
  cart.set(product.id, { product, quantity: existing ? existing.quantity + 1 : 1 });
  renderCart();
  showToast(`${product.name} adicionado à sacola`);
});

document.querySelectorAll(".brand-logo").forEach((logo) => {
  logo.addEventListener("dblclick", (event) => {
    event.preventDefault();
    openAdminDialog();
  });
});

document.querySelector(".admin-close").addEventListener("click", () => setAdminDialogOpen(false));
adminBackdrop.addEventListener("click", () => setAdminDialogOpen(false));
document.querySelector(".admin-add-product").addEventListener("click", () => openProductEditor());
document.querySelector(".admin-new-product").addEventListener("click", () => openProductEditor());
document.querySelector(".admin-product-list").addEventListener("click", (event) => {
  const editButton = event.target.closest("[data-admin-edit]");
  if (editButton) openProductEditor(editButton.dataset.adminEdit);
});
document.querySelector("[data-cancel-product]").addEventListener("click", () => {
  clearAdminImagePreview();
  adminImageInput.value = "";
  adminProductForm.hidden = true;
  adminManagement.hidden = false;
});

adminLogin.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!supabaseClient) return;
  const submitButton = adminLogin.querySelector('button[type="submit"]');
  const status = document.querySelector(".admin-status");
  submitButton.disabled = true;
  status.textContent = "Verificando acesso...";
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: adminLogin.elements.email.value.trim(),
      password: adminLogin.elements.password.value,
    });
    if (error) {
      status.textContent = error.message === "Invalid login credentials"
        ? "E-mail ou senha inválidos."
        : "Não foi possível entrar. Confira a configuração e tente novamente.";
      console.error("Falha no login administrativo.", error);
    } else await refreshAdminSession(data.session);
  } catch (error) {
    status.textContent = "Não foi possível conectar para validar o acesso.";
    console.error("Falha de conexão durante o login administrativo.", error);
  } finally {
    submitButton.disabled = false;
  }
});

document.querySelector(".admin-logout").addEventListener("click", async () => {
  try {
    const { error } = await supabaseClient.auth.signOut();
    if (error) throw error;
    adminLogin.reset();
    setAdminDialogOpen(false);
  } catch (error) {
    console.error("Falha ao encerrar a sessão administrativa.", error);
    showToast("Não foi possível encerrar a sessão.");
    return;
  }
});

adminProductForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!isAdmin || !supabaseClient) return;
  const form = adminProductForm;
  const imageFile = adminImageInput.files[0] || null;
  if (imageFile && validateProductImage(imageFile)) {
    adminFormError.textContent = validateProductImage(imageFile);
    adminFormError.hidden = false;
    return;
  }
  if (!imageFile && !form.elements.image_path.value) {
    adminFormError.textContent = "Escolha uma foto para o produto.";
    adminFormError.hidden = false;
    return;
  }

  const productId = form.elements.id.value || crypto.randomUUID();
  const button = form.querySelector('button[type="submit"]');
  const previousImagePath = form.elements.image_path.value;
  let uploadedImage = null;
  const product = {
    id: productId,
    name: form.elements.name.value.trim(),
    brand: form.elements.brand.value.trim(),
    category: form.elements.category.value,
    price: Number(form.elements.price.value),
    tag: form.elements.tag.value.trim() || null,
    image_url: "",
    image_path: previousImagePath || null,
    alt_text: form.elements.alt.value.trim(),
  };
  button.disabled = true;
  adminFormError.hidden = true;
  let productSaved = false;
  try {
    if (imageFile) {
      uploadedImage = await uploadProductImage(imageFile);
      product.image_url = uploadedImage.url;
      product.image_path = uploadedImage.path;
    } else {
      product.image_url = products.find((item) => item.id === productId)?.image || "";
    }
    const { error } = await supabaseClient.from("products").upsert(product);
    if (error) throw error;
    productSaved = true;
    let cleanupWarning = false;
    if (previousImagePath && uploadedImage) {
      const { error: deleteError } = await supabaseClient.storage
        .from(productImageBucket)
        .remove([previousImagePath]);
      if (deleteError) {
        cleanupWarning = true;
        console.error("Produto salvo, mas não foi possível remover a imagem anterior.", deleteError);
      }
    }
    await loadCatalog();
    renderAdminProductList();
    adminProductForm.hidden = true;
    adminManagement.hidden = false;
    showToast(cleanupWarning ? "Produto salvo, mas a foto anterior não foi removida." : "Produto salvo no catálogo.");
  } catch (error) {
    if (uploadedImage && !productSaved) {
      try {
        const { error: cleanupError } = await supabaseClient.storage
          .from(productImageBucket)
          .remove([uploadedImage.path]);
        if (cleanupError) console.error("Não foi possível remover a imagem enviada após a falha ao salvar.", cleanupError);
      } catch (cleanupError) {
        console.error("Não foi possível remover a imagem enviada após a falha ao salvar.", cleanupError);
      }
    }
    console.error("Falha ao salvar o produto.", error);
    adminFormError.textContent = productSaved
      ? "Produto salvo, mas o catálogo não pôde ser atualizado. Feche e abra o painel novamente."
      : "Não foi possível salvar. Verifique sua conexão e as permissões do catálogo.";
    adminFormError.hidden = false;
  } finally {
    button.disabled = false;
  }
});

categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeCategory = button.dataset.category;
    categoryButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    renderProducts();
  });
});

searchInput.addEventListener("input", renderProducts);
document.querySelector(".cart-trigger").addEventListener("click", () => setCartOpen(true));
document.querySelector(".close-cart").addEventListener("click", () => setCartOpen(false));
document.querySelector(".cart-backdrop").addEventListener("click", () => setCartOpen(false));
document.querySelector(".cart-items").addEventListener("click", (event) => {
  const removeButton = event.target.closest("[data-remove]");
  const quantityButton = event.target.closest("[data-quantity]");
  const productId = removeButton?.dataset.remove || quantityButton?.dataset.quantity;
  if (!productId) return;
  const item = cart.get(productId);
  if (!item) return;
  if (removeButton) cart.delete(productId);
  else {
    const quantity = item.quantity + Number(quantityButton.dataset.change);
    if (quantity < 1) cart.delete(productId);
    else cart.set(productId, { ...item, quantity });
  }
  renderCart();
});

document.querySelector(".checkout-button").addEventListener("click", () => {
  if (cart.size === 0) {
    setCartOpen(false);
    return;
  }
  window.location.href = getWhatsAppOrderUrl();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && adminDialog.classList.contains("is-open")) {
    setAdminDialogOpen(false);
    return;
  }
  if (event.key === "Tab" && adminDialog.classList.contains("is-open")) {
    const focusableElements = [...adminDialog.querySelectorAll("button:not([disabled]), input:not([disabled]), select:not([disabled])")]
      .filter((element) => !element.closest("[hidden]"));
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
  const drawer = document.querySelector(".cart-drawer");
  if (!drawer.classList.contains("is-open")) return;
  if (event.key === "Escape") {
    setCartOpen(false);
    return;
  }
  if (event.key === "Tab") {
    const focusableElements = [...drawer.querySelectorAll("button:not([disabled])")];
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }
});

renderProducts();
renderCart();
initializeSupabase().catch((error) => {
  console.error("Falha ao inicializar o catálogo online.", error);
  document.querySelector(".admin-status").textContent = "Não foi possível conectar ao catálogo online. Verifique a configuração do Supabase.";
  showToast("Falha ao carregar o catálogo online.");
});
