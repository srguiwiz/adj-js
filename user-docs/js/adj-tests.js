//
// Copyright (c) 2002-2015, Nirvana Research
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the copyright holder nor the names of
//       contributors may be used to endorse or promote products derived from
//       this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDER AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY DIRECT,
// INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
// BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
// OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
// NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
// EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// i.e. Modified BSD License
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

// constant
Adj.documentResultStashHeader = "ExpectedResultForTestAutomation:";
Adj.documentResultStashHeaderLength = Adj.documentResultStashHeader.length;
// recognize a double hyphen, not allowed in an XML comment
Adj.doubleHyphenRegexp = /--/g;

// for running automated tests
Adj.encodeDocumentResultStash = function encodeDocumentResultStash(content) {
	return Adj.documentResultStashHeader + encodeURIComponent(content).replace(Adj.doubleHyphenRegexp,"-%2D");
}

// for running automated tests
Adj.apparentlyEncodedDocumentResultStash = function encodeDocumentResultStash(encoded) {
	return encoded.substring(0,Adj.documentResultStashHeaderLength) == Adj.documentResultStashHeader;
}

// constant
Adj.anyWhitespaceRegexp = /\s+/g;

// for running automated tests
Adj.decodeDocumentResultStash = function encodeDocumentResultStash(encoded) {
	encoded = encoded.replace(Adj.anyWhitespaceRegexp, ""); // remove accidentally or erroneously introduced whitespace or newlines
	return decodeURIComponent(encoded.substring(encoded.indexOf(":") + 1));
}

// for running automated tests
// look for previous stash, if any then return its content still encoded else null,
// if not given a documentToDo then default to doing _the_ document
Adj.apparentlyDocumentResultStash = function apparentlyDocumentResultStash(documentToDo) {
	if (!documentToDo) {
		documentToDo = document;
	}
	var node = documentToDo.documentElement.firstChild;
	do {
		var nextChild = node.nextSibling;
		if (nextChild) {
			if (nextChild.nodeType == Node.COMMENT_NODE) {
				var maybeStashContent = nextChild.nodeValue;
				if (Adj.apparentlyEncodedDocumentResultStash(maybeStashContent)) { // correct header
					return maybeStashContent;
				}
			}
		}
		node = nextChild;
	} while (node);
	return null;
}

// for running automated tests
// remove previous stash, if any then return its content still encoded else null,
// if not given a documentToDo then default to doing _the_ document
Adj.removeDocumentResultStash = function removeDocumentResultStash(documentToDo) {
	if (!documentToDo) {
		documentToDo = document;
	}
	var apparentStashContent = null;
	var node = documentToDo.documentElement.firstChild;
	do {
		var nextChild = node.nextSibling;
		if (nextChild) {
			if (nextChild.nodeType == Node.COMMENT_NODE) {
				var maybeStashContent = nextChild.nodeValue;
				if (Adj.apparentlyEncodedDocumentResultStash(maybeStashContent)) { // correct header
					if (!apparentStashContent) { // first one
						apparentStashContent = maybeStashContent; // remember
					}
					documentToDo.documentElement.removeChild(nextChild);
					continue;
				}
			}
		}
		node = nextChild;
	} while (node);
	return apparentStashContent;
}

// for running automated tests
// put stash,
// if not given a documentToDo then default to doing _the_ document
Adj.stashDocumentResult = function stashDocumentResult(documentToDo) {
	if (!documentToDo) {
		documentToDo = document;
	}
	// convert to text
	var serializer = new XMLSerializer();
	var documentAsString = serializer.serializeToString(documentToDo);
	// encode
	var comment = documentToDo.createComment(Adj.encodeDocumentResultStash(documentAsString));
	documentToDo.documentElement.appendChild(comment);
}

