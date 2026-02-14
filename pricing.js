document.querySelectorAll('.toggle-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const billing = btn.dataset.billing;
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    document.querySelectorAll('.price-monthly, .price-annual').forEach(el => {
      el.style.display = 'none';
    });

    if (billing === 'monthly') {
      document.querySelectorAll('.price-monthly').forEach(el => {
        el.style.display = 'block';
      });
    } else {
      document.querySelectorAll('.price-annual').forEach(el => {
        el.style.display = 'block';
      });
    }
  });
});

document.querySelectorAll('.pricing-card .btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const planName = btn.closest('.pricing-card').querySelector('.pricing-title').textContent;
    alert(`Selected plan: ${planName}\n\nRedirecting to checkout...`);
  });
});
