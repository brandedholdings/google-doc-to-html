function ConvertGoogleDocToCleanHtml() {
    var body = DocumentApp.getActiveDocument().getBody();
    var numChildren = body.getNumChildren();
    var output = [];
    var images = [];
    var listCounters = {};

    // Walk through all the child elements of the body.
    for (var i = 0; i < numChildren; i++) {
        var child = body.getChild(i);
        output.push(processItem(child, listCounters, images));
    }

    var html = output.join('\r');
    emailHtml(html, images);
}

function emailHtml(html, images) {
    var attachments = [];
    for (var j=0; j<images.length; j++) {
        attachments.push( {
            "fileName": images[j].name,
            "mimeType": images[j].type,
            "content": images[j].blob.getBytes() } );
    }

    var inlineImages = {};
    for (var j=0; j<images.length; j++) {
        inlineImages[[images[j].name]] = images[j].blob;
    }

    var documentName = DocumentApp.getActiveDocument().getName(),
        name = cleanFilename(documentName) + ".html";

    attachments.push({
        "fileName": name,
        "mimeType": "text/html",
        "content": html
    });
    MailApp.sendEmail({
         to: Session.getActiveUser().getEmail(),
         subject: name,
         htmlBody: 'Your converted, sanitized HTML is attached! :)',
         inlineImages: inlineImages,
         attachments: attachments
     });
}

function cleanFilename(fileName) {
    return fileName.replace(/ /g,'-').toLowerCase();
}

function dumpAttributes(atts) {
    // Log the paragraph attributes.
    for (var att in atts) {
        Logger.log(att + ":" + atts[att]);
    }
}

function processItem(item, listCounters, images) {
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
                prefix = "<h1>", suffix = "</h1>";

                break;
            default: 
                prefix = "<p>", suffix = "</p>";
        }

        if (item.getNumChildren() == 0)
            return "";
    }
    else if (item.getType() == DocumentApp.ElementType.INLINE_IMAGE) {
        processImage(item, images, output);
    }
    else if (item.getType()===DocumentApp.ElementType.LIST_ITEM) {
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
                prefix = '<ul class="list"><li>', suffix = "</li>";

                    suffix += "</ul>";
                }
            else {
                // Ordered list (<ol>):
                prefix = '<ol class="list"><li>', suffix = '</li>';
            }
        }
        else {
            prefix = "<li>";
            suffix = "</li>";
        }

        if (item.isAtDocumentEnd() || (item.getNextSibling() && (item.getNextSibling().getType() != DocumentApp.ElementType.LIST_ITEM))) {
            if (gt === DocumentApp.GlyphType.BULLET
                    || gt === DocumentApp.GlyphType.HOLLOW_BULLET
                    || gt === DocumentApp.GlyphType.SQUARE_BULLET) {
                suffix += "</ul>";
            }
            else {
                // Ordered list (<ol>):
                suffix += "</ol>";
            }

        }

        counter++;
        listCounters[key] = counter;
    }

    output.push(prefix);

    if (item.getType() == DocumentApp.ElementType.TEXT) {
        processText(item, output);
    }
    else {


        if (item.getNumChildren) {
            var numChildren = item.getNumChildren();

            // Walk through all the child elements of the doc.
            for (var i = 0; i < numChildren; i++) {
                var child = item.getChild(i);
                output.push(processItem(child, listCounters, images));
            }
        }

    }

    output.push(suffix);
    return output.join('');
}


function processText(item, output) {
    var text = item.getText();
    var indices = item.getTextAttributeIndices();

    if (indices.length <= 1) {
        // Assuming that a whole para fully italic is a quote
        if(item.isBold()) {
            output.push('<strong>' + text + '</strong>');
        }
        else if(item.isItalic()) {
            output.push('<blockquote>' + text + '</blockquote>');
        }
        else if (text.trim().indexOf('http://') == 0 || text.trim().indexOf('https://') == 0) {
            output.push('<a href="' + text + '">' + text + '</a>');
        }
        else {
            output.push(text);
        }
    }
    else {

        for (var i=0; i < indices.length; i ++) {
            var partAtts = item.getAttributes(indices[i]);
            var startPos = indices[i];
            var endPos = i+1 < indices.length ? indices[i+1]: text.length;
            var partText = text.substring(startPos, endPos);

            Logger.log(partText);

            if (partAtts.ITALIC) {
                output.push('<em>');
            }
            if (partAtts.BOLD) {
                output.push('<strong>');
            }
            if (partAtts.UNDERLINE) {
                output.push('<u>');
            }

            // If someone has written [xxx] and made this whole text some special font, like superscript
            // then treat it as a reference and make it superscript.
            // Unfortunately in Google Docs, there's no way to detect superscript
            if (partText.indexOf('[')==0 && partText[partText.length-1] == ']') {
                output.push('<sup>' + partText + '</sup>');
            }
            else if (partText.trim().indexOf('http://') == 0 || partText.trim().indexOf('https://') == 0) {
                output.push('<a href="' + partText + '">' + partText + '</a>');
            }
            else {
                output.push(partText);
            }

            if (partAtts.ITALIC) {
                output.push('</em>');
            }
            if (partAtts.BOLD) {
                output.push('</strong>');
            }
            if (partAtts.UNDERLINE) {
                output.push('</u>');
            }

        }
    }
}


function processImage(item, images, output)
{
    images = images || [];

    var blob = item.getBlob(),
        contentType = blob.getContentType(),
        extension = '';

    if (/\/png$/.test(contentType)) {
        extension = ".png";
    } else if (/\/gif$/.test(contentType)) {
        extension = ".gif";
    } else if (/\/jpe?g$/.test(contentType)) {
        extension = ".jpg";
    } else {
        throw "Unsupported image type: "+contentType;
    }

    /*
     * Build the images
     * Use the document name as the image prefix
     */
    var documentName = DocumentApp.getActiveDocument().getName(),
        imagePrefix = cleanFilename(documentName),
        imageCounter = images.length,
        fileName = imagePrefix + imageCounter + extension;

    imageCounter++;
    output.push('<img src="' + fileName + '" alt="" />');
    images.push( {
        "blob": blob,
        "type": contentType,
        "name": fileName
    });
}
