/**
 * ============================================================
 * Native-Style Toast Notification System
 * ============================================================
 * Replaces ugly browser alert() dialogs with beautiful
 * in-app toast notifications — just like native mobile apps.
 *
 * USAGE (from anywhere in the app):
 *   import { showToast } from "@/lib/toast";
 *   showToast("Location verified!", "success");
 *   showToast("Camera access denied", "error");
 *   showToast("Loading...", "info");
 *   showToast("Are you sure?", "warning");
 *
 * AUTO-OVERRIDE: window.alert() is also automatically patched
 * to use this system after calling installToastSystem().
 * ============================================================
 */

export type ToastType = "success" | "error" | "warning" | "info";

interface ToastOptions {
  duration?: number; // ms, default 4000
  type?: ToastType;
}

// ─── Toast Container ─────────────────────────────────────────────────────────
function getOrCreateContainer(): HTMLElement {
  let container = document.getElementById("hosteleaze-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "hosteleaze-toast-container";
    container.style.cssText = `
      position: fixed;
      top: 0;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      padding: 16px;
      pointer-events: none;
      width: 100%;
      max-width: 420px;
    `;
    document.body.appendChild(container);

    // Inject CSS for animations
    if (!document.getElementById("hosteleaze-toast-styles")) {
      const style = document.createElement("style");
      style.id = "hosteleaze-toast-styles";
      style.textContent = `
        @keyframes hl-toast-in {
          from { opacity: 0; transform: translateY(-20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0px) scale(1); }
        }
        @keyframes hl-toast-out {
          from { opacity: 1; transform: translateY(0px) scale(1); }
          to   { opacity: 0; transform: translateY(-10px) scale(0.95); }
        }
        .hl-toast {
          animation: hl-toast-in 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards;
        }
        .hl-toast.hl-toast-leaving {
          animation: hl-toast-out 0.25s ease forwards;
        }
      `;
      document.head.appendChild(style);
    }
  }
  return container;
}

// ─── Icon SVGs ────────────────────────────────────────────────────────────────
function getIcon(type: ToastType): string {
  const icons: Record<ToastType, string> = {
    success: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  return icons[type];
}

// ─── Colors ───────────────────────────────────────────────────────────────────
function getColors(type: ToastType) {
  const colors: Record<ToastType, { bg: string; border: string; icon: string; text: string; bar: string }> = {
    success: { bg: "#0f2d1f", border: "rgba(0,255,136,0.35)", icon: "#00ff88", text: "#e8fff5", bar: "#00ff88" },
    error:   { bg: "#2d0f0f", border: "rgba(255,80,80,0.35)",  icon: "#ff5050", text: "#fff0f0", bar: "#ff5050" },
    warning: { bg: "#2d200f", border: "rgba(255,170,0,0.35)",  icon: "#ffaa00", text: "#fff8e8", bar: "#ffaa00" },
    info:    { bg: "#0f1a2d", border: "rgba(80,160,255,0.35)", icon: "#50a0ff", text: "#e8f0ff", bar: "#50a0ff" },
  };
  return colors[type];
}

// ─── Main showToast function ───────────────────────────────────────────────────
export function showToast(message: string, type: ToastType = "info", options: ToastOptions = {}): void {
  if (typeof window === "undefined") return;

  // Prevent duplicate toast messages showing at the same time (e.g. from React StrictMode or rapid user clicks)
  const container = getOrCreateContainer();
  const existingToasts = container.querySelectorAll(".hl-toast p");
  for (let i = 0; i < existingToasts.length; i++) {
    if (existingToasts[i].textContent === message) {
      return;
    }
  }

  const duration = options.duration ?? (type === "error" ? 5000 : 4000);
  const colors = getColors(type);

  // Create toast element
  const toast = document.createElement("div");
  toast.className = "hl-toast";
  toast.style.cssText = `
    pointer-events: all;
    width: 100%;
    background: ${colors.bg};
    border: 1.5px solid ${colors.border};
    border-radius: 16px;
    padding: 14px 16px;
    display: flex;
    align-items: flex-start;
    gap: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);
    backdrop-filter: blur(12px);
    position: relative;
    overflow: hidden;
    cursor: pointer;
  `;

  // Progress bar (shrinks over duration)
  const progressBar = document.createElement("div");
  progressBar.style.cssText = `
    position: absolute;
    bottom: 0; left: 0;
    height: 3px;
    width: 100%;
    background: ${colors.bar};
    transform-origin: left;
    transition: transform ${duration}ms linear;
    border-radius: 0 0 16px 16px;
  `;

  // Icon
  const iconEl = document.createElement("div");
  iconEl.innerHTML = getIcon(type);
  iconEl.style.cssText = `
    color: ${colors.icon};
    flex-shrink: 0;
    margin-top: 1px;
    filter: drop-shadow(0 0 6px ${colors.icon}88);
  `;

  // Message
  const msgEl = document.createElement("p");
  msgEl.textContent = message;
  msgEl.style.cssText = `
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: ${colors.text};
    line-height: 1.5;
    flex: 1;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  `;

  // Close button
  const closeBtn = document.createElement("button");
  closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;
  closeBtn.style.cssText = `
    background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,0.3); padding: 0; flex-shrink: 0; margin-top: 1px;
  `;

  toast.appendChild(progressBar);
  toast.appendChild(iconEl);
  toast.appendChild(msgEl);
  toast.appendChild(closeBtn);
  container.appendChild(toast);

  // Animate the progress bar shrinking
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      progressBar.style.transform = "scaleX(0)";
    });
  });

  // Remove function
  const removeToast = () => {
    toast.classList.add("hl-toast-leaving");
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  };

  // Auto-remove after duration
  const timer = setTimeout(removeToast, duration);

  // Click to dismiss
  toast.addEventListener("click", () => {
    clearTimeout(timer);
    removeToast();
  });
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    clearTimeout(timer);
    removeToast();
  });
}

