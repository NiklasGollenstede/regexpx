
Turns a template string containing an extended RegExp, which may contain uninterpreted whitespaces
and # comments, into a regular RegExp object.
Must be called as a template string tagging function.
Since it uses the template strings '.raw' property, no additional escaping compared to regular RegExp
literal is required, except that whitespaces and '#' characters that are not to be removed need to be escaped.
Note: The sequence '${' needs to be escaped to '\${' or '$\{' and will then appear as '\${' or '$\{' in the resulting RegExp.
The usual flags 'gim(uy)' may follow the RegExp itself after a closing '/'.
Example:
```
    RegExpX`a` <= same as => /a/
    RegExpX`a/i` <= same as => /a/i
    RegExpX`[\n\ ] # newline or space
            \/ # an escaped slash
            \# not a comment
            /g` <= same as => /[\n\ ]\/##notacomment/g
    RegExpX`^ . * ? x / g i m` <= smae as => /^.*?x/gim
```
As a plus, you can also use variables in your RegExp's, e.g.:
```
    const newLine = /[\r\n]/;
    const sentence = /([\w\.\ 0-9]*)/; // (modifiers ignored)
    RegExpX`(${ sentence } (<br><\/br>)+ ${ newLine })+` <= same as => /(([\w\. 0-9]*)(<br><\/br>)+[\r\n])+/
```
