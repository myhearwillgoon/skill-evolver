function kebabCase(text) {
  if (typeof text !== "string" || !text.trim()) return "untitled-skill";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .slice(0, 6)
    .join("-");
}

function sanitizeSkillName(name) {
  return kebabCase(name);
}

module.exports = {
  kebabCase,
  sanitizeSkillName
};
