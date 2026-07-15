/**
 * Formats a study prompt, copies it to the clipboard, and opens the preferred external AI service in a new tab.
 * @param {string} sentenceEn - English sentence.
 * @param {string} sentenceKo - Korean translation.
 * @param {string} preferredAi - "chatgpt" or "gemini".
 */
export function askExternalAi(sentenceEn, sentenceKo, preferredAi = "chatgpt") {
  const cleanEn = sentenceEn.replace(/\*/g, "").trim();
  const cleanKo = sentenceKo.replace(/\*/g, "").trim();
  
  const prompt = `"${cleanEn}" (${cleanKo}) 이 영어 문장의 뜻과 문법 구조를 쉽게 설명해 주고, 원어민이 많이 쓰는 대체 표현도 몇 가지 예시와 함께 알려줘.`;

  // Try copying to clipboard
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(prompt)
      .then(() => {
        console.log("Prompt copied to clipboard successfully!");
      })
      .catch((err) => {
        console.error("Failed to copy prompt to clipboard:", err);
      });
  } else {
    // Fallback: legacy execCommand for older browsers
    try {
      const textArea = document.createElement("textarea");
      textArea.value = prompt;
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
    alert("💡 질문이 클립보드에 자동으로 복사되었습니다!\nGemini 대화창에 붙여넣기(Ctrl+V)하여 바로 물어보세요. ✨");
  } else {
    // Default to ChatGPT (supports pre-filled queries via URL parameter)
    window.open(`https://chatgpt.com/?q=${encodeURIComponent(prompt)}`, "_blank");
  }
}
