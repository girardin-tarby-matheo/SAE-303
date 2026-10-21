
const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");

if ("IntersectionObserver" in window) {
  const io = new IntersectionObserver((entrees) => {
    for (const e of entrees) {
      if (!e.isIntersecting) continue;
      e.target.classList.add("est-visible");
      io.unobserve(e.target);
    }
  }, { threshold: 0.25 });
  elements.forEach((el) => io.observe(el));
} else {
  elements.forEach((el) => el.classList.add("est-visible"));
}
