// Personal page interactions: theme preference, mobile navigation, and section highlighting.
(function () {
  'use strict';

  var root = document.documentElement;
  var themeToggle = document.getElementById('theme-toggle');
  var themeIcon = document.getElementById('theme-icon');
  var navToggle = document.getElementById('nav-toggle');
  var navLinks = document.getElementById('primary-nav');
  var sectionLinks = Array.prototype.slice.call(document.querySelectorAll('[data-section]'));
  var sections = sectionLinks
    .map(function (link) { return document.getElementById(link.getAttribute('data-section')); })
    .filter(Boolean);

  function setTheme(theme, persist) {
    var isDark = theme === 'dark';
    root.dataset.theme = isDark ? 'dark' : 'light';

    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(isDark));
      themeToggle.setAttribute('aria-label', isDark ? '切换到浅色主题' : '切换到深色主题');
    }

    if (themeIcon) {
      themeIcon.setAttribute('href', isDark ? '#icon-moon' : '#icon-sun');
    }

    if (persist) {
      try {
        window.localStorage.setItem('personal-page-theme', isDark ? 'dark' : 'light');
      } catch (error) {
        // Private browsing may disable storage; the page still works for this visit.
      }
    }
  }

  function initialTheme() {
    try {
      var saved = window.localStorage.getItem('personal-page-theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch (error) {
      // Fall back to the system preference when storage is unavailable.
    }

    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

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

    updateActiveSection('home');

    var observer = new IntersectionObserver(function (entries) {
      if (window.scrollY < 80) {
        updateActiveSection('home');
        return;
      }

      var visible = entries
        .filter(function (entry) { return entry.isIntersecting; })
        .filter(function (entry) { return entry.target.id !== 'home'; })
        .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });

      if (visible[0]) updateActiveSection(visible[0].target.id);
    }, {
      rootMargin: '-72px 0px -55% 0px',
      threshold: [0.1, 0.35, 0.7]
    });

    sections.forEach(function (section) { observer.observe(section); });
  }

  function setupPageTransitions() {
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    document.addEventListener('click', function (event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      var link = event.target.closest('a[href]');
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;

      var href = link.getAttribute('href');
      if (!href || href.charAt(0) === '#' || href.indexOf('mailto:') === 0 || href.indexOf('tel:') === 0) return;

      var destination;
      try {
        destination = new URL(href, window.location.href);
      } catch (error) {
        return;
      }

      if (destination.origin !== window.location.origin || destination.protocol === 'mailto:') return;
      if (destination.pathname === window.location.pathname && destination.hash === window.location.hash) return;

      event.preventDefault();
      closeMobileNav();
      document.body.classList.add('page-leaving');
      window.setTimeout(function () {
        window.location.assign(destination.href);
      }, 180);
    });
  }

  var GITHUB_USER = 'Gao-Chenkai';
  var GITHUB_EVENTS_URL = 'https://api.github.com/users/' + GITHUB_USER + '/events/public?per_page=100';

  function padNumber(value) {
    return String(value).padStart(2, '0');
  }

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

  function repoUrl(repoName) {
    return 'https://github.com/' + repoName;
  }

  function makeTextPart(text) {
    return { text: text };
  }

  function makeLinkPart(text, href) {
    return { text: text, href: href };
  }

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
        key: 'push:' + repoName + ':' + day,
        kind: 'push',
        date: date,
        sortTime: event.created_at,
        count: commitCount,
        parts: [
          makeTextPart('向 '),
          makeLinkPart(repoName, repositoryUrl),
          makeTextPart(' 推送了 ' + commitCount + ' 次提交')
        ]
      };
    }

    if (event.type === 'CreateEvent' && payload.ref_type === 'repository') {
      return {
        key: 'create-repository:' + repoName,
        kind: 'create',
        date: date,
        sortTime: event.created_at,
        parts: [makeTextPart('创建了仓库 '), makeLinkPart(repoName, repositoryUrl)]
      };
    }

    if (event.type === 'PullRequestEvent' && payload.pull_request) {
      var pullRequest = payload.pull_request;
      var pullRequestAction = getActionText(payload.action, '发起了', '完成了', '更新了');
      var pullRequestPage = pullRequest.html_url || (pullRequest.number
        ? 'https://github.com/' + repoName + '/pull/' + pullRequest.number
        : repositoryUrl);
      var pullRequestTitle = pullRequest.title || ('Pull Request #' + (pullRequest.number || ''));
      return {
        key: 'pull-request:' + pullRequestPage,
        kind: 'pull-request',
        date: date,
        sortTime: event.created_at,
        parts: [
          makeTextPart(pullRequestAction + ' '),
          makeLinkPart(repoName, repositoryUrl),
          makeTextPart(' 的 Pull Request：'),
          makeLinkPart(pullRequestTitle, pullRequestPage)
        ]
      };
    }

    if (event.type === 'PullRequestReviewEvent' && payload.pull_request) {
      var reviewedPullRequest = payload.pull_request;
      var reviewedPullRequestPage = reviewedPullRequest.html_url || (reviewedPullRequest.number
        ? 'https://github.com/' + repoName + '/pull/' + reviewedPullRequest.number
        : repositoryUrl);
      return {
        key: 'pull-request-review:' + reviewedPullRequestPage,
        kind: 'review',
        date: date,
        sortTime: event.created_at,
        parts: [
          makeTextPart('参与了 '),
          makeLinkPart(repoName, repositoryUrl),
          makeTextPart(' 的 Pull Request 审查：'),
          makeLinkPart(reviewedPullRequest.title || ('Pull Request #' + (reviewedPullRequest.number || '')), reviewedPullRequestPage)
        ]
      };
    }

    if (event.type === 'IssuesEvent' && payload.issue) {
      var issue = payload.issue;
      var issueAction = getActionText(payload.action, '创建了', '关闭了', '更新了');
      var issuePage = issue.html_url || (issue.number
        ? 'https://github.com/' + repoName + '/issues/' + issue.number
        : repositoryUrl);
      return {
        key: 'issue:' + issuePage,
        kind: 'issue',
        date: date,
        sortTime: event.created_at,
        parts: [
          makeTextPart(issueAction + ' '),
          makeLinkPart(repoName, repositoryUrl),
          makeTextPart(' 的 Issue：'),
          makeLinkPart(issue.title || ('Issue #' + (issue.number || '')), issuePage)
        ]
      };
    }

    if (event.type === 'IssueCommentEvent' && payload.issue) {
      var commentedIssue = payload.issue;
      var commentedIssuePage = commentedIssue.html_url || (commentedIssue.number
        ? 'https://github.com/' + repoName + '/issues/' + commentedIssue.number
        : repositoryUrl);
      return {
        key: 'issue-comment:' + commentedIssuePage,
        kind: 'issue-comment',
        date: date,
        sortTime: event.created_at,
        parts: [
          makeTextPart('评论了 '),
          makeLinkPart(repoName, repositoryUrl),
          makeTextPart(' 的 Issue：'),
          makeLinkPart(commentedIssue.title || ('Issue #' + (commentedIssue.number || '')), commentedIssuePage)
        ]
      };
    }

    if (event.type === 'ReleaseEvent' && payload.release) {
      var release = payload.release;
      return {
        key: 'release:' + (release.html_url || repoName + ':' + release.tag_name),
        kind: 'release',
        date: date,
        sortTime: event.created_at,
        parts: [
          makeTextPart('发布了 '),
          makeLinkPart(repoName, repositoryUrl),
          makeTextPart(' 的版本 '),
          makeLinkPart(release.tag_name || '未命名版本', release.html_url || repositoryUrl)
        ]
      };
    }

    if (event.type === 'ForkEvent' && payload.forkee) {
      var forkedRepository = payload.forkee;
      return {
        key: 'fork:' + (forkedRepository.full_name || repoName),
        kind: 'fork',
        date: date,
        sortTime: event.created_at,
        parts: [makeTextPart('复制了仓库 '), makeLinkPart(repoName, repositoryUrl)]
      };
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
        existing.parts[2] = makeTextPart(' 推送了 ' + existing.count + ' 次提交');
        return;
      }

      if (!existing) grouped[activity.key] = activity;
    });

    return Object.keys(grouped)
      .map(function (key) { return grouped[key]; })
      .sort(function (a, b) { return new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime(); });
  }

  function appendActivityParts(container, parts) {
    parts.forEach(function (part) {
      if (part.href) {
        var link = document.createElement('a');
        link.href = part.href;
        link.target = '_blank';
        link.rel = 'noopener';
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
    var options = {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (controller) options.signal = controller.signal;

    window.fetch(GITHUB_EVENTS_URL, options)
      .then(function (response) {
        if (!response.ok) throw new Error('GitHub activity request failed');
        return response.json();
      })
      .then(function (events) {
        if (!Array.isArray(events)) throw new Error('GitHub activity response was not a list');
        var activities = buildActivities(events);
        activityLists.forEach(function (list) { renderActivityList(list, activities); });
      })
      .catch(function () {
        // Keep the local snapshot in place when GitHub is unavailable or rate-limited.
      })
      .then(function () {
        if (timeout) window.clearTimeout(timeout);
      });
  }

  function clearNode(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
  }

  function createExternalLink(text, href, className) {
    var link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = text;
    if (className) link.className = className;
    return link;
  }

  function appendPlainText(node, text) {
    node.appendChild(document.createTextNode(text));
  }

  function contributionLevel(day) {
    var color = String(day.color || '').toLowerCase();
    var knownColors = {
      '#ebedf0': 0,
      '#9be9a8': 1,
      '#40c463': 2,
      '#30a14e': 3,
      '#216e39': 4
    };

    if (Object.prototype.hasOwnProperty.call(knownColors, color)) return knownColors[color];

    var count = Number(day.contributionCount) || 0;
    if (count === 0) return 0;
    if (count <= 2) return 1;
    if (count <= 5) return 2;
    if (count <= 10) return 3;
    return 4;
  }

  function utcDayValue(value) {
    return Date.parse(String(value) + 'T00:00:00Z');
  }

  function findContributionWeek(weeks, value) {
    var target = utcDayValue(value);
    var index = 0;

    weeks.forEach(function (week, weekIndex) {
      if (utcDayValue(week.firstDay) <= target) index = weekIndex;
    });

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

    if (window.__GITHUB_CONTRIBUTIONS__) {
      renderContributionCalendar(window.__GITHUB_CONTRIBUTIONS__);
    }
  }

  function monthKeyForDate(value) {
    var date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'unknown';
    return date.getFullYear() + '-' + padNumber(date.getMonth() + 1);
  }

  function monthLabelForKey(key) {
    var parts = key.split('-');
    var date = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  function shortActivityDate(value) {
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function timelineRepoApiUrl(repoName, resource, number) {
    var encodedRepo = repoName.split('/').map(function (part) { return encodeURIComponent(part); }).join('/');
    return 'https://api.github.com/repos/' + encodedRepo + '/' + resource + (number ? '/' + encodeURIComponent(number) : '');
  }

  function timelineRepoPageUrl(repoName) {
    return 'https://github.com/' + repoName;
  }

  function timelinePullRequestPageUrl(repoName, number) {
    return timelineRepoPageUrl(repoName) + '/pull/' + number;
  }

  function timelineIssuePageUrl(repoName, number) {
    return timelineRepoPageUrl(repoName) + '/issues/' + number;
  }

  function compactBody(value, maxLength) {
    var text = String(value || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[>#*_`~-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 1).trimEnd() + '…';
  }

  function timelineCountLabel(count, singular, plural) {
    return count + ' ' + (count === 1 ? singular : plural);
  }

  function createTimelineRecord(map, key, base) {
    if (!map[key]) map[key] = base;
    return map[key];
  }

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
        var commitGroup = createTimelineRecord(commitGroups, monthKey, {
          kind: 'commits',
          monthKey: monthKey,
          sortTime: event.created_at,
          total: 0,
          repositories: Object.create(null)
        });
        commitGroup.total += commitCount;
        commitGroup.repositories[repoName] = (commitGroup.repositories[repoName] || 0) + commitCount;
        if (new Date(event.created_at).getTime() > new Date(commitGroup.sortTime).getTime()) commitGroup.sortTime = event.created_at;
        return;
      }

      if (event.type === 'CreateEvent' && payload.ref_type === 'repository') {
        var repositoryGroup = createTimelineRecord(repositoryGroups, monthKey, {
          kind: 'repositories',
          monthKey: monthKey,
          sortTime: event.created_at,
          repositories: []
        });
        if (!repositoryGroup.repositories.some(function (name) { return name === repoName; })) repositoryGroup.repositories.push(repoName);
        if (new Date(event.created_at).getTime() > new Date(repositoryGroup.sortTime).getTime()) repositoryGroup.sortTime = event.created_at;
        return;
      }

      if (event.type === 'PullRequestEvent' && payload.pull_request) {
        var pullRequest = payload.pull_request;
        var pullRequestNumber = pullRequest.number || payload.number;
        if (!pullRequestNumber) return;
        var pullRequestKey = repoName + '#' + pullRequestNumber;
        var pullRequestRecord = createTimelineRecord(pullRequests, pullRequestKey, {
          kind: 'pull-request',
          key: pullRequestKey,
          repo: repoName,
          number: pullRequestNumber,
          url: timelinePullRequestPageUrl(repoName, pullRequestNumber),
          monthKey: monthKey,
          latestAt: event.created_at,
          openedAt: event.created_at,
          opened: false,
          merged: false,
          details: null
        });
        if (payload.action === 'opened') {
          pullRequestRecord.opened = true;
          pullRequestRecord.openedAt = event.created_at;
          pullRequestRecord.monthKey = monthKey;
        }
        if (payload.action === 'merged') pullRequestRecord.merged = true;
        if (new Date(event.created_at).getTime() > new Date(pullRequestRecord.latestAt).getTime()) pullRequestRecord.latestAt = event.created_at;
        return;
      }

      if (event.type === 'IssuesEvent' && payload.issue) {
        var issue = payload.issue;
        var issueKey = repoName + '#' + issue.number;
        var issueRecord = createTimelineRecord(issues, issueKey, {
          kind: 'issue',
          key: issueKey,
          repo: repoName,
          number: issue.number,
          url: issue.html_url || timelineIssuePageUrl(repoName, issue.number),
          monthKey: monthKey,
          latestAt: event.created_at,
          openedAt: event.created_at,
          opened: false,
          closed: false,
          details: issue
        });
        if (payload.action === 'opened') {
          issueRecord.opened = true;
          issueRecord.openedAt = event.created_at;
          issueRecord.monthKey = monthKey;
        }
        if (payload.action === 'closed') issueRecord.closed = true;
        if (new Date(event.created_at).getTime() > new Date(issueRecord.latestAt).getTime()) issueRecord.latestAt = event.created_at;
        return;
      }

      if (event.type === 'PullRequestReviewEvent' && payload.pull_request) {
        var reviewedPullRequest = payload.pull_request;
        if (!reviewedPullRequest.number) return;
        miscellaneous.push({
          kind: 'review',
          repo: repoName,
          number: reviewedPullRequest.number,
          title: reviewedPullRequest.title || ('Pull Request #' + reviewedPullRequest.number),
          url: timelinePullRequestPageUrl(repoName, reviewedPullRequest.number),
          monthKey: monthKey,
          sortTime: event.created_at
        });
      }
    });

    var entries = [];
    Object.keys(commitGroups).forEach(function (key) {
      var group = commitGroups[key];
      entries.push({
        kind: group.kind,
        monthKey: group.monthKey,
        sortTime: group.sortTime,
        data: {
          total: group.total,
          repositories: Object.keys(group.repositories).map(function (name) {
            return { name: name, count: group.repositories[name] };
          }).sort(function (a, b) { return b.count - a.count; })
        }
      });
    });

    Object.keys(repositoryGroups).forEach(function (key) {
      var group = repositoryGroups[key];
      entries.push({
        kind: group.kind,
        monthKey: group.monthKey,
        sortTime: group.sortTime,
        data: { repositories: group.repositories.sort() }
      });
    });

    var pullRequestList = Object.keys(pullRequests).map(function (key) { return pullRequests[key]; })
      .sort(function (a, b) { return new Date(b.openedAt || b.latestAt).getTime() - new Date(a.openedAt || a.latestAt).getTime(); });
    var pullRequestDetailCount = Math.min(3, pullRequestList.length);
    pullRequestList.slice(0, pullRequestDetailCount).forEach(function (record) {
      entries.push({ kind: 'pull-request', monthKey: record.monthKey, sortTime: record.openedAt || record.latestAt, record: record });
    });

    var pullRequestSummary = Object.create(null);
    pullRequestList.slice(pullRequestDetailCount).forEach(function (record) {
      var summary = createTimelineRecord(pullRequestSummary, record.monthKey, {
        kind: 'pull-request-summary',
        monthKey: record.monthKey,
        sortTime: record.openedAt || record.latestAt,
        total: 0,
        merged: 0,
        repositories: Object.create(null)
      });
      summary.total += 1;
      if (record.merged) summary.merged += 1;
      if (!summary.repositories[record.repo]) summary.repositories[record.repo] = { total: 0, merged: 0 };
      summary.repositories[record.repo].total += 1;
      if (record.merged) summary.repositories[record.repo].merged += 1;
    });
    Object.keys(pullRequestSummary).forEach(function (key) {
      var summary = pullRequestSummary[key];
      entries.push({
        kind: summary.kind,
        monthKey: summary.monthKey,
        sortTime: summary.sortTime,
        data: {
          total: summary.total,
          merged: summary.merged,
          repositories: Object.keys(summary.repositories).map(function (name) {
            return { name: name, total: summary.repositories[name].total, merged: summary.repositories[name].merged };
          }).sort(function (a, b) { return b.total - a.total; })
        }
      });
    });

    var issueList = Object.keys(issues).map(function (key) { return issues[key]; })
      .sort(function (a, b) { return new Date(b.openedAt || b.latestAt).getTime() - new Date(a.openedAt || a.latestAt).getTime(); });
    var issueDetailCount = Math.min(2, issueList.length);
    issueList.slice(0, issueDetailCount).forEach(function (record) {
      entries.push({ kind: 'issue', monthKey: record.monthKey, sortTime: record.openedAt || record.latestAt, record: record });
    });

    var issueSummary = Object.create(null);
    issueList.slice(issueDetailCount).forEach(function (record) {
      var summary = createTimelineRecord(issueSummary, record.monthKey, {
        kind: 'issue-summary',
        monthKey: record.monthKey,
        sortTime: record.openedAt || record.latestAt,
        total: 0,
        open: 0,
        repositories: Object.create(null)
      });
      summary.total += 1;
      if (!record.closed) summary.open += 1;
      if (!summary.repositories[record.repo]) summary.repositories[record.repo] = { total: 0, open: 0 };
      summary.repositories[record.repo].total += 1;
      if (!record.closed) summary.repositories[record.repo].open += 1;
    });
    Object.keys(issueSummary).forEach(function (key) {
      var summary = issueSummary[key];
      entries.push({
        kind: summary.kind,
        monthKey: summary.monthKey,
        sortTime: summary.sortTime,
        data: {
          total: summary.total,
          open: summary.open,
          repositories: Object.keys(summary.repositories).map(function (name) {
            return { name: name, total: summary.repositories[name].total, open: summary.repositories[name].open };
          }).sort(function (a, b) { return b.total - a.total; })
        }
      });
    });

    miscellaneous.slice(0, 3).forEach(function (item) { entries.push(item); });

    entries.sort(function (a, b) { return new Date(b.sortTime).getTime() - new Date(a.sortTime).getTime(); });

    return {
      entries: entries,
      pullRequests: pullRequestList.slice(0, pullRequestDetailCount),
      issues: issueList.slice(0, issueDetailCount)
    };
  }

  function githubJsonRequest(url, signal) {
    var options = {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    };
    if (signal) options.signal = signal;

    return window.fetch(url, options).then(function (response) {
      if (!response.ok) throw new Error('GitHub request failed');
      return response.json();
    });
  }

  function enrichTimelineModel(model, signal) {
    var requests = [];

    model.pullRequests.forEach(function (record) {
      requests.push(githubJsonRequest(timelineRepoApiUrl(record.repo, 'pulls', record.number), signal)
        .then(function (details) { record.details = details; })
        .catch(function () { return null; }));
    });

    model.issues.forEach(function (record) {
      requests.push(githubJsonRequest(timelineRepoApiUrl(record.repo, 'issues', record.number), signal)
        .then(function (details) { record.details = details; })
        .catch(function () { return null; }));
    });

    return Promise.all(requests).then(function () { return model; });
  }

  function createTimelineMarker(kind) {
    var marker = document.createElement('span');
    marker.className = 'timeline-marker';
    marker.setAttribute('aria-hidden', 'true');
    marker.textContent = {
      commits: '↥',
      repositories: '▣',
      'pull-request': '⑂',
      'pull-request-summary': '⑂',
      issue: '◉',
      'issue-summary': '◉',
      review: '✓'
    }[kind] || '·';
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

  function createTimelineMeta() {
    var meta = document.createElement('div');
    meta.className = 'timeline-card-meta';
    return meta;
  }

  function appendTimelineMetaText(meta, text, className) {
    var item = document.createElement('span');
    item.textContent = text;
    if (className) item.className = className;
    meta.appendChild(item);
  }

  function appendTimelineBadge(meta, text, className) {
    var badge = document.createElement('span');
    badge.className = 'timeline-badge' + (className ? ' ' + className : '');
    badge.textContent = text;
    meta.appendChild(badge);
  }

  function createTimelineCardTitle(text, href) {
    return createExternalLink(text, href, 'timeline-card-title');
  }

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
    entryNode.appendChild(createTimelineHeader(entry, function (headerTitle) {
      appendPlainText(headerTitle, 'Created a pull request in ');
      headerTitle.appendChild(createExternalLink(record.repo, timelineRepoPageUrl(record.repo)));
      appendPlainText(headerTitle, ' that received ' + comments + ' ' + (comments === 1 ? 'comment' : 'comments'));
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
    entryNode.appendChild(createTimelineHeader(entry, function (headerTitle) {
      appendPlainText(headerTitle, 'Created an issue in ');
      headerTitle.appendChild(createExternalLink(record.repo, timelineRepoPageUrl(record.repo)));
      appendPlainText(headerTitle, ' that received ' + comments + ' ' + (comments === 1 ? 'comment' : 'comments'));
    }));

    card.className = 'timeline-card';
    card.appendChild(createTimelineCardTitle(title, issueUrl));
    appendTimelineSummary(card, details.body);
    appendTimelineBadge(meta, details.state || (record.closed ? 'closed' : 'open'), details.state === 'open' ? 'is-open' : '');
    (details.labels || []).slice(0, 2).forEach(function (label) {
      appendTimelineBadge(meta, label.name || String(label));
    });
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
        trailing = document.createElement('span');
      } else {
        count.className = 'timeline-summary-count';
        if (rowType === 'pull-request-summary') {
          var merged = document.createElement('strong');
          merged.textContent = String(repository.merged);
          count.appendChild(merged);
          count.appendChild(document.createTextNode(' merged'));
        } else {
          var open = document.createElement('strong');
          open.textContent = String(repository.open);
          count.appendChild(open);
          count.appendChild(document.createTextNode(' open'));
        }
        trailing = document.createElement('span');
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
      entry.data.repositories.forEach(function (repository) { repository.barWidth = Math.max(4, (repository.count / maxCommitCount) * 100); });
      entryNode.appendChild(createTimelineHeader(entry, function (title) {
        appendPlainText(title, 'Created ' + timelineCountLabel(entry.data.total, 'commit', 'commits') + ' in ' + entry.data.repositories.length + ' repositories');
      }));
      content = document.createElement('div');
      content.appendChild(createTimelineRows(entry.data.repositories, 'commits'));
    } else if (entry.kind === 'repositories') {
      entryNode.appendChild(createTimelineHeader(entry, function (title) {
        appendPlainText(title, 'Created ' + timelineCountLabel(entry.data.repositories.length, 'repository', 'repositories'));
      }));
      content = document.createElement('div');
      content.appendChild(createTimelineRows(entry.data.repositories.map(function (name) {
        return { name: name, count: 'Created', merged: 0, open: 0 };
      }), 'repositories'));
    } else if (entry.kind === 'pull-request-summary') {
      entryNode.appendChild(createTimelineHeader(entry, function (title) {
        appendPlainText(title, 'Opened ' + entry.data.total + ' other pull requests in ' + entry.data.repositories.length + ' repositories');
      }));
      content = document.createElement('div');
      content.appendChild(createTimelineRows(entry.data.repositories, 'pull-request-summary'));
    } else if (entry.kind === 'issue-summary') {
      entryNode.appendChild(createTimelineHeader(entry, function (title) {
        appendPlainText(title, 'Opened ' + entry.data.total + ' other issues in ' + entry.data.repositories.length + ' repositories');
      }));
      content = document.createElement('div');
      content.appendChild(createTimelineRows(entry.data.repositories, 'issue-summary'));
    } else if (entry.kind === 'review') {
      entryNode.appendChild(createTimelineHeader(entry, function (title) {
        appendPlainText(title, 'Reviewed a pull request in ');
        title.appendChild(createExternalLink(entry.repo, timelineRepoPageUrl(entry.repo)));
      }));
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
        fallback.appendChild(createExternalLink('View the profile ↗', 'https://github.com/Gao-Chenkai'));
        timeline.appendChild(fallback);
      })
      .then(function () {
        if (timeout) window.clearTimeout(timeout);
      });
  }

  setTheme(initialTheme(), false);

  if (themeToggle) {
    themeToggle.addEventListener('click', function () {
      setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark', true);
    });
  }

  if (navToggle && navLinks) {
    navToggle.addEventListener('click', function () {
      var isOpen = navLinks.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(isOpen));
      navToggle.setAttribute('aria-label', isOpen ? '关闭导航' : '打开导航');
    });

    navLinks.addEventListener('click', function (event) {
      if (event.target.closest('a')) closeMobileNav();
    });
  }

  setupSectionHighlighting();
  setupPageTransitions();
  setupGitHubActivity();
  setupGitHubDashboard();
  setupGitHubTimeline();
}());
