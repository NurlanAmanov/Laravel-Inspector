/**
 * Laravel Inspector — overlay.
 *
 * Backend `<!--lvi:s:ID-->` … `<!--lvi:e:ID-->` şərhləri ilə hər Blade
 * görünüşünün çıxışını işarələyir. Bu skript həmin şərhləri oxuyub
 * DOM elementi → view qeydi xəritəsi qurur.
 */
(function () {
    'use strict';

    var raw = document.getElementById('lvi-payload');
    if (!raw || window.__lviLoaded) return;
    window.__lviLoaded = true;

    var data;
    try {
        data = JSON.parse(raw.textContent);
    } catch (e) {
        console.warn('[inspector] payload oxunmadı', e);
        return;
    }

    var views = data.views || [];
    var byId = {};
    views.forEach(function (v) { byId[v.id] = v; });

    var root = document.createElement('div');
    root.id = 'lvi-root';
    document.body.appendChild(root);

    // ---------------------------------------------------------------- utils

    function el(tag, cls, text) {
        var node = document.createElement(tag);
        if (cls) node.className = cls;
        if (text != null) node.textContent = text;
        return node;
    }

    function esc(value) {
        return value == null ? '' : String(value);
    }

    function basename(path) {
        return esc(path).split('/').pop();
    }

    function editorHref(file, line) {
        if (!file || !data.editor) return null;
        var abs = data.base_path + '/' + file;
        if (data.editor === 'phpstorm') {
            return 'phpstorm://open?file=' + encodeURIComponent(abs) + '&line=' + (line || 1);
        }
        if (data.editor === 'sublime') {
            return 'subl://open?url=file://' + encodeURIComponent(abs) + '&line=' + (line || 1);
        }
        return 'vscode://file/' + abs + ':' + (line || 1);
    }

    function fileLink(file, line, label) {
        var text = (label || basename(file)) + (line ? ':' + line : '');
        var href = editorHref(file, line);
        if (!href) return el('span', 'lvi-mut', text);
        var a = el('a', 'lvi-link', text);
        a.href = href;
        a.title = file + (line ? ':' + line : '');
        return a;
    }

    // ------------------------------------------------- DOM ↔ view xəritəsi

    var elementView = new WeakMap();
    var viewElements = {};

    function buildMap() {
        elementView = new WeakMap();
        viewElements = {};

        var walker = document.createTreeWalker(
            document.documentElement,
            NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_ELEMENT,
            {
                acceptNode: function (node) {
                    if (node.nodeType === 1 && node.id === 'lvi-root') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    return NodeFilter.FILTER_ACCEPT;
                }
            }
        );

        var stack = [];
        var node;

        while ((node = walker.nextNode())) {
            if (node.nodeType === 8) {
                var m = /^lvi:(s|e):(\w+)$/.exec(node.data.trim());
                if (!m) continue;
                if (m[1] === 's') {
                    stack.push(m[2]);
                } else {
                    // Yalnız uyğun gələn id-ni çıxarırıq — qarışıq
                    // yerləşmədə stack-in pozulmasının qarşısını alır.
                    var at = stack.lastIndexOf(m[2]);
                    if (at > -1) stack.splice(at, 1);
                }
                continue;
            }

            if (!stack.length) continue;

            var id = stack[stack.length - 1];
            elementView.set(node, id);
            (viewElements[id] || (viewElements[id] = [])).push(node);
        }
    }

    function viewOf(target) {
        var node = target;
        while (node && node.nodeType === 1) {
            var id = elementView.get(node);
            if (id) return id;
            node = node.parentElement;
        }
        return null;
    }

    // ------------------------------------------------------------ highlight

    var hl = el('div', 'lvi-hl');
    var tip = el('div', 'lvi-tip');
    root.appendChild(hl);
    root.appendChild(tip);

    function showHighlight(node, view) {
        var r = node.getBoundingClientRect();
        if (!r.width && !r.height) return hideHighlight();

        hl.style.display = 'block';
        hl.style.left = r.left + 'px';
        hl.style.top = r.top + 'px';
        hl.style.width = r.width + 'px';
        hl.style.height = r.height + 'px';

        if (!view) return;

        tip.textContent = '';
        tip.appendChild(el('div', 'lvi-tip-name', view.path || view.name));

        var origin = (view.chain || [])[0];
        if (origin) {
            var line = el('div', 'lvi-mut');
            line.appendChild(el('span', 'lvi-tag ' + origin.kind, origin.kind));
            line.appendChild(document.createTextNode(' ' + origin.label + ' · ' + basename(origin.file) + ':' + origin.line));
            tip.appendChild(line);
        }

        var names = (view.data || []).filter(function (d) { return !d.shared; })
            .map(function (d) { return '$' + d.name; });

        if (names.length) {
            tip.appendChild(el('div', 'lvi-mut', names.slice(0, 8).join(', ')
                + (names.length > 8 ? ' +' + (names.length - 8) : '')));
        }

        tip.style.display = 'block';
        var top = r.top - tip.offsetHeight - 6;
        tip.style.top = (top < 4 ? r.bottom + 6 : top) + 'px';
        tip.style.left = Math.max(4, Math.min(r.left, window.innerWidth - tip.offsetWidth - 8)) + 'px';
    }

    function hideHighlight() {
        hl.style.display = 'none';
        tip.style.display = 'none';
    }

    // ------------------------------------------------------- inspect rejimi

    var inspecting = false;

    function onMove(event) {
        if (!inspecting && !event.altKey) return hideHighlight();
        var id = viewOf(event.target);
        if (!id) return hideHighlight();
        showHighlight(event.target, byId[id]);
    }

    function onClick(event) {
        if (!inspecting) return;
        var id = viewOf(event.target);
        if (!id) return;
        event.preventDefault();
        event.stopPropagation();
        setInspecting(false);
        open(true);
        selectTab('views');
        focusView(id);
    }

    function setInspecting(on) {
        inspecting = on;
        inspectBtn.classList.toggle('lvi-on', on);
        document.documentElement.style.cursor = on ? 'crosshair' : '';
        if (!on) hideHighlight();
    }

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    window.addEventListener('scroll', hideHighlight, true);
    window.addEventListener('resize', hideHighlight);

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
            if (inspecting) return setInspecting(false);
            open(false);
        }
        // Alt + I — inspect rejimini çevirir.
        if (event.altKey && (event.key === 'i' || event.key === 'I')) {
            event.preventDefault();
            setInspecting(!inspecting);
        }
    });

    // ----------------------------------------------------------------- badge

    var badge = el('button', 'lvi-badge');
    badge.appendChild(el('b', null, '⚡ Inspector'));
    badge.appendChild(el('span', null,
        (data.stats.views || 0) + ' view · ' + (data.stats.queries || 0) + ' sorğu'
    ));
    badge.addEventListener('click', function () { open(true); });
    root.appendChild(badge);

    // ----------------------------------------------------------------- panel

    var panel = el('div', 'lvi-panel');
    var head = el('div', 'lvi-head');
    head.appendChild(el('strong', null, '⚡ Laravel Inspector'));

    var inspectBtn = el('button', 'lvi-btn', 'Inspect (Alt+I)');
    inspectBtn.addEventListener('click', function () { setInspecting(!inspecting); });
    head.appendChild(inspectBtn);

    var closeBtn = el('button', 'lvi-btn', '✕');
    closeBtn.addEventListener('click', function () { open(false); });
    head.appendChild(closeBtn);
    panel.appendChild(head);

    var tabsBar = el('div', 'lvi-tabs');
    var body = el('div', 'lvi-body');
    panel.appendChild(tabsBar);
    panel.appendChild(body);
    root.appendChild(panel);

    var tabs = [
        { key: 'views', label: 'Görünüşlər (' + (data.stats.views || 0) + ')', render: renderViews },
        { key: 'request', label: 'Axın', render: renderRequest },
        { key: 'queries', label: 'SQL (' + (data.stats.queries || 0) + ')', render: renderQueries }
    ];

    var current = 'views';

    tabs.forEach(function (tab) {
        var btn = el('button', 'lvi-tab', tab.label);
        btn.dataset.tab = tab.key;
        btn.addEventListener('click', function () { selectTab(tab.key); });
        tabsBar.appendChild(btn);
    });

    function selectTab(key) {
        current = key;
        Array.prototype.forEach.call(tabsBar.children, function (btn) {
            btn.classList.toggle('lvi-on', btn.dataset.tab === key);
        });
        body.textContent = '';
        tabs.filter(function (t) { return t.key === key; })[0].render(body);
    }

    function open(on) {
        root.classList.toggle('lvi-open', on);
        if (on) {
            buildMap();
            selectTab(current);
        } else {
            setInspecting(false);
        }
    }

    // ------------------------------------------------------- views renderer

    var nodeIndex = {};

    function renderViews(target) {
        nodeIndex = {};
        if (!views.length) {
            target.appendChild(el('div', 'lvi-mut', 'Heç bir Blade görünüşü qeydə alınmadı.'));
            return;
        }

        var children = {};
        views.forEach(function (v) {
            (children[v.parent || '#root'] || (children[v.parent || '#root'] = [])).push(v);
        });

        (function branch(parentKey, container) {
            (children[parentKey] || []).forEach(function (view) {
                var node = el('div', 'lvi-node');
                nodeIndex[view.id] = node;

                var headRow = el('button', 'lvi-node-head');
                headRow.appendChild(el('span', 'lvi-name', view.path || view.name));
                var own = (view.data || []).filter(function (d) { return !d.shared; }).length;
                headRow.appendChild(el('span', 'lvi-count', own + ' dəyişən'));
                headRow.addEventListener('click', function () {
                    node.classList.toggle('lvi-open');
                });
                headRow.addEventListener('mouseenter', function () {
                    var nodes = viewElements[view.id];
                    if (nodes && nodes.length) showHighlight(nodes[0], view);
                });
                headRow.addEventListener('mouseleave', hideHighlight);
                node.appendChild(headRow);

                var inner = el('div', 'lvi-node-body');

                inner.appendChild(el('div', 'lvi-sub', 'Mənbə — bu view-u kim çağırdı'));
                inner.appendChild(renderChain(view.chain || []));

                inner.appendChild(el('div', 'lvi-sub', 'Ötürülən dəyişənlər'));
                inner.appendChild(renderVars(view.data || []));

                node.appendChild(inner);
                container.appendChild(node);

                var kids = el('div', 'lvi-kids');
                container.appendChild(kids);
                branch(view.id, kids);
            });
        })('#root', target);
    }

    function renderVars(vars) {
        var wrap = el('div');
        var own = vars.filter(function (v) { return !v.shared; });
        var shared = vars.filter(function (v) { return v.shared; });

        if (!own.length) {
            wrap.appendChild(el('div', 'lvi-mut', 'Controller-dən dəyişən ötürülməyib.'));
        }

        own.concat(shared).forEach(function (v) {
            var row = el('div', 'lvi-var' + (v.shared ? ' lvi-shared' : ''));
            row.appendChild(el('span', 'lvi-k', '$' + v.name));

            var value = el('span', 'lvi-v');
            value.appendChild(document.createTextNode(esc(v.summary)));

            var meta = [];
            if (v.source) meta.push(v.source);
            else if (v.class && v.type === 'object') meta.push(v.class);
            if (v.table) meta.push('table: ' + v.table);
            if (v.relations && v.relations.length) meta.push('relations: ' + v.relations.join(', '));
            if (v.meta && !meta.length) meta.push(v.meta);
            if (v.shared) meta.push('(paylaşılan)');

            if (meta.length) value.appendChild(el('span', 'lvi-m', meta.join(' · ')));

            if (v.attributes && v.attributes.length) {
                value.appendChild(el('span', 'lvi-m', 'sütunlar: ' + v.attributes.join(', ')));
            }

            if (v.children && v.children.length) {
                value.appendChild(el('span', 'lvi-m', v.children.map(function (c) {
                    return c.name + ': ' + esc(c.summary);
                }).join(' | ')));
            }

            row.appendChild(value);
            wrap.appendChild(row);
        });

        return wrap;
    }

    function renderChain(chain) {
        var wrap = el('div', 'lvi-flow');

        if (!chain.length) {
            wrap.appendChild(el('div', 'lvi-mut', 'Çağırış zənciri tapılmadı (yəqin başqa view-dan include olunub).'));
            return wrap;
        }

        chain.forEach(function (frame) {
            var step = el('div', 'lvi-step');
            step.appendChild(el('span', 'lvi-tag ' + frame.kind, frame.kind));
            step.appendChild(el('span', null, frame.label || frame.function));
            var right = el('span', 'lvi-count');
            right.appendChild(fileLink(frame.file, frame.line));
            step.appendChild(right);
            wrap.appendChild(step);
        });

        return wrap;
    }

    function focusView(id) {
        var node = nodeIndex[id];
        if (!node) return;
        node.classList.add('lvi-open');
        node.scrollIntoView({ block: 'center' });
    }

    // ----------------------------------------------------- request renderer

    function renderRequest(target) {
        var req = data.request || {};

        var card = el('div', 'lvi-node lvi-open');
        var h = el('div', 'lvi-node-head');
        h.appendChild(el('span', 'lvi-name', (req.method || '?') + ' ' + (req.uri || '')));
        card.appendChild(h);

        var inner = el('div', 'lvi-node-body');
        var flow = el('div', 'lvi-flow');

        if (req.route) {
            var r = el('div', 'lvi-step');
            r.appendChild(el('span', 'lvi-tag route', 'route'));
            r.appendChild(el('span', null, req.route.name || req.route.uri));
            flow.appendChild(r);

            var params = Object.keys(req.route.parameters || {});
            if (params.length) {
                var p = el('div', 'lvi-step');
                p.appendChild(el('span', 'lvi-tag', 'params'));
                p.appendChild(el('span', 'lvi-mut', params.map(function (k) {
                    return k + ' = ' + req.route.parameters[k];
                }).join(', ')));
                flow.appendChild(p);
            }
        }

        if (req.controller) {
            var c = el('div', 'lvi-step');
            c.appendChild(el('span', 'lvi-tag controller', 'controller'));
            c.appendChild(el('span', null, req.controller.label));
            var cr = el('span', 'lvi-count');
            cr.appendChild(fileLink(req.controller.file, req.controller.line));
            c.appendChild(cr);
            flow.appendChild(c);
        }

        // Hər view-un zəncirindəki unikal Service/Action addımları.
        var seen = {};
        views.forEach(function (v) {
            (v.chain || []).forEach(function (f) {
                if (f.kind === 'controller' || f.kind === 'view') return;
                var key = f.label + f.file + f.line;
                if (seen[key]) return;
                seen[key] = true;
                var s = el('div', 'lvi-step');
                s.appendChild(el('span', 'lvi-tag ' + f.kind, f.kind));
                s.appendChild(el('span', null, f.label));
                var sr = el('span', 'lvi-count');
                sr.appendChild(fileLink(f.file, f.line));
                s.appendChild(sr);
                flow.appendChild(s);
            });
        });

        views.filter(function (v) { return !v.parent; }).forEach(function (v) {
            var s = el('div', 'lvi-step');
            s.appendChild(el('span', 'lvi-tag view', 'view'));
            s.appendChild(el('span', null, v.name));
            var sr = el('span', 'lvi-count');
            sr.appendChild(fileLink(v.path, 1));
            s.appendChild(sr);
            flow.appendChild(s);
        });

        inner.appendChild(flow);

        if (req.middleware && req.middleware.length) {
            inner.appendChild(el('div', 'lvi-sub', 'Middleware'));
            inner.appendChild(el('div', 'lvi-mut', req.middleware.join(', ')));
        }

        card.appendChild(inner);
        target.appendChild(card);
    }

    // ----------------------------------------------------- queries renderer

    function renderQueries(target) {
        var queries = data.queries || [];

        if (!queries.length) {
            target.appendChild(el('div', 'lvi-mut', 'SQL sorğusu qeydə alınmadı.'));
            return;
        }

        target.appendChild(el('div', 'lvi-mut',
            queries.length + ' sorğu · ' + (data.stats.query_time || 0) + ' ms'));

        queries.forEach(function (q, i) {
            var node = el('div', 'lvi-node' + (q.slow ? ' lvi-slow' : ''));

            var h = el('button', 'lvi-node-head');
            h.appendChild(el('span', 'lvi-name', '#' + (i + 1)));
            h.appendChild(el('span', null, q.caller ? q.caller.label : q.connection));
            h.appendChild(el('span', 'lvi-count', q.time + ' ms'));
            h.addEventListener('click', function () { node.classList.toggle('lvi-open'); });
            node.appendChild(h);

            var inner = el('div', 'lvi-node-body');
            inner.appendChild(el('code', 'lvi-sql', q.sql));

            if (q.bindings && q.bindings.length) {
                inner.appendChild(el('div', 'lvi-mut', 'bindings: ' + JSON.stringify(q.bindings)));
            }

            if (q.chain && q.chain.length) {
                inner.appendChild(el('div', 'lvi-sub', 'Çağırış yeri'));
                inner.appendChild(renderChain(q.chain));
            }

            node.appendChild(inner);
            target.appendChild(node);
        });
    }

    buildMap();
})();
