//
// Simplified BSD License
//
// Copyright (c) 2002-2016, Nirvana Research
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// ==============================================================================
//
// Idea and first implementation - Leo Baschy <srguiwiz12 AT nrvr DOT com>
//
// ==============================================================================
//
// Project contact: <adj.project AT nrvr DOT com>
//
// ==============================================================================
//
// Public repository - https://github.com/srguiwiz/adj-js
//

// ==============================================================================
// in an SVG document being used in a test suite, load this source file after loading adj.js
// e.g.
//   <script type="text/javascript" xlink:href="js/adj.js"/>
//   <script type="text/javascript" xlink:href="js/adj-tests.js"/>
//

// ==============================================================================
// extension of Adj in order to facilitate running automated tests
//

// disclaimer:  this testing code is maintained with somewhat different, not to say
// lesser, criteria than the library proper

// constant
Adj.documentResultEncodingHeader = "ExpectedResult:";
Adj.documentResultEncodingHeaderLength = Adj.documentResultEncodingHeader.length;
// recognize a double hyphen, not allowed in an XML comment
Adj.doubleHyphenRegexp = /--/g;
// recognize a vertical bar, used as argument separator in this test suite's messaging
Adj.verticalLineRegexp = /\|/g;
// recognize a colon, used as encoding separator in this test suite's messaging
Adj.colonRegexp = /:/g;

// for running automated tests
Adj.encodeDocumentString = function encodeDocumentString (content) {
	return Adj.documentResultEncodingHeader
		+ encodeURIComponent(content)
		.replace(Adj.doubleHyphenRegexp,"-%2D")
		.replace(Adj.verticalLineRegexp,"%7C")
		.replace(Adj.colonRegexp,"%3A");
}

// a predicate for running automated tests
Adj.apparentlyEncodedDocumentString = function apparentlyEncodedDocumentString (encoded) {
	return encoded.substring(0, Adj.documentResultEncodingHeaderLength) === Adj.documentResultEncodingHeader;
}

// constant
Adj.anyWhitespaceRegexp = /\s+/g;

// for running automated tests
Adj.decodeEncodedDocumentString = function decodeEncodedDocumentString (encoded) {
	encoded = encoded.replace(Adj.anyWhitespaceRegexp, ""); // remove accidentally or erroneously introduced whitespace or newlines
	return decodeURIComponent(encoded.substring(encoded.indexOf(":") + 1));
}

// constants
Adj.whitespaceBetweenElementsRegexp = />\s+</g;
Adj.whitespaceAtEndRegexp = /\s+$/g;
Adj.whitespacesRegexp = /\s+/g;
Adj.xmlDeclarationRegexp = /^\s*<\?xml[^>]*>/;
// in Internet Explorer after an SVG document includes a fragment from SVG inline in an HTML document
// seen <g xmlns:NS1="" NS1:adj:command="horizontalList"> and test hence has failed
Adj.useOfEmptilyDeclaredXmlnsRegexp = /(xmlns:(NS[0-9]+)="".*?)\2:/g;
Adj.emptilyDeclaredXmlnsRegexp = /xmlns:NS[0-9]+=""/g;
//
Adj.commasRegexp = /,/g;
Adj.letterDecimalsRegexp = /([A-Za-z])([0-9.+-])/g;
//
Adj.trimRegexp = /^\s*([\S\s]*?)\s*$/; // [\S\s] matches newline too, which . doesn't
//
Adj.decimalForToleranceRegexp = /[+-]?[0-9]+\.?[0-9]*|[0-9]*\.?[0-9]/g;
Adj.decimalCharacterRegexp = /[0-9.+-]/;
//
Adj.nameSplitAfterColonRegexp = /^(.*:)?(.*)$/;

