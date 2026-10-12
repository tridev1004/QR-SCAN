const marked = Element.prototype as Element & { __upiMonitorOpenShadow?: boolean };

if (!marked.__upiMonitorOpenShadow) {
  marked.__upiMonitorOpenShadow = true;
  const original = marked.attachShadow;
  marked.attachShadow = function (init: ShadowRootInit): ShadowRoot {
    return original.call(this, { ...init, mode: "open" });
  };
}
