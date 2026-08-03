(function () {
  document.addEventListener('click', function (e) {
    var trigger = e.target.closest('[data-row-menu-toggle]');
    var openMenus = document.querySelectorAll('.row-menu.is-open');

    if (trigger) {
      e.preventDefault();
      e.stopPropagation();
      var menu = trigger.nextElementSibling;
      var wasOpen = menu.classList.contains('is-open');
      openMenus.forEach(function (m) { m.classList.remove('is-open'); });
      if (!wasOpen) menu.classList.add('is-open');
      return;
    }

    if (!e.target.closest('.row-menu')) {
      openMenus.forEach(function (m) { m.classList.remove('is-open'); });
    }
  });
})();
