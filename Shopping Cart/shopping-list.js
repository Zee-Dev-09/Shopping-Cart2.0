const storageKey = "lilac-shopping-list";
const initialItems = ["Rice", "Milk", "Bread", "Eggs"];
let list = initialItems.map(name => ({ name, checked: false }));
let filter = "all";
let storageAvailable = true;

try {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (!Array.isArray(parsed) || !parsed.every(item => item &&
            typeof item.name === "string" && item.name.trim().length > 0 &&
            item.name.length <= 120 && typeof item.checked === "boolean")) {
            throw new Error("Invalid saved list");
        }
        // Older saved lists have no price; keep them and mark them unpriced.
        list = parsed.map(item => ({ ...item, price: validPrice(item.price) ? item.price : null }));
    }
} catch {
    storageAvailable = false;
}

function validPrice(value) {
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 999999999;
}

const money = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN" });
const priceInput = document.getElementById("price-input");

function updateTotals() {
    // Add whole kobo to avoid decimal rounding errors.
    const total = list.reduce((sum, item) => sum + (validPrice(item.price) ? Math.round(item.price * 100) : 0), 0);
    const remaining = list.reduce((sum, item) => sum + (!item.checked && validPrice(item.price) ? Math.round(item.price * 100) : 0), 0);
    const unpriced = list.filter(item => !validPrice(item.price)).length;
    document.getElementById("expected-total").textContent = money.format(total / 100);
    const remainingLine = document.getElementById("remaining-total");
    remainingLine.textContent = `${money.format(remaining / 100)} left to buy`;
    remainingLine.hidden = !list.some(item => item.checked);
    const unpricedLine = document.getElementById("unpriced-count");
    unpricedLine.textContent = `${unpriced} ${unpriced === 1 ? "item without a price" : "items without prices"}`;
    unpricedLine.hidden = unpriced === 0;
}

const form = document.getElementById("item-form");
const input = document.getElementById("item-input");
const items = document.getElementById("items");
const search = document.getElementById("search");
const feedback = document.getElementById("feedback");
const clearButton = document.getElementById("clear-completed");

function announce(message) {
    feedback.className = storageAvailable ? "sr-only" : "hint";
    feedback.textContent = storageAvailable
        ? message
        : `${message} Changes cannot be saved in this browser session.`;
}

function saveList() {
    try {
        localStorage.setItem(storageKey, JSON.stringify(list));
        storageAvailable = true;
    } catch {
        storageAvailable = false;
    }
}

function renderList(focusIndex = null) {
    items.replaceChildren();
    const query = search.value.trim().toLocaleLowerCase();
    list.forEach((item, index) => {
        if (!item.name.toLocaleLowerCase().includes(query)) return;
        if (filter === "pending" && item.checked) return;
        if (filter === "completed" && !item.checked) return;

        const row = document.createElement("li");
        const label = document.createElement("label");
        label.className = "item-label";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = item.checked;
        checkbox.addEventListener("change", () => {
            item.checked = checkbox.checked;
            saveList();
            renderList(index);
            announce(item.checked ? `${item.name} completed.` : `${item.name} moved to your to-buy list.`);
        });
        const name = document.createElement("span");
        name.textContent = item.name;
        label.append(checkbox, name);

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-button";
        remove.textContent = "\u00d7";
        remove.setAttribute("aria-label", `Remove ${item.name}`);
        remove.addEventListener("click", () => {
            const position = [...items.children].indexOf(row);
            list.splice(index, 1);
            saveList();
            renderList();
            const next = items.children[Math.min(position, items.children.length - 1)];
            if (next) next.querySelector(".remove-button").focus();
            else input.focus();
            announce(`${item.name} removed.`);
        });
        const priceField = document.createElement("label");
        priceField.className = "item-price";
        const price = document.createElement("input");
        price.type = "number";
        price.min = "0";
        price.max = "999999999";
        price.step = "0.01";
        price.inputMode = "decimal";
        price.placeholder = "Add price";
        price.value = validPrice(item.price) ? item.price.toFixed(2) : "";
        price.setAttribute("aria-label", `Expected price for ${item.name} in naira`);
        price.addEventListener("input", () => {
            if (!price.validity.valid) return;
            item.price = price.value === "" ? null : Math.round(price.valueAsNumber * 100) / 100;
            saveList();
            updateTotals();
            if (!storageAvailable) announce("Price updated.");
        });
        price.addEventListener("change", () => {
            if (!price.reportValidity()) return;
            if (validPrice(item.price)) price.value = item.price.toFixed(2);
        });
        priceField.append(price);
        row.append(label, priceField, remove);
        items.append(row);
        if (focusIndex === index) checkbox.focus();
    });

    updateTotals();
    const completed = list.filter(item => item.checked).length;
    document.getElementById("item-count").textContent = `${list.length - completed} of ${list.length} remaining`;
    const progress = document.getElementById("progress");
    progress.value = list.length ? completed / list.length * 100 : 0;
    progress.setAttribute("aria-valuetext", `${completed} of ${list.length} items completed`);
    clearButton.disabled = completed === 0;
    const empty = document.getElementById("empty-message");
    empty.hidden = items.children.length > 0;
    empty.textContent = list.length ? "No items match this view." : "A fresh start. Add your first item above.";
    if (focusIndex !== null && !items.contains(document.activeElement)) {
        const next = items.querySelector('input[type="checkbox"]');
        if (next) next.focus();
        else document.querySelector(`[data-filter="${filter}"]`).focus();
    }
}

