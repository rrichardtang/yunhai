(function initTravelPlannerOverlayManager(global) {
  function createOverlayManager() {
    const entries = new Map();

    function isVisible(entry) {
      if (!entry) return false;
      const node = entry.getNode();
      if (!node) return false;
      return entry.isVisible ? entry.isVisible(node) : !node.classList.contains('hidden');
    }

    function refresh() {
      const hasBlockingOverlay = Array.from(entries.values()).some((entry) => isVisible(entry));
      document.body.classList.toggle('overlay-active', hasBlockingOverlay);
      return hasBlockingOverlay;
    }

    function register(name, getNode, isVisible) {
      if (!name || typeof getNode !== 'function') return;
      entries.set(String(name), {
        getNode,
        isVisible: typeof isVisible === 'function' ? isVisible : null
      });
      refresh();
    }

    function unregister(name) {
      entries.delete(String(name));
      refresh();
    }

    function open(name) {
      const entry = entries.get(String(name));
      const node = entry?.getNode?.();
      if (node) node.classList.remove('hidden');
      refresh();
      return node;
    }

    function close(name) {
      const entry = entries.get(String(name));
      const node = entry?.getNode?.();
      if (node) node.classList.add('hidden');
      refresh();
      return node;
    }

    return {
      register,
      unregister,
      open,
      close,
      refresh
    };
  }

  global.TravelPlannerOverlayManager = {
    createOverlayManager
  };
})(window);
