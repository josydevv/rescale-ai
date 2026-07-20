// app.js - Rescale AI Website Interaction

document.addEventListener("DOMContentLoaded", () => {
  // FAQ Accordion Logic
  const faqItems = document.querySelectorAll(".faq-item");

  faqItems.forEach((item) => {
    const question = item.querySelector(".faq-question");

    question.addEventListener("click", () => {
      const isActive = item.classList.contains("active");
      
      // Close all items first (accordion style)
      faqItems.forEach((el) => {
        el.classList.remove("active");
        const answer = el.querySelector(".faq-answer");
        answer.style.maxHeight = null;
      });

      // Open clicked item if it wasn't active
      if (!isActive) {
        item.classList.add("active");
        const answer = item.querySelector(".faq-answer");
        answer.style.maxHeight = answer.scrollHeight + "px";
      }
    });
  });
});