// ─── Override window.alert() globally ─────────────────────────────────────────
/**
 * Call this ONCE in your app layout to replace ALL window.alert() calls
 * with beautiful native-style toasts. No need to change any existing code!
 */
export function installToastSystem(): void {
  if (typeof window === "undefined") return;
  if ((window as any).__hosteleaze_toast_installed) return;

  (window as any).__hosteleaze_toast_installed = true;

  // Override window.alert
  const originalAlert = window.alert.bind(window);
  window.alert = (message?: any) => {
    const msg = String(message ?? "");
    // Detect type from message content
    let type: ToastType = "info";
    const lower = msg.toLowerCase();
    if (lower.includes("✅") || lower.includes("success") || lower.includes("successfully") || lower.includes("verified") || lower.includes("registered")) {
      type = "success";
    } else if (lower.includes("❌") || lower.includes("failed") || lower.includes("error") || lower.includes("denied") || lower.includes("mismatch") || lower.includes("blocked") || lower.includes("invalid") || lower.includes("wrong")) {
      type = "error";
    } else if (lower.includes("⚠️") || lower.includes("warning") || lower.includes("please") || lower.includes("required") || lower.includes("fill")) {
      type = "warning";
    }
    showToast(msg, type);
  };

  console.log("✅ [Hosteleaze] Native toast system installed — window.alert() is now beautiful!");
}

// ─── Premium Custom Confirm Dialog Modal ──────────────────────────────────────
export function showConfirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }

    // Create modal elements
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(5, 5, 15, 0.7);
      backdrop-filter: blur(12px);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      transition: opacity 0.25s ease;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      background: #0f2d1f;
      border: 1.5px solid rgba(0, 255, 136, 0.35);
      border-radius: 24px;
      padding: 24px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.04);
      transform: translateY(20px) scale(0.95);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    // Title / Warning Icon
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    `;
    const icon = document.createElement("div");
    icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
    const title = document.createElement("h3");
    title.textContent = "Confirm Action";
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #e8fff5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    header.appendChild(icon);
    header.appendChild(title);

    // Message
    const msg = document.createElement("p");
    msg.innerHTML = message.replace(/\n/g, "<br>");
    msg.style.cssText = `
      margin: 0 0 24px 0;
      font-size: 14px;
      font-weight: 600;
      color: #e8fff5;
      opacity: 0.85;
      line-height: 1.6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    // Buttons
    const btnContainer = document.createElement("div");
    btnContainer.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 10px 18px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    cancelBtn.onmouseenter = () => cancelBtn.style.background = "rgba(255, 255, 255, 0.1)";
    cancelBtn.onmouseleave = () => cancelBtn.style.background = "rgba(255, 255, 255, 0.05)";

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Confirm";
    confirmBtn.style.cssText = `
      background: #00ff88;
      border: none;
      border-radius: 12px;
      padding: 10px 18px;
      color: #0f2d1f;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
    `;
    confirmBtn.onmouseenter = () => confirmBtn.style.background = "#33ffa6";
    confirmBtn.onmouseleave = () => confirmBtn.style.background = "#00ff88";

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(confirmBtn);
    card.appendChild(header);
    card.appendChild(msg);
    card.appendChild(btnContainer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Fade in
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      card.style.transform = "translateY(0) scale(1)";
    });

    const cleanup = (value: boolean) => {
      overlay.style.opacity = "0";
      card.style.transform = "translateY(20px) scale(0.95)";
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(value);
      }, 250);
    };

    cancelBtn.addEventListener("click", () => cleanup(false));
    confirmBtn.addEventListener("click", () => cleanup(true));
  });
}

