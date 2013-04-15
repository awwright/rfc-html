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
	switch(n){
		case '--page-numbers': pageNumbers=true; break;
		case '--no-page-numbers': pageNumbers=false; break;
		case '--root': rootTag=v; break;
	}
	if(n=='--') break;
	if(n.slice(0,2)=='--'){ console.error('Unknown argument '+arg); continue; }
	files.push(arg);
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
	var indent = 1/0;
	while(1){
		line=peekLine(i);
		if(!line){i++; break;}
		i = line.i+1;
		if(!line.line.length) break;
		blockLines.push(line.line);
		var m = line.line.match(/^( *)/);
		if(m[0].length < indent){
			indent = m[0].length;
		}
	}
	//if(!blockLines.length) return undefined;
	var trimLines = blockLines.map(function(v){return v.substr(indent);});
	//console.error(start, trimLines);
	return {indent:indent, lines:blockLines, trim:trimLines, start:start, i:i};
}

function skipWS(i){
	while(1){
		var line = peekLine(i);
		if(!line || line.line.length) break;
		i = line.i+1;
	}
	return {i:i};
}

function parseDl(start){
	var i = start;
	console.log('<dl id="line-'+start+'">');
	var dtIndent = 3;
	if(config.line[i] && config.line[i].dtIndent){
		dtIndent = parseInt(config.line[i].dtIndent);
	}
	while(1){
		var dtline = peekLine(i);
		if(!dtline || !dtline.line.match(/^ {3}\S/)) break;
		var j = dtline.i+1;
		var dd = [];
		while(1){
			var block = nextBlock(j);
			if(block.indent < 3+dtIndent) break;
			dd.push(block.trim.join('\n'));
			j = block.i;
		}
		if(!dd.length) break;
		console.log('<dt>'+escapeHTML(dtline.line)+'</dt>');
		console.log('<dd>\n'+dd.map(function(v){return '<p>'+escapeHTML(v)+'</p>\n';}).join('')+'</dd>');
		i = skipWS(j).i;
	}
	console.log('</dl>');
	if(i==start) throw new Error('DL unhandled');
	return {i:i}
}

function parseUl(start){
	var i = start;
	console.log('<ul>');
	while(1){
		var block = nextBlock(i);
		if(!block || block.trim[0]===undefined || !block.trim[0].match(/^[-o*]\s+/)) break;

		var lis = [];
		for(var j=0; j<block.trim.length; j++){
			var line = [block.trim[j].substr(2)];
			while(block.trim[j+1] && block.trim[j+1].match(/^\s/)){
				line.push(block.trim[++j]);
			}
			lis.push(line.join('\n'));
		}
		lis.forEach(function(v){
			var p = (lis.length===1)?('<p>'+escapeHTML(v)+'\n</p>'):escapeHTML(v);
			console.log('<li id="line-'+i+'">\n'+p+'</li>');
		});
		i = skipWS(block.i).i;
	}
	console.log('</ul>');
	return {i:i}
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
			console.log('<li>'+escapeHTML(m[4])+'</li>');
		}
	}
	console.log('</ol>');
	return {i:skipWS(block.i).i}
}

function parseOl(start){
	var i = start;
	var className;
	var pattern = /^\d+\.?\s+/;
	if(config.line[i] && config.line[i].className){
		className = config.line[i].className;
	}
	if(config.line[i] && config.line[i].pattern){
		pattern = new RegExp(config.line[i].pattern, config.line[i].patternflags);
	}
	console.log('<ol id="line-'+start+'"'+(className?(' class="'+className+'"'):'')+'>');
	while(1){
		var block = nextBlock(i);
		if(!block || (typeof block.trim[0])!='string') break;
		var m = block.trim[0].match(pattern);
		if(!m) break;
		console.log('<li><p>'+escapeHTML(block.trim.join('\n').substr(m[0].length).trim())+'</p></li>');
		i = skipWS(block.i).i;
	}
	console.log('</ol>');
	return {i:i}
}

function parseABNF(i){
	while(1){
		if(config.line[i] && config.line[i].format && config.line[i].format !=='abnf')  return {i:i};
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

function parseP(i, indent){
	while(1){
		var block = nextBlock(i);
		if(block.indent!==indent) break;
		if(config.line[block.start] && config.line[block.start].format && config.line[block.start].format!=='p') return {i:block.start};
		var html = block.trim.join('\n');
		if(config.xmlentities){
			html = html.replace(/\&\#x([0-9a-f]+)\;/ig, function(a, b){ return String.fromCharCode(parseInt(b, 16)); });
			html = html.replace(/&amp;/ig, '&');
		}
		console.log('<p id="line-'+block.start+'">'+escapeHTML(html)+'\n</p>');
		i = skipWS(block.i).i;
	}
	return {i:i}
}

function parseNote(i, indent){
	console.log('<div class="note" id="line-'+i+'">');
	while(1){
		var block = nextBlock(i);
		if(block.indent!==indent) break;
		i = skipWS(block.i).i;
		console.log('<p>'+escapeHTML(block.trim.join('\n')).replace(/(Notes?:|Warning:)/i,'<span class="nh">$1</span>')+'\n</p>');
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
