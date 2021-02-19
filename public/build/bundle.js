
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var app = (function () {
    'use strict';

    function noop() { }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        // onMount happens before the initial afterUpdate
        add_render_callback(() => {
            const new_on_destroy = on_mount.map(run).filter(is_function);
            if (on_destroy) {
                on_destroy.push(...new_on_destroy);
            }
            else {
                // Edge case - component was destroyed immediately,
                // most likely as a result of a binding initialising
                run_all(new_on_destroy);
            }
            component.$$.on_mount = [];
        });
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.32.3' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /* src/Tailwind.svelte generated by Svelte v3.32.3 */

    function create_fragment(ctx) {
    	const block = {
    		c: noop,
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Tailwind", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Tailwind> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Tailwind extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Tailwind",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

    function createCommonjsModule(fn) {
      var module = { exports: {} };
    	return fn(module, module.exports), module.exports;
    }

    var page = createCommonjsModule(function (module, exports) {
    (function (global, factory) {
    	module.exports = factory() ;
    }(commonjsGlobal, (function () {
    var isarray = Array.isArray || function (arr) {
      return Object.prototype.toString.call(arr) == '[object Array]';
    };

    /**
     * Expose `pathToRegexp`.
     */
    var pathToRegexp_1 = pathToRegexp;
    var parse_1 = parse;
    var compile_1 = compile;
    var tokensToFunction_1 = tokensToFunction;
    var tokensToRegExp_1 = tokensToRegExp;

    /**
     * The main path matching regexp utility.
     *
     * @type {RegExp}
     */
    var PATH_REGEXP = new RegExp([
      // Match escaped characters that would otherwise appear in future matches.
      // This allows the user to escape special characters that won't transform.
      '(\\\\.)',
      // Match Express-style parameters and un-named parameters with a prefix
      // and optional suffixes. Matches appear as:
      //
      // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?", undefined]
      // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined, undefined]
      // "/*"            => ["/", undefined, undefined, undefined, undefined, "*"]
      '([\\/.])?(?:(?:\\:(\\w+)(?:\\(((?:\\\\.|[^()])+)\\))?|\\(((?:\\\\.|[^()])+)\\))([+*?])?|(\\*))'
    ].join('|'), 'g');

    /**
     * Parse a string for the raw tokens.
     *
     * @param  {String} str
     * @return {Array}
     */
    function parse (str) {
      var tokens = [];
      var key = 0;
      var index = 0;
      var path = '';
      var res;

      while ((res = PATH_REGEXP.exec(str)) != null) {
        var m = res[0];
        var escaped = res[1];
        var offset = res.index;
        path += str.slice(index, offset);
        index = offset + m.length;

        // Ignore already escaped sequences.
        if (escaped) {
          path += escaped[1];
          continue
        }

        // Push the current path onto the tokens.
        if (path) {
          tokens.push(path);
          path = '';
        }

        var prefix = res[2];
        var name = res[3];
        var capture = res[4];
        var group = res[5];
        var suffix = res[6];
        var asterisk = res[7];

        var repeat = suffix === '+' || suffix === '*';
        var optional = suffix === '?' || suffix === '*';
        var delimiter = prefix || '/';
        var pattern = capture || group || (asterisk ? '.*' : '[^' + delimiter + ']+?');

        tokens.push({
          name: name || key++,
          prefix: prefix || '',
          delimiter: delimiter,
          optional: optional,
          repeat: repeat,
          pattern: escapeGroup(pattern)
        });
      }

      // Match any characters still remaining.
      if (index < str.length) {
        path += str.substr(index);
      }

      // If the path exists, push it onto the end.
      if (path) {
        tokens.push(path);
      }

      return tokens
    }

    /**
     * Compile a string to a template function for the path.
     *
     * @param  {String}   str
     * @return {Function}
     */
    function compile (str) {
      return tokensToFunction(parse(str))
    }

    /**
     * Expose a method for transforming tokens into the path function.
     */
    function tokensToFunction (tokens) {
      // Compile all the tokens into regexps.
      var matches = new Array(tokens.length);

      // Compile all the patterns before compilation.
      for (var i = 0; i < tokens.length; i++) {
        if (typeof tokens[i] === 'object') {
          matches[i] = new RegExp('^' + tokens[i].pattern + '$');
        }
      }

      return function (obj) {
        var path = '';
        var data = obj || {};

        for (var i = 0; i < tokens.length; i++) {
          var token = tokens[i];

          if (typeof token === 'string') {
            path += token;

            continue
          }

          var value = data[token.name];
          var segment;

          if (value == null) {
            if (token.optional) {
              continue
            } else {
              throw new TypeError('Expected "' + token.name + '" to be defined')
            }
          }

          if (isarray(value)) {
            if (!token.repeat) {
              throw new TypeError('Expected "' + token.name + '" to not repeat, but received "' + value + '"')
            }

            if (value.length === 0) {
              if (token.optional) {
                continue
              } else {
                throw new TypeError('Expected "' + token.name + '" to not be empty')
              }
            }

            for (var j = 0; j < value.length; j++) {
              segment = encodeURIComponent(value[j]);

              if (!matches[i].test(segment)) {
                throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
              }

              path += (j === 0 ? token.prefix : token.delimiter) + segment;
            }

            continue
          }

          segment = encodeURIComponent(value);

          if (!matches[i].test(segment)) {
            throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but received "' + segment + '"')
          }

          path += token.prefix + segment;
        }

        return path
      }
    }

    /**
     * Escape a regular expression string.
     *
     * @param  {String} str
     * @return {String}
     */
    function escapeString (str) {
      return str.replace(/([.+*?=^!:${}()[\]|\/])/g, '\\$1')
    }

    /**
     * Escape the capturing group by escaping special characters and meaning.
     *
     * @param  {String} group
     * @return {String}
     */
    function escapeGroup (group) {
      return group.replace(/([=!:$\/()])/g, '\\$1')
    }

    /**
     * Attach the keys as a property of the regexp.
     *
     * @param  {RegExp} re
     * @param  {Array}  keys
     * @return {RegExp}
     */
    function attachKeys (re, keys) {
      re.keys = keys;
      return re
    }

    /**
     * Get the flags for a regexp from the options.
     *
     * @param  {Object} options
     * @return {String}
     */
    function flags (options) {
      return options.sensitive ? '' : 'i'
    }

    /**
     * Pull out keys from a regexp.
     *
     * @param  {RegExp} path
     * @param  {Array}  keys
     * @return {RegExp}
     */
    function regexpToRegexp (path, keys) {
      // Use a negative lookahead to match only capturing groups.
      var groups = path.source.match(/\((?!\?)/g);

      if (groups) {
        for (var i = 0; i < groups.length; i++) {
          keys.push({
            name: i,
            prefix: null,
            delimiter: null,
            optional: false,
            repeat: false,
            pattern: null
          });
        }
      }

      return attachKeys(path, keys)
    }

    /**
     * Transform an array into a regexp.
     *
     * @param  {Array}  path
     * @param  {Array}  keys
     * @param  {Object} options
     * @return {RegExp}
     */
    function arrayToRegexp (path, keys, options) {
      var parts = [];

      for (var i = 0; i < path.length; i++) {
        parts.push(pathToRegexp(path[i], keys, options).source);
      }

      var regexp = new RegExp('(?:' + parts.join('|') + ')', flags(options));

      return attachKeys(regexp, keys)
    }

    /**
     * Create a path regexp from string input.
     *
     * @param  {String} path
     * @param  {Array}  keys
     * @param  {Object} options
     * @return {RegExp}
     */
    function stringToRegexp (path, keys, options) {
      var tokens = parse(path);
      var re = tokensToRegExp(tokens, options);

      // Attach keys back to the regexp.
      for (var i = 0; i < tokens.length; i++) {
        if (typeof tokens[i] !== 'string') {
          keys.push(tokens[i]);
        }
      }

      return attachKeys(re, keys)
    }

    /**
     * Expose a function for taking tokens and returning a RegExp.
     *
     * @param  {Array}  tokens
     * @param  {Array}  keys
     * @param  {Object} options
     * @return {RegExp}
     */
    function tokensToRegExp (tokens, options) {
      options = options || {};

      var strict = options.strict;
      var end = options.end !== false;
      var route = '';
      var lastToken = tokens[tokens.length - 1];
      var endsWithSlash = typeof lastToken === 'string' && /\/$/.test(lastToken);

      // Iterate over the tokens and create our regexp string.
      for (var i = 0; i < tokens.length; i++) {
        var token = tokens[i];

        if (typeof token === 'string') {
          route += escapeString(token);
        } else {
          var prefix = escapeString(token.prefix);
          var capture = token.pattern;

          if (token.repeat) {
            capture += '(?:' + prefix + capture + ')*';
          }

          if (token.optional) {
            if (prefix) {
              capture = '(?:' + prefix + '(' + capture + '))?';
            } else {
              capture = '(' + capture + ')?';
            }
          } else {
            capture = prefix + '(' + capture + ')';
          }

          route += capture;
        }
      }

      // In non-strict mode we allow a slash at the end of match. If the path to
      // match already ends with a slash, we remove it for consistency. The slash
      // is valid at the end of a path match, not in the middle. This is important
      // in non-ending mode, where "/test/" shouldn't match "/test//route".
      if (!strict) {
        route = (endsWithSlash ? route.slice(0, -2) : route) + '(?:\\/(?=$))?';
      }

      if (end) {
        route += '$';
      } else {
        // In non-ending mode, we need the capturing groups to match as much as
        // possible by using a positive lookahead to the end or next path segment.
        route += strict && endsWithSlash ? '' : '(?=\\/|$)';
      }

      return new RegExp('^' + route, flags(options))
    }

    /**
     * Normalize the given path string, returning a regular expression.
     *
     * An empty array can be passed in for the keys, which will hold the
     * placeholder key descriptions. For example, using `/user/:id`, `keys` will
     * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
     *
     * @param  {(String|RegExp|Array)} path
     * @param  {Array}                 [keys]
     * @param  {Object}                [options]
     * @return {RegExp}
     */
    function pathToRegexp (path, keys, options) {
      keys = keys || [];

      if (!isarray(keys)) {
        options = keys;
        keys = [];
      } else if (!options) {
        options = {};
      }

      if (path instanceof RegExp) {
        return regexpToRegexp(path, keys)
      }

      if (isarray(path)) {
        return arrayToRegexp(path, keys, options)
      }

      return stringToRegexp(path, keys, options)
    }

    pathToRegexp_1.parse = parse_1;
    pathToRegexp_1.compile = compile_1;
    pathToRegexp_1.tokensToFunction = tokensToFunction_1;
    pathToRegexp_1.tokensToRegExp = tokensToRegExp_1;

    /**
       * Module dependencies.
       */

      

      /**
       * Short-cuts for global-object checks
       */

      var hasDocument = ('undefined' !== typeof document);
      var hasWindow = ('undefined' !== typeof window);
      var hasHistory = ('undefined' !== typeof history);
      var hasProcess = typeof process !== 'undefined';

      /**
       * Detect click event
       */
      var clickEvent = hasDocument && document.ontouchstart ? 'touchstart' : 'click';

      /**
       * To work properly with the URL
       * history.location generated polyfill in https://github.com/devote/HTML5-History-API
       */

      var isLocation = hasWindow && !!(window.history.location || window.location);

      /**
       * The page instance
       * @api private
       */
      function Page() {
        // public things
        this.callbacks = [];
        this.exits = [];
        this.current = '';
        this.len = 0;

        // private things
        this._decodeURLComponents = true;
        this._base = '';
        this._strict = false;
        this._running = false;
        this._hashbang = false;

        // bound functions
        this.clickHandler = this.clickHandler.bind(this);
        this._onpopstate = this._onpopstate.bind(this);
      }

      /**
       * Configure the instance of page. This can be called multiple times.
       *
       * @param {Object} options
       * @api public
       */

      Page.prototype.configure = function(options) {
        var opts = options || {};

        this._window = opts.window || (hasWindow && window);
        this._decodeURLComponents = opts.decodeURLComponents !== false;
        this._popstate = opts.popstate !== false && hasWindow;
        this._click = opts.click !== false && hasDocument;
        this._hashbang = !!opts.hashbang;

        var _window = this._window;
        if(this._popstate) {
          _window.addEventListener('popstate', this._onpopstate, false);
        } else if(hasWindow) {
          _window.removeEventListener('popstate', this._onpopstate, false);
        }

        if (this._click) {
          _window.document.addEventListener(clickEvent, this.clickHandler, false);
        } else if(hasDocument) {
          _window.document.removeEventListener(clickEvent, this.clickHandler, false);
        }

        if(this._hashbang && hasWindow && !hasHistory) {
          _window.addEventListener('hashchange', this._onpopstate, false);
        } else if(hasWindow) {
          _window.removeEventListener('hashchange', this._onpopstate, false);
        }
      };

      /**
       * Get or set basepath to `path`.
       *
       * @param {string} path
       * @api public
       */

      Page.prototype.base = function(path) {
        if (0 === arguments.length) return this._base;
        this._base = path;
      };

      /**
       * Gets the `base`, which depends on whether we are using History or
       * hashbang routing.

       * @api private
       */
      Page.prototype._getBase = function() {
        var base = this._base;
        if(!!base) return base;
        var loc = hasWindow && this._window && this._window.location;

        if(hasWindow && this._hashbang && loc && loc.protocol === 'file:') {
          base = loc.pathname;
        }

        return base;
      };

      /**
       * Get or set strict path matching to `enable`
       *
       * @param {boolean} enable
       * @api public
       */

      Page.prototype.strict = function(enable) {
        if (0 === arguments.length) return this._strict;
        this._strict = enable;
      };


      /**
       * Bind with the given `options`.
       *
       * Options:
       *
       *    - `click` bind to click events [true]
       *    - `popstate` bind to popstate [true]
       *    - `dispatch` perform initial dispatch [true]
       *
       * @param {Object} options
       * @api public
       */

      Page.prototype.start = function(options) {
        var opts = options || {};
        this.configure(opts);

        if (false === opts.dispatch) return;
        this._running = true;

        var url;
        if(isLocation) {
          var window = this._window;
          var loc = window.location;

          if(this._hashbang && ~loc.hash.indexOf('#!')) {
            url = loc.hash.substr(2) + loc.search;
          } else if (this._hashbang) {
            url = loc.search + loc.hash;
          } else {
            url = loc.pathname + loc.search + loc.hash;
          }
        }

        this.replace(url, null, true, opts.dispatch);
      };

      /**
       * Unbind click and popstate event handlers.
       *
       * @api public
       */

      Page.prototype.stop = function() {
        if (!this._running) return;
        this.current = '';
        this.len = 0;
        this._running = false;

        var window = this._window;
        this._click && window.document.removeEventListener(clickEvent, this.clickHandler, false);
        hasWindow && window.removeEventListener('popstate', this._onpopstate, false);
        hasWindow && window.removeEventListener('hashchange', this._onpopstate, false);
      };

      /**
       * Show `path` with optional `state` object.
       *
       * @param {string} path
       * @param {Object=} state
       * @param {boolean=} dispatch
       * @param {boolean=} push
       * @return {!Context}
       * @api public
       */

      Page.prototype.show = function(path, state, dispatch, push) {
        var ctx = new Context(path, state, this),
          prev = this.prevContext;
        this.prevContext = ctx;
        this.current = ctx.path;
        if (false !== dispatch) this.dispatch(ctx, prev);
        if (false !== ctx.handled && false !== push) ctx.pushState();
        return ctx;
      };

      /**
       * Goes back in the history
       * Back should always let the current route push state and then go back.
       *
       * @param {string} path - fallback path to go back if no more history exists, if undefined defaults to page.base
       * @param {Object=} state
       * @api public
       */

      Page.prototype.back = function(path, state) {
        var page = this;
        if (this.len > 0) {
          var window = this._window;
          // this may need more testing to see if all browsers
          // wait for the next tick to go back in history
          hasHistory && window.history.back();
          this.len--;
        } else if (path) {
          setTimeout(function() {
            page.show(path, state);
          });
        } else {
          setTimeout(function() {
            page.show(page._getBase(), state);
          });
        }
      };

      /**
       * Register route to redirect from one path to other
       * or just redirect to another route
       *
       * @param {string} from - if param 'to' is undefined redirects to 'from'
       * @param {string=} to
       * @api public
       */
      Page.prototype.redirect = function(from, to) {
        var inst = this;

        // Define route from a path to another
        if ('string' === typeof from && 'string' === typeof to) {
          page.call(this, from, function(e) {
            setTimeout(function() {
              inst.replace(/** @type {!string} */ (to));
            }, 0);
          });
        }

        // Wait for the push state and replace it with another
        if ('string' === typeof from && 'undefined' === typeof to) {
          setTimeout(function() {
            inst.replace(from);
          }, 0);
        }
      };

      /**
       * Replace `path` with optional `state` object.
       *
       * @param {string} path
       * @param {Object=} state
       * @param {boolean=} init
       * @param {boolean=} dispatch
       * @return {!Context}
       * @api public
       */


      Page.prototype.replace = function(path, state, init, dispatch) {
        var ctx = new Context(path, state, this),
          prev = this.prevContext;
        this.prevContext = ctx;
        this.current = ctx.path;
        ctx.init = init;
        ctx.save(); // save before dispatching, which may redirect
        if (false !== dispatch) this.dispatch(ctx, prev);
        return ctx;
      };

      /**
       * Dispatch the given `ctx`.
       *
       * @param {Context} ctx
       * @api private
       */

      Page.prototype.dispatch = function(ctx, prev) {
        var i = 0, j = 0, page = this;

        function nextExit() {
          var fn = page.exits[j++];
          if (!fn) return nextEnter();
          fn(prev, nextExit);
        }

        function nextEnter() {
          var fn = page.callbacks[i++];

          if (ctx.path !== page.current) {
            ctx.handled = false;
            return;
          }
          if (!fn) return unhandled.call(page, ctx);
          fn(ctx, nextEnter);
        }

        if (prev) {
          nextExit();
        } else {
          nextEnter();
        }
      };

      /**
       * Register an exit route on `path` with
       * callback `fn()`, which will be called
       * on the previous context when a new
       * page is visited.
       */
      Page.prototype.exit = function(path, fn) {
        if (typeof path === 'function') {
          return this.exit('*', path);
        }

        var route = new Route(path, null, this);
        for (var i = 1; i < arguments.length; ++i) {
          this.exits.push(route.middleware(arguments[i]));
        }
      };

      /**
       * Handle "click" events.
       */

      /* jshint +W054 */
      Page.prototype.clickHandler = function(e) {
        if (1 !== this._which(e)) return;

        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        if (e.defaultPrevented) return;

        // ensure link
        // use shadow dom when available if not, fall back to composedPath()
        // for browsers that only have shady
        var el = e.target;
        var eventPath = e.path || (e.composedPath ? e.composedPath() : null);

        if(eventPath) {
          for (var i = 0; i < eventPath.length; i++) {
            if (!eventPath[i].nodeName) continue;
            if (eventPath[i].nodeName.toUpperCase() !== 'A') continue;
            if (!eventPath[i].href) continue;

            el = eventPath[i];
            break;
          }
        }

        // continue ensure link
        // el.nodeName for svg links are 'a' instead of 'A'
        while (el && 'A' !== el.nodeName.toUpperCase()) el = el.parentNode;
        if (!el || 'A' !== el.nodeName.toUpperCase()) return;

        // check if link is inside an svg
        // in this case, both href and target are always inside an object
        var svg = (typeof el.href === 'object') && el.href.constructor.name === 'SVGAnimatedString';

        // Ignore if tag has
        // 1. "download" attribute
        // 2. rel="external" attribute
        if (el.hasAttribute('download') || el.getAttribute('rel') === 'external') return;

        // ensure non-hash for the same path
        var link = el.getAttribute('href');
        if(!this._hashbang && this._samePath(el) && (el.hash || '#' === link)) return;

        // Check for mailto: in the href
        if (link && link.indexOf('mailto:') > -1) return;

        // check target
        // svg target is an object and its desired value is in .baseVal property
        if (svg ? el.target.baseVal : el.target) return;

        // x-origin
        // note: svg links that are not relative don't call click events (and skip page.js)
        // consequently, all svg links tested inside page.js are relative and in the same origin
        if (!svg && !this.sameOrigin(el.href)) return;

        // rebuild path
        // There aren't .pathname and .search properties in svg links, so we use href
        // Also, svg href is an object and its desired value is in .baseVal property
        var path = svg ? el.href.baseVal : (el.pathname + el.search + (el.hash || ''));

        path = path[0] !== '/' ? '/' + path : path;

        // strip leading "/[drive letter]:" on NW.js on Windows
        if (hasProcess && path.match(/^\/[a-zA-Z]:\//)) {
          path = path.replace(/^\/[a-zA-Z]:\//, '/');
        }

        // same page
        var orig = path;
        var pageBase = this._getBase();

        if (path.indexOf(pageBase) === 0) {
          path = path.substr(pageBase.length);
        }

        if (this._hashbang) path = path.replace('#!', '');

        if (pageBase && orig === path && (!isLocation || this._window.location.protocol !== 'file:')) {
          return;
        }

        e.preventDefault();
        this.show(orig);
      };

      /**
       * Handle "populate" events.
       * @api private
       */

      Page.prototype._onpopstate = (function () {
        var loaded = false;
        if ( ! hasWindow ) {
          return function () {};
        }
        if (hasDocument && document.readyState === 'complete') {
          loaded = true;
        } else {
          window.addEventListener('load', function() {
            setTimeout(function() {
              loaded = true;
            }, 0);
          });
        }
        return function onpopstate(e) {
          if (!loaded) return;
          var page = this;
          if (e.state) {
            var path = e.state.path;
            page.replace(path, e.state);
          } else if (isLocation) {
            var loc = page._window.location;
            page.show(loc.pathname + loc.search + loc.hash, undefined, undefined, false);
          }
        };
      })();

      /**
       * Event button.
       */
      Page.prototype._which = function(e) {
        e = e || (hasWindow && this._window.event);
        return null == e.which ? e.button : e.which;
      };

      /**
       * Convert to a URL object
       * @api private
       */
      Page.prototype._toURL = function(href) {
        var window = this._window;
        if(typeof URL === 'function' && isLocation) {
          return new URL(href, window.location.toString());
        } else if (hasDocument) {
          var anc = window.document.createElement('a');
          anc.href = href;
          return anc;
        }
      };

      /**
       * Check if `href` is the same origin.
       * @param {string} href
       * @api public
       */
      Page.prototype.sameOrigin = function(href) {
        if(!href || !isLocation) return false;

        var url = this._toURL(href);
        var window = this._window;

        var loc = window.location;

        /*
           When the port is the default http port 80 for http, or 443 for
           https, internet explorer 11 returns an empty string for loc.port,
           so we need to compare loc.port with an empty string if url.port
           is the default port 80 or 443.
           Also the comparition with `port` is changed from `===` to `==` because
           `port` can be a string sometimes. This only applies to ie11.
        */
        return loc.protocol === url.protocol &&
          loc.hostname === url.hostname &&
          (loc.port === url.port || loc.port === '' && (url.port == 80 || url.port == 443)); // jshint ignore:line
      };

      /**
       * @api private
       */
      Page.prototype._samePath = function(url) {
        if(!isLocation) return false;
        var window = this._window;
        var loc = window.location;
        return url.pathname === loc.pathname &&
          url.search === loc.search;
      };

      /**
       * Remove URL encoding from the given `str`.
       * Accommodates whitespace in both x-www-form-urlencoded
       * and regular percent-encoded form.
       *
       * @param {string} val - URL component to decode
       * @api private
       */
      Page.prototype._decodeURLEncodedURIComponent = function(val) {
        if (typeof val !== 'string') { return val; }
        return this._decodeURLComponents ? decodeURIComponent(val.replace(/\+/g, ' ')) : val;
      };

      /**
       * Create a new `page` instance and function
       */
      function createPage() {
        var pageInstance = new Page();

        function pageFn(/* args */) {
          return page.apply(pageInstance, arguments);
        }

        // Copy all of the things over. In 2.0 maybe we use setPrototypeOf
        pageFn.callbacks = pageInstance.callbacks;
        pageFn.exits = pageInstance.exits;
        pageFn.base = pageInstance.base.bind(pageInstance);
        pageFn.strict = pageInstance.strict.bind(pageInstance);
        pageFn.start = pageInstance.start.bind(pageInstance);
        pageFn.stop = pageInstance.stop.bind(pageInstance);
        pageFn.show = pageInstance.show.bind(pageInstance);
        pageFn.back = pageInstance.back.bind(pageInstance);
        pageFn.redirect = pageInstance.redirect.bind(pageInstance);
        pageFn.replace = pageInstance.replace.bind(pageInstance);
        pageFn.dispatch = pageInstance.dispatch.bind(pageInstance);
        pageFn.exit = pageInstance.exit.bind(pageInstance);
        pageFn.configure = pageInstance.configure.bind(pageInstance);
        pageFn.sameOrigin = pageInstance.sameOrigin.bind(pageInstance);
        pageFn.clickHandler = pageInstance.clickHandler.bind(pageInstance);

        pageFn.create = createPage;

        Object.defineProperty(pageFn, 'len', {
          get: function(){
            return pageInstance.len;
          },
          set: function(val) {
            pageInstance.len = val;
          }
        });

        Object.defineProperty(pageFn, 'current', {
          get: function(){
            return pageInstance.current;
          },
          set: function(val) {
            pageInstance.current = val;
          }
        });

        // In 2.0 these can be named exports
        pageFn.Context = Context;
        pageFn.Route = Route;

        return pageFn;
      }

      /**
       * Register `path` with callback `fn()`,
       * or route `path`, or redirection,
       * or `page.start()`.
       *
       *   page(fn);
       *   page('*', fn);
       *   page('/user/:id', load, user);
       *   page('/user/' + user.id, { some: 'thing' });
       *   page('/user/' + user.id);
       *   page('/from', '/to')
       *   page();
       *
       * @param {string|!Function|!Object} path
       * @param {Function=} fn
       * @api public
       */

      function page(path, fn) {
        // <callback>
        if ('function' === typeof path) {
          return page.call(this, '*', path);
        }

        // route <path> to <callback ...>
        if ('function' === typeof fn) {
          var route = new Route(/** @type {string} */ (path), null, this);
          for (var i = 1; i < arguments.length; ++i) {
            this.callbacks.push(route.middleware(arguments[i]));
          }
          // show <path> with [state]
        } else if ('string' === typeof path) {
          this['string' === typeof fn ? 'redirect' : 'show'](path, fn);
          // start [options]
        } else {
          this.start(path);
        }
      }

      /**
       * Unhandled `ctx`. When it's not the initial
       * popstate then redirect. If you wish to handle
       * 404s on your own use `page('*', callback)`.
       *
       * @param {Context} ctx
       * @api private
       */
      function unhandled(ctx) {
        if (ctx.handled) return;
        var current;
        var page = this;
        var window = page._window;

        if (page._hashbang) {
          current = isLocation && this._getBase() + window.location.hash.replace('#!', '');
        } else {
          current = isLocation && window.location.pathname + window.location.search;
        }

        if (current === ctx.canonicalPath) return;
        page.stop();
        ctx.handled = false;
        isLocation && (window.location.href = ctx.canonicalPath);
      }

      /**
       * Escapes RegExp characters in the given string.
       *
       * @param {string} s
       * @api private
       */
      function escapeRegExp(s) {
        return s.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1');
      }

      /**
       * Initialize a new "request" `Context`
       * with the given `path` and optional initial `state`.
       *
       * @constructor
       * @param {string} path
       * @param {Object=} state
       * @api public
       */

      function Context(path, state, pageInstance) {
        var _page = this.page = pageInstance || page;
        var window = _page._window;
        var hashbang = _page._hashbang;

        var pageBase = _page._getBase();
        if ('/' === path[0] && 0 !== path.indexOf(pageBase)) path = pageBase + (hashbang ? '#!' : '') + path;
        var i = path.indexOf('?');

        this.canonicalPath = path;
        var re = new RegExp('^' + escapeRegExp(pageBase));
        this.path = path.replace(re, '') || '/';
        if (hashbang) this.path = this.path.replace('#!', '') || '/';

        this.title = (hasDocument && window.document.title);
        this.state = state || {};
        this.state.path = path;
        this.querystring = ~i ? _page._decodeURLEncodedURIComponent(path.slice(i + 1)) : '';
        this.pathname = _page._decodeURLEncodedURIComponent(~i ? path.slice(0, i) : path);
        this.params = {};

        // fragment
        this.hash = '';
        if (!hashbang) {
          if (!~this.path.indexOf('#')) return;
          var parts = this.path.split('#');
          this.path = this.pathname = parts[0];
          this.hash = _page._decodeURLEncodedURIComponent(parts[1]) || '';
          this.querystring = this.querystring.split('#')[0];
        }
      }

      /**
       * Push state.
       *
       * @api private
       */

      Context.prototype.pushState = function() {
        var page = this.page;
        var window = page._window;
        var hashbang = page._hashbang;

        page.len++;
        if (hasHistory) {
            window.history.pushState(this.state, this.title,
              hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
        }
      };

      /**
       * Save the context state.
       *
       * @api public
       */

      Context.prototype.save = function() {
        var page = this.page;
        if (hasHistory) {
            page._window.history.replaceState(this.state, this.title,
              page._hashbang && this.path !== '/' ? '#!' + this.path : this.canonicalPath);
        }
      };

      /**
       * Initialize `Route` with the given HTTP `path`,
       * and an array of `callbacks` and `options`.
       *
       * Options:
       *
       *   - `sensitive`    enable case-sensitive routes
       *   - `strict`       enable strict matching for trailing slashes
       *
       * @constructor
       * @param {string} path
       * @param {Object=} options
       * @api private
       */

      function Route(path, options, page) {
        var _page = this.page = page || globalPage;
        var opts = options || {};
        opts.strict = opts.strict || _page._strict;
        this.path = (path === '*') ? '(.*)' : path;
        this.method = 'GET';
        this.regexp = pathToRegexp_1(this.path, this.keys = [], opts);
      }

      /**
       * Return route middleware with
       * the given callback `fn()`.
       *
       * @param {Function} fn
       * @return {Function}
       * @api public
       */

      Route.prototype.middleware = function(fn) {
        var self = this;
        return function(ctx, next) {
          if (self.match(ctx.path, ctx.params)) {
            ctx.routePath = self.path;
            return fn(ctx, next);
          }
          next();
        };
      };

      /**
       * Check if this route matches `path`, if so
       * populate `params`.
       *
       * @param {string} path
       * @param {Object} params
       * @return {boolean}
       * @api private
       */

      Route.prototype.match = function(path, params) {
        var keys = this.keys,
          qsIndex = path.indexOf('?'),
          pathname = ~qsIndex ? path.slice(0, qsIndex) : path,
          m = this.regexp.exec(decodeURIComponent(pathname));

        if (!m) return false;

        delete params[0];

        for (var i = 1, len = m.length; i < len; ++i) {
          var key = keys[i - 1];
          var val = this.page._decodeURLEncodedURIComponent(m[i]);
          if (val !== undefined || !(hasOwnProperty.call(params, key.name))) {
            params[key.name] = val;
          }
        }

        return true;
      };


      /**
       * Module exports.
       */

      var globalPage = createPage();
      var page_js = globalPage;
      var default_1 = globalPage;

    page_js.default = default_1;

    return page_js;

    })));
    });

    var textarea;

    function decodeEntity(name) {
      textarea = textarea || document.createElement('textarea');
      textarea.innerHTML = '&' + name + ';';
      return textarea.value;
    }

    var hasOwn = Object.prototype.hasOwnProperty;

    function has(object, key) {
      return object
        ? hasOwn.call(object, key)
        : false;
    }

    // Extend objects
    //
    function assign(obj /*from1, from2, from3, ...*/) {
      var sources = [].slice.call(arguments, 1);

      sources.forEach(function (source) {
        if (!source) { return; }

        if (typeof source !== 'object') {
          throw new TypeError(source + 'must be object');
        }

        Object.keys(source).forEach(function (key) {
          obj[key] = source[key];
        });
      });

      return obj;
    }

    ////////////////////////////////////////////////////////////////////////////////

    var UNESCAPE_MD_RE = /\\([\\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;

    function unescapeMd(str) {
      if (str.indexOf('\\') < 0) { return str; }
      return str.replace(UNESCAPE_MD_RE, '$1');
    }

    ////////////////////////////////////////////////////////////////////////////////

    function isValidEntityCode(c) {
      /*eslint no-bitwise:0*/
      // broken sequence
      if (c >= 0xD800 && c <= 0xDFFF) { return false; }
      // never used
      if (c >= 0xFDD0 && c <= 0xFDEF) { return false; }
      if ((c & 0xFFFF) === 0xFFFF || (c & 0xFFFF) === 0xFFFE) { return false; }
      // control codes
      if (c >= 0x00 && c <= 0x08) { return false; }
      if (c === 0x0B) { return false; }
      if (c >= 0x0E && c <= 0x1F) { return false; }
      if (c >= 0x7F && c <= 0x9F) { return false; }
      // out of range
      if (c > 0x10FFFF) { return false; }
      return true;
    }

    function fromCodePoint(c) {
      /*eslint no-bitwise:0*/
      if (c > 0xffff) {
        c -= 0x10000;
        var surrogate1 = 0xd800 + (c >> 10),
            surrogate2 = 0xdc00 + (c & 0x3ff);

        return String.fromCharCode(surrogate1, surrogate2);
      }
      return String.fromCharCode(c);
    }

    var NAMED_ENTITY_RE   = /&([a-z#][a-z0-9]{1,31});/gi;
    var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;

    function replaceEntityPattern(match, name) {
      var code = 0;
      var decoded = decodeEntity(name);

      if (name !== decoded) {
        return decoded;
      } else if (name.charCodeAt(0) === 0x23/* # */ && DIGITAL_ENTITY_TEST_RE.test(name)) {
        code = name[1].toLowerCase() === 'x' ?
          parseInt(name.slice(2), 16)
        :
          parseInt(name.slice(1), 10);
        if (isValidEntityCode(code)) {
          return fromCodePoint(code);
        }
      }
      return match;
    }

    function replaceEntities(str) {
      if (str.indexOf('&') < 0) { return str; }

      return str.replace(NAMED_ENTITY_RE, replaceEntityPattern);
    }

    ////////////////////////////////////////////////////////////////////////////////

    var HTML_ESCAPE_TEST_RE = /[&<>"]/;
    var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
    var HTML_REPLACEMENTS = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    };

    function replaceUnsafeChar(ch) {
      return HTML_REPLACEMENTS[ch];
    }

    function escapeHtml(str) {
      if (HTML_ESCAPE_TEST_RE.test(str)) {
        return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
      }
      return str;
    }

    /**
     * Renderer rules cache
     */

    var rules = {};

    /**
     * Blockquotes
     */

    rules.blockquote_open = function(/* tokens, idx, options, env */) {
      return '<blockquote>\n';
    };

    rules.blockquote_close = function(tokens, idx /*, options, env */) {
      return '</blockquote>' + getBreak(tokens, idx);
    };

    /**
     * Code
     */

    rules.code = function(tokens, idx /*, options, env */) {
      if (tokens[idx].block) {
        return '<pre><code>' + escapeHtml(tokens[idx].content) + '</code></pre>' + getBreak(tokens, idx);
      }
      return '<code>' + escapeHtml(tokens[idx].content) + '</code>';
    };

    /**
     * Fenced code blocks
     */

    rules.fence = function(tokens, idx, options, env, instance) {
      var token = tokens[idx];
      var langClass = '';
      var langPrefix = options.langPrefix;
      var langName = '', fences, fenceName;
      var highlighted;

      if (token.params) {

        //
        // ```foo bar
        //
        // Try custom renderer "foo" first. That will simplify overwrite
        // for diagrams, latex, and any other fenced block with custom look
        //

        fences = token.params.split(/\s+/g);
        fenceName = fences.join(' ');

        if (has(instance.rules.fence_custom, fences[0])) {
          return instance.rules.fence_custom[fences[0]](tokens, idx, options, env, instance);
        }

        langName = escapeHtml(replaceEntities(unescapeMd(fenceName)));
        langClass = ' class="' + langPrefix + langName + '"';
      }

      if (options.highlight) {
        highlighted = options.highlight.apply(options.highlight, [ token.content ].concat(fences))
          || escapeHtml(token.content);
      } else {
        highlighted = escapeHtml(token.content);
      }

      return '<pre><code' + langClass + '>'
            + highlighted
            + '</code></pre>'
            + getBreak(tokens, idx);
    };

    rules.fence_custom = {};

    /**
     * Headings
     */

    rules.heading_open = function(tokens, idx /*, options, env */) {
      return '<h' + tokens[idx].hLevel + '>';
    };
    rules.heading_close = function(tokens, idx /*, options, env */) {
      return '</h' + tokens[idx].hLevel + '>\n';
    };

    /**
     * Horizontal rules
     */

    rules.hr = function(tokens, idx, options /*, env */) {
      return (options.xhtmlOut ? '<hr />' : '<hr>') + getBreak(tokens, idx);
    };

    /**
     * Bullets
     */

    rules.bullet_list_open = function(/* tokens, idx, options, env */) {
      return '<ul>\n';
    };
    rules.bullet_list_close = function(tokens, idx /*, options, env */) {
      return '</ul>' + getBreak(tokens, idx);
    };

    /**
     * List items
     */

    rules.list_item_open = function(/* tokens, idx, options, env */) {
      return '<li>';
    };
    rules.list_item_close = function(/* tokens, idx, options, env */) {
      return '</li>\n';
    };

    /**
     * Ordered list items
     */

    rules.ordered_list_open = function(tokens, idx /*, options, env */) {
      var token = tokens[idx];
      var order = token.order > 1 ? ' start="' + token.order + '"' : '';
      return '<ol' + order + '>\n';
    };
    rules.ordered_list_close = function(tokens, idx /*, options, env */) {
      return '</ol>' + getBreak(tokens, idx);
    };

    /**
     * Paragraphs
     */

    rules.paragraph_open = function(tokens, idx /*, options, env */) {
      return tokens[idx].tight ? '' : '<p>';
    };
    rules.paragraph_close = function(tokens, idx /*, options, env */) {
      var addBreak = !(tokens[idx].tight && idx && tokens[idx - 1].type === 'inline' && !tokens[idx - 1].content);
      return (tokens[idx].tight ? '' : '</p>') + (addBreak ? getBreak(tokens, idx) : '');
    };

    /**
     * Links
     */

    rules.link_open = function(tokens, idx, options /* env */) {
      var title = tokens[idx].title ? (' title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '"') : '';
      var target = options.linkTarget ? (' target="' + options.linkTarget + '"') : '';
      return '<a href="' + escapeHtml(tokens[idx].href) + '"' + title + target + '>';
    };
    rules.link_close = function(/* tokens, idx, options, env */) {
      return '</a>';
    };

    /**
     * Images
     */

    rules.image = function(tokens, idx, options /*, env */) {
      var src = ' src="' + escapeHtml(tokens[idx].src) + '"';
      var title = tokens[idx].title ? (' title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '"') : '';
      var alt = ' alt="' + (tokens[idx].alt ? escapeHtml(replaceEntities(unescapeMd(tokens[idx].alt))) : '') + '"';
      var suffix = options.xhtmlOut ? ' /' : '';
      return '<img' + src + alt + title + suffix + '>';
    };

    /**
     * Tables
     */

    rules.table_open = function(/* tokens, idx, options, env */) {
      return '<table>\n';
    };
    rules.table_close = function(/* tokens, idx, options, env */) {
      return '</table>\n';
    };
    rules.thead_open = function(/* tokens, idx, options, env */) {
      return '<thead>\n';
    };
    rules.thead_close = function(/* tokens, idx, options, env */) {
      return '</thead>\n';
    };
    rules.tbody_open = function(/* tokens, idx, options, env */) {
      return '<tbody>\n';
    };
    rules.tbody_close = function(/* tokens, idx, options, env */) {
      return '</tbody>\n';
    };
    rules.tr_open = function(/* tokens, idx, options, env */) {
      return '<tr>';
    };
    rules.tr_close = function(/* tokens, idx, options, env */) {
      return '</tr>\n';
    };
    rules.th_open = function(tokens, idx /*, options, env */) {
      var token = tokens[idx];
      return '<th'
        + (token.align ? ' style="text-align:' + token.align + '"' : '')
        + '>';
    };
    rules.th_close = function(/* tokens, idx, options, env */) {
      return '</th>';
    };
    rules.td_open = function(tokens, idx /*, options, env */) {
      var token = tokens[idx];
      return '<td'
        + (token.align ? ' style="text-align:' + token.align + '"' : '')
        + '>';
    };
    rules.td_close = function(/* tokens, idx, options, env */) {
      return '</td>';
    };

    /**
     * Bold
     */

    rules.strong_open = function(/* tokens, idx, options, env */) {
      return '<strong>';
    };
    rules.strong_close = function(/* tokens, idx, options, env */) {
      return '</strong>';
    };

    /**
     * Italicize
     */

    rules.em_open = function(/* tokens, idx, options, env */) {
      return '<em>';
    };
    rules.em_close = function(/* tokens, idx, options, env */) {
      return '</em>';
    };

    /**
     * Strikethrough
     */

    rules.del_open = function(/* tokens, idx, options, env */) {
      return '<del>';
    };
    rules.del_close = function(/* tokens, idx, options, env */) {
      return '</del>';
    };

    /**
     * Insert
     */

    rules.ins_open = function(/* tokens, idx, options, env */) {
      return '<ins>';
    };
    rules.ins_close = function(/* tokens, idx, options, env */) {
      return '</ins>';
    };

    /**
     * Highlight
     */

    rules.mark_open = function(/* tokens, idx, options, env */) {
      return '<mark>';
    };
    rules.mark_close = function(/* tokens, idx, options, env */) {
      return '</mark>';
    };

    /**
     * Super- and sub-script
     */

    rules.sub = function(tokens, idx /*, options, env */) {
      return '<sub>' + escapeHtml(tokens[idx].content) + '</sub>';
    };
    rules.sup = function(tokens, idx /*, options, env */) {
      return '<sup>' + escapeHtml(tokens[idx].content) + '</sup>';
    };

    /**
     * Breaks
     */

    rules.hardbreak = function(tokens, idx, options /*, env */) {
      return options.xhtmlOut ? '<br />\n' : '<br>\n';
    };
    rules.softbreak = function(tokens, idx, options /*, env */) {
      return options.breaks ? (options.xhtmlOut ? '<br />\n' : '<br>\n') : '\n';
    };

    /**
     * Text
     */

    rules.text = function(tokens, idx /*, options, env */) {
      return escapeHtml(tokens[idx].content);
    };

    /**
     * Content
     */

    rules.htmlblock = function(tokens, idx /*, options, env */) {
      return tokens[idx].content;
    };
    rules.htmltag = function(tokens, idx /*, options, env */) {
      return tokens[idx].content;
    };

    /**
     * Abbreviations, initialism
     */

    rules.abbr_open = function(tokens, idx /*, options, env */) {
      return '<abbr title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '">';
    };
    rules.abbr_close = function(/* tokens, idx, options, env */) {
      return '</abbr>';
    };

    /**
     * Footnotes
     */

    rules.footnote_ref = function(tokens, idx) {
      var n = Number(tokens[idx].id + 1).toString();
      var id = 'fnref' + n;
      if (tokens[idx].subId > 0) {
        id += ':' + tokens[idx].subId;
      }
      return '<sup class="footnote-ref"><a href="#fn' + n + '" id="' + id + '">[' + n + ']</a></sup>';
    };
    rules.footnote_block_open = function(tokens, idx, options) {
      var hr = options.xhtmlOut
        ? '<hr class="footnotes-sep" />\n'
        : '<hr class="footnotes-sep">\n';
      return hr + '<section class="footnotes">\n<ol class="footnotes-list">\n';
    };
    rules.footnote_block_close = function() {
      return '</ol>\n</section>\n';
    };
    rules.footnote_open = function(tokens, idx) {
      var id = Number(tokens[idx].id + 1).toString();
      return '<li id="fn' + id + '"  class="footnote-item">';
    };
    rules.footnote_close = function() {
      return '</li>\n';
    };
    rules.footnote_anchor = function(tokens, idx) {
      var n = Number(tokens[idx].id + 1).toString();
      var id = 'fnref' + n;
      if (tokens[idx].subId > 0) {
        id += ':' + tokens[idx].subId;
      }
      return ' <a href="#' + id + '" class="footnote-backref">↩</a>';
    };

    /**
     * Definition lists
     */

    rules.dl_open = function() {
      return '<dl>\n';
    };
    rules.dt_open = function() {
      return '<dt>';
    };
    rules.dd_open = function() {
      return '<dd>';
    };
    rules.dl_close = function() {
      return '</dl>\n';
    };
    rules.dt_close = function() {
      return '</dt>\n';
    };
    rules.dd_close = function() {
      return '</dd>\n';
    };

    /**
     * Helper functions
     */

    function nextToken(tokens, idx) {
      if (++idx >= tokens.length - 2) {
        return idx;
      }
      if ((tokens[idx].type === 'paragraph_open' && tokens[idx].tight) &&
          (tokens[idx + 1].type === 'inline' && tokens[idx + 1].content.length === 0) &&
          (tokens[idx + 2].type === 'paragraph_close' && tokens[idx + 2].tight)) {
        return nextToken(tokens, idx + 2);
      }
      return idx;
    }

    /**
     * Check to see if `\n` is needed before the next token.
     *
     * @param  {Array} `tokens`
     * @param  {Number} `idx`
     * @return {String} Empty string or newline
     * @api private
     */

    var getBreak = rules.getBreak = function getBreak(tokens, idx) {
      idx = nextToken(tokens, idx);
      if (idx < tokens.length && tokens[idx].type === 'list_item_close') {
        return '';
      }
      return '\n';
    };

    /**
     * Renderer class. Renders HTML and exposes `rules` to allow
     * local modifications.
     */

    function Renderer() {
      this.rules = assign({}, rules);

      // exported helper, for custom rules only
      this.getBreak = rules.getBreak;
    }

    /**
     * Render a string of inline HTML with the given `tokens` and
     * `options`.
     *
     * @param  {Array} `tokens`
     * @param  {Object} `options`
     * @param  {Object} `env`
     * @return {String}
     * @api public
     */

    Renderer.prototype.renderInline = function (tokens, options, env) {
      var _rules = this.rules;
      var len = tokens.length, i = 0;
      var result = '';

      while (len--) {
        result += _rules[tokens[i].type](tokens, i++, options, env, this);
      }

      return result;
    };

    /**
     * Render a string of HTML with the given `tokens` and
     * `options`.
     *
     * @param  {Array} `tokens`
     * @param  {Object} `options`
     * @param  {Object} `env`
     * @return {String}
     * @api public
     */

    Renderer.prototype.render = function (tokens, options, env) {
      var _rules = this.rules;
      var len = tokens.length, i = -1;
      var result = '';

      while (++i < len) {
        if (tokens[i].type === 'inline') {
          result += this.renderInline(tokens[i].children, options, env);
        } else {
          result += _rules[tokens[i].type](tokens, i, options, env, this);
        }
      }
      return result;
    };

    /**
     * Ruler is a helper class for building responsibility chains from
     * parse rules. It allows:
     *
     *   - easy stack rules chains
     *   - getting main chain and named chains content (as arrays of functions)
     *
     * Helper methods, should not be used directly.
     * @api private
     */

    function Ruler() {
      // List of added rules. Each element is:
      //
      // { name: XXX,
      //   enabled: Boolean,
      //   fn: Function(),
      //   alt: [ name2, name3 ] }
      //
      this.__rules__ = [];

      // Cached rule chains.
      //
      // First level - chain name, '' for default.
      // Second level - digital anchor for fast filtering by charcodes.
      //
      this.__cache__ = null;
    }

    /**
     * Find the index of a rule by `name`.
     *
     * @param  {String} `name`
     * @return {Number} Index of the given `name`
     * @api private
     */

    Ruler.prototype.__find__ = function (name) {
      var len = this.__rules__.length;
      var i = -1;

      while (len--) {
        if (this.__rules__[++i].name === name) {
          return i;
        }
      }
      return -1;
    };

    /**
     * Build the rules lookup cache
     *
     * @api private
     */

    Ruler.prototype.__compile__ = function () {
      var self = this;
      var chains = [ '' ];

      // collect unique names
      self.__rules__.forEach(function (rule) {
        if (!rule.enabled) {
          return;
        }

        rule.alt.forEach(function (altName) {
          if (chains.indexOf(altName) < 0) {
            chains.push(altName);
          }
        });
      });

      self.__cache__ = {};

      chains.forEach(function (chain) {
        self.__cache__[chain] = [];
        self.__rules__.forEach(function (rule) {
          if (!rule.enabled) {
            return;
          }

          if (chain && rule.alt.indexOf(chain) < 0) {
            return;
          }
          self.__cache__[chain].push(rule.fn);
        });
      });
    };

    /**
     * Ruler public methods
     * ------------------------------------------------
     */

    /**
     * Replace rule function
     *
     * @param  {String} `name` Rule name
     * @param  {Function `fn`
     * @param  {Object} `options`
     * @api private
     */

    Ruler.prototype.at = function (name, fn, options) {
      var idx = this.__find__(name);
      var opt = options || {};

      if (idx === -1) {
        throw new Error('Parser rule not found: ' + name);
      }

      this.__rules__[idx].fn = fn;
      this.__rules__[idx].alt = opt.alt || [];
      this.__cache__ = null;
    };

    /**
     * Add a rule to the chain before given the `ruleName`.
     *
     * @param  {String}   `beforeName`
     * @param  {String}   `ruleName`
     * @param  {Function} `fn`
     * @param  {Object}   `options`
     * @api private
     */

    Ruler.prototype.before = function (beforeName, ruleName, fn, options) {
      var idx = this.__find__(beforeName);
      var opt = options || {};

      if (idx === -1) {
        throw new Error('Parser rule not found: ' + beforeName);
      }

      this.__rules__.splice(idx, 0, {
        name: ruleName,
        enabled: true,
        fn: fn,
        alt: opt.alt || []
      });

      this.__cache__ = null;
    };

    /**
     * Add a rule to the chain after the given `ruleName`.
     *
     * @param  {String}   `afterName`
     * @param  {String}   `ruleName`
     * @param  {Function} `fn`
     * @param  {Object}   `options`
     * @api private
     */

    Ruler.prototype.after = function (afterName, ruleName, fn, options) {
      var idx = this.__find__(afterName);
      var opt = options || {};

      if (idx === -1) {
        throw new Error('Parser rule not found: ' + afterName);
      }

      this.__rules__.splice(idx + 1, 0, {
        name: ruleName,
        enabled: true,
        fn: fn,
        alt: opt.alt || []
      });

      this.__cache__ = null;
    };

    /**
     * Add a rule to the end of chain.
     *
     * @param  {String}   `ruleName`
     * @param  {Function} `fn`
     * @param  {Object}   `options`
     * @return {String}
     */

    Ruler.prototype.push = function (ruleName, fn, options) {
      var opt = options || {};

      this.__rules__.push({
        name: ruleName,
        enabled: true,
        fn: fn,
        alt: opt.alt || []
      });

      this.__cache__ = null;
    };

    /**
     * Enable a rule or list of rules.
     *
     * @param  {String|Array} `list` Name or array of rule names to enable
     * @param  {Boolean} `strict` If `true`, all non listed rules will be disabled.
     * @api private
     */

    Ruler.prototype.enable = function (list, strict) {
      list = !Array.isArray(list)
        ? [ list ]
        : list;

      // In strict mode disable all existing rules first
      if (strict) {
        this.__rules__.forEach(function (rule) {
          rule.enabled = false;
        });
      }

      // Search by name and enable
      list.forEach(function (name) {
        var idx = this.__find__(name);
        if (idx < 0) {
          throw new Error('Rules manager: invalid rule name ' + name);
        }
        this.__rules__[idx].enabled = true;
      }, this);

      this.__cache__ = null;
    };


    /**
     * Disable a rule or list of rules.
     *
     * @param  {String|Array} `list` Name or array of rule names to disable
     * @api private
     */

    Ruler.prototype.disable = function (list) {
      list = !Array.isArray(list)
        ? [ list ]
        : list;

      // Search by name and disable
      list.forEach(function (name) {
        var idx = this.__find__(name);
        if (idx < 0) {
          throw new Error('Rules manager: invalid rule name ' + name);
        }
        this.__rules__[idx].enabled = false;
      }, this);

      this.__cache__ = null;
    };

    /**
     * Get a rules list as an array of functions.
     *
     * @param  {String} `chainName`
     * @return {Object}
     * @api private
     */

    Ruler.prototype.getRules = function (chainName) {
      if (this.__cache__ === null) {
        this.__compile__();
      }
      return this.__cache__[chainName] || [];
    };

    function block(state) {

      if (state.inlineMode) {
        state.tokens.push({
          type: 'inline',
          content: state.src.replace(/\n/g, ' ').trim(),
          level: 0,
          lines: [ 0, 1 ],
          children: []
        });

      } else {
        state.block.parse(state.src, state.options, state.env, state.tokens);
      }
    }

    // Inline parser state

    function StateInline(src, parserInline, options, env, outTokens) {
      this.src = src;
      this.env = env;
      this.options = options;
      this.parser = parserInline;
      this.tokens = outTokens;
      this.pos = 0;
      this.posMax = this.src.length;
      this.level = 0;
      this.pending = '';
      this.pendingLevel = 0;

      this.cache = [];        // Stores { start: end } pairs. Useful for backtrack
                              // optimization of pairs parse (emphasis, strikes).

      // Link parser state vars

      this.isInLabel = false; // Set true when seek link label - we should disable
                              // "paired" rules (emphasis, strikes) to not skip
                              // tailing `]`

      this.linkLevel = 0;     // Increment for each nesting link. Used to prevent
                              // nesting in definitions

      this.linkContent = '';  // Temporary storage for link url

      this.labelUnmatchedScopes = 0; // Track unpaired `[` for link labels
                                     // (backtrack optimization)
    }

    // Flush pending text
    //
    StateInline.prototype.pushPending = function () {
      this.tokens.push({
        type: 'text',
        content: this.pending,
        level: this.pendingLevel
      });
      this.pending = '';
    };

    // Push new token to "stream".
    // If pending text exists - flush it as text token
    //
    StateInline.prototype.push = function (token) {
      if (this.pending) {
        this.pushPending();
      }

      this.tokens.push(token);
      this.pendingLevel = this.level;
    };

    // Store value to cache.
    // !!! Implementation has parser-specific optimizations
    // !!! keys MUST be integer, >= 0; values MUST be integer, > 0
    //
    StateInline.prototype.cacheSet = function (key, val) {
      for (var i = this.cache.length; i <= key; i++) {
        this.cache.push(0);
      }

      this.cache[key] = val;
    };

    // Get cache value
    //
    StateInline.prototype.cacheGet = function (key) {
      return key < this.cache.length ? this.cache[key] : 0;
    };

    /**
     * Parse link labels
     *
     * This function assumes that first character (`[`) already matches;
     * returns the end of the label.
     *
     * @param  {Object} state
     * @param  {Number} start
     * @api private
     */

    function parseLinkLabel(state, start) {
      var level, found, marker,
          labelEnd = -1,
          max = state.posMax,
          oldPos = state.pos,
          oldFlag = state.isInLabel;

      if (state.isInLabel) { return -1; }

      if (state.labelUnmatchedScopes) {
        state.labelUnmatchedScopes--;
        return -1;
      }

      state.pos = start + 1;
      state.isInLabel = true;
      level = 1;

      while (state.pos < max) {
        marker = state.src.charCodeAt(state.pos);
        if (marker === 0x5B /* [ */) {
          level++;
        } else if (marker === 0x5D /* ] */) {
          level--;
          if (level === 0) {
            found = true;
            break;
          }
        }

        state.parser.skipToken(state);
      }

      if (found) {
        labelEnd = state.pos;
        state.labelUnmatchedScopes = 0;
      } else {
        state.labelUnmatchedScopes = level - 1;
      }

      // restore old state
      state.pos = oldPos;
      state.isInLabel = oldFlag;

      return labelEnd;
    }

    // Parse abbreviation definitions, i.e. `*[abbr]: description`


    function parseAbbr(str, parserInline, options, env) {
      var state, labelEnd, pos, max, label, title;

      if (str.charCodeAt(0) !== 0x2A/* * */) { return -1; }
      if (str.charCodeAt(1) !== 0x5B/* [ */) { return -1; }

      if (str.indexOf(']:') === -1) { return -1; }

      state = new StateInline(str, parserInline, options, env, []);
      labelEnd = parseLinkLabel(state, 1);

      if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A/* : */) { return -1; }

      max = state.posMax;

      // abbr title is always one line, so looking for ending "\n" here
      for (pos = labelEnd + 2; pos < max; pos++) {
        if (state.src.charCodeAt(pos) === 0x0A) { break; }
      }

      label = str.slice(2, labelEnd);
      title = str.slice(labelEnd + 2, pos).trim();
      if (title.length === 0) { return -1; }
      if (!env.abbreviations) { env.abbreviations = {}; }
      // prepend ':' to avoid conflict with Object.prototype members
      if (typeof env.abbreviations[':' + label] === 'undefined') {
        env.abbreviations[':' + label] = title;
      }

      return pos;
    }

    function abbr(state) {
      var tokens = state.tokens, i, l, content, pos;

      if (state.inlineMode) {
        return;
      }

      // Parse inlines
      for (i = 1, l = tokens.length - 1; i < l; i++) {
        if (tokens[i - 1].type === 'paragraph_open' &&
            tokens[i].type === 'inline' &&
            tokens[i + 1].type === 'paragraph_close') {

          content = tokens[i].content;
          while (content.length) {
            pos = parseAbbr(content, state.inline, state.options, state.env);
            if (pos < 0) { break; }
            content = content.slice(pos).trim();
          }

          tokens[i].content = content;
          if (!content.length) {
            tokens[i - 1].tight = true;
            tokens[i + 1].tight = true;
          }
        }
      }
    }

    function normalizeLink(url) {
      var normalized = replaceEntities(url);
      // We shouldn't care about the result of malformed URIs,
      // and should not throw an exception.
      try {
        normalized = decodeURI(normalized);
      } catch (err) {}
      return encodeURI(normalized);
    }

    /**
     * Parse link destination
     *
     *   - on success it returns a string and updates state.pos;
     *   - on failure it returns null
     *
     * @param  {Object} state
     * @param  {Number} pos
     * @api private
     */

    function parseLinkDestination(state, pos) {
      var code, level, link,
          start = pos,
          max = state.posMax;

      if (state.src.charCodeAt(pos) === 0x3C /* < */) {
        pos++;
        while (pos < max) {
          code = state.src.charCodeAt(pos);
          if (code === 0x0A /* \n */) { return false; }
          if (code === 0x3E /* > */) {
            link = normalizeLink(unescapeMd(state.src.slice(start + 1, pos)));
            if (!state.parser.validateLink(link)) { return false; }
            state.pos = pos + 1;
            state.linkContent = link;
            return true;
          }
          if (code === 0x5C /* \ */ && pos + 1 < max) {
            pos += 2;
            continue;
          }

          pos++;
        }

        // no closing '>'
        return false;
      }

      // this should be ... } else { ... branch

      level = 0;
      while (pos < max) {
        code = state.src.charCodeAt(pos);

        if (code === 0x20) { break; }

        // ascii control chars
        if (code < 0x20 || code === 0x7F) { break; }

        if (code === 0x5C /* \ */ && pos + 1 < max) {
          pos += 2;
          continue;
        }

        if (code === 0x28 /* ( */) {
          level++;
          if (level > 1) { break; }
        }

        if (code === 0x29 /* ) */) {
          level--;
          if (level < 0) { break; }
        }

        pos++;
      }

      if (start === pos) { return false; }

      link = unescapeMd(state.src.slice(start, pos));
      if (!state.parser.validateLink(link)) { return false; }

      state.linkContent = link;
      state.pos = pos;
      return true;
    }

    /**
     * Parse link title
     *
     *   - on success it returns a string and updates state.pos;
     *   - on failure it returns null
     *
     * @param  {Object} state
     * @param  {Number} pos
     * @api private
     */

    function parseLinkTitle(state, pos) {
      var code,
          start = pos,
          max = state.posMax,
          marker = state.src.charCodeAt(pos);

      if (marker !== 0x22 /* " */ && marker !== 0x27 /* ' */ && marker !== 0x28 /* ( */) { return false; }

      pos++;

      // if opening marker is "(", switch it to closing marker ")"
      if (marker === 0x28) { marker = 0x29; }

      while (pos < max) {
        code = state.src.charCodeAt(pos);
        if (code === marker) {
          state.pos = pos + 1;
          state.linkContent = unescapeMd(state.src.slice(start + 1, pos));
          return true;
        }
        if (code === 0x5C /* \ */ && pos + 1 < max) {
          pos += 2;
          continue;
        }

        pos++;
      }

      return false;
    }

    function normalizeReference(str) {
      // use .toUpperCase() instead of .toLowerCase()
      // here to avoid a conflict with Object.prototype
      // members (most notably, `__proto__`)
      return str.trim().replace(/\s+/g, ' ').toUpperCase();
    }

    function parseReference(str, parser, options, env) {
      var state, labelEnd, pos, max, code, start, href, title, label;

      if (str.charCodeAt(0) !== 0x5B/* [ */) { return -1; }

      if (str.indexOf(']:') === -1) { return -1; }

      state = new StateInline(str, parser, options, env, []);
      labelEnd = parseLinkLabel(state, 0);

      if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A/* : */) { return -1; }

      max = state.posMax;

      // [label]:   destination   'title'
      //         ^^^ skip optional whitespace here
      for (pos = labelEnd + 2; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (code !== 0x20 && code !== 0x0A) { break; }
      }

      // [label]:   destination   'title'
      //            ^^^^^^^^^^^ parse this
      if (!parseLinkDestination(state, pos)) { return -1; }
      href = state.linkContent;
      pos = state.pos;

      // [label]:   destination   'title'
      //                       ^^^ skipping those spaces
      start = pos;
      for (pos = pos + 1; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (code !== 0x20 && code !== 0x0A) { break; }
      }

      // [label]:   destination   'title'
      //                          ^^^^^^^ parse this
      if (pos < max && start !== pos && parseLinkTitle(state, pos)) {
        title = state.linkContent;
        pos = state.pos;
      } else {
        title = '';
        pos = start;
      }

      // ensure that the end of the line is empty
      while (pos < max && state.src.charCodeAt(pos) === 0x20/* space */) { pos++; }
      if (pos < max && state.src.charCodeAt(pos) !== 0x0A) { return -1; }

      label = normalizeReference(str.slice(1, labelEnd));
      if (typeof env.references[label] === 'undefined') {
        env.references[label] = { title: title, href: href };
      }

      return pos;
    }


    function references(state) {
      var tokens = state.tokens, i, l, content, pos;

      state.env.references = state.env.references || {};

      if (state.inlineMode) {
        return;
      }

      // Scan definitions in paragraph inlines
      for (i = 1, l = tokens.length - 1; i < l; i++) {
        if (tokens[i].type === 'inline' &&
            tokens[i - 1].type === 'paragraph_open' &&
            tokens[i + 1].type === 'paragraph_close') {

          content = tokens[i].content;
          while (content.length) {
            pos = parseReference(content, state.inline, state.options, state.env);
            if (pos < 0) { break; }
            content = content.slice(pos).trim();
          }

          tokens[i].content = content;
          if (!content.length) {
            tokens[i - 1].tight = true;
            tokens[i + 1].tight = true;
          }
        }
      }
    }

    function inline(state) {
      var tokens = state.tokens, tok, i, l;

      // Parse inlines
      for (i = 0, l = tokens.length; i < l; i++) {
        tok = tokens[i];
        if (tok.type === 'inline') {
          state.inline.parse(tok.content, state.options, state.env, tok.children);
        }
      }
    }

    function footnote_block(state) {
      var i, l, j, t, lastParagraph, list, tokens, current, currentLabel,
          level = 0,
          insideRef = false,
          refTokens = {};

      if (!state.env.footnotes) { return; }

      state.tokens = state.tokens.filter(function(tok) {
        if (tok.type === 'footnote_reference_open') {
          insideRef = true;
          current = [];
          currentLabel = tok.label;
          return false;
        }
        if (tok.type === 'footnote_reference_close') {
          insideRef = false;
          // prepend ':' to avoid conflict with Object.prototype members
          refTokens[':' + currentLabel] = current;
          return false;
        }
        if (insideRef) { current.push(tok); }
        return !insideRef;
      });

      if (!state.env.footnotes.list) { return; }
      list = state.env.footnotes.list;

      state.tokens.push({
        type: 'footnote_block_open',
        level: level++
      });
      for (i = 0, l = list.length; i < l; i++) {
        state.tokens.push({
          type: 'footnote_open',
          id: i,
          level: level++
        });

        if (list[i].tokens) {
          tokens = [];
          tokens.push({
            type: 'paragraph_open',
            tight: false,
            level: level++
          });
          tokens.push({
            type: 'inline',
            content: '',
            level: level,
            children: list[i].tokens
          });
          tokens.push({
            type: 'paragraph_close',
            tight: false,
            level: --level
          });
        } else if (list[i].label) {
          tokens = refTokens[':' + list[i].label];
        }

        state.tokens = state.tokens.concat(tokens);
        if (state.tokens[state.tokens.length - 1].type === 'paragraph_close') {
          lastParagraph = state.tokens.pop();
        } else {
          lastParagraph = null;
        }

        t = list[i].count > 0 ? list[i].count : 1;
        for (j = 0; j < t; j++) {
          state.tokens.push({
            type: 'footnote_anchor',
            id: i,
            subId: j,
            level: level
          });
        }

        if (lastParagraph) {
          state.tokens.push(lastParagraph);
        }

        state.tokens.push({
          type: 'footnote_close',
          level: --level
        });
      }
      state.tokens.push({
        type: 'footnote_block_close',
        level: --level
      });
    }

    // Enclose abbreviations in <abbr> tags
    //

    var PUNCT_CHARS = ' \n()[]\'".,!?-';


    // from Google closure library
    // http://closure-library.googlecode.com/git-history/docs/local_closure_goog_string_string.js.source.html#line1021
    function regEscape(s) {
      return s.replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, '\\$1');
    }


    function abbr2(state) {
      var i, j, l, tokens, token, text, nodes, pos, level, reg, m, regText,
          blockTokens = state.tokens;

      if (!state.env.abbreviations) { return; }
      if (!state.env.abbrRegExp) {
        regText = '(^|[' + PUNCT_CHARS.split('').map(regEscape).join('') + '])'
                + '(' + Object.keys(state.env.abbreviations).map(function (x) {
                          return x.substr(1);
                        }).sort(function (a, b) {
                          return b.length - a.length;
                        }).map(regEscape).join('|') + ')'
                + '($|[' + PUNCT_CHARS.split('').map(regEscape).join('') + '])';
        state.env.abbrRegExp = new RegExp(regText, 'g');
      }
      reg = state.env.abbrRegExp;

      for (j = 0, l = blockTokens.length; j < l; j++) {
        if (blockTokens[j].type !== 'inline') { continue; }
        tokens = blockTokens[j].children;

        // We scan from the end, to keep position when new tags added.
        for (i = tokens.length - 1; i >= 0; i--) {
          token = tokens[i];
          if (token.type !== 'text') { continue; }

          pos = 0;
          text = token.content;
          reg.lastIndex = 0;
          level = token.level;
          nodes = [];

          while ((m = reg.exec(text))) {
            if (reg.lastIndex > pos) {
              nodes.push({
                type: 'text',
                content: text.slice(pos, m.index + m[1].length),
                level: level
              });
            }

            nodes.push({
              type: 'abbr_open',
              title: state.env.abbreviations[':' + m[2]],
              level: level++
            });
            nodes.push({
              type: 'text',
              content: m[2],
              level: level
            });
            nodes.push({
              type: 'abbr_close',
              level: --level
            });
            pos = reg.lastIndex - m[3].length;
          }

          if (!nodes.length) { continue; }

          if (pos < text.length) {
            nodes.push({
              type: 'text',
              content: text.slice(pos),
              level: level
            });
          }

          // replace current node
          blockTokens[j].children = tokens = [].concat(tokens.slice(0, i), nodes, tokens.slice(i + 1));
        }
      }
    }

    // Simple typographical replacements
    //
    // TODO:
    // - fractionals 1/2, 1/4, 3/4 -> ½, ¼, ¾
    // - miltiplication 2 x 4 -> 2 × 4

    var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;

    var SCOPED_ABBR_RE = /\((c|tm|r|p)\)/ig;
    var SCOPED_ABBR = {
      'c': '©',
      'r': '®',
      'p': '§',
      'tm': '™'
    };

    function replaceScopedAbbr(str) {
      if (str.indexOf('(') < 0) { return str; }

      return str.replace(SCOPED_ABBR_RE, function(match, name) {
        return SCOPED_ABBR[name.toLowerCase()];
      });
    }


    function replace(state) {
      var i, token, text, inlineTokens, blkIdx;

      if (!state.options.typographer) { return; }

      for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {

        if (state.tokens[blkIdx].type !== 'inline') { continue; }

        inlineTokens = state.tokens[blkIdx].children;

        for (i = inlineTokens.length - 1; i >= 0; i--) {
          token = inlineTokens[i];
          if (token.type === 'text') {
            text = token.content;

            text = replaceScopedAbbr(text);

            if (RARE_RE.test(text)) {
              text = text
                .replace(/\+-/g, '±')
                // .., ..., ....... -> …
                // but ?..... & !..... -> ?.. & !..
                .replace(/\.{2,}/g, '…').replace(/([?!])…/g, '$1..')
                .replace(/([?!]){4,}/g, '$1$1$1').replace(/,{2,}/g, ',')
                // em-dash
                .replace(/(^|[^-])---([^-]|$)/mg, '$1\u2014$2')
                // en-dash
                .replace(/(^|\s)--(\s|$)/mg, '$1\u2013$2')
                .replace(/(^|[^-\s])--([^-\s]|$)/mg, '$1\u2013$2');
            }

            token.content = text;
          }
        }
      }
    }

    // Convert straight quotation marks to typographic ones
    //

    var QUOTE_TEST_RE = /['"]/;
    var QUOTE_RE = /['"]/g;
    var PUNCT_RE = /[-\s()\[\]]/;
    var APOSTROPHE = '’';

    // This function returns true if the character at `pos`
    // could be inside a word.
    function isLetter(str, pos) {
      if (pos < 0 || pos >= str.length) { return false; }
      return !PUNCT_RE.test(str[pos]);
    }


    function replaceAt(str, index, ch) {
      return str.substr(0, index) + ch + str.substr(index + 1);
    }


    function smartquotes(state) {
      /*eslint max-depth:0*/
      var i, token, text, t, pos, max, thisLevel, lastSpace, nextSpace, item,
          canOpen, canClose, j, isSingle, blkIdx, tokens,
          stack;

      if (!state.options.typographer) { return; }

      stack = [];

      for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {

        if (state.tokens[blkIdx].type !== 'inline') { continue; }

        tokens = state.tokens[blkIdx].children;
        stack.length = 0;

        for (i = 0; i < tokens.length; i++) {
          token = tokens[i];

          if (token.type !== 'text' || QUOTE_TEST_RE.test(token.text)) { continue; }

          thisLevel = tokens[i].level;

          for (j = stack.length - 1; j >= 0; j--) {
            if (stack[j].level <= thisLevel) { break; }
          }
          stack.length = j + 1;

          text = token.content;
          pos = 0;
          max = text.length;

          /*eslint no-labels:0,block-scoped-var:0*/
          OUTER:
          while (pos < max) {
            QUOTE_RE.lastIndex = pos;
            t = QUOTE_RE.exec(text);
            if (!t) { break; }

            lastSpace = !isLetter(text, t.index - 1);
            pos = t.index + 1;
            isSingle = (t[0] === "'");
            nextSpace = !isLetter(text, pos);

            if (!nextSpace && !lastSpace) {
              // middle of word
              if (isSingle) {
                token.content = replaceAt(token.content, t.index, APOSTROPHE);
              }
              continue;
            }

            canOpen = !nextSpace;
            canClose = !lastSpace;

            if (canClose) {
              // this could be a closing quote, rewind the stack to get a match
              for (j = stack.length - 1; j >= 0; j--) {
                item = stack[j];
                if (stack[j].level < thisLevel) { break; }
                if (item.single === isSingle && stack[j].level === thisLevel) {
                  item = stack[j];
                  if (isSingle) {
                    tokens[item.token].content = replaceAt(tokens[item.token].content, item.pos, state.options.quotes[2]);
                    token.content = replaceAt(token.content, t.index, state.options.quotes[3]);
                  } else {
                    tokens[item.token].content = replaceAt(tokens[item.token].content, item.pos, state.options.quotes[0]);
                    token.content = replaceAt(token.content, t.index, state.options.quotes[1]);
                  }
                  stack.length = j;
                  continue OUTER;
                }
              }
            }

            if (canOpen) {
              stack.push({
                token: i,
                pos: t.index,
                single: isSingle,
                level: thisLevel
              });
            } else if (canClose && isSingle) {
              token.content = replaceAt(token.content, t.index, APOSTROPHE);
            }
          }
        }
      }
    }

    /**
     * Core parser `rules`
     */

    var _rules = [
      [ 'block',          block          ],
      [ 'abbr',           abbr           ],
      [ 'references',     references     ],
      [ 'inline',         inline         ],
      [ 'footnote_tail',  footnote_block  ],
      [ 'abbr2',          abbr2          ],
      [ 'replacements',   replace   ],
      [ 'smartquotes',    smartquotes    ],
    ];

    /**
     * Class for top level (`core`) parser rules
     *
     * @api private
     */

    function Core() {
      this.options = {};
      this.ruler = new Ruler();
      for (var i = 0; i < _rules.length; i++) {
        this.ruler.push(_rules[i][0], _rules[i][1]);
      }
    }

    /**
     * Process rules with the given `state`
     *
     * @param  {Object} `state`
     * @api private
     */

    Core.prototype.process = function (state) {
      var i, l, rules;
      rules = this.ruler.getRules('');
      for (i = 0, l = rules.length; i < l; i++) {
        rules[i](state);
      }
    };

    // Parser state class

    function StateBlock(src, parser, options, env, tokens) {
      var ch, s, start, pos, len, indent, indent_found;

      this.src = src;

      // Shortcuts to simplify nested calls
      this.parser = parser;

      this.options = options;

      this.env = env;

      //
      // Internal state vartiables
      //

      this.tokens = tokens;

      this.bMarks = [];  // line begin offsets for fast jumps
      this.eMarks = [];  // line end offsets for fast jumps
      this.tShift = [];  // indent for each line

      // block parser variables
      this.blkIndent  = 0; // required block content indent
                           // (for example, if we are in list)
      this.line       = 0; // line index in src
      this.lineMax    = 0; // lines count
      this.tight      = false;  // loose/tight mode for lists
      this.parentType = 'root'; // if `list`, block parser stops on two newlines
      this.ddIndent   = -1; // indent of the current dd block (-1 if there isn't any)

      this.level = 0;

      // renderer
      this.result = '';

      // Create caches
      // Generate markers.
      s = this.src;
      indent = 0;
      indent_found = false;

      for (start = pos = indent = 0, len = s.length; pos < len; pos++) {
        ch = s.charCodeAt(pos);

        if (!indent_found) {
          if (ch === 0x20/* space */) {
            indent++;
            continue;
          } else {
            indent_found = true;
          }
        }

        if (ch === 0x0A || pos === len - 1) {
          if (ch !== 0x0A) { pos++; }
          this.bMarks.push(start);
          this.eMarks.push(pos);
          this.tShift.push(indent);

          indent_found = false;
          indent = 0;
          start = pos + 1;
        }
      }

      // Push fake entry to simplify cache bounds checks
      this.bMarks.push(s.length);
      this.eMarks.push(s.length);
      this.tShift.push(0);

      this.lineMax = this.bMarks.length - 1; // don't count last fake line
    }

    StateBlock.prototype.isEmpty = function isEmpty(line) {
      return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
    };

    StateBlock.prototype.skipEmptyLines = function skipEmptyLines(from) {
      for (var max = this.lineMax; from < max; from++) {
        if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
          break;
        }
      }
      return from;
    };

    // Skip spaces from given position.
    StateBlock.prototype.skipSpaces = function skipSpaces(pos) {
      for (var max = this.src.length; pos < max; pos++) {
        if (this.src.charCodeAt(pos) !== 0x20/* space */) { break; }
      }
      return pos;
    };

    // Skip char codes from given position
    StateBlock.prototype.skipChars = function skipChars(pos, code) {
      for (var max = this.src.length; pos < max; pos++) {
        if (this.src.charCodeAt(pos) !== code) { break; }
      }
      return pos;
    };

    // Skip char codes reverse from given position - 1
    StateBlock.prototype.skipCharsBack = function skipCharsBack(pos, code, min) {
      if (pos <= min) { return pos; }

      while (pos > min) {
        if (code !== this.src.charCodeAt(--pos)) { return pos + 1; }
      }
      return pos;
    };

    // cut lines range from source.
    StateBlock.prototype.getLines = function getLines(begin, end, indent, keepLastLF) {
      var i, first, last, queue, shift,
          line = begin;

      if (begin >= end) {
        return '';
      }

      // Opt: don't use push queue for single line;
      if (line + 1 === end) {
        first = this.bMarks[line] + Math.min(this.tShift[line], indent);
        last = keepLastLF ? this.eMarks[line] + 1 : this.eMarks[line];
        return this.src.slice(first, last);
      }

      queue = new Array(end - begin);

      for (i = 0; line < end; line++, i++) {
        shift = this.tShift[line];
        if (shift > indent) { shift = indent; }
        if (shift < 0) { shift = 0; }

        first = this.bMarks[line] + shift;

        if (line + 1 < end || keepLastLF) {
          // No need for bounds check because we have fake entry on tail.
          last = this.eMarks[line] + 1;
        } else {
          last = this.eMarks[line];
        }

        queue[i] = this.src.slice(first, last);
      }

      return queue.join('');
    };

    // Code block (4 spaces padded)

    function code(state, startLine, endLine/*, silent*/) {
      var nextLine, last;

      if (state.tShift[startLine] - state.blkIndent < 4) { return false; }

      last = nextLine = startLine + 1;

      while (nextLine < endLine) {
        if (state.isEmpty(nextLine)) {
          nextLine++;
          continue;
        }
        if (state.tShift[nextLine] - state.blkIndent >= 4) {
          nextLine++;
          last = nextLine;
          continue;
        }
        break;
      }

      state.line = nextLine;
      state.tokens.push({
        type: 'code',
        content: state.getLines(startLine, last, 4 + state.blkIndent, true),
        block: true,
        lines: [ startLine, state.line ],
        level: state.level
      });

      return true;
    }

    // fences (``` lang, ~~~ lang)

    function fences(state, startLine, endLine, silent) {
      var marker, len, params, nextLine, mem,
          haveEndMarker = false,
          pos = state.bMarks[startLine] + state.tShift[startLine],
          max = state.eMarks[startLine];

      if (pos + 3 > max) { return false; }

      marker = state.src.charCodeAt(pos);

      if (marker !== 0x7E/* ~ */ && marker !== 0x60 /* ` */) {
        return false;
      }

      // scan marker length
      mem = pos;
      pos = state.skipChars(pos, marker);

      len = pos - mem;

      if (len < 3) { return false; }

      params = state.src.slice(pos, max).trim();

      if (params.indexOf('`') >= 0) { return false; }

      // Since start is found, we can report success here in validation mode
      if (silent) { return true; }

      // search end of block
      nextLine = startLine;

      for (;;) {
        nextLine++;
        if (nextLine >= endLine) {
          // unclosed block should be autoclosed by end of document.
          // also block seems to be autoclosed by end of parent
          break;
        }

        pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
        max = state.eMarks[nextLine];

        if (pos < max && state.tShift[nextLine] < state.blkIndent) {
          // non-empty line with negative indent should stop the list:
          // - ```
          //  test
          break;
        }

        if (state.src.charCodeAt(pos) !== marker) { continue; }

        if (state.tShift[nextLine] - state.blkIndent >= 4) {
          // closing fence should be indented less than 4 spaces
          continue;
        }

        pos = state.skipChars(pos, marker);

        // closing code fence must be at least as long as the opening one
        if (pos - mem < len) { continue; }

        // make sure tail has spaces only
        pos = state.skipSpaces(pos);

        if (pos < max) { continue; }

        haveEndMarker = true;
        // found!
        break;
      }

      // If a fence has heading spaces, they should be removed from its inner block
      len = state.tShift[startLine];

      state.line = nextLine + (haveEndMarker ? 1 : 0);
      state.tokens.push({
        type: 'fence',
        params: params,
        content: state.getLines(startLine + 1, nextLine, len, true),
        lines: [ startLine, state.line ],
        level: state.level
      });

      return true;
    }

    // Block quotes

    function blockquote(state, startLine, endLine, silent) {
      var nextLine, lastLineEmpty, oldTShift, oldBMarks, oldIndent, oldParentType, lines,
          terminatorRules,
          i, l, terminate,
          pos = state.bMarks[startLine] + state.tShift[startLine],
          max = state.eMarks[startLine];

      if (pos > max) { return false; }

      // check the block quote marker
      if (state.src.charCodeAt(pos++) !== 0x3E/* > */) { return false; }

      if (state.level >= state.options.maxNesting) { return false; }

      // we know that it's going to be a valid blockquote,
      // so no point trying to find the end of it in silent mode
      if (silent) { return true; }

      // skip one optional space after '>'
      if (state.src.charCodeAt(pos) === 0x20) { pos++; }

      oldIndent = state.blkIndent;
      state.blkIndent = 0;

      oldBMarks = [ state.bMarks[startLine] ];
      state.bMarks[startLine] = pos;

      // check if we have an empty blockquote
      pos = pos < max ? state.skipSpaces(pos) : pos;
      lastLineEmpty = pos >= max;

      oldTShift = [ state.tShift[startLine] ];
      state.tShift[startLine] = pos - state.bMarks[startLine];

      terminatorRules = state.parser.ruler.getRules('blockquote');

      // Search the end of the block
      //
      // Block ends with either:
      //  1. an empty line outside:
      //     ```
      //     > test
      //
      //     ```
      //  2. an empty line inside:
      //     ```
      //     >
      //     test
      //     ```
      //  3. another tag
      //     ```
      //     > test
      //      - - -
      //     ```
      for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
        pos = state.bMarks[nextLine] + state.tShift[nextLine];
        max = state.eMarks[nextLine];

        if (pos >= max) {
          // Case 1: line is not inside the blockquote, and this line is empty.
          break;
        }

        if (state.src.charCodeAt(pos++) === 0x3E/* > */) {
          // This line is inside the blockquote.

          // skip one optional space after '>'
          if (state.src.charCodeAt(pos) === 0x20) { pos++; }

          oldBMarks.push(state.bMarks[nextLine]);
          state.bMarks[nextLine] = pos;

          pos = pos < max ? state.skipSpaces(pos) : pos;
          lastLineEmpty = pos >= max;

          oldTShift.push(state.tShift[nextLine]);
          state.tShift[nextLine] = pos - state.bMarks[nextLine];
          continue;
        }

        // Case 2: line is not inside the blockquote, and the last line was empty.
        if (lastLineEmpty) { break; }

        // Case 3: another tag found.
        terminate = false;
        for (i = 0, l = terminatorRules.length; i < l; i++) {
          if (terminatorRules[i](state, nextLine, endLine, true)) {
            terminate = true;
            break;
          }
        }
        if (terminate) { break; }

        oldBMarks.push(state.bMarks[nextLine]);
        oldTShift.push(state.tShift[nextLine]);

        // A negative number means that this is a paragraph continuation;
        //
        // Any negative number will do the job here, but it's better for it
        // to be large enough to make any bugs obvious.
        state.tShift[nextLine] = -1337;
      }

      oldParentType = state.parentType;
      state.parentType = 'blockquote';
      state.tokens.push({
        type: 'blockquote_open',
        lines: lines = [ startLine, 0 ],
        level: state.level++
      });
      state.parser.tokenize(state, startLine, nextLine);
      state.tokens.push({
        type: 'blockquote_close',
        level: --state.level
      });
      state.parentType = oldParentType;
      lines[1] = state.line;

      // Restore original tShift; this might not be necessary since the parser
      // has already been here, but just to make sure we can do that.
      for (i = 0; i < oldTShift.length; i++) {
        state.bMarks[i + startLine] = oldBMarks[i];
        state.tShift[i + startLine] = oldTShift[i];
      }
      state.blkIndent = oldIndent;

      return true;
    }

    // Horizontal rule

    function hr(state, startLine, endLine, silent) {
      var marker, cnt, ch,
          pos = state.bMarks[startLine],
          max = state.eMarks[startLine];

      pos += state.tShift[startLine];

      if (pos > max) { return false; }

      marker = state.src.charCodeAt(pos++);

      // Check hr marker
      if (marker !== 0x2A/* * */ &&
          marker !== 0x2D/* - */ &&
          marker !== 0x5F/* _ */) {
        return false;
      }

      // markers can be mixed with spaces, but there should be at least 3 one

      cnt = 1;
      while (pos < max) {
        ch = state.src.charCodeAt(pos++);
        if (ch !== marker && ch !== 0x20/* space */) { return false; }
        if (ch === marker) { cnt++; }
      }

      if (cnt < 3) { return false; }

      if (silent) { return true; }

      state.line = startLine + 1;
      state.tokens.push({
        type: 'hr',
        lines: [ startLine, state.line ],
        level: state.level
      });

      return true;
    }

    // Lists

    // Search `[-+*][\n ]`, returns next pos arter marker on success
    // or -1 on fail.
    function skipBulletListMarker(state, startLine) {
      var marker, pos, max;

      pos = state.bMarks[startLine] + state.tShift[startLine];
      max = state.eMarks[startLine];

      if (pos >= max) { return -1; }

      marker = state.src.charCodeAt(pos++);
      // Check bullet
      if (marker !== 0x2A/* * */ &&
          marker !== 0x2D/* - */ &&
          marker !== 0x2B/* + */) {
        return -1;
      }

      if (pos < max && state.src.charCodeAt(pos) !== 0x20) {
        // " 1.test " - is not a list item
        return -1;
      }

      return pos;
    }

    // Search `\d+[.)][\n ]`, returns next pos arter marker on success
    // or -1 on fail.
    function skipOrderedListMarker(state, startLine) {
      var ch,
          pos = state.bMarks[startLine] + state.tShift[startLine],
          max = state.eMarks[startLine];

      if (pos + 1 >= max) { return -1; }

      ch = state.src.charCodeAt(pos++);

      if (ch < 0x30/* 0 */ || ch > 0x39/* 9 */) { return -1; }

      for (;;) {
        // EOL -> fail
        if (pos >= max) { return -1; }

        ch = state.src.charCodeAt(pos++);

        if (ch >= 0x30/* 0 */ && ch <= 0x39/* 9 */) {
          continue;
        }

        // found valid marker
        if (ch === 0x29/* ) */ || ch === 0x2e/* . */) {
          break;
        }

        return -1;
      }


      if (pos < max && state.src.charCodeAt(pos) !== 0x20/* space */) {
        // " 1.test " - is not a list item
        return -1;
      }
      return pos;
    }

    function markTightParagraphs(state, idx) {
      var i, l,
          level = state.level + 2;

      for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
        if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
          state.tokens[i + 2].tight = true;
          state.tokens[i].tight = true;
          i += 2;
        }
      }
    }


    function list(state, startLine, endLine, silent) {
      var nextLine,
          indent,
          oldTShift,
          oldIndent,
          oldTight,
          oldParentType,
          start,
          posAfterMarker,
          max,
          indentAfterMarker,
          markerValue,
          markerCharCode,
          isOrdered,
          contentStart,
          listTokIdx,
          prevEmptyEnd,
          listLines,
          itemLines,
          tight = true,
          terminatorRules,
          i, l, terminate;

      // Detect list type and position after marker
      if ((posAfterMarker = skipOrderedListMarker(state, startLine)) >= 0) {
        isOrdered = true;
      } else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
        isOrdered = false;
      } else {
        return false;
      }

      if (state.level >= state.options.maxNesting) { return false; }

      // We should terminate list on style change. Remember first one to compare.
      markerCharCode = state.src.charCodeAt(posAfterMarker - 1);

      // For validation mode we can terminate immediately
      if (silent) { return true; }

      // Start list
      listTokIdx = state.tokens.length;

      if (isOrdered) {
        start = state.bMarks[startLine] + state.tShift[startLine];
        markerValue = Number(state.src.substr(start, posAfterMarker - start - 1));

        state.tokens.push({
          type: 'ordered_list_open',
          order: markerValue,
          lines: listLines = [ startLine, 0 ],
          level: state.level++
        });

      } else {
        state.tokens.push({
          type: 'bullet_list_open',
          lines: listLines = [ startLine, 0 ],
          level: state.level++
        });
      }

      //
      // Iterate list items
      //

      nextLine = startLine;
      prevEmptyEnd = false;
      terminatorRules = state.parser.ruler.getRules('list');

      while (nextLine < endLine) {
        contentStart = state.skipSpaces(posAfterMarker);
        max = state.eMarks[nextLine];

        if (contentStart >= max) {
          // trimming space in "-    \n  3" case, indent is 1 here
          indentAfterMarker = 1;
        } else {
          indentAfterMarker = contentStart - posAfterMarker;
        }

        // If we have more than 4 spaces, the indent is 1
        // (the rest is just indented code block)
        if (indentAfterMarker > 4) { indentAfterMarker = 1; }

        // If indent is less than 1, assume that it's one, example:
        //  "-\n  test"
        if (indentAfterMarker < 1) { indentAfterMarker = 1; }

        // "  -  test"
        //  ^^^^^ - calculating total length of this thing
        indent = (posAfterMarker - state.bMarks[nextLine]) + indentAfterMarker;

        // Run subparser & write tokens
        state.tokens.push({
          type: 'list_item_open',
          lines: itemLines = [ startLine, 0 ],
          level: state.level++
        });

        oldIndent = state.blkIndent;
        oldTight = state.tight;
        oldTShift = state.tShift[startLine];
        oldParentType = state.parentType;
        state.tShift[startLine] = contentStart - state.bMarks[startLine];
        state.blkIndent = indent;
        state.tight = true;
        state.parentType = 'list';

        state.parser.tokenize(state, startLine, endLine, true);

        // If any of list item is tight, mark list as tight
        if (!state.tight || prevEmptyEnd) {
          tight = false;
        }
        // Item become loose if finish with empty line,
        // but we should filter last element, because it means list finish
        prevEmptyEnd = (state.line - startLine) > 1 && state.isEmpty(state.line - 1);

        state.blkIndent = oldIndent;
        state.tShift[startLine] = oldTShift;
        state.tight = oldTight;
        state.parentType = oldParentType;

        state.tokens.push({
          type: 'list_item_close',
          level: --state.level
        });

        nextLine = startLine = state.line;
        itemLines[1] = nextLine;
        contentStart = state.bMarks[startLine];

        if (nextLine >= endLine) { break; }

        if (state.isEmpty(nextLine)) {
          break;
        }

        //
        // Try to check if list is terminated or continued.
        //
        if (state.tShift[nextLine] < state.blkIndent) { break; }

        // fail if terminating block found
        terminate = false;
        for (i = 0, l = terminatorRules.length; i < l; i++) {
          if (terminatorRules[i](state, nextLine, endLine, true)) {
            terminate = true;
            break;
          }
        }
        if (terminate) { break; }

        // fail if list has another type
        if (isOrdered) {
          posAfterMarker = skipOrderedListMarker(state, nextLine);
          if (posAfterMarker < 0) { break; }
        } else {
          posAfterMarker = skipBulletListMarker(state, nextLine);
          if (posAfterMarker < 0) { break; }
        }

        if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) { break; }
      }

      // Finilize list
      state.tokens.push({
        type: isOrdered ? 'ordered_list_close' : 'bullet_list_close',
        level: --state.level
      });
      listLines[1] = nextLine;

      state.line = nextLine;

      // mark paragraphs tight if needed
      if (tight) {
        markTightParagraphs(state, listTokIdx);
      }

      return true;
    }

    // Process footnote reference list

    function footnote(state, startLine, endLine, silent) {
      var oldBMark, oldTShift, oldParentType, pos, label,
          start = state.bMarks[startLine] + state.tShift[startLine],
          max = state.eMarks[startLine];

      // line should be at least 5 chars - "[^x]:"
      if (start + 4 > max) { return false; }

      if (state.src.charCodeAt(start) !== 0x5B/* [ */) { return false; }
      if (state.src.charCodeAt(start + 1) !== 0x5E/* ^ */) { return false; }
      if (state.level >= state.options.maxNesting) { return false; }

      for (pos = start + 2; pos < max; pos++) {
        if (state.src.charCodeAt(pos) === 0x20) { return false; }
        if (state.src.charCodeAt(pos) === 0x5D /* ] */) {
          break;
        }
      }

      if (pos === start + 2) { return false; } // no empty footnote labels
      if (pos + 1 >= max || state.src.charCodeAt(++pos) !== 0x3A /* : */) { return false; }
      if (silent) { return true; }
      pos++;

      if (!state.env.footnotes) { state.env.footnotes = {}; }
      if (!state.env.footnotes.refs) { state.env.footnotes.refs = {}; }
      label = state.src.slice(start + 2, pos - 2);
      state.env.footnotes.refs[':' + label] = -1;

      state.tokens.push({
        type: 'footnote_reference_open',
        label: label,
        level: state.level++
      });

      oldBMark = state.bMarks[startLine];
      oldTShift = state.tShift[startLine];
      oldParentType = state.parentType;
      state.tShift[startLine] = state.skipSpaces(pos) - pos;
      state.bMarks[startLine] = pos;
      state.blkIndent += 4;
      state.parentType = 'footnote';

      if (state.tShift[startLine] < state.blkIndent) {
        state.tShift[startLine] += state.blkIndent;
        state.bMarks[startLine] -= state.blkIndent;
      }

      state.parser.tokenize(state, startLine, endLine, true);

      state.parentType = oldParentType;
      state.blkIndent -= 4;
      state.tShift[startLine] = oldTShift;
      state.bMarks[startLine] = oldBMark;

      state.tokens.push({
        type: 'footnote_reference_close',
        level: --state.level
      });

      return true;
    }

    // heading (#, ##, ...)

    function heading(state, startLine, endLine, silent) {
      var ch, level, tmp,
          pos = state.bMarks[startLine] + state.tShift[startLine],
          max = state.eMarks[startLine];

      if (pos >= max) { return false; }

      ch  = state.src.charCodeAt(pos);

      if (ch !== 0x23/* # */ || pos >= max) { return false; }

      // count heading level
      level = 1;
      ch = state.src.charCodeAt(++pos);
      while (ch === 0x23/* # */ && pos < max && level <= 6) {
        level++;
        ch = state.src.charCodeAt(++pos);
      }

      if (level > 6 || (pos < max && ch !== 0x20/* space */)) { return false; }

      if (silent) { return true; }

      // Let's cut tails like '    ###  ' from the end of string

      max = state.skipCharsBack(max, 0x20, pos); // space
      tmp = state.skipCharsBack(max, 0x23, pos); // #
      if (tmp > pos && state.src.charCodeAt(tmp - 1) === 0x20/* space */) {
        max = tmp;
      }

      state.line = startLine + 1;

      state.tokens.push({ type: 'heading_open',
        hLevel: level,
        lines: [ startLine, state.line ],
        level: state.level
      });

      // only if header is not empty
      if (pos < max) {
        state.tokens.push({
          type: 'inline',
          content: state.src.slice(pos, max).trim(),
          level: state.level + 1,
          lines: [ startLine, state.line ],
          children: []
        });
      }
      state.tokens.push({ type: 'heading_close', hLevel: level, level: state.level });

      return true;
    }

    // lheading (---, ===)

    function lheading(state, startLine, endLine/*, silent*/) {
      var marker, pos, max,
          next = startLine + 1;

      if (next >= endLine) { return false; }
      if (state.tShift[next] < state.blkIndent) { return false; }

      // Scan next line

      if (state.tShift[next] - state.blkIndent > 3) { return false; }

      pos = state.bMarks[next] + state.tShift[next];
      max = state.eMarks[next];

      if (pos >= max) { return false; }

      marker = state.src.charCodeAt(pos);

      if (marker !== 0x2D/* - */ && marker !== 0x3D/* = */) { return false; }

      pos = state.skipChars(pos, marker);

      pos = state.skipSpaces(pos);

      if (pos < max) { return false; }

      pos = state.bMarks[startLine] + state.tShift[startLine];

      state.line = next + 1;
      state.tokens.push({
        type: 'heading_open',
        hLevel: marker === 0x3D/* = */ ? 1 : 2,
        lines: [ startLine, state.line ],
        level: state.level
      });
      state.tokens.push({
        type: 'inline',
        content: state.src.slice(pos, state.eMarks[startLine]).trim(),
        level: state.level + 1,
        lines: [ startLine, state.line - 1 ],
        children: []
      });
      state.tokens.push({
        type: 'heading_close',
        hLevel: marker === 0x3D/* = */ ? 1 : 2,
        level: state.level
      });

      return true;
    }

    // List of valid html blocks names, accorting to commonmark spec
    // http://jgm.github.io/CommonMark/spec.html#html-blocks

    var html_blocks = {};

    [
      'article',
      'aside',
      'button',
      'blockquote',
      'body',
      'canvas',
      'caption',
      'col',
      'colgroup',
      'dd',
      'div',
      'dl',
      'dt',
      'embed',
      'fieldset',
      'figcaption',
      'figure',
      'footer',
      'form',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'header',
      'hgroup',
      'hr',
      'iframe',
      'li',
      'map',
      'object',
      'ol',
      'output',
      'p',
      'pre',
      'progress',
      'script',
      'section',
      'style',
      'table',
      'tbody',
      'td',
      'textarea',
      'tfoot',
      'th',
      'tr',
      'thead',
      'ul',
      'video'
    ].forEach(function (name) { html_blocks[name] = true; });

    // HTML block


    var HTML_TAG_OPEN_RE = /^<([a-zA-Z]{1,15})[\s\/>]/;
    var HTML_TAG_CLOSE_RE = /^<\/([a-zA-Z]{1,15})[\s>]/;

    function isLetter$1(ch) {
      /*eslint no-bitwise:0*/
      var lc = ch | 0x20; // to lower case
      return (lc >= 0x61/* a */) && (lc <= 0x7a/* z */);
    }

    function htmlblock(state, startLine, endLine, silent) {
      var ch, match, nextLine,
          pos = state.bMarks[startLine],
          max = state.eMarks[startLine],
          shift = state.tShift[startLine];

      pos += shift;

      if (!state.options.html) { return false; }

      if (shift > 3 || pos + 2 >= max) { return false; }

      if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false; }

      ch = state.src.charCodeAt(pos + 1);

      if (ch === 0x21/* ! */ || ch === 0x3F/* ? */) {
        // Directive start / comment start / processing instruction start
        if (silent) { return true; }

      } else if (ch === 0x2F/* / */ || isLetter$1(ch)) {

        // Probably start or end of tag
        if (ch === 0x2F/* \ */) {
          // closing tag
          match = state.src.slice(pos, max).match(HTML_TAG_CLOSE_RE);
          if (!match) { return false; }
        } else {
          // opening tag
          match = state.src.slice(pos, max).match(HTML_TAG_OPEN_RE);
          if (!match) { return false; }
        }
        // Make sure tag name is valid
        if (html_blocks[match[1].toLowerCase()] !== true) { return false; }
        if (silent) { return true; }

      } else {
        return false;
      }

      // If we are here - we detected HTML block.
      // Let's roll down till empty line (block end).
      nextLine = startLine + 1;
      while (nextLine < state.lineMax && !state.isEmpty(nextLine)) {
        nextLine++;
      }

      state.line = nextLine;
      state.tokens.push({
        type: 'htmlblock',
        level: state.level,
        lines: [ startLine, state.line ],
        content: state.getLines(startLine, nextLine, 0, true)
      });

      return true;
    }

    // GFM table, non-standard

    function getLine(state, line) {
      var pos = state.bMarks[line] + state.blkIndent,
          max = state.eMarks[line];

      return state.src.substr(pos, max - pos);
    }

    function table(state, startLine, endLine, silent) {
      var ch, lineText, pos, i, nextLine, rows, cell,
          aligns, t, tableLines, tbodyLines;

      // should have at least three lines
      if (startLine + 2 > endLine) { return false; }

      nextLine = startLine + 1;

      if (state.tShift[nextLine] < state.blkIndent) { return false; }

      // first character of the second line should be '|' or '-'

      pos = state.bMarks[nextLine] + state.tShift[nextLine];
      if (pos >= state.eMarks[nextLine]) { return false; }

      ch = state.src.charCodeAt(pos);
      if (ch !== 0x7C/* | */ && ch !== 0x2D/* - */ && ch !== 0x3A/* : */) { return false; }

      lineText = getLine(state, startLine + 1);
      if (!/^[-:| ]+$/.test(lineText)) { return false; }

      rows = lineText.split('|');
      if (rows <= 2) { return false; }
      aligns = [];
      for (i = 0; i < rows.length; i++) {
        t = rows[i].trim();
        if (!t) {
          // allow empty columns before and after table, but not in between columns;
          // e.g. allow ` |---| `, disallow ` ---||--- `
          if (i === 0 || i === rows.length - 1) {
            continue;
          } else {
            return false;
          }
        }

        if (!/^:?-+:?$/.test(t)) { return false; }
        if (t.charCodeAt(t.length - 1) === 0x3A/* : */) {
          aligns.push(t.charCodeAt(0) === 0x3A/* : */ ? 'center' : 'right');
        } else if (t.charCodeAt(0) === 0x3A/* : */) {
          aligns.push('left');
        } else {
          aligns.push('');
        }
      }

      lineText = getLine(state, startLine).trim();
      if (lineText.indexOf('|') === -1) { return false; }
      rows = lineText.replace(/^\||\|$/g, '').split('|');
      if (aligns.length !== rows.length) { return false; }
      if (silent) { return true; }

      state.tokens.push({
        type: 'table_open',
        lines: tableLines = [ startLine, 0 ],
        level: state.level++
      });
      state.tokens.push({
        type: 'thead_open',
        lines: [ startLine, startLine + 1 ],
        level: state.level++
      });

      state.tokens.push({
        type: 'tr_open',
        lines: [ startLine, startLine + 1 ],
        level: state.level++
      });
      for (i = 0; i < rows.length; i++) {
        state.tokens.push({
          type: 'th_open',
          align: aligns[i],
          lines: [ startLine, startLine + 1 ],
          level: state.level++
        });
        state.tokens.push({
          type: 'inline',
          content: rows[i].trim(),
          lines: [ startLine, startLine + 1 ],
          level: state.level,
          children: []
        });
        state.tokens.push({ type: 'th_close', level: --state.level });
      }
      state.tokens.push({ type: 'tr_close', level: --state.level });
      state.tokens.push({ type: 'thead_close', level: --state.level });

      state.tokens.push({
        type: 'tbody_open',
        lines: tbodyLines = [ startLine + 2, 0 ],
        level: state.level++
      });

      for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
        if (state.tShift[nextLine] < state.blkIndent) { break; }

        lineText = getLine(state, nextLine).trim();
        if (lineText.indexOf('|') === -1) { break; }
        rows = lineText.replace(/^\||\|$/g, '').split('|');

        state.tokens.push({ type: 'tr_open', level: state.level++ });
        for (i = 0; i < rows.length; i++) {
          state.tokens.push({ type: 'td_open', align: aligns[i], level: state.level++ });
          // 0x7c === '|'
          cell = rows[i].substring(
              rows[i].charCodeAt(0) === 0x7c ? 1 : 0,
              rows[i].charCodeAt(rows[i].length - 1) === 0x7c ? rows[i].length - 1 : rows[i].length
          ).trim();
          state.tokens.push({
            type: 'inline',
            content: cell,
            level: state.level,
            children: []
          });
          state.tokens.push({ type: 'td_close', level: --state.level });
        }
        state.tokens.push({ type: 'tr_close', level: --state.level });
      }
      state.tokens.push({ type: 'tbody_close', level: --state.level });
      state.tokens.push({ type: 'table_close', level: --state.level });

      tableLines[1] = tbodyLines[1] = nextLine;
      state.line = nextLine;
      return true;
    }

    // Definition lists

    // Search `[:~][\n ]`, returns next pos after marker on success
    // or -1 on fail.
    function skipMarker(state, line) {
      var pos, marker,
          start = state.bMarks[line] + state.tShift[line],
          max = state.eMarks[line];

      if (start >= max) { return -1; }

      // Check bullet
      marker = state.src.charCodeAt(start++);
      if (marker !== 0x7E/* ~ */ && marker !== 0x3A/* : */) { return -1; }

      pos = state.skipSpaces(start);

      // require space after ":"
      if (start === pos) { return -1; }

      // no empty definitions, e.g. "  : "
      if (pos >= max) { return -1; }

      return pos;
    }

    function markTightParagraphs$1(state, idx) {
      var i, l,
          level = state.level + 2;

      for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
        if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
          state.tokens[i + 2].tight = true;
          state.tokens[i].tight = true;
          i += 2;
        }
      }
    }

    function deflist(state, startLine, endLine, silent) {
      var contentStart,
          ddLine,
          dtLine,
          itemLines,
          listLines,
          listTokIdx,
          nextLine,
          oldIndent,
          oldDDIndent,
          oldParentType,
          oldTShift,
          oldTight,
          prevEmptyEnd,
          tight;

      if (silent) {
        // quirk: validation mode validates a dd block only, not a whole deflist
        if (state.ddIndent < 0) { return false; }
        return skipMarker(state, startLine) >= 0;
      }

      nextLine = startLine + 1;
      if (state.isEmpty(nextLine)) {
        if (++nextLine > endLine) { return false; }
      }

      if (state.tShift[nextLine] < state.blkIndent) { return false; }
      contentStart = skipMarker(state, nextLine);
      if (contentStart < 0) { return false; }

      if (state.level >= state.options.maxNesting) { return false; }

      // Start list
      listTokIdx = state.tokens.length;

      state.tokens.push({
        type: 'dl_open',
        lines: listLines = [ startLine, 0 ],
        level: state.level++
      });

      //
      // Iterate list items
      //

      dtLine = startLine;
      ddLine = nextLine;

      // One definition list can contain multiple DTs,
      // and one DT can be followed by multiple DDs.
      //
      // Thus, there is two loops here, and label is
      // needed to break out of the second one
      //
      /*eslint no-labels:0,block-scoped-var:0*/
      OUTER:
      for (;;) {
        tight = true;
        prevEmptyEnd = false;

        state.tokens.push({
          type: 'dt_open',
          lines: [ dtLine, dtLine ],
          level: state.level++
        });
        state.tokens.push({
          type: 'inline',
          content: state.getLines(dtLine, dtLine + 1, state.blkIndent, false).trim(),
          level: state.level + 1,
          lines: [ dtLine, dtLine ],
          children: []
        });
        state.tokens.push({
          type: 'dt_close',
          level: --state.level
        });

        for (;;) {
          state.tokens.push({
            type: 'dd_open',
            lines: itemLines = [ nextLine, 0 ],
            level: state.level++
          });

          oldTight = state.tight;
          oldDDIndent = state.ddIndent;
          oldIndent = state.blkIndent;
          oldTShift = state.tShift[ddLine];
          oldParentType = state.parentType;
          state.blkIndent = state.ddIndent = state.tShift[ddLine] + 2;
          state.tShift[ddLine] = contentStart - state.bMarks[ddLine];
          state.tight = true;
          state.parentType = 'deflist';

          state.parser.tokenize(state, ddLine, endLine, true);

          // If any of list item is tight, mark list as tight
          if (!state.tight || prevEmptyEnd) {
            tight = false;
          }
          // Item become loose if finish with empty line,
          // but we should filter last element, because it means list finish
          prevEmptyEnd = (state.line - ddLine) > 1 && state.isEmpty(state.line - 1);

          state.tShift[ddLine] = oldTShift;
          state.tight = oldTight;
          state.parentType = oldParentType;
          state.blkIndent = oldIndent;
          state.ddIndent = oldDDIndent;

          state.tokens.push({
            type: 'dd_close',
            level: --state.level
          });

          itemLines[1] = nextLine = state.line;

          if (nextLine >= endLine) { break OUTER; }

          if (state.tShift[nextLine] < state.blkIndent) { break OUTER; }
          contentStart = skipMarker(state, nextLine);
          if (contentStart < 0) { break; }

          ddLine = nextLine;

          // go to the next loop iteration:
          // insert DD tag and repeat checking
        }

        if (nextLine >= endLine) { break; }
        dtLine = nextLine;

        if (state.isEmpty(dtLine)) { break; }
        if (state.tShift[dtLine] < state.blkIndent) { break; }

        ddLine = dtLine + 1;
        if (ddLine >= endLine) { break; }
        if (state.isEmpty(ddLine)) { ddLine++; }
        if (ddLine >= endLine) { break; }

        if (state.tShift[ddLine] < state.blkIndent) { break; }
        contentStart = skipMarker(state, ddLine);
        if (contentStart < 0) { break; }

        // go to the next loop iteration:
        // insert DT and DD tags and repeat checking
      }

      // Finilize list
      state.tokens.push({
        type: 'dl_close',
        level: --state.level
      });
      listLines[1] = nextLine;

      state.line = nextLine;

      // mark paragraphs tight if needed
      if (tight) {
        markTightParagraphs$1(state, listTokIdx);
      }

      return true;
    }

    // Paragraph

    function paragraph(state, startLine/*, endLine*/) {
      var endLine, content, terminate, i, l,
          nextLine = startLine + 1,
          terminatorRules;

      endLine = state.lineMax;

      // jump line-by-line until empty one or EOF
      if (nextLine < endLine && !state.isEmpty(nextLine)) {
        terminatorRules = state.parser.ruler.getRules('paragraph');

        for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
          // this would be a code block normally, but after paragraph
          // it's considered a lazy continuation regardless of what's there
          if (state.tShift[nextLine] - state.blkIndent > 3) { continue; }

          // Some tags can terminate paragraph without empty line.
          terminate = false;
          for (i = 0, l = terminatorRules.length; i < l; i++) {
            if (terminatorRules[i](state, nextLine, endLine, true)) {
              terminate = true;
              break;
            }
          }
          if (terminate) { break; }
        }
      }

      content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();

      state.line = nextLine;
      if (content.length) {
        state.tokens.push({
          type: 'paragraph_open',
          tight: false,
          lines: [ startLine, state.line ],
          level: state.level
        });
        state.tokens.push({
          type: 'inline',
          content: content,
          level: state.level + 1,
          lines: [ startLine, state.line ],
          children: []
        });
        state.tokens.push({
          type: 'paragraph_close',
          tight: false,
          level: state.level
        });
      }

      return true;
    }

    /**
     * Parser rules
     */

    var _rules$1 = [
      [ 'code',       code ],
      [ 'fences',     fences,     [ 'paragraph', 'blockquote', 'list' ] ],
      [ 'blockquote', blockquote, [ 'paragraph', 'blockquote', 'list' ] ],
      [ 'hr',         hr,         [ 'paragraph', 'blockquote', 'list' ] ],
      [ 'list',       list,       [ 'paragraph', 'blockquote' ] ],
      [ 'footnote',   footnote,   [ 'paragraph' ] ],
      [ 'heading',    heading,    [ 'paragraph', 'blockquote' ] ],
      [ 'lheading',   lheading ],
      [ 'htmlblock',  htmlblock,  [ 'paragraph', 'blockquote' ] ],
      [ 'table',      table,      [ 'paragraph' ] ],
      [ 'deflist',    deflist,    [ 'paragraph' ] ],
      [ 'paragraph',  paragraph ]
    ];

    /**
     * Block Parser class
     *
     * @api private
     */

    function ParserBlock() {
      this.ruler = new Ruler();
      for (var i = 0; i < _rules$1.length; i++) {
        this.ruler.push(_rules$1[i][0], _rules$1[i][1], {
          alt: (_rules$1[i][2] || []).slice()
        });
      }
    }

    /**
     * Generate tokens for the given input range.
     *
     * @param  {Object} `state` Has properties like `src`, `parser`, `options` etc
     * @param  {Number} `startLine`
     * @param  {Number} `endLine`
     * @api private
     */

    ParserBlock.prototype.tokenize = function (state, startLine, endLine) {
      var rules = this.ruler.getRules('');
      var len = rules.length;
      var line = startLine;
      var hasEmptyLines = false;
      var ok, i;

      while (line < endLine) {
        state.line = line = state.skipEmptyLines(line);
        if (line >= endLine) {
          break;
        }

        // Termination condition for nested calls.
        // Nested calls currently used for blockquotes & lists
        if (state.tShift[line] < state.blkIndent) {
          break;
        }

        // Try all possible rules.
        // On success, rule should:
        //
        // - update `state.line`
        // - update `state.tokens`
        // - return true

        for (i = 0; i < len; i++) {
          ok = rules[i](state, line, endLine, false);
          if (ok) {
            break;
          }
        }

        // set state.tight iff we had an empty line before current tag
        // i.e. latest empty line should not count
        state.tight = !hasEmptyLines;

        // paragraph might "eat" one newline after it in nested lists
        if (state.isEmpty(state.line - 1)) {
          hasEmptyLines = true;
        }

        line = state.line;

        if (line < endLine && state.isEmpty(line)) {
          hasEmptyLines = true;
          line++;

          // two empty lines should stop the parser in list mode
          if (line < endLine && state.parentType === 'list' && state.isEmpty(line)) { break; }
          state.line = line;
        }
      }
    };

    var TABS_SCAN_RE = /[\n\t]/g;
    var NEWLINES_RE  = /\r[\n\u0085]|[\u2424\u2028\u0085]/g;
    var SPACES_RE    = /\u00a0/g;

    /**
     * Tokenize the given `str`.
     *
     * @param  {String} `str` Source string
     * @param  {Object} `options`
     * @param  {Object} `env`
     * @param  {Array} `outTokens`
     * @api private
     */

    ParserBlock.prototype.parse = function (str, options, env, outTokens) {
      var state, lineStart = 0, lastTabPos = 0;
      if (!str) { return []; }

      // Normalize spaces
      str = str.replace(SPACES_RE, ' ');

      // Normalize newlines
      str = str.replace(NEWLINES_RE, '\n');

      // Replace tabs with proper number of spaces (1..4)
      if (str.indexOf('\t') >= 0) {
        str = str.replace(TABS_SCAN_RE, function (match, offset) {
          var result;
          if (str.charCodeAt(offset) === 0x0A) {
            lineStart = offset + 1;
            lastTabPos = 0;
            return match;
          }
          result = '    '.slice((offset - lineStart - lastTabPos) % 4);
          lastTabPos = offset - lineStart + 1;
          return result;
        });
      }

      state = new StateBlock(str, this, options, env, outTokens);
      this.tokenize(state, state.line, state.lineMax);
    };

    // Skip text characters for text token, place those to pending buffer
    // and increment current pos

    // Rule to skip pure text
    // '{}$%@~+=:' reserved for extentions

    function isTerminatorChar(ch) {
      switch (ch) {
        case 0x0A/* \n */:
        case 0x5C/* \ */:
        case 0x60/* ` */:
        case 0x2A/* * */:
        case 0x5F/* _ */:
        case 0x5E/* ^ */:
        case 0x5B/* [ */:
        case 0x5D/* ] */:
        case 0x21/* ! */:
        case 0x26/* & */:
        case 0x3C/* < */:
        case 0x3E/* > */:
        case 0x7B/* { */:
        case 0x7D/* } */:
        case 0x24/* $ */:
        case 0x25/* % */:
        case 0x40/* @ */:
        case 0x7E/* ~ */:
        case 0x2B/* + */:
        case 0x3D/* = */:
        case 0x3A/* : */:
          return true;
        default:
          return false;
      }
    }

    function text$1(state, silent) {
      var pos = state.pos;

      while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
        pos++;
      }

      if (pos === state.pos) { return false; }

      if (!silent) { state.pending += state.src.slice(state.pos, pos); }

      state.pos = pos;

      return true;
    }

    // Proceess '\n'

    function newline(state, silent) {
      var pmax, max, pos = state.pos;

      if (state.src.charCodeAt(pos) !== 0x0A/* \n */) { return false; }

      pmax = state.pending.length - 1;
      max = state.posMax;

      // '  \n' -> hardbreak
      // Lookup in pending chars is bad practice! Don't copy to other rules!
      // Pending string is stored in concat mode, indexed lookups will cause
      // convertion to flat mode.
      if (!silent) {
        if (pmax >= 0 && state.pending.charCodeAt(pmax) === 0x20) {
          if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 0x20) {
            // Strip out all trailing spaces on this line.
            for (var i = pmax - 2; i >= 0; i--) {
              if (state.pending.charCodeAt(i) !== 0x20) {
                state.pending = state.pending.substring(0, i + 1);
                break;
              }
            }
            state.push({
              type: 'hardbreak',
              level: state.level
            });
          } else {
            state.pending = state.pending.slice(0, -1);
            state.push({
              type: 'softbreak',
              level: state.level
            });
          }

        } else {
          state.push({
            type: 'softbreak',
            level: state.level
          });
        }
      }

      pos++;

      // skip heading spaces for next line
      while (pos < max && state.src.charCodeAt(pos) === 0x20) { pos++; }

      state.pos = pos;
      return true;
    }

    // Proceess escaped chars and hardbreaks

    var ESCAPED = [];

    for (var i = 0; i < 256; i++) { ESCAPED.push(0); }

    '\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'
      .split('').forEach(function(ch) { ESCAPED[ch.charCodeAt(0)] = 1; });


    function escape(state, silent) {
      var ch, pos = state.pos, max = state.posMax;

      if (state.src.charCodeAt(pos) !== 0x5C/* \ */) { return false; }

      pos++;

      if (pos < max) {
        ch = state.src.charCodeAt(pos);

        if (ch < 256 && ESCAPED[ch] !== 0) {
          if (!silent) { state.pending += state.src[pos]; }
          state.pos += 2;
          return true;
        }

        if (ch === 0x0A) {
          if (!silent) {
            state.push({
              type: 'hardbreak',
              level: state.level
            });
          }

          pos++;
          // skip leading whitespaces from next line
          while (pos < max && state.src.charCodeAt(pos) === 0x20) { pos++; }

          state.pos = pos;
          return true;
        }
      }

      if (!silent) { state.pending += '\\'; }
      state.pos++;
      return true;
    }

    // Parse backticks

    function backticks(state, silent) {
      var start, max, marker, matchStart, matchEnd,
          pos = state.pos,
          ch = state.src.charCodeAt(pos);

      if (ch !== 0x60/* ` */) { return false; }

      start = pos;
      pos++;
      max = state.posMax;

      while (pos < max && state.src.charCodeAt(pos) === 0x60/* ` */) { pos++; }

      marker = state.src.slice(start, pos);

      matchStart = matchEnd = pos;

      while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
        matchEnd = matchStart + 1;

        while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60/* ` */) { matchEnd++; }

        if (matchEnd - matchStart === marker.length) {
          if (!silent) {
            state.push({
              type: 'code',
              content: state.src.slice(pos, matchStart)
                                  .replace(/[ \n]+/g, ' ')
                                  .trim(),
              block: false,
              level: state.level
            });
          }
          state.pos = matchEnd;
          return true;
        }
      }

      if (!silent) { state.pending += marker; }
      state.pos += marker.length;
      return true;
    }

    // Process ~~deleted text~~

    function del(state, silent) {
      var found,
          pos,
          stack,
          max = state.posMax,
          start = state.pos,
          lastChar,
          nextChar;

      if (state.src.charCodeAt(start) !== 0x7E/* ~ */) { return false; }
      if (silent) { return false; } // don't run any pairs in validation mode
      if (start + 4 >= max) { return false; }
      if (state.src.charCodeAt(start + 1) !== 0x7E/* ~ */) { return false; }
      if (state.level >= state.options.maxNesting) { return false; }

      lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
      nextChar = state.src.charCodeAt(start + 2);

      if (lastChar === 0x7E/* ~ */) { return false; }
      if (nextChar === 0x7E/* ~ */) { return false; }
      if (nextChar === 0x20 || nextChar === 0x0A) { return false; }

      pos = start + 2;
      while (pos < max && state.src.charCodeAt(pos) === 0x7E/* ~ */) { pos++; }
      if (pos > start + 3) {
        // sequence of 4+ markers taking as literal, same as in a emphasis
        state.pos += pos - start;
        if (!silent) { state.pending += state.src.slice(start, pos); }
        return true;
      }

      state.pos = start + 2;
      stack = 1;

      while (state.pos + 1 < max) {
        if (state.src.charCodeAt(state.pos) === 0x7E/* ~ */) {
          if (state.src.charCodeAt(state.pos + 1) === 0x7E/* ~ */) {
            lastChar = state.src.charCodeAt(state.pos - 1);
            nextChar = state.pos + 2 < max ? state.src.charCodeAt(state.pos + 2) : -1;
            if (nextChar !== 0x7E/* ~ */ && lastChar !== 0x7E/* ~ */) {
              if (lastChar !== 0x20 && lastChar !== 0x0A) {
                // closing '~~'
                stack--;
              } else if (nextChar !== 0x20 && nextChar !== 0x0A) {
                // opening '~~'
                stack++;
              } // else {
                //  // standalone ' ~~ ' indented with spaces
                // }
              if (stack <= 0) {
                found = true;
                break;
              }
            }
          }
        }

        state.parser.skipToken(state);
      }

      if (!found) {
        // parser failed to find ending tag, so it's not valid emphasis
        state.pos = start;
        return false;
      }

      // found!
      state.posMax = state.pos;
      state.pos = start + 2;

      if (!silent) {
        state.push({ type: 'del_open', level: state.level++ });
        state.parser.tokenize(state);
        state.push({ type: 'del_close', level: --state.level });
      }

      state.pos = state.posMax + 2;
      state.posMax = max;
      return true;
    }

    // Process ++inserted text++

    function ins(state, silent) {
      var found,
          pos,
          stack,
          max = state.posMax,
          start = state.pos,
          lastChar,
          nextChar;

      if (state.src.charCodeAt(start) !== 0x2B/* + */) { return false; }
      if (silent) { return false; } // don't run any pairs in validation mode
      if (start + 4 >= max) { return false; }
      if (state.src.charCodeAt(start + 1) !== 0x2B/* + */) { return false; }
      if (state.level >= state.options.maxNesting) { return false; }

      lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
      nextChar = state.src.charCodeAt(start + 2);

      if (lastChar === 0x2B/* + */) { return false; }
      if (nextChar === 0x2B/* + */) { return false; }
      if (nextChar === 0x20 || nextChar === 0x0A) { return false; }

      pos = start + 2;
      while (pos < max && state.src.charCodeAt(pos) === 0x2B/* + */) { pos++; }
      if (pos !== start + 2) {
        // sequence of 3+ markers taking as literal, same as in a emphasis
        state.pos += pos - start;
        if (!silent) { state.pending += state.src.slice(start, pos); }
        return true;
      }

      state.pos = start + 2;
      stack = 1;

      while (state.pos + 1 < max) {
        if (state.src.charCodeAt(state.pos) === 0x2B/* + */) {
          if (state.src.charCodeAt(state.pos + 1) === 0x2B/* + */) {
            lastChar = state.src.charCodeAt(state.pos - 1);
            nextChar = state.pos + 2 < max ? state.src.charCodeAt(state.pos + 2) : -1;
            if (nextChar !== 0x2B/* + */ && lastChar !== 0x2B/* + */) {
              if (lastChar !== 0x20 && lastChar !== 0x0A) {
                // closing '++'
                stack--;
              } else if (nextChar !== 0x20 && nextChar !== 0x0A) {
                // opening '++'
                stack++;
              } // else {
                //  // standalone ' ++ ' indented with spaces
                // }
              if (stack <= 0) {
                found = true;
                break;
              }
            }
          }
        }

        state.parser.skipToken(state);
      }

      if (!found) {
        // parser failed to find ending tag, so it's not valid emphasis
        state.pos = start;
        return false;
      }

      // found!
      state.posMax = state.pos;
      state.pos = start + 2;

      if (!silent) {
        state.push({ type: 'ins_open', level: state.level++ });
        state.parser.tokenize(state);
        state.push({ type: 'ins_close', level: --state.level });
      }

      state.pos = state.posMax + 2;
      state.posMax = max;
      return true;
    }

    // Process ==highlighted text==

    function mark(state, silent) {
      var found,
          pos,
          stack,
          max = state.posMax,
          start = state.pos,
          lastChar,
          nextChar;

      if (state.src.charCodeAt(start) !== 0x3D/* = */) { return false; }
      if (silent) { return false; } // don't run any pairs in validation mode
      if (start + 4 >= max) { return false; }
      if (state.src.charCodeAt(start + 1) !== 0x3D/* = */) { return false; }
      if (state.level >= state.options.maxNesting) { return false; }

      lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
      nextChar = state.src.charCodeAt(start + 2);

      if (lastChar === 0x3D/* = */) { return false; }
      if (nextChar === 0x3D/* = */) { return false; }
      if (nextChar === 0x20 || nextChar === 0x0A) { return false; }

      pos = start + 2;
      while (pos < max && state.src.charCodeAt(pos) === 0x3D/* = */) { pos++; }
      if (pos !== start + 2) {
        // sequence of 3+ markers taking as literal, same as in a emphasis
        state.pos += pos - start;
        if (!silent) { state.pending += state.src.slice(start, pos); }
        return true;
      }

      state.pos = start + 2;
      stack = 1;

      while (state.pos + 1 < max) {
        if (state.src.charCodeAt(state.pos) === 0x3D/* = */) {
          if (state.src.charCodeAt(state.pos + 1) === 0x3D/* = */) {
            lastChar = state.src.charCodeAt(state.pos - 1);
            nextChar = state.pos + 2 < max ? state.src.charCodeAt(state.pos + 2) : -1;
            if (nextChar !== 0x3D/* = */ && lastChar !== 0x3D/* = */) {
              if (lastChar !== 0x20 && lastChar !== 0x0A) {
                // closing '=='
                stack--;
              } else if (nextChar !== 0x20 && nextChar !== 0x0A) {
                // opening '=='
                stack++;
              } // else {
                //  // standalone ' == ' indented with spaces
                // }
              if (stack <= 0) {
                found = true;
                break;
              }
            }
          }
        }

        state.parser.skipToken(state);
      }

      if (!found) {
        // parser failed to find ending tag, so it's not valid emphasis
        state.pos = start;
        return false;
      }

      // found!
      state.posMax = state.pos;
      state.pos = start + 2;

      if (!silent) {
        state.push({ type: 'mark_open', level: state.level++ });
        state.parser.tokenize(state);
        state.push({ type: 'mark_close', level: --state.level });
      }

      state.pos = state.posMax + 2;
      state.posMax = max;
      return true;
    }

    // Process *this* and _that_

    function isAlphaNum(code) {
      return (code >= 0x30 /* 0 */ && code <= 0x39 /* 9 */) ||
             (code >= 0x41 /* A */ && code <= 0x5A /* Z */) ||
             (code >= 0x61 /* a */ && code <= 0x7A /* z */);
    }

    // parse sequence of emphasis markers,
    // "start" should point at a valid marker
    function scanDelims(state, start) {
      var pos = start, lastChar, nextChar, count,
          can_open = true,
          can_close = true,
          max = state.posMax,
          marker = state.src.charCodeAt(start);

      lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;

      while (pos < max && state.src.charCodeAt(pos) === marker) { pos++; }
      if (pos >= max) { can_open = false; }
      count = pos - start;

      if (count >= 4) {
        // sequence of four or more unescaped markers can't start/end an emphasis
        can_open = can_close = false;
      } else {
        nextChar = pos < max ? state.src.charCodeAt(pos) : -1;

        // check whitespace conditions
        if (nextChar === 0x20 || nextChar === 0x0A) { can_open = false; }
        if (lastChar === 0x20 || lastChar === 0x0A) { can_close = false; }

        if (marker === 0x5F /* _ */) {
          // check if we aren't inside the word
          if (isAlphaNum(lastChar)) { can_open = false; }
          if (isAlphaNum(nextChar)) { can_close = false; }
        }
      }

      return {
        can_open: can_open,
        can_close: can_close,
        delims: count
      };
    }

    function emphasis(state, silent) {
      var startCount,
          count,
          found,
          oldCount,
          newCount,
          stack,
          res,
          max = state.posMax,
          start = state.pos,
          marker = state.src.charCodeAt(start);

      if (marker !== 0x5F/* _ */ && marker !== 0x2A /* * */) { return false; }
      if (silent) { return false; } // don't run any pairs in validation mode

      res = scanDelims(state, start);
      startCount = res.delims;
      if (!res.can_open) {
        state.pos += startCount;
        if (!silent) { state.pending += state.src.slice(start, state.pos); }
        return true;
      }

      if (state.level >= state.options.maxNesting) { return false; }

      state.pos = start + startCount;
      stack = [ startCount ];

      while (state.pos < max) {
        if (state.src.charCodeAt(state.pos) === marker) {
          res = scanDelims(state, state.pos);
          count = res.delims;
          if (res.can_close) {
            oldCount = stack.pop();
            newCount = count;

            while (oldCount !== newCount) {
              if (newCount < oldCount) {
                stack.push(oldCount - newCount);
                break;
              }

              // assert(newCount > oldCount)
              newCount -= oldCount;

              if (stack.length === 0) { break; }
              state.pos += oldCount;
              oldCount = stack.pop();
            }

            if (stack.length === 0) {
              startCount = oldCount;
              found = true;
              break;
            }
            state.pos += count;
            continue;
          }

          if (res.can_open) { stack.push(count); }
          state.pos += count;
          continue;
        }

        state.parser.skipToken(state);
      }

      if (!found) {
        // parser failed to find ending tag, so it's not valid emphasis
        state.pos = start;
        return false;
      }

      // found!
      state.posMax = state.pos;
      state.pos = start + startCount;

      if (!silent) {
        if (startCount === 2 || startCount === 3) {
          state.push({ type: 'strong_open', level: state.level++ });
        }
        if (startCount === 1 || startCount === 3) {
          state.push({ type: 'em_open', level: state.level++ });
        }

        state.parser.tokenize(state);

        if (startCount === 1 || startCount === 3) {
          state.push({ type: 'em_close', level: --state.level });
        }
        if (startCount === 2 || startCount === 3) {
          state.push({ type: 'strong_close', level: --state.level });
        }
      }

      state.pos = state.posMax + startCount;
      state.posMax = max;
      return true;
    }

    // Process ~subscript~

    // same as UNESCAPE_MD_RE plus a space
    var UNESCAPE_RE = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;

    function sub(state, silent) {
      var found,
          content,
          max = state.posMax,
          start = state.pos;

      if (state.src.charCodeAt(start) !== 0x7E/* ~ */) { return false; }
      if (silent) { return false; } // don't run any pairs in validation mode
      if (start + 2 >= max) { return false; }
      if (state.level >= state.options.maxNesting) { return false; }

      state.pos = start + 1;

      while (state.pos < max) {
        if (state.src.charCodeAt(state.pos) === 0x7E/* ~ */) {
          found = true;
          break;
        }

        state.parser.skipToken(state);
      }

      if (!found || start + 1 === state.pos) {
        state.pos = start;
        return false;
      }

      content = state.src.slice(start + 1, state.pos);

      // don't allow unescaped spaces/newlines inside
      if (content.match(/(^|[^\\])(\\\\)*\s/)) {
        state.pos = start;
        return false;
      }

      // found!
      state.posMax = state.pos;
      state.pos = start + 1;

      if (!silent) {
        state.push({
          type: 'sub',
          level: state.level,
          content: content.replace(UNESCAPE_RE, '$1')
        });
      }

      state.pos = state.posMax + 1;
      state.posMax = max;
      return true;
    }

    // Process ^superscript^

    // same as UNESCAPE_MD_RE plus a space
    var UNESCAPE_RE$1 = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;

    function sup(state, silent) {
      var found,
          content,
          max = state.posMax,
          start = state.pos;

      if (state.src.charCodeAt(start) !== 0x5E/* ^ */) { return false; }
      if (silent) { return false; } // don't run any pairs in validation mode
      if (start + 2 >= max) { return false; }
      if (state.level >= state.options.maxNesting) { return false; }

      state.pos = start + 1;

      while (state.pos < max) {
        if (state.src.charCodeAt(state.pos) === 0x5E/* ^ */) {
          found = true;
          break;
        }

        state.parser.skipToken(state);
      }

      if (!found || start + 1 === state.pos) {
        state.pos = start;
        return false;
      }

      content = state.src.slice(start + 1, state.pos);

      // don't allow unescaped spaces/newlines inside
      if (content.match(/(^|[^\\])(\\\\)*\s/)) {
        state.pos = start;
        return false;
      }

      // found!
      state.posMax = state.pos;
      state.pos = start + 1;

      if (!silent) {
        state.push({
          type: 'sup',
          level: state.level,
          content: content.replace(UNESCAPE_RE$1, '$1')
        });
      }

      state.pos = state.posMax + 1;
      state.posMax = max;
      return true;
    }

    // Process [links](<to> "stuff")


    function links(state, silent) {
      var labelStart,
          labelEnd,
          label,
          href,
          title,
          pos,
          ref,
          code,
          isImage = false,
          oldPos = state.pos,
          max = state.posMax,
          start = state.pos,
          marker = state.src.charCodeAt(start);

      if (marker === 0x21/* ! */) {
        isImage = true;
        marker = state.src.charCodeAt(++start);
      }

      if (marker !== 0x5B/* [ */) { return false; }
      if (state.level >= state.options.maxNesting) { return false; }

      labelStart = start + 1;
      labelEnd = parseLinkLabel(state, start);

      // parser failed to find ']', so it's not a valid link
      if (labelEnd < 0) { return false; }

      pos = labelEnd + 1;
      if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
        //
        // Inline link
        //

        // [link](  <href>  "title"  )
        //        ^^ skipping these spaces
        pos++;
        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);
          if (code !== 0x20 && code !== 0x0A) { break; }
        }
        if (pos >= max) { return false; }

        // [link](  <href>  "title"  )
        //          ^^^^^^ parsing link destination
        start = pos;
        if (parseLinkDestination(state, pos)) {
          href = state.linkContent;
          pos = state.pos;
        } else {
          href = '';
        }

        // [link](  <href>  "title"  )
        //                ^^ skipping these spaces
        start = pos;
        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);
          if (code !== 0x20 && code !== 0x0A) { break; }
        }

        // [link](  <href>  "title"  )
        //                  ^^^^^^^ parsing link title
        if (pos < max && start !== pos && parseLinkTitle(state, pos)) {
          title = state.linkContent;
          pos = state.pos;

          // [link](  <href>  "title"  )
          //                         ^^ skipping these spaces
          for (; pos < max; pos++) {
            code = state.src.charCodeAt(pos);
            if (code !== 0x20 && code !== 0x0A) { break; }
          }
        } else {
          title = '';
        }

        if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
          state.pos = oldPos;
          return false;
        }
        pos++;
      } else {
        //
        // Link reference
        //

        // do not allow nested reference links
        if (state.linkLevel > 0) { return false; }

        // [foo]  [bar]
        //      ^^ optional whitespace (can include newlines)
        for (; pos < max; pos++) {
          code = state.src.charCodeAt(pos);
          if (code !== 0x20 && code !== 0x0A) { break; }
        }

        if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
          start = pos + 1;
          pos = parseLinkLabel(state, pos);
          if (pos >= 0) {
            label = state.src.slice(start, pos++);
          } else {
            pos = start - 1;
          }
        }

        // covers label === '' and label === undefined
        // (collapsed reference link and shortcut reference link respectively)
        if (!label) {
          if (typeof label === 'undefined') {
            pos = labelEnd + 1;
          }
          label = state.src.slice(labelStart, labelEnd);
        }

        ref = state.env.references[normalizeReference(label)];
        if (!ref) {
          state.pos = oldPos;
          return false;
        }
        href = ref.href;
        title = ref.title;
      }

      //
      // We found the end of the link, and know for a fact it's a valid link;
      // so all that's left to do is to call tokenizer.
      //
      if (!silent) {
        state.pos = labelStart;
        state.posMax = labelEnd;

        if (isImage) {
          state.push({
            type: 'image',
            src: href,
            title: title,
            alt: state.src.substr(labelStart, labelEnd - labelStart),
            level: state.level
          });
        } else {
          state.push({
            type: 'link_open',
            href: href,
            title: title,
            level: state.level++
          });
          state.linkLevel++;
          state.parser.tokenize(state);
          state.linkLevel--;
          state.push({ type: 'link_close', level: --state.level });
        }
      }

      state.pos = pos;
      state.posMax = max;
      return true;
    }

    // Process inline footnotes (^[...])


    function footnote_inline(state, silent) {
      var labelStart,
          labelEnd,
          footnoteId,
          oldLength,
          max = state.posMax,
          start = state.pos;

      if (start + 2 >= max) { return false; }
      if (state.src.charCodeAt(start) !== 0x5E/* ^ */) { return false; }
      if (state.src.charCodeAt(start + 1) !== 0x5B/* [ */) { return false; }
      if (state.level >= state.options.maxNesting) { return false; }

      labelStart = start + 2;
      labelEnd = parseLinkLabel(state, start + 1);

      // parser failed to find ']', so it's not a valid note
      if (labelEnd < 0) { return false; }

      // We found the end of the link, and know for a fact it's a valid link;
      // so all that's left to do is to call tokenizer.
      //
      if (!silent) {
        if (!state.env.footnotes) { state.env.footnotes = {}; }
        if (!state.env.footnotes.list) { state.env.footnotes.list = []; }
        footnoteId = state.env.footnotes.list.length;

        state.pos = labelStart;
        state.posMax = labelEnd;

        state.push({
          type: 'footnote_ref',
          id: footnoteId,
          level: state.level
        });
        state.linkLevel++;
        oldLength = state.tokens.length;
        state.parser.tokenize(state);
        state.env.footnotes.list[footnoteId] = { tokens: state.tokens.splice(oldLength) };
        state.linkLevel--;
      }

      state.pos = labelEnd + 1;
      state.posMax = max;
      return true;
    }

    // Process footnote references ([^...])

    function footnote_ref(state, silent) {
      var label,
          pos,
          footnoteId,
          footnoteSubId,
          max = state.posMax,
          start = state.pos;

      // should be at least 4 chars - "[^x]"
      if (start + 3 > max) { return false; }

      if (!state.env.footnotes || !state.env.footnotes.refs) { return false; }
      if (state.src.charCodeAt(start) !== 0x5B/* [ */) { return false; }
      if (state.src.charCodeAt(start + 1) !== 0x5E/* ^ */) { return false; }
      if (state.level >= state.options.maxNesting) { return false; }

      for (pos = start + 2; pos < max; pos++) {
        if (state.src.charCodeAt(pos) === 0x20) { return false; }
        if (state.src.charCodeAt(pos) === 0x0A) { return false; }
        if (state.src.charCodeAt(pos) === 0x5D /* ] */) {
          break;
        }
      }

      if (pos === start + 2) { return false; } // no empty footnote labels
      if (pos >= max) { return false; }
      pos++;

      label = state.src.slice(start + 2, pos - 1);
      if (typeof state.env.footnotes.refs[':' + label] === 'undefined') { return false; }

      if (!silent) {
        if (!state.env.footnotes.list) { state.env.footnotes.list = []; }

        if (state.env.footnotes.refs[':' + label] < 0) {
          footnoteId = state.env.footnotes.list.length;
          state.env.footnotes.list[footnoteId] = { label: label, count: 0 };
          state.env.footnotes.refs[':' + label] = footnoteId;
        } else {
          footnoteId = state.env.footnotes.refs[':' + label];
        }

        footnoteSubId = state.env.footnotes.list[footnoteId].count;
        state.env.footnotes.list[footnoteId].count++;

        state.push({
          type: 'footnote_ref',
          id: footnoteId,
          subId: footnoteSubId,
          level: state.level
        });
      }

      state.pos = pos;
      state.posMax = max;
      return true;
    }

    // List of valid url schemas, accorting to commonmark spec
    // http://jgm.github.io/CommonMark/spec.html#autolinks

    var url_schemas = [
      'coap',
      'doi',
      'javascript',
      'aaa',
      'aaas',
      'about',
      'acap',
      'cap',
      'cid',
      'crid',
      'data',
      'dav',
      'dict',
      'dns',
      'file',
      'ftp',
      'geo',
      'go',
      'gopher',
      'h323',
      'http',
      'https',
      'iax',
      'icap',
      'im',
      'imap',
      'info',
      'ipp',
      'iris',
      'iris.beep',
      'iris.xpc',
      'iris.xpcs',
      'iris.lwz',
      'ldap',
      'mailto',
      'mid',
      'msrp',
      'msrps',
      'mtqp',
      'mupdate',
      'news',
      'nfs',
      'ni',
      'nih',
      'nntp',
      'opaquelocktoken',
      'pop',
      'pres',
      'rtsp',
      'service',
      'session',
      'shttp',
      'sieve',
      'sip',
      'sips',
      'sms',
      'snmp',
      'soap.beep',
      'soap.beeps',
      'tag',
      'tel',
      'telnet',
      'tftp',
      'thismessage',
      'tn3270',
      'tip',
      'tv',
      'urn',
      'vemmi',
      'ws',
      'wss',
      'xcon',
      'xcon-userid',
      'xmlrpc.beep',
      'xmlrpc.beeps',
      'xmpp',
      'z39.50r',
      'z39.50s',
      'adiumxtra',
      'afp',
      'afs',
      'aim',
      'apt',
      'attachment',
      'aw',
      'beshare',
      'bitcoin',
      'bolo',
      'callto',
      'chrome',
      'chrome-extension',
      'com-eventbrite-attendee',
      'content',
      'cvs',
      'dlna-playsingle',
      'dlna-playcontainer',
      'dtn',
      'dvb',
      'ed2k',
      'facetime',
      'feed',
      'finger',
      'fish',
      'gg',
      'git',
      'gizmoproject',
      'gtalk',
      'hcp',
      'icon',
      'ipn',
      'irc',
      'irc6',
      'ircs',
      'itms',
      'jar',
      'jms',
      'keyparc',
      'lastfm',
      'ldaps',
      'magnet',
      'maps',
      'market',
      'message',
      'mms',
      'ms-help',
      'msnim',
      'mumble',
      'mvn',
      'notes',
      'oid',
      'palm',
      'paparazzi',
      'platform',
      'proxy',
      'psyc',
      'query',
      'res',
      'resource',
      'rmi',
      'rsync',
      'rtmp',
      'secondlife',
      'sftp',
      'sgn',
      'skype',
      'smb',
      'soldat',
      'spotify',
      'ssh',
      'steam',
      'svn',
      'teamspeak',
      'things',
      'udp',
      'unreal',
      'ut2004',
      'ventrilo',
      'view-source',
      'webcal',
      'wtai',
      'wyciwyg',
      'xfire',
      'xri',
      'ymsgr'
    ];

    // Process autolinks '<protocol:...>'


    /*eslint max-len:0*/
    var EMAIL_RE    = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;
    var AUTOLINK_RE = /^<([a-zA-Z.\-]{1,25}):([^<>\x00-\x20]*)>/;


    function autolink(state, silent) {
      var tail, linkMatch, emailMatch, url, fullUrl, pos = state.pos;

      if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false; }

      tail = state.src.slice(pos);

      if (tail.indexOf('>') < 0) { return false; }

      linkMatch = tail.match(AUTOLINK_RE);

      if (linkMatch) {
        if (url_schemas.indexOf(linkMatch[1].toLowerCase()) < 0) { return false; }

        url = linkMatch[0].slice(1, -1);
        fullUrl = normalizeLink(url);
        if (!state.parser.validateLink(url)) { return false; }

        if (!silent) {
          state.push({
            type: 'link_open',
            href: fullUrl,
            level: state.level
          });
          state.push({
            type: 'text',
            content: url,
            level: state.level + 1
          });
          state.push({ type: 'link_close', level: state.level });
        }

        state.pos += linkMatch[0].length;
        return true;
      }

      emailMatch = tail.match(EMAIL_RE);

      if (emailMatch) {

        url = emailMatch[0].slice(1, -1);

        fullUrl = normalizeLink('mailto:' + url);
        if (!state.parser.validateLink(fullUrl)) { return false; }

        if (!silent) {
          state.push({
            type: 'link_open',
            href: fullUrl,
            level: state.level
          });
          state.push({
            type: 'text',
            content: url,
            level: state.level + 1
          });
          state.push({ type: 'link_close', level: state.level });
        }

        state.pos += emailMatch[0].length;
        return true;
      }

      return false;
    }

    // Regexps to match html elements

    function replace$1(regex, options) {
      regex = regex.source;
      options = options || '';

      return function self(name, val) {
        if (!name) {
          return new RegExp(regex, options);
        }
        val = val.source || val;
        regex = regex.replace(name, val);
        return self;
      };
    }


    var attr_name     = /[a-zA-Z_:][a-zA-Z0-9:._-]*/;

    var unquoted      = /[^"'=<>`\x00-\x20]+/;
    var single_quoted = /'[^']*'/;
    var double_quoted = /"[^"]*"/;

    /*eslint no-spaced-func:0*/
    var attr_value  = replace$1(/(?:unquoted|single_quoted|double_quoted)/)
                        ('unquoted', unquoted)
                        ('single_quoted', single_quoted)
                        ('double_quoted', double_quoted)
                        ();

    var attribute   = replace$1(/(?:\s+attr_name(?:\s*=\s*attr_value)?)/)
                        ('attr_name', attr_name)
                        ('attr_value', attr_value)
                        ();

    var open_tag    = replace$1(/<[A-Za-z][A-Za-z0-9]*attribute*\s*\/?>/)
                        ('attribute', attribute)
                        ();

    var close_tag   = /<\/[A-Za-z][A-Za-z0-9]*\s*>/;
    var comment     = /<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->/;
    var processing  = /<[?].*?[?]>/;
    var declaration = /<![A-Z]+\s+[^>]*>/;
    var cdata       = /<!\[CDATA\[[\s\S]*?\]\]>/;

    var HTML_TAG_RE = replace$1(/^(?:open_tag|close_tag|comment|processing|declaration|cdata)/)
      ('open_tag', open_tag)
      ('close_tag', close_tag)
      ('comment', comment)
      ('processing', processing)
      ('declaration', declaration)
      ('cdata', cdata)
      ();

    // Process html tags


    function isLetter$2(ch) {
      /*eslint no-bitwise:0*/
      var lc = ch | 0x20; // to lower case
      return (lc >= 0x61/* a */) && (lc <= 0x7a/* z */);
    }


    function htmltag(state, silent) {
      var ch, match, max, pos = state.pos;

      if (!state.options.html) { return false; }

      // Check start
      max = state.posMax;
      if (state.src.charCodeAt(pos) !== 0x3C/* < */ ||
          pos + 2 >= max) {
        return false;
      }

      // Quick fail on second char
      ch = state.src.charCodeAt(pos + 1);
      if (ch !== 0x21/* ! */ &&
          ch !== 0x3F/* ? */ &&
          ch !== 0x2F/* / */ &&
          !isLetter$2(ch)) {
        return false;
      }

      match = state.src.slice(pos).match(HTML_TAG_RE);
      if (!match) { return false; }

      if (!silent) {
        state.push({
          type: 'htmltag',
          content: state.src.slice(pos, pos + match[0].length),
          level: state.level
        });
      }
      state.pos += match[0].length;
      return true;
    }

    // Process html entity - &#123;, &#xAF;, &quot;, ...


    var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,8}|[0-9]{1,8}));/i;
    var NAMED_RE   = /^&([a-z][a-z0-9]{1,31});/i;


    function entity(state, silent) {
      var ch, code, match, pos = state.pos, max = state.posMax;

      if (state.src.charCodeAt(pos) !== 0x26/* & */) { return false; }

      if (pos + 1 < max) {
        ch = state.src.charCodeAt(pos + 1);

        if (ch === 0x23 /* # */) {
          match = state.src.slice(pos).match(DIGITAL_RE);
          if (match) {
            if (!silent) {
              code = match[1][0].toLowerCase() === 'x' ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
              state.pending += isValidEntityCode(code) ? fromCodePoint(code) : fromCodePoint(0xFFFD);
            }
            state.pos += match[0].length;
            return true;
          }
        } else {
          match = state.src.slice(pos).match(NAMED_RE);
          if (match) {
            var decoded = decodeEntity(match[1]);
            if (match[1] !== decoded) {
              if (!silent) { state.pending += decoded; }
              state.pos += match[0].length;
              return true;
            }
          }
        }
      }

      if (!silent) { state.pending += '&'; }
      state.pos++;
      return true;
    }

    /**
     * Inline Parser `rules`
     */

    var _rules$2 = [
      [ 'text',            text$1 ],
      [ 'newline',         newline ],
      [ 'escape',          escape ],
      [ 'backticks',       backticks ],
      [ 'del',             del ],
      [ 'ins',             ins ],
      [ 'mark',            mark ],
      [ 'emphasis',        emphasis ],
      [ 'sub',             sub ],
      [ 'sup',             sup ],
      [ 'links',           links ],
      [ 'footnote_inline', footnote_inline ],
      [ 'footnote_ref',    footnote_ref ],
      [ 'autolink',        autolink ],
      [ 'htmltag',         htmltag ],
      [ 'entity',          entity ]
    ];

    /**
     * Inline Parser class. Note that link validation is stricter
     * in Remarkable than what is specified by CommonMark. If you
     * want to change this you can use a custom validator.
     *
     * @api private
     */

    function ParserInline() {
      this.ruler = new Ruler();
      for (var i = 0; i < _rules$2.length; i++) {
        this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
      }

      // Can be overridden with a custom validator
      this.validateLink = validateLink;
    }

    /**
     * Skip a single token by running all rules in validation mode.
     * Returns `true` if any rule reports success.
     *
     * @param  {Object} `state`
     * @api privage
     */

    ParserInline.prototype.skipToken = function (state) {
      var rules = this.ruler.getRules('');
      var len = rules.length;
      var pos = state.pos;
      var i, cached_pos;

      if ((cached_pos = state.cacheGet(pos)) > 0) {
        state.pos = cached_pos;
        return;
      }

      for (i = 0; i < len; i++) {
        if (rules[i](state, true)) {
          state.cacheSet(pos, state.pos);
          return;
        }
      }

      state.pos++;
      state.cacheSet(pos, state.pos);
    };

    /**
     * Generate tokens for the given input range.
     *
     * @param  {Object} `state`
     * @api private
     */

    ParserInline.prototype.tokenize = function (state) {
      var rules = this.ruler.getRules('');
      var len = rules.length;
      var end = state.posMax;
      var ok, i;

      while (state.pos < end) {

        // Try all possible rules.
        // On success, the rule should:
        //
        // - update `state.pos`
        // - update `state.tokens`
        // - return true
        for (i = 0; i < len; i++) {
          ok = rules[i](state, false);

          if (ok) {
            break;
          }
        }

        if (ok) {
          if (state.pos >= end) { break; }
          continue;
        }

        state.pending += state.src[state.pos++];
      }

      if (state.pending) {
        state.pushPending();
      }
    };

    /**
     * Parse the given input string.
     *
     * @param  {String} `str`
     * @param  {Object} `options`
     * @param  {Object} `env`
     * @param  {Array} `outTokens`
     * @api private
     */

    ParserInline.prototype.parse = function (str, options, env, outTokens) {
      var state = new StateInline(str, this, options, env, outTokens);
      this.tokenize(state);
    };

    /**
     * Validate the given `url` by checking for bad protocols.
     *
     * @param  {String} `url`
     * @return {Boolean}
     */

    function validateLink(url) {
      var BAD_PROTOCOLS = [ 'vbscript', 'javascript', 'file', 'data' ];
      var str = url.trim().toLowerCase();
      // Care about digital entities "javascript&#x3A;alert(1)"
      str = replaceEntities(str);
      if (str.indexOf(':') !== -1 && BAD_PROTOCOLS.indexOf(str.split(':')[0]) !== -1) {
        return false;
      }
      return true;
    }

    // Remarkable default options

    var defaultConfig = {
      options: {
        html:         false,        // Enable HTML tags in source
        xhtmlOut:     false,        // Use '/' to close single tags (<br />)
        breaks:       false,        // Convert '\n' in paragraphs into <br>
        langPrefix:   'language-',  // CSS language prefix for fenced blocks
        linkTarget:   '',           // set target to open link in

        // Enable some language-neutral replacements + quotes beautification
        typographer:  false,

        // Double + single quotes replacement pairs, when typographer enabled,
        // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
        quotes: '“”‘’',

        // Highlighter function. Should return escaped HTML,
        // or '' if input not changed
        //
        // function (/*str, lang*/) { return ''; }
        //
        highlight: null,

        maxNesting:   20            // Internal protection, recursion limit
      },

      components: {

        core: {
          rules: [
            'block',
            'inline',
            'references',
            'replacements',
            'smartquotes',
            'references',
            'abbr2',
            'footnote_tail'
          ]
        },

        block: {
          rules: [
            'blockquote',
            'code',
            'fences',
            'footnote',
            'heading',
            'hr',
            'htmlblock',
            'lheading',
            'list',
            'paragraph',
            'table'
          ]
        },

        inline: {
          rules: [
            'autolink',
            'backticks',
            'del',
            'emphasis',
            'entity',
            'escape',
            'footnote_ref',
            'htmltag',
            'links',
            'newline',
            'text'
          ]
        }
      }
    };

    // Remarkable default options

    var fullConfig = {
      options: {
        html:         false,        // Enable HTML tags in source
        xhtmlOut:     false,        // Use '/' to close single tags (<br />)
        breaks:       false,        // Convert '\n' in paragraphs into <br>
        langPrefix:   'language-',  // CSS language prefix for fenced blocks
        linkTarget:   '',           // set target to open link in

        // Enable some language-neutral replacements + quotes beautification
        typographer:  false,

        // Double + single quotes replacement pairs, when typographer enabled,
        // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
        quotes:       '“”‘’',

        // Highlighter function. Should return escaped HTML,
        // or '' if input not changed
        //
        // function (/*str, lang*/) { return ''; }
        //
        highlight:     null,

        maxNesting:    20            // Internal protection, recursion limit
      },

      components: {
        // Don't restrict core/block/inline rules
        core: {},
        block: {},
        inline: {}
      }
    };

    // Commonmark default options

    var commonmarkConfig = {
      options: {
        html:         true,         // Enable HTML tags in source
        xhtmlOut:     true,         // Use '/' to close single tags (<br />)
        breaks:       false,        // Convert '\n' in paragraphs into <br>
        langPrefix:   'language-',  // CSS language prefix for fenced blocks
        linkTarget:   '',           // set target to open link in

        // Enable some language-neutral replacements + quotes beautification
        typographer:  false,

        // Double + single quotes replacement pairs, when typographer enabled,
        // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
        quotes: '“”‘’',

        // Highlighter function. Should return escaped HTML,
        // or '' if input not changed
        //
        // function (/*str, lang*/) { return ''; }
        //
        highlight: null,

        maxNesting:   20            // Internal protection, recursion limit
      },

      components: {

        core: {
          rules: [
            'block',
            'inline',
            'references',
            'abbr2'
          ]
        },

        block: {
          rules: [
            'blockquote',
            'code',
            'fences',
            'heading',
            'hr',
            'htmlblock',
            'lheading',
            'list',
            'paragraph'
          ]
        },

        inline: {
          rules: [
            'autolink',
            'backticks',
            'emphasis',
            'entity',
            'escape',
            'htmltag',
            'links',
            'newline',
            'text'
          ]
        }
      }
    };

    /**
     * Preset configs
     */

    var config = {
      'default': defaultConfig,
      'full': fullConfig,
      'commonmark': commonmarkConfig
    };

    /**
     * The `StateCore` class manages state.
     *
     * @param {Object} `instance` Remarkable instance
     * @param {String} `str` Markdown string
     * @param {Object} `env`
     */

    function StateCore(instance, str, env) {
      this.src = str;
      this.env = env;
      this.options = instance.options;
      this.tokens = [];
      this.inlineMode = false;

      this.inline = instance.inline;
      this.block = instance.block;
      this.renderer = instance.renderer;
      this.typographer = instance.typographer;
    }

    /**
     * The main `Remarkable` class. Create an instance of
     * `Remarkable` with a `preset` and/or `options`.
     *
     * @param {String} `preset` If no preset is given, `default` is used.
     * @param {Object} `options`
     */

    function Remarkable(preset, options) {
      if (typeof preset !== 'string') {
        options = preset;
        preset = 'default';
      }

      if (options && options.linkify != null) {
        console.warn(
          'linkify option is removed. Use linkify plugin instead:\n\n' +
          'import Remarkable from \'remarkable\';\n' +
          'import linkify from \'remarkable/linkify\';\n' +
          'new Remarkable().use(linkify)\n'
        );
      }

      this.inline   = new ParserInline();
      this.block    = new ParserBlock();
      this.core     = new Core();
      this.renderer = new Renderer();
      this.ruler    = new Ruler();

      this.options  = {};
      this.configure(config[preset]);
      this.set(options || {});
    }

    /**
     * Set options as an alternative to passing them
     * to the constructor.
     *
     * ```js
     * md.set({typographer: true});
     * ```
     * @param {Object} `options`
     * @api public
     */

    Remarkable.prototype.set = function (options) {
      assign(this.options, options);
    };

    /**
     * Batch loader for components rules states, and options
     *
     * @param  {Object} `presets`
     */

    Remarkable.prototype.configure = function (presets) {
      var self = this;

      if (!presets) { throw new Error('Wrong `remarkable` preset, check name/content'); }
      if (presets.options) { self.set(presets.options); }
      if (presets.components) {
        Object.keys(presets.components).forEach(function (name) {
          if (presets.components[name].rules) {
            self[name].ruler.enable(presets.components[name].rules, true);
          }
        });
      }
    };

    /**
     * Use a plugin.
     *
     * ```js
     * var md = new Remarkable();
     *
     * md.use(plugin1)
     *   .use(plugin2, opts)
     *   .use(plugin3);
     * ```
     *
     * @param  {Function} `plugin`
     * @param  {Object} `options`
     * @return {Object} `Remarkable` for chaining
     */

    Remarkable.prototype.use = function (plugin, options) {
      plugin(this, options);
      return this;
    };


    /**
     * Parse the input `string` and return a tokens array.
     * Modifies `env` with definitions data.
     *
     * @param  {String} `string`
     * @param  {Object} `env`
     * @return {Array} Array of tokens
     */

    Remarkable.prototype.parse = function (str, env) {
      var state = new StateCore(this, str, env);
      this.core.process(state);
      return state.tokens;
    };

    /**
     * The main `.render()` method that does all the magic :)
     *
     * @param  {String} `string`
     * @param  {Object} `env`
     * @return {String} Rendered HTML.
     */

    Remarkable.prototype.render = function (str, env) {
      env = env || {};
      return this.renderer.render(this.parse(str, env), this.options, env);
    };

    /**
     * Parse the given content `string` as a single string.
     *
     * @param  {String} `string`
     * @param  {Object} `env`
     * @return {Array} Array of tokens
     */

    Remarkable.prototype.parseInline = function (str, env) {
      var state = new StateCore(this, str, env);
      state.inlineMode = true;
      this.core.process(state);
      return state.tokens;
    };

    /**
     * Render a single content `string`, without wrapping it
     * to paragraphs
     *
     * @param  {String} `str`
     * @param  {Object} `env`
     * @return {String}
     */

    Remarkable.prototype.renderInline = function (str, env) {
      env = env || {};
      return this.renderer.render(this.parseInline(str, env), this.options, env);
    };

    var bind = function bind(fn, thisArg) {
      return function wrap() {
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; i++) {
          args[i] = arguments[i];
        }
        return fn.apply(thisArg, args);
      };
    };

    /*global toString:true*/

    // utils is a library of generic helper functions non-specific to axios

    var toString = Object.prototype.toString;

    /**
     * Determine if a value is an Array
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Array, otherwise false
     */
    function isArray(val) {
      return toString.call(val) === '[object Array]';
    }

    /**
     * Determine if a value is undefined
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if the value is undefined, otherwise false
     */
    function isUndefined(val) {
      return typeof val === 'undefined';
    }

    /**
     * Determine if a value is a Buffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Buffer, otherwise false
     */
    function isBuffer(val) {
      return val !== null && !isUndefined(val) && val.constructor !== null && !isUndefined(val.constructor)
        && typeof val.constructor.isBuffer === 'function' && val.constructor.isBuffer(val);
    }

    /**
     * Determine if a value is an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an ArrayBuffer, otherwise false
     */
    function isArrayBuffer(val) {
      return toString.call(val) === '[object ArrayBuffer]';
    }

    /**
     * Determine if a value is a FormData
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an FormData, otherwise false
     */
    function isFormData(val) {
      return (typeof FormData !== 'undefined') && (val instanceof FormData);
    }

    /**
     * Determine if a value is a view on an ArrayBuffer
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a view on an ArrayBuffer, otherwise false
     */
    function isArrayBufferView(val) {
      var result;
      if ((typeof ArrayBuffer !== 'undefined') && (ArrayBuffer.isView)) {
        result = ArrayBuffer.isView(val);
      } else {
        result = (val) && (val.buffer) && (val.buffer instanceof ArrayBuffer);
      }
      return result;
    }

    /**
     * Determine if a value is a String
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a String, otherwise false
     */
    function isString(val) {
      return typeof val === 'string';
    }

    /**
     * Determine if a value is a Number
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Number, otherwise false
     */
    function isNumber(val) {
      return typeof val === 'number';
    }

    /**
     * Determine if a value is an Object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is an Object, otherwise false
     */
    function isObject(val) {
      return val !== null && typeof val === 'object';
    }

    /**
     * Determine if a value is a plain Object
     *
     * @param {Object} val The value to test
     * @return {boolean} True if value is a plain Object, otherwise false
     */
    function isPlainObject(val) {
      if (toString.call(val) !== '[object Object]') {
        return false;
      }

      var prototype = Object.getPrototypeOf(val);
      return prototype === null || prototype === Object.prototype;
    }

    /**
     * Determine if a value is a Date
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Date, otherwise false
     */
    function isDate(val) {
      return toString.call(val) === '[object Date]';
    }

    /**
     * Determine if a value is a File
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a File, otherwise false
     */
    function isFile(val) {
      return toString.call(val) === '[object File]';
    }

    /**
     * Determine if a value is a Blob
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Blob, otherwise false
     */
    function isBlob(val) {
      return toString.call(val) === '[object Blob]';
    }

    /**
     * Determine if a value is a Function
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Function, otherwise false
     */
    function isFunction(val) {
      return toString.call(val) === '[object Function]';
    }

    /**
     * Determine if a value is a Stream
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a Stream, otherwise false
     */
    function isStream(val) {
      return isObject(val) && isFunction(val.pipe);
    }

    /**
     * Determine if a value is a URLSearchParams object
     *
     * @param {Object} val The value to test
     * @returns {boolean} True if value is a URLSearchParams object, otherwise false
     */
    function isURLSearchParams(val) {
      return typeof URLSearchParams !== 'undefined' && val instanceof URLSearchParams;
    }

    /**
     * Trim excess whitespace off the beginning and end of a string
     *
     * @param {String} str The String to trim
     * @returns {String} The String freed of excess whitespace
     */
    function trim(str) {
      return str.replace(/^\s*/, '').replace(/\s*$/, '');
    }

    /**
     * Determine if we're running in a standard browser environment
     *
     * This allows axios to run in a web worker, and react-native.
     * Both environments support XMLHttpRequest, but not fully standard globals.
     *
     * web workers:
     *  typeof window -> undefined
     *  typeof document -> undefined
     *
     * react-native:
     *  navigator.product -> 'ReactNative'
     * nativescript
     *  navigator.product -> 'NativeScript' or 'NS'
     */
    function isStandardBrowserEnv() {
      if (typeof navigator !== 'undefined' && (navigator.product === 'ReactNative' ||
                                               navigator.product === 'NativeScript' ||
                                               navigator.product === 'NS')) {
        return false;
      }
      return (
        typeof window !== 'undefined' &&
        typeof document !== 'undefined'
      );
    }

    /**
     * Iterate over an Array or an Object invoking a function for each item.
     *
     * If `obj` is an Array callback will be called passing
     * the value, index, and complete array for each item.
     *
     * If 'obj' is an Object callback will be called passing
     * the value, key, and complete object for each property.
     *
     * @param {Object|Array} obj The object to iterate
     * @param {Function} fn The callback to invoke for each item
     */
    function forEach(obj, fn) {
      // Don't bother if no value provided
      if (obj === null || typeof obj === 'undefined') {
        return;
      }

      // Force an array if not already something iterable
      if (typeof obj !== 'object') {
        /*eslint no-param-reassign:0*/
        obj = [obj];
      }

      if (isArray(obj)) {
        // Iterate over array values
        for (var i = 0, l = obj.length; i < l; i++) {
          fn.call(null, obj[i], i, obj);
        }
      } else {
        // Iterate over object keys
        for (var key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            fn.call(null, obj[key], key, obj);
          }
        }
      }
    }

    /**
     * Accepts varargs expecting each argument to be an object, then
     * immutably merges the properties of each object and returns result.
     *
     * When multiple objects contain the same key the later object in
     * the arguments list will take precedence.
     *
     * Example:
     *
     * ```js
     * var result = merge({foo: 123}, {foo: 456});
     * console.log(result.foo); // outputs 456
     * ```
     *
     * @param {Object} obj1 Object to merge
     * @returns {Object} Result of all merge properties
     */
    function merge(/* obj1, obj2, obj3, ... */) {
      var result = {};
      function assignValue(val, key) {
        if (isPlainObject(result[key]) && isPlainObject(val)) {
          result[key] = merge(result[key], val);
        } else if (isPlainObject(val)) {
          result[key] = merge({}, val);
        } else if (isArray(val)) {
          result[key] = val.slice();
        } else {
          result[key] = val;
        }
      }

      for (var i = 0, l = arguments.length; i < l; i++) {
        forEach(arguments[i], assignValue);
      }
      return result;
    }

    /**
     * Extends object a by mutably adding to it the properties of object b.
     *
     * @param {Object} a The object to be extended
     * @param {Object} b The object to copy properties from
     * @param {Object} thisArg The object to bind function to
     * @return {Object} The resulting value of object a
     */
    function extend(a, b, thisArg) {
      forEach(b, function assignValue(val, key) {
        if (thisArg && typeof val === 'function') {
          a[key] = bind(val, thisArg);
        } else {
          a[key] = val;
        }
      });
      return a;
    }

    /**
     * Remove byte order marker. This catches EF BB BF (the UTF-8 BOM)
     *
     * @param {string} content with BOM
     * @return {string} content value without BOM
     */
    function stripBOM(content) {
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
      }
      return content;
    }

    var utils = {
      isArray: isArray,
      isArrayBuffer: isArrayBuffer,
      isBuffer: isBuffer,
      isFormData: isFormData,
      isArrayBufferView: isArrayBufferView,
      isString: isString,
      isNumber: isNumber,
      isObject: isObject,
      isPlainObject: isPlainObject,
      isUndefined: isUndefined,
      isDate: isDate,
      isFile: isFile,
      isBlob: isBlob,
      isFunction: isFunction,
      isStream: isStream,
      isURLSearchParams: isURLSearchParams,
      isStandardBrowserEnv: isStandardBrowserEnv,
      forEach: forEach,
      merge: merge,
      extend: extend,
      trim: trim,
      stripBOM: stripBOM
    };

    function encode(val) {
      return encodeURIComponent(val).
        replace(/%3A/gi, ':').
        replace(/%24/g, '$').
        replace(/%2C/gi, ',').
        replace(/%20/g, '+').
        replace(/%5B/gi, '[').
        replace(/%5D/gi, ']');
    }

    /**
     * Build a URL by appending params to the end
     *
     * @param {string} url The base of the url (e.g., http://www.google.com)
     * @param {object} [params] The params to be appended
     * @returns {string} The formatted url
     */
    var buildURL = function buildURL(url, params, paramsSerializer) {
      /*eslint no-param-reassign:0*/
      if (!params) {
        return url;
      }

      var serializedParams;
      if (paramsSerializer) {
        serializedParams = paramsSerializer(params);
      } else if (utils.isURLSearchParams(params)) {
        serializedParams = params.toString();
      } else {
        var parts = [];

        utils.forEach(params, function serialize(val, key) {
          if (val === null || typeof val === 'undefined') {
            return;
          }

          if (utils.isArray(val)) {
            key = key + '[]';
          } else {
            val = [val];
          }

          utils.forEach(val, function parseValue(v) {
            if (utils.isDate(v)) {
              v = v.toISOString();
            } else if (utils.isObject(v)) {
              v = JSON.stringify(v);
            }
            parts.push(encode(key) + '=' + encode(v));
          });
        });

        serializedParams = parts.join('&');
      }

      if (serializedParams) {
        var hashmarkIndex = url.indexOf('#');
        if (hashmarkIndex !== -1) {
          url = url.slice(0, hashmarkIndex);
        }

        url += (url.indexOf('?') === -1 ? '?' : '&') + serializedParams;
      }

      return url;
    };

    function InterceptorManager() {
      this.handlers = [];
    }

    /**
     * Add a new interceptor to the stack
     *
     * @param {Function} fulfilled The function to handle `then` for a `Promise`
     * @param {Function} rejected The function to handle `reject` for a `Promise`
     *
     * @return {Number} An ID used to remove interceptor later
     */
    InterceptorManager.prototype.use = function use(fulfilled, rejected) {
      this.handlers.push({
        fulfilled: fulfilled,
        rejected: rejected
      });
      return this.handlers.length - 1;
    };

    /**
     * Remove an interceptor from the stack
     *
     * @param {Number} id The ID that was returned by `use`
     */
    InterceptorManager.prototype.eject = function eject(id) {
      if (this.handlers[id]) {
        this.handlers[id] = null;
      }
    };

    /**
     * Iterate over all the registered interceptors
     *
     * This method is particularly useful for skipping over any
     * interceptors that may have become `null` calling `eject`.
     *
     * @param {Function} fn The function to call for each interceptor
     */
    InterceptorManager.prototype.forEach = function forEach(fn) {
      utils.forEach(this.handlers, function forEachHandler(h) {
        if (h !== null) {
          fn(h);
        }
      });
    };

    var InterceptorManager_1 = InterceptorManager;

    /**
     * Transform the data for a request or a response
     *
     * @param {Object|String} data The data to be transformed
     * @param {Array} headers The headers for the request or response
     * @param {Array|Function} fns A single function or Array of functions
     * @returns {*} The resulting transformed data
     */
    var transformData = function transformData(data, headers, fns) {
      /*eslint no-param-reassign:0*/
      utils.forEach(fns, function transform(fn) {
        data = fn(data, headers);
      });

      return data;
    };

    var isCancel = function isCancel(value) {
      return !!(value && value.__CANCEL__);
    };

    var normalizeHeaderName = function normalizeHeaderName(headers, normalizedName) {
      utils.forEach(headers, function processHeader(value, name) {
        if (name !== normalizedName && name.toUpperCase() === normalizedName.toUpperCase()) {
          headers[normalizedName] = value;
          delete headers[name];
        }
      });
    };

    /**
     * Update an Error with the specified config, error code, and response.
     *
     * @param {Error} error The error to update.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The error.
     */
    var enhanceError = function enhanceError(error, config, code, request, response) {
      error.config = config;
      if (code) {
        error.code = code;
      }

      error.request = request;
      error.response = response;
      error.isAxiosError = true;

      error.toJSON = function toJSON() {
        return {
          // Standard
          message: this.message,
          name: this.name,
          // Microsoft
          description: this.description,
          number: this.number,
          // Mozilla
          fileName: this.fileName,
          lineNumber: this.lineNumber,
          columnNumber: this.columnNumber,
          stack: this.stack,
          // Axios
          config: this.config,
          code: this.code
        };
      };
      return error;
    };

    /**
     * Create an Error with the specified message, config, error code, request and response.
     *
     * @param {string} message The error message.
     * @param {Object} config The config.
     * @param {string} [code] The error code (for example, 'ECONNABORTED').
     * @param {Object} [request] The request.
     * @param {Object} [response] The response.
     * @returns {Error} The created error.
     */
    var createError = function createError(message, config, code, request, response) {
      var error = new Error(message);
      return enhanceError(error, config, code, request, response);
    };

    /**
     * Resolve or reject a Promise based on response status.
     *
     * @param {Function} resolve A function that resolves the promise.
     * @param {Function} reject A function that rejects the promise.
     * @param {object} response The response.
     */
    var settle = function settle(resolve, reject, response) {
      var validateStatus = response.config.validateStatus;
      if (!response.status || !validateStatus || validateStatus(response.status)) {
        resolve(response);
      } else {
        reject(createError(
          'Request failed with status code ' + response.status,
          response.config,
          null,
          response.request,
          response
        ));
      }
    };

    var cookies = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs support document.cookie
        (function standardBrowserEnv() {
          return {
            write: function write(name, value, expires, path, domain, secure) {
              var cookie = [];
              cookie.push(name + '=' + encodeURIComponent(value));

              if (utils.isNumber(expires)) {
                cookie.push('expires=' + new Date(expires).toGMTString());
              }

              if (utils.isString(path)) {
                cookie.push('path=' + path);
              }

              if (utils.isString(domain)) {
                cookie.push('domain=' + domain);
              }

              if (secure === true) {
                cookie.push('secure');
              }

              document.cookie = cookie.join('; ');
            },

            read: function read(name) {
              var match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
              return (match ? decodeURIComponent(match[3]) : null);
            },

            remove: function remove(name) {
              this.write(name, '', Date.now() - 86400000);
            }
          };
        })() :

      // Non standard browser env (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return {
            write: function write() {},
            read: function read() { return null; },
            remove: function remove() {}
          };
        })()
    );

    /**
     * Determines whether the specified URL is absolute
     *
     * @param {string} url The URL to test
     * @returns {boolean} True if the specified URL is absolute, otherwise false
     */
    var isAbsoluteURL = function isAbsoluteURL(url) {
      // A URL is considered absolute if it begins with "<scheme>://" or "//" (protocol-relative URL).
      // RFC 3986 defines scheme name as a sequence of characters beginning with a letter and followed
      // by any combination of letters, digits, plus, period, or hyphen.
      return /^([a-z][a-z\d\+\-\.]*:)?\/\//i.test(url);
    };

    /**
     * Creates a new URL by combining the specified URLs
     *
     * @param {string} baseURL The base URL
     * @param {string} relativeURL The relative URL
     * @returns {string} The combined URL
     */
    var combineURLs = function combineURLs(baseURL, relativeURL) {
      return relativeURL
        ? baseURL.replace(/\/+$/, '') + '/' + relativeURL.replace(/^\/+/, '')
        : baseURL;
    };

    /**
     * Creates a new URL by combining the baseURL with the requestedURL,
     * only when the requestedURL is not already an absolute URL.
     * If the requestURL is absolute, this function returns the requestedURL untouched.
     *
     * @param {string} baseURL The base URL
     * @param {string} requestedURL Absolute or relative URL to combine
     * @returns {string} The combined full path
     */
    var buildFullPath = function buildFullPath(baseURL, requestedURL) {
      if (baseURL && !isAbsoluteURL(requestedURL)) {
        return combineURLs(baseURL, requestedURL);
      }
      return requestedURL;
    };

    // Headers whose duplicates are ignored by node
    // c.f. https://nodejs.org/api/http.html#http_message_headers
    var ignoreDuplicateOf = [
      'age', 'authorization', 'content-length', 'content-type', 'etag',
      'expires', 'from', 'host', 'if-modified-since', 'if-unmodified-since',
      'last-modified', 'location', 'max-forwards', 'proxy-authorization',
      'referer', 'retry-after', 'user-agent'
    ];

    /**
     * Parse headers into an object
     *
     * ```
     * Date: Wed, 27 Aug 2014 08:58:49 GMT
     * Content-Type: application/json
     * Connection: keep-alive
     * Transfer-Encoding: chunked
     * ```
     *
     * @param {String} headers Headers needing to be parsed
     * @returns {Object} Headers parsed into an object
     */
    var parseHeaders = function parseHeaders(headers) {
      var parsed = {};
      var key;
      var val;
      var i;

      if (!headers) { return parsed; }

      utils.forEach(headers.split('\n'), function parser(line) {
        i = line.indexOf(':');
        key = utils.trim(line.substr(0, i)).toLowerCase();
        val = utils.trim(line.substr(i + 1));

        if (key) {
          if (parsed[key] && ignoreDuplicateOf.indexOf(key) >= 0) {
            return;
          }
          if (key === 'set-cookie') {
            parsed[key] = (parsed[key] ? parsed[key] : []).concat([val]);
          } else {
            parsed[key] = parsed[key] ? parsed[key] + ', ' + val : val;
          }
        }
      });

      return parsed;
    };

    var isURLSameOrigin = (
      utils.isStandardBrowserEnv() ?

      // Standard browser envs have full support of the APIs needed to test
      // whether the request URL is of the same origin as current location.
        (function standardBrowserEnv() {
          var msie = /(msie|trident)/i.test(navigator.userAgent);
          var urlParsingNode = document.createElement('a');
          var originURL;

          /**
        * Parse a URL to discover it's components
        *
        * @param {String} url The URL to be parsed
        * @returns {Object}
        */
          function resolveURL(url) {
            var href = url;

            if (msie) {
            // IE needs attribute set twice to normalize properties
              urlParsingNode.setAttribute('href', href);
              href = urlParsingNode.href;
            }

            urlParsingNode.setAttribute('href', href);

            // urlParsingNode provides the UrlUtils interface - http://url.spec.whatwg.org/#urlutils
            return {
              href: urlParsingNode.href,
              protocol: urlParsingNode.protocol ? urlParsingNode.protocol.replace(/:$/, '') : '',
              host: urlParsingNode.host,
              search: urlParsingNode.search ? urlParsingNode.search.replace(/^\?/, '') : '',
              hash: urlParsingNode.hash ? urlParsingNode.hash.replace(/^#/, '') : '',
              hostname: urlParsingNode.hostname,
              port: urlParsingNode.port,
              pathname: (urlParsingNode.pathname.charAt(0) === '/') ?
                urlParsingNode.pathname :
                '/' + urlParsingNode.pathname
            };
          }

          originURL = resolveURL(window.location.href);

          /**
        * Determine if a URL shares the same origin as the current location
        *
        * @param {String} requestURL The URL to test
        * @returns {boolean} True if URL shares the same origin, otherwise false
        */
          return function isURLSameOrigin(requestURL) {
            var parsed = (utils.isString(requestURL)) ? resolveURL(requestURL) : requestURL;
            return (parsed.protocol === originURL.protocol &&
                parsed.host === originURL.host);
          };
        })() :

      // Non standard browser envs (web workers, react-native) lack needed support.
        (function nonStandardBrowserEnv() {
          return function isURLSameOrigin() {
            return true;
          };
        })()
    );

    var xhr = function xhrAdapter(config) {
      return new Promise(function dispatchXhrRequest(resolve, reject) {
        var requestData = config.data;
        var requestHeaders = config.headers;

        if (utils.isFormData(requestData)) {
          delete requestHeaders['Content-Type']; // Let the browser set it
        }

        var request = new XMLHttpRequest();

        // HTTP basic authentication
        if (config.auth) {
          var username = config.auth.username || '';
          var password = config.auth.password ? unescape(encodeURIComponent(config.auth.password)) : '';
          requestHeaders.Authorization = 'Basic ' + btoa(username + ':' + password);
        }

        var fullPath = buildFullPath(config.baseURL, config.url);
        request.open(config.method.toUpperCase(), buildURL(fullPath, config.params, config.paramsSerializer), true);

        // Set the request timeout in MS
        request.timeout = config.timeout;

        // Listen for ready state
        request.onreadystatechange = function handleLoad() {
          if (!request || request.readyState !== 4) {
            return;
          }

          // The request errored out and we didn't get a response, this will be
          // handled by onerror instead
          // With one exception: request that using file: protocol, most browsers
          // will return status as 0 even though it's a successful request
          if (request.status === 0 && !(request.responseURL && request.responseURL.indexOf('file:') === 0)) {
            return;
          }

          // Prepare the response
          var responseHeaders = 'getAllResponseHeaders' in request ? parseHeaders(request.getAllResponseHeaders()) : null;
          var responseData = !config.responseType || config.responseType === 'text' ? request.responseText : request.response;
          var response = {
            data: responseData,
            status: request.status,
            statusText: request.statusText,
            headers: responseHeaders,
            config: config,
            request: request
          };

          settle(resolve, reject, response);

          // Clean up request
          request = null;
        };

        // Handle browser request cancellation (as opposed to a manual cancellation)
        request.onabort = function handleAbort() {
          if (!request) {
            return;
          }

          reject(createError('Request aborted', config, 'ECONNABORTED', request));

          // Clean up request
          request = null;
        };

        // Handle low level network errors
        request.onerror = function handleError() {
          // Real errors are hidden from us by the browser
          // onerror should only fire if it's a network error
          reject(createError('Network Error', config, null, request));

          // Clean up request
          request = null;
        };

        // Handle timeout
        request.ontimeout = function handleTimeout() {
          var timeoutErrorMessage = 'timeout of ' + config.timeout + 'ms exceeded';
          if (config.timeoutErrorMessage) {
            timeoutErrorMessage = config.timeoutErrorMessage;
          }
          reject(createError(timeoutErrorMessage, config, 'ECONNABORTED',
            request));

          // Clean up request
          request = null;
        };

        // Add xsrf header
        // This is only done if running in a standard browser environment.
        // Specifically not if we're in a web worker, or react-native.
        if (utils.isStandardBrowserEnv()) {
          // Add xsrf header
          var xsrfValue = (config.withCredentials || isURLSameOrigin(fullPath)) && config.xsrfCookieName ?
            cookies.read(config.xsrfCookieName) :
            undefined;

          if (xsrfValue) {
            requestHeaders[config.xsrfHeaderName] = xsrfValue;
          }
        }

        // Add headers to the request
        if ('setRequestHeader' in request) {
          utils.forEach(requestHeaders, function setRequestHeader(val, key) {
            if (typeof requestData === 'undefined' && key.toLowerCase() === 'content-type') {
              // Remove Content-Type if data is undefined
              delete requestHeaders[key];
            } else {
              // Otherwise add header to the request
              request.setRequestHeader(key, val);
            }
          });
        }

        // Add withCredentials to request if needed
        if (!utils.isUndefined(config.withCredentials)) {
          request.withCredentials = !!config.withCredentials;
        }

        // Add responseType to request if needed
        if (config.responseType) {
          try {
            request.responseType = config.responseType;
          } catch (e) {
            // Expected DOMException thrown by browsers not compatible XMLHttpRequest Level 2.
            // But, this can be suppressed for 'json' type as it can be parsed by default 'transformResponse' function.
            if (config.responseType !== 'json') {
              throw e;
            }
          }
        }

        // Handle progress if needed
        if (typeof config.onDownloadProgress === 'function') {
          request.addEventListener('progress', config.onDownloadProgress);
        }

        // Not all browsers support upload events
        if (typeof config.onUploadProgress === 'function' && request.upload) {
          request.upload.addEventListener('progress', config.onUploadProgress);
        }

        if (config.cancelToken) {
          // Handle cancellation
          config.cancelToken.promise.then(function onCanceled(cancel) {
            if (!request) {
              return;
            }

            request.abort();
            reject(cancel);
            // Clean up request
            request = null;
          });
        }

        if (!requestData) {
          requestData = null;
        }

        // Send the request
        request.send(requestData);
      });
    };

    var DEFAULT_CONTENT_TYPE = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    function setContentTypeIfUnset(headers, value) {
      if (!utils.isUndefined(headers) && utils.isUndefined(headers['Content-Type'])) {
        headers['Content-Type'] = value;
      }
    }

    function getDefaultAdapter() {
      var adapter;
      if (typeof XMLHttpRequest !== 'undefined') {
        // For browsers use XHR adapter
        adapter = xhr;
      } else if (typeof process !== 'undefined' && Object.prototype.toString.call(process) === '[object process]') {
        // For node use HTTP adapter
        adapter = xhr;
      }
      return adapter;
    }

    var defaults = {
      adapter: getDefaultAdapter(),

      transformRequest: [function transformRequest(data, headers) {
        normalizeHeaderName(headers, 'Accept');
        normalizeHeaderName(headers, 'Content-Type');
        if (utils.isFormData(data) ||
          utils.isArrayBuffer(data) ||
          utils.isBuffer(data) ||
          utils.isStream(data) ||
          utils.isFile(data) ||
          utils.isBlob(data)
        ) {
          return data;
        }
        if (utils.isArrayBufferView(data)) {
          return data.buffer;
        }
        if (utils.isURLSearchParams(data)) {
          setContentTypeIfUnset(headers, 'application/x-www-form-urlencoded;charset=utf-8');
          return data.toString();
        }
        if (utils.isObject(data)) {
          setContentTypeIfUnset(headers, 'application/json;charset=utf-8');
          return JSON.stringify(data);
        }
        return data;
      }],

      transformResponse: [function transformResponse(data) {
        /*eslint no-param-reassign:0*/
        if (typeof data === 'string') {
          try {
            data = JSON.parse(data);
          } catch (e) { /* Ignore */ }
        }
        return data;
      }],

      /**
       * A timeout in milliseconds to abort a request. If set to 0 (default) a
       * timeout is not created.
       */
      timeout: 0,

      xsrfCookieName: 'XSRF-TOKEN',
      xsrfHeaderName: 'X-XSRF-TOKEN',

      maxContentLength: -1,
      maxBodyLength: -1,

      validateStatus: function validateStatus(status) {
        return status >= 200 && status < 300;
      }
    };

    defaults.headers = {
      common: {
        'Accept': 'application/json, text/plain, */*'
      }
    };

    utils.forEach(['delete', 'get', 'head'], function forEachMethodNoData(method) {
      defaults.headers[method] = {};
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      defaults.headers[method] = utils.merge(DEFAULT_CONTENT_TYPE);
    });

    var defaults_1 = defaults;

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    function throwIfCancellationRequested(config) {
      if (config.cancelToken) {
        config.cancelToken.throwIfRequested();
      }
    }

    /**
     * Dispatch a request to the server using the configured adapter.
     *
     * @param {object} config The config that is to be used for the request
     * @returns {Promise} The Promise to be fulfilled
     */
    var dispatchRequest = function dispatchRequest(config) {
      throwIfCancellationRequested(config);

      // Ensure headers exist
      config.headers = config.headers || {};

      // Transform request data
      config.data = transformData(
        config.data,
        config.headers,
        config.transformRequest
      );

      // Flatten headers
      config.headers = utils.merge(
        config.headers.common || {},
        config.headers[config.method] || {},
        config.headers
      );

      utils.forEach(
        ['delete', 'get', 'head', 'post', 'put', 'patch', 'common'],
        function cleanHeaderConfig(method) {
          delete config.headers[method];
        }
      );

      var adapter = config.adapter || defaults_1.adapter;

      return adapter(config).then(function onAdapterResolution(response) {
        throwIfCancellationRequested(config);

        // Transform response data
        response.data = transformData(
          response.data,
          response.headers,
          config.transformResponse
        );

        return response;
      }, function onAdapterRejection(reason) {
        if (!isCancel(reason)) {
          throwIfCancellationRequested(config);

          // Transform response data
          if (reason && reason.response) {
            reason.response.data = transformData(
              reason.response.data,
              reason.response.headers,
              config.transformResponse
            );
          }
        }

        return Promise.reject(reason);
      });
    };

    /**
     * Config-specific merge-function which creates a new config-object
     * by merging two configuration objects together.
     *
     * @param {Object} config1
     * @param {Object} config2
     * @returns {Object} New object resulting from merging config2 to config1
     */
    var mergeConfig = function mergeConfig(config1, config2) {
      // eslint-disable-next-line no-param-reassign
      config2 = config2 || {};
      var config = {};

      var valueFromConfig2Keys = ['url', 'method', 'data'];
      var mergeDeepPropertiesKeys = ['headers', 'auth', 'proxy', 'params'];
      var defaultToConfig2Keys = [
        'baseURL', 'transformRequest', 'transformResponse', 'paramsSerializer',
        'timeout', 'timeoutMessage', 'withCredentials', 'adapter', 'responseType', 'xsrfCookieName',
        'xsrfHeaderName', 'onUploadProgress', 'onDownloadProgress', 'decompress',
        'maxContentLength', 'maxBodyLength', 'maxRedirects', 'transport', 'httpAgent',
        'httpsAgent', 'cancelToken', 'socketPath', 'responseEncoding'
      ];
      var directMergeKeys = ['validateStatus'];

      function getMergedValue(target, source) {
        if (utils.isPlainObject(target) && utils.isPlainObject(source)) {
          return utils.merge(target, source);
        } else if (utils.isPlainObject(source)) {
          return utils.merge({}, source);
        } else if (utils.isArray(source)) {
          return source.slice();
        }
        return source;
      }

      function mergeDeepProperties(prop) {
        if (!utils.isUndefined(config2[prop])) {
          config[prop] = getMergedValue(config1[prop], config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          config[prop] = getMergedValue(undefined, config1[prop]);
        }
      }

      utils.forEach(valueFromConfig2Keys, function valueFromConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          config[prop] = getMergedValue(undefined, config2[prop]);
        }
      });

      utils.forEach(mergeDeepPropertiesKeys, mergeDeepProperties);

      utils.forEach(defaultToConfig2Keys, function defaultToConfig2(prop) {
        if (!utils.isUndefined(config2[prop])) {
          config[prop] = getMergedValue(undefined, config2[prop]);
        } else if (!utils.isUndefined(config1[prop])) {
          config[prop] = getMergedValue(undefined, config1[prop]);
        }
      });

      utils.forEach(directMergeKeys, function merge(prop) {
        if (prop in config2) {
          config[prop] = getMergedValue(config1[prop], config2[prop]);
        } else if (prop in config1) {
          config[prop] = getMergedValue(undefined, config1[prop]);
        }
      });

      var axiosKeys = valueFromConfig2Keys
        .concat(mergeDeepPropertiesKeys)
        .concat(defaultToConfig2Keys)
        .concat(directMergeKeys);

      var otherKeys = Object
        .keys(config1)
        .concat(Object.keys(config2))
        .filter(function filterAxiosKeys(key) {
          return axiosKeys.indexOf(key) === -1;
        });

      utils.forEach(otherKeys, mergeDeepProperties);

      return config;
    };

    /**
     * Create a new instance of Axios
     *
     * @param {Object} instanceConfig The default config for the instance
     */
    function Axios(instanceConfig) {
      this.defaults = instanceConfig;
      this.interceptors = {
        request: new InterceptorManager_1(),
        response: new InterceptorManager_1()
      };
    }

    /**
     * Dispatch a request
     *
     * @param {Object} config The config specific for this request (merged with this.defaults)
     */
    Axios.prototype.request = function request(config) {
      /*eslint no-param-reassign:0*/
      // Allow for axios('example/url'[, config]) a la fetch API
      if (typeof config === 'string') {
        config = arguments[1] || {};
        config.url = arguments[0];
      } else {
        config = config || {};
      }

      config = mergeConfig(this.defaults, config);

      // Set config.method
      if (config.method) {
        config.method = config.method.toLowerCase();
      } else if (this.defaults.method) {
        config.method = this.defaults.method.toLowerCase();
      } else {
        config.method = 'get';
      }

      // Hook up interceptors middleware
      var chain = [dispatchRequest, undefined];
      var promise = Promise.resolve(config);

      this.interceptors.request.forEach(function unshiftRequestInterceptors(interceptor) {
        chain.unshift(interceptor.fulfilled, interceptor.rejected);
      });

      this.interceptors.response.forEach(function pushResponseInterceptors(interceptor) {
        chain.push(interceptor.fulfilled, interceptor.rejected);
      });

      while (chain.length) {
        promise = promise.then(chain.shift(), chain.shift());
      }

      return promise;
    };

    Axios.prototype.getUri = function getUri(config) {
      config = mergeConfig(this.defaults, config);
      return buildURL(config.url, config.params, config.paramsSerializer).replace(/^\?/, '');
    };

    // Provide aliases for supported request methods
    utils.forEach(['delete', 'get', 'head', 'options'], function forEachMethodNoData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, config) {
        return this.request(mergeConfig(config || {}, {
          method: method,
          url: url,
          data: (config || {}).data
        }));
      };
    });

    utils.forEach(['post', 'put', 'patch'], function forEachMethodWithData(method) {
      /*eslint func-names:0*/
      Axios.prototype[method] = function(url, data, config) {
        return this.request(mergeConfig(config || {}, {
          method: method,
          url: url,
          data: data
        }));
      };
    });

    var Axios_1 = Axios;

    /**
     * A `Cancel` is an object that is thrown when an operation is canceled.
     *
     * @class
     * @param {string=} message The message.
     */
    function Cancel(message) {
      this.message = message;
    }

    Cancel.prototype.toString = function toString() {
      return 'Cancel' + (this.message ? ': ' + this.message : '');
    };

    Cancel.prototype.__CANCEL__ = true;

    var Cancel_1 = Cancel;

    /**
     * A `CancelToken` is an object that can be used to request cancellation of an operation.
     *
     * @class
     * @param {Function} executor The executor function.
     */
    function CancelToken(executor) {
      if (typeof executor !== 'function') {
        throw new TypeError('executor must be a function.');
      }

      var resolvePromise;
      this.promise = new Promise(function promiseExecutor(resolve) {
        resolvePromise = resolve;
      });

      var token = this;
      executor(function cancel(message) {
        if (token.reason) {
          // Cancellation has already been requested
          return;
        }

        token.reason = new Cancel_1(message);
        resolvePromise(token.reason);
      });
    }

    /**
     * Throws a `Cancel` if cancellation has been requested.
     */
    CancelToken.prototype.throwIfRequested = function throwIfRequested() {
      if (this.reason) {
        throw this.reason;
      }
    };

    /**
     * Returns an object that contains a new `CancelToken` and a function that, when called,
     * cancels the `CancelToken`.
     */
    CancelToken.source = function source() {
      var cancel;
      var token = new CancelToken(function executor(c) {
        cancel = c;
      });
      return {
        token: token,
        cancel: cancel
      };
    };

    var CancelToken_1 = CancelToken;

    /**
     * Syntactic sugar for invoking a function and expanding an array for arguments.
     *
     * Common use case would be to use `Function.prototype.apply`.
     *
     *  ```js
     *  function f(x, y, z) {}
     *  var args = [1, 2, 3];
     *  f.apply(null, args);
     *  ```
     *
     * With `spread` this example can be re-written.
     *
     *  ```js
     *  spread(function(x, y, z) {})([1, 2, 3]);
     *  ```
     *
     * @param {Function} callback
     * @returns {Function}
     */
    var spread = function spread(callback) {
      return function wrap(arr) {
        return callback.apply(null, arr);
      };
    };

    /**
     * Determines whether the payload is an error thrown by Axios
     *
     * @param {*} payload The value to test
     * @returns {boolean} True if the payload is an error thrown by Axios, otherwise false
     */
    var isAxiosError = function isAxiosError(payload) {
      return (typeof payload === 'object') && (payload.isAxiosError === true);
    };

    /**
     * Create an instance of Axios
     *
     * @param {Object} defaultConfig The default config for the instance
     * @return {Axios} A new instance of Axios
     */
    function createInstance(defaultConfig) {
      var context = new Axios_1(defaultConfig);
      var instance = bind(Axios_1.prototype.request, context);

      // Copy axios.prototype to instance
      utils.extend(instance, Axios_1.prototype, context);

      // Copy context to instance
      utils.extend(instance, context);

      return instance;
    }

    // Create the default instance to be exported
    var axios = createInstance(defaults_1);

    // Expose Axios class to allow class inheritance
    axios.Axios = Axios_1;

    // Factory for creating new instances
    axios.create = function create(instanceConfig) {
      return createInstance(mergeConfig(axios.defaults, instanceConfig));
    };

    // Expose Cancel & CancelToken
    axios.Cancel = Cancel_1;
    axios.CancelToken = CancelToken_1;
    axios.isCancel = isCancel;

    // Expose all/spread
    axios.all = function all(promises) {
      return Promise.all(promises);
    };
    axios.spread = spread;

    // Expose isAxiosError
    axios.isAxiosError = isAxiosError;

    var axios_1 = axios;

    // Allow use of default import syntax in TypeScript
    var _default = axios;
    axios_1.default = _default;

    var axios$1 = axios_1;

    // Api.js

    // Create a instance of axios to use the same base url.
    const axiosAPI = axios$1.create({
      // baseURL : "https://pokeapi.co/api/v2/" // it's not recommended to have this info here.
    });

    // implement a method to execute all the request from here.
    const apiRequest = (method, url, request) => {
        const headers = {
            //authorization: ""
        };
        //using the axios instance to perform the request that received from each http method
        return axiosAPI({
            method,
            url,
            data: request,
            headers
          }).then(res => {
            return Promise.resolve(res.data);
          })
          .catch(err => {
            return Promise.reject(err);
          });
    };

    // function to execute the http get request
    const get = (url, request) => apiRequest("get",url,request);

    // function to execute the http delete request
    const deleteRequest = (url, request) =>  apiRequest("delete", url, request);

    // function to execute the http post request
    const post = (url, request) => apiRequest("post", url, request);

    // function to execute the http put request
    const put = (url, request) => apiRequest("put", url, request);

    // function to execute the http path request
    const patch = (url, request) =>  apiRequest("patch", url, request);

    // expose your method to other services or actions
    const API ={
        get,
        delete: deleteRequest,
        post,
        put,
        patch
    };

    var config$1 = {
        github_owner: 'AJsVoices',
        github_repo: 'story-bible',

        home: 'README'
    };

    const baseURL = 'https://api.github.com';

    const getHomePage = async () => {
        return await getPage(config$1.home);
    };

    const getContents = async (url) => {
        try {
            const response = await API.get(url);
            return response;
        } catch (error) {
            console.error(error);
        }
    };

    const getPage = async (page) => {
        try {
            const response = await API.get(`${baseURL}/repos/${config$1.github_owner}/${config$1.github_repo}/contents/${page}.md`);
            let url = response.download_url;
            return await getContents(url);
        } catch (error) {
            const response = await API.get(`${baseURL}/repos/${config$1.github_owner}/${config$1.github_repo}/contents/not-found.md`);
            let url = response.download_url;
            return await getContents(url);
        }
    };

    /* src/pages/Home.svelte generated by Svelte v3.32.3 */
    const file = "src/pages/Home.svelte";

    function create_fragment$1(ctx) {
    	let main;

    	const block = {
    		c: function create() {
    			main = element("main");
    			attr_dev(main, "class", "m-3");
    			add_location(main, file, 18, 0, 389);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, main, anchor);
    			main.innerHTML = /*markdown*/ ctx[0];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*markdown*/ 1) main.innerHTML = /*markdown*/ ctx[0];		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Home", slots, []);
    	let md = new Remarkable({ xhtmlOut: true, breaks: true });
    	let markdown = "Loading...";

    	onMount(async () => {
    		const res = await getHomePage();
    		$$invalidate(0, markdown = md.render(res));
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		Remarkable,
    		getHomePage,
    		md,
    		markdown
    	});

    	$$self.$inject_state = $$props => {
    		if ("md" in $$props) md = $$props.md;
    		if ("markdown" in $$props) $$invalidate(0, markdown = $$props.markdown);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [markdown];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    /* src/pages/About.svelte generated by Svelte v3.32.3 */

    const file$1 = "src/pages/About.svelte";

    function create_fragment$2(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "About Component/route";
    			add_location(h2, file$1, 3, 0, 21);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("About", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<About> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class About extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "About",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    /* src/pages/Page.svelte generated by Svelte v3.32.3 */
    const file$2 = "src/pages/Page.svelte";

    function create_fragment$3(ctx) {
    	let h2;
    	let t1;
    	let p;
    	let t2_value = /*params*/ ctx[0].slug + "";
    	let t2;
    	let t3;
    	let main;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Page component/route";
    			t1 = space();
    			p = element("p");
    			t2 = text(t2_value);
    			t3 = space();
    			main = element("main");
    			add_location(h2, file$2, 21, 0, 443);
    			add_location(p, file$2, 22, 0, 473);
    			attr_dev(main, "class", "m-3");
    			add_location(main, file$2, 23, 0, 496);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, p, anchor);
    			append_dev(p, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, main, anchor);
    			main.innerHTML = /*markdown*/ ctx[1];
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*params*/ 1 && t2_value !== (t2_value = /*params*/ ctx[0].slug + "")) set_data_dev(t2, t2_value);
    			if (dirty & /*markdown*/ 2) main.innerHTML = /*markdown*/ ctx[1];		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(p);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(main);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Page", slots, []);
    	let { params } = $$props;
    	let md = new Remarkable({ xhtmlOut: true, breaks: true });
    	let markdown = "Loading...";

    	onMount(async () => {
    		const slug = params.slug;
    		const res = await getPage(slug);
    		$$invalidate(1, markdown = md.render(res));
    	});

    	const writable_props = ["params"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Page> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ("params" in $$props) $$invalidate(0, params = $$props.params);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		Remarkable,
    		getPage,
    		params,
    		md,
    		markdown
    	});

    	$$self.$inject_state = $$props => {
    		if ("params" in $$props) $$invalidate(0, params = $$props.params);
    		if ("md" in $$props) md = $$props.md;
    		if ("markdown" in $$props) $$invalidate(1, markdown = $$props.markdown);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [params, markdown];
    }

    class Page extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, { params: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Page",
    			options,
    			id: create_fragment$3.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*params*/ ctx[0] === undefined && !("params" in props)) {
    			console.warn("<Page> was created without expected prop 'params'");
    		}
    	}

    	get params() {
    		throw new Error("<Page>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<Page>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/pages/Feed.svelte generated by Svelte v3.32.3 */

    const file$3 = "src/pages/Feed.svelte";

    function create_fragment$4(ctx) {
    	let h2;

    	const block = {
    		c: function create() {
    			h2 = element("h2");
    			h2.textContent = "Feed component/route";
    			add_location(h2, file$3, 3, 0, 20);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, h2, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Feed", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Feed> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Feed extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Feed",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.32.3 */
    const file$4 = "src/App.svelte";

    function create_fragment$5(ctx) {
    	let tailwindcss;
    	let t0;
    	let h1;
    	let t2;
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	tailwindcss = new Tailwind({ $$inline: true });
    	var switch_value = /*page*/ ctx[0];

    	function switch_props(ctx) {
    		return {
    			props: { params: /*params*/ ctx[1] },
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props(ctx));
    	}

    	const block = {
    		c: function create() {
    			create_component(tailwindcss.$$.fragment);
    			t0 = space();
    			h1 = element("h1");
    			h1.textContent = "Master Layout";
    			t2 = space();
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    			add_location(h1, file$4, 25, 0, 615);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(tailwindcss, target, anchor);
    			insert_dev(target, t0, anchor);
    			insert_dev(target, h1, anchor);
    			insert_dev(target, t2, anchor);

    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const switch_instance_changes = {};
    			if (dirty & /*params*/ 2) switch_instance_changes.params = /*params*/ ctx[1];

    			if (switch_value !== (switch_value = /*page*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props(ctx));
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			} else if (switch_value) {
    				switch_instance.$set(switch_instance_changes);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(tailwindcss.$$.fragment, local);
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(tailwindcss.$$.fragment, local);
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(tailwindcss, detaching);
    			if (detaching) detach_dev(t0);
    			if (detaching) detach_dev(h1);
    			if (detaching) detach_dev(t2);
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	let page$1;
    	let params;
    	page("/", () => $$invalidate(0, page$1 = Home));
    	page("/about", () => $$invalidate(0, page$1 = About));

    	page(
    		"/page/:slug(.*)",
    		(ctx, next) => {
    			$$invalidate(1, params = ctx.params);
    			next();
    		},
    		() => $$invalidate(0, page$1 = Page)
    	);

    	page("/feed", () => $$invalidate(0, page$1 = Feed));
    	page.start();
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		Tailwindcss: Tailwind,
    		router: page,
    		Home,
    		About,
    		Page,
    		Feed,
    		page: page$1,
    		params
    	});

    	$$self.$inject_state = $$props => {
    		if ("page" in $$props) $$invalidate(0, page$1 = $$props.page);
    		if ("params" in $$props) $$invalidate(1, params = $$props.params);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [page$1, params];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
