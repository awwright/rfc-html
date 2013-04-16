#!/usr/bin/env node
var fs = require('fs');

/* Escape plain text to XML safe for HTML attributes and cdata */
function escapeHTML(text){
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}
function escapeHTMLAttr(text){
	return String(text)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}
var xmlns = 'http://www.w3.org/1999/xhtml';

var pageNumbers = false;
var rootTag = 'html';
var files = [];

var args = process.argv.slice(2);
var arg;
while(typeof (arg=args.shift()) == 'string'){
	var n = arg.split('=',1)[0];
	var v = n.substring(n.length);
	if(n=='--') break;
	switch(n){
		case '--page-numbers': pageNumbers=true; break;
		case '--no-page-numbers': pageNumbers=false; break;
		case '--root': rootTag=v; break;
		default:
			if(n.slice(0,2)=='--'){
				console.error('Unknown argument '+arg);
				continue;
			}
			files.push(arg);
			break;
	}
}
while(typeof (arg=args.shift()) == 'string'){
	files.push(arg);
}

if(!files.length){ console.error('No input files listed.'); return; }
var srcdata = fs.readFileSync(files[0], 'utf8');
var confLines = fs.readFileSync(files[0].replace(/\.txt$/, '.conf'), 'utf8').split('\n');
var lines = srcdata.split(/\n/);

// Parse attached config/markup file
var config = {line: {}};
confLines.forEach(function(l){
	if(!l) return;
	var m = l.split('=',1);
	var v = l.substring(m[0].length+1).trim();
	var n = m[0].trim().split('.');
	var c = config;
	for(var i=0; i<n.length-1; i++){
		var k = n[i];
		if(!c[k]) c[k]={};
		var r = k.match(/^(\d+)-(\d+)$/);
		if(r){
			for(var j=parseInt(r[1]), len=parseInt(r[2]); j<=len; j++){
				if(!c[j]) c[j]=Object.create(c[k]);
			}
		}
		c = c[k];
	}
	try{
		v = JSON.parse(v);
	}catch(e){
	}
	c[n[i]] = v;
});
console.error(config);


function parseHeader(){
	var i = 0;
	// Skip leadin
	while(lines[i].length==0) i++;

	// Parse info and authors (two columns)
	var lcol = [];
	var rcol = [];
	while(lines[i]){
		if(lines[i].length<2) break;
		var parts = lines[i].split(/\s{2,}/);
		if(parts[0]) lcol.push(parts[0]);
		if(parts[1]) rcol.push(parts[1]);
		i++;
	}

	// Parse title
	while(lines[i].length==0) i++;
	var title = lines[i].trim();
	i++;
	while(lines[i].length==0) i++;

	if(rootTag=='html'){
		console.log('<?xml version="1.0" encoding="UTF-8" ?>');
		console.log('<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Strict//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-strict.dtd">');
		console.log('<html xmlns="'+xmlns+'">');
		console.log('<head>');
		console.log('<title>'+escapeHTML(title)+'</title>');
		console.log('<link href="style.css" type="text/css" rel="stylesheet" />');
		console.log('</head>');
		console.log('<body>');
	}
	console.log('<h1>'+escapeHTML(title)+'</h1>');

	// Let's print the document information after the title instead of before
	var date = rcol.pop();
	console.log('<div style="float:left;"><ul>'+lcol.map(function(v){return '<li>'+escapeHTML(v)+'</li>\n';}).join('')+'</ul></div>');
	console.log('<div style="float:right;"><ul>'+rcol.map(function(v){return '<li>'+escapeHTML(v)+'</li>\n';}).join('')+'</ul>'+escapeHTML(date)+'</div>');
	console.log('<div style="clear:both;"></div>');

	return {i:i};
}


function peekLine(i){
	while(1){
		if(lines[i]===undefined) return;
		var page = lines[i+3] && lines[i+3].match(/\[Page (\d+)\]$/);
		if(lines[i+0]=='' && lines[i+4]=='\f'){
			i+=7;
			if(pageNumbers) console.log('<span class="pagenumber">pp'+page[1]+' @'+i+'</span>');
			continue;
		}
		if(config.line[i] && config.line[i].continue){
			i++;
			continue;
		}
		break;
	}
	var line = lines[i] || '';
	if(config.line[i] && config.line[i].unindent){
		var indent = parseInt(config.line[i].unindent);
		while(indent>0 && line[0]==' '){
			line = line.substring(1);
			indent--;
		}
	}
	if(config.line[i] && config.line[i].indent){
		var indent = parseInt(config.line[i].indent);
		if(indent<0) line = line.substring(-indent);
		else{
			for(var j=0; j<indent; j++) line = ' '+line;
		}
	}
	if(config.line[i] && config.line[i].prepend){
		line = config.line[i].prepend + line;
	}
	if(config.line[i] && config.line[i].append){
		line += config.line[i].append;
	}
	//console.error(i+' '+require('util').inspect(line));
	return {i:i, line:line};
}

