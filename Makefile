FILES=$(wildcard src/rfc*.txt)

all: $(FILES:src/%.txt=%.html)

list:
	@echo $(FILES)

rfc%.html: src/rfc%.txt src/rfc%.conf generate.js
	node generate.js $< > $@

distclean:
	rm -f rfc*.html src/rfc*.txt

clean:
	rm -f rfc*.html

download:
	bash dl.sh
