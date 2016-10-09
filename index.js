(() => { 'use strict'; const factory = function RegExpX(exports) { // This Source Code Form is subject to the terms of the Mozilla Public License, v. 2.0. If a copy of the MPL was not distributed with this file, You can obtain one at http://mozilla.org/MPL/2.0/.

const native_name2flag = {
	'global': 'g',
	'ignoreCase': 'i',
	'multiline': 'm',
	'unicode': 'u',
	'sticky': 'y',
};

const added_name2flag = {
	'noCapture': 'n',
	'singleLine': 's',
	'ungreedy': 'U',
	'extra': 'X',
};

const name2flag = Object.assign(added_name2flag, native_name2flag);

const flag2name = {
	'n': 'noCapture',
	's': 'singleLine',
	'U': 'ungreedy',
	'X': 'extra',

	'g': 'global',
	'i': 'ignoreCase',
	'm': 'multiline',
	'u': 'unicode',
	'y': 'sticky',
};

const instances = new WeakSet;

/**
 * Transforms a template string into a RegExp object. May be called in two different ways:
 *
 * - to specify flags / options call like a normal function:
 *     @param  {string|object}  options  Either a string of flag characters or an object of flags properties.
 *         Examples:
 *             'i' adds the native case insensitivity flag.
 *             'gimuy' adds all native flags.
 *             'g-im-uy' adds the flags 'g', 'm' and 'y', and removes the flags 'i' and 'u'.
 *             { global: true, } adds the native 'g' flag.
 *             { ungreedy: false, } removes the 'U' flag (if previously added).
 *             'o' would add 'o' as a (unrecognised) native flag (which probably throws in the RegExp constructor).
 *     @return {function}                The RegExpX function with the new options bound.
 *                                       Can now be used to create RexExp objects with these options or can have more options bound.
 *
 * - to create a RegExp object call as a template string tag function:
 *     Since it uses the template strings '.raw' property, no additional escaping compared to regular RegExp literal is required,
 *     except that whitespaces and '#' characters that are not to be removed need to be escaped.
 *     Note: The sequence '${' needs to be escaped to '\${' or '$\{' and will then appear as '\${' or '$\{' in the resulting RegExp.
 *     @param  {object}  hasRaw          An object with a .raw property which is an array of strings.
 *     @param  {...any}  substitutions   Additional values to substitute into the template string.
 *     @invariant                        substitutions.length must be exactly hasRaw.raw.length - 1.
 *     @return {RegExp}                  Enhanced RexExp object.
 */
const RegExpX = function RegExpX(/* options */) {
	const options = this && typeof this.otherFlags === 'string' ? Object.assign({ }, this) : { otherFlags: '', };

	// not called as template string processor
	if (!(typeof arguments[0] === 'object' && typeof arguments[0].raw === 'object' && arguments[0].raw.length === arguments.length)) {
		if (typeof arguments[0] === 'string') {
			// replace options by those encoded in the string
			const left = arguments[0].replace(/(-?)([A-Za-z])/g, (_, remove, flag) => ((flag2name[flag]
				? options[flag2name[flag]] = !remove
				: options.otherFlags = options.otherFlags.replace(new RegExp(flag +'|$'), remove ? '' : flag)
			), ''));
			if (!(/^\s*$/).test(left)) { throw new SyntaxError('Unrecognised characters in RegExpX flags: "'+ left +'"'); }
			return RegExpX.bind(options);
		} else if (typeof arguments[0] === 'object') {
			// add new options, overwriting existing ones
			const source = arguments[0];
			Object.keys(source).forEach(key => { if (name2flag.hasOwnProperty(key)) {
				options[key] = source[key];
			} else {
				throw new TypeError('Unrecognised RegExpX option "'+ key +'"');
			} });
			return RegExpX.bind(options);
		}
		throw new TypeError('RegExpX must be called like String.raw() or with a string or object as options');
	}

	// called as template string processor, get bound options
	const ctx = { options, groups: [ null, ], };

	// concat input
	for (let i = 1, l = arguments.length; i < l; ++i) {
		arguments[i] = substitute(arguments[i], i);
	}
	const input = String.raw.apply(String, arguments); // get the string exactly as typed ==> no further escaping necessary

	parse(ctx, input);
	if (ctx.list) { RegExp('['); } // throws 'unterminated character class'
	const source = ctx.done;
	const flags = Object.keys(native_name2flag).map(name => options[name] ? native_name2flag[name] : '').join('') + options.otherFlags;

	const regExp = new RegExp(source, flags);
	setHiddenConst(regExp, 'originalSource', input);
	setHiddenConst(regExp, 'originalFlags', flags + Object.keys(added_name2flag).map(name => options[name] ? added_name2flag[name] : '').join(''));
	ctx.groups.some(_=>_ != null) && extendExec(regExp, ctx.groups);
	instances.add(regExp);
	return regExp;
}.bind(null);

function substitute(arg, pos) {
	if (typeof arg === 'string') { return escape(arg); }
	if (typeof arg !== 'object') { throw new TypeError(`Bad type for substitution value: ${ typeof arg } at value ${ pos }`); }
	if (typeof arg.originalSource === 'string') { return arg.originalSource; }
	if (typeof arg.source === 'string') { return arg.source; }
	if (Array.isArray(arg)) {
		return '(?:'+ arg.map(item => substitute(item, pos)).join('|') +')';
	}
	return '(?:'+ Object.keys(arg).map(key => {
		if (!(/^[A-Za-z_]\w*$/).test(key)) { throw new SyntaxError('Invalid group structure, group name must be words and not begin with a digit'); }
		return '(?<'+ key +'>'+ substitute(arg[key], pos) +')';
	}).join('|') +')';
}

function escape(string) {
	return string.replace(/[\-\[\]\{\}\(\)\*\+\?\.\,\\\/\^\$\|\#\s]/g, '\\$&');
}

function isEscaped(ctx) {
	return isEscapeingAt(ctx.now, ctx.now.length);
}
// checks whether the string is escaping the char at index
function isEscapeingAt(string, index) {
	if (index === 0) { return false; }
	let i = index - 1, found = 0;
	while (
		i >= 0 && string[i] === '\\'
	) { --i; }
	return (index - i) % 2 === 0;
}

const parser = {
	[/\s/](ctx, wsp) { // remove whitespaces or an escaping slash
		if (ctx.list) { return true; }
		if (isEscaped(ctx)) {
			ctx.now = ctx.now.slice(0, -1) + wsp;
		} else {
			let s = ctx.now, i = s.length;
			while (
				i >= 0 && (/[^\(\)\[\]\{\}\$\|\*\+\\\?]/).test(s[i])
			) { --i; }
			if (i < 0 || isEscapeingAt(s, i)) { return; }
			switch (s[i]) { // insert (?:) if potentially within { }-quantifier or escape sequence
				case '{': ctx.now += '(?:)'; break;
				case '\\': switch (s[i + 1]) {
					case 'c': s.length - i <= 2 && (ctx.now = s.slice(0, i) + s.slice(i + 1)); break;
					case 'x': s.length - i <= 3 && (ctx.now = s.slice(0, i) + s.slice(i + 1)); break;
					case 'u': s.length - i <= 5 && (ctx.now = s.slice(0, i) + s.slice(i + 1)); break;
				}
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
		ctx.now += !ctx.list && ctx.options.singleLine && !isEscaped(ctx) ? '[^]' : '.';
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
			throw new SyntaxError('Reference to non-existent sub pattern "'+ (name || index) +'"');
		}
	},
	[/\(\?>/](ctx) { // replace atomic groups with capturing lookaheads
		if (ctx.list || isEscaped(ctx)) { return true; }
		let s = ctx.next, i = 0, l = s.length, level = 1, skip = false;
		while (i < l && level > 0) { switch (s[i]) {
			case '[': !isEscapeingAt(s, i) && (skip = true); break;
			case ']': !isEscapeingAt(s, i) && (skip = false); break;
			case '(': !skip && !isEscapeingAt(s, i) && ++level; break;
			case ')': !skip && !isEscapeingAt(s, i) && --level; break;
		} ++i; }
		const contents = ctx.next.slice(0, i - 1);
		ctx.next = ctx.next.slice(i);
		const index = ctx.groups.push(false) - 1;
		ctx.next = contents +'))\\'+ index + ctx.next;
		ctx.now += '(?=(';
	},
	[/(?:\*|\+|\?|\{\d+(?:\,\d*)?\})/](ctx, found) { // implement 'U' flag and replace possessive quantifiers with capturing lookaheads
		if (ctx.list || isEscaped(ctx)) { return true; }
		if (ctx.next[0] !== '+') {
			if (ctx.options.ungreedy) { // 'U' flag
				if (ctx.next[0] === '?') {
					ctx.next = ctx.next.slice(1);
				} else {
					ctx.now = ctx.now + found + '?';
					return false;
				}
			}
			return true;
		}
		// possessive quantifiers
		ctx.now = ctx.done + ctx.now; ctx.done = '';
		let s = ctx.now, i = s.length - 1, back = 0;
		switch (true) {
			case s[i] === ']': {
				do {
					i = s.lastIndexOf('[', i - 1);
				} while (isEscapeingAt(s, i));
			} break;
			case s[i] === ')' && !isEscapeingAt(s, i): {
				let level = 1, skip = false;
				while (i >= 0 && level > 0) { --i; switch (s[i]) {
					case ']': !isEscapeingAt(s, i) && (skip = true); break;
					case '[': !isEscapeingAt(s, i) && (skip = false); break;
					case ')': !skip && !isEscapeingAt(s, i) && ++level; break;
					case '(': if (!skip && !isEscapeingAt(s, i)) {
						s[i + 1] !== '?' && ++back;
						--level;
					} break;
				} }
			} break;
			default: {
				i -= isEscapeingAt(s, i);
			}
		}
		const contents = ctx.now.slice(i) + found;
		ctx.now = ctx.now.slice(0, i);
		const index = ctx.groups.length - back;
		ctx.groups.splice(index, 0, false);
		ctx.next = ctx.next.slice(1);
		ctx.now += '(?=('+ contents +'))\\'+ index;
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
		if (ctx.list || isEscaped(ctx)) { return true; }
		if ((/^\?/).test(ctx.next)) { return true; }
		if (ctx.options.noCapture) {
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
	[/\\\d/](ctx, found) { // forbid octal escapes in the input
		if (ctx.list) { return true; }
		const digit = found[1];
		if (digit === '0') {
			if ((/^\s+\d/).test(ctx.next)) { ctx.now += found +'(?:)'; return; }
			else if ((/^\D|^$/).test(ctx.next)) { return true; }
			// throw new SyntaxError('Octal escapes are not allowed');
		}
		const index = +(digit + (/^\d*/).exec(ctx.next)[0]);
		if (ctx.groups[index] === false) { return true; }
		throw new SyntaxError('Octal escapes are not allowed');
	},
	[/\\[A-Za-z]/](ctx, found) { // forbid unnecessary escapes
		if (!ctx.options.extra) { ctx.next = found + ctx.next; return 2; }
		const letter = found[1];
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
				if ((/^\{[0-9A-Fa-f]{4,5}\}/).test(ctx.next)) {
					if (ctx.options.unicode) { return true; }
					throw new SyntaxError('Unnecessary escape of character "u" (u flag required)');
				}
			} break;
		}
		throw new SyntaxError('Unnecessary escape of character "'+ letter +'"');
	},
};
const tokens = new RegExp('(.*?)('+ Object.keys(parser).map(key => '('+ key.slice(1, -1) +')').join('|') +')', 'g');
const replacers = Object.keys(parser).map(key => parser[key]);

function parse(ctx, input) {
	ctx.done = ''; ctx.now = ''; ctx.next = input;
	let skip = 0;
	while (ctx.next) {
		tokens.lastIndex = skip;
		const match = tokens.exec(ctx.next);
		if (!match) { ctx.done += ctx.next; break; }
		ctx.now = ctx.next.slice(0, skip) + match[1];
		ctx.next = ctx.next.slice(skip + match[0].length);
		const token = match[2];
		const replacer = replacers[match.indexOf(token, 3) - 3];
		const res = replacer(ctx, token);
		if (res === true) {
			ctx.now += token;
			skip = 0;
		} else {
			skip = res || 0;
		}
		ctx.done += ctx.now;
	}
	return ctx;
}

const $exec = RegExp.prototype.exec;
const $$match = Symbol.match && RegExp.prototype[Symbol.match];

function extendExec(regExp, groups) {
	function assignNames(match) {
		if (!match) { return match; }
		for (let i = 0, r = 0, l = match.length; i < l; ++i) {
			if (groups[i] === false) { match.splice(i - r++, 1); }
			else if (groups[i] && match[i - r] !== undefined) { match[groups[i]] = match[i - r]; }
		}
		return match;
	}
	setHiddenConst(regExp, 'exec', function exec() {
		const match = $exec.apply(this, arguments);
		return assignNames(match);
	});
	$$match && setHiddenConst(regExp, Symbol.match, function() {
		const match = $$match.apply(this, arguments);
		return assignNames(match);
	});
}

function setHiddenConst(object, key, value) {
	return Object.defineProperty(object, key, { value, writable: false, enumerable: false, configurable: false, });
}

const $compile = RegExp.prototype.compile;
RegExp.prototype.compile = function() {
	if (instances.has(this)) {
		throw new TypeError('RegExpX objects can not be recompiled');
	}
	return $compile.apply(this, arguments);
};

return (RegExpX.RegExpX = RegExpX);

}; /* istanbul ignore next */ if (typeof define === 'function' && define.amd) { define([ 'exports', ], factory); } else { const exp = { }, result = factory(exp) || exp; if (typeof exports === 'object' && typeof module === 'object') { module.exports = result; } else { window[factory.name] = result; } } })();
