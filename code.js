function convertCreditLoan() {
    init('CL');
}

function convertQuote() {
    init('QT');
}

function init(site) {
    var body = DocumentApp.getActiveDocument().getBody(),
        numChildren = body.getNumChildren(),
        output = [],
        images = [],
        listCounters = {},
        config = {
            CL: {
                imagePath: 'https://content.creditloan.com/wp-content/uploads/'
            },
            QT: {
                imagePath: 'https://content.quote.com/wp-content/uploads/'
            }
        },
        imagePath = config[site].imagePath || '';

    // Walk through all the child elements of the body.
    for (var i = 0; i < numChildren; i++) {
        var child = body.getChild(i);
        
        output.push(processItem(child, listCounters, images, imagePath));
    }

    var html = output.join('\r');

    html = cleanOutput(html);
    
    emailHtml(html, images);
}

function emailHtml(html, images) {
    var attachments = [],
        documentName = DocumentApp.getActiveDocument().getName(),
        name = cleanFilename(documentName) + '.html';

    // image attachments
    for (var j=0; j<images.length; j++) {
        attachments.push( {
            "fileName": images[j].name,
            "mimeType": images[j].type,
            "content": images[j].blob.getBytes()
        });
    }

    // the html document attachment
    attachments.push({
        "fileName": name,
        "mimeType": "text/html",
        "content": html
    });

    // send the email
    MailApp.sendEmail({
        to: Session.getActiveUser().getEmail(),
        subject: name,
        body: 'Your converted, sanitized HTML is attached! :)',
        attachments: attachments
     });
}

/*
 * Cleans up output
 */
function cleanOutput(output) {
    var output = output // first, convert to lowercase

    // encode ampersands
    .replace(/&/g, '&amp;')

    // encode mdashes
    .replace(/—/g, '&mdash;')

    // convert single smart quotes
    .replace(/’/g, '\'')

    // convert double smart quotes
    .replace(/(“|”)/g, '"')

    // convert nbsp to spaces (nbsp should not be used for forcing layout)
    .replace(/&nbsp;/g, ' ')

    // remove empty list items
    .replace(/<li><\/li>/gi, '')

    // remove empty strong tags containing only line breaks/carriage returns
    .replace(/<strong>\s+<\/strong>/gi, '')

    // remove empty shortcode tags
    .replace(/(\[.*\])\s*(\[\/\w*\])/g, '')

    // don't wrap [shortcodes][/shortcodes] in <p> tags
    .replace(/<p>\s*?(\[.*\]\s*?.*\s*?\[\/.*\])\s*?<\/p>/gi, '$1')

    // unwrap headings that contain only an img tag
    .replace(/<h[1-6]>\s*?(<img.*>)\s*?<\/h[1-6]>/g, '$1')

    // remove strong tags from headings that start and end with strong tags
    .replace(/(<h[1-6]>)\s*<strong>\s*(.*)\s*<\/strong>\s*(<\/h[1-6]>)/g, '$1$2$3')

    // convert tab character to 4-spaces tabs
    .replace(/\t/gi, '    ')

    // strip out custom component graphic-list
    .replace(/\{\{graphic_list\}\}/gi, '')

    // strip out custom component expander
    .replace(/\{\{expander\}\}/gi, '')

    // remove empty <p> tags
    .replace(/<p><\/p>/gi, '')

    ; return output;
}

/*
 * Cleans up filenames
 */
function cleanFilename(name) {
    var fileName = name.toLowerCase() // first, convert to lowercase

    // strip non-alphanumeric characters (except spaces, periods and hyphens)
    .replace(/[^a-z0-9\s\.\-]/g, '')

    // convert spaces, periods and underscores to hyphens
    .replace(/[\s\._]/g, '-')

    // condense multiple adjacent hyphens to a single hyphen
    .replace(/-{2,}/g, '-')

    // remove leading and trailing hyphens
    .replace(/(^-)|(-$)/g, '')

    ; return fileName;
}

function dumpAttributes(atts) {
    // Log the paragraph attributes.
    for (var att in atts) {
        Logger.log(att + ":" + atts[att]);
    }
}

