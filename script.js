const actionButton = document.getElementById('actionButton');
const message = document.getElementById('message');

if (actionButton && message) {
  actionButton.addEventListener('click', () => {
    message.textContent = `Button clicked at ${new Date().toLocaleTimeString()}`;
  });
}
