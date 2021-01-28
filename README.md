Personal helper tool for translating subtitles.

Workflow:

 * Upload the subtitle to a pastebin that allows viewing the raw file (such as pastebin.com)
 * Copy a link to the raw file to Google Translate
   * For example: `https://translate.google.com/translate?sl={source language}&tl={translated language}&u=https://pastebin.com/raw/...`
 * Copy the source code of the translated page into a text file
   * Right click->Inspect (Element) within the frame
   * Scroll up to the `<pre>` element within the iframe, right click->Store as global variable
   * Run `copy(temp1.innerHTML)` in the console to copy the contents
   * Paste into a text file
 * Run `node fixsrt.js path/to/file.txt > output`
   * If there are any errors printed, fix them in the generated output file, then run it again with the output file as the source: `node fixsrt.js output > output1`

This is meant as a quick and dirty way to translate subtitles, without requiring API keys or website scraping. It is not intended to replace other automatic subtitle translation tools.

Due to the rather volatile nature of automated translation tools, fixsrt.js is not guaranteed to be able to accurately restore the format.
A future direction is to create a script that will prepare an intermediate file that, once translated, can be accurately restored to an acceptable format with the help of the original subtitle file.