(function() { const _module = function RegExpX() { 'use strict';

/**
 * Turns a template string containing an extended RegExp, which may contain uninterpreted whitespaces
 * and # comments, into a regular RegExp object.
 * Must be called as a template string tagging function.
 * Since it uses the template strings '.raw' property, no additional escaping compared to regular RegExp
 * literal is required, except that whitespaces and '#' characters that are not to be removed need to be escaped.
 * Note: The sequence '${' needs to be escaped to '\${' or '$\{' and will then appear as '\${' or '$\{' in the resulting RegExp.
 * The usual flags 'gim(uy)' may follow the RegExp itself after a closing '/'.
 * Example:
 *     RegExpX`a` <= same as => /a/
 *     RegExpX`a/i` <= same as => /a/i
 *     RegExpX`[\n\ ] # newline or space
 *             \/ # an escaped slash
 *             \# not a comment
 *             /g` <= same as => /[\n\ ]\/##notacomment/g
 *     RegExpX`^ . * ? x / g i m` <= smae as => /^.*?x/gim
 * As a plus, you can also use variables in your RegExp's, e.g.:
 *     const newLine = /[\r\n]/;
 *     const sentence = /([\w\.\ 0-9]*)/; // (modifiers ignored)
 *     RegExpX`(${ sentence } (<br><\/br>)+ ${ newLine })+` <= same as => /(([\w\. 0-9]*)(<br><\/br>)+[\r\n])+/
 */
function RegExpX(options) {

	const optionNames = { single: 's', ungreedy: 'U', nocapture: 'n', };

	// not called as template string processor
	if (!(options && options.raw && arguments.length === options.length)) {
		// replace options by those encoded in the string
		if (typeof options === 'string') { return RegExpX.bind(Object.keys(optionNames).reduce((ret, key) => ((ret[key] = options.includes(optionNames[key])), ret), { })); }
		// add new options, overwriting existing ones
		this && this !== exports && Object.keys(optionNames).forEach(key => !(key in options) && (key in this) && (options[key] = this[key]));
		return RegExpX.bind(options);
	}
	// called as template string processor, get bound options
	const _options = this && this !== exports ? this : { };
	const ctx = { groups: [ null, ], };
	Object.keys(optionNames).forEach(key => ctx[key] = _options[key]);

	// concat input
	for (let i = 1, l = arguments.length; i < l; ++i) {
		arguments[i] = substitute(arguments[i], ctx.groupNames);
	}
	const input = String.raw.apply(String, arguments); // get the string exactly as typed ==> no further escaping necessary

	function substitute(arg, groups) {
		if (!arg) { return arg +''; }
		if (typeof arg === 'string') { return escape(arg); }
		if (arg.source && arg.toString && arg.toString().startsWith(arg.source, 1)) { return arg.source; }
		if (Array.isArray(arg)) {
			return '(?:'+ arg.map(item => substitute(item, groups)).join('|') +')';
		}
		if (typeof arg === 'object') {
			return '(?:'+ Object.keys(arg).map(key => {
				return '(?<'+ key +'>'+ substitute(arg[key], groups) +')';
			}).join('|') +')';
		}
		return escape(arg +'');
	}

	function escape(string) {
		return string.replace(/[\-\[\]\{\}\(\)\*\+\?\.\,\\\/\^\$\|\#\s]/g, '\\$&');
	}

	function isEscaped(ctx) {
		return ctx.now.match(/\\*$/)[0].length % 2 === 1;
	}

	const parser = new Map([
		[ /^\s$/, function(ctx, wsp) { // remove whitespaces or an escaping slash
			if (ctx.list) { return true; }
			if (isEscaped(ctx)) {
				ctx.now = ctx.now.slice(0, -1) + wsp;
			}
		}, ],
		[ /^\[$/, function(ctx) { // step into character list
			!ctx.list && !isEscaped(ctx) && (ctx.list = true);
			return true;
		}, ],
		[ /^\]$/, function(ctx) { // step out of character list
			ctx.list && !isEscaped(ctx) && (ctx.list = false);
			return true;
		}, ],
		[ /^\.$/, function(ctx) { // implement 's' flag
			ctx.now += !ctx.list && ctx.single && !isEscaped(ctx) ? '[^]' : '.';
		}, ],
		[ /^(?:\*|\+|\{\d+(?:\,\d*)?\})$/, function(ctx) { // implement 'U' flag
			if (!ctx.list && ctx.ungreedy && !isEscaped(ctx)) {
				ctx.next = ctx.next.replace(/^(\?)?/, (_, is) => is ? '' : '?');
			}
			return true;
		}, ],
		[ /^(?:\$\d|\$<)$/, function(ctx, group) { // resolve group references
			if (ctx.list) { return true; }
			let index, name;
			if ((/\d$/).test(group)) {
				const digits = (/^\d*/).exec(ctx.next)[0];
				ctx.next = ctx.next.slice(digits.length);
				index = +(group.slice(-1) + digits);
			} else {
				const match = (/^(\w+)>/).exec(ctx.next);
				if (!match) { throw new SyntaxError('Invalid group reference, expected group name after "$<"'); }
				ctx.next = ctx.next.slice(match[0].length);
				if (+match[1]) { index = +match[1]; }
				else { name = match[1]; }
			}
			if (index && index < ctx.groups.length) {
				ctx.now += '\\'+ index;
			} else if (name && ctx.groups.includes(name)) {
				ctx.now += '\\'+ ctx.groups.indexOf(name);
			} else {
				throw new SyntaxError('Reference to non-existent subpattern "'+ (name || index) +'" in "'+ group +'"');
			}
		}, ],
		[ /^\(\?<$/, function(ctx) { // translate named groups and store references
			if (ctx.list || isEscaped(ctx)) { return true; }
			const match = (/^(\w+)>/).exec(ctx.next);
			if (!match) { throw new SyntaxError('Invalid group structure, expected named group'); }
			if ((/^\d/).test(match[1])) { throw new SyntaxError('Invalid group structure, group name must not begin with a digit'); }
			ctx.groups.push(match[1]);
			ctx.next = ctx.next.slice(match[0].length);
			ctx.now += '(';
		}, ],
		[ /^\($/, function(ctx) { // find unnamed groups and ether write references or translate to non-capturing group ('n' flag)
			if (ctx.list) { return true; }
			if ((/^\?/).test(ctx.next)) { return true; }
			if (ctx.nocapture) {
				ctx.now += '(?:';
			} else {
				ctx.groups.push(null);
				return true;
			}
		}, ],
		[ /^\#$/, function(ctx) { // strip comments
			if (ctx.list) { return true; }
			if (isEscaped(ctx)) {
				ctx.now = ctx.now.slice(0, -1) +'#';
			} else {
				ctx.next = ctx.next.replace(/^.*[^]/, '');
			}
		}, ],
		[ /^\/$/, function(ctx) { // find native flags
			if (ctx.list) { return true; }
			if (isEscaped(ctx)) {
				ctx.now += '/';
			} else {
				if (ctx.source) { throw new SyntaxError('Invalid regular expression flags'); }
				ctx.source = ctx.done + ctx.now;
				ctx.done = ''; ctx.now = '';
			}
		}, ],
	]);
	parser.tokens = new RegExp('(.*?)('+ Array.from(parser.keys()).map(_=>_.source.slice(1, -1)).join('|') +')', '');
	parser.replacers = Array.from(parser.values());

	function parse(parser, ctx, input) {
		const { tokens, } = parser;
		ctx.done = ''; ctx.now = ''; ctx.next = input;
		while (ctx.next) {
			const match = tokens.exec(ctx.next);
			if (!match) { ctx.done += ctx.next; break; }
			ctx.now = match[1];
			ctx.next = ctx.next.slice(match[0].length);
			const token = match[2];
			for (let [ exp, replace, ] of parser) {
				if (!exp.test(token)) { continue; }
				if (replace(ctx, token)) {
					ctx.now += token;
				}
				break;
			}
			ctx.done += ctx.now;
		}
		return ctx;
	}

	parse(parser, ctx, input);
	if (ctx.list) { RegExp('['); } // throws
	if (ctx.source === undefined) {
		ctx.source = ctx.done;
	} else {
		ctx.flags = ctx.done;
	}

	const regExp = ctx.groups.some(_=>_) ? new RegExpNamed(ctx) : new RegExp(ctx.source, ctx.flags);
	regExp.originalSource = input;
	return regExp;
}

class RegExpNamed extends RegExp {
	constructor(ctx) {
		super(ctx.source, ctx.flags);
		this.groups = ctx.groups;
	}
	assignNames(match) {
		match && this.groups.forEach((name, index) => name !== null && match[index] !== undefined && (match[name] = match[index]));
		// console.log('matched', this, match);
		return match;
	}
	[Symbol.match]() {
		const match = super[Symbol.match](...arguments);
		return this.assignNames(match);
	}
	exec() {
		const match = super.exec(...arguments);
		return this.assignNames(match);
	}
}

return RegExpX;

};

if (typeof define === 'function'/* && define.amd*/) {
	define(_module.name.toLowerCase(), [ ], _module);
} else if (typeof exports === 'object' && typeof module === 'object') {
	const result = _module(exports);
	result && (module.exports = result);
} else {
	const result = _module(this[_module.name] = { });
	result && (this[_module.name] = result);
}

})();
