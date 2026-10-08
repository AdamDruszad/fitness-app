/** Convert API errors, including FastAPI validation arrays, into renderable text. */
export function apiError(error, fallback = "Something went wrong. Please try again.") {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail.trim();
  if (Array.isArray(detail)) {
    const messages = detail.flatMap((item) => {
      if (!item || typeof item.msg !== "string" || !item.msg.trim()) return [];
      const field = Array.isArray(item.loc)
        ? item.loc.filter((part) => part !== "body" && typeof part === "string").join(" · ").replaceAll("_", " ")
        : "";
      return [field ? `${field}: ${item.msg.trim()}` : item.msg.trim()];
    });
    if (messages.length) return messages.join(". ");
  }
  return fallback;
}
