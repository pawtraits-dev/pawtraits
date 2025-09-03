// Simple script to click the 'new' filter button
const filterButtons = document.querySelectorAll('button');
for (let button of filterButtons) {
  if (button.textContent.trim().toLowerCase() === 'new') {
    button.click();
    console.log('Clicked new filter button');
    break;
  }
}