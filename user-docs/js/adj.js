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
// Contributor - Hans Baschy
//
// ==============================================================================
//
// Project contact: <adj.project AT nrvr DOT com>
//
// ==============================================================================
//
// Public repository - https://github.com/srguiwiz/adj-js
//
// Stable releases (recent) - https://github.com/srguiwiz/adj-js/releases
//
// Blog - http://leosbog.nrvr.com/category/adj/
//
// Commit list - https://github.com/srguiwiz/adj-js/commits/master

// Invoke Adj by doing Adj.doSvg(theSvgElement), e.g. <svg onload="Adj.doSvg(this);">,
// optionally even shorter <svg onload="Adj.doSvg()">.
//
// Adj.doSvg() runs asynchronously, hence optionally a callback function can be passed,
// which optionally may use the SVG element or array of SVG elements it will be passed.
//
// In this example note the sequence when running
//
//   Adj.doSvg(function (svg) {
//     console.log('done with', svg)
//   });
//   console.log('starting');
//
// Adj.doSvg() runs asynchronously, hence there is little benefit to catching exceptions.

// the singleton
var Adj = {};
Adj.version = { major:6, minor:1, revision:6 };
Adj.algorithms = {};

// constants
Adj.SvgNamespace = "http://www.w3.org/2000/svg";
Adj.AdjNamespace = "http://www.nrvr.com/2012/adj";
Adj.XLinkNamespace = "http://www.w3.org/1999/xlink";
//
Adj.AdjNamespacePrefix = "adj";
Adj.XLinkNamespacePrefix = "xlink";

// main invocation
// if not given a documentNodeOrAnSvgElement then default to doing all SVG elements in the document;
//
// doSvgDoneCallback is optional here and in most or all other functions defined in this library
// will be called as doSvgDoneCallback(oneSvgElementOrSvgElements);
//
// most exceptions will be shown in the SVG element and swallowed;
// UI failure should not prevent further execution of business logic and
// have least possible impact on a potentially important course of action;
// also https://www.google.com/search?q=exception+swallow
Adj.doSvg = function doSvg (documentNodeOrAnSvgElement, doSvgDoneCallback) {
	// accommodate sloppy parameter passing
	if (!doSvgDoneCallback && typeof documentNodeOrAnSvgElement === "function") {
		doSvgDoneCallback = documentNodeOrAnSvgElement;
		documentNodeOrAnSvgElement = undefined;
	}
	documentNodeOrAnSvgElement = documentNodeOrAnSvgElement || document;
	// under the document node, which isn't an element, is one root element, in an SVG document an <svg> element
	var element = documentNodeOrAnSvgElement.documentElement || documentNodeOrAnSvgElement;
	//
	// main-SVG-intent versus inlined-SVG-workaround
	if (element instanceof SVGSVGElement) {
		// simple original intent
		Adj.processAdjElements(element, doSvgDoneCallback);
	} else {
		// supposed to work for all instances of SVG elements inlined in an HTML document
		var svgElements = Array.prototype.slice.call(documentNodeOrAnSvgElement.querySelectorAll("svg"));
		// limit to outermost SVG elements for this level invocation, in case any nested
		var nestedSvgElements = documentNodeOrAnSvgElement.querySelectorAll("svg svg");
		for (var i = 0, n = nestedSvgElements.length, j = 0; i < n; i++) {
			var nestedSvgElement = nestedSvgElements[i];
			while (j < svgElements.length) {
				if (nestedSvgElement.isEqualNode(svgElements[j])) {
					svgElements.splice(j, 1);
					break;
				} else {
					j++;
				}
			}
		}
		//
		var svgElementsProcessing = {};
		if (svgElements.length) {
			// setting all svgElementsProcessing first, in case all processDoneCallback will be invoked synchronously,
			// nevertheless need to keep track of elements processing, in case one will be invoked asynchronously
			for (var i = 0, n = svgElements.length; i < n; i++) {
				var oneSvgElement = svgElements[i];
				// keep track of elements processing
				svgElementsProcessing[Adj.runtimeId(oneSvgElement)] = oneSvgElement;
			}
			for (var i = 0, n = svgElements.length; i < n; i++) {
				var oneSvgElement = svgElements[i];
				Adj.processAdjElements(oneSvgElement, function oneDoSvgDoneCallback (oneSvgElement) {
					// keep track of elements processing
					delete svgElementsProcessing[Adj.runtimeId(oneSvgElement)];
					//
					if (doSvgDoneCallback) {
						if (!Object.keys(svgElementsProcessing).length) { // if 0
							// no outstanding processing means done with all Adj.processAdjElements
							doSvgDoneCallback(svgElements);
						}
					}
				});
			}
		} else { // not even one SVG element
			// make sure doSvgDoneCallback is called anyway
			if (doSvgDoneCallback) {
				// call asynchronously even in this case
				window.setImmediate(function () {
					doSvgDoneCallback(svgElements);
				});
			}
		}
	}
};

// complete processing of all phases
//
// processDoneCallback is optional here and in most or all other functions defined in this library
// will be called as processDoneCallback(theSvgElement);
Adj.processAdjElements = (function() {
	function processAdjElements (theSvgElement, processDoneCallback) {
		if (!(theSvgElement instanceof SVGSVGElement)) {
			console.error("Adj skipping because invoked with something other than required SVGSVGElement");
			// make sure processDoneCallback is called anyway
			if (processDoneCallback) {
				// call asynchronously even in this case
				window.setImmediate(function () {
					processDoneCallback(theSvgElement);
				});
			} // else { // swallow instead of throw error;
			return;
		}
		//
		var adjProcessing = theSvgElement.adjProcessing;
		if (!adjProcessing) {
			adjProcessing = theSvgElement.adjProcessing = {
				// the only correct context to call method processAdjElementsCore, ever
				singlifier: new Adj.Singlifier(processAdjElementsCore.bind(Adj, theSvgElement)),
				ongoing: false,
				ongoingCallbacks: [],
				nextCallbacks: []
			};
		}
		//
		if (processDoneCallback) {
			adjProcessing.nextCallbacks.push(processDoneCallback);
		}
		adjProcessing.singlifier.invokeSooner();
	};
	//
	// private function to prevent inherently wrong calls from other context
	function processAdjElementsCore (theSvgElement) {
		var adjProcessing = theSvgElement.adjProcessing;
		// there may be callbacks yet to be called in ongoingCallbacks
		adjProcessing.ongoingCallbacks = adjProcessing.ongoingCallbacks.concat(adjProcessing.nextCallbacks);
		adjProcessing.nextCallbacks = []; // reset
		try {
			//
			// remove certain nodes for a new start, in case any such are present from earlier processing
			Adj.modifyMaybeRemoveChildren
			(theSvgElement,
			 function (node,child) {
				if (child.adjPermanentArtifact || Adj.elementGetAttributeInAdjNS(child, "artifact")) {
					child.adjPermanentArtifact = true;
					child.adjRemoveElement = true;
				}
				if (child.adjExplanationArtifact || Adj.elementGetAttributeInAdjNS(child, "explanation")) {
					child.adjExplanationArtifact = true;
					child.adjRemoveElement = true;
				}
			 });
			//
			// for Adj.algorithms.include
			theSvgElement.adjAsyncGetTextFileRequesters = theSvgElement.adjAsyncGetTextFileRequesters || {};
			//
			// read Adj elements and make or update phase handlers
			Adj.parseTheSvgElementForAdjElements(theSvgElement);
			//
			// then process
			Adj.processTheSvgElementWithPhaseHandlers(theSvgElement);
			//
		} catch (exception) {
			Adj.displayException(exception, theSvgElement);
			// swallow instead of throw exception;
		} finally {
			var ongoingCallbacks = adjProcessing.ongoingCallbacks;
			if (ongoingCallbacks.length) {
				if (!Object.keys(theSvgElement.adjAsyncGetTextFileRequesters).length) { // if 0
					// no outstanding requests means done with all Adj.algorithms.include
					//
					try {
						for (var i = 0, n = ongoingCallbacks.length; i < n ; i++) {
							ongoingCallbacks[i](theSvgElement);
						}
					} catch (exception) {
						// silently swallow exceptions from callbacks,
						// those should do their own exception handling if desired
					}
				} else {
					// at least one outstanding request, put back ongoingCallbacks
					adjProcessing.nextCallbacks = adjProcessing.ongoingCallbacks.concat(adjProcessing.nextCallbacks);
				}
				adjProcessing.ongoingCallbacks = []; // let go
			}
		}
	};
	//
	return processAdjElements;
})();

// generic installer
Adj.setAlgorithm = function setAlgorithm (target, algorithmName, parametersObject, element) {
	var theSvgElement = target.ownerSVGElement || target;
	//
	parametersObject = parametersObject || {}; // if no parametersObject given then empty object
	element = element || target; // if no element given then same as target, element === target is normal
	var algorithm = Adj.algorithms[algorithmName];
	if (!algorithm) {
		// tolerate, for now
		console.error("Adj skipping unknown algorithm name " + algorithmName);
		return;
	}
	//
	var phaseHandlerNames = algorithm.phaseHandlerNames;
	var methods = algorithm.methods;
	//
	// phaseHandlers is an associative array object which for a phaseHandlerName key as value has an array of phaseHandler, if there is any
	var phaseHandlers = target.adjPhaseHandlers;
	phaseHandlers = phaseHandlers || {}; // if no phaseHandlers yet then new associative array object
	target.adjPhaseHandlers = phaseHandlers;
	//
	for (var phaseHandlerIndex in phaseHandlerNames) {
		var phaseHandlerName = phaseHandlerNames[phaseHandlerIndex];
		var phaseHandler = { // stuff everything needed into one phaseHandler object
			element: element,
			algorithm: algorithm,
			method: methods[phaseHandlerIndex],
			parametersObject: parametersObject // shared for one element for all method invocations of one algorithm
		};
		//console.log("a " + element.nodeName + " element gets a " + phaseHandlerName + " handler with a " + algorithmName + " algorithm");
		var phaseHandlersForThisPhase = phaseHandlers[phaseHandlerName];
		phaseHandlersForThisPhase = phaseHandlersForThisPhase || []; // if no phaseHandlersForThisPhase yet then new array
		phaseHandlersForThisPhase.push(phaseHandler);
		phaseHandlers[phaseHandlerName] = phaseHandlersForThisPhase;
		//
		theSvgElement.adjPhaseHandlerNamesOccurringByName[phaseHandlerName] = true;
	}
	//
	if (algorithm.notAnOrder1Element) {
		element.adjNotAnOrder1Element = true;
		Adj.hideByDisplayAttribute(element);
	}
	if (algorithm.hiddenByCommand) {
		element.adjHiddenByCommand = true;
		Adj.hideByDisplayAttribute(element);
	}
	if (algorithm.processSubtreeOnlyInPhaseHandler) {
		element.adjProcessSubtreeOnlyInPhaseHandler = algorithm.processSubtreeOnlyInPhaseHandler; // try being cleverer ?
	}
};

// utility
Adj.getPhaseHandlersForElementForAlgorithmName = function getPhaseHandlersForElementForAlgorithmName (target, algorithmName) {
	var matchingPhaseHandlers = [];
	var algorithm = Adj.algorithms[algorithmName];
	if (!algorithm) {
		return matchingPhaseHandlers;
	}
	var phaseHandlersForThisPhase = target.adjPhaseHandlers[algorithm.phaseHandlerName];
	if (!phaseHandlersForThisPhase) {
		return matchingPhaseHandlers;
	}
	var numberOfPhaseHandlersForThisPhase = phaseHandlersForThisPhase.length;
	for (var i = 0; i < numberOfPhaseHandlersForThisPhase; i++) {
		var phaseHandler = phaseHandlersForThisPhase[i];
		if (phaseHandler.algorithm === algorithm) {
			matchingPhaseHandlers.push(phaseHandler);
		}
	}
	return matchingPhaseHandlers;
};

// constants
// recognize a boolean or decimal
Adj.booleanOrDecimalRegexp = /^\s*(true|false|[+-]?[0-9]+\.?[0-9]*|[0-9]*\.?[0-9]+)\s*$/;
// recognize a boolean
Adj.booleanRegexp = /^\s*(true|false)\s*$/;
// recognize a valid phase handler name
Adj.phaseHandlerNameRegexp = /^(adjPhase[0-9])(Down|Up|)$/;

// read Adj elements and make or update phase handlers,
// entry point
Adj.parseTheSvgElementForAdjElements = function parseTheSvgElementForAdjElements (theSvgElement) {
	// first clear theSvgElement.adjSomething properties for a new start
	// TODO consider whether setting undefined or null is better than delete, should verify all uses,
	// also see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/in#Using_in_with_deleted_or_undefined_properties
	theSvgElement.adjIdsDictionary = undefined;
	theSvgElement.adjPhaseHandlerNamesOccurringByName = {};
	theSvgElement.adjPhaseNamesOccurring = undefined;
	theSvgElement.adjIncludingElement = undefined;
	//
	// then walk
	Adj.parseAdjElementsToPhaseHandlers(theSvgElement);
	//
	// determine which phases are occurring in this document
	var phaseHandlerNamesOccurringByName = theSvgElement.adjPhaseHandlerNamesOccurringByName;
	var phaseNamesOccurringByName = {};
	for (var phaseHandlerName in phaseHandlerNamesOccurringByName) {
		var nameMatch = Adj.phaseHandlerNameRegexp.exec(phaseHandlerName);
		if (nameMatch) {
			var phaseName = nameMatch[1];
			phaseNamesOccurringByName[phaseName] = true;
		}
	}
	var phaseNamesOccurringInOrder = [];
	for (var phaseName in phaseNamesOccurringByName) {
		phaseNamesOccurringInOrder.push(phaseName);
	}
	phaseNamesOccurringInOrder.sort();
	theSvgElement.adjPhaseNamesOccurring = phaseNamesOccurringInOrder;
	//
	// define some global adjVariables
	// intentionally here to avoid many conditional evaluations
	var globalVariables = theSvgElement.adjVariables = theSvgElement.adjVariables || {};
	globalVariables.windowInnerWidth = globalVariables.windowInnerWidth || function windowInnerWidth () { return window.innerWidth; };
	globalVariables.windowInnerHeight = globalVariables.windowInnerHeight || function windowInnerHeight () { return window.innerHeight; };
};

// build on first use, so any algorithms added e.g. from other source files will be considered too
Adj.commandNamesUsingParameterName = function commandNamesUsingParameterName (parameterNameToMatch) {
	var commandNamesByParameterName = Adj.commandNamesByParameterName;
	if (!commandNamesByParameterName) {
		commandNamesByParameterName = Adj.commandNamesByParameterName = {};
		var algorithms = Adj.algorithms;
		for (var algorithmName in algorithms) {
			var parameterNames = algorithms[algorithmName].parameters;
			for (var i in parameterNames) {
				var parameterName = parameterNames[i];
				var commandNamesForParameterName = commandNamesByParameterName[parameterName];
				if (!commandNamesForParameterName) {
					commandNamesForParameterName = commandNamesByParameterName[parameterName] = [];
				}
				// commandName === algorithmName, for now
				commandNamesForParameterName.push(algorithmName);
			}
		}
	}
	return commandNamesByParameterName[parameterNameToMatch];
};

// utility
Adj.parameterParse = function parameterParse (value) {
	var numberMatch = Adj.booleanOrDecimalRegexp.exec(value);
	if (numberMatch) { // !isNaN(value) would miss boolean
		// keep booleans and decimal and integer numbers as is
		value = numberMatch[1];
		switch (value) {
			case "true":
				value = true;
				break;
			case "false":
				value = false;
				break;
			default:
				value = Number(value);
		}
	}
	return value;
};

// utility
// expects element to be an Adj element
Adj.collectParameters = function collectParameters (element) {
	var namespaceImplementation = Adj.namespaceImplementation(element.ownerDocument); // no-namespace-workaround
	//
	var parameters = { commandElement: element };
	var attributes = element.attributes;
	for (var i = 0, numberOfAttributes = attributes.length; i < numberOfAttributes; i++) {
		var attribute = attributes[i];
		if (namespaceImplementation === "full") { // normal-namespace-intent
			if (!attribute.namespaceURI || attribute.namespaceURI === Adj.AdjNamespace) {
				parameters[Adj.mixedCasedName(attribute.localName)] = Adj.parameterParse(attribute.value);
			}
		} else if (namespaceImplementation === "obtuse") { // no-namespace-workaround
			var splitAttributeName = Adj.nameSplitByColon(attribute.name);
			if (!splitAttributeName.prefix || splitAttributeName.prefix === Adj.AdjNamespacePrefix) {
				parameters[Adj.mixedCasedName(splitAttributeName.localPart)] = Adj.parameterParse(attribute.value);
			}
		} else { // holstein-namespace-workaround
			var splitAttributeName = Adj.nameSplitByColon(attribute.name);
			if (!splitAttributeName.prefix || splitAttributeName.prefix === Adj.AdjNamespacePrefix) {
				parameters[Adj.mixedCasedName(splitAttributeName.localPart)] = Adj.parameterParse(attribute.value);
			} else if (!attribute.namespaceURI || attribute.namespaceURI === Adj.AdjNamespace) {
				parameters[Adj.mixedCasedName(attribute.localName)] = Adj.parameterParse(attribute.value);
			}
		}
	}
	return parameters;
};

// abstraction
// returns local name, i.e. without prefix, or returns null if not an Adj element,
// implemented with an assumption an Adj element has to be a child of an SVG element,
// hence if that assumption would not hold true then implementation should be changed
Adj.elementNameInAdjNS = function elementNameInAdjNS (element) {
	var namespaceImplementation = Adj.namespaceImplementation(element.ownerDocument); // no-namespace-workaround
	//
	var elementName = null;
	if (namespaceImplementation === "full") { // normal-namespace-intent
		if (element.namespaceURI === Adj.AdjNamespace) { // if an Adj element
			elementName = Adj.mixedCasedName(element.localName);
		}
	} else if (namespaceImplementation === "obtuse") { // no-namespace-workaround
		var splitElementName = Adj.nameSplitByColon(element.tagName);
		if (splitElementName.prefix === Adj.AdjNamespacePrefix) {
			elementName = Adj.mixedCasedName(splitElementName.localPart);
		}
	} else { // holstein-namespace-workaround
		var splitElementName = Adj.nameSplitByColon(element.tagName);
		if (splitElementName.prefix === Adj.AdjNamespacePrefix) {
			elementName = Adj.mixedCasedName(splitElementName.localPart);
		} else if (element.namespaceURI === Adj.AdjNamespace) { // if an Adj element
			elementName = Adj.mixedCasedName(element.localName);
		}
	}
	return elementName;
};

// utility
// collect all Adj attributes of an element
Adj.adjAttributesByNameOf = function adjAttributesByNameOf (element) {
	var namespaceImplementation = Adj.namespaceImplementation(element.ownerDocument); // no-namespace-workaround
	//
	// then look for newer alternative syntax Adj commands as attributes
	var adjAttributesByName = {};
	var attributes = element.attributes;
	for (var i = 0, numberOfAttributes = attributes.length; i < numberOfAttributes; i++) {
		var attribute = attributes[i];
		// normal-namespace-intent
		if (attribute.namespaceURI === Adj.AdjNamespace) {
			adjAttributesByName[Adj.mixedCasedName(attribute.localName)] = attribute;
		} else if (namespaceImplementation !== "full") { // no-namespace-workaround
			var splitAttributeName = Adj.nameSplitByColon(attribute.name);
			if (splitAttributeName.prefix === Adj.AdjNamespacePrefix) {
				adjAttributesByName[Adj.mixedCasedName(splitAttributeName.localPart)] = attribute;
			}
		}
	}
	return adjAttributesByName;
};

// utility
// make parameters object from collected attributes
Adj.parametersFromAttributes = function parametersFromAttributes (attributesByName) {
	var parametersByName = {};
	for (var attributeName in attributesByName) {
		parametersByName[attributeName] = Adj.parameterParse(attributesByName[attributeName].value);
	}
	return parametersByName;
}

// node.adjS could mean "Adj's" or "Adj Stuff" or "Adj's Stuff" and is meant to be extensible;
// if needed a node.adjZ could be like node.adjS that, however, would be cleared

// read Adj elements and make or update phase handlers,
// recursive walking of the tree,
// expects node to be an SVG element, not to be an Adj element, but a child can be an Adj element
Adj.parseAdjElementsToPhaseHandlers = function parseAdjElementsToPhaseHandlers (node) {
	// first clear node.adjSomething properties for a new start
	delete node.adjPhaseHandlers;
	delete node.adjProcessSubtreeOnlyInPhaseHandler;
	//delete node.adjPlacementArtifact; // probably safe not to delete, element should be gone
	delete node.adjNotAnOrder1Element;
	delete node.adjHiddenByCommand;
	//delete node.adjPermanentArtifact; // probably safe not to delete, element should be gone
	//delete node.adjExplanationArtifact; // probably safe not to delete, element should be gone
	//delete node.adjRemoveElement; // probably safe not to delete, element should be gone
	Adj.unhideByDisplayAttribute(node); // does delete node.adjOriginalDisplay
	delete node.adjLevel;
	delete node.adjVariables;
	//delete node.adjIncluded; // intentionally not clearing flag, include only first time
	//delete node.adjS; // intentionally not deleting, set only first time
	//
	// then look for newer alternative syntax Adj commands as attributes
	var adjAttributesByName = Adj.adjAttributesByNameOf(node);
	// first find out which commands
	var commandParametersByName = {};
	for (var adjAttributeName in adjAttributesByName) {
		switch (adjAttributeName) {
			case "command":
				var commandName = adjAttributesByName[adjAttributeName].value;
				commandParametersByName[commandName] = { commandElement: node };
				delete adjAttributesByName[adjAttributeName]; // done with
				break;
			case "textBreaks":
			case "rider":
			case "floater":
			case "fit":
			case "tilt":
			case "hide":
			case "explain":
				// these commands can coexist with another command,
				// though only some combinations make sense, while others cause conflicts,
				// those that do work allow nicely looking SVG/Adj source, hence keeping this, for now
				if (Adj.doVarsBoolean(node, adjAttributesByName[adjAttributeName].value, false, "used as attribute adj:" + adjAttributeName)) { // must be ="true", skip if ="false"
					commandParametersByName[adjAttributeName] = { commandElement: node };
				}
				break;
			default:
				break;
		}
	}
	if (Object.keys(commandParametersByName).length) { // as an optimization only if any command at all
		// then assign parameters to their appropriate commands
		for (var adjAttributeName in adjAttributesByName) {
			var commandNamesUsingParameterName = Adj.commandNamesUsingParameterName(adjAttributeName);
			if (commandNamesUsingParameterName) {
				var adjAttributeValue = Adj.parameterParse(adjAttributesByName[adjAttributeName].value);
				for (var i in commandNamesUsingParameterName) {
					var commandName = commandNamesUsingParameterName[i];
					var commandParameters = commandParametersByName[commandName];
					if (commandParameters) {
						commandParameters[adjAttributeName] = adjAttributeValue;
					}
				}
			}
		}
		for (var commandName in commandParametersByName) {
			// commandName === algorithmName, for now
			Adj.setAlgorithm(node, commandName, commandParametersByName[commandName]);
		}
	} // else { // e.g. an adj:rcGridPart
	//
	// then walk
	for (var child = node.firstChild; child; child = child.nextSibling) {
		if (child instanceof Element) { // if an XML element, e.g. not an XML #text
			var algorithmName = Adj.elementNameInAdjNS(child);
			if (algorithmName) { // if an Adj element
				var parameters = Adj.collectParameters(child);
				switch (algorithmName) {
					case "variable":
						var variableName = parameters["name"];
						if (variableName) {
							var variableValue = parameters["value"];
							var variables = node.adjVariables;
							if (!variables) {
								variables = node.adjVariables = {};
							}
							if (variableValue != undefined) {
								variables[variableName] = variableValue;
							} else {
								delete variables[variableName];
							}
						}
						break;
					default:
						Adj.setAlgorithm(node, algorithmName, parameters);
						break;
				}
				continue;
			}
		}
		if (!(child instanceof SVGElement)) {
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		if (!child.getBBox) {
			continue; // skip if not an SVGLocatable, e.g. a <script> element
		}
		Adj.parseAdjElementsToPhaseHandlers(child); // recursion
	}
};

// complete processing of all phases
Adj.processTheSvgElementWithPhaseHandlers = function processTheSvgElementWithPhaseHandlers (theSvgElement) {
	Adj.processElementWithPhaseHandlers(theSvgElement);
	// a singleton
	var svgElementBoundingBox = theSvgElement.getBBox();
	theSvgElement.setAttribute("width", Adj.decimal(svgElementBoundingBox.x + svgElementBoundingBox.width));
	theSvgElement.setAttribute("height", Adj.decimal(svgElementBoundingBox.y + svgElementBoundingBox.height));
	// necessary cleanup
	Adj.modifyMaybeRemoveChildren
	(theSvgElement,
	 function (node,child) {
		if (child.adjPlacementArtifact) {
			// remove certain nodes that have been created for use during processing
			child.adjRemoveElement = true;
			return;
		}
		if (child.adjNotAnOrder1Element) {
			Adj.unhideByDisplayAttribute(child);
		}
		if (child.adjExplanationArtifact) {
			Adj.unhideByDisplayAttribute(child, true);
		}
	 });
};

// complete processing of all phases
Adj.processElementWithPhaseHandlers = function processElementWithPhaseHandlers (element, thisTimeFullyProcessSubtree, level) {
	// every SVGElement has an .ownerElement except theSvgElement itself as an SVGSVGElement doesn't have an .ownerElement,
	// therefore, in order to avoid null, this library often writes theSvgElement = element.ownerSVGElement || element,
	// but more correct logic would be theSvgElement = element instanceof SVGSVGElement ? element : element.ownerSVGElement
	var theSvgElement = element instanceof SVGSVGElement ? element : element.ownerSVGElement;
	//
	var phaseNamesOccurring = theSvgElement.adjPhaseNamesOccurring;
	for (var i = 0, n = phaseNamesOccurring.length; i < n; i++) {
		var phaseName = phaseNamesOccurring[i];
		Adj.walkNodes(element, phaseName, thisTimeFullyProcessSubtree, level);
	}
};

// recursive walking of the tree
Adj.walkNodes = function walkNodes (node, phaseName, thisTimeFullyProcessSubtree, level) {
	level = level || 1; // if no level given then 1
	//console.log("phase " + phaseName + " level " + level + " going into " + node.nodeName);
	//
	var phaseHandlers = node.adjPhaseHandlers;
	//
	var processSubtreeOnlyInPhaseHandler = node.adjProcessSubtreeOnlyInPhaseHandler;
	if (processSubtreeOnlyInPhaseHandler) { // e.g. a rider, or a floater
		if (!thisTimeFullyProcessSubtree) { // first time getting here
			if (processSubtreeOnlyInPhaseHandler != phaseName) {
				return; // skip
			} else { // processSubtreeOnlyInPhaseHandler === phaseName
				if (phaseHandlers) {
					var subtreePhaseHandlerName = phaseName;
					var phaseHandlersForSubtreeName = phaseHandlers[subtreePhaseHandlerName];
					if (phaseHandlersForSubtreeName) { // e.g. a rider, or a floater
						// expect only one
						for (var subtreeIndex in phaseHandlersForSubtreeName) {
							var phaseHandler = phaseHandlersForSubtreeName[subtreeIndex];
							phaseHandler.method(phaseHandler.element, phaseHandler.parametersObject, level);
						}
					}
				}
				return; // return to allow phaseHandler to do its thing and call back here with thisTimeFullyProcessSubtree
			}
		}
	}
	//
	if (phaseHandlers) {
		var downPhaseHandlerName = phaseName + "Down";
		var phaseHandlersForDownName = phaseHandlers[downPhaseHandlerName];
		if (phaseHandlersForDownName) {
			for (var downIndex in phaseHandlersForDownName) {
				var phaseHandler = phaseHandlersForDownName[downIndex];
				phaseHandler.method(phaseHandler.element, phaseHandler.parametersObject, level);
			}
		}
	}
	//
	for (var child = node.firstChild; child; child = child.nextSibling) {
		if (!(child instanceof SVGElement)) {
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		if (!child.getBBox) {
			continue; // skip if not an SVGLocatable, e.g. a <script> element
		}
		if (child.adjHiddenByCommand) {
			continue; // skip
		}
		Adj.walkNodes(child, phaseName, false, level + 1); // recursion
	}
	//
	if (phaseHandlers) {
		var upPhaseHandlerName = phaseName + "Up";
		var phaseHandlersForUpName = phaseHandlers[upPhaseHandlerName];
		if (phaseHandlersForUpName) {
			for (var upIndex in phaseHandlersForUpName) {
				var phaseHandler = phaseHandlersForUpName[upIndex];
				phaseHandler.method(phaseHandler.element, phaseHandler.parametersObject, level);
			}
		}
	}
	//console.log("phase " + phaseName + " level " + level + " cming outa " + node.nodeName);
};

// modification and selective removing
Adj.modifyMaybeRemoveChildren = function modifyMaybeRemoveChildren (node, modifyMaybeMarkFunctionOfNodeAndChild) {
	for (var child = node.firstChild; child; ) { // because of removeChild here cannot child = child.nextSibling
		if (!(child instanceof SVGElement)) {
			child = child.nextSibling;
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		if (!child.getBBox) {
			child = child.nextSibling;
			continue; // skip if not an SVGLocatable, e.g. a <script> element
		}
		var conditionValue = modifyMaybeMarkFunctionOfNodeAndChild(node,child);
		if (child.adjRemoveElement) {
			var childToRemove = child;
			child = child.nextSibling;
			node.removeChild(childToRemove);
			continue;
		}
		Adj.modifyMaybeRemoveChildren(child, modifyMaybeMarkFunctionOfNodeAndChild); // recursion
		child = child.nextSibling;
	}
};

// constants
Adj.leftCenterRight = { left:0, center:0.5, right:1 };
Adj.topMiddleBottom = { top:0, middle:0.5, bottom:1 };
Adj.insideMedianOutside = { inside:0, median:0.5, outside:1 };
Adj.fromHalfwayTo = { from:0, halfway:0.5, to:1 };
Adj.noneClearNear = { none:"none", clear:"clear", near:"near" };
Adj.eastSouthWestNorth = { east:0, south:90, west:180, north:270 };

// utility
// if one and other both are integers and not too close then round result to be an integer as well
Adj.fraction = function fraction (one, other, fraction, roundNoCloser, roundIfIntegers) {
	roundNoCloser = roundNoCloser != undefined ? roundNoCloser : 0; // default roundNoCloser = 0
	roundIfIntegers = roundIfIntegers != undefined ? roundIfIntegers : true; // default roundIfInteger = true
	fraction = one + (other - one) * fraction;
	if (roundIfIntegers) {
		if (one % 1 === 0 && other % 1 === 0) { // both are integers
			if (Math.abs(other - one) >= roundNoCloser) { // exactly or further apart than roundNoCloser
				return Math.round(fraction);
			} else { // don't round closer
				return fraction;
			}
		} else { // not both integers
			return fraction;
		}
	} else { // don't round ever
		return fraction;
	}
};

// utility
Adj.decimal = function decimal (number, decimalDigits) {
	decimalDigits = decimalDigits != undefined ? decimalDigits : 3; // default decimal = 3
	var factor = Math.pow(10, decimalDigits);
	return Math.round(number * factor) / factor;
};

// utility
// optional elementToLookupPrefix apparently needed at least in some versions Chrome and Internet Explorer
Adj.qualifyName = function qualifyName (element, namespaceURI, localName, elementToLookupPrefix) {
	var prefix = (elementToLookupPrefix || element).lookupPrefix(namespaceURI);
	if (prefix) {
		return prefix + ":" + localName;
	} else {
		return localName;
	}
};

// utility
// as implemented caches
Adj.prefixName = (function () {
	var prefixedNamesByPrefix = {};
	return function prefixName (namespacePrefix, name) {
		var prefixedNamesForPrefix =
			prefixedNamesByPrefix[namespacePrefix] || (prefixedNamesByPrefix[namespacePrefix] = {});
		var prefixedName =
			prefixedNamesForPrefix[name] || (prefixedNamesForPrefix[name] = namespacePrefix + ":" + name);
		return prefixedName;
	};
})();

// abstraction
Adj.elementGetAttributeInNS = function elementGetAttributeInNS (element, namespace, prefix, name) {
	var namespaceImplementation = Adj.namespaceImplementation(element.ownerDocument); // no-namespace-workaround
	if (namespaceImplementation === "full") {
		// normal-namespace-intent
		return element.getAttributeNS(namespace, name);
	} else if (namespaceImplementation === "obtuse") { // no-namespace-workaround
		return element.getAttribute(Adj.prefixName(prefix, name));
	} else { // holstein-namespace-workaround
		return element.getAttributeNS(namespace, name)
			|| element.getAttribute(Adj.prefixName(prefix, name));
	}
};
// abstraction
Adj.elementGetAttributeInAdjNS = function elementGetAttributeInAdjNS (element, name) {
	return Adj.elementGetAttributeInNS(element, Adj.AdjNamespace, Adj.AdjNamespacePrefix, name);
};
// abstraction
Adj.elementGetAttributeInXLinkNS = function elementGetAttributeInXLinkNS (element, name) {
	return Adj.elementGetAttributeInNS(element, Adj.XLinkNamespace, Adj.XLinkNamespacePrefix, name);
};

// abstraction
// optional elementToLookupPrefix apparently needed at least in some versions Chrome and Internet Explorer
Adj.elementSetAttributeInNS = function elementSetAttributeInNS (element, namespace, prefix, name, value, elementToLookupPrefix) {
	var namespaceImplementation = Adj.namespaceImplementation(element.ownerDocument); // no-namespace-workaround
	if (namespaceImplementation === "full") {
		// normal-namespace-intent
		element.setAttributeNS(namespace, Adj.qualifyName(element, namespace, name, elementToLookupPrefix), value);
	} else if (namespaceImplementation === "obtuse") { // no-namespace-workaround
		element.setAttribute(Adj.prefixName(prefix, name), value);
	} else { // holstein-namespace-workaround
		// trying to be clever and safely cover all cases,
		// admittedly not yet fully tested in all possible situations and browsers
		if (element.getAttributeNS(namespace, name)) { // this kind pre-existing
			element.setAttributeNS(namespace, Adj.qualifyName(element, namespace, name, elementToLookupPrefix), value);
		} else if (element.getAttribute(Adj.prefixName(prefix, name))) { // that kind pre-existing
			element.setAttribute(Adj.prefixName(prefix, name), value);
		} else { // otherwise
			Adj.elementRemoveAttributeInNS(element, namespace, prefix, name); // cover all possibilities
			// if no other reason then do the preferred kind
			element.setAttributeNS(namespace, Adj.qualifyName(element, namespace, name, elementToLookupPrefix), value);
		}
	}
};
// abstraction
// optional elementToLookupPrefix apparently needed at least in some versions Chrome and Internet Explorer
Adj.elementSetAttributeInAdjNS = function elementSetAttributeInAdjNS (element, name, value, elementToLookupPrefix) {
	Adj.elementSetAttributeInNS(element, Adj.AdjNamespace, Adj.AdjNamespacePrefix, name, value, elementToLookupPrefix);
};
// abstraction
// optional elementToLookupPrefix apparently needed at least in some versions Chrome and Internet Explorer
Adj.elementSetAttributeInXLinkNS = function elementSetAttributeInXLinkNS (element, name, value, elementToLookupPrefix) {
	Adj.elementSetAttributeInNS(element, Adj.XLinkNamespace, Adj.XLinkNamespacePrefix, name, value, elementToLookupPrefix);
};

// abstraction
Adj.elementRemoveAttributeInNS = function elementRemoveAttributeInNS (element, namespace, prefix, name) {
	var namespaceImplementation = Adj.namespaceImplementation(element.ownerDocument); // no-namespace-workaround
	if (namespaceImplementation === "full") {
		// normal-namespace-intent
		element.removeAttributeNS(namespace, name);
	} else if (namespaceImplementation === "obtuse") { // no-namespace-workaround
		element.removeAttribute(Adj.prefixName(prefix, name));
	} else { // holstein-namespace-workaround
		// cover all possibilities
		element.removeAttributeNS(namespace, name);
		element.removeAttribute(Adj.prefixName(prefix, name));
	}
};
// abstraction
Adj.elementRemoveAttributeInAdjNS = function elementRemoveAttributeInAdjNS (element, name) {
	Adj.elementRemoveAttributeInNS(element, Adj.AdjNamespace, Adj.AdjNamespacePrefix, name);
};

// utility
Adj.createSVGElement = function createSVGElement (ownerDocument, elementName, additionalProperties) {
	var element = ownerDocument.createElementNS(Adj.SvgNamespace, elementName);
	if (additionalProperties) {
		for (var propertyName in additionalProperties) {
			element[propertyName] = additionalProperties[propertyName];
		}
	}
	return element;
};

// utility
Adj.hideByDisplayAttribute = function hideByDisplayAttribute (element) {
	var originalDisplay = element.getAttribute("display");
	if (!originalDisplay) {
		originalDisplay = "-"; // encode the fact there wasn't any
	}
	if (!element.adjOriginalDisplay) {
		element.adjOriginalDisplay = originalDisplay;
		Adj.elementSetAttributeInAdjNS(element, "originalDisplay", element.adjOriginalDisplay);
	}
	element.setAttribute("display", "none");
};

// utility
Adj.unhideByDisplayAttribute = function unhideByDisplayAttribute (element, evenIfNoOriginalDisplay) {
	var originalDisplay = element.adjOriginalDisplay;
	if (!originalDisplay) {
		originalDisplay = Adj.elementGetAttributeInAdjNS(element, "originalDisplay");
	}
	if (originalDisplay) {
		if (originalDisplay !== "-") {
			element.setAttribute("display", originalDisplay);
		} else { // === "-" is code for the fact there wasn't any
			element.removeAttribute("display");
		}
	} else if (evenIfNoOriginalDisplay) {
		element.removeAttribute("display");
	}
	delete element.adjOriginalDisplay;
	Adj.elementRemoveAttributeInAdjNS(element, "originalDisplay");
};

// utility
Adj.createArtifactElement = function createArtifactElement (name, parent) {
	var artifactElement = Adj.createSVGElement(parent.ownerDocument, name, {adjPermanentArtifact:true});
	Adj.elementSetAttributeInAdjNS(artifactElement, "artifact", "true", parent);
	return artifactElement;
};
// utility
Adj.cloneArtifactElement = function cloneArtifactElement (element, deep) {
	deep = deep != undefined ? deep : true; // default deep = true
	var clone = element.cloneNode(deep);
	Adj.elementSetAttributeInAdjNS(clone, "artifact", "true", element);
	return clone;
};

// utility
Adj.createExplanationElement = function createExplanationElement (expectedAncestor, name, dontDisplayNone) {
	var explanationElement = Adj.createSVGElement(expectedAncestor.ownerDocument, name, {adjExplanationArtifact:true});
	// expectedAncestor is used as elementSetAttributeInAdjNS argument elementToLookupPrefix
	Adj.elementSetAttributeInAdjNS(explanationElement, "explanation", "true", expectedAncestor);
	if (!dontDisplayNone) {
		Adj.hideByDisplayAttribute(explanationElement);
	}
	explanationElement.style["pointer-events"] = "none";
	return explanationElement;
};

// utility
Adj.createExplanationPointCircle = function createExplanationPointCircle (expectedAncestor, x, y, fill) {
	var explanationElement = Adj.createExplanationElement(expectedAncestor, "circle");
	explanationElement.setAttribute("cx", Adj.decimal(x));
	explanationElement.setAttribute("cy", Adj.decimal(y));
	explanationElement.setAttribute("r", 3);
	explanationElement.setAttribute("fill", fill);
	explanationElement.setAttribute("fill-opacity", "0.2");
	explanationElement.setAttribute("stroke", "none");
	return explanationElement;
};

// utility
Adj.createExplanationLine = function createExplanationLine (expectedAncestor, x1, y1, x2, y2, stroke) {
	var explanationElement = Adj.createExplanationElement(expectedAncestor, "line");
	explanationElement.setAttribute("x1", Adj.decimal(x1));
	explanationElement.setAttribute("y1", Adj.decimal(y1));
	explanationElement.setAttribute("x2", Adj.decimal(x2));
	explanationElement.setAttribute("y2", Adj.decimal(y2));
	explanationElement.setAttribute("stroke", stroke);
	explanationElement.setAttribute("stroke-width", "1");
	explanationElement.setAttribute("stroke-opacity", "0.2");
	return explanationElement;
};

// lower case element.tagName instead of mixed case element.tagName has been
// observed when parsing Adj in SVG inline in HTML,
// hence we are tolerating lower case, implemented by converting to intended mixed case,
// furthermore one has to expect lower case to be written back to disk by authors
// to "pollute" bodies of documents, both HTML and potentially also SVG
//
// throughout Adj source code, a comment may or may not be used for clarity:
// lowercase-names-workaround
Adj.mixedCasedNames = {}; // by lower case name, only if mixed case, for now
Adj.registerMixedCasedName = function registerMixedCasedName(nameToRegister) {
	var nameToRegisterLowerCase = nameToRegister.toLowerCase();
	if (nameToRegisterLowerCase !== nameToRegister) {
		Adj.mixedCasedNames[nameToRegisterLowerCase] = nameToRegister;
	}
};
//
Adj.mixedCasedName = function mixedCasedName (uncertainlyCasedName) {
	// looked up or as is
	return Adj.mixedCasedNames[uncertainlyCasedName] || uncertainlyCasedName;
};

// essential wrapper
Adj.defineCommandForAlgorithm = function defineCommandForAlgorithm (algorithm) {
	var algorithmName = algorithm.algorithmName;
	Adj.algorithms[algorithmName] = algorithm;
	//
	Adj.registerMixedCasedName(algorithmName);
	var parameterNames = algorithm.parameters;
	for (var i in parameterNames) {
		Adj.registerMixedCasedName(parameterNames[i]);
	}
};

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "horizontalList",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["gap",
				 "horizontalGap", "leftGap", "centerGap", "rightGap",
				 "verticalGap", "topGap", "middleGap", "bottomGap",
				 "maxWidth", "maxPerRow", "itemsH2V",
				 "makeGrid",
				 "hAlign", "vAlign",
				 "explain"],
	methods: [function horizontalList (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a horizontalList command";
		var variableSubstitutionsByName = {};
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 3, null, usedHow, variableSubstitutionsByName); // default gap = 3
		var horizontalGap = Adj.doVarsArithmetic(element, parametersObject.horizontalGap, gap, null, usedHow, variableSubstitutionsByName); // default horizontalGap = gap
		var leftGap = Adj.doVarsArithmetic(element, parametersObject.leftGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default leftGap = horizontalGap
		var centerGap = Adj.doVarsArithmetic(element, parametersObject.centerGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default centerGap = horizontalGap
		var rightGap = Adj.doVarsArithmetic(element, parametersObject.rightGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default rightGap = horizontalGap
		var verticalGap = Adj.doVarsArithmetic(element, parametersObject.verticalGap, gap, null, usedHow, variableSubstitutionsByName); // default verticalGap = gap
		var topGap = Adj.doVarsArithmetic(element, parametersObject.topGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default topGap = verticalGap
		var middleGap = Adj.doVarsArithmetic(element, parametersObject.middleGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default middleGap = verticalGap
		var bottomGap = Adj.doVarsArithmetic(element, parametersObject.bottomGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default bottomGap = verticalGap
		var maxWidth = Adj.doVarsArithmetic(element, parametersObject.maxWidth, null, null, usedHow, variableSubstitutionsByName); // allowed, default maxWidth = null means no limit
		var maxPerRow = Adj.doVarsArithmetic(element, parametersObject.maxPerRow, null, null, usedHow, variableSubstitutionsByName); // allowed, default maxPerRow = null means no limit
		var itemsH2V = Adj.doVarsArithmetic(element, parametersObject.itemsH2V, null, null, usedHow, variableSubstitutionsByName); // allowed, default itemsH2V = null means not used
		var makeGrid = Adj.doVarsBoolean(element, parametersObject.makeGrid, false, usedHow, variableSubstitutionsByName); // default makeGrid = false
		var hAlign = Adj.doVarsArithmetic(element, parametersObject.hAlign, 0, Adj.leftCenterRight, usedHow, variableSubstitutionsByName); // hAlign could be a number, default hAlign 0 == left
		var vAlign = Adj.doVarsArithmetic(element, parametersObject.vAlign, 0, Adj.topMiddleBottom, usedHow, variableSubstitutionsByName); // vAlign could be a number, default vAlign 0 == top
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping hiddenRect and skipping notAnOrder1Element
		var hiddenRect;
		var childRecords = [];
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			if (child.adjHiddenByCommand) {
				continue;
			}
			childRecords.push({
				boundingBox: child.getBBox(),
				node: child
			});
		}
		if (itemsH2V) {
			var maxPerRowByItemsH2V = Math.ceil(Math.sqrt(childRecords.length * itemsH2V));
			if (!maxPerRow || maxPerRowByItemsH2V < maxPerRow) {
				maxPerRow = maxPerRowByItemsH2V;
			}
		}
		if (!maxPerRow) { // don't allow it to remain null below here
			maxPerRow = childRecords.length; // make sure it is a number
		}
		//
		// process
		var maxRight;
		var maxBottom;
		var columnWidths = [];
		var rowHeights = [];
		var tryToFit = true;
		tryToFitLoop: while (tryToFit) {
			var currentChildX = leftGap;
			var currentChildY = topGap;
			maxRight = currentChildX;
			maxBottom = currentChildY;
			var currentColumn = 0;
			var currentRow = 0;
			var anyMadeWider = false;
			var anyMadeTaller = false;
			childRecordsLoop: for (var childRecordIndex in childRecords) {
				var childRecord = childRecords[childRecordIndex];
				var childBoundingBox = childRecord.boundingBox;
				var child = childRecord.node;
				// figure width
				var widthToUse;
				var currentChildWidth = childBoundingBox.width;
				if (!makeGrid) { // make it whatever wide it is
					widthToUse = currentChildWidth;
				} else { // makeGrid
					var columnWidth = columnWidths[currentColumn];
					if (columnWidth === undefined) { // first row
						widthToUse = currentChildWidth;
						columnWidths[currentColumn] = widthToUse;
					} else { // further row
						if (currentChildWidth <= columnWidth) { // fits
							widthToUse = columnWidth;
						} else { // column must be wider
							widthToUse = currentChildWidth;
							columnWidths[currentColumn] = widthToUse;
							anyMadeWider = true;
						}
					}
				}
				// figure whether it sticks out too far
				if (maxWidth && currentColumn > 0 && currentChildX + widthToUse + centerGap > maxWidth) { // needs new row for current element
					if (makeGrid && maxPerRow > 1) { // try one column less, unless only one column left
						// try again with one column less
						maxPerRow -= 1;
						columnWidths = [];
						rowHeights = [];
						continue tryToFitLoop;
					}
					currentChildX = leftGap;
					currentChildY = maxBottom + middleGap;
					currentColumn = 0;
					currentRow += 1;
				}
				// figure height
				var heightToUse;
				var currentChildHeight = childBoundingBox.height;
				var rowHeight = rowHeights[currentRow];
				if (rowHeight === undefined) { // first element in row
					heightToUse = currentChildHeight;
					rowHeights[currentRow] = heightToUse;
				} else { // further element in row
					if (currentChildHeight <= rowHeight) { // fits
						heightToUse = rowHeight;
					} else { // row must be taller
						heightToUse = currentChildHeight;
						rowHeights[currentRow] = heightToUse;
						anyMadeTaller = true;
					}
				}
				// now we know where to put it
				var translationX = currentChildX - childBoundingBox.x + Adj.fraction(0, widthToUse - currentChildWidth, hAlign);
				var translationY = currentChildY - childBoundingBox.y + Adj.fraction(0, heightToUse - currentChildHeight, vAlign);
				child.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
				// explain
				if (explain) {
					childRecord.explainRect = {
						x: currentChildX,
						y: currentChildY,
						width: widthToUse,
						height: heightToUse
					};
				}
				// consequences
				var currentChildRight = currentChildX + widthToUse;
				if (currentChildRight > maxRight) {
					maxRight = currentChildRight;
				}
				var currentChildBottom = currentChildY + heightToUse;
				if (currentChildBottom > maxBottom) {
					maxBottom = currentChildBottom;
				}
				// get ready for next position
				currentChildX = currentChildRight + centerGap;
				currentColumn += 1;
				if (currentColumn >= maxPerRow) { // needs new row for next element
					currentChildX = leftGap;
					currentChildY = maxBottom + middleGap;
					currentColumn = 0;
					currentRow += 1;
				}
			}
			if (anyMadeWider // fyi anyMadeWider only should occur if makeGrid
				|| (anyMadeTaller && vAlign !== 0)) { // anyMadeTaller only should matter if vAlign !== 0
				// try again with known columnWidths and rowHeights
				continue tryToFitLoop;
			}
			tryToFit = false;
		}
		//
		// size the hidden rect for having a good bounding box when from a level up this element's getBBox() gets called
		if (hiddenRect) {
			hiddenRect.setAttribute("x", 0);
			hiddenRect.setAttribute("y", 0);
			hiddenRect.setAttribute("width", Adj.decimal(maxRight + rightGap));
			hiddenRect.setAttribute("height", Adj.decimal(maxBottom + bottomGap));
		}
		//
		// explain
		if (explain) {
			if (hiddenRect) {
				var explanationElement = Adj.createExplanationElement(element, "rect");
				explanationElement.setAttribute("x", 0);
				explanationElement.setAttribute("y", 0);
				explanationElement.setAttribute("width", Adj.decimal(maxRight + rightGap));
				explanationElement.setAttribute("height", Adj.decimal(maxBottom + bottomGap));
				explanationElement.setAttribute("fill", "white");
				explanationElement.setAttribute("fill-opacity", "0.1");
				explanationElement.setAttribute("stroke", "blue");
				explanationElement.setAttribute("stroke-width", "1");
				explanationElement.setAttribute("stroke-opacity", "0.2");
				element.appendChild(explanationElement);
			}
			for (var childRecordIndex in childRecords) {
				var childRecord = childRecords[childRecordIndex];
				var explainRect = childRecord.explainRect;
				if (explainRect) {
					var explanationElement = Adj.createExplanationElement(element, "rect");
					explanationElement.setAttribute("x", Adj.decimal(explainRect.x));
					explanationElement.setAttribute("y", Adj.decimal(explainRect.y));
					explanationElement.setAttribute("width", Adj.decimal(explainRect.width));
					explanationElement.setAttribute("height", Adj.decimal(explainRect.height));
					explanationElement.setAttribute("fill", "blue");
					explanationElement.setAttribute("fill-opacity", "0.1");
					explanationElement.setAttribute("stroke", "blue");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.1");
					element.appendChild(explanationElement);
				}
			}
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "verticalList",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["gap",
				 "horizontalGap", "leftGap", "centerGap", "rightGap",
				 "verticalGap", "topGap", "middleGap", "bottomGap",
				 "maxHeight", "maxPerColumn", "itemsH2V",
				 "makeGrid",
				 "hAlign", "vAlign",
				 "explain"],
	methods: [function verticalList (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a verticalList command";
		var variableSubstitutionsByName = {};
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 3, null, usedHow, variableSubstitutionsByName); // default gap = 3
		var horizontalGap = Adj.doVarsArithmetic(element, parametersObject.horizontalGap, gap, null, usedHow, variableSubstitutionsByName); // default horizontalGap = gap
		var leftGap = Adj.doVarsArithmetic(element, parametersObject.leftGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default leftGap = horizontalGap
		var centerGap = Adj.doVarsArithmetic(element, parametersObject.centerGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default centerGap = horizontalGap
		var rightGap = Adj.doVarsArithmetic(element, parametersObject.rightGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default rightGap = horizontalGap
		var verticalGap = Adj.doVarsArithmetic(element, parametersObject.verticalGap, gap, null, usedHow, variableSubstitutionsByName); // default verticalGap = gap
		var topGap = Adj.doVarsArithmetic(element, parametersObject.topGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default topGap = verticalGap
		var middleGap = Adj.doVarsArithmetic(element, parametersObject.middleGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default middleGap = verticalGap
		var bottomGap = Adj.doVarsArithmetic(element, parametersObject.bottomGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default bottomGap = verticalGap
		var maxHeight = Adj.doVarsArithmetic(element, parametersObject.maxHeight, null, null, usedHow, variableSubstitutionsByName); // allowed, default maxHeight = null means no limit
		var maxPerColumn = Adj.doVarsArithmetic(element, parametersObject.maxPerColumn, null, null, usedHow, variableSubstitutionsByName); // allowed, default maxPerColumn = null means no limit
		var itemsH2V = Adj.doVarsArithmetic(element, parametersObject.itemsH2V, null, null, usedHow, variableSubstitutionsByName); // allowed, default itemsH2V = null means not used
		var makeGrid = Adj.doVarsBoolean(element, parametersObject.makeGrid, false, usedHow, variableSubstitutionsByName); // default makeGrid = false
		var hAlign = Adj.doVarsArithmetic(element, parametersObject.hAlign, 0, Adj.leftCenterRight, usedHow, variableSubstitutionsByName); // hAlign could be a number, default hAlign 0 == left
		var vAlign = Adj.doVarsArithmetic(element, parametersObject.vAlign, 0, Adj.topMiddleBottom, usedHow, variableSubstitutionsByName); // vAlign could be a number, default vAlign 0 == top
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping hiddenRect and skipping notAnOrder1Element
		var hiddenRect;
		var childRecords = [];
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			if (child.adjHiddenByCommand) {
				continue;
			}
			childRecords.push({
				boundingBox: child.getBBox(),
				node: child
			});
		}
		if (itemsH2V) {
			var maxPerColumnByItemsH2V = Math.ceil(Math.sqrt(childRecords.length / itemsH2V));
			if (!maxPerColumn || maxPerColumnByItemsH2V < maxPerColumn) {
				maxPerColumn = maxPerColumnByItemsH2V;
			}
		}
		if (!maxPerColumn) { // don't allow it to remain null below here
			maxPerColumn = childRecords.length; // make sure it is a number
		}
		//
		// process
		var maxRight;
		var maxBottom;
		var columnWidths = [];
		var rowHeights = [];
		var tryToFit = true;
		tryToFitLoop: while (tryToFit) {
			var currentChildX = leftGap;
			var currentChildY = topGap;
			maxRight = currentChildX;
			maxBottom = currentChildY;
			var currentColumn = 0;
			var currentRow = 0;
			var anyMadeWider = false;
			var anyMadeTaller = false;
			childRecordsLoop: for (var childRecordIndex in childRecords) {
				var childRecord = childRecords[childRecordIndex];
				var childBoundingBox = childRecord.boundingBox;
				var child = childRecord.node;
				// figure height
				var heightToUse;
				var currentChildHeight = childBoundingBox.height;
				if (!makeGrid) { // make it whatever wide it is
					heightToUse = currentChildHeight;
				} else { // makeGrid
					var rowHeight = rowHeights[currentRow];
					if (rowHeight === undefined) { // first column
						heightToUse = currentChildHeight;
						rowHeights[currentRow] = heightToUse;
					} else { // further column
						if (currentChildHeight <= rowHeight) { // fits
							heightToUse = rowHeight;
						} else { // row must be taller
							heightToUse = currentChildHeight;
							rowHeights[currentRow] = heightToUse;
							anyMadeTaller = true;
						}
					}
				}
				// figure whether it sticks out too far
				if (maxHeight && currentRow > 0 && currentChildY + heightToUse + middleGap > maxHeight) { // needs new column for current element
					if (makeGrid && maxPerColumn > 1) { // try one row less, unless only one row left
						// try again with one row less
						maxPerColumn -= 1;
						columnWidths = [];
						rowHeights = [];
						continue tryToFitLoop;
					}
					currentChildX = maxRight + centerGap;
					currentChildY = topGap;
					currentColumn += 1;
					currentRow = 0;
				}
				// figure width
				var widthToUse;
				var currentChildWidth = childBoundingBox.width;
				var columnWidth = columnWidths[currentColumn];
				if (columnWidth === undefined) { // first element in column
					widthToUse = currentChildWidth;
					columnWidths[currentColumn] = widthToUse;
				} else { // further element in column
					if (currentChildWidth <= columnWidth) { // fits
						widthToUse = columnWidth;
					} else { // column must be wider
						widthToUse = currentChildWidth;
						columnWidths[currentColumn] = widthToUse;
						anyMadeWider = true;
					}
				}
				// now we know where to put it
				var translationX = currentChildX - childBoundingBox.x + Adj.fraction(0, widthToUse - currentChildWidth, hAlign);
				var translationY = currentChildY - childBoundingBox.y + Adj.fraction(0, heightToUse - currentChildHeight, vAlign);
				child.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
				// explain
				if (explain) {
					childRecord.explainRect = {
						x: currentChildX,
						y: currentChildY,
						width: widthToUse,
						height: heightToUse
					};
				}
				// consequences
				var currentChildRight = currentChildX + widthToUse;
				if (currentChildRight > maxRight) {
					maxRight = currentChildRight;
				}
				var currentChildBottom = currentChildY + heightToUse;
				if (currentChildBottom > maxBottom) {
					maxBottom = currentChildBottom;
				}
				// get ready for next position
				currentChildY = currentChildBottom + middleGap;
				currentRow += 1;
				if (currentRow >= maxPerColumn) { // needs new column for next element
					currentChildX = maxRight + centerGap;
					currentChildY = topGap;
					currentColumn += 1;
					currentRow = 0;
				}
			}
			if (anyMadeTaller // fyi anyMadeTaller only should occur if makeGrid
				|| (anyMadeWider && hAlign !== 0)) { // anyMadeWider only should matter if hAlign !== 0
				// try again with known columnWidths and rowHeights
				continue tryToFitLoop;
			}
			tryToFit = false;
		}
		//
		// size the hidden rect for having a good bounding box when from a level up this element's getBBox() gets called
		if (hiddenRect) {
			hiddenRect.setAttribute("x", 0);
			hiddenRect.setAttribute("y", 0);
			hiddenRect.setAttribute("width", Adj.decimal(maxRight + rightGap));
			hiddenRect.setAttribute("height", Adj.decimal(maxBottom + bottomGap));
		}
		//
		// explain
		if (explain) {
			if (hiddenRect) {
				var explanationElement = Adj.createExplanationElement(element, "rect");
				explanationElement.setAttribute("x", 0);
				explanationElement.setAttribute("y", 0);
				explanationElement.setAttribute("width", Adj.decimal(maxRight + rightGap));
				explanationElement.setAttribute("height", Adj.decimal(maxBottom + bottomGap));
				explanationElement.setAttribute("fill", "white");
				explanationElement.setAttribute("fill-opacity", "0.1");
				explanationElement.setAttribute("stroke", "blue");
				explanationElement.setAttribute("stroke-width", "1");
				explanationElement.setAttribute("stroke-opacity", "0.2");
				element.appendChild(explanationElement);
			}
			for (var childRecordIndex in childRecords) {
				var childRecord = childRecords[childRecordIndex];
				var explainRect = childRecord.explainRect;
				if (explainRect) {
					var explanationElement = Adj.createExplanationElement(element, "rect");
					explanationElement.setAttribute("x", Adj.decimal(explainRect.x));
					explanationElement.setAttribute("y", Adj.decimal(explainRect.y));
					explanationElement.setAttribute("width", Adj.decimal(explainRect.width));
					explanationElement.setAttribute("height", Adj.decimal(explainRect.height));
					explanationElement.setAttribute("fill", "blue");
					explanationElement.setAttribute("fill-opacity", "0.1");
					explanationElement.setAttribute("stroke", "blue");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.1");
					element.appendChild(explanationElement);
				}
			}
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "frameForParent",
	notAnOrder1Element: true,
	phaseHandlerNames: ["adjPhase5Down"],
	parameters: ["inset",
				 "horizontalInset", "leftInset", "rightInset",
				 "verticalInset", "topInset", "bottomInset"],
	methods: [function frameForParent (element, parametersObject) {
		var usedHow = "used in a parameter for a frameForParent command";
		var variableSubstitutionsByName = {};
		var inset = Adj.doVarsArithmetic(element, parametersObject.inset, 0.5, null, usedHow, variableSubstitutionsByName); // default inset = 0.5
		var horizontalInset = Adj.doVarsArithmetic(element, parametersObject.horizontalInset, inset, null, usedHow, variableSubstitutionsByName); // default horizontalInset = inset
		var leftInset = Adj.doVarsArithmetic(element, parametersObject.leftInset, horizontalInset, null, usedHow, variableSubstitutionsByName); // default leftInset = horizontalInset
		var rightInset = Adj.doVarsArithmetic(element, parametersObject.rightInset, horizontalInset, null, usedHow, variableSubstitutionsByName); // default rightInset = horizontalInset
		var verticalInset = Adj.doVarsArithmetic(element, parametersObject.verticalInset, inset, null, usedHow, variableSubstitutionsByName); // default verticalInset = inset
		var topInset = Adj.doVarsArithmetic(element, parametersObject.topInset, verticalInset, null, usedHow, variableSubstitutionsByName); // default topInset = verticalInset
		var bottomInset = Adj.doVarsArithmetic(element, parametersObject.bottomInset, verticalInset, null, usedHow, variableSubstitutionsByName); // default bottomInset = verticalInset
		//
		var parent = element.parentNode;
		var parentBoundingBox = parent.getBBox();
		element.setAttribute("x", Adj.decimal(parentBoundingBox.x + leftInset));
		element.setAttribute("y", Adj.decimal(parentBoundingBox.y + topInset));
		element.setAttribute("width", Adj.decimal(parentBoundingBox.width - leftInset - rightInset));
		element.setAttribute("height", Adj.decimal(parentBoundingBox.height - topInset - bottomInset));
	}]
});

// constants
// parse word breaks, intentionally treat as one any number of spaces and line breaks
Adj.wordBreakRegexp = /(?:\s)+/;
// parse line breaks, intentionally treat separately each line break
Adj.lineBreakRegexp = /(?:\r?\n)/;

// utility
// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "textBreaks",
	phaseHandlerNames: ["adjPhase1Down"],
	parameters: ["wordBreaks",
				 "lineBreaks"],
	methods: [function textBreaks (element, parametersObject) {
		var wordBreaks = parametersObject.wordBreaks != undefined ? parametersObject.wordBreaks : false; // default wordBreaks = false
		var lineBreaks = parametersObject.lineBreaks != undefined ? parametersObject.lineBreaks : true; // default lineBreaks = true
		//
		// breaks, if any
		if (wordBreaks || lineBreaks) {
			for (var child = element.firstChild; child; child = child.nextSibling) {
				var isSVGTextElement = child instanceof SVGTextElement;
				if (!isSVGTextElement) {
					continue; // skip if not SVG text element
				}
				var text = child.textContent;
				var broken;
				if (wordBreaks) {
					broken = text.split(Adj.wordBreakRegexp);
				} else { // lineBreaks
					broken = text.split(Adj.lineBreakRegexp);
				}
				if (broken.length) {
					while (broken.length > 1) { // needs new elements
						var newSibling = child.cloneNode(false);
						newSibling.textContent = broken.shift();
						element.insertBefore(newSibling, child);
					}
					child.textContent = broken[0];
				}
			}
		}
	}]
});

// utility
Adj.buildIdsDictionary = function buildIdsDictionary (element, idsDictionary, level) {
	if (idsDictionary === undefined) { idsDictionary = {}; } // ensure there is an idsDictionary
	level = level || 1; // if no level given then 1
	// chose to implement to recognize more than one kind of id
	var ids = {};
	var adjId = Adj.elementGetAttributeInAdjNS(element, "id"); // first check for preferred attribute adj:id
	if (adjId) {
		ids[adjId] = true;
	}
	var plainId = element.getAttribute("id"); // second check for acceptable attribute id
	if (plainId) {
		ids[plainId] = true;
	}
	for (var id in ids) { // could be more than one
		var elementsWithThisId = idsDictionary[id] || [];
		elementsWithThisId.push(element); // could be more than one
		idsDictionary[id] = elementsWithThisId;
	}
	element.adjLevel = level;
	// then walk
	for (var child = element.firstChild; child; child = child.nextSibling) {
		if (!(child instanceof SVGElement)) {
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		if (!child.getBBox) {
			continue; // skip if not an SVGLocatable, e.g. a <script> element
		}
		Adj.buildIdsDictionary(child, idsDictionary, level + 1); // recursion
	}
	return idsDictionary;
};

// utility
// this specific function builds on invocation even if a dictionary exists already,
// could be useful to call more than once if new ids have been created by code running or
// if document structure has changed in a way that would affect outcomes,
// could be expensive for a huge document, hence while itself O(n) nevertheless to avoid O(n^2) call sparingly
Adj.buildIdsDictionaryForTheSvgElement = function buildIdsDictionaryForTheSvgElement (theSvgElement) {
	return theSvgElement.adjIdsDictionary = Adj.buildIdsDictionary(theSvgElement);
};

// utility
Adj.elementLevel = function elementLevel (element) {
	var level = element.adjLevel;
	if (!level) {
		level = 1;
		var parent = element.parentNode;
		while (parent instanceof SVGElement) {
			var parentLevel = parent.adjLevel;
			if (parentLevel) {
				level += parentLevel;
				break;
			}
			level++;
			parent = parent.parentNode;
		}
		element.adjLevel = level;
	}
	return level;
};

// utility
Adj.getElementByIdNearby = function getElementByIdNearby (id, startingElement) {
	// note: any change in implementation still should keep intact deterministic behavior
	var theSvgElement = startingElement.ownerSVGElement || startingElement;
	//
	var adjIdsDictionary = theSvgElement.adjIdsDictionary || Adj.buildIdsDictionaryForTheSvgElement(theSvgElement); // ensure there is an adjIdsDictionary
	var elementsWithThisId = adjIdsDictionary[id];
	if (!elementsWithThisId) {
		return null;
	}
	var numberOfElementsWithThisId = elementsWithThisId.length;
	if (!numberOfElementsWithThisId) {
		return null;
	}
	if (numberOfElementsWithThisId === 1) { // if only one then that is the one
		return elementsWithThisId[0];
	}
	// getting here means at least two to pick from
	var descendants = [];
	var otherRelations = [];
	var startingElementLevel = Adj.elementLevel(startingElement);
	elementsWithThisIdLoop: for (var i = 0; i < numberOfElementsWithThisId; i++) {
		var elementWithThisId = elementsWithThisId[i];
		if (elementWithThisId === startingElement) { // self is nearest possible
			return elementWithThisId;
		}
		var elementWithThisIdLevel = Adj.elementLevel(elementWithThisId);
		var element2Ancestor = elementWithThisId;
		var ancestorLevel = elementWithThisIdLevel;
		while (ancestorLevel > startingElementLevel) {
			// go up until startingElementLevel
			element2Ancestor = element2Ancestor.parentNode;
			ancestorLevel--;
			if (element2Ancestor === startingElement) { // elementWithThisId is a descendant of startingElement
				descendants.push( { element:elementWithThisId, level:elementWithThisIdLevel } );
				continue elementsWithThisIdLoop;
			}
		}
		if (descendants.length) {
			// chose to implement to prefer a descendant, if any then no need to check other relations
			continue elementsWithThisIdLoop;
		}
		var element1Ancestor = startingElement;
		while (element1Ancestor != element2Ancestor) {
			// go up until reaching common ancestor
			element1Ancestor = element1Ancestor.parentNode;
			element2Ancestor = element2Ancestor.parentNode;
			ancestorLevel--;
			if (!element1Ancestor || !element2Ancestor) { // for stability, a defensive check rather than risk an exception
				continue elementsWithThisIdLoop;
			}
		}
		otherRelations.push( { element:elementWithThisId, level:elementWithThisIdLevel, commonAncestorLevel: ancestorLevel } );
	}
	var numberOfDescendants = descendants.length;
	if (numberOfDescendants) {
		// chose to implement to prefer a descendant, if any then no need to check other relations
		var descendantToReturn = descendants[0];
		var descendantToReturnLevel = descendantToReturn.level;
		for (var i = 1; i < numberOfDescendants; i++) {
			var descendant = descendants[i];
			if (descendant.level < descendantToReturnLevel) { // closer to startingElement
				descendantToReturn = descendant;
				descendantToReturnLevel = descendantToReturn.level;
			}
		}
		return descendantToReturn.element;
	}
	var numberOfOtherRelations = otherRelations.length;
	if (numberOfOtherRelations) {
		var otherToReturn = otherRelations[0];
		var othersToReturn = [ otherToReturn ];
		var otherToReturnCommonAncestorLevel = otherToReturn.commonAncestorLevel;
		for (var i = 1; i < numberOfOtherRelations; i++) {
			var otherRelation = otherRelations[i];
			var otherRelationCommonAncestorLevel = otherRelation.commonAncestorLevel;
			if (otherRelationCommonAncestorLevel > otherToReturnCommonAncestorLevel) { // closer to startingElement
				othersToReturn = [ otherRelation ];
				otherToReturnCommonAncestorLevel = otherRelationCommonAncestorLevel;
			} else if (otherRelationCommonAncestorLevel === otherToReturnCommonAncestorLevel) { // same distance to startingElement
				othersToReturn.push(otherRelation);
			}
		}
		//
		var numberOfOthersToReturn = othersToReturn.length;
		var otherToReturn = othersToReturn[0];
		var otherToReturnLevel = otherToReturn.level;
		for (var i = 1; i < numberOfOthersToReturn; i++) {
			var otherRelation = othersToReturn[i];
			if (otherRelation.level < otherToReturnLevel) { // closer to startingElement
				otherToReturn = otherRelation;
				otherToReturnLevel = otherToReturn.level;
			}
		}
		return otherToReturn.element;
	}
	return null; // failed to find any
};

// constants
// parse an id and optionally two more parameters, e.g. full "obj1 % 0.5, 1" or less specific "obj2"
// note: as implemented tolerates extra parameters
Adj.idXYRegexp = /^\s*([^%\s]+)\s*(?:%\s*([^,\s]+)\s*)?(?:,\s*([^,\s]+)\s*)?(?:,.*)?$/;
// parse an optional id and optionally two more parameters, e.g. full "obj1 % 0.5, 1" or less specific "obj1" or "0.5, 1" or "% 0.5, 1" or "obj1 %"
// note: as implemented does not tolerate extra parameters
Adj.idXYRegexp2 = /^\s*([^%,\s]*?)\s*%?\s*(?:([^%,\s]+)\s*,\s*([^%,\s]+))?\s*$/;
Adj.idXYRegexp2NoMatch = [ null, null, null, null ];
// parse one or two parameters, e.g. "0.5, 1" or only "0.3"
// note: as implemented tolerates extra parameters
Adj.oneOrTwoRegexp = /^\s*([^,\s]+)\s*(?:,\s*([^,\s]+)\s*)?(?:,.*)?$/;
// parse two parameters, e.g. "0.5, 1"
// note: as implemented tolerates extra parameters
Adj.twoRegexp = /^\s*([^,\s]+)\s*,\s*([^,\s]+)\s*(?:,.*)?$/;
Adj.twoRegexpNoMatch = [ null, null, null ];
// parse three parameters, e.g. "3, -4, 4"
// note: as implemented tolerates extra parameters
Adj.threeRegexp = /^\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)\s*(?:,.*)?$/;

// note: theSvgElement.createSVGPoint() used because createSVGPoint() only implemented in SVG element,
// same for createSVGRect(), createSVGMatrix()

// utility
Adj.endPoints = function endPoints (element) {
	var theSvgElement = element.ownerSVGElement || element;
	//
	if (element instanceof SVGLineElement) {
		// get static base values as floating point values, before animation
		var fromPoint = theSvgElement.createSVGPoint();
		fromPoint.x = element.x1.baseVal.value;
		fromPoint.y = element.y1.baseVal.value;
		var toPoint = theSvgElement.createSVGPoint();
		toPoint.x = element.x2.baseVal.value;
		toPoint.y = element.y2.baseVal.value;
		return {fromPoint:fromPoint, toPoint:toPoint};
	} else if (element instanceof SVGPathElement) {
		// presumably static base values as floating point values, before animation
		var totalLength = element.getTotalLength();
		var fromPoint = element.getPointAtLength(0.0);
		var toPoint = element.getPointAtLength(totalLength);
		return {fromPoint:fromPoint, toPoint:toPoint};
	} else {
		// other types of elements not implemented at this time
		return null;
	}
};

// utility
Adj.displacementAndAngle = function displacementAndAngle (fromPoint, toPoint) {
	var deltaX = toPoint.x - fromPoint.x;
	var deltaY = toPoint.y - fromPoint.y;
	var displacement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	var angle = Math.atan2(deltaY, deltaX) / Math.PI * 180;
	return {displacement:displacement, angle:angle};
};

// utility
Adj.transformLine = function transformLine (lineElement, matrix) {
	var theSvgElement = lineElement.ownerSVGElement || lineElement;
	//
	// get static base values as floating point values, before animation
	var point1 = theSvgElement.createSVGPoint();
	point1.x = lineElement.x1.baseVal.value;
	point1.y = lineElement.y1.baseVal.value;
	point1 = point1.matrixTransform(matrix);
	var point2 = theSvgElement.createSVGPoint();
	point2.x = lineElement.x2.baseVal.value;
	point2.y = lineElement.y2.baseVal.value;
	point2 = point2.matrixTransform(matrix);
	lineElement.setAttribute("x1", Adj.decimal(point1.x));
	lineElement.setAttribute("y1", Adj.decimal(point1.y));
	lineElement.setAttribute("x2", Adj.decimal(point2.x));
	lineElement.setAttribute("y2", Adj.decimal(point2.y));
};

// utility class
// for Adj.transformPathSegList
Adj.PathSegList = function PathSegList (pathSegArray) {
	this.pathSegArray = pathSegArray;
	this.numberOfItems = pathSegArray.length;
};
Adj.PathSegList.prototype.getItem = function getItem (index) {
	return this.pathSegArray[index];
};

// utility class
// for Adj.transformPathSegList, to avoid needing createSVGPoint()
Adj.Point = function Point (x, y) {
	this.x = x;
	this.y = y;
};
Adj.Point.prototype.matrixTransform = function matrixTransform (matrix) {
	return {
		x: matrix.a * this.x + matrix.c * this.y + matrix.e,
		y: matrix.b * this.x + matrix.d * this.y + matrix.f };
};

// utility
Adj.isIdentityMatrix = function isIdentityMatrix (matrix) {
	return matrix.a === 1 && matrix.b === 0 && matrix.c === 0
		&& matrix.d === 1 && matrix.e === 0 && matrix.f === 0;
};

Adj.setAttributeTransformMatrix = function setAttributeTransformMatrix (element, matrix, evenIfIdentity) {
	if (evenIfIdentity || !Adj.isIdentityMatrix(matrix)) {
		element.setAttribute("transform",
			"matrix(" + Adj.decimal(matrix.a) + "," + Adj.decimal(matrix.b) + "," + Adj.decimal(matrix.c) + ","
			+ Adj.decimal(matrix.d) + "," + Adj.decimal(matrix.e) + "," + Adj.decimal(matrix.f) + ")");
	} else {
		element.removeAttribute("transform");
	}
};

// utility
// returns an array
// note: as implemented if path contains an elliptical arc curve segment then it is replaced by a line
Adj.transformPathSegList = function transformPathSegList (pathSegList, matrix) {
	var numberOfPathSegs = pathSegList.numberOfItems;
	// relative coordinates must be transformed without translation's e and f
	var absoluteMatrix = matrix;
	// identity transform into a new copy, to avoid needing createSVGMatrix()
	var relativeMatrix = absoluteMatrix.scale(1);
	// keep a, b, c, d
	relativeMatrix.e = 0;
	relativeMatrix.f = 0;
	// loop
	var previousOriginalCoordinates = new Adj.Point(); // hold in case needed for absolute horizontal or vertical lineto
	var transformedPathSegArray = [];
	for (var index = 0; index < numberOfPathSegs; index++) {
		var pathSeg = pathSegList.getItem(index);
		var pathSegTypeAsLetter = pathSeg.pathSegTypeAsLetter;
		var coordinates;
		var coordinates1;
		var coordinates2;
		switch (pathSegTypeAsLetter) {
			case 'Z':  // closepath
			case 'z':
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter });
				break;
			case 'M': // moveto
			case 'L': // lineto
			case 'T': // smooth quadratic curveto
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'm': // moveto
			case 'l': // lineto
			case 't': // smooth quadratic curveto
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				if (index !== 0) {
					coordinates = coordinates.matrixTransform(relativeMatrix);
				} else {
					// first command in path data must be moveto and is absolute even if lowercase m would indicate relative
					coordinates = coordinates.matrixTransform(absoluteMatrix);
				}
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'Q': // quadratic Bézier curveto
				coordinates1 = new Adj.Point(pathSeg.x1, pathSeg.y1);
				coordinates1 = coordinates1.matrixTransform(absoluteMatrix);
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x1: coordinates1.x,
				   y1: coordinates1.y,
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'q': // quadratic Bézier curveto
				coordinates1 = new Adj.Point(pathSeg.x1, pathSeg.y1);
				coordinates1 = coordinates1.matrixTransform(relativeMatrix);
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(relativeMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x1: coordinates1.x,
				   y1: coordinates1.y,
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'C': // cubic Bézier curveto
				coordinates1 = new Adj.Point(pathSeg.x1, pathSeg.y1);
				coordinates1 = coordinates1.matrixTransform(absoluteMatrix);
				coordinates2 = new Adj.Point(pathSeg.x2, pathSeg.y2);
				coordinates2 = coordinates2.matrixTransform(absoluteMatrix);
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x1: coordinates1.x,
				   y1: coordinates1.y,
				   x2: coordinates2.x,
				   y2: coordinates2.y,
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'c': // cubic Bézier curveto
				coordinates1 = new Adj.Point(pathSeg.x1, pathSeg.y1);
				coordinates1 = coordinates1.matrixTransform(relativeMatrix);
				coordinates2 = new Adj.Point(pathSeg.x2, pathSeg.y2);
				coordinates2 = coordinates2.matrixTransform(relativeMatrix);
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(relativeMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x1: coordinates1.x,
				   y1: coordinates1.y,
				   x2: coordinates2.x,
				   y2: coordinates2.y,
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'S': // smooth cubic curveto
				coordinates2 = new Adj.Point(pathSeg.x2, pathSeg.y2);
				coordinates2 = coordinates2.matrixTransform(absoluteMatrix);
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x2: coordinates2.x,
				   y2: coordinates2.y,
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 's': // smooth cubic curveto
				coordinates2 = new Adj.Point(pathSeg.x2, pathSeg.y2);
				coordinates2 = coordinates2.matrixTransform(relativeMatrix);
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(relativeMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x2: coordinates2.x,
				   y2: coordinates2.y,
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'H': // horizontal lineto
				coordinates = new Adj.Point(pathSeg.x, previousOriginalCoordinates.y);
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: 'L',
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x = pathSeg.x;
				break;
			case 'h': // horizontal lineto
				coordinates = new Adj.Point(pathSeg.x, 0);
				coordinates = coordinates.matrixTransform(relativeMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: 'l',
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x += pathSeg.x;
				break;
			case 'V': // vertical lineto
				coordinates = new Adj.Point(previousOriginalCoordinates.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: 'L',
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'v': // vertical lineto
				coordinates = new Adj.Point(0, pathSeg.y);
				coordinates = coordinates.matrixTransform(relativeMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: 'l',
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'A': // elliptical arc, as implemented replace by a line
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: 'L',
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'a': // elliptical arc, as implemented replace by a line
				coordinates = new Adj.Point(pathSeg.x, pathSeg.y);
				coordinates = coordinates.matrixTransform(relativeMatrix);
				transformedPathSegArray.push
				({ pathSegTypeAsLetter: 'l',
				   x: coordinates.x,
				   y: coordinates.y });
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			default:
		}
	}
	return transformedPathSegArray;
};

// utility
// note: as implemented if path contains an elliptical arc curve segment then it is replaced by a line
Adj.pathSegListToDString = function pathSegListToDString (pathSegList) {
	var numberOfPathSegs = pathSegList.numberOfItems;
	var d = "";
	for (var index = 0; index < numberOfPathSegs; index++) {
		var pathSeg = pathSegList.getItem(index);
		var pathSegTypeAsLetter = pathSeg.pathSegTypeAsLetter;
		switch (pathSegTypeAsLetter) {
			case 'Z':  // closepath
			case 'z':
				d += pathSegTypeAsLetter;
				break;
			case 'M': // moveto
			case 'L': // lineto
			case 'T': // smooth quadratic curveto
			case 'm': // moveto
			case 'l': // lineto
			case 't': // smooth quadratic curveto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				break;
			case 'Q': // quadratic Bézier curveto
			case 'q': // quadratic Bézier curveto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x1) + "," + Adj.decimal(pathSeg.y1) + " " + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				break;
			case 'C': // cubic Bézier curveto
			case 'c': // cubic Bézier curveto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x1) + "," + Adj.decimal(pathSeg.y1) + " " + Adj.decimal(pathSeg.x2) + "," + Adj.decimal(pathSeg.y2) + " " + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				break;
			case 'S': // smooth cubic curveto
			case 's': // smooth cubic curveto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x2) + "," + Adj.decimal(pathSeg.y2) + " " + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				break;
			case 'H': // horizontal lineto
			case 'h': // horizontal lineto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x);
				break;
			case 'V': // vertical lineto
			case 'v': // vertical lineto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.y);
				break;
			case 'A': // elliptical arc, as implemented replace by a line
				d += "L" + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				break;
			case 'a': // elliptical arc, as implemented replace by a line
				d += "l" + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				break;
			default:
		}
		d += " ";
	}
	return d;
};

// utility
// note: as implemented if path contains an elliptical arc curve segment then it is replaced by a line
Adj.transformPath = function transformPath (pathElement, matrix) {
	// get static base values as floating point values, before animation
	var transformedPathSegArray = Adj.transformPathSegList(pathElement.pathSegList, matrix);
	var transformedPathSegList = new Adj.PathSegList(transformedPathSegArray);
	var d = Adj.pathSegListToDString(transformedPathSegList);
	pathElement.setAttribute("d", d);
};

// utility
Adj.restoreAndStoreAuthoringAttribute = function restoreAndStoreAuthoringAttribute (element, name) {
	var value = Adj.elementGetAttributeInAdjNS(element, name);
	if (value) { // restore if any
		element.setAttribute(name, value);
	} else {
		value = element.getAttribute(name);
		if (value) { // store if any
			Adj.elementSetAttributeInAdjNS(element, name, value);
		}
	}
};

// utility
Adj.restoreAndStoreAuthoringCoordinates = function restoreAndStoreAuthoringCoordinates (element) {
	if (element instanceof SVGLineElement) {
		Adj.restoreAndStoreAuthoringAttribute(element, "x1");
		Adj.restoreAndStoreAuthoringAttribute(element, "y1");
		Adj.restoreAndStoreAuthoringAttribute(element, "x2");
		Adj.restoreAndStoreAuthoringAttribute(element, "y2");
	} else if (element instanceof SVGPathElement) {
		Adj.restoreAndStoreAuthoringAttribute(element, "d");
	} else {
		// other types of elements not implemented at this time
	}
};

// a specific algorithm
// note: as implemented works for simplified cases line and path,
// and for general case group containing one line (or path) as vector and any number of lines and paths as children of that group
Adj.defineCommandForAlgorithm({
	algorithmName: "connection",
	notAnOrder1Element: true,
	phaseHandlerNames: ["adjPhase5Up"],
	parameters: ["from", "to",
				 "vector",
				 "explain"],
	methods: [function connection (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		var theSvgElement = element.ownerSVGElement || element;
		//
		var usedHow = "used in a parameter for a connection command";
		var variableSubstitutionsByName = {};
		var fromParameter = parametersObject.from;
		if (!fromParameter) {
			throw "missing parameter from= for a connection command";
		}
		var fromMatch = Adj.idXYRegexp.exec(fromParameter);
		var fromId = fromMatch[1];
		var fromX = fromMatch[2] ? parseFloat(fromMatch[2]) : 0.5; // default fromX = 0.5
		var fromY = fromMatch[3] ? parseFloat(fromMatch[3]) : 0.5; // default fromY = 0.5
		var toParameter = parametersObject.to;
		if (!toParameter) {
			throw "missing parameter to= for a connection command";
		}
		var toMatch = Adj.idXYRegexp.exec(toParameter);
		var toId = toMatch[1];
		var toX = toMatch[2] ? parseFloat(toMatch[2]) : 0.5; // default toX = 0.5
		var toY = toMatch[3] ? parseFloat(toMatch[3]) : 0.5; // default toY = 0.5
		var vector = !isNaN(parametersObject.vector) ? parametersObject.vector : 0; // default vector = 0
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		Adj.unhideByDisplayAttribute(element);
		//
		// what to connect
		var fromElement = Adj.getElementByIdNearby(fromId, element);
		if (!fromElement) {
			throw "nonresolving id \"" + fromId + "\" used in parameter from= for a connection command";
		}
		var fromBoundingBox = fromElement.getBBox();
		var matrixFromFromElement = fromElement.getTransformToElement(element);
		var fromPoint = theSvgElement.createSVGPoint();
		fromPoint.x = fromBoundingBox.x + fromBoundingBox.width * fromX;
		fromPoint.y = fromBoundingBox.y + fromBoundingBox.height * fromY;
		fromPoint = fromPoint.matrixTransform(matrixFromFromElement);
		//
		var toElement = Adj.getElementByIdNearby(toId, element);
		if (!toElement) {
			throw "nonresolving id \"" + toId + "\" used in parameter to= for a connection command";
		}
		var toBoundingBox = toElement.getBBox();
		var matrixFromToElement = toElement.getTransformToElement(element);
		var toPoint = theSvgElement.createSVGPoint();
		toPoint.x = toBoundingBox.x + toBoundingBox.width * toX;
		toPoint.y = toBoundingBox.y + toBoundingBox.height * toY;
		toPoint = toPoint.matrixTransform(matrixFromToElement);
		//
		var neededDisplacementAndAngle = Adj.displacementAndAngle(fromPoint, toPoint);
		//
		// differentiate simplified cases
		if (element instanceof SVGLineElement) {
			// an SVG line
			// simple process
			element.setAttribute("x1", Adj.decimal(fromPoint.x));
			element.setAttribute("y1", Adj.decimal(fromPoint.y));
			element.setAttribute("x2", Adj.decimal(toPoint.x));
			element.setAttribute("y2", Adj.decimal(toPoint.y));
		} else if (element instanceof SVGPathElement) {
			// an SVG path
			// restore if any
			Adj.restoreAndStoreAuthoringCoordinates(element);
			// end points
			var pathEndPoints = Adj.endPoints(element);
			var pathFromPoint = pathEndPoints.fromPoint;
			var pathToPoint = pathEndPoints.toPoint;
			var pathDisplacementAndAngle = Adj.displacementAndAngle(pathFromPoint, pathToPoint);
			// the necessary matrix
			var matrix = theSvgElement.createSVGMatrix();
			// backwards order
			matrix = matrix.translate(fromPoint.x, fromPoint.y);
			matrix = matrix.rotate(neededDisplacementAndAngle.angle);
			matrix = matrix.scaleNonUniform(neededDisplacementAndAngle.displacement / pathDisplacementAndAngle.displacement, 1);
			matrix = matrix.rotate(-pathDisplacementAndAngle.angle);
			matrix = matrix.translate(-pathFromPoint.x, -pathFromPoint.y);
			// apply
			Adj.transformPath(element, matrix);
		} else { // general case, a group element
			// determine which nodes to process
			var childRecords = []; // children that are instances of SVGElement rather than every DOM node
			for (var child = element.firstChild, index = 0; child; child = child.nextSibling) {
				if (!(child instanceof SVGElement)) {
					continue; // skip if not an SVGElement, e.g. an XML #text
				}
				if (!child.getBBox) {
					continue; // skip if not an SVGLocatable, e.g. a <script> element
				}
				if (child.adjNotAnOrder1Element) { // e.g. a rider, or a floater
					continue;
				}
				if (index === vector) {
					vector = child; // now an SVGElement instead of a number
				}
				childRecords.push({
					node: child
				});
				index++;
			}
			if (!(vector instanceof SVGElement)) { // maybe childRecords.length === 0
				return; // defensive exit
			}
			// restore if any
			restoreLoop: for (var childRecordIndex in childRecords) {
				Adj.restoreAndStoreAuthoringCoordinates(childRecords[childRecordIndex].node);
			}
			// end points
			var vectorEndPoints = Adj.endPoints(vector);
			if (!vectorEndPoints) { // maybe vector is an unexpected type of element
				return; // defensive exit
			}
			var vectorFromPoint = vectorEndPoints.fromPoint;
			var vectorToPoint = vectorEndPoints.toPoint;
			var vectorDisplacementAndAngle = Adj.displacementAndAngle(vectorFromPoint, vectorToPoint);
			// the necessary matrix
			var matrix = theSvgElement.createSVGMatrix();
			// backwards order
			matrix = matrix.translate(fromPoint.x, fromPoint.y);
			matrix = matrix.rotate(neededDisplacementAndAngle.angle);
			matrix = matrix.scaleNonUniform(neededDisplacementAndAngle.displacement / vectorDisplacementAndAngle.displacement, 1);
			matrix = matrix.rotate(-vectorDisplacementAndAngle.angle);
			matrix = matrix.translate(-vectorFromPoint.x, -vectorFromPoint.y);
			// process
			childRecordsLoop: for (var childRecordIndex in childRecords) {
				var childRecord = childRecords[childRecordIndex];
				var child = childRecord.node;
				// apply
				if (child instanceof SVGLineElement) {
					// an SVG line
					Adj.transformLine(child, matrix);
				} else if (child instanceof SVGPathElement) {
					// an SVG path
					Adj.transformPath(child, matrix);
				} // else { // not a known case, as implemented not transformed
			}
		}
		//
		// explain
		if (explain) {
			var parent = element.parentNode;
			var explanationElement = Adj.createExplanationElement(parent, "rect");
			explanationElement.setAttribute("x", Adj.decimal(fromBoundingBox.x));
			explanationElement.setAttribute("y", Adj.decimal(fromBoundingBox.y));
			explanationElement.setAttribute("width", Adj.decimal(fromBoundingBox.width));
			explanationElement.setAttribute("height", Adj.decimal(fromBoundingBox.height));
			explanationElement.transform.baseVal.initialize(theSvgElement.createSVGTransformFromMatrix(matrixFromFromElement));
			explanationElement.setAttribute("fill", "green");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "green");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			parent.appendChild(explanationElement);
			parent.appendChild(Adj.createExplanationPointCircle(parent, fromPoint.x, fromPoint.y, "green"));
			var explanationElement = Adj.createExplanationElement(parent, "rect");
			explanationElement.setAttribute("x", Adj.decimal(toBoundingBox.x));
			explanationElement.setAttribute("y", Adj.decimal(toBoundingBox.y));
			explanationElement.setAttribute("width", Adj.decimal(toBoundingBox.width));
			explanationElement.setAttribute("height", Adj.decimal(toBoundingBox.height));
			explanationElement.transform.baseVal.initialize(theSvgElement.createSVGTransformFromMatrix(matrixFromToElement));
			explanationElement.setAttribute("fill", "red");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "red");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			parent.appendChild(explanationElement);
			parent.appendChild(Adj.createExplanationPointCircle(parent, toPoint.x, toPoint.y, "red"));
		}
	}]
});

// utility
Adj.fractionPoint = function fractionPoint (element, pathFraction) {
	var theSvgElement = element.ownerSVGElement || element;
	//
	var pathFractionPoint;
	if (element instanceof SVGLineElement) {
		// an SVG line
		pathFractionPoint = theSvgElement.createSVGPoint();
		// get static base values as floating point values, before animation
		pathFractionPoint.x = Adj.fraction(element.x1.baseVal.value, element.x2.baseVal.value, pathFraction);
		pathFractionPoint.y = Adj.fraction(element.y1.baseVal.value, element.y2.baseVal.value, pathFraction);
	} else if (element instanceof SVGPathElement) {
		// an SVG path
		// presumably static base values as floating point values, before animation
		var totalLength = element.getTotalLength();
		pathFractionPoint = element.getPointAtLength(totalLength * pathFraction);
	} // else { // not a known case, as implemented not transformed
	return pathFractionPoint;
};

// utility
Adj.totalLength = function totalLength (element) {
	if (element instanceof SVGLineElement) {
		// an SVG line
		// get static base values as floating point values, before animation
		var dx = element.x2.baseVal.value - element.x1.baseVal.value;
		var dy = element.y2.baseVal.value - element.y1.baseVal.value;
		return Math.sqrt(dx * dx + dy * dy);
	} else if (element instanceof SVGPathElement) {
		// an SVG path
		// presumably static base values as floating point values, before animation
		return element.getTotalLength();
	} // else { // not a known case, as implemented
};

// utility
Adj.distanceBetweenRectangles = function distanceBetweenRectangles (rect1, rect2) {
	var r1x1 = rect1.x;
	var r1x2 = r1x1 + rect1.width;
	var r1y1 = rect1.y;
	var r1y2 = r1y1 + rect1.height;
	var r2x1 = rect2.x;
	var r2x2 = r2x1 + rect2.width;
	var r2y1 = rect2.y;
	var r2y2 = r2y1 + rect2.height;
	var dx;
	var dy;
	if (r2x1 > r1x2) {
		dx = r2x1 - r1x2;
	} else if (r1x1 > r2x2) {
		dx = r1x1 - r2x2;
	} else {
		dx = 0;
	}
	if (r2y1 > r1y2) {
		dy = r2y1 - r1y2;
	} else if (r1y1 > r2y2) {
		dy = r1y1 - r2y2;
	} else {
		dy = 0;
	}
	if (dx === 0 && dy === 0) { // overlap
		var ox1 = r1x1 > r2x1 ? r1x1 : r2x1;
		var ox2 = r1x2 < r2x2 ? r1x2 : r2x2;
		var oy1 = r1y1 > r2y1 ? r1y1 : r2y1;
		var oy2 = r1y2 < r2y2 ? r1y2 : r2y2;
		return - Math.min(ox2 - ox1, oy2 - oy1); // if overlap then say distance = - overlap
	} else if (dx === 0) { // dy !== 0
		return dy;
	} else if (dy === 0) { // dx !== 0
		return dx;
	} else { // dx !== 0 && dy !== 0
		return Math.sqrt(dx * dx + dy * dy);
	}
};

// utility
Adj.addElementToAvoid = function addElementToAvoid (avoidList, element) {
	avoidList.push(element);
};

// utility
Adj.addSiblingsToAvoid = function addSiblingsToAvoid (avoidList, element) {
	var parent = element.parentNode;
	for (var sibling = parent.firstChild; sibling; sibling = sibling.nextSibling) {
		if (!(sibling instanceof SVGElement)) {
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		if (!sibling.getBBox) {
			continue; // skip if not an SVGLocatable, e.g. a <script> element
		}
		if (sibling === element) {
			continue; // don't avoid self
		}
		if (sibling.adjPlacementArtifact) {
			continue;
		}
		if (sibling.adjNotAnOrder1Element) {
			continue;
		}
		if (sibling.adjHiddenByCommand) {
			continue;
		}
		if (sibling.adjExplanationArtifact) {
			continue;
		}
		avoidList.push(sibling);
	}
};

// utility
// note: as implemented only works well for translation and scaling but gives distorted answers for rotation
Adj.relativeBoundingBoxes = function relativeBoundingBoxes (element, elements) {
	var theSvgElement = element.ownerSVGElement || element;
	//
	var parent = element.parentNode;
	var relativeBoundingBoxes = [];
	for (var oneElementIndex in elements) {
		var oneElement = elements[oneElementIndex];
		var oneBoundingBox;
		try {
			oneBoundingBox = oneElement.getBBox();
		} catch (exception) {
			// observed to get here in Firefox 19 when defs element has getBBox but expectably fails
			continue; // can ignore as long as no requirement for matching indexes
		}
		var oneBoundingBoxX = oneBoundingBox.x;
		var oneBoundingBoxY = oneBoundingBox.y;
		var oneBoundingBoxWidth = oneBoundingBox.width;
		var oneBoundingBoxHeight = oneBoundingBox.height;
		if (oneBoundingBoxWidth === 0 && oneBoundingBoxHeight === 0) { // e.g. an empty group
			continue; // skip
		}
		var matrixFromOneElement = oneElement.getTransformToElement(parent);
		var topLeftPoint = theSvgElement.createSVGPoint();
		topLeftPoint.x = oneBoundingBoxX;
		topLeftPoint.y = oneBoundingBoxY;
		topLeftPoint = topLeftPoint.matrixTransform(matrixFromOneElement);
		var bottomRightPoint = theSvgElement.createSVGPoint();
		bottomRightPoint.x = oneBoundingBoxX + oneBoundingBoxWidth;
		bottomRightPoint.y = oneBoundingBoxY + oneBoundingBoxHeight;
		bottomRightPoint = bottomRightPoint.matrixTransform(matrixFromOneElement);
		oneBoundingBoxX = topLeftPoint.x;
		oneBoundingBoxY = topLeftPoint.y;
		oneBoundingBoxWidth = bottomRightPoint.x - oneBoundingBoxX;
		oneBoundingBoxHeight = bottomRightPoint.y - oneBoundingBoxY;
		if (oneBoundingBoxWidth < 0) {
			// defensive swap for possible oddity
			oneBoundingBoxX = bottomRightPoint.x;
			oneBoundingBoxWidth = -oneBoundingBoxWidth;
		}
		if (oneBoundingBoxHeight < 0) {
			// defensive swap for possible oddity
			oneBoundingBoxY = bottomRightPoint.y;
			oneBoundingBoxHeight = -oneBoundingBoxHeight;
		}
		relativeBoundingBoxes.push({
			x: oneBoundingBoxX,
			y: oneBoundingBoxY,
			width: oneBoundingBoxWidth,
			height: oneBoundingBoxHeight
		});
	}
	return relativeBoundingBoxes;
};

// utility
Adj.distancesBetweenRectangles = function distancesBetweenRectangles (rectangle, rectangles) {
	var distances = [];
	for (var oneRectangleIndex in rectangles) {
		distances.push(Adj.distanceBetweenRectangles(rectangle, rectangles[oneRectangleIndex]));
	}
	return distances;
};

// a specific algorithm
// note: as implemented works for simplified case being in group of which first element is a path (or line) to ride on,
// and for general case given the id of a path to ride on
Adj.defineCommandForAlgorithm({
	algorithmName: "rider",
	notAnOrder1Element: true,
	phaseHandlerNames: ["adjPhase7"],
	processSubtreeOnlyInPhaseHandler: "adjPhase7",
	parameters: ["pin",
				 "path",
				 "adjust",
				 "at",
				 "gap",
				 "steps"],
	methods: [function rider (element, parametersObject, level) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a rider command";
		var variableSubstitutionsByName = {};
		var pinMatch = Adj.twoRegexp.exec(parametersObject.pin || "");
		var hFraction = pinMatch ? parseFloat(pinMatch[1]) : 0.5; // default hFraction = 0.5
		var vFraction = pinMatch ? parseFloat(pinMatch[2]) : 0.5; // default vFraction = 0.5
		var pathId = parametersObject.path;
		var adjust = Adj.noneClearNear[parametersObject.adjust]; // whether and how to automatically adjust
		var atMatch = Adj.oneOrTwoRegexp.exec(parametersObject.at);
		var pathFraction = atMatch[1];
		var pathFraction2 = atMatch[2]; // other end of range to try, if any
		// following conditionals still need pathFraction etc as string
		if (adjust === undefined) {
			if (!parametersObject.at) { // given neither adjust nor at
				adjust = Adj.noneClearNear["clear"]; // default adjust clear
			} else {
				if (pathFraction2) { // if given other end of range to try at
					adjust = Adj.noneClearNear["clear"]; // default adjust clear
				} else { // if given one number only
					adjust = Adj.noneClearNear["none"]; // default adjust none
				}
			}
		}
		// further operations need pathFraction etc as number
		pathFraction = parseFloat(pathFraction);
		pathFraction2 = parseFloat(pathFraction2);
		if (isNaN(pathFraction)) {
			switch (adjust) {
				case "clear":
				case "near":
					pathFraction = 0;
					break;
				case "none":
				default:
					pathFraction = 0.5;
			}
		}
		if (isNaN(pathFraction2)) {
			switch (adjust) {
				case "clear":
					pathFraction2 = 1;
					break;
				case "near":
					pathFraction2 = 0.5;
					break;
				case "none":
				default:
					pathFraction2 = pathFraction;
			}
		}
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 3, null, usedHow, variableSubstitutionsByName); // for adjust near, default gap = 3
		var numberOfSamples = !isNaN(parametersObject.steps) ? parametersObject.steps + 1 : 11; // for adjust, default steps = 10, which makes numberOfSamples = 11
		if (numberOfSamples < 4) { // sanity check
			numberOfSamples = 4;
		}
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		var considerElementsToAvoid;
		switch (adjust) {
			case "clear":
			case "near":
				considerElementsToAvoid = true;
				break;
			default:
				considerElementsToAvoid = false;
		}
		//
		var path;
		var avoidList = [];
		if (pathId) { // path id given
			// general case
			path = Adj.getElementByIdNearby(pathId, element);
			if (!path) {
				throw "nonresolving id \"" + pathId + "\" used in parameter path= for a rider command";
			}
			//
			if (considerElementsToAvoid) {
				Adj.addSiblingsToAvoid(avoidList, element);
			}
		} else { // no path id given
			// simplified case
			var parent = element.parentNode;
			// find first sibling
			for (var sibling = parent.firstChild, index = 0; sibling; sibling = sibling.nextSibling) {
				if (!(sibling instanceof SVGElement)) {
					continue; // skip if not an SVGElement, e.g. an XML #text
				}
				if (!sibling.getBBox) {
					continue; // skip if not an SVGLocatable, e.g. a <script> element
				}
				if (sibling.adjNotAnOrder1Element) {
					continue; // skip in case a rider is first
				}
				// found it
				path = sibling;
				break; // find first sibling loop
			}
			//
			if (considerElementsToAvoid) {
				Adj.addSiblingsToAvoid(avoidList, parent);
			}
		}
		//
		Adj.unhideByDisplayAttribute(element);
		Adj.processElementWithPhaseHandlers(element, true, level); // process subtree separately, i.e. now
		//
		// where on path to put it
		var boundingBox = element.getBBox();
		var pinX = boundingBox.x + Adj.fraction(0, boundingBox.width, hFraction);
		var pinY = boundingBox.y + Adj.fraction(0, boundingBox.height, vFraction);
		var bestPathFraction = (pathFraction + pathFraction2) / 2;
		if (!considerElementsToAvoid) {
			// no adjusting of bestPathFraction
		} else {
			var relativeBoundingBoxes = Adj.relativeBoundingBoxes(element, avoidList);
			var pathFractionLimit = pathFraction; // stay within this limit
			var pathFractionLimit2 = pathFraction2; // stay within this limit
			var pathTotalLength = Adj.totalLength(path);
			var pathFractionRange = pathFraction2 - pathFraction;
			var pathLengthRange = pathFractionRange * pathTotalLength;
			while (Math.abs(pathLengthRange) > 1) {
				var pathFractionStep = pathFractionRange / (numberOfSamples - 1);
				var oneTranslatedBoundingBox = {
					width: boundingBox.width,
					height: boundingBox.height
				};
				var samples = [];
				for (var sampleIndex = 0; sampleIndex < numberOfSamples; sampleIndex++) {
					var onePathFraction = pathFraction + sampleIndex * pathFractionStep;
					var onePathFractionPoint = Adj.fractionPoint(path, onePathFraction);
					oneTranslatedBoundingBox.x = boundingBox.x + (onePathFractionPoint.x - pinX); // effectively + translationX
					oneTranslatedBoundingBox.y = boundingBox.y + (onePathFractionPoint.y - pinY);
					samples.push({
						pathFraction: onePathFraction,
						distance: Math.min.apply(null, Adj.distancesBetweenRectangles(oneTranslatedBoundingBox, relativeBoundingBoxes))
					});
				}
				switch (adjust) {
					case "clear":
						for (var sampleIndex = 0; sampleIndex < numberOfSamples; sampleIndex++) {
							var oneSample = samples[sampleIndex];
							if (oneSample.distance > bestSample.distance) { // further away
								bestSample = oneSample;
							}
						}
						bestPathFraction = bestSample.pathFraction;
						break;
					case "near":
						var bestSample = samples[0];
						for (var sampleIndex = 0; sampleIndex < numberOfSamples; sampleIndex++) {
							var oneSample = samples[sampleIndex];
							if (bestSample.distance < gap) { // not enough distance yet
								if (oneSample.distance > bestSample.distance) { // larger distance
									bestSample = oneSample;
								}
							} else { // bestSample.distance >= gap, enough distance already
								if (oneSample.distance < bestSample.distance && oneSample.distance >= gap) { // closer to gap
									bestSample = oneSample;
								}
							}
						}
						bestPathFraction = bestSample.pathFraction;
						break;
					default:
						// no adjusting of bestPathFraction
				}
				// narrow down with a decreased range and step
				var pathFractionRange = 2 * pathFractionRange / (numberOfSamples - 1);
				var pathLengthRange = pathFractionRange * pathTotalLength;
				if (Math.abs(pathLengthRange) <= 1) { // good enough
					break; // done
				} else {
					pathFraction = bestPathFraction - pathFractionRange / 2;
					pathFraction2 = pathFraction + pathFractionRange;
					// stay within limits
					if (pathFractionRange > 0) { // positive direction
						if (pathFraction < pathFractionLimit) {
							pathFraction = pathFractionLimit;
							pathFraction2 = pathFraction + pathFractionRange;
						} else if (pathFraction2 > pathFractionLimit2) {
							pathFraction2 = pathFractionLimit2;
							pathFraction = pathFraction2 - pathFractionRange;
						}
					} else { // negative direction
						if (pathFraction > pathFractionLimit) {
							pathFraction = pathFractionLimit;
							pathFraction2 = pathFraction + pathFractionRange;
						} else if (pathFraction2 < pathFractionLimit2) {
							pathFraction2 = pathFractionLimit2;
							pathFraction = pathFraction2 - pathFractionRange;
						}
					}
				}
			}
		}
		var pathFractionPoint = Adj.fractionPoint(path, bestPathFraction);
		//
		// now put it there
		if (pathFractionPoint) {
			var translationX = pathFractionPoint.x - pinX;
			var translationY = pathFractionPoint.y - pinY;
			element.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
		} else { // not a known case, as implemented not transformed
			element.removeAttribute("transform");
		}
		//
		// explain
		if (explain) {
			var parent = element.parentNode;
			var elementTransformAttribute = element.getAttribute("transform");
			if (considerElementsToAvoid) {
				for (var oneRelativeBoundingBoxIndex in relativeBoundingBoxes) {
					var oneRelativeBoundingBox = relativeBoundingBoxes[oneRelativeBoundingBoxIndex];
					var explanationElement = Adj.createExplanationElement(parent, "rect");
					explanationElement.setAttribute("x", Adj.decimal(oneRelativeBoundingBox.x));
					explanationElement.setAttribute("y", Adj.decimal(oneRelativeBoundingBox.y));
					explanationElement.setAttribute("width", Adj.decimal(oneRelativeBoundingBox.width));
					explanationElement.setAttribute("height", Adj.decimal(oneRelativeBoundingBox.height));
					explanationElement.setAttribute("fill", "pink");
					explanationElement.setAttribute("fill-opacity", "0.2");
					explanationElement.setAttribute("stroke", "pink");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.2");
					parent.appendChild(explanationElement);
				}
			}
			var explanationElement = Adj.createExplanationElement(parent, "rect");
			explanationElement.setAttribute("x", Adj.decimal(boundingBox.x));
			explanationElement.setAttribute("y", Adj.decimal(boundingBox.y));
			explanationElement.setAttribute("width", Adj.decimal(boundingBox.width));
			explanationElement.setAttribute("height", Adj.decimal(boundingBox.height));
			explanationElement.setAttribute("transform", elementTransformAttribute);
			explanationElement.setAttribute("fill", "blue");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "blue");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			parent.appendChild(explanationElement);
			parent.appendChild(Adj.createExplanationPointCircle(parent, pinX, pinY, "blue"));
			if (considerElementsToAvoid) {
				var pathFractionPoint = Adj.fractionPoint(path, pathFractionLimit);
				parent.appendChild(Adj.createExplanationPointCircle(parent, pathFractionPoint.x, pathFractionPoint.y, "green"));
				var pathFractionPoint = Adj.fractionPoint(path, pathFractionLimit2);
				parent.appendChild(Adj.createExplanationPointCircle(parent, pathFractionPoint.x, pathFractionPoint.y, "red"));
			}
		}
	}]
});

// utility
Adj.relativatePath = function relativatePath (pathElement) {
	var theSvgElement = pathElement.ownerSVGElement || pathElement;
	//
	// get static base values as floating point values, before animation
	var pathSegList = pathElement.pathSegList;
	var numberOfPathSegs = pathSegList.numberOfItems;
	// loop
	var previousCoordinates = theSvgElement.createSVGPoint(); // keep current coordinates
	var d = "";
	for (var index = 0; index < numberOfPathSegs; index++) {
		var pathSeg = pathSegList.getItem(index);
		var pathSegTypeAsLetter = pathSeg.pathSegTypeAsLetter;
		switch (pathSegTypeAsLetter) {
			case 'Z':  // closepath
			case 'z':
				d += pathSegTypeAsLetter;
				break;
			case 'M': // moveto
			case 'L': // lineto
			case 'T': // smooth quadratic curveto
				d += pathSegTypeAsLetter.toLowerCase() + Adj.decimal(pathSeg.x - previousCoordinates.x) + "," + Adj.decimal(pathSeg.y - previousCoordinates.y);
				previousCoordinates.x = pathSeg.x;
				previousCoordinates.y = pathSeg.y;
				break;
			case 'm': // moveto
			case 'l': // lineto
			case 't': // smooth quadratic curveto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				previousCoordinates.x += pathSeg.x;
				previousCoordinates.y += pathSeg.y;
				break;
			case 'Q': // quadratic Bézier curveto
				d += pathSegTypeAsLetter.toLowerCase() + Adj.decimal(pathSeg.x1 - previousCoordinates.x) + "," + Adj.decimal(pathSeg.y1 - previousCoordinates.y) +
					" " + Adj.decimal(pathSeg.x - previousCoordinates.x) + "," + Adj.decimal(pathSeg.y - previousCoordinates.y);
				previousCoordinates.x = pathSeg.x;
				previousCoordinates.y = pathSeg.y;
				break;
			case 'q': // quadratic Bézier curveto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x1) + "," + Adj.decimal(pathSeg.y1) +
					" " + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				previousCoordinates.x += pathSeg.x;
				previousCoordinates.y += pathSeg.y;
				break;
			case 'C': // cubic Bézier curveto
				d += pathSegTypeAsLetter.toLowerCase() + Adj.decimal(pathSeg.x1 - previousCoordinates.x) + "," + Adj.decimal(pathSeg.y1 - previousCoordinates.y) +
					" " + Adj.decimal(pathSeg.x2 - previousCoordinates.x) + "," + Adj.decimal(pathSeg.y2 - previousCoordinates.y) +
					" " + Adj.decimal(pathSeg.x - previousCoordinates.x) + "," + Adj.decimal(pathSeg.y - previousCoordinates.y);
				previousCoordinates.x = pathSeg.x;
				previousCoordinates.y = pathSeg.y;
				break;
			case 'c': // cubic Bézier curveto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x1) + "," + Adj.decimal(pathSeg.y1) +
					" " + Adj.decimal(pathSeg.x2) + "," + Adj.decimal(pathSeg.y2) +
					" " + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				previousCoordinates.x += pathSeg.x;
				previousCoordinates.y += pathSeg.y;
				break;
			case 'S': // smooth cubic curveto
				d += pathSegTypeAsLetter.toLowerCase() + Adj.decimal(pathSeg.x2 - previousCoordinates.x) + "," + Adj.decimal(pathSeg.y2 - previousCoordinates.y) +
					" " + Adj.decimal(pathSeg.x - previousCoordinates.x) + "," + Adj.decimal(pathSeg.y - previousCoordinates.y);
				previousCoordinates.x = pathSeg.x;
				previousCoordinates.y = pathSeg.y;
				break;
			case 's': // smooth cubic curveto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x2) + "," + Adj.decimal(pathSeg.y2) +
					" " + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				previousCoordinates.x += pathSeg.x;
				previousCoordinates.y += pathSeg.y;
				break;
			case 'H': // horizontal lineto
				d += pathSegTypeAsLetter.toLowerCase() + Adj.decimal(pathSeg.x - previousCoordinates.x);
				previousCoordinates.x = pathSeg.x;
				break;
			case 'h': // horizontal lineto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.x);
				previousCoordinates.x += pathSeg.x;
				break;
			case 'V': // vertical lineto
				d += pathSegTypeAsLetter.toLowerCase() + Adj.decimal(pathSeg.y - previousCoordinates.y);
				previousCoordinates.y = pathSeg.y;
				break;
			case 'v': // vertical lineto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.y);
				previousCoordinates.y += pathSeg.y;
				break;
			case 'A': // elliptical arc
				d += pathSegTypeAsLetter.toLowerCase() + Adj.decimal(pathSeg.r1) + "," + Adj.decimal(pathSeg.r2) +
					" " + Adj.decimal(pathSeg.angle) +
					" " + (Adj.decimal(pathSeg.largeArcFlag) ? "1" : "0" ) + "," + (Adj.decimal(pathSeg.sweepFlag) ? "1" : "0" ) +
					" " + Adj.decimal(pathSeg.x - previousCoordinates.x) + "," + Adj.decimal(pathSeg.y - previousCoordinates.y);
				previousCoordinates.x = pathSeg.x;
				previousCoordinates.y = pathSeg.y;
				break;
			case 'a': // elliptical arc
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.r1) + "," + Adj.decimal(pathSeg.r2) +
					" " + Adj.decimal(pathSeg.angle) +
					" " + (Adj.decimal(pathSeg.largeArcFlag) ? "1" : "0" ) + "," + (Adj.decimal(pathSeg.sweepFlag) ? "1" : "0" ) +
					" " + Adj.decimal(pathSeg.x) + "," + Adj.decimal(pathSeg.y);
				previousCoordinates.x += pathSeg.x;
				previousCoordinates.y += pathSeg.y;
				break;
			default:
		}
	}
	pathElement.setAttribute("d", d);
};

// utility
// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "relativate",
	phaseHandlerNames: ["adjPhase1Down"],
	parameters: [],
	methods: [function relativate (element, parametersObject) {
		// differentiate simplified cases
		if (element instanceof SVGPathElement) {
			// an SVG path
			Adj.relativatePath(element);
		} else { // general case, a group element
			// determine which nodes to process
			for (var child = element.firstChild, index = 0; child; child = child.nextSibling) {
				if (!(child instanceof SVGElement)) {
					continue; // skip if not an SVGElement, e.g. an XML #text
				}
				if (!child.getBBox) {
					continue; // skip if not an SVGLocatable, e.g. a <script> element
				}
				if (child instanceof SVGPathElement) {
					// an SVG path
					Adj.relativatePath(child);
				} // else { // not a known case, as implemented not relativated
			}
		}
	}]
});

// utility
Adj.circleAroundRect = function circleAroundRect (rect) {
	var x = rect.x;
	var y = rect.y;
	var width = rect.width;
	var height = rect.height;
	return {cx: x + width / 2, cy: y + height / 2, r: Math.sqrt(width * width + height * height) / 2};
};

// utility
Adj.ellipseAroundRect = function ellipseAroundRect (rect) {
	var x = rect.x;
	var y = rect.y;
	var width = rect.width;
	var height = rect.height;
	return {cx: x + width / 2, cy: y + height / 2, rx: width * Math.SQRT1_2, ry: height * Math.SQRT1_2};
};

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "circleForParent",
	notAnOrder1Element: true,
	phaseHandlerNames: ["adjPhase5Down"],
	parameters: ["inset"],
	methods: [function circleForParent (element, parametersObject) {
		var usedHow = "used in a parameter for a circleForParent command";
		var variableSubstitutionsByName = {};
		var inset = Adj.doVarsArithmetic(element, parametersObject.inset, 0, null, usedHow, variableSubstitutionsByName); // default inset = 0
		//
		var parent = element.parentNode;
		var parentBoundingBox = parent.getBBox();
		var parentBoundingCircle = Adj.circleAroundRect(parentBoundingBox);
		element.setAttribute("cx", Adj.decimal(parentBoundingCircle.cx));
		element.setAttribute("cy", Adj.decimal(parentBoundingCircle.cy));
		element.setAttribute("r", Adj.decimal(parentBoundingCircle.r - inset));
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "ellipseForParent",
	notAnOrder1Element: true,
	phaseHandlerNames: ["adjPhase5Down"],
	parameters: ["inset", "horizontalInset", "verticalInset"],
	methods: [function ellipseForParent (element, parametersObject) {
		var usedHow = "used in a parameter for an ellipseForParent command";
		var variableSubstitutionsByName = {};
		var inset = Adj.doVarsArithmetic(element, parametersObject.inset, 0, null, usedHow, variableSubstitutionsByName); // default inset = 0
		var horizontalInset = Adj.doVarsArithmetic(element, parametersObject.horizontalInset, inset, null, usedHow, variableSubstitutionsByName); // default horizontalInset = inset
		var verticalInset = Adj.doVarsArithmetic(element, parametersObject.verticalInset, inset, null, usedHow, variableSubstitutionsByName); // default verticalInset = inset
		//
		var parent = element.parentNode;
		var parentBoundingBox = parent.getBBox();
		var parentBoundingEllipse = Adj.ellipseAroundRect(parentBoundingBox);
		element.setAttribute("cx", Adj.decimal(parentBoundingEllipse.cx));
		element.setAttribute("cy", Adj.decimal(parentBoundingEllipse.cy));
		element.setAttribute("rx", Adj.decimal(parentBoundingEllipse.rx - horizontalInset));
		element.setAttribute("ry", Adj.decimal(parentBoundingEllipse.ry - verticalInset));
	}]
});

// a specific algorithm
// first element is trunk in the center, could be an empty group, remaining elements are branches
Adj.defineCommandForAlgorithm({
	algorithmName: "circularList",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["gap", "rGap", "cGap",
				 "fromAngle", "toAngle",
				 "rAlign",
				 "packArc", "cAlign",
				 "horizontalGap", "leftGap", "rightGap",
				 "verticalGap", "topGap", "bottomGap",
				 "explain"],
	methods: [function circularList (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a circularList command";
		var variableSubstitutionsByName = {};
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 3, null, usedHow, variableSubstitutionsByName); // default gap = 3
		var rGap = Adj.doVarsArithmetic(element, parametersObject.rGap, gap, null, usedHow, variableSubstitutionsByName); // minimum required radial gap, default rGap = gap
		var cGap = Adj.doVarsArithmetic(element, parametersObject.cGap, gap, null, usedHow, variableSubstitutionsByName); // minimum required circumferencial gap, default cGap = gap
		var fromAngle = Adj.doVarsArithmetic(element, parametersObject.fromAngle, 0, null, usedHow, variableSubstitutionsByName); // clockwise, 0 is x axis, default fromAngle = 0
		var toAngle = Adj.doVarsArithmetic(element, parametersObject.toAngle, fromAngle + 360, null, usedHow, variableSubstitutionsByName); // larger than fromAngle is clockwise, default toAngle = fromAngle + 360 means full circle clockwise
		var rAlign = Adj.doVarsArithmetic(element, parametersObject.rAlign, 0.5, Adj.insideMedianOutside, usedHow, variableSubstitutionsByName); // rAlign could be a number, default rAlign 0.5 == median
		var packArc = Adj.doVarsBoolean(element, parametersObject.packArc, false, usedHow, variableSubstitutionsByName); // default packArc = false
		var cAlign = Adj.doVarsArithmetic(element, parametersObject.cAlign, 0.5, Adj.fromHalfwayTo, usedHow, variableSubstitutionsByName); // cAlign could be a number, default cAlign 0.5 == halfway
		// outside gaps
		var horizontalGap = Adj.doVarsArithmetic(element, parametersObject.horizontalGap, gap, null, usedHow, variableSubstitutionsByName); // default horizontalGap = gap
		var leftGap = Adj.doVarsArithmetic(element, parametersObject.leftGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default leftGap = horizontalGap
		var rightGap = Adj.doVarsArithmetic(element, parametersObject.rightGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default rightGap = horizontalGap
		var verticalGap = Adj.doVarsArithmetic(element, parametersObject.verticalGap, gap, null, usedHow, variableSubstitutionsByName); // default verticalGap = gap
		var topGap = Adj.doVarsArithmetic(element, parametersObject.topGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default topGap = verticalGap
		var bottomGap = Adj.doVarsArithmetic(element, parametersObject.bottomGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default bottomGap = verticalGap
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping hiddenRect and skipping notAnOrder1Element
		var hiddenRect;
		var trunkRecord;
		var childRecords = [];
		var maxBranchRadius = 0;
		var minBranchRadius = 1 / 0; // Infinity
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			if (child.adjHiddenByCommand) {
				continue;
			}
			var boundingBox = child.getBBox();
			var boundingCircle = Adj.circleAroundRect(boundingBox);
			boundingCircle.r = Math.ceil(boundingCircle.r);
			childRecords.push({
				boundingBox: boundingBox,
				boundingCircle: boundingCircle,
				node: child
			});
			if (!trunkRecord) { // needs a trunk, chose to require it to be first
				trunkRecord = childRecords[0];
				continue;
			}
			if (boundingCircle.r > maxBranchRadius) {
				maxBranchRadius = boundingCircle.r;
			}
			if (boundingCircle.r < minBranchRadius) {
				minBranchRadius = boundingCircle.r;
			}
		}
		if (!trunkRecord) { // childRecords.length === 0
			return; // defensive exit
		}
		var childRecordsLength = childRecords.length;
		var numberOfBranches = childRecordsLength - 1;
		if (numberOfBranches <= 0) { // no branch
			minBranchRadius = 0; // prevent defect in case packArc
		}
		//
		// process
		// figure angles
		var angleCovered = toAngle - fromAngle;
		var clockwise = angleCovered >= 0;
		angleCovered = angleCovered % 360;
		var fullCircle = angleCovered === 0;
		if (fullCircle) {
			if (clockwise) {
				angleCovered = 360;
			} else {
				angleCovered = -360;
			}
		}
		toAngle = fromAngle + angleCovered;
		var numberOfSteps = fullCircle ? numberOfBranches : numberOfBranches - 1;
		var angleStep;
		if (numberOfBranches > 1) {
			angleStep = angleCovered / numberOfSteps;
		} else {
			angleStep = 180; // defensive default for later /sin(angleStep/2)
		}
		var angleStepRad = angleStep * Math.PI / 180;
		// figure radius
		var cGap05 = cGap / 2;
		var rAlign2 = rAlign * 2;
		var trunkCausedRadius = trunkRecord.boundingCircle.r + rGap + maxBranchRadius;
		var sinAngleStepAbsRad05 = Math.sin(Math.abs(angleStepRad) / 2);
		var maxBranchesCausedRadius = Math.ceil((maxBranchRadius + cGap05) / sinAngleStepAbsRad05);
		if (!packArc) {
			if (maxBranchesCausedRadius <= trunkCausedRadius) {
				var treeRadius = trunkCausedRadius;
			} else {
				treeRadius = maxBranchesCausedRadius;
			}
		} else { // packArc
			// in here radians, not degrees
			var angleCoveredAbsRad = Math.abs(angleCovered * Math.PI / 180);
			var minBranchesCausedRadius = Math.ceil((minBranchRadius + cGap05) / sinAngleStepAbsRad05);
			var minPossibleRadius = Math.max(minBranchesCausedRadius, trunkCausedRadius);
			var angleCoveredAtTreeRadius = function angleCoveredAtTreeRadius (treeRadiusAt) {
				var accumulatedAngleCovered05 = 0;
				for (var childRecordIndex = 1; childRecordIndex < childRecordsLength; childRecordIndex++) {
					var childRecord = childRecords[childRecordIndex];
					var childBoundingCircleR = childRecord.boundingCircle.r;
					var wiggleR = maxBranchRadius - childBoundingCircleR;
					var currentRadius = treeRadiusAt - wiggleR + rAlign2 * wiggleR;
					var angleCovered05 = Math.asin((childBoundingCircleR + cGap05) / currentRadius);
					if (isNaN(angleCovered05)) { // possible if e.g. currentRadius === 0 (observed), or asin(2)
						angleCovered05 = 0;
					}
					childRecord.angleCovered05 = angleCovered05; // other sections of this algorithm now depend on this
					accumulatedAngleCovered05 += angleCovered05;
				}
				return 2 * accumulatedAngleCovered05;
			};
			if (maxBranchesCausedRadius <= minPossibleRadius) {
				var treeRadius = minPossibleRadius;
				var tentativeAngleCovered = angleCoveredAtTreeRadius(treeRadius);
			} else {
				var maxPossibleAngleCovered = angleCoveredAtTreeRadius(minPossibleRadius);
				var tentativeTreeRadius = maxBranchesCausedRadius;
				var tentativeAngleCovered = angleCoveredAtTreeRadius(tentativeTreeRadius);
				var previousTentativeTreeRadius = tentativeTreeRadius;
				while (true) {
					var tentativeRemainingArc = (angleCoveredAbsRad - tentativeAngleCovered) * tentativeTreeRadius;
					if (tentativeRemainingArc < 0.5) { // good enough
						break;
					}
					// get closer
					tentativeTreeRadius =
						minPossibleRadius +
						(angleCoveredAbsRad - maxPossibleAngleCovered) *
						(tentativeTreeRadius - minPossibleRadius) /
						(tentativeAngleCovered - maxPossibleAngleCovered);
					if (tentativeTreeRadius < minPossibleRadius) {
						tentativeTreeRadius = minPossibleRadius;
					}
					if (!(tentativeTreeRadius < previousTentativeTreeRadius)) { // possible if e.g. tentativeAngleCovered == maxPossibleAngleCovered
						// prevent endless loop, gracious exit
						tentativeTreeRadius = previousTentativeTreeRadius;
						break;
					}
					tentativeAngleCovered = angleCoveredAtTreeRadius(tentativeTreeRadius);
					if (tentativeTreeRadius <= minPossibleRadius) {
						break;
					}
					previousTentativeTreeRadius = tentativeTreeRadius;
				}
				treeRadius = tentativeTreeRadius;
			}
		}
		// now we know where to put it
		var treeCenterX = treeRadius + maxBranchRadius;
		var treeCenterY = treeRadius + maxBranchRadius;
		// from here on radians, not degrees
		var currentAngle = fromAngle * Math.PI / 180;
		if (packArc) {
			currentAngle += cAlign * (angleCoveredAbsRad - tentativeAngleCovered);
		}
		var minPlacedChildBoundingBoxX = 2 * treeCenterX;
		var minPlacedChildBoundingBoxY = 2 * treeCenterY;
		var maxPlacedChildBoundingBoxX = 0;
		var maxPlacedChildBoundingBoxY = 0;
		// first determine the respective translations
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var childBoundingCircle = childRecord.boundingCircle;
			var childBoundingCircleR = childBoundingCircle.r;
			var child = childRecord.node;
			var placedChildCx;
			var placedChildCy;
			if (childRecord === trunkRecord) {
				placedChildCx = treeCenterX;
				placedChildCy = treeCenterY;
			} else {
				var wiggleR = maxBranchRadius - childBoundingCircleR;
				var currentRadius = treeRadius - wiggleR + rAlign2 * wiggleR;
				// increment
				if (packArc) {
					currentAngle += childRecord.angleCovered05;
				}
				placedChildCx = treeCenterX + currentRadius * Math.cos(currentAngle);
				placedChildCy = treeCenterY + currentRadius * Math.sin(currentAngle);
				// increment
				if (!packArc) {
					currentAngle += angleStepRad;
				} else { // packArc
					currentAngle += childRecord.angleCovered05;
				}
			}
			// now we know where to put it
			childRecord.translationX = Math.round(placedChildCx - childBoundingCircle.cx);
			childRecord.translationY = Math.round(placedChildCy - childBoundingCircle.cy);
			// figure how to fix up translations to be top left aligned
			var childBoundingBox = childRecord.boundingBox;
			var childBoundingBoxWidth = childBoundingBox.width;
			var childBoundingBoxHeight = childBoundingBox.height;
			var placedChildBoundingBoxX = placedChildCx - childBoundingBoxWidth / 2;
			var placedChildBoundingBoxY = placedChildCy - childBoundingBoxHeight / 2;
			if (placedChildBoundingBoxX < minPlacedChildBoundingBoxX) {
				minPlacedChildBoundingBoxX = placedChildBoundingBoxX;
			}
			if (placedChildBoundingBoxY < minPlacedChildBoundingBoxY) {
				minPlacedChildBoundingBoxY = placedChildBoundingBoxY;
			}
			var placedChildBoundingBoxXPlusWidth = placedChildBoundingBoxX + childBoundingBoxWidth;
			var placedChildBoundingBoxYPlusHeight = placedChildBoundingBoxY + childBoundingBoxHeight;
			if (placedChildBoundingBoxXPlusWidth > maxPlacedChildBoundingBoxX) {
				maxPlacedChildBoundingBoxX = placedChildBoundingBoxXPlusWidth;
			}
			if (placedChildBoundingBoxYPlusHeight > maxPlacedChildBoundingBoxY) {
				maxPlacedChildBoundingBoxY = placedChildBoundingBoxYPlusHeight;
			}
			// explain
			if (explain) {
				childRecord.explainCircle = {
					cx: placedChildCx,
					cy: placedChildCy,
					r: childBoundingCircle.r
				};
			}
		}
		// how to fix up translations to be top left aligned
		var topLeftAlignmentFixX = Math.floor(minPlacedChildBoundingBoxX) - leftGap;
		var topLeftAlignmentFixY = Math.floor(minPlacedChildBoundingBoxY) - topGap;
		// then apply the respective translations, but fixed up translations to be top left aligned
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			var translationX = childRecord.translationX - topLeftAlignmentFixX;
			var translationY = childRecord.translationY - topLeftAlignmentFixY;
			child.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
		}
		//
		// size the hidden rect for having a good bounding box when from a level up this element's getBBox() gets called
		if (hiddenRect) {
			hiddenRect.setAttribute("x", 0);
			hiddenRect.setAttribute("y", 0);
			hiddenRect.setAttribute("width", Adj.decimal(Math.ceil(maxPlacedChildBoundingBoxX) + rightGap - topLeftAlignmentFixX));
			hiddenRect.setAttribute("height", Adj.decimal(Math.ceil(maxPlacedChildBoundingBoxY) + bottomGap - topLeftAlignmentFixY));
		}
		//
		// explain
		if (explain) {
			var explanationElement = Adj.createExplanationElement(element, "circle");
			explanationElement.setAttribute("cx", Adj.decimal(treeCenterX - topLeftAlignmentFixX));
			explanationElement.setAttribute("cy", Adj.decimal(treeCenterY - topLeftAlignmentFixY));
			explanationElement.setAttribute("r", Adj.decimal(treeRadius + maxBranchRadius));
			explanationElement.setAttribute("fill", "white");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "blue");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			element.appendChild(explanationElement);
			for (var childRecordIndex in childRecords) {
				var childRecord = childRecords[childRecordIndex];
				var explainCircle = childRecord.explainCircle;
				var explanationElement = Adj.createExplanationElement(element, "circle");
				explanationElement.setAttribute("cx", Adj.decimal(explainCircle.cx - topLeftAlignmentFixX));
				explanationElement.setAttribute("cy", Adj.decimal(explainCircle.cy - topLeftAlignmentFixY));
				explanationElement.setAttribute("r", Adj.decimal(explainCircle.r));
				explanationElement.setAttribute("fill", "blue");
				explanationElement.setAttribute("fill-opacity", "0.1");
				explanationElement.setAttribute("stroke", "blue");
				explanationElement.setAttribute("stroke-width", "1");
				explanationElement.setAttribute("stroke-opacity", "0.1");
				element.appendChild(explanationElement);
			}
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "verticalTree",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["gap",
				 "horizontalGap", "leftGap", "centerGap", "rightGap", "childlessGap", "earGap",
				 "verticalGap", "topGap", "middleGap", "bottomGap",
				 "hAlign", "vAlign",
				 "autoParrots",
				 "explain"],
	methods: [function verticalTree (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a verticalTree command";
		var variableSubstitutionsByName = {};
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 10, null, usedHow, variableSubstitutionsByName); // default gap = 10
		var horizontalGap = Adj.doVarsArithmetic(element, parametersObject.horizontalGap, gap, null, usedHow, variableSubstitutionsByName); // default horizontalGap = gap
		var leftGap = Adj.doVarsArithmetic(element, parametersObject.leftGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default leftGap = horizontalGap
		var centerGap = Adj.doVarsArithmetic(element, parametersObject.centerGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default centerGap = horizontalGap
		var rightGap = Adj.doVarsArithmetic(element, parametersObject.rightGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default rightGap = horizontalGap
		var childlessGap = Adj.doVarsArithmetic(element, parametersObject.childlessGap, centerGap, null, usedHow, variableSubstitutionsByName); // default childlessGap = centerGap
		var earGap = Adj.doVarsArithmetic(element, parametersObject.earGap, centerGap, null, usedHow, variableSubstitutionsByName); // default earGap = centerGap
		var verticalGap = Adj.doVarsArithmetic(element, parametersObject.verticalGap, gap, null, usedHow, variableSubstitutionsByName); // default verticalGap = gap
		var topGap = Adj.doVarsArithmetic(element, parametersObject.topGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default topGap = verticalGap
		var middleGap = Adj.doVarsArithmetic(element, parametersObject.middleGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default middleGap = verticalGap
		var bottomGap = Adj.doVarsArithmetic(element, parametersObject.bottomGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default bottomGap = verticalGap
		var hAlign = Adj.doVarsArithmetic(element, parametersObject.hAlign, 0.5, Adj.leftCenterRight, usedHow, variableSubstitutionsByName); // hAlign could be a number, default hAlign 0.5 == center
		var vAlign = Adj.doVarsArithmetic(element, parametersObject.vAlign, 0.5, Adj.topMiddleBottom, usedHow, variableSubstitutionsByName); // vAlign could be a number, default vAlign 0.5 == middle
		var autoParrots = Adj.doVarsBoolean(element, parametersObject.autoParrots, false, usedHow, variableSubstitutionsByName); // autoParrots explain = false
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping hiddenRect and skipping notAnOrder1Element
		var hiddenRect;
		var childRecords = [];
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			if (child.adjHiddenByCommand) {
				continue;
			}
			var childBoundingBox = child.getBBox();
			childRecords.push({
				boundingBox: childBoundingBox,
				node: child,
				treeChildRecords: [],
				positioningBox: { // x and y relative to enclosing familyBox, at first
					x: 0,
					y: 0,
					width: childBoundingBox.width,
					height: childBoundingBox.height
				},
				localSerialNumber: childRecords.length
			});
		}
		//
		// determine tree structure
		var idsDictionary = {};
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			var adjId = Adj.elementGetAttributeInAdjNS(child, "id"); // first check for preferred attribute adj:id
			if (adjId && !idsDictionary[adjId]) { // new
				idsDictionary[adjId] = childRecord;
			}
			var plainId = child.getAttribute("id"); // second check for acceptable attribute id
			if (plainId && !idsDictionary[plainId]) { // new
				idsDictionary[plainId] = childRecord;
			}
		}
		var rootRecords = [];
		var superRootRecord = {
			boundingBox: {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			},
			treeChildRecords: rootRecords,
			positioningBox: {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			},
			familyBox: {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			}
		};
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			var treeParentId = Adj.elementGetAttributeInAdjNS(child, "treeParent");
			if (treeParentId) {
				var treeParentRecord = idsDictionary[treeParentId];
				if (treeParentRecord) { // an element found with an id matching attribute adj:treeParent, as expected
					treeParentRecord.treeChildRecords.push(childRecord);
					childRecord.treeParentRecord = treeParentRecord;
				} else { // no element found with an id matching attribute adj:treeParent, e.g. author error
					rootRecords.push(childRecord);
					childRecord.treeParentRecord = superRootRecord;
				}
			} else { // no attribute adj:treeParent, e.g. author intended root
				rootRecords.push(childRecord);
				childRecord.treeParentRecord = superRootRecord;
			}
		}
		//
		// walk tree structure
		// tree walking variables
		var currentSiblingRecords = rootRecords;
		var currentSiblingRecordIndex = 0;
		var stack = [];
		var onWayBack = false;
		// coordinate calculating variables
		var rowRecords = [];
		// walk
		//console.log("walkTreeLoop1 starting");
		walkTreeLoop1: while (currentSiblingRecordIndex < currentSiblingRecords.length) {
			var currentChildRecord = currentSiblingRecords[currentSiblingRecordIndex];
			var treeChildRecords = currentChildRecord.treeChildRecords;
			var numberOfTreeChildren = treeChildRecords.length;
			//
			var indexOfRow = stack.length;
			var rowRecord = rowRecords[indexOfRow];
			if (!rowRecord) {
				rowRecord = rowRecords[indexOfRow] = {
					nodeRecords: [],
					maxHeight: 0 // largest in this row
				};
			}
			//
			if (!onWayBack) {
				if (currentSiblingRecordIndex === 0) {
					//console.log("walkTreeLoop1 before first of siblings at level " + (stack.length + 1));
				}
				//console.log("walkTreeLoop1 on way there in node " + currentChildRecord.node + " node " + currentSiblingRecordIndex + " at level " + (stack.length + 1));
				//
				currentChildRecord.reachable = true;
				currentChildRecord.indexAsSibling = currentSiblingRecordIndex;
				var nodeRecords = rowRecord.nodeRecords;
				var indexInRow = nodeRecords.length;
				currentChildRecord.indexInRow = indexInRow;
				currentChildRecord.indexOfRow = indexOfRow;
				nodeRecords.push(currentChildRecord);
				//
				if (numberOfTreeChildren) {
					//console.log("walkTreeLoop1 on way there to children of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					stack.push( { siblingRecords: currentSiblingRecords, index: currentSiblingRecordIndex } );
					currentSiblingRecords = treeChildRecords;
					currentSiblingRecordIndex = 0;
					continue walkTreeLoop1;
				} else { // childless node, aka leaf
					//console.log("walkTreeLoop1 at childless node (leaf) " + currentChildRecord.node + " at level " + (stack.length + 1));
					//
					currentChildRecord.furtherDepth = 0;
					var boundingBox = currentChildRecord.boundingBox;
					currentChildRecord.familyBox = { // x and y relative to enclosing familyBox, at first
						x: 0,
						y: 0,
						width: boundingBox.width,
						height: boundingBox.height
					};
				}
			} else { // onWayBack
				//console.log("walkTreeLoop1 on way back in node " + currentChildRecord.node + " at level " + (stack.length + 1));
				onWayBack = false;
				//
				// note furtherDepth
				var maxFurtherDepth = 0;
				for (var treeChildIndex = 0; treeChildIndex < numberOfTreeChildren; treeChildIndex++) {
					var treeChildRecord = treeChildRecords[treeChildIndex];
					var treeChildFurtherDepth = treeChildRecord.furtherDepth;
					if (treeChildFurtherDepth >= maxFurtherDepth) {
						maxFurtherDepth = treeChildFurtherDepth + 1;
					}
				}
				currentChildRecord.furtherDepth = maxFurtherDepth;
				// note: cannot reckon maxHeight yet, descendants not enough, further nodes in same rows could be larger
				//
				// place all children's familyBox (horizontally) once knowing all their respective familyBox.width
				var gapBetweenSiblings;
				if (maxFurtherDepth > 1) {
					gapBetweenSiblings = centerGap;
				} else {
					gapBetweenSiblings = childlessGap;
				}
				var familyBoxWidth = 0;
				if (!autoParrots || maxFurtherDepth === 0) { // avoid more complicated algorithm
					for (var treeChildIndex = 0; treeChildIndex < numberOfTreeChildren; treeChildIndex++) {
						if (treeChildIndex > 0) {
							familyBoxWidth += gapBetweenSiblings;
						}
						var treeChildFamilyBox = treeChildRecords[treeChildIndex].familyBox;
						treeChildFamilyBox.x = familyBoxWidth; // current value
						familyBoxWidth += treeChildFamilyBox.width;
					}
				} else { // autoParrots
					// a parrot sits next to a head on a shoulder
					var mostAdvancedHead = 0;
					var mostAdvancedBody = 0;
					var anyHeadAndBodyYet = false;
					var previousTreeChildRecord;
					for (var treeChildIndex = 0; treeChildIndex < numberOfTreeChildren; treeChildIndex++) {
						var treeChildRecord = treeChildRecords[treeChildIndex];
						var treeChildFurtherDepth = treeChildRecord.furtherDepth;
						var parrotToHead = false;
						var parrotToParrot = false;
						var headToParrot = false;
						var headToHead = false;
						if (treeChildIndex > 0) {
							var previousTreeChildFurtherDepth = previousTreeChildRecord.furtherDepth;
							if (previousTreeChildFurtherDepth === 0) {
								if (treeChildFurtherDepth > 0) {
									parrotToHead = true;
								} else {
									parrotToParrot = true;
								}
							} else {
								if (treeChildFurtherDepth === 0) {
									headToParrot = true;
								} else {
									headToHead = true;
								}
							}
						}
						var treeChildFamilyBox = treeChildRecord.familyBox;
						var treeChildPositioningBox = treeChildRecord.positioningBox;
						if (parrotToHead) {
							var treeChildFamilyBoxXByHead = mostAdvancedHead + earGap - treeChildPositioningBox.x;
							var treeChildFamilyBoxXByBody = mostAdvancedBody;
							if (anyHeadAndBodyYet) {
								treeChildFamilyBoxXByBody += gapBetweenSiblings;
							}
							if (treeChildFamilyBoxXByBody > treeChildFamilyBoxXByHead) {
								treeChildFamilyBox.x = treeChildFamilyBoxXByBody;
								if (!anyHeadAndBodyYet) {
									var parrotsMoveOver = treeChildFamilyBoxXByBody - treeChildFamilyBoxXByHead;
									for (var parrotIndex = 0; parrotIndex < treeChildIndex; parrotIndex++) {
										var parrotRecord = treeChildRecords[parrotIndex];
										parrotRecord.familyBox.x += parrotsMoveOver;
									}
								}
							} else {
								treeChildFamilyBox.x = treeChildFamilyBoxXByHead;
							}
							anyHeadAndBodyYet = true;
						} else if (parrotToParrot) {
							treeChildFamilyBox.x = mostAdvancedHead + gapBetweenSiblings;
						} else if (headToParrot) {
							treeChildFamilyBox.x = mostAdvancedHead + earGap;
						} else if (headToHead) {
							var treeChildFamilyBoxX = mostAdvancedBody > mostAdvancedHead ? mostAdvancedBody : mostAdvancedHead;
							treeChildFamilyBoxX += gapBetweenSiblings;
							treeChildFamilyBox.x = treeChildFamilyBoxX;
							anyHeadAndBodyYet = true;
						} else { // treeChildIndex === 0
							treeChildFamilyBox.x = 0;
							if (treeChildFurtherDepth > 0) {
								anyHeadAndBodyYet = true;
							}
						}
						mostAdvancedHead = treeChildFamilyBox.x + treeChildPositioningBox.x + treeChildPositioningBox.width;
						if (treeChildRecord.furtherDepth > 0) { // a head
							mostAdvancedBody = treeChildFamilyBox.x + treeChildFamilyBox.width;
						}
						previousTreeChildRecord = treeChildRecord;
					}
					familyBoxWidth = mostAdvancedBody > mostAdvancedHead ? mostAdvancedBody : mostAdvancedHead;
				}
				var positioningBox = currentChildRecord.positioningBox;
				var positioningBoxWidth = positioningBox.width;
				if (familyBoxWidth < positioningBoxWidth) {
					var treeChildrenMoveOver = Adj.fraction(0, positioningBoxWidth - familyBoxWidth, hAlign);
					for (var treeChildIndex = 0; treeChildIndex < numberOfTreeChildren; treeChildIndex++) {
						var treeChildRecord = treeChildRecords[treeChildIndex];
						treeChildRecord.familyBox.x += treeChildrenMoveOver;
					}
					familyBoxWidth = positioningBoxWidth;
				}
				currentChildRecord.familyBox = { // x and y relative to enclosing familyBox, at first
					x: 0,
					y: 0,
					width: familyBoxWidth,
					height: 0 // cannot reckon height yet, descendants not enough, further nodes in same rows could be larger
				};
				//
				positioningBox.x = Adj.fraction(0, familyBoxWidth - positioningBoxWidth, hAlign);
				//
				if (currentChildRecord === superRootRecord) {
					//console.log("walkTreeLoop1 done");
					//
					currentChildRecord.familyBox.x = leftGap;
					currentChildRecord.familyBox.y = topGap;
					//
					break walkTreeLoop1;
				}
			}
			//console.log("walkTreeLoop1 finishing at node " + currentChildRecord.node + " at level " + (stack.length + 1));
			//
			var currentChildRecordHeight = currentChildRecord.positioningBox.height;
			if (currentChildRecordHeight > rowRecord.maxHeight) {
				rowRecord.maxHeight = currentChildRecordHeight;
			}
			//
			currentSiblingRecordIndex += 1;
			if (currentSiblingRecordIndex < currentSiblingRecords.length) {
				continue walkTreeLoop1;
			} else { // no more sibling
				//console.log("walkTreeLoop1 after last of siblings at level " + (stack.length + 1));
				if (stack.length > 0) {
					//console.log("walkTreeLoop1 on way back to parent of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					var stackedPosition = stack.pop();
					currentSiblingRecords = stackedPosition.siblingRecords;
					currentSiblingRecordIndex = stackedPosition.index;
					onWayBack = true;
					continue walkTreeLoop1;
				} else { // stack.length === 0
					//console.log("walkTreeLoop1 almost done");
					currentSiblingRecords = [superRootRecord];
					currentSiblingRecordIndex = 0;
					onWayBack = true;
					continue walkTreeLoop1;
				}
			}
		}
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			if (!childRecord.reachable) {
				// only way to get here should be because of an attribute adj:treeParent loop
				var unreachableParentRecords = [];
				var localSerialNumber = childRecord.localSerialNumber;
				while (!unreachableParentRecords[localSerialNumber]) {
					unreachableParentRecords[localSerialNumber] = true;
					childRecord = childRecord.treeParentRecord;
					localSerialNumber = childRecord.localSerialNumber;
				}
				var suspectChild = childRecord.node;
				// first check for preferred attribute adj:id
				// second check for acceptable attribute id
				var suspectId = Adj.elementGetAttributeInAdjNS(suspectChild, "id") || suspectChild.getAttribute("id");
				throw "suspect id \"" + suspectId + "\" used as attribute adj:treeParent= in a loop with a verticalTree unreachable element";
			}
		}
		//
		var totalWidth = leftGap + superRootRecord.familyBox.width + rightGap;
		//
		// place each familyBox vertically once knowing each row's maxHeight
		var totalHeight = topGap; // adds up with each row
		var familyBoxY; // relative
		var numberOfRows = rowRecords.length;
		for (var rowIndex = 0; rowIndex < numberOfRows; rowIndex++) {
			var rowRecord = rowRecords[rowIndex];
			var rowMaxHeight = rowRecord.maxHeight;
			if (rowIndex === 0) { // roots row
				familyBoxY = 0;
			} else { // rowIndex > 0
				totalHeight += middleGap;
			}
			var nodeRecords = rowRecord.nodeRecords;
			var numberOfNodes = nodeRecords.length;
			for (var nodeIndex = 0; nodeIndex < numberOfNodes; nodeIndex++) {
				var nodeRecord = nodeRecords[nodeIndex];
				nodeRecord.familyBox.y = familyBoxY;
				//
				var positioningBox = nodeRecord.positioningBox;
				positioningBox.y = Adj.fraction(0, rowMaxHeight - positioningBox.height, vAlign);
			}
			familyBoxY = rowMaxHeight + middleGap; // for next row
			rowRecord.y = totalHeight;
			totalHeight += rowMaxHeight;
		}
		totalHeight += bottomGap;
		//
		// walk tree structure again
		// tree walking variables
		var currentSiblingRecords = rootRecords;
		var currentSiblingRecordIndex = 0;
		var stack = [];
		var onWayBack = false;
		// walk
		//console.log("walkTreeLoop2 starting");
		walkTreeLoop2: while (currentSiblingRecordIndex < currentSiblingRecords.length) {
			var currentChildRecord = currentSiblingRecords[currentSiblingRecordIndex];
			var treeChildRecords = currentChildRecord.treeChildRecords;
			var numberOfTreeChildren = treeChildRecords.length;
			//
			var indexOfRow = stack.length;
			var rowRecord = rowRecords[indexOfRow];
			//
			if (!onWayBack) {
				if (currentSiblingRecordIndex === 0) {
					//console.log("walkTreeLoop2 before first of siblings at level " + (stack.length + 1));
				}
				//console.log("walkTreeLoop2 on way there in node " + currentChildRecord.node + " node " + currentSiblingRecordIndex + " at level " + (stack.length + 1));
				//
				var currentChildFamilyBox = currentChildRecord.familyBox;
				var treeParentFamilyBox = currentChildRecord.treeParentRecord.familyBox;
				// make familyBox.x and familyBox.y from relative to absolute
				currentChildFamilyBox.x += treeParentFamilyBox.x;
				currentChildFamilyBox.y += treeParentFamilyBox.y;
				// correction, possibly only needed if (explain)
				var deepestTreeDescendantRowRecord = rowRecords[indexOfRow + currentChildRecord.furtherDepth];
				currentChildFamilyBox.height = deepestTreeDescendantRowRecord.y + deepestTreeDescendantRowRecord.maxHeight - rowRecord.y;
				//
				var currentChildPositioningBox = currentChildRecord.positioningBox;
				// make positioningBox.x and positioningBox.y from relative to absolute
				currentChildPositioningBox.x += currentChildFamilyBox.x;
				currentChildPositioningBox.y += currentChildFamilyBox.y;
				//
				var currentChildBoundingBox = currentChildRecord.boundingBox;
				var translationX = currentChildPositioningBox.x - currentChildBoundingBox.x;
				var translationY = currentChildPositioningBox.y - currentChildBoundingBox.y;
				currentChildRecord.node.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
				//
				if (numberOfTreeChildren) {
					//console.log("walkTreeLoop2 on way there to children of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					stack.push( { siblingRecords: currentSiblingRecords, index: currentSiblingRecordIndex } );
					currentSiblingRecords = treeChildRecords;
					currentSiblingRecordIndex = 0;
					continue walkTreeLoop2;
				} else { // childless node, aka leaf
					//console.log("walkTreeLoop2 at childless node (leaf) " + currentChildRecord.node + " at level " + (stack.length + 1));
				}
			} else { // onWayBack
				//console.log("walkTreeLoop2 on way back in node " + currentChildRecord.node + " at level " + (stack.length + 1));
				onWayBack = false;
			}
			//console.log("walkTreeLoop2 finishing at node " + currentChildRecord.node + " at level " + (stack.length + 1));
			currentSiblingRecordIndex += 1;
			if (currentSiblingRecordIndex < currentSiblingRecords.length) {
				continue walkTreeLoop2;
			} else { // no more sibling
				//console.log("walkTreeLoop2 after last of siblings at level " + (stack.length + 1));
				if (stack.length > 0) {
					//console.log("walkTreeLoop2 on way back to parent of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					var stackedPosition = stack.pop();
					currentSiblingRecords = stackedPosition.siblingRecords;
					currentSiblingRecordIndex = stackedPosition.index;
					onWayBack = true;
					continue walkTreeLoop2;
				} else { // stack.length === 0
					//console.log("walkTreeLoop2 done");
					break walkTreeLoop2;
				}
			}
		}
		//
		// size the hidden rect for having a good bounding box when from a level up this element's getBBox() gets called
		if (hiddenRect) {
			hiddenRect.setAttribute("x", 0);
			hiddenRect.setAttribute("y", 0);
			hiddenRect.setAttribute("width", Adj.decimal(totalWidth));
			hiddenRect.setAttribute("height", Adj.decimal(totalHeight));
		}
		//
		// explain
		if (explain) {
			if (hiddenRect) {
				var explanationElement = Adj.createExplanationElement(element, "rect");
				explanationElement.setAttribute("x", 0);
				explanationElement.setAttribute("y", 0);
				explanationElement.setAttribute("width", Adj.decimal(totalWidth));
				explanationElement.setAttribute("height", Adj.decimal(totalHeight));
				explanationElement.setAttribute("fill", "white");
				explanationElement.setAttribute("fill-opacity", "0.1");
				explanationElement.setAttribute("stroke", "blue");
				explanationElement.setAttribute("stroke-width", "1");
				explanationElement.setAttribute("stroke-opacity", "0.2");
				element.appendChild(explanationElement);
			}
			var numberOfRows = rowRecords.length;
			for (var rowIndex = 0; rowIndex < numberOfRows; rowIndex++) {
				var rowRecord = rowRecords[rowIndex];
				var rowY = rowRecord.y;
				var rowMaxHeight = rowRecord.maxHeight;
				var rowHeadBottom = rowY + rowMaxHeight;
				var rowShoulderTop = rowHeadBottom + middleGap; // rowRecords[rowIndex + 1].y
				var nodeRecords = rowRecord.nodeRecords;
				var numberOfNodes = nodeRecords.length;
				for (var nodeIndex = 0; nodeIndex < numberOfNodes; nodeIndex++) {
					var nodeRecord = nodeRecords[nodeIndex];
					//
					var familyBox = nodeRecord.familyBox;
					var positioningBox = nodeRecord.positioningBox;
					if (nodeRecord.furtherDepth > 0) { // a head
						var explainPathData = "m" +
							Adj.decimal(positioningBox.x) + "," + Adj.decimal(familyBox.y) + " " +
							Adj.decimal(positioningBox.width) + "," + Adj.decimal(0) + " L" +
							Adj.decimal(positioningBox.x + positioningBox.width) + "," + Adj.decimal(rowHeadBottom) + " " +
							Adj.decimal(familyBox.x + familyBox.width) + "," + Adj.decimal(rowShoulderTop) + " " +
							Adj.decimal(familyBox.x + familyBox.width) + "," + Adj.decimal(familyBox.y + familyBox.height) + " l" +
							Adj.decimal(-familyBox.width) + "," + Adj.decimal(0) + " L" +
							Adj.decimal(familyBox.x) + "," + Adj.decimal(rowShoulderTop) + " " +
							Adj.decimal(positioningBox.x) + "," + Adj.decimal(rowHeadBottom) + " z";
						var explanationElement = Adj.createExplanationElement(element, "path");
						explanationElement.setAttribute("d", explainPathData);
						explanationElement.setAttribute("fill", "white");
						explanationElement.setAttribute("fill-opacity", "0.1");
						explanationElement.setAttribute("stroke", "blue");
						explanationElement.setAttribute("stroke-width", "1");
						explanationElement.setAttribute("stroke-opacity", "0.2");
						element.appendChild(explanationElement);
					} else {
						var explanationElement = Adj.createExplanationElement(element, "rect");
						explanationElement.setAttribute("x", Adj.decimal(familyBox.x));
						explanationElement.setAttribute("y", Adj.decimal(familyBox.y));
						explanationElement.setAttribute("width", Adj.decimal(familyBox.width));
						explanationElement.setAttribute("height", Adj.decimal(familyBox.height));
						explanationElement.setAttribute("fill", "white");
						explanationElement.setAttribute("fill-opacity", "0.1");
						explanationElement.setAttribute("stroke", "blue");
						explanationElement.setAttribute("stroke-width", "1");
						explanationElement.setAttribute("stroke-opacity", "0.2");
						element.appendChild(explanationElement);
					}
					//
					var explanationElement = Adj.createExplanationElement(element, "rect");
					explanationElement.setAttribute("x", Adj.decimal(positioningBox.x));
					explanationElement.setAttribute("y", Adj.decimal(positioningBox.y));
					explanationElement.setAttribute("width", Adj.decimal(positioningBox.width));
					explanationElement.setAttribute("height", Adj.decimal(positioningBox.height));
					explanationElement.setAttribute("fill", "blue");
					explanationElement.setAttribute("fill-opacity", "0.1");
					explanationElement.setAttribute("stroke", "blue");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.2");
					element.appendChild(explanationElement);
				}
				familyBoxY = rowMaxHeight + middleGap; // for next row
				totalHeight += rowMaxHeight;
			}
		}
	}]
});

// a specific algorithm
// note: has been made from a copy of verticalTree,
// for the purpose of developing in parallel, naming of variables has been kept similar, which has lead to some naming oddities,
// e.g. a row in this algorithm is vertical, still "a series of objects placed next to each other, usually in a straight line" per AHD
Adj.defineCommandForAlgorithm({
	algorithmName: "horizontalTree",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["gap",
				 "horizontalGap", "leftGap", "centerGap", "rightGap",
				 "verticalGap", "topGap", "middleGap", "bottomGap", "childlessGap", "earGap",
				 "hAlign", "vAlign",
				 "autoParrots",
				 "explain"],
	methods: [function horizontalTree (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a horizontalTree command";
		var variableSubstitutionsByName = {};
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 10, null, usedHow, variableSubstitutionsByName); // default gap = 10
		var horizontalGap = Adj.doVarsArithmetic(element, parametersObject.horizontalGap, gap, null, usedHow, variableSubstitutionsByName); // default horizontalGap = gap
		var leftGap = Adj.doVarsArithmetic(element, parametersObject.leftGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default leftGap = horizontalGap
		var centerGap = Adj.doVarsArithmetic(element, parametersObject.centerGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default centerGap = horizontalGap
		var rightGap = Adj.doVarsArithmetic(element, parametersObject.rightGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default rightGap = horizontalGap
		var verticalGap = Adj.doVarsArithmetic(element, parametersObject.verticalGap, gap, null, usedHow, variableSubstitutionsByName); // default verticalGap = gap
		var topGap = Adj.doVarsArithmetic(element, parametersObject.topGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default topGap = verticalGap
		var middleGap = Adj.doVarsArithmetic(element, parametersObject.middleGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default middleGap = verticalGap
		var bottomGap = Adj.doVarsArithmetic(element, parametersObject.bottomGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default bottomGap = verticalGap
		var childlessGap = Adj.doVarsArithmetic(element, parametersObject.childlessGap, middleGap, null, usedHow, variableSubstitutionsByName); // default childlessGap = middleGap
		var earGap = Adj.doVarsArithmetic(element, parametersObject.earGap, middleGap, null, usedHow, variableSubstitutionsByName); // default earGap = middleGap
		var hAlign = Adj.doVarsArithmetic(element, parametersObject.hAlign, 0.5, Adj.leftCenterRight, usedHow, variableSubstitutionsByName); // hAlign could be a number, default hAlign 0.5 == center
		var vAlign = Adj.doVarsArithmetic(element, parametersObject.vAlign, 0.5, Adj.topMiddleBottom, usedHow, variableSubstitutionsByName); // vAlign could be a number, default vAlign 0.5 == middle
		var autoParrots = Adj.doVarsBoolean(element, parametersObject.autoParrots, false, usedHow, variableSubstitutionsByName); // autoParrots explain = false
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping hiddenRect and skipping notAnOrder1Element
		var hiddenRect;
		var childRecords = [];
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			if (child.adjHiddenByCommand) {
				continue;
			}
			var childBoundingBox = child.getBBox();
			childRecords.push({
				boundingBox: childBoundingBox,
				node: child,
				treeChildRecords: [],
				positioningBox: { // x and y relative to enclosing familyBox, at first
					x: 0,
					y: 0,
					width: childBoundingBox.width,
					height: childBoundingBox.height
				},
				localSerialNumber: childRecords.length
			});
		}
		//
		// determine tree structure
		var idsDictionary = {};
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			var adjId = Adj.elementGetAttributeInAdjNS(child, "id"); // first check for preferred attribute adj:id
			if (adjId && !idsDictionary[adjId]) { // new
				idsDictionary[adjId] = childRecord;
			}
			var plainId = child.getAttribute("id"); // second check for acceptable attribute id
			if (plainId && !idsDictionary[plainId]) { // new
				idsDictionary[plainId] = childRecord;
			}
		}
		var rootRecords = [];
		var superRootRecord = {
			boundingBox: {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			},
			treeChildRecords: rootRecords,
			positioningBox: {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			},
			familyBox: {
				x: 0,
				y: 0,
				width: 0,
				height: 0
			}
		};
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			var treeParentId = Adj.elementGetAttributeInAdjNS(child, "treeParent");
			if (treeParentId) {
				var treeParentRecord = idsDictionary[treeParentId];
				if (treeParentRecord) { // an element found with an id matching attribute adj:treeParent, as expected
					treeParentRecord.treeChildRecords.push(childRecord);
					childRecord.treeParentRecord = treeParentRecord;
				} else { // no element found with an id matching attribute adj:treeParent, e.g. author error
					rootRecords.push(childRecord);
					childRecord.treeParentRecord = superRootRecord;
				}
			} else { // no attribute adj:treeParent, e.g. author intended root
				rootRecords.push(childRecord);
				childRecord.treeParentRecord = superRootRecord;
			}
		}
		//
		// walk tree structure
		// tree walking variables
		var currentSiblingRecords = rootRecords;
		var currentSiblingRecordIndex = 0;
		var stack = [];
		var onWayBack = false;
		// coordinate calculating variables
		var rowRecords = [];
		// walk
		//console.log("walkTreeLoop1 starting");
		walkTreeLoop1: while (currentSiblingRecordIndex < currentSiblingRecords.length) {
			var currentChildRecord = currentSiblingRecords[currentSiblingRecordIndex];
			var treeChildRecords = currentChildRecord.treeChildRecords;
			var numberOfTreeChildren = treeChildRecords.length;
			//
			var indexOfRow = stack.length;
			var rowRecord = rowRecords[indexOfRow];
			if (!rowRecord) {
				rowRecord = rowRecords[indexOfRow] = {
					nodeRecords: [],
					maxWidth: 0 // largest in this row
				};
			}
			//
			if (!onWayBack) {
				if (currentSiblingRecordIndex === 0) {
					//console.log("walkTreeLoop1 before first of siblings at level " + (stack.length + 1));
				}
				//console.log("walkTreeLoop1 on way there in node " + currentChildRecord.node + " node " + currentSiblingRecordIndex + " at level " + (stack.length + 1));
				//
				currentChildRecord.reachable = true;
				currentChildRecord.indexAsSibling = currentSiblingRecordIndex;
				var nodeRecords = rowRecord.nodeRecords;
				var indexInRow = nodeRecords.length;
				currentChildRecord.indexInRow = indexInRow;
				currentChildRecord.indexOfRow = indexOfRow;
				nodeRecords.push(currentChildRecord);
				//
				if (numberOfTreeChildren) {
					//console.log("walkTreeLoop1 on way there to children of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					stack.push( { siblingRecords: currentSiblingRecords, index: currentSiblingRecordIndex } );
					currentSiblingRecords = treeChildRecords;
					currentSiblingRecordIndex = 0;
					continue walkTreeLoop1;
				} else { // childless node, aka leaf
					//console.log("walkTreeLoop1 at childless node (leaf) " + currentChildRecord.node + " at level " + (stack.length + 1));
					//
					currentChildRecord.furtherDepth = 0;
					var boundingBox = currentChildRecord.boundingBox;
					currentChildRecord.familyBox = { // x and y relative to enclosing familyBox, at first
						x: 0,
						y: 0,
						width: boundingBox.width,
						height: boundingBox.height
					};
				}
			} else { // onWayBack
				//console.log("walkTreeLoop1 on way back in node " + currentChildRecord.node + " at level " + (stack.length + 1));
				onWayBack = false;
				//
				// note furtherDepth
				var maxFurtherDepth = 0;
				for (var treeChildIndex = 0; treeChildIndex < numberOfTreeChildren; treeChildIndex++) {
					var treeChildRecord = treeChildRecords[treeChildIndex];
					var treeChildFurtherDepth = treeChildRecord.furtherDepth;
					if (treeChildFurtherDepth >= maxFurtherDepth) {
						maxFurtherDepth = treeChildFurtherDepth + 1;
					}
				}
				currentChildRecord.furtherDepth = maxFurtherDepth;
				// note: cannot reckon maxWidth yet, descendants not enough, further nodes in same rows could be larger
				//
				// place all children's familyBox (vertically) once knowing all their respective familyBox.height
				var gapBetweenSiblings;
				if (maxFurtherDepth > 1) {
					gapBetweenSiblings = middleGap;
				} else {
					gapBetweenSiblings = childlessGap;
				}
				var familyBoxHeight = 0;
				if (!autoParrots || maxFurtherDepth === 0) { // avoid more complicated algorithm
					for (var treeChildIndex = 0; treeChildIndex < numberOfTreeChildren; treeChildIndex++) {
						if (treeChildIndex > 0) {
							familyBoxHeight += gapBetweenSiblings;
						}
						var treeChildFamilyBox = treeChildRecords[treeChildIndex].familyBox;
						treeChildFamilyBox.y = familyBoxHeight; // current value
						familyBoxHeight += treeChildFamilyBox.height;
					}
				} else { // autoParrots
					// a parrot sits next to a head on a shoulder
					var mostAdvancedHead = 0;
					var mostAdvancedBody = 0;
					var anyHeadAndBodyYet = false;
					var previousTreeChildRecord;
					for (var treeChildIndex = 0; treeChildIndex < numberOfTreeChildren; treeChildIndex++) {
						var treeChildRecord = treeChildRecords[treeChildIndex];
						var treeChildFurtherDepth = treeChildRecord.furtherDepth;
						var parrotToHead = false;
						var parrotToParrot = false;
						var headToParrot = false;
						var headToHead = false;
						if (treeChildIndex > 0) {
							var previousTreeChildFurtherDepth = previousTreeChildRecord.furtherDepth;
							if (previousTreeChildFurtherDepth === 0) {
								if (treeChildFurtherDepth > 0) {
									parrotToHead = true;
								} else {
									parrotToParrot = true;
								}
							} else {
								if (treeChildFurtherDepth === 0) {
									headToParrot = true;
								} else {
									headToHead = true;
								}
							}
						}
						var treeChildFamilyBox = treeChildRecord.familyBox;
						var treeChildPositioningBox = treeChildRecord.positioningBox;
						if (parrotToHead) {
							var treeChildFamilyBoxYByHead = mostAdvancedHead + earGap - treeChildPositioningBox.y;
							var treeChildFamilyBoxYByBody = mostAdvancedBody;
							if (anyHeadAndBodyYet) {
								treeChildFamilyBoxYByBody += gapBetweenSiblings;
							}
							if (treeChildFamilyBoxYByBody > treeChildFamilyBoxYByHead) {
								treeChildFamilyBox.y = treeChildFamilyBoxYByBody;
								if (!anyHeadAndBodyYet) {
									var parrotsMoveOver = treeChildFamilyBoxYByBody - treeChildFamilyBoxYByHead;
									for (var parrotIndex = 0; parrotIndex < treeChildIndex; parrotIndex++) {
										var parrotRecord = treeChildRecords[parrotIndex];
										parrotRecord.familyBox.y += parrotsMoveOver;
									}
								}
							} else {
								treeChildFamilyBox.y = treeChildFamilyBoxYByHead;
							}
							anyHeadAndBodyYet = true;
						} else if (parrotToParrot) {
							treeChildFamilyBox.y = mostAdvancedHead + gapBetweenSiblings;
						} else if (headToParrot) {
							treeChildFamilyBox.y = mostAdvancedHead + earGap;
						} else if (headToHead) {
							var treeChildFamilyBoxY = mostAdvancedBody > mostAdvancedHead ? mostAdvancedBody : mostAdvancedHead;
							treeChildFamilyBoxY += gapBetweenSiblings;
							treeChildFamilyBox.y = treeChildFamilyBoxY;
							anyHeadAndBodyYet = true;
						} else { // treeChildIndex === 0
							treeChildFamilyBox.y = 0;
							if (treeChildFurtherDepth > 0) {
								anyHeadAndBodyYet = true;
							}
						}
						mostAdvancedHead = treeChildFamilyBox.y + treeChildPositioningBox.y + treeChildPositioningBox.height;
						if (treeChildRecord.furtherDepth > 0) { // a head
							mostAdvancedBody = treeChildFamilyBox.y + treeChildFamilyBox.height;
						}
						previousTreeChildRecord = treeChildRecord;
					}
					familyBoxHeight = mostAdvancedBody > mostAdvancedHead ? mostAdvancedBody : mostAdvancedHead;
				}
				var positioningBox = currentChildRecord.positioningBox;
				var positioningBoxHeight = positioningBox.height;
				if (familyBoxHeight < positioningBoxHeight) {
					var treeChildrenMoveOver = Adj.fraction(0, positioningBoxHeight - familyBoxHeight, vAlign);
					for (var treeChildIndex = 0; treeChildIndex < numberOfTreeChildren; treeChildIndex++) {
						var treeChildRecord = treeChildRecords[treeChildIndex];
						treeChildRecord.familyBox.y += treeChildrenMoveOver;
					}
					familyBoxHeight = positioningBoxHeight;
				}
				currentChildRecord.familyBox = { // x and y relative to enclosing familyBox, at first
					x: 0,
					y: 0,
					width: 0, // cannot reckon width yet, descendants not enough, further nodes in same rows could be larger
					height: familyBoxHeight
				};
				//
				positioningBox.y = Adj.fraction(0, familyBoxHeight - positioningBoxHeight, vAlign);
				//
				if (currentChildRecord === superRootRecord) {
					//console.log("walkTreeLoop1 done");
					//
					currentChildRecord.familyBox.x = leftGap;
					currentChildRecord.familyBox.y = topGap;
					//
					break walkTreeLoop1;
				}
			}
			//console.log("walkTreeLoop1 finishing at node " + currentChildRecord.node + " at level " + (stack.length + 1));
			//
			var currentChildRecordWidth = currentChildRecord.positioningBox.width;
			if (currentChildRecordWidth > rowRecord.maxWidth) {
				rowRecord.maxWidth = currentChildRecordWidth;
			}
			//
			currentSiblingRecordIndex += 1;
			if (currentSiblingRecordIndex < currentSiblingRecords.length) {
				continue walkTreeLoop1;
			} else { // no more sibling
				//console.log("walkTreeLoop1 after last of siblings at level " + (stack.length + 1));
				if (stack.length > 0) {
					//console.log("walkTreeLoop1 on way back to parent of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					var stackedPosition = stack.pop();
					currentSiblingRecords = stackedPosition.siblingRecords;
					currentSiblingRecordIndex = stackedPosition.index;
					onWayBack = true;
					continue walkTreeLoop1;
				} else { // stack.length === 0
					//console.log("walkTreeLoop1 almost done");
					currentSiblingRecords = [superRootRecord];
					currentSiblingRecordIndex = 0;
					onWayBack = true;
					continue walkTreeLoop1;
				}
			}
		}
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			if (!childRecord.reachable) {
				// only way to get here should be because of an attribute adj:treeParent loop
				var unreachableParentRecords = [];
				var localSerialNumber = childRecord.localSerialNumber;
				while (!unreachableParentRecords[localSerialNumber]) {
					unreachableParentRecords[localSerialNumber] = true;
					childRecord = childRecord.treeParentRecord;
					localSerialNumber = childRecord.localSerialNumber;
				}
				var suspectChild = childRecord.node;
				// first check for preferred attribute adj:id
				// second check for acceptable attribute id
				var suspectId = Adj.elementGetAttributeInAdjNS(suspectChild, "id") || suspectChild.getAttribute("id");
				throw "suspect id \"" + suspectId + "\" used as attribute adj:treeParent= in a loop with a horizontalTree unreachable element";
			}
		}
		//
		var totalHeight = topGap + superRootRecord.familyBox.height + bottomGap;
		//
		// place each familyBox horizontally once knowing each row's maxWidth
		var totalWidth = leftGap; // adds up with each row
		var familyBoxX; // relative
		var numberOfRows = rowRecords.length;
		for (var rowIndex = 0; rowIndex < numberOfRows; rowIndex++) {
			var rowRecord = rowRecords[rowIndex];
			var rowMaxWidth = rowRecord.maxWidth;
			if (rowIndex === 0) { // roots row
				familyBoxX = 0;
			} else { // rowIndex > 0
				totalWidth += centerGap;
			}
			var nodeRecords = rowRecord.nodeRecords;
			var numberOfNodes = nodeRecords.length;
			for (var nodeIndex = 0; nodeIndex < numberOfNodes; nodeIndex++) {
				var nodeRecord = nodeRecords[nodeIndex];
				nodeRecord.familyBox.x = familyBoxX;
				//
				var positioningBox = nodeRecord.positioningBox;
				positioningBox.x = Adj.fraction(0, rowMaxWidth - positioningBox.width, hAlign);
			}
			familyBoxX = rowMaxWidth + centerGap; // for next row
			rowRecord.x = totalWidth;
			totalWidth += rowMaxWidth;
		}
		totalWidth += rightGap;
		//
		// walk tree structure again
		// tree walking variables
		var currentSiblingRecords = rootRecords;
		var currentSiblingRecordIndex = 0;
		var stack = [];
		var onWayBack = false;
		// walk
		//console.log("walkTreeLoop2 starting");
		walkTreeLoop2: while (currentSiblingRecordIndex < currentSiblingRecords.length) {
			var currentChildRecord = currentSiblingRecords[currentSiblingRecordIndex];
			var treeChildRecords = currentChildRecord.treeChildRecords;
			var numberOfTreeChildren = treeChildRecords.length;
			//
			var indexOfRow = stack.length;
			var rowRecord = rowRecords[indexOfRow];
			//
			if (!onWayBack) {
				if (currentSiblingRecordIndex === 0) {
					//console.log("walkTreeLoop2 before first of siblings at level " + (stack.length + 1));
				}
				//console.log("walkTreeLoop2 on way there in node " + currentChildRecord.node + " node " + currentSiblingRecordIndex + " at level " + (stack.length + 1));
				//
				var currentChildFamilyBox = currentChildRecord.familyBox;
				var treeParentFamilyBox = currentChildRecord.treeParentRecord.familyBox;
				// make familyBox.x and familyBox.y from relative to absolute
				currentChildFamilyBox.x += treeParentFamilyBox.x;
				currentChildFamilyBox.y += treeParentFamilyBox.y;
				// correction, possibly only needed if (explain)
				var deepestTreeDescendantRowRecord = rowRecords[indexOfRow + currentChildRecord.furtherDepth];
				currentChildFamilyBox.width = deepestTreeDescendantRowRecord.x + deepestTreeDescendantRowRecord.maxWidth - rowRecord.x;
				//
				var currentChildPositioningBox = currentChildRecord.positioningBox;
				// make positioningBox.x and positioningBox.y from relative to absolute
				currentChildPositioningBox.x += currentChildFamilyBox.x;
				currentChildPositioningBox.y += currentChildFamilyBox.y;
				//
				var currentChildBoundingBox = currentChildRecord.boundingBox;
				var translationX = currentChildPositioningBox.x - currentChildBoundingBox.x;
				var translationY = currentChildPositioningBox.y - currentChildBoundingBox.y;
				currentChildRecord.node.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
				//
				if (numberOfTreeChildren) {
					//console.log("walkTreeLoop2 on way there to children of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					stack.push( { siblingRecords: currentSiblingRecords, index: currentSiblingRecordIndex } );
					currentSiblingRecords = treeChildRecords;
					currentSiblingRecordIndex = 0;
					continue walkTreeLoop2;
				} else { // childless node, aka leaf
					//console.log("walkTreeLoop2 at childless node (leaf) " + currentChildRecord.node + " at level " + (stack.length + 1));
				}
			} else { // onWayBack
				//console.log("walkTreeLoop2 on way back in node " + currentChildRecord.node + " at level " + (stack.length + 1));
				onWayBack = false;
			}
			//console.log("walkTreeLoop2 finishing at node " + currentChildRecord.node + " at level " + (stack.length + 1));
			currentSiblingRecordIndex += 1;
			if (currentSiblingRecordIndex < currentSiblingRecords.length) {
				continue walkTreeLoop2;
			} else { // no more sibling
				//console.log("walkTreeLoop2 after last of siblings at level " + (stack.length + 1));
				if (stack.length > 0) {
					//console.log("walkTreeLoop2 on way back to parent of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					var stackedPosition = stack.pop();
					currentSiblingRecords = stackedPosition.siblingRecords;
					currentSiblingRecordIndex = stackedPosition.index;
					onWayBack = true;
					continue walkTreeLoop2;
				} else { // stack.length === 0
					//console.log("walkTreeLoop2 done");
					break walkTreeLoop2;
				}
			}
		}
		//
		// size the hidden rect for having a good bounding box when from a level up this element's getBBox() gets called
		if (hiddenRect) {
			hiddenRect.setAttribute("x", 0);
			hiddenRect.setAttribute("y", 0);
			hiddenRect.setAttribute("width", Adj.decimal(totalWidth));
			hiddenRect.setAttribute("height", Adj.decimal(totalHeight));
		}
		//
		// explain
		if (explain) {
			if (hiddenRect) {
				var explanationElement = Adj.createExplanationElement(element, "rect");
				explanationElement.setAttribute("x", 0);
				explanationElement.setAttribute("y", 0);
				explanationElement.setAttribute("width", Adj.decimal(totalWidth));
				explanationElement.setAttribute("height", Adj.decimal(totalHeight));
				explanationElement.setAttribute("fill", "white");
				explanationElement.setAttribute("fill-opacity", "0.1");
				explanationElement.setAttribute("stroke", "blue");
				explanationElement.setAttribute("stroke-width", "1");
				explanationElement.setAttribute("stroke-opacity", "0.2");
				element.appendChild(explanationElement);
			}
			var numberOfRows = rowRecords.length;
			for (var rowIndex = 0; rowIndex < numberOfRows; rowIndex++) {
				var rowRecord = rowRecords[rowIndex];
				var rowX = rowRecord.x;
				var rowMaxWidth = rowRecord.maxWidth;
				var rowHeadRight = rowX + rowMaxWidth;
				var rowShoulderLeft = rowHeadRight + centerGap; // rowRecords[rowIndex + 1].x
				var nodeRecords = rowRecord.nodeRecords;
				var numberOfNodes = nodeRecords.length;
				for (var nodeIndex = 0; nodeIndex < numberOfNodes; nodeIndex++) {
					var nodeRecord = nodeRecords[nodeIndex];
					//
					var familyBox = nodeRecord.familyBox;
					var positioningBox = nodeRecord.positioningBox;
					if (nodeRecord.furtherDepth > 0) { // a head
						var explainPathData = "m" +
							Adj.decimal(familyBox.x) + "," + Adj.decimal(positioningBox.y) + " " +
							Adj.decimal(0) + "," + Adj.decimal(positioningBox.height) + " L" +
							Adj.decimal(rowHeadRight) + "," + Adj.decimal(positioningBox.y + positioningBox.height) + " " +
							Adj.decimal(rowShoulderLeft) + "," + Adj.decimal(familyBox.y + familyBox.height) + " " +
							Adj.decimal(familyBox.x + familyBox.width) + "," + Adj.decimal(familyBox.y + familyBox.height) + " l" +
							Adj.decimal(0) + "," + Adj.decimal(-familyBox.height) + " L" +
							Adj.decimal(rowShoulderLeft) + "," + Adj.decimal(familyBox.y) + " " +
							Adj.decimal(rowHeadRight) + "," + Adj.decimal(positioningBox.y) + " z";
						var explanationElement = Adj.createExplanationElement(element, "path");
						explanationElement.setAttribute("d", explainPathData);
						explanationElement.setAttribute("fill", "white");
						explanationElement.setAttribute("fill-opacity", "0.1");
						explanationElement.setAttribute("stroke", "blue");
						explanationElement.setAttribute("stroke-width", "1");
						explanationElement.setAttribute("stroke-opacity", "0.2");
						element.appendChild(explanationElement);
					} else {
						var explanationElement = Adj.createExplanationElement(element, "rect");
						explanationElement.setAttribute("x", Adj.decimal(familyBox.x));
						explanationElement.setAttribute("y", Adj.decimal(familyBox.y));
						explanationElement.setAttribute("width", Adj.decimal(familyBox.width));
						explanationElement.setAttribute("height", Adj.decimal(familyBox.height));
						explanationElement.setAttribute("fill", "white");
						explanationElement.setAttribute("fill-opacity", "0.1");
						explanationElement.setAttribute("stroke", "blue");
						explanationElement.setAttribute("stroke-width", "1");
						explanationElement.setAttribute("stroke-opacity", "0.2");
						element.appendChild(explanationElement);
					}
					//
					var explanationElement = Adj.createExplanationElement(element, "rect");
					explanationElement.setAttribute("x", Adj.decimal(positioningBox.x));
					explanationElement.setAttribute("y", Adj.decimal(positioningBox.y));
					explanationElement.setAttribute("width", Adj.decimal(positioningBox.width));
					explanationElement.setAttribute("height", Adj.decimal(positioningBox.height));
					explanationElement.setAttribute("fill", "blue");
					explanationElement.setAttribute("fill-opacity", "0.1");
					explanationElement.setAttribute("stroke", "blue");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.2");
					element.appendChild(explanationElement);
				}
				familyBoxX = rowMaxWidth + centerGap; // for next row
				totalWidth += rowMaxWidth;
			}
		}
	}]
});

// utility
Adj.firstTimeStoreAuthoringAttribute = function firstTimeStoreAuthoringAttribute (element, name) {
	var value = Adj.elementGetAttributeInAdjNS(element, name);
	if (!value) { // not any yet
		value = element.getAttribute(name);
		if (value) { // store if any
			Adj.elementSetAttributeInAdjNS(element, name, value);
		}
	}
};

// utility
Adj.firstTimeStoreAuthoringCoordinates = function firstTimeStoreAuthoringCoordinates (element) {
	if (element instanceof SVGPathElement) {
		Adj.firstTimeStoreAuthoringAttribute(element, "d");
	} else {
		// other types of elements not implemented at this time
	}
};

// constants
// parse a ^ prefix and a variable name, e.g. "^distance"
Adj.variableRegexp = /\^\s*([^^#%,+\-*\/~\s]+)/g;
// parse a ~ prefix, an id, a #, a field, and optionally a % and one more parameter, e.g. full "~obj1#x%0.2" or less specific "~obj2#yh"
Adj.idArithmeticRegexp = /~\s*([^#\s]+)\s*#\s*([^%,+\-*)\s]+)(?:\s*%\s*(-?[0-9.]+))?/g;
// match a simple arithmetic expression, allowing integer and decimal numbers, +, -, and *, e.g. "0.5 * 125 + 20"
Adj.simpleArithmeticRegexp = /(-?\.?[0-9.]+(?:\s*[+\-*]\s*-?[0-9.]+)+)/g;
Adj.simpleArithmeticNumberRegexp = /(-?\.?[0-9.]+)/g;
Adj.simpleArithmeticOperatorRegexp = /([+\-*])/g;

// essential
// substitute variables
Adj.substituteVariables = function substituteVariables (element, originalExpression, usedHow, variableSubstitutionsByName) {
	Adj.variableRegexp.lastIndex = 0; // be safe
	var variableMatch = Adj.variableRegexp.exec(originalExpression);
	if (!variableMatch) { // shortcut for speed
		return originalExpression;
	}
	if (!usedHow) {
		usedHow = "";
	}
	if (!variableSubstitutionsByName) { // if not given one to reuse, make one for local use here
		variableSubstitutionsByName = {};
	}
	var replacements = [];
	while (variableMatch) {
		var variableName = variableMatch[1];
		var variableValue = variableSubstitutionsByName[variableName];
		if (variableValue === undefined) {
			var variableValue = undefined;
			var elementToLookUpIn = element;
			do {
				var variablesAtElement = elementToLookUpIn.adjVariables;
				if (variablesAtElement) {
					variableValue = variablesAtElement[variableName];
				}
				elementToLookUpIn = elementToLookUpIn.parentNode;
			} while (variableValue === undefined && elementToLookUpIn instanceof SVGElement);
			if (variableValue === undefined) {
				throw "nonresolving ^ variable name \"" + variableName + "\" " + usedHow;
			}
			if (typeof variableValue === "function") {
				variableValue = variableValue.call(element);
			}
			variableSubstitutionsByName[variableName] = variableValue;
		}
		replacements.push({
			index: variableMatch.index,
			lastIndex: Adj.variableRegexp.lastIndex,
			variableValue: variableValue
		});
		//
		variableMatch = Adj.variableRegexp.exec(originalExpression);
	}
	var replacementsLength = replacements.length;
	var replacementSegments = [];
	var previousIndex = 0;
	for (var replacementIndex = 0; replacementIndex < replacementsLength; replacementIndex++) {
		var replacement = replacements[replacementIndex];
		replacementSegments.push(originalExpression.substring(previousIndex, replacement.index));
		replacementSegments.push(replacement.variableValue);
		previousIndex = replacement.lastIndex;
	}
	replacementSegments.push(originalExpression.substring(previousIndex, originalExpression.length));
	var substitutedExpression = replacementSegments.join("");
	return substitutedExpression;
};

// essential
// resolve id arithmetic
Adj.resolveIdArithmetic = function resolveIdArithmetic (element, originalExpression, usedHow, idedElementRecordsById) {
	var theSvgElement = element.ownerSVGElement || element;
	//
	Adj.idArithmeticRegexp.lastIndex = 0; // be safe
	var idArithmeticMatch = Adj.idArithmeticRegexp.exec(originalExpression);
	if (!idArithmeticMatch) { // shortcut for speed
		return originalExpression;
	}
	if (!usedHow) {
		usedHow = "";
	}
	if (!idedElementRecordsById) { // if not given one to reuse, make one for local use here
		idedElementRecordsById = {};
	}
	var parent = element.parentNode;
	var replacements = [];
	while (idArithmeticMatch) {
		var arithmeticId = idArithmeticMatch[1];
		var idedElementRecord = idedElementRecordsById[arithmeticId];
		if (idedElementRecord === undefined) {
			var idedElement = Adj.getElementByIdNearby(arithmeticId, element);
			if (!idedElement) {
				throw "nonresolving ~ id \"" + arithmeticId + "\" " + usedHow;
			}
			idedElementRecord = idedElementRecordsById[arithmeticId] = {
				boundingBox: idedElement.getBBox(),
				matrixFrom: idedElement.getTransformToElement(parent)
			};
		}
		var arithmeticField = idArithmeticMatch[2];
		var arithmeticParameter = idArithmeticMatch[3];
		var arithmeticX;
		var arithmeticY;
		switch (arithmeticField) {
			case "x":
				if (!isNaN(arithmeticParameter)) {
					arithmeticX = parseFloat(arithmeticParameter);
				} else {
					arithmeticX = 0;
				}
				break;
			case "y":
				if (!isNaN(arithmeticParameter)) {
					arithmeticY = parseFloat(arithmeticParameter);
				} else {
					arithmeticY = 0;
				}
				break;
			case "xw":
				arithmeticX = 1;
				break;
			case "yh":
				arithmeticY = 1;
				break;
			case "cx":
				arithmeticX = 0.5;
				break;
			case "cy":
				arithmeticY = 0.5;
				break;
			case "w":
				withoutEF = true;
				break;
			case "h":
				withoutEF = true;
				break;
			case "d":
				withoutEF = true;
				break;
			default:
				throw "unknown # field \"" + arithmeticField + "\" " + usedHow;
		}
		var arithmeticBoundingBox = idedElementRecord.boundingBox;
		var matrixFromIdedElement = idedElementRecord.matrixFrom;
		var arithmeticPoint = theSvgElement.createSVGPoint();
		switch (arithmeticField) {
			case "w":
			case "h":
			case "d":
				// relative coordinates must be transformed without translation's e and f
				var matrixFromIdedElementWithoutEF = idedElementRecord.matrixFromWithoutEF;
				if (matrixFromIdedElementWithoutEF === undefined) {
					var matrixFromIdedElementWithoutEF = idedElementRecord.matrixFromWithoutEF = theSvgElement.createSVGMatrix();
					matrixFromIdedElementWithoutEF.a = matrixFromIdedElement.a;
					matrixFromIdedElementWithoutEF.b = matrixFromIdedElement.b;
					matrixFromIdedElementWithoutEF.c = matrixFromIdedElement.c;
					matrixFromIdedElementWithoutEF.d = matrixFromIdedElement.d;
				}
				arithmeticPoint.x = arithmeticBoundingBox.width;
				arithmeticPoint.y = arithmeticBoundingBox.height;
				arithmeticPoint = arithmeticPoint.matrixTransform(matrixFromIdedElementWithoutEF);
				break;
			default:
				if (isNaN(arithmeticX)) { // unknown for now
					arithmeticX = 0.5;
				}
				if (isNaN(arithmeticY)) { // unknown for now
					arithmeticY = 0.5;
				}
				arithmeticPoint.x = arithmeticBoundingBox.x + arithmeticBoundingBox.width * arithmeticX;
				arithmeticPoint.y = arithmeticBoundingBox.y + arithmeticBoundingBox.height * arithmeticY;
				arithmeticPoint = arithmeticPoint.matrixTransform(matrixFromIdedElement);
				break;
		}
		var arithmeticCoordinate;
		switch (arithmeticField) {
			case "x":
			case "xw":
			case "cx":
			case "w":
				arithmeticCoordinate = arithmeticPoint.x;
				break;
			case "y":
			case "yh":
			case "cy":
			case "h":
				arithmeticCoordinate = arithmeticPoint.y;
				break;
			case "d":
				arithmeticCoordinate = Math.sqrt(Math.pow(arithmeticPoint.x, 2) + Math.pow(arithmeticPoint.y, 2));
				break;
			// should never get to a default
		}
		arithmeticCoordinate = Adj.decimal(arithmeticCoordinate);
		replacements.push({
			index: idArithmeticMatch.index,
			lastIndex: Adj.idArithmeticRegexp.lastIndex,
			arithmeticCoordinate: arithmeticCoordinate
		});
		//
		idArithmeticMatch = Adj.idArithmeticRegexp.exec(originalExpression);
	}
	var replacementsLength = replacements.length;
	var replacementSegments = [];
	var previousIndex = 0;
	for (var replacementIndex = 0; replacementIndex < replacementsLength; replacementIndex++) {
		var replacement = replacements[replacementIndex];
		replacementSegments.push(originalExpression.substring(previousIndex, replacement.index));
		replacementSegments.push(replacement.arithmeticCoordinate);
		previousIndex = replacement.lastIndex;
	}
	replacementSegments.push(originalExpression.substring(previousIndex, originalExpression.length));
	var resolvedExpression = replacementSegments.join("");
	return resolvedExpression;
};

// essential
// evaluate simple arithmetic
Adj.evaluateArithmetic = function evaluateArithmetic (originalExpression, usedHow) {
	Adj.simpleArithmeticRegexp.lastIndex = 0; // be safe
	var simpleArithmeticMatch = Adj.simpleArithmeticRegexp.exec(originalExpression);
	if (!simpleArithmeticMatch) { // shortcut for speed
		return originalExpression;
	}
	if (!usedHow) {
		usedHow = "";
	}
	var replacements = [];
	while (simpleArithmeticMatch) {
		var arithmeticExpression = simpleArithmeticMatch[1];
		var sumSoFar = 0; // start with 0
		var currentAddend = 0; // start with 0
		var simpleNumberMatch;
		var simpleNumber;
		var simpleOperatorMatch;
		var simpleOperator = "+"; // start with 0 + 0
		Adj.simpleArithmeticOperatorRegexp.lastIndex = 0;
		do {
			Adj.simpleArithmeticNumberRegexp.lastIndex = Adj.simpleArithmeticOperatorRegexp.lastIndex;
			simpleNumberMatch = Adj.simpleArithmeticNumberRegexp.exec(arithmeticExpression);
			simpleNumber = simpleNumberMatch[1];
			if (isNaN(simpleNumber)) {
				throw "not a number \"" + simpleNumber + "\" " + usedHow;
			}
			simpleNumber = parseFloat(simpleNumber);
			switch (simpleOperator) {
				case "*":
					currentAddend *= simpleNumber;
					break;
				case "+":
					currentAddend = simpleNumber;
					break;
				case "-":
					currentAddend = -simpleNumber;
					break;
				default: // should never get here
					break;
			}
			//
			Adj.simpleArithmeticOperatorRegexp.lastIndex = Adj.simpleArithmeticNumberRegexp.lastIndex;
			simpleOperatorMatch = Adj.simpleArithmeticOperatorRegexp.exec(arithmeticExpression);
			if (simpleOperatorMatch) {
				simpleOperator = simpleOperatorMatch[1];
				switch (simpleOperator) {
					case "*":
						break;
					case "+":
					case "-":
						sumSoFar += currentAddend;
						break;
					default: // should never get here
						break;
				}
			} else { // should be end of arithmeticExpression
				sumSoFar += currentAddend;
			}
		} while (simpleOperatorMatch);
		replacements.push({
			index: simpleArithmeticMatch.index,
			lastIndex: Adj.simpleArithmeticRegexp.lastIndex,
			arithmeticExpression: sumSoFar.toString()
		});
		//
		simpleArithmeticMatch = Adj.simpleArithmeticRegexp.exec(originalExpression);
	}
	var replacementsLength = replacements.length;
	var replacementSegments = [];
	var previousIndex = 0;
	for (var replacementIndex = 0; replacementIndex < replacementsLength; replacementIndex++) {
		var replacement = replacements[replacementIndex];
		replacementSegments.push(originalExpression.substring(previousIndex, replacement.index));
		replacementSegments.push(replacement.arithmeticExpression);
		previousIndex = replacement.lastIndex;
	}
	replacementSegments.push(originalExpression.substring(previousIndex, originalExpression.length));
	var evaluatedExpression = replacementSegments.join("");
	return evaluatedExpression;
};

// utility
// combine other calls,
// return a string
Adj.doVarsIdsArithmetic = function doVarsIdsArithmetic (element, originalExpression, usedHow, variableSubstitutionsByName, idedElementRecordsById) {
	var withVariablesSubstituted = Adj.substituteVariables(element, originalExpression, usedHow, variableSubstitutionsByName);
	var withIdsResolved = Adj.resolveIdArithmetic(element, withVariablesSubstituted, usedHow, idedElementRecordsById);
	var withArithmeticEvaluated = Adj.evaluateArithmetic(withIdsResolved, usedHow);
	return withArithmeticEvaluated;
};

// utility
// combine other calls,
// return a number
Adj.doVarsIdsArithmeticToGetNumber = function doVarsIdsArithmeticToGetNumber (element, originalExpression, defaultValue, usedHow, variableSubstitutionsByName, idedElementRecordsById) {
	if (typeof originalExpression === "number") { // a number already
		return originalExpression;
	}
	if (!originalExpression) { // e.g. undefined
		return defaultValue;
	}
	var withArithmeticEvaluated = Adj.doVarsIdsArithmetic(element, originalExpression, usedHow, variableSubstitutionsByName, idedElementRecordsById);
	var number = parseFloat(withArithmeticEvaluated);
	if (isNaN(number)) {
		throw "expression \"" + originalExpression + "\" does not evaluate to a number (\"" + withArithmeticEvaluated + "\") " + usedHow;
	}
	return number;
};

// utility
// combine other calls,
// return a string
Adj.doVarsArithmetic2 = function doVarsArithmetic2 (element, originalExpression, usedHow, variableSubstitutionsByName) {
	var withVariablesSubstituted = Adj.substituteVariables(element, originalExpression, usedHow, variableSubstitutionsByName);
	var withArithmeticEvaluated = Adj.evaluateArithmetic(withVariablesSubstituted, usedHow);
	return withArithmeticEvaluated;
};

// utility
// combine other calls,
// return a number
Adj.doVarsArithmetic = function doVarsArithmetic (element, originalExpression, defaultValue, constantsByName, usedHow, variableSubstitutionsByName) {
	if (typeof originalExpression === "number") { // a number already
		return originalExpression;
	}
	if (!originalExpression) { // e.g. undefined
		return defaultValue;
	}
	if (constantsByName) { // e.g. Adj.leftCenterRight
		var constantValue = constantsByName[originalExpression];
		if (constantValue != undefined) {
			return constantValue;
		}
	}
	var withVariablesSubstituted = Adj.substituteVariables(element, originalExpression, usedHow, variableSubstitutionsByName);
	var withArithmeticEvaluated = Adj.evaluateArithmetic(withVariablesSubstituted, usedHow);
	var number = parseFloat(withArithmeticEvaluated);
	if (isNaN(number)) {
		throw "expression \"" + originalExpression + "\" does not evaluate to a number (\"" + withArithmeticEvaluated + "\") " + usedHow;
	}
	return number;
};

// utility
// combine other calls,
// return a boolean
Adj.doVarsBoolean = function doVarsBoolean (element, originalExpression, defaultValue, usedHow, variableSubstitutionsByName) {
	if (typeof originalExpression === "boolean") { // a number already
		return originalExpression;
	}
	if (!originalExpression) { // e.g. undefined
		return defaultValue;
	}
	var withVariablesSubstituted = Adj.substituteVariables(element, originalExpression, usedHow, variableSubstitutionsByName);
	var booleanMatch = Adj.booleanRegexp.exec(withVariablesSubstituted);
	if (booleanMatch) {
		// strict spelling of booleans
		var booleanString = booleanMatch[1];
		switch (booleanString) {
			case "true":
				return true;
			case "false":
				return false;
			default:
		}
	}
	throw "expression \"" + originalExpression + "\" does not evaluate to a boolean (\"" + withVariablesSubstituted + "\") " + usedHow;
};

// a specific algorithm
// note: as implemented works for path
Adj.defineCommandForAlgorithm({
	algorithmName: "vine",
	notAnOrder1Element: true,
	phaseHandlerNames: ["adjPhase7Up"],
	parameters: ["explain"],
	methods: [function vine (element, parametersObject) {
		var usedHow = "used in a parameter for a vine command";
		var variableSubstitutionsByName = {};
		var idedElementRecordsById = {};
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		Adj.unhideByDisplayAttribute(element);
		//
		// differentiate simplified cases
		if (element instanceof SVGPathElement) {
			// an SVG path
			// first time store if first time
			Adj.firstTimeStoreAuthoringCoordinates(element);
			//
			var authoringD = Adj.elementGetAttributeInAdjNS(element, "d") || "";
			var dWithArithmeticEvaluated = Adj.doVarsIdsArithmetic(element, authoringD, "used in attribute adj:d= for a path element", variableSubstitutionsByName, idedElementRecordsById);
			//
			element.setAttribute("d", dWithArithmeticEvaluated);
		} // else { // not a known case, as implemented not transformed
		//
		// explain
		if (explain) {
			if (element instanceof SVGPathElement) {
				// an SVG path
				if (Adj.getPhaseHandlersForElementForAlgorithmName(element, "explain").length === 0) {
					Adj.explainBasicGeometry(element);
				} // else { // don't explain twice
			} // else { // not a known case, as implemented
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "floater",
	notAnOrder1Element: true,
	phaseHandlerNames: ["adjPhase3"],
	processSubtreeOnlyInPhaseHandler: "adjPhase3",
	parameters: ["at",
				 "pin",
				 "explain"],
	methods: [function floater (element, parametersObject, level) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a floater command";
		var variableSubstitutionsByName = {};
		var idedElementRecordsById = {};
		//
		Adj.unhideByDisplayAttribute(element);
		//
		var at = parametersObject.at ? parametersObject.at.toString() : ""; // without toString could get number
		if (!at) {
			throw "missing parameter at= for a floater command";
		}
		var atWithArithmeticEvaluated = Adj.doVarsIdsArithmetic(element, at, "used in parameter at= for a floater command", variableSubstitutionsByName, idedElementRecordsById);
		var atMatch = Adj.twoRegexp.exec(atWithArithmeticEvaluated);
		if (!atMatch) {
			throw "impossible parameter at=\"" + at + "\" for a floater command";
		}
		var atX = parseFloat(atMatch[1]);
		var atY = parseFloat(atMatch[2]);
		//
		var pinMatch = Adj.twoRegexp.exec(parametersObject.pin || "");
		var hFraction = pinMatch ? parseFloat(pinMatch[1]) : 0.5; // default hFraction = 0.5
		var vFraction = pinMatch ? parseFloat(pinMatch[2]) : 0.5; // default vFraction = 0.5
		//
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		Adj.processElementWithPhaseHandlers(element, true, level); // process subtree separately, i.e. now
		//
		var boundingBox = element.getBBox();
		var pinX = boundingBox.x + Adj.fraction(0, boundingBox.width, hFraction);
		var pinY = boundingBox.y + Adj.fraction(0, boundingBox.height, vFraction);
		//
		// now put it there
		var translationX = atX - pinX;
		var translationY = atY - pinY;
		element.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
		//
		// explain
		if (explain) {
			var parent = element.parentNode;
			var elementTransformAttribute = element.getAttribute("transform");
			var explanationElement = Adj.createExplanationElement(parent, "rect");
			explanationElement.setAttribute("x", Adj.decimal(boundingBox.x));
			explanationElement.setAttribute("y", Adj.decimal(boundingBox.y));
			explanationElement.setAttribute("width", Adj.decimal(boundingBox.width));
			explanationElement.setAttribute("height", Adj.decimal(boundingBox.height));
			explanationElement.setAttribute("transform", elementTransformAttribute);
			explanationElement.setAttribute("fill", "blue");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "blue");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			parent.appendChild(explanationElement);
			//
			var explanationElement = Adj.createExplanationPointCircle(parent, pinX, pinY, "blue");
			explanationElement.setAttribute("transform", elementTransformAttribute);
			parent.appendChild(explanationElement);
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "fit",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["maxWidth", "maxHeight",
				 "width", "height"],
	methods: [function fit (element, parametersObject) {
		var usedHow = "used in a parameter for a fit command";
		var variableSubstitutionsByName = {};
		var idedElementRecordsById = {};
		//
		var width = Adj.doVarsIdsArithmeticToGetNumber(element, parametersObject.width, null, usedHow, variableSubstitutionsByName, idedElementRecordsById); // default width = null
		var height = Adj.doVarsIdsArithmeticToGetNumber(element, parametersObject.height, null, usedHow, variableSubstitutionsByName, idedElementRecordsById); // default height = null
		var maxWidth = Adj.doVarsIdsArithmeticToGetNumber(element, parametersObject.maxWidth, null, usedHow, variableSubstitutionsByName, idedElementRecordsById); // default maxWidth = null
		var maxHeight = Adj.doVarsIdsArithmeticToGetNumber(element, parametersObject.maxHeight, null, usedHow, variableSubstitutionsByName, idedElementRecordsById); // default maxHeight = null
		//
		var boundingBox = element.getBBox();
		var boundingBoxWidth = boundingBox.width;
		var boundingBoxHeight = boundingBox.height;
		var hScale = null;
		var vScale = null;
		if (width != null) {
			hScale = width / boundingBoxWidth;
		}
		if (height != null) {
			vScale = height / boundingBoxHeight;
		}
		var scale;
		if (hScale != null) {
			if (vScale != null) {
				scale = Math.min(hScale, vScale);
			} else {
				scale = hScale;
			}
		} else {
			if (vScale != null) {
				scale = vScale;
			} else {
				scale = 1;
			}
		}
		var wouldBeWidth = scale * boundingBoxWidth;
		if (maxWidth != null) {
			if (wouldBeWidth > maxWidth) {
				scale = scale * maxWidth / wouldBeWidth;
			}
		}
		var wouldBeHeight = scale * boundingBoxHeight;
		if (maxHeight != null) {
			if (wouldBeHeight > maxHeight) {
				scale = scale * maxHeight / wouldBeHeight;
			}
		}
		element.setAttribute("transform", "scale(" + Adj.decimal(scale) + ")");
	}]
});

// utility for use inside algorithms
Adj.explainBasicGeometry = function explainBasicGeometry (element) {
	var ownerDocument = element.ownerDocument;
	var theSvgElement = element.ownerSVGElement || element;
	//
	var parent = element.parentNode;
	var explanationGElement = Adj.createExplanationElement(parent, "g");
	// by now the necessary transform should be known
	var transform = element.getAttribute("transform");
	if (transform) {
		explanationGElement.setAttribute("transform", transform);
	}
	parent.appendChild(explanationGElement);
	if (element instanceof SVGPathElement) {
		// an SVG path
		var explainPathData = element.getAttribute("d");
		var explanationElement = Adj.createExplanationElement(explanationGElement, "path");
		explanationElement.setAttribute("d", explainPathData);
		explanationElement.setAttribute("fill", "none");
		explanationElement.setAttribute("fill-opacity", "0.1");
		explanationElement.setAttribute("stroke", "blue");
		explanationElement.setAttribute("stroke-width", "1");
		explanationElement.setAttribute("stroke-opacity", "0.2");
		explanationGElement.appendChild(explanationElement);
		//
		// get static base values as floating point values, before animation
		var pathSegList = element.pathSegList;
		var numberOfPathSegs = pathSegList.numberOfItems;
		var numberOfLastPathSeg = numberOfPathSegs - 1;
		var coordinates = theSvgElement.createSVGPoint();
		var initialCoordinates = theSvgElement.createSVGPoint(); // per sub-path
		var controlPoint = theSvgElement.createSVGPoint();
		for (var index = 0; index < numberOfPathSegs; index++) {
			var pathSeg = pathSegList.getItem(index);
			var pathSegTypeAsLetter = pathSeg.pathSegTypeAsLetter;
			var pointCircleFill = index <= 0 ? "green" : index < numberOfLastPathSeg ? "blue" : "red";
			switch (pathSegTypeAsLetter) {
				case 'Z':  // closepath
				case 'z':
					coordinates.x = initialCoordinates.x;
					coordinates.y = initialCoordinates.y;
					break;
				case 'M': // moveto, absolute
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					initialCoordinates.x = coordinates.x;
					initialCoordinates.y = coordinates.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'm': // moveto, relative
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					initialCoordinates.x = coordinates.x;
					initialCoordinates.y = coordinates.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'L': // lineto, absolute
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'l': // lineto, relative
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'H': // horizontal lineto, absolute
					coordinates.x = pathSeg.x;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'h': // horizontal lineto, relative
					coordinates.x += pathSeg.x;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'V': // vertical lineto, absolute
					coordinates.y = pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'v': // vertical lineto, relative
					coordinates.y += pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'C': // cubic Bézier curveto, absolute
					controlPoint.x = pathSeg.x1;
					controlPoint.y = pathSeg.y1;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					controlPoint.x = pathSeg.x2;
					controlPoint.y = pathSeg.y2;
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'c': // cubic Bézier curveto, relative
					controlPoint.x = coordinates.x + pathSeg.x1;
					controlPoint.y = coordinates.y + pathSeg.y1;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					controlPoint.x = coordinates.x + pathSeg.x2;
					controlPoint.y = coordinates.y + pathSeg.y2;
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'S': // smooth cubic curveto, absolute
					controlPoint.x = 2 * coordinates.x - controlPoint.x;
					controlPoint.y = 2 * coordinates.y - controlPoint.y;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					controlPoint.x = pathSeg.x2;
					controlPoint.y = pathSeg.y2;
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 's': // smooth cubic curveto, relative
					controlPoint.x = 2 * coordinates.x - controlPoint.x;
					controlPoint.y = 2 * coordinates.y - controlPoint.y;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					controlPoint.x = coordinates.x + pathSeg.x2;
					controlPoint.y = coordinates.y + pathSeg.y2;
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'Q': // quadratic Bézier curveto, absolute
					controlPoint.x = pathSeg.x1;
					controlPoint.y = pathSeg.y1;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'q': // quadratic Bézier curveto, relative
					controlPoint.x = coordinates.x + pathSeg.x1;
					controlPoint.y = coordinates.y + pathSeg.y1;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'T': // smooth quadratic curveto, absolute
					controlPoint.x = 2 * coordinates.x - controlPoint.x;
					controlPoint.y = 2 * coordinates.y - controlPoint.y;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 't': // smooth quadratic curveto, relative
					controlPoint.x = 2 * coordinates.x - controlPoint.x;
					controlPoint.y = 2 * coordinates.y - controlPoint.y;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, controlPoint.x, controlPoint.y, "blue"));
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationLine(explanationGElement, controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'A': // elliptical arc, absolute
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'a': // elliptical arc, relative
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					explanationGElement.appendChild(Adj.createExplanationPointCircle(explanationGElement, coordinates.x, coordinates.y, pointCircleFill));
					break;
				default:
			}
		}
	}
};

// a specific algorithm
// note: as implemented works for path
Adj.defineCommandForAlgorithm({
	algorithmName: "explain",
	phaseHandlerNames: ["adjPhase7Up"],
	parameters: [],
	methods: [function explain (element, parametersObject) {
		// differentiate simplified cases
		if (element instanceof SVGPathElement) {
			// an SVG path
			Adj.explainBasicGeometry(element);
		} // else { // not a known case, as implemented
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "stackFrames",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["inset",
				 "horizontalInset", "leftInset", "rightInset",
				 "verticalInset", "topInset", "bottomInset",
				 "stacking", "frame", "subject"],
	methods: [function stackFrames (element, parametersObject) {
		var usedHow = "used in a parameter for a stackFrames command";
		var variableSubstitutionsByName = {};
		var inset = Adj.doVarsArithmetic(element, parametersObject.inset, 0.5, null, usedHow, variableSubstitutionsByName); // default inset = 0.5
		var horizontalInset = Adj.doVarsArithmetic(element, parametersObject.horizontalInset, inset, null, usedHow, variableSubstitutionsByName); // default horizontalInset = inset
		var leftInset = Adj.doVarsArithmetic(element, parametersObject.leftInset, horizontalInset, null, usedHow, variableSubstitutionsByName); // default leftInset = horizontalInset
		var rightInset = Adj.doVarsArithmetic(element, parametersObject.rightInset, horizontalInset, null, usedHow, variableSubstitutionsByName); // default rightInset = horizontalInset
		var verticalInset = Adj.doVarsArithmetic(element, parametersObject.verticalInset, inset, null, usedHow, variableSubstitutionsByName); // default verticalInset = inset
		var topInset = Adj.doVarsArithmetic(element, parametersObject.topInset, verticalInset, null, usedHow, variableSubstitutionsByName); // default topInset = verticalInset
		var bottomInset = Adj.doVarsArithmetic(element, parametersObject.bottomInset, verticalInset, null, usedHow, variableSubstitutionsByName); // default bottomInset = verticalInset
		//
		var stacking = parametersObject.stacking ? parametersObject.stacking.toString() : ""; // without toString could get number
		if (!stacking) {
			throw "missing parameter stacking= for a stackFrames command";
		}
		var stackingWithArithmeticEvaluated = Adj.doVarsArithmetic2(element, stacking, "used in parameter stacking= for a stackFrames command", variableSubstitutionsByName);
		var stackingMatch = Adj.threeRegexp.exec(stackingWithArithmeticEvaluated);
		if (!stackingMatch) {
			throw "impossible parameter stacking=\"" + stacking + "\" for a stackFrames command";
		}
		var stackingN = parseInt(stackingMatch[1]);
		var stackingX = parseFloat(stackingMatch[2]);
		var stackingY = parseFloat(stackingMatch[3]);
		if (stackingN < 1) {
			stackingN = 1;
		}
		//
		var frame = !isNaN(parametersObject.frame) ? parametersObject.frame : 0; // default frame = 0
		var subject = !isNaN(parametersObject.subject) ? parametersObject.subject : frame + 1; // default subject = frame + 1
		//
		// determine which nodes are frame template and subject respectively
		for (var child = element.firstChild, index = 0; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (child.adjNotAnOrder1Element) { // e.g. a rider, or a floater
				continue;
			}
			if (child.adjExplanationArtifact) {
				continue;
			}
			if (index === frame) {
				frame = child; // now an SVGElement instead of a number
			}
			if (index === subject) {
				subject = child; // now an SVGElement instead of a number
			}
			index++;
		}
		if (!(frame instanceof SVGElement)) { // maybe childRecords.length === 0
			return; // defensive exit
		}
		if (!(subject instanceof SVGElement)) { // maybe childRecords.length === 0
			return; // defensive exit
		}
		//
		var subjectBoundingBox = subject.getBBox();
		frame.setAttribute("x", Adj.decimal(subjectBoundingBox.x + leftInset));
		frame.setAttribute("y", Adj.decimal(subjectBoundingBox.y + topInset));
		frame.setAttribute("width", Adj.decimal(subjectBoundingBox.width - leftInset - rightInset));
		frame.setAttribute("height", Adj.decimal(subjectBoundingBox.height - topInset - bottomInset));
		frame.removeAttribute("transform");
		for (var i = stackingN - 1; i > 0; i--) { // needs new elements
			var clonedFrame = Adj.cloneArtifactElement(frame);
			clonedFrame.setAttribute("transform", "translate(" + Adj.decimal(i * stackingX) + "," + Adj.decimal(i * stackingY) + ")");
			element.insertBefore(clonedFrame, frame);
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "zoomFrames",
	notAnOrder1Element: true,
	phaseHandlerNames: ["adjPhase5Down"],
	parameters: ["from", "to",
				 "step"],
	methods: [function zoomFrames (element, parametersObject) {
		var theSvgElement = element.ownerSVGElement || element;
		//
		var usedHow = "used in a parameter for a zoomFrames command";
		var variableSubstitutionsByName = {};
		var fromId = parametersObject.from;
		var toId = parametersObject.to;
		var step = Adj.doVarsArithmetic(element, parametersObject.step, 10, null, usedHow, variableSubstitutionsByName); // default step = 10
		//
		var parent = element.parentNode;
		var fromElement;
		if (fromId) { // from id given
			fromElement = Adj.getElementByIdNearby(fromId, element);
			if (!fromElement) {
				throw "nonresolving id \"" + fromId + "\" used in parameter from= for a zoomFrames command";
			}
		} else { // no from id given
			// find previous sibling
			for (var sibling = parent.firstChild, index = 0, couldBeIt; sibling; sibling = sibling.nextSibling) {
				if (sibling === element) { // at element self
					fromElement = couldBeIt; // found it
					break; // findPreviousSiblingLoop
				}
				if (!(sibling instanceof SVGElement)) {
					continue; // skip if not an SVGElement, e.g. an XML #text
				}
				if (!sibling.getBBox) {
					continue; // skip if not an SVGLocatable, e.g. a <script> element
				}
				if (sibling.adjNotAnOrder1Element) {
					continue; // skip in case a rider is first
				}
				couldBeIt = sibling;
			}
			if (!fromElement) {
				throw "missing parameter from= for a zoomFrames command";
			}
		}
		var toElement;
		if (toId) { // to id given
			toElement = Adj.getElementByIdNearby(toId, element);
			if (!toElement) {
				throw "nonresolving id \"" + toId + "\" used in parameter to= for a zoomFrames command";
			}
		} else { // no to id given
			// find next sibling
			for (var sibling = parent.firstChild, index = 0, nextOneIsIt; sibling; sibling = sibling.nextSibling) {
				if (sibling === element) { // at element self
					nextOneIsIt = true;
					continue; // next one will be it
				}
				if (!(sibling instanceof SVGElement)) {
					continue; // skip if not an SVGElement, e.g. an XML #text
				}
				if (!sibling.getBBox) {
					continue; // skip if not an SVGLocatable, e.g. a <script> element
				}
				if (sibling.adjNotAnOrder1Element) {
					continue; // skip in case a rider is first
				}
				if (nextOneIsIt) {
					toElement = sibling; // found it
					break; // findNextSiblingLoop
				}
			}
			if (!toElement) {
				throw "missing parameter to= for a zoomFrames command";
			}
		}
		//
		Adj.unhideByDisplayAttribute(element);
		//
		var fromBoundingBox = fromElement.getBBox();
		var matrixFromFromElement = fromElement.getTransformToElement(element);
		var fromTopLeft = theSvgElement.createSVGPoint();
		fromTopLeft.x = fromBoundingBox.x;
		fromTopLeft.y = fromBoundingBox.y;
		fromTopLeft = fromTopLeft.matrixTransform(matrixFromFromElement);
		var fromTopRight = theSvgElement.createSVGPoint();
		fromTopRight.x = fromBoundingBox.x + fromBoundingBox.width;
		fromTopRight.y = fromBoundingBox.y;
		fromTopRight = fromTopRight.matrixTransform(matrixFromFromElement);
		var fromBottomLeft = theSvgElement.createSVGPoint();
		fromBottomLeft.x = fromBoundingBox.x;
		fromBottomLeft.y = fromBoundingBox.y + fromBoundingBox.height;
		fromBottomLeft = fromBottomLeft.matrixTransform(matrixFromFromElement);
		var fromBottomRight = theSvgElement.createSVGPoint();
		fromBottomRight.x = fromBoundingBox.x + fromBoundingBox.width;
		fromBottomRight.y = fromBoundingBox.y + fromBoundingBox.height;
		fromBottomRight = fromBottomRight.matrixTransform(matrixFromFromElement);
		//
		var toBoundingBox = toElement.getBBox();
		var matrixFromToElement = toElement.getTransformToElement(element);
		var toTopLeft = theSvgElement.createSVGPoint();
		toTopLeft.x = toBoundingBox.x;
		toTopLeft.y = toBoundingBox.y;
		toTopLeft = toTopLeft.matrixTransform(matrixFromToElement);
		var toTopRight = theSvgElement.createSVGPoint();
		toTopRight.x = toBoundingBox.x + toBoundingBox.width;
		toTopRight.y = toBoundingBox.y;
		toTopRight = toTopRight.matrixTransform(matrixFromToElement);
		var toBottomLeft = theSvgElement.createSVGPoint();
		toBottomLeft.x = toBoundingBox.x;
		toBottomLeft.y = toBoundingBox.y + toBoundingBox.height;
		toBottomLeft = toBottomLeft.matrixTransform(matrixFromToElement);
		var toBottomRight = theSvgElement.createSVGPoint();
		toBottomRight.x = toBoundingBox.x + toBoundingBox.width;
		toBottomRight.y = toBoundingBox.y + toBoundingBox.height;
		toBottomRight = toBottomRight.matrixTransform(matrixFromToElement);
		//
		Adj.hideByDisplayAttribute(element);
		//
		var deltaTopLeft = Math.sqrt(Math.pow(toTopLeft.x - fromTopLeft.x, 2) + Math.pow(toTopLeft.y - fromTopLeft.y, 2));
		var deltaTopRight = Math.sqrt(Math.pow(toTopRight.x - fromTopRight.x, 2) + Math.pow(toTopRight.y - fromTopRight.y, 2));
		var deltaBottomLeft = Math.sqrt(Math.pow(toBottomLeft.x - fromBottomLeft.x, 2) + Math.pow(toBottomLeft.y - fromBottomLeft.y, 2));
		var deltaBottomRight = Math.sqrt(Math.pow(toBottomRight.x - fromBottomRight.x, 2) + Math.pow(toBottomRight.y - fromBottomRight.y, 2));
		var delta = (deltaTopLeft + deltaTopRight + deltaBottomLeft + deltaBottomRight) / 4;
		//
		if (step < 1) {
			step = 1; // for stability, a defensive check rather than risk an exception
		}
		var steps = Math.floor(delta / step); // integer
		if (steps > 1000) {
			steps = 1000; // a defensive limit
		}
		var firstStepFraction;
		var stepFraction;
		if (steps > 1) { // normal case
			firstStepFraction = (delta - (steps - 1) * step) / 2 / delta;
			stepFraction = step / delta;
		} else { // special case
			steps = 1;
			firstStepFraction = 0.5;
			stepFraction = 0;
		}
		//
		var fromX = fromTopLeft.x;
		var fromY = fromTopLeft.y;
		var fromW = fromTopRight.x - fromTopLeft.x;
		var fromH = fromBottomLeft.y - fromTopLeft.y;
		var toX = toTopLeft.x;
		var toY = toTopLeft.y;
		var toW = toTopRight.x - toTopLeft.x;
		var toH = toBottomLeft.y - toTopLeft.y;
		//
		var fraction = firstStepFraction;
		element.setAttribute("x", Adj.decimal(Adj.fraction(fromX, toX, fraction)));
		element.setAttribute("y", Adj.decimal(Adj.fraction(fromY, toY, fraction)));
		element.setAttribute("width", Adj.decimal(Adj.fraction(fromW, toW, fraction)));
		element.setAttribute("height", Adj.decimal(Adj.fraction(fromH, toH, fraction)));
		element.removeAttribute("transform");
		var nextSibling = element.nextSibling;
		for (var i = 1; i < steps; i++) { // needs new elements
			fraction = firstStepFraction + i * stepFraction;
			var clonedElement = Adj.cloneArtifactElement(element, false);
			clonedElement.adjNotAnOrder1Element = true;
			clonedElement.setAttribute("x", Adj.decimal(Adj.fraction(fromX, toX, fraction)));
			clonedElement.setAttribute("y", Adj.decimal(Adj.fraction(fromY, toY, fraction)));
			clonedElement.setAttribute("width", Adj.decimal(Adj.fraction(fromW, toW, fraction)));
			clonedElement.setAttribute("height", Adj.decimal(Adj.fraction(fromH, toH, fraction)));
			parent.insertBefore(clonedElement, nextSibling);
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "tilt",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["alpha", "beta"],
	methods: [function tilt (element, parametersObject) {
		var theSvgElement = element.ownerSVGElement || element;
		//
		var usedHow = "used in a parameter for a tilt command";
		var variableSubstitutionsByName = {};
		var alpha = Adj.doVarsArithmetic(element, parametersObject.alpha, 30, null, usedHow, variableSubstitutionsByName); // default alpha = 30
		var beta = Adj.doVarsArithmetic(element, parametersObject.beta, 0, null, usedHow, variableSubstitutionsByName); // default beta = 0
		//
		alpha = alpha * Math.PI / 180;
		beta = beta * Math.PI / 180;
		var matrix = theSvgElement.createSVGMatrix();
		matrix.a = Math.cos(alpha);
		matrix.b = Math.sin(alpha);
		matrix.c = -Math.sin(beta);
		matrix.d = Math.cos(beta);
		Adj.setAttributeTransformMatrix(element, matrix);
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "skimpyList",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["gap",
				 "horizontalGap", "leftGap", "rightGap",
				 "verticalGap", "topGap", "bottomGap"],
	methods: [function skimpyList (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a skimpyList command";
		var variableSubstitutionsByName = {};
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 3, null, usedHow, variableSubstitutionsByName); // default gap = 3
		var horizontalGap = Adj.doVarsArithmetic(element, parametersObject.horizontalGap, gap, null, usedHow, variableSubstitutionsByName); // default horizontalGap = gap
		var leftGap = Adj.doVarsArithmetic(element, parametersObject.leftGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default leftGap = horizontalGap
		var rightGap = Adj.doVarsArithmetic(element, parametersObject.rightGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default rightGap = horizontalGap
		var verticalGap = Adj.doVarsArithmetic(element, parametersObject.verticalGap, gap, null, usedHow, variableSubstitutionsByName); // default verticalGap = gap
		var topGap = Adj.doVarsArithmetic(element, parametersObject.topGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default topGap = verticalGap
		var bottomGap = Adj.doVarsArithmetic(element, parametersObject.bottomGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default bottomGap = verticalGap
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping hiddenRect and skipping notAnOrder1Element
		var hiddenRect;
		var childRecords = [];
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			if (child.adjHiddenByCommand) {
				continue;
			}
			childRecords.push({
				boundingBox: child.getBBox(),
				node: child
			});
		}
		//
		// process
		var minLeft = undefined;
		var minTop = undefined;
		var maxRight = undefined;
		var maxBottom = undefined;
		childRecordsLoop: for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var childBoundingBox = childRecord.boundingBox;
			var currentChildX = childBoundingBox.x;
			var currentChildY = childBoundingBox.y;
			var currentChildXW = currentChildX + childBoundingBox.width;
			var currentChildYH = currentChildY + childBoundingBox.height;
			if (minLeft != undefined) {
				if (currentChildX < minLeft) {
					minLeft = currentChildX;
				}
			} else {
				minLeft = currentChildX;
			}
			if (minTop != undefined) {
				if (currentChildY < minTop) {
					minTop = currentChildY;
				}
			} else {
				minTop = currentChildY;
			}
			if (maxRight != undefined) {
				if (currentChildXW > maxRight) {
					maxRight = currentChildXW;
				}
			} else {
				maxRight = currentChildXW;
			}
			if (maxBottom != undefined) {
				if (currentChildYH > maxBottom) {
					maxBottom = currentChildYH;
				}
			} else {
				maxBottom = currentChildYH;
			}
		}
		minLeft = minLeft || 0;
		minTop = minTop || 0;
		maxRight = maxRight || 0;
		maxBottom = maxBottom || 0;
		minLeft -= leftGap;
		minTop -= topGap;
		maxRight += rightGap;
		maxBottom += bottomGap;
		// now we know where to put it
		var translationX = -minLeft;
		var translationY = -minTop;
		childRecordsLoop: for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			child.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
		}
		//
		// size the hidden rect for having a good bounding box when from a level up this element's getBBox() gets called
		if (hiddenRect) {
			hiddenRect.setAttribute("x", 0);
			hiddenRect.setAttribute("y", 0);
			hiddenRect.setAttribute("width", Adj.decimal(maxRight - minLeft));
			hiddenRect.setAttribute("height", Adj.decimal(maxBottom - minTop));
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "pinnedList",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["gap",
				 "horizontalGap", "leftGap", "rightGap",
				 "verticalGap", "topGap", "bottomGap"],
	methods: [function pinnedList (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		var theSvgElement = element.ownerSVGElement || element;
		//
		var usedHow = "used in a parameter for a pinnedList command";
		var variableSubstitutionsByName = {};
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 3, null, usedHow, variableSubstitutionsByName); // default gap = 3
		var horizontalGap = Adj.doVarsArithmetic(element, parametersObject.horizontalGap, gap, null, usedHow, variableSubstitutionsByName); // default horizontalGap = gap
		var leftGap = Adj.doVarsArithmetic(element, parametersObject.leftGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default leftGap = horizontalGap
		var rightGap = Adj.doVarsArithmetic(element, parametersObject.rightGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default rightGap = horizontalGap
		var verticalGap = Adj.doVarsArithmetic(element, parametersObject.verticalGap, gap, null, usedHow, variableSubstitutionsByName); // default verticalGap = gap
		var topGap = Adj.doVarsArithmetic(element, parametersObject.topGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default topGap = verticalGap
		var bottomGap = Adj.doVarsArithmetic(element, parametersObject.bottomGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default bottomGap = verticalGap
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping hiddenRect and skipping notAnOrder1Element
		var hiddenRect;
		var childRecords = [];
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			if (child.adjHiddenByCommand) {
				continue;
			}
			childRecords.push({
				boundingBox: child.getBBox(),
				node: child
			});
		}
		//
		// process
		var minLeft = undefined;
		var minTop = undefined;
		var maxRight = undefined;
		var maxBottom = undefined;
		var placedYetChilds = [];
		childRecordsLoop: for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var childBoundingBox = childRecord.boundingBox;
			var child = childRecord.node;
			var childIndex = childRecord.index;
			//
			var currentChildX = childBoundingBox.x;
			var currentChildY = childBoundingBox.y;
			var currentChildXW = currentChildX + childBoundingBox.width;
			var currentChildYH = currentChildY + childBoundingBox.height;
			//
			var pinThisParameter = Adj.elementGetAttributeInAdjNS(child, "pinThis");
			var pinToParameter = Adj.elementGetAttributeInAdjNS(child, "pinTo");
			if (pinThisParameter || pinToParameter) { // this child to be pinned
				if (childRecordIndex < 1) {
					throw "cannot pin first element inside a pinnedList";
				}
				var pinThisElement;
				var pinThisX;
				var pinThisY;
				var pinToElement;
				var pinToX;
				var pinToY;
				var childLevel = Adj.elementLevel(child);
				var pinThisSibling;
				if (pinThisParameter) {
					var pinThisMatch = Adj.idXYRegexp.exec(pinThisParameter);
					var pinThisId = pinThisMatch[1];
					pinThisX = pinThisMatch[2] ? parseFloat(pinThisMatch[2]) : 0.5; // default pinThisX = 0.5
					pinThisY = pinThisMatch[3] ? parseFloat(pinThisMatch[3]) : 0.0; // default pinThisY = 0.0
					pinThisElement = Adj.getElementByIdNearby(pinThisId, child);
					if (!pinThisElement) {
						throw "nonresolving id \"" + pinThisId + "\" used in attribute adj:pinThis= of an element inside a pinnedList";
					}
					var pinThisElementLevel = Adj.elementLevel(pinThisElement);
					pinThisSibling = pinThisElement;
					for (var l = pinThisElementLevel; l > childLevel; l--) {
						pinThisSibling = pinThisSibling.parentNode;
					}
					if (pinThisSibling != child) {
						throw "non-contained id \"" + pinThisId + "\" used in attribute adj:pinThis= of an element inside a pinnedList";
					}
				} else {
					pinThisSibling = pinThisElement = child; // default this child itself
					pinThisX = 0.5; // default pinThisX = 0.5
					pinThisY = 0.0; // default pinThisY = 0.0
				}
				var pinToSibling;
				if (pinToParameter) {
					var pinToMatch = Adj.idXYRegexp.exec(pinToParameter);
					var pinToId = pinToMatch[1];
					pinToX = pinToMatch[2] ? parseFloat(pinToMatch[2]) : 0.5; // default pinToX = 0.5
					pinToY = pinToMatch[3] ? parseFloat(pinToMatch[3]) : 1.0; // default pinToY = 1.0
					pinToElement = Adj.getElementByIdNearby(pinToId, child);
					if (!pinToElement) {
						throw "nonresolving id \"" + pinToId + "\" used in attribute adj:pinTo= of an element inside a pinnedList";
					}
					var pinToElementLevel = Adj.elementLevel(pinToElement);
					pinToSibling = pinToElement;
					for (var l = pinToElementLevel; l > childLevel; l--) {
						pinToSibling = pinToSibling.parentNode;
					}
					var pinToSiblingIndex = placedYetChilds.indexOf(pinToSibling);
					if (pinToSiblingIndex === -1) {
						throw "non-preceding id \"" + pinToId + "\" used in attribute adj:pinTo= of an element inside a pinnedList";
					}
				} else {
					pinToSibling = pinToElement = childRecords[childRecordIndex - 1]; // default previous child
					pinToX = 0.5; // default pinToX = 0.5
					pinToY = 1.0; // default pinToY = 1.0
				}
				//
				var pinToBoundingBox = pinToElement.getBBox();
				var matrixFromPinToElement = pinToElement.getTransformToElement(pinToSibling);
				var pinToPoint = theSvgElement.createSVGPoint();
				pinToPoint.x = pinToBoundingBox.x + pinToBoundingBox.width * pinToX;
				pinToPoint.y = pinToBoundingBox.y + pinToBoundingBox.height * pinToY;
				pinToPoint = pinToPoint.matrixTransform(matrixFromPinToElement);
				//
				var pinThisBoundingBox = pinThisElement.getBBox();
				var matrixFromPinThisElement = pinThisElement.getTransformToElement(pinThisSibling);
				var pinThisPoint = theSvgElement.createSVGPoint();
				pinThisPoint.x = pinThisBoundingBox.x + pinThisBoundingBox.width * pinThisX;
				pinThisPoint.y = pinThisBoundingBox.y + pinThisBoundingBox.height * pinThisY;
				pinThisPoint = pinThisPoint.matrixTransform(matrixFromPinThisElement);
				//
				var pinTranslationX = pinToPoint.x - pinThisPoint.x;
				var pinTranslationY = pinToPoint.y - pinThisPoint.y;
				childRecord.pinTranslationX = pinTranslationX;
				childRecord.pinTranslationY = pinTranslationY;
				childRecord.pinned = true;
				//
				currentChildX += pinTranslationX;
				currentChildY += pinTranslationY;
			}
			//
			if (minLeft != undefined) {
				if (currentChildX < minLeft) {
					minLeft = currentChildX;
				}
			} else {
				minLeft = currentChildX;
			}
			if (minTop != undefined) {
				if (currentChildY < minTop) {
					minTop = currentChildY;
				}
			} else {
				minTop = currentChildY;
			}
			if (maxRight != undefined) {
				if (currentChildXW > maxRight) {
					maxRight = currentChildXW;
				}
			} else {
				maxRight = currentChildXW;
			}
			if (maxBottom != undefined) {
				if (currentChildYH > maxBottom) {
					maxBottom = currentChildYH;
				}
			} else {
				maxBottom = currentChildYH;
			}
			placedYetChilds.push(child);
		}
		minLeft = minLeft || 0;
		minTop = minTop || 0;
		maxRight = maxRight || 0;
		maxBottom = maxBottom || 0;
		minLeft -= leftGap;
		minTop -= topGap;
		maxRight += rightGap;
		maxBottom += bottomGap;
		// now we know where to put it
		var translationX = -minLeft;
		var translationY = -minTop;
		childRecordsLoop: for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			if (childRecord.pinned) {
				child.setAttribute("transform", "translate(" + Adj.decimal(translationX + childRecord.pinTranslationX) + "," + Adj.decimal(translationY + childRecord.pinTranslationY) + ")");
			} else {
				child.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
			}
		}
		//
		// size the hidden rect for having a good bounding box when from a level up this element's getBBox() gets called
		if (hiddenRect) {
			hiddenRect.setAttribute("x", 0);
			hiddenRect.setAttribute("y", 0);
			hiddenRect.setAttribute("width", Adj.decimal(maxRight - minLeft));
			hiddenRect.setAttribute("height", Adj.decimal(maxBottom - minTop));
		}
	}]
});

// utility
// as implemented would loop infinitely on a circular reference, but is good enough for here
Adj.deepCloneObject = function deepCloneObject (object) {
	var clone = (object instanceof Array) ? [] : {};
	for (var i in object) {
		if (object[i] && typeof object[i] === "object") {
			clone[i] = Adj.deepCloneObject(object[i]);
		} else {
			clone[i] = object[i];
		}
	}
	return clone;
};

// utility
Adj.roundAway = function roundAway (number) {
	return number >= 0 ? Math.ceil(number) : Math.floor(number);
}

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "telescopicTree",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["gap",
				 "from", "to",
				 "explain"],
	methods: [function telescopicTree (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a telescopicTree command";
		var variableSubstitutionsByName = {};
		var idedElementRecordsById = {};
		var gap = Adj.doVarsIdsArithmeticToGetNumber(element, parametersObject.gap, 3, usedHow, variableSubstitutionsByName, idedElementRecordsById); // default gap = 3
		//
		var fromParameter = parametersObject.from;
		if (!fromParameter) {
			fromParameter = "";
		}
		var fromMatch = Adj.twoRegexp.exec(fromParameter);
		if (!fromMatch) {
			fromMatch = Adj.twoRegexpNoMatch;
		}
		var defaultFromX = fromMatch[1] ? parseFloat(fromMatch[1]) : 0.5; // default fromX = 0.5
		var defaultFromY = fromMatch[2] ? parseFloat(fromMatch[2]) : 0.5; // default fromY = 0.5
		var toParameter = parametersObject.to;
		if (!toParameter) {
			toParameter = "";
		}
		var toMatch = Adj.twoRegexp.exec(toParameter);
		if (!toMatch) {
			toMatch = Adj.twoRegexpNoMatch;
		}
		var defaultToX = toMatch[1] ? parseFloat(toMatch[1]) : 0.5; // default toX = 0.5
		var defaultToY = toMatch[2] ? parseFloat(toMatch[2]) : 0.5; // default toY = 0.5
		//
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping hiddenRect and skipping notAnOrder1Element
		var hiddenRect;
		// boom tells where child will be placed
		var currentBoomConfiguration = {
			// initial default boom
			from: { x: defaultFromX, y: defaultFromY },
			to: { x: defaultToX, y: defaultToY },
			angle: 0,
			gap: gap
		};
		var childRecords = [];
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (child instanceof Element) { // if an XML element, e.g. not an XML #text
				var childName = Adj.elementNameInAdjNS(child);
				if (childName) { // if an Adj element
					if (childName === "boom") {
						var boomParametersObject = Adj.collectParameters(child);
						var previousBoomConfiguration = currentBoomConfiguration;
						currentBoomConfiguration = {};
						//
						var boomUsedHow = "used in a parameter for a boom command";
						var boomFromParameter = boomParametersObject.from;
						if (!boomFromParameter) {
							boomFromParameter = "";
						}
						var boomFromMatch = Adj.idXYRegexp2.exec(boomFromParameter);
						if (!boomFromMatch) {
							boomFromMatch = Adj.idXYRegexp2NoMatch;
						}
						var boomFromId = boomFromMatch[1]; // if any
						var boomFromX = boomFromMatch[2] ? parseFloat(boomFromMatch[2]) : defaultFromX;
						var boomFromY = boomFromMatch[3] ? parseFloat(boomFromMatch[3]) : defaultFromY;
						currentBoomConfiguration.from = {
							id: boomFromId,
							x: boomFromX,
							y: boomFromY
						};
						// there is no boomToId
						var boomToParameter = boomParametersObject.to;
						if (!boomToParameter) {
							boomToParameter = "";
						}
						var boomToMatch = Adj.twoRegexp.exec(boomToParameter);
						if (!boomToMatch) {
							boomToMatch = Adj.twoRegexpNoMatch;
						}
						var boomToX = boomToMatch[1] ? parseFloat(boomToMatch[1]) : defaultToX;
						var boomToY = boomToMatch[2] ? parseFloat(boomToMatch[2]) : defaultToY;
						currentBoomConfiguration.to = {
							x: boomToX,
							y: boomToY
						};
						currentBoomConfiguration.angle = Adj.doVarsArithmetic(element, boomParametersObject.angle, previousBoomConfiguration.angle, Adj.eastSouthWestNorth, boomUsedHow, variableSubstitutionsByName); // boom angle could be a number, default boom angle 0 == previous boom angle
						currentBoomConfiguration.gap = Adj.doVarsIdsArithmeticToGetNumber(element, boomParametersObject.gap, gap, boomUsedHow, variableSubstitutionsByName, idedElementRecordsById); // default boom gap = telescopicTree gap
						//console.log(currentBoomConfiguration);
					}
				}
			}
			//
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			if (child.adjHiddenByCommand) {
				continue;
			}
			var childBoundingBox = child.getBBox();
			childBoundingBox.d = Math.sqrt(Math.pow(childBoundingBox.width, 2) + Math.pow(childBoundingBox.height, 2)); // diagonal
			childRecords.push({
				boomConfiguration: childRecords.length ? Adj.deepCloneObject(currentBoomConfiguration) : undefined, // undefined for rootRecord
				boundingBox: childBoundingBox,
				node: child,
				treeChildRecords: [],
				positioningBox: { // x and y relative to ancestor being processed, at first
					x: 0,
					y: 0,
					width: childBoundingBox.width,
					height: childBoundingBox.height,
					d: childBoundingBox.d
				}
			});
		}
		if (!childRecords.length) {
			return;
		}
		//
		// determine tree structure
		var idsDictionary = {};
		// resolve among DOM siblings only
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			var adjId = Adj.elementGetAttributeInAdjNS(child, "id"); // first check for preferred attribute adj:id
			if (adjId && !idsDictionary[adjId]) { // new
				idsDictionary[adjId] = childRecord;
			}
			var plainId = child.getAttribute("id"); // second check for acceptable attribute id
			if (plainId && !idsDictionary[plainId]) { // new
				idsDictionary[plainId] = childRecord;
			}
		}
		var rootRecord = childRecords[0];
		//console.log(rootRecord);
		var numberOfChildRecords = childRecords.length;
		for (var childRecordIndex = 1; childRecordIndex < numberOfChildRecords; childRecordIndex++) {
			var childRecord = childRecords[childRecordIndex];
			var boomConfiguration = childRecord.boomConfiguration;
			if (boomConfiguration) {
				var boomFrom = boomConfiguration.from;
				if (boomFrom) {
					var treeParentRecord;
					if (boomFrom.id) {
						treeParentRecord = idsDictionary[boomFrom.id]; // resolve
					} else {
						treeParentRecord = null;
					}
					if (!treeParentRecord) { // if not given then default
						treeParentRecord = childRecords[childRecordIndex - 1]; // previous in order
					}
					childRecord.treeParentRecord = treeParentRecord;
					treeParentRecord.treeChildRecords.push(childRecord);
				}
			}
			//console.log(childRecord);
		}
		//
		// walk tree structure
		// tree walking variables
		var currentSiblingRecords = [rootRecord];
		var currentSiblingRecordIndex = 0;
		var stack = [];
		var onWayBack = false;
		//
		// walk
		//console.log("walkTreeLoop1 starting");
		walkTreeLoop1: while (currentSiblingRecordIndex < currentSiblingRecords.length) {
			var currentChildRecord = currentSiblingRecords[currentSiblingRecordIndex];
			var treeChildRecords = currentChildRecord.treeChildRecords;
			var numberOfTreeChildren = treeChildRecords.length;
			var placeNow = false;
			//
			if (!onWayBack) {
				if (currentSiblingRecordIndex === 0) {
					//console.log("walkTreeLoop1 before first of siblings at level " + (stack.length + 1));
				}
				//console.log("walkTreeLoop1 on way there in node " + currentChildRecord.node + " node " + currentSiblingRecordIndex + " at level " + (stack.length + 1));
				//
				currentChildRecord.indexAsSibling = currentSiblingRecordIndex;
				currentChildRecord.branchRecords = [currentChildRecord];
				currentChildRecord.branchBox = Adj.deepCloneObject(currentChildRecord.positioningBox);
				//
				if (numberOfTreeChildren) {
					//console.log("walkTreeLoop1 on way there to children of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					stack.push( { siblingRecords: currentSiblingRecords, index: currentSiblingRecordIndex } );
					currentSiblingRecords = treeChildRecords;
					currentSiblingRecordIndex = 0;
					continue walkTreeLoop1;
				} else { // childless node, aka leaf
					//console.log("walkTreeLoop1 at childless node (leaf) " + currentChildRecord.node + " at level " + (stack.length + 1));
					//
					placeNow = true;
				}
			} else { // onWayBack
				//console.log("walkTreeLoop1 on way back in node " + currentChildRecord.node + " at level " + (stack.length + 1));
				//
				onWayBack = false;
				placeNow = true;
			}
			//
			if (placeNow) {
				var boomConfiguration = currentChildRecord.boomConfiguration;
				if (!boomConfiguration) {
					//console.log("walkTreeLoop1 done");
					//
					break walkTreeLoop1;
				}
				//
				// position current branch
				var currentTreeParentRecord = currentChildRecord.treeParentRecord;
				var currentTreeParentPositioningBox = currentTreeParentRecord.positioningBox; // from
				var currentChildPositioningBox = currentChildRecord.positioningBox; // to
				var from = boomConfiguration.from;
				var to = boomConfiguration.to;
				var fromX = from.x;
				var fromY = from.y;
				var toX = to.x;
				var toY = to.y;
				var fromPointRelativeX = currentTreeParentPositioningBox.width * fromX;
				var fromPointRelativeY = currentTreeParentPositioningBox.height * fromY;
				var toPointRelativeX = currentChildPositioningBox.width * toX;
				var toPointRelativeY = currentChildPositioningBox.height * toY;
				//
				var boomAngle = boomConfiguration.angle;
				// note: % 180 to avoid result 6.123233995736766e-17 !== 0
				var cosine = (boomAngle - 90) % 180 ? Math.cos(boomAngle * Math.PI / 180) : 0;
				var sine = boomAngle % 180 ? Math.sin(boomAngle * Math.PI / 180) : 0;
				var boomGap = boomConfiguration.gap;
				//
				var currentTreeParentBoundingBox = currentTreeParentRecord.boundingBox; // from
				var currentChildBoundingBox = currentChildRecord.boundingBox; // to
				var currentTreeParentBranchBox = currentTreeParentRecord.branchBox; // from
				var currentChildBranchBox = currentChildRecord.branchBox; // to
				//
				var deltaMin = boomGap;
				var deltaMax = currentTreeParentBoundingBox.d + boomGap + currentChildBranchBox.d;
				for (var i = 0, n = currentSiblingRecordIndex; i < n; i++) {
					var siblingRecord = currentSiblingRecords[i];
					deltaMax += siblingRecord.branchBox.d + siblingRecord.boomConfiguration.gap;
				}
				deltaMax *= 1.5; // accommodate odd layouts
				var delta = currentTreeParentBoundingBox.d / 2 + boomGap + currentChildBoundingBox.d / 2; // reasonable
				var bestDelta = 1 / 0; // Infinity
				var bestAccuracy = 1 / 0; // Infinity
				var endOfIterating = false;
				iterateDeltaLoop: while (true) {
					if (endOfIterating) {
						if (delta === bestDelta) { // most recent is best already
							break iterateDeltaLoop;
						} // else { // shift one more time to get back to best
					}
					//
					var deltaX = delta * cosine;
					var deltaY = delta * sine;
					//
					// correct first for connection points relative coordinates and then for already existing offset
					deltaX = Adj.roundAway
						((fromPointRelativeX + deltaX - toPointRelativeX) - (currentChildPositioningBox.x - currentTreeParentPositioningBox.x));
					deltaY = Adj.roundAway
						((fromPointRelativeY + deltaY - toPointRelativeY) - (currentChildPositioningBox.y - currentTreeParentPositioningBox.y));
					//
					// shift
					currentChildPositioningBox.x += deltaX;
					currentChildPositioningBox.y += deltaY;
					currentChildBranchBox.x += deltaX;
					currentChildBranchBox.y += deltaY;
					//
					if (endOfIterating) { // done
						break iterateDeltaLoop;
					}
					//
					var distance = Adj.distanceBetweenRectangles(currentTreeParentPositioningBox, currentChildBranchBox);
					for (var i = 0, n = currentSiblingRecordIndex; i < n; i++) {
						distance =
							Math.min
							(distance,
							 Adj.distanceBetweenRectangles(currentSiblingRecords[i].branchBox, currentChildBranchBox));
					}
					//
					var accuracy = distance - boomGap;
					// extra precautions implemented to avoid endless loops in case of irregular patterns
					if (accuracy >= 0 && accuracy < bestAccuracy) {
						bestDelta = delta;
						bestAccuracy = accuracy;
					}
					if (accuracy >= 0 && accuracy < 1) { // good enough
						endOfIterating = true;
						continue iterateDeltaLoop;
					}
					if (deltaMax - deltaMin < 0.5) { // good enough
						endOfIterating = true;
						continue iterateDeltaLoop;
					}
					if (distance < boomGap) {
						if (delta > deltaMin) {
							deltaMin = delta;
						}
					}
					if (distance > boomGap) {
						if (delta < deltaMax) {
							deltaMax = delta;
						}
					}
					delta = (deltaMin + deltaMax) / 2;
				}
				//
				// merge branches
				var currentTreeParentBranchRecords = currentTreeParentRecord.branchRecords;
				currentTreeParentBranchRecords.push(currentChildRecord);
				// merge branch boxes
				var currentChildBranchBoxRight = currentChildBranchBox.x + currentChildBranchBox.width;
				var currentChildBranchBoxBottom = currentChildBranchBox.y + currentChildBranchBox.height;
				var currentTreeParentBranchBoxRight = currentTreeParentBranchBox.x + currentTreeParentBranchBox.width;
				var currentTreeParentBranchBoxBottom = currentTreeParentBranchBox.y + currentTreeParentBranchBox.height;
				if (currentChildBranchBox.x < currentTreeParentBranchBox.x) {
					currentTreeParentBranchBox.x = currentChildBranchBox.x;
				}
				if (currentChildBranchBoxRight > currentTreeParentBranchBoxRight) {
					currentTreeParentBranchBoxRight = currentChildBranchBoxRight;
				}
				currentTreeParentBranchBox.width = currentTreeParentBranchBoxRight - currentTreeParentBranchBox.x;
				if (currentChildBranchBox.y < currentTreeParentBranchBox.y) {
					currentTreeParentBranchBox.y = currentChildBranchBox.y;
				}
				if (currentChildBranchBoxBottom > currentTreeParentBranchBoxBottom) {
					currentTreeParentBranchBoxBottom = currentChildBranchBoxBottom;
				}
				currentTreeParentBranchBox.height = currentTreeParentBranchBoxBottom - currentTreeParentBranchBox.y;
				currentTreeParentBranchBox.d = Math.sqrt(Math.pow(currentTreeParentBranchBox.width, 2) + Math.pow(currentTreeParentBranchBox.height, 2));
			}
			//console.log("walkTreeLoop1 finishing at node " + currentChildRecord.node + " at level " + (stack.length + 1));
			//
			currentSiblingRecordIndex += 1;
			if (currentSiblingRecordIndex < currentSiblingRecords.length) {
				continue walkTreeLoop1;
			} else { // no more sibling
				//console.log("walkTreeLoop1 after last of siblings at level " + (stack.length + 1));
				if (stack.length > 0) {
					//console.log("walkTreeLoop1 on way back to parent of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					var stackedPosition = stack.pop();
					currentSiblingRecords = stackedPosition.siblingRecords;
					currentSiblingRecordIndex = stackedPosition.index;
					onWayBack = true;
					continue walkTreeLoop1;
				} else { // stack.length === 0
					//console.log("walkTreeLoop1 done");
					//
					break walkTreeLoop1;
				}
			}
		}
		//
		// walk tree structure again
		// tree walking variables
		var currentSiblingRecords = [rootRecord];
		var currentSiblingRecordIndex = 0;
		var stack = [];
		var onWayBack = false;
		//
		// walk
		//console.log("walkTreeLoop2 starting");
		walkTreeLoop2: while (currentSiblingRecordIndex < currentSiblingRecords.length) {
			var currentChildRecord = currentSiblingRecords[currentSiblingRecordIndex];
			var treeChildRecords = currentChildRecord.treeChildRecords;
			var numberOfTreeChildren = treeChildRecords.length;
			//
			if (!onWayBack) {
				if (currentSiblingRecordIndex === 0) {
					//console.log("walkTreeLoop2 before first of siblings at level " + (stack.length + 1));
				}
				//console.log("walkTreeLoop2 on way there in node " + currentChildRecord.node + " node " + currentSiblingRecordIndex + " at level " + (stack.length + 1));
				//
				// determine position of current branch
				var positioningBox = currentChildRecord.positioningBox;
				// positioningBox.x and .y were relative to ancestor being processed until here
				// positioningBox.x and .y will be relative to element from here
				if (!stack.length) {
					var rootRecordBranchBox = rootRecord.branchBox;
					positioningBox.x += gap - rootRecordBranchBox.x;
					positioningBox.y += gap - rootRecordBranchBox.y;
				} else {
					var currentTreeParentPositioningBox = currentChildRecord.treeParentRecord.positioningBox;
					positioningBox.x += currentTreeParentPositioningBox.x;
					positioningBox.y += currentTreeParentPositioningBox.y;
				}
				if (explain) {
					if (stack.length) {
						var branchBox = currentChildRecord.branchBox;
						branchBox.x += currentTreeParentPositioningBox.x;
						branchBox.y += currentTreeParentPositioningBox.y;
					}
				}
				//
				if (numberOfTreeChildren) {
					//console.log("walkTreeLoop2 on way there to children of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					stack.push( { siblingRecords: currentSiblingRecords, index: currentSiblingRecordIndex } );
					currentSiblingRecords = treeChildRecords;
					currentSiblingRecordIndex = 0;
					continue walkTreeLoop2;
				} else { // childless node, aka leaf
					//console.log("walkTreeLoop2 at childless node (leaf) " + currentChildRecord.node + " at level " + (stack.length + 1));
				}
			} else { // onWayBack
				//console.log("walkTreeLoop2 on way back in node " + currentChildRecord.node + " at level " + (stack.length + 1));
				//
				onWayBack = false;
			}
			//
			//console.log("walkTreeLoop2 finishing at node " + currentChildRecord.node + " at level " + (stack.length + 1));
			//
			currentSiblingRecordIndex += 1;
			if (currentSiblingRecordIndex < currentSiblingRecords.length) {
				continue walkTreeLoop2;
			} else { // no more sibling
				//console.log("walkTreeLoop2 after last of siblings at level " + (stack.length + 1));
				if (stack.length > 0) {
					//console.log("walkTreeLoop2 on way back to parent of node " + currentChildRecord.node + " from level " + (stack.length + 1));
					var stackedPosition = stack.pop();
					currentSiblingRecords = stackedPosition.siblingRecords;
					currentSiblingRecordIndex = stackedPosition.index;
					onWayBack = true;
					continue walkTreeLoop2;
				} else { // stack.length === 0
					//console.log("walkTreeLoop2 done");
					//
					break walkTreeLoop2;
				}
			}
		}
		//
		// now we know where to put each
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var childPositioningBox = childRecord.positioningBox;
			//
			var childBoundingBox = childRecord.boundingBox;
			var translationX = Math.round(childPositioningBox.x - childBoundingBox.x);
			var translationY = Math.round(childPositioningBox.y - childBoundingBox.y);
			childRecord.node.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
		}
		//
		// size the hidden rect for having a good bounding box when from a level up this element's getBBox() gets called
		if (hiddenRect) {
			hiddenRect.setAttribute("x", 0);
			hiddenRect.setAttribute("y", 0);
			var hiddenRectWidth = Math.ceil(rootRecordBranchBox.width) + 2 * gap;
			var hiddenRectHeight = Math.ceil(rootRecordBranchBox.height) + 2 * gap;
			hiddenRect.setAttribute("width", Adj.decimal(hiddenRectWidth));
			hiddenRect.setAttribute("height", Adj.decimal(hiddenRectHeight));
		}
		//
		// explain
		if (explain) {
			if (hiddenRect) {
				var explanationElement = Adj.createExplanationElement(element, "rect");
				explanationElement.setAttribute("x", 0);
				explanationElement.setAttribute("y", 0);
				explanationElement.setAttribute("width", Adj.decimal(hiddenRectWidth));
				explanationElement.setAttribute("height", Adj.decimal(hiddenRectHeight));
				explanationElement.setAttribute("fill", "white");
				explanationElement.setAttribute("fill-opacity", "0.1");
				explanationElement.setAttribute("stroke", "blue");
				explanationElement.setAttribute("stroke-width", "1");
				explanationElement.setAttribute("stroke-opacity", "0.2");
				element.appendChild(explanationElement);
			}
			for (var childRecordIndex in childRecords) {
				var childRecord = childRecords[childRecordIndex];
				var explainRect = childRecord.positioningBox;
				var explanationElement = Adj.createExplanationElement(element, "rect");
				explanationElement.setAttribute("x", Adj.decimal(explainRect.x));
				explanationElement.setAttribute("y", Adj.decimal(explainRect.y));
				explanationElement.setAttribute("width", Adj.decimal(explainRect.width));
				explanationElement.setAttribute("height", Adj.decimal(explainRect.height));
				explanationElement.setAttribute("fill", "blue");
				explanationElement.setAttribute("fill-opacity", "0.1");
				explanationElement.setAttribute("stroke", "blue");
				explanationElement.setAttribute("stroke-width", "1");
				explanationElement.setAttribute("stroke-opacity", "0.1");
				element.appendChild(explanationElement);
				//
				var treeParentRecord = childRecord.treeParentRecord;
				if (treeParentRecord) {
					if (childRecord.treeChildRecords.length) {
						var explainRect = childRecord.branchBox;
						var explanationElement = Adj.createExplanationElement(element, "rect");
						explanationElement.setAttribute("x", Adj.decimal(explainRect.x));
						explanationElement.setAttribute("y", Adj.decimal(explainRect.y));
						explanationElement.setAttribute("width", Adj.decimal(explainRect.width));
						explanationElement.setAttribute("height", Adj.decimal(explainRect.height));
						explanationElement.setAttribute("fill", "none");
						explanationElement.setAttribute("fill-opacity", "0.1");
						explanationElement.setAttribute("stroke", "blue");
						explanationElement.setAttribute("stroke-dasharray", "3");
						explanationElement.setAttribute("stroke-width", "1");
						explanationElement.setAttribute("stroke-opacity", "0.1");
						element.appendChild(explanationElement);
					}
					//
					var boomConfiguration = childRecord.boomConfiguration;
					var treeParentPositioningBox = treeParentRecord.positioningBox; // from
					var childPositioningBox = childRecord.positioningBox; // to
					var from = boomConfiguration.from;
					var to = boomConfiguration.to;
					var fromX = from.x;
					var fromY = from.y;
					var toX = to.x;
					var toY = to.y;
					var fromPointX = treeParentPositioningBox.x + treeParentPositioningBox.width * fromX;
					var fromPointY = treeParentPositioningBox.y + treeParentPositioningBox.height * fromY;
					var toPointX = childPositioningBox.x + childPositioningBox.width * toX;
					var toPointY = childPositioningBox.y + childPositioningBox.height * toY;
					var explanationElement = Adj.createExplanationElement(element, "line");
					explanationElement.setAttribute("x1", Adj.decimal(fromPointX));
					explanationElement.setAttribute("y1", Adj.decimal(fromPointY));
					explanationElement.setAttribute("x2", Adj.decimal(toPointX));
					explanationElement.setAttribute("y2", Adj.decimal(toPointY));
					explanationElement.setAttribute("stroke", "blue");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.2");
					element.appendChild(explanationElement);
					element.appendChild(Adj.createExplanationPointCircle(element, fromPointX, fromPointY, "green"));
					element.appendChild(Adj.createExplanationPointCircle(element, toPointX, toPointY, "red"));
				}
			}
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "boom",
	phaseHandlerNames: [], // actual processing done in Adj.algorithms.telescopicTree, for now
	parameters: ["from", "to",
				 "angle",
				 "gap"],
	methods: []
});

// constants
Adj.svgTextFixedupNewlineRegexp1 = /(^|\S)\n/g;
Adj.svgTextFixedupNewlineReplacment1 = "$1 \n";
Adj.svgTextFixedupNewlineRegexp2 = /\n\s+/g;
Adj.svgTextFixedupNewlineReplacment2 = "\n";
Adj.svgTextNewlineRegexp = /\n+/g;
Adj.svgTextSpacesRegexp = /[ \t]+/g;
Adj.svgTextWhitespaceTruthByCode = { 32: true, 9: true, 10: true };
Adj.svgTextTickle = "\u200B\uFEFF"; // so for consistency between browsers

// utility to work around Safari 5 to 7 at \n stopping increasing getSubStringLength
Adj.getTextSubStringLength = function getTextSubStringLength (element, begin, end, newlinesAndNodeEndsMap) {
	if (newlinesAndNodeEndsMap && Object.getOwnPropertyNames(newlinesAndNodeEndsMap).length) {
		var length = 0;
		var nextBegin = begin;
		for (var i = begin; i < end; i++) {
			if (newlinesAndNodeEndsMap[i]) {
				length += element.getSubStringLength(nextBegin, i + 1 - nextBegin);
				nextBegin = i + 1;
			}
		}
		if (end > nextBegin) {
			length += element.getSubStringLength(nextBegin, end - nextBegin);
		}
		return length;
	} else {
		return element.getSubStringLength(begin, end - begin);
	}
};

// utility
Adj.createTspanXYElement = function createTspanXYElement (ownerDocument, x, y) {
	var tspanElement = Adj.createSVGElement(ownerDocument, "tspan");
	tspanElement.setAttribute("x", x);
	tspanElement.setAttribute("y", y);
	tspanElement.textContent = Adj.svgTextTickle;
	return tspanElement;
};

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "paragraph",
	phaseHandlerNames: ["adjPhase1Down", "adjPhase7Up"],
	parameters: ["maxWidth", "lineGap", "hAlign", "indent",
				 "explain"],
	methods: [function paragraph1Down (element, parametersObject) {
		// quite useful hack, if you use this code outside this source code file,
		// please put a note into your source code, describing your derivative, such as
		// "partially inspired by, copied from, evolved from Leo Baschy's Adj.algorithms.paragraph"
		//
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for a paragraph command";
		var variableSubstitutionsByName = {};
		var maxWidth = Adj.doVarsArithmetic(element, parametersObject.maxWidth, null, null, usedHow, variableSubstitutionsByName); // default maxWidth = null means no limit
		var lineGap = Adj.doVarsArithmetic(element, parametersObject.lineGap, 2, null, usedHow, variableSubstitutionsByName); // default lineGap = 2
		var hAlign = Adj.doVarsArithmetic(element, parametersObject.hAlign, 0, Adj.leftCenterRight, usedHow, variableSubstitutionsByName); // hAlign could be a number, default hAlign 0 == left
		var indent = Adj.doVarsArithmetic(element, parametersObject.indent, 0, null, usedHow, variableSubstitutionsByName); // default indent = 0
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		if (!element instanceof SVGTextElement) {
			return; // avoid nonsense
		}
		//
		var currentElement = element;
		var currentChild = currentElement.firstChild;
		var stack = [];
		var downward = false;
		var upward = false;
		walkTextLoop1: while (currentChild || stack.length) {
			if (!currentChild) {
				var stackedPosition = stack.pop();
				currentElement = stackedPosition.element;
				currentChild = stackedPosition.child;
				upward = true;
			}
			if (!upward) {
				if (currentChild.nodeType === Node.TEXT_NODE) {
					//console.log("walkTextLoop1 level ", stack.length, " text node ", currentChild.nodeValue);
					var currentNodeText = currentChild.nodeValue;
					// make sure \n has a space in front of it for consistency between browsers (one violates spec)
					var fixedUpNodeText = currentNodeText.replace(Adj.svgTextFixedupNewlineRegexp1, Adj.svgTextFixedupNewlineReplacment1);
					// make sure \n has no whitespaces behind it for consistency between browsers (one violates spec),
					// fixes a problem observed at least in Chrome 43
					var fixedUpNodeText = fixedUpNodeText.replace(Adj.svgTextFixedupNewlineRegexp2, Adj.svgTextFixedupNewlineReplacment2);
					if (fixedUpNodeText != currentNodeText) {
						currentChild.nodeValue = fixedUpNodeText;
					}
				} else if (currentChild instanceof Element) {
					if (currentChild instanceof SVGTSpanElement) {
						// look for artifact and if so then remove
						if (currentChild.childNodes.length === 1) {
							if (currentChild.textContent === Adj.svgTextTickle) {
								var childToRemove = currentChild;
								currentChild = currentChild.nextSibling;
								childToRemove.parentNode.removeChild(childToRemove);
								continue walkTextLoop1;
							}
						}
						downward = true;
					} else if (currentChild instanceof SVGAElement) {
						downward = true;
					} // else skip, e.g. a <title> or <desc> element
				}
			} else {
				upward = false;
			}
			if (downward) {
				stack.push( { element: currentElement, child: currentChild } );
				currentElement = currentChild;
				currentChild = currentElement.firstChild;
				downward = false;
				continue walkTextLoop1;
			}
			currentChild = currentChild.nextSibling;
		}
		element.normalize(); // observed to be necessary for Safari 7.0.6 after removing artifacts
		// second loop needed after normalize
		var currentElement = element;
		var currentChild = currentElement.firstChild;
		var stack = [];
		var downward = false;
		var upward = false;
		var textNodeRecords = [];
		walkTextLoop2: while (currentChild || stack.length) {
			if (!currentChild) {
				var stackedPosition = stack.pop();
				currentElement = stackedPosition.element;
				currentChild = stackedPosition.child;
				upward = true;
			}
			if (!upward) {
				if (currentChild.nodeType === Node.TEXT_NODE) {
					//console.log("walkTextLoop2 level ", stack.length, " text node ", currentChild.nodeValue);
					textNodeRecords.push( { node: currentChild } );
				} else if (currentChild instanceof Element) {
					if (currentChild instanceof SVGTSpanElement) {
						downward = true;
					} else if (currentChild instanceof SVGAElement) {
						downward = true;
					} // else skip, e.g. a <title> or <desc> element
				}
			} else {
				upward = false;
			}
			if (downward) {
				stack.push( { element: currentElement, child: currentChild } );
				currentElement = currentChild;
				currentChild = currentElement.firstChild;
				downward = false;
				continue walkTextLoop2;
			}
			currentChild = currentChild.nextSibling;
		}
		//
		if (!maxWidth) {
			return; // done
		}
		var lineZeroMaxWidth = maxWidth - indent;
		var newLineRecords = [ { textNode: element, charInNodeIndex: 0 } ];
		element.setAttribute("visibility", "hidden");
		breakLinesTry: try {
			//
			var textContent = element.textContent;
			var spaceCleanedTextContent = textContent.replace(Adj.svgTextNewlineRegexp, "").replace(Adj.svgTextSpacesRegexp, " ").trim();
			var elementNumberOfChars = element.getNumberOfChars();
			if (spaceCleanedTextContent.length != elementNumberOfChars) {
				if (spaceCleanedTextContent.length + 1 === elementNumberOfChars) {
					// observed to get here in Internet Explorer 11 when text ends with whitespace
					console.log("tolerating one off text lengths");
				} else {
					console.error("non-matching text lengths prevent paragraph formatting");
					break breakLinesTry; // avoid problems
				}
			}
			if (!textContent.length) {
				break breakLinesTry; // done
			}
			//
			var oneLineBoundingBox = element.getBBox();
			var lineStep = Math.round(oneLineBoundingBox.height) + lineGap;
			if (oneLineBoundingBox.width <= lineZeroMaxWidth) {
				break breakLinesTry; //done
			}
			//
			// in spaceCleanedTextContent
			var currentCharIndex = -1;
			var currentLineBegin = 0;
			var endOfWordCharIndex = currentLineBegin;
			var previousEndOfWordCharIndex = endOfWordCharIndex;
			var lineNumber = 0;
			var inWord = false;
			var newlinesAndNodeEndsMap = {}; // for Adj.getTextSubStringLength
			// in textNodeRecords
			var currentNode = textNodeRecords[0];
			var currentCharInNodeIndex = -1;
			var endOfTextNodeRecords = false;
			var beginOfWordNode = null;
			var beginOfWordCharInNodeIndex;
			var beginOfWordCharIndex;
			for (var textNodeIndex = 0, textNodeRecordsLength = textNodeRecords.length; !endOfTextNodeRecords; ) {
				currentCharInNodeIndex++;
				if (currentCharInNodeIndex === 0) {
					var textNodeRecord = textNodeRecords[textNodeIndex];
					var currentTextNode = textNodeRecord.node;
					var currentNodeText = currentTextNode.nodeValue;
					var currentNodeTextLength = currentNodeText.length;
				}
				var endOfWord = false;
				var beginOfWord = false;
				if (currentCharInNodeIndex < currentNodeTextLength) {
					//console.log("char ", currentNodeText.charAt(currentCharInNodeIndex));
					var charCode = currentNodeText.charCodeAt(currentCharInNodeIndex);
					var isWhitespace = Adj.svgTextWhitespaceTruthByCode[charCode];
					if (charCode === 10) {
						newlinesAndNodeEndsMap[currentCharIndex] = true;
					}
					if (inWord) {
						currentCharIndex++;
						if (isWhitespace) {
							endOfWord = true;
							endOfWordCharIndex = currentCharIndex;
						}
					} else {
						if (!isWhitespace) {
							currentCharIndex++;
							beginOfWord = true;
							beginOfWordCharIndex = currentCharIndex;
						}
					}
				} else {
					textNodeIndex++;
					currentCharInNodeIndex = -1;
					newlinesAndNodeEndsMap[currentCharIndex] = true;
					if (textNodeIndex >= textNodeRecordsLength) {
						endOfTextNodeRecords = true;
						currentCharIndex++;
						if (inWord) {
							endOfWord = true;
							endOfWordCharIndex = currentCharIndex;
						}
					}
				}
				if (beginOfWord) {
					inWord = true;
					beginOfWordNode = currentTextNode;
					beginOfWordCharInNodeIndex = currentCharInNodeIndex;
				}
				if (endOfWord) {
					inWord = false;
					if (beginOfWordCharIndex > currentLineBegin) {
						var lineLengthToEndOfWord =
							Math.ceil(Adj.getTextSubStringLength(element, currentLineBegin, endOfWordCharIndex, newlinesAndNodeEndsMap));
						if (lineLengthToEndOfWord > (lineNumber ? maxWidth : lineZeroMaxWidth)) {
							//console.log("needs new line at char ", currentCharIndex);
							newLineRecords[lineNumber].lineLength =
								Math.ceil(Adj.getTextSubStringLength(element, currentLineBegin, previousEndOfWordCharIndex, newlinesAndNodeEndsMap));
							lineNumber++;
							currentLineBegin = beginOfWordCharIndex;
							newLineRecords.push({
								textNode: beginOfWordNode,
								charInNodeIndex: beginOfWordCharInNodeIndex
							});
						}
					} else {
						// don't break if first word
					}
					previousEndOfWordCharIndex = endOfWordCharIndex;
				}
				if (endOfTextNodeRecords) {
					newLineRecords[lineNumber].lineLength =
						Math.ceil(Adj.getTextSubStringLength(element, currentLineBegin, endOfWordCharIndex, newlinesAndNodeEndsMap));
				}
			}
			//
			for (var lineNumber = newLineRecords.length - 1; lineNumber > 0; lineNumber--) {
				var newLineRecord = newLineRecords[lineNumber];
				var textNode = newLineRecord.textNode;
				var charInNodeIndex = newLineRecord.charInNodeIndex;
				var lineLength = newLineRecord.lineLength;
				//
				var tspanXYElement =
					Adj.createTspanXYElement(ownerDocument, Adj.fraction(0, maxWidth - lineLength, hAlign), lineNumber * lineStep);
				var tspanXYElement2 = tspanXYElement.cloneNode(true); // so for consistency between browsers
				if (charInNodeIndex > 0) {
					textNode = textNode.splitText(charInNodeIndex); // var newTextNode
				} // else === 0
				var parentNodeForInsert = textNode.parentNode;
				parentNodeForInsert.insertBefore(tspanXYElement, textNode);
				parentNodeForInsert.insertBefore(tspanXYElement2, textNode);
			}
			// different both how and how much for line 0
			element.setAttribute("x", Adj.fraction(indent, maxWidth - newLineRecords[0].lineLength - indent, hAlign));
			element.setAttribute("y", 0);
		} finally {
			element.removeAttribute("visibility");
		}
		//
		// explain
		if (explain) {
			if (maxWidth) {
				var textBoundingBox = element.getBBox();
				var x = Adj.decimal(textBoundingBox.x - Adj.fraction(0, maxWidth - textBoundingBox.width, hAlign));
				var w = maxWidth;
				var xw = x + w;
				var y = Adj.decimal(textBoundingBox.y);
				var h = newLineRecords.length * lineStep;
				var yh = y + h;
				var explanationElement = Adj.createExplanationElement(parent, "g");
				var explanationRect = Adj.createExplanationElement(parent, "rect");
				explanationRect.setAttribute("x", x);
				explanationRect.setAttribute("y", y);
				explanationRect.setAttribute("width", w);
				explanationRect.setAttribute("height", h);
				explanationRect.setAttribute("fill", "blue");
				explanationRect.setAttribute("fill-opacity", "0.1");
				explanationRect.setAttribute("stroke", "none");
				explanationElement.appendChild(explanationRect);
				explanationElement.appendChild(Adj.createExplanationLine(parent, x, yh, x, y, "blue"));
				explanationElement.appendChild(Adj.createExplanationLine(parent, x, y, xw, y, "blue"));
				explanationElement.appendChild(Adj.createExplanationLine(parent, xw, y, xw, yh, "blue"));
				parametersObject.explanationElement = explanationElement; // store for a later phase
			}
		}
	},
	function paragraph7Up (element, parametersObject) {
		// explain
		var explanationElement = parametersObject.explanationElement;
		if (explanationElement) {
			// by now the necessary transform should be known
			var transform = element.getAttribute("transform");
			if (transform) {
				explanationElement.setAttribute("transform", transform);
			}
			var parent = element.parentNode;
			parent.appendChild(explanationElement);
			delete parametersObject.explanationElement;
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "hide",
	hiddenByCommand: true,
	phaseHandlerNames: [], // actual hiding done in Adj.setAlgorithm, for now
	parameters: []
});

// utility
Adj.hideUnhideSiblingsFollowing = function hideUnhideSiblingsFollowing (element, hide, doSvg) {
	switch (hide) {
		case "hide":
		case "unhide":
		case "toggle":
			break;
		default:
			hide = "unhide";
	}
	var parent = element.parentNode;
	var following = false;
	for (var sibling = parent.firstChild; sibling; sibling = sibling.nextSibling) {
		if (!(sibling instanceof SVGElement)) {
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		if (!sibling.getBBox) {
			continue; // skip if not an SVGLocatable, e.g. a <script> element
		}
		if (sibling === element) {
			following = true;
			continue; // don't hide self
		}
		if (sibling.adjPlacementArtifact) {
			continue;
		}
		// different than other algorithms, don't skip sibling.adjNotAnOrder1Element
		// different than other algorithms, don't skip sibling.adjHiddenByCommand
		if (sibling.adjExplanationArtifact) {
			continue;
		}
		//
		// process
		if (following) {
			if (hide === "toggle") { // only possible at first sibling following
				if (sibling.adjHiddenByCommand) {
					hide = "unhide";
				} else {
					hide = "hide";
				}
			}
			if (hide === "hide") {
				Adj.elementSetAttributeInAdjNS(sibling, "hide", "true");
			} else { // "unhide"
				Adj.elementRemoveAttributeInAdjNS(sibling, "hide");
			}
		}
	}
	if (doSvg) {
		Adj.doSvg(element.ownerSVGElement);
	}
};
Adj.hideSiblingsFollowing = function hideSiblingsFollowing (element, doSvg) {
	Adj.hideUnhideSiblingsFollowing(element, "hide", doSvg);
};
Adj.unhideSiblingsFollowing = function unhideSiblingsFollowing (element, doSvg) {
	Adj.hideUnhideSiblingsFollowing(element, "unhide", doSvg);
};
Adj.toggleHideSiblingsFollowing = function toggleHideSiblingsFollowing (element, doSvg) {
	Adj.hideUnhideSiblingsFollowing(element, "toggle", doSvg);
};

// visual exception display
Adj.displayException = function displayException (exception, theSvgElement) {
	console.error(exception); // redundant logging in case a subsequent run of doSvg() replaces this visual exception display
	//
	var ownerDocument = theSvgElement.ownerDocument;
	//
	for (var child = theSvgElement.firstChild; child; child = child.nextSibling) {
		if (!(child instanceof SVGElement)) {
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		if (!child.getBBox) {
			continue; // skip if not an SVGLocatable, e.g. a <script> element
		}
		Adj.hideByDisplayAttribute(child); // make invisible but don't delete
	}
	var exceptionString = exception.toString();
	var exceptionElement = Adj.createExplanationElement(theSvgElement, "g", true);
	theSvgElement.appendChild(exceptionElement);
	var exceptionTextElement = Adj.createSVGElement(ownerDocument, "text");
	exceptionTextElement.appendChild(ownerDocument.createTextNode(exceptionString));
	exceptionTextElement.setAttribute("fill", "red");
	exceptionTextElement.setAttribute("style", "fill:red;");
	exceptionElement.appendChild(exceptionTextElement);
	// fix up
	Adj.algorithms.textBreaks.methods[0](exceptionElement,{lineBreaks:true});
	Adj.algorithms.verticalList.methods[0](exceptionElement,{});
	var svgElementBoundingBox = theSvgElement.getBBox();
	theSvgElement.setAttribute("width", Adj.decimal(svgElementBoundingBox.width));
	theSvgElement.setAttribute("height", Adj.decimal(svgElementBoundingBox.height));
};

Adj.toPathRegExp = /^([^?#]*)(.*)$/;
Adj.fragmentsSplitRegExp = /#/;
Adj.anySlashRegExp = /^.*\//;
Adj.schemeAuthorityPathRegExp = /^([a-zA-Z][-+.a-zA-Z0-9]*:\/\/)?([^\/]*)(.*)$/;
Adj.dirRegExp = /^(.*\/)/;
Adj.leadingSlashRegExp = /^\//;
Adj.leadingDotDotSlashRegExp = /^(\.\.\/)?(.*)$/;
Adj.tailingDirRegExp = /^(.*?)([^\/]+\/)$/;
Adj.firstTagRegExp = /^(?:[\s\S]*?<)([A-Za-z0-9]+)/;

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "include",
	phaseHandlerNames: ["adjPhase1Down", "adjPhase1Up"],
	parameters: ["href"],
	methods: [function include1Down (element, parametersObject) {
		var theSvgElement = element.ownerSVGElement || element;
		var commandElement = parametersObject.commandElement;
		//
		var usedHow = "used in a parameter for an include command";
		var href = Adj.elementGetAttributeInXLinkNS(commandElement, "href");
		if (!href) {
			throw "missing parameter xlink:href= for an include command";
		}
		//
		if (element.adjIncluded) {
			// don't include a second time
			return;
		}
		if (theSvgElement.adjIncludingElement) {
			// prevent a concurrent nested getTextFile
			return;
		}
		//
		var includeFragments = href.split(Adj.fragmentsSplitRegExp);
		var hrefToQuery = includeFragments[0];
		if (!hrefToQuery) {
			throw "missing path in include attribute xlink:href=\"" + href + "\"";
		}
		window.nrvrGetTextFile(hrefToQuery, function (responseText, status) {
			(function () {
				// keep track of requests
				delete theSvgElement.adjAsyncGetTextFileRequesters[Adj.runtimeId(element)];
				//
				if (status != 200) { // 200 OK
					var errorMessage = "HTTP GET status " + status + " for " + href;
					element.adjIncluded = errorMessage; // prevent endless loop
					console.error(errorMessage);
					return;
				}
				// main-SVG-intent versus inlined-SVG-workaround
				var matchFirstTag = Adj.firstTagRegExp.exec(responseText);
				if (matchFirstTag) {
					var firstTag = matchFirstTag[1];
				} else {
					firstTag = null;
				}
				var isMainSvg = firstTag === "svg"; // versus e.g. "HTML"
				// see https://developer.mozilla.org/en-US/docs/Web/API/DOMParser
				// and https://w3c.github.io/DOM-Parsing/#the-domparser-interface
				var domParser = new DOMParser();
				try {
					if (isMainSvg) { // main-SVG-intent
						var textFileDom = domParser.parseFromString(responseText, "image/svg+xml");
					} else { // inlined-SVG-workaround
						textFileDom = domParser.parseFromString(responseText, "text/html");
					}
				} catch (exception) {
					element.adjIncluded = exception; // prevent endless loop
					console.error(exception);
					return;
				}
				var documentElementToIncludeFrom = textFileDom.documentElement;
				if (documentElementToIncludeFrom.nodeName === "parsererror") {
					element.adjIncluded = documentElementToIncludeFrom; // prevent endless loop
					console.error(documentElementToIncludeFrom);
					return;
				}
				var ownerDocument = element.ownerDocument;
				if (!ownerDocument) { // defensive check for asynchronous removal
					var errorMessage = "apparently element has been removed";
					element.adjIncluded = errorMessage; // prevent endless loop
					console.error(errorMessage);
					return;
				}
				try {
					// first resolve fragment ids, if any
					if (includeFragments.length > 1) {
						if (isMainSvg) { // main-SVG-intent
							var svgElementsToIncludeFrom = [ documentElementToIncludeFrom ];
						} else { // inlined-SVG-workaround
							svgElementsToIncludeFrom = documentElementToIncludeFrom.getElementsByTagName("svg");
						}
						// both main-SVG-intent and inlined-SVG-workaround
						for (var i = 0, n = svgElementsToIncludeFrom.length; i < n; i++) {
							var oneSvgElementToIncludeFrom = svgElementsToIncludeFrom[i];
							// include fragment of document
							var toIncludeElement = oneSvgElementToIncludeFrom;
							for (var j = 1, n = includeFragments.length; j < n; j++) {
								var id = includeFragments[j];
								toIncludeElement = Adj.getElementByIdNearby(id, toIncludeElement);
								if (!toIncludeElement) { // not resolving in this context
									break;
								}
							}
							if (toIncludeElement) { // resolved
								break;
							}
						}
						if (!toIncludeElement) {
							var errorMessage = "nonresolving id in include attribute xlink:href=\"" + href + "\"";
							element.adjIncluded = errorMessage; // prevent endless loop
							console.error(errorMessage);
							return;
						}
					}
					// should only get here if content has been retrieved and is ready to insert
					// remove
					for (var child = element.firstChild; child; ) { // because of removeChild here cannot child = child.nextSibling
						if (child === commandElement) {
							// skip if the very commandElement itself
							child = child.nextSibling;
							continue;
						}
						var childToRemove = child;
						child = child.nextSibling;
						element.removeChild(childToRemove);
					}
					// if necessary then fix up ownerDocument.adjNamespaceImplementation
					var ownerDocumentNamespaceImplementation = Adj.namespaceImplementation(ownerDocument);
					var textFileDomNamespaceImplementation = Adj.namespaceImplementation(textFileDom);
					if (ownerDocumentNamespaceImplementation === "full" && textFileDomNamespaceImplementation === "obtuse") {
						// e.g. an SVG document includes a fragment from SVG inline in an HTML document
						ownerDocument.adjNamespaceImplementation = "fullYetSomeObtuse"; // trigger holstein-namespace-workaround
					}
					// insert
					if (includeFragments.length === 1) { // no fragment in URI
						// include all content of document
						var toIncludeFromNodes = documentElementToIncludeFrom.childNodes;
						for (var i = 0, n = toIncludeFromNodes.length; i < n; i++) {
							var toIncludeNode = toIncludeFromNodes[i];
							if (toIncludeNode instanceof Element) {
								if (toIncludeNode.nodeName === "script") {
									// e.g. <script type="text/javascript" xlink:href="js/adj.js"/>
									continue; // skip
								}
							}
							toIncludeNode = ownerDocument.importNode(toIncludeNode, true); // leave original for potential future reuse
							element.appendChild(toIncludeNode);
						}
					} else {
						// include fragment of document
						toIncludeElement = ownerDocument.importNode(toIncludeElement, true); // leave original for potential future reuse
						toIncludeElement.removeAttribute("transform");
						element.appendChild(toIncludeElement);
					}
					// clean up to avoid problems in other code
					element.normalize();
				} finally {
					// prevent endless loop
					element.adjIncluded = element.adjIncluded || new Date();
				}
				// fix up URIs
				// terms used for three logical levels are document, include, link
				var includeToPath = Adj.toPathRegExp.exec(href)[1] || "";
				if (Adj.anySlashRegExp.test(includeToPath)) { // at least one slash
					var schemeAuthorityPathRegExpMatch = Adj.schemeAuthorityPathRegExp.exec(includeToPath);
					var includeScheme2 = schemeAuthorityPathRegExpMatch[1];
					if (includeScheme2) {
						var includeAuthority = schemeAuthorityPathRegExpMatch[2];
						var includePath = schemeAuthorityPathRegExpMatch[3];
					} else {
						includeScheme2 = "";
						includeAuthority = "";
						includePath = includeToPath;
					}
					var includeDir = Adj.dirRegExp.exec(includePath)[1];
					var includePathStartsAtRoot = Adj.leadingSlashRegExp.test(includePath);
					// would have liked
					//   var linkIterator = document.evaluate(".//@*[local-name()='href']", element, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
					//   var linkAttribute;
					//   while (linkAttribute = linkIterator.iterateNext()) { // sic
					// note first link found is from this very include, skip it by element or by initial
					//   var linkAttribute = linkIterator.iterateNext();
					// also couldn't use XPath because of compatibility
					// note per https://developer.mozilla.org/en-US/docs/Web/API/Document/evaluate no Internet Explorer 11
					// note per https://developer.mozilla.org/en-US/docs/Web/API/Attr no parentNode or ownerElement
					// note for NODE_ITERATOR modifying a node will invalidate the iterator, would have to use NODE_SNAPSHOT and snapshot methods
					// also considered .//@*[namespace-uri()='http://www.nrvr.com/2012/adj' and local-name()='href']
					// now instead a "good enough" method to be compatible with Internet Explorer 11
					var linkElements = element.querySelectorAll("[*|href]");
					for (var i = 0, n = linkElements.length; i < n; i++) {
						// fix up one link
						var linkedElement = linkElements[i];
						if (linkedElement === commandElement) {
							// skip if the very commandElement itself
							continue;
						}
						var linkUri = Adj.elementGetAttributeInXLinkNS(linkedElement, "href");
						if (!linkUri) { // could try other namespaces
							continue; // but don't, for now
						}
						// note http://www.ietf.org/rfc/rfc3986.txt Uniform Resource Identifier (URI): Generic Syntax
						var toPathAfterPathRegExpMatch = Adj.toPathRegExp.exec(linkUri);
						var linkToPath = toPathAfterPathRegExpMatch[1] || "";
						var linkAfterPath = toPathAfterPathRegExpMatch[2] || "";
						var linkScheme2 = Adj.schemeAuthorityPathRegExp.exec(linkToPath)[1];
						if (!linkScheme2) { // link is not absolute
							if (Adj.leadingSlashRegExp.test(linkToPath)) { // linkToPath starts with a slash, at root
								linkUri = includeScheme2 + includeAuthority + linkUri;
							} else {
								// eliminate subdir/../ if any
								var linkPathPart1 = includeDir;
								var linkPathPart2 = linkToPath;
								while (true) {
									var matchPart2 = Adj.leadingDotDotSlashRegExp.exec(linkPathPart2);
									if (!matchPart2[1]) { // no leading ../ in linkPathPart2
										break;
									}
									var matchPart1 = Adj.tailingDirRegExp.exec(linkPathPart1);
									if (!matchPart1) { // no match
										break;
									}
									var tailingDir = matchPart1[2];
									if (tailingDir === "../" || tailingDir === "./") { // an oddball
										break;
									}
									linkPathPart1 = matchPart1[1] || "";
									linkPathPart2 = matchPart2[2] || "";
								}
								linkUri = includeScheme2 + includeAuthority + linkPathPart1 + linkPathPart2 + linkAfterPath;
							}
							Adj.elementSetAttributeInXLinkNS(linkedElement, "href", linkUri);
						//} else { // link is absolute, no fixup needed
						}
					}
				//} else { // not any slash means same directory, no fixup needed
				}
			})();
			// above in a function to make sure all non-exceptional exits proceed here
			theSvgElement.adjProcessing.singlifier.invokeLater();
		});
		// keep track of requests
		theSvgElement.adjAsyncGetTextFileRequesters[Adj.runtimeId(element)] = element;
		// prevent a concurrent nested getTextFile
		theSvgElement.adjIncludingElement = element;
	},
	function include1Up (element, parametersObject) {
		var theSvgElement = element.ownerSVGElement || element;
		//
		if (theSvgElement.adjIncludingElement === element) {
			theSvgElement.adjIncludingElement = undefined;
		}
	}]
});

// utility class
// for Adj.algorithms.include, at first
// if needed use bind before passing func
Adj.Singlifier = function Singlifier (func) {
	// per https://html.spec.whatwg.org/multipage/webappapis.html#timers
	// setTimeout returns an integer that is greater than zero
	this.timeoutId = null;
	this.immediateId = null;
	this.func = func;
};
// schedule invocation
// intentionally takes no parameters
Adj.Singlifier.prototype.invokeLater = function invokeLater () {
	if (   !this.timeoutId // no timeout yet
		&& !this.immediateId) { // neither immediate
		var invocation = function singlifierLaterInvocation (singlifierInvoked) {
			singlifierInvoked.timeoutId = null; // reset
			singlifierInvoked.func();
		};
		this.timeoutId = window.setTimeout(invocation, 0, this);
	}
};
// schedule invocation
// intentionally takes no parameters
Adj.Singlifier.prototype.invokeSooner = function invokeSooner () {
	if (!this.immediateId) { // no immediate yet
		var invocation = function singlifierSoonerInvocation (singlifierInvoked) {
			singlifierInvoked.immediateId = null; // reset
			singlifierInvoked.func();
		};
		this.immediateId = window.setImmediate(invocation, this);
	}
	if (this.timeoutId) { // a preexisting timeout
		// prevent that second invocation
		window.clearTimeout(this.timeoutId);
		this.timeoutId = null;
	}
};

// if function window.nrvrGetTextFile from file-scheme-get-from-script.xpi
// isn't present then provide an equivalent API
// for Adj.algorithms.include
if (!window.nrvrGetTextFile) {
	window.nrvrGetTextFile = function nrvrGetTextFile (fileUrl, gotFileCallback) {
		try {
			var xhr = new XMLHttpRequest();
			xhr.onloadend = function () {
				// Chrome 46 has been observed to return synchronously to report
				// XMLHttpRequest cannot load file:// … Cross origin requests are only supported for protocol schemes: http, …
				// therefore we wrap with what otherwise could appear a frivolous setTimeout
				window.setTimeout(function (gotFileCallbackGiven, xhrLoadEnded) {
					gotFileCallbackGiven(xhrLoadEnded.responseText, xhrLoadEnded.status);
				}, 0, gotFileCallback, xhr);
			};
			xhr.open('GET', fileUrl, true);
			xhr.responseType = 'text';
			xhr.send();
		} catch (e) {
			console.error('error attempting to GET', fileUrl.href, e);
			window.setTimeout(function (gotFileCallbackGiven) {
				gotFileCallbackGiven('', 0);
			}, 0, gotFileCallback);
		}
	};
}

// deal with namespaces not being implemented fully when parsing Adj in SVG inline in HTML,
// aka no-namespace-workaround,
// to be clear: this is because of browsers having limited namespace support in SVG inline in HTML
//
// throughout Adj source code, two comments are used, by convention:
// normal-namespace-intent versus no-namespace-workaround,
// and sometimes thirdly holstein-namespace-workaround (spotted within one document)
//
// https://www.google.com/search?q=other+namespaces+in+svg+in+html5
// http://stackoverflow.com/questions/23319537/html-5-inline-svg-and-namespace-awareness-for-svg-dom
// http://dev.w3.org/SVG/proposals/svg-html/svg-html-proposal.html
//
// "full", "obtuse", or "fullYetSomeObtuse"
Adj.namespaceImplementation = function namespaceImplementation (document) {
	var documentNamespaceImplementation = document.adjNamespaceImplementation;
	if (documentNamespaceImplementation) { // cached
		return documentNamespaceImplementation; // quick return
	}
	// determine
	if (document.documentElement.tagName === "svg") {
		// assume normality
		documentNamespaceImplementation = "full";
	} else {
		// test Adj in SVG inline in HTML
		var domParser = new DOMParser();
		var dummyDom = domParser.parseFromString(
'<!DOCTYPE html><html><body><svg xmlns="http://www.w3.org/2000/svg" xmlns:adj="http://www.nrvr.com/2012/adj"><adj:dummy/><rect width="30" height="20"/></svg></body></html>',
			"text/html");
		if (dummyDom.getElementsByTagName("svg")[0].firstElementChild.namespaceURI === Adj.AdjNamespace) { // maybe someday will be lucky
			documentNamespaceImplementation = "full";
		} else { // Adj.SvgNamespace commonly observed
			documentNamespaceImplementation = "obtuse";
		}
	}
	document.adjNamespaceImplementation = documentNamespaceImplementation;
	return documentNamespaceImplementation;
};
//
Adj.nameSplitByColonRegexp = /^(?:(.*?):)?(.*)$/;
Adj.nameSplitByColon = function nameSplitByColon (name) {
	var match = Adj.nameSplitByColonRegexp.exec(name);
	return {
		prefix: match[1],
		localPart: match[2],
	};
};

// utility
// intended for use as key
Adj.runtimeId = (function () {
	var nextRuntimeId = 1;
	return function runtimeId (object) {
		return object.adjRuntimeId || (object.adjRuntimeId = nextRuntimeId++);
	};
})();

// utility
Adj.normalizeDirection = function normalizeDirection(direction) {
	if (isNaN(direction.l)) {
		// l as in length of direction vector
		var l = Math.sqrt(Math.pow(direction.x, 2) + Math.pow(direction.y, 2));
		direction.x /= l;
		direction.y /= l;
		direction.l = 1;
		direction.o = l; // o as in original length of direction vector
		if (isFinite(direction.x) && isFinite(direction.y)) { // normal case
			return;
		} else if (isFinite(direction.x)) {
			direction.x = 0;
			direction.y = Math.sign(direction.y);
		} else if (isFinite(direction.y)) {
			direction.x = Math.sign(direction.x);
			direction.y = 0;
		} else {
			direction.l = 0; // no identifiable direction
			direction.x = 0;
			direction.y = 0;
		}
	}
};

// utility
// returns new objects
Adj.rightAndLeftOffsetPoints = function rightAndLeftOffsetPoints (point, offset, direction1) {
	var directionArgument = 2;
	var argumentsLength = arguments.length;
	var numberOfDirectionArguments = argumentsLength - directionArgument;
	var directionX = 0;
	var directionY = 0;
	var identifiableDirections = 0;
	for (var i = directionArgument; i < argumentsLength; i++) { // any number of directions
		var d = arguments[i];
		Adj.normalizeDirection(d);
		directionX += d.x;
		directionY += d.y;
		identifiableDirections += d.l;
	}
	var direction = { x: directionX, y:  directionY };
	Adj.normalizeDirection(direction);
	//
	if (numberOfDirectionArguments === 2 && identifiableDirections === 2) { // if exactly two directions
		// determine angle between directions
		var secantOfHalfAngle = identifiableDirections / direction.o;
		// make offset longer, e.g. 90°/2 == 45° gets *√2, yet limit to not too long
		offset *= Math.min(secantOfHalfAngle, 2.0);
	}
	//
	var offsetX = - offset * direction.y;
	var offsetY = offset * direction.x;
	return {
		right: { x: point.x + offsetX, y: point.y + offsetY },
		left: { x: point.x - offsetX, y: point.y - offsetY },
		direction: direction
	};
};

// utility
// modifies point
Adj.shiftPoint = function shiftPoint (point, offset, direction) {
	Adj.normalizeDirection(direction);
	point.x += offset * direction.x;
	point.y += offset * direction.y;
};

// utility
// returns an array
// assumes pathSegList to be absolute segments only of types M, L, C, Q
Adj.reversePathSegList = function reversePathSegList (pathSegList) {
	var numberOfPathSegs = pathSegList.numberOfItems;
	var reversedPathSegArray = [];
	var pathSeg = pathSegList.getItem(numberOfPathSegs - 1);
	reversedPathSegArray.push({ pathSegTypeAsLetter: 'M', x: pathSeg.x, y: pathSeg.y });
	for (var index = numberOfPathSegs - 2; index >= 0; index--) {
		var precedingPathSeg = pathSegList.getItem(index);
		var pathSegTypeAsLetter = pathSeg.pathSegTypeAsLetter;
		switch (pathSegTypeAsLetter) {
			case 'M':
			case 'L':
				reversedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x: precedingPathSeg.x, y: precedingPathSeg.y });
				break;
			case 'C':
				reversedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x1: pathSeg.x2, y1: pathSeg.y2,
				   x2: pathSeg.x1, y2: pathSeg.y1,
				   x: precedingPathSeg.x, y: precedingPathSeg.y });
				break;
			case 'Q':
				reversedPathSegArray.push
				({ pathSegTypeAsLetter: pathSegTypeAsLetter,
				   x1: pathSeg.x1, y1: pathSeg.y1,
				   x: precedingPathSeg.x, y: precedingPathSeg.y });
				break;
			default:
				// not dealing with other types, for now
		}
		pathSeg = precedingPathSeg;
	}
	return reversedPathSegArray;
};

// a specific algorithm
// note: as implemented only some kinds of path segments are supported
Adj.defineCommandForAlgorithm({
	algorithmName: "pathArrow",
	notAnOrder1Element: true,
	phaseHandlerNames: ["adjPhase7Up"],
	parameters: ["path",
				 "setback", "nockSetback", "pointSetback",
				 "explain"],
	methods: [function pathArrow (element, parametersObject) {
		var theSvgElement = element.ownerSVGElement || element;
		//
		var usedHow = "used in a parameter for a pathArrow command";
		var variableSubstitutionsByName = {};
		var idedElementRecordsById = {};
		var pathId = parametersObject.path;
		var setback = Adj.doVarsArithmetic(element, parametersObject.setback, 0, null, usedHow, variableSubstitutionsByName); // default setback = 0
		var nockSetback = Adj.doVarsArithmetic(element, parametersObject.nockSetback, setback, null, usedHow, variableSubstitutionsByName); // default nockSetback = setback
		var pointSetback = Adj.doVarsArithmetic(element, parametersObject.pointSetback, setback, null, usedHow, variableSubstitutionsByName); // default pointSetback = setback
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		var parent = element.parentNode;
		var arrowElement = element; // the arrow shape, a path itself, part of which will be bent
		if (!(arrowElement instanceof SVGPathElement)) {
			throw "not a path given as arrow shape for a pathArrow command";
		}
		//
		var pathElement; // the path to follow
		if (pathId) { // path id given
			// general case
			pathElement = Adj.getElementByIdNearby(pathId, element);
			if (!pathElement) {
				throw "nonresolving id \"" + pathId + "\" used in parameter path= for a pathArrow command";
			}
			if (!(pathElement instanceof SVGPathElement)) {
				throw "not a path at id \"" + pathId + "\" used in parameter path= for a pathArrow command";
			}
		} else { // no path id given
			// simplified case
			var pathElement = element.previousElementSibling;
			if (!(pathElement instanceof SVGPathElement)) { // also if !pathElement
				throw "no path given to follow for a pathArrow command";
			}
		}
		var matrixFromPathElement = pathElement.getTransformToElement(parent);
		//
		// first time store if first time
		Adj.firstTimeStoreAuthoringCoordinates(arrowElement);
		var authoringD = Adj.elementGetAttributeInAdjNS(arrowElement, "d") || "";
		var dWithArithmeticEvaluated = Adj.doVarsIdsArithmetic(arrowElement, authoringD, "used in attribute adj:d= for a path element", variableSubstitutionsByName, idedElementRecordsById);
		arrowElement.setAttribute("d", dWithArithmeticEvaluated);
		//
		// nock, left line forward, point, right line backward
		var arrowPathSegArrayParts = [ [], [], [], [] ];
		// loop to parse into pieces
		// get static base values as floating point values, before animation
		var pathSegList = arrowElement.pathSegList; // the arrow shape, a path to bend
		var numberOfPathSegs = pathSegList.numberOfItems;
		var pathSegArrayParts = arrowPathSegArrayParts;
		var previousCoordinates = theSvgElement.createSVGPoint(); // keep track for when needed for converting absolute to relative, initialized to 0,0
		for (var index = 0, partNumber = 0, pathSegArrayPart = pathSegArrayParts[partNumber]; index < numberOfPathSegs; index++) {
			var pathSeg = pathSegList.getItem(index);
			var pathSegTypeAsLetter = pathSeg.pathSegTypeAsLetter;
			switch (pathSegTypeAsLetter) {
				case 'Z':  // closepath
				case 'z':
					if (index < numberOfPathSegs - 1) {
						throw "premature use of path segment type '" + pathSegTypeAsLetter + "' in arrow shape for a pathArrow command";
					}
					pathSegArrayPart.push({ pathSegTypeAsLetter: pathSegTypeAsLetter });
					break;
				case 'M': // moveto
				case 'L': // lineto
				case 'T': // smooth quadratic curveto
					pathSegArrayPart.push
					({ pathSegTypeAsLetter: pathSegTypeAsLetter,
					   x: pathSeg.x, y: pathSeg.y });
					previousCoordinates.x = pathSeg.x;
					previousCoordinates.y = pathSeg.y;
					break;
				case 'm': // moveto
				case 'l': // lineto
				case 't': // smooth quadratic curveto
					if (pathSegTypeAsLetter === 'l') {
						if (pathSeg.x === 0 && pathSeg.y === 0) { // 'l' relative line to 0,0 marker to indicate next part
							partNumber++;
							if (partNumber >= pathSegArrayParts.length) {
								throw "too many 'l' relative line to 0,0 markers in arrow shape for a pathArrow command";
							}
							pathSegArrayPart = pathSegArrayParts[partNumber];
							pathSegArrayPart.push
							({ pathSegTypeAsLetter: 'M',
							   x: previousCoordinates.x, y: previousCoordinates.y });
							break;
						}
					}
					pathSegArrayPart.push
					({ pathSegTypeAsLetter: pathSegTypeAsLetter,
					   x: pathSeg.x, y: pathSeg.y });
					previousCoordinates.x += pathSeg.x;
					previousCoordinates.y += pathSeg.y;
					break;
				case 'Q': // quadratic Bézier curveto
					pathSegArrayPart.push
					({ pathSegTypeAsLetter: pathSegTypeAsLetter,
					   x: pathSeg.x, y: pathSeg.y,
					   x1: pathSeg.x1, y1: pathSeg.y1 });
					previousCoordinates.x = pathSeg.x;
					previousCoordinates.y = pathSeg.y;
					break;
				case 'q': // quadratic Bézier curveto
					pathSegArrayPart.push
					({ pathSegTypeAsLetter: pathSegTypeAsLetter,
					   x: pathSeg.x, y: pathSeg.y,
					   x1: pathSeg.x1, y1: pathSeg.y1 });
					previousCoordinates.x += pathSeg.x;
					previousCoordinates.y += pathSeg.y;
					break;
				case 'C': // cubic Bézier curveto
					pathSegArrayPart.push
					({ pathSegTypeAsLetter: pathSegTypeAsLetter,
					   x: pathSeg.x, y: pathSeg.y,
					   x1: pathSeg.x1, y1: pathSeg.y1,
					   x2: pathSeg.x2, y2: pathSeg.y2 });
					previousCoordinates.x = pathSeg.x;
					previousCoordinates.y = pathSeg.y;
					break;
				case 'c': // cubic Bézier curveto
					pathSegArrayPart.push
					({ pathSegTypeAsLetter: pathSegTypeAsLetter,
					   x: pathSeg.x, y: pathSeg.y,
					   x1: pathSeg.x1, y1: pathSeg.y1,
					   x2: pathSeg.x2, y2: pathSeg.y2 });
					previousCoordinates.x += pathSeg.x;
					previousCoordinates.y += pathSeg.y;
					break;
				case 'S': // smooth cubic curveto
					pathSegArrayPart.push
					({ pathSegTypeAsLetter: pathSegTypeAsLetter,
					   x: pathSeg.x, y: pathSeg.y,
					   x2: pathSeg.x2, y2: pathSeg.y2 });
					previousCoordinates.x = pathSeg.x;
					previousCoordinates.y = pathSeg.y;
					break;
				case 's': // smooth cubic curveto
					pathSegArrayPart.push
					({ pathSegTypeAsLetter: pathSegTypeAsLetter,
					   x: pathSeg.x, y: pathSeg.y,
					   x2: pathSeg.x2, y2: pathSeg.y2 });
					previousCoordinates.x += pathSeg.x;
					previousCoordinates.y += pathSeg.y;
					break;
				default:
					throw "unsupported path segment type '" + pathSegTypeAsLetter + "' used in arrow shape for a pathArrow command";
			}
		}
		if (partNumber < pathSegArrayParts.length - 1) {
			throw "not enough 'l' relative line to 0,0 markers in arrow shape for a pathArrow command";
		}
		var nockPathSegArray = arrowPathSegArrayParts[0];
		var leftPathSegArray = arrowPathSegArrayParts[1];
		var pointPathSegArray = arrowPathSegArrayParts[2];
		var rightPathSegArray = arrowPathSegArrayParts[3];
		var nockRightCorner = nockPathSegArray[0]; // while a PathSeg nevertheless has .x and .y like a point
		var nockLeftCorner = leftPathSegArray[0];
		var pointLeftCorner = pointPathSegArray[0];
		var pointRightCorner = rightPathSegArray[0];
		var nockBaseWidth = Adj.decimal(Math.sqrt(Math.pow(nockLeftCorner.x - nockRightCorner.x, 2) + Math.pow(nockLeftCorner.y - nockRightCorner.y, 2)), 3);
		var pointBaseWidth = Adj.decimal(Math.sqrt(Math.pow(pointRightCorner.x - pointLeftCorner.x, 2) + Math.pow(pointRightCorner.y - pointLeftCorner.y, 2)), 3);
		if (nockBaseWidth !== pointBaseWidth) {
			throw "mismatched nock width and point width in arrow shape for a pathArrow command";
		}
		var lineOffset = nockBaseWidth / 2;
		//
		var pathSegList = pathElement.pathSegList;
		var numberOfPathSegs = pathSegList.numberOfItems;
		if (numberOfPathSegs < 2) {
			throw "not enough path segments in path given to follow for a pathArrow command";
		}
		var leftPathSegArray = [];
		var rightPathSegArray = [];
		var previousCoordinates = theSvgElement.createSVGPoint(); // keep track for when needed for converting absolute to relative, initialized to 0,0
		var previousDirection;
		var previousLeftCoordinates = theSvgElement.createSVGPoint(); // initialized to 0,0
		var previousRightCoordinates = theSvgElement.createSVGPoint(); // initialized to 0,0
		var nextPathSeg = pathSegList.getItem(0);
		// first command in path data must be moveto and is absolute even if lowercase m would indicate relative
		if (nextPathSeg.pathSegTypeAsLetter.toUpperCase() === 'M') {
			nextPathSeg = { pathSegTypeAsLetter: 'M', x: nextPathSeg.x, y: nextPathSeg.y }; // normalize
		} else {
			throw "missing initial path segment type 'M' in path given to follow for a pathArrow command";
		}
		for (var index = 0; index < numberOfPathSegs; index++) {
			var pathSeg = nextPathSeg;
			var pathSegTypeAsLetter = pathSeg.pathSegTypeAsLetter;
			//
			// need exitCoordinates to be able to determine all kinds of nextDirection
			var exitCoordinates;
			switch (pathSegTypeAsLetter) {
				case 'M':
				case 'L':
				case 'C':
				case 'Q':
					exitCoordinates = { x: pathSeg.x, y: pathSeg.y };
					break;
					// if relative then would be
					//exitCoordinates = { x: previousCoordinates.x + pathSeg.x, y: previousCoordinates.y + pathSeg.y };
				default:
					// other and unsupported path segment types dealt with by nextPathSegTypeAsLetter
			}
			var nextDirection;
			var nextIndex = index + 1;
			if (nextIndex < numberOfPathSegs) {
				var nextPathSeg = pathSegList.getItem(nextIndex);
				var nextPathSegTypeAsLetter = nextPathSeg.pathSegTypeAsLetter;
				// while at it, make all absolute to ease reversing;
				// other sections of this method now depend on this section making all absolute
				switch (nextPathSegTypeAsLetter) {
					case 'L':
						nextDirection = { x: nextPathSeg.x - exitCoordinates.x, y: nextPathSeg.y - exitCoordinates.y };
						break;
					case 'C':
					case 'Q':
						nextDirection = { x: nextPathSeg.x1 - exitCoordinates.x, y: nextPathSeg.y1 - exitCoordinates.y };
						break;
					case 'l':
						nextDirection = { x: nextPathSeg.x, y: nextPathSeg.y };
						// make absolute
						nextPathSeg =
						{ pathSegTypeAsLetter: 'L',
						  x: exitCoordinates.x + nextPathSeg.x, y: exitCoordinates.y + nextPathSeg.y };
						break;
					case 'c':
						nextDirection = { x: nextPathSeg.x1, y: nextPathSeg.y1 };
						// make absolute
						nextPathSeg =
						{ pathSegTypeAsLetter: 'C',
						  x1: exitCoordinates.x + nextPathSeg.x1, y1: exitCoordinates.y + nextPathSeg.y1,
						  x2: exitCoordinates.x + nextPathSeg.x2, y2: exitCoordinates.y + nextPathSeg.y2,
						  x: exitCoordinates.x + nextPathSeg.x, y: exitCoordinates.y + nextPathSeg.y };
						break;
					case 'q':
						nextDirection = { x: nextPathSeg.x1, y: nextPathSeg.y1 };
						// make absolute
						nextPathSeg =
						{ pathSegTypeAsLetter: 'Q',
						  x1: exitCoordinates.x + nextPathSeg.x1, y1: exitCoordinates.y + nextPathSeg.y1,
						  x: exitCoordinates.x + nextPathSeg.x, y: exitCoordinates.y + nextPathSeg.y };
						break;
					case 'S':
						nextDirection = { x: pathSeg.x - pathSeg.x2, y: pathSeg.y - pathSeg.y2 };
						// replace shorthand to ease reversing
						nextPathSeg =
						{ pathSegTypeAsLetter: 'C',
						  x1: exitCoordinates.x + nextDirection.x, y1: exitCoordinates.y + nextDirection.y,
						  x2: nextPathSeg.x2, y2: nextPathSeg.y2,
						  x: nextPathSeg.x, y: nextPathSeg.y };
						break;
					case 's':
						nextDirection = { x: pathSeg.x - pathSeg.x2, y: pathSeg.y - pathSeg.y2 };
						// replace shorthand to ease reversing
						nextPathSeg =
						{ pathSegTypeAsLetter: 'C',
						  x1: exitCoordinates.x + nextDirection.x, y1: exitCoordinates.y + nextDirection.y,
						  x2: exitCoordinates.x + nextPathSeg.x2, y2: exitCoordinates.y + nextPathSeg.y2,
						  x: exitCoordinates.x + nextPathSeg.x, y: exitCoordinates.y + nextPathSeg.y };
						break;
					case 'T':
						nextDirection = { x: pathSeg.x - pathSeg.x1, y: pathSeg.y - pathSeg.y1 };
						// replace shorthand to ease reversing
						nextPathSeg =
						{ pathSegTypeAsLetter: 'Q',
						  x1: exitCoordinates.x + nextDirection.x, y1: exitCoordinates.y + nextDirection.y,
						  x: nextPathSeg.x, y: nextPathSeg.y };
						break;
					case 't':
						nextDirection = { x: pathSeg.x - pathSeg.x1, y: pathSeg.y - pathSeg.y1 };
						// replace shorthand to ease reversing
						nextPathSeg =
						{ pathSegTypeAsLetter: 'Q',
						  x1: exitCoordinates.x + nextDirection.x, y1: exitCoordinates.y + nextDirection.y,
						  x: exitCoordinates.x + nextPathSeg.x, y: exitCoordinates.y + nextPathSeg.y };
						break;
					case 'H':
						nextDirection = { x: nextPathSeg.x - exitCoordinates.x, y: 0 };
						// replace shorthand
						nextPathSeg =
						{ pathSegTypeAsLetter: 'L',
						  x: nextPathSeg.x, y: exitCoordinates.y };
						break;
					case 'h':
						nextDirection = { x: nextPathSeg.x, y: 0 };
						// replace shorthand
						nextPathSeg =
						{ pathSegTypeAsLetter: 'L',
						  x: exitCoordinates.x + nextPathSeg.x, y: exitCoordinates.y };
						break;
					case 'V':
						nextDirection = { x: 0, y: nextPathSeg.y - exitCoordinates.y };
						// replace shorthand
						nextPathSeg =
						{ pathSegTypeAsLetter: 'L',
						  x: exitCoordinates.x, y: nextPathSeg.y };
						break;
					case 'v':
						nextDirection = { x: 0, y: nextPathSeg.y };
						// replace shorthand
						nextPathSeg =
						{ pathSegTypeAsLetter: 'L',
						  x: exitCoordinates.x, y: exitCoordinates.y + nextPathSeg.y };
						break;
					case 'A': // elliptical arc, as implemented replace by a line
						nextDirection = { x: nextPathSeg.x - exitCoordinates.x, y: nextPathSeg.y - exitCoordinates.y };
						// replace
						nextPathSeg = { pathSegTypeAsLetter: 'L', x: exitCoordinates.x, y: exitCoordinates.y };
						break;
					case 'a': // elliptical arc, as implemented replace by a line
						nextDirection = { x: nextPathSeg.x, y: nextPathSeg.y };
						// replace
						nextPathSeg =
						{ pathSegTypeAsLetter: 'L',
						  x: exitCoordinates.x + nextPathSeg.x, y: exitCoordinates.y + nextPathSeg.y };
						break;
					case 'M': // moveto
					case 'm': // moveto
						throw "unsupported use of path segment type '" + nextPathSegTypeAsLetter + "' in path given to follow for a pathArrow command";
					case 'Z':  // closepath
					case 'z':
						// no support for closepath, for now at least
					default:
						throw "unsupported path segment type '" + nextPathSegTypeAsLetter + "' used in path given to follow for a pathArrow command";
				}
			} else { // nextIndex === numberOfPathSegs
				nextDirection = { x: 0, y: 0 };
			}
			//
			//var entryDirection;
			var exitDirection;
			var overallDirection;
			var coordinates1;
			var coordinates2;
			var rightAndLeftCoordinates;
			var rightAndLeftCoordinates1;
			var rightAndLeftCoordinates2;
			var rightCoordinates;
			var rightCoordinates1;
			var rightCoordinates2;
			var leftCoordinates;
			var leftCoordinates1;
			var leftCoordinates2;
			var nockRightAndLeftCoordinates;
			var pointRightAndLeftCoordinates;
			switch (pathSegTypeAsLetter) {
				case 'L': // lineto
					exitDirection = { x: exitCoordinates.x - previousCoordinates.x, y: exitCoordinates.y - previousCoordinates.y };
					if (nextIndex === numberOfPathSegs && pointSetback) {
						Adj.shiftPoint(exitCoordinates, -pointSetback, exitDirection);
					}
					//
					rightAndLeftCoordinates =
						Adj.rightAndLeftOffsetPoints
						(exitCoordinates, lineOffset, exitDirection, nextDirection);
					rightCoordinates = rightAndLeftCoordinates.right;
					leftCoordinates = rightAndLeftCoordinates.left;
					//
					leftPathSegArray.push
					({ pathSegTypeAsLetter: 'L',
					   x: leftCoordinates.x, y: leftCoordinates.y });
					rightPathSegArray.push
					({ pathSegTypeAsLetter: 'L',
					   x: rightCoordinates.x, y: rightCoordinates.y });
					break;
				case 'C': // cubic Bézier curveto
					exitDirection = { x: exitCoordinates.x - pathSeg.x2, y: exitCoordinates.y - pathSeg.y2 };
					overallDirection = { x: exitCoordinates.x - previousCoordinates.x, y: exitCoordinates.y - previousCoordinates.y };
					coordinates1 = new Adj.Point(pathSeg.x1, pathSeg.y1);
					coordinates2 = new Adj.Point(pathSeg.x2, pathSeg.y2);
					if (nextIndex === numberOfPathSegs && pointSetback) {
						Adj.shiftPoint(exitCoordinates, -pointSetback, exitDirection);
					}
					//
					rightAndLeftCoordinates =
						Adj.rightAndLeftOffsetPoints
						(exitCoordinates, lineOffset, exitDirection, nextDirection);
					rightCoordinates = rightAndLeftCoordinates.right;
					leftCoordinates = rightAndLeftCoordinates.left;
					//
					rightAndLeftCoordinates1 =
						Adj.rightAndLeftOffsetPoints
						(coordinates1, lineOffset, overallDirection);
					rightCoordinates1 = rightAndLeftCoordinates1.right;
					leftCoordinates1 = rightAndLeftCoordinates1.left;
					//
					rightAndLeftCoordinates2 =
						Adj.rightAndLeftOffsetPoints
						(coordinates2, lineOffset, overallDirection);
					rightCoordinates2 = rightAndLeftCoordinates2.right;
					leftCoordinates2 = rightAndLeftCoordinates2.left;
					//
					leftPathSegArray.push
					({ pathSegTypeAsLetter: 'C',
					   x1: leftCoordinates1.x, y1: leftCoordinates1.y,
					   x2: leftCoordinates2.x, y2: leftCoordinates2.y,
					   x: leftCoordinates.x, y: leftCoordinates.y });
					rightPathSegArray.push
					({ pathSegTypeAsLetter: 'C',
					   x1: rightCoordinates1.x, y1: rightCoordinates1.y,
					   x2: rightCoordinates2.x, y2: rightCoordinates2.y,
					   x: rightCoordinates.x, y: rightCoordinates.y });
					break;
				case 'Q': // quadratic Bézier curveto
					exitDirection = { x: exitCoordinates.x - pathSeg.x1, y: exitCoordinates.y - pathSeg.y1 };
					overallDirection = { x: exitCoordinates.x - previousCoordinates.x, y: exitCoordinates.y - previousCoordinates.y };
					coordinates1 = new Adj.Point(pathSeg.x1, pathSeg.y1);
					if (nextIndex === numberOfPathSegs && pointSetback) {
						Adj.shiftPoint(exitCoordinates, -pointSetback, exitDirection);
					}
					//
					rightAndLeftCoordinates =
						Adj.rightAndLeftOffsetPoints
						(exitCoordinates, lineOffset, exitDirection, nextDirection);
					rightCoordinates = rightAndLeftCoordinates.right;
					leftCoordinates = rightAndLeftCoordinates.left;
					//
					rightAndLeftCoordinates1 =
						Adj.rightAndLeftOffsetPoints
						(coordinates1, lineOffset, overallDirection);
					rightCoordinates1 = rightAndLeftCoordinates1.right;
					leftCoordinates1 = rightAndLeftCoordinates1.left;
					//
					leftPathSegArray.push
					({ pathSegTypeAsLetter: 'Q',
					   x1: leftCoordinates1.x, y1: leftCoordinates1.y,
					   x: leftCoordinates.x, y: leftCoordinates.y });
					rightPathSegArray.push
					({ pathSegTypeAsLetter: 'Q',
					   x1: rightCoordinates1.x, y1: rightCoordinates1.y,
					   x: rightCoordinates.x, y: rightCoordinates.y });
					break;
				case 'M': // moveto
					// as implemented getting here means first path segment
					exitDirection = nextDirection;
					if (index === 0 && nockSetback) {
						Adj.shiftPoint(exitCoordinates, nockSetback, nextDirection);
					}
					//
					rightAndLeftCoordinates =
						Adj.rightAndLeftOffsetPoints
						(exitCoordinates, lineOffset, nextDirection);
					rightCoordinates = rightAndLeftCoordinates.right;
					leftCoordinates = rightAndLeftCoordinates.left;
					//
					leftPathSegArray.push
					({ pathSegTypeAsLetter: 'M',
					   x: leftCoordinates.x, y: leftCoordinates.y });
					rightPathSegArray.push
					({ pathSegTypeAsLetter: 'M',
					   x: rightCoordinates.x, y: rightCoordinates.y });
					if (index === 0) {
						nockRightAndLeftCoordinates = rightAndLeftCoordinates;
					}
					break;
				default:
					// other and unsupported path segment types dealt with by nextPathSegTypeAsLetter
			}
			pointRightAndLeftCoordinates = rightAndLeftCoordinates;
			//
			// iterate
			previousCoordinates = exitCoordinates;
			previousDirection = exitDirection;
			previousLeftCoordinates = leftCoordinates;
			previousRightCoordinates = rightCoordinates;
		}
		//
		rightPathSegArray = Adj.reversePathSegList(new Adj.PathSegList(rightPathSegArray));
		//
		var nockRightCornerOnPath = nockRightAndLeftCoordinates.right;
		var nockDirection = nockRightAndLeftCoordinates.direction;
		var nockPlacementMatrix =
			theSvgElement.createSVGMatrix()
			.translate(nockRightCornerOnPath.x, nockRightCornerOnPath.y)
			.rotate(Math.atan2(nockDirection.y, nockDirection.x) * 180 / Math.PI)
			.translate(-nockRightCorner.x, -nockRightCorner.y);
		nockPathSegArray = Adj.transformPathSegList(new Adj.PathSegList(nockPathSegArray), nockPlacementMatrix);
		//
		var pointLeftCornerOnPath = pointRightAndLeftCoordinates.left;
		var pointDirection = pointRightAndLeftCoordinates.direction;
		var pointPlacementMatrix =
			theSvgElement.createSVGMatrix()
			.translate(pointLeftCornerOnPath.x, pointLeftCornerOnPath.y)
			.rotate(Math.atan2(pointDirection.y, pointDirection.x) * 180 / Math.PI)
			.translate(-pointLeftCorner.x, -pointLeftCorner.y);
		pointPathSegArray = Adj.transformPathSegList(new Adj.PathSegList(pointPathSegArray), pointPlacementMatrix);
		//
		leftPathSegArray[0].pathSegTypeAsLetter = 'L';
		pointPathSegArray[0].pathSegTypeAsLetter = 'L';
		rightPathSegArray[0].pathSegTypeAsLetter = 'L';
		var pathSegArray = nockPathSegArray.concat(leftPathSegArray, pointPathSegArray, rightPathSegArray);
		var d = Adj.pathSegListToDString(new Adj.PathSegList(pathSegArray));
		Adj.setAttributeTransformMatrix(arrowElement, matrixFromPathElement);
		arrowElement.setAttribute("d", d);
		//
		// explain
		if (explain) {
			var explanationGElement = Adj.createExplanationElement(parent, "g");
			Adj.setAttributeTransformMatrix(explanationGElement, matrixFromPathElement);
			parent.appendChild(explanationGElement);
			//
			var explanationPathSeg = nockPathSegArray[0];
			explanationGElement.appendChild(Adj.createExplanationPointCircle(parent, explanationPathSeg.x, explanationPathSeg.y, "green"));
			explanationPathSeg = leftPathSegArray[0];
			explanationGElement.appendChild(Adj.createExplanationPointCircle(parent, explanationPathSeg.x, explanationPathSeg.y, "blue"));
			explanationPathSeg = pointPathSegArray[0];
			explanationGElement.appendChild(Adj.createExplanationPointCircle(parent, explanationPathSeg.x, explanationPathSeg.y, "blue"));
			explanationPathSeg = rightPathSegArray[0];
			explanationGElement.appendChild(Adj.createExplanationPointCircle(parent, explanationPathSeg.x, explanationPathSeg.y, "red"));
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "rcGrid",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["gap",
				 "horizontalGap", "leftGap", "centerGap", "rightGap",
				 "verticalGap", "topGap", "middleGap", "bottomGap",
				 "hAlign", "vAlign",
				 "cellLeftGap", "cellRightGap", "cellTopGap", "cellBottomGap",
				 "rcGridPart",
				 "explain"],
	methods: [function rcGrid (element, parametersObject) {
		var ownerDocument = element.ownerDocument;
		//
		var usedHow = "used in a parameter for an rcGrid command";
		var variableSubstitutionsByName = {};
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 3, null, usedHow, variableSubstitutionsByName); // default gap = 3
		var horizontalGap = Adj.doVarsArithmetic(element, parametersObject.horizontalGap, gap, null, usedHow, variableSubstitutionsByName); // default horizontalGap = gap
		var leftGap = Adj.doVarsArithmetic(element, parametersObject.leftGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default leftGap = horizontalGap
		var centerGap = Adj.doVarsArithmetic(element, parametersObject.centerGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default centerGap = horizontalGap
		var rightGap = Adj.doVarsArithmetic(element, parametersObject.rightGap, horizontalGap, null, usedHow, variableSubstitutionsByName); // default rightGap = horizontalGap
		var verticalGap = Adj.doVarsArithmetic(element, parametersObject.verticalGap, gap, null, usedHow, variableSubstitutionsByName); // default verticalGap = gap
		var topGap = Adj.doVarsArithmetic(element, parametersObject.topGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default topGap = verticalGap
		var middleGap = Adj.doVarsArithmetic(element, parametersObject.middleGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default middleGap = verticalGap
		var bottomGap = Adj.doVarsArithmetic(element, parametersObject.bottomGap, verticalGap, null, usedHow, variableSubstitutionsByName); // default bottomGap = verticalGap
		var hAlign = Adj.doVarsArithmetic(element, parametersObject.hAlign, 0.5, Adj.leftCenterRight, usedHow, variableSubstitutionsByName); // hAlign could be a number, default hAlign 0.5 == center
		var vAlign = Adj.doVarsArithmetic(element, parametersObject.vAlign, 0.5, Adj.topMiddleBottom, usedHow, variableSubstitutionsByName); // vAlign could be a number, default vAlign 0.5 == middle
		var cellLeftGap = Adj.doVarsArithmetic(element, parametersObject.cellLeftGap, Math.floor(centerGap / 2), null, usedHow, variableSubstitutionsByName); // default cellLeftGap = Math.floor(centerGap / 2)
		var cellRightGap = Adj.doVarsArithmetic(element, parametersObject.cellRightGap, Math.floor(centerGap / 2), null, usedHow, variableSubstitutionsByName); // default cellRightGap = Math.floor(centerGap / 2)
		var cellTopGap = Adj.doVarsArithmetic(element, parametersObject.cellTopGap, Math.floor(middleGap / 2), null, usedHow, variableSubstitutionsByName); // default cellTopGap = Math.floor(middleGap / 2)
		var cellBottomGap = Adj.doVarsArithmetic(element, parametersObject.cellBottomGap, Math.floor(middleGap / 2), null, usedHow, variableSubstitutionsByName); // default cellBottomGap = Math.floor(middleGap / 2)
		var defaultPartType = parametersObject.rcGridPart || "row";
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		switch (defaultPartType) {
			case "column":
			case "row":
				break;
			default:
				throw "attribute adj:rcGridPart= has invalid value \"" + defaultPartType + "\"";
		}
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping hiddenRect and skipping notAnOrder1Element
		var hiddenRect;
		var partRecords = []; // similar to childRecords in other algorithms
		var partColumn;
		var partRow;
		var previousPartType;
		var maxRow = -1; // inclusive
		var columns = [];
		var rows = [];
		var columnWidths = [];
		var columnLeftGaps = [];
		var columnRightGaps = [];
		var rowHeights = [];
		var rowTopGaps = [];
		var rowBottomGaps = [];
		var cellTemplates = [];
		// loop through children, which are parts
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (child instanceof Element) { // if an XML element, e.g. not an XML #text
				var childName = Adj.elementNameInAdjNS(child);
				if (childName) { // if an Adj element
					if (childName === "rcGridCellTemplates") {
						cellTemplates = [];
						// loop through grandchildren
						for (var grandchild = child.firstChild; grandchild; grandchild = grandchild.nextSibling) {
							if (!(grandchild instanceof Element)) {
								continue; // skip if not an Element, e.g. an XML #text
							}
							var grandchildName = Adj.elementNameInAdjNS(grandchild);
							if (!grandchildName) {
								continue; // skip if not an Adj element
							}
							if (grandchildName === "rcGridCellTemplate") {
								usedHow = "used in a parameter for an rcGridCellTemplate";
								var templateParametersObject = Adj.collectParameters(grandchild);
								var cellTemplate = {};
								cellTemplate.hAlign = Adj.doVarsArithmetic(grandchild, templateParametersObject.hAlign, undefined, Adj.leftCenterRight, usedHow, variableSubstitutionsByName);
								cellTemplate.vAlign = Adj.doVarsArithmetic(grandchild, templateParametersObject.vAlign, undefined, Adj.topMiddleBottom, usedHow, variableSubstitutionsByName);
								cellTemplate.cellLeftGap = Adj.doVarsArithmetic(grandchild, templateParametersObject.cellLeftGap, undefined, null, usedHow, variableSubstitutionsByName);
								cellTemplate.cellRightGap = Adj.doVarsArithmetic(grandchild, templateParametersObject.cellRightGap, undefined, null, usedHow, variableSubstitutionsByName);
								cellTemplate.cellTopGap = Adj.doVarsArithmetic(grandchild, templateParametersObject.cellTopGap, undefined, null, usedHow, variableSubstitutionsByName);
								cellTemplate.cellBottomGap = Adj.doVarsArithmetic(grandchild, templateParametersObject.cellBottomGap, undefined, null, usedHow, variableSubstitutionsByName);
								for (var propertyName in cellTemplate) {
									if (cellTemplate[propertyName] === undefined) {
										delete cellTemplate[propertyName];
									}
								}
								cellTemplates.push(cellTemplate);
							}
						}
						//console.log(cellTemplates);
					}
				}
			}
			//
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			if (child.adjHiddenByCommand) {
				continue;
			}
			if (!(child instanceof SVGGElement)) {
				throw "child of rcGrid must be g, not " + child.tagName;
			}
			// was var partType = Adj.elementGetAttributeInAdjNS(child, "rcGridPart");
			var partParametersObject = Adj.parametersFromAttributes(Adj.adjAttributesByNameOf(child));
			var partType = partParametersObject.rcGridPart;
			switch (partType) {
				case null:
				case undefined:
					//throw "required attribute adj:rcGridPart= missing in child of rcGrid";
					partType = defaultPartType;
			}
			switch (partType) {
				case "column":
					switch (previousPartType) {
						case "column":
							partColumn++; // increment even if nothing in column, an implementation choice, risky to change later on
							break;
						case "row":
							partColumn = 0;
							partRow = ++maxRow; // increment even if nothing in column, an implementation choice, risky to change later on
							cellTemplates = []; // reset
							break;
						default:
							partColumn = 0;
							partRow = 0;
					}
					usedHow = "used in a parameter for an rcGridPart column";
					break;
				case "row":
					partColumn = 0; // implementation choice for simplicity, for now at least
					partRow = ++maxRow; // increment even if nothing in row, an implementation choice, risky to change later on
					switch (previousPartType) {
						case "column":
							cellTemplates = []; // reset
					}
					usedHow = "used in a parameter for an rcGridPart row";
					break;
				case "":
				default:
					throw "attribute adj:rcGridPart= has invalid value \"" + partType + "\"";
			}
			//
			var partTemplate = {};
			partTemplate.hAlign = Adj.doVarsArithmetic(child, partParametersObject.hAlign, hAlign, Adj.leftCenterRight, usedHow, variableSubstitutionsByName);
			partTemplate.vAlign = Adj.doVarsArithmetic(child, partParametersObject.vAlign, vAlign, Adj.topMiddleBottom, usedHow, variableSubstitutionsByName);
			partTemplate.cellLeftGap = Adj.doVarsArithmetic(child, partParametersObject.cellLeftGap, cellLeftGap, null, usedHow, variableSubstitutionsByName);
			partTemplate.cellRightGap = Adj.doVarsArithmetic(child, partParametersObject.cellRightGap, cellRightGap, null, usedHow, variableSubstitutionsByName);
			partTemplate.cellTopGap = Adj.doVarsArithmetic(child, partParametersObject.cellTopGap, cellTopGap, null, usedHow, variableSubstitutionsByName);
			partTemplate.cellBottomGap = Adj.doVarsArithmetic(child, partParametersObject.cellBottomGap, cellBottomGap, null, usedHow, variableSubstitutionsByName);
			//
			var grandchildAfterHiddenRect = null; // must be null
			var cellRecords = []; // similar to what would we grandchildRecords in other algorithms
			var cellColumn = partColumn;
			var cellRow = partRow;
			var cellInPartIndex = 0;
			// loop through grandchildren, which are cells
			for (var grandchild = child.firstChild; grandchild; grandchild = grandchild.nextSibling) {
				if (!(grandchild instanceof SVGElement)) {
					continue; // skip if not an SVGElement, e.g. an XML #text
				}
				if (!grandchild.getBBox) {
					continue; // skip if not an SVGLocatable, e.g. a <script> element
				}
				if (!grandchildAfterHiddenRect) { // needs a hidden rect, chose to require it to be first
					grandchildAfterHiddenRect = grandchild;
				}
				if (grandchild.adjNotAnOrder1Element) {
					continue;
				}
				if (grandchild.adjHiddenByCommand) {
					continue;
				}
				//
				var cellParameters = Object.create(partTemplate);
				var cellTemplate = cellTemplates[cellInPartIndex];
				for (var propertyName in cellTemplate) {
					cellParameters[propertyName] = cellTemplate[propertyName];
				}
				//
				var boundingBox = grandchild.getBBox();
				var cellRecord = {
					boundingBox: boundingBox,
					node: grandchild,
					//
					column: cellColumn,
					row: cellRow,
					//
					parameters: cellParameters
				}
				//
				var column = columns[cellColumn] || (columns[cellColumn] = []);
				column[cellRow] = cellRecord;
				var row = rows[cellRow] || (rows[cellRow] = []);
				row[cellColumn] = cellRecord;
				//
				while (columnWidths.length <= cellColumn) {
					columnWidths.push(0);
					columnLeftGaps.push(0);
					columnRightGaps.push(0);
				}
				columnWidths[cellColumn] = Math.max(columnWidths[cellColumn], boundingBox.width);
				columnLeftGaps[cellColumn] = Math.max(columnLeftGaps[cellColumn], cellParameters.cellLeftGap);
				columnRightGaps[cellColumn] = Math.max(columnRightGaps[cellColumn], cellParameters.cellRightGap);
				while (rowHeights.length <= cellRow) {
					rowHeights.push(0);
					rowTopGaps.push(0);
					rowBottomGaps.push(0);
				}
				rowHeights[cellRow] = Math.max(rowHeights[cellRow], boundingBox.height);
				rowTopGaps[cellRow] = Math.max(rowTopGaps[cellRow], cellParameters.cellTopGap);
				rowBottomGaps[cellRow] = Math.max(rowBottomGaps[cellRow], cellParameters.cellBottomGap);
				//
				cellRecords.push(cellRecord);
				//
				switch (partType) {
					case "column":
						if (cellRow > maxRow) {
							maxRow = cellRow;
						}
						cellRow++;
						break;
					case "row":
						cellColumn++;
						break;
					// never should get here with any other partType
				}
				cellInPartIndex++;
			}
			// make hidden rect
			var partHiddenRect = Adj.createSVGElement(ownerDocument, "rect", {adjPlacementArtifact:true});
			partHiddenRect.setAttribute("width", 0);
			partHiddenRect.setAttribute("height", 0);
			partHiddenRect.setAttribute("visibility", "hidden");
			child.insertBefore(partHiddenRect, grandchildAfterHiddenRect);
			//
			partRecords.push({
				boundingBox: child.getBBox(),
				node: child,
				//
				hiddenRect: partHiddenRect,
				cellRecords: cellRecords,
				//
				type: partType,
				column: partColumn,
				row: partRow,
				//
				// was partTemplate: partTemplate
			});
			previousPartType = partType;
		}
		//
		// process
		var numberOfColumns = columns.length;
		var numberOfColumns1 = numberOfColumns - 1;
		var numberOfRows = rows.length;
		var numberOfRows1 = numberOfRows - 1;
		//
		if (numberOfColumns) { // !== 0
			leftGap = Math.max(leftGap, columnLeftGaps[0]);
			rightGap = Math.max(rightGap, columnRightGaps[numberOfColumns1]);
		}
		if (numberOfRows) { // !== 0
			topGap = Math.max(topGap, rowTopGaps[0]);
			bottomGap = Math.max(bottomGap, rowBottomGaps[numberOfRows1]);
		}
		//
		var columnXs = [ leftGap ];
		for (var i = 0, n = numberOfColumns - 1; i < n; i++) {
			columnXs.push(columnXs[i] + columnWidths[i] + columnRightGaps[i] + columnLeftGaps[i + 1]);
		}
		var rowYs = [ topGap ];
		for (var i = 0, n = numberOfRows; i < n; i++) {
			rowYs.push(rowYs[i] + rowHeights[i] + rowBottomGaps[i] + rowTopGaps[i + 1]);
		}
		//
		for (var partRecordIndex in partRecords) {
			var partRecord = partRecords[partRecordIndex];
			var cellRecords = partRecord.cellRecords;
			for (var cellRecordIndex in cellRecords) {
				var cellRecord = cellRecords[cellRecordIndex];
				var cellBoundingBox = cellRecord.boundingBox;
				var cellElement = cellRecord.node;
				var cellColumn = cellRecord.column;
				var cellRow = cellRecord.row;
				var cellParameters = cellRecord.parameters;
				var columnX = columnXs[cellColumn];
				var rowY = rowYs[cellRow];
				var columnWidth = columnWidths[cellColumn];
				var rowHeight = rowHeights[cellRow];
				var cellX = cellBoundingBox.x;
				var cellY = cellBoundingBox.y;
				var cellWidth = cellBoundingBox.width;
				var cellHeight = cellBoundingBox.height;
				// now we know where to put it
				var translationX = columnX - cellX + Adj.fraction(0, columnWidth - cellWidth, cellParameters.hAlign);
				var translationY = rowY - cellY + Adj.fraction(0, rowHeight - cellHeight, cellParameters.vAlign);
				cellElement.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
			}
			//
			// size hidden rect for having a good bounding box when elsewhere this part's getBBox() gets called, e.g. from a frameForParent
			var partHiddenRect = partRecord.hiddenRect;
			if (partHiddenRect) {
				if (cellRecords.length) {
					var firstCellRecord = cellRecords[0];
					var lastCellRecord = cellRecords[cellRecords.length - 1];
					var column1 = firstCellRecord.column;
					var row1 = firstCellRecord.row;
					var column2 = lastCellRecord.column;
					var row2 = lastCellRecord.row;
					var x1 = columnXs[column1] - columnLeftGaps[column1];
					var y1 = rowYs[row1] - rowTopGaps[row1];
					var x2 = columnXs[column2] + columnWidths[column2] + columnRightGaps[column2];
					var y2 = rowYs[row2] + rowHeights[row2] + rowBottomGaps[row2];
				} else { // cellRecords.length === 0
					var partType = partRecord.type;
					var partColumn = partRecord.column;
					var partRow = partRecord.row;
					var x1 = columnXs[partColumn] - columnLeftGaps[partColumn];
					var y1 = rowYs[partRow] - rowTopGaps[partRow];
					var x2 = columnXs[partColumn] + columnRightGaps[partColumn];
					var y2 = rowYs[partRow] + rowBottomGaps[partRow];
					switch (partType) {
						case "column":
							x2 += columnWidths[partColumn];
							break;
						case "row":
							y2 += rowHeights[partRow];
							break;
						// never should get here with any other partType
					}
				}
				var partWidth = x2 - x1;
				var partHeight = y2 - y1;
				partHiddenRect.setAttribute("x", Adj.decimal(x1));
				partHiddenRect.setAttribute("y", Adj.decimal(y1));
				partHiddenRect.setAttribute("width", Adj.decimal(partWidth));
				partHiddenRect.setAttribute("height", Adj.decimal(partHeight));
				// explain
				if (explain) {
					partRecord.explainRect = {
						x: x1,
						y: y1,
						width: partWidth,
						height: partHeight
					};
				}
			}
		}
		//
		// size the hidden rect for having a good bounding box when from a level up this element's getBBox() gets called
		if (hiddenRect) {
			var totalWidth = Adj.decimal((numberOfColumns ? columnXs[numberOfColumns1] + columnWidths[numberOfColumns1] : leftGap) + rightGap);
			var totalHeight = Adj.decimal((numberOfRows ? rowYs[numberOfRows1] + rowHeights[numberOfRows1] : topGap) + bottomGap);
			hiddenRect.setAttribute("x", 0);
			hiddenRect.setAttribute("y", 0);
			hiddenRect.setAttribute("width", totalWidth);
			hiddenRect.setAttribute("height", totalHeight);
			// explain
			if (explain) {
				var explainRect = {
					x: 0,
					y: 0,
					width: totalWidth,
					height: totalHeight
				};
			}
		}
		//
		// explain
		if (explain) {
			if (explainRect) {
				var explanationElement = Adj.createExplanationElement(element, "rect");
				explanationElement.setAttribute("x", 0);
				explanationElement.setAttribute("y", 0);
				explanationElement.setAttribute("width", explainRect.width);
				explanationElement.setAttribute("height", explainRect.height);
				explanationElement.setAttribute("fill", "white");
				explanationElement.setAttribute("fill-opacity", "0.1");
				explanationElement.setAttribute("stroke", "blue");
				explanationElement.setAttribute("stroke-width", "1");
				explanationElement.setAttribute("stroke-opacity", "0.2");
				element.appendChild(explanationElement);
			}
			for (var partRecordIndex in partRecords) {
				var partRecord = partRecords[partRecordIndex];
				var partExplainRect = partRecord.explainRect;
				if (partExplainRect) {
					var explanationElement = Adj.createExplanationElement(element, "rect");
					explanationElement.setAttribute("x", Adj.decimal(partExplainRect.x));
					explanationElement.setAttribute("y", Adj.decimal(partExplainRect.y));
					explanationElement.setAttribute("width", Adj.decimal(partExplainRect.width));
					explanationElement.setAttribute("height", Adj.decimal(partExplainRect.height));
					explanationElement.setAttribute("fill", "blue");
					explanationElement.setAttribute("fill-opacity", "0.1");
					explanationElement.setAttribute("stroke", "blue");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.1");
					element.appendChild(explanationElement);
				}
			}
		}
	}]
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "rcGridCellTemplates",
	phaseHandlerNames: [], // actual processing done in Adj.algorithms.rcGrid, for now
	parameters: [],
	methods: []
});

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "rcGridCellTemplate",
	phaseHandlerNames: [], // actual processing done in Adj.algorithms.rcGrid, for now
	parameters: ["hAlign", "vAlign",
				 "cellLeftGap", "cellRightGap", "cellTopGap", "cellBottomGap"],
	methods: []
});

// utility
Adj.setGlobalCursor = function setCursor (newCursor) {
	document.documentElement.style.cursor = newCursor;
}
Adj.unsetGlobalCursor = function unsetCursor () {
	document.documentElement.style.cursor = "";
}

// one event listener function to be installed for document,
// only one element can be dragged at a time,
// mouseup and mousemove event may occur outside the dragged element
Adj.documentDraggedListener = function documentDraggedListener (event) {
	var type = event.type;
	var target = event.target;
	var ownerDocument = target.ownerDocument;
	var dragged = ownerDocument.adjDragged;
	switch (type) {
		case "mouseup":
			if (!dragged) { // a mousemove for another reason
				// fast exit
				return true;
			}
			//console.log(type);
			Adj.unsetGlobalCursor();
			var draggedMouseUpListener = dragged.draggedMouseUpListener;
			if (draggedMouseUpListener) {
				return draggedMouseUpListener(event);
			}
			ownerDocument.adjDragged = null;
			return true;
		case "mousemove":
			if (!dragged) { // a mousemove for another reason
				// fast exit
				return true;
			}
			var draggedMouseMoveListener = dragged.draggedMouseMoveListener;
			if (draggedMouseMoveListener) {
				return draggedMouseMoveListener(event);
			}
			return true;
	}
	return true;
}
document.addEventListener("mouseup", Adj.documentDraggedListener);
document.addEventListener("mousemove", Adj.documentDraggedListener);

// companion class
Adj.SliderKnob = function SliderKnob (knob, min, max, step) {
	this.knob = knob;
	// must be step before min before max
	this.step = Math.abs(step);
	this.min = min = Math.ceil(min / step) * step;
	this.max = max = Math.max(Math.floor(max / step) * step, min);
	this.range = max - min;
};
Object.defineProperty(Adj.SliderKnob.prototype, "value", {
	get: function() {
		return this._value;
	},
	set: function(value) {
		var step = this.step;
		var previousValue = this.value;
		var newValue = Math.min(Math.max(Math.round(value / step) * step, this.min), this.max);
		if (newValue !== previousValue) {
			this._value = newValue;
			this.update();
			//
			var knob = this.knob;
			// https://developer.mozilla.org/en-US/docs/Web/API/Document/createEvent
			var event = knob.ownerDocument.createEvent("Event");
			event.initEvent("change", true, true);
			event.detail = { value: this.value };
			// per https://developer.mozilla.org/en-US/docs/Web/API/EventTarget/dispatchEvent
			// event handlers run on a nested call stack: they block the caller until they complete,
			// but exceptions do not propagate to the caller
			knob.dispatchEvent(event);
		}
	}
});
Adj.SliderKnob.prototype.update = function sliderKnobUpdate () {
	var knob = this.knob;
	var slider = knob.parentNode;
	var sliderBoundingBox = slider.getBBox();
	var knobBoundingBox = knob.getBBox();
	var sliderX = sliderBoundingBox.x;
	var sliderY = sliderBoundingBox.y;
	var freedomW = sliderBoundingBox.width - knobBoundingBox.width;
	var freedomH = sliderBoundingBox.height - knobBoundingBox.height;
	if (freedomW >= freedomH) {
		var orientation = "horizontal";
		var freedom = freedomW;
	} else {
		orientation = "vertical";
		freedom = freedomH;
	}
	if (this.range) {
		var offset = (this.value - this.min) / this.range * freedom;
	} else {
		offset = freedom / 2;
	}
	switch (orientation) {
		case "horizontal":
			var positionX = sliderX + offset;
			var positionY = sliderY + freedomH / 2;
			var cursor = "ew-resize";
			break;
		case "vertical":
			positionX = sliderX + freedomW / 2;
			positionY = sliderY + offset;
			cursor = "ns-resize";
			break;
	}
	var translateX = positionX - knobBoundingBox.x;
	var translateY = positionY - knobBoundingBox.y;
	// now we know where to put it
	knob.setAttribute("transform", "translate(" + Adj.decimal(translateX) + "," + Adj.decimal(translateY) + ")");
	knob.style.cursor = cursor;
};
Adj.SliderKnob.prototype.interpret = function sliderKnobInterpret (translateX, translateY) {
	var knob = this.knob;
	var sliderBoundingBox = knob.parentNode.getBBox();
	var knobBoundingBox = knob.getBBox();
	var freedomW = sliderBoundingBox.width - knobBoundingBox.width;
	var freedomH = sliderBoundingBox.height - knobBoundingBox.height;
	if (freedomW >= freedomH) { // horizontal
		var freedom = freedomW;
		var offset = translateX + knobBoundingBox.x - sliderBoundingBox.x;
	} else { // vertical
		freedom = freedomH;
		offset = translateY + knobBoundingBox.y - sliderBoundingBox.y;
	}
	return this.min + offset / freedom * this.range; // value
};

// one event listener function to be installed for any element that needs it
Adj.sliderKnobListener = function sliderKnobListener (event) {
	var type = event.type;
	var target = event.target;
	var ownerDocument = target.ownerDocument;
	switch (type) {
		case "mousedown":
			var knob = target;
			while (true) {
				var adjS = knob.adjS;
				if (adjS) {
					var sliderKnobRecord = adjS.sliderKnobRecord;
					if (sliderKnobRecord) { // found containing knob element
						break;
					}
				}
				knob = knob.parentNode;
				if (!knob) {
					return true;
				}
			}
			var slider = knob.parentNode;
			// relative coordinates must be transformed without translation's e and f
			var clientToSliderMatrixWithoutEF = slider.getScreenCTM().inverse();
			clientToSliderMatrixWithoutEF.e = 0;
			clientToSliderMatrixWithoutEF.f = 0;
			// only one element can be dragged at a time
			ownerDocument.adjDragged = {
				draggedMouseUpListener: knob.adjDraggedMouseUpListener,
				draggedMouseMoveListener: knob.adjDraggedMouseMoveListener,
				//
				knob: knob,
				initialPageXY: new Adj.Point(event.pageX, event.pageY),
				initialKnobToSliderMatrix: knob.getTransformToElement(slider),
				clientToSliderMatrixWithoutEF: clientToSliderMatrixWithoutEF,
			};
			Adj.setGlobalCursor(knob.style.cursor);
			//console.log(type, knob);
			return false;
		case "mouseup":
			//console.log(type);
			var dragged = ownerDocument.adjDragged;
			if (dragged) {
				ownerDocument.adjDragged = null;
				return false;
			}
			return true;
		case "mousemove":
			var dragged = ownerDocument.adjDragged;
			if (!dragged) { // a mousemove for another reason
				// fast exit
				return true;
			}
			var knob = dragged.knob;
			if (!knob) { // dragging something else
				return true;
			}
			var adjS = knob.adjS;
			if (!adjS) { // dragging something else
				return true;
			}
			var sliderKnobRecord = adjS.sliderKnobRecord;
			if (!sliderKnobRecord) { // dragging something else
				return true;
			}
			if (knob.ownerDocument !== ownerDocument) {
				// defensive exit for possible oddity
				ownerDocument.adjDragged = null;
				return true;
			}
			// could further check knob.
			var initialKnobToSliderMatrix = dragged.initialKnobToSliderMatrix;
			var mouseRelativeToInitial = new Adj.Point(event.pageX - dragged.initialPageXY.x, event.pageY - dragged.initialPageXY.y);
			mouseRelativeToInitial = mouseRelativeToInitial.matrixTransform(dragged.clientToSliderMatrixWithoutEF);
			// new translate
			var translateX = initialKnobToSliderMatrix.e + mouseRelativeToInitial.x;
			var translateY = initialKnobToSliderMatrix.f + mouseRelativeToInitial.y;
			// limit range
			var slider = knob.parentNode;
			var sliderBoundingBox = slider.getBBox();
			var knobBoundingBox = knob.getBBox();
			var sliderX = sliderBoundingBox.x;
			var sliderY = sliderBoundingBox.y;
			var sliderXW = sliderX + sliderBoundingBox.width;
			var sliderYH = sliderY + sliderBoundingBox.height;
			var knobX = knobBoundingBox.x;
			var knobY = knobBoundingBox.y;
			var knobXW = knobX + knobBoundingBox.width;
			var knobYH = knobY + knobBoundingBox.height;
			if (knobXW + translateX > sliderXW) {
				translateX = sliderXW - knobXW;
			}
			if (knobX + translateX < sliderX) {
				translateX = sliderX - knobX;
			}
			if (knobYH + translateY > sliderYH) {
				translateY = sliderYH - knobYH;
			}
			if (knobY + translateY < sliderY) {
				translateY = sliderY - knobY;
			}
			// now we know where to put it
			// was knob.setAttribute("transform", "translate(" + Adj.decimal(translateX) + "," + Adj.decimal(translateY) + ")");
			sliderKnobRecord.value = sliderKnobRecord.interpret(translateX, translateY); // enforces step
			return false;
	}
	return true;
}

// a specific algorithm
Adj.defineCommandForAlgorithm({
	algorithmName: "sliderKnob",
	phaseHandlerNames: ["adjPhase1Up"],
	parameters: ["min", "max", "step",
				 "preset"],
	methods: [function sliderKnob (element, parametersObject) {
		var usedHow = "used in a parameter for a sliderKnob command";
		var variableSubstitutionsByName = {};
		var min = Adj.doVarsArithmetic(element, parametersObject.min, 0, null, usedHow, variableSubstitutionsByName); // default min = 0
		var max = Adj.doVarsArithmetic(element, parametersObject.max, 100, null, usedHow, variableSubstitutionsByName); // default max = 100
		var step = Adj.doVarsArithmetic(element, parametersObject.step, 1, null, usedHow, variableSubstitutionsByName); // default step = 1
		var preset = Adj.doVarsArithmetic(element, parametersObject.preset, min, null, usedHow, variableSubstitutionsByName); // default preset = min
		//
		var adjS = element.adjS || (element.adjS = {});
		var sliderKnobRecord = adjS.sliderKnobRecord;
		if (!sliderKnobRecord) { // onload but not each doSvg()
			sliderKnobRecord = new Adj.SliderKnob (element, min, max, step);
			adjS.sliderKnobRecord = sliderKnobRecord;
			element.addEventListener("mousedown", Adj.sliderKnobListener);
			element.adjDraggedMouseUpListener = Adj.sliderKnobListener;
			element.adjDraggedMouseMoveListener = Adj.sliderKnobListener;
			//
			sliderKnobRecord.value = preset;
		} else { // preexisting
			sliderKnobRecord.update(); // in case slider resized even though value remained the same
		}
	}]
});

// polyfill for missing method getTransformToElement
// necessary e.g. from Chrome 48 onward
// https://groups.google.com/a/chromium.org/forum/#!topic/blink-dev/SeGqJ2YZSnk
// http://ww.w3.org/TR/SVG/types.html
if (!SVGElement.prototype.getTransformToElement) {
	(function() {
		SVGElement.prototype.getTransformToElement = function getTransformToElement (element) {
			return element.getScreenCTM().inverse().multiply(this.getScreenCTM());
		};
	})();
}

// polyfill for missing property pathSegList
// necessary e.g. from Chrome 48 onward
// https://code.google.com/p/chromium/issues/detail?id=539385
// SVG 1.1. http://www.w3.org/TR/SVG/paths.html
// SVG 2 https://svgwg.org/svg2-draft/paths.html
// changes http://www.w3.org/TR/SVG2/changes.html
// implemented about 2016-01-03 after reading https://github.com/progers/pathseg
if (!window.SVGPathSegList) {
	(function() {
		var mutationObserverInit = { "attributes": true, "attributeFilter": ["d"] };
		var isWhitespace = { ' ': true, '\t': true, '\n': true, '\r': true, '\f': true };
		var isNumberDigit = {
			'+': true, '-': true, '.': true, 'e': true,
			'0': true, '1': true, '2': true, '3': true, '4': true,
			'5': true, '6': true, '7': true, '8': true, '9': true
		};
		var isPathSegType = {
			'Z': true, 'z': true, 'M': true, 'm': true, 'L': true, 'l': true,
			'Q': true, 'q': true, 'C': true, 'c': true, 'T': true, 't': true, 'S': true, 's': true,
			'H': true, 'h': true, 'V': true, 'v': true, 'A': true, 'a': true
		};
		var parseDString = function parseDString (dString) {
			var pathSegArray = [];
			if (!dString || !dString.length) { // empty, is allowed
				return pathSegArray;
			}
			//
			var index = 0; // character in dString
			var dStringLength = dString.length;
			//
			var skipSpaces = function skipSpaces () {
				while (index < dStringLength && isWhitespace[dString[index]]) {
					index++;
				}
			};
			var skipSpacesAndComma = function skipSpacesAndComma () {
				while (index < dStringLength && isWhitespace[dString[index]]) {
					index++;
				}
				if (index < dStringLength && dString[index] === ',') {
					index++;
					while (index < dStringLength && isWhitespace[dString[index]]) {
						index++;
					}
				}
			};
			var parseNumber = function parseNumber () {
				skipSpaces();
				var startIndex = index;
				while (index < dStringLength && isNumberDigit[dString[index]]) {
					index++;
				}
				var number = parseFloat(dString.substring(startIndex, index));
				if (isNaN(number)) {
					throw "pathSegList parseNumber isNaN";
				}
				skipSpacesAndComma();
				return number;
			};
			var parseArcFlag = function parseArcFlag () {
				skipSpaces();
				var character = ''; // use '' for none
				if (index < dStringLength) {
					character = dString[index++];
				}
				var arcFlag;
				switch (character) {
					case '0':
						arcFlag = false;
						break;
					case '1':
						arcFlag = true;
						break;
					default:
						throw "pathSegList parseArcFlag not a flag";
				}
				skipSpacesAndComma();
				return arcFlag;
			};
			//
			skipSpaces();
			if (index >= dStringLength) { // empty, is allowed
				return pathSegArray;
			}
			var character = dString[index];
			if (character !== 'M' && character !== 'm') { // first must be 'M' or 'm'
				throw "pathSegList first neither 'M' nor 'm'";
			}
			//
			var previousPathSegTypeAsLetter = ' '; // use ' ' for unknown
			while (index < dStringLength) {
				character = dString[index];
				var pathSegTypeAsLetter;
				if (isPathSegType[character]) {
					pathSegTypeAsLetter = character;
					index++;
				} else {
					if (isNumberDigit[character]) { // same type segment again, without letter
						if (previousPathSegTypeAsLetter === 'M') {
							pathSegTypeAsLetter = 'L';
						} else if (previousPathSegTypeAsLetter === 'm') {
							pathSegTypeAsLetter = 'l';
						} else { // simply same type segment again, without letter
							pathSegTypeAsLetter = previousPathSegTypeAsLetter;
						}
					} else {
						throw "pathSegList unsupported segment type '" + character + "'";
					}
				}
				switch (pathSegTypeAsLetter) {
					case 'Z':
					case 'z':
						pathSegArray.push
						({ pathSegTypeAsLetter: pathSegTypeAsLetter });
						skipSpaces();
						break;
					case 'M':
					case 'L':
					case 'T':
					case 'm':
					case 'l':
					case 't':
						pathSegArray.push
						({ pathSegTypeAsLetter: pathSegTypeAsLetter,
						   x: parseNumber(),
						   y: parseNumber() });
						break;
					case 'Q':
					case 'q':
						pathSegArray.push
						({ pathSegTypeAsLetter: pathSegTypeAsLetter,
						   x1: parseNumber(),
						   y1: parseNumber(),
						   x: parseNumber(),
						   y: parseNumber() });
						break;
					case 'C':
					case 'c':
						pathSegArray.push
						({ pathSegTypeAsLetter: pathSegTypeAsLetter,
						   x1: parseNumber(),
						   y1: parseNumber(),
						   x2: parseNumber(),
						   y2: parseNumber(),
						   x: parseNumber(),
						   y: parseNumber() });
						break;
					case 'S':
					case 's':
						pathSegArray.push
						({ pathSegTypeAsLetter: pathSegTypeAsLetter,
						   x2: parseNumber(),
						   y2: parseNumber(),
						   x: parseNumber(),
						   y: parseNumber() });
						break;
					case 'H':
					case 'h':
						pathSegArray.push
						({ pathSegTypeAsLetter: pathSegTypeAsLetter,
						   x: parseNumber() });
						break;
					case 'V':
					case 'v':
						pathSegArray.push
						({ pathSegTypeAsLetter: pathSegTypeAsLetter,
						   y: parseNumber() });
						break;
					case 'A':
					case 'a':
						pathSegArray.push
						({ pathSegTypeAsLetter: pathSegTypeAsLetter,
						   x1: parseNumber(),
						   y1: parseNumber(),
						   arcAngle: parseNumber(),
						   arcLarge: parseArcFlag(),
						   arcSweep: parseArcFlag(),
						   x: parseNumber(),
						   y: parseNumber() });
						break;
					default:
						throw "pathSegList unsupported segment type '" + character + "'";
				}
				previousPathSegTypeAsLetter = pathSegTypeAsLetter;
			}
			return pathSegArray;
		};
		Object.defineProperty(SVGPathElement.prototype, "pathSegList", {
			get: function() {
				if (this.adjPathSegListDStringMutationCallback && this.adjPathSegListDStringMutationObserver) {
					// first process pending asynchronous mutations, if any
					this.adjPathSegListDStringMutationCallback(this.adjPathSegListDStringMutationObserver.takeRecords());
				}
				var adjPathSegList = this.adjPathSegList;
				if (adjPathSegList) { // cached
					return adjPathSegList; // quick return
				}
				// determine
				if (!this.adjPathSegListDStringMutationObserver) {
					this.adjPathSegListDStringMutationCallback =
						(function adjPathSegListDStringMutationCallback (mutationRecords) {
							for (var i = 0, n = mutationRecords.length; i < n; i++) {
								if (mutationRecords[i].attributeName === "d") {
									this.adjPathSegList = null; // reset
									break;
								}
							}
						}).bind(this);
					this.adjPathSegListDStringMutationObserver =
						new MutationObserver(this.adjPathSegListDStringMutationCallback);
					this.adjPathSegListDStringMutationObserver.observe(this, mutationObserverInit);
				}
				adjPathSegList = new Adj.PathSegList(parseDString(this.getAttribute("d")));
				this.adjPathSegList = adjPathSegList;
				return adjPathSegList;
			},
			enumerable: true
		});
	})();
}

// polyfill for method setImmediate
// see https://developer.mozilla.org/en-US/docs/Web/API/Window/setImmediate
// implemented after reading https://github.com/YuzuJS/setImmediate
// this implementation here doesn't go as far back in compatibility
if (!window.setImmediate) {
	(function() {
		var funcs = {};
		var nextFuncId = 1;
		funcs.push = function setImmediateFuncsPush (func) {
			var funcId = nextFuncId++;
			this[funcId] = func;
			return funcId;
		}
		funcs.unpush = function setImmediateFuncsUnpush (funcId) {
			var func = this[funcId];
			delete this[funcId];
			return func;
		}
		function tryFunc (func) {
			if (func) {
				try {
					func();
				} catch (e) {
					console.error('error in a function invoked by setImmediate', e);
				}
			}
		}
		window.clearImmediate = function(funcId) {
			funcs.unpush(funcId);
		}
		if (window.MessageChannel) {
			var channel = new MessageChannel();
			channel.port1.onmessage = function setImmediateOnChannelMessage (event) {
				tryFunc(funcs.unpush(event.data));
			};
			window.setImmediate = function(func) {
				var funcId = funcs.push(Function.prototype.bind.apply(func, arguments));
				channel.port2.postMessage(funcId);
				return funcId;
			}
		} else { // e.g. a little bit older Firefox in some Linux
			var messagePrefix = "Adj$setImmediate$" + Math.random() + "$";
			window.addEventListener("message", function setImmediateOnPostMessage (event) {
				var data = event.data;
				if (   event.source === window
					&& typeof data === "string"
					&& data.indexOf(messagePrefix) === 0) {
					tryFunc(funcs.unpush(+data.slice(messagePrefix.length)));
				}
			});
			window.setImmediate = function(func) {
				var funcId = funcs.push(Function.prototype.bind.apply(func, arguments));
				window.postMessage(messagePrefix + funcId, "*");
				return funcId;
			}
		}
	})();
}

// make available
window.Adj = Adj;
