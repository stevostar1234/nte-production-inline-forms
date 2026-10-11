(function (nativeWindow, nativeDocument) {
  "use strict";
  var tagName = __TAG_NAME__;
  if (nativeWindow.customElements.get(tagName)) return;

  class NTEInlineForm extends HTMLElement {
    connectedCallback() {
      if (this.shadowRoot) {
        this.connectListeners();
        return;
      }
      if (!this.querySelector("[data-nte-ready]")) {
        if (!this.pendingContent) {
          this.pendingContent = new MutationObserver(() => {
            if (this.querySelector("[data-nte-ready]")) this.connectedCallback();
          });
        }
        this.pendingContent.observe(this, {childList: true});
        return;
      }
      if (this.pendingContent) this.pendingContent.disconnect();
      this.windowListeners = [];
      var host = this;
      var template = host.querySelector("template[data-nte-content]");
      var root = host.attachShadow({mode: "open"});
      root.appendChild(template.content.cloneNode(true));
      if (host.hasAttribute("data-nte-inter") && !nativeDocument.getElementById(__FONT_ID__)) {
        var fonts = nativeDocument.createElement("style");
        fonts.id = __FONT_ID__;
        fonts.textContent = __FONT_CSS__;
        nativeDocument.head.appendChild(fonts);
      }
      // Keep the source engine local to this block. Native transport still posts
      // in the current top-level document, exactly as the standalone form does.
      var scopedDocument = {
        body: nativeDocument.body,
        createElement: nativeDocument.createElement.bind(nativeDocument),
        querySelector: root.querySelector.bind(root),
        querySelectorAll: root.querySelectorAll.bind(root),
        getElementById: root.getElementById.bind(root)
      };
      var scopedWindow = {
        location: nativeWindow.location,
        crypto: nativeWindow.crypto,
        addEventListener: function (type, listener, options) {
          host.windowListeners.push([type, listener, options]);
          nativeWindow.addEventListener(type, listener, options);
        }
      };
      this.listenersConnected = true;
      (function (window, document) {
__CONFIG_JS__
        window.NTE_CONFIG.returnUrl = host.getAttribute("data-nte-return-url");
__FORMS_JS__
      }(scopedWindow, scopedDocument));
      host.setAttribute("data-nte-initialized", "true");
      // Template and fallback are no longer needed after a successful mount.
      host.replaceChildren();
    }

    connectListeners() {
      if (this.listenersConnected) return;
      this.windowListeners.forEach(function (args) {
        nativeWindow.addEventListener.apply(nativeWindow, args);
      });
      this.listenersConnected = true;
    }

    disconnectedCallback() {
      if (this.pendingContent) this.pendingContent.disconnect();
      (this.windowListeners || []).forEach(function (args) {
        nativeWindow.removeEventListener.apply(nativeWindow, args);
      });
      this.listenersConnected = false;
    }
  }
  nativeWindow.customElements.define(tagName, NTEInlineForm);
}(window, document));
