/*
 * AM777 Landing Page → Google Sheets CRM Sync Patch
 * Robust field detection version.
 */

if (!window.__AM777_CRM_PATCH_LOADED__) {
  window.__AM777_CRM_PATCH_LOADED__ = true;

  (function () {
    "use strict";

    window.AM777_CONFIG = window.AM777_CONFIG || {};
    window.AM777_CONFIG.appsScriptEndpoint =
      "https://script.google.com/macros/s/AKfycbzQpqSDo2VD01Pk_J1eDsd1BsI0lMfCwz1FJFlCz5PqHGIZ4qCruDnq_mm_IrmgNw492w/exec";

    var AM777_ENDPOINT = window.AM777_CONFIG.appsScriptEndpoint;

    var AM777_KEYS = {
      leads: "AM777_PRIVATE_CRM_LEADS",
      events: "AM777_VISITOR_EVENTS",
      session: "AM777_SESSION_ID"
    };

    function clean(value) {
      return value == null ? "" : String(value).trim();
    }

    function nowISO() {
      return new Date().toISOString();
    }

    function deviceType() {
      var width = window.innerWidth || 0;
      if (width <= 640) return "Mobile";
      if (width <= 1024) return "Tablet";
      return "Desktop";
    }

    function sessionId() {
      var id = sessionStorage.getItem(AM777_KEYS.session);
      if (!id) {
        id =
          "SES-" +
          Date.now().toString(36).toUpperCase() +
          "-" +
          Math.random().toString(36).slice(2, 8).toUpperCase();
        sessionStorage.setItem(AM777_KEYS.session, id);
      }
      return id;
    }

    function saveLocal(key, payload, limit) {
      try {
        var current = JSON.parse(localStorage.getItem(key) || "[]");
        current.unshift(payload);
        localStorage.setItem(key, JSON.stringify(current.slice(0, limit || 500)));
      } catch (err) {
        console.warn("AM777 local backup skipped:", err);
      }
    }

    function allFields(root) {
      root = root || document;
      return Array.from(root.querySelectorAll("input, textarea, select")).filter(function (field) {
        var type = (field.type || "").toLowerCase();
        return type !== "hidden" && type !== "submit" && type !== "button";
      });
    }

    function fieldValue(field) {
      if (!field) return "";
      if (field.tagName && field.tagName.toLowerCase() === "select") {
        var selected = field.options[field.selectedIndex];
        return clean(selected ? selected.text || selected.value : field.value);
      }
      return clean(field.value);
    }

    function fieldText(field) {
      if (!field) return "";

      var labelText = "";

      if (field.id) {
        var label = document.querySelector('label[for="' + field.id + '"]');
        if (label) labelText = label.textContent || "";
      }

      var parentText = "";
      if (field.parentElement) {
        parentText = field.parentElement.textContent || "";
      }

      return [
        field.name,
        field.id,
        field.placeholder,
        field.getAttribute("aria-label"),
        field.getAttribute("data-field"),
        field.getAttribute("data-name"),
        labelText,
        parentText
      ]
        .join(" ")
        .toLowerCase();
    }

    function findByKeywords(root, keywords) {
      var fields = allFields(root);
      var keys = keywords.map(function (k) {
        return String(k).toLowerCase();
      });

      for (var i = 0; i < fields.length; i++) {
        var text = fieldText(fields[i]);

        for (var j = 0; j < keys.length; j++) {
          if (text.indexOf(keys[j]) !== -1) return fields[i];
        }
      }

      return null;
    }

    function collectLead(root) {
      root = root || document;

      var fields = allFields(root);
      var inputs = fields.filter(function (field) {
        return field.tagName.toLowerCase() === "input";
      });
      var textareas = fields.filter(function (field) {
        return field.tagName.toLowerCase() === "textarea";
      });
      var selects = fields.filter(function (field) {
        return field.tagName.toLowerCase() === "select";
      });

      var name =
        fieldValue(findByKeywords(root, ["name", "your name", "full name"])) ||
        fieldValue(inputs[0]);

      var business =
        fieldValue(findByKeywords(root, ["business", "page", "company", "business name", "page name"])) ||
        fieldValue(inputs[1]);

      var contact =
        fieldValue(findByKeywords(root, ["contact", "phone", "email", "messenger", "whatsapp", "number"])) ||
        fieldValue(inputs[2]);

      var serviceNeeded =
        fieldValue(findByKeywords(root, ["service", "service needed", "automation", "crm", "landing", "chatbot"])) ||
        fieldValue(selects[0]) ||
        fieldValue(inputs[3]);

      var problem =
        fieldValue(findByKeywords(root, ["problem", "message", "main problem", "inquiry", "workflow", "manual", "details"])) ||
        fieldValue(textareas[0]);

      return {
        type: "lead",
        timestamp: nowISO(),
        sessionId: sessionId(),
        name: name,
        business: business,
        contact: contact,
        serviceNeeded: serviceNeeded,
        problem: problem,
        source: "AM777 GitHub Landing Page",
        page: window.location.href,
        referrer: document.referrer || "",
        device: deviceType(),
        userAgent: navigator.userAgent || "",
        status: "New",
        leadTemperature: "New",
        note: "Submitted from AM777 landing page form"
      };
    }

    function sendToBackend(payload) {
      if (!AM777_ENDPOINT || AM777_ENDPOINT.indexOf("/exec") === -1) {
        console.error("AM777 endpoint missing or invalid.");
        return Promise.resolve(false);
      }

      return fetch(AM777_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      })
        .then(function () {
          return true;
        })
        .catch(function (err) {
          console.error("AM777 CRM sync failed:", err);
          return false;
        });
    }

    function submitLead(root) {
      var payload = collectLead(root);

      console.log("AM777 collected lead:", payload);

      if (!payload.name && !payload.contact && !payload.problem) {
        alert("Please add your name, contact, or inquiry details first.");
        return;
      }

      saveLocal(AM777_KEYS.leads, payload, 500);

      sendToBackend(payload).then(function () {
        alert("Thank you. Your automation request has been received.");
      });
    }

    function trackEvent(eventType, details) {
      var payload = {
        type: "event",
        timestamp: nowISO(),
        sessionId: sessionId(),
        eventType: eventType,
        page: window.location.href,
        device: deviceType(),
        referrer: document.referrer || "",
        userAgent: navigator.userAgent || "",
        details: details || ""
      };

      saveLocal(AM777_KEYS.events, payload, 1000);
      sendToBackend(payload);
    }

    function bindForms() {
      var forms = document.querySelectorAll("form");

      forms.forEach(function (form) {
        if (form.getAttribute("data-am777-crm-bound") === "true") return;

        form.setAttribute("data-am777-crm-bound", "true");

        form.addEventListener("submit", function (event) {
          event.preventDefault();
          submitLead(form);
        });
      });
    }

    function bindButtons() {
      var buttons = document.querySelectorAll("button, a");

      buttons.forEach(function (button) {
        if (button.getAttribute("data-am777-button-bound") === "true") return;

        var text = (button.textContent || "").toLowerCase();

        var isSubmitButton =
          text.indexOf("send automation request") !== -1 ||
          text.indexOf("request demo") !== -1 ||
          text.indexOf("automation request") !== -1 ||
          text.indexOf("send") !== -1;

        if (!isSubmitButton) return;

        button.setAttribute("data-am777-button-bound", "true");

        button.addEventListener("click", function (event) {
          var form = button.closest("form");

          if (form) {
            event.preventDefault();
            submitLead(form);
            return;
          }

          event.preventDefault();

          var section =
            button.closest("#contact") ||
            button.closest(".booking") ||
            button.closest("section") ||
            button.closest("main") ||
            document;

          submitLead(section);
        });
      });
    }

    function bindTracking() {
      document.addEventListener(
        "click",
        function (event) {
          var target = event.target.closest("a, button");
          if (!target) return;

          var text = clean(target.textContent);
          var href = target.href || "";
          var lower = (text + " " + href).toLowerCase();

          if (
            lower.indexOf("request") !== -1 ||
            lower.indexOf("contact") !== -1 ||
            lower.indexOf("demo") !== -1 ||
            lower.indexOf("messenger") !== -1 ||
            lower.indexOf("whatsapp") !== -1 ||
            lower.indexOf("facebook") !== -1 ||
            lower.indexOf("linkedin") !== -1
          ) {
            trackEvent("cta_click", text || href);
          }
        },
        true
      );
    }

    function initAM777CRM() {
      bindForms();
      bindButtons();
      bindTracking();
      trackEvent("page_view", document.title || "AM777 Landing Page");

      window.AM777_CRM_SYNC = {
        collectLead: function () {
          return collectLead(document);
        },
        sendLead: function (payload) {
          payload = payload || {};
          payload.type = "lead";
          return sendToBackend(payload);
        },
        sendEvent: trackEvent
      };

      console.log("AM777 CRM Sync Patch loaded successfully.");
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initAM777CRM);
    } else {
      initAM777CRM();
    }
  })();
}
