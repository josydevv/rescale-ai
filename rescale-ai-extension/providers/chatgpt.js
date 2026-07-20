// SPDX-License-Identifier: GPL-3.0-or-later
// providers/chatgpt.js - Rescale AI extension provider for chatgpt.com

const ZSProvider = (() => {
  let diag = () => {};
  const timings = {
    answerTickMs: 250,
    answerStabilizeMs: 1500,
    busyCoolDownMs: 1000
  };

  const S = {
    anyItem: '[data-testid*="conversation-turn"]',
    userItem: '[data-testid*="user-message"]',
    assistantItem: '[data-testid*="assistant-message"]',
    reply: '.prose',
    editor: 'textarea#prompt-textarea, div[contenteditable="true"]',
    inputArea: 'form, fieldset',
    sendBtn: 'button[data-testid="send-button"], button[aria-label="Send message"]',
    stopBtn: 'button[data-testid="stop-button"], button[aria-label="Stop generating"]',
    errorSurfaces: '[role="alert"], [class*="error"]',
  };

  const RE = {
    contextLimit: /(context limit|token limit|maximum length|too long)/i,
    busy: /(server busy|rate limit|too many requests)/i,
    tooLong: /(too long|maximum length|exceeded)/i,
  };

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ── Conversation turns ───────────────────────────────────────────────────
  const allItems = () => {
    return Array.from(document.querySelectorAll(S.anyItem)).sort((a, b) => {
      return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });
  };

  const isUserItem = (item) => !!item.querySelector(S.userItem);
  const isAssistantItem = (item) => !!item.querySelector(S.assistantItem);

  const itemText = (item) => {
    const r = item.querySelector(S.reply);
    return r ? r.innerText || "" : "";
  };

  const classifyText = (text) => {
    return { isCode: text.includes("```"), language: "luau" };
  };

  const assistantItems = () => allItems().filter(isAssistantItem);
  const assistantCount = () => assistantItems().length;
  const userCount = () => allItems().filter(isUserItem).length;
  const chatIsEmpty = () => allItems().length === 0;

  const getEditor = () => {
    for (const sel of [S.editor, "textarea#prompt-textarea", "div[contenteditable='true']"]) {
      const e = document.querySelector(sel);
      if (e && !e.closest("#zs-root")) return e;
    }
    return null;
  };

  const editorText = () => {
    const e = getEditor();
    if (!e) return "";
    return e.tagName === "TEXTAREA" ? e.value : (e.textContent || "");
  };

  const lastAssistant = () => {
    const it = assistantItems();
    return it.length ? it[it.length - 1] : null;
  };

  const readAssistant = (item) => {
    const txt = itemText(item);
    return { ok: true, text: txt };
  };

  const streamLen = (item) => {
    return itemText(item).length;
  };

  const snapshot = (item) => {
    return itemText(item);
  };

  const isFreshChat = () => chatIsEmpty() && !!getEditor();

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
    if (ed.tagName === "TEXTAREA") {
      ed.disabled = on;
    } else {
      ed.setAttribute("contenteditable", on ? "false" : "true");
    }
    const ph = ed.parentElement || ed;
    if (on) ph.setAttribute("data-zs-locked", "1");
    else ph.removeAttribute("data-zs-locked");
  }

  async function typeAndSend(text, images) {
    const ed = getEditor();
    if (!ed) return;
    
    const relock = _locked;
    if (relock) setInputLock(false);
    
    try {
      ed.focus();
      
      if (ed.tagName === "TEXTAREA") {
        ed.value = text;
        ed.dispatchEvent(new Event("input", { bubbles: true }));
        ed.dispatchEvent(new Event("change", { bubbles: true }));
      } else {
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
      }

      if (images && images.length) {
        await attachImages(images);
      }

      await sleep(400);
      
      const btn = document.querySelector(S.sendBtn);
      if (btn && !btn.disabled) {
        btn.click();
      } else {
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
      if (relock) setInputLock(true);
    }
  }

  function stopGeneration() {
    const btn = document.querySelector(S.stopBtn);
    if (btn) btn.click();
  }

  const isGenerating = () => !!document.querySelector(S.stopBtn);
  const isBusyNow = () => isGenerating();
  const isHardGenerating = () => isGenerating();
  const turnHalted = (item) => false;
  const findContinueBtn = () => null;
  const clickContinueBtn = (btn) => { if (btn) btn.click(); };

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

  // ── Image attachments ─────────────────────────────────────────────────────
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
      await sleep(1500);
      return true;
    } catch (e) {
      return false;
    }
  }

  function clearAttachments() {
    try {
      document.querySelectorAll("button[aria-label*='emove'], button[aria-label*='elete'], [class*='remove']").forEach((b) => {
        try { b.click(); } catch {}
      });
    } catch {}
  }

  const conversationKey = () => {
    const m = window.location.pathname.match(/\/c\/([a-f0-9\-]+)/);
    return m ? "chatgpt_" + m[1] : (chatIsEmpty() ? "" : "chatgpt_default");
  };

  function installSendHooks(handlers) {
    document.addEventListener("keydown", (e) => {
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
    }, true);

    document.addEventListener("click", (e) => {
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
    }, true);
  }

  function findToolBlockSpot(item) {
    const md = item && item.querySelector(S.reply);
    return md ? { parent: md, before: null, inside: true } : null;
  }

  return {
    id: "chatgpt",
    name: "ChatGPT",
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
