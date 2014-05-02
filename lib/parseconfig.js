
module.exports.parseConfig = parseConfig;

function parseConfig(confLines){
	if(typeof confLines=="string"){
		confLines = confLines.split("\n");
	}
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
					//if(!c[j]) c[j]=Object.create(c[k]);
					c[j] = c[j] || {};
					for(var kn in c[k]) c[j][kn]=c[k][kn];
				}
			}
			c = c[k];
		}
		try{
			// If it's not valid JSON, use it as a string
			v = JSON.parse(v);
		}catch(e){
		}
		c[n[i]] = v;
	});
	return config;
}