// ─── Premium Custom Prompt Dialog Modal ────────────────────────────────────────
export function showPrompt(message: string, defaultValue: string = ""): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(null);
      return;
    }

    // Create modal elements
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(5, 5, 15, 0.7);
      backdrop-filter: blur(12px);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      opacity: 0;
      transition: opacity 0.25s ease;
    `;

    const card = document.createElement("div");
    card.style.cssText = `
      background: #0f2d1f;
      border: 1.5px solid rgba(0, 255, 136, 0.35);
      border-radius: 24px;
      padding: 24px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.04);
      transform: translateY(20px) scale(0.95);
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    `;

    // Title / Edit Icon
    const header = document.createElement("div");
    header.style.cssText = `
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    `;
    const icon = document.createElement("div");
    icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#00ff88" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`;
    const title = document.createElement("h3");
    title.textContent = "Input Required";
    title.style.cssText = `
      margin: 0;
      font-size: 16px;
      font-weight: 800;
      color: #e8fff5;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    header.appendChild(icon);
    header.appendChild(title);

    // Message
    const msg = document.createElement("p");
    msg.innerHTML = message.replace(/\n/g, "<br>");
    msg.style.cssText = `
      margin: 0 0 16px 0;
      font-size: 14px;
      font-weight: 600;
      color: #e8fff5;
      opacity: 0.85;
      line-height: 1.6;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;

    // Input Field
    const input = document.createElement("input");
    input.type = "text";
    input.value = defaultValue;
    input.style.cssText = `
      width: 100%;
      background: rgba(255, 255, 255, 0.05);
      border: 1.5px solid rgba(0, 255, 136, 0.25);
      border-radius: 12px;
      padding: 12px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 24px;
      outline: none;
      transition: all 0.2s ease;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    input.onfocus = () => {
      input.style.borderColor = "#00ff88";
      input.style.background = "rgba(255, 255, 255, 0.08)";
    };
    input.onblur = () => {
      input.style.borderColor = "rgba(0, 255, 136, 0.25)";
      input.style.background = "rgba(255, 255, 255, 0.05)";
    };

    // Buttons
    const btnContainer = document.createElement("div");
    btnContainer.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    `;

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.style.cssText = `
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 10px 18px;
      color: rgba(255, 255, 255, 0.8);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    cancelBtn.onmouseenter = () => cancelBtn.style.background = "rgba(255, 255, 255, 0.1)";
    cancelBtn.onmouseleave = () => cancelBtn.style.background = "rgba(255, 255, 255, 0.05)";

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "Confirm";
    confirmBtn.style.cssText = `
      background: #00ff88;
      border: none;
      border-radius: 12px;
      padding: 10px 18px;
      color: #0f2d1f;
      font-size: 13px;
      font-weight: 800;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(0, 255, 136, 0.3);
    `;
    confirmBtn.onmouseenter = () => confirmBtn.style.background = "#33ffa6";
    confirmBtn.onmouseleave = () => confirmBtn.style.background = "#00ff88";

    btnContainer.appendChild(cancelBtn);
    btnContainer.appendChild(confirmBtn);
    card.appendChild(header);
    card.appendChild(msg);
    card.appendChild(input);
    card.appendChild(btnContainer);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Focus input on load
    setTimeout(() => {
      input.focus();
      // Move cursor to end of text
      const len = input.value.length;
      input.setSelectionRange(len, len);
    }, 100);

    // Fade in
    requestAnimationFrame(() => {
      overlay.style.opacity = "1";
      card.style.transform = "translateY(0) scale(1)";
    });

    const cleanup = (value: string | null) => {
      overlay.style.opacity = "0";
      card.style.transform = "translateY(20px) scale(0.95)";
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(value);
      }, 250);
    };

    cancelBtn.addEventListener("click", () => cleanup(null));
    confirmBtn.addEventListener("click", () => cleanup(input.value));
    
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        cleanup(input.value);
      } else if (e.key === "Escape") {
        cleanup(null);
      }
    });
  });
}


