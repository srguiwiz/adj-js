//
// Copyright (c) 2002-2012, Nirvana Research
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
// Comments to: <adj.feedback AT nrvr DOT com>
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
	Adj.version = { major:2 };
	Adj.algorithms = {};
}

// constants
Adj.SvgNamespace = "http://www.w3.org/2000/svg"
Adj.AdjNamespace = "http://www.nrvr.com/2012/adj";

// complete processing of all phases
Adj.processAdjElements = function processAdjElements(documentNodeOrRootElement) {
	var rootElement;
	if (documentNodeOrRootElement.documentElement) {
		rootElement = documentNodeOrRootElement.documentElement;
	} else {
		rootElement = documentNodeOrRootElement;
	}
	try {
		//
		// remove certain nodes for a new start, in case any such are present from earlier processing
		Adj.modifyMaybeRemoveChildren
		(rootElement,
		 function(node,child) {
			var adjFields = child.adjFields || (child.adjFields = {}); // ensure there is an adjFields object
			if (adjFields.explanationArtifact || child.getAttributeNS(Adj.AdjNamespace, "explanation")) {
				adjFields.explanationArtifact = true;
				adjFields.removeElement = true;
			}
		 });
		//
		// read Adj elements and make or update phase handlers
		Adj.adjElementsToPhaseHandlers(rootElement);
		//
		// then process
		Adj.processSvgElement(rootElement);
	} catch (exception) {
		Adj.displayException(exception, rootElement);
		throw exception;
	}
}

// shortcut
Adj.doDoc = function doDoc() {
	Adj.processAdjElements(document);
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
	var phaseHandlers = target.adjFields.phaseHandlers;
	phaseHandlers = phaseHandlers || {}; // if no phaseHandlers yet then new associative array object
	var phaseHandlersForThisName = phaseHandlers[phaseHandlerName];
	phaseHandlersForThisName = phaseHandlersForThisName || []; // if no phaseHandlersForThisName yet then new array
	phaseHandlersForThisName.push(phaseHandler);
	phaseHandlers[phaseHandlerName] = phaseHandlersForThisName;
	target.adjFields.phaseHandlers = phaseHandlers;
	if (algorithm.notAnOrder1Element) {
		element.adjFields.notAnOrder1Element = true;
		element.setAttribute("display", "none"); // try being cleverer ?
	}
	if (algorithm.processSubtreeOnlyInPhaseHandler) {
		element.adjFields.processSubtreeOnlyInPhaseHandler = algorithm.processSubtreeOnlyInPhaseHandler; // try being cleverer ?
	}
}

// constants
// recognize a boolean or decimal
Adj.booleanOrDecimalRegexp = /^\s*(true|false|[+-]?(?:[0-9]*\.)?[0-9]+)\s*$/;

// recursive walking of the tree
Adj.adjElementsToPhaseHandlers = function adjElementsToPhaseHandlers (node) {
	// first clear adjFields for a new start
	node.adjFields = {};
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
						var value = attribute.value;
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
						parameters[attribute.localName] = value;
					}
				}
				Adj.setAlgorithm(node, algorithmName, parameters);
				continue;
			}
		}
		if (child instanceof SVGElement) {
			Adj.adjElementsToPhaseHandlers(child); // recursion
		} // else skip if not an SVGElement, e.g. an XML #text
	}
}

// complete processing of all phases
Adj.processSvgElement = function processSvgElement(svgElement) {
	Adj.processElement(svgElement);
	// a singleton
	var svgElementBoundingBox = svgElement.getBBox();
	svgElement.setAttribute("width", Adj.decimal(svgElementBoundingBox.x + svgElementBoundingBox.width));
	svgElement.setAttribute("height", Adj.decimal(svgElementBoundingBox.y + svgElementBoundingBox.height));
	// necessary cleanup
	Adj.modifyMaybeRemoveChildren
	(svgElement,
	 function(node,child) {
		var adjFields = child.adjFields;
		if (adjFields.placementArtifact) {
			// remove certain nodes that have been created for use during processing
			adjFields.removeElement = true;
			return;
		}
		if (adjFields.explanationArtifact) {
			child.removeAttribute("display"); // try being cleverer ?
		}
	 });
}