// rather specific to use in Adj.doSvgAndVerify(),
// for correct results .normalize() MUST have been called on both nodes
//
// "expectd" is short for "expectedResult", same number of characters as "current" for readability
Adj.areEqualNodes = function areEqualNodes (expectdNode, currentNode, differences, tolerance) {
	var expectdNodeType = expectdNode.nodeType;
	var currentNodeType = currentNode.nodeType;
	if (currentNodeType != expectdNodeType) {
		differences.push("node types are different");
		return false;
	}
	switch (expectdNodeType) {
		case Node.ELEMENT_NODE:
			// compare the elements' sets of attributes
			var areNotEqual = false;
			var expectdAttributes = expectdNode.attributes;
			var currentAttributes = currentNode.attributes;
			var expectdAttributesLength = expectdAttributes.length;
			var currentAttributesLength = currentAttributes.length;
			var expectdAttributesByName = {};
			var currentAttributesByName = {};
			// attribute.name holds the qualified name
			for (var i = 0; i < expectdAttributesLength; i++) {
				var attribute = expectdAttributes.item(i);
				// workarounds mashed together to make it work
				var match = Adj.nameSplitAfterColonRegexp.exec(attribute.name); // no-namespace-workaround
				var expectdAttributeName = (match[1] ? match[1] : "") + Adj.mixedCasedName(match[2]); // lowercase-names-workaround
				expectdAttributesByName[expectdAttributeName] = attribute;
			}
			for (var i = 0; i < currentAttributesLength; i++) {
				var attribute = currentAttributes.item(i);
				// workarounds mashed together to make it work
				var match = Adj.nameSplitAfterColonRegexp.exec(attribute.name); // no-namespace-workaround
				var currentAttributeName = (match[1] ? match[1] : "") + Adj.mixedCasedName(match[2]); // lowercase-names-workaround
				currentAttributesByName[currentAttributeName] = attribute;
			}
			for (var expectdAttributeName in expectdAttributesByName) {
				var expectdAttribute = expectdAttributesByName[expectdAttributeName];
				var splitExpectdAttributeName = Adj.nameSplitByColon(expectdAttribute.name); // no-namespace-workaround
				if (expectdAttribute.prefix === "xmlns" || splitExpectdAttributeName.prefix === "xmlns") {
					// ignore xmlns: attributes for now, because different browsers serialize them into different elements
					delete expectdAttributesByName[expectdAttributeName];
					continue;
				}
				if (expectdAttribute.name === "xmlns" || splitExpectdAttributeName.localPart === "xmlns") {
					// ignore xmlns attributes for now, because different browsers serialize them into different elements
					delete expectdAttributesByName[expectdAttributeName];
					continue;
				}
				var currentAttribute = currentAttributesByName[expectdAttributeName];
				if (!currentAttribute) {
					differences.push("now missing attribute " + expectdAttributeName + "=\"" + expectdAttribute.value + "\"");
					areNotEqual = true;
					delete expectdAttributesByName[expectdAttributeName];
					continue;
				}
				// compare one attribute
				if (!Adj.areEqualNodes(expectdAttribute, currentAttribute, differences, tolerance)) {
					areNotEqual = true;
				}
				delete expectdAttributesByName[expectdAttributeName];
				delete currentAttributesByName[expectdAttributeName];
			}
			for (var currentAttributeName in currentAttributesByName) {
				var currentAttribute = currentAttributesByName[currentAttributeName];
				var splitCurrentAttributeName = Adj.nameSplitByColon(currentAttribute.name); // no-namespace-workaround
				if (currentAttribute.prefix === "xmlns" || splitCurrentAttributeName.prefix === "xmlns") {
					// ignore xmlns: attributes for now, because different browsers serialize them into different elements
					delete currentAttributesByName[currentAttributeName];
					continue;
				}
				if (currentAttribute.name === "xmlns" || splitCurrentAttributeName.localPart === "xmlns") {
					// ignore xmlns attributes for now, because different browsers serialize them into different elements
					delete currentAttributesByName[currentAttributeName];
					continue;
				}
				differences.push("now extra attribute " + currentAttributeName + "=\"" + currentAttribute.value + "\"");
				areNotEqual = true;
				delete expectdAttributesByName[expectdAttributeName];
			}
			// compare the elements' lists of children
			var expectdChildren = expectdNode.childNodes;
			var currentChildren = currentNode.childNodes;
			var expectdChildrenLength = expectdChildren.length;
			var currentChildrenLength = currentChildren.length;
			if (currentChildrenLength != expectdChildrenLength) {
				differences.push("a " + currentNode.tagName + " element now has " + currentChildrenLength + " children instead of " + expectdChildrenLength);
				return false;
			}
			for (var i = 0; i < expectdChildrenLength; i++) {
				var expectdChild = expectdChildren.item(i);
				var currentChild = currentChildren.item(i);
				if (!Adj.areEqualNodes(expectdChild, currentChild, differences, tolerance)) {
					areNotEqual = true;
				}
			}
			return !areNotEqual;
			break;
		case Node.ATTRIBUTE_NODE:
			// attribute.name holds the qualified name
			var expectdAttributeName = expectdNode.name;
			var currentAttributeName = currentNode.name;
			// don't expect to get here with currentAttributeName != expectdAttributeName,
			// if ever in the future because of namespace tricks, deal with it then
			var expectdAttributeValue = expectdNode.value;
			var currentAttributeValue = currentNode.value;
			// deal with e.g. getting attribute transform="matrix(1 0 0 1 0 0)" instead of expected value ="matrix(1, 0, 0, 1, 0, 0)",
			// replace every comma with a space
			if (expectdAttributeName === "transform" && currentAttributeName === "transform") {
				expectdAttributeValue = expectdAttributeValue.replace(Adj.commasRegexp, " ");
				currentAttributeValue = currentAttributeValue.replace(Adj.commasRegexp, " ");
			}
			// deal with e.g. getting attribute adj:d="M 5 100 q 40 10 80 0 t 80 0" instead of expected value ="M5,100 q40,10 80,0 t80,0",
			// after every letter before a decimal enter a space, replace every comma with a space
			if (expectdAttributeName === "adj:d" && currentAttributeName === "adj:d") {
				expectdAttributeValue = expectdAttributeValue.replace(Adj.letterDecimalsRegexp, "$1 $2").replace(Adj.commasRegexp, " ");
				currentAttributeValue = currentAttributeValue.replace(Adj.letterDecimalsRegexp, "$1 $2").replace(Adj.commasRegexp, " ");
			}
			// trim and normalize any sequence of whitespace to a single space
			expectdAttributeValue = expectdAttributeValue.replace(Adj.trimRegexp,"$1").replace(Adj.whitespacesRegexp," ");
			currentAttributeValue = currentAttributeValue.replace(Adj.trimRegexp,"$1").replace(Adj.whitespacesRegexp," ");
			if (currentAttributeValue == expectdAttributeValue) {
				return true;
			}
			// try tolerance
			var differenceScanningPosition = 0;
			do {
				var expectdAttributeValueLength = expectdAttributeValue.length;
				var currentAttributeValueLength = currentAttributeValue.length;
				var minLength = Math.min(expectdAttributeValueLength, currentAttributeValueLength);
				var firstDifference = minLength;
				if (differenceScanningPosition >= minLength) { // at least one at end (expected result or current)
					break;
				}
				for (var i = differenceScanningPosition; i < minLength; i++) {
					if (currentAttributeValue[i] != expectdAttributeValue[i]) {
						firstDifference = i;
						break;
					}
				}
				if (firstDifference >= expectdAttributeValueLength && firstDifference >= currentAttributeValueLength) { // both at end (expected result and current)
					break;
				}
				if ((firstDifference >= expectdAttributeValueLength || !Adj.decimalCharacterRegexp.test(expectdAttributeValue[firstDifference])) && (firstDifference >= currentAttributeValueLength || !Adj.decimalCharacterRegexp.test(currentAttributeValue[firstDifference]))) {
					// both either at end or not number
					break; // cannot calculate tolerance if not number
				}
				var decimalBegin = firstDifference;
				while (decimalBegin > 0 && Adj.decimalCharacterRegexp.test(expectdAttributeValue[decimalBegin-1])) {
					decimalBegin--;
				}
				var expectdDecimalMatch;
				Adj.decimalForToleranceRegexp.lastIndex = decimalBegin;
				do {
					var expectdDecimalMatch = Adj.decimalForToleranceRegexp.exec(expectdAttributeValue);
				} while (expectdDecimalMatch && Adj.decimalForToleranceRegexp.lastIndex < firstDifference);
				if (!expectdDecimalMatch) { // odd case, yet possible
					break;
				}
				var expectdDecimalString = expectdDecimalMatch[0];
				var expectdDecimalIndex = expectdDecimalMatch.index;
				var expectdDecimalLastIndex = Adj.decimalForToleranceRegexp.lastIndex;
				var expectdDecimal = parseFloat(expectdDecimalString);
				var currentDecimalMatch;
				Adj.decimalForToleranceRegexp.lastIndex = decimalBegin;
				do {
					var currentDecimalMatch = Adj.decimalForToleranceRegexp.exec(currentAttributeValue);
				} while (currentDecimalMatch && Adj.decimalForToleranceRegexp.lastIndex < firstDifference);
				if (!currentDecimalMatch) { // odd case, yet possible
					break;
				}
				var currentDecimalString = currentDecimalMatch[0];
				var currentDecimalIndex = currentDecimalMatch.index;
				var currentDecimalLastIndex = Adj.decimalForToleranceRegexp.lastIndex;
				var currentDecimal = parseFloat(currentDecimalString);
				var difference = Math.abs(currentDecimal - expectdDecimal);
				if (difference > tolerance.inEffect) { // numerically more difference than tolerance.inEffect
					break;
				}
				// fix up to match
				if (expectdDecimalLastIndex < firstDifference) { // odd case, yet possible
					break; // prevent endless loop
				}
				currentAttributeValue = currentAttributeValue.substring(0,currentDecimalIndex) + expectdDecimalString + currentAttributeValue.substring(currentDecimalLastIndex);
				differenceScanningPosition = expectdDecimalLastIndex + 1; // + 1 OK because there must be at least one character that separates numbers
			} while (true);
			if (currentAttributeValue == expectdAttributeValue) {
				return true;
			}
			differences.push("now getting attribute " + expectdAttributeName + "=\"" + currentNode.value + "\" instead of expected value =\"" + expectdNode.value + "\"");
			return false;
			break;
		case Node.TEXT_NODE:
		case Node.CDATA_SECTION_NODE:
		case Node.COMMENT_NODE:
			var expectdNodeValue = expectdNode.nodeValue;
			var currentNodeValue = currentNode.nodeValue;
			// trim and normalize any sequence of whitespace to a single space
			expectdNodeValue = expectdNodeValue.replace(Adj.trimRegexp,"$1").replace(Adj.whitespacesRegexp," ");
			currentNodeValue = currentNodeValue.replace(Adj.trimRegexp,"$1").replace(Adj.whitespacesRegexp," ");
			if (currentNodeValue == expectdNodeValue) {
				return true;
			} else {
				differences.push("now getting \"…" + currentNodeValue + "…\" instead of expected \"…" + expectdNodeValue + "…\"");
				return false;
			}
			break;
		case Node.ENTITY_REFERENCE_NODE:
		case Node.ENTITY_NODE:
		case Node.PROCESSING_INSTRUCTION_NODE:
			// ignore for now,
			// don't depend on these in test cases,
			// character references and references to predefined entities are considered to be
			// expanded by the HTML or XML processor so that characters are represented by their
			// Unicode equivalent rather than by an entity reference
			return true; // ignore for now, pass them OK
			break;
		case Node.DOCUMENT_NODE:
			return Adj.areEqualNodes(expectdNode.documentElement, currentNode.documentElement, differences, tolerance);
			break;
		case Node.DOCUMENT_TYPE_NODE:
		case Node.DOCUMENT_FRAGMENT_NODE:
		case Node.NOTATION_NODE:
			// ignore for now,
			// not called on document node, only called on root element, aka documentElement
			return true; // ignore for now, pass them OK
			break;
		default:
			break;
	}
	// strange if it gets here
	return false;
}

