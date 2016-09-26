'use strict';

const RegExpX = require('../');


describe('"RegExpX" should', function() {

	it('remove comments', () => {
		RegExpX`#`.should.deep.equal(new RegExp(''));
		RegExpX`a#b`.should.deep.equal((/a/));
		RegExpX`[a#b]{10}`.should.deep.equal((/[a#b]{10}/));
		(() => RegExpX`(a#b){10}`).should.throw(SyntaxError);
	});

	it('keep escaped comments', () => {
		RegExpX`\#`.should.deep.equal((/#/));
		RegExpX`a\#b`.should.deep.equal((/a#b/));
		RegExpX`[a\#b]{10}`.should.deep.equal((/[a\#b]{10}/));
		RegExpX`(a\#b){10}`.should.deep.equal((/(a#b){10}/));
	});

	it('remove comments after escaped comments', () => {
		RegExpX`\##`.should.deep.equal((/#/));
		RegExpX`\#a#b`.should.deep.equal((/#a/));
		RegExpX`\\\#a\\#b`.should.deep.equal((/\\#a\\/));
		RegExpX`\\\#a\\\\#b`.should.deep.equal((/\\#a\\\\/));
		RegExpX`\\\\\\\#a\\\\#b`.should.deep.equal((/\\\\\\#a\\\\/));
		RegExpX`\#[a#b]{10}`.should.deep.equal((/#[a#b]{10}/));
		(() => RegExpX`\#(a#b){10}`).should.throw(SyntaxError);
		(() => RegExpX`\#(a\\\\#b){10}`).should.throw(SyntaxError);
	});

	it('strip whitespaces', () => {
		RegExpX` `.should.deep.equal(new RegExp(''));
		RegExpX`
		`.should.deep.equal(new RegExp(''));
		RegExpX`a bc\\	d`.should.deep.equal((/abc\\d/));
		RegExpX`a
		`.should.deep.equal((/a/));
		RegExpX`a {1,3}`.should.deep.equal((/a{1,3}/));
	});

	it('keep escaped whitespaces', () => {
		RegExpX`\ `.should.deep.equal((/ /));
		RegExpX`\
`.should.deep.equal(new RegExp(String.raw`
`));
		RegExpX`\\\\\ `.should.deep.equal((/\\\\ /));
		RegExpX`\\\\\ \\	`.should.deep.equal((/\\\\ \\/));
		RegExpX`a\ b`.should.deep.equal((/a b/));
		RegExpX`[a b]{10}`.should.deep.equal((/[a b]{10}/));
		RegExpX`[a\ b]{10}`.should.deep.equal((/[a\ b]{10}/));
	});

	it('not just remove spaces within escape sequences', () => {
		(() => RegExpX`${ /(.) \1 23/ }`).should.throw(SyntaxError);
		const exp2 = RegExpX`a{ 1,3}`;
		exp2.test('a{1,3}').should.be.true; // /a{(?:)1,3}/
		exp2.test('aa').should.be.false; // /a{1,3}/

		// TODO: more tests
	});

	it('handle character lists correctly', () => {
		RegExpX`\[a[b\]c]d\[]`.should.deep.equal((/\[a[b\]c]d\[]/));
		RegExpX`\[a\ [b\]\ /c]\ d\[\ ]`.should.deep.equal((/\[a [b\]\ \/c] d\[ ]/));
	});

	it('recognize native flags', () => {
		RegExpX('i')`a`.should.deep.equal((/a/i));
		RegExpX('i')``.should.deep.equal((/(?:)/i));
		RegExpX('')``.should.deep.equal((/(?:)/));
		RegExpX('gim')`a`.should.deep.equal((/a/gim));
		RegExpX({ ignoreCase: true, })``.should.deep.equal((/(?:)/i));
		RegExpX({ multiline: true, })``.should.deep.equal((/(?:)/m));
		RegExpX('gim')({ })``.should.deep.equal((/(?:)/gim));
		RegExpX('gim')({ global: false, })``.should.deep.equal((/(?:)/im));
		RegExpX('u')``.should.deep.equal((/(?:)/u));
		RegExpX({ unicode: true, })``.should.deep.equal((/(?:)/u));
		RegExpX('y')``.should.deep.equal((/(?:)/y));
		RegExpX({ sticky: true, })``.should.deep.equal((/(?:)/y));
		RegExpX('gimuy')`a`.should.deep.equal((/a/gimuy));
		RegExpX('imuy')('g-m-y')`a`.should.deep.equal((/a/giu));
		RegExpX('im')('-mg')`a`.should.deep.equal((/a/gi));
	});

	it('recognize added flags', () => {
		RegExpX('s')`a`.originalFlags.should.equal('s');
		RegExpX('U')`a`.originalFlags.should.equal('U');
		RegExpX('n')`a`.originalFlags.should.equal('n');
		RegExpX({
			singleLine: true, ungreedy: true, noCapture: true, extra: true,
		})`a`.originalFlags.should.equal('nsUX');
		(() => RegExpX({ nocapture: true, })).should.throw(TypeError);
	});

	it('disallow octal escapes (\\123)', () => {
		RegExpX`\0`.should.deep.equal((/\0/));
		RegExpX`\0 1`.should.deep.equal((/\0(?:)1/));
		RegExpX`\0
		9`.should.deep.equal((/\0(?:)9/));
		(() => RegExpX`${ /\1/ }`).should.throw(SyntaxError);
		(() => RegExpX`${ /\01/ }`).should.throw(SyntaxError);
		(() => RegExpX`${ /\001/ }`).should.throw(SyntaxError);
		(() => RegExpX`${ /\901/ }`).should.throw(SyntaxError);
	});

	it(`paste an objects/RegExp's .originalSource/.souce property value`, () => {
		const newLine = /(?:\r\n?|\n)/;
		const sentence = /([\w\.\ 0-9]*)/gim;
		RegExpX`(${ sentence } (<br><\/br>)+ ${ newLine })+`.should.deep.equal((/(([\w\.\ 0-9]*)(<br><\/br>)+(?:\r\n?|\n))+/));
		const noCapture = RegExpX('n')`(.)`;
		RegExpX`a${ noCapture }b`.should.deep.equal((/a(.)b/));
		const named = RegExpX`${ { foo: 'bar', } }`;
		RegExpX`a${ named }b`.exec('abarb').should.have.a.property('foo', 'bar');
	});

	it(`escape string substitutions`, () => {
		const question = '?';
		RegExpX`${ 'Name' } ${ question }`.should.deep.equal((/Name\?/));
	});

	it(`substitute arrays as a list of alternatives`, () => {
		const punctuation = [ '?', '!', '.', ',', ';', ];
		RegExpX`${ 'Name' } ${ punctuation }`.should.deep.equal((/Name(?:\?|!|\.|\,|;)/));
	});

	it(`substitute object as a list of capturing alternatives`, () => {
		const punctuation = { question: '?', exclamation: '!', sentence: '.', };
		RegExpX`${ 'Name' } ${ punctuation }`.should.deep.equal((/Name(?:(\?)|(!)|(\.))/));
	});

	it(`assign groups from substituted object to properties of the match array`, () => {
		const punctuation = { question: '?', exclamation: '!', sentence: '.', };
		const exp1 = RegExpX`${ punctuation }`;
		'?'.match(exp1).should.have.a.property('question', '?');

		const exp2 = RegExpX`${ punctuation }${ punctuation }${ punctuation }`;
		'?!.'.match(exp2).should.contain.all.keys({ question: '?', exclamation: '!', sentence: '.', });

		const exp3 = RegExpX`(\+|-)${{ word: /[A-z]+/, number: /\d+/, }} ( ${{ punctuation: /[?!.]/, }} )?`;
		'+20'.match(exp3).should.have.a.property('number', '20');
		'-hello'.match(exp3).should.have.a.property('word', 'hello');
		exp3.exec('+NO!').should.contain.all.keys({ word: 'NO', punctuation: '!', });
	});

	it(`throw for bad substitution types`, () => {
		(() => RegExpX`a${ null }b`).should.throw(TypeError);
		(() => RegExpX`a${ undefined }b`).should.throw(TypeError);
		(() => RegExpX`a${ 42 }b`).should.throw(TypeError);
		(() => RegExpX`a${ NaN }b`).should.throw(TypeError);
		(() => RegExpX`a${ 0 }b`).should.throw(TypeError);
		(() => RegExpX`a${ function() { } }b`).should.throw(TypeError);
		(() => RegExpX`a${ x => x }b`).should.throw(TypeError);
		(() => RegExpX`a${ Symbol() }b`).should.throw(TypeError);
	});

	it(`accept the 's' (singleLine) flag`, () => {
		RegExpX`.`.should.deep.equal((/./));
		RegExpX({ singleLine: true, })`.`.should.deep.equal((/[^]/));
		RegExpX('s')`.`.should.deep.equal((/[^]/));
		RegExpX('s')`\.`.should.deep.equal((/\./));
		RegExpX('s')`.[.]`.should.deep.equal((/[^][.]/));
		const dot = /./;
		RegExpX('s')`${ dot }[${ dot }]`.should.deep.equal((/[^][.]/));
		RegExpX('s')`${ '.' }[${ dot }]`.should.deep.equal((/\.[.]/));
	});

	it(`accept the 'U' (ungreedy) flag`, () => {
		RegExpX`.*`.should.deep.equal((/.*/));
		RegExpX({ ungreedy: true, })`.*`.should.deep.equal((/.*?/));
		RegExpX('U')`.*`.should.deep.equal((/.*?/));
		RegExpX('U')`.*?`.should.deep.equal((/.*/));
		RegExpX('U')`.+`.should.deep.equal((/.+?/));
		RegExpX('U')`.+?`.should.deep.equal((/.+/));
		RegExpX('U')`.{10}`.should.deep.equal((/.{10}?/));
		RegExpX('U')`.{10}?`.should.deep.equal((/.{10}/));
		RegExpX('U')`.{10,}`.should.deep.equal((/.{10,}?/));
		RegExpX('U')`.{10,}?`.should.deep.equal((/.{10,}/));
		RegExpX('U')`.{10,20}`.should.deep.equal((/.{10,20}?/));
		RegExpX('U')`.{10,20}?`.should.deep.equal((/.{10,20}/));
		RegExpX('U')`[a.{10,20}b]`.should.deep.equal((/[a.{10,20}b]/));
		const more = /.*/;
		RegExpX('U')`${ more }[${ more }]`.should.deep.equal((/.*?[.*]/));
		RegExpX('U')`${ '.*' }[${ more }]`.should.deep.equal((/\.\*[.*]/));
	});

	it(`accept the 'n' (noCapture) flag`, () => {
		RegExpX`(.)`.should.deep.equal((/(.)/));
		RegExpX({ noCapture: true, })`(.)`.should.deep.equal((/(?:.)/));
		RegExpX('n')`(.)`.should.deep.equal((/(?:.)/));
		RegExpX('n')`(?:.)`.should.deep.equal((/(?:.)/));
		RegExpX('n')`(?!.)`.should.deep.equal((/(?!.)/));
		RegExpX('n')`[(.)]`.should.deep.equal((/[(.)]/));
		RegExpX('n')`(.)-${{ char: /\w/ }}`.should.deep.equal((/(?:.)-(?:(\w))/));
		RegExpX('n')`(.)-${{ char: /\w/ }}`.exec('a-b').should.have.a.property('char', 'b');
	});

	it(`accept the 'X' (extra) flag (forbid unnecessary escapes)`, () => {
		[ RegExpX, RegExpX('X') ].forEach(RegExpX => {
			RegExpX`\d\D\w\W\s\S\t\r\n\v\f`.should.deep.equal((/\d\D\w\W\s\S\t\r\n\v\f/));
			RegExpX`\cM`.should.deep.equal((/\cM/));
			RegExpX`\x0F`.should.deep.equal((/\x0F/));
			RegExpX`\u12Af`.should.deep.equal((/\u12Af/));
			RegExpX('u')`\u{12Af}`.should.deep.equal((/\u{12Af}/u));
			RegExpX('u')`\u{12Af7}`.should.deep.equal((/\u{12Af7}/u));
			RegExpX('u')`\ u{12345}`.should.deep.equal((/ u{12345}/u));
		});

		(() => RegExpX({ extra: true, })`\a`).should.throw(SyntaxError);
		(() => RegExpX('X')('u')`\u{12Af7}`).should.not.throw(SyntaxError);
		(() => RegExpX('X')('u')`${ /\u{12 Af}/ }`).should.throw(SyntaxError);
		(() => RegExpX('X')('u')`${ /\u {12Af}/ }`).should.throw(SyntaxError);

		(() => RegExpX('X')`\c M`).should.throw(SyntaxError);
		(() => RegExpX('X')`\a`).should.throw(SyntaxError);
		(() => RegExpX('X')`${ /\x1/ }`).should.throw(SyntaxError);
		(() => RegExpX('X')`${ /\x1G/ }`).should.throw(SyntaxError);
		(() => RegExpX('X')`${ /\x1 F/ }`).should.throw(SyntaxError);
		(() => RegExpX('X')`${ /\u12/ }`).should.throw(SyntaxError);
		(() => RegExpX('X')`${ /\u12 Af/ }`).should.throw(SyntaxError);
		(() => RegExpX('X')(' ')`\u{12Af7}`).should.throw(SyntaxError);

		(() => RegExpX`\c M`).should.not.throw(SyntaxError);
		(() => RegExpX`\a`).should.not.throw(SyntaxError);
		(() => RegExpX`${ /\x1/ }`).should.not.throw(SyntaxError);
		(() => RegExpX`${ /\x1G/ }`).should.not.throw(SyntaxError);
		(() => RegExpX`${ /\x1 F/ }`).should.not.throw(SyntaxError);
		(() => RegExpX`${ /\u12/ }`).should.not.throw(SyntaxError);
		(() => RegExpX`${ /\u12 Af/ }`).should.not.throw(SyntaxError);
		(() => RegExpX(' ')`\u{12Af7}`).should.not.throw(SyntaxError);
		(() => RegExpX('u')`${ /\u {12Af}/ }`).should.not.throw(SyntaxError);
	});

	it(`translate references to captured groups`, () => {
		RegExpX`(.)$1`.should.deep.equal((/(.)\1/));
		RegExpX`(.)$<1>`.should.deep.equal((/(.)\1/));
		RegExpX`(?<char>\w)$1`.should.deep.equal((/(\w)\1/));
		const double = RegExpX`${{ char: /\w/, }}$<char>`;
		double.test('aa').should.be.true;
		double.test('ab').should.be.false;
		double.should.deep.equal((/(?:(\w))\1/));
		RegExpX`(?<char>\w)$<char>`.should.deep.equal((/(\w)\1/));
		RegExpX`(?<char>\w)$ <char>`.should.deep.equal((/(\w)$<char>/));
		RegExpX`(.)[$1]`.should.deep.equal((/(.)[$1]/));
		const sandwich = RegExpX`${{ char: /\w/ }}(?<char>\w)$<char>`;
		sandwich.test('aaa').should.be.true;
		sandwich.test('aba').should.be.true;
		sandwich.test('abb').should.be.false;
		(() => RegExpX`$0`).should.throw(SyntaxError);
		(() => RegExpX`$1`).should.throw(SyntaxError);
		(() => RegExpX('n')`(.)$1`).should.throw(SyntaxError);
		(() => RegExpX`(?<ch ar>\w)$<char>`).should.throw(SyntaxError);
		(() => RegExpX`(? <char>\w)`).should.throw(SyntaxError);
		(() => RegExpX`(?<char>\w)$<ch ar>`).should.throw(SyntaxError);
		(() => RegExpX`${{ $: /\w/ }}`).should.throw(SyntaxError);
		(() => RegExpX`${{ '': /\w/ }}`).should.throw(SyntaxError);
	});

	it('have .originalSource and .originalFlags', () => {
		const exp = RegExpX('imnuy')('g-m-y')`(.)-${{ char: /\w/ }}`;
		exp.should.deep.equal((/(?:.)-(?:(\w))/giu));
		RegExpX(exp.originalFlags)({ raw: [ exp.originalSource ], }).should.deep.equal(exp);
	});

	it('work', () => {
		RegExpX('g')` # flags
			([\n\ ]) # newline or space
			\/ # an escaped slash
			\# # '#'-char
			\# not a comment # but this is
			${ ',?' } # a string substitution
			${{ chars: /\w+/ }} # a implicitly named group
			(?<chars>\w) # explicitly named group withthe same name
			$<chars> # a reference to that group
			$1 # a reference to the first line
			. # match all chars except newline
		`.should.deep.equal((/([\n\ ])\/##notacomment\,\?(?:(\w+))(\w)\2\1./g));

		RegExpX`^(
			 \d\d\d\d (- W[0-5]?\d)?                          # years + optional weeks
			|\d\d\d\d  - [0-1]?\d (- [0-3]?\d)?               # years + months + optional days
			|            [0-1]?\d  - [0-3]?\d                 # months + days
			|\d\d\d\d  - [0-1]?\d  - [0-3]?\d [T ] [0-2]?\d : [0-6]\d (: [0-6]\d (\. \d\d?\d?)?)? ([Z] | [+-] [0-2]?\d : [0-6]\d)? # TODO timezone other then 'Z'
			    # years + months + days + hours + minutes + optional seconds and milliseconds + optional time zone
			|[0-2]?\d : [0-6]\d ( [+-] [0-2]?\d : [0-6]\d)?   # hours + minutes + optional time zone (hh:mm)
			|P \d+ D                                          # duration in days
			|PT \d+ H (\d+ M (\d+ S)?)?                       # duration in hours + minutes + seconds
			# TODO: check duration
		)$`.should.deep.equal((/^(\d\d\d\d(-W[0-5]?\d)?|\d\d\d\d-[0-1]?\d(-[0-3]?\d)?|[0-1]?\d-[0-3]?\d|\d\d\d\d-[0-1]?\d-[0-3]?\d[T ][0-2]?\d:[0-6]\d(:[0-6]\d(\.\d\d?\d?)?)?([Z]|[+-][0-2]?\d:[0-6]\d)?|[0-2]?\d:[0-6]\d([+-][0-2]?\d:[0-6]\d)?|P\d+D|PT\d+H(\d+M(\d+S)?)?)$/));

		RegExpX`^(
			((http s? | mailto) \:\/\/)? (?:
				  [\#\@\&\=\+\$\,\/\?]   # reserved    # not used:  \! \* \' \( \) \; \: \[ \]
				| [\-\_\.\~\w]           # unreserved
				| \%
			)*
		)$`.should.deep.equal((/^(((https?|mailto)\:\/\/)?(?:[\#\@\&\=\+\$\,\/\?]|[\-\_\.\~\w]|\%)*)$/));
	});

});

