function normalizeText(text) {
  if (typeof text !== "string") return "";
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean);
}

function wordNgrams(tokens, n = 2) {
  const grams = [];
  if (tokens.length < n) {
    return tokens.length > 0 ? [tokens.join(" ")] : [];
  }
  for (let i = 0; i <= tokens.length - n; i += 1) {
    grams.push(tokens.slice(i, i + n).join(" "));
  }
  return grams;
}

function termFrequency(terms) {
  const freq = {};
  for (const term of terms) {
    freq[term] = (freq[term] || 0) + 1;
  }
  return freq;
}

function ngramCosine(a, b, n = 2) {
  const termsA = wordNgrams(tokenize(a), n);
  const termsB = wordNgrams(tokenize(b), n);
  if (termsA.length === 0 || termsB.length === 0) return 0;

  const freqA = termFrequency(termsA);
  const freqB = termFrequency(termsB);
  const vocab = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const term of vocab) {
    const va = freqA[term] || 0;
    const vb = freqB[term] || 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Simple character-level minhash signature for fast dedup
function charShingles(text, k = 3) {
  const normalized = normalizeText(text);
  const set = new Set();
  if (normalized.length < k) {
    set.add(normalized || "_");
    return set;
  }
  for (let i = 0; i <= normalized.length - k; i += 1) {
    set.add(normalized.slice(i, i + k));
  }
  return set;
}

function hashInt(str, seed = 0) {
  let h = seed;
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function minhashSignature(text, numHashes = 32) {
  const shingles = charShingles(text, 3);
  const sig = [];
  for (let i = 0; i < numHashes; i += 1) {
    let min = Infinity;
    for (const shingle of shingles) {
      const h = hashInt(shingle, i + 1);
      if (h < min) min = h;
    }
    sig.push(min === Infinity ? 0 : min);
  }
  return sig;
}

function minhashJaccard(sigA, sigB) {
  if (sigA.length !== sigB.length || sigA.length === 0) return 0;
  let equal = 0;
  for (let i = 0; i < sigA.length; i += 1) {
    if (sigA[i] === sigB[i]) equal += 1;
  }
  return equal / sigA.length;
}

function embeddingVector(text) {
  const tokens = tokenize(text);
  const grams = wordNgrams(tokens, 2);
  const freq = termFrequency(grams);
  return Object.entries(freq)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([term, count]) => ({ term, count }));
}

module.exports = {
  charShingles,
  embeddingVector,
  minhashJaccard,
  minhashSignature,
  ngramCosine,
  normalizeText,
  tokenize,
  wordNgrams
};
