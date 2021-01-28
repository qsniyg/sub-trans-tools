var fs = require("fs");

var readfile = function(path) {
	return fs.readFileSync(path).toString();
};

var html = readfile(process.argv[2]);

var loop_replace = function(text, replace) {
	var changed;
	do {
		var newtext = replace(text);

		changed = false;
		if (newtext !== text) {
			changed = true;
			text = newtext;
		}
	} while (changed);

	return text;
};

// remove <font></font>
html = html.replace(/<font(?:\s+(?:style|class)="[^"]*")*>(\s*)<\/font>/g, "$1");

// <font color="#ffffff"><font style="vertical-align: inherit;"><font style="vertical-align: inherit;">Big Buck Bunny</font></font></font>
// to:
// <font color="#ffffff">Big Buck Bunny</font>
html = loop_replace(html, function(html) {
	return html.replace(/<font style="vertical-align: inherit;"(?: class="")?>([^<]*)<\/font>/g, "$1");
});

// <font style="vertical-align: inherit;"><font color="#ffffff">Big </font><font color="#ffffff">buck </font></font><font color="#ffffff">bunny.</font>
// to:
// <font color="#ffffff">Big </font><font color="#ffffff">buck </font><font color="#ffffff">bunny.</font>
html = html.replace(/<font style="vertical-align: inherit;">((?:<font[^>]*>[^<]*<\/font>)+)<\/font>/g, "$1");

// <font color="#ffffff">Big </font><font color="#ffffff">buck </font><font color="#ffffff">bunny.</font>
// to:
// <font color="#ffffff">Big buck bunny.</font>
html = loop_replace(html, function(html) {
	return html.replace(/<font color="([^"]+)">([^<]*)<\/font><font color="\1">([^<]*)<\/font>/g, "<font color=\"$1\">$2$3</font>");
});

var has_bom = false;

// remove byte order mark
if (/^\ufeff/.test(html)) {
	html = html.replace(/^\ufeff/, "");
	has_bom = true;
}

// replace \r\n to \n
html = html.replace(/\r\n/g, "\n");

// remove trailing spaces
html = html.replace(/ *\n/g, "\n");

var parse_srt = function(srt, broken) {
	// 1                             [1]
	// 00:50:01,234 --> 00:50:02,567 [2]
	// Big buck bunny                [3]
	//                               [4]

	var stage = 1;

	var subtitles = [];
	var obj = {};
	var lastid = null;

	var lines = srt.split("\n");

	for (var i = 0; i < lines.length; i++) {
		var line = lines[i];

		if (stage === 1) {
			// empty line
			if (subtitles.length && !line.length) continue;

			var id = null;

			if (broken) {
				var match = line.match(/^([0-9]+)(?:nd|th|st)?$/);
				if (match) id = match[1];
			} else {
				var match = line.match(/^([0-9]+)$/);
				if (match) id = match[1];
			}

			if (!id) {
				console.error("Invalid ID at line", i + 1, ":", line);
				return null;
			}

			obj.id = parseInt(id);
			obj.line = i;

			if (lastid !== null) {
				if (obj.id - lastid !== 1) {
					console.error("Wrong ID order at line", i + 1, ":", line);
					return null;
				}
			}
			lastid = obj.id;

			stage++;
		} else if (stage === 2) {
			var timestamp = null;

			if (broken) {
				// try to repair it

				// 00: 00: 00.00 -&gt; 00: 00: 05,510
				// to
				// 00: 00: 00.00 -> 00: 00: 05,510
				line = line.replace(/&gt;/g, ">");

				// 00: 00: 00.00 -> 00: 00: 05,510
				// to
				// 00: 00: 00.00 --> 00: 00: 05,510
				line = line.replace(/ -> /, " --> ");

				// 00: 00: 00.00 --> 00: 00: 05,510
				// to
				// 00:00:00.00 --> 00:00:05,510
				line = loop_replace(line, function(line){return line.replace(/([0-9]{2})(?::\s+|\s+:|\s+:\s+)([0-9]{2})/g, "$1:$2");});

				// 00:00:00.00 --> 00:00:05,510
				// to
				// 00:00:00,000 --> 00:00:05,510
				//line = line.replace(/(:[0-9]{2})[,.]([0-9]{2})( -->)/, "$1,$20$3");

				// 00:00:00.000 --> 00:00:05,510
				// to
				// 00:00:00,000 --> 00:00:05,510
				line = line.replace(/(:[0-9]{2})\.([0-9]{2,3})( -->)/, "$1,$2$3");

				// 00:22:30,500 --> 00:22:34.360
				// to
				// 00:22:30,500 --> 00:22:34,360
				line = line.replace(/(:[0-9]{2})\.([0-9]{2,3})$/, "$1,$2");

				// 00:22:30,500 --> 00:22:34.36
				// to
				// 00:22:30,500 --> 00:22:34,360
				//line = line.replace(/(:[0-9]{2}),([0-9]{2})$/, "$1,$20");
			}

			var match = line.match(/^([0-9]{2}(?::[0-9]{2}){2},[0-9]{2,3} --> [0-9]{2}(?::[0-9]{2}){2},[0-9]{2,3})$/);
			if (!match) {
				console.error("Broken timestamp at line", i + 1, ":", line);
				if (!broken) return null; // todo: only ignore error if proper subtitle is available
			}

			if (match) obj.timestamp = match[1];

			stage++;
		} else if (stage === 3) {
			if (line.length === 0) {
				subtitles.push(obj);

				obj = {};
				stage = 1;
				continue;
			}

			if (!("lines" in obj)) obj.lines = [];
			obj.lines.push(line);
		}
	}

	if (stage === 3) {
		subtitles.push(obj);
	} else if (stage !== 1) {
		console.error("Invalid last line", line);
		return null;
	}

	return subtitles;
};

var stringify_srt = function(subtitles) {
	var lines = [];

	for (var i = 0; i < subtitles.length; i++) {
		var subtitle = subtitles[i];

		lines.push(subtitle.id);
		lines.push(subtitle.timestamp);
		[].push.apply(lines, subtitle.lines);
		lines.push("");
	}

	lines.push("");

	return lines.join("\r\n");
};

// todo: add option to parse the original subtitle file too, then replace lines for matching ids/timestamps
var parsed = parse_srt(html, true);

var write_out = function(out) {
	if (has_bom) process.stdout.write("\ufeff");

	process.stdout.write(out);
};

if (!parsed) {
	write_out(html);
} else {
	write_out(stringify_srt(parsed));
}
