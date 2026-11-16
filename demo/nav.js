// The demo page's tabs. The page opens on its home (#home), which leads to the two groups.
// The bar at the top picks a group (Objects, UI), the row under the bar picks a sheet in it,
// and one sheet is on show at a time. The address names the sheet (#model), so links, reloads
// and the back button work, and a group's name (#ui) opens whichever of its sheets was open last.
//
// A scene measures its box when it is made, and a hidden box measures nothing, so a sheet's
// scenes are built the first time it is shown: index.html hands each sheet's builders
// to LoftDemo.whenShown(id, build). Without this file they build at once.
(() => {
  const root = document.documentElement, bar = document.querySelector('.bar');
  if (!bar) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const site = 'Loft';

  // ── The groups and their sheets, read from the page ────────────────────
  const groups = [...document.querySelectorAll('.subnav')].map((nav) => {
    const tabs = nav.querySelector('.tabs');
    const group = { id: nav.id, nav, tabs, label: nav.querySelector('.subnav__name').textContent.trim(), link: bar.querySelector(`a[href="#${nav.id}"]`) };
    group.sheets = [...tabs.querySelectorAll('a[href^="#"]')].map((link) => {
      const el = document.getElementById(link.getAttribute('href').slice(1));
      return { id: el.id, el, group, link, label: link.textContent.trim(), head: el.querySelector('h2') };
    });
    group.last = group.sheets[0];
    return group;
  });
  const sheets = groups.flatMap((g) => g.sheets);
  // The home page is a sheet of its own, outside every group: no row of tabs, and the mark is its link.
  const homeEl = document.getElementById('home');
  let home = null;
  if (homeEl) {
    const group = { id: 'home', nav: null, tabs: null, label: 'Home', link: bar.querySelector('.mark') };
    home = { id: 'home', el: homeEl, group, link: null, label: 'Home', head: homeEl.querySelector('h1') };
    group.sheets = [home];
    group.last = home;
  }
  const pages = home ? [home, ...sheets] : sheets;
  const named = new Map([...groups, ...pages].map((x) => [x.id, x]));
  const homeTitle = document.title;
  const find = (hash) => {
    const hit = named.get(decodeURIComponent(String(hash || '').replace(/^#/, '')));
    return !hit ? null : hit.sheets ? hit.last : hit;
  };
  const majors = bar.querySelector('.majors .tabs');
  const mark = (el, value) => (value ? el.setAttribute('aria-current', value) : el.removeAttribute('aria-current'));

  // ── Builders: a sheet's scenes are made the first time it is shown ──────
  const builders = new Map(), built = new Set();
  const run = (sheet, fn) => {
    try { fn(); } catch (err) { console.error(`Loft demo: the ${sheet.label} sheet did not build.`, err); }
  };
  const build = (sheet) => {
    if (built.has(sheet.id)) return;
    built.add(sheet.id);
    for (const fn of builders.get(sheet.id) || []) run(sheet, fn);
  };

  // ── The tab under way is underlined in the accent; the line slides to the next one ──
  // The line is part of the row's scrolling width, so the fades are checked again once it has moved.
  const place = (tabs, link) => {
    tabs.style.setProperty('--x', `${link.offsetLeft}px`);
    tabs.style.setProperty('--w', `${link.offsetWidth}px`);
    tabs.syncEdges?.();
  };
  const placeAll = () => {
    if (!current) return;
    if (current.group.tabs) {
      place(majors, current.group.link);
      place(current.group.tabs, current.link);
    } else {
      majors.style.setProperty('--w', '0px'); // home: no group is under way
    }
  };

  // A row too wide for the screen scrolls sideways. It keeps its chosen item in view, and
  // fades at whichever end has more beyond it.
  const reveal = (scroller, el, smooth) => {
    const pad = 28, left = el.offsetLeft - pad, right = el.offsetLeft + el.offsetWidth + pad - scroller.clientWidth;
    const to = scroller.scrollLeft > left ? left : scroller.scrollLeft < right ? right : null;
    if (to !== null) scroller.scrollTo({ left: Math.max(0, to), behavior: smooth && !reduce.matches ? 'smooth' : 'instant' });
  };
  const edges = (scroller, content = scroller) => {
    const sync = () => {
      const more = scroller.scrollWidth - scroller.clientWidth - scroller.scrollLeft;
      scroller.classList.toggle('more-before', scroller.scrollLeft > 1);
      scroller.classList.toggle('more-after', more > 1);
    };
    scroller.addEventListener('scroll', sync, { passive: true });
    scroller.addEventListener('transitionend', sync); // the line has finished sliding
    const ro = new ResizeObserver(sync);
    ro.observe(scroller);
    if (content !== scroller) ro.observe(content);
    scroller.syncEdges = sync;
    sync();
  };

  // ── Previous and next, at the foot of every sheet ───────────────────────
  const arrow = (back) => `<svg class="pager__arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="${back ? 'M19 12H5M11 6l-6 6 6 6' : 'M5 12h14M13 6l6 6-6 6'}"/></svg>`;
  sheets.forEach((sheet, k) => {
    const pager = document.createElement('nav');
    pager.className = 'pager';
    pager.setAttribute('aria-label', 'Previous and next');
    for (const [to, back] of [[sheets[k - 1], true], [sheets[k + 1], false]]) {
      if (!to) continue;
      const a = document.createElement('a');
      a.className = `pager__link pager__link--${back ? 'prev' : 'next'}`;
      a.href = `#${to.id}`;
      a.innerHTML = `<span class="tag"></span><span class="pager__name">${back ? arrow(true) : ''}<span></span>${back ? '' : arrow(false)}</span>`;
      // Crossing into another group says so.
      a.firstChild.textContent = (back ? 'Previous' : 'Next') + (to.group === sheet.group ? '' : ` in ${to.group.label}`);
      a.querySelector('.pager__name > span').textContent = to.label;
      pager.append(a);
    }
    (sheet.el.querySelector(':scope > .wrap') || sheet.el).append(pager);
  });

  // ── Going to a sheet ─────────────────────────────────────────────────────
  let current = null;
  const enter = (sheet) => {
    if (reduce.matches) return;
    sheet.el.classList.remove('is-entering');
    void sheet.el.offsetWidth; // start the entrance again if it was still playing
    sheet.el.classList.add('is-entering');
  };
  document.addEventListener('animationend', (e) => {
    if (e.animationName === 'sheet-in') e.target.closest('.sheet')?.classList.remove('is-entering');
  });

  // Where the page stands when a sheet's row of tabs is just under the bar.
  const sheetTop = (sheet) => (!sheet.group.nav ? 0 : Math.round(sheet.el.getBoundingClientRect().top + scrollY - sheet.group.nav.offsetHeight - bar.offsetHeight + 1));
  // From further down, the new sheet has replaced the old one in place, so the page goes to
  // its top at once. From above, in the hero, the page travels down to it.
  const toTop = (sheet, travel = 'auto') => {
    const y = sheetTop(sheet), d = y - scrollY;
    if (Math.abs(d) < 2) return;
    window.scrollTo({ top: y, behavior: travel === 'auto' && d > 0 && !reduce.matches ? 'smooth' : 'instant' });
  };

  function go(next, { push = false, travel = 'auto', focus = false } = {}) {
    if (!next) return;
    const from = current;
    if (next !== from) {
      current = next;
      next.group.last = next;
      for (const g of groups) {
        const on = g === next.group;
        g.nav.classList.toggle('is-on', on);
        mark(g.link, on && 'true');
      }
      if (home) mark(home.group.link, next === home && 'page');
      for (const s of pages) {
        const on = s === next;
        s.el.classList.toggle('is-on', on);
        if (s.link) mark(s.link, on && 'page');
      }
      placeAll();
      if (next.group.tabs) reveal(next.group.tabs, next.link, from && from.group === next.group);
      build(next);
      if (from) {
        enter(next);
        document.title = next === home ? homeTitle : `${next.label} · ${site}`;
      }
    }
    if (push && location.hash !== `#${next.id}`) history.pushState(null, '', `#${next.id}`);
    if (travel !== 'none') toTop(next, travel);
    // A link inside a sheet (the pager, the hero's buttons) is left behind, so the reader is
    // taken to the new sheet's heading. Tabs stay where they are, and so does their focus.
    if (focus && next.head) next.head.focus({ preventScroll: true });
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (href === '#top') {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: reduce.matches ? 'instant' : 'smooth' });
      return;
    }
    const next = find(href);
    if (!next) return;
    e.preventDefault();
    go(next, { push: true, focus: !a.closest('.bar, .subnav') });
  });
  addEventListener('popstate', () => go(find(location.hash) || pages[0], { travel: 'instant' }));
  addEventListener('hashchange', () => {
    const next = find(location.hash);
    if (next && next !== current) go(next, { travel: 'instant' });
  });

  // ── The design-system picker floats under the bar and keeps the chosen one in view ──
  const looks = document.getElementById('looks');
  if (looks) {
    const scroller = looks.parentElement;
    edges(scroller, looks);
    new MutationObserver(() => {
      const on = looks.querySelector('[aria-pressed="true"]');
      if (on) reveal(scroller, on, true);
    }).observe(looks, { subtree: true, attributeFilter: ['aria-pressed'] });
  }
  // Once a group's row of tabs has come up as far as the picker, the picker slips beneath the
  // row and comes out below it (index.html moves it), and it goes back up when the row leaves.
  // When the page is put in place rather than scrolled there, the picker is too.
  const float = document.querySelector('.float'), pill = float && float.querySelector('.looks');
  let queued = false;
  const settle = (instant = false) => {
    queued = false;
    if (!pill || !current) return;
    const rest = float.getBoundingClientRect().top + pill.offsetTop; // where the picker sits under the bar
    const low = !!current.group.nav && current.group.nav.getBoundingClientRect().top <= rest;
    if (low === float.classList.contains('is-low')) return;
    if (instant) pill.style.transition = 'none';
    float.classList.toggle('is-low', low);
    if (instant) {
      void pill.offsetWidth;
      pill.style.transition = '';
    }
  };
  const queue = () => {
    if (queued || !pill) return;
    queued = true;
    requestAnimationFrame(() => settle());
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);

  // ── Start ────────────────────────────────────────────────────────────────
  for (const s of pages) if (s.head) s.head.tabIndex = -1;
  for (const tabs of [majors, ...groups.map((g) => g.tabs)]) {
    edges(tabs);
    new ResizeObserver(placeAll).observe(tabs);
  }
  const first = find(location.hash);
  go(first || pages[0], { travel: 'none' });
  settle(true);
  if (first) {
    if (first !== home) document.title = `${first.label} · ${site}`;
    // A group's name (#ui) becomes the sheet it opened, so the back button returns to that sheet.
    if (location.hash !== `#${first.id}`) history.replaceState(history.state, '', `#${first.id}`);
  }

  // The page, not the browser, decides where it stands: the browser would restore a place
  // before the sheet it belonged to is back on show. A link to a sheet opens at its top, back
  // and forward go to the top of the sheet they return to, and a reload returns to the place
  // the reader left, once the sheet below it has been built.
  history.scrollRestoration = 'manual';
  const KEY = 'loft-demo-place';
  addEventListener('pagehide', () => {
    try { sessionStorage.setItem(KEY, JSON.stringify({ hash: location.hash, y: Math.round(scrollY) })); } catch { /* storage is off */ }
  });
  const arrival = performance.getEntriesByType?.('navigation')[0]?.type;
  let left = null;
  if (arrival === 'reload' || arrival === 'back_forward') {
    try { left = JSON.parse(sessionStorage.getItem(KEY)); } catch { /* storage is off */ }
  }
  if ((left && left.hash === location.hash) || first) {
    addEventListener('DOMContentLoaded', () => {
      if (left && left.hash === location.hash) window.scrollTo({ top: left.y, behavior: 'instant' });
      else toTop(current, 'instant');
      settle(true);
    }, { once: true });
  }
  // The underline only slides once the tabs have their own fonts and widths.
  (document.fonts?.ready || Promise.resolve()).then(() => {
    placeAll();
    requestAnimationFrame(() => root.classList.add('tabs-ready'));
  });

  window.LoftDemo = {
    /** Build a sheet's scenes the first time the sheet is shown (now, if it is showing). */
    whenShown(id, fn) {
      builders.set(id, [...(builders.get(id) || []), fn]);
      if (current && current.id === id && built.has(id)) run(current, fn);
      else if (current && current.id === id) build(current);
    },
    /** Show a sheet or a group by name, as its tab would. */
    show(id) { go(find(id), { push: true }); },
  };
})();
