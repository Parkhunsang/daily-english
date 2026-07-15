/**
 * Formats a study prompt, copies it to the clipboard, and opens the preferred external AI service in a new tab.
 * @param {string} sentenceEn - English sentence.
 * @param {string} sentenceKo - Korean translation.
 * @param {string} preferredAi - "chatgpt" or "gemini".
 */
export function askExternalAi(sentenceEn, preferredAi = "chatgpt") {
  const cleanEn = sentenceEn.replace(/\*/g, "").trim();

  // Try copying to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(cleanEn)
      .then(() => {
        console.log("English sentence copied to clipboard successfully!");
      })
      .catch((err) => {
        console.error("Failed to copy sentence to clipboard:", err);
      });
  } else {
    // Fallback: legacy execCommand for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = cleanEn;
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
    } catch {}
  }

  if (preferredAi === "gemini") {
    window.open("https://gemini.google.com/", "_blank");
    alert("💡 영어 문장이 클립보드에 복사되었습니다!\nGemini 창에 붙여넣기(Ctrl+V)하여 질문해 보세요. ✨");
  } else {
    // Default to ChatGPT (supports pre-filled queries via URL parameter)
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(cleanEn)}`, "_blank");
  }
}
