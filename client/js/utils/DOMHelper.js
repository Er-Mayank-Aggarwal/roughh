export class DOMHelper {
  static getElement(id) {
    return document.getElementById(id);
  }

  static querySelector(selector) {
    return document.querySelector(selector);
  }

  static toggleClass(element, className, force) {
    element?.classList.toggle(className, force);
  }

  static addClass(element, className) {
    element?.classList.add(className);
  }

  static removeClass(element, className) {
    element?.classList.remove(className);
  }

  static setIcon(button, iconClass) {
    const icon = button?.querySelector("i");
    if (icon) icon.className = iconClass;
  }

  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