// for running automated tests
// get stash, decoded,
// if not given a documentToDo then default to doing _the_ document
Adj.stashedDocumentResult = function stashedDocumentResult(documentToDo, removeDocumentResultStash) {
	if (!documentToDo) {
		documentToDo = document;
	}
	var apparentStashContent;
	if (!removeDocumentResultStash) {
		apparentStashContent = Adj.apparentlyDocumentResultStash(documentToDo);
	} else {
		apparentStashContent = Adj.removeDocumentResultStash(documentToDo);
	}
	if (apparentStashContent) {
		apparentStashContent = Adj.decodeDocumentResultStash(apparentStashContent);
	}
	return apparentStashContent;
}

// for running automated tests
// get stash, decoded, and remove it from the document,
// if not given a documentToDo then default to doing _the_ document
Adj.stashedDocumentResultAndRemove = function stashedDocumentResultAndRemove(documentToDo) {
	if (!documentToDo) {
		documentToDo = document;
	}
	return Adj.stashedDocumentResult(documentToDo, true);
}

// for running automated tests,
// if not given a documentToDo then default to doing _the_ document
Adj.doDocAndStashIfNoStashYet = function doDocAndStashIfNoStashYet(documentToDo) {
	if (!documentToDo) {
		documentToDo = document;
	}
	if (Adj.apparentlyDocumentResultStash(documentToDo)) { // apparently not first time
		return; // bail out
	}
	// do
	Adj.doDoc(documentToDo);
	// put stash
	Adj.stashDocumentResult(documentToDo);
}

// for running automated tests,
// if not given a documentToDo then default to doing _the_ document
Adj.doDocAndStash = function doDocAndStash(documentToDo) {
	if (!documentToDo) {
		documentToDo = document;
	}
	// remove previous stash
	Adj.removeDocumentResultStash(documentToDo);
	// do
	Adj.doDoc(documentToDo);
	// put stash
	Adj.stashDocumentResult(documentToDo);
}

// constants
Adj.whitespaceBetweenElementsRegexp = />\s+</g;
Adj.whitespaceAtEndRegexp = /\s+$/g;
Adj.whitespacesRegexp = /\s+/g;
Adj.xmlDeclarationRegexp = /^\s*<\?xml[^>]*>/;
//
Adj.trimRegexp = /^\s*(.*?)\s*$/;
//
Adj.decimalForToleranceRegexp = /[+-]?[0-9]+\.?[0-9]*|[0-9]*\.?[0-9]/g;
Adj.decimalCharacterRegexp = /[0-9.+-]/;