function nextBlock(i){
	var start = i;
	var line;
	var blockLines = [];
	var blockLineNumbers = [];
	var indent = 1/0;
	while(1){
		line=peekLine(i);
		if(!line){i++; break;}
		i = line.i+1;
		if(!line.line.length) break;
		blockLines.push(line.line);
		blockLineNumbers.push(line.i);
		var m = line.line.match(/^( *)/);
		if(m[0].length < indent){
			indent = m[0].length;
		}
	}
	//if(!blockLines.length) return undefined;
	var trimLines = blockLines.map(function(v){return v.substr(indent);});
	//console.error(start, trimLines);
	return {indent:indent, lines:blockLines, trim:trimLines, lineNumbers:blockLineNumbers, start:start, i:i};
}

function skipWS(i){
	while(1){
		var line = peekLine(i);
		if(!line || line.line.length) break;
		i = line.i+1;
	}
	return {i:i};
}

function parseList(start, opt){
	var i = start;
	var dtIndent = opt.labelIndent;
	if(config.line[i] && config.line[i].dtIndent){
		dtIndent = parseInt(config.line[i].dtIndent);
	}
	var labelPattern = opt.labelPattern;
	if(config.line[i] && config.line[i].labelPattern){
		labelPattern = new RegExp(config.line[i].labelPattern, config.line[i].labelPatternFlags);
	}
	var className = opt.className;
	if(config.line[i] && config.line[i].className){
		className = config.line[i].className;
	}
	console.log('<'+opt.tag+(className?(' class="'+className+'"'):'')+'>');
	while(1){
		if(config.line[i] && config.line[i].format && config.line[i].format!==opt.name) break;
		var dtblock = nextBlock(i);
		if(dtblock.indent < dtIndent) break;
		// Split the dt from the dd at the first sequence of two consecutive whitespaces (which includes newlines)
		var dtm = dtblock.trim[0].match(labelPattern);
		if(!dtm) break;
		var dttext = dtm[0];
		var ddtext = dtblock.trim[0].substring(dttext.length);
		var j = dtblock.i;
		var p = true;
		if(dtblock.trim[1]){
			for(var k=1; k<dtblock.trim.length; k++){
				if(!dtblock.trim[k].match(/^\s/)){
					j = dtblock.lineNumbers[k];
					p = false;
					break;
				}
				ddtext += '\n' + dtblock.trim[k].replace(/^\s+/, '');
			}
			
		}
		var dd = [];
		if(ddtext) dd.push(ddtext);
		// Handle additional paragraphs
		while(1){
			if(config.line[j] && config.line[j].format && config.line[j].format!==opt.name) break;
			var block = nextBlock(j);
			if(!block.trim.length) break;
			if(block.indent <= dtblock.indent) break;
			dd.push(block.trim.join('\n'));
			j = block.i;
		}
		if(!dd.length) break;
		if(opt.labelTag){
			console.log('<'+opt.labelTag+' id="line-'+dtblock.start+'">'+escapeHTML(dttext)+'</'+opt.labelTag+'>');
		}
		if(p){
			console.log('<'+opt.itemTag+'>\n'+dd.map(function(v){return '<p>'+formatBody(v)+'</p>\n';}).join('')+'</'+opt.itemTag+'>');
		}else{
			console.log('<'+opt.itemTag+'>\n'+dd.map(function(v){return formatBody(v)+'\n';}).join('')+'</'+opt.itemTag+'>');
		}
		i = skipWS(j).i;
	}
	console.log('</'+opt.tag+'>');
	if(i==start) throw new Error(opt.tag+' block unhandled on line '+i);
	return {i:i}
}

function parseDl(start){
	var opts =
		{ name: 'dl'
		, tag: 'dl'
		, labelTag: 'dt'
		, labelPattern: /^(\S+ ?)+/
		, labelIndent: 3
		, itemTag: 'dd'
		};
	return parseList(start, opts);
}

