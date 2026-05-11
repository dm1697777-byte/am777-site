/*
 * AM777 Landing Page → Google Sheets CRM Sync Patch
 * Safe version: no duplicate const/let global conflicts.
 * Put this before </body> in index.html:
 * <script src="./github_landing_patch.js?v=5" defer></script>
 */

if (!window.__AM777_CRM_PATCH_LOADED__) {
  window.__AM777_CRM_PATCH_LOADED__ = true;

  (function () {
    "use strict";

    window.AM777_CONFIG = window.AM777_CONFIG || {};
    window.AM777_CONFIG.appsScriptEndpoint =
      window.AM777_CONFIG.appsScriptEndpoint ||
      "https://script.google.com/macros/s/AKfycbxbejRgkNIhssIkSym9096WGQN_9CbfHRIjMn6jdgDtYC9CDaAB5PRVNe4Yf_kKQbSSig/exec";

    var AM777_ENDPOINT = window.AM777_CONFIG.appsScriptEndpoint;

    var AM777_KEYS = {
      leads: "AM777_PRIVATE_CRM_LEADS",
      events: "AM777_VISITOR_EVENTS",
      session: "AM777_SESSION_ID"
    };

    function am777Clean(value) {
      return value == null ? "" : String(value).trim();
    }

    function am777NowISO() {
      return new Date().toISOString();
    }

    function am777Device() {
      var width = window.innerWidth || 0;
      if (width <= 640) return "Mobile";
      if (width <= 1024) return "Tablet";
      return "Desktop";
    }

    function am777SessionId() {
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

    function am777SaveLocal(key, payload, limit) {
      try {
        var current = JSON.parse(localStorage.getItem(key) || "[]");
        current.unshift(payload);
        localStorage.setItem(key, JSON.stringify(current.slice(0, limit || 500)));
      } catch (err) {
        console.warn("AM777 local save skipped:", err);
      }
    }

    function am777FindField(root, keywords) {
      root = root || document;

      var fields = root.querySelectorAll("input, textarea, select");
      var lowered = keywords.map(function (k) {
        return String(k).toLowerCase();
      });

      for (var i = 0; i < fields.length; i++) {
        var field = fields[i];

        var haystack = [
          field.name,
          field.id,
          field.placeholder,
          field.getAttribute("aria-label"),
          field.getAttribute("data-field"),
          field.getAttribute("data-name")
        ]
          .join(" ")
          .toLowerCase();

        for (var j = 0; j < lowered.length; j++) {
          if (haystack.indexOf(lowered[j]) !== -1) {
            return field;
          }
        }
      }

      return null;
    }

    function am777ValueFromField(field) {
      if (!field) return "";

      if (field.tagName && field.tagName.toLowerCase() === "select") {
        var selected = field.options[field.selectedIndex];
        return am777Clean(selected ? selected.text || selected.value : field.value);
      }

      return am777Clean(field.value);
    }

    function am777FirstSelectValue(root) {
      var select = (root || document).querySelector("select");
      return am777ValueFromField(select);
    }

    function am777CollectLead(root) {
      root = root || document;

      var name = am777ValueFromField(
        am777FindField(root, ["name", "your name", "full name"])
      );

      var business = am777ValueFromField(
        am777FindField(root, [
          "business",
          "page",
          "company",
          "business name",
          "page name"
        ])
      );

      var contact = am777ValueFromField(
        am777FindField(root, [
          "contact",
          "phone",
          "email",
          "messenger",
          "whatsapp",
          "number"
        ])
      );

      var serviceNeeded =
        am777ValueFromField(
          am777FindField(root, [
            "service",
            "service needed",
            "automation",
            "crm",
            "landing",
            "chatbot"
          ])
        ) || am777FirstSelectValue(root);

      var mainProblem = am777ValueFromField(
        am777FindField(root, [
          "problem",
          "message",
          "main problem",
          "inquiry",
          "workflow",
          "manual",
          "details"
        ])
      );

      return {
        type: "lead",
        timestamp: am777NowISO(),
        sessionId: am777SessionId(),
        name: name,
        business: business,
        contact: contact,
        serviceNeeded: serviceNeeded,
        problem: mainProblem,
        source: "AM777 GitHub Landing Page",
        page: window.location.href,
        referrer: document.referrer || "",
        device: am777Device(),
        userAgent: navigator.userAgent || "",
        status: "New",
        leadTemperature: "New",
        note: "Submitted from AM777 landing page form"
      };
    }

    function am777SendToBackend(payload) {
      if (!AM777_ENDPOINT || AM777_ENDPOINT.indexOf("/exec") === -1) {
        console.warn("AM777 CRM endpoint missing or invalid.");
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

    function am777SubmitLead(root) {
      if (window.__AM777_LEAD_SUBMIT_LOCK__) return;
      window.__AM777_LEAD_SUBMIT_LOCK__ = true;

      setTimeout(function () {
        window.__AM777_LEAD_SUBMIT_LOCK__ = false;
      }, 1600);

      var payload = am777CollectLead(root);

      if (!payload.name && !payload.contact && !payload.problem) {
        alert("Please add your name, contact, or inquiry details first.");
        return;
      }

      am777SaveLocal(AM777_KEYS.leads, payload, 500);

      am777SendToBackend(payload).then(function () {
        alert("Thank you. Your automation request has been received.");
      });
    }

    function am777TrackEvent(eventType, details) {
      var payload = {
        type: "event",
        timestamp: am777NowISO(),
        sessionId: am777SessionId(),
        eventType: eventType,
        page: window.location.href,
        device: am777Device(),
        referrer: document.referrer || "",
        userAgent: navigator.userAgent || "",
        details: details || ""
      };

      am777SaveLocal(AM777_KEYS.events, payload, 1000);
      am777SendToBackend(payload);
    }

    function am777BindForms() {
      var forms = document.querySelectorAll("form");

      for (var i = 0; i < forms.length; i++) {
        var form = forms[i];

        if (form.getAttribute("data-am777-crm-bound") === "true") continue;

        form.setAttribute("data-am777-crm-bound", "true");

        form.addEventListener("submit", function (event) {
          event.preventDefault();
          am777SubmitLead(event.currentTarget);
        });
      }
    }

    function am777BindButtons() {
      var buttons = document.querySelectorAll("button, a");

      for (var i = 0; i < buttons.length; i++) {
        var button = buttons[i];

        if (button.getAttribute("data-am777-button-bound") === "true") continue;

        var text = (button.textContent || "").toLowerCase();

        var isLeadButton =
          text.indexOf("send automation request") !== -1 ||
          text.indexOf("request demo") !== -1 ||
          text.indexOf("free automation") !== -1 ||
          text.indexOf("automation request") !== -1;

        if (!isLeadButton) continue;

        button.setAttribute("data-am777-button-bound", "true");

        button.addEventListener("click", function (event) {
          var closestForm = event.currentTarget.closest("form");

          if (closestForm) {
            return;
          }

          event.preventDefault();

          var section =
            event.currentTarget.closest("section") ||
            event.currentTarget.closest("main") ||
            document;

          am777SubmitLead(section);
        });
      }
    }

    function am777BindTrackingClicks() {
      document.addEventListener(
        "click",
        function (event) {
          var target = event.target.closest("a, button");
          if (!target) return;

          var text = (target.textContent || "").trim();
          var href = target.href || "";

          if (!text && !href) return;

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
            am777TrackEvent("cta_click", text || href);
          }
        },
        true
      );
    }

    function am777Init() {
      am777BindForms();
      am777BindButtons();
      am777BindTrackingClicks();
      am777TrackEvent("page_view", document.title || "AM777 Landing Page");

      window.AM777_CRM_SYNC = {
        sendLead: function (payload) {
          payload = payload || {};
          payload.type = "lead";
          return am777SendToBackend(payload);
        },
        sendEvent: function (eventType, details) {
          return am777TrackEvent(eventType, details);
        },
        collectLead: function () {
          return am777CollectLead(document);
        }
      };

      console.log("AM777 CRM Sync Patch loaded.");
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", am777Init);
    } else {
      am777Init();
    }
  })();
}
