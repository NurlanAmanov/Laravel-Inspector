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

    var host = document.createElement('div');
    host.id = 'lvi-root';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483000;pointer-events:none;';
    document.body.appendChild(host);

    var shadow = host.attachShadow({ mode: 'open' });
    var sheet = document.createElement('style');
    var cssNode = document.getElementById('lvi-style');
    sheet.textContent = cssNode ? cssNode.textContent : '';
    shadow.appendChild(sheet);

    var root = document.createElement('div');
    root.className = 'lvi-layer';
    shadow.appendChild(root);

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

    var hlParent = el('div', 'lvi-hl-parent');
    var hl = el('div', 'lvi-hl');
    var hlLabel = el('div', 'lvi-hl-label');
    var tip = el('div', 'lvi-tip');
    root.appendChild(hlParent);
    root.appendChild(hl);
    root.appendChild(hlLabel);
    root.appendChild(tip);

    function setBox(box, r) {
        box.style.display = 'block';
        box.style.left = r.left + 'px';
        box.style.top = r.top + 'px';
        box.style.width = r.width + 'px';
        box.style.height = r.height + 'px';
    }

    // Görünüşün öz elementinin ən yaxın fərqli görünüş sərhədini tapır (valideyn view-un qutusu).
    function enclosingNode(node, id) {
        var p = node.parentElement;
        while (p && p !== document.body) {
            var pid = elementView.get(p);
            if (pid && pid !== id) return p;
            p = p.parentElement;
        }
        return null;
    }

    // Kökdən bu view-a qədər olan görünüş zənciri: layouts.app › pages.home › …
    function crumbOf(view) {
        var names = [];
        var cur = view;
        var guard = 0;
        while (cur && guard++ < 50) {
            names.unshift(cur.path || cur.name);
            cur = cur.created_in ? byId[cur.created_in] : null;
        }
        return names.slice(0, -1);
    }

    function showHighlight(node, view) {
        var r = node.getBoundingClientRect();
        if (!r.width && !r.height) return hideHighlight();

        setBox(hl, r);

        if (!view) {
            hlParent.style.display = 'none';
            hlLabel.style.display = 'none';
            tip.style.display = 'none';
            return;
        }

        var enclosing = enclosingNode(node, view.id);
        if (enclosing) setBox(hlParent, enclosing.getBoundingClientRect());
        else hlParent.style.display = 'none';

        hlLabel.textContent = view.path || view.name;
        hlLabel.style.display = 'block';
        hlLabel.style.left = r.left + 'px';
        hlLabel.style.top = (r.top < 18 ? r.top : r.top - 18) + 'px';

        tip.textContent = '';

        var crumb = crumbOf(view);
        if (crumb.length) {
            tip.appendChild(el('span', 'lvi-crumb', crumb.join(' › ')));
        }

        var origin = (view.chain || [])[0];
        if (origin) {
            var row = el('div', 'lvi-row');
            row.appendChild(el('span', 'lvi-tag ' + origin.kind, origin.kind));
            row.appendChild(el('span', 'lvi-mut', origin.label + ' · ' + basename(origin.file) + ':' + origin.line));
            tip.appendChild(row);
        }

        var names = (view.data || []).filter(function (d) { return !d.shared; })
            .map(function (d) { return '$' + d.name; });

        if (names.length) {
            tip.appendChild(el('span', 'lvi-vars', names.slice(0, 8).join(', ')
                + (names.length > 8 ? ' +' + (names.length - 8) : '')));
        }

        tip.appendChild(el('span', 'lvi-hint', 'Klik → element detalı'));

        tip.style.display = 'block';
        var top = r.top - tip.offsetHeight - 6;
        tip.style.top = (top < 4 ? r.bottom + 6 : top) + 'px';
        tip.style.left = Math.max(4, Math.min(r.left, window.innerWidth - tip.offsetWidth - 8)) + 'px';
    }

    function hideHighlight() {
        hl.style.display = 'none';
        hlParent.style.display = 'none';
        hlLabel.style.display = 'none';
        tip.style.display = 'none';
    }

    var inspecting = false;

    function onMove(event) {
        if (!inspecting && !event.altKey) return hideHighlight();
        var id = viewOf(event.target);
        if (!id) return hideHighlight();
        showHighlight(event.target, byId[id]);
    }

    var picked = null;

    function onClick(event) {
        if (!inspecting && !event.altKey) return;
        var id = viewOf(event.target);
        if (!id) return;
        event.preventDefault();
        event.stopPropagation();
        setInspecting(false);
        picked = { id: id, info: describe(event.target) };
        open(true);
        selectTab('element');
    }

    function describe(node) {
        var text = (node.textContent || '').replace(/\s+/g, ' ').trim();
        var cls = typeof node.className === 'string' ? node.className.trim().split(/\s+/).slice(0, 4).join('.') : '';
        return {
            tag: node.tagName.toLowerCase(),
            id: node.id || '',
            cls: cls,
            text: text.length > 90 ? text.slice(0, 90) + '…' : text
        };
    }

    function setInspecting(on) {
        inspecting = on;
        inspectBtn.classList.toggle('lvi-on', on);
        badgePick.classList.toggle('lvi-on', on);
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
        if (event.altKey && (event.key === 'i' || event.key === 'I')) {
            event.preventDefault();
            setInspecting(!inspecting);
        }
    });

    var badge = el('div', 'lvi-badge');

    var badgeOpen = el('button', 'lvi-badge-open');
    badgeOpen.appendChild(el('b', null, '⚡ Inspector'));
    badgeOpen.appendChild(el('span', null,
        (data.stats.views || 0) + ' view · ' + (data.stats.queries || 0) + ' sorğu'
    ));
    badgeOpen.addEventListener('click', function () { open(true); });
    badge.appendChild(badgeOpen);

    var badgePick = el('button', 'lvi-badge-pick', 'Seç');
    badgePick.title = 'Inspect (Alt+I)';
    badgePick.appendChild(el('kbd', null, 'Alt+I'));
    badgePick.addEventListener('click', function () { setInspecting(!inspecting); });
    badge.appendChild(badgePick);

    root.appendChild(badge);

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

    var v = data.versions || {};
    var foot = el('div', 'lvi-foot');
    foot.appendChild(el('span', null, 'Inspector v' + (v.inspector || '?')));
    foot.appendChild(el('span', 'lvi-mut', 'Laravel ' + (v.laravel || '?') + ' · PHP ' + (v.php || '?')));
    foot.appendChild(el('span', 'lvi-mut', v.supports || ''));
    panel.appendChild(foot);

    root.appendChild(panel);

    var tabs = [
        { key: 'element', label: 'Element', render: renderElement },
        { key: 'views', label:'Görünüşlər (' + (data.stats.views || 0) + ')', render: renderViews },
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

    var nodeIndex = {};

    function renderViews(target) {
        nodeIndex = {};
        if (!views.length) {
            target.appendChild(el('div', 'lvi-mut', 'Heç bir Blade görünüşü qeydə alınmadı.'));
            return;
        }

        var children = {};
        views.forEach(function (v) {
            var key = v.created_in || v.parent || '#root';
            (children[key] || (children[key] = [])).push(v);
        });

        (function branch(parentKey, container) {
            (children[parentKey] || []).forEach(function (view) {
                var node = el('div', 'lvi-node');
                nodeIndex[view.id] = node;

                var headRow = el('button', 'lvi-node-head');
                headRow.appendChild(el('span', 'lvi-name', view.path || view.name));
                var own = (view.data || []).filter(isOwn).length;
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

                var parentView = view.created_in ? byId[view.created_in] : null;
                if (parentView) {
                    var pStep = el('div', 'lvi-step');
                    pStep.appendChild(el('span', 'lvi-tag view', 'include'));
                    pStep.appendChild(el('span', null, parentView.path || parentView.name));
                    inner.appendChild(pStep);
                }

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

    function isOwn(v) {
        return !v.shared && !v.inherited && !v.scope;
    }

    function renderVars(vars) {
        var wrap = el('div');
        var own = vars.filter(isOwn);
        var inherited = vars.filter(function (v) { return v.inherited; });
        var scope = vars.filter(function (v) { return v.scope; });
        var shared = vars.filter(function (v) { return v.shared; });

        if (own.length) {
            appendVarRows(wrap, own);
        }

        if (inherited.length) {
            wrap.appendChild(el('div', 'lvi-sub', 'Controller datası (' + inherited.length + ')'));
            appendVarRows(wrap, inherited);
        }

        if (scope.length) {
            wrap.appendChild(el('div', 'lvi-sub', 'Parent view scope-u — loop/local (' + scope.length + ')'));
            appendVarRows(wrap, scope);
        }

        if (shared.length) {
            wrap.appendChild(el('div', 'lvi-sub', 'Paylaşılan / qlobal (' + shared.length + ')'));
            appendVarRows(wrap, shared);
        }

        if (!own.length && !inherited.length && !scope.length) {
            wrap.appendChild(el('div', 'lvi-mut', 'Dəyişən ötürülməyib.'));
        }

        return wrap;
    }

    function appendVarRows(wrap, vars) {
        vars.forEach(function (v) {
            var row = el('div', 'lvi-var' + (isOwn(v) ? '' : ' lvi-shared'));
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

    // View-un zəncirində (özü və valideynləri) ilk controller frame-i.
    function controllerOf(view) {
        var cur = view;
        var guard = 0;
        while (cur && guard++ < 50) {
            var frame = (cur.chain || []).filter(function (f) { return f.kind === 'controller'; })[0];
            if (frame) return frame;
            cur = cur.created_in ? byId[cur.created_in] : null;
        }
        return null;
    }

    // Kökdən bu view-a qədər olan view-lar (özü daxil deyil).
    function ancestorsOf(view) {
        var list = [];
        var cur = view.created_in ? byId[view.created_in] : null;
        var guard = 0;
        while (cur && guard++ < 50) {
            list.unshift(cur);
            cur = cur.created_in ? byId[cur.created_in] : null;
        }
        return list;
    }

    function renderElement(target) {
        if (!picked) {
            target.appendChild(el('div', 'lvi-mut',
                'Element seçmək üçün overlay-də "Seç" (və ya Alt+I) basın, sonra səhifədə elementə klikləyin.'));
            return;
        }

        var view = byId[picked.id];
        var info = picked.info;
        var req = data.request || {};

        var head = el('div', 'lvi-node lvi-open');
        var h = el('div', 'lvi-node-head');
        h.appendChild(el('span', 'lvi-name', '<' + info.tag + (info.id ? '#' + info.id : '') + (info.cls ? '.' + info.cls : '') + '>'));
        var goto = el('button', 'lvi-btn', 'Ağacda göstər');
        goto.addEventListener('click', function () {
            selectTab('views');
            focusView(picked.id);
        });
        h.appendChild(goto);
        head.appendChild(h);
        var hBody = el('div', 'lvi-node-body');
        if (info.text) hBody.appendChild(el('div', 'lvi-mut', '"' + info.text + '"'));
        hBody.appendChild(el('div', 'lvi-mut', 'Görünüş: ' + (view.path || view.name)));
        head.appendChild(hBody);
        target.appendChild(head);

        target.appendChild(el('div', 'lvi-sub', 'Controller'));
        var frame = controllerOf(view);
        var controllerStep = null;
        if (frame) {
            controllerStep = el('div', 'lvi-step');
            controllerStep.appendChild(el('span', 'lvi-tag controller', 'controller'));
            controllerStep.appendChild(el('span', null, frame.label || frame.function));
            var cr = el('span', 'lvi-count');
            cr.appendChild(fileLink(frame.file, frame.line));
            controllerStep.appendChild(cr);
        } else if (req.controller) {
            controllerStep = el('div', 'lvi-step');
            controllerStep.appendChild(el('span', 'lvi-tag controller', 'controller'));
            controllerStep.appendChild(el('span', null, req.controller.label));
            var rr = el('span', 'lvi-count');
            rr.appendChild(fileLink(req.controller.file, req.controller.line));
            controllerStep.appendChild(rr);
        }
        target.appendChild(controllerStep || el('div', 'lvi-mut', 'Controller tapılmadı (view controller-dən yox, başqa yerdən render olunub).'));

        target.appendChild(el('div', 'lvi-sub', 'Necə gəlir'));
        var flow = el('div', 'lvi-flow');
        if (req.route) {
            var rs = el('div', 'lvi-step');
            rs.appendChild(el('span', 'lvi-tag route', 'route'));
            rs.appendChild(el('span', null, req.route.name || req.route.uri));
            flow.appendChild(rs);
        }
        target.appendChild(flow);
        target.appendChild(renderChain(view.chain || []));

        target.appendChild(el('div', 'lvi-sub', 'Harada (view zənciri)'));
        var where = el('div', 'lvi-flow');
        ancestorsOf(view).forEach(function (anc) {
            var s = el('div', 'lvi-step');
            s.appendChild(el('span', 'lvi-tag view', 'view'));
            s.appendChild(el('span', null, anc.path || anc.name));
            var sr = el('span', 'lvi-count');
            sr.appendChild(fileLink(anc.path, 1));
            s.appendChild(sr);
            where.appendChild(s);
        });
        var self = el('div', 'lvi-step');
        self.appendChild(el('span', 'lvi-tag view', 'view'));
        self.appendChild(el('span', 'lvi-name', view.path || view.name));
        var selfLink = el('span', 'lvi-count');
        selfLink.appendChild(fileLink(view.path, 1));
        self.appendChild(selfLink);
        where.appendChild(self);
        target.appendChild(where);

        target.appendChild(el('div', 'lvi-sub', 'Bu view-a ötürülən dəyişənlər'));
        target.appendChild(renderVars(view.data || []));
    }

    function focusView(id) {
        var node = nodeIndex[id];
        if (!node) return;
        node.classList.add('lvi-open');
        node.scrollIntoView({ block: 'center' });
    }

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
