export function debounce(fn: () => void, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    call() {
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        fn();
      }, waitMs);
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
      }
      timer = undefined;
    },
  };
}