// constant
Adj.firstElementTagRegexp = /<([a-zA-Z]+)/;
// utility
Adj.firstElementTag = function firstElementTag (documentString) {
	var firstElementTagRegexpMatch = Adj.firstElementTagRegexp.exec(documentString);
	if (firstElementTagRegexpMatch) {
		return firstElementTagRegexpMatch[1];
	} else { // not markup language ?
		return null;
	}
}

// for running automated tests,
// doSvgAndVerifyDoneCallback called with string describing difference if failed,
// or called with empty string if expected result if passed
//
// "expectd" is short for "expectedResult", same number of characters as "current" for readability
Adj.doSvgAndVerify = function doSvgAndVerify
(expectedResultEncodedDocumentString, extraWaitMilliseconds, doSvgAndVerifyDoneCallback, tolerance) {
	// sanity checks
	extraWaitMilliseconds = parseInt(extraWaitMilliseconds);
	if (!(extraWaitMilliseconds >= -1)) { // e.g. undefined, NaN, -2
		throw "Adj.doSvgAndVerify cannot run unless second parameter extraWaitMilliseconds is an integer >= -1";
	}
	if (!doSvgAndVerifyDoneCallback || typeof doSvgAndVerifyDoneCallback !== "function") {
		throw "Adj.doSvgAndVerify cannot run unless third parameter doSvgAndVerifyDoneCallback is a callback function";
	}
	if (!tolerance) {
		tolerance = {
			generalInUnits: 0.01, // default
			ifTextFractionOfTotal: 0.05 // if at least one SVG text element
		};
	}
	//
	// get expectedResult
	if (!expectedResultEncodedDocumentString) {
		doSvgAndVerifyDoneCallback("cannot verify because no expectedResultEncodedDocumentString to compare against");
		return;
	}
	if (typeof expectedResultEncodedDocumentString !== "string") {
		throw "Adj.doSvgAndVerify cannot run unless first parameter expectedResultEncodedDocumentString is a string";
		return;
	}
	if (!Adj.apparentlyEncodedDocumentString(expectedResultEncodedDocumentString)) {
		throw "Adj.doSvgAndVerify will not run unless encoding of first parameter expectedResultEncodedDocumentString is recognized";
		return;
	}
	var expectedResult = Adj.decodeEncodedDocumentString(expectedResultEncodedDocumentString);
	var verify = function verify (documentNodeOrRootElement) {
		try {
			// convert to text
			var serializer = new XMLSerializer();
			var documentAsString = serializer.serializeToString(document);
			// may have to become a bit more tolerant for different browsers and borderline cases, yet not slack
			expectedResult = expectedResult.replace(Adj.whitespaceBetweenElementsRegexp, "> <");
			expectedResult = expectedResult.replace(Adj.whitespaceAtEndRegexp, "");
			expectedResult = expectedResult.replace(Adj.whitespacesRegexp, " ");
			expectedResult = expectedResult.replace(Adj.xmlDeclarationRegexp, "");
			//expectedResult = expectedResult.replace(Adj.useOfEmptilyDeclaredXmlnsRegexp, "$1");
			//expectedResult = expectedResult.replace(Adj.emptilyDeclaredXmlnsRegexp, "");
			documentAsString = documentAsString.replace(Adj.whitespaceBetweenElementsRegexp, "> <");
			documentAsString = documentAsString.replace(Adj.whitespaceAtEndRegexp, "");
			documentAsString = documentAsString.replace(Adj.whitespacesRegexp, " ");
			documentAsString = documentAsString.replace(Adj.xmlDeclarationRegexp, "");
			documentAsString = documentAsString.replace(Adj.useOfEmptilyDeclaredXmlnsRegexp, "$1");
			documentAsString = documentAsString.replace(Adj.emptilyDeclaredXmlnsRegexp, "");
			// compare serialized documents
			if (documentAsString === expectedResult) {
				doSvgAndVerifyDoneCallback("");
				return;
			}
			// compare as DOM
			var parser = new DOMParser();
			var expectdDom;
			var currentDom;
			var apparentlyGoodParse = false;
			var expectdDomRootElement;
			var currentDomRootElement;
			try {
				switch (Adj.firstElementTag(expectedResult).toLowerCase()) {
					case "svg":
						expectdDom = parser.parseFromString(expectedResult, "application/xml");
						break;
					case "html":
						expectdDom = parser.parseFromString(expectedResult, "text/html");
						break;
					default:
						throw "neither svg nor html";
				}
				expectdDomRootElement = expectdDom.documentElement;
				switch (Adj.firstElementTag(documentAsString).toLowerCase()) {
					case "svg":
						currentDom = parser.parseFromString(documentAsString, "application/xml");
						break;
					case "html":
						// instead of currentDom = parser.parseFromString(documentAsString, "text/html"); directly use
						currentDom = document;
						break;
					default:
						throw "neither svg nor html";
				}
				currentDomRootElement = currentDom.documentElement;
				apparentlyGoodParse = true;
			} catch (exception) {
				apparentlyGoodParse = false;
			}
			var apparentlyEqualDom = false;
			if (apparentlyGoodParse) {
				try {
					apparentlyEqualDom = currentDomRootElement.isEqualNode(expectdDomRootElement);
				} catch (exception) {
					apparentlyEqualDom = false;
				}
			}
			// custom comparison of DOM
			var differences = [];
			if (!apparentlyEqualDom) {
				try {
					expectdDom.normalize();
					currentDom.normalize();
					tolerance.inEffect = tolerance.generalInUnits; // default
					if (expectdDom.getElementsByTagName("text").length) { // at least one SVG text element
						tolerance.inEffect = tolerance.ifTextFractionOfTotal * Math.sqrt(Math.pow(parseFloat(expectdDomRootElement.getAttribute("width")),2)+Math.pow(parseFloat(expectdDomRootElement.getAttribute("height")),2));
					}
					apparentlyEqualDom = Adj.areEqualNodes(expectdDomRootElement, currentDomRootElement, differences, tolerance);
				} catch (exception) {
					apparentlyEqualDom = false;
				}
			}
			if (apparentlyEqualDom) {
				doSvgAndVerifyDoneCallback("");
				return;
			} else {
				var differencesString;
				if (differences.length) {
					differencesString = differences.join("; ");
				} else {
					var sLength = expectedResult.length;
					var dLength = documentAsString.length;
					var minLength = Math.min(sLength, dLength);
					var firstDifference = minLength;
					for (var i = 0; i < minLength; i++) {
						if (documentAsString[i] != expectedResult[i]) {
							firstDifference = i;
							break;
						}
					}
					var sectionFrom = Math.max(firstDifference - 10, 0);
					var expectedSection = expectedResult.substring(sectionFrom, sectionFrom + 40);
					var documentSection = documentAsString.substring(sectionFrom, sectionFrom + 40);
					differencesString = "a difference near char " + firstDifference + ", now getting \"…" + documentSection + "…\" instead of expected \"…" + expectedSection + "…\"";
				}
				doSvgAndVerifyDoneCallback(differencesString);
				return;
			}
		} catch (exception) { // probably unusual, nevertheless covered
			doSvgAndVerifyDoneCallback(exception.toString());
			return;
		}
	};
	// do
	Adj.doSvg(function (documentNodeOrRootElement) {
		if (extraWaitMilliseconds <= -1) {
			// simple original intent
			verify(documentNodeOrRootElement);
		} else { // extraWaitMilliseconds >= 0
			// e.g. allow event handlers to run, if needed
			window.setTimeout(function () {
				verify(documentNodeOrRootElement);
			}, extraWaitMilliseconds);
		}
	});
}