form.addEventListener("submit", event => {
    event.preventDefault();
    const name = input.value.trim();
    if (!name) {
        input.value = "";
        input.focus();
        return;
    }
    const price = priceInput.value === "" ? null : Math.round(priceInput.valueAsNumber * 100) / 100;
    if (price !== null && !validPrice(price)) return;
    list.push({ name, checked: false, price });
    search.value = "";
    setFilter("all");
    saveList();
    renderList();
    form.reset();
    input.focus();
    announce(`${name} added.`);
});

function setFilter(value) {
    filter = value;
    document.querySelectorAll("[data-filter]").forEach(button => {
        button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
    });
}

document.querySelectorAll("[data-filter]").forEach(button => {
    button.addEventListener("click", () => {
        setFilter(button.dataset.filter);
        renderList();
    });
});
search.addEventListener("input", () => renderList());
clearButton.addEventListener("click", () => {
    const count = list.filter(item => item.checked).length;
    list = list.filter(item => !item.checked);
    saveList();
    renderList();
    document.querySelector(`[data-filter="${filter}"]`).focus();
    announce(`${count} completed ${count === 1 ? "item" : "items"} cleared.`);
});

renderList();
if (!storageAvailable) announce("Your list is ready.");

// Keep each pupil within its eye while looking toward the pointer.
const catEyes = [...document.querySelectorAll(".cat-eye")];
let eyeFrame = null;
let pointerPosition = null;

function updateCatEyes() {
    eyeFrame = null;
    catEyes.forEach(eye => {
        const bounds = eye.getBoundingClientRect();
        let x = 0;
        let y = 0;
        if (pointerPosition) {
            const dx = pointerPosition.x - (bounds.left + bounds.width / 2);
            const dy = pointerPosition.y - (bounds.top + bounds.height / 2);
            const distance = Math.hypot(dx, dy);
            const strength = Math.min(distance / 140, 1);
            if (distance > 0) {
                x = dx / distance * bounds.width * 0.065 * strength;
                y = dy / distance * bounds.height * 0.055 * strength;
            }
        }
        eye.style.setProperty("--look-x", `${x}px`);
        eye.style.setProperty("--look-y", `${y}px`);
    });
}

function scheduleCatEyes() {
    if (eyeFrame === null) eyeFrame = requestAnimationFrame(updateCatEyes);
}

document.addEventListener("pointermove", event => {
    pointerPosition = { x: event.clientX, y: event.clientY };
    scheduleCatEyes();
}, { passive: true });

function resetCatEyes() {
    pointerPosition = null;
    scheduleCatEyes();
}

document.documentElement.addEventListener("pointerleave", resetCatEyes);
document.addEventListener("pointercancel", resetCatEyes);
window.addEventListener("blur", resetCatEyes);
window.addEventListener("resize", scheduleCatEyes, { passive: true });
window.addEventListener("scroll", scheduleCatEyes, { passive: true });


// Little rituals for Mochi's cottage.
const kittenRoom = document.querySelector(".kitten-room");
const catMessage = document.getElementById("cat-message");
let cuddleTimer;
function showCatAffection(message) {
    catMessage.textContent = message;
    kittenRoom.classList.remove("is-loved");
    requestAnimationFrame(() => {
        requestAnimationFrame(() => kittenRoom.classList.add("is-loved"));
    });
    clearTimeout(cuddleTimer);
    cuddleTimer = setTimeout(() => kittenRoom.classList.remove("is-loved"), 1400);
}
document.getElementById("pet-cat").addEventListener("click", () => {
    showCatAffection("Prrr… Mochi is very happy you're here. ♡");
});
document.getElementById("treat-cat").addEventListener("click", () => {
    showCatAffection("A tiny treat, a very happy kitten. Thank you! ✧");
});
document.getElementById("room-light").addEventListener("click", event => {
    const evening = document.body.classList.toggle("evening");
    event.currentTarget.setAttribute("aria-pressed", String(evening));
    event.currentTarget.textContent = evening ? "☀ Morning light" : "☾ Evening light";
    catMessage.textContent = evening ? "The cottage is settling in for a cozy evening." : "A little sunshine for a lovely day.";
});
