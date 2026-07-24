const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\"",
};

function decodeEntity(match: string, entity: string) {
  if (!entity.startsWith("#")) {
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  }

  const isHexadecimal = entity[1]?.toLowerCase() === "x";
  const value = Number.parseInt(entity.slice(isHexadecimal ? 2 : 1), isHexadecimal ? 16 : 10);

  if (
    !Number.isInteger(value) ||
    value < 0 ||
    value > 0x10ffff ||
    (value >= 0xd800 && value <= 0xdfff)
  ) {
    return match;
  }

  return String.fromCodePoint(value);
}

export function decodeHtmlEntities(value: string) {
  let decoded = value;

  for (let pass = 0; pass < 2; pass += 1) {
    const next = decoded.replace(
      /&(#(?:x[\da-f]+|\d+)|[a-z][a-z\d]+);/gi,
      decodeEntity,
    );
    if (next === decoded) break;
    decoded = next;
  }

  return decoded.replace(/\u00a0/g, " ");
}
