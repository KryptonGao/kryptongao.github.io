// Personal page interactions: theme, navigation, motion, GitHub activity.
// Native DOM + IntersectionObserver + rAF parallax. No frameworks.
(function () {
  'use strict';

  var root = document.documentElement;
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isCoarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  var themeToggle = document.getElementById('theme-toggle');
  var themeIcon = document.getElementById('theme-icon');
  var navToggle = document.getElementById('nav-toggle');
  var navLinks = document.getElementById('primary-nav');
  var sectionLinks = Array.prototype.slice.call(document.querySelectorAll('[data-section]'));
  var sections = sectionLinks
    .map(function (link) { return document.getElementById(link.getAttribute('data-section')); })
    .filter(Boolean);

  /* ----------------------------------------------------------------------
     Theme
     ---------------------------------------------------------------------- */
  function setTheme(theme, persist) {
    var isDark = theme === 'dark';
    root.dataset.theme = isDark ? 'dark' : 'light';

    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(isDark));
      themeToggle.setAttribute('aria-label', isDark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    if (themeIcon) {
      themeIcon.setAttribute('href', isDark ? '#icon-moon' : '#icon-sun');
    }
    if (persist) {
      try { window.localStorage.setItem('personal-page-theme', isDark ? 'dark' : 'light'); }
      catch (error) { /* private mode */ }
    }
  }

  function initialTheme() {
    try {
      var saved = window.localStorage.getItem('personal-page-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (error) { /* fall through */ }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  /* ----------------------------------------------------------------------
     Navigation
     ---------------------------------------------------------------------- */
  function closeMobileNav() {
    if (!navLinks || !navToggle) return;
    navLinks.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
  }

  function updateActiveSection(id) {
    sectionLinks.forEach(function (link) {
      link.classList.toggle('is-active', link.getAttribute('data-section') === id);
    });
  }

  function setupSectionHighlighting() {
    if (!window.IntersectionObserver || sections.length === 0) return;
    updateActiveSection(sections[0] ? sections[0].id : 'home');

    var observer = new IntersectionObserver(function (entries) {
      if (window.scrollY < 80) {
        updateActiveSection(sections[0] ? sections[0].id : 'home');
        return;
      }
      var visible = entries
        .filter(function (e) { return e.isIntersecting; })
        .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });
      if (visible[0]) updateActiveSection(visible[0].target.id);
    }, { rootMargin: '-72px 0px -55% 0px', threshold: [0.1, 0.35, 0.7] });

    sections.forEach(function (section) { observer.observe(section); });
  }

  function setupPageTransitions() {
    if (prefersReduced) return;
    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      var link = event.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;
      var destination;
      try { destination = new URL(href, window.location.href); } catch (error) { return; }
      if (destination.origin !== window.location.origin || destination.protocol === 'mailto:') return;
      if (destination.pathname === window.location.pathname && destination.hash === window.location.hash) return;

      event.preventDefault();
      closeMobileNav();
      document.body.classList.add('page-leaving');
      window.setTimeout(function () { window.location.assign(destination.href); }, 160);
    });
  }

  /* ----------------------------------------------------------------------
     Motion: reveal on scroll
     ---------------------------------------------------------------------- */
  function setupReveal() {
    if (prefersReduced || !window.IntersectionObserver) {
      document.querySelectorAll('[data-reveal],[data-reveal-stagger]').forEach(function (el) {
        el.classList.add('is-revealed');
      });
      return;
    }

    var revealEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
    var staggerEls = Array.prototype.slice.call(document.querySelectorAll('[data-reveal-stagger]'));

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = el.getAttribute('data-reveal-delay') || 0;
        window.setTimeout(function () { el.classList.add('is-revealed'); }, Number(delay) || 0);
        observer.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

    revealEls.forEach(function (el) { observer.observe(el); });

    // stagger: reveal container, then children transition via CSS
    var staggerObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var children = Array.prototype.slice.call(el.children);
        children.forEach(function (child, i) {
          child.style.transitionDelay = (Math.min(i, 8) * 60) + 'ms';
        });
        el.classList.add('is-revealed');
        staggerObserver.unobserve(el);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });

    staggerEls.forEach(function (el) { staggerObserver.observe(el); });
  }

  /* ----------------------------------------------------------------------
     Motion: scroll progress bar
     ---------------------------------------------------------------------- */
  function setupScrollProgress() {
    var bar = document.querySelector('.scroll-progress');
    if (!bar) return;
    if (prefersReduced) { bar.style.display = 'none'; return; }

    var ticking = false;
    function update() {
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var scrolled = window.scrollY;
      var ratio = docHeight > 0 ? scrolled / docHeight : 0;
      bar.style.transform = 'scaleX(' + Math.min(1, Math.max(0, ratio)) + ')';
      ticking = false;
    }
    function onScroll() { if (!ticking) { window.requestAnimationFrame(update); ticking = true; } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ----------------------------------------------------------------------
     Motion: lightweight parallax (transform-only)
     ---------------------------------------------------------------------- */
  function setupParallax() {
    if (prefersReduced || isCoarsePointer) return;
    var layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    if (layers.length === 0) return;

    var ticking = false;
    function update() {
      var vh = window.innerHeight;
      layers.forEach(function (layer) {
        var speed = parseFloat(layer.getAttribute('data-parallax')) || 0.15;
        var rect = layer.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > vh + 200) return;
        var center = rect.top + rect.height / 2;
        var offset = (center - vh / 2) / vh;
        var y = -offset * speed * 100;
        layer.style.transform = 'translate3d(0,' + y.toFixed(2) + 'px,0)';
      });
      ticking = false;
    }
    function onScroll() { if (!ticking) { window.requestAnimationFrame(update); ticking = true; } }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    update();
  }

  /* ----------------------------------------------------------------------
     GitHub activity (news lists / event cards)
     ---------------------------------------------------------------------- */
  var GITHUB_USER = 'KryptonGao';
  var GITHUB_EVENTS_URL = 'https://api.github.com/users/' + GITHUB_USER + '/events/public?per_page=100';

  function padNumber(value) { return String(value).padStart(2, '0'); }

  function formatActivityDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'GitHub';
    return [date.getFullYear(), padNumber(date.getMonth() + 1), padNumber(date.getDate())].join('.');
  }

  function formatActivityDay(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return [date.getFullYear(), padNumber(date.getMonth() + 1), padNumber(date.getDate())].join('-');
  }

  function repoUrl(repoName) { return 'https://github.com/' + repoName; }

  function makeTextPart(text) { return { text: text }; }
  function makeLinkPart(text, href) { return { text: text, href: href }; }

  function getActionText(action, openedText, closedText, updatedText) {
    if (action === 'opened') return openedText;
    if (action === 'closed' || action === 'merged') return closedText;
    return updatedText;
  }

  function activityFromEvent(event) {
    if (!event || !event.repo || !event.repo.name || !event.created_at) return null;
    var payload = event.payload || {};
    var repoName = event.repo.name;
    var repositoryUrl = repoUrl(repoName);
    var date = formatActivityDate(event.created_at);
    var day = formatActivityDay(event.created_at);

    if (event.type === 'PushEvent') {
      var commitCount = Number(payload.size) || (Array.isArray(payload.commits) ? payload.commits.length : 1) || 1;
      return {
        key: 'push:' + repoName + ':' + day, kind: 'push', date: date, sortTime: event.created_at, count: commitCount,
        parts: [makeTextPart('Pushed to '), makeLinkPart(repoName, repositoryUrl), makeTextPart(': ' + commitCount + (commitCount === 1 ? ' commit' : ' commits'))]
      };
    }
    if (event.type === 'CreateEvent' && payload.ref_type === 'repository') {
      return { key: 'create-repository:' + repoName, kind: 'create', date: date, sortTime: event.created_at,
        parts: [makeTextPart('Created repository '), makeLinkPart(repoName, repositoryUrl)] };
    }
    if (event.type === 'PullRequestEvent' && payload.pull_request) {
      var pr = payload.pull_request;
      var prPage = pr.html_url || (pr.number ? 'https://github.com/' + repoName + '/pull/' + pr.number : repositoryUrl);
      var prTitle = pr.title || ('Pull Request #' + (pr.number || ''));
      var prAction = getActionText(payload.action, 'Opened', 'Completed', 'Updated');
      return { key: 'pull-request:' + prPage, kind: 'pull-request', date: date, sortTime: event.created_at,
        parts: [makeTextPart(prAction + ' '), makeLinkPart(repoName, repositoryUrl), makeTextPart(' pull request: '), makeLinkPart(prTitle, prPage)] };
    }
    if (event.type === 'PullRequestReviewEvent' && payload.pull_request) {
      var reviewed = payload.pull_request;
      var reviewedPage = reviewed.html_url || (reviewed.number ? 'https://github.com/' + repoName + '/pull/' + reviewed.number : repositoryUrl);
      return { key: 'pull-request-review:' + reviewedPage, kind: 'review', date: date, sortTime: event.created_at,
        parts: [makeTextPart('Reviewed '), makeLinkPart(repoName, repositoryUrl), makeTextPart(' pull request: '), makeLinkPart(reviewed.title || ('Pull Request #' + (reviewed.number || '')), reviewedPage)] };
    }
    if (event.type === 'IssuesEvent' && payload.issue) {
      var issue = payload.issue;
      var issuePage = issue.html_url || (issue.number ? 'https://github.com/' + repoName + '/issues/' + issue.number : repositoryUrl);
      var issueAction = getActionText(payload.action, 'Created', 'Closed', 'Updated');
      return { key: 'issue:' + issuePage, kind: 'issue', date: date, sortTime: event.created_at,
        parts: [makeTextPart(issueAction + ' '), makeLinkPart(repoName, repositoryUrl), makeTextPart(' issue: '), makeLinkPart(issue.title || ('Issue #' + (issue.number || '')), issuePage)] };
    }
    if (event.type === 'IssueCommentEvent' && payload.issue) {
      var commented = payload.issue;
      var commentedPage = commented.html_url || (commented.number ? 'https://github.com/' + repoName + '/issues/' + commented.number : repositoryUrl);
      return { key: 'issue-comment:' + commentedPage, kind: 'issue-comment', date: date, sortTime: event.created_at,
        parts: [makeTextPart('Commented on '), makeLinkPart(repoName, repositoryUrl), makeTextPart(' issue: '), makeLinkPart(commented.title || ('Issue #' + (commented.number || '')), commentedPage)] };
    }
    if (event.type === 'ReleaseEvent' && payload.release) {
      var release = payload.release;
      return { key: 'release:' + (release.html_url || repoName + ':' + release.tag_name), kind: 'release', date: date, sortTime: event.created_at,
        parts: [makeTextPart('Released '), makeLinkPart(repoName, repositoryUrl), makeTextPart(' version '), makeLinkPart(release.tag_name || 'Unnamed release', release.html_url || repositoryUrl)] };
    }
    if (event.type === 'ForkEvent' && payload.forkee) {
      return { key: 'fork:' + (payload.forkee.full_name || repoName), kind: 'fork', date: date, sortTime: event.created_at,
        parts: [makeTextPart('Forked repository '), makeLinkPart(repoName, repositoryUrl)] };
    }
    return null;
  }

  function buildActivities(events) {
    var grouped = Object.create(null);
    events.forEach(function (event) {
      var activity = activityFromEvent(event);
      if (!activity) return;
      var existing = grouped[activity.key];
      if (existing && activity.kind === 'push') {
        existing.count += activity.count;
        existing.parts[2] = makeTextPart(': ' + existing.count + (existing.count === 1 ? ' commit' : ' commits'));
        return;
      }
      if (!existing) grouped[activity.key] = activity;
    });
    return Object.keys(grouped).map(function (key) { return grouped[key]; })
      .sort(function (a, b) { return new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime(); });
  }

  function appendActivityParts(container, parts) {
    parts.forEach(function (part) {
      if (part.href) {
        var link = document.createElement('a');
        link.href = part.href; link.target = '_blank'; link.rel = 'noopener';
        link.textContent = part.text;
        container.appendChild(link);
      } else {
        container.appendChild(document.createTextNode(part.text));
      }
    });
  }

  function renderActivityList(list, activities) {
    var limit = Number(list.getAttribute('data-limit')) || 3;
    var fragment = document.createDocumentFragment();
    var isNewsList = list.classList.contains('news-list');

    activities.slice(0, limit).forEach(function (activity) {
      var item = document.createElement('li');
      var date = document.createElement('span');
      date.className = isNewsList ? 'news-date' : 'event-date';
      date.textContent = activity.date;
      var content = document.createElement(isNewsList ? 'span' : 'p');
      appendActivityParts(content, activity.parts);
      if (!isNewsList) item.className = 'event-card';
      item.appendChild(date);
      item.appendChild(content);
      fragment.appendChild(item);
    });
    if (!activities.length) return;
    list.replaceChildren(fragment);
  }

  function setupGitHubActivity() {
    var activityLists = Array.prototype.slice.call(document.querySelectorAll('[data-github-activity]'));
    if (activityLists.length === 0 || !window.fetch) return;

    var controller = window.AbortController ? new AbortController() : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 8000) : null;
    var options = { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } };
    if (controller) options.signal = controller.signal;

    window.fetch(GITHUB_EVENTS_URL, options)
      .then(function (response) { if (!response.ok) throw new Error('GitHub activity request failed'); return response.json(); })
      .then(function (events) {
        if (!Array.isArray(events)) throw new Error('GitHub activity response was not a list');
        var activities = buildActivities(events);
        activityLists.forEach(function (list) { renderActivityList(list, activities); });
      })
      .catch(function () { /* keep local snapshot */ })
      .then(function () { if (timeout) window.clearTimeout(timeout); });
  }

  /* ----------------------------------------------------------------------
     GitHub contribution calendar
     ---------------------------------------------------------------------- */
  function clearNode(node) { while (node && node.firstChild) node.removeChild(node.firstChild); }

  function createExternalLink(text, href, className) {
    var link = document.createElement('a');
    link.href = href; link.target = '_blank'; link.rel = 'noopener';
    link.textContent = text;
    if (className) link.className = className;
    return link;
  }

  function appendPlainText(node, text) { node.appendChild(document.createTextNode(text)); }

  function contributionLevel(day) {
    var color = String(day.color || '').toLowerCase();
    var knownColors = { '#ebedf0': 0, '#9be9a8': 1, '#40c463': 2, '#30a14e': 3, '#216e39': 4 };
    if (Object.prototype.hasOwnProperty.call(knownColors, color)) return knownColors[color];
    var count = Number(day.contributionCount) || 0;
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 10) return 3;
    return 4;
  }

  function utcDayValue(value) { return Date.parse(String(value) + 'T00:00:00Z'); }

  function findContributionWeek(weeks, value) {
    var target = utcDayValue(value);
    var index = 0;
    weeks.forEach(function (week, weekIndex) { if (utcDayValue(week.firstDay) <= target) index = weekIndex; });
    return index;
  }

  function renderContributionOverview(data) {
    var overview = document.querySelector('[data-overview-copy]');
    if (overview) {
      clearNode(overview);
      appendPlainText(overview, 'Contributed to ');
      data.repositories.slice(0, 3).forEach(function (repository, index) {
        if (index > 0) appendPlainText(overview, index === 2 ? ', ' : ' and ');
        overview.appendChild(createExternalLink(repository.name, repository.url));
      });
      var remaining = Math.max(0, Number(data.stats.repositoriesWithCommits) - data.repositories.length);
      if (remaining > 0) appendPlainText(overview, ' and ' + remaining + ' other repositories');
    }
    Object.keys(data.stats).forEach(function (statName) {
      var stat = document.querySelector('[data-contribution-stat="' + statName + '"]');
      if (stat) stat.textContent = String(data.stats[statName]);
    });
  }

  function renderContributionCalendar(data) {
    var card = document.querySelector('[data-github-contribution-card]');
    if (!card || !data || !data.calendar || !Array.isArray(data.calendar.weeks)) return;

    var weeks = data.calendar.weeks;
    var months = data.calendar.months || [];
    var grid = card.querySelector('[data-contribution-grid]');
    var monthGrid = card.querySelector('[data-contribution-months]');
    var total = card.querySelector('[data-contribution-total]');
    var updated = card.querySelector('[data-contribution-updated]');
    if (!grid || !monthGrid) return;

    grid.style.setProperty('--week-count', String(weeks.length));
    monthGrid.style.setProperty('--week-count', String(weeks.length));
    clearNode(grid);
    clearNode(monthGrid);

    if (total) total.textContent = data.calendar.totalContributions + ' contributions in the last year';
    if (updated) updated.textContent = 'Updated ' + data.generatedAt;

    months.forEach(function (month) {
      var monthLabel = document.createElement('span');
      var start = findContributionWeek(weeks, month.firstDay);
      var span = Math.max(1, Math.min(Number(month.totalWeeks) || 1, weeks.length - start));
      monthLabel.textContent = month.name;
      monthLabel.style.left = (start * 14) + 'px';
      monthLabel.dataset.weeks = String(span);
      monthGrid.appendChild(monthLabel);
    });

    weeks.forEach(function (week, weekIndex) {
      (week.contributionDays || []).forEach(function (day) {
        var cell = document.createElement('span');
        var count = Number(day.contributionCount) || 0;
        cell.className = 'contribution-cell';
        cell.dataset.level = String(contributionLevel(day));
        cell.style.gridColumn = String(weekIndex + 1);
        cell.style.gridRow = String(Number(day.weekday) + 1);
        cell.title = day.date + ': ' + count + (count === 1 ? ' contribution' : ' contributions');
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('aria-label', cell.title);
        grid.appendChild(cell);
      });
    });

    renderContributionOverview(data);
    card.dataset.ready = 'true';
  }

  function setupGitHubDashboard() {
    if (!document.querySelector('[data-github-contribution-card]')) return;
    if (window.__GITHUB_CONTRIBUTIONS__) renderContributionCalendar(window.__GITHUB_CONTRIBUTIONS__);
  }

  /* ----------------------------------------------------------------------
     GitHub timeline (news page)
     ---------------------------------------------------------------------- */
  function monthKeyForDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown';
    return date.getFullYear() + '-' + padNumber(date.getMonth() + 1);
  }

  function monthLabelForKey(key) {
    var parts = key.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, 1)
      .toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function shortActivityDate(value) {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function timelineRepoApiUrl(repoName, resource, number) {
    var encodedRepo = repoName.split('/').map(function (part) { return encodeURIComponent(part); }).join('/');
    return 'https://api.github.com/repos/' + encodedRepo + '/' + resource + (number ? '/' + encodeURIComponent(number) : '');
  }
  function timelineRepoPageUrl(repoName) { return 'https://github.com/' + repoName; }
  function timelinePullRequestPageUrl(repoName, number) { return timelineRepoPageUrl(repoName) + '/pull/' + number; }
  function timelineIssuePageUrl(repoName, number) { return timelineRepoPageUrl(repoName) + '/issues/' + number; }

  function compactBody(value, maxLength) {
    var text = String(value || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[>#*_`~-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1).trimEnd() + '\u2026';
  }

  function timelineCountLabel(count, singular, plural) { return count + ' ' + (count === 1 ? singular : plural); }

  function createTimelineRecord(map, key, base) { if (!map[key]) map[key] = base; return map[key]; }

  function buildTimelineModel(events) {
    var commitGroups = Object.create(null);
    var repositoryGroups = Object.create(null);
    var pullRequests = Object.create(null);
    var issues = Object.create(null);
    var miscellaneous = [];

    events.forEach(function (event) {
      if (!event || !event.repo || !event.repo.name || !event.created_at) return;
      var payload = event.payload || {};
      var repoName = event.repo.name;
      var monthKey = monthKeyForDate(event.created_at);

      if (event.type === 'PushEvent') {
        var commitCount = Number(payload.distinct_size || payload.size) || (Array.isArray(payload.commits) ? payload.commits.length : 1) || 1;
        var commitGroup = createTimelineRecord(commitGroups, monthKey, { kind: 'commits', monthKey: monthKey, sortTime: event.created_at, total: 0, repositories: Object.create(null) });
        commitGroup.total += commitCount;
        commitGroup.repositories[repoName] = (commitGroup.repositories[repoName] || 0) + commitCount;
        if (new Date(event.created_at).getTime() > new Date(commitGroup.sortTime).getTime()) commitGroup.sortTime = event.created_at;
        return;
      }
      if (event.type === 'CreateEvent' && payload.ref_type === 'repository') {
        var rg = createTimelineRecord(repositoryGroups, monthKey, { kind: 'repositories', monthKey: monthKey, sortTime: event.created_at, repositories: [] });
        if (!rg.repositories.some(function (name) { return name === repoName; })) rg.repositories.push(repoName);
        if (new Date(event.created_at).getTime() > new Date(rg.sortTime).getTime()) rg.sortTime = event.created_at;
        return;
      }
      if (event.type === 'PullRequestEvent' && payload.pull_request) {
        var pr = payload.pull_request;
        var prNumber = pr.number || payload.number;
        if (!prNumber) return;
        var prKey = repoName + '#' + prNumber;
        var prRecord = createTimelineRecord(pullRequests, prKey, { kind: 'pull-request', key: prKey, repo: repoName, number: prNumber, url: timelinePullRequestPageUrl(repoName, prNumber), monthKey: monthKey, latestAt: event.created_at, openedAt: event.created_at, opened: false, merged: false, details: null });
        if (payload.action === 'opened') { prRecord.opened = true; prRecord.openedAt = event.created_at; prRecord.monthKey = monthKey; }
        if (payload.action === 'merged') prRecord.merged = true;
        if (new Date(event.created_at).getTime() > new Date(prRecord.latestAt).getTime()) prRecord.latestAt = event.created_at;
        return;
      }
      if (event.type === 'IssuesEvent' && payload.issue) {
        var issue = payload.issue;
        var issueKey = repoName + '#' + issue.number;
        var issueRecord = createTimelineRecord(issues, issueKey, { kind: 'issue', key: issueKey, repo: repoName, number: issue.number, url: issue.html_url || timelineIssuePageUrl(repoName, issue.number), monthKey: monthKey, latestAt: event.created_at, openedAt: event.created_at, opened: false, closed: false, details: issue });
        if (payload.action === 'opened') { issueRecord.opened = true; issueRecord.openedAt = event.created_at; issueRecord.monthKey = monthKey; }
        if (payload.action === 'closed') issueRecord.closed = true;
        if (new Date(event.created_at).getTime() > new Date(issueRecord.latestAt).getTime()) issueRecord.latestAt = event.created_at;
        return;
      }
      if (event.type === 'PullRequestReviewEvent' && payload.pull_request) {
        var reviewed = payload.pull_request;
        if (!reviewed.number) return;
        miscellaneous.push({ kind: 'review', repo: repoName, number: reviewed.number, title: reviewed.title || ('Pull Request #' + reviewed.number), url: timelinePullRequestPageUrl(repoName, reviewed.number), monthKey: monthKey, sortTime: event.created_at });
      }
    });

    var entries = [];
    Object.keys(commitGroups).forEach(function (key) {
      var g = commitGroups[key];
      entries.push({ kind: g.kind, monthKey: g.monthKey, sortTime: g.sortTime, data: { total: g.total, repositories: Object.keys(g.repositories).map(function (name) { return { name: name, count: g.repositories[name] }; }).sort(function (a, b) { return b.count - a.count; }) } });
    });
    Object.keys(repositoryGroups).forEach(function (key) {
      var g = repositoryGroups[key];
      entries.push({ kind: g.kind, monthKey: g.monthKey, sortTime: g.sortTime, data: { repositories: g.repositories.sort() } });
    });

    var prList = Object.keys(pullRequests).map(function (k) { return pullRequests[k]; }).sort(function (a, b) { return new Date(b.openedAt || b.latestAt).getTime() - new Date(a.openedAt || a.latestAt).getTime(); });
    var prDetailCount = Math.min(3, prList.length);
    prList.slice(0, prDetailCount).forEach(function (record) { entries.push({ kind: 'pull-request', monthKey: record.monthKey, sortTime: record.openedAt || record.latestAt, record: record }); });

    var prSummary = Object.create(null);
    prList.slice(prDetailCount).forEach(function (record) {
      var s = createTimelineRecord(prSummary, record.monthKey, { kind: 'pull-request-summary', monthKey: record.monthKey, sortTime: record.openedAt || record.latestAt, total: 0, merged: 0, repositories: Object.create(null) });
      s.total += 1; if (record.merged) s.merged += 1;
      if (!s.repositories[record.repo]) s.repositories[record.repo] = { total: 0, merged: 0 };
      s.repositories[record.repo].total += 1; if (record.merged) s.repositories[record.repo].merged += 1;
    });
    Object.keys(prSummary).forEach(function (key) {
      var s = prSummary[key];
      entries.push({ kind: s.kind, monthKey: s.monthKey, sortTime: s.sortTime, data: { total: s.total, merged: s.merged, repositories: Object.keys(s.repositories).map(function (name) { return { name: name, total: s.repositories[name].total, merged: s.repositories[name].merged }; }).sort(function (a, b) { return b.total - a.total; }) } });
    });

    var issueList = Object.keys(issues).map(function (k) { return issues[k]; }).sort(function (a, b) { return new Date(b.openedAt || b.latestAt).getTime() - new Date(a.openedAt || a.latestAt).getTime(); });
    var issueDetailCount = Math.min(2, issueList.length);
    issueList.slice(0, issueDetailCount).forEach(function (record) { entries.push({ kind: 'issue', monthKey: record.monthKey, sortTime: record.openedAt || record.latestAt, record: record }); });

    var issueSummary = Object.create(null);
    issueList.slice(issueDetailCount).forEach(function (record) {
      var s = createTimelineRecord(issueSummary, record.monthKey, { kind: 'issue-summary', monthKey: record.monthKey, sortTime: record.openedAt || record.latestAt, total: 0, open: 0, repositories: Object.create(null) });
      s.total += 1; if (!record.closed) s.open += 1;
      if (!s.repositories[record.repo]) s.repositories[record.repo] = { total: 0, open: 0 };
      s.repositories[record.repo].total += 1; if (!record.closed) s.repositories[record.repo].open += 1;
    });
    Object.keys(issueSummary).forEach(function (key) {
      var s = issueSummary[key];
      entries.push({ kind: s.kind, monthKey: s.monthKey, sortTime: s.sortTime, data: { total: s.total, open: s.open, repositories: Object.keys(s.repositories).map(function (name) { return { name: name, total: s.repositories[name].total, open: s.repositories[name].open }; }).sort(function (a, b) { return b.total - a.total; }) } });
    });

    miscellaneous.slice(0, 3).forEach(function (item) { entries.push(item); });
    entries.sort(function (a, b) { return new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime(); });

    return { entries: entries, pullRequests: prList.slice(0, prDetailCount), issues: issueList.slice(0, issueDetailCount) };
  }

  function githubJsonRequest(url, signal) {
    var options = { headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' } };
    if (signal) options.signal = signal;
    return window.fetch(url, options).then(function (response) { if (!response.ok) throw new Error('GitHub request failed'); return response.json(); });
  }

  function enrichTimelineModel(model, signal) {
    var requests = [];
    model.pullRequests.forEach(function (record) {
      requests.push(githubJsonRequest(timelineRepoApiUrl(record.repo, 'pulls', record.number), signal).then(function (d) { record.details = d; }).catch(function () { return null; }));
    });
    model.issues.forEach(function (record) {
      requests.push(githubJsonRequest(timelineRepoApiUrl(record.repo, 'issues', record.number), signal).then(function (d) { record.details = d; }).catch(function () { return null; }));
    });
    return Promise.all(requests).then(function () { return model; });
  }

  function createTimelineMarker(kind) {
    var marker = document.createElement('span');
    marker.className = 'timeline-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = { commits: '\u21A5', repositories: '\u25A3', 'pull-request': '\u2102', 'pull-request-summary': '\u2102', issue: '\u25C9', 'issue-summary': '\u25C9', review: '\u2713' }[kind] || '\u00B7';
    return marker;
  }

  function createTimelineHeader(entry, titleBuilder) {
    var header = document.createElement('div');
    var title = document.createElement('div');
    var date = document.createElement('time');
    header.className = 'timeline-entry-header';
    title.className = 'timeline-entry-title';
    date.className = 'timeline-entry-date';
    titleBuilder(title);
    date.dateTime = entry.sortTime;
    date.textContent = shortActivityDate(entry.sortTime);
    header.appendChild(title);
    header.appendChild(date);
    return header;
  }

  function createTimelineMeta() { var meta = document.createElement('div'); meta.className = 'timeline-card-meta'; return meta; }
  function appendTimelineMetaText(meta, text, className) { var item = document.createElement('span'); item.textContent = text; if (className) item.className = className; meta.appendChild(item); }
  function appendTimelineBadge(meta, text, className) { var badge = document.createElement('span'); badge.className = 'timeline-badge' + (className ? ' ' + className : ''); badge.textContent = text; meta.appendChild(badge); }
  function createTimelineCardTitle(text, href) { return createExternalLink(text, href, 'timeline-card-title'); }

  function appendTimelineSummary(card, value) {
    var summary = compactBody(value, 220);
    if (!summary) return;
    var paragraph = document.createElement('p');
    paragraph.className = 'timeline-card-summary';
    paragraph.textContent = summary;
    card.appendChild(paragraph);
  }

  function createPullRequestEntry(entry) {
    var record = entry.record;
    var details = record.details || {};
    var comments = Number(details.comments) || 0;
    var title = details.title || ('Pull Request #' + record.number);
    var entryNode = document.createElement('article');
    var card = document.createElement('div');
    var meta = createTimelineMeta();

    entryNode.className = 'timeline-entry';
    entryNode.dataset.kind = 'pull-request';
    entryNode.appendChild(createTimelineMarker('pull-request'));
    entryNode.appendChild(createTimelineHeader(entry, function (t) {
      appendPlainText(t, 'Created a pull request in ');
      t.appendChild(createExternalLink(record.repo, timelineRepoPageUrl(record.repo)));
      appendPlainText(t, ' that received ' + comments + ' ' + (comments === 1 ? 'comment' : 'comments'));
    }));

    card.className = 'timeline-card';
    card.appendChild(createTimelineCardTitle(title, details.html_url || record.url));
    appendTimelineSummary(card, details.body);
    if (details.merged) appendTimelineBadge(meta, 'merged', 'is-merged');
    else appendTimelineBadge(meta, details.state || 'open', details.state === 'open' ? 'is-open' : '');
    if (details.additions !== undefined) appendTimelineMetaText(meta, '+' + details.additions, 'timeline-diff-add');
    if (details.deletions !== undefined) appendTimelineMetaText(meta, '-' + details.deletions, 'timeline-diff-delete');
    if (details.changed_files !== undefined) appendTimelineMetaText(meta, details.changed_files + ' files changed');
    appendTimelineMetaText(meta, comments + ' ' + (comments === 1 ? 'comment' : 'comments'));
    card.appendChild(meta);
    entryNode.appendChild(card);
    return entryNode;
  }

  function createIssueEntry(entry) {
    var record = entry.record;
    var details = record.details || {};
    var comments = Number(details.comments) || 0;
    var title = details.title || ('Issue #' + record.number);
    var issueUrl = details.html_url || record.url;
    var entryNode = document.createElement('article');
    var card = document.createElement('div');
    var meta = createTimelineMeta();

    entryNode.className = 'timeline-entry';
    entryNode.dataset.kind = 'issue';
    entryNode.appendChild(createTimelineMarker('issue'));
    entryNode.appendChild(createTimelineHeader(entry, function (t) {
      appendPlainText(t, 'Created an issue in ');
      t.appendChild(createExternalLink(record.repo, timelineRepoPageUrl(record.repo)));
      appendPlainText(t, ' that received ' + comments + ' ' + (comments === 1 ? 'comment' : 'comments'));
    }));

    card.className = 'timeline-card';
    card.appendChild(createTimelineCardTitle(title, issueUrl));
    appendTimelineSummary(card, details.body);
    appendTimelineBadge(meta, details.state || (record.closed ? 'closed' : 'open'), details.state === 'open' ? 'is-open' : '');
    (details.labels || []).slice(0, 2).forEach(function (label) { appendTimelineBadge(meta, label.name || String(label)); });
    appendTimelineMetaText(meta, comments + ' ' + (comments === 1 ? 'comment' : 'comments'));
    card.appendChild(meta);
    entryNode.appendChild(card);
    return entryNode;
  }

  function createTimelineRows(repositories, rowType) {
    var list = document.createElement('ul');
    list.className = rowType === 'commits' ? 'timeline-repository-list' : 'timeline-summary-list';
    repositories.forEach(function (repository) {
      var row = document.createElement('li');
      var count = document.createElement('span');
      var trailing = document.createElement('span');
      row.className = rowType === 'commits' ? 'timeline-repository-row' : 'timeline-summary-row';
      row.appendChild(createExternalLink(repository.name, timelineRepoPageUrl(repository.name)));
      if (rowType === 'commits') {
        count.className = 'timeline-repository-count';
        count.textContent = timelineCountLabel(repository.count, 'commit', 'commits');
        trailing.className = 'timeline-repository-bar';
        trailing.style.setProperty('--bar-width', String(repository.barWidth || 0) + '%');
        var bar = document.createElement('span');
        bar.style.width = String(repository.barWidth || 0) + '%';
        trailing.appendChild(bar);
      } else if (rowType === 'repositories') {
        count.className = 'timeline-repository-count';
        count.textContent = 'created';
      } else {
        count.className = 'timeline-summary-count';
        if (rowType === 'pull-request-summary') {
          var merged = document.createElement('strong'); merged.textContent = String(repository.merged);
          count.appendChild(merged); count.appendChild(document.createTextNode(' merged'));
        } else {
          var open = document.createElement('strong'); open.textContent = String(repository.open);
          count.appendChild(open); count.appendChild(document.createTextNode(' open'));
        }
      }
      row.appendChild(count);
      row.appendChild(trailing);
      list.appendChild(row);
    });
    return list;
  }

  function createGroupedTimelineEntry(entry) {
    var entryNode = document.createElement('article');
    var content;
    entryNode.className = 'timeline-entry';
    entryNode.dataset.kind = entry.kind;
    entryNode.appendChild(createTimelineMarker(entry.kind));

    if (entry.kind === 'commits') {
      var maxCommitCount = entry.data.repositories.length ? entry.data.repositories[0].count : 1;
      entry.data.repositories.forEach(function (r) { r.barWidth = Math.max(4, (r.count / maxCommitCount) * 100); });
      entryNode.appendChild(createTimelineHeader(entry, function (t) { appendPlainText(t, 'Created ' + timelineCountLabel(entry.data.total, 'commit', 'commits') + ' in ' + entry.data.repositories.length + ' repositories'); }));
      content = document.createElement('div');
      content.appendChild(createTimelineRows(entry.data.repositories, 'commits'));
    } else if (entry.kind === 'repositories') {
      entryNode.appendChild(createTimelineHeader(entry, function (t) { appendPlainText(t, 'Created ' + timelineCountLabel(entry.data.repositories.length, 'repository', 'repositories')); }));
      content = document.createElement('div');
      content.appendChild(createTimelineRows(entry.data.repositories.map(function (name) { return { name: name, count: 'Created', merged: 0, open: 0 }; }), 'repositories'));
    } else if (entry.kind === 'pull-request-summary') {
      entryNode.appendChild(createTimelineHeader(entry, function (t) { appendPlainText(t, 'Opened ' + entry.data.total + ' other pull requests in ' + entry.data.repositories.length + ' repositories'); }));
      content = document.createElement('div');
      content.appendChild(createTimelineRows(entry.data.repositories, 'pull-request-summary'));
    } else if (entry.kind === 'issue-summary') {
      entryNode.appendChild(createTimelineHeader(entry, function (t) { appendPlainText(t, 'Opened ' + entry.data.total + ' other issues in ' + entry.data.repositories.length + ' repositories'); }));
      content = document.createElement('div');
      content.appendChild(createTimelineRows(entry.data.repositories, 'issue-summary'));
    } else if (entry.kind === 'review') {
      entryNode.appendChild(createTimelineHeader(entry, function (t) { appendPlainText(t, 'Reviewed a pull request in '); t.appendChild(createExternalLink(entry.repo, timelineRepoPageUrl(entry.repo))); }));
      content = document.createElement('div');
      content.className = 'timeline-card';
      content.appendChild(createTimelineCardTitle(entry.title, entry.url));
    }
    if (content) entryNode.appendChild(content);
    return entryNode;
  }

  function renderTimelineEntries(timeline, entries, limit) {
    clearNode(timeline);
    var visibleEntries = entries.slice(0, limit);
    var currentMonth = '';
    visibleEntries.forEach(function (entry) {
      if (entry.monthKey !== currentMonth) {
        currentMonth = entry.monthKey;
        var month = document.createElement('div');
        month.className = 'timeline-month';
        month.textContent = monthLabelForKey(currentMonth);
        timeline.appendChild(month);
      }
      if (entry.kind === 'pull-request') timeline.appendChild(createPullRequestEntry(entry));
      else if (entry.kind === 'issue') timeline.appendChild(createIssueEntry(entry));
      else timeline.appendChild(createGroupedTimelineEntry(entry));
    });
  }

  function setupGitHubTimeline() {
    var timeline = document.querySelector('[data-activity-timeline]');
    if (!timeline || !window.fetch) return;

    var moreButton = document.querySelector('[data-activity-more]');
    var controller = window.AbortController ? new AbortController() : null;
    var timeout = controller ? window.setTimeout(function () { controller.abort(); }, 8000) : null;

    githubJsonRequest(GITHUB_EVENTS_URL, controller && controller.signal)
      .then(function (events) {
        if (!Array.isArray(events)) throw new Error('GitHub events response was not a list');
        return enrichTimelineModel(buildTimelineModel(events), controller && controller.signal);
      })
      .then(function (model) {
        var visibleCount = Math.min(8, model.entries.length);
        renderTimelineEntries(timeline, model.entries, visibleCount);
        if (moreButton && model.entries.length > visibleCount) {
          moreButton.hidden = false;
          moreButton.textContent = 'Show more activity';
          moreButton.addEventListener('click', function () {
            if (visibleCount < model.entries.length) {
              visibleCount = model.entries.length;
              renderTimelineEntries(timeline, model.entries, visibleCount);
              moreButton.textContent = 'Show less activity';
            } else {
              visibleCount = Math.min(8, model.entries.length);
              renderTimelineEntries(timeline, model.entries, visibleCount);
              moreButton.textContent = 'Show more activity';
              window.scrollBy({ top: -120, behavior: 'smooth' });
            }
          });
        }
      })
      .catch(function () {
        clearNode(timeline);
        var fallback = document.createElement('div');
        fallback.className = 'timeline-loading';
        fallback.appendChild(document.createTextNode('GitHub activity is temporarily unavailable. '));
        fallback.appendChild(createExternalLink('View the profile \u2197', 'https://github.com/KryptonGao'));
        timeline.appendChild(fallback);
      })
      .then(function () { if (timeout) window.clearTimeout(timeout); });
  }

  /* ----------------------------------------------------------------------
     Boot
     ---------------------------------------------------------------------- */
  setTheme(initialTheme(), false);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () { setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true); });
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
    });
    navLinks.addEventListener('click', function (event) { if (event.target.closest('a')) closeMobileNav(); });
  }

  setupSectionHighlighting();
  setupPageTransitions();
  setupReveal();
  setupScrollProgress();
  setupParallax();
  setupGitHubActivity();
  setupGitHubDashboard();
  setupGitHubTimeline();
}());