// ==============================================================================
// raison d'être of AdjTestWindow is to allow a test suite to iterate through test cases in an iframe,
// specifically to work around newer browsers (Chrome) not allowing access to local files in an iframe,
// use window.postMessage to communicate between test suite HTML document and an iframe with SVG documents being tested
//

// the singleton
var AdjTestWindow = {};

// match command by itself, or command followed by one or two parameters separated by |
AdjTestWindow.messageRegexp = /^([^|]*)(?:\|([^|]*))?(?:\|(.*))?$/;

// at least in Internet Explorer XMLSerializer has been seen producing <script src="js/adj.js"/>, which then doesn't parse right
AdjTestWindow.scriptSelfClosingTagRegexp = /(<\s*script(?:\s+[a-z]+="[^"]*?")+)(?:\s*\/>)/g;

AdjTestWindow.receivesMessage = function receivesMessage (evt) {
	// accept any evt.origin
	var messageCommand;
	var messageParameter;
	var messageMatch = AdjTestWindow.messageRegexp.exec(evt.data);
	if (messageMatch) {
		messageCommand = messageMatch[1];
		messageParameter = messageMatch[2];
		messageParameter2 = messageMatch[3];
	} else {
		messageCommand = "";
	}
	switch (messageCommand) {
		case "load":
			// remove before loading another listener
			window.removeEventListener("message", AdjTestWindow.receivesMessage, false);
			// navigate, load
			window.location.href = messageParameter;
			break;
		case "Adj.encodeDocument":
			try {
				// convert to text
				var serializer = new XMLSerializer();
				var documentAsString = serializer.serializeToString(document);
				// fix up to avoid self-closing script tags like <script src="js/adj.js"/>
				documentAsString = documentAsString.replace(AdjTestWindow.scriptSelfClosingTagRegexp, "$1></script>");
				// fix up to avoid extraneous namespace declarations and use like xmlns:NS1="" NS1:xmlns:adj="http://www.nrvr.com/2012/adj"
				documentAsString = documentAsString.replace(Adj.useOfEmptilyDeclaredXmlnsRegexp, "$1");
				documentAsString = documentAsString.replace(Adj.emptilyDeclaredXmlnsRegexp, "");
				// encode
				var encodedDocument = Adj.encodeDocumentString(documentAsString);
				// reply
				evt.source.postMessage("Adj.encodedDocument|" + window.location.href + "|" + encodedDocument, "*");
			} catch (exception) { // probably unusual, nevertheless covered
				console.error("Adj.encodeDocument exception", exception);
				exceptionString = exception.toString();
				// reply
				evt.source.postMessage("Adj.encodedDocumentException|" + window.location.href + "|" + exceptionString, "*");
			}
			break;
		case "Adj.doSvgAndVerify":
			try {
				// accommodate sloppy parameter passing
				if (!messageParameter2) {
					var expectedResultEncodedDocumentString = messageParameter;
				} else {
					var extraWaitMilliseconds = parseInt(messageParameter);
					var expectedResultEncodedDocumentString = messageParameter2;
				}
				if (!(extraWaitMilliseconds >= -1)) { // e.g. undefined, NaN, -2
					var extraWaitMilliseconds = -1;
				}
				// do
				Adj.doSvgAndVerify
				(expectedResultEncodedDocumentString,
				 extraWaitMilliseconds,
				 function (resultOfVerification) {
					console.log("Adj.doSvgAndVerify done");
					// reply
					evt.source.postMessage("Adj.didSvgAndVerify|" + window.location.href + "|" + resultOfVerification, "*");
				 });
			} catch (exception) { // probably unusual, nevertheless covered
				console.error("Adj.doSvgAndVerify exception", exception);
				exceptionString = exception.toString();
				// reply
				evt.source.postMessage("Adj.didSvgAndVerifyException|" + window.location.href + "|" + exceptionString, "*");
			}
			break;
		case "Adj.doSvg":
			Adj.doSvg(function (oneSvgElementOrSvgElements) {
				console.log('Adj.doSvg done');
			});
			break;
		default:
	}
}

// see https://developer.mozilla.org/en-US/docs/DOM/window.postMessage
window.addEventListener("message", AdjTestWindow.receivesMessage, false);
