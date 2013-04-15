# RFC to HTML converter

Once upon a time, standards specifications were published as plain text documents, to be printed on character printers.
Ones with monospaced fonts and a set number of lines per page.
And no graphics, except ASCII art.

This era is behind us, but relics of this age remain.

This nifty program converts the plain-text RFCs to HTML.

## Getting Started

You can download all the RFCs in use by this repository:

    $ make download

Then, generate their HTML files:

    $ make -k

(The `-k` option tells make to keep going even if one of the files produces an error. If you're really adventurous, try `-j`)

## Configuration file format

The .conf files annotate the .txt files with metadata. They can be used to imbue the RFC with all sorts of semantic information.

The file is a newline-seperated list of configuration directives, in key=value format. The key is a property path, seperated by a period. The value is a JSON value or any string.

For instance, declaring a portion to be a definition list or a table, or ASCII art, etc.

    line.64.format = toc

This declares that the section which starts on line 64 is a Table of Contents.

The formatters are:

 * toc (Table of Contents)
 * dl (Definition list)
 * abnf (an ABNF grammar definition, a type of definition list)
 * ul (unordered list)
 * ol (ordered list)
 * art (ASCII art)
 * table (An ASCII art table)
 * p (Standard paragraph)
 * note (An aside/note paragraph)

Normally the formatter can make pretty good guesses as to which section is what type. Lines without any indenting are headings, lines with three spaces indent are paragraphs.

It can also be used to correct formatting mistakes, and specify the formatting conventions used (which vary from file to file).

A range of lines can be specified to be modified:

    line.40-50.unindent = 3

This removes up to three spaces from the beginning of lines 40 through 50 inclusive.

    line.40-50.indent = 3

The indent property adds leading spaces to a line. If negative, it chops off that many characters, spaces or not. (To remove only spaces, use the "unindent" property.)

    line.40-50.append = string
    line.40-50.prepend = string

Appends and prepends content (for now you can't use this to add whitespace, since that is stripped in the course of parsing the config file).

Normally page breaks will create a new section (Perhaps by default they shouldn't create a new section unless explicitly specified, but whatever).
If you want to define that a page break should be ignored, then you must specify so. The second blank line after the heading, the one before the page body starts, is normally counted, and so needs to be set to be ignored:

    line.1234.continue = 1

This will tell the parser to skip over that line as if it doesn't exist.
Normally the three lines at the end of the page, before the footer, are ignored, if there are more than three blank lines due to orphan control, those need to be explicitly ignored as well.
