//
// Copyright (c) 2002-2013, Nirvana Research
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

// invoke Adj by doing Adj.processAdjElements(document);
// e.g. <svg onload="Adj.processAdjElements(document);">
// optionally try{Adj.processAdjElements(document);}catch(e){};
//
// newer shortcut is Adj.doDoc();

// the singleton
if (typeof Adj == "undefined") {
	Adj = {};
	Adj.version = { major:3, minor:5, revision:16 };
	Adj.algorithms = {};
}

// constants
Adj.SvgNamespace = "http://www.w3.org/2000/svg"
Adj.AdjNamespace = "http://www.nrvr.com/2012/adj";

// shortcut
// if not given a documentToDo then default to doing _the_ document
Adj.doDoc = function doDoc(documentToDo) {
	if (!documentToDo) {
		documentToDo = document;
	}
	Adj.processAdjElements(documentToDo);
}

// shortcut
Adj.doSvg = function doSvg(svgElement) {
	Adj.processAdjElements(svgElement);
}

// complete processing of all phases
Adj.processAdjElements = function processAdjElements(documentNodeOrRootElement) {
	var rootElement;
	if (documentNodeOrRootElement.documentElement) {
		rootElement = documentNodeOrRootElement.documentElement;
	} else {
		rootElement = documentNodeOrRootElement;
	}
	if (!(rootElement instanceof SVGSVGElement)) {
		console.log("Adj skipping because invoked with something other than required SVGSVGElement");
		return;
	}
	try {
		//
		// remove certain nodes for a new start, in case any such are present from earlier processing
		Adj.modifyMaybeRemoveChildren
		(rootElement,
		 function(node,child) {
			if (child.adjPermanentArtifact || child.getAttributeNS(Adj.AdjNamespace, "artifact")) {
				child.adjPermanentArtifact = true;
				child.adjRemoveElement = true;
			}
			if (child.adjExplanationArtifact || child.getAttributeNS(Adj.AdjNamespace, "explanation")) {
				child.adjExplanationArtifact = true;
				child.adjRemoveElement = true;
			}
		 });
		//
		// read Adj elements and make or update phase handlers
		Adj.parseSvgElementForAdjElements(rootElement);
		//
		// then process
		Adj.processSvgElementWithPhaseHandlers(rootElement);
	} catch (exception) {
		Adj.displayException(exception, rootElement);
		throw exception;
	}
}

// generic installer
Adj.setAlgorithm = function setAlgorithm (target, algorithmName, parametersObject, element) {
	parametersObject = parametersObject || {}; // if no parametersObject given then empty object
	element = element || target; // if no element given then same as target, element == target is normal
	var algorithm = Adj.algorithms[algorithmName];
	if (!algorithm) {
		// tolerate, for now
		console.log("Adj skipping unknown algorithm name " + algorithmName);
		return;
	}
	var phaseHandler = { // stuff everything needed into one phaseHandler object
		element: element,
		algorithm: algorithm,
		parametersObject: parametersObject,
	};
	var phaseHandlerName = algorithm.phaseHandlerName;
	//console.log("a " + element.nodeName + " element gets a " + phaseHandlerName + " handler with a " + algorithmName + " algorithm");
	// phaseHandlers is an associative array object which for a phaseHandlerName key as value has an array of phaseHandler, if there is any
	var phaseHandlers = target.adjPhaseHandlers;
	phaseHandlers = phaseHandlers || {}; // if no phaseHandlers yet then new associative array object
	var phaseHandlersForThisPhase = phaseHandlers[phaseHandlerName];
	phaseHandlersForThisPhase = phaseHandlersForThisPhase || []; // if no phaseHandlersForThisPhase yet then new array
	phaseHandlersForThisPhase.push(phaseHandler);
	phaseHandlers[phaseHandlerName] = phaseHandlersForThisPhase;
	target.adjPhaseHandlers = phaseHandlers;
	if (algorithm.notAnOrder1Element) {
		element.adjNotAnOrder1Element = true;
		Adj.hideByDisplayAttribute(element);
	}
	if (algorithm.processSubtreeOnlyInPhaseHandler) {
		element.adjProcessSubtreeOnlyInPhaseHandler = algorithm.processSubtreeOnlyInPhaseHandler; // try being cleverer ?
	}
	//
	var ownerDocumentElement = target.ownerDocument.documentElement;
	ownerDocumentElement.adjPhaseHandlerNamesOccurringByName[phaseHandlerName] = true;
}

// utility
Adj.getPhaseHandlersForElementForName = function getPhaseHandlersForElementForName (target, algorithmName) {
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
		if (phaseHandler.algorithm == algorithm) {
			matchingPhaseHandlers.push(phaseHandler);
		}
	}
	return matchingPhaseHandlers;
}

// constants
// recognize a boolean or decimal
Adj.booleanOrDecimalRegexp = /^\s*(true|false|[+-]?[0-9]+\.?[0-9]*|[0-9]*\.?[0-9]+)\s*$/;
// recognize a boolean
Adj.booleanRegexp = /^\s*(true|false)\s*$/;
// recognize a valid phase handler name
Adj.phaseHandlerNameRegexp = /^(adjPhase[0-9])(Down|Up|)$/;

// read Adj elements and make or update phase handlers,
// entry point
Adj.parseSvgElementForAdjElements = function parseSvgElementForAdjElements(svgElement) {
	// first clear svgElement.adjSomething properties for a new start
	delete svgElement.adjIdsDictionary;
	svgElement.adjPhaseHandlerNamesOccurringByName = {};
	delete svgElement.adjPhaseNamesOccurring;
	//
	// then walk
	Adj.parseAdjElementsToPhaseHandlers(svgElement);
	//
	// determine which phases are occurring in this document
	var phaseHandlerNamesOccurringByName = svgElement.adjPhaseHandlerNamesOccurringByName;
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
	svgElement.adjPhaseNamesOccurring = phaseNamesOccurringInOrder;
}

// build on first use, so any algorithms added e.g. from other source files will be considered too
Adj.commandNamesUsingParameterName = function commandNamesUsingParameterName(parameterNameToMatch) {
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
				// commandName == algorithmName, for now
				commandNamesForParameterName.push(algorithmName);
			}
		}
	}
	return commandNamesByParameterName[parameterNameToMatch];
}