function parseUl(start){
	var opts =
		{ name: 'ul'
		, tag: 'ul'
		, labelPattern: /^\(?[-o*\.]\)?\s+/
		, labelIndent: 3
		, itemTag: 'li'
		};
	return parseList(start, opts);
}

function parseOl(start){
	var opts =
		{ name: 'ol'
		, tag: 'ol'
		, labelPattern: /^\(?(\d+)\.?\)?\s+/
		, labelIndent: 3
		, itemTag: 'li'
		};
	return parseList(start, opts);
}

function parseTOC(start){
	var i = start;
	console.log('<ol id="line-'+start+'" class="toc">');
	var block = nextBlock(i);
	for(var j=0; j<block.trim.length; j++){
		var m = block.trim[j].trim().match(/^(([\dA-Z\.]+)(\s+))?(([^\s\.]+[\s\.])+)([\s\.]{2,})(\d+)$/);
		if(!m) continue;
		var section = m[2] && m[2].split('.').filter(function(v){return !!v});
		if(section){
			var sname = 'sec-'+section.join('.');
			console.log('<li><a href="#'+sname+'">'+escapeHTML(m[2])+'</a> '+escapeHTML(m[4])+'</li>');
		}else{
			console.log('<li>'+formatBody(m[4])+'</li>');
		}
	}
	console.log('</ol>');
	return {i:skipWS(block.i).i}
}

function parseABNF(i){
	while(1){
		if(config.line[i] && config.line[i].format && config.line[i].format !=='abnf') return {i:i};
		var block = nextBlock(i);
		// FIXME this line can cause an infinite loop, if the pattern isn't matched
		if(!block.trim[0].match(/^(\S+)( *)=(.*)$/)) break;
		for(var j=0; j<block.trim.length; j++){
			var m = block.trim[j].match(/^(\S+)( *)=(.*)$/);
			//console.error(block.trim[j], m);
			if(!m) continue;
			var dfn = [m[3]];
			while(block.trim[j+1] && block.trim[j+1].match(/^\s/)){
				dfn.push(block.trim[++j]);
			}
			console.log('<div class="gp" id="line-'+(i+j)+'">');
			console.log('<div class="lhs"><span class="nt">'+escapeHTML(m[1])+'</span> <span class="geq">=</span></div>');
			console.log('<div class="rhs">\n'+dfn.map(function(v){return '\t<div>'+escapeHTML(v)+'</div>\n';}).join('')+'</div>');
			console.log('</div>');
		}
		i = skipWS(block.i).i;
	}
	return {i:i}
}