function processItem(item, listCounters, images, imagePath) {
    var output = [],
        prefix = '',
        suffix = '';

    if (item.getType() == DocumentApp.ElementType.PARAGRAPH) {
        switch (item.getHeading()) {
                // Add a # for each heading level. No break, so we accumulate the right number.
            case DocumentApp.ParagraphHeading.HEADING6: 
                prefix = "<h6>", suffix = "</h6>"; break;
            case DocumentApp.ParagraphHeading.HEADING5: 
                prefix = "<h5>", suffix = "</h5>"; break;
            case DocumentApp.ParagraphHeading.HEADING4:
                prefix = "<h4>", suffix = "</h4>"; break;
            case DocumentApp.ParagraphHeading.HEADING3:
                prefix = "<h3>", suffix = "</h3>"; break;
            case DocumentApp.ParagraphHeading.HEADING2:
                prefix = "<h2>", suffix = "</h2>"; break;
            case DocumentApp.ParagraphHeading.HEADING1:
                prefix = "<h1>", suffix = "</h1>"; break;
            default: 
                prefix = "<p>", suffix = "</p>";
        }

        if (item.getNumChildren() == 0)
            return "";
    } else if (item.getType() == DocumentApp.ElementType.INLINE_IMAGE) {
        processImage(item, images, output, imagePath);
    } else if (item.getType() == DocumentApp.ElementType.TABLE) {
        // check if table is the graphic-list component
        if (item.findText('{{graphic_list}}')) {
            processGraphicList(item, listCounters, images, output, imagePath);
        } if (item.findText('{{expander}}')) {
            processExpander(item, listCounters, images, output, imagePath);
        } else {
            processTable(item, listCounters, images, output, imagePath);
        }
    } else if (item.getType()===DocumentApp.ElementType.LIST_ITEM) {
        var listItem = item;
        var gt = listItem.getGlyphType();
        var key = listItem.getListId() + '.' + listItem.getNestingLevel();
        var counter = listCounters[key] || 0;

        // First list item
        if ( counter == 0 ) {
            // Bullet list (<ul>):
            if (gt === DocumentApp.GlyphType.BULLET
                || gt === DocumentApp.GlyphType.HOLLOW_BULLET
                || gt === DocumentApp.GlyphType.SQUARE_BULLET) {
                prefix = '<ul class="list">\n\t<li>', suffix = "</li>";
            } else {
                // Ordered list (<ol>):
                prefix = '<ol class="list">\n\t<li>', suffix = '</li>';
            }
        } else {
            prefix = "\t<li>";
            suffix = "</li>";
        }

        if (item.isAtDocumentEnd() || (item.getNextSibling() && (item.getNextSibling().getType() != DocumentApp.ElementType.LIST_ITEM))) {
            if (gt === DocumentApp.GlyphType.BULLET
                    || gt === DocumentApp.GlyphType.HOLLOW_BULLET
                    || gt === DocumentApp.GlyphType.SQUARE_BULLET) {
                suffix += "\n</ul>";
            } else {
                // Ordered list (<ol>):
                suffix += "\n</ol>";
            }

        }

        counter++;
        listCounters[key] = counter;
    }

    output.push(prefix);

    if (item.getType() == DocumentApp.ElementType.TABLE) {
        // do nothing; already handled
    } else if (item.getType() == DocumentApp.ElementType.TEXT) {
        processText(item, output);
    } else {
        if (item.getNumChildren) {
            var numChildren = item.getNumChildren();

            // Walk through all the child elements of the doc.
            for (var i = 0; i < numChildren; i++) {
                var child = item.getChild(i);
                output.push(processItem(child, listCounters, images, imagePath));
            }
        }
    }

    output.push(suffix);
    return output.join('');
}

function processTable(item, listCounters, images, output, imagePath) {
    // open wrapper
    output.push('\n<div class="table__wrapper">\n');

    // open table
    output.push('\t<table class="table">\n');
    
    var nCols = item.getChild(0).getNumCells();
    
    for (var i = 0; i < item.getNumChildren(); i++) {
        /*
         * Open thead and tbody
         * Assumes the first row is the table header (as it should be)
         */
        if (i < 2) {
            output.push('\t\t<t' + (i === 0 ? 'head' : 'body') + '>\n');
        }

        // add the row
        output.push('\t\t\t<tr>\n');

        // process the table cells
        for (var j = 0; j < nCols; j++) {
            var formatting = item.getChild(i).getChild(j).getAttributes(),
                tag = (i === 0 || formatting.BOLD == true) ? 'th' : 'td'; // use th for thead cells and cells with bolded text

            output.push('\t\t\t\t<' + tag + '>' + item.getChild(i).getChild(j).getText() + '</' + tag + '>\n');
        }

        output.push('\t\t\t</tr>\n');

        // close thead
        if (i === 0) {
            output.push('\t\t</thead>\n');
        }
    }

    // close tbody
    output.push('\t\t</tbody>\n');

    // close table
    output.push('\t</table>\n');

    // close wrapper
    output.push('</div>\n');
}