// utility
Adj.parameterParse = function parameterParse(value) {
	var numberMatch;
	if (numberMatch = Adj.booleanOrDecimalRegexp.exec(value)) { // !isNaN(value) would miss boolean
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
}

// read Adj elements and make or update phase handlers,
// recursive walking of the tree
Adj.parseAdjElementsToPhaseHandlers = function parseAdjElementsToPhaseHandlers (node) {
	// first clear node.adjSomething properties for a new start
	delete node.adjPhaseHandlers;
	delete node.adjProcessSubtreeOnlyInPhaseHandler;
	//delete node.adjPlacementArtifact; // probably safe not to delete, element should be gone
	delete node.adjNotAnOrder1Element;
	//delete node.adjPermanentArtifact; // probably safe not to delete, element should be gone
	//delete node.adjExplanationArtifact; // probably safe not to delete, element should be gone
	//delete node.adjRemoveElement; // probably safe not to delete, element should be gone
	Adj.unhideByDisplayAttribute(node); // does delete node.adjOriginalDisplay
	delete node.adjLevel;
	delete node.adjVariables;
	//
	// then look for newer alternative syntex Adj commands as attributes
	var adjAttributesByName = {};
	var attributes = node.attributes;
	var numberOfAttributes = attributes.length;
	for (var i = 0; i < numberOfAttributes; i++) {
		var attribute = attributes[i];
		if (attribute.namespaceURI == Adj.AdjNamespace) {
			adjAttributesByName[attribute.localName] = attribute.value;
		}
	}
	// first find out which commands
	var commandParametersByName = {};
	for (var adjAttributeName in adjAttributesByName) {
		switch (adjAttributeName) {
			case "command":
				var commandName = adjAttributesByName[adjAttributeName];
				commandParametersByName[commandName] = {};
				delete adjAttributesByName[adjAttributeName]; // done with
				break;
			case "textBreaks":
			case "rider":
			case "floater":
			case "fit":
			case "tilt":
			case "explain":
				// these commands can coexist with another command,
				// though only some combinations make sense, while others cause conflicts,
				// those that do work allow nicely looking SVG/Adj source, hence keeping this, for now
				if (Adj.doVarsBoolean(node, adjAttributesByName[adjAttributeName], false, "used as attribute adj:" + adjAttributeName)) { // must be ="true", skip if ="false"
					commandParametersByName[adjAttributeName] = {};
				}
				break;
			default:
				break;
		}
	}
	// then assign parameters to their appropriate commands
	for (var adjAttributeName in adjAttributesByName) {
		var commandNamesUsingParameterName = Adj.commandNamesUsingParameterName(adjAttributeName);
		if (commandNamesUsingParameterName) {
			var adjAttributeValue = Adj.parameterParse(adjAttributesByName[adjAttributeName]);
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
		// commandName == algorithmName, for now
		Adj.setAlgorithm(node, commandName, commandParametersByName[commandName]);
	}
	//
	// then walk
	for (var child = node.firstChild; child; child = child.nextSibling) {
		if (child instanceof Element) { // if an XML element, e.g. not an XML #text
			if (child.namespaceURI == Adj.AdjNamespace) { // if an Adj element
				var algorithmName = child.localName;
				var parameters = {};
				var attributes = child.attributes;
				var numberOfAttributes = attributes.length;
				for (var i = 0; i < numberOfAttributes; i++) {
					var attribute = attributes[i];
					if (!attribute.namespaceURI || attribute.namespaceURI == Adj.AdjNamespace) {
						parameters[attribute.localName] = Adj.parameterParse(attribute.value);
					}
				}
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
}

// complete processing of all phases
Adj.processSvgElementWithPhaseHandlers = function processSvgElementWithPhaseHandlers(svgElement) {
	Adj.processElementWithPhaseHandlers(svgElement);
	// a singleton
	var svgElementBoundingBox = svgElement.getBBox();
	svgElement.setAttribute("width", Adj.decimal(svgElementBoundingBox.x + svgElementBoundingBox.width));
	svgElement.setAttribute("height", Adj.decimal(svgElementBoundingBox.y + svgElementBoundingBox.height));
	// necessary cleanup
	Adj.modifyMaybeRemoveChildren
	(svgElement,
	 function(node,child) {
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
}

// complete processing of all phases
Adj.processElementWithPhaseHandlers = function processElementWithPhaseHandlers(element, thisTimeFullyProcessSubtree, level) {
	var ownerDocumentElement = element.ownerDocument.documentElement;
	var phaseNamesOccurring = ownerDocumentElement.adjPhaseNamesOccurring;
	for (var i = 0, n = phaseNamesOccurring.length; i < n; i++) {
		var phaseName = phaseNamesOccurring[i];
		Adj.walkNodes(element, phaseName, thisTimeFullyProcessSubtree, level);
	}
}

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
			} else { // processSubtreeOnlyInPhaseHandler == phaseName
				if (phaseHandlers) {
					var subtreePhaseHandlerName = phaseName;
					var phaseHandlersForSubtreeName = phaseHandlers[subtreePhaseHandlerName];
					if (phaseHandlersForSubtreeName) { // e.g. a rider, or a floater
						// expect only one
						for (var subtreeIndex in phaseHandlersForSubtreeName) {
							var phaseHandler = phaseHandlersForSubtreeName[subtreeIndex];
							phaseHandler.algorithm.method(phaseHandler.element, phaseHandler.parametersObject, level);
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
				phaseHandler.algorithm.method(phaseHandler.element, phaseHandler.parametersObject, level);
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
		Adj.walkNodes(child, phaseName, false, level + 1); // recursion
	}
	//
	if (phaseHandlers) {
		var upPhaseHandlerName = phaseName + "Up";
		var phaseHandlersForUpName = phaseHandlers[upPhaseHandlerName];
		if (phaseHandlersForUpName) {
			for (var upIndex in phaseHandlersForUpName) {
				var phaseHandler = phaseHandlersForUpName[upIndex];
				phaseHandler.algorithm.method(phaseHandler.element, phaseHandler.parametersObject, level);
			}
		}
	}
	//console.log("phase " + phaseName + " level " + level + " cming outa " + node.nodeName);
}

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
}

// constants
Adj.leftCenterRight = { left:0, center:0.5, right:1 };
Adj.topMiddleBottom = { top:0, middle:0.5, bottom:1 };
Adj.insideMedianOutside = { inside:0, median:0.5, outside:1 };
Adj.noneClearNear = { none:"none", clear:"clear", near:"near" };

// utility
// if one and other both are integers and not too close then round result to be an integer as well
Adj.fraction = function fraction (one, other, fraction, roundNoCloser, roundIfIntegers) {
	roundNoCloser = roundNoCloser != undefined ? roundNoCloser : 0; // default roundNoCloser = 0
	roundIfIntegers = roundIfIntegers != undefined ? roundIfIntegers : true; // default roundIfInteger = true
	fraction = one + (other - one) * fraction;
	if (roundIfIntegers) {
		if (one % 1 == 0 && other % 1 == 0) { // both are integers
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
}

// utility
Adj.decimal = function decimal (number, decimalDigits) {
	decimalDigits = decimalDigits != undefined ? decimalDigits : 3; // default decimal = 3
	var factor = Math.pow(10, decimalDigits);
	return Math.round(number * factor) / factor;
}

// utility
Adj.qualifyName = function qualifyName (element, namespaceURI, name) {
	var prefix = element.lookupPrefix(namespaceURI);
	if (prefix) {
		return prefix + ":" + name;
	} else {
		return name;
	}
}

// utility
Adj.createSVGElement = function createSVGElement (name, additionalProperties) {
	var svgElement = document.createElementNS(Adj.SvgNamespace, name);
	if (additionalProperties) {
		for (name in additionalProperties) {
			svgElement[name] = additionalProperties[name];
		}
	}
	return svgElement;
}

// utility
Adj.hideByDisplayAttribute = function hideByDisplayAttribute (element) {
	var originalDisplay = element.getAttribute("display");
	if (!originalDisplay) {
		originalDisplay = "-"; // encode the fact there wasn't any
	}
	if (!element.adjOriginalDisplay) {
		element.adjOriginalDisplay = originalDisplay;
		element.setAttributeNS(Adj.AdjNamespace, Adj.qualifyName(element, Adj.AdjNamespace, "originalDisplay"), element.adjOriginalDisplay);
	}
	element.setAttribute("display", "none");
}

// utility
Adj.unhideByDisplayAttribute = function unhideByDisplayAttribute (element, evenIfNoOriginalDisplay) {
	var originalDisplay = element.adjOriginalDisplay;
	if (!originalDisplay) {
		originalDisplay = element.getAttributeNS(Adj.AdjNamespace, "originalDisplay");
	}
	if (originalDisplay) {
		if (originalDisplay != "-") {
			element.setAttribute("display", originalDisplay);
		} else { // == "-" is code for the fact there wasn't any
			element.removeAttribute("display");
		}
	} else if (evenIfNoOriginalDisplay) {
		element.removeAttribute("display");
	}
	delete element.adjOriginalDisplay;
	element.removeAttributeNS(Adj.AdjNamespace, "originalDisplay");
}

// utility
Adj.createArtifactElement = function createArtifactElement (name, parent) {
	var artifactElement = Adj.createSVGElement(name, {adjPermanentArtifact:true});
	artifactElement.setAttributeNS(Adj.AdjNamespace, Adj.qualifyName(artifactElement, Adj.AdjNamespace, "artifact"), "true");
	return artifactElement;
}
// utility
Adj.cloneArtifactElement = function cloneArtifactElement (element, deep) {
	deep = deep != undefined ? deep : true; // default deep = true
	var clone = element.cloneNode(deep);
	clone.setAttributeNS(Adj.AdjNamespace, Adj.qualifyName(element, Adj.AdjNamespace, "artifact"), "true");
	return clone;
}

// utility
Adj.createExplanationElement = function createExplanationElement (name, dontDisplayNone) {
	var explanationElement = Adj.createSVGElement(name, {adjExplanationArtifact:true});
	explanationElement.setAttributeNS(Adj.AdjNamespace, Adj.qualifyName(explanationElement, Adj.AdjNamespace, "explanation"), "true");
	if (!dontDisplayNone) {
		Adj.hideByDisplayAttribute(explanationElement);
	}
	return explanationElement;
}

// utility
Adj.createExplanationPointCircle = function createExplanationPointCircle (x, y, fill) {
	var explanationElement = Adj.createExplanationElement("circle");
	explanationElement.setAttribute("cx", Adj.decimal(x));
	explanationElement.setAttribute("cy", Adj.decimal(y));
	explanationElement.setAttribute("r", 3);
	explanationElement.setAttribute("fill", fill);
	explanationElement.setAttribute("fill-opacity", "0.2");
	explanationElement.setAttribute("stroke", "none");
	return explanationElement;
}

// utility
Adj.createExplanationLine = function createExplanationLine (x1, y1, x2, y2, stroke) {
	var explanationElement = Adj.createExplanationElement("line");
	explanationElement.setAttribute("x1", Adj.decimal(x1));
	explanationElement.setAttribute("y1", Adj.decimal(y1));
	explanationElement.setAttribute("x2", Adj.decimal(x2));
	explanationElement.setAttribute("y2", Adj.decimal(y2));
	explanationElement.setAttribute("stroke", stroke);
	explanationElement.setAttribute("stroke-width", "1");
	explanationElement.setAttribute("stroke-opacity", "0.2");
	return explanationElement;
}

// a specific algorithm
Adj.algorithms.horizontalList = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["gap",
				 "horizontalGap", "leftGap", "centerGap", "rightGap",
				 "verticalGap", "topGap", "middleGap", "bottomGap",
				 "maxWidth", "maxPerRow",
				 "makeGrid",
				 "hAlign", "vAlign",
				 "explain"],
	method: function horizontalList (element, parametersObject) {
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
		var makeGrid = Adj.doVarsBoolean(element, parametersObject.makeGrid, false, usedHow, variableSubstitutionsByName); // makeGrid explain = false
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
				hiddenRect = Adj.createSVGElement("rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			childRecords.push({
				boundingBox: child.getBBox(),
				node: child
			});
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
					if (columnWidth == undefined) { // first row
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
				if (rowHeight == undefined) { // first element in row
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
				|| (anyMadeTaller && vAlign != 0)) { // anyMadeTaller only should matter if vAlign != 0
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
				var explanationElement = Adj.createExplanationElement("rect");
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
					var explanationElement = Adj.createExplanationElement("rect");
					explanationElement.setAttribute("x", explainRect.x);
					explanationElement.setAttribute("y", explainRect.y);
					explanationElement.setAttribute("width", explainRect.width);
					explanationElement.setAttribute("height", explainRect.height);
					explanationElement.setAttribute("fill", "blue");
					explanationElement.setAttribute("fill-opacity", "0.1");
					explanationElement.setAttribute("stroke", "blue");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.1");
					element.appendChild(explanationElement);
				}
			}
		}
	}
}

// a specific algorithm
Adj.algorithms.verticalList = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["gap",
				 "horizontalGap", "leftGap", "centerGap", "rightGap",
				 "verticalGap", "topGap", "middleGap", "bottomGap",
				 "maxHeight", "maxPerColumn",
				 "makeGrid",
				 "hAlign", "vAlign",
				 "explain"],
	method: function verticalList (element, parametersObject) {
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
				hiddenRect = Adj.createSVGElement("rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
				continue;
			}
			childRecords.push({
				boundingBox: child.getBBox(),
				node: child
			});
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
					if (rowHeight == undefined) { // first column
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
				if (columnWidth == undefined) { // first element in column
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
				|| (anyMadeWider && hAlign != 0)) { // anyMadeWider only should matter if hAlign != 0
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
				var explanationElement = Adj.createExplanationElement("rect");
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
					var explanationElement = Adj.createExplanationElement("rect");
					explanationElement.setAttribute("x", explainRect.x);
					explanationElement.setAttribute("y", explainRect.y);
					explanationElement.setAttribute("width", explainRect.width);
					explanationElement.setAttribute("height", explainRect.height);
					explanationElement.setAttribute("fill", "blue");
					explanationElement.setAttribute("fill-opacity", "0.1");
					explanationElement.setAttribute("stroke", "blue");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.1");
					element.appendChild(explanationElement);
				}
			}
		}
	}
}

// a specific algorithm
Adj.algorithms.frameForParent = {
	notAnOrder1Element: true,
	phaseHandlerName: "adjPhase5Down",
	parameters: ["inset",
				 "horizontalInset", "leftInset", "rightInset",
				 "verticalInset", "topInset", "bottomInset"],
	method: function frameForParent (element, parametersObject) {
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
	}
}

// constants
// parse word breaks, intentionally treat as one any number of spaces and line breaks
Adj.wordBreakRegexp = /(?:\s)+/;
// parse line breaks, intentionally treat separately each line break
Adj.lineBreakRegexp = /(?:\r?\n)/;

// utility
// a specific algorithm
Adj.algorithms.textBreaks = {
	phaseHandlerName: "adjPhase1Down",
	parameters: ["wordBreaks",
				 "lineBreaks"],
	method: function textBreaks (element, parametersObject) {
		var wordBreaks = parametersObject.wordBreaks ? parametersObject.wordBreaks : false // default wordBreaks = false
		var lineBreaks = parametersObject.lineBreaks ? parametersObject.lineBreaks : true // default lineBreaks = true
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
	}
}

// utility
Adj.buildIdsDictionary = function buildIdsDictionary (element, idsDictionary, level) {
	if (idsDictionary == undefined) { idsDictionary = {}; }; // ensure there is an idsDictionary
	level = level || 1; // if no level given then 1
	// chose to implement to recognize more than one kind of id
	var ids = {};
	var adjId = element.getAttributeNS(Adj.AdjNamespace, "id"); // first check for preferred attribute adj:id
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
}

// utility
// this specific function builds on invocation even if a dictionary exists already,
// could be useful to call more than once if new ids have been created by code running or
// if document structure has changed in a way that would affect outcomes,
// could be expensive for a huge document, hence while itself O(n) nevertheless to avoid O(n^2) call sparingly
Adj.buildIdsDictionaryForDocument = function buildIdsDictionaryForDocument(documentNodeOrRootElement) {
	var rootElement;
	if (documentNodeOrRootElement.documentElement) {
		rootElement = documentNodeOrRootElement.documentElement;
	} else {
		rootElement = documentNodeOrRootElement;
	}
	return rootElement.adjIdsDictionary = Adj.buildIdsDictionary(rootElement);
}

// utility
Adj.elementLevel = function elementLevel(element) {
	var level = element.adjLevel;
	if (!level) {
		level = 1;
		var parent = element.parentNode;
		while (parent.nodeType == Node.ELEMENT_NODE) {
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
}

// utility
Adj.getElementByIdNearby = function getElementByIdNearby (id, startingElement) {
	// note: any change in implementation still should keep intact deterministic behavior
	var ownerDocumentElement = startingElement.ownerDocument.documentElement;
	var adjIdsDictionary = ownerDocumentElement.adjIdsDictionary || Adj.buildIdsDictionaryForDocument(ownerDocumentElement); // ensure there is an adjIdsDictionary
	var elementsWithThisId = adjIdsDictionary[id];
	if (!elementsWithThisId) {
		return null;
	}
	var numberOfElementsWithThisId = elementsWithThisId.length;
	if (!numberOfElementsWithThisId) {
		return null;
	}
	if (numberOfElementsWithThisId == 1) { // if only one then that is the one
		return elementsWithThisId[0];
	}
	// getting here means at least two to pick from
	var descendants = [];
	var otherRelations = [];
	var startingElementLevel = Adj.elementLevel(startingElement);
	elementsWithThisIdLoop: for (var i = 0; i < numberOfElementsWithThisId; i++) {
		var elementWithThisId = elementsWithThisId[i];
		if (elementWithThisId == startingElement) { // self is nearest possible
			return elementWithThisId;
		}
		var elementWithThisIdLevel = Adj.elementLevel(elementWithThisId);
		var element2Ancestor = elementWithThisId;
		var ancestorLevel = elementWithThisIdLevel;
		while (ancestorLevel > startingElementLevel) {
			// go up until startingElementLevel
			element2Ancestor = element2Ancestor.parentNode;
			ancestorLevel--;
			if (element2Ancestor == startingElement) { // elementWithThisId is a descendant of startingElement
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
			} else if (otherRelationCommonAncestorLevel == otherToReturnCommonAncestorLevel) { // same distance to startingElement
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
}

// constants
// parse an id and optionally two more parameters, e.g. full "obj1 % 0.5, 1" or less specific "obj2"
// note: as implemented tolerates extra paremeters
Adj.idXYRegexp = /^\s*([^%\s]+)\s*(?:%\s*([^,\s]+)\s*)?(?:,\s*([^,\s]+)\s*)?(?:,.*)?$/;
// parse one or two parameters, e.g. "0.5, 1" or only "0.3"
// note: as implemented tolerates extra paremeters
Adj.oneOrTwoRegexp = /^\s*([^,\s]+)\s*(?:,\s*([^,\s]+)\s*)?(?:,.*)?$/;
// parse two parameters, e.g. "0.5, 1"
// note: as implemented tolerates extra paremeters
Adj.twoRegexp = /^\s*([^,\s]+)\s*,\s*([^,\s]+)\s*(?:,.*)?$/;
// parse three parameters, e.g. "3, -4, 4"
// note: as implemented tolerates extra paremeters
Adj.threeRegexp = /^\s*([^,\s]+)\s*,\s*([^,\s]+)\s*,\s*([^,\s]+)\s*(?:,.*)?$/;

// note: document.documentElement.createSVGPoint() used because createSVGPoint() only implemented in SVG element,
// same for createSVGRect(), createSVGMatrix()

// utility
Adj.endPoints = function endPoints (element) {
	if (element instanceof SVGLineElement) {
		// get static base values as floating point values, before animation
		var fromPoint = document.documentElement.createSVGPoint();
		fromPoint.x = element.x1.baseVal.value;
		fromPoint.y = element.y1.baseVal.value;
		var toPoint = document.documentElement.createSVGPoint();
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
}

// utility
Adj.displacementAndAngle = function displacementAndAngle (fromPoint, toPoint) {
	var deltaX = toPoint.x - fromPoint.x;
	var deltaY = toPoint.y - fromPoint.y;
	var displacement = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
	var angle = Math.atan2(deltaY, deltaX) / Math.PI * 180;
	return {displacement:displacement, angle:angle};
}

// utility
Adj.transformLine = function transformLine (lineElement, matrix) {
	// get static base values as floating point values, before animation
	var point1 = document.documentElement.createSVGPoint();
	point1.x = lineElement.x1.baseVal.value;
	point1.y = lineElement.y1.baseVal.value;
	point1 = point1.matrixTransform(matrix);
	var point2 = document.documentElement.createSVGPoint();
	point2.x = lineElement.x2.baseVal.value;
	point2.y = lineElement.y2.baseVal.value;
	point2 = point2.matrixTransform(matrix);
	lineElement.setAttribute("x1", Adj.decimal(point1.x));
	lineElement.setAttribute("y1", Adj.decimal(point1.y));
	lineElement.setAttribute("x2", Adj.decimal(point2.x));
	lineElement.setAttribute("y2", Adj.decimal(point2.y));
}

// utility
// note: as implemented if path contains an elliptical arc curve segment then it is replaced by a line
Adj.transformPath = function transformPath (pathElement, matrix) {
	// get static base values as floating point values, before animation
	var pathSegList = pathElement.pathSegList;
	var numberOfPathSegs = pathSegList.numberOfItems;
	// relative coordinates must be transformed without translation's e and f
	var absoluteMatrix = matrix;
	var relativeMatrix = document.documentElement.createSVGMatrix();
	relativeMatrix.a = absoluteMatrix.a;
	relativeMatrix.b = absoluteMatrix.b;
	relativeMatrix.c = absoluteMatrix.c;
	relativeMatrix.d = absoluteMatrix.d;
	// loop
	var coordinates = document.documentElement.createSVGPoint(); // to hold coordinates to be transformed
	var previousOriginalCoordinates = document.documentElement.createSVGPoint(); // hold in case needed for absolute horizontal or vertical lineto
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
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += pathSegTypeAsLetter + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'm': // moveto
			case 'l': // lineto
			case 't': // smooth quadratic curveto
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				if (index != 0) {
					coordinates = coordinates.matrixTransform(relativeMatrix);
				} else {
					// first command in path data must be moveto and is absolute even if lowercase m would indicate relative
					coordinates = coordinates.matrixTransform(absoluteMatrix);
				}
				d += pathSegTypeAsLetter + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'Q': // quadratic Bézier curveto
				coordinates.x = pathSeg.x1;
				coordinates.y = pathSeg.y1;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += pathSegTypeAsLetter + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += " " + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'q': // quadratic Bézier curveto
				coordinates.x = pathSeg.x1;
				coordinates.y = pathSeg.y1;
				coordinates = coordinates.matrixTransform(relativeMatrix);
				d += pathSegTypeAsLetter + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(relativeMatrix);
				d += " " + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'C': // cubic Bézier curveto
				coordinates.x = pathSeg.x1;
				coordinates.y = pathSeg.y1;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += pathSegTypeAsLetter + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				coordinates.x = pathSeg.x2;
				coordinates.y = pathSeg.y2;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += " " + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += " " + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'c': // cubic Bézier curveto
				coordinates.x = pathSeg.x1;
				coordinates.y = pathSeg.y1;
				coordinates = coordinates.matrixTransform(relativeMatrix);
				d += pathSegTypeAsLetter + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				coordinates.x = pathSeg.x2;
				coordinates.y = pathSeg.y2;
				coordinates = coordinates.matrixTransform(relativeMatrix);
				d += " " + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(relativeMatrix);
				d += " " + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'S': // smooth cubic curveto
				coordinates.x = pathSeg.x2;
				coordinates.y = pathSeg.y2;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += pathSegTypeAsLetter + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += " " + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 's': // smooth cubic curveto
				coordinates.x = pathSeg.x2;
				coordinates.y = pathSeg.y2;
				coordinates = coordinates.matrixTransform(relativeMatrix);
				d += pathSegTypeAsLetter + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(relativeMatrix);
				d += " " + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'H': // horizontal lineto
				coordinates.x = pathSeg.x;
				coordinates.y = previousOriginalCoordinates.y;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += "L" + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x = pathSeg.x;
				break;
			case 'h': // horizontal lineto
				coordinates.x = pathSeg.x;
				coordinates.y = 0;
				coordinates = coordinates.matrixTransform(relativeMatrix);
				d += "l" + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x += pathSeg.x;
				break;
			case 'V': // vertical lineto
				coordinates.x = previousOriginalCoordinates.x;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += "L" + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'v': // vertical lineto
				coordinates.x = 0;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(relativeMatrix);
				d += "l" + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			case 'A': // elliptical arc, as implemented replaced by a line
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				coordinates = coordinates.matrixTransform(absoluteMatrix);
				d += 'L' + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x = pathSeg.x;
				previousOriginalCoordinates.y = pathSeg.y;
				break;
			case 'a': // elliptical arc, as implemented replaced by a line
				coordinates.x = pathSeg.x;
				coordinates.y = pathSeg.y;
				if (index != 0) {
					coordinates = coordinates.matrixTransform(relativeMatrix);
				} else {
					// first command in path data must be moveto and is absolute even if lowercase m would indicate relative
					coordinates = coordinates.matrixTransform(absoluteMatrix);
				}
				d += 'l' + Adj.decimal(coordinates.x) + "," + Adj.decimal(coordinates.y);
				previousOriginalCoordinates.x += pathSeg.x;
				previousOriginalCoordinates.y += pathSeg.y;
				break;
			default:
		}
	}
	pathElement.setAttribute("d", d);
}

// utility
Adj.restoreAndStoreAuthoringAttribute = function restoreAndStoreAuthoringAttribute (element, name) {
	var value = element.getAttributeNS(Adj.AdjNamespace, name);
	if (value) { // restore if any
		element.setAttribute(name, value);
	} else {
		value = element.getAttribute(name);
		if (value) { // store if any
			element.setAttributeNS(Adj.AdjNamespace, Adj.qualifyName(element, Adj.AdjNamespace, name), value);
		}
	}
}

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
}

// a specific algorithm
// note: as implemented works for simplified cases line and path,
// and for general case group containing one line (or path) as vector and any number of lines and paths as children of that group
Adj.algorithms.connection = {
	notAnOrder1Element: true,
	phaseHandlerName: "adjPhase5Up",
	parameters: ["from", "to",
				 "vector",
				 "explain"],
	method: function connection (element, parametersObject) {
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
		var fromPoint = document.documentElement.createSVGPoint();
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
		var toPoint = document.documentElement.createSVGPoint();
		toPoint.x = toBoundingBox.x + toBoundingBox.width * toX;
		toPoint.y = toBoundingBox.y + toBoundingBox.height * toY;
		toPoint = toPoint.matrixTransform(matrixFromToElement);
		//
		var neededDisplacementAndAngle = Adj.displacementAndAngle(fromPoint, toPoint);
		//
		// differntiate simplified cases
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
			var matrix = document.documentElement.createSVGMatrix();
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
				if (index == vector) {
					vector = child; // now an SVGElement instead of a number
				}
				childRecords.push({
					node: child
				});
				index++;
			}
			if (!(vector instanceof SVGElement)) { // maybe childRecords.length == 0
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
			var matrix = document.documentElement.createSVGMatrix();
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
			var explanationElement = Adj.createExplanationElement("rect");
			explanationElement.setAttribute("x", Adj.decimal(fromBoundingBox.x));
			explanationElement.setAttribute("y", Adj.decimal(fromBoundingBox.y));
			explanationElement.setAttribute("width", Adj.decimal(fromBoundingBox.width));
			explanationElement.setAttribute("height", Adj.decimal(fromBoundingBox.height));
			explanationElement.transform.baseVal.initialize(document.documentElement.createSVGTransformFromMatrix(matrixFromFromElement));
			explanationElement.setAttribute("fill", "green");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "green");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			parent.appendChild(explanationElement);
			parent.appendChild(Adj.createExplanationPointCircle(fromPoint.x, fromPoint.y, "green"));
			var explanationElement = Adj.createExplanationElement("rect");
			explanationElement.setAttribute("x", Adj.decimal(toBoundingBox.x));
			explanationElement.setAttribute("y", Adj.decimal(toBoundingBox.y));
			explanationElement.setAttribute("width", Adj.decimal(toBoundingBox.width));
			explanationElement.setAttribute("height", Adj.decimal(toBoundingBox.height));
			explanationElement.transform.baseVal.initialize(document.documentElement.createSVGTransformFromMatrix(matrixFromToElement));
			explanationElement.setAttribute("fill", "red");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "red");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			parent.appendChild(explanationElement);
			parent.appendChild(Adj.createExplanationPointCircle(toPoint.x, toPoint.y, "red"));
		}
	}
}

// utility
Adj.fractionPoint = function fractionPoint (element, pathFraction) {
	var pathFractionPoint;
	if (element instanceof SVGLineElement) {
		// an SVG line
		pathFractionPoint = document.documentElement.createSVGPoint();
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
}

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
}

// utility
Adj.overlapAndDistance = function overlapAndDistance (rect1, rect2) {
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
	var overlap;
	var distance;
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
	if (dx == 0 && dy == 0) { // overlap
		var ox1 = r1x1 > r2x1 ? r1x1 : r2x1;
		var ox2 = r1x2 < r2x2 ? r1x2 : r2x2;
		var oy1 = r1y1 > r2y1 ? r1y1 : r2y1;
		var oy2 = r1y2 < r2y2 ? r1y2 : r2y2;
		overlap = (ox2 - ox1) * (oy2 - oy1);
		distance = 0; // if overlap then distance = 0
	} else if (dx == 0) { // dy != 0
		overlap = 0;
		distance = dy;
	} else if (dy == 0) { // dx != 0
		overlap = 0;
		distance = dx;
	} else { // dx != 0 && dy != 0
		overlap = 0;
		distance = Math.sqrt(dx * dx + dy * dy);
	}
	return {
		overlap: overlap,
		distance: distance
	};
}

// utility
Adj.addElementToAvoid = function addElementToAvoid (avoidList, element) {
	avoidList.push(element);
}

// utility
Adj.addSiblingsToAvoid = function addSiblingsToAvoid (avoidList, element) {
	var parent = element.parentNode;
	for (var sibling = parent.firstChild, index = 0; sibling; sibling = sibling.nextSibling) {
		if (!(sibling instanceof SVGElement)) {
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		if (!sibling.getBBox) {
			continue; // skip if not an SVGLocatable, e.g. a <script> element
		}
		if (sibling == element) {
			continue; // don't avoid self
		}
		if (sibling.adjPlacementArtifact) {
			continue;
		}
		if (sibling.adjNotAnOrder1Element) {
			continue;
		}
		if (sibling.adjExplanationArtifact) {
			continue;
		}
		avoidList.push(sibling);
	}
}

// utility
// note: as implemented only works well for translation and scaling but gives distorted answers for rotation
Adj.relativeBoundingBoxes = function relativeBoundingBoxes (element, elements) {
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
		if (oneBoundingBoxWidth == 0 && oneBoundingBoxHeight == 0) { // e.g. an empty group
			continue; // skip
		}
		var matrixFromOneElement = oneElement.getTransformToElement(parent);
		var topLeftPoint = document.documentElement.createSVGPoint();
		topLeftPoint.x = oneBoundingBoxX;
		topLeftPoint.y = oneBoundingBoxY;
		topLeftPoint = topLeftPoint.matrixTransform(matrixFromOneElement);
		var bottomRightPoint = document.documentElement.createSVGPoint();
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
}

// utility
Adj.overlapAndDistances = function overlapAndDistances (rectangle, rectangles) {
	var overlaps = [];
	var distances = [];
	for (var oneRectangleIndex in rectangles) {
		var oneRectangle = rectangles[oneRectangleIndex];
		var overlapAndDistance = Adj.overlapAndDistance(rectangle, oneRectangle);
		overlaps.push(overlapAndDistance.overlap);
		distances.push(overlapAndDistance.distance);
	}
	return {
		overlaps: overlaps,
		distances: distances
	};
}

// a specific algorithm
// note: as implemented works for simplified case being in group of which first element is a path (or line) to ride on,
// and for general case given the id of a path to ride on
Adj.algorithms.rider = {
	notAnOrder1Element: true,
	phaseHandlerName: "adjPhase7",
	processSubtreeOnlyInPhaseHandler: "adjPhase7",
	parameters: ["pin",
				 "path",
				 "adjust",
				 "at",
				 "gap",
				 "steps"],
	method: function rider (element, parametersObject, level) {
		var usedHow = "used in a parameter for a rider command";
		var variableSubstitutionsByName = {};
		var pinMatch = Adj.oneOrTwoRegexp.exec(parametersObject.pin ? parametersObject.pin : "");
		var hFraction = pinMatch ? parseFloat(pinMatch[1]) : 0.5; // default hFraction = 0.5
		var vFraction = pinMatch ? parseFloat(pinMatch[2]) : 0.5; // default vFraction = 0.5
		var pathId = parametersObject.path;
		var adjust = Adj.noneClearNear[parametersObject.adjust]; // whether and how to automatically adjust
		var atMatch = Adj.oneOrTwoRegexp.exec(parametersObject.at);
		var pathFraction = atMatch[1];
		var pathFraction2 = atMatch[2]; // other end of range to try, if any
		// following conditionals still need pathFraction etc as string
		if (adjust == undefined) {
			if (!parametersObject.at) { // given neither adjust nor at
				adjust = Adj.noneClearNear["clear"]; // default adjust clear
			} else {
				if (pathFraction2) { // if given other end of range to try at
					adjust = Adj.noneClearNear["clear"]; // default adjust clear
				} else { // if given one number only
					adjust = Adj.noneClearNear["none"]; // default adjust none
				}
			}
		};
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
				break; // findFirstSiblingLoop
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
					var overlapAndDistances = Adj.overlapAndDistances(oneTranslatedBoundingBox, relativeBoundingBoxes);
					var overlaps = overlapAndDistances.overlaps;
					var distances = overlapAndDistances.distances;
					var sample = {
						pathFraction: onePathFraction
					};
					sample.maxOverlap = Math.max.apply(null, overlaps);
					sample.minDistance = Math.min.apply(null, distances);
					samples.push(sample);
				}
				switch (adjust) {
					case "clear":
						var zeroOverlapSamples = [];
						for (var sampleIndex = 0; sampleIndex < numberOfSamples; sampleIndex++) {
							var oneSample = samples[sampleIndex];
							if (oneSample.maxOverlap == 0) {
								zeroOverlapSamples.push(oneSample);
							}
						}
						var numberOfZeroOverlaps = zeroOverlapSamples.length;
						var bestSample = samples[0];
						if (numberOfZeroOverlaps > 0) { // at least one that doesn't overlap
							for (var sampleIndex = 0; sampleIndex < numberOfZeroOverlaps; sampleIndex++) {
								var oneSample = zeroOverlapSamples[sampleIndex];
								if (oneSample.minDistance > bestSample.minDistance) {
									bestSample = oneSample;
								}
							}
						} else { // not even one that doesn't overlap
							for (var sampleIndex = 0; sampleIndex < numberOfSamples; sampleIndex++) {
								var oneSample = samples[sampleIndex];
								if (oneSample.maxOverlap < bestSample.maxOverlap) {
									bestSample = oneSample;
								}
							}
						}
						bestPathFraction = bestSample.pathFraction;
						break;
					case "near":
						var zeroOverlapSamples = [];
						for (var sampleIndex = 0; sampleIndex < numberOfSamples; sampleIndex++) {
							var oneSample = samples[sampleIndex];
							if (oneSample.maxOverlap == 0) {
								zeroOverlapSamples.push(oneSample);
							}
						}
						var numberOfZeroOverlaps = zeroOverlapSamples.length;
						var bestSample = samples[0];
						if (numberOfZeroOverlaps > 0) { // at least one that doesn't overlap
							for (var sampleIndex = 0; sampleIndex < numberOfZeroOverlaps; sampleIndex++) {
								var oneSample = zeroOverlapSamples[sampleIndex];
								if (bestSample.minDistance < gap) {
									// test whether larger distance
									if (oneSample.minDistance > bestSample.minDistance) {
										bestSample = oneSample;
									}
								} else {
									// test whether closer to gap
									if (oneSample.minDistance < bestSample.minDistance && oneSample.minDistance >= gap) {
										bestSample = oneSample;
									}
								}
							}
						} else { // not even one that doesn't overlap
							for (var sampleIndex = 0; sampleIndex < numberOfSamples; sampleIndex++) {
								var oneSample = samples[sampleIndex];
								if (oneSample.maxOverlap < bestSample.maxOverlap) {
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
					var explanationElement = Adj.createExplanationElement("rect");
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
			var explanationElement = Adj.createExplanationElement("rect");
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
			parent.appendChild(Adj.createExplanationPointCircle(pinX, pinY, "blue"));
			if (considerElementsToAvoid) {
				var pathFractionPoint = Adj.fractionPoint(path, pathFractionLimit);
				parent.appendChild(Adj.createExplanationPointCircle(pathFractionPoint.x, pathFractionPoint.y, "green"));
				var pathFractionPoint = Adj.fractionPoint(path, pathFractionLimit2);
				parent.appendChild(Adj.createExplanationPointCircle(pathFractionPoint.x, pathFractionPoint.y, "red"));
			}
		}
	}
}

// utility
Adj.relativatePath = function relativatePath (pathElement) {
	// get static base values as floating point values, before animation
	var pathSegList = pathElement.pathSegList;
	var numberOfPathSegs = pathSegList.numberOfItems;
	// loop
	var previousCoordinates = document.documentElement.createSVGPoint(); // keep current coordinates
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
				previousOriginalCoordinates.x += pathSeg.x;
				break;
			case 'V': // vertical lineto
				d += pathSegTypeAsLetter.toLowerCase() + Adj.decimal(pathSeg.y - previousCoordinates.y);
				previousCoordinates.y = pathSeg.y;
				break;
			case 'v': // vertical lineto
				d += pathSegTypeAsLetter + Adj.decimal(pathSeg.y);
				previousOriginalCoordinates.y += pathSeg.y;
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
}

// utility
// a specific algorithm
Adj.algorithms.relativate = {
	phaseHandlerName: "adjPhase1Down",
	parameters: [],
	method: function relativate (element, parametersObject) {
		// differntiate simplified cases
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
	}
}

// utility
Adj.circleAroundRect = function circleAroundRect (rect) {
	var x = rect.x;
	var y = rect.y;
	var width = rect.width;
	var height = rect.height;
	return {cx: x + width / 2, cy: y + height / 2, r: Math.sqrt(width * width + height * height) / 2};
}

// utility
Adj.ellipseAroundRect = function ellipseAroundRect (rect) {
	var x = rect.x;
	var y = rect.y;
	var width = rect.width;
	var height = rect.height;
	return {cx: x + width / 2, cy: y + height / 2, rx: width * Math.SQRT1_2, ry: height * Math.SQRT1_2};
}

// a specific algorithm
Adj.algorithms.circleForParent = {
	notAnOrder1Element: true,
	phaseHandlerName: "adjPhase5Down",
	parameters: ["inset"],
	method: function circleForParent (element, parametersObject) {
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
	}
}

// a specific algorithm
Adj.algorithms.ellipseForParent = {
	notAnOrder1Element: true,
	phaseHandlerName: "adjPhase5Down",
	parameters: ["inset", "horizontalInset", "verticalInset"],
	method: function ellipseForParent (element, parametersObject) {
		var usedHow = "used in a parameter for a ellipseForParent command";
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
	}
}

// a specific algorithm
// first element is trunk in the center, could be an empty group, remaining elements are branches
Adj.algorithms.circularList = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["gap", "rGap", "cGap",
				 "fromAngle", "toAngle",
				 "rAlign",
				 "horizontalGap", "leftGap", "rightGap",
				 "verticalGap", "topGap", "bottomGap",
				 "explain"],
	method: function circularList (element, parametersObject) {
		var usedHow = "used in a parameter for a circularList command";
		var variableSubstitutionsByName = {};
		var gap = Adj.doVarsArithmetic(element, parametersObject.gap, 3, null, usedHow, variableSubstitutionsByName); // default gap = 3
		var rGap = Adj.doVarsArithmetic(element, parametersObject.rGap, gap, null, usedHow, variableSubstitutionsByName); // minimum required radial gap, default rGap = gap
		var cGap = Adj.doVarsArithmetic(element, parametersObject.cGap, gap, null, usedHow, variableSubstitutionsByName); // minimum required circumferencial gap, default cGap = gap
		var fromAngle = Adj.doVarsArithmetic(element, parametersObject.fromAngle, 0, null, usedHow, variableSubstitutionsByName); // clockwise, 0 is x axis, default fromAngle = 0
		var toAngle = Adj.doVarsArithmetic(element, parametersObject.toAngle, fromAngle + 360, null, usedHow, variableSubstitutionsByName); // larger than fromAngle is clockwise, default toAngle = fromAngle + 360 means full circle clockwise
		var rAlign = Adj.doVarsArithmetic(element, parametersObject.rAlign, 0.5, Adj.insideMedianOutside, usedHow, variableSubstitutionsByName); // rAlign could be a number, default rAlign 0.5 == median
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
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (!child.getBBox) {
				continue; // skip if not an SVGLocatable, e.g. a <script> element
			}
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement("rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
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
		}
		if (!trunkRecord) { // childRecords.length == 0
			return; // defensive exit
		}
		var numberOfBranches = childRecords.length - 1;
		//
		// process
		// figure angles
		var angleCovered = toAngle - fromAngle
		var clockwise = angleCovered >= 0;
		angleCovered = angleCovered % 360;
		var fullCircle = angleCovered == 0;
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
		if (numberOfSteps >= 1) {
			angleStep = angleCovered / numberOfSteps;
		} else {
			angleStep = 180; // defensive default for later /sin(angleStep/2)
		}
		// figure radius
		var treeRadius = trunkRecord.boundingCircle.r + rGap + maxBranchRadius;
		var necessaryRadius = Math.ceil((maxBranchRadius + cGap / 2) / Math.sin(Math.abs(angleStep) / 2 / 180 * Math.PI));
		if (necessaryRadius > treeRadius) {
			treeRadius = necessaryRadius;
		}
		// now we know where to put it
		var treeCenterX = treeRadius + maxBranchRadius;
		var treeCenterY = treeRadius + maxBranchRadius;
		var currentAngle = fromAngle;
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
			if (childRecord == trunkRecord) {
				placedChildCx = treeCenterX;
				placedChildCy = treeCenterY;
			} else {
				var wiggleR = maxBranchRadius - childBoundingCircleR;
				var currentRadius = treeRadius - wiggleR + rAlign * 2 * wiggleR;
				placedChildCx = treeCenterX + currentRadius * Math.cos(currentAngle / 180 * Math.PI);
				placedChildCy = treeCenterY + currentRadius * Math.sin(currentAngle / 180 * Math.PI);
				currentAngle += angleStep; // increment
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
			var explanationElement = Adj.createExplanationElement("circle");
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
				var explanationElement = Adj.createExplanationElement("circle");
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
	}
}

// a specific algorithm
Adj.algorithms.verticalTree = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["gap",
				 "horizontalGap", "leftGap", "centerGap", "rightGap", "childlessGap", "earGap",
				 "verticalGap", "topGap", "middleGap", "bottomGap",
				 "hAlign", "vAlign",
				 "autoParrots",
				 "explain"],
	method: function verticalTree (element, parametersObject) {
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
				hiddenRect = Adj.createSVGElement("rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
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
			var adjId = child.getAttributeNS(Adj.AdjNamespace, "id"); // first check for preferred attribute adj:id
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
		}
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			var treeParentId = child.getAttributeNS(Adj.AdjNamespace, "treeParent");
			if (treeParentId) {
				var treeParent = idsDictionary[treeParentId];
				if (treeParent) { // an element found with an id matching attribute adj:treeParent, as expected
					treeParent.treeChildRecords.push(childRecord);
					childRecord.treeParentRecord = treeParent;
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
				if (currentSiblingRecordIndex == 0) {
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
					}
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
				if (!autoParrots || maxFurtherDepth == 0) { // avoid more complicated algorithm
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
							if (previousTreeChildFurtherDepth == 0) {
								if (treeChildFurtherDepth > 0) {
									parrotToHead = true;
								} else {
									parrotToParrot = true;
								}
							} else {
								if (treeChildFurtherDepth == 0) {
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
						} else { // treeChildIndex == 0
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
				}
				//
				positioningBox.x = Adj.fraction(0, familyBoxWidth - positioningBoxWidth, hAlign);
				//
				if (currentChildRecord == superRootRecord) {
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
				} else { // stack.length == 0
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
				var suspectId = suspectChild.getAttributeNS(Adj.AdjNamespace, "id") || suspectChild.getAttribute("id");
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
			if (rowIndex == 0) { // roots row
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
				if (currentSiblingRecordIndex == 0) {
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
				} else { // stack.length == 0
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
				var explanationElement = Adj.createExplanationElement("rect");
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
						var explanationElement = Adj.createExplanationElement("path");
						explanationElement.setAttribute("d", explainPathData);
						explanationElement.setAttribute("fill", "white");
						explanationElement.setAttribute("fill-opacity", "0.1");
						explanationElement.setAttribute("stroke", "blue");
						explanationElement.setAttribute("stroke-width", "1");
						explanationElement.setAttribute("stroke-opacity", "0.2");
						element.appendChild(explanationElement);
					} else {
						var explanationElement = Adj.createExplanationElement("rect");
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
					var explanationElement = Adj.createExplanationElement("rect");
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
	}
}

// a specific algorithm
// note: has been made from a copy of verticalTree,
// for the purpose of developing in parallel, naming of variables has been kept similar, which has lead to some naming oddities,
// e.g. a row in this algorithm is vertical, still "a series of objects placed next to each other, usually in a straight line" per AHD
Adj.algorithms.horizontalTree = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["gap",
				 "horizontalGap", "leftGap", "centerGap", "rightGap",
				 "verticalGap", "topGap", "middleGap", "bottomGap", "childlessGap", "earGap",
				 "hAlign", "vAlign",
				 "autoParrots",
				 "explain"],
	method: function horizontalTree (element, parametersObject) {
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
				hiddenRect = Adj.createSVGElement("rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
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
			var adjId = child.getAttributeNS(Adj.AdjNamespace, "id"); // first check for preferred attribute adj:id
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
		}
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			var treeParentId = child.getAttributeNS(Adj.AdjNamespace, "treeParent");
			if (treeParentId) {
				var treeParent = idsDictionary[treeParentId];
				if (treeParent) { // an element found with an id matching attribute adj:treeParent, as expected
					treeParent.treeChildRecords.push(childRecord);
					childRecord.treeParentRecord = treeParent;
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
				if (currentSiblingRecordIndex == 0) {
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
					}
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
				if (!autoParrots || maxFurtherDepth == 0) { // avoid more complicated algorithm
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
							if (previousTreeChildFurtherDepth == 0) {
								if (treeChildFurtherDepth > 0) {
									parrotToHead = true;
								} else {
									parrotToParrot = true;
								}
							} else {
								if (treeChildFurtherDepth == 0) {
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
						} else { // treeChildIndex == 0
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
				}
				//
				positioningBox.y = Adj.fraction(0, familyBoxHeight - positioningBoxHeight, vAlign);
				//
				if (currentChildRecord == superRootRecord) {
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
				} else { // stack.length == 0
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
				var suspectId = suspectChild.getAttributeNS(Adj.AdjNamespace, "id") || suspectChild.getAttribute("id");
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
			if (rowIndex == 0) { // roots row
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
				if (currentSiblingRecordIndex == 0) {
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
				} else { // stack.length == 0
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
				var explanationElement = Adj.createExplanationElement("rect");
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
						var explanationElement = Adj.createExplanationElement("path");
						explanationElement.setAttribute("d", explainPathData);
						explanationElement.setAttribute("fill", "white");
						explanationElement.setAttribute("fill-opacity", "0.1");
						explanationElement.setAttribute("stroke", "blue");
						explanationElement.setAttribute("stroke-width", "1");
						explanationElement.setAttribute("stroke-opacity", "0.2");
						element.appendChild(explanationElement);
					} else {
						var explanationElement = Adj.createExplanationElement("rect");
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
					var explanationElement = Adj.createExplanationElement("rect");
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
				familyBoxY = rowMaxWidth + centerGap; // for next row
				totalWidth += rowMaxWidth;
			}
		}
	}
}

// utility
Adj.firstTimeStoreAuthoringAttribute = function firstTimeStoreAuthoringAttribute (element, name) {
	var value = element.getAttributeNS(Adj.AdjNamespace, name);
	if (!value) { // not any yet
		value = element.getAttribute(name);
		if (value) { // store if any
			element.setAttributeNS(Adj.AdjNamespace, Adj.qualifyName(element, Adj.AdjNamespace, name), value);
		}
	}
}

// utility
Adj.firstTimeStoreAuthoringCoordinates = function firstTimeStoreAuthoringCoordinates (element) {
	if (element instanceof SVGPathElement) {
		Adj.firstTimeStoreAuthoringAttribute(element, "d");
	} else {
		// other types of elements not implemented at this time
	}
}

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
		if (variableValue == undefined) {
			var variableValue = undefined;
			var elementToLookUpIn = element;
			do {
				var variablesAtElement = elementToLookUpIn.adjVariables;
				if (variablesAtElement) {
					variableValue = variablesAtElement[variableName];
				}
				elementToLookUpIn = elementToLookUpIn.parentNode;
			} while (variableValue == undefined && elementToLookUpIn);
			if (variableValue == undefined) {
				throw "nonresolving ^ variable name \"" + variableName + "\" " + usedHow;
			}
			variableValue = variableSubstitutionsByName[variableName] = variableValue;
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
}

// essential
// resolve id arithmetic
Adj.resolveIdArithmetic = function resolveIdArithmetic (element, originalExpression, usedHow, idedElementRecordsById) {
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
		if (idedElementRecord == undefined) {
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
		var isX = false;
		var isY = false;
		var withoutEF = false;
		var needsParameter = false;
		var arithmeticX;
		var arithmeticY;
		switch (arithmeticField) {
			case "x":
				isX = true;
				if (isNaN(arithmeticParameter)) {
					arithmeticX = 0;
				} else {
					needsParameter = true;
					arithmeticX = arithmeticParameter;
				}
				break;
			case "y":
				isY = true;
				if (isNaN(arithmeticParameter)) {
					arithmeticY = 0;
				} else {
					needsParameter = true;
					arithmeticY = arithmeticParameter;
				}
				break;
			case "xw":
				isX = true;
				arithmeticX = 1;
				break;
			case "yh":
				isY = true;
				arithmeticY = 1;
				break;
			case "cx":
				isX = true;
				arithmeticX = 0.5;
				break;
			case "cy":
				isY = true;
				arithmeticY = 0.5;
				break;
			case "w":
				isX = true;
				withoutEF = true;
				break;
			case "h":
				isY = true;
				withoutEF = true;
				break;
			default:
				throw "unknown # field \"" + arithmeticField + "\" " + usedHow;
		}
		if (needsParameter) {
			if (isNaN(arithmeticParameter)) {
				throw "not a number % parameter \"" + arithmeticParameter + "\" " + usedHow;
			}
		}
		var arithmeticBoundingBox = idedElementRecord.boundingBox;
		var matrixFromIdedElement = idedElementRecord.matrixFrom;
		var arithmeticPoint = document.documentElement.createSVGPoint();
		if (!withoutEF) {
			if (isNaN(arithmeticX)) { // unknown for now
				arithmeticX = 0.5;
			}
			if (isNaN(arithmeticY)) { // unknown for now
				arithmeticY = 0.5;
			}
			arithmeticPoint.x = arithmeticBoundingBox.x + arithmeticBoundingBox.width * arithmeticX;
			arithmeticPoint.y = arithmeticBoundingBox.y + arithmeticBoundingBox.height * arithmeticY;
			arithmeticPoint = arithmeticPoint.matrixTransform(matrixFromIdedElement);
		} else { // withoutEF
			// relative coordinates must be transformed without translation's e and f
			var matrixFromIdedElementWithoutEF = idedElementRecord.matrixFromWithoutEF;
			if (matrixFromIdedElementWithoutEF == undefined) {
				var matrixFromIdedElementWithoutEF = idedElementRecord.matrixFromWithoutEF = document.documentElement.createSVGMatrix();
				matrixFromIdedElementWithoutEF.a = matrixFromIdedElement.a;
				matrixFromIdedElementWithoutEF.b = matrixFromIdedElement.b;
				matrixFromIdedElementWithoutEF.c = matrixFromIdedElement.c;
				matrixFromIdedElementWithoutEF.d = matrixFromIdedElement.d;
			}
			arithmeticPoint.x = arithmeticBoundingBox.width;
			arithmeticPoint.y = arithmeticBoundingBox.height;
			arithmeticPoint = arithmeticPoint.matrixTransform(matrixFromIdedElementWithoutEF);
		}
		var arithmeticCoordinate;
		if (isX) {
			arithmeticCoordinate = arithmeticPoint.x;
		} else { // isY
			arithmeticCoordinate = arithmeticPoint.y;
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
}

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
}

// utility
// combine other calls,
// return a string
Adj.doVarsIdsArithmetic = function doVarsIdsArithmetic (element, originalExpression, usedHow, variableSubstitutionsByName, idedElementRecordsById) {
	var withVariablesSubstituted = Adj.substituteVariables(element, originalExpression, usedHow, variableSubstitutionsByName);
	var withIdsResolved = Adj.resolveIdArithmetic(element, withVariablesSubstituted, usedHow, idedElementRecordsById);
	var withArithmeticEvaluated = Adj.evaluateArithmetic(withIdsResolved, usedHow);
	return withArithmeticEvaluated;
}

// utility
// combine other calls,
// return a string
Adj.doVarsArithmetic2 = function doVarsIdsArithmetic (element, originalExpression, usedHow, variableSubstitutionsByName) {
	var withVariablesSubstituted = Adj.substituteVariables(element, originalExpression, usedHow, variableSubstitutionsByName);
	var withArithmeticEvaluated = Adj.evaluateArithmetic(withVariablesSubstituted, usedHow);
	return withArithmeticEvaluated;
}

// utility
// combine other calls,
// return a number
Adj.doVarsArithmetic = function doVarsArithmetic (element, originalExpression, defaultValue, constantsByName, usedHow, variableSubstitutionsByName) {
	if (typeof originalExpression == "number") { // a number already
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
}

// utility
// combine other calls,
// return a boolean
Adj.doVarsBoolean = function doVarsBoolean (element, originalExpression, defaultValue, usedHow, variableSubstitutionsByName) {
	if (typeof originalExpression == "boolean") { // a number already
		return originalExpression;
	}
	if (!originalExpression) { // e.g. undefined
		return defaultValue;
	}
	var withVariablesSubstituted = Adj.substituteVariables(element, originalExpression, usedHow, variableSubstitutionsByName);
	var booleanMatch;
	if (booleanMatch = Adj.booleanRegexp.exec(withVariablesSubstituted)) {
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
}

// a specific algorithm
// note: as implemented works for path
Adj.algorithms.vine = {
	notAnOrder1Element: true,
	phaseHandlerName: "adjPhase7Up",
	parameters: ["explain"],
	method: function vine (element, parametersObject) {
		var usedHow = "used in a parameter for a vine command";
		var variableSubstitutionsByName = {};
		var idedElementRecordsById = {};
		var explain = Adj.doVarsBoolean(element, parametersObject.explain, false, usedHow, variableSubstitutionsByName); // default explain = false
		//
		Adj.unhideByDisplayAttribute(element);
		//
		// differntiate simplified cases
		if (element instanceof SVGPathElement) {
			// an SVG path
			// first time store if first time
			Adj.firstTimeStoreAuthoringCoordinates(element);
			//
			var authoringD = element.getAttributeNS(Adj.AdjNamespace, "d");
			if (!authoringD) {
				authoringD = "";
			}
			var dWithArithmeticEvaluated = Adj.doVarsIdsArithmetic(element, authoringD, "used in attribute adj:d= for a path element", variableSubstitutionsByName, idedElementRecordsById);
			//
			element.setAttribute("d", dWithArithmeticEvaluated);
		} // else { // not a known case, as implemented not transformed
		//
		// explain
		if (explain) {
			if (element instanceof SVGPathElement) {
				// an SVG path
				if (Adj.getPhaseHandlersForElementForName(element, "explain").length == 0) {
					Adj.explainBasicGeometry(element);
				} // else { // don't explain twice
			} // else { // not a known case, as implemented
		}
	}
}

// a specific algorithm
Adj.algorithms.floater = {
	notAnOrder1Element: true,
	phaseHandlerName: "adjPhase3",
	processSubtreeOnlyInPhaseHandler: "adjPhase3",
	parameters: ["at",
				 "pin",
				 "explain"],
	method: function floater (element, parametersObject, level) {
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
		var pinMatch = Adj.oneOrTwoRegexp.exec(parametersObject.pin ? parametersObject.pin : "");
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
			var explanationElement = Adj.createExplanationElement("rect");
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
			var explanationElement = Adj.createExplanationPointCircle(pinX, pinY, "blue");
			explanationElement.setAttribute("transform", elementTransformAttribute);
			parent.appendChild(explanationElement);
		}
	}
}

// a specific algorithm
Adj.algorithms.fit = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["maxWidth", "maxHeight",
				 "width", "height"],
	method: function fit (element, parametersObject) {
		var usedHow = "used in a parameter for a fit command";
		var variableSubstitutionsByName = {};
		var width = Adj.doVarsArithmetic(element, parametersObject.width, null, null, usedHow, variableSubstitutionsByName); // default width = null
		var height = Adj.doVarsArithmetic(element, parametersObject.height, null, null, usedHow, variableSubstitutionsByName); // default height = null
		var maxWidth = Adj.doVarsArithmetic(element, parametersObject.maxWidth, null, null, usedHow, variableSubstitutionsByName); // default maxWidth = null
		var maxHeight = Adj.doVarsArithmetic(element, parametersObject.maxHeight, null, null, usedHow, variableSubstitutionsByName); // default maxHeight = null
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
	}
}

// utility for use inside algorithms
Adj.explainBasicGeometry = function explainBasicGeometry (element) {
	var parent = element.parentNode;
	if (element instanceof SVGPathElement) {
		// an SVG path
		var explainPathData = element.getAttribute("d");
		var explanationElement = Adj.createExplanationElement("path");
		explanationElement.setAttribute("d", explainPathData);
		explanationElement.setAttribute("fill", "none");
		explanationElement.setAttribute("fill-opacity", "0.1");
		explanationElement.setAttribute("stroke", "blue");
		explanationElement.setAttribute("stroke-width", "1");
		explanationElement.setAttribute("stroke-opacity", "0.2");
		parent.appendChild(explanationElement);
		//
		// get static base values as floating point values, before animation
		var pathSegList = element.pathSegList;
		var numberOfPathSegs = pathSegList.numberOfItems;
		var numberOfLastPathSeg = numberOfPathSegs - 1;
		var coordinates = document.documentElement.createSVGPoint();
		var initialCoordinates = document.documentElement.createSVGPoint(); // per sub-path
		var controlPoint = document.documentElement.createSVGPoint();
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
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'm': // moveto, relative
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					initialCoordinates.x = coordinates.x;
					initialCoordinates.y = coordinates.y;
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'L': // lineto, absolute
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'l': // lineto, relative
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'H': // horizontal lineto, absolute
					coordinates.x = pathSeg.x;
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'h': // horizontal lineto, relative
					coordinates.x += pathSeg.x;
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'V': // vertical lineto, absolute
					coordinates.y = pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'v': // vertical lineto, relative
					coordinates.y += pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'C': // cubic Bézier curveto, absolute
					controlPoint.x = pathSeg.x1;
					controlPoint.y = pathSeg.y1;
					parent.appendChild(Adj.createExplanationLine(coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					controlPoint.x = pathSeg.x2;
					controlPoint.y = pathSeg.y2;
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationLine(controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'c': // cubic Bézier curveto, relative
					controlPoint.x = coordinates.x + pathSeg.x1;
					controlPoint.y = coordinates.y + pathSeg.y1;
					parent.appendChild(Adj.createExplanationLine(coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					controlPoint.x = coordinates.x + pathSeg.x2;
					controlPoint.y = coordinates.y + pathSeg.y2;
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationLine(controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'S': // smooth cubic curveto, absolute
					controlPoint.x = 2 * coordinates.x - controlPoint.x;
					controlPoint.y = 2 * coordinates.y - controlPoint.y;
					parent.appendChild(Adj.createExplanationLine(coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					controlPoint.x = pathSeg.x2;
					controlPoint.y = pathSeg.y2;
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationLine(controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 's': // smooth cubic curveto, relative
					controlPoint.x = 2 * coordinates.x - controlPoint.x;
					controlPoint.y = 2 * coordinates.y - controlPoint.y;
					parent.appendChild(Adj.createExplanationLine(coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					controlPoint.x = coordinates.x + pathSeg.x2;
					controlPoint.y = coordinates.y + pathSeg.y2;
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationLine(controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'Q': // quadratic Bézier curveto, absolute

					controlPoint.x = pathSeg.x1;
					controlPoint.y = pathSeg.y1;
					parent.appendChild(Adj.createExplanationLine(coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					parent.appendChild(Adj.createExplanationLine(controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'q': // quadratic Bézier curveto, relative
					controlPoint.x = coordinates.x + pathSeg.x1;
					controlPoint.y = coordinates.y + pathSeg.y1;
					parent.appendChild(Adj.createExplanationLine(coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					parent.appendChild(Adj.createExplanationLine(controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'T': // smooth quadratic curveto, absolute
					controlPoint.x = 2 * coordinates.x - controlPoint.x;
					controlPoint.y = 2 * coordinates.y - controlPoint.y;
					parent.appendChild(Adj.createExplanationLine(coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					parent.appendChild(Adj.createExplanationLine(controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 't': // smooth quadratic curveto, relative
					controlPoint.x = 2 * coordinates.x - controlPoint.x;
					controlPoint.y = 2 * coordinates.y - controlPoint.y;
					parent.appendChild(Adj.createExplanationLine(coordinates.x, coordinates.y, controlPoint.x, controlPoint.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(controlPoint.x, controlPoint.y, "blue"));
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					parent.appendChild(Adj.createExplanationLine(controlPoint.x, controlPoint.y, coordinates.x, coordinates.y, "blue"));
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'A': // elliptical arc, absolute
					coordinates.x = pathSeg.x;
					coordinates.y = pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				case 'a': // elliptical arc, relative
					coordinates.x += pathSeg.x;
					coordinates.y += pathSeg.y;
					parent.appendChild(Adj.createExplanationPointCircle(coordinates.x, coordinates.y, pointCircleFill));
					break;
				default:
			}
		}
	}
}

// a specific algorithm
// note: as implemented works for path
Adj.algorithms.explain = {
	phaseHandlerName: "adjPhase7Up",
	parameters: [],
	method: function explain (element, parametersObject) {
		// differntiate simplified cases
		if (element instanceof SVGPathElement) {
			// an SVG path
			Adj.explainBasicGeometry(element);
		} // else { // not a known case, as implemented
	}
}

// a specific algorithm
Adj.algorithms.stackFrames = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["inset",
				 "horizontalInset", "leftInset", "rightInset",
				 "verticalInset", "topInset", "bottomInset",
				 "stacking", "frame", "subject"],
	method: function stackFrames (element, parametersObject) {
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
			if (index == frame) {
				frame = child; // now an SVGElement instead of a number
			}
			if (index == subject) {
				subject = child; // now an SVGElement instead of a number
			}
			index++;
		}
		if (!(frame instanceof SVGElement)) { // maybe childRecords.length == 0
			return; // defensive exit
		}
		if (!(subject instanceof SVGElement)) { // maybe childRecords.length == 0
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
	}
}

// a specific algorithm
Adj.algorithms.zoomFrames = {
	notAnOrder1Element: true,
	phaseHandlerName: "adjPhase5Down",
	parameters: ["from", "to",
				 "step"],
	method: function zoomFrames (element, parametersObject) {
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
				if (sibling == element) { // at element self
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
				if (sibling == element) { // at element self
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
		var fromTopLeft = document.documentElement.createSVGPoint();
		fromTopLeft.x = fromBoundingBox.x;
		fromTopLeft.y = fromBoundingBox.y;
		fromTopLeft = fromTopLeft.matrixTransform(matrixFromFromElement);
		var fromTopRight = document.documentElement.createSVGPoint();
		fromTopRight.x = fromBoundingBox.x + fromBoundingBox.width;
		fromTopRight.y = fromBoundingBox.y;
		fromTopRight = fromTopRight.matrixTransform(matrixFromFromElement);
		var fromBottomLeft = document.documentElement.createSVGPoint();
		fromBottomLeft.x = fromBoundingBox.x;
		fromBottomLeft.y = fromBoundingBox.y + fromBoundingBox.height;
		fromBottomLeft = fromBottomLeft.matrixTransform(matrixFromFromElement);
		var fromBottomRight = document.documentElement.createSVGPoint();
		fromBottomRight.x = fromBoundingBox.x + fromBoundingBox.width;
		fromBottomRight.y = fromBoundingBox.y + fromBoundingBox.height;
		fromBottomRight = fromBottomRight.matrixTransform(matrixFromFromElement);
		//
		var toBoundingBox = toElement.getBBox();
		var matrixFromToElement = toElement.getTransformToElement(element);
		var toTopLeft = document.documentElement.createSVGPoint();
		toTopLeft.x = toBoundingBox.x;
		toTopLeft.y = toBoundingBox.y;
		toTopLeft = toTopLeft.matrixTransform(matrixFromToElement);
		var toTopRight = document.documentElement.createSVGPoint();
		toTopRight.x = toBoundingBox.x + toBoundingBox.width;
		toTopRight.y = toBoundingBox.y;
		toTopRight = toTopRight.matrixTransform(matrixFromToElement);
		var toBottomLeft = document.documentElement.createSVGPoint();
		toBottomLeft.x = toBoundingBox.x;
		toBottomLeft.y = toBoundingBox.y + toBoundingBox.height;
		toBottomLeft = toBottomLeft.matrixTransform(matrixFromToElement);
		var toBottomRight = document.documentElement.createSVGPoint();
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
	}
}

// a specific algorithm
Adj.algorithms.tilt = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["alpha", "beta"],
	method: function tilt (element, parametersObject) {
		var usedHow = "used in a parameter for a tilt command";
		var variableSubstitutionsByName = {};
		var alpha = Adj.doVarsArithmetic(element, parametersObject.alpha, 30, null, usedHow, variableSubstitutionsByName); // default alpha = 30
		var beta = Adj.doVarsArithmetic(element, parametersObject.beta, 0, null, usedHow, variableSubstitutionsByName); // default beta = 0
		//
		alpha = alpha / 180 * Math.PI;
		beta = beta / 180 * Math.PI;
		var a = Math.cos(alpha);
		var b = Math.sin(alpha);
		var c = -Math.sin(beta);
		var d = Math.cos(beta);
		var e = 0;
		var f = 0;
		element.setAttribute("transform", "matrix(" + Adj.decimal(a) + "," + Adj.decimal(b) + "," + Adj.decimal(c) + "," + Adj.decimal(d) + "," + Adj.decimal(e) + "," + Adj.decimal(f) + ")");
	}
}

// a specific algorithm
Adj.algorithms.skimpyList = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["gap",
				 "horizontalGap", "leftGap", "rightGap",
				 "verticalGap", "topGap", "bottomGap"],
	method: function skimpyList (element, parametersObject) {
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
				hiddenRect = Adj.createSVGElement("rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
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
		minLeft = minLeft ? minLeft : 0;
		minTop = minTop ? minTop : 0;
		maxRight = maxRight ? maxRight : 0;
		maxBottom = maxBottom ? maxBottom : 0;
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
	}
}

// a specific algorithm
Adj.algorithms.pinnedList = {
	phaseHandlerName: "adjPhase1Up",
	parameters: ["gap",
				 "horizontalGap", "leftGap", "rightGap",
				 "verticalGap", "topGap", "bottomGap"],
	method: function pinnedList (element, parametersObject) {
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
				hiddenRect = Adj.createSVGElement("rect", {adjPlacementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjNotAnOrder1Element) {
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
			var pinThisParameter = child.getAttributeNS(Adj.AdjNamespace, "pinThis");
			var pinToParameter = child.getAttributeNS(Adj.AdjNamespace, "pinTo");
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
					if (pinToSiblingIndex == -1) {
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
				var pinToPoint = document.documentElement.createSVGPoint();
				pinToPoint.x = pinToBoundingBox.x + pinToBoundingBox.width * pinToX;
				pinToPoint.y = pinToBoundingBox.y + pinToBoundingBox.height * pinToY;
				pinToPoint = pinToPoint.matrixTransform(matrixFromPinToElement);
				//
				var pinThisBoundingBox = pinThisElement.getBBox();
				var matrixFromPinThisElement = pinThisElement.getTransformToElement(pinThisSibling);
				var pinThisPoint = document.documentElement.createSVGPoint();
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
		minLeft = minLeft ? minLeft : 0;
		minTop = minTop ? minTop : 0;
		maxRight = maxRight ? maxRight : 0;
		maxBottom = maxBottom ? maxBottom : 0;
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
	}
}

// visual exception display
Adj.displayException = function displayException (exception, svgElement) {
	var rootElement = document.documentElement;
	for (var child = rootElement.firstChild; child; child = child.nextSibling) {
		if (!(child instanceof SVGElement)) {
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		if (!child.getBBox) {
			continue; // skip if not an SVGLocatable, e.g. a <script> element
		}
		Adj.hideByDisplayAttribute(child); // make invisible but don't delete
	}
	var exceptionString = exception.toString();
	var exceptionElement = Adj.createExplanationElement("g", true);
	rootElement.appendChild(exceptionElement);
	var exceptionTextElement = Adj.createSVGElement("text");
	exceptionTextElement.appendChild(document.createTextNode(exceptionString));
	exceptionTextElement.setAttribute("fill", "red");
	exceptionTextElement.setAttribute("style", "fill:red;");
	exceptionElement.appendChild(exceptionTextElement);
	// fix up
	Adj.algorithms.textBreaks.method(exceptionElement,{lineBreaks:true});
	Adj.algorithms.verticalList.method(exceptionElement,{});
	var svgElementBoundingBox = svgElement.getBBox();
	svgElement.setAttribute("width", Adj.decimal(svgElementBoundingBox.width));
	svgElement.setAttribute("height", Adj.decimal(svgElementBoundingBox.height));
}