function formatBody(text){
	if(config.xmlentities){
		text = text.replace(/\&\#x([0-9a-f]+)\;/ig, function(a, b){ return String.fromCharCode(parseInt(b, 16)); });
		text = text.replace(/&amp;/ig, '&');
	}
	var html = escapeHTML(text);
	if(1){
		html = html.replace(/(\[([\w\d\-:]+)\])/ig, function(a, b, c){return '[<a href="#bib-'+c+'" class="bib">'+c+'</a>]';});
	}
	if(1){
		// [^] matches any character including newlines
		html = html.replace(/&lt;(http:\/\/[^]+)&gt;/gi, function(a, b){
			b = b.replace(/-\n\s+/g, '').replace(/\s+/g, '');
			return '&lt;<a href="'+b+'">'+b+'</a>&gt;';
		});
	}
	return html;
}


function parseP(i, indent){
	while(1){
		var block = nextBlock(i);
		if(block.indent!==indent) break;
		if(config.line[block.start] && config.line[block.start].format && config.line[block.start].format!=='p') return {i:block.start};
		var html = formatBody(block.trim.join('\n'));
		console.log('<p id="line-'+block.start+'">'+html+'\n</p>');
		i = skipWS(block.i).i;
	}
	return {i:i}
}

function parseBib(i, indent){
	console.log('<dl>');
	while(1){
		var block = nextBlock(i);
		if(block.indent!==indent) break;
		if(config.line[block.start] && config.line[block.start].format && config.line[block.start].format!=='bib') return {i:block.start};
		var text = block.trim.join('\n');
		var m = text.match(/^\[([\w\d\-:]+)\]/);
		if(m){
			console.log('<dt id="bib-'+m[1]+'">'+m[0]+'</dt>');
			var body = formatBody(text.substring(m[0].length));
			body = body.replace(/(RFC ?(\d+))/ig, function(a, b, c){
				return '<a href="'+c+'">'+a+'</a>';
			});
			console.log('<dd>'+body+'</dd>');
		}else{
			var body = formatBody(text);
			console.log('<p id="line-'+block.start+'">'+body+'\n</p>');
		}
		i = skipWS(block.i).i;
	}
	console.log('</dl>');
	return {i:i}
}

function parseNote(i, indent){
	console.log('<div class="note" id="line-'+i+'">');
	while(1){
		var block = nextBlock(i);
		if(block.indent!==indent) break;
		i = skipWS(block.i).i;
		var html = formatBody(block.trim.join('\n'));
		console.log('<p>'+html.replace(/(Notes?:|Warning:)/i,'<span class="nh">$1</span>')+'\n</p>');
	}
	console.log('</div>');
	return {i:i}
}

// Parse the header
var i = parseHeader().i;

// Now, parse body
while(i<lines.length){
	if(config.line[i] && config.line[i].format){
		switch(config.line[i].format){
			case 'toc':
				i = parseTOC(i).i;
				continue;
			case 'dl':
				i = parseDl(i).i;
				continue;
			case 'ul':
				i = parseUl(i).i;
				continue;
			case 'ol':
				i = parseOl(i).i;
				continue;
			case 'art':
			case 'table':
				var block = nextBlock(i);
				console.log('<pre id="line-'+i+'">\n'+escapeHTML(block.trim.join('\n'))+'\n</pre>');
				i = block.i;
				continue;
			case 'abnf':
				i = parseABNF(i).i;
				continue;
			case 'p':
				var block = nextBlock(i);
				i = parseP(block.start, block.indent).i;
				continue;
			case 'bib':
				var block = nextBlock(i);
				i = parseBib(block.start, block.indent).i;
				continue;
			case 'note':
				var block = nextBlock(i);
				i = parseNote(block.start, block.indent).i;
				continue;
			default:
				var block = nextBlock(i);
				console.error('Unknown handler %s for line %d', config.line[i].format, block.start);
				break;
		}
	}

	var block = nextBlock(i);
	if(!block) break;
	//console.error(block);

	if(block.indent===0){
		var text = block.trim.join('').trim();
		var headnumber = text.match(/^([0-9\.]+) (.*)/);
		if(headnumber && headnumber[1]){
			var levels = headnumber[1].split('.').filter(function(v){return !!v});
			var sname = 'sec-'+levels.join('.');
			var level = (levels && levels.length && (levels.length+1)) || 2;
			console.log('<h'+level+' id="'+sname+'" class="line-'+block.start+'"><span class="secnum">'+escapeHTML(headnumber[1])+'</span> '+escapeHTML(headnumber[2])+'</h'+level+'>');
		}else{
			console.log('<h2 class="line-'+block.start+'">'+escapeHTML(block.lines[0].trim())+'</h2>');
		}
		i = block.i;
		continue;
	}

	// Definition lists
	if(block.indent===3 && block.trim[1] && block.trim[1].match(/^   \S/)){
		i = parseDl(block.start).i;
		if(block.start!=i) continue;
	}

	// Unordered lists
	if(block.indent>4 && block.trim[0] && block.trim[0].match(/^[-o*]\s+/)){
		i = parseUl(block.start).i;
		if(block.start!=i) continue;
	}

	// Ordered lists
	if(block.indent>4 && block.trim[0] && block.trim[0].match(/^\d+\.?\s+/)){
		i = parseOl(block.start).i;
		if(block.start!=i) continue;
	}

	// Note asides
	if(block.indent>3 && block.trim[0] && block.trim[0].match(/^Notes?:/i)){
		i = parseNote(block.start, block.indent).i;
		continue;
	}

	// ABNF blocks
	if(block.indent>3 && block.trim[0] && block.trim[0].match(/^(\S+)( +)=(.*)$/)){
		i = parseABNF(block.start).i;
		continue;
	}

	if(block.indent===3){
		i = parseP(block.start, block.indent).i;
		continue;
	}

	if(block.trim.length){
		console.log('<pre id="line-'+block.start+'">\n'+escapeHTML(block.trim.join('\n'))+'\n</pre>');
	}
	i = block.i;
	continue;
}

if(rootTag=='html'){
	console.log('</body></html>');
}
