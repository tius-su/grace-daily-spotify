export function encyclopediaSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function isLegacyEncyclopediaIllustrationUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return false;

  const decoded = decodeURIComponent(value);
  return (
    decoded.includes("encyclopedia-banners/") &&
    (decoded.includes("-illustration") || decoded.includes("illustrationUrl"))
  );
}

export function isValidEncyclopediaIllustrationUrl(value: unknown) {
  return typeof value === "string" && (value.includes("encyclopedia-illustrations/") || value.includes("picsum.photos/seed"));
}

function textFromJson(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const data = value as Record<string, unknown>;
  const candidates = [
    data.isi_artikel,
    data.article,
    data.content,
    data.body,
    data.text,
    data.markdown,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }

  return "";
}

function parseJsonText(value: string): string {
  try {
    return textFromJson(JSON.parse(value));
  } catch {
    return "";
  }
}

function extractJsonStringField(value: string, field: string) {
  const fieldPattern = new RegExp(`"${field}"\\s*:\\s*"`, "i");
  const match = fieldPattern.exec(value);
  if (!match) return "";

  let result = "";
  let escaped = false;
  for (let index = match.index + match[0].length; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      result += char === "n" ? "\n" : char;
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === "\"") break;
    result += char;
  }

  return result.trim();
}

function stripMarkdownMarks(value: string) {
  return value
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "- ")
    .replace(/`([^`\n]+)`/g, "$1");
}

export function cleanEncyclopediaArticle(rawValue: unknown): string {
  const raw =
    typeof rawValue === "string"
      ? rawValue
      : rawValue == null
        ? ""
        : textFromJson(rawValue) || JSON.stringify(rawValue);

  let text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return "";

  const directJson = parseJsonText(text);
  if (directJson) text = directJson;

  text = text.replace(/```(?:json|markdown|md)?\s*([\s\S]*?)```/gi, (_match, block: string) => {
    const parsed = parseJsonText(block.trim());
    return parsed || extractJsonStringField(block, "isi_artikel") || "";
  });

  text = text.replace(/```(?:json|markdown|md)?[\s\S]*$/gi, "");

  const jsonStart = text.search(/\n?\s*\{\s*"?(title|description|keywords|seo|metadata|isi_artikel)"?\s*:/i);
  if (jsonStart > 0) {
    text = text.slice(0, jsonStart);
  } else if (jsonStart === 0) {
    text = extractJsonStringField(text, "isi_artikel") || "";
  }

  text = stripMarkdownMarks(text);

  return text
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function excerptFromArticle(value: unknown, maxLength = 160) {
  const text = cleanEncyclopediaArticle(value).replace(/\s+/g, " ").trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1).trim()}...` : text;
}
