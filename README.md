## Google Doc to clean HTML converter
### Customized for use with specific BH properties

#### Important notes
* Image format in the Google Document should be _In line_ (the default option), not wrapped.
* To add an image alt, select an image and navigate to Format > Alt text. Then, put the alt text in the _Title_ field.

#### Instructions
* Select the conversion function for the desired property (e.g. ConvertCreditLoan)
* [Link to additional instructions](https://howchoo.com/g/ymy2zjfjy2j/how-to-export-clean-html-from-google-docs)

#### Branded Holdings-specific features
There are a few features that are specific to Branded Holdings content generation and usage.

##### Graphic List
To generate a graphic list, first create a table with two columns and a separate row for each item:
1. Column 1: Should contain the graphic-list image
1. Column 2: Should contain the graphic-list content (text, headings, lists, etc.)

Then, insert the text `{{graphic_list}}` anywhere in the table. For example:

![Graphic list usage example](/examples/img/example-graphic-list-table.png?raw=true)

Note: the text `{{graphic_list}}` will automatically be stripped out when output is generated.

#### Attribution
Cloned from the [original GoogleDoc2Html repo](https://github.com/thejimbirch/GoogleDoc2Html)
