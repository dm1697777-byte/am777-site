
/**
 * AM777 Landing Page → Google Sheets CRM Sync Patch
 * Paste before </body> in your GitHub index.html, or merge into your existing script.
 * Replace appsScriptEndpoint with your deployed Google Apps Script Web App URL.
 */

const AM777_CONFIG = {
appsScriptEndpoint: "https://script.google.com/macros/s/AKfycbxbejRgkNIhssIkSym9096WGQN_9CbfHRIjMn6jdgDtYC9CDaAB5PRVNe4Yf_kKQbSSig/exec"
};

const AM777_KEYS = {
  leads: "AM777_PRIVATE_CRM_LEADS",
  events: "AM777_VISITOR_EVENTS",
  session: "AM777_SESSION_ID"
};

function getAM777SessionId() {
  let id = sessionStorage.getItem(AM777_KEYS.session);
  if (!id) {
    id = "SES-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    sessionStorage.setItem(AM777_KEYS.session, id);
  }
  return id;
}

function getAM777Device() {
  const w = window.innerWidth || 0;
  if (w <= 640) return "Mobile";
  if (w <= 1024) return "Tablet";
  return "Desktop";
}

function saveLeadLocal(payload) {
  const leads = JSON.parse(localStorage.getItem(AM777_KEYS.leads) || "[]");
  leads.unshift(payload);
  localStorage.setItem(AM777_KEYS.leads, JSON.stringify(leads.slice(0, 500)));
}

function saveEventLocal(payload) {
  const events = JSON.parse(localStorage.getItem(AM777_KEYS.events) || "[]");
  events.unshift(payload);
  localStorage.setItem(AM777_KEYS.events, JSON.stringify(events.slice(0, 1000)));
}

async function sendToAM777Backend(payload) {
  const url = AM777_CONFIG.appsScriptEndpoint;
  if (!url || url.includes("PASTE_YOUR_GOOGLE_APPS_SCRIPT")) return { success: false, localOnly: true };

  try {
    await fetch(url, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });
    return { success: true };
  } catch (error) {
    console.warn("AM777 backend sync failed:", error);
    return { success: false, error };
  }
}

function detectLeadTemperature(payload) {
  const message = String(payload.message || payload.problem || "").toLowerCase();
  const service = String(payload.service || "").trim();
  const contact = String(payload.contact || "").trim();
  const hotWords = ["asap", "today", "urgent", "need now", "quote", "pricing", "call", "demo", "interested"];
  if (hotWords.some(word => message.includes(word))) return "Hot";
  if (contact && service) return "Warm";
  return "New";
}

async function saveAM777Lead(rawPayload = {}, source = "landing_page") {
  const payload = {
    type: "lead",
    id: rawPayload.id || ("AM777-" + Date.now()),
    name: rawPayload.name || "",
    business: rawPayload.business || rawPayload.businessName || "",
    contact: rawPayload.contact || rawPayload.email || rawPayload.phone || "",
    service: rawPayload.service || rawPayload.serviceNeeded || "",
    message: rawPayload.message || rawPayload.problem || "",
    source,
    submittedAt: rawPayload.submittedAt || new Date().toISOString(),
    status: rawPayload.status || "New",
    leadTemperature: rawPayload.leadTemperature || "",
    notes: rawPayload.notes || ""
  };

  payload.leadTemperature = payload.leadTemperature || detectLeadTemperature(payload);

  saveLeadLocal(payload);
  await sendToAM777Backend(payload);
  await trackAM777Event(source === "chatbot" ? "chatbot_submit" : "form_submit", { leadId: payload.id, source });

  return payload;
}

async function trackAM777Event(eventType, details = {}) {
  const payload = {
    type: "event",
    id: "EVT-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7).toUpperCase(),
    sessionId: getAM777SessionId(),
    eventType,
    page: location.pathname || "/",
    timestamp: new Date().toISOString(),
    referrer: document.referrer || "Direct",
    userAgent: navigator.userAgent || "",
    device: getAM777Device(),
    details
  };

  saveEventLocal(payload);
  await sendToAM777Backend(payload);
  return payload;
}

/* Auto tracking */
document.addEventListener("DOMContentLoaded", () => {
  trackAM777Event("page_visit");

  document.querySelectorAll("a, button").forEach((el) => {
    const text = (el.innerText || el.getAttribute("aria-label") || "").toLowerCase();
    const href = el.getAttribute("href") || "";
    if (
      text.includes("request") ||
      text.includes("demo") ||
      text.includes("fit check") ||
      text.includes("contact") ||
      href.includes("wa.me") ||
      href.includes("m.me") ||
      href.includes("facebook")
    ) {
      el.addEventListener("click", () => {
        trackAM777Event("cta_click", { text: el.innerText || "", href });
      }, { once: false });
    }
  });

  const chatbotButtons = document.querySelectorAll("#ya-toggle, .chatbot-toggle, [data-chatbot-toggle]");
  chatbotButtons.forEach((btn) => {
    btn.addEventListener("click", () => trackAM777Event("chatbot_open"), { once: true });
  });

  let formStarted = false;
  const forms = document.querySelectorAll("form");
  forms.forEach((form) => {
    form.addEventListener("input", () => {
      if (!formStarted) {
        formStarted = true;
        trackAM777Event("form_start");
      }
    }, { once: true });

    form.addEventListener("submit", async (e) => {
      const data = new FormData(form);
      const payload = {
        name: data.get("name") || data.get("fullName") || "",
        business: data.get("business") || data.get("company") || "",
        contact: data.get("contact") || data.get("email") || data.get("phone") || "",
        service: data.get("service") || data.get("serviceNeeded") || "",
        message: data.get("message") || data.get("problem") || ""
      };

      // Only intercept if form has lead-style fields.
      if (payload.name || payload.contact || payload.message || payload.service) {
        e.preventDefault();
        await saveAM777Lead(payload, "bottom_form");

        const ok = document.querySelector(".form-ok, #formSuccess, [data-form-success]");
        if (ok) {
          ok.textContent = "Thank you. Your inquiry has been received. AM777 Automation Solutions will review it shortly.";
          ok.classList.add("show");
          ok.style.display = "flex";
        } else {
          alert("Thank you. Your inquiry has been received. AM777 Automation Solutions will review it shortly.");
        }

        form.reset();
      }
    });
  });
});

/**
 * CHATBOT CONNECTION NOTE:
 * Find your existing chatbot final save function, usually named saveLead(), submitLead(),
 * completeChat(), or done state handler.
 *
 * Inside that final step, call:
 *
 * saveAM777Lead({
 *   name: collectedName,
 *   business: collectedBusiness,
 *   contact: collectedContact,
 *   service: selectedService,
 *   message: collectedMessage
 * }, "chatbot");
 */
