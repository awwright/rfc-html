#!/bin/bash
for f in src/*.conf; do
	out=${f%.conf}.txt
	echo dl ${f#src/}
	curl http://www.ietf.org/rfc/${out#src/} > $out
	patch=${f%.conf}.patch
	if [ -f $patch ]; then
		echo Patch $out...
		patch $out $patch
	fi
done;