// complete processing of all phases
Adj.processElement = function processElement(element, level, thisTimeFullyProcessSubtree) {
	Adj.walkNodes(element, "adjPhase1", level, thisTimeFullyProcessSubtree);
	Adj.walkNodes(element, "adjPhase2", level, thisTimeFullyProcessSubtree);
	Adj.walkNodes(element, "adjPhase3", level, thisTimeFullyProcessSubtree);
}

// recursive walking of the tree
Adj.walkNodes = function walkNodes (node, phaseName, level, thisTimeFullyProcessSubtree) {
	level = level || 0; // if no level given then 0
	//console.log("phase " + phaseName + " level " + level + " going into " + node.nodeName);
	//
	var phaseHandlers = node.adjFields.phaseHandlers;
	//
	var processSubtreeOnlyInPhaseHandler = node.adjFields.processSubtreeOnlyInPhaseHandler;
	if (processSubtreeOnlyInPhaseHandler) { // e.g. a rider
		if (!thisTimeFullyProcessSubtree) { // first time getting here
			if (processSubtreeOnlyInPhaseHandler != phaseName) {
				return; // skip
			} else { // processSubtreeOnlyInPhaseHandler == phaseName
				if (phaseHandlers) {
					var subtreePhaseHandlerName = phaseName;
					var phaseHandlersForSubtreeName = phaseHandlers[subtreePhaseHandlerName];
					if (phaseHandlersForSubtreeName) { // e.g. a rider
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
		Adj.walkNodes(child, phaseName, level + 1); // recursion
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
		var conditionValue = modifyMaybeMarkFunctionOfNodeAndChild(node,child);
		var adjFields = child.adjFields;
		if (adjFields // adjFields exists
			&& adjFields.removeElement) {
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
Adj.fraction = function fraction (one, other, fraction, roundNoCloser, roundIfIntegers) {
	roundNoCloser = roundNoCloser != undefined ? roundNoCloser : 0; // default roundNoCloser = 0
	roundIfIntegers = roundIfIntegers != undefined ? roundIfIntegers : true; // default roundIfInteger = true
	var fraction = one + (other - one) * fraction;
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
Adj.createSVGElement = function createSVGElement (name, adjFields) {
	var svgElement = document.createElementNS(Adj.SvgNamespace, name);
	svgElement.adjFields = adjFields || {}; // ensure there is an adjFields object
	return svgElement;
}

// utility
Adj.createExplanationElement = function createExplanationElement (name, dontDisplayNone) {
	var explanationElement = Adj.createSVGElement(name, {explanationArtifact:true});
	explanationElement.setAttributeNS(Adj.AdjNamespace, "explanation", "true");
	if (!dontDisplayNone) {
		explanationElement.setAttribute("display", "none"); // try being cleverer ?
	}
	return explanationElement;
}

// a specific algorithm
Adj.algorithms.verticalList = {
	phaseHandlerName: "adjPhase1Up",
	method: function verticalList (element, parametersObject) {
		var gap = !isNaN(parametersObject.gap) ? parametersObject.gap : 3; // default gap = 3
		var horizontalGap = !isNaN(parametersObject.horizontalGap) ? parametersObject.horizontalGap : gap; // default horizontalGap = gap
		var leftGap = !isNaN(parametersObject.leftGap) ? parametersObject.leftGap : horizontalGap; // default leftGap = horizontalGap
		var rightGap = !isNaN(parametersObject.rightGap) ? parametersObject.rightGap : horizontalGap; // default rightGap = horizontalGap
		var centerGap = !isNaN(parametersObject.centerGap) ? parametersObject.centerGap : !isNaN(parametersObject.horizontalGap) ? parametersObject.horizontalGap : !isNaN(parametersObject.gap) ? parametersObject.gap : (leftGap + rightGap) / 2;
		var verticalGap = !isNaN(parametersObject.verticalGap) ? parametersObject.verticalGap : gap; // default verticalGap = gap
		var topGap = !isNaN(parametersObject.topGap) ? parametersObject.topGap : verticalGap; // default topGap = verticalGap
		var bottomGap = !isNaN(parametersObject.bottomGap) ? parametersObject.bottomGap : verticalGap; // default bottomGap = verticalGap
		var middleGap = !isNaN(parametersObject.middleGap) ? parametersObject.middleGap : !isNaN(parametersObject.verticalGap) ? parametersObject.verticalGap : !isNaN(parametersObject.gap) ? parametersObject.gap : (topGap + bottomGap) / 2;
		var maxHeight = !isNaN(parametersObject.maxHeight) ? parametersObject.maxHeight : null; // allowed, default maxHeight = null means no limit
		var maxPerColumn = !isNaN(parametersObject.maxPerColumn) ? parametersObject.maxPerColumn : null; // allowed, default maxPerColumn = null means no limit
		var makeGrid = parametersObject.makeGrid ? true : false; // default makeGrid = false
		var hAlign = !isNaN(parametersObject.hAlign) ? parametersObject.hAlign : Adj.leftCenterRight[parametersObject.hAlign]; // hAlign could be a number
		if (hAlign == undefined) { hAlign = Adj.leftCenterRight["left"]; }; // default hAlign left
		var vAlign = !isNaN(parametersObject.vAlign) ? parametersObject.vAlign : Adj.topMiddleBottom[parametersObject.vAlign]; // vAlign could be a number
		if (vAlign == undefined) { vAlign = Adj.topMiddleBottom["top"]; }; // default vAlign top
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
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement("rect", {placementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjFields.notAnOrder1Element) {
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
				if (element.adjFields.explain) {
					var explainPathData = "m" +
						Adj.decimal(currentChildX) + "," + Adj.decimal(currentChildY) + " " +
						Adj.decimal(widthToUse) + "," + Adj.decimal(0) + " " +
						Adj.decimal(0) + "," + Adj.decimal(heightToUse) + " " +
						Adj.decimal(-widthToUse) + "," + Adj.decimal(0) + " " +
						Adj.decimal(0) + "," + Adj.decimal(-heightToUse) + " ";
					childRecord.explainPathData = explainPathData;
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
		if (element.adjFields.explain) {
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
				var explainPathData = childRecord.explainPathData;
				if (explainPathData) {
					var explanationElement = Adj.createExplanationElement("path");
					explanationElement.setAttribute("d", explainPathData);
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
Adj.algorithms.horizontalList = {
	phaseHandlerName: "adjPhase1Up",
	method: function horizontalList (element, parametersObject) {
		var gap = !isNaN(parametersObject.gap) ? parametersObject.gap : 3; // default gap = 3
		var horizontalGap = !isNaN(parametersObject.horizontalGap) ? parametersObject.horizontalGap : gap; // default horizontalGap = gap
		var leftGap = !isNaN(parametersObject.leftGap) ? parametersObject.leftGap : horizontalGap; // default leftGap = horizontalGap
		var rightGap = !isNaN(parametersObject.rightGap) ? parametersObject.rightGap : horizontalGap; // default rightGap = horizontalGap
		var centerGap = !isNaN(parametersObject.centerGap) ? parametersObject.centerGap : !isNaN(parametersObject.horizontalGap) ? parametersObject.horizontalGap : !isNaN(parametersObject.gap) ? parametersObject.gap : (leftGap + rightGap) / 2;
		var verticalGap = !isNaN(parametersObject.verticalGap) ? parametersObject.verticalGap : gap; // default verticalGap = gap
		var topGap = !isNaN(parametersObject.topGap) ? parametersObject.topGap : verticalGap; // default topGap = verticalGap
		var bottomGap = !isNaN(parametersObject.bottomGap) ? parametersObject.bottomGap : verticalGap; // default bottomGap = verticalGap
		var middleGap = !isNaN(parametersObject.middleGap) ? parametersObject.middleGap : !isNaN(parametersObject.verticalGap) ? parametersObject.verticalGap : !isNaN(parametersObject.gap) ? parametersObject.gap : (topGap + bottomGap) / 2;
		var maxWidth = !isNaN(parametersObject.maxWidth) ? parametersObject.maxWidth : null; // allowed, default maxWidth = null means no limit
		var maxPerRow = !isNaN(parametersObject.maxPerRow) ? parametersObject.maxPerRow : null; // allowed, default maxPerRow = null means no limit
		var makeGrid = parametersObject.makeGrid ? true : false; // default makeGrid = false
		var hAlign = !isNaN(parametersObject.hAlign) ? parametersObject.hAlign : Adj.leftCenterRight[parametersObject.hAlign]; // hAlign could be a number
		if (hAlign == undefined) { hAlign = Adj.leftCenterRight["left"]; }; // default hAlign left
		var vAlign = !isNaN(parametersObject.vAlign) ? parametersObject.vAlign : Adj.topMiddleBottom[parametersObject.vAlign]; // vAlign could be a number
		if (vAlign == undefined) { vAlign = Adj.topMiddleBottom["top"]; }; // default vAlign top
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
			if (!hiddenRect) { // needs a hidden rect, chose to require it to be first
				// make hidden rect
				hiddenRect = Adj.createSVGElement("rect", {placementArtifact:true});
				hiddenRect.setAttribute("width", 0);
				hiddenRect.setAttribute("height", 0);
				hiddenRect.setAttribute("visibility", "hidden");
				element.insertBefore(hiddenRect, child);
			}
			if (child.adjFields.notAnOrder1Element) {
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
				if (element.adjFields.explain) {
					var explainPathData = "m" +
						Adj.decimal(currentChildX) + "," + Adj.decimal(currentChildY) + " " +
						Adj.decimal(widthToUse) + "," + Adj.decimal(0) + " " +
						Adj.decimal(0) + "," + Adj.decimal(heightToUse) + " " +
						Adj.decimal(-widthToUse) + "," + Adj.decimal(0) + " " +
						Adj.decimal(0) + "," + Adj.decimal(-heightToUse) + " ";
					childRecord.explainPathData = explainPathData;
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
		if (element.adjFields.explain) {
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
				var explainPathData = childRecord.explainPathData;
				if (explainPathData) {
					var explanationElement = Adj.createExplanationElement("path");
					explanationElement.setAttribute("d", explainPathData);
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
	phaseHandlerName: "adjPhase2Down",
	method: function frameForParent (element, parametersObject) {
		var inset = !isNaN(parametersObject.inset) ? parametersObject.inset : 0.5; // default inset = 0.5
		var horizontalInset = !isNaN(parametersObject.horizontalInset) ? parametersObject.horizontalInset : inset; // default horizontalInset = inset
		var verticalInset = !isNaN(parametersObject.verticalInset) ? parametersObject.verticalInset : inset; // default verticalInset = inset
		var leftInset = !isNaN(parametersObject.leftInset) ? parametersObject.leftInset : horizontalInset; // default leftInset = horizontalInset
		var rightInset = !isNaN(parametersObject.rightInset) ? parametersObject.rightInset : horizontalInset; // default rightInset = horizontalInset
		var topInset = !isNaN(parametersObject.topInset) ? parametersObject.topInset : verticalInset; // default topInset = verticalInset
		var bottomInset = !isNaN(parametersObject.bottomInset) ? parametersObject.bottomInset : verticalInset; // default bottomInset = verticalInset
		var parent = element.parentNode;
		var parentBoundingBox = parent.getBBox();
		element.setAttribute("x", Adj.decimal(parentBoundingBox.x + leftInset));
		element.setAttribute("y", Adj.decimal(parentBoundingBox.y + topInset));
		element.setAttribute("width", Adj.decimal(parentBoundingBox.width - leftInset - rightInset));
		element.setAttribute("height", Adj.decimal(parentBoundingBox.height - topInset - bottomInset));
		element.removeAttribute("display"); // try being cleverer ?
	}
}

// utility
// a specific algorithm
Adj.algorithms.explain = {
	phaseHandlerName: "adjPhase1Down",
	method: function explain (element, parametersObject) {
		element.adjFields.explain = true;
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
						newSibling.adjFields = {};
						newSibling.textContent = broken.shift();
						element.insertBefore(newSibling, child);
					}
					child.textContent = broken[0];
				}
			}
		}
	}
}

// constants
// parse an id and optionally two more parameters, e.g. full "obj1, 0.5, 1" or less specific "obj2"
// note: as implemented tolerates extra paremeters
Adj.idXYRegexp = /^\s*([^,\s]+)\s*(?:,\s*([^,\s]+)\s*)?(?:,\s*([^,\s]+)\s*)?(?:,.*)?$/;
// parse one or two parameters, e.g. "0.5, 1" or only "0.3"
// note: as implemented tolerates extra paremeters
Adj.oneOrTwoRegexp = /^\s*([^,\s]+)\s*(?:,\s*([^,\s]+)\s*)?(?:,.*)?$/;

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
	var value;
	value = element.getAttributeNS(Adj.AdjNamespace, name);
	if (value) { // restore if any
		element.setAttribute(name, value);
	} else {
		value = element.getAttribute(name);
		if (value) { // store if any
			element.setAttributeNS(Adj.AdjNamespace, name, value);
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
	phaseHandlerName: "adjPhase2Up",
	method: function connection (element, parametersObject) {
		var fromMatch = Adj.idXYRegexp.exec(parametersObject.from);
		var fromId = fromMatch[1];
		var fromX = fromMatch[2] ? parseFloat(fromMatch[2]) : 0.5; // default fromX = 0.5
		var fromY = fromMatch[3] ? parseFloat(fromMatch[3]) : 0.5; // default fromY = 0.5
		var toMatch = Adj.idXYRegexp.exec(parametersObject.to);
		var toId = toMatch[1];
		var toX = toMatch[2] ? parseFloat(toMatch[2]) : 0.5; // default toX = 0.5
		var toY = toMatch[3] ? parseFloat(toMatch[3]) : 0.5; // default toY = 0.5
		var vector = !isNaN(parametersObject.vector) ? parametersObject.vector : 0; // default vector = 0
		//
		element.removeAttribute("display"); // try being cleverer ?
		//
		// what to connect
		var fromElement = document.getElementById(fromId);
		var fromBoundingBox = fromElement.getBBox();
		var matrixFromFromElement = fromElement.getTransformToElement(element);
		var fromPoint = document.documentElement.createSVGPoint();
		fromPoint.x = fromBoundingBox.x + fromBoundingBox.width * fromX;
		fromPoint.y = fromBoundingBox.y + fromBoundingBox.height * fromY;
		fromPoint = fromPoint.matrixTransform(matrixFromFromElement);
		//
		var toElement = document.getElementById(toId);
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
				if (child.adjFields.notAnOrder1Element) { // e.g. a rider
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
				} else { // not a known case, as implemented not transformed
				}
			}
		}
		//
		// explain
		if (element.adjFields.explain) {
			var parent = element.parentNode;
			var explanationElement = Adj.createExplanationElement("rect");
			explanationElement.setAttribute("x", fromBoundingBox.x);
			explanationElement.setAttribute("y", fromBoundingBox.y);
			explanationElement.setAttribute("width", fromBoundingBox.width);
			explanationElement.setAttribute("height", fromBoundingBox.height);
			explanationElement.transform.baseVal.initialize(document.documentElement.createSVGTransformFromMatrix(matrixFromFromElement));
			explanationElement.setAttribute("fill", "green");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "green");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			parent.appendChild(explanationElement);
			var explanationElement = Adj.createExplanationElement("circle");
			explanationElement.setAttribute("cx", fromPoint.x);
			explanationElement.setAttribute("cy", fromPoint.y);
			explanationElement.setAttribute("r", 3);
			explanationElement.setAttribute("fill", "green");
			explanationElement.setAttribute("fill-opacity", "0.2");
			explanationElement.setAttribute("stroke", "none");
			parent.appendChild(explanationElement);
			var explanationElement = Adj.createExplanationElement("rect");
			explanationElement.setAttribute("x", toBoundingBox.x);
			explanationElement.setAttribute("y", toBoundingBox.y);
			explanationElement.setAttribute("width", toBoundingBox.width);
			explanationElement.setAttribute("height", toBoundingBox.height);
			explanationElement.transform.baseVal.initialize(document.documentElement.createSVGTransformFromMatrix(matrixFromToElement));
			explanationElement.setAttribute("fill", "red");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "red");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			parent.appendChild(explanationElement);
			var explanationElement = Adj.createExplanationElement("circle");
			explanationElement.setAttribute("cx", toPoint.x);
			explanationElement.setAttribute("cy", toPoint.y);
			explanationElement.setAttribute("r", 3);
			explanationElement.setAttribute("fill", "red");
			explanationElement.setAttribute("fill-opacity", "0.2");
			explanationElement.setAttribute("stroke", "none");
			parent.appendChild(explanationElement);
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
	} else { // not a known case, as implemented not transformed
	}
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
	} else { // not a known case, as implemented
	}
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
		if (sibling == element) {
			continue; // don't avoid self
		}
		var adjFields = sibling.adjFields;
		if (adjFields.placementArtifact) {
			continue;
		}
		if (adjFields.notAnOrder1Element) {
			continue;
		}
		if (adjFields.explanationArtifact) {
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
		var oneBoundingBox = oneElement.getBBox();
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
	phaseHandlerName: "adjPhase3",
	processSubtreeOnlyInPhaseHandler: "adjPhase3",
	method: function rider (element, parametersObject, level) {
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
		var gap = !isNaN(parametersObject.gap) ? parametersObject.gap : 3; // for adjust near, default gap = 3
		var pinMatch = Adj.oneOrTwoRegexp.exec(parametersObject.pin ? parametersObject.pin : "");
		var hFraction = pinMatch ? parseFloat(pinMatch[1]) : 0.5; // default hFraction = 0.5
		var vFraction = pinMatch ? parseFloat(pinMatch[2]) : 0.5; // default vFraction = 0.5
		var numberOfSamples = !isNaN(parametersObject.steps) ? parametersObject.steps + 1 : 11; // for adjust, default steps = 10, which makes numberOfSamples = 11
		if (numberOfSamples < 4) { // sanity check
			numberOfSamples = 4;
		}
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
			path = document.getElementById(pathId);
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
		element.removeAttribute("display"); // try being cleverer ?
		Adj.processElement(element, level, true); // process subtree separately, i.e. now
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
		if (element.adjFields.explain) {
			var parent = element.parentNode;
			var elementTransformAttribute = element.getAttribute("transform");
			if (considerElementsToAvoid) {
				for (var oneRelativeBoundingBoxIndex in relativeBoundingBoxes) {
					var oneRelativeBoundingBox = relativeBoundingBoxes[oneRelativeBoundingBoxIndex];
					var explanationElement = Adj.createExplanationElement("rect");
					explanationElement.setAttribute("x", oneRelativeBoundingBox.x);
					explanationElement.setAttribute("y", oneRelativeBoundingBox.y);
					explanationElement.setAttribute("width", oneRelativeBoundingBox.width);
					explanationElement.setAttribute("height", oneRelativeBoundingBox.height);
					explanationElement.setAttribute("fill", "orange");
					explanationElement.setAttribute("fill-opacity", "0.1");
					explanationElement.setAttribute("stroke", "orange");
					explanationElement.setAttribute("stroke-width", "1");
					explanationElement.setAttribute("stroke-opacity", "0.2");
					parent.appendChild(explanationElement);
				}
			}
			var explanationElement = Adj.createExplanationElement("rect");
			explanationElement.setAttribute("x", boundingBox.x);
			explanationElement.setAttribute("y", boundingBox.y);
			explanationElement.setAttribute("width", boundingBox.width);
			explanationElement.setAttribute("height", boundingBox.height);
			explanationElement.setAttribute("transform", elementTransformAttribute);
			explanationElement.setAttribute("fill", "blue");
			explanationElement.setAttribute("fill-opacity", "0.1");
			explanationElement.setAttribute("stroke", "blue");
			explanationElement.setAttribute("stroke-width", "1");
			explanationElement.setAttribute("stroke-opacity", "0.2");
			parent.appendChild(explanationElement);
			var explanationElement = Adj.createExplanationElement("circle");
			explanationElement.setAttribute("cx", pinX);
			explanationElement.setAttribute("cy", pinY);
			explanationElement.setAttribute("r", 3);
			explanationElement.setAttribute("transform", elementTransformAttribute);
			explanationElement.setAttribute("fill", "blue");
			explanationElement.setAttribute("fill-opacity", "0.2");
			explanationElement.setAttribute("stroke", "none");
			parent.appendChild(explanationElement);
			if (considerElementsToAvoid) {
				var pathFractionPoint = Adj.fractionPoint(path, pathFractionLimit);
				var explanationElement = Adj.createExplanationElement("circle");
				explanationElement.setAttribute("cx", pathFractionPoint.x);
				explanationElement.setAttribute("cy", pathFractionPoint.y);
				explanationElement.setAttribute("r", 3);
				explanationElement.setAttribute("fill", "green");
				explanationElement.setAttribute("fill-opacity", "0.2");
				explanationElement.setAttribute("stroke", "none");
				parent.appendChild(explanationElement);
				var pathFractionPoint = Adj.fractionPoint(path, pathFractionLimit2);
				var explanationElement = Adj.createExplanationElement("circle");
				explanationElement.setAttribute("cx", pathFractionPoint.x);
				explanationElement.setAttribute("cy", pathFractionPoint.y);
				explanationElement.setAttribute("r", 3);
				explanationElement.setAttribute("fill", "red");
				explanationElement.setAttribute("fill-opacity", "0.2");
				explanationElement.setAttribute("stroke", "none");
				parent.appendChild(explanationElement);
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
				if (child instanceof SVGPathElement) {
					// an SVG path
					Adj.relativatePath(child);
				} else { // not a known case, as implemented not relativated
				}
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
	phaseHandlerName: "adjPhase2Down",
	method: function circleForParent (element, parametersObject) {
		var inset = !isNaN(parametersObject.inset) ? parametersObject.inset : 0; // default inset = 0
		var parent = element.parentNode;
		var parentBoundingBox = parent.getBBox();
		var parentBoundingCircle = Adj.circleAroundRect(parentBoundingBox);
		element.setAttribute("cx", Adj.decimal(parentBoundingCircle.cx));
		element.setAttribute("cy", Adj.decimal(parentBoundingCircle.cy));
		element.setAttribute("r", Adj.decimal(parentBoundingCircle.r - inset));
		element.removeAttribute("display"); // try being cleverer ?
	}
}

// a specific algorithm
Adj.algorithms.ellipseForParent = {
	notAnOrder1Element: true,
	phaseHandlerName: "adjPhase2Down",
	method: function ellipseForParent (element, parametersObject) {
		var inset = !isNaN(parametersObject.inset) ? parametersObject.inset : 0; // default inset = 0
		var horizontalInset = !isNaN(parametersObject.horizontalInset) ? parametersObject.horizontalInset : inset; // default horizontalInset = inset
		var verticalInset = !isNaN(parametersObject.verticalInset) ? parametersObject.verticalInset : inset; // default verticalInset = inset
		var parent = element.parentNode;
		var parentBoundingBox = parent.getBBox();
		var parentBoundingEllipse = Adj.ellipseAroundRect(parentBoundingBox);
		element.setAttribute("cx", Adj.decimal(parentBoundingEllipse.cx));
		element.setAttribute("cy", Adj.decimal(parentBoundingEllipse.cy));
		element.setAttribute("rx", Adj.decimal(parentBoundingEllipse.rx - horizontalInset));
		element.setAttribute("ry", Adj.decimal(parentBoundingEllipse.ry - verticalInset));
		element.removeAttribute("display"); // try being cleverer ?
	}
}

// a specific algorithm
// first element is trunk in the center, could be an empty group, remaining elements are branches
Adj.algorithms.circularList = {
	phaseHandlerName: "adjPhase1Up",
	method: function circularList (element, parametersObject) {
		var gap = !isNaN(parametersObject.gap) ? parametersObject.gap : 3; // default gap = 3
		var rGap = !isNaN(parametersObject.rGap) ? parametersObject.rGap : gap; // minimum required radial gap, default rGap = gap
		var cGap = !isNaN(parametersObject.cGap) ? parametersObject.cGap : gap; // minimum required circumferencial gap, default cGap = gap
		var fromAngle = !isNaN(parametersObject.fromAngle) ? parametersObject.fromAngle : 0; // clockwise, 0 is x axis, default fromAngle = 0
		var toAngle = !isNaN(parametersObject.toAngle) ? parametersObject.toAngle : fromAngle + 360; // larger than fromAngle is clockwise, default toAngle = fromAngle + 360 means full circle clockwise
		var rAlign = !isNaN(parametersObject.rAlign) ? parametersObject.rAlign : Adj.insideMedianOutside[parametersObject.rAlign]; // rAlign could be a number
		if (rAlign == undefined) { rAlign = Adj.insideMedianOutside["median"]; }; // default rAlign median
		//
		// determine which nodes to process,
		// children that are instances of SVGElement rather than every DOM node,
		// also skipping notAnOrder1Element
		var trunkRecord;
		var childRecords = [];
		var maxBranchRadius = 0;
		for (var child = element.firstChild; child; child = child.nextSibling) {
			if (!(child instanceof SVGElement)) {
				continue; // skip if not an SVGElement, e.g. an XML #text
			}
			if (child.adjFields.notAnOrder1Element) {
				continue;
			}
			var boundingBox = child.getBBox();
			var boundingCircle = Adj.circleAroundRect(boundingBox);
			childRecords.push({
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
		if (numberOfSteps > 1) {
			angleStep = angleCovered / numberOfSteps;
		} else {
			angleStep = 180; // defensive default for later /sin(angleStep/2)
		}
		// figure radius
		var treeRadius = trunkRecord.boundingCircle.r + rGap + maxBranchRadius;
		var necessaryRadius = (maxBranchRadius + cGap / 2) / Math.sin(Math.abs(angleStep) / 2 / 180 * Math.PI);
		if (necessaryRadius > treeRadius) {
			treeRadius = necessaryRadius;
		}
		// now we know where to put it
		var treeCenterX = treeRadius + maxBranchRadius;
		var treeCenterY = treeRadius + maxBranchRadius;
		var currentAngle = fromAngle;
		var minPlacedChildBoundingCircleX = 2 * treeCenterX;
		var minPlacedChildBoundingCircleY = 2 * treeCenterY;
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
			childRecord.translationX = placedChildCx - childBoundingCircle.cx;
			childRecord.translationY = placedChildCy - childBoundingCircle.cy;
			// figure how to fix up translations to be top left aligned
			var placedChildBoundingCircleX = placedChildCx - childBoundingCircleR;
			var placedChildBoundingCircleY = placedChildCy - childBoundingCircleR;
			if (placedChildBoundingCircleX < minPlacedChildBoundingCircleX) {
				minPlacedChildBoundingCircleX = placedChildBoundingCircleX;
			}
			if (placedChildBoundingCircleY < minPlacedChildBoundingCircleY) {
				minPlacedChildBoundingCircleY = placedChildBoundingCircleY;
			}
			// explain
			if (element.adjFields.explain) {
				childRecord.explainCircle = {
					cx: placedChildCx,
					cy: placedChildCy,
					r: childBoundingCircle.r
				};
			}
		}
		// how to fix up translations to be top left aligned
		var topLeftAlignmentFixX = minPlacedChildBoundingCircleX;
		var topLeftAlignmentFixY = minPlacedChildBoundingCircleY;
		// then apply the respective translations, but fixed up translations to be top left aligned
		for (var childRecordIndex in childRecords) {
			var childRecord = childRecords[childRecordIndex];
			var child = childRecord.node;
			var translationX = childRecord.translationX - topLeftAlignmentFixX;
			var translationY = childRecord.translationY - topLeftAlignmentFixY;
			child.setAttribute("transform", "translate(" + Adj.decimal(translationX) + "," + Adj.decimal(translationY) + ")");
		}
		//
		// explain
		if (element.adjFields.explain) {
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

// visual exception display
Adj.displayException = function displayException (exception, svgElement) {
	var rootElement = document.documentElement;
	for (var child = rootElement.firstChild; child; child = child.nextSibling) {
		if (!(child instanceof SVGElement)) {
			continue; // skip if not an SVGElement, e.g. an XML #text
		}
		child.setAttribute("display", "none"); // make invisible but don't delete
	}
	var exceptionString = exception.toString();
	var exceptionElement = Adj.createExplanationElement("g", true);
	rootElement.appendChild(exceptionElement);
	var exceptionTextElement = Adj.createSVGElement("text");
	exceptionTextElement.appendChild(document.createTextNode(exceptionString));
	exceptionTextElement.setAttribute("fill", "red");
	exceptionElement.appendChild(exceptionTextElement);
	// fix up
	Adj.algorithms.textBreaks.method(exceptionElement,{lineBreaks:true});
	Adj.algorithms.verticalList.method(exceptionElement,{});
	var svgElementBoundingBox = svgElement.getBBox();
	svgElement.setAttribute("width", svgElementBoundingBox.width);
	svgElement.setAttribute("height", svgElementBoundingBox.height);
}