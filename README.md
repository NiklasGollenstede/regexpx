This module exports a single function which turns template strings into RegExp objects, with the following benefits:

## New flags
It adds support for the additional regular expression flags `n`, `s`, `U`, `x`, and `X` known from other languages:
- `n`/`noCapture`: Turns all unnamed capturing groups into non-capturing groups.
- `s`/`singleLine`: Makes the . match newline characters.
- `U`/`ungreedy`: Makes all greedy quantifiers ungreedy, and all ungreedy quantifiers greedy.
- `x`/`extended`: Whitespaces and comments after # are ignored unless escaped. Is active by default and (currently) cant be turned off.
- `X`/`extra`: Forbid unnecessary escapes. A `\` followed by a character (sequence) without special meaning is a SyntaxError.

## New syntax:
It adds support for the additional regular expression features:
- Named capturing groups: ...
- Forbid octal escapes in the input:
    <BR>Octal escapes are generally confusing and even more so in regular expressions.
    <BR>The `\1` in `/(.)\1/` is a reference to the capturing group `(.)`, in `/[.]\1/` it is the char with code `1`.
    <BR>Therefore, and because octal escapes in template strings are (currently) SyntaxErrors themselves, thy are not allowed by RegExpX.
    <BR>To reference unnamed capturing groups, use `$1` or `\k<0>`

## Substitutions:
...
- string: ...
- RegExp: ...
- array: ...
- object: ...

## API:
```js
const RegExpX = require('regexpx') || window.RegExpX; // CommonJS
/**
 * Transforms a template string into a RegExp object. May be called in two different ways:
 *
 * - to specify flags / options:
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
```

## Examples:
...
