// SPDX-License-Identifier: GPL-3.0-or-later
// core/global-widget.js - Rescale AI Global Sidebar Widget

(() => {
  let isWidgetEnabled = true;
  let bridgeStatus = {
    connected: false,
    mcpAlive: false,
    studio: null,
    studioApp: null,
    studioProc: null,
    tools: 0,
    servers: []
  };

  const currentHost = window.location.hostname;

  // Initialize: check if disabled for this site or globally
  chrome.storage.local.get(["disabled_hosts", "global_widget_enabled"], (res) => {
    if (res.global_widget_enabled === false) {
      isWidgetEnabled = false;
      return;
    }
    const disabledHosts = res.disabled_hosts || [];
    if (disabledHosts.includes(currentHost)) {
      isWidgetEnabled = false;
      return;
    }
    initWidget();
  });

  function initWidget() {
    // Prevent duplicate injection
    if (document.getElementById("rescale-global-widget-root")) return;

    // Create container
    const root = document.createElement("div");
    root.id = "rescale-global-widget-root";
    document.documentElement.appendChild(root);

    // Inject styles and markup
    root.innerHTML = `
      <div id="rescale-widget-badge" title="Rescale AI Status Panel">
        <svg viewBox="0 0 100 100" class="rescale-badge-logo">
          <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" stroke-width="8"/>
          <path d="M30 50 L50 30 L70 50 L50 70 Z" fill="currentColor"/>
          <circle cx="50" cy="50" r="8" fill="#111219"/>
        </svg>
        <span class="rescale-badge-status-dot offline"></span>
      </div>

      <div id="rescale-sidebar-panel" class="rescale-sidebar-hidden">
        <div class="rescale-sidebar-header">
          <div class="rescale-sidebar-brand">
            <span class="rescale-sidebar-logo">◆</span>
            <span class="rescale-sidebar-title">Rescale AI</span>
            <span class="rescale-sidebar-version">v1.4.2</span>
          </div>
          <button id="rescale-sidebar-close" title="Close Panel">&times;</button>
        </div>

        <div class="rescale-sidebar-content">
          <!-- Connection Status Card -->
          <div class="rescale-card">
            <div class="rescale-card-header">
              <span class="rescale-card-title">Bridge Connection</span>
              <span id="rescale-status-indicator" class="rescale-status-pill offline">Offline</span>
            </div>
            <div class="rescale-status-row">
              <span class="rescale-status-label">Local WebSocket:</span>
              <span id="rescale-ws-addr" class="rescale-status-val">ws://127.0.0.1:17613</span>
            </div>
          </div>

          <!-- Studio Status Card -->
          <div class="rescale-card">
            <div class="rescale-card-header">
              <span class="rescale-card-title">Roblox Studio Link</span>
            </div>
            <div class="rescale-status-row">
              <span class="rescale-status-label">Studio App:</span>
              <span id="rescale-studio-app" class="rescale-status-val status-warn">Unknown</span>
            </div>
            <div class="rescale-status-row">
              <span class="rescale-status-label">Active Project/Place:</span>
              <span id="rescale-studio-place" class="rescale-status-val status-warn">Disconnected</span>
            </div>
            <div class="rescale-status-row">
              <span class="rescale-status-label">Active Tools:</span>
              <span id="rescale-studio-tools" class="rescale-status-val">0 (MCP)</span>
            </div>
          </div>

          <!-- Supported AIs Section -->
          <div class="rescale-section">
            <span class="rescale-section-title">Supported AI Platforms</span>
            <ul class="rescale-ai-list">
              <li data-host="chatgpt.com" class="rescale-ai-item" onclick="window.open('https://chatgpt.com/', '_blank')">
                <span class="rescale-ai-name">ChatGPT</span>
                <span class="rescale-ai-url">chatgpt.com</span>
              </li>
              <li data-host="claude.ai" class="rescale-ai-item" onclick="window.open('https://claude.ai/', '_blank')">
                <span class="rescale-ai-name">Claude</span>
                <span class="rescale-ai-url">claude.ai</span>
              </li>
              <li data-host="chat.deepseek.com" class="rescale-ai-item" onclick="window.open('https://chat.deepseek.com/', '_blank')">
                <span class="rescale-ai-name">DeepSeek</span>
                <span class="rescale-ai-url">chat.deepseek.com</span>
              </li>
              <li data-host="gemini.google.com" class="rescale-ai-item" onclick="window.open('https://gemini.google.com/', '_blank')">
                <span class="rescale-ai-name">Gemini</span>
                <span class="rescale-ai-url">gemini.google.com</span>
              </li>
              <li data-host="perplexity.ai" class="rescale-ai-item" onclick="window.open('https://www.perplexity.ai/', '_blank')">
                <span class="rescale-ai-name">Perplexity</span>
                <span class="rescale-ai-url">perplexity.ai</span>
              </li>
              <li data-host="kimi.ai" class="rescale-ai-item" onclick="window.open('https://kimi.moonshot.cn/', '_blank')">
                <span class="rescale-ai-name">Kimi</span>
                <span class="rescale-ai-url">kimi.com</span>
              </li>
              <li data-host="qwen.ai" class="rescale-ai-item" onclick="window.open('https://chat.qwen.ai/', '_blank')">
                <span class="rescale-ai-name">Qwen</span>
                <span class="rescale-ai-url">chat.qwen.ai</span>
              </li>
              <li data-host="z.ai" class="rescale-ai-item" onclick="window.open('https://chat.z.ai/', '_blank')">
                <span class="rescale-ai-name">GLM (Z.ai)</span>
                <span class="rescale-ai-url">chat.z.ai</span>
              </li>
              <li data-host="arena.ai" class="rescale-ai-item" onclick="window.open('https://arena.ai/', '_blank')">
                <span class="rescale-ai-name">LMSYS Arena</span>
                <span class="rescale-ai-url">arena.ai</span>
              </li>
            </ul>
          </div>

          <!-- Instructions Card -->
          <div class="rescale-card rescale-info-card">
            <div class="rescale-card-header">
              <span class="rescale-card-title">Setup Checklist</span>
            </div>
            <ul class="rescale-checklist">
              <li>1. Run <code>start.bat</code> to launch the bridge on your PC.</li>
              <li>2. Start Roblox Studio and load a project file.</li>
              <li>3. Enable the MCP Server in Studio's settings.</li>
              <li>4. Open any supported AI chat to generate and run Roblox code.</li>
            </ul>
          </div>

          <!-- Configuration Footer -->
          <div class="rescale-settings-footer">
            <label class="rescale-toggle-label">
              <input type="checkbox" id="rescale-toggle-site" checked>
              <span>Show widget on this website</span>
            </label>
          </div>
        </div>
      </div>
    `;

    const badge = root.querySelector("#rescale-widget-badge");
    const sidebar = root.querySelector("#rescale-sidebar-panel");
    const closeBtn = root.querySelector("#rescale-sidebar-close");
    const toggleSite = root.querySelector("#rescale-toggle-site");

    // Toggle sidebar
    badge.addEventListener("click", () => {
      sidebar.classList.toggle("rescale-sidebar-hidden");
    });

    closeBtn.addEventListener("click", () => {
      sidebar.classList.add("rescale-sidebar-hidden");
    });

    // Close on click outside
    document.addEventListener("click", (e) => {
      if (!root.contains(e.target) && !sidebar.classList.contains("rescale-sidebar-hidden")) {
        sidebar.classList.add("rescale-sidebar-hidden");
      }
    });

    // Disable widget for this site
    toggleSite.addEventListener("change", () => {
      if (!toggleSite.checked) {
        chrome.storage.local.get(["disabled_hosts"], (res) => {
          const disabledHosts = res.disabled_hosts || [];
          if (!disabledHosts.includes(currentHost)) {
            disabledHosts.push(currentHost);
            chrome.storage.local.set({ disabled_hosts: disabledHosts }, () => {
              root.remove();
            });
          }
        });
      }
    });

    // Request initial status
    chrome.runtime.sendMessage({ type: "status" }, (resp) => {
      if (resp) updateUI(resp);
    });

    // Listen for live updates
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === "zs-status") {
        updateUI(msg);
      }
    });
  }

  function updateUI(status) {
    bridgeStatus = status;
    const root = document.getElementById("rescale-global-widget-root");
    if (!root) return;

    // Update badge status dot
    const badgeDot = root.querySelector(".rescale-badge-status-dot");
    const statusPill = root.querySelector("#rescale-status-indicator");

    if (badgeDot && statusPill) {
      badgeDot.className = "rescale-badge-status-dot " + (status.connected ? (status.mcpAlive ? "online" : "warn") : "offline");
      statusPill.className = "rescale-status-pill " + (status.connected ? (status.mcpAlive ? "online" : "warn") : "offline");
      statusPill.innerText = status.connected ? (status.mcpAlive ? "Connected" : "No MCP") : "Offline";
    }

    // Update Studio Connection status
    const studioAppEl = root.querySelector("#rescale-studio-app");
    const studioPlaceEl = root.querySelector("#rescale-studio-place");
    const studioToolsEl = root.querySelector("#rescale-studio-tools");

    if (studioAppEl && studioPlaceEl && studioToolsEl) {
      if (status.connected) {
        // App status
        if (status.studioProc === false) {
          studioAppEl.className = "rescale-status-val status-warn";
          studioAppEl.innerText = "Not Running";
        } else if (status.studioApp === false) {
          studioAppEl.className = "rescale-status-val status-warn";
          studioAppEl.innerText = "Plugin disabled";
        } else {
          studioAppEl.className = "rescale-status-val status-ok";
          studioAppEl.innerText = "Connected";
        }

        // Place status
        if (status.studio === true) {
          studioPlaceEl.className = "rescale-status-val status-ok";
          studioPlaceEl.innerText = "Active Place Connected";
        } else {
          studioPlaceEl.className = "rescale-status-val status-warn";
          studioPlaceEl.innerText = "Open place in Studio";
        }

        // Tools status
        studioToolsEl.className = "rescale-status-val status-ok";
        studioToolsEl.innerText = `${status.tools || 0} Tools available`;
      } else {
        // Disconnected
        studioAppEl.className = "rescale-status-val status-warn";
        studioAppEl.innerText = "Offline";

        studioPlaceEl.className = "rescale-status-val status-warn";
        studioPlaceEl.innerText = "Offline";

        studioToolsEl.className = "rescale-status-val";
        studioToolsEl.innerText = "0 (MCP)";
      }
    }

    // Highlight current host in list if supported
    root.querySelectorAll(".rescale-ai-item").forEach((item) => {
      const hostVal = item.getAttribute("data-host");
      if (currentHost.includes(hostVal)) {
        item.classList.add("active-site");
      }
    });
  }
})();
