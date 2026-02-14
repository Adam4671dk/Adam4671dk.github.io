const year = document.getElementById('year');
const contactForm = document.getElementById('contactForm');
const formMessage = document.getElementById('formMessage');

if (year) {
  year.textContent = String(new Date().getFullYear());
}

if (contactForm && formMessage) {
  contactForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const data = new FormData(contactForm);
    const name = data.get('name');

    formMessage.textContent = `Thanks${name ? `, ${name}` : ''}! Your request is in. We'll get back to you within 24 hours.`;
    contactForm.reset();
  });
}
