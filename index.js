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

	parse(ctx, input);
	if (ctx.list) { RegExp('['); } // throws
	if (ctx.source === undefined) {
		ctx.source = ctx.done;
	} else {
		ctx.flags = ctx.done;
	}

	const regExp = new RegExp(ctx.source, ctx.flags);
	regExp.originalSource = input;
	ctx.groups.some(_=>_) && extendExec(regExp, ctx.groups);
	return regExp;
}

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

const parser = {
	[/\s/](ctx, wsp) { // remove whitespaces or an escaping slash
		if (ctx.list) { return true; }
		if (isEscaped(ctx)) {
			ctx.now = ctx.now.slice(0, -1) + wsp;
		} else {
			const match = (/(.)([^\(\)\[\]\{\}\$\|\*\+\\\?]*?)$/).exec(ctx.now);
			if (!match || isEscaped({ now: ctx.now.slice(0, -match[0].length), })) { return; }
			switch (match[1]) { // insert (?:) if potentially within { }-quantifier or escape sequence
				case '{': ctx.now += '(?:)'; break;
			}
		}
	},
	[/\[/](ctx) { // step into character list
		!ctx.list && !isEscaped(ctx) && (ctx.list = true);
		return true;
	},
	[/\]/](ctx) { // step out of character list
		ctx.list && !isEscaped(ctx) && (ctx.list = false);
		return true;
	},
	[/\./](ctx) { // implement 's' flag
		ctx.now += !ctx.list && ctx.single && !isEscaped(ctx) ? '[^]' : '.';
	},
	[/(?:\*|\+|\{\d+(?:\,\d*)?\})/](ctx) { // implement 'U' flag
		if (!ctx.list && ctx.ungreedy && !isEscaped(ctx)) {
			ctx.next = ctx.next.replace(/^(\?)?/, (_, is) => is ? '' : '?');
		}
		return true;
	},
	[/(?:\$\d|\$<|\\k<)/](ctx, group) { // resolve group references
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
			throw new SyntaxError('Reference to non-existent subpattern "'+ (name || index) +'"');
		}
	},
	[/\(\?</](ctx) { // translate named groups and store references
		if (ctx.list || isEscaped(ctx)) { return true; }
		const match = (/^(\w+)>/).exec(ctx.next);
		if (!match) { throw new SyntaxError('Invalid group structure, expected named group'); }
		if ((/^\d/).test(match[1])) { throw new SyntaxError('Invalid group structure, group name must not begin with a digit'); }
		ctx.groups.push(match[1]);
		ctx.next = ctx.next.slice(match[0].length);
		ctx.now += '(';
	},
	[/\(/](ctx) { // find unnamed groups and ether write references or translate to non-capturing group ('n' flag)
		if (ctx.list) { return true; }
		if ((/^\?/).test(ctx.next)) { return true; }
		if (ctx.nocapture) {
			ctx.now += '(?:';
		} else {
			ctx.groups.push(null);
			return true;
		}
	},
	[/\#/](ctx) { // strip comments
		if (ctx.list) { return true; }
		if (isEscaped(ctx)) {
			ctx.now = ctx.now.slice(0, -1) +'#';
		} else {
			ctx.next = ctx.next.replace(/^.*[^]/, '');
		}
	},
	[/\//](ctx) { // find native flags
		if (ctx.list) { return true; }
		if (isEscaped(ctx)) {
			ctx.now += '/';
		} else {
			if (ctx.source) { throw new SyntaxError('Invalid regular expression flags'); }
			ctx.source = ctx.done + ctx.now;
			ctx.done = ''; ctx.now = '';
		}
	},
	[/\\\d/](ctx, digit) { // forbid octal escapes in the input
		if (ctx.list) { return true; }
		if ((/^\\0$/).test(digit)) {
			if ((/^\s+\d/).test(ctx.next)) { ctx.now += digit +'(?:)'; return; }
			else if ((/^\D|^$/).test(ctx.next)) { return true; }
		}
		throw new SyntaxError('Octal escapes are not allowed');
	},
	[/\\[A-Za-z]/](ctx, letter) { // forbid unnecessary escapes
		if (ctx.list) { return true; }
		letter = letter[1];
		if ((/[dDwWsStrnvf]/).test(letter)) { return true; }
		switch (letter) {
			case 'c': {
				if ((/^[A-Za-z]/).test(ctx.next)) { return true; }
			} break;
			case 'x': {
				if ((/^[0-9A-Fa-f]{2}/).test(ctx.next)) { return true; }
			} break;
			case 'u': {
				if ((/^[0-9A-Fa-f]{4}/).test(ctx.next)) { return true; }
				if ((/^\{[0-9A-Fa-f]{4,5}\}/).test(ctx.next)) { return true; } // TODO: only allow if 'u' flag is set ?
			} break;
		}
		throw new SyntaxError('Unnecessary escape of character "'+ letter +'"');
	},
};
const tokens = new RegExp('(.*?)('+ Object.keys(parser).map(key => '('+ key.slice(1, -1) +')').join('|') +')', '');
const replacers = Object.keys(parser).map(key => parser[key]);

function parse(ctx, input) {
	ctx.done = ''; ctx.now = ''; ctx.next = input;
	while (ctx.next) {
		const match = tokens.exec(ctx.next);
		if (!match) { ctx.done += ctx.next; break; }
		ctx.now = match[1];
		ctx.next = ctx.next.slice(match[0].length);
		const token = match[2];
		const replacer = replacers[match.indexOf(token, 3) - 3];
		if (replacer(ctx, token)) {
			ctx.now += token;
		}
		ctx.done += ctx.now;
	}
	return ctx;
}

const $exec = RegExp.prototype.exec;
const $$match = RegExp.prototype[Symbol.match];

function extendExec(regExp, groups) {
	function assignNames(match) {
		match && groups.forEach((name, index) => name !== null && match[index] !== undefined && (match[name] = match[index]));
		// console.log('matched', this, match);
		return match;
	}
	regExp.exec = function() {
		const match = $exec.apply(this, arguments);
		return assignNames(match);
	};
	if (!$$match) { return; }
	regExp[Symbol.match] = function() {
		const match = $$match.apply(this, arguments);
		return assignNames(match);
	};
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
