// Après une navigation, attend que l'écran de chargement (squelette) ait laissé place au contenu.
export function settle(page) {
  const wait = () => page.locator("[aria-busy=true]").first().waitFor({ state: "detached", timeout: 15000 }).catch(() => {});
  for (const m of ["goto", "reload", "waitForURL"]) {
    const orig = page[m].bind(page);
    page[m] = async (...args) => {
      const r = await orig(...args);
      await wait();
      return r;
    };
  }
  return page;
}
