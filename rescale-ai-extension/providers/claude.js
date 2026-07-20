// SPDX-License-Identifier: GPL-3.0-or-later
// providers/claude.js - Claude (claude.ai) provider.
// Exports the same ZSProvider interface as providers/deepseek.js.

const ZSProvider = (() => {
  "use strict";
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  let diag = () => {}; // injected by core via init()

  const S = {
    anyItem: '[data-testid="user-message"], [data-testid="assistant-message"], .font-user-message, [class*="ConversationTurn"]',
    userItem: '[data-testid="user-message"], .font-user-message',
    assistantItem: '[data-testid="assistant-message"], [class*="ConversationTurn"]',
    reply: ".prose",
    editor: 'div[contenteditable="true"], div.ProseMirror',
    inputArea: "fieldset, form, div.ProseMirror",
    sendBtn: 'button[aria-label="Send message"], button[data-testid="send-button"]',
    stopBtn: 'button[aria-label="Stop generating"]',
    errorSurfaces: '[role="alert"], [class*="error"], [class*="alert"]',
  };

  const RE = {
    contextLimit: /context limit|too long|start a new chat|message too long/i,
    tooLong: /conversation too long|message too long/i,
    busy: /something went wrong|try again later|rate limit/i,
    stopped: /stopped|arrété|arrêté/i,
  };

  const timings = {
    GEN_IDLE_MS: 1500,
    REASON_IDLE_MS: 12000,
    WARMUP_MS: 45000,
    REASON_NOREPLY_MS: 90000,
    STABLE_MS: 9000,
    RESPONSE_TIMEOUT_MS: 300000,
  };

  // ── Turn classification ───────────────────────────────────────────────────
  const isUserItem = (item) => {
    if (!item) return false;
    return item.matches('[data-testid="user-message"]') || 
           item.classList.contains('font-user-message') || 
           !!item.querySelector('.font-user-message');
  };

  const isAssistantItem = (item) => {
    if (!item) return false;
    return !isUserItem(item) && 
           (item.matches('[data-testid="assistant-message"]') || 
            !!item.querySelector('.prose'));
  };

  const allItems = () => {
    return [...document.querySelectorAll(S.anyItem)].sort((a, b) => {
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  };

  const assistantItems = () => allItems().filter(isAssistantItem);
  const assistantCount = () => assistantItems().length;
  const userCount = () => allItems().filter(isUserItem).length;
  const chatIsEmpty = () => allItems().length === 0;

  const getEditor = () => {
    for (const sel of [S.editor, "div[contenteditable='true']"]) {
      const e = document.querySelector(sel);
      if (e && !e.closest("#zs-root")) return e;
    }
    return null;
  };

  const editorText = () => {
    const e = getEditor();
    return e ? e.textContent || "" : "";
  };

  const lastAssistant = () => {
    const it = assistantItems();
    return it.length ? it[it.length - 1] : null;
  };

  const isFreshChat = () => chatIsEmpty() && !!getEditor();
  const composerFrame = () => {
    const ed = getEditor();
    return ed ? ed.closest('fieldset') || ed.closest('form') || ed.parentElement : null;
  };

  function barMount() {
    const ed = getEditor();
    if (!ed) return null;
    
    let composerCard = null;
    const send = document.querySelector(S.sendBtn);
    if (send) {
      let p = ed.parentElement;
      while (p) {
        if (p.contains(send)) {
          composerCard = p;
          break;
        }
        p = p.parentElement;
      }
    }
    if (!composerCard) {
      composerCard = ed.parentElement.parentElement;
    }
    if (!composerCard) return null;
    
    let child = ed;
    while (child && child.parentElement !== composerCard) {
      child = child.parentElement;
    }
    if (!child) return null;
    
    return { parent: composerCard, before: child, inside: false };
  }

  function barAnchor() {
    return null;
  }

  // ── Input lock ────────────────────────────────────────────────────────────
  let _locked = false;
  function setInputLock(on) {
    _locked = on;
    const ed = getEditor();
    if (!ed) return;
    ed.setAttribute("contenteditable", on ? "false" : "true");
    const ph = ed.parentElement || ed;
    if (on) ph.setAttribute("data-zs-locked", "1");
    else ph.removeAttribute("data-zs-locked");
  }

  // ── Generation detection ──────────────────────────────────────────────────
  function streamText(item) {
    if (!item) return "";
    const md = item.querySelector(S.reply);
    return md ? textWithout(md, ".zs-chip") : "";
  }

  const streamLen = (item) => streamText(item === undefined ? lastAssistant() : item).length;

  let _streamMax = -1, _streamAt = 0, _streamItem = null;
  function sampleStream() {
    const item = lastAssistant();
    const len = streamText(item).length;
    const now = Date.now();
    if (item !== _streamItem || len < _streamMax - 400) {
      _streamItem = item; _streamMax = len; _streamAt = now; return;
    }
    if (len > _streamMax) { _streamMax = len; _streamAt = now; }
  }
  const grewWithin = (ms) => _streamMax > 1 && Date.now() - _streamAt < ms;

  function isGenerating() {
    if (document.querySelector(S.stopBtn)) return true;
    sampleStream();
    return grewWithin(timings.GEN_IDLE_MS);
  }

  function isBusyNow() {
    if (document.querySelector(S.stopBtn)) return true;
    sampleStream();
    return grewWithin(timings.GEN_IDLE_MS);
  }

  function isHardGenerating() {
    return !!document.querySelector(S.stopBtn);
  }

  function snapshot() {
    try {
      const it = lastAssistant();
      if (!it) return { th: 0, rp: 0 };
      const md = it.querySelector(S.reply);
      return {
        th: 0,
        rp: md ? (md.textContent || "").length : 0,
      };
    } catch { return {}; }
  }

  const turnHalted = () => false;
  const findContinueBtn = () => null;
  const clickContinueBtn = () => false;

  // ── Text extraction helper ───────────────────────────────────────────────
  function textWithout(root, excludeSel) {
    if (!root) return "";
    let t = "";
    const walk = (n) => {
      if (n.nodeType === 3) { t += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      if (n.matches && excludeSel && n.matches(excludeSel)) return;
      for (const c of n.childNodes) walk(c);
    };
    walk(root);
    return t;
  }

  function itemText(item) {
    if (!item) return "";
    if (isAssistantItem(item)) {
      const md = item.querySelector(S.reply);
      return md ? textWithout(md, ".zs-chip").trim() : "";
    }
    return textWithout(item);
  }

  function classifyText(item, excludeSel) {
    if (isAssistantItem(item)) {
      const md = item.querySelector(S.reply);
      if (!md || (excludeSel && md.closest(excludeSel))) return "";
      return textWithout(md, excludeSel);
    }
    return textWithout(item, excludeSel);
  }

  function readAssistant() {
    const item = lastAssistant();
    if (!item) return { present: false, reply: "", thinking: "", item: null };
    const md = item.querySelector(S.reply);
    return {
      present: true,
      reply: md ? textWithout(md, ".zs-chip").trim() : "",
      thinking: "",
      item,
    };
  }

  async function waitFor(pred, timeout) {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      if (pred()) return true;
      await sleep(120);
    }
    return false;
  }

  // ── Message sending ───────────────────────────────────────────────────────
  async function typeAndSend(text, images) {
    const ed = getEditor();
    if (!ed) throw new Error("Claude input box not found");
    const relock = _locked;
    if (relock) ed.setAttribute("contenteditable", "true");
    try {
      ed.focus();
      const sel = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(ed);
      sel.removeAllRanges();
      sel.addRange(range);
      
      const lines = String(text).split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (lines[i]) document.execCommand("insertText", false, lines[i]);
        if (i < lines.length - 1) document.execCommand("insertLineBreak");
      }
      
      ed.dispatchEvent(new Event("input", { bubbles: true }));
      
      if (images && images.length) {
        await attachImages(images);
      }

      await sleep(300); // Give React time to bind state
      const btn = document.querySelector(S.sendBtn);
      if (btn && !btn.disabled) {
        btn.click();
      } else {
        // Fallback: Dispatch Enter key event
        ed.dispatchEvent(new KeyboardEvent("keydown", {
          key: "Enter",
          code: "Enter",
          keyCode: 13,
          which: 13,
          bubbles: true,
          cancelable: true
        }));
      }
    } finally {
      if (relock) ed.setAttribute("contenteditable", "false");
    }
  }

  function stopGeneration() {
    const btn = document.querySelector(S.stopBtn);
    if (btn) btn.click();
  }

  function scanError() {
    try {
      for (const el of document.querySelectorAll(S.errorSurfaces)) {
        if (el.offsetParent === null) continue;
        if (el.closest(S.anyItem)) continue;
        const t = (el.innerText || "").trim();
        if (t.length > 8 && t.length < 600 && RE.contextLimit.test(t)) return t.slice(0, 240);
      }
    } catch {}
    if (!getEditor()) return "The input box disappeared.";
    return null;
  }

  const isTooLongMsg = (text) => RE.tooLong.test(text);
  const isBusyMsg = (text) => RE.busy.test(text);

  // ── Image attachment ──────────────────────────────────────────────────────
  function fileFromImage(img, i) {
    const mime = img.mimeType || "image/jpeg";
    const bin = atob(img.data);
    const arr = new Uint8Array(bin.length);
    for (let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
    const ext = mime.includes("png") ? "png" : "jpg";
    return new File([arr], `rescale_${Date.now()}_${i}.${ext}`, { type: mime });
  }

  async function attachImages(images) {
    const ed = getEditor();
    if (!ed) return false;
    if (!images || !images.length) return false;
    const dt = new DataTransfer();
    images.forEach((img, i) => { try { dt.items.add(fileFromImage(img, i)); } catch {} });
    if (!dt.items.length) return false;

    const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) return false;

    try {
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(1500); // Wait for upload preview
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearAttachments() {
    // Claude close attachments button
    try {
      document.querySelectorAll("button[aria-label*='emove'], button[aria-label*='elete'], [class*='remove']").forEach((b) => {
        try { b.click(); } catch {}
      });
    } catch {}
  }

  const conversationKey = () => {
    const m = window.location.pathname.match(/\/chat\/([a-f0-9\-]+)/);
    return m ? "claude_" + m[1] : (chatIsEmpty() ? "" : "claude_default");
  };

  // ── User-send interception ────────────────────────────────────────────────
  function installSendHooks(handlers) {
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
        const ed = getEditor();
        if (!ed || !ed.contains(e.target)) return;
        if (editorText().trim() === "") return;
        if (handlers.isBlocked()) return;
        if (!handlers.isStarted()) {
          if (!chatIsEmpty()) return;
          handlers.onBlockedAttempt();
          return;
        }
        handlers.onUserMessage(assistantCount());
      },
      true
    );

    document.addEventListener(
      "click",
      (e) => {
        if (!getEditor()) return;
        const btn = e.target && e.target.closest && e.target.closest("button");
        if (!btn) return;
        if (btn.matches(S.stopBtn)) {
          handlers.onNativeStop();
          return;
        }
        if (!btn.matches(S.sendBtn)) return;
        if (handlers.isBlocked()) return;
        if (!handlers.isStarted()) {
          if (!chatIsEmpty()) return;
          handlers.onBlockedAttempt();
          return;
        }
        handlers.onUserMessage(assistantCount());
      },
      true
    );
  }

  function findToolBlockSpot(item) {
    const md = item && item.querySelector(S.reply);
    return md ? { parent: md, before: null, inside: true } : null;
  }

  return {
    id: "claude",
    displayName: "Claude",
    supportsVision: true,
    timings,
    thinkingSel: null,
    chipAtItemLevel: true,
    coverPad: 0,
    coverOffsetY: 0,
    reliableCounts: true,
    unstableWarning: null,
    init({ diag: d } = {}) { if (d) diag = d; },
    // turns
    allItems, isUserItem, isAssistantItem, itemText, classifyText,
    assistantCount, userCount, lastAssistant, readAssistant,
    streamLen, snapshot,
    // composer / state
    getEditor, editorText, chatIsEmpty, isFreshChat, composerFrame, barMount, barAnchor,
    setInputLock, typeAndSend, stopGeneration,
    isGenerating, isBusyNow, isHardGenerating,
    enforceComposer() { return { ready: true }; },
    ensureComposerReady() { return { ready: true }; },
    turnHalted, findContinueBtn, clickContinueBtn,
    scanError, isTooLongMsg, isBusyMsg,
    // actions
    attachImages, clearAttachments, conversationKey,
    installSendHooks, findToolBlockSpot,
  };
})();