// rather specific to use in Adj.doDocAndVerify(),
// for correct results .normalize() MUST have been called on both nodes
Adj.areEqualNodes = function areEqualNodes(stashedNode, currentNode, differences, tolerance) {
	var stashedNodeType = stashedNode.nodeType;
	var currentNodeType = currentNode.nodeType;
	if (currentNodeType != stashedNodeType) {
		differences.push("node types are different");
		return false;
	}
	switch (stashedNodeType) {
		case Node.ELEMENT_NODE:
			// compare the elements' sets of attributes
			var areNotEqual = false;
			var stashedAttributes = stashedNode.attributes;
			var currentAttributes = currentNode.attributes;
			var stashedAttributesLength = stashedAttributes.length;
			var currentAttributesLength = currentAttributes.length;
			var stashedAttributesByName = {};
			var currentAttributesByName = {};
			// nodeName holds the qualified name
			for (var i = 0; i < stashedAttributesLength; i++) {
				var a = stashedAttributes.item(i);
				stashedAttributesByName[a.nodeName] = a;
			}
			for (var i = 0; i < currentAttributesLength; i++) {
				var a = currentAttributes.item(i);
				currentAttributesByName[a.nodeName] = a;
			}
			for (stashedAttributeName in stashedAttributesByName) {
				var stashedAttribute = stashedAttributesByName[stashedAttributeName];
				if (stashedAttribute.prefix == "xmlns") {
					// ignore xmlns: attributes for now, because different browsers serialize them into different elements
					delete stashedAttributesByName[stashedAttributeName];
					continue;
				}
				var currentAttribute = currentAttributesByName[stashedAttributeName];
				if (!currentAttribute) {
					differences.push("now missing attribute " + stashedAttributeName + "=\"" + stashedAttribute.value + "\"");
					areNotEqual = true;
					delete stashedAttributesByName[stashedAttributeName];
					continue;
				}
				// compare one attribute
				if (!Adj.areEqualNodes(stashedAttribute, currentAttribute, differences, tolerance)) {
					areNotEqual = true;
				}
				delete stashedAttributesByName[stashedAttributeName];
				delete currentAttributesByName[stashedAttributeName];
			}
			for (currentAttributeName in currentAttributesByName) {
				var currentAttribute = currentAttributesByName[currentAttributeName];
				if (currentAttribute.prefix == "xmlns") {
					// ignore xmlns: attributes for now, because different browsers serialize them into different elements
					delete currentAttributesByName[currentAttributeName];
					continue;
				}
				differences.push("now extra attribute " + currentAttributeName + "=\"" + currentAttribute.value + "\"");
				areNotEqual = true;
				delete stashedAttributesByName[stashedAttributeName];
			}
			// compare the elements' lists of children
			var stashedChildren = stashedNode.childNodes;
			var currentChildren = currentNode.childNodes;
			var stashedChildrenLength = stashedChildren.length;
			var currentChildrenLength = currentChildren.length;
			if (currentChildrenLength != stashedChildrenLength) {
				differences.push("a " + currentNode.nodeName + " element now has " + currentChildrenLength + " children instead of " + stashedChildrenLength);
				return false;
			}
			for (var i = 0; i < stashedChildrenLength; i++) {
				var stashedChild = stashedChildren.item(i);
				var currentChild = currentChildren.item(i);
				if (!Adj.areEqualNodes(stashedChild, currentChild, differences, tolerance)) {
					areNotEqual = true;
				}
			}
			return !areNotEqual;
			break;
		case Node.ATTRIBUTE_NODE:
			// nodeName holds the qualified name
			var stashedAttributeName = stashedNode.nodeName;
			var currentAttributeName = currentNode.nodeName;
			// don't expect to get here with currentAttributeName != stashedAttributeName,
			// if ever in the future because of namespace tricks, deal with it then
			var stashedAttributeValue = stashedNode.value;
			var currentAttributeValue = currentNode.value;
			// trim and normalize any sequence of whitespace to a single space
			stashedAttributeValue = stashedAttributeValue.replace(Adj.trimRegexp,"$1").replace(Adj.whitespacesRegexp," ");
			currentAttributeValue = currentAttributeValue.replace(Adj.trimRegexp,"$1").replace(Adj.whitespacesRegexp," ");
			if (currentAttributeValue == stashedAttributeValue) {
				return true;
			}
			// try tolerance
			var differenceScanningPosition = 0;
			do {
				var stashedAttributeValueLength = stashedAttributeValue.length;
				var currentAttributeValueLength = currentAttributeValue.length;
				var minLength = Math.min(stashedAttributeValueLength, currentAttributeValueLength);
				var firstDifference = minLength;
				if (differenceScanningPosition >= minLength) { // at least one at end (stashed or current)
					break;
				}
				for (var i = differenceScanningPosition; i < minLength; i++) {
					if (currentAttributeValue[i] != stashedAttributeValue[i]) {
						firstDifference = i;
						break;
					}
				}
				if (firstDifference >= stashedAttributeValueLength && firstDifference >= currentAttributeValueLength) { // both at end (stashed and current)
					break;
				}
				if ((firstDifference >= stashedAttributeValueLength || !Adj.decimalCharacterRegexp.test(stashedAttributeValue[firstDifference])) && (firstDifference >= currentAttributeValueLength || !Adj.decimalCharacterRegexp.test(currentAttributeValue[firstDifference]))) {
					// both either at end or not number
					break; // cannot calculate tolerance if not number
				}
				var decimalBegin = firstDifference;
				while (decimalBegin > 0 && Adj.decimalCharacterRegexp.test(stashedAttributeValue[decimalBegin-1])) {
					decimalBegin--;
				}
				var stashedDecimalMatch;
				Adj.decimalForToleranceRegexp.lastIndex = decimalBegin;
				do {
					var stashedDecimalMatch = Adj.decimalForToleranceRegexp.exec(stashedAttributeValue);
				} while (stashedDecimalMatch && Adj.decimalForToleranceRegexp.lastIndex < firstDifference);
				if (!stashedDecimalMatch) { // odd case, yet possible
					break;
				}
				var stashedDecimalString = stashedDecimalMatch[0];
				var stashedDecimalIndex = stashedDecimalMatch.index;
				var stashedDecimalLastIndex = Adj.decimalForToleranceRegexp.lastIndex;
				var stashedDecimal = parseFloat(stashedDecimalString);
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
				var difference = Math.abs(currentDecimal - stashedDecimal);
				if (difference > tolerance.inEffect) { // numerically more difference than tolerance.inEffect
					break;
				}
				// fix up to match
				if (stashedDecimalLastIndex < firstDifference) { // odd case, yet possible
					break; // prevent endless loop
				}
				currentAttributeValue = currentAttributeValue.substring(0,currentDecimalIndex) + stashedDecimalString + currentAttributeValue.substring(currentDecimalLastIndex);
				differenceScanningPosition = stashedDecimalLastIndex + 1; // + 1 OK because there must be at least one character that separates numbers
			} while (true);
			if (currentAttributeValue == stashedAttributeValue) {
				return true;
			}
			differences.push("now getting attribute " + stashedAttributeName + "=\"" + currentNode.value + "\" instead of expected value =\"" + stashedNode.value + "\"");
			return false;
			break;
		case Node.TEXT_NODE:
		case Node.CDATA_SECTION_NODE:
		case Node.COMMENT_NODE:
			var stashedNodeValue = stashedNode.nodeValue;
			var currentNodeValue = currentNode.nodeValue;
			// trim and normalize any sequence of whitespace to a single space
			stashedNodeValue = stashedNodeValue.replace(Adj.trimRegexp,"$1").replace(Adj.whitespacesRegexp," ");
			currentNodeValue = currentNodeValue.replace(Adj.trimRegexp,"$1").replace(Adj.whitespacesRegexp," ");
			if (currentNodeValue == stashedNodeValue) {
				return true;
			} else {
				differences.push("now getting \"…" + currentNodeValue + "…\" instead of expected \"…" + stashedNodeValue + "…\"");
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
			return Adj.areEqualNodes(stashedNode.documentElement, currentNode.documentElement, differences, tolerance);
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

// for running automated tests,
// return string describing difference == failed, or empty string if expected result == passed,
// if not given a documentToDo then default to doing _the_ document
Adj.doDocAndVerify = function doDocAndVerify(documentToDo, tolerance) {
	if (!documentToDo) {
		documentToDo = document;
	}
	if (!tolerance) {
		tolerance = {
			generalInUnits: 0.01, // default
			ifTextFractionOfTotal: 0.05 // if at least one SVG text element
		};
	}
	// get stash
	var stashContent = Adj.stashedDocumentResultAndRemove(documentToDo);
	if (!stashContent) { // apparently no stash
		// cannot verify
		throw "cannot verify because no stash found to compare against";
	}
	// do
	Adj.doDoc(documentToDo);
	// convert to text
	var serializer = new XMLSerializer();
	var documentAsString = serializer.serializeToString(documentToDo);
	// may have to become a bit more tolerant for different browsers and borderline cases, yet not slack
	stashContent = stashContent.replace(Adj.whitespaceBetweenElementsRegexp, "><");
	stashContent = stashContent.replace(Adj.whitespaceAtEndRegexp, "");
	stashContent = stashContent.replace(Adj.whitespacesRegexp, " ");
	stashContent = stashContent.replace(Adj.xmlDeclarationRegexp, "");
	documentAsString = documentAsString.replace(Adj.whitespaceBetweenElementsRegexp, "><");
	documentAsString = documentAsString.replace(Adj.whitespaceAtEndRegexp, "");
	documentAsString = documentAsString.replace(Adj.whitespacesRegexp, " ");
	documentAsString = documentAsString.replace(Adj.xmlDeclarationRegexp, "");
	// compare serialized documents
	if (documentAsString == stashContent) {
		return "";
	}
	// compare as DOM
	var parser = new DOMParser();
	var stashedDom;
	var currentDom;
	var apparentlyGoodParse = false;
	var stashedDomRootElement;
	var currentDomRootElement;
	try {
		stashedDom = parser.parseFromString(stashContent, "application/xml");
		stashedDomRootElement = stashedDom.documentElement;
		if (stashedDomRootElement.localName != "svg") {
			throw "not svg";
		}
		currentDom = parser.parseFromString(documentAsString, "application/xml");
		currentDomRootElement = currentDom.documentElement;
		if (currentDomRootElement.localName != "svg") {
			throw "not svg";
		}
		apparentlyGoodParse = true;
	} catch (exception) {
		apparentlyGoodParse = false;
	}
	var apparentlyEqualDom = false;
	if (apparentlyGoodParse) {
		try {
			apparentlyEqualDom = currentDomRootElement.isEqualNode(stashedDomRootElement);
		} catch (exception) {
			apparentlyEqualDom = false;
		}
	}
	// custom comparison of DOM
	var differences = [];
	if (!apparentlyEqualDom) {
		try {
			stashedDom.normalize();
			currentDom.normalize();
			tolerance.inEffect = tolerance.generalInUnits; // default
			if (stashedDom.getElementsByTagName("text").length) { // at least one SVG text element
				tolerance.inEffect = tolerance.ifTextFractionOfTotal * Math.sqrt(Math.pow(parseFloat(stashedDomRootElement.getAttribute("width")),2)+Math.pow(parseFloat(stashedDomRootElement.getAttribute("height")),2));
			}
			apparentlyEqualDom = Adj.areEqualNodes(stashedDomRootElement, currentDomRootElement, differences, tolerance);
		} catch (exception) {
			apparentlyEqualDom = false;
		}
	}
	if (apparentlyEqualDom) {
		return "";
	} else {
		var differencesString;
		if (differences.length) {
			differencesString = differences.join("; ");
		} else {
			var sLength = stashContent.length;
			var dLength = documentAsString.length;
			var minLength = Math.min(sLength, dLength);
			var firstDifference = minLength;
			for (var i = 0; i < minLength; i++) {
				if (documentAsString[i] != stashContent[i]) {
					firstDifference = i;
					break;
				}
			}
			var sectionFrom = Math.max(firstDifference - 10, 0);
			var stashSection = stashContent.substring(sectionFrom, sectionFrom + 40);
			var documentSection = documentAsString.substring(sectionFrom, sectionFrom + 40);
			differencesString = "a difference near char " + firstDifference + ", now getting \"…" + documentSection + "…\" instead of expected \"…" + stashSection + "…\"";
		}
		return differencesString;
	}
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

AdjTestWindow.receivesMessage = function receivesMessage(evt) {
	// accept any evt.origin
	var messageCommand;
	var messageParameter;
	var messageMatch = AdjTestWindow.messageRegexp.exec(evt.data);
	if (messageMatch) {
		messageCommand = messageMatch[1];
		messageParameter = messageMatch[2];
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
		case "Adj.doDocAndVerify":
			try {
				// do
				var commandResult = Adj.doDocAndVerify();
				// reply
				evt.source.postMessage("Adj.didDocAndVerify|" + window.location.href + "|" + commandResult, "*");
			} catch (exception) {
				exceptionString = exception.toString();
				// reply
				evt.source.postMessage("Adj.didDocAndVerifyException|" + window.location.href + "|" + exceptionString, "*");
			}
			break;
		case "Adj.doDoc":
			var commandResult = Adj.doDoc();
			break;
		default:
	}
}

// see https://developer.mozilla.org/en-US/docs/DOM/window.postMessage
window.addEventListener("message", AdjTestWindow.receivesMessage, false);