// generate the graphic-list component from a table
function processGraphicList(item, listCounters, images, output, imagePath) {
    // open wrapper
    output.push('\n<ul class="graphic-list">\n');
    
    var nCols = item.getChild(0).getNumCells();
    
    for (var i = 0; i < item.getNumChildren(); i++) {
        // add the list item
        output.push('\t<li class="graphic-list__item">\n');

        // process the table cells
        for (var j = 0; j < nCols; j++) {
            var type = (j === 0) ? 'image' : 'content'; // image is always first cell, content second

            output.push('\t\t<div class="graphic-list__' + type + '">\n\t\t\t' + processItem(item.getChild(i).getChild(j), listCounters, images, imagePath) + '\n\t\t</div>\n');
        }

        output.push('\t</li>\n');
    }

    // close wrapper
    output.push('</ul>\n');
}

// generate an expander from a table
function processExpander(item, listCounters, images, output, imagePath) {
    // open wrapper
    output.push('\n<ul class="expander">\n');
    
    var nCols = item.getChild(0).getNumCells();
    
    for (var i = 0; i < item.getNumChildren(); i++) {
        // add the list item
        output.push('\t<li>\n');

        // process the table cells
        for (var j = 0; j < nCols; j++) {
            var classes = (j === 0) ? 'expander__trigger expander--hidden' : 'expander__content'; // trigger is always first cell, content second

            output.push('\t\t<div class="' + classes + '">\n\t\t\t' + processItem(item.getChild(i).getChild(j), listCounters, images, imagePath) + '\n\t\t</div>\n');
        }

        output.push('\t</li>\n');
    }

    // close wrapper
    output.push('</ul>\n');
}

function processText(item, output) {
    var text = item.getText(),
        indices = item.getTextAttributeIndices();

    if (indices.length <= 1) {
        // Assuming that a whole para fully italic is a quote
        if(item.isBold()) {
            output.push('<strong>' + text + '</strong>');
        } else if(item.isItalic()) {
            /*
             * Use pullquote shortcode for blockquotes
             * Remove all quotes from pullquote body as this is handled inside the shortcode processor for global styling
             */
            output.push('\n[pullquote style="full"]' + text.replace(/(“|”|")/g, '') + '[/pullquote]\n');
        } else {
            output.push(text);
        }
    } else {
        for (var i=0; i < indices.length; i ++) {
            var partAtts = item.getAttributes(indices[i]),
                startPos = indices[i],
                endPos = i+1 < indices.length ? indices[i+1]: text.length,
                partText = text.substring(startPos, endPos);

            // Logger.log(partText);

            if (partAtts.ITALIC) {
                output.push('<em>');
            }

            if (partAtts.BOLD) {
                output.push('<strong>');
            }

            if (partAtts.UNDERLINE) {
                output.push('');
            }

            if (partAtts.LINK_URL) {
                output.push('<a href="' + partAtts.LINK_URL + '">');
            }

            // If someone has written [xxx] and made this whole text some special font, like superscript
            // then treat it as a reference and make it superscript.
            // Unfortunately in Google Docs, there's no way to detect superscript
            if (partText.indexOf('[')==0 && partText[partText.length-1] == ']') {
                output.push('<sup>' + partText + '</sup>');
            } else {
                output.push(partText);
            }

            if (partAtts.ITALIC) {
                output.push('</em>');
            }

            if (partAtts.BOLD) {
                output.push('</strong>');
            }

            if (partAtts.UNDERLINE) {
                output.push('');
            }

            if (partAtts.LINK_URL) {
                output.push('</a>');
            }
        }
    }
}

function processImage(item, images, output, imagePath) {
    images = images || [];

    var blob = item.getBlob(),
        contentType = blob.getContentType(),
        extension = '',
        fileName = '';

    if (/\/png$/.test(contentType)) {
        extension = ".png";
    } else if (/\/gif$/.test(contentType)) {
        extension = ".gif";
    } else if (/\/jpe?g$/.test(contentType)) {
        extension = ".jpg";
    } else {
        throw "Unsupported image type: " + contentType;
    }

    /*
     * Build the images
     * Use the document name as the image prefix
     */
    var documentName = DocumentApp.getActiveDocument().getName(),
        imagePrefix = '', // add custom image prefix here (e.g. 'some-prefix')
        alt = item.getAltTitle() || '',
        imageCounter = images.length;

    // allow custom image prefix
    if (imagePrefix) {
        fileName += imagePrefix + '-';
    }

    // use image alt as prefix if possible; else, use document name
    fileName += alt ? alt : documentName;

    // sanitize filename before use
    // append image counter and extension
    fileName = cleanFilename(fileName) + '-' + imageCounter + extension;

    imageCounter++;
    output.push('<img src="' + imagePath + fileName + '" alt="' + alt.replace(/(^\s)|(\s$)/g, '') + '" />'); // remove leading and trailing empty spaces from alt
    images.push( {
        "blob": blob,
        "type": contentType,
        "name": fileName
    });
}
