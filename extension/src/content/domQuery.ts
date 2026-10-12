export function queryAllDeep(root: ParentNode, selector: string): Element[] {
  const found: Element[] = [];
  const visit = (node: ParentNode) => {
    found.push(...Array.from(node.querySelectorAll(selector)));
    for (const element of Array.from(node.querySelectorAll("*"))) {
      const shadow = (element as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
      if (shadow) {
        visit(shadow);
      }
    }
  };
  visit(root);
  return found;
}

export function queryDeep<T extends Element>(root: ParentNode, selector: string): T | null {
  return (queryAllDeep(root, selector)[0] as T | undefined) ?? null;
}

export function forEachShadowRoot(root: ParentNode, visit: (shadow: ShadowRoot) => void): void {
  for (const element of Array.from(root.querySelectorAll("*"))) {
    const shadow = (element as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
    if (!shadow) {
      continue;
    }
    visit(shadow);
    forEachShadowRoot(shadow, visit);
  }
}
