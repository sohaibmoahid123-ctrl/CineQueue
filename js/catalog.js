// Shared catalog state for modules that need the current movie and TV entries.
let catalog = [];

export function setCatalog(movies) {
  catalog = Array.isArray(movies) ? movies : [];
}

export function getCatalog() {
  return catalog;
}
